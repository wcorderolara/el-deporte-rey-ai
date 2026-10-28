/**
 * Options of the football-data adapter (`providers.sports.sources[].options`; contracts/provider-ports.md section 1.4)
 * with the defaults of the section's table, validated by the adapter's own Zod schema.
 *
 * Every problem is reported with fixed text naming the option (T11H-F03): a validator issue, its message or the
 * refused input is never logged, thrown or included in a message, because validators may copy the input into them.
 * The token is never an option (AD-30): secret-like keys are already refused by the configuration loader, and any
 * unknown key is refused here without being named.
 */
import { z } from 'zod';

import { ConfigError, type ConfigIssue } from '../../../../platform/config/index.js';
import { DEFAULT_SPORTS_MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES_LIMIT } from '../../../../platform/net/index.js';
import { type CacheTtlSeconds, DEFAULT_CACHE_TTL_SECONDS } from '../../support/index.js';

import { PINNED_ORIGIN } from './constants.js';

/** A provider competition code or numeric ID as configured (for example the reference `CL`). */
export const COMPETITION_CODE_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
/** Longest cache validity accepted for any resource (7 days). */
const MAX_TTL_SECONDS = 604_800;

export interface FootballDataOptions {
  readonly baseUrl: string;
  readonly referenceCompetitionRefs: readonly string[];
  readonly areaIds: readonly number[];
  readonly requestsPerMinute: number;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly maxRateLimitWaitSeconds: number;
  readonly maxResponseBytes: number;
  readonly maxResponseBytesByResource: { readonly stageDiscovery: number | null };
  readonly researchReservedSlots: number;
  readonly maxDiscoveryWaiters: number;
  readonly cacheTtlSeconds: CacheTtlSeconds;
}

/** Fixed problem texts per option (OD-20, T11H-F03). */
const PROBLEMS: ReadonlyMap<string, string> = new Map([
  ['baseUrl', 'must be an https: URL without user information, query or fragment'],
  ['referenceCompetitionRefs', 'must be a list of at most 20 competition codes of 1 to 16 letters, digits, _ or -'],
  ['areaIds', 'must be a list of at most 50 positive integer area IDs'],
  ['requestsPerMinute', 'must be an integer from 1 to 60'],
  ['timeoutMs', 'must be an integer from 1000 to 30000'],
  ['maxRetries', 'must be an integer from 0 to 3'],
  ['backoffMs', 'must be an integer from 100 to 10000'],
  ['maxRateLimitWaitSeconds', 'must be an integer from 1 to 3600'],
  ['maxResponseBytes', `must be an integer from 1 to ${String(MAX_RESPONSE_BYTES_LIMIT)}`],
  [
    'maxResponseBytesByResource',
    `must be an object whose only key is stageDiscovery, an integer from 1 to ${String(MAX_RESPONSE_BYTES_LIMIT)}`,
  ],
  ['researchReservedSlots', 'must be an integer from 0 to requestsPerMinute - 1'],
  ['maxDiscoveryWaiters', 'must be an integer from 1 to 100'],
  [
    'cacheTtlSeconds',
    'must be an object of competitions, seasons, stagesCurrent, stagesPast, selectionLive, selectionCurrent and ' +
      `selectionPast, each an integer from 1 to ${String(MAX_TTL_SECONDS)}`,
  ],
]);

/** Problem text of an origin other than the pinned one (T11H-F03). */
export const ORIGIN_PROBLEM = `must use the origin ${PINNED_ORIGIN}: the adapter sends its credential to no other host`;

/** An `https:` URL without user information, query or fragment. */
export function isAcceptedBaseUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('?') || value.includes('#')) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname !== '';
}

/** The WHATWG origin of a URL, or null. */
export function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const int = (min: number, max: number): z.ZodNumber => z.number().int().min(min).max(max);
const ttl = (fallback: number) => int(1, MAX_TTL_SECONDS).default(fallback);

const optionsSchema = z
  .strictObject({
    baseUrl: z.custom<string>(isAcceptedBaseUrl),
    referenceCompetitionRefs: z.array(z.string().regex(COMPETITION_CODE_PATTERN)).max(20).default([]),
    areaIds: z.array(int(1, 999_999)).max(50).default([]),
    requestsPerMinute: int(1, 60).default(10),
    timeoutMs: int(1000, 30_000).default(10_000),
    maxRetries: int(0, 3).default(2),
    backoffMs: int(100, 10_000).default(1000),
    maxRateLimitWaitSeconds: int(1, 3600).default(65),
    maxResponseBytes: int(1, MAX_RESPONSE_BYTES_LIMIT).default(DEFAULT_SPORTS_MAX_RESPONSE_BYTES),
    maxResponseBytesByResource: z
      .strictObject({ stageDiscovery: int(1, MAX_RESPONSE_BYTES_LIMIT).optional() })
      .default({}),
    researchReservedSlots: int(0, 59).default(2),
    maxDiscoveryWaiters: int(1, 100).default(20),
    cacheTtlSeconds: z
      .strictObject({
        competitions: ttl(DEFAULT_CACHE_TTL_SECONDS.competitions),
        seasons: ttl(DEFAULT_CACHE_TTL_SECONDS.seasons),
        stagesCurrent: ttl(DEFAULT_CACHE_TTL_SECONDS.stagesCurrent),
        stagesPast: ttl(DEFAULT_CACHE_TTL_SECONDS.stagesPast),
        selectionLive: ttl(DEFAULT_CACHE_TTL_SECONDS.selectionLive),
        selectionCurrent: ttl(DEFAULT_CACHE_TTL_SECONDS.selectionCurrent),
        selectionPast: ttl(DEFAULT_CACHE_TTL_SECONDS.selectionPast),
      })
      .default({ ...DEFAULT_CACHE_TTL_SECONDS }),
  })
  .superRefine((options, ctx) => {
    if (options.researchReservedSlots > options.requestsPerMinute - 1) {
      ctx.addIssue({ code: 'custom', path: ['researchReservedSlots'], message: 'out of range' });
    }
  });

/** Configuration issues with fixed texts only: the option name from the issue path, never its message or input. */
function toIssues(error: z.ZodError, prefix: string): ConfigIssue[] {
  const seen = new Set<string>();
  const issues: ConfigIssue[] = [];
  for (const issue of error.issues) {
    const field = issue.path[0];
    const problem = typeof field === 'string' ? PROBLEMS.get(field) : undefined;
    const known = problem !== undefined && issue.code !== 'unrecognized_keys';
    const setting = known ? `${prefix}.${String(field)}` : prefix;
    const text = known ? problem : issue.code === 'unrecognized_keys' ? 'contains unknown keys' : 'is invalid';
    const key = `${setting}\u0000${text}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push({ setting, problem: text });
    }
  }
  return issues;
}

/**
 * Validates the options; returns them with defaults applied, or the configuration issues (fixed texts) under
 * `<setting>.options`. Does not check the origin (see `originIssue`).
 */
export function parseFootballDataOptions(
  raw: unknown,
  setting: string,
):
  | { readonly ok: true; readonly options: FootballDataOptions }
  | { readonly ok: false; readonly issues: ConfigIssue[] } {
  const prefix = `${setting}.options`;
  const result = optionsSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: toIssues(result.error, prefix) };
  }
  const data = result.data;
  const options: FootballDataOptions = {
    baseUrl: data.baseUrl,
    referenceCompetitionRefs: Object.freeze([...data.referenceCompetitionRefs]),
    areaIds: Object.freeze([...data.areaIds]),
    requestsPerMinute: data.requestsPerMinute,
    timeoutMs: data.timeoutMs,
    maxRetries: data.maxRetries,
    backoffMs: data.backoffMs,
    maxRateLimitWaitSeconds: data.maxRateLimitWaitSeconds,
    maxResponseBytes: data.maxResponseBytes,
    maxResponseBytesByResource: Object.freeze({
      stageDiscovery: data.maxResponseBytesByResource.stageDiscovery ?? null,
    }),
    researchReservedSlots: data.researchReservedSlots,
    maxDiscoveryWaiters: data.maxDiscoveryWaiters,
    cacheTtlSeconds: Object.freeze({ ...data.cacheTtlSeconds }),
  };
  return { ok: true, options: Object.freeze(options) };
}

/** The origin-pinning issue of a parsed base URL, or null when its origin is the pinned one (T11H-F03). */
export function originIssue(options: FootballDataOptions, setting: string): ConfigIssue | null {
  return originOf(options.baseUrl) === PINNED_ORIGIN
    ? null
    : { setting: `${setting}.options.baseUrl`, problem: ORIGIN_PROBLEM };
}

/** Throws the `ConfigError` of the issues (fixed texts). */
export function throwIssues(issues: readonly ConfigIssue[]): never {
  throw new ConfigError(issues);
}
