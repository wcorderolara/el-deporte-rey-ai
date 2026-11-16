/**
 * Deterministic display formatting of facts (contracts/provider-ports.md section 5; R-035, R-036, R-052, R-213).
 *
 * These functions are the single source of display text for facts: the content substitution, the renderer and the
 * visual-QA data check all call them, so equal facts always give equal text. No function uses `Intl`, the host
 * locale or the host time zone; dates use code month tables and the configured display offset.
 */
import { type Language, templateText } from './text.js';

/** Smallest and largest display offsets accepted, in minutes east of UTC (UTC-12:00 to UTC+14:00). */
export const MIN_UTC_OFFSET_MINUTES = -720;
export const MAX_UTC_OFFSET_MINUTES = 840;

/** ISO-8601 date and time with an explicit offset or `Z` (the domain schema requires one, provider-ports 1.3). */
const ISO_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-](\d{2}):(\d{2}))$/;

const MS_PER_MINUTE = 60_000;

function assertSafeInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${what} must be a safe integer`);
  }
}

/** Integer as ASCII digits without grouping, with a leading `-` when negative: `formatInt(12) === '12'`. */
export function formatInt(value: number): string {
  assertSafeInteger(value, 'value');
  return value < 0 ? `-${String(-value)}` : String(value);
}

/** A match score as `home-away`: `formatScore({ home: 2, away: 1 }) === '2-1'`. Goals are non-negative integers. */
export function formatScore(score: { readonly home: number; readonly away: number }): string {
  for (const [what, goals] of [
    ['home goals', score.home],
    ['away goals', score.away],
  ] as const) {
    assertSafeInteger(goals, what);
    if (goals < 0) {
      throw new RangeError(`${what} must not be negative`);
    }
  }
  return `${formatInt(score.home)}-${formatInt(score.away)}`;
}

/** The result relation of a score, as the key of the per-language `resultRelation` phrases. */
export function resultRelation(score: {
  readonly home: number;
  readonly away: number;
}): 'homeWin' | 'draw' | 'awayWin' {
  formatScore(score);
  if (score.home > score.away) {
    return 'homeWin';
  }
  return score.home === score.away ? 'draw' : 'awayWin';
}

/** Checks a display offset in minutes (configuration `display.utcOffsetMinutes`). */
export function assertUtcOffset(utcOffsetMinutes: number): void {
  assertSafeInteger(utcOffsetMinutes, 'utcOffsetMinutes');
  if (utcOffsetMinutes < MIN_UTC_OFFSET_MINUTES || utcOffsetMinutes > MAX_UTC_OFFSET_MINUTES) {
    throw new RangeError('utcOffsetMinutes is out of range');
  }
}

/** Parses an ISO-8601 instant with an explicit offset; throws a RangeError (without echoing the input) otherwise. */
function parseInstant(iso: string): number {
  const match = ISO_WITH_OFFSET.exec(iso);
  if (match === null) {
    throw new RangeError('date must be an ISO-8601 date and time with an explicit offset');
  }
  const field = (index: number): number => Number(match[index] ?? '0');
  const [year, month, day, hour, minute, second] = [field(1), field(2), field(3), field(4), field(5), field(6)];
  const zone = match[8] ?? 'Z';
  const local = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(local);
  if (
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError('date is not a valid calendar date and time');
  }
  let offset = 0;
  if (zone !== 'Z') {
    const offsetHours = field(9);
    const offsetMinutes = field(10);
    if (offsetHours > 14 || offsetMinutes > 59) {
      throw new RangeError('date has an invalid offset');
    }
    offset = (zone.startsWith('-') ? -1 : 1) * (offsetHours * 60 + offsetMinutes);
  }
  return local - offset * MS_PER_MINUTE;
}

/** Calendar fields of an instant shown at the display offset. */
function displayFields(iso: string, utcOffsetMinutes: number): Date {
  assertUtcOffset(utcOffsetMinutes);
  return new Date(parseInstant(iso) + utcOffsetMinutes * MS_PER_MINUTE);
}

/**
 * Date at the display offset with the language's month table: `formatDate('2026-10-27T18:00:00Z', 'es', -360)` is
 * `'27 oct 2026'`, and `'27 Oct 2026'` in English.
 */
export function formatDate(iso: string, language: Language, utcOffsetMinutes: number): string {
  const shifted = displayFields(iso, utcOffsetMinutes);
  const month = templateText(language).months[shifted.getUTCMonth()];
  if (month === undefined) {
    throw new RangeError('month table is incomplete');
  }
  return `${String(shifted.getUTCDate())} ${month} ${String(shifted.getUTCFullYear())}`;
}

/**
 * Time of day at the display offset, 24-hour `HH:MM`: `formatTime('2026-10-27T18:00:00Z', -360)` is `'12:00'`
 * (PD-ARCH-01G-C, the kickoff time of a visual template).
 */
export function formatTime(iso: string, utcOffsetMinutes: number): string {
  const shifted = displayFields(iso, utcOffsetMinutes);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

/** A team name for display: the verified official name, exactly as given (R-052, R-426). */
export function teamDisplayName(officialName: string): string {
  return officialName;
}

/**
 * Hashtag-safe form of an official name (architecture.md section 8.2; R-426): `#` followed by the letters and digits
 * of the name (Unicode NFC) with spaces and punctuation removed and diacritics kept. Returns null when the name has no
 * letter or digit, so that no empty hashtag is ever produced.
 */
export function hashtagFor(officialName: string): string | null {
  const kept = Array.from(officialName.normalize('NFC'))
    .filter((character) => /[\p{L}\p{M}\p{N}]/u.test(character))
    .join('');
  return /[\p{L}\p{N}]/u.test(kept) ? `#${kept}` : null;
}

/**
 * Stage display text (provider-ports section 5): the stage name as the source gives it, followed by the language's
 * matchday word and number when the selection is a matchday, or the stage name alone for a whole stage.
 * `stageDisplay('Fase de liga', 3, 'es') === 'Fase de liga · Jornada 3'`.
 */
export function stageDisplay(stageName: string, matchday: number | null, language: Language): string {
  if (matchday === null) {
    return stageName;
  }
  assertSafeInteger(matchday, 'matchday');
  if (matchday < 1) {
    throw new RangeError('matchday must be positive');
  }
  return `${stageName} · ${templateText(language).matchdayWord} ${formatInt(matchday)}`;
}
