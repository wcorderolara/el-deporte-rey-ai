/**
 * Unit tests of the brand image inspection (T10-F12; PD-15): signature detection and header dimensions read
 * without decoding, with the 4096 x 4096 cap and a bounded JPEG marker scan. All images are synthetic.
 */
import { describe, expect, it } from 'vitest';

import { MAX_IMAGE_DIMENSION, MAX_JPEG_MARKERS, detectImageType, readImageHeader } from './image.js';
import { gif, ihdr, jpeg, png, pngHeaderOnly, svg, text } from './test/images.js';

describe('detectImageType', () => {
  it('detects PNG and JPEG by signature', () => {
    expect(detectImageType(png())).toBe('image/png');
    expect(detectImageType(jpeg())).toBe('image/jpeg');
  });

  it('refuses SVG, GIF, text, empty and truncated signatures', () => {
    expect(detectImageType(svg())).toBeNull();
    expect(detectImageType(gif())).toBeNull();
    expect(detectImageType(text())).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(png().subarray(0, 7))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('ignores the name or declared type: only the leading bytes count', () => {
    const renamed = Buffer.concat([Buffer.from('not an image '), png()]);
    expect(detectImageType(renamed)).toBeNull();
  });
});

describe('readImageHeader: PNG', () => {
  it('reads the IHDR dimensions', () => {
    expect(readImageHeader(png({ width: 30, height: 12 }), 'image/png')).toEqual({
      ok: true,
      header: { mime: 'image/png', width: 30, height: 12 },
    });
  });

  it('accepts the dimension cap exactly and refuses one pixel more, from the header only', () => {
    expect(readImageHeader(pngHeaderOnly(ihdr(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)), 'image/png')).toMatchObject({
      ok: true,
      header: { width: 4096, height: 4096 },
    });
    expect(readImageHeader(pngHeaderOnly(ihdr(4097, 1)), 'image/png')).toEqual({
      ok: false,
      reason: 'dimensions_too_large',
    });
    expect(readImageHeader(pngHeaderOnly(ihdr(1, 4097)), 'image/png')).toEqual({
      ok: false,
      reason: 'dimensions_too_large',
    });
    // A decompression-bomb shaped header (65535 x 65535) is refused before anything is decoded.
    expect(readImageHeader(pngHeaderOnly(ihdr(65535, 65535)), 'image/png')).toEqual({
      ok: false,
      reason: 'dimensions_too_large',
    });
  });

  it('refuses zero dimensions, dimensions above 2^31 - 1 and invalid IHDR fields', () => {
    const invalid = { ok: false, reason: 'header_invalid' };
    expect(readImageHeader(pngHeaderOnly(ihdr(0, 10)), 'image/png')).toEqual(invalid);
    expect(readImageHeader(pngHeaderOnly(ihdr(0x80000000, 10)), 'image/png')).toEqual(invalid);
    expect(readImageHeader(pngHeaderOnly(ihdr(10, 10, 7, 6)), 'image/png')).toEqual(invalid);
    expect(readImageHeader(pngHeaderOnly(ihdr(10, 10, 8, 5)), 'image/png')).toEqual(invalid);
    expect(readImageHeader(pngHeaderOnly(ihdr(10, 10, 8, 6, 2)), 'image/png')).toEqual(invalid);
    const compression = ihdr(10, 10);
    compression[10] = 1;
    expect(readImageHeader(pngHeaderOnly(compression), 'image/png')).toEqual(invalid);
  });

  it('refuses a broken IHDR CRC, a wrong first chunk and a truncated header', () => {
    const invalid = { ok: false, reason: 'header_invalid' };
    expect(readImageHeader(pngHeaderOnly(ihdr(10, 10), { crc: 'broken' }), 'image/png')).toEqual(invalid);
    const renamedChunk = png();
    renamedChunk.write('IDAT', 12, 'latin1');
    expect(readImageHeader(renamedChunk, 'image/png')).toEqual(invalid);
    expect(readImageHeader(png().subarray(0, 30), 'image/png')).toEqual(invalid);
  });
});

describe('readImageHeader: JPEG', () => {
  it('reads the SOF dimensions after other segments', () => {
    expect(readImageHeader(jpeg({ width: 40, height: 24, appSegments: 3, note: 'synthetic' }), 'image/jpeg')).toEqual({
      ok: true,
      header: { mime: 'image/jpeg', width: 40, height: 24 },
    });
  });

  it('reads progressive and other frame types (the decode check decides support)', () => {
    expect(readImageHeader(jpeg({ sof: 0xc2, width: 9, height: 7 }), 'image/jpeg')).toMatchObject({
      ok: true,
      header: { width: 9, height: 7 },
    });
  });

  it('refuses dimensions above the cap from the header', () => {
    expect(readImageHeader(jpeg({ width: 4097, height: 8, truncated: true }), 'image/jpeg')).toEqual({
      ok: false,
      reason: 'dimensions_too_large',
    });
    expect(readImageHeader(jpeg({ width: 65535, height: 65535, truncated: true }), 'image/jpeg')).toEqual({
      ok: false,
      reason: 'dimensions_too_large',
    });
  });

  it('refuses a deferred height (DNL), a scan before the frame and a segment past the end', () => {
    const invalid = { ok: false, reason: 'header_invalid' };
    expect(readImageHeader(jpeg({ zeroHeight: true }), 'image/jpeg')).toEqual(invalid);
    expect(readImageHeader(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]), 'image/jpeg')).toEqual(invalid);
    expect(readImageHeader(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg')).toEqual(invalid);
    expect(readImageHeader(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x40, 0x00, 0x01]), 'image/jpeg')).toEqual(invalid);
    expect(readImageHeader(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01]), 'image/jpeg')).toEqual(invalid);
    expect(readImageHeader(Buffer.from([0xff, 0xd8, 0x00, 0x00]), 'image/jpeg')).toEqual(invalid);
  });

  it('refuses a frame header whose length does not match its component count', () => {
    const image = jpeg({ components: 3 });
    const sof = image.indexOf(Buffer.from([0xff, 0xc0]));
    image[sof + 9] = 4;
    expect(readImageHeader(image, 'image/jpeg')).toEqual({ ok: false, reason: 'header_invalid' });
  });

  it('bounds the marker scan: more segments than the limit before the frame are refused', () => {
    expect(readImageHeader(jpeg({ appSegments: MAX_JPEG_MARKERS - 2 }), 'image/jpeg')).toMatchObject({ ok: true });
    expect(readImageHeader(jpeg({ appSegments: MAX_JPEG_MARKERS }), 'image/jpeg')).toEqual({
      ok: false,
      reason: 'header_invalid',
    });
  });

  it('scans a buffer of fill bytes in linear time', () => {
    const fill = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(5 * 1024 * 1024, 0xff)]);
    const started = performance.now();
    expect(readImageHeader(fill, 'image/jpeg')).toEqual({ ok: false, reason: 'header_invalid' });
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
