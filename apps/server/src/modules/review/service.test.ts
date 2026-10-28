/**
 * Unit tests of the review service state machine on drafts of the real content stage (stub AI, in-memory migrated
 * database, synthetic facts): approval guards with seeded facts for each block reason (R-206, R-271, R-272), each
 * accepted manual-approval policy value, a marked and an unmarked competition, a `confirmed` and an `unconfirmed`
 * LIVE_DATA source; content flags (R-207); QA failures, pending QA and warnings including `capitalized_tokens`
 * (OD-09, OD-26); withdrawal; final approval with its version set and invalidation on any change (R-240); and the
 * atomicity of every guarded write (T10-F15).
 */
import { HttpProblem, problemBody } from '../../platform/http/index.js';
import type { Db, SqlRow, Statement } from '../../platform/db/index.js';
import { AI_FIXTURE_CASES, leagueFacts } from '../content/test/support.js';
import { acceptCapitalizedTokens } from '../visual-qa/test/support.js';
import type { AppContainer } from '../../container.js';

import { afterEach, describe, expect, it } from 'vitest';

import { ReviewService } from './service.js';
import { versionSetOf } from './state.js';
import {
  CAPITALIZED_WARNING,
  type ReviewFixture,
  STYLE_WARNING,
  TEXT_FIT_FAILURE,
  markedManualConfig,
  nextId,
  reviewFixture,
  testConfig,
  withManualPolicy,
} from './test/support.js';

let env: ReviewFixture | null = null;

afterEach(() => {
  env?.close();
  env = null;
});

async function draft(options: Parameters<typeof reviewFixture>[0]): Promise<ReviewFixture> {
  env = await reviewFixture(options);
  return env;
}

/** Runs `work` and returns the problem it throws. */
function problemOf(work: () => unknown): ReturnType<typeof problemBody> {
  try {
    work();
  } catch (error) {
    if (error instanceof HttpProblem) {
      return problemBody(error);
    }
    throw error;
  }
  throw new Error('no problem was thrown');
}

function approveAll(fixture: ReviewFixture, service: ReviewService = fixture.service()): void {
  for (const row of fixture.elements()) {
    service.approveElement(row.carouselId, row.elementId, row.versionId);
  }
}

function finalApprovalRows(fixture: ReviewFixture) {
  return fixture.fixture.db
    .prepare<{ id: string; version_set: string; version_set_sha256: string; invalidated_at: string | null }>(
      'SELECT id, version_set, version_set_sha256, invalidated_at FROM final_approvals ORDER BY rowid',
    )
    .all();
}

describe('approval of verified DEMO_DATA content', () => {
  it('approves the exact current version, appends one approval row and is idempotent', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    fixture.passAll();
    const service = fixture.service();
    const match = fixture.element('match_result');

    const element = service.approveElement(match.carouselId, match.elementId, match.versionId);
    expect(element.currentVersion).toMatchObject({ id: match.versionId, state: 'approved', blocked: false });
    service.approveElement(match.carouselId, match.elementId, match.versionId);
    const rows = fixture.fixture.db
      .prepare<{ action: string }>('SELECT action FROM approvals WHERE element_version_id = ?')
      .all([match.versionId]);
    expect(rows).toEqual([{ action: 'approved' }]);
  });

  it('refuses a version that is not current with VERSION_CONFLICT and an unknown element with NOT_FOUND', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    fixture.passAll();
    const service = fixture.service();
    const match = fixture.element('match_result');
    const cover = fixture.element('cover');
    expect(problemOf(() => service.approveElement(match.carouselId, match.elementId, cover.versionId))).toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
    });
    expect(problemOf(() => service.approveElement(match.carouselId, nextId(), match.versionId))).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(problemOf(() => service.approveElement(nextId(), match.elementId, match.versionId)).code).toBe('NOT_FOUND');
  });
});

describe('APPROVAL_BLOCKED with the block reasons of the verification module (R-206, R-271, R-272)', () => {
  it('one unverified score blocks the slide and caption using it, naming the fact; other content stays approvable (R-206)', async () => {
    const facts = leagueFacts();
    const score = facts.facts.find((fact) => fact.factKey === 'match:liga-demo-1-a:score');
    if (score === undefined) {
      throw new Error('no score fact');
    }
    Object.assign(score, {
      status: 'unverified',
      unverifiedReason: 'awaiting_independent_verification',
      candidateValue: score.value,
      value: null,
    });
    const fixture = await draft({ facts });
    fixture.passAll();
    const service = fixture.service();

    const rows = fixture.elements();
    const usingScore = rows.filter((row) =>
      fixture.fixture.db
        .prepare('SELECT 1 FROM element_fact_refs WHERE element_version_id = ? AND fact_id = ?')
        .get([row.versionId, score.id]),
    );
    expect(usingScore.length).toBeGreaterThan(0);
    for (const row of usingScore) {
      const problem = problemOf(() => service.approveElement(row.carouselId, row.elementId, row.versionId));
      expect(problem).toMatchObject({ status: 409, code: 'APPROVAL_BLOCKED' });
      expect(problem.facts).toEqual([
        expect.objectContaining({
          factId: score.id,
          factKey: 'match:liga-demo-1-a:score',
          kind: 'match_score',
          status: 'unverified',
          unverifiedReason: 'awaiting_independent_verification',
          blockReason: 'not_verified',
          display: '2-1',
        }),
      ]);
    }
    const others = rows.filter((row) => !usingScore.includes(row));
    expect(others.length).toBeGreaterThan(0);
    for (const row of others) {
      expect(service.approveElement(row.carouselId, row.elementId, row.versionId).currentVersion.state).toBe(
        'approved',
      );
    }
    expect(fixture.fixture.db.prepare('SELECT COUNT(*) AS n FROM approvals').get()).toEqual({ n: others.length });
  });

  it('single-source LIVE_DATA facts are refused naming each fact as awaiting independent verification (R-271)', async () => {
    const fixture = await draft({
      facts: leagueFacts('candidate'),
      project: { sourceId: 'live-a', dataMode: 'LIVE_DATA' },
      support: { sourceId: 'live-a', mode: 'LIVE_DATA' },
      config: testConfig({ liveConfirmed: true }),
    });
    fixture.passAll();
    const match = fixture.element('match_result');
    const problem = problemOf(() =>
      fixture.service().approveElement(match.carouselId, match.elementId, match.versionId),
    );
    expect(problem.code).toBe('APPROVAL_BLOCKED');
    expect(problem.facts?.length).toBeGreaterThan(0);
    for (const fact of problem.facts ?? []) {
      expect(fact).toMatchObject({
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        blockReason: 'not_verified',
      });
    }
  });

  it('verified LIVE_DATA facts are refused while publication permission is unconfirmed, accepted once confirmed (PD-18, R-271)', async () => {
    const options = {
      facts: leagueFacts(),
      project: { sourceId: 'live-a', dataMode: 'LIVE_DATA' },
      support: { sourceId: 'live-a', mode: 'LIVE_DATA' as const },
    };
    const fixture = await draft(options);
    fixture.passAll();
    const match = fixture.element('match_result');
    const problem = problemOf(() =>
      fixture.service().approveElement(match.carouselId, match.elementId, match.versionId),
    );
    expect(problem.code).toBe('APPROVAL_BLOCKED');
    expect(new Set(problem.facts?.map((fact) => fact.blockReason))).toEqual(
      new Set(['publication_permission_unconfirmed']),
    );
    expect(problem.facts?.every((fact) => fact.status === 'verified' && fact.unverifiedReason === null)).toBe(true);

    const confirmed = fixture.service(testConfig({ liveConfirmed: true }));
    expect(confirmed.approveElement(match.carouselId, match.elementId, match.versionId).currentVersion.state).toBe(
      'approved',
    );
  });

  it('manually approved facts: accepted for a marked competition under allowed_without_accepted_source (PD-17, R-272)', async () => {
    const facts = leagueFacts('candidate');
    const fixture = await draft({
      facts,
      config: markedManualConfig(),
      project: { sourceId: 'manual-a', dataMode: 'MANUAL_DATA', competitionId: 'liga-manual' },
      manuallyApproved: facts.facts.map((fact) => fact.id),
    });
    fixture.passAll();
    const match = fixture.element('match_result');
    const element = fixture.service().approveElement(match.carouselId, match.elementId, match.versionId);
    expect(element.currentVersion.state).toBe('approved');
    // Shown as MANUALLY_APPROVED, never as verified (R-071, R-272).
    const factSegments = element.currentVersion.fields.flatMap((field) =>
      field.segments.filter((segment) => segment.provenance === 'fact'),
    );
    expect(factSegments.length).toBeGreaterThan(0);
    expect(factSegments.every((segment) => segment.factStatus === 'manually_approved')).toBe(true);
  });

  it.each([
    ['an unmarked competition', markedManualConfig(false)],
    ['the blocked policy', withManualPolicy(markedManualConfig(), 'blocked')],
    ['an unlinked competition', testConfig()],
  ])('manually approved facts: refused for %s (PD-17, R-272)', async (_name, config) => {
    const facts = leagueFacts('candidate');
    const fixture = await draft({
      facts,
      config,
      project: { sourceId: 'manual-a', dataMode: 'MANUAL_DATA', competitionId: 'liga-manual' },
      manuallyApproved: facts.facts.map((fact) => fact.id),
    });
    fixture.passAll();
    const match = fixture.element('match_result');
    const problem = problemOf(() =>
      fixture.service().approveElement(match.carouselId, match.elementId, match.versionId),
    );
    expect(problem.code).toBe('APPROVAL_BLOCKED');
    for (const fact of problem.facts ?? []) {
      expect(fact).toMatchObject({
        status: 'manually_approved',
        unverifiedReason: null,
        blockReason: 'manually_approved_not_publishable',
      });
    }
  });

  it('a revoked manual approval blocks approved content again and invalidates the final approval (R-272)', async () => {
    const facts = leagueFacts('candidate');
    const config = markedManualConfig();
    const fixture = await draft({
      facts,
      config,
      project: { sourceId: 'manual-a', dataMode: 'MANUAL_DATA', competitionId: 'liga-manual' },
      manuallyApproved: facts.facts.map((fact) => fact.id),
    });
    fixture.passAll();
    const service = fixture.service();
    approveAll(fixture, service);
    const match = fixture.element('match_result');
    const final = service.approveCarousel(match.carouselId);
    expect(final.valid).toBe(true);

    const score = facts.facts.find((fact) => fact.factKey === 'match:liga-demo-1-a:score');
    fixture.manualApproval(score?.id ?? '', 'revoked');

    // Recomputed at read time: blocked, the final approval no longer valid, a new final approval refused.
    const carousel = service.activeDraft(
      fixture.fixture.db.prepare<{ id: string }>('SELECT id FROM projects').get()?.id ?? '',
    ).carousels[0];
    const view = carousel?.elements.find((element) => element.id === match.elementId);
    expect(view?.currentVersion).toMatchObject({ state: 'approved', blocked: true });
    expect(view?.currentVersion.blockingFacts.map((fact) => fact.factId)).toContain(score?.id);
    expect(carousel?.readyForFinalApproval).toBe(false);
    expect(carousel?.finalApproval?.valid).toBe(false);
    const refused = problemOf(() => service.approveCarousel(match.carouselId));
    expect(refused.code).toBe('FINAL_APPROVAL_REFUSED');
    expect(refused.items).toContainEqual({ elementId: match.elementId, reason: 'blocked' });
    expect(problemOf(() => service.approveElement(match.carouselId, match.elementId, match.versionId)).code).toBe(
      'APPROVAL_BLOCKED',
    );
  });

  it.each([
    ['a stricter policy', withManualPolicy(markedManualConfig(), 'blocked')],
    ['a link no longer marked', markedManualConfig(false)],
  ])('%s invalidates the final approvals of affected carousels at startup', async (_name, stricter) => {
    const facts = leagueFacts('candidate');
    const fixture = await draft({
      facts,
      config: markedManualConfig(),
      project: { sourceId: 'manual-a', dataMode: 'MANUAL_DATA', competitionId: 'liga-manual' },
      manuallyApproved: facts.facts.map((fact) => fact.id),
    });
    fixture.passAll();
    approveAll(fixture);
    fixture.service().approveCarousel(fixture.element('cover').carouselId);
    expect(fixture.service().invalidateStaleFinalApprovals()).toBe(0);
    expect(finalApprovalRows(fixture)[0]?.invalidated_at).toBeNull();

    expect(fixture.service(stricter).invalidateStaleFinalApprovals()).toBe(1);
    expect(finalApprovalRows(fixture)[0]?.invalidated_at).not.toBeNull();
  });

  it('an unconfirmed publication permission invalidates final approvals of verified LIVE_DATA content at startup', async () => {
    const fixture = await draft({
      facts: leagueFacts(),
      project: { sourceId: 'live-a', dataMode: 'LIVE_DATA' },
      support: { sourceId: 'live-a', mode: 'LIVE_DATA' },
      config: testConfig({ liveConfirmed: true }),
    });
    fixture.passAll();
    approveAll(fixture);
    fixture.service().approveCarousel(fixture.element('cover').carouselId);
    expect(fixture.service(testConfig()).invalidateStaleFinalApprovals()).toBe(1);
  });
});

describe('content flags and visual QA guards', () => {
  const flagged = AI_FIXTURE_CASES.find((entry) => !entry.bypassClass && entry.expectFlag === 'UNVERIFIED_NUMBER');

  it('a flagged version is refused with CONTENT_FLAGGED (R-207)', async () => {
    if (flagged === undefined) {
      throw new Error('no UNVERIFIED_NUMBER fixture');
    }
    const fixture = await draft({ facts: leagueFacts(), scenario: flagged.scenario });
    fixture.passAll();
    const service = fixture.service();
    const flaggedRows = fixture
      .elements()
      .filter(
        (row) =>
          fixture.fixture.db
            .prepare<{ content_flags: string }>('SELECT content_flags FROM element_versions WHERE id = ?')
            .get([row.versionId])?.content_flags !== '[]',
      );
    expect(flaggedRows.length).toBeGreaterThan(0);
    for (const row of flaggedRows) {
      expect(problemOf(() => service.approveElement(row.carouselId, row.elementId, row.versionId))).toMatchObject({
        status: 409,
        code: 'CONTENT_FLAGGED',
      });
    }
  });

  it('pending QA and a blocking QA failure are refused with QA_FAILED', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    const service = fixture.service();
    const match = fixture.element('match_result');
    expect(problemOf(() => service.approveElement(match.carouselId, match.elementId, match.versionId)).code).toBe(
      'QA_FAILED',
    );
    fixture.setQa(match.versionId, 'failed', [TEXT_FIT_FAILURE]);
    expect(problemOf(() => service.approveElement(match.carouselId, match.elementId, match.versionId)).code).toBe(
      'QA_FAILED',
    );
    expect(
      service
        .activeDraft(fixture.fixture.db.prepare<{ id: string }>('SELECT id FROM projects').get()?.id ?? '')
        .carousels[0]?.elements.find((element) => element.id === match.elementId)?.currentVersion.state,
    ).toBe('qa_failed');
  });

  it.each([
    ['style_consistency', STYLE_WARNING],
    ['capitalized_tokens', CAPITALIZED_WARNING],
  ] as const)('a %s warning needs an acknowledgement before approval (OD-09, OD-26)', async (check, warning) => {
    const fixture = await draft({ facts: leagueFacts() });
    acceptCapitalizedTokens(fixture.fixture);
    const service = fixture.service();
    const row = check === 'capitalized_tokens' ? fixture.element('caption') : fixture.element('match_result');
    fixture.setQa(row.versionId, 'warnings', [warning]);

    expect(problemOf(() => service.approveElement(row.carouselId, row.elementId, row.versionId)).code).toBe(
      'QA_ACK_REQUIRED',
    );
    const acknowledged = service.acknowledgeQaWarnings(row.carouselId, row.elementId, row.versionId, [check]);
    const result = acknowledged.currentVersion.qa.find((item) => item.check === check);
    expect(result?.acknowledgedAt).not.toBeNull();
    // A second acknowledgement keeps the first time.
    const again = service.acknowledgeQaWarnings(row.carouselId, row.elementId, row.versionId, [check]);
    expect(again.currentVersion.qa.find((item) => item.check === check)?.acknowledgedAt).toBe(result?.acknowledgedAt);
    expect(service.approveElement(row.carouselId, row.elementId, row.versionId).currentVersion.state).toBe('approved');
  });

  it('acknowledging a check without a failed warning, or a version that is not current, is refused', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    const service = fixture.service();
    const match = fixture.element('match_result');
    fixture.setQa(match.versionId, 'passed', []);
    expect(
      problemOf(() =>
        service.acknowledgeQaWarnings(match.carouselId, match.elementId, match.versionId, ['style_consistency']),
      ),
    ).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(
      problemOf(() => service.acknowledgeQaWarnings(match.carouselId, match.elementId, nextId(), ['style_consistency']))
        .code,
    ).toBe('VERSION_CONFLICT');
  });
});

describe('withdrawal and final approval (R-240)', () => {
  it('refuses the final approval while any element is unapproved, listing each element and reason', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    fixture.passAll();
    const service = fixture.service();
    const rows = fixture.elements();
    const [first, ...rest] = rows;
    if (first === undefined) {
      throw new Error('no element');
    }
    service.approveElement(first.carouselId, first.elementId, first.versionId);
    const problem = problemOf(() => service.approveCarousel(first.carouselId));
    expect(problem).toMatchObject({ status: 409, code: 'FINAL_APPROVAL_REFUSED' });
    expect(problem.items).toEqual(rest.map((row) => ({ elementId: row.elementId, reason: 'not_approved' })));
    expect(finalApprovalRows(fixture)).toEqual([]);
  });

  it('records the version set and its SHA-256 once every element is approved; a repeat returns the same record', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    fixture.passAll();
    const service = fixture.service();
    approveAll(fixture, service);
    const carouselId = fixture.element('cover').carouselId;
    const final = service.approveCarousel(carouselId);
    const expected = versionSetOf(fixture.elements().map((row) => row.versionId));
    expect(final).toMatchObject({ carouselId, versionSetSha256: expected.sha256, valid: true });
    expect(finalApprovalRows(fixture)).toEqual([
      { id: final.id, version_set: expected.json, version_set_sha256: expected.sha256, invalidated_at: null },
    ]);
    expect(service.approveCarousel(carouselId).id).toBe(final.id);
    expect(finalApprovalRows(fixture)).toHaveLength(1);
  });

  it('withdrawing an approval invalidates the final approval; the element is ready again', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    fixture.passAll();
    const service = fixture.service();
    approveAll(fixture, service);
    const match = fixture.element('match_result');
    service.approveCarousel(match.carouselId);

    const element = service.withdrawElementApproval(match.carouselId, match.elementId);
    expect(element.currentVersion.state).toBe('ready');
    expect(finalApprovalRows(fixture)[0]?.invalidated_at).not.toBeNull();
    expect(
      fixture.fixture.db
        .prepare<{ action: string }>('SELECT action FROM approvals WHERE element_version_id = ? ORDER BY rowid')
        .all([match.versionId]),
    ).toEqual([{ action: 'approved' }, { action: 'withdrawn' }]);
    expect(problemOf(() => service.approveCarousel(match.carouselId)).items).toEqual([
      { elementId: match.elementId, reason: 'not_approved' },
    ]);
    // Withdrawing an unapproved version changes nothing.
    service.withdrawElementApproval(match.carouselId, match.elementId);
    expect(
      fixture.fixture.db
        .prepare('SELECT COUNT(*) AS n FROM approvals WHERE element_version_id = ?')
        .get([match.versionId]),
    ).toEqual({ n: 2 });
  });
});

describe('atomic guards (T10-F15)', () => {
  /** A Db wrapper that records whether every write statement ran inside a transaction. */
  function recordingDb(db: Db, writes: { sql: string; inTransaction: boolean }[]): Db {
    return {
      prepare: <Row extends object = SqlRow>(sql: string): Statement<Row> => {
        const statement = db.prepare<Row>(sql);
        return {
          get: (params) => statement.get(params),
          all: (params) => statement.all(params),
          run: (params) => {
            writes.push({ sql, inTransaction: db.inTransaction });
            return statement.run(params);
          },
        };
      },
      transaction: (work) => db.transaction(work),
      get inTransaction() {
        return db.inTransaction;
      },
      close: () => db.close(),
    };
  }

  it('every approval, acknowledgement, withdrawal and final-approval write runs inside a transaction', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    fixture.passAll();
    const match = fixture.element('match_result');
    fixture.setQa(match.versionId, 'warnings', [STYLE_WARNING]);
    const writes: { sql: string; inTransaction: boolean }[] = [];
    const container = fixture.container();
    const service = new ReviewService({
      container: { ...container, db: recordingDb(container.db, writes) } as AppContainer,
      newId: nextId,
    });
    service.acknowledgeQaWarnings(match.carouselId, match.elementId, match.versionId, ['style_consistency']);
    for (const row of fixture.elements()) {
      service.approveElement(row.carouselId, row.elementId, row.versionId);
    }
    service.approveCarousel(match.carouselId);
    service.withdrawElementApproval(match.carouselId, match.elementId);
    service.invalidateStaleFinalApprovals();

    expect(writes.map((write) => write.sql.split(' ').slice(0, 3).join(' '))).toEqual(
      expect.arrayContaining([
        'UPDATE qa_results SET',
        'INSERT INTO approvals',
        'INSERT INTO final_approvals',
        'UPDATE final_approvals SET',
      ]),
    );
    expect(writes.every((write) => write.inTransaction)).toBe(true);
  });

  it('a refused guard writes nothing', async () => {
    const fixture = await draft({ facts: leagueFacts() });
    const service = fixture.service();
    const match = fixture.element('match_result');
    problemOf(() => service.approveElement(match.carouselId, match.elementId, match.versionId));
    problemOf(() => service.approveCarousel(match.carouselId));
    expect(fixture.fixture.db.prepare('SELECT COUNT(*) AS n FROM approvals').get()).toEqual({ n: 0 });
    expect(finalApprovalRows(fixture)).toEqual([]);
  });
});
