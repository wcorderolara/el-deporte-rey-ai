import {
  ImportApplyOperationResponseSchema,
  ImportApplyOperationStartResponseSchema,
  ImportApplyPlanResponseSchema,
  ImportPreviewResponseSchema,
  ProblemSchema,
  type ImportApplyDecision,
  type ImportApplyOperation,
  type ImportApplyPlan,
} from '@edr/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { competition, fixtureDocument, season, selection, stubAdapter } from '../../providers/sports/test/synthetic.js';
import {
  READ_HEADERS,
  WRITE_HEADERS,
  projectsTestApp,
  testSources,
  type ProjectsTestApp,
} from '../projects/test/support.js';
import { CompetitionCalendarService } from './calendar/application/CompetitionCalendarService.js';
import { CompetitionImportApplyService } from './import-apply.js';
import { CompetitionImportPreviewService } from './import-preview.js';

/** Mutating requests without a body must not declare a JSON content type. */
const NO_BODY = { host: WRITE_HEADERS.host, origin: WRITE_HEADERS.origin, 'x-edr-client': 'web' };
const ALL = ['season', 'teams', 'participants', 'stages', 'rounds', 'matches', 'results'];
type FixtureMatch = {
  key: string;
  home: string;
  away: string;
  kickoff: string;
  status: string;
  score: { home: number; away: number } | null;
};
const ROUND_1: FixtureMatch[] = [
  {
    key: 'm1',
    home: 'alfa',
    away: 'beta',
    kickoff: '2026-10-20T18:00:00Z',
    status: 'finished',
    score: { home: 2, away: 1 },
  },
  {
    key: 'm2',
    home: 'gamma',
    away: 'delta',
    kickoff: '2026-10-20T20:00:00Z',
    status: 'finished',
    score: { home: 0, away: 0 },
  },
];
const ROUND_2: FixtureMatch[] = [
  { key: 'm3', home: 'beta', away: 'alfa', kickoff: '2026-10-27T18:00:00Z', status: 'scheduled', score: null },
  { key: 'm4', home: 'delta', away: 'gamma', kickoff: '2026-10-27T20:00:00Z', status: 'scheduled', score: null },
];

/** One stage with two numbered matchdays whose matches are distinct (the shared fixture repeats them). */
function document(round2: FixtureMatch[] = ROUND_2) {
  const day = (matchday: number, matches: FixtureMatch[]) => ({
    ...(selection({ stage: 'REGULAR_SEASON', matchday }) as Record<string, unknown>),
    matches: matches.map((match) => ({
      matchKey: match.key,
      homeTeamKey: match.home,
      awayTeamKey: match.away,
      kickoff: match.kickoff,
      status: match.status,
      score: match.score,
      ref: `fixture:synthetic/selection#${match.key}`,
    })),
  });
  return fixtureDocument([
    competition('copa-stub', 'Copa Stub', [
      season('2026', [
        {
          id: 'regular',
          name: 'REGULAR_SEASON',
          order: 1,
          standings: 'expected',
          wholeStage: null,
          matchdays: { '1': day(1, ROUND_1), '2': day(2, round2) },
        },
      ]),
    ]),
  ]);
}

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await h?.close();
  h = undefined;
});

async function setup(mode: 'provider' | 'hybrid' = 'provider') {
  const stub = stubAdapter('test-live', 'LIVE_DATA');
  stub.documents.set('stub-a', document());
  h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }), stub });
  const created = await h.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name: 'Liga importada' },
  });
  expect(created.statusCode).toBe(201);
  const competitionId = (created.json() as { id: string }).id;
  const bound = await h.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/provider-binding`,
    headers: WRITE_HEADERS,
    payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode },
  });
  expect(bound.statusCode, bound.body).toBe(201);
  return competitionId;
}

async function preview(competitionId: string, resources = ALL, destinationSeasonId: string | null = null) {
  const response = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-previews`,
    headers: WRITE_HEADERS,
    payload: { externalSeasonId: '2026', destinationSeasonId, resources },
  });
  expect(response.statusCode, response.body).toBe(201);
  return ImportPreviewResponseSchema.parse(response.json()).preview;
}

async function plan(competitionId: string, previewId: string, decisions: ImportApplyDecision[] = []) {
  const response = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-previews/${previewId}/application-plan`,
    headers: WRITE_HEADERS,
    payload: { decisions },
  });
  expect(response.statusCode, response.body).toBe(200);
  return ImportApplyPlanResponseSchema.parse(response.json()).plan;
}

function start(competitionId: string, previewId: string, planHash: string, decisions: ImportApplyDecision[] = []) {
  return h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-previews/${previewId}/applications`,
    headers: WRITE_HEADERS,
    payload: { decisions, planHash },
  });
}

async function settle(competitionId: string, operationId: string): Promise<ImportApplyOperation> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-applications/${operationId}`,
      headers: READ_HEADERS,
    });
    expect(response.statusCode, response.body).toBe(200);
    const operation = ImportApplyOperationResponseSchema.parse(response.json()).operation;
    if (['completed', 'failed', 'cancelled'].includes(operation.status)) return operation;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('application did not finish');
}

async function apply(competitionId: string, previewId: string, decisions: ImportApplyDecision[] = []) {
  const current = await plan(competitionId, previewId, decisions);
  expect(current.blockers).toEqual([]);
  const accepted = await start(competitionId, previewId, current.planHash, decisions);
  expect(accepted.statusCode, accepted.body).toBe(202);
  const operation = ImportApplyOperationStartResponseSchema.parse(accepted.json()).operation;
  return settle(competitionId, operation.operationId);
}

function count(table: string): number {
  const queries: Record<string, string> = {
    seasons: 'SELECT COUNT(*) AS n FROM competition_seasons',
    teams: 'SELECT COUNT(*) AS n FROM managed_teams',
    competitionTeams: 'SELECT COUNT(*) AS n FROM competition_teams',
    participants: 'SELECT COUNT(*) AS n FROM season_participants',
    stages: 'SELECT COUNT(*) AS n FROM competition_stages',
    rounds: 'SELECT COUNT(*) AS n FROM competition_rounds',
    matches: 'SELECT COUNT(*) AS n FROM competition_matches',
    history: 'SELECT COUNT(*) AS n FROM match_result_history',
    mappings: 'SELECT COUNT(*) AS n FROM external_identity_mappings',
    applications: 'SELECT COUNT(*) AS n FROM competition_import_applications',
  };
  return h!.db.prepare<{ n: number }>(queries[table]!).get()!.n;
}
function snapshotCounts() {
  return Object.fromEntries(
    [
      'seasons',
      'teams',
      'competitionTeams',
      'participants',
      'stages',
      'rounds',
      'matches',
      'history',
      'mappings',
      'applications',
    ].map((table) => [table, count(table)]),
  );
}
function matchRow(home: string, away: string) {
  return h!.db
    .prepare<{
      id: string;
      season_id: string;
      status: string;
      kickoff_at: string | null;
      home_score: number | null;
      away_score: number | null;
      round: string | null;
      stage: string | null;
    }>(
      'SELECT m.id, m.season_id, m.status, m.kickoff_at, r.home_score, r.away_score, ro.name AS round, st.name AS stage FROM competition_matches m JOIN match_results r ON r.match_id = m.id JOIN managed_teams h ON h.id = m.home_team_id JOIN managed_teams a ON a.id = m.away_team_id LEFT JOIN competition_rounds ro ON ro.id = m.round_id LEFT JOIN competition_stages st ON st.id = m.stage_id WHERE h.name = ? AND a.name = ?',
    )
    .get([home, away]);
}
function itemFor(current: ImportApplyPlan, resource: string, externalId: string) {
  return current.reviewItems.find((item) => item.resource === resource && item.externalId === externalId);
}

describe('confirmed import application', () => {
  it('keeps manual competitions editable without a provider and records local provenance', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const competition = await h.inject({
      method: 'POST',
      url: '/api/v1/competitions',
      headers: WRITE_HEADERS,
      payload: { name: 'Liga manual' },
    });
    const competitionId = (competition.json() as { id: string }).id;
    const created = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/seasons`,
      headers: WRITE_HEADERS,
      payload: { label: '2026' },
    });
    const seasonId = (created.json() as { id: string }).id;
    const updated = await h.inject({
      method: 'PATCH',
      url: `/api/v1/competitions/${competitionId}/seasons/${seasonId}`,
      headers: WRITE_HEADERS,
      payload: { label: '2026/27' },
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(
      h.db
        .prepare<{ origin: string; manual_override: number }>(
          "SELECT origin, manual_override FROM sports_field_provenance WHERE competition_id = ? AND entity_type = 'season' AND entity_id = ? AND field_name = 'label'",
        )
        .get([competitionId, seasonId]),
    ).toEqual({ origin: 'manual', manual_override: 0 });
    expect(
      h.db.prepare('SELECT 1 FROM competition_provider_bindings WHERE competition_id = ?').get([competitionId]),
    ).toBeUndefined();
  });

  it('imports a complete season into the local model from the stored snapshot only', async () => {
    const competitionId = await setup();
    const snapshot = await preview(competitionId);
    const reads = h!.stub.count('stub-a', 'fetchSelection');
    const current = await plan(competitionId, snapshot.previewId);
    expect(current).toMatchObject({ ready: true, destinationIsNew: true, destinationLabel: '2026/27', blockers: [] });
    expect(current.counts).toMatchObject({ seasonsCreated: 1, teamsCreated: 4, matchesCreated: 4, resultsApplied: 2 });
    expect(snapshotCounts()).toMatchObject({ seasons: 0, teams: 0, matches: 0, mappings: 0 });

    const operation = await apply(competitionId, snapshot.previewId);
    expect(operation.status, operation.errorMessage ?? '').toBe('completed');
    expect(operation.completedStages).toEqual(['validating', 'resolving_identities', 'transforming']);
    expect(h!.stub.count('stub-a', 'fetchSelection')).toBe(reads);
    const application = operation.application!;
    expect(application.counts).toEqual({
      seasonsCreated: 1,
      teamsCreated: 4,
      teamsReused: 0,
      associationsCreated: 4,
      participantsCreated: 4,
      stagesCreated: 1,
      roundsCreated: 2,
      matchesCreated: 4,
      matchesUpdated: 0,
      resultsApplied: 2,
      mappingsCreated: 12,
      unchanged: 0,
      skipped: 0,
      conflictsNotApplied: 0,
    });
    expect(snapshotCounts()).toEqual({
      seasons: 1,
      teams: 4,
      competitionTeams: 4,
      participants: 4,
      stages: 1,
      rounds: 2,
      matches: 4,
      history: 6,
      mappings: 12,
      applications: 1,
    });
    const seasonRow = h!.db
      .prepare<{ id: string; label: string }>('SELECT id, label FROM competition_seasons WHERE competition_id = ?')
      .get([competitionId])!;
    expect(seasonRow.label).toBe('2026/27');
    expect(application.destinationSeasonId).toBe(seasonRow.id);
    // Visible stage title follows the local contract; the opaque provider label is kept on the mapping.
    expect(h!.db.prepare<{ name: string }>('SELECT name FROM competition_stages').get()?.name).toBe('REGULAR SEASON');
    expect(
      h!.db
        .prepare<{ external_label: string }>(
          "SELECT external_label FROM external_identity_mappings WHERE resource = 'stages'",
        )
        .get()?.external_label,
    ).toBe('REGULAR_SEASON');
    expect(
      h!.db
        .prepare<{ name: string; display_order: number }>(
          'SELECT name, display_order FROM competition_rounds ORDER BY display_order',
        )
        .all(),
    ).toEqual([
      { name: 'Jornada 1', display_order: 0 },
      { name: 'Jornada 2', display_order: 1 },
    ]);
    expect(matchRow('Club Alfa', 'Club Beta')).toMatchObject({
      season_id: seasonRow.id,
      status: 'finished',
      kickoff_at: '2026-10-20T18:00:00.000Z',
      home_score: 2,
      away_score: 1,
      round: 'Jornada 1',
      stage: 'REGULAR SEASON',
    });
    // `0-0` is an explicit result; an unknown provider score stays unknown.
    expect(matchRow('Club Gamma', 'Club Delta')).toMatchObject({ status: 'finished', home_score: 0, away_score: 0 });
    expect(matchRow('Club Beta', 'Club Alfa')).toMatchObject({
      status: 'scheduled',
      home_score: null,
      away_score: null,
      round: 'Jornada 2',
    });
    // The result is readable again without re-applying it.
    const again = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-applications/${operation.operationId}`,
      headers: READ_HEADERS,
    });
    expect(ImportApplyOperationResponseSchema.parse(again.json()).operation.application).toEqual(application);
    // Local views read the persisted rows immediately.
    const matches = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/seasons/${seasonRow.id}/matches`,
      headers: READ_HEADERS,
    });
    expect(matches.statusCode, matches.body).toBe(200);
    expect((matches.json() as { matches: unknown[] }).matches).toHaveLength(4);
  });

  it('is idempotent for double submissions, retries and a second snapshot of the same season', async () => {
    const competitionId = await setup();
    const snapshot = await preview(competitionId);
    const current = await plan(competitionId, snapshot.previewId);
    const [first, second] = await Promise.all([
      start(competitionId, snapshot.previewId, current.planHash),
      start(competitionId, snapshot.previewId, current.planHash),
    ]);
    expect(first.statusCode, first.body).toBe(202);
    expect(second.statusCode, second.body).toBe(202);
    const firstId = ImportApplyOperationStartResponseSchema.parse(first.json()).operation.operationId;
    expect(ImportApplyOperationStartResponseSchema.parse(second.json()).operation.operationId).toBe(firstId);
    const completed = await settle(competitionId, firstId);
    expect(completed.status).toBe('completed');
    const after = snapshotCounts();
    const retry = await start(competitionId, snapshot.previewId, current.planHash);
    expect(retry.statusCode).toBe(202);
    expect(ImportApplyOperationStartResponseSchema.parse(retry.json()).operation).toMatchObject({
      operationId: firstId,
      status: 'completed',
    });
    expect(snapshotCounts()).toEqual(after);

    // A fresh snapshot of the same provider season resolves every record through the persisted mappings.
    const refreshed = await preview(competitionId);
    const replan = await plan(competitionId, refreshed.previewId);
    expect(replan.destinationSeasonId).toBe(completed.application!.destinationSeasonId);
    expect(replan.totals).toMatchObject({ create: 0, blocked: 0, update: 0 });
    const reapplied = await apply(competitionId, refreshed.previewId);
    expect(reapplied.application!.counts).toMatchObject({
      seasonsCreated: 0,
      teamsCreated: 0,
      teamsReused: 4,
      matchesCreated: 0,
      resultsApplied: 0,
      mappingsCreated: 0,
    });
    expect(snapshotCounts()).toEqual({ ...after, applications: 2 });
  });

  it('updates values that still match the imported baseline and protects manual edits', async () => {
    const competitionId = await setup('hybrid');
    const first = await apply(competitionId, (await preview(competitionId)).previewId);
    const seasonId = first.application!.destinationSeasonId;
    // A manual correction of a provider result becomes protected local data.
    const manual = matchRow('Club Alfa', 'Club Beta')!;
    const corrected = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/seasons/${seasonId}/matches/${manual.id}/result`,
      headers: WRITE_HEADERS,
      payload: { status: 'finished', homeScore: 3, awayScore: 1 },
    });
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(
      h!.db
        .prepare<{ field_name: string; origin: string; manual_override: number }>(
          "SELECT field_name, origin, manual_override FROM sports_field_provenance WHERE competition_id = ? AND entity_type = 'result' AND entity_id = ? ORDER BY field_name",
        )
        .all([competitionId, manual.id]),
    ).toEqual([
      { field_name: 'awayScore', origin: 'manual_override', manual_override: 1 },
      { field_name: 'homeScore', origin: 'manual_override', manual_override: 1 },
    ]);
    const provenanceResponse = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/provenance/result/${manual.id}`,
      headers: READ_HEADERS,
    });
    expect(provenanceResponse.statusCode, provenanceResponse.body).toBe(200);
    expect(provenanceResponse.json()).toMatchObject({
      fields: [
        { field: 'awayScore', origin: 'manual_override', protected: true },
        { field: 'homeScore', origin: 'manual_override', protected: true },
      ],
    });
    // The provider now reports a played round 2.
    h!.stub.documents.set(
      'stub-a',
      document([
        { ...ROUND_2[0]!, status: 'finished', score: { home: 1, away: 1 } },
        { ...ROUND_2[1]!, kickoff: '2026-10-28T20:00:00Z' },
      ]),
    );
    const snapshot = await preview(competitionId);
    const current = await plan(competitionId, snapshot.previewId);
    expect(current.ready).toBe(true);
    expect(itemFor(current, 'results', 'm1:result')).toMatchObject({
      action: 'keep_local',
      options: ['accept_incoming'],
      changes: [{ field: 'marcador', localValue: '3-1', incomingValue: '2-1', applied: false }],
    });
    expect(itemFor(current, 'matches', 'm3')).toMatchObject({ action: 'update' });
    expect(itemFor(current, 'matches', 'm4')).toMatchObject({
      action: 'update',
      changes: [{ field: 'kickoffAt', applied: true }],
    });
    const kept = await apply(competitionId, snapshot.previewId);
    expect(kept.application!.counts).toMatchObject({ matchesUpdated: 2, resultsApplied: 1, conflictsNotApplied: 1 });
    // The applied snapshot is closed: it is not reused and cannot be confirmed with other decisions.
    const closed = await plan(competitionId, snapshot.previewId);
    expect(closed.blockers.map((blocker) => blocker.code)).toContain('ALREADY_APPLIED');
    expect((await start(competitionId, snapshot.previewId, closed.planHash)).statusCode).toBe(409);
    expect(kept.application!.notApplied).toEqual([
      expect.objectContaining({ resource: 'results', externalId: 'm1:result', action: 'keep_local' }),
    ]);
    expect(matchRow('Club Alfa', 'Club Beta')).toMatchObject({ home_score: 3, away_score: 1 });
    expect(matchRow('Club Beta', 'Club Alfa')).toMatchObject({ status: 'finished', home_score: 1, away_score: 1 });
    expect(matchRow('Club Delta', 'Club Gamma')).toMatchObject({ kickoff_at: '2026-10-28T20:00:00.000Z' });

    // Only an explicit, audited decision replaces the protected local score.
    const next = await preview(competitionId);
    expect(next.previewId).not.toBe(snapshot.previewId);
    const decision: ImportApplyDecision = {
      resource: 'results',
      externalId: 'm1:result',
      externalScope: next.items.find((item) => item.externalId === 'm1:result')!.externalScope,
      action: 'accept_incoming',
      localId: null,
    };
    const acceptPlan = await plan(competitionId, next.previewId, [decision]);
    expect(itemFor(acceptPlan, 'results', 'm1:result'), JSON.stringify(acceptPlan.reviewItems)).toMatchObject({
      action: 'update',
      decision: 'accept_incoming',
    });
    const accepted = await apply(competitionId, next.previewId, [decision]);
    expect(accepted.status).toBe('completed');
    expect(matchRow('Club Alfa', 'Club Beta')).toMatchObject({ home_score: 2, away_score: 1 });
    expect(
      h!.db
        .prepare<{ field_name: string; origin: string; manual_override: number }>(
          "SELECT field_name, origin, manual_override FROM sports_field_provenance WHERE competition_id = ? AND entity_type = 'result' AND entity_id = ? ORDER BY field_name",
        )
        .all([competitionId, manual.id]),
    ).toEqual([
      { field_name: 'awayScore', origin: 'provider', manual_override: 0 },
      { field_name: 'homeScore', origin: 'provider', manual_override: 0 },
    ]);
    expect(
      h!.db
        .prepare<{ action: string }>(
          "SELECT action FROM sports_field_provenance_events WHERE competition_id = ? AND entity_id = ? AND field_name = 'homeScore' ORDER BY recorded_at",
        )
        .all([competitionId, manual.id])
        .map((row) => row.action),
    ).toEqual(expect.arrayContaining(['provider_applied', 'manual_edit', 'accept_provider']));
    expect(
      h!.db
        .prepare<{ action: string; external_id: string }>(
          'SELECT action, external_id FROM competition_import_decisions',
        )
        .all(),
    ).toEqual([{ action: 'accept_incoming', external_id: 'm1:result' }]);
  });

  it('never merges a same-name local team without an explicit decision', async () => {
    const competitionId = await setup();
    const manual = await h!.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: WRITE_HEADERS,
      payload: { name: 'Club Alfa' },
    });
    expect(manual.statusCode, manual.body).toBe(201);
    const manualId = (manual.json() as { id: string }).id;
    const snapshot = await preview(competitionId);
    const blocked = await plan(competitionId, snapshot.previewId);
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(['TEAM_IDENTITY_REQUIRED', 'DEPENDENCY_UNRESOLVED']),
    );
    const team = itemFor(blocked, 'teams', 'alfa')!;
    expect(team).toMatchObject({
      action: 'blocked',
      options: ['link', 'skip'],
      candidates: [{ id: manualId, label: 'Club Alfa' }],
    });
    const refused = await start(competitionId, snapshot.previewId, blocked.planHash);
    expect(refused.statusCode).toBe(409);
    expect(ProblemSchema.parse(refused.json()).code).toBe('IMPORT_REJECTED');
    expect(snapshotCounts()).toMatchObject({ seasons: 0, mappings: 0 });

    // A decision for a candidate the plan did not offer is refused, never applied.
    const wrong = await plan(competitionId, snapshot.previewId, [
      { resource: 'teams', externalId: 'alfa', externalScope: null, action: 'link', localId: competitionId },
    ]);
    expect(wrong.ready).toBe(false);

    const link: ImportApplyDecision = {
      resource: 'teams',
      externalId: 'alfa',
      externalScope: null,
      action: 'link',
      localId: manualId,
    };
    const linked = await apply(competitionId, snapshot.previewId, [link]);
    expect(linked.status, linked.errorMessage ?? '').toBe('completed');
    expect(linked.application!.counts).toMatchObject({ teamsCreated: 3, teamsReused: 1, matchesCreated: 4 });
    expect(count('teams')).toBe(4);
    expect(
      h!.db
        .prepare<{ local_id: string; origin: string }>(
          "SELECT local_id, origin FROM external_identity_mappings WHERE resource = 'teams' AND external_id = 'alfa'",
        )
        .get(),
    ).toEqual({ local_id: manualId, origin: 'linked' });
  });

  it('keeps identities per competition and offers another competition mapping only as explicit evidence', async () => {
    const first = await setup();
    await apply(first, (await preview(first)).previewId);
    const created = await h!.inject({
      method: 'POST',
      url: '/api/v1/competitions',
      headers: WRITE_HEADERS,
      payload: { name: 'Segunda liga' },
    });
    const second = (created.json() as { id: string }).id;
    const bound = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${second}/provider-binding`,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'provider' },
    });
    expect(bound.statusCode, bound.body).toBe(201);
    const snapshot = await preview(second, ['season', 'teams']);
    const blocked = await plan(second, snapshot.previewId);
    const teams = blocked.reviewItems.filter((item) => item.resource === 'teams');
    expect(teams).toHaveLength(4);
    for (const team of teams) {
      expect(team).toMatchObject({ action: 'blocked', options: ['link', 'skip'] });
      expect(team.reason).toContain('misma identidad externa');
    }
    const decisions = teams.map((team) => ({
      resource: 'teams' as const,
      externalId: team.externalId,
      externalScope: null,
      action: 'link' as const,
      localId: team.candidates[0]!.id,
    }));
    const linked = await apply(second, snapshot.previewId, decisions);
    expect(linked.application!.counts).toMatchObject({
      seasonsCreated: 1,
      teamsCreated: 0,
      teamsReused: 4,
      associationsCreated: 4,
    });
    expect(count('teams')).toBe(4);
    expect(
      h!.db
        .prepare<{ n: number }>(
          "SELECT COUNT(*) AS n FROM external_identity_mappings WHERE resource = 'teams' AND competition_id = ? AND origin = 'linked'",
        )
        .get([second])?.n,
    ).toBe(4);
  });

  it('skips a team and every record that depends on it when the operator chooses so', async () => {
    const competitionId = await setup();
    const manual = await h!.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: WRITE_HEADERS,
      payload: { name: 'Club Alfa' },
    });
    expect(manual.statusCode).toBe(201);
    const snapshot = await preview(competitionId);
    const blocked = await plan(competitionId, snapshot.previewId);
    const dependents = blocked.reviewItems.filter((item) => item.action === 'blocked' && item.resource !== 'teams');
    const decisions: ImportApplyDecision[] = [
      { resource: 'teams', externalId: 'alfa', externalScope: null, action: 'skip', localId: null },
    ];
    const current = await plan(competitionId, snapshot.previewId, decisions);
    expect(current.ready).toBe(true);
    expect(dependents.length).toBeGreaterThan(0);
    for (const item of dependents) expect(itemFor(current, item.resource, item.externalId)?.action).toBe('skip');
    const operation = await apply(competitionId, snapshot.previewId, decisions);
    expect(operation.application!.counts).toMatchObject({ teamsCreated: 3, matchesCreated: 2 });
    expect(matchRow('Club Gamma', 'Club Delta')).toBeTruthy();
    expect(matchRow('Club Alfa', 'Club Beta')).toBeUndefined();
  });

  it('rejects expired, stale, re-bound and unconfirmed snapshots without writing sports data', async () => {
    const competitionId = await setup();
    const snapshot = await preview(competitionId);
    const current = await plan(competitionId, snapshot.previewId);
    const wrongHash = await start(competitionId, snapshot.previewId, 'f'.repeat(64));
    expect(wrongHash.statusCode).toBe(409);
    expect(ProblemSchema.parse(wrongHash.json()).code).toBe('VERSION_CONFLICT');

    // Local data changed after the preview: the fingerprint no longer matches.
    await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name: 'Club Omega' } });
    const stale = await plan(competitionId, snapshot.previewId);
    expect(stale.ready).toBe(false);
    expect(stale.blockers.map((blocker) => blocker.code)).toContain('PREVIEW_STALE');
    const staleStart = await start(competitionId, snapshot.previewId, current.planHash);
    expect(staleStart.statusCode).toBe(409);

    // The provider binding was replaced after the preview.
    const fresh = await preview(competitionId);
    await h!.inject({
      method: 'DELETE',
      url: `/api/v1/competitions/${competitionId}/provider-binding`,
      headers: NO_BODY,
    });
    await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/provider-binding`,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'provider' },
    });
    const rebound = await plan(competitionId, fresh.previewId);
    expect(rebound.blockers.map((blocker) => blocker.code)).toContain('BINDING_CHANGED');

    // An expired snapshot cannot be applied; a new preview is required.
    const latest = await preview(competitionId);
    const latestPlan = await plan(competitionId, latest.previewId);
    h!.db
      .prepare('UPDATE competition_import_previews SET expires_at = ? WHERE id = ?')
      .run(['2000-01-01T00:00:00.000Z', latest.previewId]);
    const expired = await start(competitionId, latest.previewId, latestPlan.planHash);
    expect(expired.statusCode).toBe(410);
    expect(ProblemSchema.parse(expired.json()).code).toBe('IMPORT_PREVIEW_EXPIRED');
    expect(snapshotCounts()).toMatchObject({ seasons: 0, matches: 0, mappings: 0, applications: 0 });
  });

  it('refuses a match whose dependencies are neither in the snapshot nor mapped', async () => {
    const competitionId = await setup();
    const snapshot = await preview(competitionId, ['season', 'matches']);
    const current = await plan(competitionId, snapshot.previewId);
    expect(current.ready).toBe(false);
    expect(current.blockers.map((blocker) => blocker.code)).toContain('DEPENDENCY_MISSING');
    expect(itemFor(current, 'matches', 'm1')).toMatchObject({ action: 'blocked', options: ['skip'] });
  });

  it('rolls back every write of a failed application and can be retried', async () => {
    const competitionId = await setup();
    const snapshot = await preview(competitionId);
    const original = CompetitionCalendarService.prototype.createMatch;
    let calls = 0;
    const spy = vi.spyOn(CompetitionCalendarService.prototype, 'createMatch').mockImplementation(function (
      this: CompetitionCalendarService,
      ...args
    ) {
      calls += 1;
      if (calls === 3) throw new Error('disk failure');
      return original.apply(this, args);
    });
    const failed = await apply(competitionId, snapshot.previewId);
    expect(failed).toMatchObject({
      status: 'failed',
      errorCode: 'INTERNAL',
      currentStage: 'persisting',
      application: null,
    });
    expect(failed.errorMessage).toContain('No se guardó ningún cambio');
    expect(snapshotCounts()).toEqual({
      seasons: 0,
      teams: 0,
      competitionTeams: 0,
      participants: 0,
      stages: 0,
      rounds: 0,
      matches: 0,
      history: 0,
      mappings: 0,
      applications: 0,
    });
    spy.mockRestore();
    const retried = await apply(competitionId, snapshot.previewId);
    expect(retried.status).toBe('completed');
    expect(retried.operationId).not.toBe(failed.operationId);
    expect(count('matches')).toBe(4);
  });

  it('serializes write operations per competition and recovers interrupted work after a restart', async () => {
    const competitionId = await setup();
    const snapshot = await preview(competitionId, ['season']);
    const current = await plan(competitionId, snapshot.previewId);
    const service = new CompetitionImportApplyService(h!.container, new CompetitionImportPreviewService(h!.container));
    // Start and cancel in the same tick: the queued work stops before any stage runs.
    const queued = service.start(competitionId, snapshot.previewId, { decisions: [], planHash: current.planHash });
    expect(queued.status).toBe('queued');
    expect(service.cancel(competitionId, queued.operationId).status).toBe('cancelled');
    await new Promise((resolve) => setImmediate(resolve));
    expect(service.get(competitionId, queued.operationId).status).toBe('cancelled');
    expect(count('seasons')).toBe(0);

    // A live operation of another snapshot blocks a second write operation for the same competition.
    const other = await preview(competitionId, ['season', 'teams']);
    const otherPlan = await plan(competitionId, other.previewId);
    h!.db
      .prepare(
        "INSERT INTO competition_import_apply_operations (id, competition_id, preview_id, binding_id, provider_key, snapshot_hash, plan_hash, decisions_json, status, current_stage, completed_stages_json, created_at, updated_at) SELECT ?, competition_id, id, binding_id, provider_key, snapshot_hash, ?, '[]', 'running', 'persisting', '[]', ?, ? FROM competition_import_previews WHERE id = ?",
      )
      .run([
        '00000000-0000-4000-8000-0000000000aa',
        'a'.repeat(64),
        '2026-10-27T12:00:00.000Z',
        '2026-10-27T12:00:00.000Z',
        snapshot.previewId,
      ]);
    const busy = await start(competitionId, other.previewId, otherPlan.planHash);
    expect(busy.statusCode).toBe(409);
    expect(ProblemSchema.parse(busy.json()).code).toBe('RUN_IN_PROGRESS');
    const late = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-applications/00000000-0000-4000-8000-0000000000aa/cancel`,
      headers: NO_BODY,
    });
    expect(late.statusCode).toBe(409);
    expect(() =>
      h!.db
        .prepare(
          "INSERT INTO competition_import_apply_operations (id, competition_id, preview_id, binding_id, provider_key, snapshot_hash, plan_hash, decisions_json, status, completed_stages_json, created_at, updated_at) SELECT ?, competition_id, id, binding_id, provider_key, snapshot_hash, ?, '[]', 'queued', '[]', ?, ? FROM competition_import_previews WHERE id = ?",
        )
        .run([
          '00000000-0000-4000-8000-0000000000ab',
          'a'.repeat(64),
          '2026-10-27T12:00:00.000Z',
          '2026-10-27T12:00:00.000Z',
          other.previewId,
        ]),
    ).toThrow();

    // A restart marks the interrupted operation failed; its transaction never committed anything.
    new CompetitionImportApplyService(h!.container, new CompetitionImportPreviewService(h!.container));
    expect(service.get(competitionId, '00000000-0000-4000-8000-0000000000aa')).toMatchObject({
      status: 'failed',
      errorCode: 'INTERRUPTED',
    });
    const resumed = await apply(competitionId, other.previewId);
    expect(resumed.status).toBe('completed');
  });

  it('streams persisted, resumable progress and logs safe correlated transitions', async () => {
    const competitionId = await setup();
    const info = vi.spyOn(h!.container.logger, 'info');
    const snapshot = await preview(competitionId);
    const operation = await apply(competitionId, snapshot.previewId);
    const stream = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-applications/${operation.operationId}/events`,
      headers: READ_HEADERS,
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.headers['content-type']).toContain('text/event-stream');
    const types = [...stream.body.matchAll(/^event: (.+)$/gm)].map((match) => match[1]);
    expect(types[0]).toBe('operation.queued');
    expect(types.at(-1)).toBe('operation.completed');
    expect(stream.body).toContain('"stage":"persisting"');
    expect(stream.body).toContain(`"applicationId":"${operation.application!.applicationId}"`);
    const ids = [...stream.body.matchAll(/^id: (\d+)$/gm)].map((match) => Number(match[1]));
    const resumed = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-applications/${operation.operationId}/events`,
      headers: { ...READ_HEADERS, 'last-event-id': String(ids.at(-2)) },
    });
    expect([...resumed.body.matchAll(/^event: (.+)$/gm)].map((match) => match[1])).toEqual(['operation.completed']);
    const records = info.mock.calls
      .map(([data]) => data)
      .filter((data): data is Record<string, unknown> => typeof data === 'object' && data !== null)
      .filter((data) => data.operationId === operation.operationId);
    expect(records.find((record) => record.eventType === 'operation.completed')).toMatchObject({
      previewId: snapshot.previewId,
      competitionId,
      status: 'completed',
      durationMs: expect.any(Number),
      destinationSeasonId: operation.application!.destinationSeasonId,
      counts: operation.application!.counts,
    });
    expect(
      records.some((record) => record.eventType === 'stage.completed' && typeof record.durationMs === 'number'),
    ).toBe(true);
    const logged = JSON.stringify(records);
    expect(logged).not.toMatch(/api.?key|authorization|token|Club Alfa/i);
  });
});
