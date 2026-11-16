/**
 * UI-06.3 provider-import errors and recovery through the HTTP API (PD-ARCH-01D-B/C), with the counting stub adapter:
 * - the provider times out while the preview operation lists the season: the operation fails with a closed code and
 *   a Spanish message, stores no preview and no sports data, and a new request after the recovery completes;
 * - the provider is unavailable for one matchday: the preview is kept with an error warning and skipped records, the
 *   plan refuses it as incomplete in Spanish, nothing is written, and a new preview after the recovery is applied.
 * The SOURCE_INCOMPLETE blocker was covered only by `import-transform.test.ts` (unit). Synthetic data only.
 * One test documents product defect UI-06.3-D3 (an incomplete preview is reused, so the advised retry is impossible).
 */
import {
  ImportApplyOperationResponseSchema,
  ImportApplyOperationStartResponseSchema,
  type ImportApplyPlan,
  ImportApplyPlanResponseSchema,
  ImportOperationResponseSchema,
  ImportOperationStartResponseSchema,
  type ImportPreview,
  ImportPreviewResponseSchema,
  ProblemSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  READ_HEADERS,
  WRITE_HEADERS,
  type ProjectsTestApp,
  projectsTestApp,
  testSources,
} from '../../../src/modules/projects/test/support.js';
import { SourceError } from '../../../src/providers/sports/ingestion/errors.js';
import { competition, fixtureDocument, season, selection } from '../../../src/providers/sports/test/synthetic.js';

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

/** One stage with two matchdays (the stub document of the copa-stub competition). */
function twoMatchdays() {
  const day = (matchday: number, key: string) => ({
    ...(selection({ stage: 'REGULAR_SEASON', matchday }) as Record<string, unknown>),
    matches: [
      {
        matchKey: key,
        homeTeamKey: 'alfa',
        awayTeamKey: 'beta',
        kickoff: `2026-10-${String(19 + matchday)}T18:00:00Z`,
        status: 'finished',
        score: { home: 1, away: 0 },
        ref: `fixture:synthetic/selection#${key}`,
      },
    ],
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
          matchdays: { '1': day(1, 'm1'), '2': day(2, 'm2') },
        },
      ]),
    ]),
  ]);
}

const RESOURCES = ['season', 'teams', 'stages', 'rounds', 'matches', 'results'];
const INCOMPLETE_MESSAGE =
  'Algunas selecciones no pudieron consultarse. Genera otra vista previa para importar el alcance completo.';

async function boundCompetition(): Promise<string> {
  h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
  h.stub.documents.set('stub-a', twoMatchdays());
  const created = await h.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name: 'Liga con cortes' },
  });
  expect(created.statusCode, created.body).toBe(201);
  const competitionId = (created.json() as { id: string }).id;
  const bound = await h.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/provider-binding`,
    headers: WRITE_HEADERS,
    payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'provider' },
  });
  expect(bound.statusCode, bound.body).toBe(201);
  return competitionId;
}

function sportsRows() {
  return h!.db
    .prepare<{ seasons: number; teams: number; matches: number; mappings: number; applications: number }>(
      'SELECT (SELECT COUNT(*) FROM competition_seasons) AS seasons, (SELECT COUNT(*) FROM managed_teams) AS teams, (SELECT COUNT(*) FROM competition_matches) AS matches, (SELECT COUNT(*) FROM external_identity_mappings) AS mappings, (SELECT COUNT(*) FROM competition_import_applications) AS applications',
    )
    .get();
}

function previewRows(): number {
  return h!.db.prepare<{ n: number }>('SELECT COUNT(*) AS n FROM competition_import_previews').get()?.n ?? -1;
}

async function operation(competitionId: string, resources: string[]) {
  const accepted = await h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/import-operations`,
    headers: WRITE_HEADERS,
    payload: { externalSeasonId: '2026', resources },
  });
  expect(accepted.statusCode, accepted.body).toBe(202);
  const { operationId } = ImportOperationStartResponseSchema.parse(accepted.json()).operation;
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = await h!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}`,
      headers: READ_HEADERS,
    });
    expect(response.statusCode, response.body).toBe(200);
    const current = ImportOperationResponseSchema.parse(response.json()).operation;
    if (['completed', 'failed', 'cancelled'].includes(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('operation did not finish');
}

describe('provider import errors and recovery (UI-06.3)', () => {
  it('a provider timeout fails the preview operation with a Spanish message, stores nothing, and a new request recovers', async () => {
    const competitionId = await boundCompetition();
    const before = sportsRows();
    h!.stub.overrides.set(
      'stub-a/listStages',
      new SourceError('timeout', 'synthetic upstream deadline at https://provider.invalid/v4', 'stub-a'),
    );
    const failed = await operation(competitionId, ['season', 'stages', 'matches']);
    expect(failed).toMatchObject({
      status: 'failed',
      previewId: null,
      errorCode: 'PROVIDER_FAILED',
      errorMessage: 'No se pudieron consultar los datos del proveedor.',
    });
    expect(JSON.stringify(failed)).not.toMatch(/provider\.invalid|deadline/);
    expect(previewRows()).toBe(0);
    expect(sportsRows()).toEqual(before);
    const events = h!.db
      .prepare<{ event_type: string }>(
        'SELECT event_type FROM competition_import_operation_events WHERE operation_id = ? ORDER BY sequence',
      )
      .all([failed.operationId])
      .map((row) => row.event_type);
    expect(events.at(-1)).toBe('operation.failed');
    expect(events).not.toContain('operation.completed');

    // The provider answers again: the same request is accepted as new work and completes.
    h!.stub.overrides.delete('stub-a/listStages');
    const recovered = await operation(competitionId, ['season', 'stages', 'matches']);
    expect(recovered.operationId).not.toBe(failed.operationId);
    expect(recovered.status, recovered.errorMessage ?? '').toBe('completed');
    expect(recovered.previewId).toBeTruthy();
    expect(previewRows()).toBe(1);
  });

  /** A preview whose second matchday the provider could not serve (unavailable); the first one is served. */
  async function incompletePreview(competitionId: string): Promise<ImportPreview> {
    const overrides = h!.stub.overrides;
    const read = overrides.get.bind(overrides);
    let selectionReads = 0;
    overrides.get = (key: string) =>
      key === 'stub-a/fetchSelection' && ++selectionReads === 2
        ? new SourceError('unavailable', 'synthetic outage', 'stub-a')
        : read(key);
    try {
      const response = await h!.inject({
        method: 'POST',
        url: `/api/v1/competitions/${competitionId}/import-previews`,
        headers: WRITE_HEADERS,
        payload: { externalSeasonId: '2026', resources: RESOURCES },
      });
      expect(response.statusCode, response.body).toBe(201);
      expect(selectionReads).toBe(2);
      return ImportPreviewResponseSchema.parse(response.json()).preview;
    } finally {
      Reflect.deleteProperty(overrides, 'get');
    }
  }

  async function planOf(competitionId: string, previewId: string): Promise<ImportApplyPlan> {
    const response = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-previews/${previewId}/application-plan`,
      headers: WRITE_HEADERS,
      payload: { decisions: [] },
    });
    expect(response.statusCode, response.body).toBe(200);
    return ImportApplyPlanResponseSchema.parse(response.json()).plan;
  }

  it('a matchday the provider cannot serve makes the preview incomplete: refused in Spanish, nothing written, recoverable', async () => {
    const competitionId = await boundCompetition();
    const before = sportsRows();
    const preview = await incompletePreview(competitionId);
    // The unread matchday is listed as a skipped record with a Spanish reason; the served one is previewed.
    expect(preview.summary.skipped).toBe(1);
    expect(preview.items.find((item) => item.operation === 'skipped')).toMatchObject({
      resource: 'matches',
      title: 'Selección no disponible',
      warnings: ['No se pudo consultar esta selección del proveedor. Revisa la conexión o inténtalo de nuevo.'],
    });
    expect(preview.items.some((item) => item.resource === 'matches' && item.externalId === 'm1')).toBe(true);
    expect(preview.warnings.map((warning) => warning.message)).toContain(
      'Una o más selecciones no pudieron consultarse; se indican como omitidas en el resumen.',
    );

    const plan = await planOf(competitionId, preview.previewId);
    expect(plan.ready).toBe(false);
    expect(plan.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_INCOMPLETE', message: INCOMPLETE_MESSAGE })]),
    );
    const refused = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-previews/${preview.previewId}/applications`,
      headers: WRITE_HEADERS,
      payload: { decisions: [], planHash: plan.planHash },
    });
    expect(refused.statusCode).toBe(409);
    expect(ProblemSchema.parse(refused.json()).code).toBe('IMPORT_REJECTED');
    expect(sportsRows()).toEqual(before);

    // Once the incomplete snapshot has expired, a new preview reads the recovered provider and can be applied.
    h!.db
      .prepare('UPDATE competition_import_previews SET expires_at = ? WHERE id = ?')
      .run(['2000-01-01T00:00:00.000Z', preview.previewId]);
    const fresh = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-previews`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: RESOURCES },
    });
    expect(fresh.statusCode, fresh.body).toBe(201);
    const complete = ImportPreviewResponseSchema.parse(fresh.json()).preview;
    expect(complete.previewId).not.toBe(preview.previewId);
    expect(complete.summary.skipped).toBe(0);
    const ready = await planOf(competitionId, complete.previewId);
    expect(ready.blockers).toEqual([]);
    const applied = await h!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-previews/${complete.previewId}/applications`,
      headers: WRITE_HEADERS,
      payload: { decisions: [], planHash: ready.planHash },
    });
    expect(applied.statusCode, applied.body).toBe(202);
    // The application runs in the background: wait for it, so that it never outlives the app of this test.
    const operationId = ImportApplyOperationStartResponseSchema.parse(applied.json()).operation.operationId;
    let status = 'queued';
    for (let attempt = 0; attempt < 200 && !['completed', 'failed', 'cancelled'].includes(status); attempt++) {
      const response = await h!.inject({
        method: 'GET',
        url: `/api/v1/competitions/${competitionId}/import-applications/${operationId}`,
        headers: READ_HEADERS,
      });
      status = ImportApplyOperationResponseSchema.parse(response.json()).operation.status;
      if (status === 'queued' || status === 'running') await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(status).toBe('completed');
  });

  // Product defect UI-06.3-D3 (see the suite report): an incomplete preview (selections the provider could not
  // serve) is reused for the same scope until it expires (30 minutes), by `CompetitionImportPreviewService` and by
  // the preview operations the web starts. The SOURCE_INCOMPLETE blocker tells the operator to "generate another
  // preview", but every new request returns the same incomplete snapshot without asking the recovered provider.
  it('after the provider recovers, another preview of the same scope asks it again instead of reusing the incomplete one', async () => {
    const competitionId = await boundCompetition();
    const incomplete = await incompletePreview(competitionId);
    expect(incomplete.summary.skipped).toBe(1);
    const reads = h!.stub.count('stub-a', 'fetchSelection');
    // The operator follows the blocker's advice through the operation the web starts.
    const retried = await operation(competitionId, RESOURCES);
    expect(retried.status, retried.errorMessage ?? '').toBe('completed');
    expect(h!.stub.count('stub-a', 'fetchSelection')).toBeGreaterThan(reads);
    expect(retried.previewId).not.toBe(incomplete.previewId);
  });
});
