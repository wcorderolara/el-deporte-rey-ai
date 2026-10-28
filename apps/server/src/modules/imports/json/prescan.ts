/**
 * Linear pre-scan of an imported JSON file before `JSON.parse` (contracts/provider-ports.md section 1.6; T11H-F08,
 * V-45): one pass over the decoded text, without recursion and without regular expressions, that
 *
 * - refuses nesting deeper than 16 levels outside strings (`parse_error`), stopping at the first level too deep;
 * - tracks the member names of every open object (decoded as `JSON.parse` decodes them, so `"a"` and `"a"` are
 *   the same name) and refuses a duplicate member name within one object (`parse_error`, naming the JSON pointer),
 *   because `JSON.parse` would keep the last value and the applied data would differ from the preserved original.
 *
 * Everything else about the syntax is left to `JSON.parse`: when the scan meets malformed input (an unterminated
 * string, a bad escape, mismatched brackets) it stops without a finding and the parse reports `parse_error`.
 * Member names are held in a `Set` per object (T11H-F07). Pointers contain only known document member names and
 * array indexes; any other name is shown as `*`, so a pointer never carries imported text (T11H-F12).
 */
import { DOCUMENT_MEMBER_NAMES } from '../document.js';
import { type ImportErrorList, fieldName } from '../errors.js';

/** Deepest nesting accepted in an imported JSON file. */
export const MAX_IMPORT_JSON_DEPTH = 16;

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const OPEN_OBJECT = 0x7b;
const CLOSE_OBJECT = 0x7d;
const OPEN_ARRAY = 0x5b;
const CLOSE_ARRAY = 0x5d;
const COMMA = 0x2c;

interface Frame {
  readonly isObject: boolean;
  /** Member names seen in this object. */
  readonly names: Set<string> | null;
  /** Current member name (objects). */
  name: string | null;
  /** Current element index (arrays). */
  index: number;
  /** True when the next string of this object is a member name. */
  expectName: boolean;
}

/** Outcome of the pre-scan: `ok` when nothing was found (the text may still be invalid JSON). */
export type PrescanOutcome = 'ok' | 'too_deep' | 'duplicate_member';

function segmentOf(name: string): string {
  return DOCUMENT_MEMBER_NAMES.has(name) ? name : '*';
}

/**
 * JSON pointer of a position: the segments of the open frames (all of them with `includeTop`, else all but the
 * innermost), then `last` when given.
 */
function pointerOf(frames: readonly Frame[], last: string | null, includeTop = false): string {
  let pointer = '';
  const levels = includeTop ? frames.length : frames.length - 1;
  for (let level = 0; level < levels; level += 1) {
    const frame = frames[level];
    if (frame === undefined) {
      break;
    }
    pointer += frame.isObject ? `/${segmentOf(frame.name ?? '')}` : `/${String(frame.index)}`;
  }
  if (last !== null) {
    pointer += `/${segmentOf(last)}`;
  }
  return pointer === '' ? '/' : pointer;
}

function hexValue(code: number): number {
  if (code >= 0x30 && code <= 0x39) {
    return code - 0x30;
  }
  const lower = code | 0x20;
  if (lower >= 0x61 && lower <= 0x66) {
    return lower - 0x61 + 10;
  }
  return -1;
}

const SIMPLE_ESCAPES: ReadonlyMap<number, string> = new Map([
  [0x22, '"'],
  [0x5c, '\\'],
  [0x2f, '/'],
  [0x62, '\b'],
  [0x66, '\f'],
  [0x6e, '\n'],
  [0x72, '\r'],
  [0x74, '\t'],
]);

/**
 * Reads the string starting at the opening quote `start`. Returns the index after the closing quote and, when
 * `decode` is set, the decoded value; `end` is -1 for an unterminated string or an invalid escape.
 */
function readString(text: string, start: number, decode: boolean): { end: number; value: string } {
  const parts: string[] = [];
  let segmentStart = start + 1;
  let index = start + 1;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === QUOTE) {
      if (decode) {
        parts.push(text.slice(segmentStart, index));
      }
      return { end: index + 1, value: decode ? parts.join('') : '' };
    }
    if (code === BACKSLASH) {
      const next = text.charCodeAt(index + 1);
      if (decode) {
        parts.push(text.slice(segmentStart, index));
      }
      if (next === 0x75) {
        let unit = 0;
        for (let digit = 2; digit <= 5; digit += 1) {
          const value = hexValue(text.charCodeAt(index + digit));
          if (value < 0) {
            return { end: -1, value: '' };
          }
          unit = unit * 16 + value;
        }
        if (decode) {
          parts.push(String.fromCharCode(unit));
        }
        index += 6;
      } else {
        const simple = SIMPLE_ESCAPES.get(next);
        if (simple === undefined) {
          return { end: -1, value: '' };
        }
        if (decode) {
          parts.push(simple);
        }
        index += 2;
      }
      segmentStart = index;
      continue;
    }
    index += 1;
  }
  return { end: -1, value: '' };
}

/**
 * Pre-scans `text`. Findings are added to `errors` (record: the JSON pointer; field: the member name for a
 * duplicate). Returns `too_deep` at the first level beyond `maxDepth`, `duplicate_member` when at least one duplicate
 * member name was found, else `ok`.
 */
export function prescanJson(text: string, errors: ImportErrorList, maxDepth = MAX_IMPORT_JSON_DEPTH): PrescanOutcome {
  const frames: Frame[] = [];
  let duplicates = false;
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    const top = frames[frames.length - 1];
    if (code === QUOTE) {
      const isName = top !== undefined && top.isObject && top.expectName;
      const { end, value } = readString(text, index, isName);
      if (end < 0) {
        return duplicates ? 'duplicate_member' : 'ok';
      }
      if (isName && top.names !== null) {
        if (top.names.has(value)) {
          duplicates = true;
          errors.add(
            pointerOf(frames, value),
            fieldName(value),
            'parse_error',
            'A member name appears twice in one object',
          );
        } else {
          top.names.add(value);
        }
        top.name = value;
        top.expectName = false;
      }
      index = end;
      continue;
    }
    if (code === OPEN_OBJECT || code === OPEN_ARRAY) {
      if (frames.length + 1 > maxDepth) {
        errors.add(
          pointerOf(frames, null, true),
          null,
          'parse_error',
          `The JSON nesting is deeper than ${String(maxDepth)} levels`,
        );
        return 'too_deep';
      }
      const isObject = code === OPEN_OBJECT;
      frames.push({ isObject, names: isObject ? new Set() : null, name: null, index: 0, expectName: isObject });
    } else if (code === CLOSE_OBJECT || code === CLOSE_ARRAY) {
      if (top === undefined || top.isObject !== (code === CLOSE_OBJECT)) {
        return duplicates ? 'duplicate_member' : 'ok';
      }
      frames.pop();
    } else if (code === COMMA && top !== undefined) {
      if (top.isObject) {
        top.expectName = true;
      } else {
        top.index += 1;
      }
    }
    index += 1;
  }
  return duplicates ? 'duplicate_member' : 'ok';
}
