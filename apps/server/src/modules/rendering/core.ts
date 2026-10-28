/**
 * Pure rendering core (architecture.md sections 6 and 9; contracts/provider-ports.md section 3): slide contents and
 * embedded assets in, render models and PNGs out. No database access and no file writes; the tests call it with
 * synthetic inputs in isolation (R-104, R-225).
 *
 * Each slide is drawn with the current template of its slide type (R-211); the render model records the template ID
 * and version, the palette, the fonts and every element, then the renderer produces the PNG at the configured size
 * (OD-04, R-238).
 */
import type { BrandAssetLookup } from '../brand/index.js';
import type { AppConfig } from '../../platform/config/index.js';
import { StageFailure } from '../../workflow/index.js';

import type { FontSet } from './fonts.js';
import { type ImageSlot, type Palette, type RenderModel } from './render-model.js';
import { type EmbeddedAsset, renderSlide } from './renderer.js';
import { type SlideContent, SlideContentError } from './slide-content.js';
import type { AssetRef, TemplateContext } from './templates/common.js';
import type { TemplateRegistry } from './templates/registry.js';

/** An active brand asset with its verified bytes, for an image slot. */
export interface SlotAsset extends EmbeddedAsset {
  readonly slot: ImageSlot;
}

/** The image slots templates may fill. */
export const IMAGE_SLOTS: readonly ImageSlot[] = Object.freeze(['brand_logo', 'mascot'] as const);

/**
 * The asset of each image slot: the most recently registered active asset of its kind, with its hash-checked bytes
 * (T33 `readFile`). A slot without an active asset stays empty; no substitute exists (OD-07, R-034).
 */
export async function activeSlotAssets(lookup: BrandAssetLookup): Promise<SlotAsset[]> {
  const assets: SlotAsset[] = [];
  for (const slot of IMAGE_SLOTS) {
    const asset = lookup.activeAssets(slot).at(-1);
    if (asset !== undefined) {
      const file = await lookup.readFile(asset.id);
      assets.push({ slot, id: asset.id, sha256: asset.sha256, mime: asset.mime, content: file.content });
    }
  }
  return assets;
}

/** Settings of the render taken from the configuration. */
export interface RenderSettings {
  readonly canvas: { readonly width: number; readonly height: number };
  readonly palette: Palette;
  readonly utcOffsetMinutes: number;
}

/** The render settings of a configuration (format and provisional brand palette, OD-04, OD-07). */
export function renderSettings(config: AppConfig): RenderSettings {
  return {
    canvas: { width: config.format.width, height: config.format.height },
    palette: { ...config.brand.palette },
    utcOffsetMinutes: config.display.utcOffsetMinutes,
  };
}

/** The template context of a render. */
export function templateContext(
  settings: RenderSettings,
  fonts: FontSet,
  assets: readonly SlotAsset[],
): TemplateContext {
  const slots: Partial<Record<ImageSlot, AssetRef>> = {};
  for (const asset of assets) {
    slots[asset.slot] = { id: asset.id, sha256: asset.sha256, mime: asset.mime };
  }
  return {
    canvas: settings.canvas,
    palette: settings.palette,
    fonts,
    assets: slots,
    utcOffsetMinutes: settings.utcOffsetMinutes,
  };
}

export interface RenderDeps {
  readonly registry: TemplateRegistry;
  readonly fonts: FontSet;
  readonly settings: RenderSettings;
  readonly assets: readonly SlotAsset[];
  readonly signal?: AbortSignal;
}

/** A rendered slide: its render model and PNG. */
export interface SlideRender {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly renderModel: RenderModel;
  readonly png: Buffer;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
}

/** Builds the render model of one slide with the current template of its type. */
export function buildRenderModel(content: SlideContent, deps: Omit<RenderDeps, 'signal'>): RenderModel {
  const template = deps.registry.current(content.slideType);
  return template.build(content, templateContext(deps.settings, deps.fonts, deps.assets));
}

/** Renders one slide; stored text that cannot be drawn fails with `invalid` at the given path. */
export async function renderContent(content: SlideContent, deps: RenderDeps, path: string): Promise<SlideRender> {
  let model: RenderModel;
  try {
    model = buildRenderModel(content, deps);
  } catch (error) {
    if (error instanceof SlideContentError) {
      throw new StageFailure('invalid', { path });
    }
    throw error;
  }
  const assets = new Map(deps.assets.map((asset) => [asset.id, asset]));
  const rendered = await renderSlide(model, { fonts: deps.fonts, assets }, deps.signal);
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
