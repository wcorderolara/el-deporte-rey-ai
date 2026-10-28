/**
 * Content transfer and encoding of file imports (T11H-F01, AD-35; V-43): strict base64, the 1 to 524 288 byte range,
 * strict UTF-8 with the BOM skipped for parsing only, and the received bytes kept and hashed unchanged.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { MAX_CONTENT_BYTES, decodeBase64Strict, decodeFileContent, decodeUtf8Strict, sha256Hex } from './encoding.js';

const BOM = [0xef, 0xbb, 0xbf];

function b64(bytes: readonly number[] | Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('strict base64 decoding', () => {
  it('accepts canonical standard padded base64', () => {
    expect(decodeBase64Strict('QUJD')?.toString('utf8')).toBe('ABC');
    expect(decodeBase64Strict('QUI=')?.toString('utf8')).toBe('AB');
    expect(decodeBase64Strict('QQ==')?.toString('utf8')).toBe('A');
  });

  it.each([
    ['non-canonical trailing bits', 'QR=='],
    ['missing padding', 'QQ'],
    ['URL-safe alphabet', '-_-_'],
    ['line-broken input', 'QUJD\nQUJD'],
    ['CRLF-broken input', 'QUJD\r\nQUJD'],
    ['padding in the middle', 'QQ==QUJD'],
    ['spaces', 'QU JD'],
    ['three padding characters', 'Q==='],
  ])('refuses %s', (_label, input) => {
    expect(decodeBase64Strict(input)).toBeNull();
    const decoded = decodeFileContent(input);
    expect(decoded.ok).toBe(false);
    expect(decoded.ok ? null : decoded.problem).toBe('encoding_invalid');
  });
});

describe('content size', () => {
  it('refuses an empty file as too_large (1 to 524288 bytes)', () => {
    const decoded = decodeFileContent('');
    expect(decoded.ok ? null : decoded.problem).toBe('too_large');
  });

  it('accepts exactly 524288 bytes and refuses 524289', () => {
    const atCap = decodeFileContent(b64(Buffer.alloc(MAX_CONTENT_BYTES, 0x61)));
    expect(atCap.ok).toBe(true);
    const overCap = decodeFileContent(b64(Buffer.alloc(MAX_CONTENT_BYTES + 1, 0x61)));
    expect(overCap.ok ? null : overCap.problem).toBe('too_large');
  });

  it('refuses a base64 string longer than the contract maximum before decoding', () => {
    const decoded = decodeFileContent('A'.repeat(699_056));
    expect(decoded.ok ? null : decoded.problem).toBe('too_large');
  });
});

describe('strict UTF-8 decoding', () => {
  it('skips a leading BOM for parsing only and keeps the bytes unchanged', () => {
    const bytes = [...BOM, ...Buffer.from('a,b\r\n')];
    const decoded = decodeFileContent(b64(bytes));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.text).toBe('a,b\r\n');
      expect([...decoded.bytes]).toEqual(bytes);
      expect(sha256Hex(decoded.bytes)).toBe(createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
    }
  });

  it('keeps CRLF line ends in the text and the bytes', () => {
    const decoded = decodeFileContent(b64(Buffer.from('x\r\ny\r\n')));
    expect(decoded.ok && decoded.text).toBe('x\r\ny\r\n');
  });

  it.each([
    ['an invalid byte', [0x61, 0xff, 0x62]],
    ['an overlong sequence', [0x61, 0xc0, 0xaf]],
    ['an overlong three-byte form', [0xe0, 0x80, 0xaf]],
    ['an encoded lone surrogate (ED A0 80)', [0x61, 0xed, 0xa0, 0x80]],
    ['a truncated sequence', [0x61, 0xe2, 0x82]],
  ])('refuses %s as encoding_invalid', (_label, bytes) => {
    expect(decodeUtf8Strict(Uint8Array.from(bytes))).toBeNull();
    const decoded = decodeFileContent(b64(bytes));
    expect(decoded.ok ? null : decoded.problem).toBe('encoding_invalid');
  });

  it('keeps a BOM that is not at the start as text', () => {
    expect(decodeUtf8Strict(Uint8Array.from([0x61, ...BOM]))).toBe('a﻿');
  });
});
