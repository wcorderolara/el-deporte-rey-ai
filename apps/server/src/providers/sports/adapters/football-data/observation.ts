/**
 * Capability observations for the probe (contracts/provider-ports.md section 1.4, "Capability probe"; AD-32; R-259;
 * T11H-F02, T11H-F04). Computed inside the adapter, and only when an observer is attached (the probe script), so that
 * the observer never sees a raw body, a header value other than the two counters and the API version, or the
 * `X-Authenticated-Client` value: it receives presence booleans and counts, the names (not values) of dropped keys,
 * response sizes and the parsed counters.
 *
 * Failure diagnostics (FU-2, OD-60; T11H-F02): for a refused or rejected response the observer also receives the egress
 * refusal kind from a closed list, the stage that rejected it from a closed list, and the failing validation path
 * reduced to schema field names and numeric indices (every other segment replaced by `*`). No value of the body, of a
 * header or of the request ever reaches a diagnostic.
 */
import {
  CompetitionListingSchema,
  SeasonListingSchema,
  SelectionSnapshotSchema,
  StageListingSchema,
} from '@edr/contracts';

import type { EgressError } from '../../../../platform/net/index.js';

import {
  CompetitionDetailSchema,
  CompetitionsResponseSchema,
  MatchesResponseSchema,
  StandingsResponseSchema,
} from './schemas.js';

/** Request kinds, for sizes and observations. */
export type RequestKind = 'competitions' | 'competition' | 'stageDiscovery' | 'matches' | 'standings';

/** Resource kinds of a diagnostic: the request kinds plus the selection snapshot (closed list). */
export const DIAGNOSTIC_RESOURCES = [
  'competitions',
  'competition',
  'stageDiscovery',
  'matches',
  'standings',
  'selection',
] as const;
export type DiagnosticResource = (typeof DIAGNOSTIC_RESOURCES)[number];

/**
 * Egress refusal kinds recorded for the probe (closed list): `too_large` (decoded body above its cap), `redirect`
 * (a redirect response, never followed) and `other` (any other refusal: a foreign origin, or an invalid request such as
 * the probe's request cap).
 */
export const EGRESS_REFUSAL_KINDS = ['too_large', 'redirect', 'other'] as const;
export type EgressRefusalKind = (typeof EGRESS_REFUSAL_KINDS)[number];

/** Stages that reject a received response (closed list). */
export const REJECTION_STAGES = ['not_json', 'allow_list', 'domain'] as const;
export type RejectionStage = (typeof REJECTION_STAGES)[number];

/** One HTTP response (or transport failure) as the observer sees it. */
export interface ResponseObservation {
  readonly type: 'response';
  readonly kind: RequestKind;
  /** Path template, for example `/competitions/:code/matches`. */
  readonly pathTemplate: string;
  readonly status: number | null;
  /** Closed failure code of the attempt (`timeout`, `unavailable`, `invalid`, ...), null on a received response. */
  readonly failure: string | null;
  /** The egress refusal kind when the egress client refused the request or its response, else null. */
  readonly refusal: EgressRefusalKind | null;
  /** Decoded bytes of the body. */
  readonly bytes: number | null;
  readonly requestsAvailable: number | null;
  readonly counterResetSeconds: number | null;
  /** `X-API-Version` when it is a short version token (`v4`), `other` for anything else, null when absent. */
  readonly apiVersion: string | null;
  /** Whether `X-Authenticated-Client` was present and non-empty (T11H-F04: a boolean, never the value). */
  readonly authenticatedClientPresent: boolean;
  /** Whether its value equals the first value this adapter saw (compared in memory), null when absent. */
  readonly authenticatedClientSameAsFirst: boolean | null;
  /** The adapter's in-memory classification of a 403: true when the header counted as positive. */
  readonly classifiedPositive: boolean | null;
}

/** Presence of one mapped field over the items of a response. */
export interface FieldPresence {
  readonly field: string;
  /** Items (or the single object) in which the field is present and not null. */
  readonly present: number;
  readonly total: number;
}

/** One parsed body as the observer sees it. */
export interface BodyObservation {
  readonly type: 'body';
  readonly kind: RequestKind;
  readonly fields: readonly FieldPresence[];
  /** Paths of the keys the allow-list dropped, with array positions as `[]` (names only, never values). */
  readonly droppedKeys: readonly string[];
  /** Number of `TOTAL` tables (standings only). */
  readonly totalTables: number | null;
}

/**
 * A received response (or the adapter output built from it) that was rejected: by `JSON.parse`, by the allow-list
 * schema of the resource, or by the shared domain validation. `path` is a diagnostic path (`diagnosticPath`): schema
 * field names and numeric indices only, never a value; null when the stage reports none.
 */
export interface RejectionObservation {
  readonly type: 'rejection';
  readonly resource: DiagnosticResource;
  readonly stage: RejectionStage;
  readonly path: string | null;
}

export type RequestObservation = ResponseObservation | BodyObservation | RejectionObservation;
export type RequestObserver = (observation: RequestObservation) => void;

/** Mapped field paths per kind (`[]` iterates an array). */
export const MAPPED_FIELDS: ReadonlyMap<RequestKind, readonly string[]> = new Map<RequestKind, readonly string[]>([
  ['competitions', ['competitions[].id', 'competitions[].code', 'competitions[].name', 'competitions[].area.name']],
  [
    'competition',
    [
      'id',
      'code',
      'name',
      'currentSeason',
      'currentSeason.currentMatchday',
      'seasons[].startDate',
      'seasons[].endDate',
    ],
  ],
  [
    'stageDiscovery',
    [
      'competition.name',
      'matches[].id',
      'matches[].utcDate',
      'matches[].status',
      'matches[].stage',
      'matches[].matchday',
    ],
  ],
  [
    'matches',
    [
      'competition.name',
      'matches[].id',
      'matches[].utcDate',
      'matches[].status',
      'matches[].stage',
      'matches[].matchday',
      'matches[].homeTeam.id',
      'matches[].homeTeam.name',
      'matches[].homeTeam.shortName',
      'matches[].homeTeam.tla',
      'matches[].awayTeam.id',
      'matches[].awayTeam.name',
      'matches[].awayTeam.shortName',
      'matches[].awayTeam.tla',
      'matches[].score.fullTime.home',
      'matches[].score.fullTime.away',
    ],
  ],
  [
    'standings',
    [
      'standings[].stage',
      'standings[].type',
      'standings[].group',
      'standings[].table[].position',
      'standings[].table[].team.id',
      'standings[].table[].team.name',
      'standings[].table[].playedGames',
      'standings[].table[].won',
      'standings[].table[].draw',
      'standings[].table[].lost',
      'standings[].table[].points',
      'standings[].table[].goalsFor',
      'standings[].table[].goalsAgainst',
      'standings[].table[].goalDifference',
    ],
  ],
]);

const MAX_DROPPED_KEYS = 100;
const MAX_DEPTH = 32;
const SAFE_KEY = /^[A-Za-z_$][A-Za-z0-9_$-]{0,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An own member of a raw object, never an inherited one. */
function member(value: unknown, key: string): unknown {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

/** Leaves of `path` under `root`: values reached, with `undefined` for a missing member. */
function leaves(root: unknown, segments: readonly string[]): unknown[] {
  let current: unknown[] = [root];
  for (const segment of segments) {
    const next: unknown[] = [];
    const iterate = segment.endsWith('[]');
    const key = iterate ? segment.slice(0, -2) : segment;
    for (const value of current) {
      const reached = member(value, key);
      if (iterate) {
        if (Array.isArray(reached)) {
          next.push(...(reached as unknown[]));
        }
      } else {
        next.push(reached);
      }
    }
    current = next;
  }
  return current;
}

/** Presence of each mapped field of `kind` in a raw parsed body. */
export function fieldPresence(kind: RequestKind, raw: unknown): FieldPresence[] {
  return (MAPPED_FIELDS.get(kind) ?? []).map((field) => {
    const values = leaves(raw, field.split('.'));
    return {
      field,
      present: values.filter((value) => value !== undefined && value !== null).length,
      total: values.length,
    };
  });
}

/** Paths of the keys present in `raw` but not in the allow-listed `parsed` value (names only, deduplicated). */
export function droppedKeyPaths(raw: unknown, parsed: unknown): string[] {
  const found = new Set<string>();
  const walk = (input: unknown, output: unknown, prefix: string, depth: number): void => {
    if (depth > MAX_DEPTH || found.size >= MAX_DROPPED_KEYS) {
      return;
    }
    if (Array.isArray(input) && Array.isArray(output)) {
      const length = Math.min(input.length, output.length);
      for (let index = 0; index < length; index += 1) {
        walk(input[index], output[index], `${prefix}[]`, depth + 1);
      }
      return;
    }
    if (isRecord(input) && isRecord(output)) {
      for (const key of Object.keys(input)) {
        const name = SAFE_KEY.test(key) ? key : '<key>';
        const path = prefix === '' ? name : `${prefix}.${name}`;
        if (Object.hasOwn(output, key)) {
          walk(input[key], output[key], path, depth + 1);
        } else if (found.size < MAX_DROPPED_KEYS) {
          found.add(path);
        }
      }
    }
  };
  walk(raw, parsed, '', 0);
  return [...found].sort();
}

/** Number of `TOTAL` tables in a raw standings body. */
export function totalTableCount(raw: unknown): number {
  return leaves(raw, ['standings[]', 'type']).filter((type) => type === 'TOTAL').length;
}

/** A short `X-API-Version` token, `other` for anything else, null when absent. */
export function apiVersionToken(value: string | null): string | null {
  if (value === null || value === '') {
    return null;
  }
  return /^v[0-9]{1,3}$/.test(value) ? value : 'other';
}

// ---------------------------------------------------------------------------------------------------------------
// Failure diagnostics (FU-2; T11H-F02)
// ---------------------------------------------------------------------------------------------------------------

/** The refusal kind of an egress failure, or null when it is not a refusal (timeout, network, cancellation). */
export function egressRefusalKind(error: EgressError): EgressRefusalKind | null {
  switch (error.kind) {
    case 'too_large':
    case 'redirect':
      return error.kind;
    case 'denied':
    case 'invalid_request':
      return 'other';
    case 'timeout':
    case 'network':
    case 'aborted':
      return null;
  }
}

/** A schema field name usable as a diagnostic segment. */
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
/** A numeric array index (the largest array cap is below 100,000). */
const INDEX = /^(0|[1-9][0-9]{0,4})$/;
const MAX_DIAGNOSTIC_SEGMENTS = 24;
const MAX_DIAGNOSTIC_PATH_LENGTH = 200;

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The object keys declared by `schemas` (walked through every nested schema: objects, arrays, unions, optionals,
 * nullables, pipes, refinements). Only declared keys are collected, never literal or enum values.
 */
export function declaredFieldNames(schemas: readonly unknown[]): ReadonlySet<string> {
  const names = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (schema: unknown, depth: number): void => {
    if (!isRecordLike(schema) || seen.has(schema) || depth > 64) {
      return;
    }
    seen.add(schema);
    const internals = schema['_zod'];
    const def = isRecordLike(internals) ? internals['def'] : undefined;
    if (!isRecordLike(def)) {
      return;
    }
    if (def['type'] === 'object' && isRecordLike(def['shape'])) {
      for (const [key, value] of Object.entries(def['shape'])) {
        if (FIELD_NAME.test(key)) {
          names.add(key);
        }
        visit(value, depth + 1);
      }
    }
    for (const [key, value] of Object.entries(def)) {
      if (key === 'shape') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value as unknown[]) {
          visit(item, depth + 1);
        }
      } else {
        visit(value, depth + 1);
      }
    }
  };
  for (const schema of schemas) {
    visit(schema, 0);
  }
  return names;
}

/**
 * The closed list of segment names a diagnostic path may hold: the field names declared by the adapter's allow-list
 * schemas and by the shared domain schemas its output passes (listings and the selection snapshot).
 */
export const DIAGNOSTIC_FIELD_NAMES: ReadonlySet<string> = declaredFieldNames([
  CompetitionsResponseSchema,
  CompetitionDetailSchema,
  MatchesResponseSchema,
  StandingsResponseSchema,
  CompetitionListingSchema,
  SeasonListingSchema,
  StageListingSchema,
  SelectionSnapshotSchema,
]);

/**
 * A validation path (`/teams/12/name`) reduced to a diagnostic path: each segment is kept only when it is a numeric
 * index or a declared schema field name (`DIAGNOSTIC_FIELD_NAMES`); any other segment becomes `*`. Null for anything
 * that is not a path. The result can never hold a value of the validated input (T11H-F02).
 */
export function diagnosticPath(path: unknown): string | null {
  if (typeof path !== 'string' || path.length > MAX_DIAGNOSTIC_PATH_LENGTH || !path.startsWith('/')) {
    return null;
  }
  if (path === '/') {
    return '/';
  }
  const segments = path.slice(1).split('/').slice(0, MAX_DIAGNOSTIC_SEGMENTS);
  return segments
    .map((segment) => (INDEX.test(segment) || DIAGNOSTIC_FIELD_NAMES.has(segment) ? `/${segment}` : '/*'))
    .join('');
}
