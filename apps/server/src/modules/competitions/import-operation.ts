import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { AppContainer } from '../../container.js';
import type { Db } from '../../platform/db/db.js';
import { HttpProblem, sanitizeText } from '../../platform/http/problem.js';
import { SourceError } from '../../providers/sports/ingestion/errors.js';
import type { ImportPreviewCreate } from '@edr/contracts';
import type { CompetitionImportPreviewService } from './import-preview.js';
import { previewIncomplete } from './import-transform.js';

export type PreviewStage = 'fetching' | 'normalizing' | 'comparing' | 'preparing_preview';
export type OperationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
interface OperationRow {
  id: string;
  competition_id: string;
  binding_id: string;
  provider_key: string;
  external_season_id: string;
  destination_season_id: string | null;
  resources_json: string;
  scope_key: string;
  status: OperationStatus;
  current_stage: PreviewStage | null;
  completed_stages_json: string;
  cancellation_requested: number;
  preview_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
}
interface EventRow {
  sequence: number;
  operation_id: string;
  event_type: string;
  status: OperationStatus;
  stage: PreviewStage | null;
  preview_id: string | null;
  created_at: string;
}
const terminal = (status: OperationStatus) => ['completed', 'failed', 'cancelled'].includes(status);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class ImportPreviewOperationService {
  readonly #db: Db;
  readonly #previews: CompetitionImportPreviewService;
  readonly #container: AppContainer;
  readonly #events = new EventEmitter();
  readonly #controllers = new Map<string, AbortController>();
  readonly #operationStarted = new Map<string, number>();
  readonly #stageStarted = new Map<string, number>();
  constructor(container: AppContainer, previews: CompetitionImportPreviewService) {
    this.#container = container;
    this.#db = container.db;
    this.#previews = previews;
    const interrupted = this.#db
      .prepare<OperationRow>("SELECT * FROM competition_import_operations WHERE status IN ('queued','running')")
      .all();
    for (const row of interrupted)
      this.#transition(
        row.id,
        'failed',
        row.current_stage,
        'operation.failed',
        null,
        'INTERRUPTED',
        'La consulta se interrumpió al reiniciar el servidor. Puedes iniciarla de nuevo.',
      );
  }
  #row(id: string, competitionId: string): OperationRow {
    const row = this.#db
      .prepare<OperationRow>('SELECT * FROM competition_import_operations WHERE id = ? AND competition_id = ?')
      .get([id, competitionId]);
    if (!row) throw new HttpProblem(404, 'NOT_FOUND', 'No se encontró la operación de consulta.');
    return row;
  }
  #view(row: OperationRow) {
    return {
      operationId: row.id,
      competitionId: row.competition_id,
      providerKey: row.provider_key,
      externalSeasonId: row.external_season_id,
      destinationSeasonId: row.destination_season_id,
      resources: JSON.parse(row.resources_json) as string[],
      status: row.status,
      currentStage: row.current_stage,
      completedStages: JSON.parse(row.completed_stages_json) as PreviewStage[],
      cancellationRequested: row.cancellation_requested === 1,
      previewId: row.preview_id,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
  get(competitionId: string, id: string) {
    return this.#view(this.#row(id, competitionId));
  }
  eventsSince(competitionId: string, id: string, after: number) {
    this.#row(id, competitionId);
    return this.#db
      .prepare<EventRow>(
        'SELECT * FROM competition_import_operation_events WHERE operation_id = ? AND sequence > ? ORDER BY sequence',
      )
      .all([id, after])
      .map((row) => ({
        id: row.sequence,
        type: row.event_type,
        operationId: row.operation_id,
        status: row.status,
        stage: row.stage,
        previewId: row.preview_id,
        timestamp: row.created_at,
      }));
  }
  subscribe(id: string, listener: () => void) {
    if (this.#events.listenerCount(id) >= 5)
      throw new HttpProblem(
        409,
        'RUN_IN_PROGRESS',
        'Hay demasiadas conexiones de progreso abiertas para esta consulta.',
      );
    this.#events.on(id, listener);
    return () => this.#events.off(id, listener);
  }
  #transition(
    id: string,
    status: OperationStatus,
    stage: PreviewStage | null,
    eventType: string,
    previewId: string | null = null,
    errorCode: string | null = null,
    errorMessage: string | null = null,
    processedRecords: number | null = null,
  ) {
    const now = this.#container.clock.now().toISOString();
    let before: OperationRow | undefined;
    this.#db.transaction(() => {
      const row = this.#db.prepare<OperationRow>('SELECT * FROM competition_import_operations WHERE id = ?').get([id]);
      if (!row || terminal(row.status)) return;
      before = row;
      const done = JSON.parse(row.completed_stages_json) as PreviewStage[];
      if (eventType === 'stage.completed' && stage && !done.includes(stage)) done.push(stage);
      this.#db
        .prepare(
          "UPDATE competition_import_operations SET status = ?, current_stage = ?, completed_stages_json = ?, preview_id = ?, error_code = ?, error_message = ?, started_at = CASE WHEN ? = 'operation.started' THEN ? ELSE started_at END, updated_at = ?, completed_at = ? WHERE id = ?",
        )
        .run([
          status,
          stage,
          JSON.stringify(done),
          previewId ?? row.preview_id,
          errorCode,
          errorMessage,
          eventType,
          now,
          now,
          terminal(status) ? now : null,
          id,
        ]);
      this.#db
        .prepare(
          'INSERT INTO competition_import_operation_events(operation_id,event_type,status,stage,preview_id,created_at) VALUES (?,?,?,?,?,?)',
        )
        .run([id, eventType, status, stage, previewId, now]);
    });
    if (!before) return;
    const elapsed = performance.now();
    if (eventType === 'operation.started') this.#operationStarted.set(id, elapsed);
    if (eventType === 'stage.started' && stage) this.#stageStarted.set(`${id}:${stage}`, elapsed);
    const since =
      eventType === 'stage.completed' && stage
        ? this.#stageStarted.get(`${id}:${stage}`)
        : terminal(status)
          ? this.#operationStarted.get(id)
          : undefined;
    if (eventType === 'stage.completed' && stage) this.#stageStarted.delete(`${id}:${stage}`);
    if (terminal(status)) {
      this.#operationStarted.delete(id);
      for (const key of this.#stageStarted.keys()) if (key.startsWith(`${id}:`)) this.#stageStarted.delete(key);
    }
    this.#container.logger.info(
      {
        operationId: id,
        competitionId: before.competition_id,
        stage,
        previousStatus: before.status,
        status,
        timestamp: now,
        eventType,
        ...(since === undefined ? {} : { durationMs: Math.round(elapsed - since) }),
        ...(processedRecords === null ? {} : { processedRecords }),
      },
      'import preview operation transition',
    );
    this.#events.emit(id);
  }
  start(competitionId: string, input: ImportPreviewCreate) {
    const binding = this.#db
      .prepare<{ id: string; provider_key: string }>(
        'SELECT id, provider_key FROM competition_provider_bindings WHERE competition_id = ? AND status = ?',
      )
      .get([competitionId, 'active']);
    if (!binding)
      throw new HttpProblem(409, 'SELECTION_UNAVAILABLE', 'Vincula un proveedor antes de consultar datos deportivos.');
    if (
      input.destinationSeasonId &&
      !this.#db
        .prepare('SELECT id FROM competition_seasons WHERE id = ? AND competition_id = ?')
        .get([input.destinationSeasonId, competitionId])
    )
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'La temporada de destino no pertenece a esta competición.');
    const resources = [...input.resources].sort();
    const scopeKey = hash([
      competitionId,
      binding.id,
      input.externalSeasonId,
      input.destinationSeasonId ?? null,
      resources,
    ]);
    const now = this.#container.clock.now().toISOString();
    const existing = this.#db
      .prepare<OperationRow>(
        'SELECT * FROM competition_import_operations WHERE scope_key = ? ORDER BY created_at DESC LIMIT 20',
      )
      .all([scopeKey]);
    for (const row of existing) {
      if (row.status === 'queued' || row.status === 'running') return this.#view(row);
      if (row.status === 'completed' && row.preview_id) {
        try {
          const preview = this.#previews.get(competitionId, row.preview_id);
          // An incomplete snapshot is never reused: the advised retry asks the provider again (UI-06.3).
          if (!preview.stale && !previewIncomplete(preview)) return this.#view(row);
        } catch {
          /* Expired snapshots are never reused. */
        }
      }
    }
    const id = randomUUID();
    this.#db.transaction(() => {
      this.#db
        .prepare(
          'INSERT INTO competition_import_operations(id,competition_id,binding_id,provider_key,external_season_id,destination_season_id,resources_json,scope_key,status,current_stage,completed_stages_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run([
          id,
          competitionId,
          binding.id,
          binding.provider_key,
          input.externalSeasonId,
          input.destinationSeasonId ?? null,
          JSON.stringify(resources),
          scopeKey,
          'queued',
          null,
          '[]',
          now,
          now,
        ]);
      this.#db
        .prepare(
          'INSERT INTO competition_import_operation_events(operation_id,event_type,status,stage,preview_id,created_at) VALUES (?,?,?,?,?,?)',
        )
        .run([id, 'operation.queued', 'queued', null, null, now]);
    });
    queueMicrotask(() => void this.#run(id, competitionId, input));
    return this.get(competitionId, id);
  }
  async #run(id: string, competitionId: string, input: ImportPreviewCreate) {
    const controller = new AbortController();
    this.#controllers.set(id, controller);
    try {
      if (this.#row(id, competitionId).status === 'cancelled') return;
      this.#transition(id, 'running', 'fetching', 'operation.started');
      const preview = await this.#previews.createWithProgress(
        competitionId,
        input,
        (stage, state) => {
          if (controller.signal.aborted) throw controller.signal.reason;
          this.#transition(id, 'running', stage, `stage.${state}`);
        },
        controller.signal,
      );
      // A reused immutable snapshot has no new fetch stages; completion follows the validated stored result.
      this.#transition(
        id,
        'completed',
        null,
        'operation.completed',
        preview.previewId,
        null,
        null,
        preview.items.length,
      );
    } catch (error) {
      if (controller.signal.aborted || this.#row(id, competitionId).cancellation_requested)
        this.#transition(id, 'cancelled', null, 'operation.cancelled');
      else {
        const code =
          error instanceof HttpProblem ? error.code : error instanceof SourceError ? 'PROVIDER_FAILED' : 'INTERNAL';
        const message =
          error instanceof HttpProblem
            ? (error.detail ?? 'No se pudo preparar la vista previa.')
            : error instanceof SourceError
              ? 'No se pudieron consultar los datos del proveedor.'
              : 'No se pudo preparar la vista previa. Inténtalo de nuevo.';
        this.#container.logger.error(
          { operationId: id, code, errorName: error instanceof Error ? error.name : 'Unknown' },
          'import preview operation failed',
        );
        this.#transition(
          id,
          'failed',
          this.#row(id, competitionId).current_stage,
          'operation.failed',
          null,
          code,
          sanitizeText(message, 240),
        );
      }
    } finally {
      this.#controllers.delete(id);
    }
  }
  cancel(competitionId: string, id: string) {
    const row = this.#row(id, competitionId);
    if (terminal(row.status)) return this.#view(row);
    this.#db
      .prepare('UPDATE competition_import_operations SET cancellation_requested = 1, updated_at = ? WHERE id = ?')
      .run([this.#container.clock.now().toISOString(), id]);
    this.#container.logger.info(
      {
        operationId: id,
        competitionId,
        stage: row.current_stage,
        previousStatus: row.status,
        status: row.status,
        timestamp: this.#container.clock.now().toISOString(),
        eventType: 'operation.cancellation_requested',
      },
      'import preview cancellation requested',
    );
    this.#controllers.get(id)?.abort(new Error('operation cancelled'));
    if (row.status === 'queued') this.#transition(id, 'cancelled', null, 'operation.cancelled');
    return this.get(competitionId, id);
  }
}
