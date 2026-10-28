/**
 * Capability observations for the probe (contracts/provider-ports.md section 1.4, "Capability probe"; AD-32; R-259;
 * T11H-F02, T11H-F04). Computed inside the adapter, and only when an observer is attached (the probe script), so that
 * the observer never sees a raw body, a header value other than the two counters and the API version, or the
 * `X-Authenticated-Client` value: it receives presence booleans and counts, the names (not values) of dropped keys,
 * response sizes and the parsed counters.
 */

/** Request kinds, for sizes and observations. */
export type RequestKind = 'competitions' | 'competition' | 'stageDiscovery' | 'matches' | 'standings';

/** One HTTP response (or transport failure) as the observer sees it. */
export interface ResponseObservation {
  readonly type: 'response';
  readonly kind: RequestKind;
  /** Path template, for example `/competitions/:code/matches`. */
  readonly pathTemplate: string;
  readonly status: number | null;
  /** Closed failure code of the attempt (`timeout`, `unavailable`, `invalid`, ...), null on a received response. */
  readonly failure: string | null;
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

export type RequestObservation = ResponseObservation | BodyObservation;
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
