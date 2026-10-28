/**
 * Byte handling of the file channels (T11H-F01, NV-11): standard padded base64 of the exact bytes, read with
 * `arrayBuffer()`.
 */
import { describe, expect, it } from 'vitest';

import { base64Length, encodeBase64, readFileBytes, utf8ByteLength } from './encoding';
import { bytesFile, decodeBase64, referenceBase64 } from './testSupport';

describe('encodeBase64', () => {
  it('matches the standard padded encoding for every remainder length', () => {
    for (let length = 0; length <= 10; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, index) => (index * 97 + 13) % 256);
      expect(encodeBase64(bytes)).toBe(referenceBase64(bytes));
      expect(encodeBase64(bytes).length).toBe(base64Length(length));
    }
  });

  it('encodes every byte value and round-trips', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const encoded = encodeBase64(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    expect(decodeBase64(encoded)).toEqual([...bytes]);
  });

  it('keeps 512 KiB within the contract maximum of 699 052 characters', () => {
    expect(base64Length(524288)).toBe(699052);
    // 524 289 bytes still fit in 699 052 characters: the byte count, checked first, is what enforces the limit.
    expect(base64Length(524289)).toBe(699052);
    expect(base64Length(524290)).toBeGreaterThan(699052);
  });
});

describe('readFileBytes', () => {
  it('returns the exact bytes, including a BOM, CRLF and an invalid UTF-8 byte', async () => {
    const bytes = [0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0xff, 0x62];
    expect([...(await readFileBytes(bytesFile('x.csv', bytes)))]).toEqual(bytes);
  });
});

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
  });
});
