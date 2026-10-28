/**
 * Run and stage persistence (`workflow_runs`, `stage_runs`; data-model.md section 3.1). Every statement is a constant
 * with bound parameters (T10-F14); failures are written and read through the contract's closed `Failure` schema
 * (T10-F10); rows are validated on read.
 */
import {
  FailureSchema,
  type Run,
  RunKindSchema,
  RunStatusSchema,
  StageRunStatusSchema,
  WorkflowStageSchema,
} from '@edr/contracts';

import type { StageName } from '../modules/module-kit.js';
import { type Db, readJsonColumn, readNullableJsonColumn, writeJsonColumn } from '../platform/db/index.js';

import type { Failure } from './failure.js';
import { type ConfigSnapshot, ConfigSnapshotSchema, type RunParameters } from './snapshot.js';

export type RunKind = 'full' | 'redraft';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StageRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** A run as the contract returns it (`Run`). */
export type RunView = Run;

/** Stored facts of a run that the runner needs to execute it. */
export interface RunRecord {
  readonly id: string;
  readonly projectId: string;
  readonly runNumber: number;
  readonly kind: RunKind;
  readonly baseRunId: string | null;
  readonly status: RunStatus;
}

interface RunRow {
  id: string;
  project_id: string;
  run_number: number;
  kind: string;
  base_run_id: string | null;
  status: string;
  failure: string | null;
  started_at: string | null;
  finished_at: string | null;
}

interface StageRow {
  run_id: string;
  stage: string;
  position: number;
  status: string;
  failure: string | null;
  started_at: string | null;
  finished_at: string | null;
}

const RUN_COLUMNS = 'id, project_id, run_number, kind, base_run_id, status, failure, started_at, finished_at';
const STAGE_COLUMNS = 'run_id, stage, position, status, failure, started_at, finished_at';

const ACTIVE_STATUSES = "('pending', 'running')";

const SQL = {
  insertRun:
    'INSERT INTO workflow_runs (id, project_id, run_number, kind, base_run_id, status, failure, config_snapshot, ' +
    "standings_availability, started_at, finished_at) VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, NULL, NULL)",
  insertStage:
    'INSERT INTO stage_runs (id, run_id, stage, position, status, failure, started_at, finished_at) ' +
    "VALUES (?, ?, ?, ?, 'pending', NULL, NULL, NULL)",
  nextRunNumber: 'SELECT COALESCE(MAX(run_number), 0) + 1 AS next FROM workflow_runs WHERE project_id = ?',
  activeRun: `SELECT id FROM workflow_runs WHERE project_id = ? AND status IN ${ACTIVE_STATUSES} LIMIT 1`,
  latestVerifiedRun:
    'SELECT r.id AS id FROM workflow_runs r JOIN stage_runs s ON s.run_id = r.id ' +
    "WHERE r.project_id = ? AND s.stage = 'verification' AND s.status = 'completed' " +
    'ORDER BY r.run_number DESC LIMIT 1',
  run: `SELECT ${RUN_COLUMNS} FROM workflow_runs WHERE id = ?`,
  runOfProject: `SELECT ${RUN_COLUMNS} FROM workflow_runs WHERE id = ? AND project_id = ?`,
  runsOfProject: `SELECT ${RUN_COLUMNS} FROM workflow_runs WHERE project_id = ? ORDER BY run_number DESC`,
  latestRunOfProject: `SELECT ${RUN_COLUMNS} FROM workflow_runs WHERE project_id = ? ORDER BY run_number DESC LIMIT 1`,
  stagesOfRun: `SELECT ${STAGE_COLUMNS} FROM stage_runs WHERE run_id = ? ORDER BY position`,
  snapshot: 'SELECT config_snapshot FROM workflow_runs WHERE id = ?',
  markRunRunning: "UPDATE workflow_runs SET status = 'running', started_at = ? WHERE id = ? AND status = 'pending'",
  markRunCompleted:
    "UPDATE workflow_runs SET status = 'completed', finished_at = ? WHERE id = ? AND status = 'running'",
  markRunFailed: `UPDATE workflow_runs SET status = 'failed', failure = ?, finished_at = ? WHERE id = ? AND status IN ${ACTIVE_STATUSES}`,
  markStageRunning:
    "UPDATE stage_runs SET status = 'running', started_at = ? WHERE run_id = ? AND stage = ? AND status = 'pending'",
  markStageCompleted:
    "UPDATE stage_runs SET status = 'completed', finished_at = ? WHERE run_id = ? AND stage = ? AND status = 'running'",
  markStageFailed:
    "UPDATE stage_runs SET status = 'failed', failure = ?, started_at = COALESCE(started_at, ?), finished_at = ? " +
    "WHERE run_id = ? AND stage = ? AND status IN ('pending', 'running')",
  skipPendingStages: "UPDATE stage_runs SET status = 'skipped' WHERE run_id = ? AND status = 'pending'",
  activeRuns: `SELECT id FROM workflow_runs WHERE status IN ${ACTIVE_STATUSES} ORDER BY id`,
  failRunningStagesOfRun:
    "UPDATE stage_runs SET status = 'failed', failure = ?, finished_at = ? WHERE run_id = ? AND status = 'running'",
} as const;

function failureColumn(value: Failure): string {
  return writeJsonColumn(FailureSchema, value, 'failure');
}

function toRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    runNumber: row.run_number,
    kind: RunKindSchema.parse(row.kind),
    baseRunId: row.base_run_id,
    status: RunStatusSchema.parse(row.status),
  };
}

/** Persistence of runs and stage runs over the `Db` port. */
export class RunRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** The ID of the project's active (`pending` or `running`) run, or null. */
  activeRunId(projectId: string): string | null {
    return this.#db.prepare<{ id: string }>(SQL.activeRun).get([projectId])?.id ?? null;
  }

  /** The latest run of the project whose verification stage completed (the facts a redraft reuses), or null. */
  latestVerifiedRunId(projectId: string): string | null {
    return this.#db.prepare<{ id: string }>(SQL.latestVerifiedRun).get([projectId])?.id ?? null;
  }

  /** Inserts a pending run and its pending stage runs; returns the run number. Call inside a transaction. */
  insertRun(input: {
    readonly id: string;
    readonly projectId: string;
    readonly kind: RunKind;
    readonly baseRunId: string | null;
    readonly snapshot: ConfigSnapshot;
    readonly stages: readonly { readonly id: string; readonly stage: StageName }[];
  }): number {
    const next = this.#db.prepare<{ next: number }>(SQL.nextRunNumber).get([input.projectId])?.next ?? 1;
    this.#db
      .prepare(SQL.insertRun)
      .run([
        input.id,
        input.projectId,
        next,
        input.kind,
        input.baseRunId,
        writeJsonColumn(ConfigSnapshotSchema, input.snapshot, 'config_snapshot'),
      ]);
    input.stages.forEach((stage, index) => {
      this.#db.prepare(SQL.insertStage).run([stage.id, input.id, stage.stage, index + 1]);
    });
    return next;
  }

  record(runId: string): RunRecord | null {
    const row = this.#db.prepare<RunRow>(SQL.run).get([runId]);
    return row === undefined ? null : toRecord(row);
  }

  /** The stage names of a run in position order. */
  stageNames(runId: string): StageName[] {
    return this.#db
      .prepare<StageRow>(SQL.stagesOfRun)
      .all([runId])
      .map((row) => WorkflowStageSchema.parse(row.stage));
  }

  /** The run parameters stored in the run's configuration snapshot. */
  parameters(runId: string): RunParameters | null {
    const row = this.#db.prepare<{ config_snapshot: string }>(SQL.snapshot).get([runId]);
    return row === undefined
      ? null
      : readJsonColumn(ConfigSnapshotSchema, row.config_snapshot, 'config_snapshot').parameters;
  }

  /** The configuration snapshot of a run. */
  snapshot(runId: string): ConfigSnapshot | null {
    const row = this.#db.prepare<{ config_snapshot: string }>(SQL.snapshot).get([runId]);
    return row === undefined ? null : readJsonColumn(ConfigSnapshotSchema, row.config_snapshot, 'config_snapshot');
  }

  view(runId: string): RunView | null {
    const row = this.#db.prepare<RunRow>(SQL.run).get([runId]);
    return row === undefined ? null : this.#toView(row);
  }

  viewOfProject(projectId: string, runId: string): RunView | null {
    const row = this.#db.prepare<RunRow>(SQL.runOfProject).get([runId, projectId]);
    return row === undefined ? null : this.#toView(row);
  }

  /** Runs of a project, newest first. */
  listViews(projectId: string): RunView[] {
    return this.#db
      .prepare<RunRow>(SQL.runsOfProject)
      .all([projectId])
      .map((row) => this.#toView(row));
  }

  latestView(projectId: string): RunView | null {
    const row = this.#db.prepare<RunRow>(SQL.latestRunOfProject).get([projectId]);
    return row === undefined ? null : this.#toView(row);
  }

  markRunRunning(runId: string, at: string): boolean {
    return this.#db.prepare(SQL.markRunRunning).run([at, runId]).changes === 1;
  }

  markStageRunning(runId: string, stage: StageName, at: string): boolean {
    return this.#db.prepare(SQL.markStageRunning).run([at, runId, stage]).changes === 1;
  }

  markStageCompleted(runId: string, stage: StageName, at: string): void {
    this.#db.prepare(SQL.markStageCompleted).run([at, runId, stage]);
  }

  markRunCompleted(runId: string, at: string): void {
    this.#db.prepare(SQL.markRunCompleted).run([at, runId]);
  }

  /** Fails the stage and the run with one failure and skips the remaining stages, in one transaction. */
  failRun(runId: string, stage: StageName, value: Failure, at: string): void {
    const stored = failureColumn(value);
    this.#db.transaction(() => {
      this.#db.prepare(SQL.markStageFailed).run([stored, at, at, runId, stage]);
      this.#db.prepare(SQL.skipPendingStages).run([runId]);
      this.#db.prepare(SQL.markRunFailed).run([stored, at, runId]);
    });
  }

  /**
   * Marks every run left `pending` or `running` as failed with `interrupted` (startup, AD-10): its running stage
   * fails with the same failure and its pending stages are skipped. Returns the number of runs marked.
   */
  failInterruptedRuns(value: Failure, at: string): number {
    const stored = failureColumn(value);
    return this.#db.transaction(() => {
      const ids = this.#db
        .prepare<{ id: string }>(SQL.activeRuns)
        .all()
        .map((row) => row.id);
      for (const id of ids) {
        this.#db.prepare(SQL.failRunningStagesOfRun).run([stored, at, id]);
        this.#db.prepare(SQL.skipPendingStages).run([id]);
        this.#db.prepare(SQL.markRunFailed).run([stored, at, id]);
      }
      return ids.length;
    });
  }

  #toView(row: RunRow): RunView {
    const stages = this.#db
      .prepare<StageRow>(SQL.stagesOfRun)
      .all([row.id])
      .map((stage) => ({
        stage: WorkflowStageSchema.parse(stage.stage),
        status: StageRunStatusSchema.parse(stage.status),
        startedAt: stage.started_at,
        finishedAt: stage.finished_at,
        failure: readNullableJsonColumn(FailureSchema, stage.failure, 'failure'),
      }));
    return {
      id: row.id,
      projectId: row.project_id,
      runNumber: row.run_number,
      kind: RunKindSchema.parse(row.kind),
      status: RunStatusSchema.parse(row.status),
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      failure: readNullableJsonColumn(FailureSchema, row.failure, 'failure'),
      stages,
    };
  }
}
