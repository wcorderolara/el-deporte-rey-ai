/**
 * Test-only synthetic image generators for the brand tests: minimal PNG and baseline JPEG encoders written here (no
 * image dependency), plus non-image content (SVG, GIF header, text). Every image is generated; nothing is read from
 * disk. Not used by production code.
 */
import { crc32, deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);
  return Buffer.concat([length, typed, crc]);
}

/** The 13 IHDR data bytes. */
export function ihdr(width: number, height: number, bitDepth = 8, colourType = 6, interlace = 0): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = bitDepth;
  data[9] = colourType;
  data[12] = interlace;
  return data;
}

export interface PngOptions {
  readonly width?: number;
  readonly height?: number;
  /** One RGBA pixel repeated over the image. Default opaque purple. */
  readonly rgba?: readonly [number, number, number, number];
  /** Text stored in a tEXt chunk, to make otherwise equal images differ. */
  readonly note?: string;
  /** Damages the compressed pixel data (header stays valid). */
  readonly corruptData?: boolean;
  /** Fills the pixels with deterministic pseudo-random opaque colours (incompressible), instead of `rgba`. */
  readonly noise?: boolean;
}

/** An 8-bit RGBA PNG of one colour. */
export function png(options: PngOptions = {}): Buffer {
  const width = options.width ?? 8;
  const height = options.height ?? 8;
  const rgba = options.rgba ?? [91, 42, 134, 255];
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  let seed = 0x2545f491;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (options.noise === true) {
        // xorshift32: incompressible RGB, opaque alpha.
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        seed >>>= 0;
        raw.writeUInt32BE(((seed & 0xffffff00) | 0xff) >>> 0, y * stride + 1 + x * 4);
      } else {
        raw.set(rgba, y * stride + 1 + x * 4);
      }
    }
  }
  let data = deflateSync(raw);
  if (options.corruptData === true) {
    data = Buffer.from(data.map((byte, index) => (index > 2 ? byte ^ 0x5a : byte)));
  }
  const chunks = [pngChunk('IHDR', ihdr(width, height))];
  if (options.note !== undefined) {
    chunks.push(pngChunk('tEXt', Buffer.from(`Comment\0${options.note}`, 'latin1')));
  }
  chunks.push(pngChunk('IDAT', data), pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

/** A PNG whose header declares the given dimensions and fields, with a tiny pixel payload (never decodable). */
export function pngHeaderOnly(header: Buffer, options: { readonly crc?: 'valid' | 'broken' } = {}): Buffer {
  const chunk = pngChunk('IHDR', header);
  if (options.crc === 'broken') {
    chunk[chunk.length - 1] = (chunk[chunk.length - 1] ?? 0) ^ 0xff;
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk,
    pngChunk('IDAT', deflateSync(Buffer.alloc(4))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

class BitWriter {
  readonly #bytes: number[] = [];
  #current = 0;
  #count = 0;

  put(bits: number, length: number): void {
    for (let index = length - 1; index >= 0; index -= 1) {
      this.#current = (this.#current << 1) | ((bits >> index) & 1);
      this.#count += 1;
      if (this.#count === 8) {
        this.#bytes.push(this.#current);
        if (this.#current === 0xff) {
          this.#bytes.push(0x00);
        }
        this.#current = 0;
        this.#count = 0;
      }
    }
  }

  finish(): Buffer {
    if (this.#count > 0) {
      this.put((1 << (8 - this.#count)) - 1, 8 - this.#count);
    }
    return Buffer.from(this.#bytes);
  }
}

function segment(marker: number, data: Uint8Array): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(data.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, data]);
}

export interface JpegOptions {
  readonly width?: number;
  readonly height?: number;
  /** 1 (greyscale), 3 (YCbCr) or 4 (CMYK, which the renderer's decoder does not support). */
  readonly components?: 1 | 3 | 4;
  /** Start-of-frame marker; default 0xC0 (baseline). 0xC9 is arithmetic coding (unsupported). */
  readonly sof?: number;
  /** Text in a COM segment, to make otherwise equal images differ. */
  readonly note?: string;
  /** Number of APP1 segments of 16 bytes before the frame header. */
  readonly appSegments?: number;
  /** Cuts the entropy-coded data and the end marker. */
  readonly truncated?: boolean;
  /** Writes `height` 0 (dimensions deferred to a DNL marker). */
  readonly zeroHeight?: boolean;
}

/**
 * A baseline JPEG of uniform mid-grey: every block has a zero DC difference and no AC coefficient, coded with
 * one-symbol Huffman tables.
 */
export function jpeg(options: JpegOptions = {}): Buffer {
  const width = options.width ?? 16;
  const height = options.height ?? 16;
  const components = options.components ?? 3;
  const frameHeight = options.zeroHeight === true ? 0 : height;
  const frame = [8, frameHeight >> 8, frameHeight & 0xff, width >> 8, width & 0xff, components];
  const scan: number[] = [components];
  for (let id = 1; id <= components; id += 1) {
    frame.push(id, 0x11, 0);
    scan.push(id, 0x00);
  }
  scan.push(0, 63, 0);
  const counts = Buffer.alloc(16);
  counts[0] = 1;
  const huffman = Buffer.concat([Buffer.from([0x00]), counts, Buffer.from([0x00, 0x10]), counts, Buffer.from([0x00])]);
  const bits = new BitWriter();
  const blocks = Math.ceil(width / 8) * Math.ceil(height / 8) * components;
  for (let block = 0; block < blocks; block += 1) {
    bits.put(0, 1);
    bits.put(0, 1);
  }
  const entropy = bits.finish();
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  for (let index = 0; index < (options.appSegments ?? 0); index += 1) {
    parts.push(segment(0xe1, Buffer.alloc(16, index)));
  }
  if (options.note !== undefined) {
    parts.push(segment(0xfe, Buffer.from(options.note, 'latin1')));
  }
  parts.push(
    segment(0xdb, Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 1)])),
    segment(options.sof ?? 0xc0, Buffer.from(frame)),
    segment(0xc4, huffman),
    segment(0xda, Buffer.from(scan)),
  );
  if (options.truncated === true) {
    parts.push(entropy.subarray(0, 1));
  } else {
    parts.push(entropy, Buffer.from([0xff, 0xd9]));
  }
  return Buffer.concat(parts);
}

/** An SVG document with a script (refused by signature). */
export function svg(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script>' +
      '<rect width="10" height="10"/></svg>',
    'utf8',
  );
}

/** The header of a GIF image (refused by signature). */
export function gif(): Buffer {
  return Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.from([1, 0, 1, 0, 0, 0, 0, 0x3b])]);
}

/** A plain text file, as a renamed `.png` would carry. */
export function text(): Buffer {
  return Buffer.from('team,score\nalfa,2\nbeta,1\n', 'utf8');
}
