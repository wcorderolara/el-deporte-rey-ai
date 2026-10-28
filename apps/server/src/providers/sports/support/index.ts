/**
 * Generic, provider-neutral support of LIVE_DATA adapters (contracts/provider-ports.md sections 1.1 and 1.4; AD-26,
 * AD-27): the request budget, strict server-counter parsing, the projection cache with its TTL rules, the retry
 * policy, single-flight of identical misses, and the clock, timer and random seams. Nothing here names a provider, a
 * provider field, a header name or a URL.
 */
export {
  MAX_COUNTER_RESET_SECONDS,
  MAX_REQUESTS_AVAILABLE,
  NO_COUNTERS,
  type ServerCounters,
  parseCounter,
  parseServerCounters,
} from './counters.js';
export {
  type CacheEntryView,
  type CacheHit,
  DEFAULT_CACHE_ENTRIES,
  ProjectionCache,
  cacheKey,
} from './projection-cache.js';
export {
  BUDGET_WINDOW_MS,
  type BudgetClass,
  type BudgetPermit,
  BudgetRefused,
  type BudgetRefusalReason,
  RequestBudget,
  type RequestBudgetOptions,
} from './request-budget.js';
export { BACKOFF_JITTER, MAX_TOTAL_RETRY_MS, backoffDelayMs, mayRetry } from './retry.js';
export { type RandomSource, type Scheduler, WaitAborted, schedulerFor, sleep, systemRandom } from './scheduler.js';
export { SingleFlight } from './single-flight.js';
export {
  type CacheTtlSeconds,
  DEFAULT_CACHE_TTL_SECONDS,
  LIVE_SELECTION_HORIZON_MS,
  isLiveSelection,
  selectionTtlMs,
  stagesTtlMs,
} from './ttl.js';
