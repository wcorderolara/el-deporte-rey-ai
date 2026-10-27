/**
 * Errors of the persistence platform.
 *
 * Messages are built from fixed text and code-controlled parameters only (migration file names, column labels,
 * validation paths); they never contain a stored value, an absolute file path or a driver message, so that they can
 * be logged and turned into closed failure codes safely (T10-F10, T11H-F12).
 */

/** Closed list of persistence error codes. */
export const DB_ERROR_CODES = [
  'open_failed',
  'pragma_failed',
  'transaction_async_work',
  'migration_directory_unreadable',
  'migration_file_name_invalid',
  'migration_version_duplicate',
  'migration_sequence_gap',
  'migration_unknown_applied',
  'migration_name_mismatch',
  'migration_out_of_order',
  'migration_failed',
  'migration_left_transaction',
  'foreign_key_violation',
  'identifier_not_allowed',
  'json_column_invalid',
  'column_value_invalid',
  'placeholder_count_invalid',
] as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

export class DbError extends Error {
  readonly code: DbErrorCode;

  constructor(code: DbErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DbError';
    this.code = code;
  }
}

/** Kind of SQLite constraint that refused a write. */
export type ConstraintKind = 'check' | 'not_null' | 'unique' | 'primary_key' | 'foreign_key' | 'datatype';

/** Extended SQLite result codes of constraint failures (https://www.sqlite.org/rescode.html). */
const CONSTRAINT_KINDS: ReadonlyMap<number, ConstraintKind> = new Map([
  [275, 'check'], // SQLITE_CONSTRAINT_CHECK
  [1299, 'not_null'], // SQLITE_CONSTRAINT_NOTNULL
  [2067, 'unique'], // SQLITE_CONSTRAINT_UNIQUE
  [1555, 'primary_key'], // SQLITE_CONSTRAINT_PRIMARYKEY
  [787, 'foreign_key'], // SQLITE_CONSTRAINT_FOREIGNKEY
  [3091, 'datatype'], // SQLITE_CONSTRAINT_DATATYPE (STRICT tables)
]);

/**
 * Returns the constraint kind when `error` is a SQLite constraint failure raised by `node:sqlite`, else null.
 * Repositories use it to map, for example, a unique violation to a domain conflict without reading the message.
 */
export function constraintKind(error: unknown): ConstraintKind | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { code, errcode } = error as { code?: unknown; errcode?: unknown };
  if (code !== 'ERR_SQLITE_ERROR' || typeof errcode !== 'number') {
    return null;
  }
  return CONSTRAINT_KINDS.get(errcode) ?? null;
}
