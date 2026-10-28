import { useCallback, useEffect, useState } from 'react';

export type ResourceState<T> =
  { status: 'idle' } | { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: unknown };

export interface ApiResource<T> {
  state: ResourceState<T>;
  /** Loads again (after a failure, or after an import changed the data). */
  reload: () => void;
}

type Outcome<T> = { status: 'ready'; data: T } | { status: 'error'; error: unknown };

/**
 * Loads a value from the API while `key` is not null, again whenever `key` changes or `reload` is called. The previous
 * request is aborted and a late answer to an earlier key or attempt is ignored, so the state always matches the
 * current key. `load` must depend only on the values encoded in `key`. (Same model as the projects feature's
 * `useApiRequest`; features keep their hooks in their own directory.)
 */
export function useApiResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): ApiResource<T> {
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
          setResult({ tag, outcome: { status: 'ready', data } });
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

  let state: ResourceState<T>;
  if (tag === null) {
    state = { status: 'idle' };
  } else if (result !== null && result.tag === tag) {
    state = result.outcome;
  } else {
    state = { status: 'loading' };
  }
  return { state, reload };
}
