/**
 * Pure helpers of the review feature: element order and names, the obstacles to an element approval and to the
 * final approval as they appear in the shown draft, QA helpers, and the parsing of the refusal details of a problem.
 *
 * These helpers only explain the shown state to the operator. Every guard runs on the server (AD-13, T10-F15): an
 * obstacle derived here disables a control and is explained next to it, and the server's refusal is always shown.
 */
import {
  FactRefSchema,
  FinalApprovalRefusalReasonSchema,
  QA_WARNING_CHECKS,
  UuidSchema,
  type Carousel,
  type Draft,
  type EditorialPackage,
  type EditorialVersion,
  type Element,
  type ElementVersion,
  type FactRef,
  type FinalApprovalRefusalReason,
  type QaResult,
  type QaWarningCheck,
} from '@edr/contracts';

import type { Problem } from '../../api/types';
import { blockReasonLabel, blockingFactCopy, elementCopy, type ApprovalObstacle } from './copy';
import { unverifiedReasonLabel } from '../../ui';

/** Slides by position, then the caption: the carousel order of the preview (R-215). */
export function orderedElements(carousel: Carousel): Element[] {
  return [...carousel.elements].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'slide' ? -1 : 1;
    }
    return a.position - b.position;
  });
}

/** Operator-facing name of an element. */
export function elementName(element: Element): string {
  return element.kind === 'caption' ? elementCopy.caption : elementCopy.slide(element.position, element.slideType);
}

const WARNING_CHECKS: ReadonlySet<string> = new Set(QA_WARNING_CHECKS);

export function isWarningCheck(check: QaResult['check']): check is QaWarningCheck {
  return WARNING_CHECKS.has(check);
}

/** A failed warning check that the operator has not acknowledged yet (OD-09, OD-26). */
export function needsAcknowledgement(result: QaResult): boolean {
  return result.severity === 'warning' && result.outcome === 'fail' && result.acknowledgedAt === null;
}

/** A failed blocking check: only a regenerated version that passes resolves it (OD-09). */
export function isBlockingFailure(result: QaResult): boolean {
  return result.severity === 'blocking' && result.outcome === 'fail';
}

/**
 * Obstacles to approving the shown version, in the order of the server's guards (architecture.md section 11.1).
 * Empty for an approved version (it can be withdrawn instead) and for a version ready to approve.
 */
export function approvalObstacles(version: ElementVersion): ApprovalObstacle[] {
  if (version.state === 'approved') {
    return [];
  }
  const obstacles: ApprovalObstacle[] = [];
  if (version.state === 'superseded') {
    obstacles.push('superseded');
  }
  if (version.blocked) {
    obstacles.push('blocked');
  }
  if (version.contentFlags.length > 0) {
    obstacles.push('flagged');
  }
  if (version.state === 'qa_failed' || version.qa.some(isBlockingFailure)) {
    obstacles.push('qa_failed');
  }
  if (version.qa.some(needsAcknowledgement)) {
    obstacles.push('qa_ack_required');
  }
  if (version.state === 'pending_qa') {
    obstacles.push('pending_qa');
  }
  return obstacles;
}

export interface BulkApprovalSummary {
  approved: number;
  eligible: Element[];
  warning: Element[];
  blocked: Element[];
  pending: Element[];
  pendingCount: number;
  total: number;
}

/** Classifies only current slide versions; the server remains authoritative for every approval. */
export function bulkApprovalSummary(slides: readonly Element[]): BulkApprovalSummary {
  const summary: BulkApprovalSummary = {
    approved: 0,
    eligible: [],
    warning: [],
    blocked: [],
    pending: [],
    pendingCount: 0,
    total: slides.length,
  };
  for (const slide of slides) {
    if (slide.currentVersion.state === 'approved') {
      summary.approved += 1;
      continue;
    }
    const obstacles = approvalObstacles(slide.currentVersion);
    if (obstacles.length === 0) {
      summary.eligible.push(slide);
      continue;
    }
    if (obstacles.length === 1 && obstacles[0] === 'qa_ack_required') {
      summary.warning.push(slide);
    } else if (obstacles.length === 1 && obstacles[0] === 'pending_qa') {
      summary.pending.push(slide);
    } else {
      summary.blocked.push(slide);
    }
  }
  summary.pendingCount = summary.total - summary.approved;
  return summary;
}

/** Reasons why an element prevents the final approval, as in Problem.items of FINAL_APPROVAL_REFUSED (R-240). */
export function finalApprovalReasons(element: Element): FinalApprovalRefusalReason[] {
  const version = element.currentVersion;
  const reasons: FinalApprovalRefusalReason[] = [];
  if (version.state !== 'approved') {
    reasons.push('not_approved');
  }
  if (version.blocked) {
    reasons.push('blocked');
  }
  if (version.contentFlags.length > 0) {
    reasons.push('flagged');
  }
  if (version.state === 'qa_failed' || version.qa.some(isBlockingFailure)) {
    reasons.push('qa_failed');
  }
  if (version.qa.some(needsAcknowledgement)) {
    reasons.push('qa_ack_required');
  }
  return reasons;
}

export interface ElementRefusal {
  elementId: string;
  name: string;
  reasons: FinalApprovalRefusalReason[];
}

/** Elements of the carousel that prevent its final approval, in carousel order. */
export function finalApprovalObstacles(carousel: Carousel): ElementRefusal[] {
  // Only slides: the caption is not required for the final approval (PD-ARCH-01E-PD-02).
  return orderedElements(carousel)
    .filter((element) => element.kind === 'slide')
    .map((element) => ({ elementId: element.id, name: elementName(element), reasons: finalApprovalReasons(element) }))
    .filter((item) => item.reasons.length > 0);
}

/** True when the shown carousel has a final approval that is still valid. */
export function hasValidFinalApproval(carousel: Carousel): boolean {
  return carousel.finalApproval !== null && carousel.finalApproval.valid;
}

/**
 * What an element needs from the operator, from its shown version (UX-REVIEW-01): `blocking` when it cannot be
 * approved without a correction (non-publishable data, content flags, a failed QA, also on an approved version with
 * a blocked overlay), `warning` when a QA warning waits for confirmation, otherwise none.
 */
export type ElementIssue = 'blocking' | 'warning' | null;

export interface ElementStatus {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  symbol: string;
  issue: ElementIssue;
}

export function elementStatus(element: Element): ElementStatus {
  const version = element.currentVersion;
  if (version.blocked) {
    return { label: elementCopy.statusBlocked, tone: 'danger', symbol: '!', issue: 'blocking' };
  }
  if (version.contentFlags.length > 0 || version.state === 'qa_failed' || version.qa.some(isBlockingFailure)) {
    return { label: elementCopy.statusRegenerate, tone: 'danger', symbol: '!', issue: 'blocking' };
  }
  if (version.state === 'approved') {
    return { label: elementCopy.approvedStatus, tone: 'success', symbol: '✓', issue: null };
  }
  if (version.qa.some(needsAcknowledgement)) {
    return { label: elementCopy.statusWarning, tone: 'warning', symbol: '!', issue: 'warning' };
  }
  if (version.state === 'pending_qa') {
    return { label: elementCopy.statusPendingQa, tone: 'neutral', symbol: '…', issue: null };
  }
  if (version.state === 'superseded') {
    return { label: elementCopy.statusSuperseded, tone: 'neutral', symbol: '↻', issue: null };
  }
  return { label: elementCopy.statusReady, tone: 'info', symbol: '•', issue: null };
}

/** The editorial versions that exist (PD-ARCH-01H), in contract order; `null` while the package is not loaded. */
export function currentEditorialVersions(pkg: EditorialPackage | null): EditorialVersion[] {
  return pkg === null ? [] : pkg.deliverables.flatMap((entry) => (entry.current === null ? [] : [entry.current]));
}

/** What the carousel's download would carry of the editorial copy now (REVIEW-APPROVAL-01). */
export interface EditorialExportSummary {
  /** Deliverables with a current version. */
  readonly total: number;
  /** Deliverables the export would include: the server's `exportable` (approved, no flags, publishable data). */
  readonly exportable: number;
  /** Approved deliverables the server no longer allows to export: their sports data changed. */
  readonly needsReview: number;
}

/**
 * The editorial copy of the download, read from the server's states only (`EditorialDeliverableState.exportable`, the
 * export's own rule): no eligibility rule is computed here.
 */
export function editorialExportSummary(pkg: EditorialPackage): EditorialExportSummary {
  const generated = pkg.deliverables.filter((entry) => entry.current !== null);
  return {
    total: generated.length,
    exportable: generated.filter((entry) => entry.exportable).length,
    needsReview: generated.filter((entry) => entry.current?.state === 'approved' && !entry.exportable).length,
  };
}

export interface ReviewIndicators {
  slidesApproved: number;
  slidesTotal: number;
  /** The carousel caption plus every editorial deliverable that has a version. */
  copyApproved: number;
  copyTotal: number;
  /** True once the editorial copy has at least one version. */
  editorialGenerated: boolean;
  /** Items that cannot be approved without a correction: elements and flagged editorial deliverables. */
  blocking: number;
  /** Elements with a QA warning to confirm. */
  warnings: number;
}

/**
 * The compact indicators of the review (UX-REVIEW-01), all derived from the shown draft and editorial package: no
 * state of their own. The caption counts as copy, never as a slide (it is not required by the final approval).
 */
export function reviewIndicators(carousel: Carousel | undefined, pkg: EditorialPackage | null): ReviewIndicators {
  const elements = carousel?.elements ?? [];
  const slides = elements.filter((element) => element.kind === 'slide');
  const caption = elements.find((element) => element.kind === 'caption');
  const editorial = currentEditorialVersions(pkg);
  const statuses = elements.map(elementStatus);
  return {
    slidesApproved: slides.filter((element) => element.currentVersion.state === 'approved').length,
    slidesTotal: slides.length,
    copyApproved:
      (caption?.currentVersion.state === 'approved' ? 1 : 0) +
      editorial.filter((version) => version.state === 'approved').length,
    copyTotal: (caption === undefined ? 0 : 1) + editorial.length,
    editorialGenerated: editorial.length > 0,
    blocking:
      statuses.filter((status) => status.issue === 'blocking').length +
      editorial.filter((version) => version.state === 'flagged').length,
    warnings: statuses.filter((status) => status.issue === 'warning').length,
  };
}

/** The next slide after `currentId` (wrapping around) that is not approved yet, or undefined. */
export function nextPendingSlide(slides: readonly Element[], currentId: string): Element | undefined {
  const index = slides.findIndex((slide) => slide.id === currentId);
  return [...slides.slice(index + 1), ...slides.slice(0, Math.max(index, 0))].find(
    (slide) => slide.currentVersion.state !== 'approved',
  );
}

/** Replaces one element of the draft (the answer of an element operation). */
export function replaceElement(draft: Draft, element: Element): Draft {
  return {
    ...draft,
    carousels: draft.carousels.map((carousel) =>
      carousel.id !== element.carouselId
        ? carousel
        : { ...carousel, elements: carousel.elements.map((item) => (item.id === element.id ? element : item)) },
    ),
  };
}

/** Clear-text block reason of a fact (R-206, R-271, R-272). A missing reason is derived from the fact's status. */
export function blockReasonText(fact: FactRef): string {
  if (fact.blockReason !== undefined) {
    const text = blockReasonLabel[fact.blockReason];
    if (fact.blockReason === 'not_verified' && fact.unverifiedReason !== null) {
      return `Dato sin verificar: ${unverifiedReasonLabel[fact.unverifiedReason]}.`;
    }
    return text;
  }
  switch (fact.status) {
    case 'unverified':
      return fact.unverifiedReason === null
        ? blockReasonLabel.not_verified
        : `Dato sin verificar: ${unverifiedReasonLabel[fact.unverifiedReason]}.`;
    case 'manually_approved':
      return blockReasonLabel.manually_approved_not_publishable;
    case 'verified':
      return blockingFactCopy.reasonUnknown;
  }
}

/** Facts named by an APPROVAL_BLOCKED problem; entries that do not match the contract are dropped. */
export function problemFacts(problem: Problem | null): FactRef[] {
  if (problem === null) {
    return [];
  }
  const facts: FactRef[] = [];
  for (const item of problem.facts) {
    const parsed = FactRefSchema.safeParse(item);
    if (parsed.success) {
      facts.push(parsed.data);
    }
  }
  return facts;
}

/** Items of a FINAL_APPROVAL_REFUSED problem; entries that do not match the contract are dropped. */
export function problemItems(problem: Problem | null): { elementId: string; reason: FinalApprovalRefusalReason }[] {
  if (problem === null) {
    return [];
  }
  const items: { elementId: string; reason: FinalApprovalRefusalReason }[] = [];
  for (const item of problem.items) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const elementId = UuidSchema.safeParse(record.elementId);
    const reason = FinalApprovalRefusalReasonSchema.safeParse(record.reason);
    if (elementId.success && reason.success) {
      items.push({ elementId: elementId.data, reason: reason.data });
    }
  }
  return items;
}
