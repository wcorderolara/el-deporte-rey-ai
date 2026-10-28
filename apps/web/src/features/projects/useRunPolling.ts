import type { Run } from '@edr/contracts';
import { useEffect, useState } from 'react';

import { ApiError, isRetryable } from '../../api/client';
import type { ProjectsApi } from './api';
import { isRunActive } from './RunProgress';

export interface RunPolling {
  /** The run shown: the project's latest run, then every newer state received. */
  run: Run | null;
  /** Shows a run returned by startRun. */
  setRun: (run: Run) => void;
  /** Last polling failure, cleared by the next successful poll. */
  pollError: unknown;
  /** True when polling stopped after a failure that is not retryable. */
  stopped: boolean;
  /** Polls again after a failure. */
  resume: () => void;
}

/**
 * Polls `getRun` while the run is pending or running (contract: "Polled by the UI"), one request at a time, every
 * `intervalMs`. A retryable failure keeps polling; any other failure stops it until `resume`. `onFinished` is called
 * once when the run leaves the active states.
 */
export function useRunPolling(
  api: ProjectsApi,
  projectId: string,
  initialRun: Run | null,
  intervalMs: number,
  onFinished: () => void,
): RunPolling {
  const [run, setRun] = useState<Run | null>(initialRun);
  const [pollError, setPollError] = useState<unknown>(null);
  const [stopped, setStopped] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (run === null || !isRunActive(run) || stopped) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.getRun(projectId, run.id, controller.signal).then(
        (next) => {
          if (controller.signal.aborted) {
            return;
          }
          setPollError(null);
          setRun(next);
          if (!isRunActive(next)) {
            onFinished();
          }
        },
        (error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          setPollError(error);
          if (error instanceof ApiError && isRetryable(error)) {
            setTick((value) => value + 1);
          } else {
            setStopped(true);
          }
        },
      );
    }, intervalMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // A new run object (each poll answer) or a retry schedules the next poll.
  }, [run, tick, stopped]);

  return {
    run,
    setRun: (next: Run) => {
      setPollError(null);
      setStopped(false);
      setRun(next);
    },
    pollError,
    stopped,
    resume: () => {
      setStopped(false);
      setTick((value) => value + 1);
    },
  };
}
