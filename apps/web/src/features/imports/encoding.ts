/**
 * Byte handling of the file channels (T11H-F01, AD-35, NV-11): the file is read as bytes with `file.arrayBuffer()`
 * and encoded as standard padded base64 (RFC 4648 section 4, no line breaks). It is never decoded as text, so a
 * byte-order mark, CRLF line ends and invalid UTF-8 sequences reach the server unchanged and the server's hash of the
 * original equals the hash of the operator's file (R-277).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard padded base64 of the bytes. Linear in the input size. */
export function encodeBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const length = bytes.length;
  let index = 0;
  for (; index + 2 < length; index += 3) {
    const chunk = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    parts.push(
      ALPHABET.charAt((chunk >> 18) & 63) +
        ALPHABET.charAt((chunk >> 12) & 63) +
        ALPHABET.charAt((chunk >> 6) & 63) +
        ALPHABET.charAt(chunk & 63),
    );
  }
  const remaining = length - index;
  if (remaining === 1) {
    const chunk = (bytes[index] ?? 0) << 16;
    parts.push(`${ALPHABET.charAt((chunk >> 18) & 63)}${ALPHABET.charAt((chunk >> 12) & 63)}==`);
  } else if (remaining === 2) {
    const chunk = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8);
    parts.push(
      `${ALPHABET.charAt((chunk >> 18) & 63)}${ALPHABET.charAt((chunk >> 12) & 63)}${ALPHABET.charAt((chunk >> 6) & 63)}=`,
    );
  }
  return parts.join('');
}

/** Length of the padded base64 text of `byteLength` bytes. */
export function base64Length(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4;
}

/** The exact bytes of a file, read with `arrayBuffer()` (never `text()`). */
export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Number of bytes of the UTF-8 encoding of a string. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
