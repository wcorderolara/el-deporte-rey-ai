/**
 * TEAM-DISPLAY-01 (PD-37): the text a slide is drawn with. Every fact segment of a team-name fact with a recorded
 * presentation name takes it (the team fields, the home and away names of each calendar row, and the team placeholders
 * of the headline and description); commentary, template text and the other facts are drawn as stored, whatever they
 * say: the swap goes by fact, never by comparing text. The map only ever holds team-name facts (`displayNamesOfSlides`).
 */
import { describe, expect, it } from 'vitest';

import type { StoredElementText } from '../rendering/slide-content.js';
import { commentary, fact, template, uuid } from '../rendering/test/support.js';

import { presentedText } from './project.js';

const HOME = uuid(11);
const AWAY = uuid(12);
const KICKOFF = uuid(14);
const OTHER_HOME = uuid(21);
const OTHER_AWAY = uuid(22);

const MATCH: StoredElementText = {
  version: 1,
  fields: [
    { field: 'title', segments: [template('Resultado')] },
    { field: 'team_home', segments: [fact('Club Sintético Alfa de la Ciudad Ficticia', HOME)] },
    { field: 'team_away', segments: [fact('Club Sintético Beta', AWAY)] },
    { field: 'kickoff', segments: [fact('20 de diciembre', KICKOFF)] },
    {
      field: 'headline',
      segments: [fact('Club Sintético Alfa de la Ciudad Ficticia', HOME), commentary(' gana en casa')],
    },
    {
      field: 'description',
      segments: [
        commentary('Club Sintético Alfa de la Ciudad Ficticia sigue líder ante '),
        fact('Club Sintético Beta', AWAY),
      ],
    },
  ],
};

const CALENDAR: StoredElementText = {
  version: 1,
  fields: [
    {
      field: 'fixtures',
      segments: [
        fact('Club Sintético Alfa de la Ciudad Ficticia', HOME),
        template(' vs '),
        fact('Club Sintético Beta', AWAY),
        template(' · '),
        fact('20 de diciembre', KICKOFF),
        template('\n'),
        fact('Club Sintético Gamma', OTHER_HOME),
        template(' vs '),
        fact('Club Sintético Alfa de la Ciudad Ficticia', OTHER_AWAY),
        template(' · '),
        fact('21 de diciembre', KICKOFF),
      ],
    },
  ],
};

describe('presentedText (TEAM-DISPLAY-01)', () => {
  it('returns the stored text itself when the project has no presentation name', () => {
    expect(presentedText(MATCH, {})).toBe(MATCH);
  });

  it('draws the presentation name in every segment of that team fact, with the same fact and provenance', () => {
    const drawn = presentedText(MATCH, { [HOME]: 'Alfa CF' });
    expect(drawn.fields).toEqual([
      { field: 'title', segments: [template('Resultado')] },
      { field: 'team_home', segments: [fact('Alfa CF', HOME)] },
      { field: 'team_away', segments: [fact('Club Sintético Beta', AWAY)] },
      { field: 'kickoff', segments: [fact('20 de diciembre', KICKOFF)] },
      // The team placeholder of the AI text takes the name; the commentary around it does not change.
      { field: 'headline', segments: [fact('Alfa CF', HOME), commentary(' gana en casa')] },
      // Text that is not a fact segment is drawn as stored, whatever it says: the swap goes by fact, never by text.
      {
        field: 'description',
        segments: [
          commentary('Club Sintético Alfa de la Ciudad Ficticia sigue líder ante '),
          fact('Club Sintético Beta', AWAY),
        ],
      },
    ]);
    // The stored text is not changed.
    expect(MATCH.fields[1]?.segments[0]?.text).toBe('Club Sintético Alfa de la Ciudad Ficticia');
  });

  it('draws the presentation names in the home and away names of each calendar row, and leaves its other values', () => {
    const drawn = presentedText(CALENDAR, { [HOME]: 'Alfa CF', [OTHER_AWAY]: 'Alfa CF' });
    expect(drawn.fields[0]?.segments.map((segment) => segment.text)).toEqual([
      'Alfa CF',
      ' vs ',
      'Club Sintético Beta',
      ' · ',
      '20 de diciembre',
      '\n',
      'Club Sintético Gamma',
      ' vs ',
      'Alfa CF',
      ' · ',
      '21 de diciembre',
    ]);
    expect(drawn.fields[0]?.segments.map((segment) => segment.factId)).toEqual(
      CALENDAR.fields[0]?.segments.map((segment) => segment.factId),
    );
  });
});
