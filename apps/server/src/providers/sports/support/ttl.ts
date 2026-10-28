/**
 * Validity of cached projections by resource and match status (contracts/provider-ports.md section 1.4, "Cache";
 * AD-27): competitions 24 h; seasons 6 h; stage lists 1 h for the current season and 24 h for past seasons;
 * selections 60 s while any match is `scheduled` within 3 hours or `in_play`, 15 min for other current-season
 * selections, 24 h for past seasons. Generic: it reads only provider-neutral match statuses and times.
 */
import type { SelectionSnapshot } from '../ingestion/index.js';

/** TTLs in seconds per resource (option `cacheTtlSeconds`). */
export interface CacheTtlSeconds {
  readonly competitions: number;
  readonly seasons: number;
  readonly stagesCurrent: number;
  readonly stagesPast: number;
  readonly selectionLive: number;
  readonly selectionCurrent: number;
  readonly selectionPast: number;
}

export const DEFAULT_CACHE_TTL_SECONDS: CacheTtlSeconds = Object.freeze({
  competitions: 86_400,
  seasons: 21_600,
  stagesCurrent: 3_600,
  stagesPast: 86_400,
  selectionLive: 60,
  selectionCurrent: 900,
  selectionPast: 86_400,
});

/** A scheduled match kicking off within this time keeps a selection "live". */
export const LIVE_SELECTION_HORIZON_MS = 3 * 60 * 60 * 1000;

/** TTL of a stage list. */
export function stagesTtlMs(ttl: CacheTtlSeconds, currentSeason: boolean): number {
  return (currentSeason ? ttl.stagesCurrent : ttl.stagesPast) * 1000;
}

/** True while any match is in play, or scheduled to kick off within 3 hours (or overdue). */
export function isLiveSelection(matches: SelectionSnapshot['matches'], nowMs: number): boolean {
  return matches.some((match) => {
    if (match.status === 'in_play') {
      return true;
    }
    if (match.status !== 'scheduled') {
      return false;
    }
    const kickoff = Date.parse(match.kickoff);
    return Number.isFinite(kickoff) && kickoff <= nowMs + LIVE_SELECTION_HORIZON_MS;
  });
}

/** TTL of a selection snapshot. */
export function selectionTtlMs(
  ttl: CacheTtlSeconds,
  snapshot: Pick<SelectionSnapshot, 'matches'>,
  currentSeason: boolean,
  nowMs: number,
): number {
  if (isLiveSelection(snapshot.matches, nowMs)) {
    return ttl.selectionLive * 1000;
  }
  return (currentSeason ? ttl.selectionCurrent : ttl.selectionPast) * 1000;
}
