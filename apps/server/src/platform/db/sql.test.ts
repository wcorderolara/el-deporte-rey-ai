/**
 * Unit tests of the repository helpers: placeholder lists, identifiers from code constants (T10-F14), boolean
 * columns and Zod-validated JSON columns whose errors carry no stored values (T10-F10, T11H-F12).
 */
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { DbError } from './errors.js';
import {
  fromSqlBoolean,
  MAX_PLACEHOLDERS,
  pickIdentifier,
  placeholders,
  readJsonColumn,
  readNullableJsonColumn,
  toSqlBoolean,
  writeJsonColumn,
} from './sql.js';

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof DbError ? error.code : 'not a DbError';
  }
  return undefined;
}

describe('placeholders', () => {
  it('returns one bound placeholder per value', () => {
    expect(placeholders(1)).toBe('?');
    expect(placeholders(3)).toBe('?, ?, ?');
    expect(placeholders(MAX_PLACEHOLDERS).split(', ')).toHaveLength(MAX_PLACEHOLDERS);
  });

  it('refuses empty, fractional and oversized lists', () => {
    for (const count of [0, -1, 1.5, MAX_PLACEHOLDERS + 1, Number.NaN]) {
      expect(codeOf(() => placeholders(count))).toBe('placeholder_count_invalid');
    }
  });
});

describe('pickIdentifier', () => {
  const SORTABLE = ['created_at', 'updated_at', 'p.competition_name'] as const;

  it('returns the code constant equal to the request', () => {
    expect(pickIdentifier(SORTABLE, 'updated_at')).toBe('updated_at');
    expect(pickIdentifier(SORTABLE, 'p.competition_name')).toBe('p.competition_name');
  });

  it('refuses identifiers outside the list without echoing them', () => {
    const hostile = 'created_at; DROP TABLE projects';
    let caught: unknown;
    try {
      pickIdentifier(SORTABLE, hostile);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).code).toBe('identifier_not_allowed');
    expect((caught as DbError).message).not.toContain('DROP');
    expect(codeOf(() => pickIdentifier(SORTABLE, 'CREATED_AT'))).toBe('identifier_not_allowed');
  });

  it('refuses an allowed entry that is not a plain identifier', () => {
    expect(codeOf(() => pickIdentifier(['name desc'], 'name desc'))).toBe('identifier_not_allowed');
  });
});

describe('boolean columns', () => {
  it('maps booleans to 0 and 1 and back', () => {
    expect(toSqlBoolean(true)).toBe(1);
    expect(toSqlBoolean(false)).toBe(0);
    expect(fromSqlBoolean(1, 'active')).toBe(true);
    expect(fromSqlBoolean(0, 'active')).toBe(false);
  });

  it('refuses other stored values', () => {
    expect(codeOf(() => fromSqlBoolean(2, 'active'))).toBe('column_value_invalid');
    expect(codeOf(() => fromSqlBoolean('1', 'active'))).toBe('column_value_invalid');
  });
});

describe('JSON columns', () => {
  // Test stand-in shaped like a closed failure object; the real schema is the contract's `Failure` (T20).
  const FailureLike = z
    .object({
      code: z.enum(['timeout', 'invalid']),
      sourceId: z.string().nullable(),
      path: z.string().max(200).nullable(),
      httpStatus: z.number().int().nullable(),
    })
    .strict();

  const valid = { code: 'timeout', sourceId: 'demo-a', path: null, httpStatus: null } as const;

  it('validates on write and round-trips on read', () => {
    const text = writeJsonColumn(FailureLike, valid, 'workflow_runs.failure');
    expect(JSON.parse(text)).toEqual(valid);
    expect(readJsonColumn(FailureLike, text, 'workflow_runs.failure')).toEqual(valid);
  });

  it('refuses a value outside the schema on write, naming the path but not the value', () => {
    const secretLike = 'Incorrect API key provided: sk-ab****xyz';
    let caught: unknown;
    try {
      writeJsonColumn(FailureLike, { ...valid, code: secretLike }, 'workflow_runs.failure');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DbError);
    expect((caught as DbError).code).toBe('json_column_invalid');
    expect((caught as DbError).message).toContain('workflow_runs.failure');
    expect((caught as DbError).message).toContain('code');
    expect((caught as DbError).message).not.toContain('sk-ab');
    expect(codeOf(() => writeJsonColumn(FailureLike, { ...valid, message: 'free text' }, 'failure'))).toBe(
      'json_column_invalid',
    );
  });

  it('refuses stored text that is not JSON or does not match the schema', () => {
    expect(codeOf(() => readJsonColumn(FailureLike, '{not json', 'failure'))).toBe('json_column_invalid');
    expect(codeOf(() => readJsonColumn(FailureLike, '{"code":"other"}', 'failure'))).toBe('json_column_invalid');
    expect(codeOf(() => readJsonColumn(FailureLike, 42, 'failure'))).toBe('json_column_invalid');
    expect(codeOf(() => readJsonColumn(FailureLike, null, 'failure'))).toBe('json_column_invalid');
  });

  it('reads SQL NULL of a nullable column as null', () => {
    expect(readNullableJsonColumn(FailureLike, null, 'failure')).toBeNull();
    expect(readNullableJsonColumn(FailureLike, JSON.stringify(valid), 'failure')).toEqual(valid);
  });
});
