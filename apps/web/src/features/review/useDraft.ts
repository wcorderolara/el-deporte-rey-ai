import type { Draft, Element, FinalApproval } from '@edr/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { replaceElement } from './model';
import type { ReviewApi } from './api';

export type DraftState =
  { status: 'loading' } | { status: 'success'; draft: Draft } | { status: 'error'; error: unknown };

export interface DraftRequest {
  state: DraftState;
  /** Loads the draft again, showing the loading state (after a failed first load). */
  reload: () => void;
  /** Loads the draft again in the background, keeping the shown draft until the answer arrives. */
  refresh: () => Promise<boolean>;
  refreshing: boolean;
  refreshError: unknown;
  /** Shows the element returned by an element operation until the next refresh. */
  showElement: (element: Element) => void;
  /** Shows the final approval returned by approveCarousel until the next refresh. */
  showFinalApproval: (approval: FinalApproval) => void;
}

/**
 * Active draft of a project (getActiveDraft). Each operation answer is shown at once, then the whole draft is
 * refreshed from the server, because readiness, final-approval validity and the blocked overlay are computed there.
 * A late answer to an earlier request is ignored.
 */
export function useDraft(api: ReviewApi, projectId: string): DraftRequest {
  const [state, setState] = useState<DraftState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    const id = ++sequence.current;
    api.getActiveDraft(projectId, current.signal).then(
      (draft) => {
        if (id === sequence.current) {
          setState({ status: 'success', draft });
        }
      },
      (error: unknown) => {
        if (id === sequence.current) {
          setState({ status: 'error', error });
        }
      },
    );
    return () => current.abort();
  }, [api, projectId, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setRefreshError(null);
    setAttempt((value) => value + 1);
  }, []);

  const refresh = useCallback(async () => {
    const current = new AbortController();
    controller.current?.abort();
    controller.current = current;
    const id = ++sequence.current;
    setRefreshing(true);
    setRefreshError(null);
    let refreshed = false;
    try {
      const draft = await api.getActiveDraft(projectId, current.signal);
      if (id === sequence.current) {
        setState({ status: 'success', draft });
        refreshed = true;
      }
    } catch (error) {
      if (id === sequence.current) setRefreshError(error);
    } finally {
      if (id === sequence.current) setRefreshing(false);
    }
    return refreshed;
  }, [api, projectId]);

  useEffect(() => () => controller.current?.abort(), []);

  const showElement = useCallback((element: Element) => {
    setState((previous) =>
      previous.status === 'success' ? { status: 'success', draft: replaceElement(previous.draft, element) } : previous,
    );
  }, []);

  const showFinalApproval = useCallback((approval: FinalApproval) => {
    setState((previous) =>
      previous.status === 'success'
        ? {
            status: 'success',
            draft: {
              ...previous.draft,
              carousels: previous.draft.carousels.map((carousel) =>
                carousel.id === approval.carouselId ? { ...carousel, finalApproval: approval } : carousel,
              ),
            },
          }
        : previous,
    );
  }, []);

  return { state, reload, refresh, refreshing, refreshError, showElement, showFinalApproval };
}
