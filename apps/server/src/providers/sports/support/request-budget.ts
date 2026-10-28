/**
 * Request budget of one source (contracts/provider-ports.md section 1.4; AD-26; R-131, R-141, R-249, R-291, R-312;
 * T11H-F05, T11H-F06). Generic and provider-neutral: it knows request classes, a sliding window and server counters,
 * never a provider, a header name or a URL.
 *
 * - One serialized queue per source: at most one request is in flight (concurrency 1).
 * - A request is admitted only when (a) fewer than `requestsPerMinute` requests were sent in the last 60 seconds
 *   (sliding log on the injected clock), and (b) the last response did not report zero remaining requests, or its
 *   counter reset time has passed. A 429 blocks the source until its reset (`blockFor`).
 * - Priority and fairness: priority requests (research, verification, consultation) are admitted before waiting
 *   discovery requests; discovery is admitted only while fewer than `requestsPerMinute - researchReservedSlots`
 *   requests were sent in the window, so the reserved slots stay free for priority requests; at most
 *   `maxDiscoveryWaiters` discovery requests wait, and a further one is refused at once.
 * - Every acquisition has a longest wait. A request whose admission time lies beyond its wait is refused at once
 *   with the time until admission (`retryAfterSeconds`); a request still waiting at its deadline is refused then.
 * - Retries and waits consume the same budget: every attempt acquires its own permit.
 */
import type { ServerCounters } from './counters.js';
import { type Scheduler, WaitAborted } from './scheduler.js';

/** Length of the sliding window. */
export const BUDGET_WINDOW_MS = 60_000;

/** Request classes: discovery (catalogue browsing) and priority (research, verification, consultation). */
export type BudgetClass = 'discovery' | 'priority';

export interface RequestBudgetOptions {
  /** Requests per sliding 60-second window; 1 to 60. */
  readonly requestsPerMinute: number;
  /** Slots of each window that discovery may not use; 0 to `requestsPerMinute - 1`. */
  readonly researchReservedSlots: number;
  /** Discovery requests allowed to wait; 1 to 100. */
  readonly maxDiscoveryWaiters: number;
}

/** Why the budget refused a request. */
export type BudgetRefusalReason = 'wait_exceeded' | 'waiters_full';

/** The budget refused a request: it could not be admitted within its longest wait. */
export class BudgetRefused extends Error {
  override readonly name = 'BudgetRefused';
  readonly reason: BudgetRefusalReason;
  /** Whole seconds until a request of the same class could be admitted (at least 1). */
  readonly retryAfterSeconds: number;

  constructor(reason: BudgetRefusalReason, retryAfterSeconds: number) {
    super('request budget exhausted');
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The right to send one request; released exactly once with the server counters of its response, if any. */
export interface BudgetPermit {
  release(counters?: ServerCounters | null): void;
}

interface Waiter {
  readonly cls: BudgetClass;
  readonly deadline: number;
  readonly resolve: (permit: BudgetPermit) => void;
  readonly reject: (error: Error) => void;
  readonly detach: () => void;
}

function checkOptions(options: RequestBudgetOptions): void {
  const { requestsPerMinute, researchReservedSlots, maxDiscoveryWaiters } = options;
  const integer = (value: number, min: number, max: number): boolean =>
    Number.isInteger(value) && value >= min && value <= max;
  if (
    !integer(requestsPerMinute, 1, 60) ||
    !integer(researchReservedSlots, 0, requestsPerMinute - 1) ||
    !integer(maxDiscoveryWaiters, 1, 100)
  ) {
    throw new RangeError('request budget options are out of range');
  }
}

export class RequestBudget {
  readonly #scheduler: Scheduler;
  readonly #limit: number;
  readonly #discoveryLimit: number;
  readonly #maxDiscoveryWaiters: number;
  /** Send times within the window, oldest first. */
  readonly #log: number[] = [];
  readonly #priority: Waiter[] = [];
  readonly #discovery: Waiter[] = [];
  #blockedUntil = 0;
  #inFlight = false;
  #cancelTimer: (() => void) | null = null;
  #lastCounters: ServerCounters | null = null;

  constructor(options: RequestBudgetOptions, scheduler: Scheduler) {
    checkOptions(options);
    this.#scheduler = scheduler;
    this.#limit = options.requestsPerMinute;
    this.#discoveryLimit = options.requestsPerMinute - options.researchReservedSlots;
    this.#maxDiscoveryWaiters = options.maxDiscoveryWaiters;
  }

  /**
   * Waits for a permit of class `cls` for at most `maxWaitMs`. Rejects with `BudgetRefused` when the request cannot
   * be admitted in time (at once when that is already known, or when too many discovery requests wait), and with
   * `WaitAborted` when `signal` aborts.
   */
  acquire(cls: BudgetClass, maxWaitMs: number, signal?: AbortSignal): Promise<BudgetPermit> {
    if (signal?.aborted === true) {
      return Promise.reject(new WaitAborted());
    }
    const queue = cls === 'discovery' ? this.#discovery : this.#priority;
    if (cls === 'discovery' && queue.length >= this.#maxDiscoveryWaiters) {
      const now = this.#scheduler.nowMs();
      this.#prune(now);
      return Promise.reject(new BudgetRefused('waiters_full', this.#retryAfter(cls, now)));
    }
    return new Promise<BudgetPermit>((resolve, reject) => {
      const onAbort = (): void => {
        this.#remove(waiter);
        reject(new WaitAborted());
        this.#pump();
      };
      const waiter: Waiter = {
        cls,
        deadline: this.#scheduler.nowMs() + Math.max(0, maxWaitMs),
        resolve,
        reject,
        detach: () => signal?.removeEventListener('abort', onAbort),
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      queue.push(waiter);
      this.#pump();
    });
  }

  /** Blocks every class until now + `seconds` (a 429 with its counter reset). */
  blockFor(seconds: number): void {
    if (Number.isFinite(seconds) && seconds > 0) {
      this.#blockedUntil = Math.max(this.#blockedUntil, this.#scheduler.nowMs() + seconds * 1000);
    }
    this.#pump();
  }

  /** Requests left in the current window for priority requests (for diagnostic logging). */
  remaining(): number {
    const now = this.#scheduler.nowMs();
    this.#prune(now);
    return Math.max(0, this.#limit - this.#log.length);
  }

  /** The server counters of the last response that reported any (for diagnostic logging and the probe). */
  lastCounters(): ServerCounters | null {
    return this.#lastCounters;
  }

  /** Number of waiting requests per class (test and diagnostic accessor). */
  waiting(): { readonly priority: number; readonly discovery: number } {
    return { priority: this.#priority.length, discovery: this.#discovery.length };
  }

  #prune(now: number): void {
    while (this.#log.length > 0 && (this.#log[0] ?? 0) <= now - BUDGET_WINDOW_MS) {
      this.#log.shift();
    }
  }

  /** Earliest time a request of class `cls` satisfies the window and the server block (ignores the queue). */
  #admissionTime(cls: BudgetClass, now: number): number {
    const cap = cls === 'discovery' ? this.#discoveryLimit : this.#limit;
    let at = Math.max(now, this.#blockedUntil);
    if (this.#log.length >= cap) {
      const oldestCounted = this.#log[this.#log.length - cap] ?? now;
      at = Math.max(at, oldestCounted + BUDGET_WINDOW_MS);
    }
    return at;
  }

  #retryAfter(cls: BudgetClass, now: number): number {
    return Math.max(1, Math.ceil((this.#admissionTime(cls, now) - now) / 1000));
  }

  #remove(waiter: Waiter): void {
    for (const queue of [this.#priority, this.#discovery]) {
      const index = queue.indexOf(waiter);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    }
  }

  #refuse(waiter: Waiter, now: number): void {
    this.#remove(waiter);
    waiter.detach();
    waiter.reject(new BudgetRefused('wait_exceeded', this.#retryAfter(waiter.cls, now)));
  }

  #grant(waiter: Waiter, now: number): void {
    this.#remove(waiter);
    waiter.detach();
    this.#inFlight = true;
    this.#log.push(now);
    let released = false;
    waiter.resolve(
      Object.freeze({
        release: (counters?: ServerCounters | null): void => {
          if (released) {
            return;
          }
          released = true;
          this.#inFlight = false;
          this.#applyCounters(counters ?? null);
          this.#pump();
        },
      }),
    );
  }

  #applyCounters(counters: ServerCounters | null): void {
    if (counters === null || (counters.requestsAvailable === null && counters.resetSeconds === null)) {
      return;
    }
    this.#lastCounters = counters;
    if (counters.requestsAvailable === 0 && counters.resetSeconds !== null) {
      this.#blockedUntil = Math.max(this.#blockedUntil, this.#scheduler.nowMs() + counters.resetSeconds * 1000);
    }
  }

  /** Refuses hopeless waiters, admits the head request when allowed, and arms one timer for the next event. */
  #pump(): void {
    this.#cancelTimer?.();
    this.#cancelTimer = null;
    const now = this.#scheduler.nowMs();
    this.#prune(now);

    // Hopeless waiters are refused at once: their admission time already lies beyond their longest wait.
    for (const waiter of [...this.#priority, ...this.#discovery]) {
      if (this.#admissionTime(waiter.cls, now) > waiter.deadline) {
        this.#refuse(waiter, now);
      }
    }

    let next = Number.POSITIVE_INFINITY;
    if (!this.#inFlight) {
      const head = this.#priority[0] ?? this.#discovery[0];
      if (head !== undefined && this.#admissionTime(head.cls, now) <= now) {
        this.#grant(head, now);
      }
    }

    // Waiters that reached their deadline without a permit are refused; the others keep waiting.
    for (const waiter of [...this.#priority, ...this.#discovery]) {
      if (waiter.deadline <= now) {
        this.#refuse(waiter, now);
      } else {
        next = Math.min(next, waiter.deadline);
      }
    }
    if (!this.#inFlight) {
      const head = this.#priority[0] ?? this.#discovery[0];
      if (head !== undefined) {
        next = Math.min(next, this.#admissionTime(head.cls, now));
      }
    }
    if (Number.isFinite(next)) {
      this.#cancelTimer = this.#scheduler.setTimer(Math.max(0, next - now), () => {
        this.#cancelTimer = null;
        this.#pump();
      });
    }
  }
}
