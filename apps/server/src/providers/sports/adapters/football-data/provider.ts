/**
 * FootballDataProvider (LIVE_DATA; contracts/provider-ports.md section 1.4; AD-25 to AD-27, AD-30, AD-36; PD-12,
 * PD-15 option A; R-128 to R-133, R-244 to R-256, R-260, R-263, R-266, R-280, R-286, R-291).
 *
 * Response handling, in order: egress cap and deadline (egress client); status classification; `JSON.parse` of the
 * text; allow-list schemas (unknown keys stripped and counted; person fields and crests dropped); mapping to the
 * domain; shared domain validation; only then caching. An invalid body is `invalid` with its validation path, never
 * retried and never cached; an error response is never cached and its body is never parsed, logged or kept.
 *
 * Error classification: 400 `bad_request`; 401, or 403 without a positive `X-Authenticated-Client`, `access_refused`;
 * 403 with a positive header and 404 `not_available`; none of them retried. 429 `rate_limited`: the budget blocks
 * until the counter reset and the request is retried once when that wait is within the purpose's limit. 500, 502,
 * 503, 504 and connection failures `unavailable`, and an exceeded deadline `timeout`: retried up to `maxRetries` with
 * backoff within 30 seconds. Egress refusals (redirect, oversize, foreign origin) `invalid`, never retried.
 *
 * Probe diagnostics (FU-2; only with an observer attached): the refusal kind of an egress refusal, and for a rejected
 * response or output its stage (not JSON, allow-list schema, shared domain validation) and the diagnostic path, reduced
 * to schema field names and numeric indices (`observation.ts`, `diagnosticPath`).
 *
 * Logging (R-124, R-133): one debug line per request with the path template, the names of the query parameters, the
 * status, the duration, the cache outcome and the remaining budget; never the token, a header value other than the two
 * rate-limit counters (never `X-Authenticated-Client`), a body or a URL with query values.
 */
import { DomainDisplayNameSchema, type SelectionSnapshot, SourceCompetitionSchema, parseDomain } from '@edr/contracts';
import type { z } from 'zod';

import type { ConfigIssue } from '../../../../platform/config/index.js';
import { ConfigError } from '../../../../platform/config/index.js';
import { EgressError, type EgressClient, type EgressResponse } from '../../../../platform/net/index.js';
import {
  type AdapterContext,
  type AdapterRegistration,
  type IngestionContext,
  type IngestionPurpose,
  type IngestionSource,
  type Listing,
  type SourceCompetition,
  type SourceDescriptor,
  type SourceRef,
  type SourceSeason,
  type SourceStage,
  type SportsLogger,
  SourceError,
  sourceErrorFromEgress,
  validateCompetitionListing,
  validateSeasonListing,
  validateSelectionSnapshot,
  validateStageListing,
} from '../../ingestion/index.js';
import {
  type BudgetClass,
  type BudgetPermit,
  BudgetRefused,
  type CacheEntryView,
  ProjectionCache,
  type RandomSource,
  RequestBudget,
  type Scheduler,
  type ServerCounters,
  SingleFlight,
  WaitAborted,
  backoffDelayMs,
  cacheKey,
  mayRetry,
  parseServerCounters,
  schedulerFor,
  selectionTtlMs,
  sleep,
  stagesTtlMs,
  systemRandom,
} from '../../support/index.js';

import {
  ANONYMOUS_CLIENT_MARKER,
  DEFAULT_RATE_LIMIT_WAIT_SECONDS,
  DISCOVERY_MAX_WAIT_MS,
  FOOTBALL_DATA_ADAPTER_KIND,
  HEADER_API_VERSION,
  HEADER_AUTHENTICATED_CLIENT,
  HEADER_COUNTER_RESET,
  HEADER_REQUESTS_AVAILABLE,
} from './constants.js';
import { type Credential, TOKEN_ISSUE, readCredential } from './credentials.js';
import {
  type StandingsInput,
  decodeCompetitionRef,
  decodeSeasonRef,
  decodeSelectionRef,
  mapCompetitions,
  mapSeasons,
  mapSelection,
  mapStages,
} from './mapping.js';
import {
  type DiagnosticResource,
  type EgressRefusalKind,
  type RejectionStage,
  type RequestKind,
  type RequestObservation,
  type RequestObserver,
  apiVersionToken,
  diagnosticPath,
  droppedKeyPaths,
  egressRefusalKind,
  fieldPresence,
  totalTableCount,
} from './observation.js';
import { type FootballDataOptions, originIssue, parseFootballDataOptions } from './options.js';
import {
  CompetitionDetailSchema,
  CompetitionsResponseSchema,
  MatchesResponseSchema,
  StandingsResponseSchema,
} from './schemas.js';

/** Statuses retried as transient provider failures. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504]);

/** Path templates logged instead of request URLs (R-133). */
const TEMPLATES: ReadonlyMap<RequestKind, string> = new Map<RequestKind, string>([
  ['competitions', '/competitions'],
  ['competition', '/competitions/:code'],
  ['stageDiscovery', '/competitions/:code/matches'],
  ['matches', '/competitions/:code/matches'],
  ['standings', '/competitions/:code/standings'],
]);

const AVAILABLE = Object.freeze({ available: true as const });

/** Test, probe and clock seams; never configuration. */
export interface FootballDataSeams {
  /** Timers on the injected clock; default: the clock's own timers, else real timers on the clock's time. */
  readonly scheduler?: Scheduler;
  /** Jitter source of the backoff; default `Math.random`. */
  readonly random?: RandomSource;
  /** Capability observations (the probe script only). */
  readonly observer?: RequestObserver;
}

/** The adapter as an ingestion source, with a test accessor of its cache (AD-27). */
export interface FootballDataSource extends IngestionSource {
  validateStartup(): void;
  /** The cached projections, least recently used first (test and probe accessor; never raw payloads). */
  cacheEntries(): readonly CacheEntryView<unknown>[];
}

interface RequestSpec {
  readonly kind: RequestKind;
  /** Path segments after the base URL (provider codes; encoded when the URL is built). */
  readonly segments: readonly string[];
  readonly query: readonly (readonly [string, string])[];
}

interface Received {
  readonly text: string;
  readonly retrievedAt: string;
}

interface Loaded<T> {
  readonly value: T;
  readonly retrievedAt: string;
  readonly ttlMs: number;
}

/** The base URL without a trailing slash (`https://api.football-data.org/v4`). */
function baseOf(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function listing<T>(
  items: readonly T[],
  retrievedAt: string,
  fromCache: boolean,
  stale: boolean,
  retryAfterSeconds: number | null,
): Listing<T> {
  return { items, availability: AVAILABLE, retrievedAt, fromCache, stale, retryAfterSeconds };
}

class FootballDataProvider implements FootballDataSource {
  readonly descriptor: SourceDescriptor;
  readonly #sourceId: string;
  readonly #options: FootballDataOptions | null;
  readonly #optionIssues: readonly ConfigIssue[];
  readonly #credential: Credential;
  readonly #egress: EgressClient;
  readonly #logger: SportsLogger;
  readonly #scheduler: Scheduler;
  readonly #random: RandomSource;
  readonly #observer: RequestObserver | null;
  readonly #budget: RequestBudget | null;
  readonly #cache: ProjectionCache<unknown>;
  readonly #flights = new SingleFlight<Loaded<unknown>>();
  readonly #base: string | null;
  /** First `X-Authenticated-Client` value seen, kept in memory only while a probe observer is attached (T11H-F04). */
  #firstClientValue: string | null = null;

  constructor(context: AdapterContext, seams: FootballDataSeams) {
    this.descriptor = context.descriptor;
    this.#sourceId = context.descriptor.id;
    this.#egress = context.deps.egress;
    this.#logger = context.deps.logger;
    this.#scheduler = seams.scheduler ?? schedulerFor(context.deps.clock);
    this.#random = seams.random ?? systemRandom;
    this.#observer = seams.observer ?? null;
    this.#credential = readCredential(context.deps.env);
    this.#cache = new ProjectionCache<unknown>(this.#scheduler);

    const parsed = parseFootballDataOptions(context.options, context.setting);
    if (parsed.ok) {
      const pinned = originIssue(parsed.options, context.setting);
      this.#options = parsed.options;
      this.#optionIssues = pinned === null ? [] : [pinned];
      this.#budget = new RequestBudget(parsed.options, this.#scheduler);
      this.#base = pinned === null ? baseOf(parsed.options.baseUrl) : null;
    } else {
      this.#options = null;
      this.#optionIssues = parsed.issues;
      this.#budget = null;
      this.#base = null;
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Startup and readiness
  // -------------------------------------------------------------------------------------------------------------

  validateStartup(): void {
    const issues: ConfigIssue[] = [...this.#optionIssues];
    if (!this.#credential.present) {
      issues.push(TOKEN_ISSUE);
    }
    if (issues.length > 0) {
      throw new ConfigError(issues);
    }
  }

  /** The configured parts, or a refusal: nothing is sent unless options, origin and token are valid. */
  #ready(): { options: FootballDataOptions; budget: RequestBudget; base: string } {
    const options = this.#options;
    const budget = this.#budget;
    const base = this.#base;
    if (options === null || budget === null || base === null || !this.#credential.present) {
      throw new SourceError('unavailable', 'source adapter is not configured', this.#sourceId);
    }
    return { options, budget, base };
  }

  cacheEntries(): readonly CacheEntryView<unknown>[] {
    return this.#cache.entries();
  }

  // -------------------------------------------------------------------------------------------------------------
  // Port methods
  // -------------------------------------------------------------------------------------------------------------

  async listCompetitions(ctx: IngestionContext): Promise<Listing<SourceCompetition>> {
    const { options } = this.#ready();
    const areas = options.areaIds.length > 0 ? options.areaIds.join(',') : null;
    const key = cacheKey(this.#sourceId, 'competitions', { areas });
    return this.#listing<SourceCompetition>('competitions', key, ctx, async (signal) => {
      const spec: RequestSpec = {
        kind: 'competitions',
        segments: ['competitions'],
        query: areas === null ? [] : [['areas', areas]],
      };
      const received = await this.#send(spec, ctx.purpose, signal);
      const response = this.#parse(spec, received.text, CompetitionsResponseSchema);
      const mapped = mapCompetitions(response, options.referenceCompetitionRefs);
      const items = mapped.items
        .map((item) =>
          item.areaName !== null && !DomainDisplayNameSchema.safeParse(item.areaName).success
            ? { ...item, areaName: null }
            : item,
        )
        .filter((item) => SourceCompetitionSchema.safeParse(item).success);
      const skipped = mapped.skipped + mapped.items.length - items.length;
      if (skipped > 0) {
        this.#logger.debug({ sourceId: this.#sourceId, resource: 'competitions', skipped }, 'source items left out');
      }
      const validated = this.#domain('competitions', () =>
        validateCompetitionListing(
          listing(items, received.retrievedAt, false, false, null),
          this.#sourceId,
          this.#logger,
        ),
      );
      return {
        value: validated.items,
        retrievedAt: received.retrievedAt,
        ttlMs: options.cacheTtlSeconds.competitions * 1000,
      };
    });
  }

  async listSeasons(competition: SourceRef, ctx: IngestionContext): Promise<Listing<SourceSeason>> {
    const { options } = this.#ready();
    const ref = decodeCompetitionRef(competition, this.#sourceId);
    const key = cacheKey(this.#sourceId, 'seasons', { c: ref.c });
    return this.#listing<SourceSeason>('seasons', key, ctx, async (signal) => {
      const spec: RequestSpec = { kind: 'competition', segments: ['competitions', ref.c], query: [] };
      const received = await this.#send(spec, ctx.purpose, signal);
      const detail = this.#parse(spec, received.text, CompetitionDetailSchema);
      const mapped = mapSeasons(detail, ref);
      if (mapped.skipped > 0) {
        this.#logger.debug(
          { sourceId: this.#sourceId, resource: 'seasons', skipped: mapped.skipped },
          'source items left out',
        );
      }
      const validated = this.#domain('competition', () =>
        validateSeasonListing(
          listing(mapped.items, received.retrievedAt, false, false, null),
          this.#sourceId,
          this.#logger,
        ),
      );
      return {
        value: validated.items,
        retrievedAt: received.retrievedAt,
        ttlMs: options.cacheTtlSeconds.seasons * 1000,
      };
    });
  }

  async listStages(competition: SourceRef, season: SourceRef, ctx: IngestionContext): Promise<Listing<SourceStage>> {
    const { options } = this.#ready();
    const competitionRef = decodeCompetitionRef(competition, this.#sourceId);
    const ref = decodeSeasonRef(season, this.#sourceId);
    if (competitionRef.c !== ref.c) {
      throw new SourceError('invalid', 'unknown source reference', this.#sourceId);
    }
    const key = cacheKey(this.#sourceId, 'stages', { c: ref.c, y: ref.y });
    return this.#listing<SourceStage>('stages', key, ctx, async (signal) => {
      const spec: RequestSpec = {
        kind: 'stageDiscovery',
        segments: ['competitions', ref.c, 'matches'],
        query: [['season', String(ref.y)]],
      };
      const received = await this.#send(spec, ctx.purpose, signal);
      const response = this.#parse(spec, received.text, MatchesResponseSchema);
      const mapped = mapStages(response, ref);
      if (mapped.skipped > 0) {
        this.#logger.debug(
          { sourceId: this.#sourceId, resource: 'stages', skipped: mapped.skipped },
          'source items left out',
        );
      }
      const validated = this.#domain('stageDiscovery', () =>
        validateStageListing(
          listing(mapped.items, received.retrievedAt, false, false, null),
          this.#sourceId,
          this.#logger,
        ),
      );
      return {
        value: validated.items,
        retrievedAt: received.retrievedAt,
        ttlMs: stagesTtlMs(options.cacheTtlSeconds, ref.cur),
      };
    });
  }

  async fetchSelection(selection: SourceRef, ctx: IngestionContext): Promise<SelectionSnapshot> {
    const { options } = this.#ready();
    const ref = decodeSelectionRef(selection, this.#sourceId);
    const key = cacheKey(this.#sourceId, 'selection', { c: ref.c, y: ref.y, st: ref.st, md: ref.md });
    const hit = this.#cache.get(key);
    if (hit !== undefined && !hit.expired) {
      this.#logCache('selection', 'hit');
      return { ...(hit.value as SelectionSnapshot), fromCache: true };
    }
    try {
      const loaded = await this.#flight(key, ctx, async (signal): Promise<Loaded<unknown>> => {
        const matchesSpec: RequestSpec = {
          kind: 'matches',
          segments: ['competitions', ref.c, 'matches'],
          query: [['season', String(ref.y)], ref.md === null ? ['stage', ref.st] : ['matchday', String(ref.md)]],
        };
        const received = await this.#send(matchesSpec, ctx.purpose, signal);
        const matches = this.#parse(matchesSpec, received.text, MatchesResponseSchema);
        const standings = await this.#standings(ref.md !== null && ref.sx, ref, ctx.purpose, signal);
        const mapped = mapSelection(ref, matches, standings, {
          sourceId: this.#sourceId,
          retrievedAt: received.retrievedAt,
        });
        if (mapped.skippedMatches > 0) {
          this.#logger.debug(
            { sourceId: this.#sourceId, resource: 'selection', skipped: mapped.skippedMatches },
            'source items left out',
          );
        }
        const snapshot = this.#domain('selection', () =>
          validateSelectionSnapshot(mapped.snapshot, this.descriptor, this.#logger),
        );
        const ttlMs = selectionTtlMs(options.cacheTtlSeconds, snapshot, ref.cur, this.#scheduler.nowMs());
        this.#cache.set(key, snapshot, received.retrievedAt, ttlMs);
        return { value: snapshot, retrievedAt: received.retrievedAt, ttlMs };
      });
      return { ...(loaded.value as SelectionSnapshot), fromCache: false };
    } catch (error) {
      throw this.#toSourceError(error);
    }
  }

  /** The standings of a matchday selection whose stage expects them; a 403 or 404 gives a reason (R-254, R-286). */
  async #standings(
    wanted: boolean,
    ref: { c: string; y: number; md: number | null },
    purpose: IngestionPurpose,
    signal: AbortSignal,
  ): Promise<StandingsInput> {
    if (!wanted || ref.md === null) {
      return { kind: 'none', reason: 'not_provided_for_stage' };
    }
    const spec: RequestSpec = {
      kind: 'standings',
      segments: ['competitions', ref.c, 'standings'],
      query: [
        ['season', String(ref.y)],
        ['matchday', String(ref.md)],
      ],
    };
    try {
      const received = await this.#send(spec, purpose, signal);
      const response = this.#parse(spec, received.text, StandingsResponseSchema);
      return { kind: 'response', response, retrievedAt: received.retrievedAt };
    } catch (error) {
      const failure = this.#toSourceError(error);
      if (failure.code === 'not_available') {
        return {
          kind: 'none',
          reason: failure.httpStatus === 404 ? 'not_provided_by_source' : 'not_available_with_subscription',
        };
      }
      throw failure;
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Cache and single-flight
  // -------------------------------------------------------------------------------------------------------------

  /**
   * A listing from the cache when valid, else from one (shared) provider request. When the budget is exhausted,
   * a discovery listing is served from an expired entry (`stale`, with its retrieval time and the wait); research and
   * verification never get stale entries (R-141, R-291).
   */
  async #listing<T>(
    resource: string,
    key: string,
    ctx: IngestionContext,
    load: (signal: AbortSignal) => Promise<Loaded<readonly T[]>>,
  ): Promise<Listing<T>> {
    const hit = this.#cache.get(key);
    if (hit !== undefined && !hit.expired) {
      this.#logCache(resource, 'hit');
      return listing(hit.value as readonly T[], hit.retrievedAt, true, false, null);
    }
    try {
      const loaded = await this.#flight(key, ctx, async (signal): Promise<Loaded<unknown>> => {
        const fresh = await load(signal);
        this.#cache.set(key, fresh.value, fresh.retrievedAt, fresh.ttlMs);
        return fresh;
      });
      return listing(loaded.value as readonly T[], loaded.retrievedAt, false, false, null);
    } catch (error) {
      const failure = this.#toSourceError(error);
      if (ctx.purpose === 'discovery' && hit !== undefined && failure.code === 'rate_limited') {
        this.#logCache(resource, 'stale');
        return listing(hit.value as readonly T[], hit.retrievedAt, true, true, failure.retryAfterSeconds);
      }
      throw failure;
    }
  }

  /** Identical concurrent misses of the same request class share one provider request (T11H-F06). */
  #flight(
    key: string,
    ctx: IngestionContext,
    task: (signal: AbortSignal) => Promise<Loaded<unknown>>,
  ): Promise<Loaded<unknown>> {
    return this.#flights.run(`${key}\u0000${classOf(ctx.purpose)}`, ctx.signal, task);
  }

  #logCache(resource: string, outcome: 'hit' | 'stale'): void {
    this.#logger.debug(
      { sourceId: this.#sourceId, resource, cache: outcome, remaining: this.#budget?.remaining() ?? null },
      'source cache',
    );
  }

  // -------------------------------------------------------------------------------------------------------------
  // Transport: budget, request, classification, retries
  // -------------------------------------------------------------------------------------------------------------

  #url(base: string, spec: RequestSpec): string {
    const path = spec.segments.map((segment) => encodeURIComponent(segment)).join('/');
    const query = new URLSearchParams(spec.query.map(([name, value]): [string, string] => [name, value])).toString();
    return `${base}/${path}${query === '' ? '' : `?${query}`}`;
  }

  #maxBytes(options: FootballDataOptions, kind: RequestKind): number {
    return kind === 'stageDiscovery'
      ? (options.maxResponseBytesByResource.stageDiscovery ?? options.maxResponseBytes)
      : options.maxResponseBytes;
  }

  async #send(spec: RequestSpec, purpose: IngestionPurpose, signal: AbortSignal): Promise<Received> {
    const { options, budget, base } = this.#ready();
    const cls = classOf(purpose);
    const waitLimitMs =
      cls === 'discovery'
        ? Math.min(DISCOVERY_MAX_WAIT_MS, options.maxRateLimitWaitSeconds * 1000)
        : options.maxRateLimitWaitSeconds * 1000;
    const url = this.#url(base, spec);
    const started = this.#scheduler.nowMs();
    let retries = 0;
    let rateLimitRetried = false;

    for (;;) {
      const permit = await this.#acquire(budget, cls, waitLimitMs, signal);
      const sentAt = this.#scheduler.nowMs();
      let response: EgressResponse;
      try {
        response = await this.#egress.request(url, {
          method: 'GET',
          headers: this.#credential.headersFor(url),
          timeoutMs: options.timeoutMs,
          maxResponseBytes: this.#maxBytes(options, spec.kind),
          signal,
        });
      } catch (error) {
        permit.release(null);
        const failure =
          error instanceof EgressError
            ? sourceErrorFromEgress(error, this.#sourceId)
            : new SourceError('unavailable', 'source request failed', this.#sourceId);
        this.#logRequest(spec, null, sentAt, budget, null, failure.code);
        this.#observeFailure(spec, failure.code, error instanceof EgressError ? egressRefusalKind(error) : null);
        const transient = error instanceof EgressError && (error.kind === 'timeout' || error.kind === 'network');
        if (transient && (await this.#backoff(options, retries, started, signal))) {
          retries += 1;
          continue;
        }
        throw failure;
      }

      const counters = parseServerCounters(
        response.headers.get(HEADER_REQUESTS_AVAILABLE),
        response.headers.get(HEADER_COUNTER_RESET),
      );
      permit.release(counters);
      const status = response.status;
      const positive = status === 403 ? isPositiveClient(response.headers) : null;
      this.#logRequest(spec, status, sentAt, budget, counters, null);
      this.#observeResponse(spec, response, counters, positive);

      if (status >= 200 && status <= 299) {
        return { text: response.text, retrievedAt: new Date(this.#scheduler.nowMs()).toISOString() };
      }
      if (status === 429) {
        const wait = counters.resetSeconds ?? DEFAULT_RATE_LIMIT_WAIT_SECONDS;
        budget.blockFor(wait);
        if (!rateLimitRetried && wait * 1000 <= waitLimitMs) {
          rateLimitRetried = true;
          continue;
        }
        throw new SourceError('rate_limited', 'source rate limit reached', this.#sourceId, null, status, wait);
      }
      if (RETRYABLE_STATUSES.has(status)) {
        if (await this.#backoff(options, retries, started, signal)) {
          retries += 1;
          continue;
        }
        throw new SourceError('unavailable', 'source unavailable', this.#sourceId, null, status);
      }
      throw this.#statusFailure(status, positive);
    }
  }

  async #acquire(budget: RequestBudget, cls: BudgetClass, waitMs: number, signal: AbortSignal): Promise<BudgetPermit> {
    try {
      return await budget.acquire(cls, waitMs, signal);
    } catch (error) {
      throw this.#toSourceError(error);
    }
  }

  /** Waits before a retry when the policy allows one; false when no retry may be made. */
  async #backoff(
    options: FootballDataOptions,
    retries: number,
    started: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const delay = backoffDelayMs(retries, options.backoffMs, this.#random);
    if (!mayRetry(retries, options.maxRetries, this.#scheduler.nowMs() - started, delay)) {
      return false;
    }
    try {
      await sleep(this.#scheduler, delay, signal);
    } catch (error) {
      throw this.#toSourceError(error);
    }
    return true;
  }

  /** Non-retried statuses (the body is never read). */
  #statusFailure(status: number, positiveClient: boolean | null): SourceError {
    const id = this.#sourceId;
    switch (status) {
      case 400:
        return new SourceError('bad_request', 'source refused the request filter', id, null, status);
      case 401:
        return new SourceError('access_refused', 'provider access refused', id, null, status);
      case 403:
        return positiveClient === true
          ? new SourceError('not_available', 'resource not available with the subscription', id, null, status)
          : new SourceError('access_refused', 'provider access refused', id, null, status);
      case 404:
        return new SourceError('not_available', 'resource not found', id, null, status);
      default:
        return new SourceError('unavailable', 'source unavailable', id, null, status);
    }
  }

  #toSourceError(error: unknown): SourceError {
    if (error instanceof SourceError) {
      return error;
    }
    if (error instanceof BudgetRefused) {
      return new SourceError(
        'rate_limited',
        'source request budget exhausted',
        this.#sourceId,
        null,
        null,
        error.retryAfterSeconds,
      );
    }
    if (error instanceof WaitAborted) {
      return new SourceError('unavailable', 'source request was cancelled', this.#sourceId);
    }
    if (error instanceof EgressError) {
      return sourceErrorFromEgress(error, this.#sourceId);
    }
    return new SourceError('unavailable', 'source adapter failed', this.#sourceId);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Parsing, logging, observations
  // -------------------------------------------------------------------------------------------------------------

  /** `JSON.parse`, then the allow-list schema; an invalid body is `invalid` with its validation path (R-247). */
  #parse<S extends z.ZodType>(spec: RequestSpec, text: string, schema: S): z.output<S> {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.#logger.debug({ sourceId: this.#sourceId, resource: spec.kind }, 'source response is not JSON');
      this.#observeRejection(spec.kind, 'not_json', null);
      throw new SourceError('invalid', 'source response is not JSON', this.#sourceId);
    }
    const result = parseDomain(schema, raw);
    if (!result.success) {
      const path = result.issues[0]?.path ?? null;
      this.#logger.debug(
        { sourceId: this.#sourceId, resource: spec.kind, issueCount: result.issues.length, path },
        'source response rejected by the allow-list schema',
      );
      this.#observeRejection(spec.kind, 'allow_list', path);
      throw new SourceError('invalid', 'source response failed the allow-list schema', this.#sourceId, path);
    }
    if (result.strippedKeys > 0) {
      this.#logger.debug(
        { sourceId: this.#sourceId, resource: spec.kind, strippedKeys: result.strippedKeys },
        'unknown keys stripped from source response',
      );
    }
    if (this.#observer !== null) {
      this.#observe({
        type: 'body',
        kind: spec.kind,
        fields: fieldPresence(spec.kind, raw),
        droppedKeys: droppedKeyPaths(raw, result.data),
        totalTables: spec.kind === 'standings' ? totalTableCount(raw) : null,
      });
    }
    return result.data;
  }

  #logRequest(
    spec: RequestSpec,
    status: number | null,
    sentAt: number,
    budget: RequestBudget,
    counters: ServerCounters | null,
    failure: string | null,
  ): void {
    this.#logger.debug(
      {
        sourceId: this.#sourceId,
        path: TEMPLATES.get(spec.kind) ?? null,
        params: spec.query.map(([name]) => name).sort(),
        status,
        failure,
        durationMs: Math.max(0, this.#scheduler.nowMs() - sentAt),
        cache: 'miss',
        remaining: budget.remaining(),
        requestsAvailable: counters?.requestsAvailable ?? null,
        counterResetSeconds: counters?.resetSeconds ?? null,
      },
      'source request',
    );
  }

  #observe(observation: RequestObservation): void {
    try {
      this.#observer?.(observation);
    } catch {
      // An observer never changes the adapter's behaviour.
    }
  }

  /**
   * Runs a shared domain validation; when it rejects the output, the observer learns the stage and the diagnostic path
   * (field names and indices only) before the error is rethrown unchanged.
   */
  #domain<T>(resource: DiagnosticResource, validate: () => T): T {
    try {
      return validate();
    } catch (error) {
      if (error instanceof SourceError && error.code === 'invalid') {
        this.#observeRejection(resource, 'domain', error.path);
      }
      throw error;
    }
  }

  #observeRejection(resource: DiagnosticResource, stage: RejectionStage, path: string | null): void {
    if (this.#observer === null) {
      return;
    }
    this.#observe({ type: 'rejection', resource, stage, path: diagnosticPath(path) });
  }

  #observeFailure(spec: RequestSpec, failure: string, refusal: EgressRefusalKind | null): void {
    if (this.#observer === null) {
      return;
    }
    this.#observe({
      type: 'response',
      kind: spec.kind,
      pathTemplate: TEMPLATES.get(spec.kind) ?? '',
      status: null,
      failure,
      refusal,
      bytes: null,
      requestsAvailable: null,
      counterResetSeconds: null,
      apiVersion: null,
      authenticatedClientPresent: false,
      authenticatedClientSameAsFirst: null,
      classifiedPositive: null,
    });
  }

  #observeResponse(
    spec: RequestSpec,
    response: EgressResponse,
    counters: ServerCounters,
    positive: boolean | null,
  ): void {
    if (this.#observer === null) {
      return;
    }
    const value = response.headers.get(HEADER_AUTHENTICATED_CLIENT);
    const present = value !== null && value.trim() !== '';
    let same: boolean | null = null;
    if (present) {
      if (this.#firstClientValue === null) {
        this.#firstClientValue = value;
      }
      same = this.#firstClientValue === value;
    }
    this.#observe({
      type: 'response',
      kind: spec.kind,
      pathTemplate: TEMPLATES.get(spec.kind) ?? '',
      status: response.status,
      failure: null,
      refusal: null,
      bytes: Buffer.byteLength(response.text, 'utf8'),
      requestsAvailable: counters.requestsAvailable,
      counterResetSeconds: counters.resetSeconds,
      apiVersion: apiVersionToken(response.headers.get(HEADER_API_VERSION)),
      authenticatedClientPresent: present,
      authenticatedClientSameAsFirst: same,
      classifiedPositive: positive,
    });
  }
}

function classOf(purpose: IngestionPurpose): BudgetClass {
  return purpose === 'discovery' ? 'discovery' : 'priority';
}

/**
 * "Positive" `X-Authenticated-Client` (T11H-F04): a boolean computed in memory: the header is present, non-empty and
 * not the provider's anonymous marker. The value itself goes nowhere.
 */
export function isPositiveClient(headers: Headers): boolean {
  const value = headers.get(HEADER_AUTHENTICATED_CLIENT);
  return value !== null && value.trim() !== '' && value.trim() !== ANONYMOUS_CLIENT_MARKER;
}

/** Creates the adapter of one configured source. It never throws: problems surface through `validateStartup`. */
export function createFootballDataSource(context: AdapterContext, seams: FootballDataSeams = {}): FootballDataSource {
  return new FootballDataProvider(context, seams);
}

/** A registration of the adapter kind with seams (tests and the probe build their own registry with it). */
export function footballDataRegistration(seams: FootballDataSeams = {}): AdapterRegistration {
  return Object.freeze({
    kind: FOOTBALL_DATA_ADAPTER_KIND,
    mode: 'LIVE_DATA' as const,
    provider: Object.freeze({
      name: 'football-data.org',
      capabilities: Object.freeze({ competitionCatalogue: true, seasons: true, stages: true }),
    }),
    create: (context: AdapterContext): IngestionSource => createFootballDataSource(context, seams),
  });
}

/** The production registration (`adapters/index.ts`). */
export const footballDataAdapter: AdapterRegistration = footballDataRegistration();
