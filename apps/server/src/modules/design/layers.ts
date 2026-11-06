/**
 * Original brand layers of a design proposal (PD-ARCH-01G-B section 8: a protected asset "can be used later as an
 * original layer in the composition engine").
 *
 * Each reserved placement has a fixed zone, in fractions of the proposal size, that the prompt asks the model to keep
 * empty. After generation the original file is drawn into its zone by resvg, scaled uniformly to fit (never cropped,
 * stretched or regenerated), over the generated background. One zone per group: the logo, the mascot, and one other
 * brand graphic.
 */
import { renderAsync } from '@resvg/resvg-js';
import type { BrandAssetKind } from '@edr/contracts';

import { GeneratedImageError, type CheckedImage } from './image.js';

export type LayerGroup = 'logo' | 'mascot' | 'graphic';

export interface Zone {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Zones as fractions of the width and height. */
export const LAYER_ZONES: Readonly<Record<LayerGroup, Zone>> = Object.freeze({
  logo: { x: 0.36, y: 0.03, width: 0.28, height: 0.12 },
  mascot: { x: 0.68, y: 0.6, width: 0.29, height: 0.37 },
  graphic: { x: 0.03, y: 0.8, width: 0.26, height: 0.17 },
});

export function layerGroup(kind: BrandAssetKind): LayerGroup {
  return kind === 'brand_logo' ? 'logo' : kind === 'mascot' ? 'mascot' : 'graphic';
}

/** The pixel box of a zone in an image of the given size. */
export function zoneBox(group: LayerGroup, width: number, height: number): Zone {
  const zone = LAYER_ZONES[group];
  return {
    x: Math.round(zone.x * width),
    y: Math.round(zone.y * height),
    width: Math.round(zone.width * width),
    height: Math.round(zone.height * height),
  };
}

/** The zone in words for the prompt (percentages of the width and height). */
export function zoneText(group: LayerGroup): string {
  const zone = LAYER_ZONES[group];
  const pct = (value: number) => `${String(Math.round(value * 100))}%`;
  return (
    `from ${pct(zone.x)} to ${pct(zone.x + zone.width)} of the width and from ${pct(zone.y)} to ` +
    `${pct(zone.y + zone.height)} of the height`
  );
}

export interface LayerImage {
  readonly mime: 'image/png' | 'image/jpeg';
  readonly content: Buffer;
  readonly box: Zone;
}

/** Draws the original layers over the background (PNG output). */
export async function composeLayers(background: CheckedImage, layers: readonly LayerImage[]): Promise<CheckedImage> {
  if (layers.length === 0) {
    return background;
  }
  const w = String(background.width);
  const h = String(background.height);
  const images = layers
    .map(
      (layer) =>
        `<image x="${String(layer.box.x)}" y="${String(layer.box.y)}" width="${String(layer.box.width)}" ` +
        `height="${String(layer.box.height)}" preserveAspectRatio="xMidYMid meet" ` +
        `xlink:href="data:${layer.mime};base64,${layer.content.toString('base64')}"/>`,
    )
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" ` +
    `xlink:href="data:${background.mime};base64,${background.content.toString('base64')}"/>${images}</svg>`;
  let rendered;
  try {
    rendered = await renderAsync(svg, {
      fitTo: { mode: 'original' },
      font: { loadSystemFonts: false },
      logLevel: 'off',
    });
  } catch {
    throw new GeneratedImageError('the proposal layers cannot be composed');
  }
  return {
    mime: 'image/png',
    width: background.width,
    height: background.height,
    content: Buffer.from(rendered.asPng()),
  };
}
