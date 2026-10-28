/**
 * Repository helpers for the `Db` port (data-model.md section 2; T10-F14, T10-F10).
 *
 * - `placeholders` builds the `?, ?, ?` list of an `IN (...)` clause; the values are still bound.
 * - `pickIdentifier` turns a requested column or sort name into the matching code constant, so that no identifier
 *   from input reaches SQL text.
 * - `toSqlBoolean` and `fromSqlBoolean` map the `INTEGER CHECK (col IN (0,1))` columns.
 * - `writeJsonColumn` and `readJsonColumn` validate JSON columns with a Zod schema on write and on read; `failure`
 *   columns use them with the contract's closed `Failure` schema, so only a closed code and sanitized parameters are
 *   stored (T10-F10). Their errors name the column and the issue paths, never the values.
 */
import type { z } from 'zod';

import { DbError } from './errors.js';

/** Most bound values one `placeholders` list may hold. */
export const MAX_PLACEHOLDERS = 1000;

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/;

/** Returns `count` comma-separated `?` placeholders (1 to 1000). */
export function placeholders(count: number): string {
  if (!Number.isInteger(count) || count < 1 || count > MAX_PLACEHOLDERS) {
    throw new DbError('placeholder_count_invalid', `A placeholder list holds 1 to ${MAX_PLACEHOLDERS} values`);
  }
  return Array.from({ length: count }, () => '?').join(', ');
}

/**
 * Returns the element of `allowed` equal to `requested`. The returned string is the code constant, never the input.
 * Every allowed entry must be a plain SQL identifier (optionally `table.column`).
 *
 * @throws DbError `identifier_not_allowed` when `requested` is not in the list (the message omits the value).
 */
export function pickIdentifier<const T extends string>(allowed: readonly T[], requested: string): T {
  const found = allowed.find((identifier) => identifier === requested);
  if (found === undefined || !IDENTIFIER_PATTERN.test(found)) {
    throw new DbError('identifier_not_allowed', 'The requested SQL identifier is not in the allowed list');
  }
  return found;
}

/** Maps a boolean to the `0`/`1` of an `INTEGER CHECK (col IN (0,1))` column. */
export function toSqlBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/** Reads a `0`/`1` column; any other value is a defect of the stored data. */
export function fromSqlBoolean(value: unknown, column: string): boolean {
  if (value === 0 || value === 1) {
    return value === 1;
  }
  throw new DbError('column_value_invalid', `Column ${column} holds a value other than 0 or 1`);
}

function invalid(column: string, error: z.ZodError | undefined, stage: 'write' | 'read'): DbError {
  const paths = (error?.issues ?? [])
    .slice(0, 5)
    .map((issue) => (issue.path.length === 0 ? '(root)' : issue.path.map((part) => String(part)).join('.')));
  const where = paths.length === 0 ? '' : ` at ${paths.join(', ')}`;
  return new DbError('json_column_invalid', `JSON column ${column} is invalid on ${stage}${where}`);
}

/** Validates `value` with `schema` and serializes the parsed result for a JSON column. */
export function writeJsonColumn<T>(schema: z.ZodType<T>, value: unknown, column: string): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw invalid(column, parsed.error, 'write');
  }
  return JSON.stringify(parsed.data);
}

/** Parses a JSON column and validates it with `schema`. */
export function readJsonColumn<T>(schema: z.ZodType<T>, text: unknown, column: string): T {
  if (typeof text !== 'string') {
    throw invalid(column, undefined, 'read');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw invalid(column, undefined, 'read');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw invalid(column, parsed.error, 'read');
  }
  return parsed.data;
}

/** Same as `readJsonColumn` for a nullable column: SQL `NULL` reads as `null`. */
export function readNullableJsonColumn<T>(schema: z.ZodType<T>, text: unknown, column: string): T | null {
  return text === null ? null : readJsonColumn(schema, text, column);
}
