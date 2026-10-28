/**
 * Workflow runner (architecture.md section 6; AD-10; contracts/provider-ports.md section 3).
 *
 * - `start(projectId, kind)` creates a `workflow_runs` row and its `stage_runs` (pending) in one `BEGIN IMMEDIATE`
 *   transaction, after the guards: one active (`pending` or `running`) run per project (`run_in_progress`), and for a
 *   redraft a completed verification to reuse (`no_verified_run`). The guards and the writes are atomic (T10-F15).
 * - The run then executes in the same process, sequentially, with the stages in the fixed order: `full` runs
 *   research, verification, content, rendering, visual QA; `redraft` runs content, rendering, visual QA and records
 *   the run whose facts it reuses (`base_run_id`).
 * - Each stage is `load` -> `input.parse` -> `run` -> `output.parse` -> `persist`. A stage that is not available
 *   fails the run with `stage_not_available`. A stage failure stops the run: the stage is `failed` with the closed
 *   `Failure` (T10-F10), later stages are `skipped`, the run is `failed`. The operator starts a new run (R-203).
 * - Runs left `pending` or `running` by a stopped process are failed with `interrupted` at startup
 *   (`failInterruptedRuns`); runs still active when the runner shuts down are cancelled and failed the same way.
 * - The run's configuration snapshot is built from the parsed configuration only (T10-F11, AD-30).
 */
import { randomUUID } from 'node:crypto';

import type { AppContainer } from '../container.js';
import type { Stage, StageContext, StageName } from '../modules/module-kit.js';
import { summarizeError } from '../platform/http/index.js';

import { failure, failureOf } from './failure.js';
import { type RunKind, RunRepository, type RunView } from './repository.js';
import { NO_RUN_PARAMETERS, type RunParameters, buildConfigSnapshot } from './snapshot.js';

/** The fixed stage order (architecture.md section 6). */
export const STAGE_ORDER: readonly StageName[] = Object.freeze([
  'research',
  'verification',
  'content',
  'rendering',
  'visual_qa',
]);

/** The stages each run kind executes, in order. */
export const STAGES_BY_KIND: Readonly<Record<RunKind, readonly StageName[]>> = Object.freeze({
  full: STAGE_ORDER,
  redraft: Object.freeze(['content', 'rendering', 'visual_qa'] as const),
});

/** A stage as registered by a module (`ServerModule.stages`). */
export type AnyStage = Stage<unknown, unknown>;

/** Supplies the registered stages; read when a run executes. */
export type StageProvider = () => readonly AnyStage[] | Promise<readonly AnyStage[]>;

export type RunStartRefusal = 'run_in_progress' | 'no_verified_run';

/** A run that cannot start; the caller maps the reason to its problem (`RUN_IN_PROGRESS`, `NO_VERIFIED_RUN`). */
export class RunStartRefused extends Error {
  override readonly name = 'RunStartRefused';
  readonly reason: RunStartRefusal;

  constructor(reason: RunStartRefusal) {
    super(`run start refused: ${reason}`);
    this.reason = reason;
  }
}

export interface StartRunOptions {
  /** Run parameters recorded in the configuration snapshot (for example a redraft's excluded matches). */
  readonly parameters?: RunParameters;
  /** Runs first inside the start transaction (for example the project existence check); may throw. */
  readonly before?: () => void;
  /** Runs inside the start transaction after the guards passed, before the run is inserted; may throw. */
  readonly afterGuards?: () => void;
}

export interface WorkflowRunnerOptions {
  readonly container: AppContainer;
  readonly stages: StageProvider;
  /** ID generator; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

interface ActiveRun {
  readonly controller: AbortController;
  readonly done: Promise<void>;
}

/** The in-process workflow runner of one container. */
export class WorkflowRunner {
  readonly #container: AppContainer;
  readonly #stages: StageProvider;
  readonly #newId: () => string;
  readonly #runs: RunRepository;
  readonly #active = new Map<string, ActiveRun>();
  #closed = false;

  constructor(options: WorkflowRunnerOptions) {
    this.#container = options.container;
    this.#stages = options.stages;
    this.#newId = options.newId ?? randomUUID;
    this.#runs = new RunRepository(options.container.db);
  }

  /** The run repository (read access for routes). */
  get runs(): RunRepository {
    return this.#runs;
  }

  /**
   * Creates a run and starts executing it; returns the run as created (`pending`).
   *
   * @throws RunStartRefused when a run is active or a redraft has no completed verification to reuse.
   */
  start(projectId: string, kind: RunKind, options: StartRunOptions = {}): RunView {
    if (this.#closed) {
      throw new Error('the workflow runner is shut down');
    }
    const { db, config } = this.#container;
    const runId = this.#newId();
    const view = db.transaction(() => {
      options.before?.();
      if (this.#runs.activeRunId(projectId) !== null) {
        throw new RunStartRefused('run_in_progress');
      }
      let baseRunId: string | null = null;
      if (kind === 'redraft') {
        baseRunId = this.#runs.latestVerifiedRunId(projectId);
        if (baseRunId === null) {
          throw new RunStartRefused('no_verified_run');
        }
      }
      options.afterGuards?.();
      this.#runs.insertRun({
        id: runId,
        projectId,
        kind,
        baseRunId,
        snapshot: buildConfigSnapshot(config, options.parameters ?? NO_RUN_PARAMETERS),
        stages: STAGES_BY_KIND[kind].map((stage) => ({ id: this.#newId(), stage })),
      });
      const created = this.#runs.view(runId);
      if (created === null) {
        throw new Error('the created run was not found');
      }
      return created;
    });
    this.#launch(runId, projectId, kind);
    return view;
  }

  /** Resolves when the run has stopped executing in this process (immediately when it is not active here). */
  settled(runId: string): Promise<void> {
    return this.#active.get(runId)?.done ?? Promise.resolve();
  }

  /** Resolves when no run is executing in this process. */
  async idle(): Promise<void> {
    while (this.#active.size > 0) {
      await Promise.all([...this.#active.values()].map((run) => run.done));
    }
  }

  /** Number of runs executing in this process. */
  get activeCount(): number {
    return this.#active.size;
  }

  /** Cancels every executing run (each is failed with `interrupted`) and waits for them; refuses new runs. */
  async shutdown(): Promise<void> {
    this.#closed = true;
    for (const run of this.#active.values()) {
      run.controller.abort();
    }
    await this.idle();
  }

  #launch(runId: string, projectId: string, kind: RunKind): void {
    const controller = new AbortController();
    const done = this.#execute(runId, projectId, kind, controller.signal)
      .catch((error: unknown) => {
        this.#container.logger.error({ runId, err: summarizeError(error) }, 'workflow run bookkeeping failed');
      })
      .finally(() => {
        this.#active.delete(runId);
      });
    this.#active.set(runId, { controller, done });
  }

  #now(): string {
    return this.#container.clock.now().toISOString();
  }

  async #execute(runId: string, projectId: string, kind: RunKind, signal: AbortSignal): Promise<void> {
    // Execution starts after the creating request has read its answer.
    await Promise.resolve();
    const { logger } = this.#container;
    const stageNames = this.#runs.stageNames(runId);
    if (!this.#runs.markRunRunning(runId, this.#now())) {
      return;
    }
    let registered: readonly AnyStage[];
    try {
      registered = await this.#stages();
    } catch (error) {
      logger.error({ runId, err: summarizeError(error) }, 'workflow stages could not be read');
      registered = [];
    }
    const byName = new Map<StageName, AnyStage>();
    for (const stage of registered) {
      if (!byName.has(stage.name)) {
        byName.set(stage.name, stage);
      }
    }

    for (const name of stageNames) {
      if (signal.aborted) {
        this.#runs.failRun(runId, name, failure('interrupted'), this.#now());
        return;
      }
      const stage = byName.get(name);
      if (stage === undefined) {
        this.#runs.failRun(runId, name, failure('stage_not_available'), this.#now());
        logger.warn({ runId, stage: name, code: 'stage_not_available' }, 'workflow stage failed');
        return;
      }
      this.#runs.markStageRunning(runId, name, this.#now());
      const ctx: StageContext = { runId, projectId, runKind: kind, container: this.#container, signal };
      try {
        const input = stage.input.parse(await stage.load(ctx));
        const output = stage.output.parse(await stage.run(input, ctx));
        if (signal.aborted) {
          throw signal.reason;
        }
        await stage.persist(output, ctx);
      } catch (error) {
        const value = failureOf(error, signal.aborted);
        this.#runs.failRun(runId, name, value, this.#now());
        logger.warn(
          { runId, stage: name, code: value.code, sourceId: value.sourceId, httpStatus: value.httpStatus },
          'workflow stage failed',
        );
        if (value.code === 'internal') {
          logger.error({ runId, stage: name, err: summarizeError(error) }, 'workflow stage error');
        }
        return;
      }
      this.#runs.markStageCompleted(runId, name, this.#now());
    }
    this.#runs.markRunCompleted(runId, this.#now());
  }
}

/** Fails every run left `pending` or `running` by a stopped process with `interrupted` (startup hook, AD-10). */
export function failInterruptedRuns(container: Pick<AppContainer, 'db' | 'clock'>): number {
  return new RunRepository(container.db).failInterruptedRuns(
    failure('interrupted'),
    container.clock.now().toISOString(),
  );
}
