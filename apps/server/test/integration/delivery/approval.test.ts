/**
 * Approval through the HTTP API (architecture.md sections 7.4, 11.1 and 11.2; T37 guards in the order VERSION_CONFLICT,
 * APPROVAL_BLOCKED, CONTENT_FLAGGED, QA_FAILED, QA_ACK_REQUIRED; warnings acknowledged from the draft view, never
 * assuming a version passed QA without them):
 * - a blocked approval names the unverified fact while content that does not use it stays approvable (R-206);
 * - final approval refused while any element is unapproved or blocked, export refused without it, both succeed once
 *   everything is approved (R-216, R-240); withdrawal invalidates the final approval;
 * - regenerating one slide changes only that slide, which goes through QA and needs approval again (R-217);
 * - single-source content: DEMO_DATA with the verification source disabled, and LIVE_DATA without a secondary source,
 *   drafted and refused naming the single-source fact; LIVE_DATA verified by an independent `test-live` secondary is
 *   refused while the publication permission is unconfirmed and approvable and exportable once a decision confirms it,
 *   both states set through the test's configuration only (R-271, PD-18, OD-29);
 * - MANUALLY_APPROVED content: approvable and exported operator-attested for a competition marked
 *   `noAcceptedPublicSource` with pinned names, blocked again by a revoked manual approval; refused naming the fact for
 *   an unlinked manual competition (R-272, PD-17, AD-38).
 */
import { type Draft, type Element, ElementSchema, type Fact } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { type Json, type TestApp, expectNoNetworkViolations, sourcesOf } from '../../support/index.js';
import { LIVE_SOURCE_ID, cleanups, scriptedReplay, start, startLive } from '../ingestion/support.js';

import {
  type Client,
  LIGA_MANUAL_MD1,
  MARKED_MD1,
  acknowledgeWarnings,
  allElements,
  approve,
  approveCarousel,
  approveDraft,
  approveFactsManually,
  approveOne,
  captionOf,
  draftOf,
  elementPath,
  excludeMatches,
  expectProblem,
  exportCarousel,
  exported,
  factsOf,
  finalApprovalRows,
  finalApprove,
  ligaDemo,
  manifestOf,
  manualRootedApp,
  projectWithDraft,
  slidesOfType,
  traceOf,
  WORKFLOW_TEST_TIMEOUT,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const REFERENCE_MD1 = {
  competitionId: 'copa-continental',
  sourceId: LIVE_SOURCE_ID,
  seasonId: '2026',
  stageId: 'league-stage',
  matchday: 1,
} as const;

function firstCarousel(draft: Draft): Draft['carousels'][number] {
  const carousel = draft.carousels[0];
  if (carousel === undefined) {
    throw new Error('the draft has no carousel');
  }
  return carousel;
}

/** Acknowledges warnings and tries to approve; returns the problem of the refusal (must be refused). */
async function refusedApproval(c: Client, element: Element, code: string) {
  await acknowledgeWarnings(c, element);
  return expectProblem(await approve(c, element), 409, code as never);
}

// ---------------------------------------------------------------------------------------------------------------
// R-206, R-216, R-240
// ---------------------------------------------------------------------------------------------------------------

describe('blocked facts and explicit approval (R-206, R-216, R-240)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('approval of content using an unverified score is refused naming the fact; other content stays approvable', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'single-source' });
    const { project, run } = await projectWithDraft(t, ligaDemo(1));
    const facts = (await factsOf(t, project.id, run.id)).facts;
    const unverified = facts.filter((fact) => fact.status === 'unverified');
    expect(unverified.length).toBeGreaterThan(0);
    expect(new Set(unverified.map((fact) => fact.unverifiedReason))).toEqual(
      new Set(['awaiting_independent_verification']),
    );
    const unverifiedIds = new Set(unverified.map((fact) => fact.factId));
    const draft = await draftOf(t, project.id);
    const carousel = firstCarousel(draft);
    const usesUnverified = (element: Element) =>
      element.currentVersion.fields.some((field) => field.segments.some((s) => unverifiedIds.has(String(s.factId))));
    const blocked = carousel.elements.filter(usesUnverified);
    // The match slide of that match and the caption that mentions its score.
    expect(blocked.map((element) => element.kind).sort()).toEqual(['caption', 'slide']);
    for (const element of blocked) {
      expect(element.currentVersion.blocked).toBe(true);
      const problem = await refusedApproval(t, element, 'APPROVAL_BLOCKED');
      const score = unverified.find((fact) => fact.kind === 'match_score') as Fact;
      expect(problem.facts?.map((fact) => fact.factKey)).toContain(score.factKey);
      for (const fact of problem.facts ?? []) {
        expect(unverifiedIds.has(fact.factId)).toBe(true);
        expect(fact).toMatchObject({
          status: 'unverified',
          unverifiedReason: 'awaiting_independent_verification',
          blockReason: 'not_verified',
        });
        expect(fact.reason).toBeTruthy();
      }
    }
    // A stale version is a VERSION_CONFLICT before any other guard.
    const other = carousel.elements.find((element) => !usesUnverified(element)) as Element;
    const stale = await t.send('PUT', `${elementPath(blocked[0] as Element)}/approval`, {
      versionId: other.currentVersion.id,
    });
    expectProblem(stale, 409, 'VERSION_CONFLICT');
    // Content that does not use the fact is approvable.
    for (const element of carousel.elements.filter((entry) => !usesUnverified(entry))) {
      await approveOne(t, element);
    }
    const refused = expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    // Only the blocked slide: a caption still in review is not required (PD-ARCH-01E-PD-02).
    expect(new Set(refused.items?.map((item) => item.elementId))).toEqual(
      new Set(blocked.filter((e) => e.kind === 'slide').map((e) => e.id)),
    );
    expect(refused.items?.map((item) => item.reason)).toContain('blocked');
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');

    // Leaving the match out (redraft): the new draft has no blocked element and can be approved and exported;
    // approvals of the superseded draft do not carry over.
    const matchKey = String(unverified.find((fact) => fact.kind === 'match_score')?.subject.matchKey);
    const redraft = await excludeMatches(t, project.id, [matchKey]);
    expect(redraft).toMatchObject({ kind: 'redraft', status: 'completed' });
    const next = await draftOf(t, project.id);
    expect(next.leftOutMatches).toContainEqual(expect.objectContaining({ matchKey, reason: 'excluded_by_operator' }));
    expect(allElements(next).every((element) => element.currentVersion.state === 'ready')).toBe(true);
    expect(allElements(next).some((element) => element.currentVersion.blocked)).toBe(false);
    const nextCarousel = firstCarousel(next);
    await approveCarousel(t, nextCarousel);
    await exported(t, nextCarousel.id);
  });

  it('final approval and export need every slide; the caption is exported once approved; withdrawal undoes it', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project } = await projectWithDraft(t, ligaDemo(2));
    const carousel = firstCarousel(await draftOf(t, project.id));
    const caption = captionOf(carousel);
    const slides = carousel.elements.filter((entry) => entry.id !== caption.id);
    expect(carousel.readyForFinalApproval).toBe(false);
    const none = expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    // Every slide is named; the caption is not required (PD-ARCH-01E-PD-02).
    expect(new Set(none.items?.map((item) => item.elementId))).toEqual(new Set(slides.map((e) => e.id)));
    expect(new Set(none.items?.map((item) => item.reason))).toEqual(new Set(['not_approved']));
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');

    // Every slide approved, the caption not: the carousel is approved and exported without caption.txt.
    for (const element of slides) {
      await approveOne(t, element);
    }
    expect(firstCarousel(await draftOf(t, project.id)).readyForFinalApproval).toBe(true);
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
    const withoutCaption = await exported(t, carousel.id);
    expect(withoutCaption.files.map((file) => file.kind)).toEqual([...slides.map(() => 'slide_image'), 'manifest']);
    expect(withoutCaption.files.at(-1)).toMatchObject({ fileName: 'manifest.json', position: slides.length + 1 });
    const zip = await t.get(`/exports/${withoutCaption.id}/download`);
    expect(zip.statusCode, zip.body).toBe(200);
    expect(zip.rawPayload.toString('latin1')).not.toContain('caption.txt');

    // Regenerating the caption still in review keeps the final approval.
    const regenerated = await t.send('POST', `${elementPath(caption)}/regenerate`);
    expect(regenerated.statusCode, regenerated.body).toBe(201);
    expect(firstCarousel(await draftOf(t, project.id)).finalApproval?.valid).toBe(true);

    // Approving the caption later changes what the carousel holds: it is approved again and exported with it.
    const current = captionOf(firstCarousel(await draftOf(t, project.id)));
    await approveOne(t, current);
    expect(firstCarousel(await draftOf(t, project.id)).finalApproval?.valid).toBe(false);
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
    const withCaption = await exported(t, carousel.id);
    expect(withCaption.files.filter((file) => file.kind === 'caption_text')).toEqual([
      expect.objectContaining({ fileName: 'caption.txt', elementVersionId: current.currentVersion.id }),
    ]);

    // Withdrawing one approval makes the final approval invalid: export is refused until both are given again.
    const match = slidesOfType(carousel, 'match_result')[0] as Element;
    const withdrawn = await t.send('DELETE', `${elementPath(match)}/approval`);
    expect(withdrawn.statusCode, withdrawn.body).toBe(200);
    expect(firstCarousel(await draftOf(t, project.id)).finalApproval?.valid).toBe(false);
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    await approveOne(t, match);
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
    const written = await exported(t, carousel.id);
    expect(written.carouselId).toBe(carousel.id);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-217
// ---------------------------------------------------------------------------------------------------------------

describe('regeneration of one slide (R-217)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('changes only that slide; the new version is rendered, checked and needs approval again before export', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project } = await projectWithDraft(t, ligaDemo(1));
    const before = await approveDraft(t, project.id);
    const carousel = firstCarousel(before);
    const first = await exported(t, carousel.id);
    const target = slidesOfType(carousel, 'match_result')[2] as Element;

    const response = await t.send('POST', `${elementPath(target)}/regenerate`);
    expect(response.statusCode, response.body).toBe(201);
    const regenerated = ElementSchema.parse(response.json());
    expect(regenerated.currentVersion).toMatchObject({ versionNumber: 2, state: 'ready' });
    expect(regenerated.currentVersion.id).not.toBe(target.currentVersion.id);
    expect(regenerated.currentVersion.qa.map((result) => result.check).sort()).toEqual([
      'capitalized_tokens',
      'data_match',
      'dimensions',
      'style_consistency',
      'team_names',
      'text_fit',
    ]);
    expect((await t.get(`/element-versions/${regenerated.currentVersion.id}/image`)).statusCode).toBe(200);

    const after = firstCarousel(await draftOf(t, project.id));
    for (const element of after.elements) {
      const previous = carousel.elements.find((entry) => entry.id === element.id) as Element;
      if (element.id === target.id) {
        expect(element.currentVersion.state).toBe('ready');
      } else {
        expect(element.currentVersion.id).toBe(previous.currentVersion.id);
        expect(element.currentVersion.state).toBe('approved');
      }
    }
    expect(after.finalApproval?.valid).toBe(false);
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    const refused = expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    expect(refused.items).toEqual([{ elementId: target.id, reason: 'not_approved' }]);

    await approveOne(t, after.elements.find((element) => element.id === target.id) as Element);
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
    const second = await exported(t, carousel.id);
    const versions = (written: typeof first) => written.files.map((file) => file.elementVersionId);
    expect(versions(second)).toEqual(
      versions(first).map((id) => (id === target.currentVersion.id ? regenerated.currentVersion.id : id)),
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-271
// ---------------------------------------------------------------------------------------------------------------

describe('single-source content (R-271)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('DEMO_DATA with the verification source disabled: drafted, rendered, checked, and refused naming the facts', async () => {
    const t = await start(cleanup, {
      base: 'demo-only',
      scenario: 'default',
      mutate: (document: Json) => {
        const verification = sourcesOf(document).find((source) => source['role'] === 'verification') as Json;
        verification['enabled'] = false;
      },
    });
    const { project, run } = await projectWithDraft(t, ligaDemo(1));
    const facts = (await factsOf(t, project.id, run.id)).facts;
    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      expect(fact).toMatchObject({ status: 'unverified', unverifiedReason: 'awaiting_independent_verification' });
      expect(fact.reason).toContain('single source: demo-a');
    }
    const carousel = firstCarousel(await draftOf(t, project.id));
    const matches = slidesOfType(carousel, 'match_result');
    expect(matches.length).toBeGreaterThan(0);
    for (const element of [...matches, captionOf(carousel)]) {
      expect(element.currentVersion.blocked).toBe(true);
      const problem = await refusedApproval(t, element, 'APPROVAL_BLOCKED');
      expect(problem.facts?.length).toBeGreaterThan(0);
      expect(problem.facts?.every((fact) => fact.blockReason === 'not_verified')).toBe(true);
      expect(problem.facts?.some((fact) => fact.kind === 'match_score')).toBe(true);
    }
    expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
  });

  it('LIVE_DATA without a secondary source: research completes and approval is refused naming the single-source fact', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress);
    const { project, run } = await projectWithDraft(t, REFERENCE_MD1);
    const facts = (await factsOf(t, project.id, run.id)).facts;
    expect(facts.some((fact) => fact.status === 'verified')).toBe(false);
    const carousel = firstCarousel(await draftOf(t, project.id));
    const match = slidesOfType(carousel, 'match_result')[0] as Element;
    const problem = await refusedApproval(t, match, 'APPROVAL_BLOCKED');
    const score = problem.facts?.find((fact) => fact.kind === 'match_score');
    expect(score).toMatchObject({
      status: 'unverified',
      unverifiedReason: 'awaiting_independent_verification',
      blockReason: 'not_verified',
    });
    expect(score?.reason).toContain(`single source: ${LIVE_SOURCE_ID}`);
    expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    expect(egress.unmatched).toEqual([]);
    expectNoNetworkViolations();
  });

  /** The LIVE-shaped configuration with the agreeing `test-live` secondary; `confirmed` sets the permission state. */
  async function liveVerified(confirmed: boolean): Promise<TestApp> {
    return startLive(cleanup, scriptedReplay(), {
      base: 'live-secondary',
      scenario: 'live-secondary-agree',
      ...(confirmed
        ? {
            mutate: (document: Json) => {
              for (const source of sourcesOf(document)) {
                source['publicationPermission'] = 'confirmed';
                source['publicationPermissionDecision'] = 'PD-99';
              }
            },
          }
        : {}),
    });
  }

  it('verified LIVE_DATA content is refused while the republishing permission is unconfirmed (PD-18)', async () => {
    const t = await liveVerified(false);
    const settings = (await t.get('/settings')).json() as {
      providers: { sources: { publicationPermission: string }[] };
    };
    expect(settings.providers.sources.every((source) => source.publicationPermission === 'unconfirmed')).toBe(true);
    const { project, run } = await projectWithDraft(t, REFERENCE_MD1);
    expect((await factsOf(t, project.id, run.id)).facts.every((fact) => fact.status === 'verified')).toBe(true);
    const carousel = firstCarousel(await draftOf(t, project.id));
    for (const element of [slidesOfType(carousel, 'match_result')[0] as Element, captionOf(carousel)]) {
      const problem = await refusedApproval(t, element, 'APPROVAL_BLOCKED');
      expect(problem.facts?.length).toBeGreaterThan(0);
      for (const fact of problem.facts ?? []) {
        expect(fact).toMatchObject({ status: 'verified', blockReason: 'publication_permission_unconfirmed' });
      }
    }
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
  });

  it('once a decision confirms the permission, the same content is approvable and exported with both sources traced', async () => {
    const t = await liveVerified(true);
    const { project } = await projectWithDraft(t, REFERENCE_MD1);
    const draft = await approveDraft(t, project.id);
    const egressBefore = t.egress.requests.length;
    for (const carousel of draft.carousels) {
      const written = await exported(t, carousel.id);
      expect(written).toMatchObject({ dataMode: 'LIVE_DATA', demonstration: false });
      const manifest = manifestOf(t, written);
      expect(manifest).toMatchObject({ dataMode: 'LIVE_DATA', demonstration: false, source: { id: LIVE_SOURCE_ID } });
      expect(manifest).not.toHaveProperty('operatorAttested');
      expect(manifest.sources.map((source) => source.id).sort()).toEqual([LIVE_SOURCE_ID, 'live-secondary'].sort());
      expect(new Set(manifest.facts.map((fact) => fact.status))).toEqual(new Set(['verified']));
      // The first match slide (position 2 of the first carousel) traces its score to both LIVE_DATA sources.
      const match = written.files.find((file) => file.kind === 'slide_image' && file.position === 2);
      expect(match).toBeDefined();
      if (carousel.sequence === 1) {
        const trace = await traceOf(t, written.id, 2);
        const score = trace.facts.find((fact) => fact.kind === 'match_score') as Fact;
        expect(
          score.evidence
            .filter((evidence) => evidence.relation === 'supports')
            .map((evidence) => [evidence.sourceId, evidence.dataMode])
            .sort(),
        ).toEqual(
          [
            [LIVE_SOURCE_ID, 'LIVE_DATA'],
            ['live-secondary', 'LIVE_DATA'],
          ].sort(),
        );
      }
    }
    // The export sent nothing: no provider request and no blocked connection.
    expect(t.egress.requests.length).toBe(egressBefore);
    expectNoNetworkViolations();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-272
// ---------------------------------------------------------------------------------------------------------------

describe('MANUALLY_APPROVED content (R-272, PD-17, AD-38)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('marked competition: blocked before the manual approval, then approvable, exported operator-attested; a revocation blocks it again', async () => {
    const a = await manualRootedApp(cleanup, { marked: true });
    const { project, run } = await projectWithDraft(a, MARKED_MD1);
    const facts = (await factsOf(a, project.id, run.id)).facts;
    expect(facts.every((fact) => fact.unverifiedReason === 'no_accepted_source')).toBe(true);
    const before = firstCarousel(await draftOf(a, project.id));
    const match = slidesOfType(before, 'match_result')[0] as Element;
    const problem = await refusedApproval(a, match, 'APPROVAL_BLOCKED');
    expect(problem.facts?.every((fact) => fact.blockReason === 'not_verified')).toBe(true);

    expect(await approveFactsManually(a, project.id, run.id, facts)).toBeGreaterThan(0);
    const draft = await draftOf(a, project.id);
    // Fact segments are labelled MANUALLY_APPROVED, never verified.
    const statuses = new Set(
      allElements(draft).flatMap((element) =>
        element.currentVersion.fields.flatMap((field) => field.segments.map((segment) => segment.factStatus)),
      ),
    );
    expect(statuses.has('manually_approved')).toBe(true);
    expect(statuses.has('verified')).toBe(false);
    expect(allElements(draft).some((element) => element.currentVersion.blocked)).toBe(false);
    const approved = await approveDraft(a, project.id);
    const carousel = firstCarousel(approved);
    const written = await exported(a, carousel.id);
    const manifest = manifestOf(a, written);
    expect(manifest.operatorAttested).toBe(true);
    expect(manifest.facts.some((fact) => fact.status === 'verified')).toBe(false);
    expect(manifest.facts.some((fact) => fact.status === 'manually_approved')).toBe(true);
    const trace = await traceOf(a, written.id, 2);
    expect(trace.facts.some((fact) => fact.status === 'manually_approved' && fact.manualApproval !== null)).toBe(true);
    expect(trace.facts.some((fact) => fact.status === 'verified')).toBe(false);

    // Revoking a used fact's manual approval blocks the content again and invalidates the final approval.
    const used = trace.facts.find((fact) => fact.kind === 'match_score') as Fact;
    const revoked = await a.send(
      'DELETE',
      `/projects/${project.id}/runs/${run.id}/facts/${used.factId}/manual-approval`,
    );
    expect(revoked.statusCode, revoked.body).toBe(200);
    const after = firstCarousel(await draftOf(a, project.id));
    expect(after.finalApproval?.valid).toBe(false);
    expect(finalApprovalRows(a).find((row) => row.carousel_id === carousel.id)?.invalidated_at).not.toBeNull();
    const blocked = after.elements.filter((element) => element.currentVersion.blocked);
    expect(blocked.length).toBeGreaterThan(0);
    expectProblem(await exportCarousel(a, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    const refused = expectProblem(await finalApprove(a, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    expect(refused.items?.map((item) => item.reason)).toContain('blocked');
  });

  it('unlinked manual competition: manually approved facts stay unpublishable and the approval names them', async () => {
    const a = await manualRootedApp(cleanup, { marked: false });
    const { project, run } = await projectWithDraft(a, LIGA_MANUAL_MD1);
    const facts = (await factsOf(a, project.id, run.id)).facts;
    expect(await approveFactsManually(a, project.id, run.id, facts)).toBeGreaterThan(0);
    const carousel = firstCarousel(await draftOf(a, project.id));
    const match = slidesOfType(carousel, 'match_result')[0] as Element;
    const problem = await refusedApproval(a, match, 'APPROVAL_BLOCKED');
    expect(problem.facts?.length).toBeGreaterThan(0);
    for (const fact of problem.facts ?? []) {
      expect(fact).toMatchObject({ status: 'manually_approved', blockReason: 'manually_approved_not_publishable' });
      expect(fact.factKey.length).toBeGreaterThan(0);
    }
    expectProblem(await finalApprove(a, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    expectProblem(await exportCarousel(a, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
  });
});
