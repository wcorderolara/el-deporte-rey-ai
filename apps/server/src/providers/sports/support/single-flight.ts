/**
 * Single-flight of identical concurrent cache misses (contracts/provider-ports.md section 1.4; T11H-F06): callers
 * that ask for the same key while a provider request for it is running share that one request instead of spending
 * budget on duplicates. Generic.
 *
 * The shared request gets its own abort signal, which aborts only when every caller that joined it has aborted; each
 * caller still stops waiting as soon as its own signal aborts (`WaitAborted`). Flights live in a `Map` (T11H-F07) and
 * are removed when they settle, so a later miss starts a new request.
 */
import { WaitAborted } from './scheduler.js';

interface Flight<T> {
  readonly promise: Promise<T>;
  readonly controller: AbortController;
  participants: number;
  aborted: number;
}

export class SingleFlight<T> {
  readonly #flights = new Map<string, Flight<T>>();

  /** Runs `task` for `key`, or joins the running flight of the same key. */
  run(key: string, signal: AbortSignal, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (signal.aborted) {
      return Promise.reject(new WaitAborted());
    }
    let flight = this.#flights.get(key);
    if (flight === undefined) {
      const controller = new AbortController();
      const started: Flight<T> = {
        promise: Promise.resolve()
          .then(() => task(controller.signal))
          .finally(() => {
            if (this.#flights.get(key) === started) {
              this.#flights.delete(key);
            }
          }),
        controller,
        participants: 0,
        aborted: 0,
      };
      // The flight's own rejection is observed by every participant; this handler only prevents an unhandled
      // rejection when all participants have stopped waiting.
      started.promise.catch(() => undefined);
      this.#flights.set(key, started);
      flight = started;
    }
    const current = flight;
    current.participants += 1;

    return new Promise<T>((resolve, reject) => {
      const onAbort = (): void => {
        current.aborted += 1;
        if (current.aborted >= current.participants) {
          current.controller.abort();
        }
        reject(new WaitAborted());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      current.promise.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error instanceof Error ? error : new Error('single-flight task failed'));
        },
      );
    });
  }

  /** Number of running flights (test accessor). */
  get size(): number {
    return this.#flights.size;
  }
}
