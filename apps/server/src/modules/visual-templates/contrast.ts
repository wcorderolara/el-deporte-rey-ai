/**
 * Contrast of template text over its background (PD-ARCH-01G-C validation, `LOW_CONTRAST` warning).
 *
 * The background is drawn by resvg as the renderer draws it (`cover`, centred) at a quarter of the canvas size, and
 * the mean relative luminance of the pixels under a text box is compared with the luminance of the text colour
 * (WCAG 2 contrast ratio). Image layers between the background and the text are not taken into account, so the
 * result is a warning for the operator to review, never a block.
 */
import { renderAsync } from '@resvg/resvg-js';

import type { FractionBox } from '../rendering/index.js';

/** Sampling scale of the canvas. */
const SAMPLE_SCALE = 0.25;

/** Relative luminance of an sRGB channel value (0 to 255). */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a colour. */
export function luminance(red: number, green: number, blue: number): number {
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** Relative luminance of a `#rrggbb` colour. */
export function hexLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return luminance((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
}

/** WCAG 2 contrast ratio of two luminances (1 to 21). */
export function contrastRatio(a: number, b: number): number {
  const [light, dark] = a >= b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** Mean luminance of the background under a box; null when the box has no pixel. */
export type LuminanceSampler = (box: FractionBox) => number | null;

/** Draws the background over the canvas, as the renderer does, and returns its luminance sampler. */
export async function backgroundSampler(
  image: { readonly mime: 'image/png' | 'image/jpeg'; readonly content: Uint8Array },
  canvas: { readonly width: number; readonly height: number },
): Promise<LuminanceSampler> {
  const width = Math.max(1, Math.round(canvas.width * SAMPLE_SCALE));
  const height = Math.max(1, Math.round(canvas.height * SAMPLE_SCALE));
  const href = `data:${image.mime};base64,${Buffer.from(image.content).toString('base64')}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(width)}" ` +
    `height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"><image x="0" y="0" ` +
    `width="${String(width)}" height="${String(height)}" preserveAspectRatio="xMidYMid slice" xlink:href="${href}"/></svg>`;
  const rendered = await renderAsync(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false },
    logLevel: 'off',
  });
  const pixels = rendered.pixels;
  return (box) => {
    const left = Math.max(0, Math.floor(box.x * width));
    const top = Math.max(0, Math.floor(box.y * height));
    const right = Math.min(width, Math.ceil((box.x + box.width) * width));
    const bottom = Math.min(height, Math.ceil((box.y + box.height) * height));
    let total = 0;
    let count = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * width + x) * 4;
        total += luminance(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0);
        count += 1;
      }
    }
    return count === 0 ? null : total / count;
  };
}
