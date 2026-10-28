import { useCallback, useEffect, useState } from 'react';

export type LoadState<T> = { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: unknown };

export interface Load<T> {
  /** State of the current request (current key and attempt). */
  state: LoadState<T>;
  /**
   * Latest value loaded for the current key, kept while a reload is in progress or after it failed, so a refresh
   * does not blank the page; null before the first success for this key.
   */
  latest: T | null;
  /** Repeats the request (retry after a failure, or refresh after an export). */
  reload: () => void;
}

type Outcome<T> = { status: 'success'; data: T } | { status: 'error'; error: unknown };

/**
 * Loads a value from the API for `key`, and again whenever `key` changes or `reload` is called. The previous request
 * is aborted and a late answer to an earlier key or attempt is ignored, so the state always matches the current
 * request. `load` must depend only on the values encoded in `key`.
 */
export function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Load<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ tag: string; outcome: Outcome<T> } | null>(null);
  const [success, setSuccess] = useState<{ key: string; data: T } | null>(null);
  const tag = `${attempt}\u0000${key}`;

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setResult({ tag, outcome: { status: 'success', data } });
          setSuccess({ key, data });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ tag, outcome: { status: 'error', error } });
        }
      },
    );
    return () => controller.abort();
    // `load` depends only on the values encoded in `tag` (which includes `key`).
  }, [tag]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const state: LoadState<T> = result !== null && result.tag === tag ? result.outcome : { status: 'loading' };
  const latest = success !== null && success.key === key ? success.data : null;
  return { state, latest, reload };
}
