/**
 * CSV parser of MANUAL_DATA imports (contracts/provider-ports.md section 1.6; AD-29; SC-05 option A, PD-15; V-44).
 *
 * A single-pass state machine over the decoded text (invalid UTF-8 is already refused and a leading BOM is not part
 * of the text), RFC 4180 subset:
 * - comma separator only; CRLF or LF line ends (a CR without LF is an error);
 * - double-quoted fields with `""` escapes; a quote inside an unquoted field, text after a closing quote, an
 *   unterminated quoted field and a line break inside a quoted field are errors;
 * - at most 5 000 data rows after the header (`too_many_rows`, parsing stops), at most 200 characters (code points)
 *   per field (flagged per field, reported by the caller); at most 64 fields are kept per row and the rest counted.
 *
 * Every character is visited once; no regular expression is used and no input is re-scanned: after a syntax error
 * the parser skips to the next line feed and continues, so every row's syntax error is reported together (up to the
 * error cap, where parsing stops). Errors name the row (line) number and never repeat input text (T11H-F12).
 */
import type { ImportErrorList } from '../errors.js';

/** Most data rows after the header. */
export const MAX_DATA_ROWS = 5000;
/** Most characters (code points) in one field. */
export const MAX_FIELD_CHARACTERS = 200;
/** Most fields kept per row (the layouts have 14 and 19 columns); further fields are only counted. */
export const MAX_KEPT_FIELDS = 64;

const QUOTE = 0x22;
const COMMA = 0x2c;
const LF = 0x0a;
const CR = 0x0d;

/** One parsed row. */
export interface CsvRow {
  /** Line number in the file (the header is line 1); fields never contain a line break, so rows are lines. */
  readonly line: number;
  /** The fields (at most `MAX_KEPT_FIELDS`); a field longer than the limit is kept as an empty string. */
  readonly fields: readonly string[];
  /** Number of fields in the row, including those beyond `MAX_KEPT_FIELDS`. */
  readonly fieldCount: number;
  /** Indexes of the fields longer than `MAX_FIELD_CHARACTERS`. */
  readonly longFields: ReadonlySet<number>;
}

export interface CsvParseResult {
  /** Rows without a syntax error, in file order. */
  readonly rows: readonly CsvRow[];
  /** Line numbers of rows refused for a syntax error. */
  readonly brokenLines: ReadonlySet<number>;
  /** True when the file has more than `MAX_DATA_ROWS` data rows (parsing stopped). */
  readonly tooManyRows: boolean;
  /** True when parsing stopped at the error cap. */
  readonly stoppedAtErrorCap: boolean;
}

const SYNTAX_MESSAGES = {
  unterminated: 'A quoted field is not terminated',
  lineBreakInField: 'A line break inside a field is not allowed',
  quoteInUnquoted: 'A quote inside an unquoted field is not allowed',
  afterQuoted: 'A quoted field must be followed by a comma or a line end',
  bareCarriageReturn: 'A carriage return must be followed by a line feed',
} as const;

type SyntaxError = keyof typeof SYNTAX_MESSAGES;

function isLowSurrogate(code: number): boolean {
  return (code & 0xfc00) === 0xdc00;
}

/** Parses the decoded text of a CSV file. Syntax errors and the row limit are added to `errors`. */
export function parseCsv(text: string, errors: ImportErrorList): CsvParseResult {
  const length = text.length;
  const rows: CsvRow[] = [];
  const brokenLines = new Set<number>();
  let index = 0;
  let line = 0;

  /** Skips past the next line feed (or to the end) after a syntax error. */
  const resync = (): void => {
    while (index < length && text.charCodeAt(index) !== LF) {
      index += 1;
    }
    if (index < length) {
      index += 1;
    }
  };

  const fail = (kind: SyntaxError): void => {
    brokenLines.add(line);
    errors.add(String(line), null, 'parse_error', SYNTAX_MESSAGES[kind]);
    resync();
  };

  rowLoop: while (index < length) {
    line += 1;
    if (line - 1 > MAX_DATA_ROWS) {
      errors.add('file', null, 'too_many_rows', `The file has more than ${String(MAX_DATA_ROWS)} data rows`);
      return { rows, brokenLines, tooManyRows: true, stoppedAtErrorCap: false };
    }
    if (errors.full) {
      return { rows, brokenLines, tooManyRows: false, stoppedAtErrorCap: true };
    }
    const fields: string[] = [];
    const longFields = new Set<number>();
    let fieldCount = 0;

    for (;;) {
      // One field, starting at `index`.
      let value: string;
      let characters = 0;
      if (index < length && text.charCodeAt(index) === QUOTE) {
        index += 1;
        const parts: string[] = [];
        let segmentStart = index;
        let closed = false;
        while (index < length) {
          const code = text.charCodeAt(index);
          if (code === QUOTE) {
            if (index + 1 < length && text.charCodeAt(index + 1) === QUOTE) {
              if (characters <= MAX_FIELD_CHARACTERS) {
                parts.push(text.slice(segmentStart, index + 1));
              }
              characters += 1;
              index += 2;
              segmentStart = index;
              continue;
            }
            if (characters <= MAX_FIELD_CHARACTERS) {
              parts.push(text.slice(segmentStart, index));
            }
            index += 1;
            closed = true;
            break;
          }
          if (code === LF || code === CR) {
            fail('lineBreakInField');
            continue rowLoop;
          }
          if (!isLowSurrogate(code)) {
            characters += 1;
          }
          index += 1;
        }
        if (!closed) {
          fail('unterminated');
          continue rowLoop;
        }
        value = characters > MAX_FIELD_CHARACTERS ? '' : parts.join('');
      } else {
        const start = index;
        while (index < length) {
          const code = text.charCodeAt(index);
          if (code === COMMA || code === LF || code === CR) {
            break;
          }
          if (code === QUOTE) {
            fail('quoteInUnquoted');
            continue rowLoop;
          }
          if (!isLowSurrogate(code)) {
            characters += 1;
          }
          index += 1;
        }
        value = characters > MAX_FIELD_CHARACTERS ? '' : text.slice(start, index);
      }

      if (fieldCount < MAX_KEPT_FIELDS) {
        fields.push(value);
        if (characters > MAX_FIELD_CHARACTERS) {
          longFields.add(fieldCount);
        }
      }
      fieldCount += 1;

      // Delimiter after the field.
      if (index >= length) {
        break;
      }
      const code = text.charCodeAt(index);
      if (code === COMMA) {
        index += 1;
        continue;
      }
      if (code === LF) {
        index += 1;
        break;
      }
      if (code === CR) {
        if (index + 1 < length && text.charCodeAt(index + 1) === LF) {
          index += 2;
          break;
        }
        fail('bareCarriageReturn');
        continue rowLoop;
      }
      fail('afterQuoted');
      continue rowLoop;
    }

    rows.push({ line, fields, fieldCount, longFields });
  }
  return { rows, brokenLines, tooManyRows: false, stoppedAtErrorCap: false };
}
