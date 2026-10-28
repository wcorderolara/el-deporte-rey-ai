/** Display text of evidence and dispute values, and of fact values without a server display form. */
import type { Fact } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { factValueText, formatFactValue, matchLabel, teamNamesFrom } from './format';
import { demoFacts, scoreFact } from './test/fixtures';

const teams = new Map([
  ['equipo-a', 'Equipo A'],
  ['equipo-b', 'Equipo B'],
]);

describe('formatFactValue', () => {
  it('formats every kind of value', () => {
    expect(formatFactValue({ home: 3, away: 0 }, teams)).toBe('3–0');
    expect(formatFactValue({ homeTeamId: 'equipo-a', awayTeamId: 'equipo-z' }, teams)).toBe(
      'Equipo A (local) contra equipo-z (visitante)',
    );
    expect(formatFactValue({ matchStatus: 'awarded' }, teams)).toBe('Resultado adjudicado por decisión administrativa');
    expect(formatFactValue({ teamId: 'equipo-a', officialName: 'Equipo A' }, teams)).toBe('Equipo A');
    expect(formatFactValue({ stageLabel: 'Fase de grupos', matchdayNumber: 3, totalMatchdays: 6 }, teams)).toBe(
      'Fase de grupos, jornada 3 de 6',
    );
    expect(formatFactValue({ stageLabel: 'Final', matchdayNumber: null, totalMatchdays: null }, teams)).toBe('Final');
    expect(formatFactValue({ type: 'teams_in_table', count: 10 }, teams)).toBe('10 equipos en la tabla');
    expect(formatFactValue({ type: 'matchday_of_total', matchday: 1, totalMatchdays: 18 }, teams)).toBe(
      'jornada 1 de 18',
    );
    expect(
      formatFactValue(
        {
          position: 2,
          teamId: 'equipo-b',
          played: 5,
          won: 1,
          drawn: 1,
          lost: 3,
          goalsFor: 4,
          goalsAgainst: 9,
          goalDifference: -5,
          points: 4,
        },
        teams,
      ),
    ).toBe('Posición 2 · Equipo B · PJ 5 · G 1 · E 1 · P 3 · GF 4 · GC 9 · DG -5 · Pts 4');
    expect(formatFactValue({ kickoff: 'not-a-date' }, teams)).toBe('not-a-date');
  });
});

describe('factValueText and matchLabel', () => {
  it('prefers the server display form, then the value, then the candidate value', () => {
    expect(factValueText(scoreFact({ n: 1, matchKey: 'm1', display: '2-1' }), teams)).toBe('2-1');
    expect(factValueText(scoreFact({ n: 1, matchKey: 'm1' }), teams)).toBe('2–1');
    const candidate = scoreFact({ n: 1, matchKey: 'm1', status: 'unverified', unverifiedReason: 'no_accepted_source' });
    expect(factValueText(candidate, teams)).toBe('2–1');
    const none = scoreFact({ n: 1, matchKey: 'm1', status: 'unverified', unverifiedReason: 'disputed', score: null });
    expect(factValueText(none, teams)).toBeNull();
  });

  it('names a match by its teams and falls back to the match key', () => {
    const facts: Fact[] = demoFacts().facts;
    expect(matchLabel('m1', facts, teamNamesFrom(facts))).toBe('Equipo A - Equipo B');
    expect(matchLabel('m2', facts, teamNamesFrom(facts))).toBe('m2');
  });

  it('collects official team names into a prototype-safe map', () => {
    const names = teamNamesFrom(demoFacts().facts);
    expect(names.get('equipo-a')).toBe('Equipo A');
    expect(names.get('__proto__')).toBeUndefined();
  });
});
