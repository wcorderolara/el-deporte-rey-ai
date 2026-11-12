/**
 * Rendering stage on a migrated database in a temporary data directory (architecture.md sections 6 and 9;
 * contracts/provider-ports.md section 3; R-211, R-212, R-213, R-225, R-238, R-269, R-285; T10-F13).
 *
 * The draft rows are synthetic and shaped as the content stage (T32) stores them: element text version 1 with
 * provenance segments, positional slides and a caption, versions with the render columns NULL and `qa_status`
 * pending.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StageFailure } from '../../workflow/index.js';
import type { BrandAssetLookup } from '../brand/index.js';
import { png } from '../brand/test/images.js';
import type { StageContext } from '../module-kit.js';

import { pngSize } from './renderer.js';
import { RenderModelSchema } from './render-model.js';
import type { RenderVersionRefused } from './stage.js';
import {
  type RenderingOptions,
  createRenderingStage,
  readSlideImage,
  renderElementVersion,
  slideImageUrl,
} from './stage.js';
import type { TemplateDefinition } from './templates/common.js';
import { matchResultTemplateV1 } from './templates/match-result.js';
import { BUILT_IN_TEMPLATES, TemplateRegistry } from './templates/registry.js';
import {
  MATCH_A,
  SELECTION_A,
  type RenderDb,
  type SeedSlide,
  carouselWithoutStandings,
  closingText,
  coverText,
  matchText,
  renderDb,
  seedDraft,
  seedProject,
  seedRetrieval,
  seedRun,
  standingsRows,
  standingsText,
  testFonts,
  uuid,
} from './test/support.js';

const PROJECT = uuid(1);
const RUN = uuid(2);
const DRAFT = uuid(3);
const CAROUSEL = uuid(4);
const CAPTION = { elementId: uuid(5), versionId: uuid(6) };

const fonts = testFonts();
const noAssets: BrandAssetLookup = {
  activeAssets: () => [],
  readFile: () => Promise.reject(new Error('no asset')),
};
const baseOptions: RenderingOptions = { fonts: () => fonts, assets: () => noAssets };

let env: RenderDb;

function ctx(runId = RUN, projectId = PROJECT): StageContext {
  return { runId, projectId, runKind: 'full', container: env.container, signal: new AbortController().signal };
}

async function runStage(options: RenderingOptions = baseOptions, context: StageContext = ctx()) {
  const stage = createRenderingStage(options);
  const input = stage.input.parse(await stage.load(context));
  const output = stage.output.parse(await stage.run(input, context));
  await stage.persist(output, context);
  return { input, output };
}

interface VersionRow {
  id: string;
  template_id: string | null;
  template_version: string | null;
  render_model: string | null;
  image_path: string | null;
  image_sha256: string | null;
  width: number | null;
  height: number | null;
  qa_status: string;
}

function version(id: string): VersionRow {
  const row = env.db
    .prepare<VersionRow>(
      'SELECT id, template_id, template_version, render_model, image_path, image_sha256, width, height, qa_status ' +
        'FROM element_versions WHERE id = ?',
    )
    .get([id]);
  if (row === undefined) {
    throw new Error('missing version');
  }
  return row;
}

function fullCarousel(base: number): SeedSlide[] {
  return [
    { elementId: uuid(base + 1), versionId: uuid(base + 2), slideType: 'cover', text: coverText(SELECTION_A) },
    { elementId: uuid(base + 3), versionId: uuid(base + 4), slideType: 'match_result', text: matchText(MATCH_A) },
    {
      elementId: uuid(base + 5),
      versionId: uuid(base + 6),
      slideType: 'standings',
      text: standingsText(standingsRows(12)),
    },
    { elementId: uuid(base + 7), versionId: uuid(base + 8), slideType: 'closing', text: closingText() },
  ];
}

beforeEach(() => {
  env = renderDb();
});

afterEach(() => {
  env.close();
});

describe('rendering stage', () => {
  it('renders every slide of the run draft at 1080 x 1350 and records each render once', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    seedRetrieval(env.db, RUN, uuid(7), '2026-10-25T09:30:00Z');
    const slides = fullCarousel(100);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides,
      captionIds: CAPTION,
    });

    const { input, output } = await runStage();
    expect(input.slides.map((slide) => slide.slideType)).toEqual(['cover', 'match_result', 'standings', 'closing']);
    expect(input.demonstration).toBe(true);
    expect(output.renders).toHaveLength(4);

    for (const slide of slides) {
      const row = version(slide.versionId);
      expect([row.template_version, row.width, row.height, row.qa_status]).toEqual(['1.0.0', 1080, 1350, 'pending']);
      expect(row.image_path).toBe(`renders/${PROJECT}/${slide.versionId}.png`);
      const file = readFileSync(join(env.root.dataDir, row.image_path ?? ''));
      expect(createHash('sha256').update(file).digest('hex')).toBe(row.image_sha256);
      expect(pngSize(file)).toEqual({ width: 1080, height: 1350 });
      expect(statSync(join(env.root.dataDir, row.image_path ?? '')).mode & 0o777).toBe(0o600);
      const model = RenderModelSchema.parse(JSON.parse(row.render_model ?? 'null'));
      expect([model.templateId, model.slideType, model.demoLabel]).toEqual([
        row.template_id,
        slide.slideType,
        'DEMOSTRACIÓN · datos sintéticos',
      ]);
    }
    const standings = RenderModelSchema.parse(JSON.parse(version(uuid(106)).render_model ?? 'null'));
    expect(
      standings.elements.some((element) => element.kind === 'text' && element.text === 'Actualizada al 25 oct 2026'),
    ).toBe(true);
    // The caption has no image.
    expect(version(CAPTION.versionId).render_model).toBeNull();

    // A second pass finds nothing left to render and changes nothing.
    const before = slides.map((slide) => version(slide.versionId));
    const again = await runStage();
    expect(again.output.renders).toEqual([]);
    expect(slides.map((slide) => version(slide.versionId))).toEqual(before);
  });

  it('gives a byte-identical image for the same stored text (R-213)', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    const same = matchText(MATCH_A);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides: [
        { elementId: uuid(201), versionId: uuid(202), slideType: 'match_result', text: same },
        { elementId: uuid(203), versionId: uuid(204), slideType: 'match_result', text: same },
      ],
    });
    await runStage();
    expect(version(uuid(202)).image_sha256).toBe(version(uuid(204)).image_sha256);
    expect(version(uuid(202)).render_model).toBe(version(uuid(204)).render_model);
  });

  it('renders a complete carousel without standings (R-285) and no band for other data modes (R-269)', async () => {
    seedProject(env.db, PROJECT, 'MANUAL_DATA', RUN);
    const slides = carouselWithoutStandings(300);
    seedDraft(env.db, { projectId: PROJECT, runId: RUN, draftId: DRAFT, carouselId: CAROUSEL, slides });
    const { input } = await runStage();
    expect(input.demonstration).toBe(false);
    expect(input.standingsAsOf).toBeNull();
    for (const slide of slides) {
      const model = RenderModelSchema.parse(JSON.parse(version(slide.versionId).render_model ?? 'null'));
      expect(model.demoLabel).toBeNull();
      expect(model.elements.some((element) => element.kind === 'text' && element.overflow)).toBe(false);
      expect(model.elements.some((element) => element.kind === 'image')).toBe(false);
    }
  });

  it('applies a new template version to later carousels only (R-211)', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides: fullCarousel(400),
    });
    await runStage();
    const earlier = version(uuid(404));

    // A later version without badges: the version of a project whose badges do not cover the engine templates.
    const version2: TemplateDefinition = {
      ...matchResultTemplateV1,
      version: '1.2.0',
      build: (slide, context) => ({ ...matchResultTemplateV1.build(slide, context), templateVersion: '1.2.0' }),
    };
    const registry = new TemplateRegistry([...BUILT_IN_TEMPLATES, version2]);
    const run2 = uuid(450);
    seedRun(env.db, PROJECT, run2, 2);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: run2,
      draftId: uuid(451),
      carouselId: uuid(452),
      slides: fullCarousel(460),
    });
    await runStage({ ...baseOptions, registry }, ctx(run2));
    expect(version(uuid(464)).template_version).toBe('1.2.0');
    expect(version(uuid(462)).template_version).toBe('1.0.0');
    // The earlier version keeps the template version and the render it was made with.
    expect(version(uuid(404))).toEqual(earlier);
    expect(earlier.template_version).toBe('1.0.0');
  });

  it('places active brand assets and keeps the layout complete without them (R-212)', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides: fullCarousel(500),
    });
    const logo = png({ width: 30, height: 20, rgba: [212, 175, 55, 255] });
    const sha256 = createHash('sha256').update(logo).digest('hex');
    const asset = {
      id: uuid(590),
      kind: 'brand_logo' as const,
      label: 'Logo sintético',
      description: null,
      mime: 'image/png' as const,
      width: 30,
      height: 20,
      byteSize: logo.length,
      sha256,
      usagePolicy: 'protected' as const,
      official: true,
      primary: true,
      variant: null,
      pose: null,
      expression: null,
      active: true,
      registeredAt: '2026-10-27T12:00:00.000Z',
      updatedAt: '2026-10-27T12:00:00.000Z',
    };
    const lookup: BrandAssetLookup = {
      activeAssets: (kind) => (kind === 'brand_logo' ? [asset] : []),
      readFile: async () => Promise.resolve({ asset, content: logo }),
    };
    await runStage({ fonts: () => fonts, assets: () => lookup });
    for (const versionId of [uuid(502), uuid(504), uuid(506), uuid(508)]) {
      const model = RenderModelSchema.parse(JSON.parse(version(versionId).render_model ?? 'null'));
      const images = model.elements.filter((element) => element.kind === 'image');
      expect(images.map((image) => image.kind === 'image' && [image.slot, image.assetId, image.sha256])).toEqual([
        ['brand_logo', asset.id, sha256],
      ]);
    }
  });

  it('uses the brand registry by default and draws no substitute when no asset is registered (OD-07)', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides: fullCarousel(600),
    });
    await runStage({ fonts: () => fonts });
    const model = RenderModelSchema.parse(JSON.parse(version(uuid(602)).render_model ?? 'null'));
    expect(model.elements.some((element) => element.kind === 'image')).toBe(false);
  });

  it('fails with no_data when the run produced no draft', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    const stage = createRenderingStage(baseOptions);
    const error = await stage.load(ctx()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StageFailure);
    expect((error as StageFailure).failure.code).toBe('no_data');
  });

  it('records nothing and fails with run_superseded when a version is superseded meanwhile', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    const slides = fullCarousel(700);
    seedDraft(env.db, { projectId: PROJECT, runId: RUN, draftId: DRAFT, carouselId: CAROUSEL, slides });
    const stage = createRenderingStage(baseOptions);
    const input = stage.input.parse(await stage.load(ctx()));
    const output = stage.output.parse(await stage.run(input, ctx()));
    env.db
      .prepare('UPDATE element_versions SET superseded_at = ? WHERE id = ?')
      .run(['2026-10-27T12:00:01.000Z', uuid(704)]);
    const error = await stage.persist(output, ctx()).catch((caught: unknown) => caught);
    expect((error as StageFailure).failure.code).toBe('run_superseded');
    for (const slide of slides) {
      expect(version(slide.versionId).render_model).toBeNull();
    }
  });

  it('fails with invalid when stored standings text does not have the row shape', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    const broken = standingsText(standingsRows(2));
    const text = {
      ...broken,
      fields: broken.fields.map((field) =>
        field.field === 'standings' ? { ...field, segments: field.segments.slice(1) } : field,
      ),
    };
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides: [{ elementId: uuid(801), versionId: uuid(802), slideType: 'standings', text }],
    });
    const error = await runStage().catch((caught: unknown) => caught);
    expect((error as StageFailure).failure).toEqual({
      code: 'invalid',
      sourceId: null,
      path: '/slides/0/text',
      httpStatus: null,
    });
  });
});

describe('renderElementVersion (regeneration of one element, T37) and slide images', () => {
  it('renders a regenerated current version and refuses every other case', async () => {
    seedProject(env.db, PROJECT, 'DEMO_DATA', RUN);
    seedDraft(env.db, {
      projectId: PROJECT,
      runId: RUN,
      draftId: DRAFT,
      carouselId: CAROUSEL,
      slides: fullCarousel(900),
      captionIds: CAPTION,
    });
    await runStage();
    const options = baseOptions;
    const refusal = (versionId: string) =>
      renderElementVersion(env.container, versionId, options).catch(
        (caught: unknown) => (caught as RenderVersionRefused).reason,
      );
    expect(await refusal(uuid(999))).toBe('not_found');
    expect(await refusal('not-a-uuid')).toBe('not_found');
    expect(await refusal(CAPTION.versionId)).toBe('not_a_slide');
    expect(await refusal(uuid(904))).toBe('already_rendered');

    // A regeneration: version 2 of the match element becomes current, version 1 is superseded.
    const regenerated = uuid(950);
    env.db
      .prepare(
        'INSERT INTO element_versions (id, element_id, version_number, origin, text, content_flags, ai_adapter, ' +
          "qa_status, created_at) VALUES (?, ?, 2, 'regenerated', ?, '[]', 'stub', 'pending', ?)",
      )
      .run([
        regenerated,
        uuid(903),
        JSON.stringify(matchText(MATCH_A, { headline: ' gana otra vez' })),
        '2026-10-27T13:00:00.000Z',
      ]);
    expect(await refusal(regenerated)).toBe('not_current');
    env.db
      .prepare('UPDATE element_versions SET superseded_at = ? WHERE id = ?')
      .run(['2026-10-27T13:00:00.000Z', uuid(904)]);
    env.db.prepare('UPDATE elements SET current_version_id = ? WHERE id = ?').run([regenerated, uuid(903)]);
    expect(await refusal(uuid(904))).toBe('not_current');

    const result = await renderElementVersion(env.container, regenerated, options);
    expect([result.templateId, result.templateVersion, result.width, result.height]).toEqual([
      'match-result',
      '1.0.0',
      1080,
      1350,
    ]);
    expect(result.imagePath).toBe(`renders/${PROJECT}/${regenerated}.png`);
    expect(existsSync(join(env.root.dataDir, result.imagePath))).toBe(true);
    // Other elements keep their renders.
    expect(version(uuid(902)).template_version).toBe('1.0.0');

    const image = await readSlideImage(env.container, regenerated);
    expect(image === null ? null : createHash('sha256').update(image).digest('hex')).toBe(result.sha256);
    expect(await readSlideImage(env.container, CAPTION.versionId)).toBeNull();
    expect(slideImageUrl(regenerated)).toBe(`/api/v1/element-versions/${regenerated}/image`);
  });
});
