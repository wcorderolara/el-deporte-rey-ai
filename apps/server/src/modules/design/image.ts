/**
 * Checks and local adaptation of a generated image (PD-ARCH-01G-B; the brand module's image rules).
 *
 * - The bytes the provider returned are untrusted: the type is detected from the signature (PNG or JPEG only), the
 *   header is read without decoding (dimensions at most 4096), and resvg, the server's only decoder, must render it.
 * - When the image is not at the target size (a model with standard sizes only, or a provider that returned another
 *   size), it is rendered by resvg into the target size with `xMidYMid slice`: scaled uniformly and cut at the centre,
 *   never stretched. The adapted proposal is a PNG.
 */
import { renderAsync } from '@resvg/resvg-js';

import { detectImageType, readImageHeader, resvgDecodeCheck } from '../brand/index.js';

export type ProposalMime = 'image/png' | 'image/jpeg';

export interface CheckedImage {
  readonly mime: ProposalMime;
  readonly width: number;
  readonly height: number;
  readonly content: Buffer;
}

/** A generated image could not be accepted; the message is fixed text. */
export class GeneratedImageError extends Error {
  override readonly name = 'GeneratedImageError';
}

/** Detects, measures and decodes a generated image. */
export async function checkGeneratedImage(content: Buffer): Promise<CheckedImage> {
  const mime = detectImageType(content);
  if (mime !== 'image/png' && mime !== 'image/jpeg') {
    throw new GeneratedImageError('the generated image is not a PNG or JPEG file');
  }
  const header = readImageHeader(content, mime);
  if (!header.ok) {
    throw new GeneratedImageError('the generated image header is invalid');
  }
  if (!(await resvgDecodeCheck(content, header.header))) {
    throw new GeneratedImageError('the generated image cannot be decoded');
  }
  return { mime, width: header.header.width, height: header.header.height, content };
}

/** Fits an image into the target size by a uniform scale and a centred crop (PNG output). */
export async function fitToSize(image: CheckedImage, width: number, height: number): Promise<CheckedImage> {
  if (image.width === width && image.height === height) {
    return image;
  }
  const w = String(width);
  const h = String(height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" ` +
    `xlink:href="data:${image.mime};base64,${image.content.toString('base64')}"/></svg>`;
  let rendered;
  try {
    rendered = await renderAsync(svg, {
      fitTo: { mode: 'original' },
      font: { loadSystemFonts: false },
      logLevel: 'off',
    });
  } catch {
    throw new GeneratedImageError('the generated image cannot be adapted');
  }
  if (rendered.width !== width || rendered.height !== height) {
    throw new GeneratedImageError('the generated image cannot be adapted');
  }
  return { mime: 'image/png', width, height, content: Buffer.from(rendered.asPng()) };
}
