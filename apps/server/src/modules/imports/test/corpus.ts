/**
 * Adversarial corpus of the CSV parser and the JSON pre-scan, generated in test code (SC-05 option A conditions,
 * PD-15; security/design-review-change-1.md section 6.3; V-44, V-45, NV-12). Each generator fills an input of about
 * `size` characters with one worst-case shape, so the same shape can be measured at 64 KiB and at the 512 KiB cap.
 */
import { MATCHES_HEADER, matchRow } from './support.js';

export const KIB = 1024;
export const CAP = 512 * KIB;

function fill(unit: string, size: number): string {
  return unit.repeat(Math.max(1, Math.floor(size / unit.length)));
}

/** CSV shapes (decoded text) that make the parser visit the whole input. */
export const CSV_SHAPES: Readonly<Record<string, (size: number) => string>> = {
  'only double quotes': (size) => '"'.repeat(size),
  'alternating empty quoted fields ("",)': (size) => fill('"",', size),
  'quoted field of escaped quotes ("x""...")': (size) => `"${fill('x""', size - 2)}"`,
  'unterminated quoted field': (size) => `"${'a'.repeat(size - 1)}`,
  'only separators': (size) => ','.repeat(size),
  'CR-only line ends': (size) => fill('a,b\r', size),
  'one huge unquoted field': (size) => 'a'.repeat(size),
  'valid rows up to the size': (size) => {
    const row = `${matchRow('Club Alfa', 'Deportivo Beta')}\n`;
    const count = Math.min(5000, Math.floor((size - MATCHES_HEADER.length - 1) / row.length));
    return `${MATCHES_HEADER}\n${row.repeat(count)}`;
  },
  // Long rows keep the number of syntax errors below the error cap, so the whole input is scanned.
  'syntax error on every long row': (size) => fill(`${'x'.repeat(1100)}"y,1\n`, size),
};

/** JSON shapes (decoded text) for the pre-scan. */
export const JSON_SHAPES: Readonly<Record<string, (size: number) => string>> = {
  'one object with many distinct member names': (size) => {
    const parts: string[] = [];
    let length = 2;
    for (let index = 0; ; index += 1) {
      const part = `"k${String(index)}":0`;
      if (length + part.length + 1 > size) {
        break;
      }
      parts.push(part);
      length += part.length + 1;
    }
    return `{${parts.join(',')}}`;
  },
  'long member names with escapes': (size) => `{"${fill('\\u0061\\"', size - 8)}":1}`,
  'one long string of escapes': (size) => `["${fill('\\\\', size - 4)}"]`,
  'many small objects': (size) => `[${fill('{"a":1,"b":[2]},', size - 4)}{}]`,
  'nesting at the depth limit, repeated': (size) => `[${fill(`${'['.repeat(15)}${']'.repeat(15)},`, size - 4)}0]`,
  'only double quotes': (size) => '"'.repeat(size),
  'brackets inside one string': (size) => `"${fill('[{', size - 2)}"`,
};
