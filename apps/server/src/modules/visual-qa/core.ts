/**
 * Pure core of visual QA (architecture.md section 10; AD-12; OD-09, OD-26, OD-38, OD-49; R-214, R-237, R-238,
 * R-285). Deterministic checks on the stored render model, the stored text and the PNG header size; no OCR, no AI,
 * no database access and no file I/O, so the tests call it with synthetic inputs in isolation (R-225).
 *
 * Checks of a slide version (severity per OD-09; every check gives one result, `pass` or `fail`):
 * - `data_match` (blocking): every fact-bearing text element (score, kickoff, standings position and cells) equals the
 *   deterministic display form (`platform/format`) of its fact's verified value, or of its candidate value when the
 *   fact is unverified (T11G). Standings rows are compared as the content stage stores them (OD-49, T32 risk 3): the
 *   row's position and number cells against `standingRowCells` of the row fact, in column order. The match-result
 *   title must state the result relation of the score fact (T10-F06). Every fact segment of a template field must be
 *   drawn. In the AI fields, the drawn text must be the stored text, and every substituted fact segment must be a
 *   display form of its fact (a standings placeholder holds the single position or points value, OD-49).
 * - `team_names` (blocking): every team-name element (match teams, standings teams) is exactly the official name of
 *   its team-name fact (the verified official name, or the candidate name of an unverified team), and so is every
 *   team-name fact segment of the AI fields; the AI-written text has no non-official variant of a team name
 *   (translation, abbreviation, accent loss, known alias, mixed-script look-alike), detected with the content
 *   module's name rules (R-237). Template text (titles, the demonstration band, headings) is not examined.
 * - `text_fit` (blocking): every text element is re-measured with the rendering module's `layoutText` and the same
 *   bundled face at the stored font size and box (measurement without kerning on both sides, T34 risk 2); it fails
 *   when the render model flags an overflow, the re-measured layout overflows or differs from the stored lines, the
 *   lines exceed the box height, or the box leaves the canvas.
 * - `style_consistency` (warning): colours outside the configured palette, fonts outside the configured font roles or
 *   the bundled files, and versions of the same template differing within the carousel.
 * - `dimensions` (blocking): the PNG width and height read from the file header equal the configured format.
 * - `capitalized_tokens` (warning; OD-26, OD-38): capitalized tokens of the AI-written (commentary) text that are not
 *   part of a verified team name, a selection label (competition, stage, season), a brand term or the language word
 *   list: possible person names (T11H-F17 residual).
 *
 * The caption element has no image: its QA is the content checks (architecture.md section 10), plus
 * `capitalized_tokens` on its caption and hashtags (OD-26 applies to every AI draft).
 */
import { type Language, QA_CHECKS, type QaCheck, type QaMismatch, type QaResult, QaResultSchema } from '@edr/contracts';

import {
  formatDate,
  formatInt,
  formatScore,
  hashtagFor,
  resultRelation,
  templateText,
} from '../../platform/format/index.js';
import {
  type ContentFact,
  type Segment,
  type TeamNameRule,
  FactIndex,
  checkContextOf,
  checkText,
  foldWord,
  standingRowCells,
} from '../content/index.js';
import {
  BUNDLED_FONT_FILES,
  type FontSet,
  type RenderModel,
  type TextElement,
  layoutText,
} from '../rendering/index.js';

import type {
  CarouselTemplate,
  QaLabels,
  QaSettings,
  QaStatus,
  VersionResult,
  VersionToCheck,
  VisualQaInput,
  VisualQaOutput,
} from './schemas.js';
import { LANGUAGE_WORDS } from './words.js';

/** Contract limits of the result details (QaMismatch, text_fit, style_consistency, capitalized_tokens). */
export const DETAIL_LIMITS = Object.freeze({
  elementId: 64,
  mismatchText: 200,
  name: 64,
  token: 64,
  /** Most mismatches kept per check (the outcome is `fail` either way). */
  mismatches: 200,
  /** Most tokens kept by `capitalized_tokens`. */
  tokens: 50,
});

/** Text elements that show a fact value compared by `data_match`. */
const VALUE_SEMANTICS: ReadonlySet<TextElement['semantic']> = new Set([
  'score',
  'kickoff',
  'standings_position',
  'standings_cell',
]);

/** The AI-written fields of a slide (content module `aiField`). */
const SLIDE_AI_FIELDS = ['headline', 'description'] as const;

/** The AI-written fields of a caption element. */
const CAPTION_AI_FIELDS = ['caption', 'hashtags'] as const;

/** Runs of letters, marks and digits (the content checks' token definition). */
const TOKEN = /[\p{L}\p{M}\p{N}]+/gu;
const CAPITALIZED = /^[\p{Lu}\p{Lt}]/u;

/** Half a pixel of tolerance for rounding of boxes and line heights (as the template builder applies). */
const PIXEL_TOLERANCE = 0.5;

// ---------------------------------------------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------------------------------------------

/** A team as the name checks know it: the content module's rule plus the fact of its name. */
export interface TeamRule extends TeamNameRule {
  readonly factId: string | null;
}

/** Everything the checks read besides the version itself. */
export interface QaContext {
  readonly language: Language;
  readonly settings: QaSettings;
  readonly facts: ReadonlyMap<string, ContentFact>;
  readonly teams: readonly TeamRule[];
  readonly fonts: FontSet;
  /** Folded tokens `capitalized_tokens` accepts: the word list, verified team names, labels and brand terms. */
  readonly allowedTokens: ReadonlySet<string>;
  /** The hashtag-safe forms of the verified team names (accepted whole as hashtags). */
  readonly verifiedHashtags: ReadonlySet<string>;
  readonly carouselTemplates: readonly CarouselTemplate[];
}

function foldedTokens(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((match) => foldWord(match[0]));
}

/** The folded tokens that `capitalized_tokens` accepts (see the module notes). */
export function allowedTokensOf(
  facts: readonly ContentFact[],
  labels: QaLabels,
  brand: QaSettings['brand'],
): Set<string> {
  const allowed = new Set(LANGUAGE_WORDS);
  const add = (text: string | null): void => {
    for (const token of text === null ? [] : foldedTokens(text)) {
      allowed.add(token);
    }
  };
  for (const name of verifiedTeamNames(facts)) {
    add(name);
  }
  add(labels.competitionName);
  add(labels.stageLabel);
  add(labels.seasonLabel);
  add(brand.name);
  add(brand.handle.replace(/^@/u, ''));
  add(brand.mascotName);
  return allowed;
}

/** The official names of the team-name facts that are verified (a verified value; R-052, OD-12). */
function verifiedTeamNames(facts: readonly ContentFact[]): string[] {
  return facts.flatMap((fact) =>
    fact.kind === 'team_official_name' && fact.status === 'verified' && fact.value !== null
      ? [fact.value.officialName]
      : [],
  );
}

/** Builds the check context of a stage input. */
export function qaContext(input: VisualQaInput, fonts: FontSet): QaContext {
  const index = new FactIndex(input.facts);
  const teams = checkContextOf(index, input.teamAliases, input.settings.brand.handle).teams.map((rule) => ({
    ...rule,
    factId: index.teamName(rule.teamId)?.factId ?? null,
  }));
  const verifiedHashtags = new Set(
    verifiedTeamNames(input.facts)
      .map(hashtagFor)
      .filter((tag): tag is string => tag !== null),
  );
  return {
    language: input.language,
    settings: input.settings,
    facts: new Map(input.facts.map((fact) => [fact.id, fact])),
    teams,
    fonts,
    allowedTokens: allowedTokensOf(input.facts, input.labels, input.settings.brand),
    verifiedHashtags,
    carouselTemplates: input.carouselTemplates,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

/** The text cut at a code-point boundary to at most `max` UTF-16 units (the contract `maxLength`). */
export function clip(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  let result = '';
  for (const character of text) {
    if (result.length + character.length > max) {
      break;
    }
    result += character;
  }
  return result;
}

type FactOf<K extends ContentFact['kind']> = Extract<ContentFact, { kind: K }>;

/** The verified value of a fact of the given kind, else its candidate value; null otherwise (T11G). */
function usableValue<K extends ContentFact['kind']>(
  fact: ContentFact | undefined,
  kind: K,
): NonNullable<FactOf<K>['value']> | null {
  if (fact?.kind !== kind) {
    return null;
  }
  const typed = fact as FactOf<K>;
  return (typed.value ?? typed.candidateValue ?? null) as NonNullable<FactOf<K>['value']> | null;
}

function textElements(model: RenderModel): TextElement[] {
  return model.elements.filter((element): element is TextElement => element.kind === 'text');
}

function segmentsOf(version: VersionToCheck, field: string): readonly Segment[] {
  return version.text.fields.find((candidate) => candidate.field === field)?.segments ?? [];
}

/** The AI-written text of a field with every substituted segment replaced by a space (as the content checks see it). */
function aiTextOf(segments: readonly Segment[]): string {
  return segments.map((segment) => (segment.provenance === 'commentary' ? segment.text : ' ')).join('');
}

class Mismatches {
  readonly items: QaMismatch[] = [];

  add(elementId: string, factId: string | null, expected: string, actual: string): void {
    if (this.items.length >= DETAIL_LIMITS.mismatches) {
      return;
    }
    this.items.push({
      elementId: clip(elementId, DETAIL_LIMITS.elementId),
      factId,
      expected: clip(expected, DETAIL_LIMITS.mismatchText),
      actual: clip(actual, DETAIL_LIMITS.mismatchText),
    });
  }
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
}

// ---------------------------------------------------------------------------------------------------------------
// data_match
// ---------------------------------------------------------------------------------------------------------------

/** Display form of a value element's fact for the element's semantic; null when the fact cannot give it. */
function valueDisplay(semantic: 'score' | 'kickoff', fact: ContentFact | undefined, ctx: QaContext): string | null {
  if (semantic === 'score') {
    const score = usableValue(fact, 'match_score');
    return score === null ? null : formatScore(score);
  }
  const kickoff = usableValue(fact, 'match_kickoff');
  return kickoff === null ? null : formatDate(kickoff.kickoff, ctx.language, ctx.settings.utcOffsetMinutes);
}

/** Display forms a substituted fact segment of an AI field may hold (content module placeholder bindings). */
function segmentDisplays(fact: ContentFact | undefined, ctx: QaContext): string[] {
  switch (fact?.kind) {
    case 'match_score':
    case 'match_kickoff': {
      const display = valueDisplay(fact.kind === 'match_score' ? 'score' : 'kickoff', fact, ctx);
      return display === null ? [] : [display];
    }
    case 'standing_row': {
      // `{{f:row:<teamId>:position}}` and `{{f:row:<teamId>:points}}` hold single values (OD-49).
      const row = usableValue(fact, 'standing_row');
      return row === null ? [] : [formatInt(row.position), formatInt(row.points)];
    }
    default:
      return [];
  }
}

/** Compares the position and number cells of each standings row with `standingRowCells` of its fact (OD-49). */
function checkStandingsRows(rows: ReadonlyMap<string, TextElement[]>, ctx: QaContext, mismatches: Mismatches): void {
  for (const [factId, elements] of rows) {
    const row = usableValue(ctx.facts.get(factId), 'standing_row');
    const ordered = [
      ...elements.filter((element) => element.semantic === 'standings_position'),
      ...elements.filter((element) => element.semantic === 'standings_cell'),
    ];
    if (row === null) {
      for (const element of ordered) {
        mismatches.add(element.id, factId, '', element.text);
      }
      continue;
    }
    const cells = standingRowCells(row);
    for (let index = 0; index < Math.max(cells.length, ordered.length); index += 1) {
      const element = ordered[index];
      const expected = cells[index] ?? '';
      if (element?.text !== expected) {
        mismatches.add(element?.id ?? 'standings', factId, expected, element?.text ?? '');
      }
    }
  }
}

/** The match-result title states the deterministic result relation of the score fact (T10-F06). */
function checkResultTitle(texts: readonly TextElement[], ctx: QaContext, mismatches: Mismatches): void {
  const scoreElement = texts.find((element) => element.semantic === 'score');
  const scoreFactId = scoreElement?.factIds.length === 1 ? (scoreElement.factIds[0] ?? null) : null;
  const score = scoreFactId === null ? null : usableValue(ctx.facts.get(scoreFactId), 'match_score');
  if (score === null) {
    return;
  }
  const words = templateText(ctx.language);
  const expected = `${words.resultTitle} · ${words.resultRelation[resultRelation(score)]}`;
  const title = texts.find((element) => element.semantic === 'title');
  if (title?.text !== expected) {
    mismatches.add(title?.id ?? 'title', scoreFactId, expected, title?.text ?? '');
  }
}

export function dataMatch(version: VersionToCheck, model: RenderModel, ctx: QaContext): QaResult {
  const mismatches = new Mismatches();
  const texts = textElements(model);
  const rows = new Map<string, TextElement[]>();

  for (const element of texts) {
    if (!VALUE_SEMANTICS.has(element.semantic)) {
      continue;
    }
    const [factId] = element.factIds;
    if (factId === undefined || element.factIds.length !== 1) {
      // A value that cannot be attributed to exactly one fact is never a verified display (AD-07).
      mismatches.add(element.id, factId ?? null, '', element.text);
      continue;
    }
    if (element.semantic === 'standings_position' || element.semantic === 'standings_cell') {
      rows.set(factId, [...(rows.get(factId) ?? []), element]);
      continue;
    }
    const expected = valueDisplay(element.semantic === 'score' ? 'score' : 'kickoff', ctx.facts.get(factId), ctx);
    if (expected === null || element.text !== expected) {
      mismatches.add(element.id, factId, expected ?? '', element.text);
    }
  }
  checkStandingsRows(rows, ctx, mismatches);
  if (model.slideType === 'match_result') {
    checkResultTitle(texts, ctx, mismatches);
  }

  // Every fact segment of a template field is drawn by some text element.
  const drawn = new Set(texts.flatMap((element) => element.factIds));
  for (const field of version.text.fields) {
    if ((SLIDE_AI_FIELDS as readonly string[]).includes(field.field)) {
      continue;
    }
    for (const segment of field.segments) {
      if (segment.factId !== null && !drawn.has(segment.factId)) {
        mismatches.add(field.field, segment.factId, segment.text, '');
      }
    }
  }

  // AI fields: the drawn text is the stored text, and every substituted value is a display form of its fact.
  for (const field of SLIDE_AI_FIELDS) {
    const segments = segmentsOf(version, field);
    const stored = segments.map((segment) => segment.text).join('');
    const element = texts.find((candidate) => candidate.field === field);
    if (stored.trim() !== '' && element?.text !== stored) {
      mismatches.add(element?.id ?? field, null, stored, element?.text ?? '');
    }
    for (const segment of segments) {
      if (segment.provenance !== 'fact' || segment.factId === null) {
        continue;
      }
      const fact = ctx.facts.get(segment.factId);
      if (fact?.kind === 'team_official_name') {
        continue; // checked by team_names
      }
      const displays = segmentDisplays(fact, ctx);
      if (!displays.includes(segment.text)) {
        mismatches.add(element?.id ?? field, segment.factId, displays[0] ?? '', segment.text);
      }
    }
  }
  return result('data_match', mismatches.items.length === 0, { mismatches: mismatches.items });
}

// ---------------------------------------------------------------------------------------------------------------
// team_names
// ---------------------------------------------------------------------------------------------------------------

/** The official name of a team-name fact (verified, else candidate); null when it has none. */
function officialName(fact: ContentFact | undefined): string | null {
  return usableValue(fact, 'team_official_name')?.officialName ?? null;
}

const NO_PLACEHOLDERS: ReadonlySet<string> = new Set();

function nameFlags(field: 'headline' | 'description', text: string, teams: readonly TeamNameRule[], handle: string) {
  return checkText(field, text, NO_PLACEHOLDERS, { brandHandle: handle, teams })
    .filter((flag) => flag.code === 'NON_OFFICIAL_TEAM_NAME')
    .map((flag) => flag.excerpt);
}

/** Non-official name forms in AI-written text, with the team they stand for (null: a mixed-script token). */
function nameVariants(
  field: 'headline' | 'description',
  text: string,
  ctx: QaContext,
): { readonly team: TeamRule | null; readonly written: string }[] {
  if (text.trim() === '') {
    return [];
  }
  const handle = ctx.settings.brand.handle;
  const scriptOnly = new Set(nameFlags(field, text, [], handle));
  const variants: { team: TeamRule | null; written: string }[] = [...scriptOnly].map((written) => ({
    team: null,
    written,
  }));
  for (const team of ctx.teams) {
    for (const written of nameFlags(field, text, [team], handle)) {
      if (!scriptOnly.has(written)) {
        variants.push({ team, written });
      }
    }
  }
  return variants;
}

export function teamNames(version: VersionToCheck, model: RenderModel, ctx: QaContext): QaResult {
  const mismatches = new Mismatches();
  for (const element of textElements(model)) {
    if (element.semantic !== 'team_name') {
      continue;
    }
    const [factId] = element.factIds;
    const expected = factId === undefined || element.factIds.length !== 1 ? null : officialName(ctx.facts.get(factId));
    if (expected === null || element.text !== expected) {
      mismatches.add(element.id, factId ?? null, expected ?? '', element.text);
    }
  }
  for (const field of SLIDE_AI_FIELDS) {
    const segments = segmentsOf(version, field);
    const elementId = textElements(model).find((candidate) => candidate.field === field)?.id ?? field;
    for (const segment of segments) {
      const fact = segment.factId === null ? undefined : ctx.facts.get(segment.factId);
      if (segment.provenance !== 'fact' || fact?.kind !== 'team_official_name') {
        continue;
      }
      const expected = officialName(fact);
      if (expected === null || segment.text !== expected) {
        mismatches.add(elementId, segment.factId, expected ?? '', segment.text);
      }
    }
    for (const variant of nameVariants(field, aiTextOf(segments), ctx)) {
      mismatches.add(elementId, variant.team?.factId ?? null, variant.team?.officialName ?? '', variant.written);
    }
  }
  return result('team_names', mismatches.items.length === 0, { mismatches: mismatches.items });
}

// ---------------------------------------------------------------------------------------------------------------
// text_fit
// ---------------------------------------------------------------------------------------------------------------

/** True when the element's text fits its box as re-measured (see the module notes). */
export function fitsBox(element: TextElement, canvas: RenderModel['canvas'], fonts: FontSet): boolean {
  if (element.overflow) {
    return false;
  }
  const face = fonts.faces.find(
    (candidate) => candidate.family === element.fontFamily && candidate.weight === element.fontWeight,
  );
  if (face === undefined) {
    return false; // not measurable with a bundled face: not shown to fit
  }
  const layout = layoutText(element.text, face.font, element.fontSize, element.box.width, element.maxLines);
  if (
    layout.overflow ||
    layout.lines.length !== element.lines.length ||
    layout.lines.some((line, index) => line !== element.lines[index])
  ) {
    return false;
  }
  const { box } = element;
  return (
    element.lines.length * element.lineHeight <= box.height + PIXEL_TOLERANCE &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= canvas.width + PIXEL_TOLERANCE &&
    box.y + box.height <= canvas.height + PIXEL_TOLERANCE
  );
}

export function textFit(model: RenderModel, ctx: QaContext): QaResult {
  const overflowing = textElements(model)
    .filter((element) => !fitsBox(element, model.canvas, ctx.fonts))
    .map((element) => clip(element.id, DETAIL_LIMITS.elementId));
  return result('text_fit', overflowing.length === 0, { overflowingElements: overflowing });
}

// ---------------------------------------------------------------------------------------------------------------
// style_consistency
// ---------------------------------------------------------------------------------------------------------------

function fontName(family: string, weight: number): string {
  return clip(`${family} ${String(weight)}`, DETAIL_LIMITS.name);
}

export function styleConsistency(version: VersionToCheck, model: RenderModel, ctx: QaContext): QaResult {
  const palette = new Set(Object.values(ctx.settings.palette).map((colour) => colour.toLowerCase()));
  const colours = [model.background.color, ...Object.values(model.palette)];
  for (const element of model.elements) {
    if (element.kind === 'text' || element.kind === 'rect') {
      colours.push(element.color);
    }
  }
  const colorsOutsidePalette = sortedUnique(
    colours.map((colour) => colour.toLowerCase()).filter((colour) => !palette.has(colour)),
  );

  const fonts: string[] = [];
  for (const font of model.fonts) {
    const configured = ctx.settings.fonts[font.role];
    const bundled = BUNDLED_FONT_FILES.find((entry) => entry.family === font.family && entry.weight === font.weight);
    if (
      configured.family !== font.family ||
      configured.weight !== font.weight ||
      bundled?.file !== font.file ||
      bundled.sha256 !== font.sha256
    ) {
      fonts.push(fontName(font.family, font.weight));
    }
  }
  for (const element of textElements(model)) {
    const configured = ctx.settings.fonts[element.fontRole];
    if (configured.family !== element.fontFamily || configured.weight !== element.fontWeight) {
      fonts.push(fontName(element.fontFamily, element.fontWeight));
    }
  }
  const fontsOutsideSet = sortedUnique(fonts);

  // Versions of the same template within the carousel (a template change applies to new versions only, R-211).
  const versions = new Set([model.templateVersion]);
  for (const template of ctx.carouselTemplates) {
    if (template.carouselId === version.carouselId && template.templateId === model.templateId) {
      versions.add(template.templateVersion);
    }
  }
  const templateVersions =
    versions.size > 1
      ? sortedUnique([...versions].map((value) => clip(`${model.templateId}@${value}`, DETAIL_LIMITS.name)))
      : [];

  return result(
    'style_consistency',
    colorsOutsidePalette.length === 0 && fontsOutsideSet.length === 0 && templateVersions.length === 0,
    { colorsOutsidePalette, fontsOutsideSet, templateVersions },
  );
}

// ---------------------------------------------------------------------------------------------------------------
// dimensions
// ---------------------------------------------------------------------------------------------------------------

export function dimensions(version: VersionToCheck, ctx: QaContext): QaResult {
  const actual = version.image ?? { width: 0, height: 0 };
  const { width, height } = ctx.settings;
  return result('dimensions', actual.width === width && actual.height === height, {
    expectedWidth: width,
    expectedHeight: height,
    actualWidth: actual.width,
    actualHeight: actual.height,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// capitalized_tokens
// ---------------------------------------------------------------------------------------------------------------

/** The capitalized tokens of the version's AI-written text that no allowed source accounts for (OD-26). */
export function capitalizedTokensOf(version: VersionToCheck, ctx: QaContext): string[] {
  const fields: readonly string[] = version.kind === 'caption' ? CAPTION_AI_FIELDS : SLIDE_AI_FIELDS;
  const tokens: string[] = [];
  for (const field of fields) {
    for (const segment of segmentsOf(version, field)) {
      if (segment.provenance !== 'commentary') {
        continue;
      }
      if (field === 'hashtags' && ctx.verifiedHashtags.has(segment.text.trim())) {
        continue;
      }
      for (const match of segment.text.matchAll(TOKEN)) {
        const token = match[0];
        if (CAPITALIZED.test(token) && !ctx.allowedTokens.has(foldWord(token))) {
          tokens.push(clip(token, DETAIL_LIMITS.token));
        }
      }
    }
  }
  return [...new Set(tokens)].slice(0, DETAIL_LIMITS.tokens);
}

export function capitalizedTokens(version: VersionToCheck, ctx: QaContext): QaResult {
  const tokens = capitalizedTokensOf(version, ctx);
  return result('capitalized_tokens', tokens.length === 0, { tokens });
}

// ---------------------------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------------------------

/** Severity of each check (OD-09, OD-26). */
export const CHECK_SEVERITY: Readonly<Record<QaCheck, 'blocking' | 'warning'>> = Object.freeze({
  data_match: 'blocking',
  team_names: 'blocking',
  text_fit: 'blocking',
  style_consistency: 'warning',
  dimensions: 'blocking',
  capitalized_tokens: 'warning',
});

/** A closed contract result (T10-F17): validated, never acknowledged when produced. */
function result(check: QaCheck, passed: boolean, details: unknown): QaResult {
  return QaResultSchema.parse({
    check,
    outcome: passed ? 'pass' : 'fail',
    severity: CHECK_SEVERITY[check],
    details,
    acknowledgedAt: null,
  });
}

/** `qa_status`: failed on a blocking failure, warnings on a warning failure only, passed otherwise (OD-09). */
export function qaStatusOf(results: readonly QaResult[]): QaStatus {
  const failed = results.filter((item) => item.outcome === 'fail');
  if (failed.some((item) => item.severity === 'blocking')) {
    return 'failed';
  }
  return failed.length > 0 ? 'warnings' : 'passed';
}

/** Runs the enabled checks on one element version. */
export function checkVersion(
  version: VersionToCheck,
  ctx: QaContext,
  enabled: ReadonlySet<QaCheck> = new Set(QA_CHECKS),
): VersionResult {
  const results: QaResult[] = [];
  const run = (check: QaCheck, produce: () => QaResult): void => {
    if (enabled.has(check)) {
      results.push(produce());
    }
  };
  const model = version.renderModel;
  if (version.kind === 'slide' && model !== null) {
    run('data_match', () => dataMatch(version, model, ctx));
    run('team_names', () => teamNames(version, model, ctx));
    run('text_fit', () => textFit(model, ctx));
    run('style_consistency', () => styleConsistency(version, model, ctx));
    run('dimensions', () => dimensions(version, ctx));
  }
  run('capitalized_tokens', () => capitalizedTokens(version, ctx));
  return { versionId: version.versionId, qaStatus: qaStatusOf(results), results };
}

/** The pure core of the stage: every version of the input checked with the checks the database accepts. */
export function runVisualQa(input: VisualQaInput, fonts: FontSet): VisualQaOutput {
  const ctx = qaContext(input, fonts);
  const enabled = new Set(input.checks);
  return {
    projectId: input.projectId,
    versions: input.versions.map((version) => checkVersion(version, ctx, enabled)),
  };
}
