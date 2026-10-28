/**
 * Regeneration of one element (architecture.md section 11.1; R-217; used by the review module, T37).
 *
 * A regeneration creates a new version of one element only: new AI text for that slide key (`only: [slideKey]`), or
 * a new caption and hashtags for the caption element, with the same deterministic template fields, substitution and
 * content checks as the draft. The other elements keep their versions and approvals. The rendering and visual QA of
 * the new version are run by the caller.
 *
 * It is split so that the caller can keep its guard and the write in one synchronous `BEGIN IMMEDIATE` transaction
 * (T10-F15):
 * - `prepareElementRegeneration` (async): reads the element, its carousel and the facts of its draft, calls the AI
 *   provider and builds the new version content; no database write;
 * - `applyElementRegeneration` (synchronous): in one transaction (a savepoint when the caller already holds one),
 *   re-checks that the element's current version is still the one the preparation started from, supersedes it,
 *   inserts the new version (origin `regenerated`, `qa_status` pending) with its fact references, makes it current
 *   and invalidates the carousel's final approvals (its version set changed, R-240);
 * - `regenerateElement` does both.
 */
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { AppContainer } from '../../container.js';
import type { Db } from '../../platform/db/index.js';
import { AiProviderError } from '../../providers/ai/index.js';

import { captionOf, checkContextOf, draftContextOf, textsBySlide } from './core.js';
import { composeCaption, composeSlide } from './compose.js';
import { ContentRepository, type StoredCarouselElement } from './repository.js';
import { buildDraftRequest } from './request.js';
import { ContentFactSchema, ContentInputSchema, type ElementVersionContent } from './schemas.js';
import { type CarouselPlan, FactIndex, type SlidePlan, matchPlanFor, standingsRowsFor } from './structure.js';
import { buildContentInput } from './stage.js';

export type RegenerationRefusal = 'element_not_found' | 'draft_superseded' | 'version_conflict' | 'not_regenerable';

/** A regeneration that cannot be done; the caller maps the reason to its problem (for example `VERSION_CONFLICT`). */
export class ElementRegenerationRefused extends Error {
  override readonly name = 'ElementRegenerationRefused';
  readonly reason: RegenerationRefusal;

  constructor(reason: RegenerationRefusal) {
    super(`element regeneration refused: ${reason}`);
    this.reason = reason;
  }
}

/** A prepared new version of one element. */
export interface PreparedRegeneration {
  readonly elementId: string;
  readonly carouselId: string;
  /** The current version when the preparation started; the write is refused if it changed. */
  readonly baseVersionId: string;
  readonly content: ElementVersionContent;
  readonly aiAdapter: string;
}

function slideOf(element: StoredCarouselElement, index: FactIndex): SlidePlan {
  const { subject } = element;
  switch (element.slideType) {
    case 'cover':
      return { type: 'cover', key: 'cover' };
    case 'closing':
      return { type: 'closing', key: 'closing' };
    case 'match_result': {
      const match =
        subject.matchKey === null || subject.matchIndex === null
          ? null
          : matchPlanFor(index, subject.matchKey, subject.matchIndex);
      if (match === null) {
        throw new ElementRegenerationRefused('not_regenerable');
      }
      return { type: 'match_result', key: element.slideKey, match };
    }
    case 'standings': {
      const rows = standingsRowsFor(index, subject.teamIds);
      if (rows === null || subject.standingsPage === null) {
        throw new ElementRegenerationRefused('not_regenerable');
      }
      return { type: 'standings', key: element.slideKey, page: subject.standingsPage, rows };
    }
    default:
      throw new ElementRegenerationRefused('not_regenerable');
  }
}

/** Builds the new version content of one element with the AI provider; no database write. */
export async function prepareElementRegeneration(
  container: Pick<AppContainer, 'db' | 'config' | 'aiProvider'>,
  elementId: string,
  signal: AbortSignal,
): Promise<PreparedRegeneration> {
  const repository = new ContentRepository(container.db);
  const element = repository.element(elementId);
  if (element === null) {
    throw new ElementRegenerationRefused('element_not_found');
  }
  if (element.draftSuperseded) {
    throw new ElementRegenerationRefused('draft_superseded');
  }
  if (element.currentVersionId === null) {
    throw new ElementRegenerationRefused('version_conflict');
  }
  const input = ContentInputSchema.parse(
    buildContentInput(container, {
      projectId: element.projectId,
      runId: element.factsRunId,
      factsRunId: element.factsRunId,
      language: element.language,
      excludedMatchKeys: [],
      maxSlidesPerCarousel: 100,
      standingsRowsPerSlide: 100,
    }),
  );
  const index = new FactIndex(z.array(ContentFactSchema).parse(input.facts));
  const context = draftContextOf(input);
  const checks = checkContextOf(index, input.teamAliases, input.brand.handle);
  const slides = repository
    .carouselElements(element.carouselId)
    .filter((sibling) => sibling.kind === 'slide')
    .map((sibling) => slideOf(sibling, index));
  const carousel: CarouselPlan = { sequence: element.sequence, total: element.total, slides };
  const ai = container.aiProvider;

  let content: ElementVersionContent;
  if (element.kind === 'caption') {
    const response = await ai.generateDraft(buildDraftRequest(carousel, context), { signal });
    const { caption, hashtags } = captionOf(response);
    content = composeCaption(carousel, caption, hashtags, context, checks);
  } else {
    const slide = slides.find((candidate) => candidate.key === element.slideKey);
    if (slide === undefined) {
      throw new ElementRegenerationRefused('not_regenerable');
    }
    const response = await ai.generateDraft(buildDraftRequest(carousel, context, [slide.key]), { signal });
    const texts = textsBySlide(response).get(slide.key);
    if (texts === undefined) {
      throw new AiProviderError('ai_response_invalid');
    }
    content = composeSlide(slide, carousel, texts, context, checks);
  }
  return {
    elementId,
    carouselId: element.carouselId,
    baseVersionId: element.currentVersionId,
    content,
    aiAdapter: ai.id,
  };
}

/**
 * Stores a prepared version (synchronous; its own transaction, or a savepoint of the caller's). Throws
 * `ElementRegenerationRefused` when the element or its draft changed since the preparation.
 */
export function applyElementRegeneration(
  db: Db,
  prepared: PreparedRegeneration,
  options: { readonly versionId: string; readonly at: string },
): { readonly versionId: string; readonly versionNumber: number } {
  return db.transaction(() => {
    const repository = new ContentRepository(db);
    const element = repository.element(prepared.elementId);
    if (element === null) {
      throw new ElementRegenerationRefused('element_not_found');
    }
    if (element.draftSuperseded) {
      throw new ElementRegenerationRefused('draft_superseded');
    }
    if (
      element.currentVersionId !== prepared.baseVersionId ||
      !repository.supersedeVersion(prepared.baseVersionId, options.at)
    ) {
      throw new ElementRegenerationRefused('version_conflict');
    }
    const versionNumber = repository.nextVersionNumber(prepared.elementId);
    repository.insertVersion({
      id: options.versionId,
      elementId: prepared.elementId,
      versionNumber,
      origin: 'regenerated',
      content: prepared.content,
      aiAdapter: prepared.aiAdapter,
      createdAt: options.at,
    });
    repository.invalidateFinalApprovals(prepared.carouselId, options.at);
    return { versionId: options.versionId, versionNumber };
  });
}

/** Prepares and stores a new version of one element. */
export async function regenerateElement(
  container: Pick<AppContainer, 'db' | 'config' | 'aiProvider' | 'clock'>,
  elementId: string,
  signal: AbortSignal,
  options: { readonly newId?: () => string } = {},
): Promise<{ readonly versionId: string; readonly versionNumber: number }> {
  const prepared = await prepareElementRegeneration(container, elementId, signal);
  return applyElementRegeneration(container.db, prepared, {
    versionId: (options.newId ?? randomUUID)(),
    at: container.clock.now().toISOString(),
  });
}
