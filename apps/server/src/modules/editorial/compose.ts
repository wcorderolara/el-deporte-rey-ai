/**
 * Composition and deterministic checks of the editorial deliverables (PD-ARCH-01H, encargo sections 10 and 11). They
 * run after the writer answers and again on every operator edit; the writer saying that it checked is never enough.
 *
 * - Substitution: the writer's text is split at its placeholders like a slide (`substitute`): a known placeholder
 *   becomes the confirmed value, an unknown one stays visible and is flagged `UNKNOWN_FACT_REFERENCE`.
 * - Content checks of the content stage on the writer's text (`checkText`, `checkHashtags`): invisible characters,
 *   unknown placeholders, numbers outside placeholders (the editorial exemptions excepted), non-official team names,
 *   result claims about matches not played yet, URLs, mentions, markup.
 * - Editorial rules on the final text: word and character limits (`LENGTH_OUT_OF_RANGE`), hook in capital letters,
 *   questions with a question mark, three different viral headlines, five to eight hashtags (`FORMAT_RULE`); no claim
 *   that an unfinished round is over (`INCOMPLETE_ROUND_CLAIM`); no standings claim without standings
 *   (`STANDINGS_CLAIM_WITHOUT_DATA`); only event and evidence identifiers the request gave.
 * - Operator edits are final text: the confirmed display values found in it (team names, scores, dates, labels; not
 *   bare one- or two-digit numbers) are turned back into their placeholders, then the same checks run, so a number
 *   that is not a confirmed value is flagged as in the writer's text.
 */
import {
  EDITORIAL_DELIVERABLE_FIELDS,
  type EditorialDeliverable,
  type EditorialField,
  type EditorialFieldName,
  type EditorialFlag,
  type EditorialFlagCode,
} from '@edr/contracts';

import type { EditorialRequest, EditorialResponse } from '../../providers/ai/index.js';
import { RESPONSE_KEY } from '../../providers/ai/index.js';
import {
  type CheckedField,
  type PlaceholderBinding,
  checkHashtags,
  checkText,
  excerptOf,
  fieldText,
  foldWord,
  substitute,
} from '../content/index.js';

import { EDITORIAL_LIMITS, type EditorialCore } from './core.js';

/** Most flags stored for one version. */
export const MAX_EDITORIAL_FLAGS = 40;

/** The writer's text of a deliverable: field name → text (hashtags as a list). */
export type RawDeliverable = Readonly<Partial<Record<EditorialFieldName, string | readonly string[]>>>;

/** A composed version, ready to store. */
export interface ComposedVersion {
  readonly deliverable: EditorialDeliverable;
  readonly raw: RawDeliverable;
  readonly fields: readonly EditorialField[];
  readonly flags: readonly EditorialFlag[];
  readonly factIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

/** Words of a text: runs separated by white space that hold a letter or a digit. */
export function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

function characters(text: string): number {
  return Array.from(text).length;
}

/** The kind of content check a field gets (line-feed allowance as the content stage defines it). */
const CHECK_FIELD: Readonly<Record<EditorialFieldName, Exclude<CheckedField, 'hashtags'>>> = {
  headline: 'headline',
  body: 'caption',
  question: 'headline',
  hashtags: 'headline',
  copy: 'caption',
  headline_1: 'headline',
  headline_2: 'headline',
  headline_3: 'headline',
  title: 'headline',
  description: 'caption',
};

class Flags {
  readonly #flags: EditorialFlag[] = [];
  readonly #seen = new Set<string>();

  add(code: EditorialFlagCode, field: string, excerpt: string): void {
    const flag = { code, field, excerpt: excerptOf(excerpt) };
    const key = `${code}\u0000${field}\u0000${flag.excerpt}`;
    if (this.#seen.has(key) || this.#flags.length >= MAX_EDITORIAL_FLAGS) {
      return;
    }
    this.#seen.add(key);
    this.#flags.push(flag);
  }

  toArray(): EditorialFlag[] {
    return [...this.#flags];
  }
}

const PLACEHOLDER_TOKEN = /\{\{[^{}]{0,200}\}\}/gu;

/** The writer's own words of a text (placeholders removed). */
function commentaryOf(text: string): string {
  return text.replace(PLACEHOLDER_TOKEN, ' ');
}

/** Folded phrases that present an unfinished round as over. */
const ROUND_OVER_PHRASES: readonly string[] = [
  'jornada terminada',
  'jornada finalizada',
  'jornada concluida',
  'jornada completa',
  'jornada cerrada',
  'cierre de jornada',
  'cierre de la jornada',
  'termino la jornada',
  'acabo la jornada',
  'se cerro la jornada',
  'matchday is over',
  'end of the matchday',
  'completed matchday',
  'matchday ended',
  'matchday is complete',
].map(foldWord);

/** Folded words that state a standings position or consequence. */
const STANDINGS_WORDS: ReadonlySet<string> = new Set(
  [
    'lider',
    'lideres',
    'liderato',
    'colider',
    'sublider',
    'puntero',
    'punteros',
    'tabla',
    'clasificacion',
    'descenso',
    'sotanero',
    'colero',
    'clasificado',
    'clasificados',
    'eliminado',
    'eliminados',
    'campeon',
    'leader',
    'leaders',
    'standings',
    'table',
    'relegation',
    'relegated',
    'qualified',
    'eliminated',
    'champion',
  ].map(foldWord),
);

function foldedText(text: string): string {
  return ` ${foldWord(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function checkClaims(field: string, text: string, core: EditorialCore, flags: Flags): void {
  const folded = foldedText(commentaryOf(text));
  if (core.context.roundState.status !== 'complete') {
    for (const phrase of ROUND_OVER_PHRASES) {
      if (folded.includes(` ${phrase} `)) {
        flags.add('INCOMPLETE_ROUND_CLAIM', field, phrase);
      }
    }
  }
  if (!core.standingsAvailable) {
    for (const word of folded.trim().split(' ')) {
      if (STANDINGS_WORDS.has(word)) {
        flags.add('STANDINGS_CLAIM_WITHOUT_DATA', field, word);
      }
    }
  }
}

function checkLimit(field: string, value: number, min: number, max: number, unit: string, flags: Flags): void {
  if (value < min || value > max) {
    flags.add('LENGTH_OUT_OF_RANGE', field, `${String(value)} ${unit}; ${String(min)}-${String(max)}`);
  }
}

/** The editorial limits of one field's final text. */
function checkField(field: EditorialFieldName, final: string, flags: Flags): void {
  const limits = EDITORIAL_LIMITS;
  switch (field) {
    case 'headline':
      checkLimit(field, characters(final), 1, limits.headlineMaxChars, 'characters', flags);
      break;
    case 'body':
      checkLimit(field, countWords(final), limits.bodyMinWords, limits.bodyMaxWords, 'words', flags);
      break;
    case 'copy':
      checkLimit(field, countWords(final), 1, limits.shortCopyMaxWords, 'words', flags);
      break;
    case 'question':
      checkLimit(field, characters(final), 1, limits.questionMaxChars, 'characters', flags);
      if (!final.includes('?')) {
        flags.add('FORMAT_RULE', field, 'question without a question mark');
      }
      break;
    case 'headline_1':
    case 'headline_2':
    case 'headline_3':
      checkLimit(field, characters(final), 1, limits.viralHeadlineMaxChars, 'characters', flags);
      break;
    case 'title':
      checkLimit(field, characters(final), 1, limits.youtubeTitleMaxChars, 'characters', flags);
      break;
    case 'description':
      checkLimit(field, characters(final), 1, limits.youtubeDescriptionMaxChars, 'characters', flags);
      break;
    case 'hashtags':
      break;
  }
}

function asText(value: string | readonly string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Composes and checks one deliverable from raw text with placeholders. */
export function composeDeliverable(
  deliverable: EditorialDeliverable,
  raw: RawDeliverable,
  core: EditorialCore,
  references: { readonly eventIds: readonly string[]; readonly evidenceIds: readonly string[] },
): ComposedVersion {
  const flags = new Flags();
  const allowed = new Set(core.bindings.keys());
  const used: PlaceholderBinding[] = [];
  const fields: EditorialField[] = [];
  const finals = new Map<EditorialFieldName, string>();
  for (const name of EDITORIAL_DELIVERABLE_FIELDS[deliverable]) {
    if (name === 'hashtags') {
      const hashtags = Array.isArray(raw.hashtags) ? [...(raw.hashtags as readonly string[])] : [];
      for (const flag of checkHashtags(hashtags, core.checks)) {
        flags.add(flag.code, 'hashtags', flag.excerpt);
      }
      if (hashtags.length < EDITORIAL_LIMITS.minHashtags || hashtags.length > EDITORIAL_LIMITS.maxHashtags) {
        flags.add(
          'FORMAT_RULE',
          'hashtags',
          `${String(hashtags.length)} hashtags; ${String(EDITORIAL_LIMITS.minHashtags)}-${String(EDITORIAL_LIMITS.maxHashtags)}`,
        );
      }
      const text = hashtags.join(' ');
      fields.push({ name, text, words: hashtags.length, characters: characters(text) });
      continue;
    }
    const source = asText(raw[name]);
    if (source.trim() === '') {
      flags.add('FORMAT_RULE', name, 'empty field');
    }
    for (const flag of checkText(CHECK_FIELD[name], source, allowed, core.checks)) {
      flags.add(flag.code, name, flag.excerpt);
    }
    const { segments, used: bound } = substitute(source, core.bindings);
    used.push(...bound);
    const final = fieldText(segments);
    finals.set(name, final);
    checkField(name, final, flags);
    checkClaims(name, source, core, flags);
    if (name === 'headline' && deliverable === 'facebook_instagram') {
      const own = segments
        .filter((segment) => segment.provenance === 'commentary')
        .map((segment) => segment.text)
        .join('');
      if (/\p{Ll}/u.test(own)) {
        flags.add('FORMAT_RULE', name, 'hook not in capital letters');
      }
    }
    fields.push({ name, text: final, words: countWords(final), characters: characters(final) });
  }
  if (deliverable === 'viral_headlines') {
    const folded = ['headline_1', 'headline_2', 'headline_3'].map((name) =>
      foldWord(finals.get(name as EditorialFieldName) ?? '')
        .replace(/\s+/gu, ' ')
        .trim(),
    );
    if (new Set(folded).size !== folded.length) {
      flags.add('FORMAT_RULE', 'headline_1', 'the three headlines must be different');
    }
  }
  const knownEvents = new Set(core.keyEvents.map((event) => event.id));
  const knownEvidence = new Set([...core.evidence].map((item) => item.id));
  for (const id of references.eventIds) {
    if (!knownEvents.has(id)) {
      flags.add('UNKNOWN_EVENT_REFERENCE', 'references', id);
    }
  }
  for (const id of references.evidenceIds) {
    if (!knownEvidence.has(id)) {
      flags.add('UNKNOWN_EVIDENCE_REFERENCE', 'references', id);
    }
  }
  const eventIds = references.eventIds.filter((id) => knownEvents.has(id));
  const evidenceIds = references.evidenceIds.filter((id) => knownEvidence.has(id));
  const evidenceFacts = core.evidence.filter((item) => evidenceIds.includes(item.id)).flatMap((item) => item.factIds);
  const factIds = [
    ...new Set([...used.map((binding) => binding.factId).filter((id): id is string => id !== null), ...evidenceFacts]),
  ].sort();
  return { deliverable, raw, fields, flags: flags.toArray(), factIds, eventIds, evidenceIds };
}

/** The raw text of each requested deliverable of a writer response. */
export function rawDeliverables(
  request: EditorialRequest,
  response: EditorialResponse,
): Map<EditorialDeliverable, RawDeliverable> {
  const result = new Map<EditorialDeliverable, RawDeliverable>();
  for (const deliverable of request.deliverables) {
    const value = response[RESPONSE_KEY[deliverable]] as RawDeliverable | undefined;
    result.set(deliverable, value ?? {});
  }
  return result;
}

/**
 * Turns an operator's final text back into placeholders: every confirmed display value found in it (longest first;
 * bare numbers of one or two digits excepted, which stay numbers and are flagged) becomes its placeholder.
 */
export function retokenize(text: string, core: EditorialCore): string {
  const candidates = [...core.bindings.values()]
    .filter((binding) => binding.text !== '' && !/^\p{N}{1,2}$/u.test(binding.text))
    .sort((a, b) => b.text.length - a.text.length || a.placeholder.localeCompare(b.placeholder));
  let result = '';
  let position = 0;
  outer: while (position < text.length) {
    for (const binding of candidates) {
      if (text.startsWith(binding.text, position)) {
        const before = position === 0 ? '' : (text[position - 1] ?? '');
        const after = text[position + binding.text.length] ?? '';
        // Whole tokens only: "Municipal" inside "Municipalidad" is not the team.
        if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) {
          result += binding.placeholder;
          position += binding.text.length;
          continue outer;
        }
      }
    }
    result += text[position] ?? '';
    position += 1;
  }
  return result;
}

/** The raw deliverable of an operator edit (final text fields, hashtags split on white space). */
export function rawOfEdit(
  deliverable: EditorialDeliverable,
  edits: ReadonlyMap<EditorialFieldName, string>,
  current: readonly EditorialField[],
  core: EditorialCore,
): RawDeliverable {
  const raw: Partial<Record<EditorialFieldName, string | readonly string[]>> = {};
  for (const name of EDITORIAL_DELIVERABLE_FIELDS[deliverable]) {
    const text = edits.get(name) ?? current.find((field) => field.name === name)?.text ?? '';
    raw[name] = name === 'hashtags' ? text.split(/\s+/u).filter((tag) => tag !== '') : retokenize(text, core);
  }
  return raw;
}
