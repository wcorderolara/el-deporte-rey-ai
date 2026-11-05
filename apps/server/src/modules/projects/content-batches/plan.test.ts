/**
 * Pure planning rules of content batches (PD-ARCH-01E-A, PD-ARCH-01E-B): eligibility of local matches for results
 * and for matches not played yet, piece planning per kind, the selection label and the request hash. All values are
 * synthetic.
 */
import type { ContentBatchMatch, ContentBatchSelection } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { localFixtureIneligibility, localResultIneligibility } from '../../../providers/sports/index.js';

import { matchView, planPieces, selectionHash, selectionLabelOf } from './service.js';
import type { LocalMatchRecord } from './repository.js';

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function record(n: number, overrides: Partial<LocalMatchRecord> = {}): LocalMatchRecord {
  return {
    id: uuid(n),
    roundId: uuid(100),
    homeTeamId: uuid(200 + n),
    awayTeamId: uuid(300 + n),
    homeTeamName: `Local ${String(n)}`,
    awayTeamName: `Visita ${String(n)}`,
    status: 'finished',
    kickoffAt: '2026-10-20T18:00:00.000Z',
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  };
}

describe('local result eligibility', () => {
  it('accepts a finished match with both scores, including a recorded 0-0', () => {
    expect(localResultIneligibility(record(1))).toBeNull();
    expect(localResultIneligibility(record(1, { homeScore: 0, awayScore: 0 }))).toBeNull();
  });

  it('never treats an unknown score as 0-0', () => {
    expect(localResultIneligibility(record(1, { homeScore: null, awayScore: null }))).toBe('score_missing');
  });

  it('does not infer a result from a past kickoff or from a score on an unfinished match', () => {
    for (const status of ['scheduled', 'in_progress', 'postponed', 'cancelled'] as const) {
      expect(localResultIneligibility(record(1, { status, kickoffAt: '2020-01-01T00:00:00.000Z' }))).toBe(
        'not_finished',
      );
    }
    expect(localResultIneligibility(record(1, { status: 'in_progress', homeScore: 2, awayScore: 2 }))).toBe(
      'not_finished',
    );
  });

  it('requires a kickoff and contract-valid team names', () => {
    expect(localResultIneligibility(record(1, { kickoffAt: null }))).toBe('kickoff_missing');
    expect(localResultIneligibility(record(1, { homeTeamName: 'Club <script>' }))).toBe('team_name_not_supported');
  });
});

describe('piece planning', () => {
  const matches: ContentBatchMatch[] = [
    matchView(record(1)),
    matchView(record(2, { status: 'scheduled', homeScore: null, awayScore: null })),
    matchView(record(3, { homeScore: 0, awayScore: 0 })),
  ];
  const options = { roundName: 'Jornada 12', language: 'es' as const, contextSupported: true };

  it('plans one round carousel of the eligible matches, first, and one piece per match in order', () => {
    const pieces = planPieces(['match_result', 'round_results'], matches, options);
    expect(pieces.map((piece) => [piece.position, piece.kind, piece.status, piece.skipReason])).toEqual([
      [1, 'round_results', 'ready', null],
      [2, 'match_result', 'ready', null],
      [3, 'match_result', 'skipped', 'not_finished'],
      [4, 'match_result', 'ready', null],
    ]);
    expect(pieces[0]).toMatchObject({ title: 'Resultados · Jornada 12', matchIds: [uuid(1), uuid(3)] });
    expect(pieces[1]).toMatchObject({ title: 'Local 1 - Visita 1', matchIds: [uuid(1)] });
  });

  it('counts exactly the selected matches for per-match pieces', () => {
    expect(planPieces(['match_result'], matches.slice(0, 1), options)).toHaveLength(1);
    expect(planPieces(['match_result'], matches, options)).toHaveLength(3);
  });

  it('skips a round carousel without eligible matches and names every selected match', () => {
    const [piece] = planPieces(['round_results'], [matches[1] as ContentBatchMatch], { ...options, language: 'en' });
    expect(piece).toMatchObject({
      title: 'Results · Jornada 12',
      status: 'skipped',
      skipReason: 'no_eligible_matches',
      matchIds: [uuid(2)],
    });
  });

  it('skips every piece when the context cannot be represented', () => {
    const pieces = planPieces(['round_results', 'match_result'], matches, { ...options, contextSupported: false });
    expect(new Set(pieces.map((piece) => piece.skipReason))).toEqual(new Set(['context_not_supported']));
  });
});

describe('eligibility of matches not played yet (PD-ARCH-01E-B)', () => {
  const pending = { homeScore: null, awayScore: null };

  it('decides by the local status, never by a past kickoff', () => {
    const past = '2020-01-01T00:00:00.000Z';
    for (const status of ['scheduled', 'postponed'] as const) {
      const match = record(1, { status, kickoffAt: past, ...pending });
      expect(localFixtureIneligibility(match, 'upcoming')).toBeNull();
      expect(localFixtureIneligibility(match, 'calendar')).toBeNull();
    }
    const finished = record(1, { status: 'finished', kickoffAt: '2099-01-01T00:00:00.000Z' });
    expect(localFixtureIneligibility(finished, 'upcoming')).toBe('already_finished');
    expect(localFixtureIneligibility(finished, 'calendar')).toBe('already_finished');
  });

  it('keeps matches in play or cancelled in the calendar but not among the upcoming matches', () => {
    for (const status of ['in_progress', 'cancelled'] as const) {
      const match = record(1, { status, ...pending });
      expect(localFixtureIneligibility(match, 'calendar')).toBeNull();
      expect(localFixtureIneligibility(match, 'upcoming')).toBe('not_upcoming');
    }
  });

  it('requires a kickoff and contract-valid team names', () => {
    const match = record(1, { status: 'scheduled', ...pending });
    expect(localFixtureIneligibility({ ...match, kickoffAt: null }, 'upcoming')).toBe('kickoff_missing');
    expect(localFixtureIneligibility({ ...match, awayTeamName: 'Club <b>' }, 'calendar')).toBe(
      'team_name_not_supported',
    );
  });
});

describe('piece planning of matches not played yet (PD-ARCH-01E-B)', () => {
  const matches: ContentBatchMatch[] = [
    matchView(record(1)),
    matchView(record(2, { status: 'scheduled', homeScore: null, awayScore: null })),
    matchView(record(3, { status: 'in_progress', homeScore: 1, awayScore: 1 })),
  ];
  const options = { roundName: 'Jornada 12', language: 'es' as const, contextSupported: true };

  it('orders results, calendar, upcoming matches, per-match results and previews, each with its eligible matches', () => {
    const pieces = planPieces(
      ['match_preview', 'upcoming_matches', 'round_calendar', 'match_result', 'round_results'],
      matches,
      options,
    );
    expect(pieces.map((piece) => [piece.position, piece.kind, piece.status, piece.skipReason])).toEqual([
      [1, 'round_results', 'ready', null],
      [2, 'round_calendar', 'ready', null],
      [3, 'upcoming_matches', 'ready', null],
      [4, 'match_result', 'ready', null],
      [5, 'match_result', 'skipped', 'not_finished'],
      [6, 'match_result', 'skipped', 'not_finished'],
      [7, 'match_preview', 'skipped', 'already_finished'],
      [8, 'match_preview', 'ready', null],
      [9, 'match_preview', 'skipped', 'not_upcoming'],
    ]);
    expect(pieces[1]).toMatchObject({ title: 'Calendario · Jornada 12', matchIds: [uuid(2), uuid(3)] });
    expect(pieces[2]).toMatchObject({ title: 'Próximos partidos · Jornada 12', matchIds: [uuid(2)] });
    expect(pieces[7]).toMatchObject({ title: 'Previa · Local 2 - Visita 2', matchIds: [uuid(2)] });
  });

  it('skips a calendar or upcoming carousel without eligible matches', () => {
    const finished = [matches[0] as ContentBatchMatch];
    const pieces = planPieces(['round_calendar', 'upcoming_matches'], finished, { ...options, language: 'en' });
    expect(pieces.map((piece) => [piece.kind, piece.status, piece.skipReason, piece.matchIds])).toEqual([
      ['round_calendar', 'skipped', 'no_eligible_matches', [uuid(1)]],
      ['upcoming_matches', 'skipped', 'no_eligible_matches', [uuid(1)]],
    ]);
  });

  it('shows the eligibility of each content family in the match view', () => {
    expect(
      matches.map((match) => [match.ineligibility, match.calendarIneligibility, match.upcomingIneligibility]),
    ).toEqual([
      [null, 'already_finished', 'already_finished'],
      ['not_finished', null, null],
      ['not_finished', null, 'not_upcoming'],
    ]);
  });
});

describe('selection label and request hash', () => {
  it('prefixes the round with its stage and refuses a label outside the stage-name rule', () => {
    expect(selectionLabelOf({ stageName: null, roundName: 'Jornada 12' })).toBe('Jornada 12');
    expect(selectionLabelOf({ stageName: 'Fase de grupos', roundName: 'Jornada 3' })).toBe(
      'Fase de grupos - Jornada 3',
    );
    expect(selectionLabelOf({ stageName: 'F'.repeat(60), roundName: 'R'.repeat(30) })).toBeNull();
  });

  it('identifies a selection independently of the order of its matches and kinds', () => {
    const base: ContentBatchSelection = {
      competitionId: uuid(1),
      seasonId: uuid(2),
      stageId: null,
      roundId: uuid(3),
      matchIds: [uuid(4), uuid(5)],
      kinds: ['round_results', 'match_result'],
    };
    const same: ContentBatchSelection = {
      ...base,
      matchIds: [uuid(5), uuid(4)],
      kinds: ['match_result', 'round_results'],
    };
    expect(selectionHash(same, 'es')).toBe(selectionHash(base, 'es'));
    expect(selectionHash({ ...base, matchIds: [uuid(4)] }, 'es')).not.toBe(selectionHash(base, 'es'));
    expect(selectionHash(base, 'en')).not.toBe(selectionHash(base, 'es'));
  });
});
