/**
 * Rendering module (architecture.md sections 4, 6 and 9; AD-07; OD-13): versioned carousel templates (cover,
 * match-result, standings, closing), measured text layout with the bundled fonts, render models, deterministic Satori
 * and resvg rendering to PNG at the configured size, the rendering stage, the template registry and the template
 * routes (listTemplates, previewTemplate). The render models of structured visual templates (PD-ARCH-01G-C,
 * `structured.ts`) use the same model and renderer.
 *
 * Integration points:
 * - visual QA (T35): `RenderModelSchema` (the stored `element_versions.render_model`), `layoutText` / `fitText`,
 *   `loadBundledFaces` / `fontSetFor` to re-measure with the same fonts, `pngSize` for the dimensions check;
 * - review (T37): `renderElementVersion` (regeneration of one element), `readSlideImage` (getSlideImage) and
 *   `slideImageUrl` (the `ElementVersion.imageUrl` path, OD-42).
 */
import type { AppContainer } from '../../container.js';
import { brandAssetLookup } from '../brand/index.js';
import type { ServerModule } from '../module-kit.js';

import { type FontSet, fontSetFor, loadBundledFaces } from './fonts.js';
import { TemplatePreviewService } from './preview.js';
import { registerTemplateRoutes } from './routes.js';
import { type RenderingOptions, createRenderingStage } from './stage.js';
import { TemplateRegistry } from './templates/registry.js';

export { IMAGE_SLOTS, type RenderSettings, type SlotAsset, activeSlotAssets, renderSettings } from './core.js';
export { RENDERS_DIRECTORY, RenderFileError, RenderFileStore, renderRelativePath } from './files.js';
export {
  BUNDLED_FONT_FILES,
  type BundledFontFile,
  FONT_ROLES,
  FontError,
  type FontRole,
  type FontSet,
  type LoadedFontFace,
  bundledFontsDirectory,
  fontSetFor,
  loadBundledFaces,
} from './fonts.js';
export { LINE_HEIGHT_FACTOR, type FittedText, type TextLayout, fitText, layoutText, measureText } from './layout.js';
export { PREVIEW_CACHE_ENTRIES, TemplatePreviewService } from './preview.js';
export {
  type BadgeSlotElement,
  PALETTE_ROLES,
  type RenderElement,
  type ImageFit,
  type Palette,
  type PaletteRole,
  type RenderModel,
  RenderModelSchema,
  type TextEffect,
  type TextElement,
  type TextSemantic,
} from './render-model.js';
export { type EmbeddedAsset, RenderError, pngSize, renderSlide, textShadowOf } from './renderer.js';
export {
  type FractionBox,
  type StructuredDocument,
  type StructuredImageItem,
  type StructuredItem,
  type StructuredModel,
  type StructuredTextItem,
  type StructuredTextStyle,
  buildStructuredModel,
  displayText,
  layoutTextBox,
  pixelBox,
} from './structured.js';
export {
  type RenderedVersion,
  RenderIntegrityError,
  RenderVersionRefused,
  type RenderingInput,
  type RenderingOptions,
  type RenderingOutput,
  createRenderingStage,
  readSlideImage,
  renderElementVersion,
  renderingStage,
  slideImageUrl,
} from './stage.js';
export { type StoredElementText, StoredElementTextSchema } from './slide-content.js';
export type { AssetRef, TemplateDefinition } from './templates/common.js';
export type { SegmentRun } from './slide-content.js';
export { BUILT_IN_TEMPLATES, TemplateRegistry, toContractTemplate } from './templates/registry.js';

/** Options of the rendering module (tests pass their own registry, fonts or asset lookup). */
export type RenderingModuleOptions = RenderingOptions;

/** The rendering module: the rendering stage and the template routes. */
export function createRenderingModule(options: RenderingModuleOptions = {}): ServerModule {
  const registry = options.registry ?? new TemplateRegistry();
  const fonts =
    options.fonts ??
    ((container: AppContainer): FontSet => fontSetFor(container.config.brand.fonts, loadBundledFaces()));
  const assets = options.assets ?? brandAssetLookup;
  return {
    name: 'rendering',
    stages: [createRenderingStage({ registry, fonts, assets }) as never],
    routes: async (app, container) => {
      const previews = new TemplatePreviewService({
        registry,
        config: container.config,
        fonts: () => fonts(container),
        assets: assets(container),
      });
      registerTemplateRoutes(app, { registry, previews, config: container.config });
      await Promise.resolve();
    },
  };
}

/** The rendering module of the static registry. */
export const serverModule: ServerModule = createRenderingModule();
