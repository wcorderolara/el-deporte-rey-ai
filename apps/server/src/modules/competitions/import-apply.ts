import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  ImportApplicationSchema,
  ImportApplyPlanSchema,
  type ImportApplication,
  type ImportApplyDecision,
  type ImportApplyOperation,
  type ImportApplyPlan,
  type ImportApplyStage,
  type ImportApplyStart,
  type ImportPreview,
} from '@edr/contracts';
import type { AppContainer } from '../../container.js';
import type { Db } from '../../platform/db/db.js';
import { constraintKind } from '../../platform/db/errors.js';
import { HttpProblem, sanitizeText } from '../../platform/http/problem.js';
import { CompetitionAdministrationError } from './domain/errors.js';
import { CalendarError } from './calendar/domain/errors.js';
import type { CompetitionImportPreviewService } from './import-preview.js';
import { SQLiteImportLocalState } from './import-local-state.js';
import { executePlan } from './import-persist.js';
import { decisionKey, transformSnapshot, type ImportPlan } from './import-transform.js';

type OperationStatus = ImportApplyOperation['status'];
interface OperationRow {
  id: string;
  competition_id: string;
  preview_id: string;
  binding_id: string;
  provider_key: string;
  snapshot_hash: string;
  plan_hash: string;
  decisions_json: string;
  status: OperationStatus;
  current_stage: ImportApplyStage | null;
  completed_stages_json: string;
  cancellation_requested: number;
  application_id: string | null;
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
  stage: ImportApplyStage | null;
  application_id: string | null;
  created_at: string;
}
interface PreviewRow {
  binding_id: string;
  provider_key: string;
  preview_json: string;
  snapshot_hash: string;
}
interface Context {
  readonly snapshot: ImportPreview;
  readonly bindingId: string;
  readonly providerKey: string;
  readonly externalCompetitionId: string;
  readonly blockers: { code: string; message: string }[];
}

const NOTHING_SAVED = 'No se guardó ningún cambio.';
const terminal = (status: OperationStatus) => status === 'completed' || status === 'failed' || status === 'cancelled';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const nextTick = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Failure of an application with a stable, non-sensitive code and an operator-facing message. */
class ApplyFailure extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function canonicalDecisions(decisions: readonly ImportApplyDecision[]): string {
  return JSON.stringify(
    [...decisions]
      .map((decision) => ({ ...decision }))
      .sort((a, b) =>
        decisionKey(a.resource, a.externalScope, a.externalId).localeCompare(
          decisionKey(b.resource, b.externalScope, b.externalId),
        ),
      ),
  );
}

/**
 * PD-ARCH-01D-C confirmed application of a stored preview snapshot.
 *
 * The provider is never contacted. Validation, identity resolution and transformation run before the write lock and
 * report their stages; persistence runs entirely inside one `BEGIN IMMEDIATE` transaction that re-validates the
 * snapshot, recomputes the plan, requires the hash the operator confirmed, writes every entity, mapping, audit row and
 * the completed operation state, and commits or rolls back as a whole. A crash or error therefore never leaves a
 * partially applied season, and an application completed for a snapshot is returned again instead of repeated.
 */
export class CompetitionImportApplyService {
  readonly #db: Db;
  readonly #container: AppContainer;
  readonly #previews: CompetitionImportPreviewService;
  readonly #events = new EventEmitter();
  readonly #startedAt = new Map<string, number>();

  constructor(container: AppContainer, previews: CompetitionImportPreviewService) {
    this.#container = container;
    this.#db = container.db;
    this.#previews = previews;
    const interrupted = this.#db
      .prepare<OperationRow>("SELECT * FROM competition_import_apply_operations WHERE status IN ('queued', 'running')")
      .all();
    for (const row of interrupted)
      this.#transition(
        row.id,
        'failed',
        row.current_stage,
        'operation.failed',
        null,
        'INTERRUPTED',
        `La importación se interrumpió al reiniciar el servidor. ${NOTHING_SAVED} Puedes iniciarla de nuevo.`,
      );
  }

  /** Read-only dry run: what a confirmation would write now, the decisions it needs and its hash. */
  plan(competitionId: string, previewId: string, decisions: readonly ImportApplyDecision[]): ImportApplyPlan {
    const context = this.#context(competitionId, previewId);
    return this.#planView(competitionId, context, this.#transform(competitionId, context, decisions));
  }

  start(competitionId: string, previewId: string, input: ImportApplyStart): ImportApplyOperation {
    const decisionsJson = canonicalDecisions(input.decisions);
    const live = this.#db
      .prepare<OperationRow>(
        "SELECT * FROM competition_import_apply_operations WHERE competition_id = ? AND preview_id = ? AND status IN ('queued', 'running', 'completed')",
      )
      .get([competitionId, previewId]);
    if (live) {
      // Double submissions and browser retries of the same confirmation return the same operation.
      if (live.plan_hash === input.planHash && live.decisions_json === decisionsJson) return this.#view(live);
      throw new HttpProblem(
        409,
        live.status === 'completed' ? 'VERSION_CONFLICT' : 'RUN_IN_PROGRESS',
        live.status === 'completed'
          ? 'Esta vista previa ya se importó. Genera otra para aplicar cambios nuevos.'
          : 'Esta vista previa ya se está importando con otras decisiones.',
      );
    }
    if (
      this.#db
        .prepare(
          "SELECT 1 FROM competition_import_apply_operations WHERE competition_id = ? AND status IN ('queued', 'running')",
        )
        .get([competitionId])
    )
      throw new HttpProblem(409, 'RUN_IN_PROGRESS', 'Ya hay una importación en curso para esta competición.');
    const context = this.#context(competitionId, previewId);
    if (context.blockers.length) throw new HttpProblem(409, 'VERSION_CONFLICT', context.blockers[0]!.message);
    const plan = this.#transform(competitionId, context, input.decisions);
    if (plan.planHash !== input.planHash)
      throw new HttpProblem(
        409,
        'VERSION_CONFLICT',
        'La propuesta cambió desde tu revisión. Revísala de nuevo antes de confirmar.',
      );
    if (!plan.ready)
      throw new HttpProblem(
        409,
        'IMPORT_REJECTED',
        plan.blockers[0]?.message ?? 'La importación tiene registros sin resolver.',
      );
    const id = randomUUID();
    const now = this.#container.clock.now().toISOString();
    try {
      this.#db.transaction(() => {
        this.#db
          .prepare(
            'INSERT INTO competition_import_apply_operations (id, competition_id, preview_id, binding_id, provider_key, snapshot_hash, plan_hash, decisions_json, status, current_stage, completed_stages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run([
            id,
            competitionId,
            previewId,
            context.bindingId,
            context.providerKey,
            context.snapshot.snapshotHash,
            plan.planHash,
            decisionsJson,
            'queued',
            null,
            '[]',
            now,
            now,
          ]);
        this.#db
          .prepare(
            'INSERT INTO competition_import_apply_events (operation_id, event_type, status, stage, application_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run([id, 'operation.queued', 'queued', null, null, now]);
      });
    } catch (error) {
      // Another connection won the race for this snapshot or competition; the database index is authoritative.
      if (constraintKind(error) === 'unique')
        throw new HttpProblem(409, 'RUN_IN_PROGRESS', 'Ya hay una importación en curso para esta competición.');
      throw error;
    }
    this.#container.logger.info(
      { operationId: id, previewId, competitionId, status: 'queued', eventType: 'operation.queued' },
      'import application queued',
    );
    queueMicrotask(() => void this.#run(id, competitionId, previewId, input.decisions));
    return this.get(competitionId, id);
  }

  get(competitionId: string, operationId: string): ImportApplyOperation {
    return this.#view(this.#row(operationId, competitionId));
  }

  cancel(competitionId: string, operationId: string): ImportApplyOperation {
    const row = this.#row(operationId, competitionId);
    if (terminal(row.status)) return this.#view(row);
    if (row.current_stage === 'persisting')
      throw new HttpProblem(
        409,
        'RUN_IN_PROGRESS',
        'La importación ya está guardando los datos y no puede cancelarse.',
      );
    this.#db
      .prepare('UPDATE competition_import_apply_operations SET cancellation_requested = 1, updated_at = ? WHERE id = ?')
      .run([this.#container.clock.now().toISOString(), operationId]);
    if (row.status === 'queued') this.#transition(operationId, 'cancelled', null, 'operation.cancelled');
    return this.get(competitionId, operationId);
  }

  eventsSince(competitionId: string, operationId: string, after: number) {
    this.#row(operationId, competitionId);
    return this.#db
      .prepare<EventRow>(
        'SELECT * FROM competition_import_apply_events WHERE operation_id = ? AND sequence > ? ORDER BY sequence',
      )
      .all([operationId, after])
      .map((row) => ({
        id: row.sequence,
        type: row.event_type,
        operationId: row.operation_id,
        status: row.status,
        stage: row.stage,
        applicationId: row.application_id,
        timestamp: row.created_at,
      }));
  }

  subscribe(operationId: string, listener: () => void) {
    if (this.#events.listenerCount(operationId) >= 5)
      throw new HttpProblem(
        409,
        'RUN_IN_PROGRESS',
        'Hay demasiadas conexiones de progreso abiertas para esta importación.',
      );
    this.#events.on(operationId, listener);
    return () => this.#events.off(operationId, listener);
  }

  async #run(id: string, competitionId: string, previewId: string, decisions: readonly ImportApplyDecision[]) {
    const cancelled = () => this.#row(id, competitionId).cancellation_requested === 1;
    let stage: ImportApplyStage = 'validating';
    try {
      if (this.#row(id, competitionId).status !== 'queued') return;
      this.#transition(id, 'running', stage, 'operation.started');
      let context: Context | undefined;
      let plan: ImportPlan | undefined;
      const stages: [ImportApplyStage, () => void][] = [
        [
          'validating',
          () => {
            context = this.#context(competitionId, previewId);
            const blocker = context.blockers[0];
            if (blocker) throw new ApplyFailure('IMPORT_PREVIEW_STALE', blocker.message);
          },
        ],
        ['resolving_identities', () => (plan = this.#transform(competitionId, context!, decisions))],
        ['transforming', () => this.#requireConfirmed(id, competitionId, plan!)],
      ];
      for (const [name, work] of stages) {
        if (cancelled()) return this.#transition(id, 'cancelled', null, 'operation.cancelled');
        stage = name;
        this.#transition(id, 'running', stage, 'stage.started');
        work();
        this.#transition(id, 'running', stage, 'stage.completed');
        await nextTick();
      }
      if (cancelled()) return this.#transition(id, 'cancelled', null, 'operation.cancelled');
      // From here on the operation cannot be cancelled: persistence is a single synchronous transaction.
      stage = 'persisting';
      this.#transition(id, 'running', stage, 'stage.started');
      const application = this.#db.transaction(() => this.#persist(id, competitionId, previewId, decisions));
      this.#notify(id, 'completed', null, 'operation.completed', application);
    } catch (error) {
      const failure =
        error instanceof ApplyFailure
          ? error
          : error instanceof HttpProblem
            ? new ApplyFailure(error.code, error.detail ?? 'La vista previa ya no está disponible.')
            : error instanceof CompetitionAdministrationError || error instanceof CalendarError
              ? new ApplyFailure('IMPORT_INTEGRITY', 'Un registro no cumple las reglas del modelo local.')
              : new ApplyFailure('INTERNAL', 'No se pudo completar la importación.');
      if (!(error instanceof ApplyFailure || error instanceof HttpProblem))
        this.#container.logger.error(
          {
            operationId: id,
            previewId,
            competitionId,
            stage,
            code: failure.code,
            errorName: error instanceof Error ? error.name : 'Unknown',
            ...(error instanceof CompetitionAdministrationError || error instanceof CalendarError
              ? { domainCode: error.code }
              : {}),
          },
          'import application failed',
        );
      const message = failure.message.endsWith(NOTHING_SAVED) ? failure.message : `${failure.message} ${NOTHING_SAVED}`;
      this.#transition(id, 'failed', stage, 'operation.failed', null, failure.code, sanitizeText(message, 240));
    }
  }

  /** Everything that must be atomic with the sports writes. Runs inside `BEGIN IMMEDIATE`. */
  #persist(
    id: string,
    competitionId: string,
    previewId: string,
    decisions: readonly ImportApplyDecision[],
  ): ImportApplication {
    const row = this.#row(id, competitionId);
    if (row.status !== 'running') throw new ApplyFailure('INTERRUPTED', 'La importación ya no está activa.');
    if (this.#db.prepare('SELECT 1 FROM competition_import_applications WHERE preview_id = ?').get([previewId]))
      throw new ApplyFailure('ALREADY_APPLIED', 'Esta vista previa ya se importó.');
    const context = this.#context(competitionId, previewId);
    const blocker = context.blockers[0];
    if (blocker) throw new ApplyFailure('IMPORT_PREVIEW_STALE', blocker.message);
    const plan = this.#transform(competitionId, context, decisions);
    this.#requireConfirmed(id, competitionId, plan);
    const applicationId = randomUUID();
    const now = this.#container.clock.now();
    const { seasonId, counts } = executePlan(plan, {
      db: this.#db,
      competitionId,
      providerKey: context.providerKey,
      bindingId: context.bindingId,
      applicationId,
      now: () => this.#container.clock.now(),
    });
    const seasonLabel = this.#db
      .prepare<{ label: string }>('SELECT label FROM competition_seasons WHERE id = ? AND competition_id = ?')
      .get([seasonId, competitionId])?.label;
    if (!seasonLabel) throw new ApplyFailure('IMPORT_INTEGRITY', 'La temporada de destino no quedó registrada.');
    const application = ImportApplicationSchema.parse({
      applicationId,
      operationId: id,
      previewId,
      competitionId,
      providerName: context.snapshot.providerName,
      externalSeasonLabel: context.snapshot.externalSeasonLabel,
      destinationSeasonId: seasonId,
      destinationSeasonLabel: seasonLabel,
      appliedAt: now.toISOString(),
      counts,
      notApplied: plan.items
        .filter(
          (item) =>
            item.action === 'skip' ||
            (item.resource !== 'teams' && item.resource !== 'stages' && item.changes.some((change) => !change.applied)),
        )
        .slice(0, 500)
        .map((item) => ({
          resource: item.resource,
          externalId: item.externalId,
          title: item.title,
          action: item.action === 'skip' ? 'skip' : 'keep_local',
          reason: item.reason,
        })),
    } satisfies ImportApplication);
    this.#db
      .prepare(
        'INSERT INTO competition_import_applications (id, competition_id, preview_id, binding_id, provider_key, snapshot_hash, destination_season_id, result_json, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run([
        applicationId,
        competitionId,
        previewId,
        context.bindingId,
        context.providerKey,
        context.snapshot.snapshotHash,
        seasonId,
        JSON.stringify(application),
        application.appliedAt,
      ]);
    for (const decision of plan.decisions)
      this.#db
        .prepare(
          'INSERT INTO competition_import_decisions (id, application_id, resource, external_scope, external_id, action, local_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run([
          randomUUID(),
          applicationId,
          decision.resource,
          decision.externalScope ?? '',
          decision.externalId,
          decision.action,
          decision.localId,
          application.appliedAt,
        ]);
    this.#write(id, 'completed', null, 'operation.completed', applicationId);
    return application;
  }

  #requireConfirmed(id: string, competitionId: string, plan: ImportPlan) {
    if (plan.planHash !== this.#row(id, competitionId).plan_hash)
      throw new ApplyFailure(
        'IMPORT_PLAN_CHANGED',
        'Los datos locales cambiaron desde tu confirmación. Revisa la propuesta de nuevo.',
      );
    if (!plan.ready)
      throw new ApplyFailure(
        'IMPORT_BLOCKED',
        plan.blockers[0]?.message ?? 'La importación tiene registros sin resolver.',
      );
  }

  /** Loads the stored snapshot and every reason that makes it unsafe to apply now. Never contacts the provider. */
  #context(competitionId: string, previewId: string): Context {
    if (!this.#db.prepare('SELECT 1 FROM competitions WHERE id = ?').get([competitionId]))
      throw new HttpProblem(404, 'NOT_FOUND', 'No encontramos esta competición.');
    const row = this.#db
      .prepare<PreviewRow>(
        'SELECT binding_id, provider_key, preview_json, snapshot_hash FROM competition_import_previews WHERE id = ? AND competition_id = ?',
      )
      .get([previewId, competitionId]);
    if (!row) throw new HttpProblem(404, 'NOT_FOUND', 'No encontramos esta vista previa. Genera una nueva.');
    // Expired snapshots answer 410 here; the stale flag compares the local fingerprint and the active binding.
    const snapshot = this.#previews.get(competitionId, previewId);
    const raw = JSON.parse(row.preview_json) as { items?: unknown; snapshotHash?: unknown };
    const blockers: Context['blockers'] = [];
    if (sha(JSON.stringify(raw.items)) !== row.snapshot_hash || raw.snapshotHash !== row.snapshot_hash)
      blockers.push({
        code: 'SNAPSHOT_INTEGRITY',
        message: 'El snapshot no coincide con su huella. Genera otra vista previa.',
      });
    const binding = this.#db
      .prepare<{ id: string; provider_key: string; external_competition_id: string }>(
        "SELECT id, provider_key, external_competition_id FROM competition_provider_bindings WHERE competition_id = ? AND status = 'active'",
      )
      .get([competitionId]);
    if (!binding || binding.id !== row.binding_id || binding.provider_key !== snapshot.providerKey)
      blockers.push({
        code: 'BINDING_CHANGED',
        message: 'La fuente vinculada cambió después de generar la vista previa. Genera otra antes de importar.',
      });
    else if (this.#db.prepare('SELECT 1 FROM competition_import_applications WHERE preview_id = ?').get([previewId]))
      blockers.push({
        code: 'ALREADY_APPLIED',
        message: 'Esta vista previa ya se importó. Genera otra para aplicar cambios nuevos.',
      });
    else if (snapshot.stale)
      blockers.push({
        code: 'PREVIEW_STALE',
        message: 'Los datos locales cambiaron desde la vista previa. Genera otra antes de importar.',
      });
    if (
      this.#db
        .prepare(
          "SELECT 1 FROM competition_import_apply_operations WHERE competition_id = ? AND preview_id <> ? AND status IN ('queued', 'running')",
        )
        .get([competitionId, previewId])
    )
      blockers.push({ code: 'APPLY_IN_PROGRESS', message: 'Hay otra importación en curso para esta competición.' });
    return {
      snapshot,
      bindingId: row.binding_id,
      providerKey: row.provider_key,
      externalCompetitionId: binding?.external_competition_id ?? '',
      blockers,
    };
  }

  #transform(competitionId: string, context: Context, decisions: readonly ImportApplyDecision[]): ImportPlan {
    return transformSnapshot({
      competitionId,
      snapshot: context.snapshot,
      externalCompetitionId: context.externalCompetitionId,
      decisions,
      state: new SQLiteImportLocalState(this.#db, competitionId, context.providerKey),
      blockers: context.blockers,
    });
  }

  #planView(competitionId: string, context: Context, plan: ImportPlan): ImportApplyPlan {
    const review = plan.items.filter(
      (item) =>
        !['create', 'unchanged', 'reuse'].includes(item.action) || item.decision !== null || item.changes.length > 0,
    );
    return ImportApplyPlanSchema.parse({
      previewId: context.snapshot.previewId,
      competitionId,
      providerName: context.snapshot.providerName,
      externalCompetitionName: context.snapshot.externalCompetitionName,
      externalSeasonLabel: context.snapshot.externalSeasonLabel,
      destinationSeasonId: plan.season && 'id' in plan.season ? plan.season.id : null,
      destinationLabel: plan.destinationLabel,
      destinationIsNew: plan.destinationIsNew,
      expiresAt: context.snapshot.expiresAt,
      planHash: plan.planHash,
      ready: plan.ready,
      totals: plan.totals,
      counts: plan.counts,
      blockers: [...plan.blockers],
      warnings: [...plan.warnings],
      reviewItems: review.slice(0, 2000),
      reviewItemsTruncated: review.length > 2000,
    } satisfies ImportApplyPlan);
  }

  #row(id: string, competitionId: string): OperationRow {
    const row = this.#db
      .prepare<OperationRow>('SELECT * FROM competition_import_apply_operations WHERE id = ? AND competition_id = ?')
      .get([id, competitionId]);
    if (!row) throw new HttpProblem(404, 'NOT_FOUND', 'No encontramos esta importación.');
    return row;
  }

  #view(row: OperationRow): ImportApplyOperation {
    const result = row.application_id
      ? this.#db
          .prepare<{ result_json: string }>('SELECT result_json FROM competition_import_applications WHERE id = ?')
          .get([row.application_id])
      : undefined;
    return {
      operationId: row.id,
      competitionId: row.competition_id,
      previewId: row.preview_id,
      status: row.status,
      currentStage: row.current_stage,
      completedStages: JSON.parse(row.completed_stages_json) as ImportApplyStage[],
      cancellationRequested: row.cancellation_requested === 1,
      cancellable: !terminal(row.status) && row.current_stage !== 'persisting',
      application: result ? ImportApplicationSchema.parse(JSON.parse(result.result_json)) : null,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /** Persists one state change and its event; a nested call joins the caller's transaction. */
  #write(
    id: string,
    status: OperationStatus,
    stage: ImportApplyStage | null,
    eventType: string,
    applicationId: string | null = null,
    errorCode: string | null = null,
    errorMessage: string | null = null,
  ): OperationRow | undefined {
    const now = this.#container.clock.now().toISOString();
    return this.#db.transaction(() => {
      const row = this.#db
        .prepare<OperationRow>('SELECT * FROM competition_import_apply_operations WHERE id = ?')
        .get([id]);
      if (!row || terminal(row.status)) return undefined;
      const done = JSON.parse(row.completed_stages_json) as ImportApplyStage[];
      if (eventType === 'stage.completed' && stage && !done.includes(stage)) done.push(stage);
      this.#db
        .prepare(
          "UPDATE competition_import_apply_operations SET status = ?, current_stage = ?, completed_stages_json = ?, application_id = ?, error_code = ?, error_message = ?, started_at = CASE WHEN ? = 'operation.started' THEN ? ELSE started_at END, updated_at = ?, completed_at = ? WHERE id = ?",
        )
        .run([
          status,
          stage,
          JSON.stringify(done),
          applicationId,
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
          'INSERT INTO competition_import_apply_events (operation_id, event_type, status, stage, application_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run([id, eventType, status, stage, applicationId, now]);
      return row;
    });
  }

  /** Logs a committed state change and wakes its SSE subscribers. */
  #notify(
    id: string,
    status: OperationStatus,
    stage: ImportApplyStage | null,
    eventType: string,
    application?: ImportApplication,
    errorCode?: string | null,
  ) {
    const now = performance.now();
    if (eventType === 'operation.started') this.#startedAt.set(id, now);
    if (eventType === 'stage.started' && stage) this.#startedAt.set(`${id}:${stage}`, now);
    const since =
      eventType === 'stage.completed' && stage
        ? this.#startedAt.get(`${id}:${stage}`)
        : terminal(status)
          ? this.#startedAt.get(id)
          : undefined;
    if (terminal(status))
      for (const key of [...this.#startedAt.keys()]) if (key.startsWith(id)) this.#startedAt.delete(key);
    const row = this.#db
      .prepare<{ competition_id: string; preview_id: string }>(
        'SELECT competition_id, preview_id FROM competition_import_apply_operations WHERE id = ?',
      )
      .get([id]);
    this.#container.logger.info(
      {
        operationId: id,
        previewId: row?.preview_id,
        competitionId: row?.competition_id,
        stage,
        status,
        eventType,
        ...(since === undefined ? {} : { durationMs: Math.round(now - since) }),
        ...(application
          ? {
              applicationId: application.applicationId,
              destinationSeasonId: application.destinationSeasonId,
              counts: application.counts,
            }
          : {}),
        ...(errorCode ? { errorCode } : {}),
      },
      'import application transition',
    );
    this.#events.emit(id);
  }

  #transition(
    id: string,
    status: OperationStatus,
    stage: ImportApplyStage | null,
    eventType: string,
    applicationId: string | null = null,
    errorCode: string | null = null,
    errorMessage: string | null = null,
  ) {
    if (this.#write(id, status, stage, eventType, applicationId, errorCode, errorMessage))
      this.#notify(id, status, stage, eventType, undefined, errorCode);
  }
}
