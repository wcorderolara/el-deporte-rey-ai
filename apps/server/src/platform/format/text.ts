/**
 * Per-language fixed template text (R-310; contracts/provider-ports.md section 5; architecture.md section 8.3).
 *
 * Content languages are Spanish (default) and English (OD-11, R-425). Every fixed text that a slide, a caption or a
 * check needs comes from these tables, so that the content substitution, the renderer and visual QA compare like with
 * like. The tables contain no provider, competition or team name.
 */

/** Selectable content languages (OD-11). The default language is configured in `config/languages.json`. */
export const CONTENT_LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof CONTENT_LANGUAGES)[number];

/** Fixed template text of one language. */
export interface TemplateText {
  /** Demonstration label of DEMO_DATA content (OD-21, R-269, AD-33). */
  readonly demonstrationLabel: string;
  /** Shown when the selection has no standings (R-254, R-285). */
  readonly standingsNotAvailable: string;
  /** Word placed before a matchday number by `stageDisplay`. */
  readonly matchdayWord: string;
  /** Title of a standings slide. */
  readonly standingsTitle: string;
  /** Prefix of the "as of" time of a standings slide (OD-05). */
  readonly standingsAsOf: string;
  /** Column headings of a standings table, in the order of the standing-row fields. */
  readonly standingsColumns: Readonly<{
    position: string;
    team: string;
    played: string;
    won: string;
    drawn: string;
    lost: string;
    goalsFor: string;
    goalsAgainst: string;
    goalDifference: string;
    points: string;
  }>;
  /** Title of a match-result slide. */
  readonly resultTitle: string;
  /** Deterministic result relation phrases (contracts/provider-ports.md section 2; T10-F06). */
  readonly resultRelation: Readonly<{ homeWin: string; draw: string; awayWin: string }>;
  /** Closing-slide call to follow the brand handle. */
  readonly closingFollow: string;
  /** Month abbreviations used by `formatDate`, January first (no `Intl`). */
  readonly months: readonly string[];
}

const SPANISH: TemplateText = {
  demonstrationLabel: 'DEMOSTRACIÓN · datos sintéticos',
  standingsNotAvailable: 'Tabla no disponible',
  matchdayWord: 'Jornada',
  standingsTitle: 'Tabla de posiciones',
  standingsAsOf: 'Actualizada al',
  standingsColumns: {
    position: 'Pos',
    team: 'Equipo',
    played: 'PJ',
    won: 'G',
    drawn: 'E',
    lost: 'P',
    goalsFor: 'GF',
    goalsAgainst: 'GC',
    goalDifference: 'DG',
    points: 'Pts',
  },
  resultTitle: 'Resultado final',
  resultRelation: { homeWin: 'victoria local', draw: 'empate', awayWin: 'victoria visitante' },
  closingFollow: 'Síguenos en',
  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};

const ENGLISH: TemplateText = {
  demonstrationLabel: 'DEMO · synthetic data',
  standingsNotAvailable: 'Standings not available',
  matchdayWord: 'Matchday',
  standingsTitle: 'Standings',
  standingsAsOf: 'As of',
  standingsColumns: {
    position: 'Pos',
    team: 'Team',
    played: 'P',
    won: 'W',
    drawn: 'D',
    lost: 'L',
    goalsFor: 'GF',
    goalsAgainst: 'GA',
    goalDifference: 'GD',
    points: 'Pts',
  },
  resultTitle: 'Full time',
  resultRelation: { homeWin: 'home win', draw: 'draw', awayWin: 'away win' },
  closingFollow: 'Follow us at',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Lookup keyed by a language code; a `Map`, so that an unexpected code never reaches an inherited property. */
const TABLES: ReadonlyMap<string, TemplateText> = new Map<string, TemplateText>([
  ['es', deepFreeze(SPANISH)],
  ['en', deepFreeze(ENGLISH)],
]);

/** True when the value is one of the content languages. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && TABLES.has(value);
}

/** The fixed template text of a language; throws a RangeError for any other value. */
export function templateText(language: Language): TemplateText {
  const table = TABLES.get(language);
  if (table === undefined) {
    throw new RangeError('unknown content language');
  }
  return table;
}
