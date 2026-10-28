/**
 * Content transfer and encoding of file imports (contracts/provider-ports.md section 1.6 "Content transfer and
 * encoding"; T11H-F01, AD-35), in this order and before any parsing:
 *
 * 1. `contentBase64` is decoded strictly: standard alphabet, length a multiple of 4, padding only at the end, and
 *    re-encoding the decoded bytes must reproduce the input exactly (non-canonical, URL-safe or line-broken input is
 *    `encoding_invalid`).
 * 2. The decoded length must be 1 to 524 288 bytes (`too_large`).
 * 3. The bytes are decoded with `TextDecoder('utf-8', { fatal: true })`: invalid sequences, overlong forms and
 *    encoded surrogates are `encoding_invalid`; a leading byte-order mark is skipped for parsing only.
 * 4. The received bytes are kept unchanged as the original; their SHA-256 is the original's hash.
 *
 * No dependency and no native decoder: Node's `Buffer` and the WHATWG `TextDecoder` only (SC-05, PD-15).
 */
import { createHash } from 'node:crypto';

import { IMPORT_CONTENT_BASE64_MAX_LENGTH } from '@edr/contracts';

/** Largest import content in bytes (512 KiB), for every channel. */
export const MAX_CONTENT_BYTES = 524_288;

/** Standard base64 alphabet with optional end padding (the contract pattern); linear, no backtracking. */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** A refused content: the problem and a fixed message. */
export interface EncodingFailure {
  readonly ok: false;
  readonly problem: 'encoding_invalid' | 'too_large';
  readonly message: string;
}

/** Decoded file content: the exact received bytes and the text for parsing (without a leading BOM). */
export interface DecodedContent {
  readonly ok: true;
  readonly bytes: Buffer;
  readonly text: string;
}

const TOO_LARGE: EncodingFailure = Object.freeze({
  ok: false,
  problem: 'too_large',
  message: 'The file must be 1 to 524288 bytes',
});

const NOT_BASE64: EncodingFailure = Object.freeze({
  ok: false,
  problem: 'encoding_invalid',
  message: 'The content is not canonical standard base64',
});

const NOT_UTF8: EncodingFailure = Object.freeze({
  ok: false,
  problem: 'encoding_invalid',
  message: 'The file is not valid UTF-8',
});

/** Strict base64 decoding (step 1); null when the input is not canonical standard base64. */
export function decodeBase64Strict(value: string): Buffer | null {
  if (value.length % 4 !== 0 || !BASE64.test(value)) {
    return null;
  }
  const bytes = Buffer.from(value, 'base64');
  return bytes.toString('base64') === value ? bytes : null;
}

/** Strict UTF-8 decoding (step 3): the text without a leading BOM, or null for any invalid sequence. */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    // ignoreBOM false: a leading BOM is consumed by the decoder and is not part of the text.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

/** Steps 1 to 3 for a file channel. */
export function decodeFileContent(contentBase64: string): DecodedContent | EncodingFailure {
  if (contentBase64.length > IMPORT_CONTENT_BASE64_MAX_LENGTH) {
    return TOO_LARGE;
  }
  const bytes = decodeBase64Strict(contentBase64);
  if (bytes === null) {
    return NOT_BASE64;
  }
  if (bytes.length < 1 || bytes.length > MAX_CONTENT_BYTES) {
    return TOO_LARGE;
  }
  const text = decodeUtf8Strict(bytes);
  if (text === null) {
    return NOT_UTF8;
  }
  return { ok: true, bytes, text };
}

/** Lowercase hexadecimal SHA-256 of the bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
