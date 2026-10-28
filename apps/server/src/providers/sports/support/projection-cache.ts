/**
 * In-memory projection cache (contracts/provider-ports.md section 1.4; AD-27; R-132, R-141, R-252, R-280, R-291).
 * Generic and provider-neutral.
 *
 * - At most `maxEntries` entries (default 500); the least recently used entry is evicted.
 * - Keyed by source ID, resource kind and normalized request parameters (`cacheKey`), in a `Map` (T11H-F07).
 * - It stores only validated domain projections (listing items or selection snapshots) with `retrievedAt` and
 *   `expiresAt`: callers put values here only after the shared domain validation. Never raw payloads, headers, URLs,
 *   error responses or credentials. Stored values are deep copies, frozen, so no caller can change them.
 * - `get` returns expired entries flagged `expired`; the caller decides whether a stale value may be served
 *   (discovery listings while the budget is exhausted only).
 */
import type { Scheduler } from './scheduler.js';

/** Default and largest number of entries. */
export const DEFAULT_CACHE_ENTRIES = 500;

export interface CacheHit<T> {
  readonly value: T;
  /** Time of the provider retrieval the value comes from (ISO-8601 UTC). */
  readonly retrievedAt: string;
  /** True when the entry's validity has ended. */
  readonly expired: boolean;
}

/** One entry as the test accessor shows it. */
export interface CacheEntryView<T> {
  readonly key: string;
  readonly value: T;
  readonly retrievedAt: string;
  readonly expiresAtMs: number;
}

interface Entry<T> {
  readonly value: T;
  readonly retrievedAt: string;
  readonly expiresAtMs: number;
}

type ParamValue = string | number | boolean | null;

/**
 * A normalized cache key: the source ID, the resource kind and the parameters sorted by name. Parameter names and
 * values are adapter-built (codes, years, numbers); the key is a JSON string used only as a `Map` key.
 */
export function cacheKey(
  sourceId: string,
  resourceKind: string,
  params: Readonly<Record<string, ParamValue>> = {},
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((name): [string, ParamValue] => [name, Object.hasOwn(params, name) ? (params[name] ?? null) : null]);
  return JSON.stringify([sourceId, resourceKind, sorted]);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export class ProjectionCache<T> {
  readonly #scheduler: Scheduler;
  readonly #maxEntries: number;
  /** Insertion order is recency order: the first entry is the least recently used. */
  readonly #entries = new Map<string, Entry<T>>();

  constructor(scheduler: Scheduler, maxEntries: number = DEFAULT_CACHE_ENTRIES) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > DEFAULT_CACHE_ENTRIES) {
      throw new RangeError('cache size is out of range');
    }
    this.#scheduler = scheduler;
    this.#maxEntries = maxEntries;
  }

  /** The entry under `key`, fresh or expired, and marks it most recently used. */
  get(key: string): CacheHit<T> | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return {
      value: entry.value,
      retrievedAt: entry.retrievedAt,
      expired: this.#scheduler.nowMs() >= entry.expiresAtMs,
    };
  }

  /** Stores a validated projection for `ttlMs`; evicts the least recently used entry beyond the limit. */
  set(key: string, value: T, retrievedAt: string, ttlMs: number): void {
    const copy = deepFreeze(structuredClone(value));
    this.#entries.delete(key);
    this.#entries.set(key, {
      value: copy,
      retrievedAt,
      expiresAtMs: this.#scheduler.nowMs() + Math.max(0, ttlMs),
    });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (oldest.done === true) {
        break;
      }
      this.#entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.#entries.size;
  }

  /** Every entry, least recently used first (test accessor, AD-27: R-252 inspects the cache content). */
  entries(): readonly CacheEntryView<T>[] {
    return [...this.#entries].map(([key, entry]) => ({
      key,
      value: entry.value,
      retrievedAt: entry.retrievedAt,
      expiresAtMs: entry.expiresAtMs,
    }));
  }
}
