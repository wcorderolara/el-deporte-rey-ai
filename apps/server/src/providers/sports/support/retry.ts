/**
 * Retry policy of transient failures (contracts/provider-ports.md section 1.4; R-130, R-250, R-251). Generic.
 *
 * - At most `maxRetries` retries (0 to 3) after the first attempt.
 * - The first backoff is `backoffMs`, doubled per retry, with a deterministic jitter of plus or minus 20 % drawn from
 *   the injected random source.
 * - The total retry time, from the start of the first attempt to the start of the next one, is capped at 30 seconds:
 *   a retry whose backoff would end later is not made.
 */
import type { RandomSource } from './scheduler.js';

/** Upper bound of the total time spent on one request including its retries and backoffs. */
export const MAX_TOTAL_RETRY_MS = 30_000;
/** Relative jitter of a backoff. */
export const BACKOFF_JITTER = 0.2;

/** The backoff before retry number `retryIndex` (0 for the first retry). */
export function backoffDelayMs(retryIndex: number, backoffMs: number, random: RandomSource): number {
  const base = backoffMs * 2 ** Math.max(0, retryIndex);
  const draw = random.next();
  const unit = Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 1) : 0.5;
  return Math.max(0, Math.round(base * (1 - BACKOFF_JITTER + 2 * BACKOFF_JITTER * unit)));
}

/** True when retry number `retryIndex` may be made after `elapsedMs`, waiting `delayMs` first. */
export function mayRetry(retryIndex: number, maxRetries: number, elapsedMs: number, delayMs: number): boolean {
  return retryIndex < maxRetries && elapsedMs + delayMs <= MAX_TOTAL_RETRY_MS;
}
