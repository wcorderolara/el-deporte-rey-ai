/**
 * Strict parsing of server rate-limit counters (contracts/provider-ports.md section 1.4; T11H-F05).
 *
 * A counter value is accepted only when it is 1 to 6 decimal digits (`^[0-9]{1,6}$`) and within its upper bound. A
 * negative, fractional, exponent, signed, padded, empty, repeated (comma-joined) or huge value is ignored, so the local
 * sliding window still applies and a server value can never block a source beyond one hour. Generic: the adapter
 * reads its own header names and passes the raw values here.
 */

/** Longest counter reset accepted, in seconds (one hour). */
export const MAX_COUNTER_RESET_SECONDS = 3600;
/** Largest remaining-request count accepted. */
export const MAX_REQUESTS_AVAILABLE = 10_000;

const COUNTER = /^[0-9]{1,6}$/;

/** A counter value within `[0, max]`, or null when the raw value is missing or not acceptable. */
export function parseCounter(raw: string | null | undefined, max: number): number | null {
  if (typeof raw !== 'string' || !COUNTER.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= max ? value : null;
}

/** Server counters reported by one response; null members were missing or invalid and are ignored. */
export interface ServerCounters {
  /** Requests the server still allows before its counter resets. */
  readonly requestsAvailable: number | null;
  /** Seconds until the server's counter resets. */
  readonly resetSeconds: number | null;
}

/** Parses the two raw counter values with their bounds (3 600 seconds, 10 000 requests). */
export function parseServerCounters(
  requestsAvailable: string | null | undefined,
  resetSeconds: string | null | undefined,
): ServerCounters {
  return Object.freeze({
    requestsAvailable: parseCounter(requestsAvailable, MAX_REQUESTS_AVAILABLE),
    resetSeconds: parseCounter(resetSeconds, MAX_COUNTER_RESET_SECONDS),
  });
}

/** Counters of a response that carried none. */
export const NO_COUNTERS: ServerCounters = Object.freeze({ requestsAvailable: null, resetSeconds: null });
