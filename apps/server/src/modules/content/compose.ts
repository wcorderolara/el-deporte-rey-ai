/**
 * Deterministic substitution and element composition (architecture.md sections 8.2 and 8.3; AD-11; OD-01, R-028,
 * R-208).
 *
 * - The AI text of a field is split at its placeholders; each known placeholder becomes a `fact` segment (the
 *   deterministic display of the fact's verified or candidate value, with the fact ID) or a `template_text` segment
 *   (selection labels, the result relation phrase); the AI text between them becomes `commentary` segments. An
 *   unknown placeholder stays visible as commentary and is flagged `UNKNOWN_FACT_REFERENCE`.
 * - Template fields (titles, team names, score, kickoff, standings rows) are built from the facts only; they never
 *   pass through the AI.
 * - The content checks run on the AI text of every field; the field limit is checked on the substituted text.
 * - The fact references of the version are the facts its template fields show (`template`) and the facts its
 *   placeholders substituted (`placeholder`); a fact used both ways is recorded once as `template`.
 */
import type { ContentFlag } from '@edr/contracts';

import { formatInt, formatScore, formatTime, templateText } from '../../platform/format/index.js';

import { type CheckContext, FlagList, checkHashtags, checkLength, checkText } from './checks.js';
import {
  DRAFT_LIMITS,
  type DraftContext,
  type PlaceholderBinding,
  captionBindings,
  kickoffDisplay,
  relationPhrase,
  selectionStageDisplay,
  slideBindings,
  statusDisplay,
} from './request.js';
import {
  ELEMENT_TEXT_VERSION,
  type ElementFactRef,
  type ElementTextField,
  type ElementVersionContent,
  type Segment,
} from './schemas.js';
import type { CarouselPlan, SlidePlan, StandingsRowPlan } from './structure.js';

const PLACEHOLDER_TOKEN = /\{\{[^{}]{0,200}\}\}/gu;

/** Splits AI text into provenance segments; also returns the bindings used. */
export function substitute(
  text: string,
  bindings: ReadonlyMap<string, PlaceholderBinding>,
): { readonly segments: Segment[]; readonly used: PlaceholderBinding[] } {
  const segments: Segment[] = [];
  const used: PlaceholderBinding[] = [];
  const pushCommentary = (value: string): void => {
    if (value === '') {
      return;
    }
    const last = segments[segments.length - 1];
    if (last !== undefined && last.provenance === 'commentary') {
      segments[segments.length - 1] = { ...last, text: last.text + value };
    } else {
      segments.push({ provenance: 'commentary', text: value, factId: null });
    }
  };
  let position = 0;
  for (const match of text.matchAll(PLACEHOLDER_TOKEN)) {
    pushCommentary(text.slice(position, match.index));
    const binding = bindings.get(match[0]);
    if (binding === undefined) {
      pushCommentary(match[0]);
    } else {
      segments.push({ provenance: binding.provenance, text: binding.text, factId: binding.factId });
      used.push(binding);
    }
    position = match.index + match[0].length;
  }
  pushCommentary(text.slice(position));
  return { segments, used };
}

/** The text of a field's segments. */
export function fieldText(segments: readonly Segment[]): string {
  return segments.map((segment) => segment.text).join('');
}

/** Cells of a standings row, in the column order of the per-language table headings. */
export function standingRowCells(row: StandingsRowPlan['value']): string[] {
  return [
    row.position,
    row.played,
    row.won,
    row.drawn,
    row.lost,
    row.goalsFor,
    row.goalsAgainst,
    row.goalDifference,
    row.points,
  ].map(formatInt);
}

function templateSegment(text: string): Segment {
  return { provenance: 'template_text', text, factId: null };
}

function factSegment(text: string, factId: string): Segment {
  return { provenance: 'fact', text, factId };
}

/** Collects fact references; `template` wins over `placeholder`. */
class FactRefs {
  readonly #usage = new Map<string, ElementFactRef['usage']>();

  add(factId: string | null, usage: ElementFactRef['usage']): void {
    if (factId === null) {
      return;
    }
    if (usage === 'template' || !this.#usage.has(factId)) {
      this.#usage.set(factId, usage);
    }
  }

  toArray(): ElementFactRef[] {
    return [...this.#usage].map(([factId, usage]) => ({ factId, usage }));
  }
}

/** Template fields of a slide and the facts they show. */
function templateFields(
  slide: SlidePlan,
  carousel: Pick<CarouselPlan, 'sequence' | 'total'>,
  context: DraftContext,
  refs: FactRefs,
): ElementTextField[] {
  const text = templateText(context.language);
  switch (slide.type) {
    case 'cover': {
      const fields: ElementTextField[] = [
        {
          field: 'title',
          segments: [
            templateSegment(context.competitionName),
            templateSegment(selectionStageDisplay(context)),
            templateSegment(context.seasonLabel),
          ],
        },
      ];
      if (carousel.total > 1) {
        fields.push({
          field: 'footer',
          segments: [templateSegment(`${String(carousel.sequence)}/${String(carousel.total)}`)],
        });
      }
      return fields;
    }
    case 'match_result': {
      const { match } = slide;
      for (const factId of [
        match.teamsFactId,
        match.statusFactId,
        match.scoreFactId,
        match.kickoffFactId,
        match.home.factId,
        match.away.factId,
      ]) {
        refs.add(factId, 'template');
      }
      const fields: ElementTextField[] = [
        {
          field: 'title',
          segments: [templateSegment(`${text.resultTitle} · ${relationPhrase(match.score, context.language)}`)],
        },
        { field: 'team_home', segments: [factSegment(match.home.name, match.home.factId)] },
        { field: 'team_away', segments: [factSegment(match.away.name, match.away.factId)] },
        { field: 'score', segments: [factSegment(formatScore(match.score), match.scoreFactId)] },
      ];
      if (match.kickoff !== null && match.kickoffFactId !== null) {
        fields.push({
          field: 'kickoff',
          segments: [factSegment(kickoffDisplay(match.kickoff, context), match.kickoffFactId)],
        });
      }
      if (context.templateFields === true) {
        // PD-ARCH-01G-D: the values a visual template draws on their own, from the same facts. A result slide
        // exists only for a finished match (the status fact is verified as `finished`).
        fields.push(
          { field: 'score_home', segments: [factSegment(formatInt(match.score.home), match.scoreFactId)] },
          { field: 'score_away', segments: [factSegment(formatInt(match.score.away), match.scoreFactId)] },
          {
            field: 'match_status',
            segments: [factSegment(statusDisplay('finished', context.language), match.statusFactId)],
          },
        );
        if (match.kickoff !== null && match.kickoffFactId !== null) {
          fields.push({
            field: 'kickoff_time',
            segments: [factSegment(formatTime(match.kickoff, context.utcOffsetMinutes), match.kickoffFactId)],
          });
        }
      }
      return fields;
    }
    case 'standings': {
      const segments: Segment[] = [];
      slide.rows.forEach((row, index) => {
        refs.add(row.factId, 'template');
        refs.add(row.team.factId, 'template');
        if (index > 0) {
          segments.push(templateSegment('\n'));
        }
        segments.push(factSegment(standingRowCells(row.value).join(' '), row.factId));
        segments.push(factSegment(row.team.name, row.team.factId));
      });
      return [
        { field: 'title', segments: [templateSegment(text.standingsTitle)] },
        { field: 'standings', segments },
      ];
    }
    case 'closing':
      return [{ field: 'title', segments: [templateSegment(`${text.closingFollow} ${context.brand.handle}`)] }];
    case 'round_overview': {
      // One line per fixture: home, versus, away, kickoff; lines separated by template line feeds (like standings).
      const segments: Segment[] = [];
      slide.fixtures.forEach((fixture, index) => {
        for (const factId of [fixture.teamsFactId, fixture.kickoffFactId, fixture.home.factId, fixture.away.factId]) {
          refs.add(factId, 'template');
        }
        if (index > 0) {
          segments.push(templateSegment('\n'));
        }
        segments.push(factSegment(fixture.home.name, fixture.home.factId));
        segments.push(templateSegment(` ${text.versus} `));
        segments.push(factSegment(fixture.away.name, fixture.away.factId));
        segments.push(templateSegment(' · '));
        segments.push(factSegment(kickoffDisplay(fixture.kickoff, context), fixture.kickoffFactId));
      });
      return [
        {
          field: 'title',
          segments: [templateSegment(`${text.calendarTitle} · ${selectionStageDisplay(context)}`)],
        },
        { field: 'fixtures', segments },
      ];
    }
    case 'fixture':
    case 'match_preview': {
      const { fixture } = slide;
      for (const factId of [
        fixture.teamsFactId,
        fixture.statusFactId,
        fixture.kickoffFactId,
        fixture.home.factId,
        fixture.away.factId,
      ]) {
        refs.add(factId, 'template');
      }
      const title =
        slide.type === 'fixture' ? text.fixtureTitle : `${text.previewTitle} · ${selectionStageDisplay(context)}`;
      const fields: ElementTextField[] = [
        { field: 'title', segments: [templateSegment(title)] },
        {
          field: 'match_status',
          segments: [factSegment(statusDisplay(fixture.status, context.language), fixture.statusFactId)],
        },
        { field: 'team_home', segments: [factSegment(fixture.home.name, fixture.home.factId)] },
        { field: 'team_away', segments: [factSegment(fixture.away.name, fixture.away.factId)] },
        { field: 'kickoff', segments: [factSegment(kickoffDisplay(fixture.kickoff, context), fixture.kickoffFactId)] },
      ];
      if (context.templateFields === true) {
        // PD-ARCH-01G-D: the kickoff time, drawn on its own by a visual template.
        fields.push({
          field: 'kickoff_time',
          segments: [factSegment(formatTime(fixture.kickoff, context.utcOffsetMinutes), fixture.kickoffFactId)],
        });
      }
      if (slide.type === 'match_preview') {
        fields.push({
          field: 'footer',
          segments: [templateSegment(`${context.competitionName} · ${context.seasonLabel}`)],
        });
      }
      return fields;
    }
  }
}

function bindingMap(bindings: readonly PlaceholderBinding[]): Map<string, PlaceholderBinding> {
  return new Map(bindings.map((binding) => [binding.placeholder, binding]));
}

/** An AI-written field: substituted segments, checks on the AI text, and the length of the substituted text. */
function aiField(
  field: 'headline' | 'description' | 'caption',
  raw: string,
  bindings: ReadonlyMap<string, PlaceholderBinding>,
  limit: number,
  checks: CheckContext,
  flags: FlagList,
  refs: FactRefs,
): ElementTextField {
  const { segments, used } = substitute(raw, bindings);
  for (const binding of used) {
    refs.add(binding.factId, 'placeholder');
  }
  flags.addAll(checkText(field, raw, new Set(bindings.keys()), checks));
  flags.addAll(checkLength(field, fieldText(segments), limit));
  return { field, segments };
}

/** The AI texts of one slide. */
export interface SlideTexts {
  readonly headline: string;
  readonly description: string;
}

/** Composes the version content of a slide. */
export function composeSlide(
  slide: SlidePlan,
  carousel: Pick<CarouselPlan, 'sequence' | 'total'>,
  texts: SlideTexts,
  context: DraftContext,
  checks: CheckContext,
): ElementVersionContent {
  const refs = new FactRefs();
  const flags = new FlagList();
  const bindings = bindingMap(slideBindings(slide, context));
  const fields = templateFields(slide, carousel, context, refs);
  fields.push(aiField('headline', texts.headline, bindings, DRAFT_LIMITS.headlineMaxChars, checks, flags, refs));
  fields.push(
    aiField('description', texts.description, bindings, DRAFT_LIMITS.descriptionMaxChars, checks, flags, refs),
  );
  return { text: { version: ELEMENT_TEXT_VERSION, fields }, contentFlags: flags.toArray(), factRefs: refs.toArray() };
}

/** Composes the version content of a carousel's caption element. */
export function composeCaption(
  carousel: CarouselPlan,
  caption: string,
  hashtags: readonly string[],
  context: DraftContext,
  checks: CheckContext,
): ElementVersionContent {
  const refs = new FactRefs();
  const flags = new FlagList();
  const bindings = bindingMap(captionBindings(carousel, context));
  const captionField = aiField('caption', caption, bindings, DRAFT_LIMITS.captionMaxChars, checks, flags, refs);
  flags.addAll(checkHashtags(hashtags, checks));
  const hashtagField: ElementTextField = {
    field: 'hashtags',
    segments: hashtags.map((hashtag) => ({ provenance: 'commentary', text: hashtag, factId: null })),
  };
  const contentFlags: ContentFlag[] = flags.toArray();
  return {
    text: { version: ELEMENT_TEXT_VERSION, fields: [captionField, hashtagField] },
    contentFlags,
    factRefs: refs.toArray(),
  };
}
