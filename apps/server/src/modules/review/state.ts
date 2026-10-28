/**
 * Element-version state machine and approval guards (architecture.md sections 11.1 and 11.2; AD-13; R-039, R-206,
 * R-207, R-240, R-405, R-406; OD-09). Pure functions over a snapshot of one stored element version; the review
 * service reads the snapshot and applies the guards inside one synchronous `BEGIN IMMEDIATE` transaction (T10-F15).
 *
 * ```
 *                  render+QA done, no blocking failure
 *   pending_qa -----------------------------------------> ready --approve--> approved
 *       |                                                  ^  |                 |
 *       | blocking QA failure                              |  | withdraw        |
 *       v                                                  |  +<----------------+
 *   qa_failed                                              |
 *   (any state) --regenerate / new draft--> superseded; the element gets a new version in pending_qa
 * ```
 *
 * QA results are treated generically by severity and outcome, never by check name, so every stored warning (for
 * example `style_consistency` and `capitalized_tokens`, OD-26) needs an acknowledgement and every stored blocking
 * failure refuses the approval.
 */
import { createHash } from 'node:crypto';

import type { ElementVersionState, FinalApprovalRefusalReason } from '@edr/contracts';

/** `element_versions.qa_status`. */
export type StoredQaStatus = 'pending' | 'passed' | 'failed' | 'warnings';

/** One stored QA result as the guards see it. */
export interface QaSnapshot {
  readonly severity: 'blocking' | 'warning';
  readonly outcome: 'pass' | 'fail';
  readonly acknowledged: boolean;
}

/** What the guards need to know about one element version. */
export interface VersionSnapshot {
  /** `superseded_at` is set (regeneration or new draft). */
  readonly superseded: boolean;
  readonly qaStatus: StoredQaStatus;
  /** The latest approval row of the version is `approved` (append-only rows, the latest decides; R-405). */
  readonly approved: boolean;
  /** A referenced fact is not publishable (derived at read and approval time; R-026, R-271, R-272). */
  readonly blocked: boolean;
  /** The version has at least one content flag (R-027, R-207). */
  readonly flagged: boolean;
  readonly qa: readonly QaSnapshot[];
}

/** A failed blocking QA check, or a `failed` QA status (OD-09). */
export function hasBlockingQaFailure(version: VersionSnapshot): boolean {
  return (
    version.qaStatus === 'failed' ||
    version.qa.some((result) => result.severity === 'blocking' && result.outcome === 'fail')
  );
}

/** A failed warning check that has not been acknowledged (OD-09, OD-26). */
export function hasUnacknowledgedWarning(version: VersionSnapshot): boolean {
  return version.qa.some(
    (result) => result.severity === 'warning' && result.outcome === 'fail' && !result.acknowledged,
  );
}

/** The contract state of a version (`ElementVersion.state`). */
export function versionState(version: VersionSnapshot): ElementVersionState {
  if (version.superseded) {
    return 'superseded';
  }
  if (version.qaStatus === 'pending') {
    return 'pending_qa';
  }
  if (hasBlockingQaFailure(version)) {
    return 'qa_failed';
  }
  return version.approved ? 'approved' : 'ready';
}

/** Problem codes of a refused element approval, in guard order (architecture.md section 11.1). */
export type ApprovalRefusalCode =
  'VERSION_CONFLICT' | 'APPROVAL_BLOCKED' | 'CONTENT_FLAGGED' | 'QA_FAILED' | 'QA_ACK_REQUIRED';

export interface ApprovalRefusal {
  readonly code: ApprovalRefusalCode;
  /** Fixed text (T10-F10). */
  readonly detail: string;
}

const REFUSALS = {
  notCurrent: { code: 'VERSION_CONFLICT', detail: 'The version is not the current version of the element.' },
  blocked: {
    code: 'APPROVAL_BLOCKED',
    detail: 'The version uses facts that are not publishable; the facts are listed with their block reasons.',
  },
  flagged: { code: 'CONTENT_FLAGGED', detail: 'The version has content flags; regenerate the element.' },
  qaPending: { code: 'QA_FAILED', detail: 'Visual QA has not completed for this version.' },
  qaFailed: { code: 'QA_FAILED', detail: 'The version failed a blocking visual QA check; regenerate the element.' },
  qaAck: { code: 'QA_ACK_REQUIRED', detail: 'Every visual QA warning of the version must be acknowledged first.' },
} as const satisfies Record<string, ApprovalRefusal>;

/**
 * Why an approval of a version is refused, or null when it may be approved. Guard order: the version is current
 * (`VERSION_CONFLICT`); every referenced fact is publishable (`APPROVAL_BLOCKED`); no content flag
 * (`CONTENT_FLAGGED`); QA completed without a blocking failure (`QA_FAILED`); every warning acknowledged
 * (`QA_ACK_REQUIRED`).
 */
export function approvalRefusal(version: VersionSnapshot, current: boolean): ApprovalRefusal | null {
  if (!current || version.superseded) {
    return REFUSALS.notCurrent;
  }
  if (version.blocked) {
    return REFUSALS.blocked;
  }
  if (version.flagged) {
    return REFUSALS.flagged;
  }
  if (version.qaStatus === 'pending') {
    return REFUSALS.qaPending;
  }
  if (hasBlockingQaFailure(version)) {
    return REFUSALS.qaFailed;
  }
  if (hasUnacknowledgedWarning(version)) {
    return REFUSALS.qaAck;
  }
  return null;
}

/**
 * Why an element prevents the final approval of its carousel (contract `Problem.items[].reason`; R-240): every
 * applicable reason, in guard order. Empty when its current version is approved and not blocked. An element without
 * a current version is `not_approved`.
 */
export function finalApprovalReasons(version: VersionSnapshot | null): FinalApprovalRefusalReason[] {
  if (version === null) {
    return ['not_approved'];
  }
  const reasons: FinalApprovalRefusalReason[] = [];
  if (versionState(version) !== 'approved') {
    reasons.push('not_approved');
  }
  if (version.blocked) {
    reasons.push('blocked');
  }
  if (version.flagged) {
    reasons.push('flagged');
  }
  if (hasBlockingQaFailure(version)) {
    reasons.push('qa_failed');
  }
  if (hasUnacknowledgedWarning(version)) {
    reasons.push('qa_ack_required');
  }
  return reasons;
}

/** A recorded version set: the sorted element version IDs as stored JSON text and its SHA-256 (R-240). */
export interface VersionSet {
  readonly ids: readonly string[];
  /** The `final_approvals.version_set` text: a JSON array of the sorted IDs. */
  readonly json: string;
  /** SHA-256 (lowercase hex) of the UTF-8 bytes of `json`. */
  readonly sha256: string;
}

/** The version set of a carousel's current versions (order-independent). */
export function versionSetOf(versionIds: readonly string[]): VersionSet {
  const ids = [...versionIds].sort();
  const json = JSON.stringify(ids);
  return { ids, json, sha256: createHash('sha256').update(json, 'utf8').digest('hex') };
}

/** True when two version sets hold the same IDs. */
export function sameVersionSet(left: readonly string[], right: readonly string[]): boolean {
  return versionSetOf(left).json === versionSetOf(right).json;
}
