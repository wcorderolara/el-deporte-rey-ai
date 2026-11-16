import {
  ImportCapabilitiesResponseSchema,
  ExternalSeasonListResponseSchema,
  ImportPreviewResponseSchema,
  ProblemSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { competition, fixtureDocument, season, stage, stubAdapter } from '../../providers/sports/test/synthetic.js';
import {
  READ_HEADERS,
  WRITE_HEADERS,
  projectsTestApp,
  testSources,
  type ProjectsTestApp,
} from '../projects/test/support.js';

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

async function makeCompetition() {
  const response = await h!.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name: 'Copa local' },
  });
  expect(response.statusCode).toBe(201);
  const competition = response.json() as { id: string };
  const binding = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competition.id}/provider-binding`,
    headers: WRITE_HEADERS,
    payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'provider' },
  });
  expect(binding.statusCode).toBe(201);
  return competition.id;
}

describe('competition read-normalize-preview API', () => {
  it('normalizes an external stage title and reuses a valid preview for the same scope', async () => {
    const stub = stubAdapter('test-live', 'LIVE_DATA');
    stub.documents.set(
      'stub-a',
      fixtureDocument([
        competition('copa-stub', 'Copa Stub', [
          season('2026', [stage({ id: 'regular', name: 'REGULAR_SEASON', order: 1, matchdays: [1] })]),
        ]),
      ]),
    );
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }), stub });
    const id = await makeCompetition();
    const path = `/api/v1/competitions/${id}/import-previews`;
    const payload = { externalSeasonId: '2026', resources: ['stages', 'rounds', 'matches'] };
    const [first, concurrent] = await Promise.all([
      h.inject({ method: 'POST', url: path, headers: WRITE_HEADERS, payload }),
      h.inject({ method: 'POST', url: path, headers: WRITE_HEADERS, payload }),
    ]);
    expect(first.statusCode, first.body).toBe(201);
    const original = ImportPreviewResponseSchema.parse(first.json()).preview;
    expect(concurrent.statusCode, concurrent.body).toBe(201);
    expect(ImportPreviewResponseSchema.parse(concurrent.json()).preview.previewId).toBe(original.previewId);
    expect(original.items.find((item) => item.resource === 'stages')).toMatchObject({ title: 'REGULAR SEASON' });
    const reads = h.stub.count('stub-a', 'fetchSelection');
    const second = await h.inject({ method: 'POST', url: path, headers: WRITE_HEADERS, payload });
    expect(second.statusCode, second.body).toBe(201);
    expect(ImportPreviewResponseSchema.parse(second.json()).preview.previewId).toBe(original.previewId);
    expect(h.stub.count('stub-a', 'fetchSelection')).toBe(reads);
    expect(
      h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_import_previews').get()?.count,
    ).toBe(1);
    h.db
      .prepare('UPDATE competition_import_previews SET expires_at = ? WHERE id = ?')
      .run(['2000-01-01T00:00:00.000Z', original.previewId]);
    const afterExpiry = await h.inject({ method: 'POST', url: path, headers: WRITE_HEADERS, payload });
    expect(afterExpiry.statusCode, afterExpiry.body).toBe(201);
    expect(ImportPreviewResponseSchema.parse(afterExpiry.json()).preview.previewId).not.toBe(original.previewId);
    expect(
      h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_import_previews').get()?.count,
    ).toBe(1);
  });
  it('lists external seasons and season-specific resource capabilities', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const id = await makeCompetition();
    const seasonsResponse = await h.inject({
      method: 'GET',
      url: `/api/v1/competitions/${id}/provider-binding/seasons`,
      headers: READ_HEADERS,
    });
    expect(seasonsResponse.statusCode).toBe(200);
    const seasons = ExternalSeasonListResponseSchema.parse(seasonsResponse.json()).seasons;
    expect(seasons.map((season) => season.externalSeasonId)).toContain('2026');
    const capsResponse = await h.inject({
      method: 'GET',
      url: `/api/v1/competitions/${id}/provider-binding/seasons/2026/capabilities`,
      headers: READ_HEADERS,
    });
    expect(capsResponse.statusCode).toBe(200);
    const caps = ImportCapabilitiesResponseSchema.parse(capsResponse.json()).capabilities;
    expect(caps.find((item) => item.resource === 'matches')?.available).toBe(true);
    expect(caps.find((item) => item.resource === 'participants')?.available).toBe(true);
  });

  it('creates an immutable normalized preview without mutating sports-domain rows and reopens it without a provider read', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const id = await makeCompetition();
    const local = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${id}/seasons`,
      headers: WRITE_HEADERS,
      payload: { label: '2026/27' },
    });
    const localSeasonId = (local.json() as { id: string }).id;
    const existingGlobalTeam = await h.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: WRITE_HEADERS,
      payload: { name: 'Club Alfa' },
    });
    expect(existingGlobalTeam.statusCode).toBe(201);
    const path = `/api/v1/competitions/${id}/import-previews`;
    const counts = () =>
      h!.db
        .prepare<{
          seasons: number;
          teams: number;
          competitionTeams: number;
          participants: number;
          stages: number;
          rounds: number;
          matches: number;
          results: number;
          history: number;
        }>(
          'SELECT (SELECT COUNT(*) FROM competition_seasons) AS seasons, (SELECT COUNT(*) FROM managed_teams) AS teams, (SELECT COUNT(*) FROM competition_teams) AS competitionTeams, (SELECT COUNT(*) FROM season_participants) AS participants, (SELECT COUNT(*) FROM competition_stages) AS stages, (SELECT COUNT(*) FROM competition_rounds) AS rounds, (SELECT COUNT(*) FROM competition_matches) AS matches, (SELECT COUNT(*) FROM match_results) AS results, (SELECT COUNT(*) FROM match_result_history) AS history',
        )
        .get();
    const before = counts();
    const response = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: {
        externalSeasonId: '2026',
        destinationSeasonId: localSeasonId,
        resources: ['season', 'teams', 'participants', 'stages', 'rounds', 'matches', 'results'],
      },
    });
    expect(response.statusCode, response.body).toBe(201);
    const preview = ImportPreviewResponseSchema.parse(response.json()).preview;
    expect(preview.summary.new).toBeGreaterThan(0);
    expect(preview.items.some((item) => item.resource === 'matches')).toBe(true);
    const matchItem = preview.items.find((item) => item.resource === 'matches');
    expect(matchItem?.relationships.map((reference) => reference.role)).toEqual(
      expect.arrayContaining(['season', 'home_team', 'away_team', 'stage', 'round']),
    );
    const resultItem = preview.items.find((item) => item.resource === 'results');
    expect(resultItem?.relationships).toEqual([
      expect.objectContaining({ role: 'match', externalId: expect.any(String) }),
    ]);
    expect(preview.warnings.every((warning) => warning.occurrenceCount > 0)).toBe(true);
    expect(
      preview.items.some(
        (item) =>
          item.resource === 'teams' && item.operation === 'conflict' && item.localCandidate?.label === 'Club Alfa',
      ),
    ).toBe(true);
    expect(
      preview.items.some(
        (item) => item.resource === 'results' && item.fields.some((field) => field.incomingValue === '0-0'),
      ),
    ).toBe(true);
    expect(preview).toMatchObject({ stale: false, externalSeasonId: '2026' });
    const resultsOnly = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', destinationSeasonId: localSeasonId, resources: ['results'] },
    });
    expect(resultsOnly.statusCode, resultsOnly.body).toBe(201);
    const resultPreview = ImportPreviewResponseSchema.parse(resultsOnly.json()).preview;
    expect(resultPreview.items.some((item) => item.resource === 'results')).toBe(true);
    expect(resultPreview.items.every((item) => item.resource === 'results')).toBe(true);
    const after = counts();
    expect(after).toEqual(before);
    const selectionsBefore = h.stub.count('stub-a', 'fetchSelection');
    const legacyPreview = {
      ...preview,
      warnings: Array.from(
        { length: 29 },
        () => 'Una o más selecciones no contienen resultados finalizados disponibles.',
      ),
      items: preview.items.map(({ relationships: _relationships, ...item }) => item),
    };
    h.db
      .prepare('UPDATE competition_import_previews SET preview_json = ? WHERE id = ?')
      .run([JSON.stringify(legacyPreview), preview.previewId]);
    const opened = await h.inject({ method: 'GET', url: `${path}/${preview.previewId}`, headers: READ_HEADERS });
    expect(opened.statusCode).toBe(200);
    const reopenedPreview = ImportPreviewResponseSchema.parse(opened.json()).preview;
    expect(reopenedPreview.snapshotHash).toBe(preview.snapshotHash);
    expect(reopenedPreview.warnings).toMatchObject([
      { occurrenceCount: 29, severity: 'info', affectedExternalIds: [] },
    ]);
    expect(reopenedPreview.items.every((item) => item.relationships.length === 0)).toBe(true);
    expect(h.stub.count('stub-a', 'fetchSelection')).toBe(selectionsBefore);
    await h.inject({
      method: 'PATCH',
      url: `/api/v1/competitions/${id}/seasons/${localSeasonId}`,
      headers: WRITE_HEADERS,
      payload: { label: '2026-27' },
    });
    const stale = await h.inject({ method: 'GET', url: `${path}/${preview.previewId}`, headers: READ_HEADERS });
    expect(ImportPreviewResponseSchema.parse(stale.json()).preview.stale).toBe(true);
  });

  it('rejects unsupported or invalid scopes and reports expired previews', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const id = await makeCompetition();
    const missingCompetition = await h.inject({
      method: 'GET',
      url: '/api/v1/competitions/00000000-0000-4000-8000-0000000000ff/provider-binding/seasons',
      headers: READ_HEADERS,
    });
    expect(missingCompetition.statusCode).toBe(404);
    const invalid = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${id}/import-previews`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: 'not-real', resources: ['matches'] },
    });
    expect(invalid.statusCode).toBe(404);
    expect(ProblemSchema.parse(invalid.json()).code).toBe('NOT_FOUND');
    const created = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${id}/import-previews`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['matches'] },
    });
    expect(created.statusCode).toBe(201);
    const preview = ImportPreviewResponseSchema.parse(created.json()).preview;
    h.db
      .prepare('UPDATE competition_import_previews SET expires_at = ? WHERE id = ?')
      .run(['2000-01-01T00:00:00.000Z', preview.previewId]);
    const expired = await h.inject({
      method: 'GET',
      url: `/api/v1/competitions/${id}/import-previews/${preview.previewId}`,
      headers: READ_HEADERS,
    });
    expect(expired.statusCode).toBe(410);
    expect(ProblemSchema.parse(expired.json()).code).toBe('IMPORT_PREVIEW_EXPIRED');
    expect(
      h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_import_previews').get()?.count,
    ).toBe(0);
  });

  it('prepares a new external season without requiring or creating a local destination', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const id = await makeCompetition();
    const response = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${id}/import-previews`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['season'] },
    });
    expect(response.statusCode, response.body).toBe(201);
    const preview = ImportPreviewResponseSchema.parse(response.json()).preview;
    expect(preview.destinationSeasonId).toBeNull();
    expect(preview.items[0]).toMatchObject({ resource: 'season', operation: 'new', localCandidate: null });
    expect(
      h.db
        .prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_seasons WHERE competition_id = ?')
        .get([id])?.count,
    ).toBe(0);
  });
});
