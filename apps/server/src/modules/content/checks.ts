/**
 * Deterministic content checks (architecture.md section 8.3; AD-11; T10-F05, T10-A1-05; R-207, R-237).
 *
 * They run on the AI-written text of every element version (headline, description, caption, hashtags), never on
 * template text or substituted fact values. A flagged version can be regenerated; it cannot be approved. Order:
 *
 * 1. `FORBIDDEN_CONTENT` pre-check, before every other rule: any control, format, surrogate or private-use
 *    character (`\p{Cc}`, `\p{Cf}`, `\p{Cs}`, `\p{Co}`: bidi controls, zero-width characters, tag characters, ...).
 *    The only exceptions (T10-A1-05) are:
 *    - U+000A LINE FEED, up to `LINE_FEED_LIMITS[field]` per field (none in headlines and hashtags);
 *    - U+200D ZERO WIDTH JOINER only inside an emoji sequence: the code point before it is an emoji
 *      (`\p{Extended_Pictographic}`), an emoji modifier or U+FE0F, and the code point after it is an emoji.
 *    Every other such character is flagged; the later rules then run on a copy without the flagged characters, so a
 *    figure split by invisible characters is also reported as a number.
 * 2. `UNKNOWN_FACT_REFERENCE`: a placeholder that is not in the element's fact set, or a stray `{` or `}`.
 * 3. `UNVERIFIED_NUMBER`, after removing the placeholders, on the text and on its NFKC-normalized copy: any `\p{N}`
 *    character (fullwidth, other-script, superscript, subscript, circled, Roman-numeral characters), and any cardinal,
 *    ordinal, multiplier or collective number word of Spanish or English (`words.ts`).
 * 4. `NON_OFFICIAL_TEAM_NAME`: a token with a letter outside the Latin script (mixed-script look-alikes such as a
 *    Cyrillic `\u0435`, and other-script words: the content languages are Latin-script); a token sequence whose folded
 *    form equals a folded official name but whose exact form differs (accent loss, case, fullwidth letters); any
 *    known alias (source name forms, identity-map aliases, translations, abbreviations) that is not the official
 *    name. Short single-word aliases (four letters or fewer) match only in their own letter case, so that a
 *    three-letter abbreviation does not match an ordinary lower-case word.
 * 5. `FORBIDDEN_CONTENT`: URLs and domain names, e-mail addresses, `@` mentions other than the configured brand
 *    handle, HTML or Markdown control sequences, and text over the field limit (`checkLength`, on the substituted
 *    text).
 *
 * Hashtags (architecture.md section 8.2): the exact hashtag-safe form of an official name (`hashtagFor`) is allowed;
 * every other hashtag must match `^#[\p{L}\p{N}_]{1,60}$` and pass the same checks.
 *
 * Excerpts show the offending text with invisible characters written as `[U+XXXX]`, at most 120 characters.
 */
import type { ContentFlag } from '@edr/contracts';

import { hashtagFor } from '../../platform/format/index.js';

import { findNumberWords, foldWord } from './words.js';

export type FlagCode = ContentFlag['code'];

/** The AI-written fields that the checks examine. */
export type CheckedField = 'headline' | 'description' | 'caption' | 'hashtags';

/** Line feeds allowed per field (T10-A1-05). */
export const LINE_FEED_LIMITS: Readonly<Record<CheckedField, number>> = Object.freeze({
  headline: 0,
  description: 2,
  caption: 20,
  hashtags: 0,
});

/** Most flags stored for one element version (identical flags are kept once). */
export const MAX_FLAGS_PER_VERSION = 40;

/** Longest excerpt (contract `ContentFlag.excerpt`). */
export const MAX_EXCERPT_LENGTH = 120;

/** Hashtags other than a team's hashtag-safe name (architecture.md section 8.2). */
export const HASHTAG_PATTERN = /^#[\p{L}\p{N}_]{1,60}$/u;

/** A team as the checks know it: the official (or candidate) name and every other known name form. */
export interface TeamNameRule {
  readonly teamId: string;
  readonly officialName: string;
  readonly aliases: readonly string[];
}

export interface CheckContext {
  /** The configured brand handle, the only `@` mention allowed. */
  readonly brandHandle: string;
  readonly teams: readonly TeamNameRule[];
}

const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u;
const INVISIBLE_GLOBAL = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/gu;
const LINE_FEED = '\n';
const ZERO_WIDTH_JOINER = '\u200D';
const EMOJI_BEFORE_JOINER = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}]$/u;
const EMOJI_AFTER_JOINER = /^\p{Extended_Pictographic}$/u;
const PLACEHOLDER_TOKEN = /\{\{[^{}]{0,200}\}\}/gu;
const NUMBER_CHARACTER = /\p{N}/u;
const LETTER = /\p{L}/u;
const LATIN = /\p{Script=Latin}/u;
const TOKEN = /[\p{L}\p{M}\p{N}]+/gu;

const URL_PATTERNS: readonly RegExp[] = [
  /[a-z][a-z0-9+.-]{0,30}:\/\//iu,
  /(^|[^\p{L}\p{N}])www\./iu,
  /(^|[^\p{L}\p{N}])(mailto|javascript|vbscript|data|file|tel|sms):/iu,
  /[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)*\.(com|net|org|info|biz|io|co|gt|es|mx|us|uk|tv|app|dev|ly|me|link|xyz|online|site|club|news|live|bet|top|ai|gg|ws|to)(?![\p{L}\p{N}])/iu,
];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/u;
const MENTION = /@[\p{L}\p{N}._]+/gu;
const MARKUP = /[<>`]|&[#a-z0-9]{1,32};|\*\*|__|~~|\]\(|!\[|^[ \t]{0,3}#{1,6}[ \t]|^[ \t]{0,3}>/imu;

// ---------------------------------------------------------------------------------------------------------------
// Flags and excerpts
// ---------------------------------------------------------------------------------------------------------------

/** The text with every invisible character written as `[U+XXXX]`. */
export function visible(text: string): string {
  return text.replace(
    INVISIBLE_GLOBAL,
    (character) => `[U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}]`,
  );
}

/** A printable excerpt of at most `MAX_EXCERPT_LENGTH` characters. */
export function excerptOf(text: string): string {
  let result = '';
  for (const character of visible(text)) {
    if (result.length + character.length > MAX_EXCERPT_LENGTH) {
      break;
    }
    result += character;
  }
  return result;
}

/** Collects flags, keeping each identical flag once and at most `MAX_FLAGS_PER_VERSION`. */
export class FlagList {
  readonly #flags: ContentFlag[] = [];
  readonly #seen = new Set<string>();

  add(code: FlagCode, field: string, text: string): void {
    const flag: ContentFlag = { code, field, excerpt: excerptOf(text) };
    const key = `${flag.code}\u0000${flag.field}\u0000${flag.excerpt}`;
    if (this.#seen.has(key) || this.#flags.length >= MAX_FLAGS_PER_VERSION) {
      return;
    }
    this.#seen.add(key);
    this.#flags.push(flag);
  }

  addAll(flags: readonly ContentFlag[]): void {
    for (const flag of flags) {
      this.add(flag.code, flag.field, flag.excerpt);
    }
  }

  toArray(): ContentFlag[] {
    return [...this.#flags];
  }
}

/** The run of non-space characters around `index` (for excerpts). */
function wordAround(text: string, index: number): string {
  let start = index;
  let end = index;
  while (start > 0 && !/\s/u.test(text[start - 1] ?? ' ')) {
    start -= 1;
  }
  while (end < text.length && !/\s/u.test(text[end] ?? ' ')) {
    end += 1;
  }
  return text.slice(start, Math.max(end, index + 1));
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Invisible characters (pre-check)
// ---------------------------------------------------------------------------------------------------------------

interface PreCheck {
  /** The text without the flagged invisible characters. */
  readonly cleaned: string;
}

function preCheck(field: CheckedField, text: string, flags: FlagList): PreCheck {
  const characters = Array.from(text);
  let lineFeeds = 0;
  let cleaned = '';
  characters.forEach((character, index) => {
    if (!INVISIBLE.test(character)) {
      cleaned += character;
      return;
    }
    if (character === LINE_FEED) {
      lineFeeds += 1;
      if (lineFeeds <= LINE_FEED_LIMITS[field]) {
        cleaned += character;
        return;
      }
      flags.add('FORBIDDEN_CONTENT', field, 'too many line breaks [U+000A]');
      cleaned += ' ';
      return;
    }
    if (
      character === ZERO_WIDTH_JOINER &&
      EMOJI_BEFORE_JOINER.test(characters[index - 1] ?? '') &&
      EMOJI_AFTER_JOINER.test(characters[index + 1] ?? '')
    ) {
      cleaned += character;
      return;
    }
    const before = characters.slice(Math.max(0, index - 12), index).join('');
    const after = characters.slice(index + 1, index + 13).join('');
    flags.add('FORBIDDEN_CONTENT', field, `${before}${character}${after}`);
  });
  return { cleaned };
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Numbers
// ---------------------------------------------------------------------------------------------------------------

function checkNumbers(field: CheckedField, text: string, flags: FlagList): void {
  for (const copy of [text, text.normalize('NFKC')]) {
    let index = 0;
    for (const character of copy) {
      if (NUMBER_CHARACTER.test(character)) {
        flags.add('UNVERIFIED_NUMBER', field, wordAround(copy, index));
      }
      index += character.length;
    }
  }
  for (const word of findNumberWords(text)) {
    flags.add('UNVERIFIED_NUMBER', field, word);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Team names and scripts
// ---------------------------------------------------------------------------------------------------------------

interface Token {
  readonly text: string;
  readonly folded: string;
  readonly start: number;
  readonly end: number;
}

/** Runs of letters, marks and digits with their offsets and folded forms. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN)) {
    tokens.push({ text: match[0], folded: foldWord(match[0]), start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/** True when the token has a letter outside the Latin script (the content languages are Latin-script). */
function hasNonLatinLetter(token: string): boolean {
  for (const character of token.normalize('NFKC')) {
    if (LETTER.test(character) && !LATIN.test(character)) {
      return true;
    }
  }
  return false;
}

/** Folded form that keeps the letter case (for short aliases). */
function foldKeepCase(value: string): string {
  return value.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '');
}

/** Start indexes in `tokens` where the folded `needle` tokens occur consecutively. */
function occurrences(tokens: readonly Token[], needle: readonly Token[]): number[] {
  const found: number[] = [];
  if (needle.length === 0) {
    return found;
  }
  for (let start = 0; start + needle.length <= tokens.length; start += 1) {
    if (needle.every((part, offset) => tokens[start + offset]?.folded === part.folded)) {
      found.push(start);
    }
  }
  return found;
}

function span(text: string, tokens: readonly Token[], start: number, length: number): string {
  const first = tokens[start];
  const last = tokens[start + length - 1];
  return first === undefined || last === undefined ? '' : text.slice(first.start, last.end);
}

function checkScripts(field: CheckedField, tokens: readonly Token[], flags: FlagList): void {
  for (const token of tokens) {
    if (hasNonLatinLetter(token.text)) {
      flags.add('NON_OFFICIAL_TEAM_NAME', field, token.text);
    }
  }
}

function checkTeamNames(field: CheckedField, text: string, teams: readonly TeamNameRule[], flags: FlagList): void {
  const tokens = tokenize(text);
  checkScripts(field, tokens, flags);
  for (const team of teams) {
    const official = team.officialName.normalize('NFC');
    const officialTokens = tokenize(official);
    const officialSpan = span(official, officialTokens, 0, officialTokens.length);
    for (const start of occurrences(tokens, officialTokens)) {
      const written = span(text, tokens, start, officialTokens.length);
      if (written.normalize('NFC') !== officialSpan) {
        flags.add('NON_OFFICIAL_TEAM_NAME', field, written);
      }
    }
    const officialFolded = officialTokens.map((token) => token.folded).join(' ');
    for (const alias of team.aliases) {
      const aliasTokens = tokenize(alias);
      if (
        alias.normalize('NFC') === official ||
        aliasTokens.map((token) => token.folded).join(' ') === officialFolded
      ) {
        continue;
      }
      const short = aliasTokens.length === 1 && (aliasTokens[0]?.folded.length ?? 0) <= 4;
      for (const start of occurrences(tokens, aliasTokens)) {
        const written = span(text, tokens, start, aliasTokens.length);
        if (short && foldKeepCase(written) !== foldKeepCase(aliasTokens[0]?.text ?? '')) {
          continue;
        }
        flags.add('NON_OFFICIAL_TEAM_NAME', field, written);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 5. Links, mentions and markup
// ---------------------------------------------------------------------------------------------------------------

function checkForbidden(field: CheckedField, text: string, brandHandle: string, flags: FlagList): void {
  const normalized = text.normalize('NFKC');
  for (const pattern of URL_PATTERNS) {
    const match = pattern.exec(normalized);
    if (match !== null) {
      flags.add('FORBIDDEN_CONTENT', field, wordAround(normalized, match.index + (match[1]?.length ?? 0)));
    }
  }
  const email = EMAIL.exec(normalized);
  if (email !== null) {
    flags.add('FORBIDDEN_CONTENT', field, email[0]);
  }
  const handle = brandHandle.toLowerCase();
  for (const mention of normalized.matchAll(MENTION)) {
    if (mention[0].toLowerCase() !== handle) {
      flags.add('FORBIDDEN_CONTENT', field, mention[0]);
    }
  }
  const markup = MARKUP.exec(normalized);
  if (markup !== null) {
    flags.add('FORBIDDEN_CONTENT', field, wordAround(normalized, markup.index));
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------------------------

/**
 * Checks one AI-written text field. `allowedPlaceholders` is the element's fact set (the placeholders of the slide,
 * or of the caption).
 */
export function checkText(
  field: Exclude<CheckedField, 'hashtags'>,
  text: string,
  allowedPlaceholders: ReadonlySet<string>,
  context: CheckContext,
): ContentFlag[] {
  const flags = new FlagList();
  const { cleaned } = preCheck(field, text, flags);

  for (const match of cleaned.matchAll(PLACEHOLDER_TOKEN)) {
    if (!allowedPlaceholders.has(match[0])) {
      flags.add('UNKNOWN_FACT_REFERENCE', field, match[0]);
    }
  }
  const stripped = cleaned.replace(PLACEHOLDER_TOKEN, ' ');
  const brace = /[{}]/u.exec(stripped);
  if (brace !== null) {
    flags.add('UNKNOWN_FACT_REFERENCE', field, wordAround(stripped, brace.index));
  }

  checkNumbers(field, stripped, flags);
  checkTeamNames(field, stripped, context.teams, flags);
  checkForbidden(field, stripped, context.brandHandle, flags);
  return flags.toArray();
}

/** The letters and digits of a name or hashtag, folded (for comparing hashtags with names). */
function compactFolded(value: string): string {
  return foldWord(value).replace(/[^\p{L}\p{N}]/gu, '');
}

/** Checks the AI-written hashtags. */
export function checkHashtags(hashtags: readonly string[], context: CheckContext): ContentFlag[] {
  const flags = new FlagList();
  const teamHashtags = new Set(
    context.teams.map((team) => hashtagFor(team.officialName)).filter((tag): tag is string => tag !== null),
  );
  for (const hashtag of hashtags) {
    const { cleaned } = preCheck('hashtags', hashtag, flags);
    if (teamHashtags.has(hashtag)) {
      continue;
    }
    if (!HASHTAG_PATTERN.test(hashtag)) {
      flags.add('FORBIDDEN_CONTENT', 'hashtags', hashtag);
    }
    const body = cleaned.replace(/^#/u, '');
    checkNumbers('hashtags', body, flags);
    checkScripts('hashtags', tokenize(body), flags);
    const compact = compactFolded(body);
    for (const team of context.teams) {
      const forms = [team.officialName, ...team.aliases].map(compactFolded);
      if (compact !== '' && forms.includes(compact)) {
        flags.add('NON_OFFICIAL_TEAM_NAME', 'hashtags', hashtag);
      }
    }
  }
  return flags.toArray();
}

/** Flags a field whose final (substituted) text is longer than its limit, in code points. */
export function checkLength(field: CheckedField, text: string, limit: number): ContentFlag[] {
  return Array.from(text).length > limit
    ? [{ code: 'FORBIDDEN_CONTENT', field, excerpt: excerptOf(`text over the field limit of ${String(limit)}`) }]
    : [];
}
