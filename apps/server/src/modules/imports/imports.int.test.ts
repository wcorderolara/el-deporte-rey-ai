/**
 * Integration of the import routes with the platform, the database, the data directory and the real source registry
 * (ManualDataProvider): R-267, R-273, R-274, R-276 to R-278; T11H-F01, F10, F11, F12, F20; NV-9; V-43, V-48, V-49.
 * Requests go through `app.inject` (no socket); configurations and data directories are temporary and synthetic.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ImportListResponseSchema,
  ImportSummarySchema,
  ManualSelectionHistorySchema,
  ManualVersionSchema,
  ProblemSchema,
  SelectionSnapshotSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { IMPORT_BODY_LIMIT } from '../../platform/http/index.js';

import {
  type AppHarness,
  MATCHES_HEADER,
  TEST_HOST,
  UI_HEADERS,
  appHarness,
  fileRequest,
  formRequest,
  matchRow,
  matchesCsv,
  sampleDocument,
  sampleSelection,
  standingsCsv,
} from './test/support.js';

let harness: AppHarness | undefined;

afterEach(async () => {
  await harness?.close();
  harness = undefined;
});

async function setup(options: Parameters<typeof appHarness>[0] = {}): Promise<AppHarness> {
  harness = await appHarness(options);
  return harness;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const discovery = () => ({ signal: new AbortController().signal, purpose: 'discovery' as const });
const research = () => ({ signal: new AbortController().signal, purpose: 'research' as const });

async function created(h: AppHarness, body: unknown) {
  const response = await h.post(body);
  expect(response.statusCode, response.body).toBe(201);
  return ImportSummarySchema.parse(response.json());
}

async function rejectedWith(h: AppHarness, body: unknown) {
  const response = await h.post(body);
  expect(response.statusCode).toBe(400);
  expect(response.headers['content-type']).toContain('application/problem+json');
  const problem = ProblemSchema.parse(response.json());
  expect(problem.code).toBe('IMPORT_REJECTED');
  return problem.importErrors ?? [];
}

/** The current snapshot of a selection, resolved through the catalogue like a project would. */
async function snapshotOf(h: AppHarness, matchday: number | null = 1) {
  const resolution = await h.container.sources.catalogue.resolveSelection(
    {
      competitionId: 'manual-liga-ficticia',
      sourceId: 'manual',
      seasonId: '2026-27',
      stageId: 'fase-regular',
      matchday,
    },
    discovery(),
  );
  expect(resolution.ok).toBe(true);
  if (!resolution.ok) {
    throw new Error('selection not resolved');
  }
  const source = h.container.sources.get('manual');
  return source?.fetchSelection(resolution.selection.selectionRef, research());
}

describe('applied imports (R-276, R-277)', () => {
  it('makes a valid import with metadata, results and standings selectable through the catalogue', async () => {
    const h = await setup();
    const summary = await created(h, fileRequest('json_file', JSON.stringify(sampleDocument())));
    expect(summary).toMatchObject({
      channel: 'json_file',
      fileName: 'resultados.json',
      declaredSource: 'Acta ficticia de la liga',
      competitionId: 'liga-ficticia',
      competitionName: 'Liga Ficticia',
      seasonId: '2026-27',
      seasonLabel: '2026/27',
      selections: [{ stageId: 'fase-regular', stageName: 'Fase Regular', matchday: 1, versionNumber: 1 }],
    });
    const catalogue = await h.container.sources.catalogue.listCatalogue(discovery());
    expect(catalogue.competitions.map((competition) => [competition.id, competition.name])).toEqual([
      ['manual-liga-ficticia', 'Liga Ficticia'],
    ]);
    const snapshot = await snapshotOf(h);
    expect(SelectionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot?.importVersionId).toBe(summary.selections[0]?.versionId);
    expect(snapshot?.sourceRef).toBe(`import:${summary.id}/v1`);
    expect(snapshot?.standings.available).toBe(true);
  });

  it('keeps the original unchanged and serves it with the same SHA-256 and safe headers (T11H-F01, F11)', async () => {
    const h = await setup();
    const text = matchesCsv().replaceAll('\n', '\r\n');
    const sent = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
    const nfdName = 'Jornada señal ñandú.csv'.normalize('NFD');
    expect(nfdName).not.toBe(nfdName.normalize('NFC'));
    const summary = await created(h, fileRequest('csv_file', sent, nfdName));
    expect(summary.fileName).toBe(nfdName);
    expect(summary.originalSha256).toBe(sha256(sent));

    const stored = readFileSync(join(h.dataDir, 'imports', summary.id, 'original.csv'));
    expect(stored.equals(sent)).toBe(true);

    const response = await h.get(`/api/v1/imports/${summary.id}/original`);
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload.equals(sent)).toBe(true);
    expect(sha256(response.rawPayload)).toBe(summary.originalSha256);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.headers['content-disposition']).toBe(`attachment; filename="original-${summary.id}.csv"`);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(JSON.stringify(response.headers)).not.toContain('Jornada');

    const record = await h.get(`/api/v1/imports/${summary.id}`);
    expect(ImportSummarySchema.parse(record.json())).toMatchObject({
      id: summary.id,
      channel: 'csv_file',
      fileName: nfdName,
      declaredSource: 'Acta ficticia de la liga',
      receivedAt: summary.receivedAt,
      originalSha256: sha256(sent),
    });
  });

  it('names form and JSON originals by channel and stores the form as canonical JSON', async () => {
    const h = await setup();
    const form = await created(h, formRequest(sampleDocument()));
    expect(form.fileName).toBeNull();
    const response = await h.get(`/api/v1/imports/${form.id}/original`);
    expect(response.headers['content-disposition']).toBe(`attachment; filename="original-${form.id}.form.json"`);
    expect(response.body).toBe(JSON.stringify(sampleDocument()));
    expect(sha256(response.rawPayload)).toBe(form.originalSha256);
  });

  it('lists imports newest first and answers 404 and 400 for unknown and malformed IDs', async () => {
    const h = await setup();
    const first = await created(h, fileRequest('csv_file', matchesCsv()));
    const second = await created(h, fileRequest('csv_file', standingsCsv()));
    const list = ImportListResponseSchema.parse((await h.get('/api/v1/imports')).json());
    expect(list.imports.map((item) => item.id)).toEqual([second.id, first.id]);
    const unknown = '00000000-0000-4000-8000-00000000abcd';
    expect((await h.get(`/api/v1/imports/${unknown}`)).statusCode).toBe(404);
    expect((await h.get(`/api/v1/imports/${unknown}/original`)).statusCode).toBe(404);
    expect((await h.get('/api/v1/imports/not-a-uuid')).statusCode).toBe(400);
    expect((await h.get(`/api/v1/manual-data/versions/${unknown}`)).statusCode).toBe(404);
    expect((await h.get('/api/v1/manual-data/selections?competitionId=liga-ficticia&seasonId=otra')).statusCode).toBe(
      404,
    );
  });
});

describe('reimport (R-278)', () => {
  it('creates a new version used by later research; the earlier version stays retrievable', async () => {
    const h = await setup();
    const first = await created(h, formRequest(sampleDocument({ homeScore: 2 })));
    const before = await snapshotOf(h);
    expect(before?.matches[0]?.score).toEqual({ home: 2, away: 1 });

    const corrected = await created(h, formRequest(sampleDocument({ homeScore: 3 })));
    expect(corrected.selections[0]?.versionNumber).toBe(2);
    const after = await snapshotOf(h);
    expect(after?.matches[0]?.score).toEqual({ home: 3, away: 1 });
    expect(after?.importVersionId).toBe(corrected.selections[0]?.versionId);

    const history = ManualSelectionHistorySchema.parse(
      (await h.get('/api/v1/manual-data/selections?competitionId=liga-ficticia&seasonId=2026-27')).json(),
    );
    expect(history.selections).toHaveLength(1);
    expect(
      history.selections[0]?.versions.map((version) => [version.versionNumber, version.importId, version.current]),
    ).toEqual([
      [1, first.id, false],
      [2, corrected.id, true],
    ]);

    const earlier = ManualVersionSchema.parse(
      (await h.get(`/api/v1/manual-data/versions/${first.selections[0]?.versionId ?? ''}`)).json(),
    );
    expect(earlier.supersededAt).not.toBeNull();
    expect(earlier.selection.matches[0]?.score).toEqual({ home: 2, away: 1 });
    expect((await h.get(`/api/v1/imports/${first.id}/original`)).statusCode).toBe(200);
  });
});

describe('rejected imports store nothing (R-066, R-273, R-274, R-276)', () => {
  it('rejects an import without metadata with every error and stores nothing', async () => {
    const h = await setup();
    const document = sampleDocument() as Record<string, unknown>;
    delete document['competition'];
    delete document['season'];
    const errors = await rejectedWith(h, formRequest(document));
    expect(errors.map((error) => [error.location, error.record, error.field, error.problem])).toEqual([
      ['form', '/', 'competition', 'metadata_missing'],
      ['form', '/', 'season', 'metadata_missing'],
    ]);
    expect(h.counts()).toEqual({ imports: 0, manual_competitions: 0, manual_seasons: 0, manual_selection_versions: 0 });
    expect(h.storedFiles()).toEqual([]);
  });

  it('rejects a form document above 512 KiB as canonical JSON before anything is written (T11H-F10)', async () => {
    const h = await setup();
    const selections = Array.from({ length: 100 }, (_unused, index) => {
      const selection = sampleSelection({ matchday: index + 1, standings: false }) as Record<string, unknown>;
      const teams = Array.from({ length: 64 }, (_t, t) => ({
        key: `club-${String(t)}-${'x'.repeat(55)}`,
        name: `Club ${String(t)} ${'Nombre Ficticio Largo'.repeat(2)}`.slice(0, 64).trim(),
      }));
      selection['teams'] = teams;
      selection['matches'] = Array.from({ length: 32 }, (_m, m) => ({
        home: teams[2 * m]?.key,
        away: teams[2 * m + 1]?.key,
        kickoff: '2026-10-20T18:00:00Z',
        status: 'scheduled',
        score: null,
      }));
      return selection;
    });
    const body = formRequest({ ...sampleDocument(), selections });
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(IMPORT_BODY_LIMIT);
    const errors = await rejectedWith(h, body);
    expect(errors.map((error) => error.problem)).toEqual(['too_large']);
    expect(h.counts()).toEqual({ imports: 0, manual_competitions: 0, manual_seasons: 0, manual_selection_versions: 0 });
    expect(h.storedFiles()).toEqual([]);
  });

  it('never logs the request body nor echoes values in errors (T11H-F12)', async () => {
    const h = await setup();
    const marker = TEST_MARKER_TOKEN;
    const content = `${MATCHES_HEADER},scorer\n${matchRow(`Club ${marker}`, 'Deportivo Beta')},${marker}\n`;
    const response = await h.post(fileRequest('csv_file', content));
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain(marker);
    expect(ProblemSchema.parse(response.json()).importErrors).toEqual([
      {
        location: 'file',
        record: '1',
        field: 'scorer',
        problem: 'person_field',
        message: 'Person-level columns are not accepted (team and competition data only)',
      },
    ]);
    const log = h.logText();
    expect(log).toContain('import rejected');
    expect(log).not.toContain(marker);
    expect(log).not.toContain(Buffer.from(content).toString('base64').slice(0, 40));
  });
});

describe('envelope and platform protections (V-43, NV-9)', () => {
  it('refuses a deeply nested 1.5 MiB envelope quickly with 400', async () => {
    const h = await setup();
    const prefix = '{"channel":"form","declaredSource":null,"document":';
    const depth = Math.floor((IMPORT_BODY_LIMIT - prefix.length - 1) / 2);
    const payload = `${prefix}${'['.repeat(depth)}${']'.repeat(depth)}}`;
    expect(payload.length).toBeLessThanOrEqual(IMPORT_BODY_LIMIT);
    const start = performance.now();
    const response = await h.app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI_HEADERS, payload });
    const elapsed = performance.now() - start;
    expect(response.statusCode).toBe(400);
    expect(ProblemSchema.parse(response.json()).code).toBe('VALIDATION_FAILED');
    expect(elapsed).toBeLessThan(2000);
  });

  it('refuses a body above the 1.5 MiB route limit with 413', async () => {
    const h = await setup();
    const payload = JSON.stringify(fileRequest('csv_file', 'x'.repeat(IMPORT_BODY_LIMIT)));
    const response = await h.app.inject({ method: 'POST', url: '/api/v1/imports', headers: UI_HEADERS, payload });
    expect(response.statusCode).toBe(413);
  });

  it('refuses an invalid envelope with VALIDATION_FAILED and a missing client header with 403', async () => {
    const h = await setup();
    for (const body of [
      { channel: 'xlsx', fileName: 'datos.csv', declaredSource: null, contentBase64: '' },
      { ...fileRequest('csv_file', matchesCsv()), fileName: '../etc/passwd.csv' },
      { ...fileRequest('csv_file', matchesCsv()), extra: 1 },
      { channel: 'form', declaredSource: null },
    ]) {
      const response = await h.post(body);
      expect(response.statusCode).toBe(400);
      expect(ProblemSchema.parse(response.json()).code).toBe('VALIDATION_FAILED');
    }
    const headers = { host: TEST_HOST, origin: 'http://127.0.0.1:4300', 'content-type': 'application/json' };
    const response = await h.app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      headers,
      payload: JSON.stringify(formRequest(sampleDocument())),
    });
    expect(response.statusCode).toBe(403);
    expect(h.counts()['imports']).toBe(0);
  });
});

describe('one representation for every channel (R-267)', () => {
  it('gives JSON, CSV and form imports of one matchday equal snapshots apart from source metadata', async () => {
    const h = await setup();
    const document = sampleDocument({ standings: false });
    const secondKickoff = matchRow('Atlético Gamma', 'Unión Delta', 'finished', '0', '0').replace(
      '2026-10-20T18:00:00Z',
      '2026-10-20T20:00:00Z',
    );
    const csv = matchesCsv([matchRow('Club Alfa', 'Deportivo Beta', 'finished', '2', '1'), secondKickoff]);

    const neutral = (snapshot: Awaited<ReturnType<typeof snapshotOf>>) => {
      const parsed = SelectionSnapshotSchema.parse(snapshot);
      return {
        competition: parsed.competition,
        season: parsed.season,
        stage: parsed.stage,
        teams: parsed.teams.map((team) => ({ teamKey: team.teamKey, name: team.name })),
        matches: parsed.matches.map(({ ref: _ref, ...match }) => match),
        standings: parsed.standings,
        context: parsed.context.map(({ ref: _ref, ...item }) => item),
        mode: parsed.mode,
      };
    };

    await created(h, fileRequest('json_file', JSON.stringify(document)));
    const fromJson = neutral(await snapshotOf(h));
    await created(h, fileRequest('csv_file', csv));
    const fromCsv = neutral(await snapshotOf(h));
    await created(h, formRequest(document));
    const fromForm = neutral(await snapshotOf(h));

    expect(fromCsv).toEqual(fromJson);
    expect(fromForm).toEqual(fromJson);
    expect(fromJson.mode).toBe('MANUAL_DATA');
  });
});
