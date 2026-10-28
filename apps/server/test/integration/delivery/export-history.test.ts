/**
 * Export, history and traceability through the HTTP API (architecture.md section 11.2; T38: manifest
 * `edr-export-manifest/1`, `operatorAttested` only when true, MANUALLY_APPROVED never written as verified):
 * - export files: one PNG per approved slide in carousel order at the configured size, the caption text file and the
 *   manifest, each listed with its SHA-256 (R-218); the DEMO_DATA flag in the export and the manifest (R-269);
 * - no publication path and nothing sent anywhere during an export: zero egress requests, zero AI requests, no
 *   blocked connection (R-219);
 * - history and reopen: the project's approval state and export time, newest export first, the exact exported slides
 *   and caption after later changes and after a restart (R-220);
 * - traceability of every exported slide: facts, statuses and sources with mode and retrieval time, for whichever of
 *   the competition's two sources was chosen (R-221, R-287);
 * - a research run (also a failing one) and a superseded draft leave nothing exportable: FINAL_APPROVAL_REQUIRED
 *   (OD-57, T58);
 * - a corrected manual reimport: changed facts lose MANUALLY_APPROVED and the content needs QA and approval again
 *   (R-278);
 * - the multi-competition workflow with recorded responses taken through approval and export as far as the
 *   verification rules allow (R-290).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Draft, type Element, type Fact, ProjectListResponseSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  REPO_ROOT,
  type TestApp,
  expectNoNetworkViolations,
  fixtureConfigDocument,
  probeStage,
  sourcesOf,
  startTestApp,
  temporaryDirectory,
} from '../../support/index.js';
import { StageFailure } from '../../../src/workflow/index.js';
import {
  LIVE_SOURCE_ID,
  SECOND_ID,
  cleanups,
  committedLiveDocument,
  errorText,
  importApplied,
  jsonImport,
  sampleRequest,
  scriptedReplay,
  start,
  startLive,
  startupError,
} from '../ingestion/support.js';

import {
  type Client,
  LIGA_MANUAL_MD1,
  MARKED_MD1,
  acknowledgeWarnings,
  allElements,
  approve,
  approveDraft,
  approveFactsManually,
  approveOne,
  captionOf,
  completedRun,
  draftOf,
  elementPath,
  excludeMatches,
  expectProblem,
  exportCarousel,
  exportDetail,
  exportFile,
  exportFileNames,
  exported,
  factsOf,
  fieldText,
  finalApprove,
  ligaDemo,
  ligaManualDocument,
  manifestOf,
  manualRootedApp,
  pngDimensions,
  projectExports,
  projectWithDraft,
  runWorkflow,
  sha256,
  slidesOfType,
  storedPng,
  storedVersion,
  switchableStage,
  traceOf,
  WORKFLOW_TEST_TIMEOUT,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

function firstCarousel(draft: Draft): Draft['carousels'][number] {
  const carousel = draft.carousels[0];
  if (carousel === undefined) {
    throw new Error('the draft has no carousel');
  }
  return carousel;
}

async function approvalStateOf(c: Client, projectId: string) {
  const projects = ProjectListResponseSchema.parse((await c.get('/projects')).json()).projects;
  return projects.find((entry) => entry.id === projectId);
}

// ---------------------------------------------------------------------------------------------------------------
// R-218, R-219, R-269
// ---------------------------------------------------------------------------------------------------------------

describe('export files and no publication (R-218, R-219, R-269)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('writes one PNG per approved slide in order at 1080 x 1350, the caption file and the manifest, sending nothing', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project } = await projectWithDraft(t, ligaDemo(1));
    const draft = await approveDraft(t, project.id);
    const carousel = firstCarousel(draft);
    const aiBefore = t.aiRequests.length;
    const logBefore = t.log.text().length;

    const written = await exported(t, carousel.id);

    // R-219: nothing is sent: the recording egress fake saw no request at all in this DEMO_DATA app, the export
    // made no AI request and no connection was attempted.
    expect(t.egress.requests).toEqual([]);
    expect(t.aiRequests.length).toBe(aiBefore);
    expectNoNetworkViolations();
    expect(t.log.text().slice(logBefore)).not.toMatch(/https?:\/\//);

    const slides = carousel.elements.filter((element) => element.kind === 'slide');
    const names = slides.map((_slide, index) => `${String(index + 1).padStart(2, '0')}.png`);
    expect(exportFileNames(t, written)).toEqual([...names, 'caption.txt', 'manifest.json'].sort());
    const images = written.files.filter((file) => file.kind === 'slide_image');
    expect(images.map((file) => [file.position, file.fileName, file.elementVersionId])).toEqual(
      slides.map((slide, index) => [index + 1, names[index], slide.currentVersion.id]),
    );
    for (const [index, slide] of slides.entries()) {
      const bytes = exportFile(t, written, String(names[index]));
      expect(pngDimensions(bytes)).toEqual({ width: 1080, height: 1350 });
      expect(sha256(bytes)).toBe(images[index]?.sha256);
      expect(bytes.equals(storedPng(t, storedVersion(t, slide.currentVersion.id)))).toBe(true);
    }
    // caption.txt: the approved caption, a blank line, the hashtags separated by spaces.
    const caption = captionOf(carousel);
    const hashtags = (caption.currentVersion.fields.find((field) => field.field === 'hashtags')?.segments ?? [])
      .map((segment) => segment.text)
      .join(' ');
    const captionFile = exportFile(t, written, 'caption.txt');
    expect(captionFile.toString('utf8')).toBe(`${fieldText(caption, 'caption')}\n\n${hashtags}\n`);
    const captionEntry = written.files.find((file) => file.kind === 'caption_text');
    expect(captionEntry).toMatchObject({ fileName: 'caption.txt', elementVersionId: caption.currentVersion.id });
    expect(captionEntry?.sha256).toBe(sha256(captionFile));
    expect(written.files.find((file) => file.kind === 'manifest')?.sha256).toBe(
      sha256(exportFile(t, written, 'manifest.json')),
    );

    // R-269: the demonstration flag in the export record and the manifest; no operator attestation.
    expect(written).toMatchObject({ dataMode: 'DEMO_DATA', demonstration: true });
    const manifest = manifestOf(t, written);
    expect(manifest).toMatchObject({
      format: 'edr-export-manifest/1',
      exportId: written.id,
      dataMode: 'DEMO_DATA',
      demonstration: true,
      carousel: { id: carousel.id, sequence: 1, total: 1 },
      project: { id: project.id, language: 'es' },
    });
    expect(manifest).not.toHaveProperty('operatorAttested');
    expect(manifest.files.map((file) => file.elementVersionId)).toEqual([
      ...slides.map((slide) => slide.currentVersion.id),
      caption.currentVersion.id,
    ]);
  });

  it('offers no publication function: no route, no contract operation, and only the manual publication mode', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    expect(t.app.printRoutes()).not.toMatch(/publish|instagram|social|share/i);
    const contract = readFileSync(join(REPO_ROOT, 'contracts', 'http-api.openapi.yaml'), 'utf8');
    const paths = contract.split('\n').filter((line) => /^ {2}\/\S*:$/.test(line));
    expect(paths.length).toBeGreaterThan(20);
    expect(paths.filter((line) => /publish|instagram|social|share/i.test(line))).toEqual([]);
    expect(((await t.get('/settings')).json() as { publicationMode: string }).publicationMode).toBe('manual');
    const error = await startupError({
      base: 'demo-only',
      mutate: (document) => {
        document['publicationMode'] = 'automatic';
      },
    });
    expect(errorText(error)).toContain('publicationMode');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-220
// ---------------------------------------------------------------------------------------------------------------

describe('history and reopen (R-220)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('lists the export with its approval state and time and reopens the exact exported content, also after changes and a restart', async () => {
    const data = temporaryDirectory('t42-history');
    cleanup.add(() => data.remove());
    const dataDir = join(data.path, 'data');
    const t = await startTestApp({ base: 'demo-only', scenario: 'default', dataDir });
    let open = true;
    cleanup.add(async () => {
      if (open) {
        await t.close();
      }
    });
    const { project } = await projectWithDraft(t, ligaDemo(1));
    expect(await approvalStateOf(t, project.id)).toMatchObject({ approvalState: 'in_review', lastExportAt: null });
    const draft = await approveDraft(t, project.id);
    expect(await approvalStateOf(t, project.id)).toMatchObject({ approvalState: 'final_approved' });
    const carousel = firstCarousel(draft);
    const first = await exported(t, carousel.id);
    expect(await approvalStateOf(t, project.id)).toMatchObject({
      approvalState: 'exported',
      lastExportAt: first.exportedAt,
      demonstration: true,
    });
    const reopened = await exportDetail(t, first.id);
    expect(reopened.elements.map((entry) => entry.version.id)).toEqual(
      carousel.elements.map((element) => element.currentVersion.id),
    );
    expect(reopened.elements.map((entry) => entry.version.fields)).toEqual(
      carousel.elements.map((element) => element.currentVersion.fields),
    );
    /** The exported content of a reopened export: version, text and image of each element (not its later state). */
    const content = (detail: typeof reopened) =>
      detail.elements.map((entry) => [
        entry.position,
        entry.kind,
        entry.version.id,
        entry.version.fields,
        entry.version.imageUrl,
      ]);

    // A later regeneration and a second export: the history lists both, newest first; the first reopens unchanged.
    const target = slidesOfType(carousel, 'match_result')[0] as Element;
    const regenerated = await t.send('POST', `${elementPath(target)}/regenerate`);
    expect(regenerated.statusCode, regenerated.body).toBe(201);
    const next = firstCarousel(await draftOf(t, project.id));
    await approveOne(t, next.elements.find((element) => element.id === target.id) as Element);
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
    const second = await exported(t, carousel.id);
    expect((await projectExports(t, project.id)).map((entry) => entry.id)).toEqual([second.id, first.id]);
    const afterChange = await exportDetail(t, first.id);
    expect(content(afterChange)).toEqual(content(reopened));
    // The regenerated slide's exported version is shown as superseded now; the exported version is the same.
    expect(afterChange.elements.find((entry) => entry.version.id === target.currentVersion.id)?.version.state).toBe(
      'superseded',
    );
    for (const file of first.files.filter((entry) => entry.kind === 'slide_image')) {
      const image = await t.get(`/element-versions/${String(file.elementVersionId)}/image`);
      expect(image.statusCode).toBe(200);
      expect(sha256(image.rawPayload)).toBe(file.sha256);
    }
    open = false;
    await t.close();

    const restarted = await start(cleanup, { base: 'demo-only', scenario: 'default', dataDir });
    expect(await exportDetail(restarted, first.id)).toEqual(afterChange);
    expect((await projectExports(restarted, project.id)).map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(await approvalStateOf(restarted, project.id)).toMatchObject({
      approvalState: 'exported',
      lastExportAt: second.exportedAt,
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-221, R-287
// ---------------------------------------------------------------------------------------------------------------

describe('traceability of exported slides (R-221, R-287)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it.each(['demo-a', 'demo-b'])(
    'with %s chosen of the two sources: the project, every retrieval, every fact and every trace record it',
    async (sourceId) => {
      // demo-a and demo-b are both primary sources of the link, so the operator can choose either; the separate
      // official publication `demo-official` (own independence group) stays the verification source of both.
      const t = await start(cleanup, {
        base: 'demo-official',
        scenario: 'default',
        mutate: (document) => {
          for (const source of sourcesOf(document)) {
            if (source['id'] === 'demo-b') {
              source['role'] = 'primary';
            }
          }
        },
      });
      const offered = (await t.get('/catalog/competitions')).json() as {
        competitions: { id: string; sources: { sourceId: string; selectable: boolean }[] }[];
      };
      expect(
        offered.competitions
          .find((competition) => competition.id === 'liga-demo')
          ?.sources.filter((source) => source.selectable)
          .map((source) => source.sourceId)
          .sort(),
      ).toEqual(['demo-a', 'demo-b']);
      const names = new Map(
        sourcesOf(fixtureConfigDocument('demo-official')).map((source) => [
          String(source['id']),
          String(source['name']),
        ]),
      );
      const { project, run } = await projectWithDraft(t, ligaDemo(1, sourceId));
      expect(project).toMatchObject({ sourceId, sourceName: names.get(sourceId) });
      const retrievals = t.container.db
        .prepare<{ source_id: string }>("SELECT source_id FROM retrievals WHERE run_id = ? AND stage = 'research'")
        .all([run.id]) as { source_id: string }[];
      expect(retrievals.length).toBeGreaterThan(0);
      expect(new Set(retrievals.map((row) => row.source_id))).toEqual(new Set([sourceId]));
      const facts = (await factsOf(t, project.id, run.id)).facts;
      expect(facts.every((fact) => fact.evidence.some((evidence) => evidence.sourceId === sourceId))).toBe(true);

      const carousel = firstCarousel(await approveDraft(t, project.id));
      const written = await exported(t, carousel.id);
      expect(manifestOf(t, written).source).toEqual({ id: sourceId, name: names.get(sourceId), dataMode: 'DEMO_DATA' });
      const factsById = new Map(facts.map((fact) => [fact.factId, fact]));
      for (const file of written.files.filter((entry) => entry.kind === 'slide_image')) {
        const trace = await traceOf(t, written.id, file.position);
        expect(trace).toMatchObject({ elementVersionId: file.elementVersionId, dataMode: 'DEMO_DATA' });
        const referenced = t.container.db
          .prepare<{ fact_id: string }>('SELECT fact_id FROM element_fact_refs WHERE element_version_id = ?')
          .all([String(file.elementVersionId)])
          .map((row) => row.fact_id)
          .sort();
        expect(trace.facts.map((fact) => fact.factId).sort()).toEqual(referenced);
        for (const fact of trace.facts) {
          expect(fact.status).toBe(factsById.get(fact.factId)?.status);
          expect(fact.evidence.some((evidence) => evidence.sourceId === sourceId)).toBe(true);
          for (const evidence of fact.evidence) {
            expect(evidence.sourceName).toBe(names.get(evidence.sourceId));
            expect(evidence.dataMode).toBe('DEMO_DATA');
            expect(evidence.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          }
        }
      }
      const match = written.files.find((entry) => entry.position === 2);
      const score = (await traceOf(t, written.id, match?.position ?? 0)).facts.find(
        (fact) => fact.kind === 'match_score',
      ) as Fact;
      expect(score).toMatchObject({ status: 'verified', dispute: null, manualApproval: null });
      expect(
        score.evidence
          .filter((evidence) => evidence.relation === 'supports')
          .map((evidence) => evidence.sourceId)
          .sort(),
      ).toEqual([sourceId, 'demo-official'].sort());
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// OD-57, T58: research run and superseded draft
// ---------------------------------------------------------------------------------------------------------------

describe('nothing stale is exportable (OD-57, T58, T38)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('a new research run makes the final approval invalid: export refused, also when the run fails', async () => {
    const research = switchableStage('research');
    const t = await start(cleanup, {
      base: 'demo-only',
      scenario: 'default',
      stageOverrides: { research: research.stage },
    });
    const { project } = await projectWithDraft(t, ligaDemo(1));
    const carousel = firstCarousel(await approveDraft(t, project.id));
    await exported(t, carousel.id);

    // A completed research run: the old carousel is no longer exportable.
    await completedRun(t, project.id);
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');

    // The new draft is approved and finally approved; then a research run that fails.
    const fresh = firstCarousel(await approveDraft(t, project.id));
    expect(fresh.id).not.toBe(carousel.id);
    research.use(
      probeStage('research', async () => {
        await Promise.resolve();
        throw new StageFailure('unavailable', { sourceId: 'demo-a' });
      }),
    );
    const failed = await runWorkflow(t, project.id);
    expect(failed.status).toBe('failed');
    expect(failed.stages[0]).toMatchObject({ stage: 'research', status: 'failed' });
    expect(firstCarousel(await draftOf(t, project.id)).finalApproval?.valid).toBe(false);
    expectProblem(await exportCarousel(t, fresh.id), 409, 'FINAL_APPROVAL_REQUIRED');
    // A new final approval of the unchanged draft is possible and exportable again.
    expect((await finalApprove(t, fresh.id)).statusCode).toBe(200);
    await exported(t, fresh.id);
  });

  it('the carousel of a draft superseded by a redraft is not exportable; its earlier export stays in the history', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project, run } = await projectWithDraft(t, ligaDemo(1));
    const carousel = firstCarousel(await approveDraft(t, project.id));
    const before = await exported(t, carousel.id);
    const match = (await factsOf(t, project.id, run.id)).facts.find((fact) => fact.kind === 'match_score') as Fact;
    const redraft = await excludeMatches(t, project.id, [String(match.subject.matchKey)]);
    expect(redraft.status).toBe('completed');
    expect(firstCarousel(await draftOf(t, project.id)).id).not.toBe(carousel.id);
    const refused = await exportCarousel(t, carousel.id);
    expectProblem(refused, 409, 'FINAL_APPROVAL_REQUIRED');
    expect((await projectExports(t, project.id)).map((entry) => entry.id)).toEqual([before.id]);
    expect((await exportDetail(t, before.id)).elements.length).toBe(carousel.elements.length);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-278
// ---------------------------------------------------------------------------------------------------------------

describe('a corrected manual reimport (R-278)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('changed facts lose MANUALLY_APPROVED; the new content needs QA and approval again before export', async () => {
    const a = await manualRootedApp(cleanup, { marked: true });
    const { project, run } = await projectWithDraft(a, MARKED_MD1);
    await approveFactsManually(a, project.id, run.id, (await factsOf(a, project.id, run.id)).facts);
    const carousel = firstCarousel(await approveDraft(a, project.id));
    const first = await exported(a, carousel.id);
    const v1 = new Set(manifestOf(a, first).facts.flatMap((fact) => fact.evidence.map((e) => e.importVersionId)));

    // Correct the first score of matchday 1 and import again.
    const corrected = ligaManualDocument() as {
      selections: { matches: { score: { home: number; away: number } }[] }[];
    };
    const score = corrected.selections[0]?.matches[0]?.score;
    if (score === undefined) {
      throw new Error('fixture shape');
    }
    score.home += 1;
    await importApplied(a, jsonImport(corrected, 'jornada-v2.json'));
    const rerun = await completedRun(a, project.id);

    // The old final approval is invalid and nothing of the old draft is exportable.
    expectProblem(await exportCarousel(a, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    const facts = (await factsOf(a, project.id, rerun.id)).facts;
    const changed = facts.filter((fact) => fact.kind === 'match_score' && fact.status !== 'manually_approved');
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ status: 'unverified', manualApproval: null });
    // Every element of the new draft went through QA and is waiting for approval; content of the changed fact is
    // blocked and its approval names the fact.
    const draft = await draftOf(a, project.id);
    for (const element of allElements(draft)) {
      expect(element.currentVersion.state).toBe('ready');
      expect(element.currentVersion.qa.length).toBeGreaterThan(0);
    }
    const next = firstCarousel(draft);
    const blocked = next.elements.filter((element) => element.currentVersion.blocked);
    expect(blocked.length).toBeGreaterThan(0);
    for (const element of blocked) {
      await acknowledgeWarnings(a, element);
      const problem = expectProblem(await approve(a, element), 409, 'APPROVAL_BLOCKED');
      expect(problem.facts?.map((fact) => fact.factId)).toContain(changed[0]?.factId);
    }
    // Once the corrected fact is approved manually again, the content is approvable and exported from version 2.
    await approveFactsManually(a, project.id, rerun.id, changed);
    const approved = firstCarousel(await approveDraft(a, project.id));
    const second = await exported(a, approved.id);
    const v2 = new Set(manifestOf(a, second).facts.flatMap((fact) => fact.evidence.map((e) => e.importVersionId)));
    expect(v2.size).toBe(1);
    expect([...v2].some((id) => v1.has(id))).toBe(false);
    expect(manifestOf(a, second).operatorAttested).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-290, R-268, R-287
// ---------------------------------------------------------------------------------------------------------------

describe('multi-competition workflow up to approval and export (R-290)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('two LIVE_DATA, one MANUAL_DATA and one DEMO_DATA competition: exported as far as the verification rules allow', async () => {
    const egress = scriptedReplay();
    const t: TestApp = await startLive(cleanup, egress, { base: committedLiveDocument() });
    await importApplied(t, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));
    const referenceId = String(
      t.container.config.catalogue.links.find((link) =>
        link.bindings.some((binding) => binding.sourceId === LIVE_SOURCE_ID),
      )?.id,
    );
    const selections = [
      [
        'LIVE_DATA',
        {
          competitionId: referenceId,
          sourceId: LIVE_SOURCE_ID,
          seasonId: '2026',
          stageId: 'league-stage',
          matchday: 1,
        },
      ],
      [
        'LIVE_DATA',
        {
          competitionId: SECOND_ID,
          sourceId: LIVE_SOURCE_ID,
          seasonId: '2026',
          stageId: 'regular-season',
          matchday: 1,
        },
      ],
      ['MANUAL_DATA', LIGA_MANUAL_MD1],
      ['DEMO_DATA', ligaDemo(1)],
    ] as const;
    const exportedModes: string[] = [];
    for (const [mode, selection] of selections) {
      const { project, run } = await projectWithDraft(t, selection);
      expect(project.dataMode).toBe(mode);
      const facts = (await factsOf(t, project.id, run.id)).facts;
      if (mode === 'MANUAL_DATA') {
        expect(await approveFactsManually(t, project.id, run.id, facts)).toBeGreaterThan(0);
      }
      const draft = await draftOf(t, project.id);
      expect(draft.dataMode).toBe(mode);
      for (const carousel of draft.carousels) {
        if (mode === 'DEMO_DATA') {
          continue;
        }
        // Single-source LIVE_DATA and manually approved facts of an unlinked competition are not publishable.
        const match = slidesOfType(carousel, 'match_result')[0];
        if (match !== undefined) {
          await acknowledgeWarnings(t, match);
          const problem = expectProblem(await approve(t, match), 409, 'APPROVAL_BLOCKED');
          const reasons = new Set(problem.facts?.map((fact) => fact.blockReason));
          expect(reasons).toEqual(
            new Set([mode === 'LIVE_DATA' ? 'not_verified' : 'manually_approved_not_publishable']),
          );
        }
        expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
        expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
      }
      if (mode === 'DEMO_DATA') {
        const approved = await approveDraft(t, project.id);
        const callsBefore = egress.calls.length;
        for (const carousel of approved.carousels) {
          const written = await exported(t, carousel.id);
          expect(written).toMatchObject({ dataMode: 'DEMO_DATA', demonstration: true });
          const trace = await traceOf(t, written.id, 2);
          expect(trace.facts.every((fact) => fact.evidence.every((e) => e.dataMode === 'DEMO_DATA'))).toBe(true);
          exportedModes.push(written.dataMode);
        }
        expect(egress.calls.length).toBe(callsBefore);
      }
    }
    expect(exportedModes).toEqual(['DEMO_DATA']);
    expect(egress.unmatched).toEqual([]);
    expectNoNetworkViolations();

    // The marked manual competition (PD-17) is exported operator-attested, completing the MANUAL_DATA case.
    const a = await manualRootedApp(cleanup, { marked: true });
    const marked = await projectWithDraft(a, MARKED_MD1);
    await approveFactsManually(
      a,
      marked.project.id,
      marked.run.id,
      (await factsOf(a, marked.project.id, marked.run.id)).facts,
    );
    const carousel = firstCarousel(await approveDraft(a, marked.project.id));
    const written = await exported(a, carousel.id);
    expect(written).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
    expect(manifestOf(a, written).operatorAttested).toBe(true);
  });
});
