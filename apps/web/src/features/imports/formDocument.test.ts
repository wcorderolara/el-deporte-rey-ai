/**
 * Web-form document builder (R-057, R-319): contract shapes, team keys by the CSV rule (T11H-F09), the semantic hints
 * of provider-ports section 1.6, no derived values (BR-14) and the 512 KiB check of the serialized document
 * (T11H-F10).
 */
import { ImportFormCreateSchema } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildFormImport,
  deriveTeamKey,
  emptyDraft,
  emptyMatch,
  emptyStanding,
  fieldIds,
  localDateTimeToUtc,
  parseInteger,
  type FormDraft,
} from './formDocument';

function validDraft(): FormDraft {
  const draft = emptyDraft();
  const [north, south] = draft.teams;
  if (north === undefined || south === undefined) {
    throw new Error('the empty draft has two teams');
  }
  north.name = 'Equipo Norte';
  south.name = 'Équipo Sur';
  const match = draft.matches[0];
  if (match === undefined) {
    throw new Error('the empty draft has one match');
  }
  Object.assign(match, {
    home: north.uid,
    away: south.uid,
    kickoff: '2026-09-30T18:00',
    status: 'finished',
    homeScore: '2',
    awayScore: '1',
  });
  return {
    ...draft,
    competitionId: 'liga-sintetica',
    competitionName: 'Liga Sintética',
    areaName: '',
    seasonId: 'temporada-2026',
    seasonLabel: 'Temporada 2026',
    stageId: 'apertura',
    stageName: 'Apertura',
    stageOrder: '1',
    scope: 'matchday',
    matchday: '3',
  };
}

function fields(draft: FormDraft): string[] {
  const check = buildFormImport(draft);
  return check.ok ? [] : check.issues.map((issue) => issue.field);
}

describe('deriveTeamKey (T11H-F09)', () => {
  it('applies NFC, removes combining marks, lowercases and joins other runs with one hyphen', () => {
    expect(deriveTeamKey('Équipo Sur')).toBe('equipo-sur');
    expect(deriveTeamKey('Équipo Sur')).toBe('equipo-sur');
    expect(deriveTeamKey('  Club A.B.  ')).toBe('club-a-b');
    expect(deriveTeamKey('Club A B')).toBe('club-a-b');
    expect(deriveTeamKey('...')).toBe('');
  });
});

describe('value helpers', () => {
  it('parses bounded integers only', () => {
    expect(parseInteger(' 7 ', 0, 99)).toBe(7);
    expect(parseInteger('-3', -999, 999)).toBe(-3);
    expect(parseInteger('100', 0, 99)).toBeNull();
    expect(parseInteger('1.5', 0, 99)).toBeNull();
    expect(parseInteger('', 0, 99)).toBeNull();
  });

  it('converts a datetime-local value to a UTC time without milliseconds', () => {
    const expected = new Date('2026-09-30T18:00').toISOString().replace('.000Z', 'Z');
    expect(localDateTimeToUtc('2026-09-30T18:00')).toBe(expected);
    expect(localDateTimeToUtc('30/09/2026')).toBeNull();
    expect(localDateTimeToUtc('')).toBeNull();
  });
});

describe('buildFormImport', () => {
  it('builds a contract-valid form import with derived team keys and the score of the finished match', () => {
    const check = buildFormImport({ ...validDraft(), declaredSource: ' Acta sintética ' });
    expect(check.ok).toBe(true);
    if (!check.ok) {
      return;
    }
    expect(ImportFormCreateSchema.safeParse(check.body).success).toBe(true);
    expect(check.body).toEqual({
      channel: 'form',
      declaredSource: 'Acta sintética',
      document: {
        format: 'edr-manual-import/1',
        competition: { id: 'liga-sintetica', name: 'Liga Sintética', areaName: null },
        season: { id: 'temporada-2026', label: 'Temporada 2026' },
        selections: [
          {
            stage: { id: 'apertura', name: 'Apertura', order: 1 },
            matchday: 3,
            teams: [
              { key: 'equipo-norte', name: 'Equipo Norte' },
              { key: 'equipo-sur', name: 'Équipo Sur' },
            ],
            matches: [
              {
                home: 'equipo-norte',
                away: 'equipo-sur',
                kickoff: localDateTimeToUtc('2026-09-30T18:00'),
                status: 'finished',
                score: { home: 2, away: 1 },
              },
            ],
            standings: null,
          },
        ],
      },
    });
    // No person-level member exists anywhere in the document (R-119).
    expect(JSON.stringify(check.body)).not.toMatch(/player|scorer|referee|coach|squad|lineup/i);
  });

  it('selects a whole stage with a null matchday', () => {
    const check = buildFormImport({ ...validDraft(), scope: 'stage', matchday: 'ignored' });
    expect(check.ok && check.body.document.selections[0]?.matchday).toBeNull();
  });

  it('sends no score for a match that is not finished, even when one was typed before', () => {
    const draft = validDraft();
    Object.assign(draft.matches[0] ?? {}, { status: 'postponed' });
    const check = buildFormImport(draft);
    expect(check.ok && check.body.document.selections[0]?.matches[0]?.score).toBeNull();
  });

  it('reports every missing value of an empty draft and never builds a document', () => {
    const draft = emptyDraft();
    const check = buildFormImport(draft);
    expect(check.ok).toBe(false);
    const reported = fields(draft);
    for (const field of [
      'competitionId',
      'competitionName',
      'seasonId',
      'seasonLabel',
      'stageId',
      'stageName',
      'matchday',
    ]) {
      expect(reported).toContain(field);
    }
    const match = draft.matches[0];
    expect(reported).toContain(fieldIds.match(match?.uid ?? '', 'home'));
    expect(reported).toContain(fieldIds.match(match?.uid ?? '', 'kickoff'));
    expect(reported).toContain(fieldIds.match(match?.uid ?? '', 'status'));
    expect(reported).toContain(fieldIds.teamName(draft.teams[0]?.uid ?? ''));
    expect(reported).not.toContain('areaName');
  });

  it('refuses identifiers and names outside the contract patterns', () => {
    const check = buildFormImport({
      ...validDraft(),
      competitionId: 'Liga Sintética',
      seasonLabel: 'Temporada <2026>',
    });
    expect(check.ok === false && check.issues.map((issue) => issue.field)).toEqual(['competitionId', 'seasonLabel']);
  });

  it('refuses team names that give the same key or no key', () => {
    const draft = validDraft();
    Object.assign(draft.teams[0] ?? {}, { name: 'Club A.B.' });
    Object.assign(draft.teams[1] ?? {}, { name: 'Club A B' });
    const check = buildFormImport(draft);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.issues.filter((issue) => issue.message.includes('«club-a-b»'))).toHaveLength(2);
    }
    const noKey = validDraft();
    Object.assign(noKey.teams[0] ?? {}, { name: '...' });
    expect(fields(noKey)).toContain(fieldIds.teamName(noKey.teams[0]?.uid ?? ''));
  });

  it('refuses a finished match without score, the same team twice and a duplicate match', () => {
    const draft = validDraft();
    const first = draft.matches[0];
    Object.assign(first ?? {}, { homeScore: '' });
    const second = {
      ...emptyMatch(),
      home: first?.home ?? '',
      away: first?.away ?? '',
      kickoff: '2026-10-01T18:00',
      status: 'scheduled' as const,
    };
    const third = {
      ...emptyMatch(),
      home: first?.home ?? '',
      away: first?.home ?? '',
      kickoff: '2026-10-01T18:00',
      status: 'scheduled' as const,
    };
    draft.matches.push(second, third);
    const check = buildFormImport(draft);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      const messages = check.issues.map((issue) => `${issue.field} ${issue.message}`);
      expect(messages).toContain(
        `${fieldIds.match(first?.uid ?? '', 'homeScore')} Un partido finalizado necesita el marcador.`,
      );
      expect(messages).toContain(
        `${fieldIds.match(second.uid, 'home')} Este partido ya está en la lista con los mismos equipos.`,
      );
      expect(messages).toContain(
        `${fieldIds.match(third.uid, 'away')} El equipo local y el visitante deben ser distintos.`,
      );
    }
  });

  it('builds standings as entered and checks positions and arithmetic without deriving values', () => {
    const draft = validDraft();
    const [north, south] = draft.teams;
    const rowA = {
      ...emptyStanding(),
      position: '1',
      team: north?.uid ?? '',
      played: '1',
      won: '1',
      drawn: '0',
      lost: '0',
      goalsFor: '2',
      goalsAgainst: '1',
      goalDifference: '1',
      points: '3',
    };
    const rowB = {
      ...emptyStanding(),
      position: '2',
      team: south?.uid ?? '',
      played: '1',
      won: '0',
      drawn: '0',
      lost: '1',
      goalsFor: '1',
      goalsAgainst: '2',
      goalDifference: '-1',
      points: '0',
    };
    const valid = { ...draft, includeStandings: true, asOf: '2026-10-01T09:00', standings: [rowA, rowB] };
    const check = buildFormImport(valid);
    expect(check.ok && check.body.document.selections[0]?.standings).toEqual({
      asOf: localDateTimeToUtc('2026-10-01T09:00'),
      rows: [
        {
          position: 1,
          team: 'equipo-norte',
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 2,
          goalsAgainst: 1,
          goalDifference: 1,
          points: 3,
        },
        {
          position: 2,
          team: 'equipo-sur',
          played: 1,
          won: 0,
          drawn: 0,
          lost: 1,
          goalsFor: 1,
          goalsAgainst: 2,
          goalDifference: -1,
          points: 0,
        },
      ],
    });

    const wrong = {
      ...valid,
      standings: [
        { ...rowA, position: '2', played: '2', goalDifference: '0' },
        { ...rowB, goalDifference: '' },
      ],
    };
    const reported = fields(wrong);
    expect(reported).toContain(fieldIds.row(rowA.uid, 'position'));
    expect(reported).toContain(fieldIds.row(rowB.uid, 'position'));
    expect(reported).toContain(fieldIds.row(rowA.uid, 'played'));
    expect(reported).toContain(fieldIds.row(rowA.uid, 'goalDifference'));
    expect(reported).toContain(fieldIds.row(rowB.uid, 'goalDifference'));
    expect(fields({ ...valid, asOf: '' })).toContain('asOf');
  });

  it('ignores the standings rows when the standings are not included (stages without standings are valid)', () => {
    const draft = { ...validDraft(), includeStandings: false, standings: [emptyStanding()] };
    const check = buildFormImport(draft);
    expect(check.ok && check.body.document.selections[0]?.standings).toBeNull();
  });
});
