/**
 * Adversarial corpus (SC-05 option A, PD-15; security/design-review-change-1.md section 6.3 condition 2; V-44, V-45):
 * every input of the corpus is refused with the expected error and nothing is stored. Inputs are generated here:
 * 512 KiB of `"`, alternating `""`, an unterminated quote, only separators, CR-only line ends, NUL, a BOM only,
 * overlong UTF-8, encoded lone surrogates, 5 001 rows, a 201-character field, depth 17, duplicate keys and `__proto__`
 * keys.
 */
import { afterEach, describe, expect, it } from 'vitest';

import type { ImportRequest } from './service.js';
import { CAP } from './test/corpus.js';
import {
  MATCHES_HEADER,
  type ServiceHarness,
  base64,
  matchRow,
  matchesCsv,
  sampleDocument,
  serviceHarness,
} from './test/support.js';

let harness: ServiceHarness | undefined;

afterEach(() => {
  harness?.close();
  harness = undefined;
});

function csv(content: string | Uint8Array): ImportRequest {
  return { channel: 'csv_file', fileName: 'corpus.csv', declaredSource: null, contentBase64: base64(content) };
}

function json(content: string | Uint8Array): ImportRequest {
  return { channel: 'json_file', fileName: 'corpus.json', declaredSource: null, contentBase64: base64(content) };
}

type Expected = ReadonlyArray<readonly [string, string | null, string]>;

/** Expected errors: an exact list, or a single problem that every reported error has. */
const corpus: ReadonlyArray<readonly [string, () => ImportRequest, Expected | { every: string; record: string }]> = [
  ['512 KiB of double quotes (CSV)', () => csv('"'.repeat(CAP)), [['1', null, 'header_invalid']]],
  [
    'alternating empty quoted fields (CSV)',
    () => csv('"",'.repeat(Math.floor(CAP / 3))),
    { every: 'column_unknown', record: '1' },
  ],
  [
    'a quoted field of alternating escaped quotes (CSV)',
    () => csv(`"${'x""'.repeat(Math.floor((CAP - 2) / 3))}"`),
    [['1', null, 'header_invalid']],
  ],
  ['an unterminated quote at 512 KiB (CSV)', () => csv(`"${'a'.repeat(CAP - 1)}`), [['1', null, 'parse_error']]],
  [
    'an unterminated quote in a data row (CSV)',
    () => csv(`${MATCHES_HEADER}\n"liga-ficticia,Liga`),
    [['2', null, 'parse_error']],
  ],
  ['only separators (CSV)', () => csv(','.repeat(CAP)), { every: 'column_unknown', record: '1' }],
  ['CR-only line ends (CSV)', () => csv(matchesCsv().replaceAll('\n', '\r')), [['1', null, 'parse_error']]],
  [
    'NUL in a field (CSV)',
    () => csv(matchesCsv([matchRow('Club Alfa', 'Deportivo\u0000Beta')])),
    [['2', 'away_team', 'type_invalid']],
  ],
  ['NUL in a JSON file', () => json('{"format":\u0000}'), [['file', null, 'parse_error']]],
  ['a BOM only (CSV)', () => csv(Uint8Array.from([0xef, 0xbb, 0xbf])), [['file', null, 'header_invalid']]],
  ['a BOM only (JSON)', () => json(Uint8Array.from([0xef, 0xbb, 0xbf])), [['file', null, 'parse_error']]],
  ['overlong UTF-8 (CSV)', () => csv(Uint8Array.from([0x61, 0xc1, 0x81, 0x0a])), [['file', null, 'encoding_invalid']]],
  [
    'overlong UTF-8 (JSON)',
    () => json(Uint8Array.from([0x7b, 0xe0, 0x80, 0xbb, 0x7d])),
    [['file', null, 'encoding_invalid']],
  ],
  [
    'an encoded lone surrogate (CSV)',
    () => csv(Uint8Array.from([0xed, 0xa0, 0x80])),
    [['file', null, 'encoding_invalid']],
  ],
  [
    'an encoded low surrogate (JSON)',
    () => json(Uint8Array.from([0x22, 0xed, 0xbf, 0xbf, 0x22])),
    [['file', null, 'encoding_invalid']],
  ],
  ['5 001 data rows (CSV)', () => csv(`${MATCHES_HEADER}\n${'x\n'.repeat(5001)}`), [['file', null, 'too_many_rows']]],
  [
    'a 201-character field (CSV)',
    () => csv(matchesCsv([matchRow('Club Alfa', 'Deportivo Beta').replace('Fase Regular', 'F'.repeat(201))])),
    [['2', 'stage_name', 'value_out_of_range']],
  ],
  ['a 201-character header name (CSV)', () => csv(`${'h'.repeat(201)}\n`), [['1', null, 'header_invalid']]],
  [
    'depth 17 (JSON)',
    () => json(`${'['.repeat(17)}${']'.repeat(17)}`),
    [['/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0', null, 'parse_error']],
  ],
  [
    '512 KiB of open brackets (JSON)',
    () => json('['.repeat(CAP)),
    [['/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0', null, 'parse_error']],
  ],
  ['512 KiB of double quotes (JSON)', () => json('"'.repeat(CAP)), [['file', null, 'parse_error']]],
  [
    'duplicate keys (JSON)',
    () => json('{"format":"edr-manual-import/1","competition":{"id":"a","id":"b"}}'),
    [['/competition/id', 'id', 'parse_error']],
  ],
  [
    'a duplicate __proto__ key (JSON)',
    () => json('{"__proto__":{"polluted":true},"__proto__":{"polluted":true}}'),
    [['/*', '__proto__', 'parse_error']],
  ],
];

describe('adversarial corpus: each input refused with the expected error', () => {
  it.each(corpus)('%s', (_label, request, expected) => {
    const h = serviceHarness();
    harness = h;
    const outcome = h.service.createImport(request());
    expect(outcome.ok).toBe(false);
    const errors = outcome.ok ? [] : outcome.errors;
    if (Array.isArray(expected)) {
      expect(errors.map((error) => [error.record, error.field, error.problem])).toEqual(expected);
    } else {
      const rule = expected as { every: string; record: string };
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every((error) => error.problem === rule.every && error.record === rule.record)).toBe(true);
    }
    expect(h.counts()).toEqual({
      imports: 0,
      manual_competitions: 0,
      manual_seasons: 0,
      manual_selection_versions: 0,
    });
    expect(h.storedFiles()).toEqual([]);
  });

  it('refuses __proto__ keys of a JSON file as unknown members without touching any prototype', () => {
    const h = serviceHarness();
    harness = h;
    const text = JSON.stringify(sampleDocument()).replace(
      '"selections":[{',
      '"__proto__":{"polluted":true},"selections":[{"__proto__":{"polluted":true},',
    );
    const outcome = h.service.createImport(json(text));
    const errors = outcome.ok ? [] : outcome.errors;
    expect(errors.map((error) => [error.record, error.field, error.problem]).sort()).toEqual([
      ['/', '__proto__', 'column_unknown'],
      ['/selections/0', '__proto__', 'column_unknown'],
    ]);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('accepts a JSON file nested exactly 16 levels deep up to the schema (depth is not the error)', () => {
    const h = serviceHarness();
    harness = h;
    const outcome = h.service.createImport(json(`${'['.repeat(16)}${']'.repeat(16)}`));
    const errors = outcome.ok ? [] : outcome.errors;
    expect(errors.map((error) => error.problem)).toEqual(['type_invalid']);
  });
});
