/**
 * Deterministic display text of a fact value (contract `FactRefFields.display`), built only with `platform/format`
 * (contracts/provider-ports.md section 5), so the facts view, content, rendering and visual QA show the same text.
 */
import type { FactKind, FactValue, Language } from '@edr/contracts';

import { formatDate, formatInt, formatScore, stageDisplay, teamDisplayName } from '../../platform/format/index.js';

export interface DisplayContext {
  readonly language: Language;
  readonly utcOffsetMinutes: number;
  /** Display name of a canonical team ID (official name or candidate name), or undefined. */
  teamName(teamId: string): string | undefined;
}

function team(ctx: DisplayContext, teamId: string): string {
  const name = ctx.teamName(teamId);
  return name === undefined ? teamId : teamDisplayName(name);
}

/** Display form of a value of the given kind; null when there is no value. */
export function displayOf(kind: FactKind, value: FactValue | null, ctx: DisplayContext): string | null {
  if (value === null) {
    return null;
  }
  const v = value as Record<string, unknown>;
  switch (kind) {
    case 'match_teams':
      return `${team(ctx, String(v['homeTeamId']))} - ${team(ctx, String(v['awayTeamId']))}`;
    case 'match_kickoff':
      return formatDate(String(v['kickoff']), ctx.language, ctx.utcOffsetMinutes);
    case 'match_status':
      return String(v['matchStatus']);
    case 'match_score':
      return formatScore({ home: Number(v['home']), away: Number(v['away']) });
    case 'standing_row':
      return `${formatInt(Number(v['position']))}. ${team(ctx, String(v['teamId']))} ${formatInt(Number(v['points']))}`;
    case 'matchday_info':
      return stageDisplay(
        String(v['stageLabel']),
        typeof v['matchdayNumber'] === 'number' ? v['matchdayNumber'] : null,
        ctx.language,
      );
    case 'context_item':
      if (v['type'] === 'matchday_of_total') {
        return `${formatInt(Number(v['matchday']))}/${formatInt(Number(v['totalMatchdays']))}`;
      }
      return formatInt(Number(v['count']));
    case 'team_official_name':
      return teamDisplayName(String(v['officialName']));
  }
}
