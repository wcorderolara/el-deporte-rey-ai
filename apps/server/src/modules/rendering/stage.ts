/**
 * Rendering stage (architecture.md sections 6 and 9; contracts/provider-ports.md section 3).
 *
 * - `load` reads the draft the content stage produced in this run, the slides whose current version has no render
 *   yet with their stored text (content module `ElementTextSchema`), the project's data mode (demonstration band of
 *   DEMO_DATA, OD-21), the "as of" time of the facts run, and the active brand logo and mascot with their verified
 *   bytes (T33). A run without a draft fails with `no_data`.
 * - `run` is the pure core: one render model and one PNG per slide, at the configured size, with the current
 *   templates (no database writes).
 * - `persist` writes each PNG to `renders/<projectId>/<versionId>.png` with the exclusive flag (T10-F13), then
 *   records every render on its element version in one transaction. A version rendered or superseded in the meantime
 *   fails the stage with `run_superseded` and nothing is recorded.
 *
 * `renderElementVersion` renders one element version the same way (regeneration of one element, T37).
 */
import { createHash } from 'node:crypto';

import { BrandAssetMimeSchema, type Language, LanguageSchema, SlideTypeSchema, UuidSchema } from '@edr/contracts';
import { z } from 'zod';

import type { AppContainer } from '../../container.js';
import { StageFailure } from '../../workflow/index.js';
import { type BrandAssetLookup, brandAssetLookup } from '../brand/index.js';
import type { Stage, StageContext } from '../module-kit.js';

import {
  type RenderDeps,
  type SlideRender,
  type SlotAsset,
  activeSlotAssets,
  renderContent,
  renderSettings,
} from './core.js';
import { RenderFileStore } from './files.js';
import { type FontSet, fontSetFor, loadBundledFaces } from './fonts.js';
import { ImageSlotSchema, RenderModelSchema } from './render-model.js';
import { RenderingRepository, type SavedRender } from './repository.js';
import { type SlideContent, StoredElementTextSchema } from './slide-content.js';
import { TemplateRegistry } from './templates/registry.js';

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/** Binary content (a Buffer or another Uint8Array). */
const BytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'expected bytes');

const SlotAssetSchema = z.strictObject({
  slot: ImageSlotSchema,
  id: UuidSchema,
  sha256: Sha256Schema,
  mime: BrandAssetMimeSchema,
  content: BytesSchema,
});

export const RenderingInputSchema = z.strictObject({
  projectId: UuidSchema,
  draftId: UuidSchema,
  language: LanguageSchema,
  demonstration: z.boolean(),
  standingsAsOf: z.string().max(40).nullable(),
  slides: z
    .array(
      z.strictObject({
        elementId: UuidSchema,
        versionId: UuidSchema,
        slideType: SlideTypeSchema,
        text: StoredElementTextSchema,
      }),
    )
    .max(2000),
  assets: z.array(SlotAssetSchema).max(2),
});
export type RenderingInput = z.infer<typeof RenderingInputSchema>;

const RenderOutputSchema = z.strictObject({
  versionId: UuidSchema,
  templateId: z.string().min(1).max(64),
  templateVersion: z.string().min(1).max(32),
  renderModel: RenderModelSchema,
  png: BytesSchema,
  sha256: Sha256Schema,
  width: z.int().min(1),
  height: z.int().min(1),
});

export const RenderingOutputSchema = z.strictObject({
  projectId: UuidSchema,
  renders: z.array(RenderOutputSchema).max(2000),
});
export type RenderingOutput = z.infer<typeof RenderingOutputSchema>;

export interface RenderingOptions {
  /** Template registry; default the built-in templates. */
  readonly registry?: TemplateRegistry;
  /** Font set factory; default the bundled faces with the configured brand font roles. */
  readonly fonts?: (container: AppContainer) => FontSet;
  /** Brand asset lookup factory; default the brand module's lookup (T33). */
  readonly assets?: (container: AppContainer) => BrandAssetLookup;
}

interface ResolvedOptions {
  readonly registry: TemplateRegistry;
  readonly fonts: (container: AppContainer) => FontSet;
  readonly assets: (container: AppContainer) => BrandAssetLookup;
}

function resolveOptions(options: RenderingOptions): ResolvedOptions {
  return {
    registry: options.registry ?? new TemplateRegistry(),
    fonts: options.fonts ?? ((container) => fontSetFor(container.config.brand.fonts, loadBundledFaces())),
    assets: options.assets ?? brandAssetLookup,
  };
}

function slideContent(
  input: { language: Language; demonstration: boolean; standingsAsOf: string | null },
  slide: RenderingInput['slides'][number],
): SlideContent {
  return {
    slideType: slide.slideType,
    language: input.language,
    demonstration: input.demonstration,
    text: slide.text,
    standingsAsOf: input.standingsAsOf,
  };
}

function renderDeps(
  container: AppContainer,
  options: ResolvedOptions,
  assets: readonly SlotAsset[],
  signal?: AbortSignal,
): RenderDeps {
  return {
    registry: options.registry,
    fonts: options.fonts(container),
    settings: renderSettings(container.config),
    assets,
    ...(signal === undefined ? {} : { signal }),
  };
}

/** Writes the PNG files, then records the renders; throws `run_superseded` when a version cannot be recorded. */
async function persistRenders(
  container: AppContainer,
  projectId: string,
  renders: readonly (SlideRender & { versionId: string })[],
): Promise<void> {
  const files = new RenderFileStore(container.paths.dataDir);
  const saved: SavedRender[] = [];
  for (const render of renders) {
    const imagePath = await files.create(projectId, render.versionId, render.png);
    saved.push({
      versionId: render.versionId,
      templateId: render.templateId,
      templateVersion: render.templateVersion,
      renderModel: render.renderModel,
      imagePath,
      sha256: render.sha256,
      width: render.width,
      height: render.height,
    });
  }
  const refused = new RenderingRepository(container.db).saveRenders(saved);
  if (refused.length > 0) {
    throw new StageFailure('run_superseded');
  }
}

/** The rendering stage with the given options. */
export function createRenderingStage(options: RenderingOptions = {}): Stage<RenderingInput, RenderingOutput> {
  const resolved = resolveOptions(options);
  return {
    name: 'rendering',
    input: RenderingInputSchema,
    output: RenderingOutputSchema,

    async load(ctx: StageContext): Promise<RenderingInput> {
      const repository = new RenderingRepository(ctx.container.db);
      const dataMode = repository.projectDataMode(ctx.projectId);
      const draft = repository.draftOfRun(ctx.projectId, ctx.runId);
      if (dataMode === null || draft === null) {
        throw new StageFailure('no_data');
      }
      return {
        projectId: ctx.projectId,
        draftId: draft.id,
        language: draft.language,
        demonstration: dataMode === 'DEMO_DATA',
        standingsAsOf: repository.standingsAsOf(draft.factsRunId),
        slides: repository.slidesToRender(draft.id),
        assets: await activeSlotAssets(resolved.assets(ctx.container)),
      };
    },

    async run(input: RenderingInput, ctx: StageContext): Promise<RenderingOutput> {
      const deps = renderDeps(ctx.container, resolved, input.assets, ctx.signal);
      const renders: RenderingOutput['renders'] = [];
      for (const [index, slide] of input.slides.entries()) {
        if (ctx.signal.aborted) {
          throw new StageFailure('interrupted');
        }
        const render = await renderContent(slideContent(input, slide), deps, `/slides/${String(index)}/text`);
        renders.push({ versionId: slide.versionId, ...render });
      }
      return { projectId: input.projectId, renders };
    },

    async persist(output: RenderingOutput, ctx: StageContext): Promise<void> {
      await persistRenders(
        ctx.container,
        output.projectId,
        output.renders.map((render) => ({ ...render, png: Buffer.from(render.png) })),
      );
    },
  };
}

/** The rendering stage of the static registry. */
export const renderingStage = createRenderingStage() as unknown as Stage<unknown, unknown>;

/** Why a single element version cannot be rendered. */
export type RenderVersionRefusal = 'not_found' | 'not_a_slide' | 'not_current' | 'already_rendered';

export class RenderVersionRefused extends Error {
  override readonly name = 'RenderVersionRefused';
  readonly reason: RenderVersionRefusal;

  constructor(reason: RenderVersionRefusal) {
    super(`element version cannot be rendered: ${reason}`);
    this.reason = reason;
  }
}

/** The result of rendering one element version. */
export interface RenderedVersion {
  readonly versionId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly imagePath: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Renders one element version (the regeneration of one element, T37): the version must be the current, unrendered,
 * non-superseded version of a slide. Uses the current templates and the active brand assets, like the stage.
 */
export async function renderElementVersion(
  container: AppContainer,
  versionId: string,
  options: RenderingOptions = {},
  signal?: AbortSignal,
): Promise<RenderedVersion> {
  const resolved = resolveOptions(options);
  const repository = new RenderingRepository(container.db);
  const version = UuidSchema.safeParse(versionId).success ? repository.version(versionId) : null;
  if (version === null) {
    throw new RenderVersionRefused('not_found');
  }
  if (version.kind !== 'slide' || version.slideType === null) {
    throw new RenderVersionRefused('not_a_slide');
  }
  if (!version.current || version.superseded) {
    throw new RenderVersionRefused('not_current');
  }
  if (version.rendered) {
    throw new RenderVersionRefused('already_rendered');
  }
  const assets = await activeSlotAssets(resolved.assets(container));
  const render = await renderContent(
    {
      slideType: version.slideType,
      language: version.language,
      demonstration: version.dataMode === 'DEMO_DATA',
      text: version.text,
      standingsAsOf: repository.standingsAsOf(version.factsRunId),
    },
    renderDeps(container, resolved, assets, signal),
    '/text',
  );
  await persistRenders(container, version.projectId, [{ ...render, versionId }]);
  const stored = repository.renderedImage(versionId);
  return {
    versionId,
    templateId: render.templateId,
    templateVersion: render.templateVersion,
    imagePath: stored?.imagePath ?? '',
    sha256: render.sha256,
    width: render.width,
    height: render.height,
  };
}

/** Relative API path of a slide image (contract operation getSlideImage; OD-42). */
export function slideImageUrl(versionId: string): string {
  return `/api/v1/element-versions/${UuidSchema.parse(versionId)}/image`;
}

/** Reads the stored PNG of an element version (for getSlideImage, T37); null when it has no render. */
export async function readSlideImage(container: AppContainer, versionId: string): Promise<Buffer | null> {
  const ref = new RenderingRepository(container.db).renderedImage(versionId);
  if (ref === null || ref.imagePath === null || ref.sha256 === null) {
    return null;
  }
  const png = await new RenderFileStore(container.paths.dataDir).read(ref.projectId, ref.versionId);
  if (createHash('sha256').update(png).digest('hex') !== ref.sha256) {
    throw new RenderIntegrityError();
  }
  return png;
}

/** A stored render whose bytes no longer match the recorded hash; a server defect. */
export class RenderIntegrityError extends Error {
  override readonly name = 'RenderIntegrityError';

  constructor() {
    super('a rendered file does not match its recorded hash');
  }
}
