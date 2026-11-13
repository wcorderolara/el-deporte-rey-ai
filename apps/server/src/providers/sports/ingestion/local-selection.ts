/**
 * Eligibility of a locally managed match for a results piece (PD-ARCH-01E-A). The rules are the structural
 * requirements of the shared `SelectionSnapshot` and of the existing results carousel, applied to the effective local
 * values (manual edits and protected overrides included):
 *
 * - only a `finished` match is a result; a past kickoff never makes a match finished;
 * - a finished match needs both scores: `null/null` is an unknown result and is never shown as 0-0;
 * - each score must fit the frozen selection (at most `IMPORT_SCORE_MAX`): a larger one is `score_not_supported`, kept
 *   as recorded and never changed; this route cannot record it (UI06.3-D06);
 * - the snapshot requires a kickoff instant;
 * - team names must satisfy the contract team-name rule, otherwise the snapshot would be refused.
 *
 * The batch preview and the frozen selection of a confirmed batch use the same function, so what the operator
 * confirms is exactly what research later retrieves. Nothing here is filled, derived or invented.
 */
import { IMPORT_SCORE_MAX, TeamNameSchema } from '@edr/contracts';

import { type SourceRef, asSourceRef } from './types.js';

export type LocalMatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'postponed' | 'cancelled';

/** Why a local match cannot be part of a results piece. */
export type LocalMatchIneligibility =
  'not_finished' | 'score_missing' | 'score_not_supported' | 'kickoff_missing' | 'team_name_not_supported';

export interface LocalMatchValues {
  readonly status: LocalMatchStatus;
  readonly kickoffAt: string | null;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

/** Null when the match can be shown as a result; otherwise the first unmet requirement. */
export function localResultIneligibility(match: LocalMatchValues): LocalMatchIneligibility | null {
  if (match.status !== 'finished') {
    return 'not_finished';
  }
  if (match.homeScore === null || match.awayScore === null) {
    return 'score_missing';
  }
  if (match.homeScore > IMPORT_SCORE_MAX || match.awayScore > IMPORT_SCORE_MAX) {
    return 'score_not_supported';
  }
  if (match.kickoffAt === null) {
    return 'kickoff_missing';
  }
  if (!TeamNameSchema.safeParse(match.homeTeamName).success || !TeamNameSchema.safeParse(match.awayTeamName).success) {
    return 'team_name_not_supported';
  }
  return null;
}

/** Why a local match cannot be part of a piece about matches not played yet (PD-ARCH-01E-B). */
export type LocalFixtureIneligibility =
  'already_finished' | 'not_upcoming' | 'kickoff_missing' | 'team_name_not_supported';

/**
 * Eligibility of a local match for a piece about matches not played yet (PD-ARCH-01E-B), from its local status only:
 * - `calendar`: any status but `finished`;
 * - `upcoming` (upcoming matches and previews): `scheduled` or `postponed`; a past kickoff never makes it played;
 * - both need a kickoff instant and contract-valid team names. A score of a pending match is never shown.
 */
export function localFixtureIneligibility(
  match: LocalMatchValues,
  kind: 'calendar' | 'upcoming',
): LocalFixtureIneligibility | null {
  if (match.status === 'finished') {
    return 'already_finished';
  }
  if (kind === 'upcoming' && match.status !== 'scheduled' && match.status !== 'postponed') {
    return 'not_upcoming';
  }
  if (match.kickoffAt === null) {
    return 'kickoff_missing';
  }
  if (!TeamNameSchema.safeParse(match.homeTeamName).success || !TeamNameSchema.safeParse(match.awayTeamName).success) {
    return 'team_name_not_supported';
  }
  return null;
}

/**
 * The selection reference of one content generation item: the batch service stores it on the item's project and the
 * local adapter reads it back. Core code still treats it as opaque (AD-21).
 */
export function localSelectionRef(itemId: string): SourceRef {
  return asSourceRef(JSON.stringify({ i: itemId }));
}
