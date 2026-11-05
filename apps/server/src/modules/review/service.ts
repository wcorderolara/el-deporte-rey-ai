/**
 * Review service (architecture.md sections 7.4, 11.1 and 11.2; AD-13; R-039, R-040, R-206, R-207, R-217, R-240,
 * R-271, R-272, R-405, R-406; OD-09, OD-26, OD-42, OD-49).
 *
 * - The active draft view: carousels, elements, current versions with their state, the derived "blocked" overlay
 *   (the content module's `blockedOverlay`, which applies the verification module's single `publishability`
 *   function; never re-implemented here), content flags, QA results, provenance segments with each fact's current
 *   status, image addresses (OD-42) and final approvals.
 * - Element approval, withdrawal and QA acknowledgement bound to the exact current version, and the final approval of
 *   a carousel with its version set and SHA-256. Each guard check and the write it protects run in one synchronous
 *   `BEGIN IMMEDIATE` transaction with no `await` inside (T10-F15), so a concurrent supersession cannot slip between
 *   check and write.
 * - Regeneration of one element: new AI text for that element (content module), its render (rendering module) and
 *   its visual QA (visual QA module); the supersession, the new version and the invalidation of the carousel's final
 *   approvals are one transaction of the content module. Other elements keep their versions and approvals.
 * - A final approval covers every slide and the caption only when the caption is approved (PD-ARCH-01E-PD-02): the
 *   caption can be written, approved and exported later. Approving or withdrawing the caption changes the covered set,
 *   so a final approval without it no longer holds once the caption is approved, and the carousel is approved again.
 * - Final approvals are invalidated by any change: regeneration and new drafts (content module), a revoked manual
 *   approval (verification module), a withdrawal (here), and at startup for content that a stricter policy, an
 *   unmarked competition link or an unconfirmed publication permission of the current configuration blocks again.
 */
import { randomUUID } from 'node:crypto';

import type {
  Carousel,
  Draft,
  Element,
  ElementVersion,
  FactRef,
  FactStatus,
  FinalApproval,
  QaResult,
  QaWarningCheck,
  TextField,
} from '@edr/contracts';

import type { AppContainer } from '../../container.js';
import { HttpProblem, type ProblemItem } from '../../platform/http/index.js';
import { AiProviderError } from '../../providers/ai/index.js';
import { StageFailure } from '../../workflow/index.js';
import {
  ElementRegenerationRefused,
  applyElementRegeneration,
  blockedOverlay,
  prepareElementRegeneration,
  verificationPublishability,
} from '../content/index.js';
import {
  type RenderingOptions,
  RenderVersionRefused,
  readSlideImage,
  renderElementVersion,
  slideImageUrl,
} from '../rendering/index.js';
import { QaVersionRefused, type VisualQaOptions, qaElementVersion } from '../visual-qa/index.js';

import {
  ReviewRepository,
  type StoredCarousel,
  type StoredElement,
  type StoredFinalApproval,
  type StoredVersion,
} from './repository.js';
import {
  type VersionSnapshot,
  approvalRefusal,
  finalApprovalReasons,
  sameVersionSet,
  versionSetOf,
  versionState,
} from './state.js';

export interface ReviewServiceOptions {
  readonly container: AppContainer;
  /** Options of the rendering of a regenerated slide (tests pass their own fonts and brand asset lookup). */
  readonly rendering?: RenderingOptions;
  /** Options of the visual QA of a regenerated version (tests pass their own fonts). */
  readonly visualQa?: VisualQaOptions;
  /** ID generator of approval, final approval and version rows; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

/** A version with everything the guards and the view need, read at one moment. */
interface InspectedVersion {
  readonly version: StoredVersion;
  readonly blockingFacts: FactRef[];
  readonly qa: QaResult[];
  readonly snapshot: VersionSnapshot;
}

/** An element of a carousel with its inspected current version (null when it has none). */
interface InspectedElement {
  readonly element: StoredElement;
  readonly current: InspectedVersion | null;
}

/**
 * The elements a final approval covers (PD-ARCH-01E-PD-02): every slide, and the caption only when its current version
 * is approved. A caption still in review neither prevents the final approval nor is exported.
 */
function coveredElements(elements: readonly InspectedElement[]): InspectedElement[] {
  return elements.filter(
    ({ element, current }) =>
      element.kind === 'slide' || (current !== null && versionState(current.snapshot) === 'approved'),
  );
}

const PROBLEMS = {
  projectNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The project does not exist.'),
  noActiveDraft: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The project has no active draft.'),
  carouselNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The carousel does not exist.'),
  elementNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The element does not exist in this carousel.'),
  imageNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The element version has no slide image.'),
  draftSuperseded: (): HttpProblem =>
    new HttpProblem(409, 'VERSION_CONFLICT', 'The draft of this carousel has been superseded by a newer draft.'),
  versionConflict: (): HttpProblem =>
    new HttpProblem(409, 'VERSION_CONFLICT', 'The version is not the current version of the element.'),
  noWarning: (): HttpProblem =>
    new HttpProblem(400, 'VALIDATION_FAILED', 'The version has no failed visual QA warning of this check.', {
      errors: [{ path: '/checks/0', message: 'has no failed warning to acknowledge' }],
    }),
  providerFailed: (): HttpProblem =>
    new HttpProblem(502, 'PROVIDER_FAILED', 'The AI provider could not draft the element; try again.'),
} as const;

/** The review use cases over the container's database, configuration, AI provider and data directory. */
export class ReviewService {
  readonly #container: AppContainer;
  readonly #repository: ReviewRepository;
  readonly #rendering: RenderingOptions;
  readonly #visualQa: VisualQaOptions;
  readonly #newId: () => string;

  constructor(options: ReviewServiceOptions) {
    this.#container = options.container;
    this.#repository = new ReviewRepository(options.container.db);
    this.#rendering = options.rendering ?? {};
    this.#visualQa = options.visualQa ?? {};
    this.#newId = options.newId ?? randomUUID;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------------------------------------------

  /** The project's active draft (getActiveDraft). */
  activeDraft(projectId: string): Draft {
    const project = this.#repository.project(projectId);
    if (project === null) {
      throw PROBLEMS.projectNotFound();
    }
    const draft = this.#repository.activeDraft(projectId);
    if (draft === null) {
      throw PROBLEMS.noActiveDraft();
    }
    const carousels: Carousel[] = [];
    for (const carouselId of this.#repository.draftCarouselIds(draft.id)) {
      const carousel = this.#repository.carousel(carouselId);
      if (carousel !== null) {
        carousels.push(this.#carouselView(carousel));
      }
    }
    return {
      id: draft.id,
      projectId: draft.projectId,
      runId: draft.runId,
      factsRunId: draft.factsRunId,
      language: draft.language,
      dataMode: project.dataMode,
      demonstration: project.dataMode === 'DEMO_DATA',
      standingsIncluded: draft.standingsIncluded,
      createdAt: draft.createdAt,
      excludedMatchKeys: draft.excludedMatchKeys,
      leftOutMatches: draft.leftOutMatches,
      carousels,
    };
  }

  /** The PNG of a slide version (getSlideImage); any version, current or superseded, that has a render. */
  async slideImage(versionId: string): Promise<Buffer> {
    const png = await readSlideImage(this.#container, versionId);
    if (png === null) {
      throw PROBLEMS.imageNotFound();
    }
    return png;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Guarded writes (one synchronous BEGIN IMMEDIATE transaction each, T10-F15)
  // -------------------------------------------------------------------------------------------------------------

  /** Approves the exact current version of an element (approveElement). */
  approveElement(carouselId: string, elementId: string, versionId: string): Element {
    const { db } = this.#container;
    return db.transaction(() => {
      const { carousel, element } = this.#locateActive(carouselId, elementId);
      const current = element.currentVersionId === versionId ? this.#repository.version(versionId) : null;
      if (current === null) {
        throw PROBLEMS.versionConflict();
      }
      const inspected = this.#inspect(current);
      const refusal = approvalRefusal(inspected.snapshot, true);
      if (refusal !== null) {
        throw new HttpProblem(
          409,
          refusal.code,
          refusal.detail,
          refusal.code === 'APPROVAL_BLOCKED' ? { facts: inspected.blockingFacts } : {},
        );
      }
      if (!inspected.snapshot.approved) {
        this.#repository.insertApproval(this.#newId(), versionId, 'approved', this.#now());
      }
      return this.#elementView(carousel, this.#reread(element));
    });
  }

  /** Withdraws the approval of the current version and invalidates the carousel's final approval. */
  withdrawElementApproval(carouselId: string, elementId: string): Element {
    const { db } = this.#container;
    return db.transaction(() => {
      const { carousel, element } = this.#locateActive(carouselId, elementId);
      const versionId = element.currentVersionId;
      const current = versionId === null ? null : this.#repository.version(versionId);
      if (current === null || current.superseded) {
        throw PROBLEMS.versionConflict();
      }
      if (this.#repository.isApproved(current.id)) {
        const at = this.#now();
        this.#repository.insertApproval(this.#newId(), current.id, 'withdrawn', at);
        this.#repository.invalidateCarouselFinalApprovals(carousel.id, at);
      }
      return this.#elementView(carousel, element);
    });
  }

  /** Acknowledges a failed warning of the exact current version (acknowledgeQaWarnings; OD-09, OD-26). */
  acknowledgeQaWarnings(
    carouselId: string,
    elementId: string,
    versionId: string,
    checks: readonly QaWarningCheck[],
  ): Element {
    const { db } = this.#container;
    return db.transaction(() => {
      const { carousel, element } = this.#locateActive(carouselId, elementId);
      const current = element.currentVersionId === versionId ? this.#repository.version(versionId) : null;
      if (current === null || current.superseded) {
        throw PROBLEMS.versionConflict();
      }
      const at = this.#now();
      for (const check of checks) {
        const warning = this.#repository.failedWarning(versionId, check);
        if (warning === undefined) {
          throw PROBLEMS.noWarning();
        }
        if (warning.acknowledgedAt === null) {
          this.#repository.acknowledge(versionId, check, at);
        }
      }
      return this.#elementView(carousel, element);
    });
  }

  /**
   * Final approval of a carousel (approveCarousel; R-240, PD-ARCH-01E-PD-02): refused with every slide that is not
   * approved or is blocked; records the version set (the slides, and the caption when approved) and its SHA-256. A valid final approval of the same version set is returned
   * unchanged; a valid one of another set (stale) is invalidated.
   */
  approveCarousel(carouselId: string): FinalApproval {
    const { db } = this.#container;
    return db.transaction(() => {
      const carousel = this.#repository.carousel(carouselId);
      if (carousel === null) {
        throw PROBLEMS.carouselNotFound();
      }
      if (carousel.draftSuperseded) {
        throw PROBLEMS.draftSuperseded();
      }
      const elements = this.#inspectCarousel(carousel);
      const slides = elements.filter(({ element }) => element.kind === 'slide');
      const items: ProblemItem[] = slides.flatMap(({ element, current }) =>
        finalApprovalReasons(current?.snapshot ?? null).map((reason) => ({ elementId: element.id, reason })),
      );
      if (slides.length === 0 || items.length > 0) {
        throw new HttpProblem(409, 'FINAL_APPROVAL_REFUSED', 'Every slide must be approved and none may be blocked.', {
          items,
        });
      }
      const covered = coveredElements(elements);
      if (covered.some(({ current }) => current !== null && finalApprovalReasons(current.snapshot).length > 0)) {
        throw new HttpProblem(409, 'FINAL_APPROVAL_REFUSED', 'An approved caption must not be blocked.', {
          items: covered.flatMap(({ element, current }) =>
            finalApprovalReasons(current?.snapshot ?? null).map((reason) => ({ elementId: element.id, reason })),
          ),
        });
      }
      const set = versionSetOf(covered.flatMap(({ current }) => (current === null ? [] : [current.version.id])));
      const at = this.#now();
      let kept: StoredFinalApproval | null = null;
      for (const existing of this.#repository.validFinalApprovals(carousel.id)) {
        if (kept === null && existing.versionSetSha256 === set.sha256 && sameVersionSet(existing.versionSet, set.ids)) {
          kept = existing;
        } else {
          this.#repository.invalidateFinalApproval(existing.id, at);
        }
      }
      if (kept === null) {
        const id = this.#newId();
        this.#repository.insertFinalApproval({ id, carouselId: carousel.id, versionSet: set, approvedAt: at });
        kept = this.#repository.finalApproval(id);
      }
      if (kept === null) {
        throw new Error('the final approval was not recorded');
      }
      return this.#finalApprovalView(kept, set.ids, false);
    });
  }

  /**
   * Regenerates one element (regenerateElement; R-040, R-217): new text through the content module, then the
   * render of a slide and the visual QA of the new version. Other elements keep their versions and approvals; the
   * carousel's final approvals are invalidated with the supersession.
   */
  async regenerateElement(carouselId: string, elementId: string): Promise<Element> {
    const { carousel, element } = this.#locateActive(carouselId, elementId);
    let prepared: Awaited<ReturnType<typeof prepareElementRegeneration>>;
    try {
      prepared = await prepareElementRegeneration(this.#container, element.id, new AbortController().signal);
    } catch (error) {
      throw regenerationProblem(error);
    }
    let versionId: string;
    try {
      ({ versionId } = applyElementRegeneration(this.#container.db, prepared, {
        versionId: this.#newId(),
        at: this.#now(),
      }));
    } catch (error) {
      throw regenerationProblem(error);
    }
    try {
      if (element.kind === 'slide') {
        await renderElementVersion(this.#container, versionId, this.#rendering);
      }
      await qaElementVersion(this.#container, versionId, this.#visualQa);
    } catch (error) {
      throw regenerationProblem(error);
    }
    return this.#elementView(carousel, this.#reread(element));
  }

  // -------------------------------------------------------------------------------------------------------------
  // Invalidation under the current configuration (startup)
  // -------------------------------------------------------------------------------------------------------------

  /**
   * Invalidates every valid final approval that no longer holds under the current data and configuration: its
   * carousel's draft is superseded, its version set differs from the carousel's current versions, or a version of
   * the set is blocked (a stricter policy, a link no longer marked, a permission no longer confirmed, a revoked manual
   * approval). One transaction. Returns the number of invalidated final approvals.
   */
  invalidateStaleFinalApprovals(): number {
    const { db } = this.#container;
    return db.transaction(() => {
      const at = this.#now();
      let invalidated = 0;
      for (const finalApproval of this.#repository.allValidFinalApprovals()) {
        if (!this.#holds(finalApproval) && this.#repository.invalidateFinalApproval(finalApproval.id, at)) {
          invalidated += 1;
        }
      }
      return invalidated;
    });
  }

  // -------------------------------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------------------------------

  #now(): string {
    return this.#container.clock.now().toISOString();
  }

  /** The element of the carousel with the carousel; 404 when either is missing, 409 for a superseded draft. */
  #locateActive(carouselId: string, elementId: string): { carousel: StoredCarousel; element: StoredElement } {
    const carousel = this.#repository.carousel(carouselId);
    const element = this.#repository.element(elementId);
    if (carousel === null || element?.carouselId !== carousel.id) {
      throw PROBLEMS.elementNotFound();
    }
    if (carousel.draftSuperseded) {
      throw PROBLEMS.draftSuperseded();
    }
    return { carousel, element };
  }

  #reread(element: StoredElement): StoredElement {
    return this.#repository.element(element.id) ?? element;
  }

  #inspect(version: StoredVersion): InspectedVersion {
    const overlay = blockedOverlay({ db: this.#container.db, config: this.#container.config }, version.id) ?? {
      blocked: false,
      blockingFacts: [],
    };
    const qa = this.#repository.qaResults(version.id);
    return {
      version,
      blockingFacts: overlay.blockingFacts,
      qa,
      snapshot: {
        superseded: version.superseded,
        qaStatus: version.qaStatus,
        approved: this.#repository.isApproved(version.id),
        blocked: overlay.blocked,
        flagged: version.contentFlags.length > 0,
        qa: qa.map((result) => ({
          severity: result.severity,
          outcome: result.outcome,
          acknowledged: result.acknowledgedAt !== null,
        })),
      },
    };
  }

  #inspectCarousel(carousel: StoredCarousel): InspectedElement[] {
    return this.#repository.carouselElements(carousel.id).map((element) => {
      const version = element.currentVersionId === null ? null : this.#repository.version(element.currentVersionId);
      return { element, current: version === null ? null : this.#inspect(version) };
    });
  }

  /** True while a final approval still holds (see `invalidateStaleFinalApprovals`). */
  #holds(finalApproval: StoredFinalApproval): boolean {
    const carousel = this.#repository.carousel(finalApproval.carouselId);
    if (carousel === null || carousel.draftSuperseded) {
      return false;
    }
    const covered = coveredElements(this.#inspectCarousel(carousel));
    const current = covered.flatMap(({ current: inspected }) => (inspected === null ? [] : [inspected.version.id]));
    return (
      covered.every(({ current: inspected }) => inspected !== null && !inspected.snapshot.blocked) &&
      sameVersionSet(finalApproval.versionSet, current)
    );
  }

  /** The current status of every fact a version's segments name (derived `manually_approved`, AD-28). */
  #factStatuses(projectId: string, version: StoredVersion): ReadonlyMap<string, FactStatus> {
    const ids = new Set<string>();
    for (const field of version.text.fields) {
      for (const segment of field.segments) {
        if (segment.factId !== null) {
          ids.add(segment.factId);
        }
      }
    }
    const verdicts = verificationPublishability(
      { db: this.#container.db, config: this.#container.config },
      projectId,
      [...ids].sort(),
    );
    return new Map([...verdicts].map(([factId, verdict]) => [factId, verdict.status]));
  }

  #versionView(projectId: string, inspected: InspectedVersion): ElementVersion {
    const { version } = inspected;
    const statuses = this.#factStatuses(projectId, version);
    const fields: TextField[] = version.text.fields.map((field) => ({
      field: field.field,
      segments: field.segments.map((segment) => ({
        provenance: segment.provenance,
        text: segment.text,
        factId: segment.factId,
        factStatus: segment.factId === null ? null : (statuses.get(segment.factId) ?? 'unverified'),
      })),
    }));
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      state: versionState(inspected.snapshot),
      blocked: inspected.snapshot.blocked,
      blockingFacts: inspected.blockingFacts,
      contentFlags: version.contentFlags,
      qa: inspected.qa,
      fields,
      // OD-42: the relative path of getSlideImage; the UI uses it as an existence flag.
      imageUrl: version.hasImage ? slideImageUrl(version.id) : null,
      width: version.width,
      height: version.height,
    };
  }

  #elementView(carousel: StoredCarousel, element: StoredElement): Element {
    const version = element.currentVersionId === null ? null : this.#repository.version(element.currentVersionId);
    if (version === null) {
      throw new Error('an element has no current version');
    }
    return {
      id: element.id,
      carouselId: element.carouselId,
      kind: element.kind,
      position: element.position,
      slideType: element.slideType,
      currentVersion: this.#versionView(carousel.projectId, this.#inspect(version)),
    };
  }

  #finalApprovalView(
    finalApproval: StoredFinalApproval,
    currentVersionIds: readonly string[],
    anyBlocked: boolean,
  ): FinalApproval {
    return {
      id: finalApproval.id,
      carouselId: finalApproval.carouselId,
      approvedAt: finalApproval.approvedAt,
      versionSetSha256: finalApproval.versionSetSha256,
      valid:
        finalApproval.invalidatedAt === null &&
        !anyBlocked &&
        sameVersionSet(finalApproval.versionSet, currentVersionIds),
    };
  }

  #carouselView(carousel: StoredCarousel): Carousel {
    const inspected = this.#inspectCarousel(carousel);
    const covered = new Set(coveredElements(inspected).map(({ element }) => element.id));
    const elements: Element[] = [];
    const currentIds: string[] = [];
    let anyBlocked = false;
    let ready = inspected.some(({ element }) => element.kind === 'slide');
    for (const { element, current } of inspected) {
      // The caption is not required (PD-ARCH-01E-PD-02); when approved it must still be publishable.
      if (covered.has(element.id) && finalApprovalReasons(current?.snapshot ?? null).length > 0) {
        ready = false;
      }
      if (current === null) {
        continue;
      }
      if (covered.has(element.id)) {
        anyBlocked ||= current.snapshot.blocked;
        currentIds.push(current.version.id);
      }
      elements.push({
        id: element.id,
        carouselId: element.carouselId,
        kind: element.kind,
        position: element.position,
        slideType: element.slideType,
        currentVersion: this.#versionView(carousel.projectId, current),
      });
    }
    const latest = this.#repository.latestFinalApproval(carousel.id);
    return {
      id: carousel.id,
      sequence: carousel.sequence,
      total: carousel.total,
      elements,
      readyForFinalApproval: ready,
      finalApproval: latest === null ? null : this.#finalApprovalView(latest, currentIds, anyBlocked),
    };
  }
}

/** The problem answered for a failed regeneration step. */
function regenerationProblem(error: unknown): Error {
  if (error instanceof ElementRegenerationRefused) {
    switch (error.reason) {
      case 'element_not_found':
        return PROBLEMS.elementNotFound();
      case 'draft_superseded':
        return PROBLEMS.draftSuperseded();
      case 'version_conflict':
        return PROBLEMS.versionConflict();
      default:
        // not_regenerable: the element cannot be rebuilt from the facts of its draft (a server defect).
        return error;
    }
  }
  if (error instanceof AiProviderError) {
    return PROBLEMS.providerFailed();
  }
  if (
    (error instanceof RenderVersionRefused && error.reason !== 'not_found' && error.reason !== 'not_a_slide') ||
    (error instanceof QaVersionRefused && error.reason !== 'not_found' && error.reason !== 'not_rendered') ||
    (error instanceof StageFailure && error.failure.code === 'run_superseded')
  ) {
    // The new version was superseded (another regeneration or a new draft) while it was rendered or checked.
    return PROBLEMS.versionConflict();
  }
  return error instanceof Error ? error : new Error('the regeneration failed');
}
