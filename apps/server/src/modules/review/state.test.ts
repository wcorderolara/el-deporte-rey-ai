/**
 * Unit tests of the element-version state machine and the approval guards (architecture.md sections 11.1 and 11.2;
 * R-206, R-207, R-240; OD-09, OD-26). Pure functions over synthetic snapshots.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type QaSnapshot,
  type VersionSnapshot,
  approvalRefusal,
  finalApprovalReasons,
  sameVersionSet,
  versionSetOf,
  versionState,
} from './state.js';

function snapshot(overrides: Partial<VersionSnapshot> = {}): VersionSnapshot {
  return {
    superseded: false,
    qaStatus: 'passed',
    approved: false,
    blocked: false,
    flagged: false,
    qa: [],
    ...overrides,
  };
}

const WARNING: QaSnapshot = { severity: 'warning', outcome: 'fail', acknowledged: false };
const ACKNOWLEDGED: QaSnapshot = { severity: 'warning', outcome: 'fail', acknowledged: true };
const BLOCKING: QaSnapshot = { severity: 'blocking', outcome: 'fail', acknowledged: false };
const PASSED: QaSnapshot = { severity: 'blocking', outcome: 'pass', acknowledged: false };

describe('versionState (section 11.1)', () => {
  it.each([
    ['pending QA', snapshot({ qaStatus: 'pending' }), 'pending_qa'],
    ['a blocking QA failure', snapshot({ qaStatus: 'failed', qa: [BLOCKING] }), 'qa_failed'],
    [
      'a stored blocking failure even with another status',
      snapshot({ qaStatus: 'warnings', qa: [BLOCKING] }),
      'qa_failed',
    ],
    ['QA passed', snapshot({ qa: [PASSED] }), 'ready'],
    ['QA warnings', snapshot({ qaStatus: 'warnings', qa: [WARNING] }), 'ready'],
    ['an approval', snapshot({ approved: true }), 'approved'],
    ['a superseded version', snapshot({ superseded: true, approved: true }), 'superseded'],
  ] as const)('%s gives %s', (_name, version, state) => {
    expect(versionState(version)).toBe(state);
  });

  it('a blocked approved version stays approved and is reported as blocked by the overlay', () => {
    expect(versionState(snapshot({ approved: true, blocked: true }))).toBe('approved');
  });
});

describe('approvalRefusal (guard order)', () => {
  it('accepts a current, publishable, unflagged version whose QA passed', () => {
    expect(approvalRefusal(snapshot({ qa: [PASSED] }), true)).toBeNull();
  });

  it('accepts a version whose warnings are all acknowledged', () => {
    expect(approvalRefusal(snapshot({ qaStatus: 'warnings', qa: [ACKNOWLEDGED, PASSED] }), true)).toBeNull();
  });

  it.each([
    ['not current', snapshot(), false, 'VERSION_CONFLICT'],
    ['superseded', snapshot({ superseded: true }), true, 'VERSION_CONFLICT'],
    ['blocked (R-206)', snapshot({ blocked: true }), true, 'APPROVAL_BLOCKED'],
    ['flagged (R-207)', snapshot({ flagged: true }), true, 'CONTENT_FLAGGED'],
    ['pending QA', snapshot({ qaStatus: 'pending' }), true, 'QA_FAILED'],
    ['QA failed', snapshot({ qaStatus: 'failed', qa: [BLOCKING] }), true, 'QA_FAILED'],
    ['an unacknowledged warning', snapshot({ qaStatus: 'warnings', qa: [WARNING] }), true, 'QA_ACK_REQUIRED'],
  ] as const)('refuses a version that is %s', (_name, version, current, code) => {
    expect(approvalRefusal(version, current)?.code).toBe(code);
  });

  it('applies the guards in the order of the architecture', () => {
    const everything = snapshot({ blocked: true, flagged: true, qaStatus: 'failed', qa: [BLOCKING, WARNING] });
    expect(approvalRefusal(everything, false)?.code).toBe('VERSION_CONFLICT');
    expect(approvalRefusal(everything, true)?.code).toBe('APPROVAL_BLOCKED');
    expect(approvalRefusal({ ...everything, blocked: false }, true)?.code).toBe('CONTENT_FLAGGED');
    expect(approvalRefusal({ ...everything, blocked: false, flagged: false }, true)?.code).toBe('QA_FAILED');
    expect(
      approvalRefusal({ ...everything, blocked: false, flagged: false, qaStatus: 'warnings', qa: [WARNING] }, true)
        ?.code,
    ).toBe('QA_ACK_REQUIRED');
  });

  it('refusal details are fixed text', () => {
    expect(approvalRefusal(snapshot({ blocked: true }), true)?.detail).toMatch(/^[A-Z][^<>]*\.$/);
  });
});

describe('finalApprovalReasons (R-240)', () => {
  it('an approved, publishable version prevents nothing', () => {
    expect(finalApprovalReasons(snapshot({ approved: true }))).toEqual([]);
  });

  it('an element without a current version is not approved', () => {
    expect(finalApprovalReasons(null)).toEqual(['not_approved']);
  });

  it('lists every applicable reason in guard order', () => {
    expect(
      finalApprovalReasons(snapshot({ blocked: true, flagged: true, qaStatus: 'failed', qa: [BLOCKING, WARNING] })),
    ).toEqual(['not_approved', 'blocked', 'flagged', 'qa_failed', 'qa_ack_required']);
    expect(finalApprovalReasons(snapshot())).toEqual(['not_approved']);
    expect(finalApprovalReasons(snapshot({ qaStatus: 'pending' }))).toEqual(['not_approved']);
  });

  it('an approved version blocked again (revoked manual approval, stricter policy) prevents the final approval', () => {
    expect(finalApprovalReasons(snapshot({ approved: true, blocked: true }))).toEqual(['blocked']);
  });
});

describe('version sets', () => {
  const a = '00000000-0000-4000-8000-00000000000a';
  const b = '00000000-0000-4000-8000-00000000000b';
  const c = '00000000-0000-4000-8000-00000000000c';

  it('are sorted, stored as JSON and hashed with SHA-256 over the stored text', () => {
    const set = versionSetOf([c, a, b]);
    expect(set.ids).toEqual([a, b, c]);
    expect(set.json).toBe(JSON.stringify([a, b, c]));
    expect(set.sha256).toBe(createHash('sha256').update(set.json, 'utf8').digest('hex'));
    expect(set.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('do not depend on the order of the IDs and change with any ID', () => {
    expect(versionSetOf([a, b]).sha256).toBe(versionSetOf([b, a]).sha256);
    expect(versionSetOf([a, b]).sha256).not.toBe(versionSetOf([a, c]).sha256);
    expect(sameVersionSet([a, b], [b, a])).toBe(true);
    expect(sameVersionSet([a, b], [a, b, c])).toBe(false);
  });
});
