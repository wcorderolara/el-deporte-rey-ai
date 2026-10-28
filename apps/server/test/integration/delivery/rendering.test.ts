/**
 * Rendering through the HTTP API after the real workflow stages, on the DEMO_DATA scenarios of both fixture
 * competitions with the bundled font roles of `config/brand.json` (OD-52, OD-54):
 * - shared templates and brand palette across two matchdays, and a template version change applying to every
 *   carousel generated afterwards while earlier renders keep their version (R-211);
 * - a complete carousel without any logo, badge or mascot image: names as text, empty badge slots, no placeholder
 *   or substitute image (R-212, R-231);
 * - deterministic rendering: the same data and template give identical numeric text and identical PNG bytes, and
 *   every score and team name equals the verified value exactly (R-213);
 * - every slide 1080 x 1350 by default (R-238);
 * - a brand asset registered once is used by the templates of every later project, also after a restart (R-228);
 * - the demonstration band on every DEMO_DATA slide and on no MANUAL_DATA slide (R-269).
 */
import { join } from 'node:path';

import { type Draft, ProjectListResponseSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { png } from '../../../src/modules/brand/test/images.js';
import { createRenderingStage } from '../../../src/modules/rendering/index.js';
import { BUILT_IN_TEMPLATES, TemplateRegistry } from '../../../src/modules/rendering/index.js';
import type { TemplateDefinition } from '../../../src/modules/rendering/index.js';
import { templateText } from '../../../src/platform/format/index.js';
import { type TestApp, expectNoNetworkViolations, startTestApp, temporaryDirectory } from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  COPA_DEMO_LEAGUE_MD1,
  type RenderModelView,
  type StoredVersion,
  allElements,
  draftOf,
  factsOf,
  fieldText,
  ligaDemo,
  LIGA_MANUAL_MD1,
  manualRootedApp,
  pngDimensions,
  projectWithDraft,
  renderModelOf,
  sha256,
  storedPng,
  switchableStage,
  versionsOfRun,
  WORKFLOW_TEST_TIMEOUT,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

/** The slide versions a run rendered (first versions; a later run may have superseded them). */
function slideVersions(t: Pick<TestApp, 'container'>, runId: string): StoredVersion[] {
  return versionsOfRun(t, runId).filter((row) => row.kind === 'slide' && row.version_number === 1);
}

/** The layout of a render model: every element's kind, ID and box, and the canvas. */
function layoutOf(model: RenderModelView): unknown {
  return {
    template: [model.templateId, model.templateVersion],
    canvas: model.canvas,
    elements: model.elements.map((element) => [element.kind, element.id, element.box]),
  };
}

/** Every colour a render model uses, with the palette role it claims. */
function coloursOf(model: RenderModelView): [string, string][] {
  return [
    [model.background.colorRole, model.background.color],
    ...model.elements
      .filter((element) => element.color !== undefined)
      .map((element): [string, string] => [String(element.colorRole), String(element.color)]),
  ];
}

async function uploadAsset(t: TestApp, kind: string, label: string, bytes: Buffer) {
  return t.inject({
    method: 'POST',
    url: `/api/v1/brand/assets?kind=${kind}&label=${encodeURIComponent(label)}`,
    headers: { host: t.host, origin: t.origin, 'x-edr-client': 'web', 'content-type': 'image/png' },
    payload: bytes,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// R-211
// ---------------------------------------------------------------------------------------------------------------

/** A new version of the match-result template: the same layout on another palette background (test only). */
function matchResultVersion(version: string): TemplateDefinition {
  const current = BUILT_IN_TEMPLATES.find((template) => template.slideType === 'match_result');
  if (current === undefined) {
    throw new Error('no match-result template');
  }
  return Object.freeze<TemplateDefinition>({
    ...current,
    version,
    build: (content, ctx) => {
      const model = current.build(content, ctx);
      return {
        ...model,
        templateVersion: version,
        background: { colorRole: 'secondary', color: model.palette.secondary },
      };
    },
  });
}

describe('templates and brand palette (R-211)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('two matchdays share layouts and use only the brand palette; a template change applies to every later carousel', async () => {
    const rendering = switchableStage('rendering');
    const t = await start(cleanup, {
      base: 'demo-only',
      scenario: 'default',
      stageOverrides: { rendering: rendering.stage },
    });
    const palette = t.container.config.brand.palette as unknown as Record<string, string>;
    const first = await projectWithDraft(t, ligaDemo(1));
    const second = await projectWithDraft(t, ligaDemo(2));
    const firstSlides = slideVersions(t, first.run.id);
    const secondSlides = slideVersions(t, second.run.id);
    for (const slideType of ['cover', 'match_result', 'standings', 'closing']) {
      const a = firstSlides.filter((row) => row.slide_type === slideType).map((row) => layoutOf(renderModelOf(row)));
      const b = secondSlides.filter((row) => row.slide_type === slideType).map((row) => layoutOf(renderModelOf(row)));
      expect(a.length, slideType).toBeGreaterThan(0);
      expect(b.length, slideType).toBeGreaterThan(0);
      // Same template and version, same canvas and boxes, slide by slide (both selections have 16 teams).
      expect(b, slideType).toEqual(a);
      if (slideType !== 'standings') {
        expect(new Set([...a, ...b].map((layout) => JSON.stringify(layout))).size, slideType).toBe(1);
      }
    }
    for (const row of [...firstSlides, ...secondSlides]) {
      const model = renderModelOf(row);
      expect(model.palette).toEqual(palette);
      for (const [role, colour] of coloursOf(model)) {
        expect(colour.toLowerCase(), `${String(row.slide_type)} ${role}`).toBe(String(palette[role]).toLowerCase());
      }
    }

    // A new template version of the match-result slide: every carousel generated afterwards uses it.
    const version = '1.1.0-t42';
    rendering.use(
      createRenderingStage({
        registry: new TemplateRegistry([...BUILT_IN_TEMPLATES, matchResultVersion(version)]),
      }) as never,
    );
    const third = await projectWithDraft(t, ligaDemo(3));
    const again = await t.runWorkflow(first.project.id);
    expect(again.status).toBe('completed');
    for (const runId of [third.run.id, again.id]) {
      for (const row of slideVersions(t, runId)) {
        const model = renderModelOf(row);
        const expected = row.slide_type === 'match_result' ? version : '1.0.0';
        expect([row.template_version, model.templateVersion], String(row.slide_type)).toEqual([expected, expected]);
        if (row.slide_type === 'match_result') {
          expect(model.background).toEqual({ colorRole: 'secondary', color: palette['secondary'] });
        }
        expect(row.qa_status, String(row.slide_type)).toBe('passed');
      }
    }
    // Slides rendered before the change keep the version they were rendered with.
    for (const row of [...firstSlides, ...secondSlides]) {
      expect(row.template_version).toBe('1.0.0');
      expect(renderModelOf(row).templateVersion).toBe('1.0.0');
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-212, R-231
// ---------------------------------------------------------------------------------------------------------------

describe('no logo, badge or mascot image (R-212, R-231)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it.each([
    ['liga-demo', ligaDemo(1)],
    ['copa-demo', COPA_DEMO_LEAGUE_MD1],
  ])(
    '%s: a complete carousel with names as text, empty badge slots and no image of any kind',
    async (_name, selection) => {
      const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
      expect((await t.get('/brand/assets')).json()).toEqual({ assets: [] });
      const { project, run } = await projectWithDraft(t, selection);
      expect(run.stages.map((stage) => stage.status)).toEqual([
        'completed',
        'completed',
        'completed',
        'completed',
        'completed',
      ]);
      const draft = await draftOf(t, project.id);
      const competitionName = project.competitionName;
      for (const row of slideVersions(t, run.id)) {
        const model = renderModelOf(row);
        expect(
          model.elements.filter((element) => element.kind === 'image'),
          String(row.slide_type),
        ).toEqual([]);
        const badges = model.elements.filter((element) => element.kind === 'badge_slot');
        if (row.slide_type === 'match_result') {
          expect(badges.map((badge) => [badge.slot, badge.empty])).toEqual([
            ['team-badge-home', true],
            ['team-badge-away', true],
          ]);
          const names = model.elements.filter((element) => element.semantic === 'team_name');
          expect(names).toHaveLength(2);
          expect(names.every((element) => element.kind === 'text' && String(element.text).length > 0)).toBe(true);
        } else {
          expect(badges).toEqual([]);
        }
        if (row.slide_type === 'cover') {
          expect(model.elements.find((element) => element.semantic === 'competition_name')?.text).toBe(competitionName);
        }
        const bytes = storedPng(t, row);
        expect(pngDimensions(bytes)).toEqual({ width: 1080, height: 1350 });
        expect(sha256(bytes)).toBe(row.image_sha256);
      }
      for (const element of allElements(draft)) {
        expect(element.currentVersion.state, String(element.slideType)).toBe('ready');
      }
      // Club badges and competition marks cannot be registered at all (PD-03): only brand kinds exist.
      const refused = await uploadAsset(t, 'team_badge', 'Escudo', png({ width: 32, height: 32 }));
      expect(refused.statusCode).toBe(400);
      expectNoNetworkViolations();
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// R-213, R-238
// ---------------------------------------------------------------------------------------------------------------

describe('deterministic rendering and slide size (R-213, R-238)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('the same data and template give identical numeric text and identical PNG bytes; values equal the verified ones', async () => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const first = await projectWithDraft(t, ligaDemo(1));
    const second = await projectWithDraft(t, ligaDemo(1));
    const rerun = await t.runWorkflow(first.project.id);
    expect(rerun.status).toBe('completed');
    const runs = [first.run.id, second.run.id, rerun.id].map((runId) => slideVersions(t, runId));
    const numeric = (rows: StoredVersion[]) =>
      rows.map((row) =>
        renderModelOf(row)
          .elements.filter((element) =>
            ['score', 'kickoff', 'standings_position', 'standings_cell'].includes(String(element.semantic)),
          )
          .map((element) => [element.semantic, element.text, element.lines]),
      );
    const reference = runs[0] as StoredVersion[];
    for (const rows of runs.slice(1)) {
      expect(rows.map((row) => row.slide_type)).toEqual(reference.map((row) => row.slide_type));
      expect(numeric(rows)).toEqual(numeric(reference));
      expect(rows.map((row) => row.image_sha256)).toEqual(reference.map((row) => row.image_sha256));
      expect(rows.map((row) => sha256(storedPng(t, row)))).toEqual(reference.map((row) => sha256(storedPng(t, row))));
    }

    // Every score and team name on a slide equals the verified value's display form exactly.
    const facts = (await factsOf(t, first.project.id, first.run.id)).facts;
    const display = new Map(facts.map((fact) => [fact.factId, fact.display]));
    for (const fact of facts) {
      expect(fact.status).toBe('verified');
    }
    let checked = 0;
    for (const row of reference) {
      for (const element of renderModelOf(row).elements) {
        if (element.semantic === 'score' || element.semantic === 'team_name') {
          expect(element.factIds?.length, element.id).toBeGreaterThan(0);
          for (const factId of element.factIds ?? []) {
            const value = display.get(factId);
            expect(value, element.id).toBeDefined();
            if (
              element.semantic === 'score' ||
              facts.find((fact) => fact.factId === factId)?.kind === 'team_official_name'
            ) {
              expect(element.text, element.id).toBe(value);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8 * 3);
  });

  it.each([
    ['liga-demo', ligaDemo(1)],
    ['copa-demo', COPA_DEMO_LEAGUE_MD1],
  ])(
    '%s: every slide is 1080 x 1350 by default, in the stored row, the render model, the PNG header and the draft',
    async (_name, selection) => {
      const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
      expect(t.container.config.format).toMatchObject({ width: 1080, height: 1350 });
      const { project, run } = await projectWithDraft(t, selection);
      for (const row of slideVersions(t, run.id)) {
        expect([row.width, row.height]).toEqual([1080, 1350]);
        expect(renderModelOf(row).canvas).toEqual({ width: 1080, height: 1350 });
        expect(pngDimensions(storedPng(t, row))).toEqual({ width: 1080, height: 1350 });
      }
      for (const element of allElements(await draftOf(t, project.id))) {
        if (element.kind === 'slide') {
          expect([element.currentVersion.width, element.currentVersion.height]).toEqual([1080, 1350]);
          const dimensions = element.currentVersion.qa.find((result) => result.check === 'dimensions');
          expect(dimensions).toMatchObject({
            outcome: 'pass',
            details: { expectedWidth: 1080, expectedHeight: 1350, actualWidth: 1080, actualHeight: 1350 },
          });
        }
        const image = await t.get(`/element-versions/${element.currentVersion.id}/image`);
        if (element.kind === 'slide') {
          expect(image.statusCode).toBe(200);
          expect(pngDimensions(image.rawPayload)).toEqual({ width: 1080, height: 1350 });
        } else {
          expect(image.statusCode).toBe(404);
        }
      }
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// R-228
// ---------------------------------------------------------------------------------------------------------------

describe('brand asset reuse across projects (R-228)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('an asset registered once is used by the templates of every later project, also after a restart', async () => {
    const data = temporaryDirectory('t42-brand');
    cleanup.add(() => data.remove());
    const dataDir = join(data.path, 'data');
    const t = await startTestApp({ base: 'demo-only', scenario: 'default', dataDir });
    let open = true;
    cleanup.add(async () => {
      if (open) {
        await t.close();
      }
    });
    const before = await projectWithDraft(t, ligaDemo(1));

    const logo = await uploadAsset(
      t,
      'brand_logo',
      'Logo sintético',
      png({ width: 120, height: 50, rgba: [200, 30, 30, 255] }),
    );
    expect(logo.statusCode, logo.body).toBe(201);
    const mascot = await uploadAsset(
      t,
      'mascot',
      'Mascota sintética',
      png({ width: 60, height: 80, rgba: [30, 30, 200, 255] }),
    );
    expect(mascot.statusCode, mascot.body).toBe(201);
    const assets = { brand_logo: (logo.json() as { id: string }).id, mascot: (mascot.json() as { id: string }).id };

    const expectAssets = (rows: StoredVersion[]) => {
      for (const row of rows) {
        const images = renderModelOf(row).elements.filter((element) => element.kind === 'image');
        const slots = new Set(images.map((image) => image.slot));
        expect(slots.has('brand_logo'), String(row.slide_type)).toBe(true);
        expect(slots.has('mascot'), String(row.slide_type)).toBe(
          row.slide_type === 'cover' || row.slide_type === 'closing',
        );
        for (const image of images) {
          expect(image.assetId).toBe(assets[image.slot as keyof typeof assets]);
        }
        expect(row.qa_status).toBe('passed');
      }
    };
    // The earlier project keeps its renders; every later project uses the assets.
    expect(
      slideVersions(t, before.run.id)
        .flatMap((row) => renderModelOf(row).elements)
        .filter((e) => e.kind === 'image'),
    ).toEqual([]);
    const later = await projectWithDraft(t, ligaDemo(2));
    expectAssets(slideVersions(t, later.run.id));
    const otherCompetition = await projectWithDraft(t, COPA_DEMO_LEAGUE_MD1);
    expectAssets(slideVersions(t, otherCompetition.run.id));
    open = false;
    await t.close();

    const restarted = await start(cleanup, { base: 'demo-only', scenario: 'default', dataDir });
    const afterRestart = await projectWithDraft(restarted, ligaDemo(3));
    expectAssets(slideVersions(restarted, afterRestart.run.id));
    const listed = (await restarted.get('/brand/assets')).json() as { assets: { id: string; active: boolean }[] };
    expect(listed.assets.map((asset) => asset.id).sort()).toEqual(Object.values(assets).sort());
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-269
// ---------------------------------------------------------------------------------------------------------------

describe('demonstration label (R-269)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it.each(['es', 'en'] as const)('every DEMO_DATA slide carries the demonstration band (%s)', async (language) => {
    const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
    const { project, run } = await projectWithDraft(t, { ...ligaDemo(1), language });
    const label = templateText(language).demonstrationLabel;
    for (const row of slideVersions(t, run.id)) {
      const model = renderModelOf(row);
      expect(model.demoLabel, String(row.slide_type)).toBe(label);
      expect(model.elements.filter((element) => element.semantic === 'demo_label').map((e) => e.text)).toEqual([label]);
    }
    const draft = await draftOf(t, project.id);
    expect(draft).toMatchObject({ dataMode: 'DEMO_DATA', demonstration: true });
    const projects = ProjectListResponseSchema.parse((await t.get('/projects')).json()).projects;
    expect(projects.find((entry) => entry.id === project.id)).toMatchObject({
      dataMode: 'DEMO_DATA',
      demonstration: true,
    });
    // Every fact names its mode and source.
    for (const fact of (await factsOf(t, project.id, run.id)).facts) {
      expect(fact.evidence.length).toBeGreaterThan(0);
      for (const evidence of fact.evidence) {
        expect(evidence.dataMode).toBe('DEMO_DATA');
        expect(evidence.sourceName.length).toBeGreaterThan(0);
      }
    }
  });

  it('no MANUAL_DATA slide carries it; its facts name the mode and the import', async () => {
    const a = await manualRootedApp(cleanup, { marked: false });
    const { project, run } = await projectWithDraft(a, LIGA_MANUAL_MD1);
    const draft: Draft = await draftOf(a, project.id);
    expect(draft).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
    const rows = slideVersions(a, run.id);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const model = renderModelOf(row);
      expect(model.demoLabel).toBeNull();
      expect(model.elements.filter((element) => element.semantic === 'demo_label')).toEqual([]);
    }
    for (const element of allElements(draft)) {
      expect(fieldText(element, 'demo_label')).toBe('');
    }
    for (const fact of (await factsOf(a, project.id, run.id)).facts) {
      for (const evidence of fact.evidence) {
        expect(evidence).toMatchObject({ dataMode: 'MANUAL_DATA', sourceId: 'manual' });
        expect(evidence.importVersionId).not.toBeNull();
      }
    }
  });
});
