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
  return orderedElements(carousel)
    .map((element) => ({ elementId: element.id, name: elementName(element), reasons: finalApprovalReasons(element) }))
    .filter((item) => item.reasons.length > 0);
}

/** True when the shown carousel has a final approval that is still valid. */
export function hasValidFinalApproval(carousel: Carousel): boolean {
  return carousel.finalApproval !== null && carousel.finalApproval.valid;
}

/** True when any fact segment or blocking fact of the draft is MANUALLY_APPROVED (operator-attested, OD-28). */
export function usesManuallyApprovedFacts(draft: Draft): boolean {
  return draft.carousels.some((carousel) =>
    carousel.elements.some(
      (element) =>
        element.currentVersion.blockingFacts.some((fact) => fact.status === 'manually_approved') ||
        element.currentVersion.fields.some((field) =>
          field.segments.some((segment) => segment.factStatus === 'manually_approved'),
        ),
    ),
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
