/**
 * Which manual-approval control a fact gets, and what the view says about publication approval.
 *
 * The contract does not expose the stored manual eligibility, so the view applies the rule of `architecture.md`
 * section 7.4 to the contract fields: the project's data mode is MANUAL_DATA; the run is the project's latest
 * completed full run; the fact is unverified with reason `no_accepted_source` or `awaiting_independent_verification`
 * (never disputed or with an unmatched team); it has a candidate value; and no accepted source disagrees with it.
 * LIVE_DATA, DEMO_DATA and disputed facts never get a control (R-412, R-071, R-272). The server stays authoritative:
 * a refusal it returns is shown with its reason. No control sets a fact to verified (R-412).
 */
import type { BlockReason, DataMode, Fact, RefusalReason, RunListResponse } from '@edr/contracts';

type Run = RunListResponse['runs'][number];

/** Why an individual fact of an eligible run cannot be manually approved. */
export type IneligibleReason =
  | Extract<RefusalReason, 'verified' | 'disputed' | 'team_identity_unmatched' | 'accepted_source_disagrees'>
  | 'no_candidate_value'
  | 'not_eligible';

export type ManualControl =
  | { kind: 'approve' }
  | { kind: 'revoke' }
  | { kind: 'unavailable'; reason: IneligibleReason }
  /** No per-fact control or reason: the page-level note explains why (see `manualApprovalPageState`). */
  | { kind: 'none' };

/** Page-level state of manual approval for the viewed run. */
export type ManualApprovalPageState = 'available' | Extract<RefusalReason, 'not_manual_data' | 'not_latest_run'>;

/** The project's latest completed full run (runs are listed newest first), or null. */
export function latestCompletedFullRun(runs: readonly Run[]): Run | null {
  return runs.find((run) => run.kind === 'full' && run.status === 'completed') ?? null;
}

export function manualApprovalPageState(
  dataMode: DataMode,
  runId: string,
  runs: readonly Run[],
): ManualApprovalPageState {
  if (dataMode !== 'MANUAL_DATA') {
    return 'not_manual_data';
  }
  return latestCompletedFullRun(runs)?.id === runId ? 'available' : 'not_latest_run';
}

function acceptedSourceDisagrees(fact: Fact): boolean {
  return fact.evidence.some((evidence) => evidence.accepted && evidence.relation === 'disagrees');
}

export function manualControlFor(fact: Fact, pageState: ManualApprovalPageState): ManualControl {
  if (pageState !== 'available') {
    return { kind: 'none' };
  }
  switch (fact.status) {
    case 'manually_approved':
      return { kind: 'revoke' };
    case 'verified':
      return { kind: 'unavailable', reason: 'verified' };
    case 'unverified':
      break;
  }
  switch (fact.unverifiedReason) {
    case 'disputed':
      return { kind: 'unavailable', reason: 'disputed' };
    case 'team_identity_unmatched':
      return { kind: 'unavailable', reason: 'team_identity_unmatched' };
    case 'no_accepted_source':
    case 'awaiting_independent_verification':
      break;
    default:
      return { kind: 'unavailable', reason: 'not_eligible' };
  }
  if (acceptedSourceDisagrees(fact)) {
    return { kind: 'unavailable', reason: 'accepted_source_disagrees' };
  }
  if (fact.candidateValue === null) {
    return { kind: 'unavailable', reason: 'no_candidate_value' };
  }
  return { kind: 'approve' };
}

/**
 * Publication approval note of a fact (architecture section 7.4): the block reason given by the server; an
 * unverified fact always blocks (`not_verified`) even when the server omits the reason. Otherwise the view says
 * only that no block is reported, never that the fact is verified.
 */
export type PublicationNote = { kind: 'blocked'; reason: BlockReason } | { kind: 'no_block_reported' };

export function publicationNoteFor(fact: Fact): PublicationNote {
  if (fact.blockReason !== undefined) {
    return { kind: 'blocked', reason: fact.blockReason };
  }
  if (fact.status === 'unverified') {
    return { kind: 'blocked', reason: 'not_verified' };
  }
  return { kind: 'no_block_reported' };
}
