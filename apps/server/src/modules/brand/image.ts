/**
 * Brand image inspection before any decode (architecture-delta.md TB-4; T10-F12; PD-10, PD-15).
 *
 * Pure TypeScript, no image library: the file signature decides the type (PNG, JPEG or WebP; SVG, GIF, text and every
 * other content are refused), and the dimensions come from the header only: PNG `IHDR` (length, type, fields and
 * CRC checked), the first JPEG SOF marker, found by a bounded marker scan, and the first WebP chunk (`VP8 `, `VP8L` or
 * `VP8X`). A WebP file is also checked as a RIFF container: the declared size equals the file size and every chunk
 * fits in it (PD-ARCH-01G-A; WebP is accepted for style references only, which the renderer never draws). Nothing here allocates memory in
 * proportion to the declared dimensions, so an oversize header is refused before the decode check runs.
 */
import { crc32 } from 'node:zlib';

import type { BrandAssetMime } from '@edr/contracts';

/** Largest accepted width and height in pixels (PD-15, T10-F12). */
export const MAX_IMAGE_DIMENSION = 4096;

/** Largest number of JPEG markers scanned before the frame header must have been found. */
export const MAX_JPEG_MARKERS = 512;

/** The dimensions and type of an inspected image. */
export interface ImageHeader {
  readonly mime: BrandAssetMime;
  readonly width: number;
  readonly height: number;
}

/** Why a header was refused. */
export type HeaderRefusal = 'header_invalid' | 'dimensions_too_large';

export type HeaderResult =
  { readonly ok: true; readonly header: ImageHeader } | { readonly ok: false; readonly reason: HeaderRefusal };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP = [0x57, 0x45, 0x42, 0x50] as const;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

/** The image type given by the file signature, or null when the content is neither PNG nor JPEG. */
export function detectImageType(bytes: Uint8Array): BrandAssetMime | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, RIFF) && bytes.length >= 12 && WEBP.every((value, index) => bytes[8 + index] === value)) {
    return 'image/webp';
  }
  return null;
}

function u16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) >>> 0) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function dimensions(mime: BrandAssetMime, width: number, height: number): HeaderResult {
  if (width < 1 || height < 1) {
    return { ok: false, reason: 'header_invalid' };
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: 'dimensions_too_large' };
  }
  return { ok: true, header: { mime, width, height } };
}

/** Allowed PNG bit depths per colour type (PNG specification, IHDR). */
const PNG_BIT_DEPTHS: ReadonlyMap<number, readonly number[]> = new Map([
  [0, [1, 2, 4, 8, 16]],
  [2, [8, 16]],
  [3, [1, 2, 4, 8]],
  [4, [8, 16]],
  [6, [8, 16]],
]);

const PNG_IHDR_LENGTH = 13;
/** Signature (8) + chunk length (4) + type (4) + IHDR data (13) + CRC (4). */
const PNG_MIN_LENGTH = 8 + 4 + 4 + PNG_IHDR_LENGTH + 4;

function readPngHeader(bytes: Uint8Array): HeaderResult {
  if (!startsWith(bytes, PNG_SIGNATURE) || bytes.length < PNG_MIN_LENGTH) {
    return { ok: false, reason: 'header_invalid' };
  }
  const isIhdr = bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
  if (u32(bytes, 8) !== PNG_IHDR_LENGTH || !isIhdr) {
    return { ok: false, reason: 'header_invalid' };
  }
  const crcStored = u32(bytes, 29);
  if (crc32(bytes.subarray(12, 29)) >>> 0 !== crcStored) {
    return { ok: false, reason: 'header_invalid' };
  }
  const width = u32(bytes, 16);
  const height = u32(bytes, 20);
  const bitDepth = bytes[24] ?? -1;
  const colourType = bytes[25] ?? -1;
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28] ?? -1;
  const depths = PNG_BIT_DEPTHS.get(colourType);
  if (depths === undefined || !depths.includes(bitDepth) || compression !== 0 || filter !== 0 || interlace > 1) {
    return { ok: false, reason: 'header_invalid' };
  }
  // The specification limits each dimension to 2^31 - 1.
  if (width > 0x7fffffff || height > 0x7fffffff) {
    return { ok: false, reason: 'header_invalid' };
  }
  return dimensions('image/png', width, height);
}

/** Start-of-frame markers (SOF0 to SOF15 without DHT 0xC4, JPG 0xC8 and DAC 0xCC). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** Markers without a length field: TEM and RST0 to RST7. */
function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

const JPEG_SOI = 0xd8;
const JPEG_EOI = 0xd9;
const JPEG_SOS = 0xda;

function readJpegHeader(bytes: Uint8Array): HeaderResult {
  const invalid: HeaderResult = { ok: false, reason: 'header_invalid' };
  if (bytes[0] !== 0xff || bytes[1] !== JPEG_SOI) {
    return invalid;
  }
  let position = 2;
  for (let markers = 0; markers < MAX_JPEG_MARKERS; markers += 1) {
    if (bytes[position] !== 0xff) {
      return invalid;
    }
    // Fill bytes (0xFF) may precede a marker.
    while (bytes[position] === 0xff) {
      position += 1;
    }
    const marker = bytes[position];
    position += 1;
    if (marker === undefined || marker === 0x00 || marker === JPEG_SOI) {
      return invalid;
    }
    if (isStandalone(marker)) {
      continue;
    }
    // A scan or the end of the image before any frame header: no dimensions.
    if (marker === JPEG_SOS || marker === JPEG_EOI) {
      return invalid;
    }
    if (position + 2 > bytes.length) {
      return invalid;
    }
    const length = u16(bytes, position);
    if (length < 2 || position + length > bytes.length) {
      return invalid;
    }
    if (isStartOfFrame(marker)) {
      // Length (2), precision (1), height (2), width (2), component count (1), 3 bytes per component.
      const components = bytes[position + 7] ?? 0;
      if (length < 8 || components < 1 || length !== 8 + 3 * components) {
        return invalid;
      }
      // A height of 0 defers the height to a DNL marker after the first scan: refused.
      return dimensions('image/jpeg', u16(bytes, position + 5), u16(bytes, position + 3));
    }
    position += length;
  }
  return invalid;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) +
    ((bytes[offset + 1] ?? 0) << 8) +
    ((bytes[offset + 2] ?? 0) << 16) +
    (((bytes[offset + 3] ?? 0) << 24) >>> 0)
  );
}

function u24le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) + ((bytes[offset + 1] ?? 0) << 8) + ((bytes[offset + 2] ?? 0) << 16);
}

function fourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 4)));
}

/** Largest number of RIFF chunks walked when checking a WebP container. */
export const MAX_WEBP_CHUNKS = 64;

/** The RIFF container of a WebP file: the declared size equals the file and every chunk (padded to even) fits. */
function webpContainerValid(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || u32le(bytes, 4) + 8 !== bytes.length) {
    return false;
  }
  let position = 12;
  for (let chunks = 0; chunks < MAX_WEBP_CHUNKS && position < bytes.length; chunks += 1) {
    if (position + 8 > bytes.length) {
      return false;
    }
    const size = u32le(bytes, position + 4);
    const next = position + 8 + size + (size % 2);
    if (next > bytes.length) {
      return false;
    }
    position = next;
  }
  return position === bytes.length;
}

function readWebpHeader(bytes: Uint8Array): HeaderResult {
  const invalid: HeaderResult = { ok: false, reason: 'header_invalid' };
  if (detectImageType(bytes) !== 'image/webp' || !webpContainerValid(bytes)) {
    return invalid;
  }
  const chunk = fourCc(bytes, 12);
  const size = u32le(bytes, 16);
  const data = 20;
  if (chunk === 'VP8 ') {
    // Frame tag (3), start code 9d 01 2a, then 14-bit width and height.
    if (size < 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
      return invalid;
    }
    const width = (bytes[data + 6] ?? 0) + (((bytes[data + 7] ?? 0) & 0x3f) << 8);
    const height = (bytes[data + 8] ?? 0) + (((bytes[data + 9] ?? 0) & 0x3f) << 8);
    return dimensions('image/webp', width, height);
  }
  if (chunk === 'VP8L') {
    // Signature 0x2f, then 14-bit width - 1 and 14-bit height - 1 (little endian bit packing).
    if (size < 5 || bytes[data] !== 0x2f) {
      return invalid;
    }
    const b1 = bytes[data + 1] ?? 0;
    const b2 = bytes[data + 2] ?? 0;
    const b3 = bytes[data + 3] ?? 0;
    const b4 = bytes[data + 4] ?? 0;
    const width = 1 + (b1 | ((b2 & 0x3f) << 8));
    const height = 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
    return dimensions('image/webp', width, height);
  }
  if (chunk === 'VP8X') {
    // Flags (1), reserved (3), canvas width - 1 (3), canvas height - 1 (3).
    if (size < 10) {
      return invalid;
    }
    return dimensions('image/webp', 1 + u24le(bytes, data + 4), 1 + u24le(bytes, data + 7));
  }
  return invalid;
}

/** Reads the dimensions of an image of the given (detected) type from its header, without decoding it. */
export function readImageHeader(bytes: Uint8Array, mime: BrandAssetMime): HeaderResult {
  switch (mime) {
    case 'image/png':
      return readPngHeader(bytes);
    case 'image/jpeg':
      return readJpegHeader(bytes);
    case 'image/webp':
      return readWebpHeader(bytes);
  }
}
