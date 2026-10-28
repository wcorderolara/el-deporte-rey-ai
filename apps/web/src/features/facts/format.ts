/**
 * Display text of fact values in the facts view. The fact's own value uses the server's deterministic `display`
 * (the single source of fact display text, `contracts/provider-ports.md` section 5); values of evidence and dispute
 * records, which have no display form in the contract, are formatted here. Everything is rendered as text.
 */
import type { Fact, FactValue } from '@edr/contracts';

import { formatDateTime } from '../../ui';
import { matchStatusLabel, valueFormatCopy } from './copy';

/** Official team names by canonical team ID, taken from the run's `team_official_name` facts. */
export type TeamNames = ReadonlyMap<string, string>;

export function teamNamesFrom(facts: readonly Fact[]): TeamNames {
  const names = new Map<string, string>();
  for (const fact of facts) {
    if (fact.kind === 'team_official_name') {
      const value = fact.value ?? fact.candidateValue;
      if (value !== null) {
        names.set(value.teamId, value.officialName);
      }
    }
  }
  return names;
}

function teamName(teamId: string, teams: TeamNames): string {
  return teams.get(teamId) ?? teamId;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Formats any closed fact value; the shape identifies the kind. */
export function formatFactValue(value: FactValue, teams: TeamNames): string {
  const copy = valueFormatCopy;
  if ('homeTeamId' in value) {
    return `${teamName(value.homeTeamId, teams)} (${copy.home}) ${copy.versus} ${teamName(value.awayTeamId, teams)} (${copy.away})`;
  }
  if ('kickoff' in value) {
    return formatDateTime(value.kickoff);
  }
  if ('matchStatus' in value) {
    return matchStatusLabel[value.matchStatus];
  }
  if ('position' in value) {
    return [
      `${copy.position} ${value.position}`,
      teamName(value.teamId, teams),
      `${copy.played} ${value.played}`,
      `${copy.won} ${value.won}`,
      `${copy.drawn} ${value.drawn}`,
      `${copy.lost} ${value.lost}`,
      `${copy.goalsFor} ${value.goalsFor}`,
      `${copy.goalsAgainst} ${value.goalsAgainst}`,
      `${copy.goalDifference} ${signed(value.goalDifference)}`,
      `${copy.points} ${value.points}`,
    ].join(' · ');
  }
  if ('stageLabel' in value) {
    const parts: string[] = [value.stageLabel];
    if (value.matchdayNumber !== null) {
      parts.push(copy.matchday(value.matchdayNumber, value.totalMatchdays));
    } else if (value.totalMatchdays !== null) {
      parts.push(copy.totalMatchdays(value.totalMatchdays));
    }
    return parts.join(', ');
  }
  if ('officialName' in value) {
    return value.officialName;
  }
  if ('type' in value) {
    switch (value.type) {
      case 'matchday_of_total':
        return copy.matchday(value.matchday, value.totalMatchdays);
      case 'teams_in_table':
        return copy.teamsInTable(value.count);
      case 'matches_in_selection':
        return copy.matchesInSelection(value.count);
    }
  }
  return `${value.home}–${value.away}`;
}

/**
 * Display text of a fact's own value: the server's display form, or the formatted value (verified) or candidate
 * value (unverified or manually approved); null when the fact has neither.
 */
export function factValueText(fact: Fact, teams: TeamNames): string | null {
  const value: FactValue | null = fact.value ?? fact.candidateValue;
  if (fact.display !== null && fact.display !== '') {
    return fact.display;
  }
  return value === null ? null : formatFactValue(value, teams);
}

/** Label of a match: its teams (from the match's `match_teams` fact) or, failing that, its match key. */
export function matchLabel(matchKey: string, facts: readonly Fact[], teams: TeamNames): string {
  const teamsFact = facts.find((fact) => fact.kind === 'match_teams' && fact.subject.matchKey === matchKey);
  if (teamsFact !== undefined) {
    const text = factValueText(teamsFact, teams);
    if (text !== null) {
      return text;
    }
  }
  return matchKey;
}
