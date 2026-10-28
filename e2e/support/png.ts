/**
 * Synthetic PNG images for the journeys (no committed binary, no real brand asset): a solid-colour truecolour image
 * built with the standard chunk layout, and a reader of the IHDR size of a PNG response.
 */
import { crc32, deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A `width` x `height` PNG (8-bit RGB) of one colour. */
export function solidPng(width: number, height: number, rgb: readonly [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type: truecolour
  header.writeUInt8(0, 10); // compression
  header.writeUInt8(0, 11); // filter
  header.writeUInt8(0, 12); // interlace
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row.writeUInt8(rgb[0], 1 + x * 3);
    row.writeUInt8(rgb[1], 2 + x * 3);
    row.writeUInt8(rgb[2], 3 + x * 3);
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Width and height of a PNG file from its IHDR chunk; throws when the bytes are not a PNG. */
export function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(SIGNATURE) || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG file');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
