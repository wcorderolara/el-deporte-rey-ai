import { describe, expect, it } from 'vitest';

import { createZip } from './zip.js';

describe('export ZIP archive', () => {
  it('writes readable store entries, CRCs, publication order and a valid central directory', () => {
    const entries = [
      { name: '01.png', bytes: Buffer.from([1, 2, 3]) },
      { name: 'caption.txt', bytes: Buffer.from('hello') },
      { name: 'manifest.json', bytes: Buffer.from('{}') },
    ];
    const zip = createZip(entries);
    let offset = 0;
    for (const entry of entries) {
      expect(zip.readUInt32LE(offset)).toBe(0x04034b50);
      const crc = zip.readUInt32LE(offset + 14);
      const size = zip.readUInt32LE(offset + 18);
      const nameLength = zip.readUInt16LE(offset + 26);
      const extraLength = zip.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      expect(zip.toString('utf8', nameStart, nameStart + nameLength)).toBe(entry.name);
      const dataStart = nameStart + nameLength + extraLength;
      const bytes = zip.subarray(dataStart, dataStart + size);
      expect(bytes).toEqual(Buffer.from(entry.bytes));
      if (entry.name === 'caption.txt') expect(crc).toBe(0x3610a686);
      offset = dataStart + size;
    }
    expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });

  it('rejects filenames outside the fixed export artifact set', () => {
    expect(() => createZip([{ name: '../secret', bytes: Buffer.from('x') }])).toThrow(TypeError);
  });
});
