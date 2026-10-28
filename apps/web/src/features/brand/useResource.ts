import { useCallback, useEffect, useState } from 'react';

export type ResourceState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

export interface Resource<T> {
  state: ResourceState<T>;
  /** Loads again (after a failure, offered as a retry). */
  reload: () => void;
  /** Changes the loaded data locally (after a successful mutation); ignored while not loaded. */
  update: (change: (data: T) => T) => void;
}

/**
 * Loads a server resource when mounted and on reload. The request is aborted when the component unmounts or the
 * loader changes, and the result of an aborted request is ignored. `load` must be a stable function.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', data });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', error });
        }
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  const update = useCallback((change: (data: T) => T) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', data: change(current.data) } : current));
  }, []);

  return { state, reload, update };
}
