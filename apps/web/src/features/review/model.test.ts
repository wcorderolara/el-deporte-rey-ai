/** Pure helpers of the review feature: order, obstacles, block reasons and problem parsing. */
import { describe, expect, it } from 'vitest';

import type { Problem } from '../../api/types';
import {
  approvalObstacles,
  blockReasonText,
  bulkApprovalSummary,
  finalApprovalObstacles,
  finalApprovalReasons,
  orderedElements,
  problemFacts,
  problemItems,
  usesManuallyApprovedFacts,
} from './model';
import {
  blockingFact,
  caption,
  carousel,
  draft,
  elementId,
  factId,
  factSegment,
  PASSING_QA,
  slide,
  version,
} from './test/support';

function problemWith(members: Partial<Problem>): Problem {
  return {
    type: 'about:blank',
    title: '',
    status: 409,
    code: 'APPROVAL_BLOCKED',
    detail: null,
    errors: [],
    importErrors: [],
    retryAfterSeconds: null,
    refusalReason: null,
    facts: [],
    items: [],
    ...members,
  };
}

describe('orderedElements (R-215)', () => {
  it('orders slides by position and puts the caption last', () => {
    const value = carousel([caption(9, 0), slide(3, 3, 'closing'), slide(1, 1, 'cover'), slide(2, 2, 'standings')]);
    expect(orderedElements(value).map((element) => element.id)).toEqual([
      elementId(1),
      elementId(2),
      elementId(3),
      elementId(9),
    ]);
  });
});

describe('approvalObstacles', () => {
  it('is empty for a ready version and for an approved version', () => {
    expect(approvalObstacles(version(1))).toEqual([]);
    expect(approvalObstacles(version(1, { state: 'approved', blocked: true }))).toEqual([]);
  });

  it('lists every obstacle in the order of the server guards', () => {
    const qa = PASSING_QA.map((result) =>
      result.check === 'dimensions'
        ? { ...result, outcome: 'fail' as const }
        : result.check === 'style_consistency'
          ? { ...result, outcome: 'fail' as const }
          : result,
    );
    expect(
      approvalObstacles(
        version(1, {
          blocked: true,
          contentFlags: [{ code: 'FORBIDDEN_CONTENT', field: 'headline', excerpt: 'x' }],
          qa,
        }),
      ),
    ).toEqual(['blocked', 'flagged', 'qa_failed', 'qa_ack_required']);
    expect(approvalObstacles(version(1, { state: 'pending_qa', qa: [] }))).toEqual(['pending_qa']);
    expect(approvalObstacles(version(1, { state: 'superseded' }))).toEqual(['superseded']);
  });

  it('does not require an acknowledged warning again', () => {
    const qa = PASSING_QA.map((result) =>
      result.check === 'capitalized_tokens'
        ? { ...result, outcome: 'fail' as const, acknowledgedAt: '2026-10-27T12:00:00Z' }
        : result,
    );
    expect(approvalObstacles(version(1, { qa }))).toEqual([]);
  });
});

describe('bulkApprovalSummary', () => {
  it('separates eligible current slides, approvals, warning acknowledgements, and blockers', () => {
    const warningQa = PASSING_QA.map((result) =>
      result.check === 'capitalized_tokens' ? { ...result, outcome: 'fail' as const } : result,
    );
    const approvedSlide = slide(1, 1, 'cover', { state: 'approved' });
    const readySlide = slide(2, 2, 'match_result');
    const warningSlide = slide(3, 3, 'match_result', { qa: warningQa });
    const blockedSlide = slide(4, 4, 'closing', { blocked: true });
    const summary = bulkApprovalSummary([approvedSlide, readySlide, warningSlide, blockedSlide]);
    expect(summary).toMatchObject({
      approved: 1,
      eligible: [readySlide],
      warning: [warningSlide],
      blocked: [blockedSlide],
      pending: [],
      pendingCount: 3,
      total: 4,
    });
  });
});

describe('finalApprovalReasons and finalApprovalObstacles (R-240)', () => {
  it('names each element that prevents the final approval', () => {
    const value = carousel([
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { blocked: true }),
      caption(3, 3),
    ]);
    expect(finalApprovalObstacles(value)).toEqual([
      { elementId: elementId(2), name: 'Diapositiva 2: Resultado', reasons: ['not_approved', 'blocked'] },
      { elementId: elementId(3), name: 'Texto de publicación y hashtags', reasons: ['not_approved'] },
    ]);
  });

  it('reports a blocked overlay on an approved version (a revoked manual approval blocks again)', () => {
    expect(finalApprovalReasons(slide(1, 1, 'cover', { state: 'approved', blocked: true }))).toEqual(['blocked']);
  });
});

describe('blockReasonText (R-206, R-271, R-272)', () => {
  it('gives each block reason in clear text', () => {
    expect(blockReasonText(blockingFact({ factId: factId(1) }))).toBe(
      'Dato sin verificar: pendiente de verificación independiente.',
    );
    expect(
      blockReasonText(blockingFact({ factId: factId(1), unverifiedReason: 'disputed', blockReason: 'not_verified' })),
    ).toBe('Dato sin verificar: en disputa entre fuentes.');
    expect(
      blockReasonText(
        blockingFact({
          factId: factId(1),
          status: 'verified',
          unverifiedReason: null,
          blockReason: 'publication_permission_unconfirmed',
        }),
      ),
    ).toBe('Permiso de republicación no confirmado.');
    expect(
      blockReasonText(
        blockingFact({
          factId: factId(1),
          status: 'manually_approved',
          unverifiedReason: null,
          blockReason: 'manually_approved_not_publishable',
        }),
      ),
    ).toContain('Aprobación manual no publicable con la política actual');
  });

  it('derives the reason from the status when the server gives none', () => {
    const { blockReason: _unused, ...withoutReason } = blockingFact({ factId: factId(1) });
    expect(blockReasonText(withoutReason)).toBe('Dato sin verificar: pendiente de verificación independiente.');
    expect(blockReasonText({ ...withoutReason, status: 'manually_approved', unverifiedReason: null })).toContain(
      'Aprobación manual no publicable',
    );
    expect(blockReasonText({ ...withoutReason, status: 'verified', unverifiedReason: null })).toBe('No publicable.');
  });
});

describe('problem details', () => {
  it('keeps only the facts and items that match the contract', () => {
    const fact = blockingFact({ factId: factId(1) });
    expect(problemFacts(problemWith({ facts: [fact, { factId: 'x' }, null, 'text'] }))).toEqual([fact]);
    expect(
      problemItems(
        problemWith({
          items: [
            { elementId: elementId(1), reason: 'qa_failed' },
            { elementId: elementId(2), reason: 'unknown' },
            { elementId: 'bad', reason: 'blocked' },
            null,
          ],
        }),
      ),
    ).toEqual([{ elementId: elementId(1), reason: 'qa_failed' }]);
    expect(problemFacts(null)).toEqual([]);
    expect(problemItems(null)).toEqual([]);
  });
});

describe('usesManuallyApprovedFacts (OD-28)', () => {
  it('detects a manually approved fact segment', () => {
    expect(usesManuallyApprovedFacts(draft())).toBe(false);
    const attested = slide(1, 1, 'match_result', {
      fields: [{ field: 'team_home', segments: [factSegment('Equipo', factId(5), 'manually_approved')] }],
    });
    expect(usesManuallyApprovedFacts(draft({ carousels: [carousel([attested])] }))).toBe(true);
  });
});
