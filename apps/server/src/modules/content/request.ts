/**
 * Fact placeholders and the AI draft request (architecture.md section 8.2; contracts/provider-ports.md section 2;
 * AD-11; T10-F06; T11H-F16, V-13a).
 *
 * Each slide and the caption have a fact set: one placeholder per value they may mention, with its deterministic
 * display value from `platform/format`:
 * - `{{t:<teamId>}}` for a team name (the official name, or the candidate name of an unverified team);
 * - `{{f:m<n>:score}}`, `{{f:m<n>:kickoff}}` for the values of the n-th match of the draft, and
 *   `{{f:m<n>:result}}` for its result relation, a deterministic phrase computed from the score (the AI never
 *   derives a result; fixed template text states it on the slide, T10-F06);
 * - `{{f:row:<teamId>:position}}`, `{{f:row:<teamId>:points}}` for a standings row;
 * - `{{f:competition}}`, `{{f:stage}}`, `{{f:season}}` for the selection labels;
 * - for a match not played yet (PD-ARCH-01E-B), `{{f:m<n>:kickoff}}` and `{{f:m<n>:status}}` (the status label of the
 *   local status, never inferred from the date): a fixture has no score and no result placeholder.
 *
 * The request holds only these placeholders and display values, the slide keys and types (positional keys, never a
 * source or match key), the language, the brand name and handle and the limits. It never holds a source reference,
 * an attribution reference, import metadata, a data mode, a file path, a person or provider free text beyond the
 * validated names (T11H-F16, V-13a; R-232). The AI port validates it again with its strict schema before sending.
 */
import { type DraftFact, type DraftLimits, type DraftRequest, type DraftSlide } from '../../providers/ai/index.js';
import {
  type Language,
  formatDate,
  formatInt,
  formatScore,
  resultRelation,
  stageDisplay,
  templateText,
} from '../../platform/format/index.js';

import type { CarouselPlan, FixturePlan, MatchPlan, SlidePlan, StandingsRowPlan } from './structure.js';

/** Field limits of the AI text (code points). The text-fit check of visual QA re-measures the rendered text. */
export const DRAFT_LIMITS: Readonly<DraftLimits> = Object.freeze({
  headlineMaxChars: 80,
  descriptionMaxChars: 280,
  captionMaxChars: 2000,
  maxHashtags: 10,
});

/** What a placeholder is replaced with. */
export interface PlaceholderBinding {
  readonly placeholder: string;
  /** The `DraftFact.kind` shown to the AI. */
  readonly kind: string;
  /** The deterministic display text substituted for the placeholder. */
  readonly text: string;
  /** `fact` with the fact ID, or `template_text` for labels and the result relation phrase. */
  readonly provenance: 'fact' | 'template_text';
  readonly factId: string | null;
}

/** Labels and settings the placeholders and template text need. */
export interface DraftContext {
  readonly language: Language;
  readonly utcOffsetMinutes: number;
  readonly competitionName: string;
  readonly seasonLabel: string;
  readonly stageLabel: string;
  readonly matchday: number | null;
  readonly brand: { readonly name: string; readonly handle: string };
  /** Store the values a visual template draws independently (PD-ARCH-01G-D); false when absent. */
  readonly templateFields?: boolean;
  /** Calendar rows (PD-ARCH-01G-E.2): each overview line also stores the time and the status; false when absent. */
  readonly calendarRows?: boolean;
}

function fact(placeholder: string, kind: string, text: string, factId: string): PlaceholderBinding {
  return { placeholder, kind, text, provenance: 'fact', factId };
}

function label(placeholder: string, kind: string, text: string): PlaceholderBinding {
  return { placeholder, kind, text, provenance: 'template_text', factId: null };
}

/** `{{t:<teamId>}}`. */
export function teamPlaceholder(teamId: string): string {
  return `{{t:${teamId}}}`;
}

/** The result relation phrase of a score in the language (T10-F06). */
export function relationPhrase(score: { readonly home: number; readonly away: number }, language: Language): string {
  return templateText(language).resultRelation[resultRelation(score)];
}

/** The deterministic display of a kickoff in the language at the display offset. */
export function kickoffDisplay(kickoff: string, context: DraftContext): string {
  return formatDate(kickoff, context.language, context.utcOffsetMinutes);
}

/** The stage display text of the selection. */
export function selectionStageDisplay(context: DraftContext): string {
  return stageDisplay(context.stageLabel, context.matchday, context.language);
}

/** Bindings of the selection labels (cover and caption). */
export function labelBindings(context: DraftContext): PlaceholderBinding[] {
  return [
    label('{{f:competition}}', 'competition', context.competitionName),
    label('{{f:stage}}', 'stage', selectionStageDisplay(context)),
    label('{{f:season}}', 'season', context.seasonLabel),
  ];
}

/** Bindings of one match (match slide and caption). */
export function matchBindings(match: MatchPlan, context: DraftContext): PlaceholderBinding[] {
  const prefix = `m${String(match.index)}`;
  const bindings = [
    fact(teamPlaceholder(match.home.teamId), 'team', match.home.name, match.home.factId),
    fact(teamPlaceholder(match.away.teamId), 'team', match.away.name, match.away.factId),
    fact(`{{f:${prefix}:score}}`, 'score', formatScore(match.score), match.scoreFactId),
    label(`{{f:${prefix}:result}}`, 'result', relationPhrase(match.score, context.language)),
  ];
  if (match.kickoff !== null && match.kickoffFactId !== null) {
    bindings.push(fact(`{{f:${prefix}:kickoff}}`, 'date', kickoffDisplay(match.kickoff, context), match.kickoffFactId));
  }
  return bindings;
}

/** The status label of a match status in the language. */
export function statusDisplay(status: FixturePlan['status'], language: Language): string {
  return templateText(language).matchStatus[status];
}

/** Bindings of one match not played yet: its teams, kickoff and status (no score, no result). */
export function fixtureBindings(fixture: FixturePlan, context: DraftContext): PlaceholderBinding[] {
  const prefix = `m${String(fixture.index)}`;
  return [
    fact(teamPlaceholder(fixture.home.teamId), 'team', fixture.home.name, fixture.home.factId),
    fact(teamPlaceholder(fixture.away.teamId), 'team', fixture.away.name, fixture.away.factId),
    fact(`{{f:${prefix}:kickoff}}`, 'date', kickoffDisplay(fixture.kickoff, context), fixture.kickoffFactId),
    fact(`{{f:${prefix}:status}}`, 'status', statusDisplay(fixture.status, context.language), fixture.statusFactId),
  ];
}

/** Bindings of one standings row. */
export function rowBindings(row: StandingsRowPlan): PlaceholderBinding[] {
  const prefix = `row:${row.team.teamId}`;
  return [
    fact(teamPlaceholder(row.team.teamId), 'team', row.team.name, row.team.factId),
    fact(`{{f:${prefix}:position}}`, 'position', formatInt(row.value.position), row.factId),
    fact(`{{f:${prefix}:points}}`, 'points', formatInt(row.value.points), row.factId),
  ];
}

/** Keeps the first binding of each placeholder. */
function unique(bindings: readonly PlaceholderBinding[]): PlaceholderBinding[] {
  const seen = new Set<string>();
  return bindings.filter((binding) => {
    if (seen.has(binding.placeholder)) {
      return false;
    }
    seen.add(binding.placeholder);
    return true;
  });
}

/** The fact set of a slide. */
export function slideBindings(slide: SlidePlan, context: DraftContext): PlaceholderBinding[] {
  switch (slide.type) {
    case 'cover':
      return labelBindings(context);
    case 'match_result':
      return matchBindings(slide.match, context);
    case 'standings':
      return unique(slide.rows.flatMap(rowBindings));
    case 'closing':
      return [];
    case 'round_overview':
      return unique(slide.fixtures.flatMap((fixture) => fixtureBindings(fixture, context)));
    case 'fixture':
      return fixtureBindings(slide.fixture, context);
    case 'match_preview':
      return unique([...labelBindings(context), ...fixtureBindings(slide.fixture, context)]);
  }
}

/** The fact set of a carousel's caption: the selection labels and every match of the carousel. */
export function captionBindings(carousel: CarouselPlan, context: DraftContext): PlaceholderBinding[] {
  const matches = carousel.slides.flatMap((slide) =>
    slide.type === 'match_result'
      ? matchBindings(slide.match, context)
      : slide.type === 'fixture' || slide.type === 'match_preview'
        ? fixtureBindings(slide.fixture, context)
        : [],
  );
  return unique([...labelBindings(context), ...matches]);
}

function draftFacts(bindings: readonly PlaceholderBinding[]): DraftFact[] {
  return bindings.map((binding) => ({ placeholder: binding.placeholder, kind: binding.kind, display: binding.text }));
}

/**
 * The draft request of one carousel. `only` lists the slide keys to regenerate (absent: every slide, the caption and
 * the hashtags).
 */
export function buildDraftRequest(
  carousel: CarouselPlan,
  context: DraftContext,
  only?: readonly string[],
): DraftRequest {
  const slides: DraftSlide[] = carousel.slides.map((slide) => ({
    slideKey: slide.key,
    slideType: slide.type,
    facts: draftFacts(slideBindings(slide, context)),
  }));
  const request: DraftRequest = {
    language: context.language,
    brand: { name: context.brand.name, handle: context.brand.handle },
    limits: { ...DRAFT_LIMITS },
    slides,
    captionFacts: draftFacts(captionBindings(carousel, context)),
  };
  if (only !== undefined) {
    request.only = [...only];
  }
  return request;
}
