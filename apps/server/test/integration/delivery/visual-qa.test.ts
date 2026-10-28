/**
 * Visual QA through the HTTP API after the real workflow stages (OD-09, OD-26, OD-38, OD-56):
 * - each QA check fails by name on a slide seeded with that defect, and a correct slide passes every check (R-214);
 *   the defects are seeded into the stored draft before the real rendering stage (wrong score, non-official team
 *   name, overflowing text, a person-like capitalized name) or into the stored render before the real visual QA stage
 *   (a colour outside the palette, a PNG of another size); the stages themselves are the registered ones;
 * - blocking failures refuse approval (QA_FAILED) until a regenerated version passes; warnings, the stored
 *   `capitalized_tokens` warning included (migration 0002), refuse approval (QA_ACK_REQUIRED) until acknowledged;
 * - any size other than the configured 1080 x 1350 fails `dimensions` (R-238);
 * - visual QA runs unchanged on LIVE_DATA (replayed responses, synthetic marker token) and MANUAL_DATA content (R-268).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Draft, type Element, ElementSchema, type QaResult } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { png } from '../../../src/modules/brand/test/images.js';
import type { StageContext } from '../../../src/modules/module-kit.js';
import { expectNoNetworkViolations } from '../../support/index.js';
import { LIVE_SOURCE_ID, cleanups, scriptedReplay, start, startLive } from '../ingestion/support.js';

import {
  LIGA_MANUAL_MD1,
  allElements,
  approve,
  approveOne,
  draftOf,
  elementPath,
  expectProblem,
  exported,
  failedChecks,
  finalApprove,
  ligaDemo,
  manualRootedApp,
  projectWithDraft,
  rewriteRenderModel,
  rewriteText,
  seededStage,
  sha256,
  slidesOfType,
  storedSegments,
  storedVersion,
  versionsOfRun,
  WORKFLOW_TEST_TIMEOUT,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

/** The seeded defects, by the slide they are seeded on (liga-demo matchday 1 has eight match slides). */
const SEEDS = {
  data_match: { slide: 'match_result', index: 0 },
  team_names: { slide: 'match_result', index: 1 },
  text_fit: { slide: 'match_result', index: 2 },
  style_consistency: { slide: 'match_result', index: 3 },
  dimensions: { slide: 'match_result', index: 4 },
  capitalized_tokens: { slide: 'closing', index: 0 },
} as const;

type SeededCheck = keyof typeof SEEDS;

const PERSON_LIKE = 'Gracias a Ezequiel Barrantes';

/** The current slide version IDs of a run's draft by seed. */
function seedTargets(ctx: StageContext): Record<SeededCheck, string> {
  const slides = versionsOfRun({ container: ctx.container }, ctx.runId).filter(
    (row) => row.kind === 'slide' && row.superseded_at === null,
  );
  const target = (check: SeededCheck): string => {
    const seed = SEEDS[check];
    const row = slides.filter((entry) => entry.slide_type === seed.slide)[seed.index];
    if (row === undefined) {
      throw new Error(`no slide for ${check}`);
    }
    return row.id;
  };
  return Object.fromEntries(Object.keys(SEEDS).map((check) => [check, target(check as SeededCheck)])) as Record<
    SeededCheck,
    string
  >;
}

/** Seeds the text defects into the stored draft before rendering (the slides are rendered with them). */
function seedText(ctx: StageContext): void {
  const c = { container: ctx.container };
  const targets = seedTargets(ctx);
  rewriteText(c, targets.data_match, (text) => {
    const [score] = storedSegments(text, 'score');
    expect(score?.provenance).toBe('fact');
    (score as { text: string }).text = '9-9';
  });
  rewriteText(c, targets.team_names, (text) => {
    const [home] = storedSegments(text, 'team_home');
    expect(home?.provenance).toBe('fact');
    const name = String(home?.text);
    (home as { text: string }).text = `${name.split(' ')[0]?.slice(0, 3) ?? ''}. ${name.split(' ').slice(1).join(' ')}`;
  });
  rewriteText(c, targets.text_fit, (text) => {
    const [first] = storedSegments(text, 'description');
    expect(first?.provenance).toBe('commentary');
    (first as { text: string }).text = 'resumen extenso del partido '.repeat(40);
  });
  rewriteText(c, targets.capitalized_tokens, (text) => {
    const [first] = storedSegments(text, 'description');
    expect(first?.provenance).toBe('commentary');
    (first as { text: string }).text = PERSON_LIKE;
  });
}

/** Seeds the render defects after rendering and before visual QA. */
function seedRender(ctx: StageContext): void {
  const c = { container: ctx.container };
  const targets = seedTargets(ctx);
  rewriteRenderModel(c, targets.style_consistency, (model) => {
    const rect = model.elements.find((element) => element.kind === 'rect');
    if (rect === undefined) {
      throw new Error('no rect element');
    }
    rect.color = '#123456';
  });
  // A valid PNG of another size, recorded with its hash (so only its size is wrong).
  const square = png({ width: 1080, height: 1080, rgba: [20, 40, 60, 255] });
  const version = storedVersion(c, targets.dimensions);
  writeFileSync(join(ctx.container.paths.dataDir, String(version.image_path)), square);
  ctx.container.db
    .prepare('UPDATE element_versions SET image_sha256 = ? WHERE id = ?')
    .run([sha256(square), targets.dimensions]);
}

function seeded(draft: Draft): Record<SeededCheck, Element> {
  const carousel = draft.carousels[0] as Draft['carousels'][number];
  return Object.fromEntries(
    Object.entries(SEEDS).map(([check, seed]) => [check, slidesOfType(carousel, seed.slide)[seed.index]]),
  ) as Record<SeededCheck, Element>;
}

function resultOf(element: Element, check: string): QaResult {
  const result = element.currentVersion.qa.find((entry) => entry.check === check);
  if (result === undefined) {
    throw new Error(`no ${check} result`);
  }
  return result;
}

describe(
  'each visual QA check fails on a slide seeded with its defect (R-214, R-238)',
  { timeout: WORKFLOW_TEST_TIMEOUT },
  () => {
    it('fails each check by name, passes every check on a correct slide, and gates approval by severity', async () => {
      const t = await start(cleanup, {
        base: 'demo-only',
        scenario: 'default',
        stageOverrides: {
          rendering: seededStage('rendering', seedText),
          visual_qa: seededStage('visual_qa', seedRender),
        },
      });
      const { project, run } = await projectWithDraft(t, ligaDemo(1));
      const draft = await draftOf(t, project.id);
      const carousel = draft.carousels[0] as Draft['carousels'][number];
      const slides = seeded(draft);

      // Each seeded slide fails exactly its check, by name, with the closed details of the contract.
      for (const [check, element] of Object.entries(slides)) {
        expect(failedChecks(element), check).toEqual([check]);
        expect(element.currentVersion.qa.map((result) => result.check).sort(), check).toEqual([
          'capitalized_tokens',
          'data_match',
          'dimensions',
          'style_consistency',
          'team_names',
          'text_fit',
        ]);
      }
      expect(resultOf(slides.data_match, 'data_match').details).toMatchObject({
        mismatches: [expect.objectContaining({ actual: '9-9' })],
      });
      expect(resultOf(slides.team_names, 'team_names').details).toMatchObject({
        mismatches: [expect.objectContaining({ elementId: expect.stringContaining('team') as unknown })],
      });
      expect(resultOf(slides.text_fit, 'text_fit').details).toEqual({ overflowingElements: ['description'] });
      expect(resultOf(slides.style_consistency, 'style_consistency').details).toMatchObject({
        colorsOutsidePalette: ['#123456'],
      });
      expect(resultOf(slides.dimensions, 'dimensions').details).toEqual({
        expectedWidth: 1080,
        expectedHeight: 1350,
        actualWidth: 1080,
        actualHeight: 1080,
      });
      expect(resultOf(slides.capitalized_tokens, 'capitalized_tokens').details).toEqual({
        tokens: ['Ezequiel', 'Barrantes'],
      });
      // The capitalized_tokens warning is stored (migration 0002) with qa_status warnings.
      const stored = t.container.db
        .prepare<{ check_name: string; outcome: string; severity: string }>(
          'SELECT check_name, outcome, severity FROM qa_results WHERE element_version_id = ? AND outcome = ?',
        )
        .all([slides.capitalized_tokens.currentVersion.id, 'fail']);
      expect(stored).toEqual([{ check_name: 'capitalized_tokens', outcome: 'fail', severity: 'warning' }]);
      expect(storedVersion(t, slides.capitalized_tokens.currentVersion.id).qa_status).toBe('warnings');

      // A correct slide passes every check.
      const cover = slidesOfType(carousel, 'cover')[0] as Element;
      expect(cover.currentVersion.qa).toHaveLength(6);
      expect(cover.currentVersion.qa.every((result) => result.outcome === 'pass')).toBe(true);
      expect(cover.currentVersion.state).toBe('ready');
      expect(storedVersion(t, cover.currentVersion.id).qa_status).toBe('passed');

      // Blocking failures (OD-09): the slide is qa_failed and its approval is refused.
      for (const check of ['data_match', 'team_names', 'text_fit', 'dimensions'] as const) {
        expect(slides[check].currentVersion.state, check).toBe('qa_failed');
        expectProblem(await approve(t, slides[check]), 409, 'QA_FAILED');
      }
      // Warnings: approval is refused until each is acknowledged; a blocking check cannot be acknowledged.
      for (const check of ['style_consistency', 'capitalized_tokens'] as const) {
        const element = slides[check];
        expect(element.currentVersion.state, check).toBe('ready');
        expectProblem(await approve(t, element), 409, 'QA_ACK_REQUIRED');
        const acknowledged = await t.send('POST', `${elementPath(element)}/qa-acknowledgements`, {
          versionId: element.currentVersion.id,
          checks: [check],
        });
        expect(acknowledged.statusCode, acknowledged.body).toBe(200);
        expect(resultOf(ElementSchema.parse(acknowledged.json()), check).acknowledgedAt).not.toBeNull();
        expect((await approve(t, element)).statusCode).toBe(200);
      }
      const blockingAck = await t.send('POST', `${elementPath(slides.dimensions)}/qa-acknowledgements`, {
        versionId: slides.dimensions.currentVersion.id,
        checks: ['dimensions'],
      });
      expect(blockingAck.statusCode).toBe(400);

      // The final approval is refused while a slide fails QA.
      for (const element of carousel.elements) {
        const current = allElements(await draftOf(t, project.id)).find((entry) => entry.id === element.id) as Element;
        if (current.currentVersion.state === 'ready') {
          await approveOne(t, current);
        }
      }
      const refused = expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
      expect(new Set(refused.items?.map((item) => item.elementId))).toEqual(
        new Set(['data_match', 'team_names', 'text_fit', 'dimensions'].map((check) => slides[check as SeededCheck].id)),
      );
      expect(new Set(refused.items?.map((item) => item.reason))).toContain('qa_failed');

      // A regenerated version of each failed slide goes through rendering and QA again and passes; then all is approvable.
      for (const check of ['data_match', 'team_names', 'text_fit', 'dimensions'] as const) {
        const response = await t.send('POST', `${elementPath(slides[check])}/regenerate`);
        expect(response.statusCode, response.body).toBe(201);
        const regenerated = ElementSchema.parse(response.json());
        expect(regenerated.currentVersion.versionNumber).toBe(2);
        expect(failedChecks(regenerated), check).toEqual([]);
        expect(regenerated.currentVersion.state).toBe('ready');
        await approveOne(t, regenerated);
      }
      expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
      const written = await exported(t, carousel.id);
      expect(written.files.filter((file) => file.kind === 'slide_image')).toHaveLength(
        carousel.elements.filter((element) => element.kind === 'slide').length,
      );
      expect(run.status).toBe('completed');
      expectNoNetworkViolations();
    });
  },
);

// ---------------------------------------------------------------------------------------------------------------
// R-268
// ---------------------------------------------------------------------------------------------------------------

/** Every version of a draft has stored results of every check and no blocking failure. */
function expectCheckedWithoutBlockingFailure(draft: Draft): void {
  const elements = allElements(draft);
  expect(elements.length).toBeGreaterThan(2);
  for (const element of elements) {
    const checks = element.currentVersion.qa.map((result) => result.check).sort();
    expect(checks, String(element.slideType)).toEqual(
      element.kind === 'caption'
        ? ['capitalized_tokens']
        : ['capitalized_tokens', 'data_match', 'dimensions', 'style_consistency', 'team_names', 'text_fit'],
    );
    expect(
      element.currentVersion.qa.filter((result) => result.severity === 'blocking' && result.outcome === 'fail'),
      String(element.slideType),
    ).toEqual([]);
    expect(element.currentVersion.state).toBe('ready');
  }
}

describe('visual QA on every data mode (R-268)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('LIVE_DATA content (replayed responses) is rendered and checked like any other; its facts stay blocked', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress);
    const { project, run } = await projectWithDraft(t, {
      competitionId: 'copa-continental',
      sourceId: LIVE_SOURCE_ID,
      seasonId: '2026',
      stageId: 'league-stage',
      matchday: 1,
    });
    expect(run.stages.map((stage) => `${stage.stage}:${stage.status}`)).toEqual([
      'research:completed',
      'verification:completed',
      'content:completed',
      'rendering:completed',
      'visual_qa:completed',
    ]);
    const draft = await draftOf(t, project.id);
    expect(draft).toMatchObject({ dataMode: 'LIVE_DATA', demonstration: false });
    expectCheckedWithoutBlockingFailure(draft);
    // data_match compared the drawn values with the candidate values (unverified, single source).
    const match = slidesOfType(draft.carousels[0] as Draft['carousels'][number], 'match_result')[0] as Element;
    expect(resultOf(match, 'data_match').outcome).toBe('pass');
    expect(match.currentVersion.blocked).toBe(true);
    expect(versionsOfRun(t, run.id).every((row) => row.qa_status !== 'pending')).toBe(true);
    expect(egress.unmatched).toEqual([]);
    expectNoNetworkViolations();
  });

  it('MANUAL_DATA content is rendered and checked like any other', async () => {
    const a = await manualRootedApp(cleanup, { marked: false });
    const { project, run } = await projectWithDraft(a, LIGA_MANUAL_MD1);
    const draft = await draftOf(a, project.id);
    expect(draft).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
    expectCheckedWithoutBlockingFailure(draft);
    expect(versionsOfRun(a, run.id).every((row) => row.qa_status !== 'pending')).toBe(true);
  });
});
