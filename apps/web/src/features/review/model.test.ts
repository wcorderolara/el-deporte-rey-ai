/** Pure helpers of the review feature: order, obstacles, block reasons and problem parsing. */
import { describe, expect, it } from 'vitest';

import type { Problem } from '../../api/types';
import {
  approvalObstacles,
  blockReasonText,
  bulkApprovalSummary,
  elementStatus,
  finalApprovalObstacles,
  finalApprovalReasons,
  nextPendingSlide,
  orderedElements,
  problemFacts,
  problemItems,
  reviewIndicators,
} from './model';
import {
  blockingFact,
  caption,
  carousel,
  editorialPackage,
  elementId,
  factId,
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
  it('names each slide that prevents the final approval; the caption is not required (PD-ARCH-01E-PD-02)', () => {
    const value = carousel([
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { blocked: true }),
      caption(3, 3),
    ]);
    expect(finalApprovalObstacles(value)).toEqual([
      { elementId: elementId(2), name: 'Diapositiva 2: Resultado', reasons: ['not_approved', 'blocked'] },
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

describe('elementStatus (UX-REVIEW-01)', () => {
  const warning = PASSING_QA.map((result) =>
    result.check === 'capitalized_tokens' ? { ...result, outcome: 'fail' as const } : result,
  );

  it('names what each slide needs, as text with a symbol', () => {
    expect(elementStatus(slide(1, 1, 'cover', { state: 'approved' }))).toMatchObject({
      label: 'Aprobada',
      issue: null,
      symbol: '✓',
    });
    expect(elementStatus(slide(1, 1, 'cover'))).toMatchObject({ label: 'Lista para aprobar', issue: null });
    expect(elementStatus(slide(1, 1, 'cover', { qa: warning }))).toMatchObject({
      label: 'Advertencia por confirmar',
      issue: 'warning',
    });
    expect(elementStatus(slide(1, 1, 'cover', { state: 'pending_qa', qa: [] }))).toMatchObject({ issue: null });
    expect(elementStatus(slide(1, 1, 'cover', { state: 'qa_failed' }))).toMatchObject({
      label: 'Requiere regenerar',
      issue: 'blocking',
    });
    expect(
      elementStatus(
        slide(1, 1, 'cover', { contentFlags: [{ code: 'FORBIDDEN_CONTENT', field: 'title', excerpt: 'x' }] }),
      ),
    ).toMatchObject({ issue: 'blocking' });
  });

  it('reports a blocked overlay even on an approved version', () => {
    expect(elementStatus(slide(1, 1, 'cover', { state: 'approved', blocked: true }))).toMatchObject({
      label: 'Bloqueada por datos',
      issue: 'blocking',
    });
  });
});

describe('reviewIndicators (UX-REVIEW-01)', () => {
  it('counts slides apart from the caption, and the caption with the editorial deliverables as copy', () => {
    const shown = carousel([
      slide(1, 1, 'cover', { state: 'approved' }),
      slide(2, 2, 'match_result', { blocked: true }),
      slide(3, 3, 'closing', {
        qa: PASSING_QA.map((result) =>
          result.check === 'style_consistency' ? { ...result, outcome: 'fail' as const } : result,
        ),
      }),
      caption(4, 4, { state: 'approved' }),
    ]);
    const base = editorialPackage();
    const flagged = {
      id: 'b0000000-0000-4000-8000-000000000001',
      deliverable: 'tiktok_reels' as const,
      versionNumber: 1,
      origin: 'generated' as const,
      state: 'flagged' as const,
      flags: [{ code: 'FORMAT_RULE' as const, field: 'copy', excerpt: 'x' }],
      generationId: null,
      instructions: null,
      eventIds: [],
      evidenceIds: [],
      fields: [{ name: 'copy' as const, text: 'x', words: 1, characters: 1 }],
      createdAt: '2026-11-10T10:00:00Z',
      approvedAt: null,
    };
    const pkg = {
      ...base,
      deliverables: base.deliverables.map((entry) =>
        entry.deliverable === 'tiktok_reels' ? { ...entry, current: flagged, versionCount: 1 } : entry,
      ),
    };
    expect(reviewIndicators(shown, pkg)).toEqual({
      slidesApproved: 1,
      slidesTotal: 3,
      copyApproved: 1,
      copyTotal: 2,
      editorialGenerated: true,
      blocking: 2,
      warnings: 1,
    });
    // Before the editorial package is read, only the caption counts as copy.
    expect(reviewIndicators(shown, null)).toMatchObject({ copyApproved: 1, copyTotal: 1, editorialGenerated: false });
    expect(reviewIndicators(undefined, null)).toMatchObject({ slidesTotal: 0, copyTotal: 0, blocking: 0 });
  });
});

describe('nextPendingSlide (UX-REVIEW-01)', () => {
  it('finds the next slide that is not approved, wrapping around and skipping approved ones', () => {
    const slides = [slide(1, 1, 'cover'), slide(2, 2, 'match_result', { state: 'approved' }), slide(3, 3, 'closing')];
    expect(nextPendingSlide(slides, elementId(1))?.id).toBe(elementId(3));
    expect(nextPendingSlide(slides, elementId(3))?.id).toBe(elementId(1));
    expect(nextPendingSlide([slides[1]!], elementId(2))).toBeUndefined();
  });
});
