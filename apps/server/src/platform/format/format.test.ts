import { describe, expect, it } from 'vitest';

import {
  CONTENT_LANGUAGES,
  formatDate,
  formatInt,
  formatTime,
  formatScore,
  hashtagFor,
  isLanguage,
  resultRelation,
  stageDisplay,
  teamDisplayName,
  templateText,
} from './index.js';

describe('formatInt and formatScore (R-036)', () => {
  it('writes ASCII digits without grouping', () => {
    expect(formatInt(12)).toBe('12');
    expect(formatInt(0)).toBe('0');
    expect(formatInt(1234567)).toBe('1234567');
    expect(formatInt(-3)).toBe('-3');
  });

  it('writes scores as home-away', () => {
    expect(formatScore({ home: 2, away: 1 })).toBe('2-1');
    expect(formatScore({ home: 0, away: 0 })).toBe('0-0');
    expect(formatScore({ home: 10, away: 11 })).toBe('10-11');
  });

  it('refuses non-integer, unsafe and negative values', () => {
    expect(() => formatInt(1.5)).toThrow(RangeError);
    expect(() => formatInt(Number.NaN)).toThrow(RangeError);
    expect(() => formatInt(2 ** 60)).toThrow(RangeError);
    expect(() => formatScore({ home: -1, away: 0 })).toThrow(RangeError);
    expect(() => formatScore({ home: 1, away: 0.5 })).toThrow(RangeError);
  });

  it('is deterministic: equal facts give equal text (R-213)', () => {
    const score = { home: 3, away: 2 };
    expect(formatScore(score)).toBe(formatScore({ ...score }));
  });

  it('gives the result relation of a score', () => {
    expect(resultRelation({ home: 2, away: 1 })).toBe('homeWin');
    expect(resultRelation({ home: 1, away: 1 })).toBe('draw');
    expect(resultRelation({ home: 0, away: 3 })).toBe('awayWin');
    expect(templateText('es').resultRelation.draw).toBe('empate');
    expect(templateText('en').resultRelation.homeWin).toBe('home win');
  });
});

describe('formatTime (PD-ARCH-01G-C)', () => {
  it('formats a 24-hour time at the display offset, across midnight', () => {
    expect(formatTime('2026-10-27T18:00:00Z', -360)).toBe('12:00');
    expect(formatTime('2026-10-27T03:05:00Z', -360)).toBe('21:05');
    expect(formatTime('2026-10-27T23:30:00+02:00', 0)).toBe('21:30');
  });
});

describe('formatDate (no Intl, configured display offset)', () => {
  it('formats with the code month tables of each language', () => {
    expect(formatDate('2026-10-27T18:00:00Z', 'es', -360)).toBe('27 oct 2026');
    expect(formatDate('2026-10-27T18:00:00Z', 'en', -360)).toBe('27 Oct 2026');
    expect(formatDate('2026-01-05T12:00:00.000Z', 'es', 0)).toBe('5 ene 2026');
    expect(formatDate('2026-12-31T12:00:00Z', 'en', 0)).toBe('31 Dec 2026');
  });

  it('applies the display offset across midnight', () => {
    // 03:00 UTC is 21:00 of the previous day at UTC-06:00 (America/Guatemala, no daylight saving time).
    expect(formatDate('2026-10-28T03:00:00Z', 'es', -360)).toBe('27 oct 2026');
    expect(formatDate('2026-10-28T03:00:00Z', 'es', 0)).toBe('28 oct 2026');
    expect(formatDate('2026-12-31T20:00:00Z', 'en', 300)).toBe('1 Jan 2027');
  });

  it('honours the explicit offset of the input', () => {
    expect(formatDate('2026-10-27T23:30:00-06:00', 'es', 0)).toBe('28 oct 2026');
    expect(formatDate('2026-10-27T23:30:00-06:00', 'es', -360)).toBe('27 oct 2026');
    expect(formatDate('2026-10-28T01:00:00+02:00', 'en', 0)).toBe('27 Oct 2026');
  });

  it('has twelve months in each language', () => {
    for (const language of CONTENT_LANGUAGES) {
      expect(templateText(language).months).toHaveLength(12);
    }
    const spanish = Array.from({ length: 12 }, (_, month) =>
      formatDate(`2026-${String(month + 1).padStart(2, '0')}-15T12:00:00Z`, 'es', 0),
    );
    expect(spanish.map((text) => text.split(' ')[1])).toEqual(templateText('es').months);
  });

  it('refuses dates without an explicit offset, impossible dates and offsets out of range', () => {
    expect(() => formatDate('2026-10-27T18:00:00', 'es', 0)).toThrow(RangeError);
    expect(() => formatDate('2026-10-27', 'es', 0)).toThrow(RangeError);
    expect(() => formatDate('2026-02-30T12:00:00Z', 'es', 0)).toThrow(RangeError);
    expect(() => formatDate('2026-10-27T24:00:00Z', 'es', 0)).toThrow(RangeError);
    expect(() => formatDate('2026-10-27T18:00:00+15:00', 'es', 0)).toThrow(RangeError);
    expect(() => formatDate('2026-10-27T18:00:00Z', 'es', 900)).toThrow(RangeError);
    expect(() => formatDate('2026-10-27T18:00:00Z', 'es', 1.5)).toThrow(RangeError);
  });

  it('does not echo the input in its errors', () => {
    let message = '';
    try {
      formatDate('not-a-date-marker', 'es', 0);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain('marker');
  });
});

describe('names, hashtags and stage display', () => {
  it('keeps official names exactly (R-052, R-426)', () => {
    expect(teamDisplayName('Club Atlético Ñandú')).toBe('Club Atlético Ñandú');
  });

  it('builds hashtags from letters and digits with diacritics kept (architecture.md section 8.2)', () => {
    expect(hashtagFor('Club Atlético Ñandú')).toBe('#ClubAtléticoÑandú');
    expect(hashtagFor("Deportivo O'Higgins F.C. 1920")).toBe('#DeportivoOHigginsFC1920');
    expect(hashtagFor('Unión (Norte) & Sur-Este')).toBe('#UniónNorteSurEste');
    expect(hashtagFor('Atlético')).toBe('#Atlético');
    expect(hashtagFor(' .-() ')).toBeNull();
  });

  it('shows the stage name as given, with the matchday word of the language', () => {
    expect(stageDisplay('Fase de liga', 3, 'es')).toBe('Fase de liga · Jornada 3');
    expect(stageDisplay('League phase', 3, 'en')).toBe('League phase · Matchday 3');
    expect(stageDisplay('Semifinales', null, 'es')).toBe('Semifinales');
    expect(() => stageDisplay('Fase de liga', 0, 'es')).toThrow(RangeError);
  });
});

describe('per-language template text (R-310, OD-21)', () => {
  it('has the demonstration label and the standings-not-available text', () => {
    expect(templateText('es').demonstrationLabel).toBe('DEMOSTRACIÓN · datos sintéticos');
    expect(templateText('en').demonstrationLabel).toBe('DEMO · synthetic data');
    expect(templateText('es').standingsNotAvailable).toBe('Tabla no disponible');
    expect(templateText('en').standingsNotAvailable).toBe('Standings not available');
  });

  it('has the same keys in every language', () => {
    const keys = (language: (typeof CONTENT_LANGUAGES)[number]): string[] => Object.keys(templateText(language)).sort();
    expect(keys('en')).toEqual(keys('es'));
  });

  it('is frozen', () => {
    expect(Object.isFrozen(templateText('es'))).toBe(true);
    expect(Object.isFrozen(templateText('es').standingsColumns)).toBe(true);
  });

  it('looks languages up without reaching inherited properties (T11H-F07)', () => {
    for (const key of ['__proto__', 'constructor', 'toString', 'fr']) {
      expect(isLanguage(key)).toBe(false);
      expect(() => templateText(key as 'es')).toThrow(RangeError);
    }
    expect(isLanguage('es')).toBe(true);
  });
});
