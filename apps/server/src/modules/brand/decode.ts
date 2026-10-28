/**
 * The one decode at registration (architecture-delta.md TB-4; T10-F12; PD-10, PD-15).
 *
 * The image is decoded by resvg, the only image decoder of the server, exactly as the renderer will use it: embedded
 * as a `data:` URI in an SVG `<image>` (T10-F09). No other decoder or image dependency is used. resvg does not
 * report a decode failure: a corrupt or unsupported raster (for example a CMYK or arithmetic-coded JPEG, or broken
 * PNG data) is silently left out of the render. The check therefore renders the image alone, at its own size on a
 * transparent canvas, and accepts it only when at least one rendered pixel is not fully transparent.
 *
 * Consequence: a completely transparent image cannot be told apart from a failed decode and is refused as well. It
 * would draw nothing on a slide, so it is not a usable brand asset.
 *
 * The SVG text is built from the closed MIME type, the header dimensions (integers already capped at 4096) and
 * base64 text only. Rendering runs off the main thread (`renderAsync`), without system fonts.
 */
import { renderAsync } from '@resvg/resvg-js';

import type { ImageHeader } from './image.js';

/** Decides whether an image whose header was accepted can be decoded by the renderer. */
export type ImageDecodeCheck = (content: Buffer, header: ImageHeader) => Promise<boolean>;

function svgEmbedding(content: Buffer, header: ImageHeader): string {
  const width = String(header.width);
  const height = String(header.height);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" ` +
    `xlink:href="data:${header.mime};base64,${content.toString('base64')}"/></svg>`
  );
}

function hasVisiblePixel(rgba: Buffer): boolean {
  for (let alpha = 3; alpha < rgba.length; alpha += 4) {
    if (rgba[alpha] !== 0) {
      return true;
    }
  }
  return false;
}

/** The resvg decode check. Any error of resvg counts as a failed decode. */
export const resvgDecodeCheck: ImageDecodeCheck = async (content, header) => {
  try {
    const rendered = await renderAsync(svgEmbedding(content, header), {
      fitTo: { mode: 'original' },
      font: { loadSystemFonts: false },
      logLevel: 'off',
    });
    return rendered.width === header.width && rendered.height === header.height && hasVisiblePixel(rendered.pixels);
  } catch {
    return false;
  }
};
