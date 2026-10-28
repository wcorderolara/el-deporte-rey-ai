/**
 * Manual-approval eligibility (architecture section 7.4; R-071, R-272, R-412) and publication notes (R-026, R-271,
 * R-272, R-078) derived from the contract fields.
 */
import { FactListResponseSchema, type Fact } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { latestCompletedFullRun, manualApprovalPageState, manualControlFor, publicationNoteFor } from './eligibility';
import { demoFacts, factId, liveFacts, MANUAL, manualFacts, NEWER_RUN_ID, run, RUN_ID } from './test/fixtures';

function manualFact(n: number): Fact {
  const fact = manualFacts().facts.find((item) => item.factId === factId(n));
  if (fact === undefined) {
    throw new Error(`fixture fact ${n} missing`);
  }
  return fact;
}

describe('fixtures', () => {
  it.each([
    ['DEMO_DATA', demoFacts],
    ['MANUAL_DATA', manualFacts],
    ['LIVE_DATA', liveFacts],
  ] as const)('the %s data set satisfies the contract schema', (_mode, build) => {
    expect(FactListResponseSchema.safeParse(build()).success).toBe(true);
  });
});

describe('latestCompletedFullRun', () => {
  it('skips redraft, running and failed runs (runs are newest first)', () => {
    const runs = [
      run({ id: NEWER_RUN_ID, runNumber: 4, kind: 'redraft' }),
      run({ id: '55555555-5555-4555-8555-555555555555', runNumber: 3, status: 'running' }),
      run({ id: '66666666-6666-4666-8666-666666666666', runNumber: 2, status: 'failed' }),
      run({ runNumber: 1 }),
    ];
    expect(latestCompletedFullRun(runs)?.id).toBe(RUN_ID);
  });

  it('is null when no full run completed', () => {
    expect(latestCompletedFullRun([run({ status: 'running' })])).toBeNull();
  });
});

describe('manualApprovalPageState', () => {
  it('is available only for the latest completed full run of a MANUAL_DATA project', () => {
    expect(manualApprovalPageState('MANUAL_DATA', RUN_ID, [run()])).toBe('available');
  });

  it.each(['LIVE_DATA', 'DEMO_DATA'] as const)('is not_manual_data for %s (R-412)', (mode) => {
    expect(manualApprovalPageState(mode, RUN_ID, [run()])).toBe('not_manual_data');
  });

  it('is not_latest_run when a newer full run completed', () => {
    const runs = [run({ id: NEWER_RUN_ID, runNumber: 2 }), run()];
    expect(manualApprovalPageState('MANUAL_DATA', RUN_ID, runs)).toBe('not_latest_run');
  });
});

describe('manualControlFor', () => {
  it.each([
    ['unverified, no accepted source, with a candidate value', MANUAL.eligibleNoSource],
    ['unverified, awaiting independent verification, with an agreeing accepted source', MANUAL.eligibleAwaiting],
  ])('offers approval for an eligible fact (%s)', (_label, n) => {
    expect(manualControlFor(manualFact(n), 'available')).toEqual({ kind: 'approve' });
  });

  it.each([
    [MANUAL.attestedBlocked, 'not publishable'],
    [MANUAL.attestedPublishable, 'publishable'],
  ])('offers revocation for a manually approved fact (%s, %s)', (n, _state) => {
    expect(manualControlFor(manualFact(n), 'available')).toEqual({ kind: 'revoke' });
  });

  it.each([
    [MANUAL.verified, 'verified'],
    [MANUAL.disputed, 'disputed'],
    [MANUAL.unmatched, 'team_identity_unmatched'],
    [MANUAL.acceptedDisagrees, 'accepted_source_disagrees'],
    [MANUAL.noCandidate, 'no_candidate_value'],
  ] as const)('refuses fact %i with reason %s', (n, reason) => {
    expect(manualControlFor(manualFact(n), 'available')).toEqual({ kind: 'unavailable', reason });
  });

  it('refuses an unverified fact without a reason', () => {
    const fact = { ...manualFact(MANUAL.eligibleNoSource), unverifiedReason: null } as Fact;
    expect(manualControlFor(fact, 'available')).toEqual({ kind: 'unavailable', reason: 'not_eligible' });
  });

  it.each(['not_manual_data', 'not_latest_run'] as const)('gives no control at all when the page is %s', (state) => {
    for (const fact of manualFacts().facts) {
      expect(manualControlFor(fact, state)).toEqual({ kind: 'none' });
    }
  });

  it('never offers anything for LIVE_DATA or DEMO_DATA facts (R-412)', () => {
    for (const list of [liveFacts(), demoFacts()]) {
      const state = manualApprovalPageState(list.dataMode, RUN_ID, [run()]);
      for (const fact of list.facts) {
        expect(manualControlFor(fact, state).kind).toBe('none');
      }
    }
  });
});

describe('publicationNoteFor', () => {
  it('reports the server block reason: republishing permission not confirmed (PD-18, R-078)', () => {
    expect(publicationNoteFor(liveFacts().facts[0] as Fact)).toEqual({
      kind: 'blocked',
      reason: 'publication_permission_unconfirmed',
    });
  });

  it('reports no block for a verified fact whose permission is confirmed', () => {
    expect(publicationNoteFor(liveFacts().facts[1] as Fact)).toEqual({ kind: 'no_block_reported' });
  });

  it('reports manually_approved_not_publishable for an unmarked competition (PD-17, R-026)', () => {
    expect(publicationNoteFor(manualFact(MANUAL.attestedBlocked))).toEqual({
      kind: 'blocked',
      reason: 'manually_approved_not_publishable',
    });
  });

  it('reports no block for a manually approved fact of a marked competition', () => {
    expect(publicationNoteFor(manualFact(MANUAL.attestedPublishable))).toEqual({ kind: 'no_block_reported' });
  });

  it('always blocks an unverified fact, even when the server omits the reason', () => {
    expect(publicationNoteFor(manualFact(MANUAL.eligibleNoSource))).toEqual({
      kind: 'blocked',
      reason: 'not_verified',
    });
  });
});
