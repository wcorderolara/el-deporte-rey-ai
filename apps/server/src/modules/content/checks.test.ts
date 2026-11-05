/**
 * Content checks (architecture.md section 8.3; T10-F05, T10-A1-05; AD-11; R-207, R-237): the invisible-character
 * pre-check and its explicit exceptions, any `\p{N}`, number words in Spanish and English (cardinals 0 to 100,
 * ordinals, multipliers), placeholders outside the fact set, team-name variants and mixed scripts, links, mentions,
 * markup, field limits and hashtags. Synthetic texts only.
 */
import { describe, expect, it } from 'vitest';

import { type CheckContext, checkHashtags, checkLength, checkText, excerptOf } from './checks.js';
import { findNumberWords } from './words.js';

const CONTEXT: CheckContext = {
  brandHandle: '@SyntheticBrand',
  teams: [
    {
      teamId: 'atletico-rio-ebano',
      officialName: 'Atlético Río Ébano',
      aliases: ['Atletico Rio Ebano', 'Ebony River Athletic', 'At. Río Ébano', 'ARÉ'],
    },
    { teamId: 'real-brisamar', officialName: 'Real Brisamar', aliases: [] },
    { teamId: 'penas-nandu-sur', officialName: 'Peñas Ñandú (Sur)', aliases: ['Rhea Rocks (South)'] },
    { teamId: 'c-d-ancora', officialName: "C.D. Áncora-Mar l'Été", aliases: ['Sea Anchor Summer SC'] },
  ],
};

const NONE = new Set<string>();

function codes(
  text: string,
  allowed: ReadonlySet<string> = NONE,
  field: 'headline' | 'description' | 'caption' = 'headline',
): string[] {
  return checkText(field, text, allowed, CONTEXT).map((flag) => flag.code);
}

// Number words 0 to 100 (test-side generators, independent of the word tables).
const ES_UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ES_TEENS = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
];
const ES_TWENTIES = [
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const ES_TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function spanish(n: number): string {
  if (n < 10) return ES_UNITS[n] ?? '';
  if (n < 20) return ES_TEENS[n - 10] ?? '';
  if (n < 30) return ES_TWENTIES[n - 20] ?? '';
  if (n === 100) return 'cien';
  const tens = ES_TENS[Math.floor(n / 10)] ?? '';
  return n % 10 === 0 ? tens : `${tens} y ${ES_UNITS[n % 10] ?? ''}`;
}

function english(n: number): string {
  if (n < 10) return EN_UNITS[n] ?? '';
  if (n < 20) return EN_TEENS[n - 10] ?? '';
  if (n === 100) return 'one hundred';
  const tens = EN_TENS[Math.floor(n / 10)] ?? '';
  return n % 10 === 0 ? tens : `${tens}-${EN_UNITS[n % 10] ?? ''}`;
}

describe('number words (T10-F05)', () => {
  it('finds every cardinal from 0 to 100 in Spanish and English', () => {
    for (let n = 0; n <= 100; n += 1) {
      expect(findNumberWords(`el equipo suma ${spanish(n)} puntos`), spanish(n)).not.toEqual([]);
      expect(findNumberWords(`the team has ${english(n)} points`), english(n)).not.toEqual([]);
    }
  });

  it('finds larger cardinals, ordinals and multiplier words in both languages', () => {
    for (const text of [
      'ciento veinte',
      'doscientos',
      'mil aficionados',
      'veintiún partidos',
      'primer gol',
      'segunda parte',
      'décimo partido',
      'vigésimo tercero',
      'the first half',
      'his twentieth goal',
      'one hundredth match',
      'un doblete',
      'media docena',
      'un póker de goles',
      'la manita',
      'a hat-trick',
      'a hat trick',
      'a brace',
      'a treble',
      'a dozen chances',
      'scored twice',
    ]) {
      expect(findNumberWords(text), text).not.toEqual([]);
    }
  });

  it('finds nothing in ordinary commentary', () => {
    expect(findNumberWords('Gran partido en casa con mucha intensidad')).toEqual([]);
    expect(findNumberWords('A great match full of intensity')).toEqual([]);
  });
});

describe('invisible characters (pre-check, T10-A1-05)', () => {
  it('flags zero-width and bidi characters before every other rule', () => {
    const flags = checkText('headline', 'Ganó 1\u200B0 a cero', NONE, CONTEXT);
    expect(flags[0]?.code).toBe('FORBIDDEN_CONTENT');
    expect(flags[0]?.excerpt).toContain('[U+200B]');
    // The rules after the pre-check see the figure joined again.
    expect(flags.map((flag) => flag.code)).toContain('UNVERIFIED_NUMBER');
    expect(codes('Marcador 1\u20662\u2069 final')[0]).toBe('FORBIDDEN_CONTENT');
    expect(new Set(codes('Resultado \u202Eabc\u202C'))).toEqual(new Set(['FORBIDDEN_CONTENT']));
  });

  it('flags control characters, soft hyphens, tag characters and private-use characters', () => {
    for (const character of ['\u0000', '\u0007', '\r', '\t', '\u00AD', '\u2060', '\uFEFF', '\u{E0041}', '\uE000']) {
      expect(codes(`Gran${character}partido`), excerptOf(character)).toContain('FORBIDDEN_CONTENT');
    }
  });

  it('allows line feeds only up to the limit of each field', () => {
    expect(codes('Gran\npartido')).toEqual(['FORBIDDEN_CONTENT']);
    expect(codes('Gran\npartido\nhoy', NONE, 'description')).toEqual([]);
    expect(codes('a\nb\nc\nd', NONE, 'description')).toEqual(['FORBIDDEN_CONTENT']);
    expect(codes(`Resumen${'\nlinea'.repeat(20)}`, NONE, 'caption')).toEqual([]);
    expect(codes(`Resumen${'\nlinea'.repeat(21)}`, NONE, 'caption')).toEqual(['FORBIDDEN_CONTENT']);
  });

  it('allows the zero width joiner only between emoji', () => {
    expect(codes('Familia futbolera \u{1F468}\u200D\u{1F469}\u200D\u{1F467}', NONE, 'caption')).toEqual([]);
    expect(codes('Fuego \u2764️\u200D\u{1F525}', NONE, 'caption')).toEqual([]);
    expect(codes('Gran\u200Dpartido', NONE, 'caption')).toEqual(['FORBIDDEN_CONTENT']);
    expect(codes('\u{1F525}\u200Dpartido', NONE, 'caption')).toEqual(['FORBIDDEN_CONTENT']);
  });
});

describe('placeholders', () => {
  const allowed = new Set(['{{t:real-brisamar}}', '{{f:m1:score}}']);

  it('accepts placeholders of the fact set and removes them before the number check', () => {
    expect(codes('{{t:real-brisamar}} gana {{f:m1:score}}', allowed)).toEqual([]);
  });

  it('flags placeholders outside the fact set and stray braces', () => {
    expect(codes('{{f:m2:score}} en casa', allowed)).toEqual(['UNKNOWN_FACT_REFERENCE']);
    expect(codes('Victoria de {{t:otro-equipo}}', allowed)).toEqual(['UNKNOWN_FACT_REFERENCE']);
    expect(codes('Victoria de {{t:otro', allowed)).toEqual(['UNKNOWN_FACT_REFERENCE']);
  });
});

describe('numbers (UNVERIFIED_NUMBER)', () => {
  it.each([
    ['ASCII digits', 'El líder ganó 4-0'],
    ['fullwidth digits', 'Victoria por \uFF13 goles'],
    ['Arabic-Indic digits', 'Victoria por \u0663 goles'],
    ['Devanagari digits', 'Ventaja de \u0969 goles'],
    ['superscript digits', 'Remontada de \u00B3 goles'],
    ['subscript digits', 'Ventaja de \u2082 goles'],
    ['circled numbers', 'Ganó por \u2462 goles'],
    ['Roman numeral characters', 'Jornada \u216B de liga'],
    ['vulgar fractions', 'Ventaja de \u00BD gol'],
    ['cardinal words above twenty', 'Ya suma veintitrés puntos'],
    ['ordinal words', 'Their third straight win'],
    ['multiplier words', 'A hat-trick and a treble'],
  ])('flags %s', (_name, text) => {
    expect(codes(text)).toContain('UNVERIFIED_NUMBER');
  });
});

describe('team names (NON_OFFICIAL_TEAM_NAME, R-237)', () => {
  it('accepts commentary without names and the exact official name', () => {
    expect(codes('Gran partido en casa')).toEqual([]);
    expect(codes('Atlético Río Ébano gana en casa')).toEqual([]);
    expect(codes("C.D. Áncora-Mar l'Été gana")).toEqual([]);
    expect(codes('Peñas Ñandú (Sur) empata')).toEqual([]);
  });

  it('flags translated, abbreviated, unaccented and re-cased names', () => {
    expect(codes('Ebony River Athletic se impone')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('At. Río Ébano se impone')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('Atletico Rio Ebano se impone')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('atlético río ébano se impone')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('Penas Nandu (Sur) empata')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('Rhea Rocks (South) draws')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('\uFF32eal Brisamar gana')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
  });

  it('matches a short abbreviation only in its own letter case', () => {
    expect(codes('ARÉ gana en casa')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('ARE gana en casa')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('Fans are happy')).toEqual([]);
  });

  it('flags mixed-script and other-script tokens', () => {
    expect(codes('R\u0435al Brisamar gana en casa')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('Gran \u0440\u0430\u0440tido')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(codes('Gran \u03B1lfa partido')).toEqual(['NON_OFFICIAL_TEAM_NAME']);
  });
});

describe('links, mentions and markup (FORBIDDEN_CONTENT)', () => {
  it.each([
    ['a URL', 'Más en https://ejemplo.test/x'],
    ['a www address', 'Visita www.ejemplo'],
    ['a domain name', 'Síguenos en ejemplo.com'],
    ['a scheme', 'Haz clic javascript:alert'],
    ['an e-mail address', 'Escribe a nadie@ejemplo.test'],
    ['another mention', 'Saludos a @OtraCuenta'],
    ['HTML', 'Gran <b>partido</b>'],
    ['an HTML entity', 'Gran &amp; partido'],
    ['Markdown emphasis', 'Gran **partido**'],
    ['a Markdown link', 'Gran [partido](enlace)'],
    ['a Markdown heading', '# Gran partido'],
    ['code', 'Gran `partido`'],
  ])('flags %s', (_name, text) => {
    expect(codes(text, NONE, 'caption')).toContain('FORBIDDEN_CONTENT');
  });

  it('allows the brand handle and fullwidth mentions are normalized first', () => {
    expect(codes('Síguenos en @SyntheticBrand', NONE, 'caption')).toEqual([]);
    expect(codes('Síguenos en @syntheticbrand', NONE, 'caption')).toEqual([]);
    expect(codes('Síguenos en \uFF20OtraCuenta', NONE, 'caption')).toEqual(['FORBIDDEN_CONTENT']);
  });

  it('flags text over the field limit', () => {
    expect(checkLength('headline', 'x'.repeat(80), 80)).toEqual([]);
    expect(checkLength('headline', 'x'.repeat(81), 80).map((flag) => flag.code)).toEqual(['FORBIDDEN_CONTENT']);
  });
});

describe('hashtags', () => {
  const hashtagCodes = (tags: string[]): string[] => checkHashtags(tags, CONTEXT).map((flag) => flag.code);

  it('accepts ordinary hashtags and the hashtag-safe form of an official name', () => {
    expect(hashtagCodes(['#futbol', '#LigaDemo', '#AtléticoRíoÉbano', '#PeñasÑandúSur', '#CDÁncoraMarlÉté'])).toEqual(
      [],
    );
  });

  it('flags other forms of team names, numbers, invisible characters and other characters', () => {
    expect(hashtagCodes(['#AtleticoRioEbano'])).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(hashtagCodes(['#EbonyRiverAthletic'])).toEqual(['NON_OFFICIAL_TEAM_NAME']);
    expect(hashtagCodes(['#Jornada3'])).toEqual(['UNVERIFIED_NUMBER']);
    expect(hashtagCodes(['#hat_trick'])).toEqual(['UNVERIFIED_NUMBER']);
    expect(hashtagCodes(['#futbol\u200B'])).toContain('FORBIDDEN_CONTENT');
    expect(hashtagCodes(['#fut-bol'])).toEqual(['FORBIDDEN_CONTENT']);
    expect(hashtagCodes(['futbol'])).toEqual(['FORBIDDEN_CONTENT']);
    expect(hashtagCodes(['#{{t:real-brisamar}}'])).toEqual(['FORBIDDEN_CONTENT']);
    expect(hashtagCodes(['#R\u0435alBrisamar'])).toContain('NON_OFFICIAL_TEAM_NAME');
  });
});

describe('flag excerpts', () => {
  it('are printable and at most 120 characters', () => {
    const flags = checkText('caption', `${'larga '.repeat(40)}\u202E${'x'.repeat(200)}`, NONE, CONTEXT);
    for (const flag of flags) {
      expect(flag.excerpt.length).toBeLessThanOrEqual(120);
      expect(/[\p{Cc}\p{Cf}]/u.test(flag.excerpt)).toBe(false);
    }
  });
});

describe('matches not played yet (UNPLAYED_RESULT_CLAIM, PD-ARCH-01E-B)', () => {
  const UNPLAYED: CheckContext = { ...CONTEXT, unplayed: true };

  function unplayedCodes(text: string): string[] {
    return checkText('description', text, NONE, UNPLAYED).map((flag) => flag.code);
  }

  it('flags result and prediction words in Spanish and English, accented or not', () => {
    for (const text of [
      'Real Brisamar ganó el partido',
      'Real Brisamar gano el partido',
      'Un empate en casa',
      'El favorito de la jornada',
      'Pronóstico reservado',
      'Real Brisamar won at home',
      'The odds favour the visitors',
      'A likely comeback',
    ]) {
      expect(unplayedCodes(text), text).toContain('UNPLAYED_RESULT_CLAIM');
    }
  });

  it('reports each word once with its excerpt and accepts neutral commentary', () => {
    const flags = checkText('description', 'Victoria y otra victoria', NONE, UNPLAYED).filter(
      (flag) => flag.code === 'UNPLAYED_RESULT_CLAIM',
    );
    expect(flags.map((flag) => flag.excerpt)).toEqual(['Victoria', 'victoria']);
    expect(unplayedCodes('Partido programado de la jornada. Real Brisamar recibe a Atlético Río Ébano')).toEqual([]);
    expect(unplayedCodes('Match day ahead for Real Brisamar')).toEqual([]);
  });

  it('does not apply to results carousels', () => {
    expect(codes('Real Brisamar ganó el partido')).toEqual([]);
    expect(checkText('description', 'Real Brisamar won', NONE, { ...CONTEXT, unplayed: false })).toEqual([]);
  });
});
