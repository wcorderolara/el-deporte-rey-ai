/**
 * CSV state machine (contracts/provider-ports.md section 1.6; V-44): quotes and `""` escapes, LF and CRLF line ends,
 * syntax errors with their row, line breaks inside fields, CR-only line ends, field and row limits.
 */
import { describe, expect, it } from 'vitest';

import { ImportErrorList } from '../errors.js';

import { MAX_DATA_ROWS, parseCsv } from './parser.js';

function parse(text: string) {
  const errors = new ImportErrorList('file');
  const result = parseCsv(text, errors);
  return { ...result, errors: errors.items };
}

describe('parseCsv', () => {
  it('parses LF and CRLF rows, quoted fields and escaped quotes', () => {
    const { rows, errors } = parse('a,b,c\r\n"x, y","say ""hi""",\n1,2,3');
    expect(errors).toEqual([]);
    expect(rows.map((row) => [row.line, row.fields])).toEqual([
      [1, ['a', 'b', 'c']],
      [2, ['x, y', 'say "hi"', '']],
      [3, ['1', '2', '3']],
    ]);
  });

  it('does not create a row after the final line end', () => {
    expect(parse('a,b\n1,2\n').rows).toHaveLength(2);
    expect(parse('a,b\r\n1,2\r\n').rows).toHaveLength(2);
  });

  it('turns an empty line into a one-field row (rejected later by the column count)', () => {
    const { rows } = parse('a,b\n\n1,2\n');
    expect(rows.map((row) => row.fieldCount)).toEqual([2, 1, 2]);
  });

  it('returns no row for empty text (a BOM-only file)', () => {
    expect(parse('').rows).toEqual([]);
  });

  it.each([
    ['a line break inside a quoted field', 'a,b\n"x\ny",2\n3,4\n', 2, 'A line break inside a field is not allowed'],
    ['a carriage return inside a quoted field', 'a,b\n"x\ry",2\n', 2, 'A line break inside a field is not allowed'],
    ['an unterminated quoted field', 'a,b\n"x,2\n', 2, 'A line break inside a field is not allowed'],
    ['an unterminated quoted field at the end', 'a,b\n"x,2', 2, 'A quoted field is not terminated'],
    ['a quote inside an unquoted field', 'a,b\nx"y,2\n', 2, 'A quote inside an unquoted field is not allowed'],
    ['text after a closing quote', 'a,b\n"x"y,2\n', 2, 'A quoted field must be followed by a comma or a line end'],
    ['a CR-only line end', 'a,b\r1,2\r', 1, 'A carriage return must be followed by a line feed'],
  ])('reports %s as parse_error with its row', (_label, text, line, message) => {
    const { errors, brokenLines } = parse(text);
    expect(errors[0]).toEqual({ location: 'file', record: String(line), field: null, problem: 'parse_error', message });
    expect(brokenLines.has(line)).toBe(true);
  });

  it('continues after a syntax error and reports every broken row together', () => {
    const { rows, errors } = parse('a,b\nx"y,1\n2,3\n"p"q,4\n5,6\n');
    expect(errors.map((error) => error.record)).toEqual(['2', '4']);
    expect(rows.map((row) => row.line)).toEqual([1, 3, 5]);
  });

  it('flags a field longer than 200 characters without keeping its text', () => {
    const { rows } = parse(`h1,h2\n${'x'.repeat(201)},"${'y'.repeat(200)}"\n`);
    const row = rows[1];
    expect(row?.longFields.has(0)).toBe(true);
    expect(row?.longFields.has(1)).toBe(false);
    expect(row?.fields[0]).toBe('');
    expect(row?.fields[1]).toHaveLength(200);
  });

  it('counts characters as code points', () => {
    const { rows } = parse(`h\n${'\u{1F600}'.repeat(200)}\n`);
    expect(rows[1]?.longFields.size).toBe(0);
  });

  it('accepts 5000 data rows and stops with too_many_rows at 5001', () => {
    const header = 'a,b\n';
    const ok = parse(header + '1,2\n'.repeat(MAX_DATA_ROWS));
    expect(ok.tooManyRows).toBe(false);
    expect(ok.rows).toHaveLength(MAX_DATA_ROWS + 1);
    const over = parse(header + '1,2\n'.repeat(MAX_DATA_ROWS + 1));
    expect(over.tooManyRows).toBe(true);
    expect(over.errors.map((error) => error.problem)).toEqual(['too_many_rows']);
  });

  it('keeps at most 64 fields and counts the rest', () => {
    const { rows } = parse(','.repeat(99));
    expect(rows[0]?.fieldCount).toBe(100);
    expect(rows[0]?.fields).toHaveLength(64);
  });
});
