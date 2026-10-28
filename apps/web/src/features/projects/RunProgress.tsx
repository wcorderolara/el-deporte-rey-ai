import { WorkflowStageSchema, type Failure, type Run, type StageStatus } from '@edr/contracts';

import { formatDateTime, StatusBadge, type BadgeTone } from '../../ui';
import { failureCodeLabel, runCopy, runStatusLabel, stageRunStatusLabel, workflowStageLabel } from './copy';
import styles from './Projects.module.css';

/** True while the run may still change (the UI polls it, R-203). */
export function isRunActive(run: Run): boolean {
  return run.status === 'pending' || run.status === 'running';
}

const STAGE_ORDER: readonly string[] = WorkflowStageSchema.options;

function sortStages(stages: readonly StageStatus[]): StageStatus[] {
  return [...stages].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
}

const stageTone: Record<StageStatus['status'], BadgeTone> = {
  pending: 'neutral',
  running: 'info',
  completed: 'positive',
  failed: 'caution',
  skipped: 'neutral',
};

/** Live summary of the run: its status and, while running, the current stage. */
export function runSummary(run: Run): string {
  const current = run.stages.find((stage) => stage.status === 'running');
  const summary = runCopy.summary(run.runNumber, run.status);
  return current === undefined
    ? summary
    : `${summary} ${workflowStageLabel[current.stage]}: ${runStatusLabel.running}.`;
}

/** Failure of a stage or run: the closed code as fixed text, with the source ID and the HTTP status when given. */
export function FailureReason({ failure }: { failure: Failure }) {
  return (
    <span className={styles.failure}>
      <span>{failureCodeLabel[failure.code]}</span>
      {failure.sourceId === null ? null : (
        <span className={styles.secondary}>{runCopy.failureSource(failure.sourceId)}</span>
      )}
      {failure.httpStatus === null ? null : (
        <span className={styles.secondary}>{runCopy.failureHttpStatus(failure.httpStatus)}</span>
      )}
    </span>
  );
}

function StageTimes({ stage }: { stage: StageStatus }) {
  if (stage.startedAt === null) {
    return <>{runCopy.notStarted}</>;
  }
  return (
    <>
      <time dateTime={stage.startedAt}>{formatDateTime(stage.startedAt)}</time>
      {stage.finishedAt === null ? null : (
        <>
          {' – '}
          <time dateTime={stage.finishedAt}>{formatDateTime(stage.finishedAt)}</time>
        </>
      )}
    </>
  );
}

/** Per-stage status of a run with the failure reason of a failed stage (R-203). */
export function RunProgress({ run }: { run: Run }) {
  const runTone: BadgeTone = run.status === 'completed' ? 'positive' : run.status === 'failed' ? 'caution' : 'info';
  const runSymbol = run.status === 'completed' ? '✓' : run.status === 'failed' ? '✕' : '…';
  return (
    <div className={styles.run}>
      <h3>{runCopy.heading(run.runNumber, run.kind)}</h3>
      <p>
        <StatusBadge label={runStatusLabel[run.status]} tone={runTone} symbol={runSymbol} />
      </p>
      {run.failure === null ? null : (
        <p>
          <span className={styles.fieldTitle}>{runCopy.failure}:</span> <FailureReason failure={run.failure} />
        </p>
      )}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption>{runCopy.stagesCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{runCopy.stageColumn}</th>
              <th scope="col">{runCopy.statusColumn}</th>
              <th scope="col">{runCopy.timesColumn}</th>
              <th scope="col">{runCopy.reasonColumn}</th>
            </tr>
          </thead>
          <tbody>
            {sortStages(run.stages).map((stage) => {
              const status = stageRunStatusLabel[stage.status];
              return (
                <tr key={stage.stage} data-stage={stage.stage}>
                  <th scope="row">{workflowStageLabel[stage.stage]}</th>
                  <td>
                    <StatusBadge label={status.label} tone={stageTone[stage.status]} symbol={status.symbol} />
                  </td>
                  <td>
                    <StageTimes stage={stage} />
                  </td>
                  <td>{stage.failure === null ? runCopy.noReason : <FailureReason failure={stage.failure} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
