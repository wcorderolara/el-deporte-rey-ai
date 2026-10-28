/**
 * Workflow runner and run persistence (architecture.md section 6; AD-10). Modules import from this file only.
 */
export {
  type Failure,
  type FailureCode,
  MAX_FAILURE_PATH_LENGTH,
  StageFailure,
  failure,
  failureOf,
  issuePointer,
  sanitizeFailure,
} from './failure.js';
export {
  type RunKind,
  type RunRecord,
  RunRepository,
  type RunStatus,
  type RunView,
  type StageRunStatus,
} from './repository.js';
export {
  type AnyStage,
  type RunStartRefusal,
  RunStartRefused,
  STAGES_BY_KIND,
  STAGE_ORDER,
  type StageProvider,
  type StartRunOptions,
  WorkflowRunner,
  type WorkflowRunnerOptions,
  failInterruptedRuns,
  includesResearch,
} from './runner.js';
export {
  CONFIG_SNAPSHOT_VERSION,
  type ConfigSnapshot,
  ConfigSnapshotSchema,
  NO_RUN_PARAMETERS,
  type RunParameters,
  RunParametersSchema,
  buildConfigSnapshot,
} from './snapshot.js';
