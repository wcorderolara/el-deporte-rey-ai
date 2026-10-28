import { useCallback, useEffect, useState } from 'react';

export type RequestState<T> =
  { status: 'idle' } | { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: unknown };

export interface ApiRequest<T> {
  state: RequestState<T>;
  /** Repeats the request (after a retryable failure). */
  reload: () => void;
  /** Replaces the loaded value with a newer one returned by another operation (for example an update). */
  replace: (data: T) => void;
}

type Outcome<T> = { status: 'success'; data: T } | { status: 'error'; error: unknown };

/**
 * Loads a value from the API while `key` is not null, and again whenever `key` changes or `reload` is called. The
 * previous request is aborted, and a late answer to an earlier key is ignored, so the state always matches the
 * current key. `load` must depend only on the values encoded in `key`.
 */
export function useApiRequest<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): ApiRequest<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ tag: string; outcome: Outcome<T> } | null>(null);
  const tag = key === null ? null : `${attempt}\u0000${key}`;

  useEffect(() => {
    if (tag === null) {
      return undefined;
    }
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setResult({ tag, outcome: { status: 'success', data } });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ tag, outcome: { status: 'error', error } });
        }
      },
    );
    return () => controller.abort();
    // `load` depends only on the values encoded in `tag`.
  }, [tag]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const replace = useCallback(
    (data: T) => {
      if (tag !== null) {
        setResult({ tag, outcome: { status: 'success', data } });
      }
    },
    [tag],
  );

  let state: RequestState<T>;
  if (tag === null) {
    state = { status: 'idle' };
  } else if (result !== null && result.tag === tag) {
    state = result.outcome;
  } else {
    state = { status: 'loading' };
  }
  return { state, reload, replace };
}
