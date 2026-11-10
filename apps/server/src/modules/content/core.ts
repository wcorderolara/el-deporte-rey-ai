/**
 * Core of the content stage (architecture.md sections 6 and 8; AD-11; R-209, R-225, R-236): structure, AI drafting,
 * deterministic substitution and content checks. It has no database access; its only I/O is the AI port, so the tests
 * call it with inline synthetic facts and the stub provider in isolation.
 *
 * One draft request per carousel, in the project's language (R-236). The response is validated by the AI port; a
 * full request must also give a caption and at least one hashtag (R-209), otherwise the stage fails with
 * `ai_response_invalid` and no partial draft is stored.
 */
import { AiProviderError, type AiTextProvider, type DraftResponse } from '../../providers/ai/index.js';

import type { CheckContext, TeamNameRule } from './checks.js';
import { composeCaption, composeSlide } from './compose.js';
import { type DraftContext, buildDraftRequest } from './request.js';
import type { ContentInput, ContentOutput, DraftCarousel, DraftElement, ElementSubject, TeamAlias } from './schemas.js';
import { CAPTION_KEY, type CarouselPlan, type ContentKind, FactIndex, type SlidePlan, planDraft } from './structure.js';

/** The labels and settings of the input as a draft context. */
export function draftContextOf(input: ContentInput): DraftContext {
  return {
    language: input.language,
    utcOffsetMinutes: input.utcOffsetMinutes,
    competitionName: input.competitionName,
    seasonLabel: input.seasonLabel,
    stageLabel: input.stageLabel,
    matchday: input.matchday,
    brand: { name: input.brand.name, handle: input.brand.handle },
    templateFields: input.templateFields === true,
  };
}

/**
 * The check context: every team with a usable name and every known alias of it, and whether the content describes
 * matches not played yet (any content kind other than `results`, PD-ARCH-01E-B).
 */
export function checkContextOf(
  index: FactIndex,
  aliases: readonly TeamAlias[],
  brandHandle: string,
  contentKind: ContentKind = 'results',
): CheckContext {
  const byTeam = new Map<string, string[]>();
  for (const alias of aliases) {
    const list = byTeam.get(alias.teamId) ?? [];
    list.push(alias.alias);
    byTeam.set(alias.teamId, list);
  }
  const teams: TeamNameRule[] = index.teamNames().map((team) => ({
    teamId: team.teamId,
    officialName: team.name,
    aliases: byTeam.get(team.teamId) ?? [],
  }));
  return contentKind === 'results' ? { brandHandle, teams } : { brandHandle, teams, unplayed: true };
}

/** The stored subject of a slide. */
export function subjectOf(slide: SlidePlan | null): ElementSubject {
  if (slide?.type === 'match_result') {
    return { matchKey: slide.match.matchKey, matchIndex: slide.match.index, standingsPage: null, teamIds: [] };
  }
  if (slide?.type === 'fixture' || slide?.type === 'match_preview') {
    return { matchKey: slide.fixture.matchKey, matchIndex: slide.fixture.index, standingsPage: null, teamIds: [] };
  }
  if (slide?.type === 'round_overview') {
    // The page is rebuilt from the facts on regeneration, like the slide was planned.
    return { matchKey: null, matchIndex: null, standingsPage: slide.page, teamIds: [] };
  }
  if (slide?.type === 'standings') {
    return {
      matchKey: null,
      matchIndex: null,
      standingsPage: slide.page,
      teamIds: slide.rows.map((row) => row.team.teamId),
    };
  }
  return { matchKey: null, matchIndex: null, standingsPage: null, teamIds: [] };
}

/** Caption and hashtags of a full response; refused when either is missing (R-209). */
export function captionOf(response: DraftResponse): { caption: string; hashtags: string[] } {
  if (response.caption === undefined || response.caption.trim() === '' || (response.hashtags ?? []).length === 0) {
    throw new AiProviderError('ai_response_invalid');
  }
  return { caption: response.caption, hashtags: [...(response.hashtags ?? [])] };
}

/** The AI texts of each requested slide, by slide key. */
export function textsBySlide(response: DraftResponse): Map<string, { headline: string; description: string }> {
  return new Map(
    response.slides.map((slide) => [slide.slideKey, { headline: slide.headline, description: slide.description }]),
  );
}

async function draftCarousel(
  carousel: CarouselPlan,
  context: DraftContext,
  checks: CheckContext,
  ai: AiTextProvider,
  signal: AbortSignal,
): Promise<DraftCarousel> {
  const response = await ai.generateDraft(buildDraftRequest(carousel, context), { signal });
  const texts = textsBySlide(response);
  const { caption, hashtags } = captionOf(response);
  const elements: DraftElement[] = [
    {
      kind: 'caption',
      position: 0,
      slideType: null,
      slideKey: CAPTION_KEY,
      subject: subjectOf(null),
      version: composeCaption(carousel, caption, hashtags, context, checks),
    },
  ];
  carousel.slides.forEach((slide, index) => {
    const slideTexts = texts.get(slide.key);
    if (slideTexts === undefined) {
      throw new AiProviderError('ai_response_invalid');
    }
    elements.push({
      kind: 'slide',
      position: index + 1,
      slideType: slide.type,
      slideKey: slide.key,
      subject: subjectOf(slide),
      version: composeSlide(slide, carousel, slideTexts, context, checks),
    });
  });
  return { sequence: carousel.sequence, total: carousel.total, elements };
}

/** Drafts the content of a run: structure, one AI request per carousel, substitution and checks. */
export async function draftContent(
  input: ContentInput,
  ai: AiTextProvider,
  signal: AbortSignal,
): Promise<ContentOutput> {
  const index = new FactIndex(input.facts);
  const plan = planDraft(index, {
    contentKind: input.contentKind,
    standings: input.standings,
    excludedMatchKeys: input.excludedMatchKeys,
    maxSlidesPerCarousel: input.maxSlidesPerCarousel,
    standingsRowsPerSlide: input.standingsRowsPerSlide,
  });
  const context = draftContextOf(input);
  const checks = checkContextOf(index, input.teamAliases, input.brand.handle, input.contentKind);
  const carousels: DraftCarousel[] = [];
  for (const carousel of plan.carousels) {
    carousels.push(await draftCarousel(carousel, context, checks, ai, signal));
  }
  return {
    projectId: input.projectId,
    factsRunId: input.factsRunId,
    language: input.language,
    standingsIncluded: plan.standingsIncluded,
    excludedMatchKeys: [...plan.excludedMatchKeys],
    leftOutMatches: [...plan.leftOutMatches],
    aiAdapter: ai.id,
    carousels,
  };
}
