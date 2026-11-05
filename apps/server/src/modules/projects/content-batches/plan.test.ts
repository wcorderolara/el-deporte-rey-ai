/**
 * Pure planning rules of content batches (PD-ARCH-01E-A): eligibility of local matches, piece planning per kind,
 * the selection label and the request hash. All values are synthetic.
 */
import type { ContentBatchMatch, ContentBatchSelection } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { localResultIneligibility } from '../../../providers/sports/index.js';

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
