/** JSON pre-scan before `JSON.parse` (T11H-F08, V-45): depth 16 and duplicate member names with their pointer. */
import { describe, expect, it } from 'vitest';

import { ImportErrorList } from '../errors.js';

import { MAX_IMPORT_JSON_DEPTH, prescanJson } from './prescan.js';

function scan(text: string) {
  const errors = new ImportErrorList('file');
  const outcome = prescanJson(text, errors);
  return { outcome, errors: errors.items };
}

function nested(depth: number): string {
  return `${'['.repeat(depth)}${']'.repeat(depth)}`;
}

describe('prescanJson', () => {
  it('accepts nesting up to 16 levels and refuses 17', () => {
    expect(scan(nested(MAX_IMPORT_JSON_DEPTH)).outcome).toBe('ok');
    const deep = scan(nested(MAX_IMPORT_JSON_DEPTH + 1));
    expect(deep.outcome).toBe('too_deep');
    expect(deep.errors).toEqual([
      {
        location: 'file',
        record: '/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0',
        field: null,
        problem: 'parse_error',
        message: 'The JSON nesting is deeper than 16 levels',
      },
    ]);
  });

  it('ignores brackets inside strings', () => {
    expect(scan(`{"name":"${'['.repeat(100)}\\"${'{'.repeat(100)}"}`).outcome).toBe('ok');
  });

  it('refuses a duplicate member name naming the JSON pointer', () => {
    const { outcome, errors } = scan('{"selections":[{"matches":[{"home":"a"},{"score":1,"status":"x","score":2}]}]}');
    expect(outcome).toBe('duplicate_member');
    expect(errors).toEqual([
      {
        location: 'file',
        record: '/selections/0/matches/1/score',
        field: 'score',
        problem: 'parse_error',
        message: 'A member name appears twice in one object',
      },
    ]);
  });

  it('treats escaped and plain spellings of one name as duplicates, as JSON.parse does', () => {
    const { outcome, errors } = scan('{"home":1,"\\u0068ome":2}');
    expect(outcome).toBe('duplicate_member');
    expect(errors[0]?.record).toBe('/home');
  });

  it('allows the same name in different objects', () => {
    expect(scan('[{"a":1},{"a":2},{"b":{"a":3}}]').outcome).toBe('ok');
  });

  it('reports every duplicate and shows unknown names as * in the pointer', () => {
    const { errors } = scan('{"__proto__":1,"__proto__":2,"x":{"constructor":1,"constructor":2}}');
    expect(errors.map((error) => [error.record, error.field])).toEqual([
      ['/*', '__proto__'],
      ['/*/*', 'constructor'],
    ]);
  });

  it('leaves malformed input to JSON.parse', () => {
    expect(scan('{"a":"unterminated').outcome).toBe('ok');
    expect(scan('{"a":1]').outcome).toBe('ok');
    expect(scan('{"a\\x":1}').outcome).toBe('ok');
  });
});
