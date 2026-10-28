/**
 * Content module (architecture.md sections 6 and 8; AD-11; contracts/provider-ports.md sections 2 and 3): the content
 * stage of the workflow (deterministic carousel structure, AI drafting with fact placeholders, deterministic
 * substitution into provenance segments, content checks, persistence of drafts, carousels, elements, versions and
 * fact references), the blocked overlay, and the regeneration of one element used by the review module (T37). It has
 * no routes.
 *
 * Downstream modules read the stored text with `ElementTextSchema`, the subject with `ElementSubjectSchema`, the
 * flags with `ContentFlagListSchema`, and use `blockedOverlay` and the regeneration functions.
 */
import type { ServerModule } from '../module-kit.js';

import { contentStage } from './stage.js';

export {
  type CheckContext,
  type CheckedField,
  HASHTAG_PATTERN,
  LINE_FEED_LIMITS,
  MAX_FLAGS_PER_VERSION,
  type TeamNameRule,
  checkHashtags,
  checkLength,
  checkText,
} from './checks.js';
export { type SlideTexts, composeCaption, composeSlide, fieldText, standingRowCells, substitute } from './compose.js';
export { checkContextOf, draftContent, draftContextOf } from './core.js';
export {
  type BlockedOverlay,
  type PublishabilityContext,
  type PublishabilityFunction,
  type PublishabilityVerdict,
  blockedOverlay,
  storedFactsPublishability,
} from './publishability.js';
export {
  ElementRegenerationRefused,
  type PreparedRegeneration,
  type RegenerationRefusal,
  applyElementRegeneration,
  prepareElementRegeneration,
  regenerateElement,
} from './regenerate.js';
export { ContentRepository } from './repository.js';
export {
  DRAFT_LIMITS,
  type DraftContext,
  type PlaceholderBinding,
  buildDraftRequest,
  captionBindings,
  slideBindings,
} from './request.js';
export {
  type ContentFact,
  ContentFactSchema,
  ContentFlagListSchema,
  type ContentInput,
  ContentInputSchema,
  type ContentOutput,
  ContentOutputSchema,
  ELEMENT_TEXT_VERSION,
  type ElementFactRef,
  ElementFactRefListSchema,
  type ElementSubject,
  ElementSubjectSchema,
  type ElementText,
  ElementTextSchema,
  type ElementVersionContent,
  LeftOutMatchListSchema,
  type Segment,
  SegmentSchema,
} from './schemas.js';
export { type ContentStageOptions, buildContentInput, contentStage, createContentStage } from './stage.js';
export {
  CAPTION_KEY,
  type CarouselPlan,
  type DraftPlan,
  FactIndex,
  type SlidePlan,
  matchSlideKey,
  planDraft,
  standingsSlideKey,
} from './structure.js';
export { findNumberWords, foldWord, isNumberWord } from './words.js';

/** The content module of the static registry: the content stage, no routes. */
export const serverModule: ServerModule = { name: 'content', stages: [contentStage] };
