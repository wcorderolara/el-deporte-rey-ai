/**
 * Unit tests of the one decode at registration with resvg (T10-F12; PD-15): valid PNG and JPEG images decode;
 * corrupt data, CMYK and arithmetic-coded JPEGs, truncated data and fully transparent images are refused. All
 * images are synthetic.
 */
import { describe, expect, it } from 'vitest';

import { resvgDecodeCheck } from './decode.js';
import type { ImageHeader } from './image.js';
import { jpeg, png } from './test/images.js';

function header(mime: ImageHeader['mime'], width: number, height: number): ImageHeader {
  return { mime, width, height };
}

describe('resvgDecodeCheck', () => {
  it('accepts a valid PNG and a valid greyscale or colour JPEG', async () => {
    await expect(resvgDecodeCheck(png({ width: 12, height: 5 }), header('image/png', 12, 5))).resolves.toBe(true);
    await expect(resvgDecodeCheck(jpeg({ components: 1 }), header('image/jpeg', 16, 16))).resolves.toBe(true);
    await expect(
      resvgDecodeCheck(jpeg({ components: 3, width: 24, height: 8 }), header('image/jpeg', 24, 8)),
    ).resolves.toBe(true);
  });

  it('accepts a partly transparent PNG', async () => {
    await expect(resvgDecodeCheck(png({ rgba: [10, 20, 30, 1] }), header('image/png', 8, 8))).resolves.toBe(true);
  });

  it('refuses corrupt PNG data behind a valid header', async () => {
    await expect(resvgDecodeCheck(png({ corruptData: true }), header('image/png', 8, 8))).resolves.toBe(false);
  });

  it('refuses unsupported JPEGs: CMYK and arithmetic coding', async () => {
    await expect(resvgDecodeCheck(jpeg({ components: 4 }), header('image/jpeg', 16, 16))).resolves.toBe(false);
    await expect(resvgDecodeCheck(jpeg({ sof: 0xc9 }), header('image/jpeg', 16, 16))).resolves.toBe(false);
  });

  it('refuses a truncated JPEG', async () => {
    const image = jpeg({ width: 64, height: 64, truncated: true });
    await expect(resvgDecodeCheck(image, header('image/jpeg', 64, 64))).resolves.toBe(false);
  });

  it('refuses what the renderer cannot decode even with a valid header, such as a 1 MiB text chunk', async () => {
    await expect(resvgDecodeCheck(png({ note: 'x'.repeat(512 * 1024) }), header('image/png', 8, 8))).resolves.toBe(
      true,
    );
    await expect(resvgDecodeCheck(png({ note: 'x'.repeat(1024 * 1024) }), header('image/png', 8, 8))).resolves.toBe(
      false,
    );
  });

  it('accepts a large incompressible image', async () => {
    await expect(
      resvgDecodeCheck(png({ width: 1200, height: 1200, noise: true }), header('image/png', 1200, 1200)),
    ).resolves.toBe(true);
  });

  it('refuses a fully transparent image (indistinguishable from a failed decode)', async () => {
    await expect(resvgDecodeCheck(png({ rgba: [0, 0, 0, 0] }), header('image/png', 8, 8))).resolves.toBe(false);
  });

  it('refuses content of the other type than the one declared to the decoder', async () => {
    await expect(resvgDecodeCheck(png(), header('image/jpeg', 8, 8))).resolves.toBe(false);
  });
});
