/**
 * Time and randomness seams of the generic support layer (contracts/provider-ports.md section 1.4; AD-26, AD-27).
 *
 * Every wait of the request budget and of the retry policy runs on a `Scheduler`: production code uses the injected
 * clock with real timers; tests use a virtual clock and advance it explicitly, so the 60-second window and every
 * backoff are proven without real waiting. Nothing here names a provider.
 */
import type { Clock } from '../ingestion/index.js';

/** Milliseconds on the injected clock and timers on the same time line. */
export interface Scheduler {
  /** The current time in milliseconds since the epoch, from the injected clock. */
  nowMs(): number;
  /** Calls `callback` once after `delayMs` (at least 0); returns a function that cancels the timer. */
  setTimer(delayMs: number, callback: () => void): () => void;
}

/** A source of numbers in [0, 1) used for deterministic jitter in tests. */
export interface RandomSource {
  next(): number;
}

/** The default random source of production code. */
export const systemRandom: RandomSource = Object.freeze({ next: (): number => Math.random() });

/** Optional timer capability of an injected clock (the virtual clock of the tests implements it). */
interface TimerCapableClock extends Clock {
  setTimer(delayMs: number, callback: () => void): () => void;
}

function hasTimers(clock: Clock): clock is TimerCapableClock {
  return typeof (clock as Partial<TimerCapableClock>).setTimer === 'function';
}

/**
 * The scheduler of an injected clock: the clock's own timers when it provides them (virtual time in tests), else the
 * clock's time with real timers.
 */
export function schedulerFor(clock: Clock): Scheduler {
  if (hasTimers(clock)) {
    return Object.freeze({
      nowMs: (): number => clock.now().getTime(),
      setTimer: (delayMs: number, callback: () => void): (() => void) => clock.setTimer(delayMs, callback),
    });
  }
  return Object.freeze({
    nowMs: (): number => clock.now().getTime(),
    setTimer(delayMs: number, callback: () => void): () => void {
      const handle = setTimeout(callback, Math.max(0, delayMs));
      return () => clearTimeout(handle);
    },
  });
}

/** Raised when the caller's signal aborts a wait; adapters map it to their own cancellation failure. */
export class WaitAborted extends Error {
  override readonly name = 'WaitAborted';

  constructor() {
    super('wait cancelled');
  }
}

/** Waits `delayMs` on the scheduler; rejects with `WaitAborted` when `signal` aborts first. */
export function sleep(scheduler: Scheduler, delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) {
    return Promise.reject(new WaitAborted());
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      cancel();
      reject(new WaitAborted());
    };
    const cancel = scheduler.setTimer(delayMs, () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
