import {
  ImportOperationResponseSchema,
  ImportOperationStartResponseSchema,
  ImportPreviewResponseSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompetitionImportPreviewService } from './import-preview.js';
import {
  READ_HEADERS,
  WRITE_HEADERS,
  projectsTestApp,
  testSources,
  type ProjectsTestApp,
} from '../projects/test/support.js';

let app: ProjectsTestApp | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
});

async function boundCompetition() {
  app = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name: 'Liga operativa' },
  });
  expect(created.statusCode).toBe(201);
  const competitionId = (created.json() as { id: string }).id;
  const bound = await app.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/provider-binding`,
    headers: WRITE_HEADERS,
    payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'provider' },
  });
  expect(bound.statusCode, bound.body).toBe(201);
  return competitionId;
}
async function waitForStatus(competitionId: string, operationId: string, status: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}`,
      headers: READ_HEADERS,
    });
    expect(response.statusCode).toBe(200);
    const operation = ImportOperationResponseSchema.parse(response.json()).operation;
    if (operation.status === status) return operation;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Operation did not reach ${status}`);
}

describe('durable import preview operations', () => {
  it('accepts work immediately, persists real events, completes with a preview, and reuses equivalent work', async () => {
    const competitionId = await boundCompetition();
    const url = `/api/v1/competitions/${competitionId}/import-operations`;
    const payload = { externalSeasonId: '2026', resources: ['season'] };
    const accepted = await app!.inject({ method: 'POST', url, headers: WRITE_HEADERS, payload });
    expect(accepted.statusCode, accepted.body).toBe(202);
    const started = ImportOperationStartResponseSchema.parse(accepted.json());
    expect(started.operation.status).toMatch(/queued|running/);
    const completed = await waitForStatus(competitionId, started.operation.operationId, 'completed');
    expect(completed.previewId).toBeTruthy();
    expect(completed.completedStages).toEqual(['fetching', 'normalizing', 'comparing', 'preparing_preview']);
    const snapshot = await app!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-previews/${completed.previewId}`,
      headers: READ_HEADERS,
    });
    expect(snapshot.statusCode).toBe(200);
    expect(ImportPreviewResponseSchema.parse(snapshot.json()).preview.previewId).toBe(completed.previewId);
    const reads = app!.stub.count('stub-a', 'fetchSelection');
    const again = await app!.inject({ method: 'POST', url, headers: WRITE_HEADERS, payload });
    expect(ImportOperationStartResponseSchema.parse(again.json()).operation.operationId).toBe(
      started.operation.operationId,
    );
    expect(app!.stub.count('stub-a', 'fetchSelection')).toBe(reads);
    const events = app!.db
      .prepare<{ event_type: string }>(
        'SELECT event_type FROM competition_import_operation_events WHERE operation_id = ? ORDER BY sequence',
      )
      .all([started.operation.operationId]);
    expect(events.map((entry) => entry.event_type)).toEqual(
      expect.arrayContaining([
        'operation.queued',
        'operation.started',
        'stage.started',
        'stage.completed',
        'operation.completed',
      ]),
    );
    expect(app!.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_seasons').get()?.count).toBe(
      0,
    );
  });
  it('keeps distinct selected-resource scopes and includes valid teams only when requested', async () => {
    const competitionId = await boundCompetition();
    const url = `/api/v1/competitions/${competitionId}/import-operations`;
    const submit = async (resources: string[]) => {
      const accepted = await app!.inject({
        method: 'POST',
        url,
        headers: WRITE_HEADERS,
        payload: { externalSeasonId: '2026', destinationSeasonId: null, resources },
      });
      expect(accepted.statusCode, accepted.body).toBe(202);
      const operation = ImportOperationStartResponseSchema.parse(accepted.json()).operation;
      const finished = await waitForStatus(competitionId, operation.operationId, 'completed');
      const response = await app!.inject({
        method: 'GET',
        url: `/api/v1/competitions/${competitionId}/import-previews/${finished.previewId}`,
        headers: READ_HEADERS,
      });
      expect(response.statusCode).toBe(200);
      return { operation, preview: ImportPreviewResponseSchema.parse(response.json()).preview };
    };
    const first = await submit(['season', 'stages']);
    const second = await submit(['season', 'stages', 'teams']);
    expect(first.operation.operationId).not.toBe(second.operation.operationId);
    expect(first.preview.previewId).not.toBe(second.preview.previewId);
    expect(first.preview.resources).toEqual(['season', 'stages']);
    expect(first.preview.items.some((item) => item.resource === 'teams')).toBe(false);
    expect(second.preview.resources).toEqual(['season', 'stages', 'teams']);
    expect(second.preview.items.filter((item) => item.resource === 'teams').length).toBeGreaterThan(0);
    expect(second.preview.summary.new).toBeGreaterThan(first.preview.summary.new);
    const repeat = await submit(['teams', 'stages', 'season']);
    expect(repeat.operation.operationId).toBe(second.operation.operationId);
  });
  it('logs safe operation and stage transitions with correlation and elapsed time', async () => {
    const competitionId = await boundCompetition();
    const info = vi.spyOn(app!.container.logger, 'info');
    const accepted = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['season', 'teams'] },
    });
    const operationId = ImportOperationStartResponseSchema.parse(accepted.json()).operation.operationId;
    await waitForStatus(competitionId, operationId, 'completed');
    const records = info.mock.calls
      .map(([data]) => data)
      .filter((data): data is Record<string, unknown> => typeof data === 'object' && data !== null);
    const related = records.filter((record) => record.operationId === operationId);
    expect(related.map((record) => record.eventType)).toEqual(
      expect.arrayContaining(['operation.started', 'stage.started', 'stage.completed', 'operation.completed']),
    );
    expect(
      related.every((record) => record.competitionId === competitionId && typeof record.timestamp === 'string'),
    ).toBe(true);
    expect(related.find((record) => record.eventType === 'operation.completed')).toMatchObject({
      previousStatus: 'running',
      status: 'completed',
      processedRecords: expect.any(Number),
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(related)).not.toMatch(/api.?key|authorization|token/i);
  });
  it('replays persisted SSE events and marks interrupted work failed after restart', async () => {
    const competitionId = await boundCompetition();
    const accepted = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['season'] },
    });
    const operationId = ImportOperationStartResponseSchema.parse(accepted.json()).operation.operationId;
    await waitForStatus(competitionId, operationId, 'completed');
    const stream = await app!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}/events`,
      headers: READ_HEADERS,
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.headers['content-type']).toContain('text/event-stream');
    expect(stream.body).toContain('event: operation.completed');
    const rows = app!.db
      .prepare<{ sequence: number }>(
        'SELECT sequence FROM competition_import_operation_events WHERE operation_id = ? ORDER BY sequence',
      )
      .all([operationId]);
    expect(rows.length).toBeGreaterThan(1);
    const resumed = await app!.inject({
      method: 'GET',
      url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}/events`,
      headers: { ...READ_HEADERS, 'last-event-id': String(rows.at(-2)!.sequence) },
    });
    expect(resumed.body).toContain('event: operation.completed');
    expect(resumed.body).not.toContain('event: operation.queued');
    app!.db
      .prepare('UPDATE competition_import_operations SET status = ?, completed_at = NULL WHERE id = ?')
      .run(['running', operationId]);
    new (await import('./import-operation.js')).ImportPreviewOperationService(
      app!.container,
      new CompetitionImportPreviewService(app!.container),
    );
    expect(
      (
        await app!.inject({
          method: 'GET',
          url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}`,
          headers: READ_HEADERS,
        })
      ).json(),
    ).toMatchObject({ operation: { status: 'failed', errorCode: 'INTERRUPTED' } });
  });
  it('confirms cancellation only after the running task stops and does not persist a partial preview', async () => {
    const competitionId = await boundCompetition();
    vi.spyOn(CompetitionImportPreviewService.prototype, 'createWithProgress').mockImplementation(
      (_id, _input, _progress, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    const accepted = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['season'] },
    });
    const operationId = ImportOperationStartResponseSchema.parse(accepted.json()).operation.operationId;
    await waitForStatus(competitionId, operationId, 'running');
    const duplicate = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['season'] },
    });
    expect(ImportOperationStartResponseSchema.parse(duplicate.json()).operation.operationId).toBe(operationId);
    const cancel = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}/cancel`,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(cancel.statusCode).toBe(200);
    await waitForStatus(competitionId, operationId, 'cancelled');
    expect(
      app!.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_import_previews').get()?.count,
    ).toBe(0);
  });
  it('scopes operations to the competition and preserves a terminal operation when cancel is requested too late', async () => {
    const competitionId = await boundCompetition();
    const accepted = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations`,
      headers: WRITE_HEADERS,
      payload: { externalSeasonId: '2026', resources: ['season'] },
    });
    const operationId = ImportOperationStartResponseSchema.parse(accepted.json()).operation.operationId;
    await waitForStatus(competitionId, operationId, 'completed');
    const cancel = await app!.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competitionId}/import-operations/${operationId}/cancel`,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(cancel.statusCode, cancel.body).toBe(200);
    expect(ImportOperationResponseSchema.parse(cancel.json()).operation.status).toBe('completed');
    const other = await app!.inject({
      method: 'GET',
      url: `/api/v1/competitions/00000000-0000-4000-8000-000000000999/import-operations/${operationId}`,
      headers: READ_HEADERS,
    });
    expect(other.statusCode).toBe(404);
  });
});
