import { describe, expect, it } from 'vitest';
import { deriveRoundStatus } from './round-status';

const matches = (...statuses: Array<'scheduled' | 'in_progress' | 'finished' | 'postponed' | 'cancelled'>) =>
  statuses.map((status) => ({ status }));

describe('deriveRoundStatus', () => {
  it('marks a round without matches as empty', () => {
    expect(deriveRoundStatus([])).toEqual({
      status: 'empty',
      finishedMatches: 0,
      totalMatches: 0,
      summary: 'Sin partidos registrados',
    });
  });

  it('marks a round as scheduled only when every match is scheduled', () => {
    expect(deriveRoundStatus(matches('scheduled', 'scheduled'))).toMatchObject({
      status: 'scheduled',
      summary: '0 de 2 partidos finalizados',
    });
  });

  it('marks a round as finished only when every match is finished', () => {
    expect(deriveRoundStatus(matches('finished', 'finished'))).toMatchObject({
      status: 'finished',
      summary: '2 de 2 partidos finalizados',
    });
  });

  it.each([
    ['a mix of finished and scheduled matches', matches('finished', 'scheduled')],
    ['an active match', matches('in_progress', 'scheduled')],
    ['a postponed match', matches('postponed')],
    ['a cancelled match', matches('cancelled')],
    ['finished and cancelled matches', matches('finished', 'cancelled')],
  ])('marks %s as in progress', (_description, input) => {
    expect(deriveRoundStatus(input).status).toBe('in_progress');
  });

  it('does not infer completion from scores or dates because they are outside the calculation', () => {
    expect(deriveRoundStatus(matches('scheduled'))).toMatchObject({
      status: 'scheduled',
      finishedMatches: 0,
    });
  });
});
