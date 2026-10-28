/**
 * Number word tables of the `UNVERIFIED_NUMBER` content check (architecture.md section 8.3; T10-F05; AD-11).
 *
 * The tables hold Spanish and English words in folded form (NFKC, lower case, diacritics removed; `foldWord`), and
 * both languages are checked whatever the content language, because a model can switch language inside a text.
 * They cover:
 * - cardinal words from zero to one hundred and beyond (every word that a cardinal up to at least 100 is written
 *   with, plus hundreds, thousands and millions);
 * - ordinal words, including the Spanish compound prefixes (`decimo...`, `vigesimo...`);
 * - multiplier and collective words ("doble", "triplete", "media docena", "hat-trick", "double", "treble", "dozen",
 *   and the football forms "brace", "poker", "manita").
 *
 * The strictest reading is applied: the Spanish "un" and "una" (also the indefinite article) and the English "one"
 * are number words and are flagged; a flagged text can be regenerated, it cannot be approved (R-207).
 */

/** Folded form of a word: NFKC, lower case, canonical decomposition, combining marks removed. */
export function foldWord(value: string): string {
  return value.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const SPANISH_CARDINALS = [
  'cero',
  'un',
  'uno',
  'una',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciseis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiun',
  'veintiuno',
  'veintiuna',
  'veintidos',
  'veintitres',
  'veinticuatro',
  'veinticinco',
  'veintiseis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
  'cien',
  'ciento',
  'cientos',
  'doscientos',
  'doscientas',
  'trescientos',
  'trescientas',
  'cuatrocientos',
  'cuatrocientas',
  'quinientos',
  'quinientas',
  'seiscientos',
  'seiscientas',
  'setecientos',
  'setecientas',
  'ochocientos',
  'ochocientas',
  'novecientos',
  'novecientas',
  'mil',
  'miles',
  'millon',
  'millones',
  'billon',
  'billones',
] as const;

const ENGLISH_CARDINALS = [
  'zero',
  'nil',
  'nought',
  'naught',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
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
  'twenty',
  'thirty',
  'forty',
  'fourty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'hundreds',
  'thousand',
  'thousands',
  'million',
  'millions',
  'billion',
  'billions',
] as const;

const SPANISH_ORDINALS = [
  'primer',
  'primero',
  'primera',
  'primeros',
  'primeras',
  'segundo',
  'segunda',
  'segundos',
  'segundas',
  'tercer',
  'tercero',
  'tercera',
  'terceros',
  'terceras',
  'cuarto',
  'cuarta',
  'cuartos',
  'cuartas',
  'quinto',
  'quinta',
  'quintos',
  'quintas',
  'sexto',
  'sexta',
  'sextos',
  'sextas',
  'septimo',
  'septima',
  'septimos',
  'septimas',
  'setimo',
  'setima',
  'octavo',
  'octava',
  'octavos',
  'octavas',
  'noveno',
  'novena',
  'novenos',
  'novenas',
  'nono',
  'nona',
  'undecimo',
  'undecima',
  'duodecimo',
  'duodecima',
] as const;

/** Spanish ordinal stems: `decimo`, `decimotercero`, `vigesimo primero`, `centesima`, ... */
const SPANISH_ORDINAL_PREFIX =
  /^(decim|vigesim|trigesim|cuadragesim|quincuagesim|sexagesim|septuagesim|octogesim|nonagesim|centesim|milesim)[oa]/;

const ENGLISH_ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
  'twentieth',
  'thirtieth',
  'fortieth',
  'fiftieth',
  'sixtieth',
  'seventieth',
  'eightieth',
  'ninetieth',
  'hundredth',
  'thousandth',
  'millionth',
] as const;

const MULTIPLIER_WORDS = [
  // Spanish
  'doble',
  'dobles',
  'doblete',
  'dobletes',
  'duplete',
  'dupletes',
  'triple',
  'triples',
  'triplete',
  'tripletes',
  'cuadruple',
  'cuadruples',
  'quintuple',
  'quintuples',
  'sextuple',
  'docena',
  'docenas',
  'decena',
  'decenas',
  'centena',
  'centenas',
  'centenar',
  'centenares',
  'millar',
  'millares',
  'poker',
  'manita',
  // English
  'double',
  'doubles',
  'treble',
  'trebles',
  'quadruple',
  'quadruples',
  'quintuple',
  'dozen',
  'dozens',
  'brace',
  'braces',
  'hattrick',
  'hattricks',
  'once',
  'twice',
  'thrice',
] as const;

/** Multi-word number expressions, as folded token sequences. */
const NUMBER_PHRASES: readonly (readonly string[])[] = [
  ['hat', 'trick'],
  ['hat', 'tricks'],
  ['media', 'docena'],
];

const NUMBER_WORDS: ReadonlySet<string> = new Set<string>([
  ...SPANISH_CARDINALS,
  ...ENGLISH_CARDINALS,
  ...SPANISH_ORDINALS,
  ...ENGLISH_ORDINALS,
  ...MULTIPLIER_WORDS,
]);

/** True when one folded word is a number word of either language. */
export function isNumberWord(folded: string): boolean {
  return NUMBER_WORDS.has(folded) || SPANISH_ORDINAL_PREFIX.test(folded);
}

/**
 * The number words and phrases found in a text, in order of appearance (folded forms). The text is folded and split
 * into runs of letters, so "hat-trick", "forty-two" and "veintitrés" are all found.
 */
export function findNumberWords(text: string): string[] {
  const words = foldWord(text)
    .split(/[^\p{L}]+/u)
    .filter((word) => word !== '');
  const found: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    const phrase = NUMBER_PHRASES.find((parts) => parts.every((part, offset) => words[index + offset] === part));
    if (phrase !== undefined) {
      found.push(phrase.join(' '));
      index += phrase.length - 1;
    } else if (isNumberWord(word)) {
      found.push(word);
    }
  }
  return found;
}

/** Number of cardinal words of each language (a test checks the coverage of at least 0 to 100). */
export const NUMBER_WORD_TABLE_SIZES = Object.freeze({
  spanishCardinals: SPANISH_CARDINALS.length,
  englishCardinals: ENGLISH_CARDINALS.length,
  spanishOrdinals: SPANISH_ORDINALS.length,
  englishOrdinals: ENGLISH_ORDINALS.length,
  multipliers: MULTIPLIER_WORDS.length,
});
