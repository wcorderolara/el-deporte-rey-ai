/**
 * Reader of the carousel ZIP the browser downloads (UI-06.1): the entries in archive order with their bytes, read from
 * the central directory. The export writes stored entries only (`apps/server/src/modules/export/zip.ts`); any other
 * method, a bad signature or a CRC mismatch throws, so a test never reads a damaged archive as valid.
 */
import { crc32 } from 'node:zlib';

export interface ZipFile {
  readonly name: string;
  readonly bytes: Buffer;
}

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** The entries of `archive`, in central-directory order. */
export function readZip(archive: Buffer): ZipFile[] {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || archive.readUInt32LE(end) !== END_SIGNATURE) throw new Error('not a ZIP archive');
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  const files: ZipFile[] = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) throw new Error('bad central directory entry');
    const method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16);
    const size = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const offset = archive.readUInt32LE(cursor + 42);
    const name = archive.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    if (method !== 0) throw new Error(`entry ${name} is not stored`);
    if (archive.readUInt32LE(offset) !== LOCAL_SIGNATURE) throw new Error(`bad local header for ${name}`);
    const start = offset + 30 + archive.readUInt16LE(offset + 26) + archive.readUInt16LE(offset + 28);
    const bytes = archive.subarray(start, start + size);
    if (crc32(bytes) !== crc) throw new Error(`CRC mismatch for ${name}`);
    files.push({ name, bytes: Buffer.from(bytes) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
