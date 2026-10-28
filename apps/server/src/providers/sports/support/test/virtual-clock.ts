/**
 * Test-only virtual clock (T49): implements the injected `Clock` and the timer capability that `schedulerFor` uses,
 * on a virtual time line that moves only when a test advances it. Waits of the request budget and the retry policy
 * therefore take no real time, and the 60-second window property is checked deterministically. Not used by
 * production code.
 */
import type { RandomSource } from '../scheduler.js';

interface Timer {
  readonly at: number;
  readonly seq: number;
  readonly callback: () => void;
}

/** Lets pending promise reactions run (microtasks and one macrotask turn). */
export async function flush(turns = 3): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export class VirtualClock {
  #now: number;
  #seq = 0;
  #timers: Timer[] = [];

  constructor(start: string | number = '2026-10-27T12:00:00.000Z') {
    this.#now = typeof start === 'number' ? start : Date.parse(start);
  }

  now(): Date {
    return new Date(this.#now);
  }

  nowMs(): number {
    return this.#now;
  }

  iso(): string {
    return new Date(this.#now).toISOString();
  }

  setTimer(delayMs: number, callback: () => void): () => void {
    const timer: Timer = { at: this.#now + Math.max(0, delayMs), seq: (this.#seq += 1), callback };
    this.#timers.push(timer);
    return () => {
      this.#timers = this.#timers.filter((candidate) => candidate !== timer);
    };
  }

  /** Number of armed timers. */
  get pendingTimers(): number {
    return this.#timers.length;
  }

  #nextTimer(): Timer | undefined {
    let next: Timer | undefined;
    for (const timer of this.#timers) {
      if (next === undefined || timer.at < next.at || (timer.at === next.at && timer.seq < next.seq)) {
        next = timer;
      }
    }
    return next;
  }

  #fire(timer: Timer): void {
    this.#timers = this.#timers.filter((candidate) => candidate !== timer);
    this.#now = Math.max(this.#now, timer.at);
    timer.callback();
  }

  /** Moves time forward by `ms`, firing every timer due on the way in order. */
  async advance(ms: number): Promise<void> {
    const target = this.#now + ms;
    await flush();
    for (;;) {
      const next = this.#nextTimer();
      if (next === undefined || next.at > target) {
        break;
      }
      this.#fire(next);
      await flush();
    }
    this.#now = target;
    await flush();
  }

  /**
   * Runs virtual time until `promise` settles: lets pending work run, then jumps to the next timer, repeatedly.
   * Fails when nothing is pending and the promise is still open, or after `maxSteps` timers.
   */
  async run<T>(promise: Promise<T>, maxSteps = 10_000): Promise<T> {
    let settled = false;
    const observed = promise.then(
      (value) => {
        settled = true;
        return value;
      },
      (error: unknown) => {
        settled = true;
        throw error;
      },
    );
    observed.catch(() => undefined);
    for (let step = 0; step < maxSteps; step += 1) {
      await flush();
      if (settled) {
        return observed;
      }
      const next = this.#nextTimer();
      if (next === undefined) {
        throw new Error('virtual clock: the promise is pending and no timer is armed');
      }
      this.#fire(next);
    }
    throw new Error('virtual clock: too many steps');
  }
}

/** A deterministic random source cycling through `values` (default: always the middle, no jitter). */
export function fixedRandom(values: readonly number[] = [0.5]): RandomSource {
  let index = 0;
  return {
    next(): number {
      const value = values[index % values.length] ?? 0.5;
      index += 1;
      return value;
    },
  };
}
