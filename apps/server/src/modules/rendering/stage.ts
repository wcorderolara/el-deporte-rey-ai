/**
 * Rendering stage (architecture.md sections 6 and 9; contracts/provider-ports.md section 3).
 *
 * - `load` reads the draft the content stage produced in this run, the slides whose current version has no render
 *   yet with their stored text (content module `ElementTextSchema`), the project's data mode (demonstration band of
 *   DEMO_DATA, OD-21), the "as of" time of the facts run, and the active brand logo and mascot with their verified
 *   bytes (T33). A run without a draft fails with `no_data`.
 * - `load` also reads the project's badge snapshot with its verified files and the teams (local IDs) of every slide
 *   that draws badges: the slides of a visual template, the engine match slides when the snapshot covers the engine
 *   templates (PD-ARCH-01G-E.1), and the rows of the engine round calendars when it covers the calendar rows
 *   (PD-ARCH-01G-E.2). The teams are found through the facts' evidence, never by a name.
 * - `load` also reads the presentation names of the project's snapshot (version 4, TEAM-DISPLAY-01) as the name to
 *   draw for each team-name fact of the slides; `run` draws them in the team-name fields only (`presentedText`). The
 *   stored text, and so the review, the copy and the checks of the AI text, keep the official names.
 * - `run` is the pure core: one render model and one PNG per slide, at the configured size, with the current
 *   templates (no database writes).
 * - `persist` writes each PNG to `renders/<projectId>/<versionId>.png` with the exclusive flag (T10-F13), then
 *   records every render on its element version in one transaction. A version rendered or superseded in the meantime
 *   fails the stage with `run_superseded` and nothing is recorded.
 *
 * `renderElementVersion` renders one element version the same way (regeneration of one element, T37).
 */
import { createHash } from 'node:crypto';

import { type Language, LanguageSchema, SlideTypeSchema, UuidSchema } from '@edr/contracts';
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
import { type SlideContent, type StoredElementText, StoredElementTextSchema } from './slide-content.js';
import { renderSlide } from './renderer.js';
import { buildStructuredModel } from './structured.js';
import {
  type ProjectBadges,
  type ProjectTemplatePlan,
  ProjectTemplatePlanSchema,
  type SlideTeams,
  engineRowBadges,
  engineSlideBadges,
  displayNamesOfSlides,
  loadProjectBadges,
  loadProjectDisplayNames,
  loadProjectTemplatePlans,
  planOf,
  presentedText,
  projectSlideDocument,
  slideTeams,
} from '../visual-templates/project.js';
import { TemplateRegistry } from './templates/registry.js';

const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/** Binary content (a Buffer or another Uint8Array). */
const BytesSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'expected bytes');

const SlotAssetSchema = z.strictObject({
  slot: ImageSlotSchema,
  id: UuidSchema,
  sha256: Sha256Schema,
  // The renderer draws PNG and JPEG only; WebP style references never reach it (PD-ARCH-01G-A).
  mime: z.enum(['image/png', 'image/jpeg']),
  content: BytesSchema,
});

/** A project's badges as validated stage input (it carries a map and bytes). */
const ProjectBadgesSchema = z.custom<ProjectBadges>(
  (value) => typeof value === 'object' && value !== null && 'engineSlots' in value && 'files' in value,
  'expected the project badges',
);

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
  /**
   * The visual templates of the project (PD-ARCH-01G-D), at most one per slide type (decision 01G-D-3); empty for the
   * engine templates only.
   */
  templates: z.array(ProjectTemplatePlanSchema).max(6),
  /** The project's badge snapshot with its verified files (PD-ARCH-01G-D, PD-ARCH-01G-E.1, PD-ARCH-01G-E.2). */
  badges: ProjectBadgesSchema,
  /**
   * The teams (local IDs) of each slide that draws badges, by element version ID; a round calendar also has the teams
   * of each row.
   */
  slideTeams: z.record(
    UuidSchema,
    z.strictObject({
      home: UuidSchema.nullable(),
      away: UuidSchema.nullable(),
      rows: z
        .array(z.strictObject({ home: UuidSchema.nullable(), away: UuidSchema.nullable() }))
        .max(64)
        .readonly()
        .optional(),
    }),
  ),
  /**
   * TEAM-DISPLAY-01: the presentation name to draw for each team-name fact of the slides, by fact ID, from the
   * project's snapshot (empty for a project created before snapshot version 4).
   */
  teamDisplayNames: z.record(UuidSchema, z.string().min(1).max(32)),
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

const NO_TEAMS: SlideTeams = Object.freeze({ home: null, away: null });

function slideContent(
  input: { language: Language; demonstration: boolean; standingsAsOf: string | null; badges: ProjectBadges },
  slide: RenderingInput['slides'][number],
  teams: SlideTeams,
): SlideContent {
  const badges = engineSlideBadges(input.badges, teams);
  const rowBadges = engineRowBadges(input.badges, teams);
  return {
    slideType: slide.slideType,
    language: input.language,
    demonstration: input.demonstration,
    text: slide.text,
    standingsAsOf: input.standingsAsOf,
    ...(badges === undefined ? {} : { badges }),
    ...(rowBadges === undefined ? {} : { rowBadges }),
  };
}

function renderDeps(
  container: AppContainer,
  options: ResolvedOptions,
  assets: readonly SlotAsset[],
  badges: ProjectBadges,
  signal?: AbortSignal,
): RenderDeps {
  return {
    registry: options.registry,
    fonts: options.fonts(container),
    settings: renderSettings(container.config),
    assets,
    badgeFiles: badges.files,
    ...(signal === undefined ? {} : { signal }),
  };
}

/**
 * True when a slide draws team badges: its type has a visual template in the project, or the current engine template
 * of its type has badge slots that the project's badges cover (the match slots, PD-ARCH-01G-E.1; the calendar rows,
 * PD-ARCH-01G-E.2).
 */
function drawsBadges(
  registry: TemplateRegistry,
  templates: readonly ProjectTemplatePlan[],
  badges: ProjectBadges,
  slideType: z.infer<typeof SlideTypeSchema>,
): boolean {
  if (planOf(templates, slideType) !== null) {
    return true;
  }
  const current = registry.current(slideType);
  return current.badgeSlots.length > 0 && (current.rows === undefined ? badges.engineSlots : badges.calendarRows);
}

/** The teams of every slide that draws badges (see `drawsBadges`). */
function teamsOfSlides(
  container: AppContainer,
  registry: TemplateRegistry,
  templates: readonly ProjectTemplatePlan[],
  badges: ProjectBadges,
  slides: readonly {
    readonly versionId: string;
    readonly slideType: z.infer<typeof SlideTypeSchema>;
    readonly text: StoredElementText;
  }[],
): Record<string, SlideTeams> {
  const teams: Record<string, SlideTeams> = {};
  for (const slide of slides) {
    if (drawsBadges(registry, templates, badges, slide.slideType)) {
      teams[slide.versionId] = slideTeams(container.db, slide.text);
    }
  }
  return teams;
}

/**
 * Renders a slide with the project's visual template (PD-ARCH-01G-D): the structured model of the slide's values,
 * drawn by the same renderer and fonts. A required value the slide does not have fails the stage with `invalid` at
 * the given path; a team without a badge only leaves its layer empty.
 */
async function renderTemplateSlide(
  plan: ProjectTemplatePlan,
  slide: { readonly text: StoredElementText; readonly teams: SlideTeams },
  language: Language,
  deps: RenderDeps,
  path: string,
): Promise<SlideRender> {
  const { document, issues } = projectSlideDocument(plan, slide, language, deps.settings.canvas);
  if (issues.some((issue) => issue.severity === 'error')) {
    throw new StageFailure('invalid', { path });
  }
  const { model } = buildStructuredModel(document, { palette: deps.settings.palette, fonts: deps.fonts });
  const rendered = await renderSlide(
    model,
    { fonts: deps.fonts, assets: new Map(plan.files.map((file) => [file.id, file])) },
    deps.signal,
  );
  return {
    templateId: model.templateId,
    templateVersion: model.templateVersion,
    renderModel: model,
    png: rendered.png,
    sha256: rendered.sha256,
    width: rendered.width,
    height: rendered.height,
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
      const slides = repository.slidesToRender(draft.id);
      const badges = await loadProjectBadges(ctx.container, ctx.projectId);
      const templates = await loadProjectTemplatePlans(ctx.container, ctx.projectId, badges);
      return {
        projectId: ctx.projectId,
        draftId: draft.id,
        language: draft.language,
        demonstration: dataMode === 'DEMO_DATA',
        standingsAsOf: repository.standingsAsOf(draft.factsRunId),
        slides,
        assets: await activeSlotAssets(resolved.assets(ctx.container)),
        templates,
        badges,
        slideTeams: teamsOfSlides(ctx.container, resolved.registry, templates, badges, slides),
        teamDisplayNames: displayNamesOfSlides(
          ctx.container.db,
          slides.map((slide) => slide.text),
          loadProjectDisplayNames(ctx.container.db, ctx.projectId),
        ),
      };
    },

    async run(input: RenderingInput, ctx: StageContext): Promise<RenderingOutput> {
      const deps = renderDeps(ctx.container, resolved, input.assets, input.badges, ctx.signal);
      const renders: RenderingOutput['renders'] = [];
      for (const [index, slide] of input.slides.entries()) {
        if (ctx.signal.aborted) {
          throw new StageFailure('interrupted');
        }
        const path = `/slides/${String(index)}/text`;
        const plan = planOf(input.templates, slide.slideType);
        const teams = input.slideTeams[slide.versionId] ?? NO_TEAMS;
        const drawn = { ...slide, text: presentedText(slide.text, input.teamDisplayNames) };
        const render =
          plan !== null
            ? await renderTemplateSlide(plan, { text: drawn.text, teams }, input.language, deps, path)
            : await renderContent(slideContent(input, drawn, teams), deps, path);
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
  const badges = await loadProjectBadges(container, version.projectId);
  const deps = renderDeps(container, resolved, assets, badges, signal);
  // A project with visual templates draws the slides of each pinned type with its version (PD-ARCH-01G-D); the engine
  // match slides and calendar rows draw the snapshot badges when it covers them (PD-ARCH-01G-E.1, PD-ARCH-01G-E.2).
  const templates = await loadProjectTemplatePlans(container, version.projectId, badges);
  const plan = planOf(templates, version.slideType);
  const teams = drawsBadges(resolved.registry, templates, badges, version.slideType)
    ? slideTeams(container.db, version.text)
    : NO_TEAMS;
  // TEAM-DISPLAY-01: the team-name fields drawn with the project's presentation names; the stored text is unchanged.
  const text = presentedText(
    version.text,
    displayNamesOfSlides(container.db, [version.text], loadProjectDisplayNames(container.db, version.projectId)),
  );
  const render =
    plan !== null
      ? await renderTemplateSlide(plan, { text, teams }, version.language, deps, '/text')
      : await renderContent(
          slideContent(
            {
              language: version.language,
              demonstration: version.dataMode === 'DEMO_DATA',
              standingsAsOf: repository.standingsAsOf(version.factsRunId),
              badges,
            },
            { elementId: version.elementId, versionId, slideType: version.slideType, text },
            teams,
          ),
          deps,
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
