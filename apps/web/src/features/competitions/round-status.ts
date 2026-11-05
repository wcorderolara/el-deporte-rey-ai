import type { CompetitionMatch } from '@edr/contracts';

export type RoundPresentationStatus = 'finished' | 'in_progress' | 'scheduled' | 'empty';

export interface RoundStatusSummary {
  status: RoundPresentationStatus;
  finishedMatches: number;
  totalMatches: number;
  summary: string;
}

type MatchForRoundStatus = Pick<CompetitionMatch, 'status'>;

/**
 * Derives a round's presentation status exclusively from persisted match states.
 *
 * A postponed or cancelled match is unresolved: it prevents a round from being finished and places it in the
 * in-progress presentation group. Dates and scores deliberately do not infer sporting state.
 */
export function deriveRoundStatus(matches: readonly MatchForRoundStatus[]): RoundStatusSummary {
  const totalMatches = matches.length;
  const finishedMatches = matches.filter((match) => match.status === 'finished').length;

  if (totalMatches === 0) {
    return { status: 'empty', finishedMatches, totalMatches, summary: 'Sin partidos registrados' };
  }

  const summary = `${finishedMatches} de ${totalMatches} ${totalMatches === 1 ? 'partido finalizado' : 'partidos finalizados'}`;
  if (finishedMatches === totalMatches) return { status: 'finished', finishedMatches, totalMatches, summary };
  if (matches.every((match) => match.status === 'scheduled')) {
    return { status: 'scheduled', finishedMatches, totalMatches, summary };
  }
  return { status: 'in_progress', finishedMatches, totalMatches, summary };
}
