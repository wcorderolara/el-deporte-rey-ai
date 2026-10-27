/**
 * The `Db` port (AD-05, data-model.md section 2).
 *
 * Repositories inside the modules depend on this interface only; the `node:sqlite` adapter (`sqlite.ts`) implements
 * it, so that a switch to another SQLite binding changes only `platform/db`.
 *
 * SQL access rules (T10-F14):
 * - every value reaches SQLite as a bound parameter of a prepared statement; SQL text is a constant of the calling
 *   code, never built from input (a lint rule rejects template literals with substitutions passed to `prepare` or
 *   `exec`);
 * - a dynamic identifier (a column or sort name) is chosen from a code constant with `pickIdentifier` (`sql.ts`);
 * - the port has no method that runs SQL text without binding (multi-statement scripts are run only by the
 *   migration runner, through the adapter).
 *
 * Guard atomicity (T10-F15): `transaction` runs synchronous work inside `BEGIN IMMEDIATE`; work that returns a
 * promise or another thenable is refused and rolled back, so no `await` can separate a guard check from its write.
 */

/** A value SQLite accepts as a bound parameter. Booleans and `undefined` are not accepted (`toSqlBoolean`). */
export type SqlValue = null | number | bigint | string | Uint8Array;

/** Named parameters (`:name`, `$name`, `@name` or the bare name in the object keys). */
export type SqlNamedParams = Readonly<Record<string, SqlValue>>;

/** Bound parameters of one execution: positional (`?`) values in order, or one object of named values. */
export type SqlParams = readonly SqlValue[] | SqlNamedParams;

/** A value SQLite returns for a column. */
export type SqlOutputValue = null | number | bigint | string | Uint8Array;

/** A result row as returned by the driver, before validation by the repository. */
export type SqlRow = Record<string, SqlOutputValue>;

/** Outcome of a data-changing statement. */
export interface RunResult {
  /** Rows inserted, updated or deleted by the statement. */
  readonly changes: number;
  /** Rowid of the last inserted row (tables in this schema use text IDs; rarely needed). */
  readonly lastInsertRowid: number | bigint;
}

/**
 * A prepared statement. `Row` is the shape the caller expects; it is not checked by the driver, so repositories
 * validate rows that carry JSON or enumerations (`readJsonColumn` in `sql.ts`, or the module's Zod schema).
 */
export interface Statement<Row extends object = SqlRow> {
  /** Executes a data-changing statement. */
  run(params?: SqlParams): RunResult;
  /** Returns the first row, or `undefined` when there is none. */
  get(params?: SqlParams): Row | undefined;
  /** Returns every row. */
  all(params?: SqlParams): Row[];
}

/**
 * Work that may run inside a transaction: synchronous and returning a non-thenable value. The return type is
 * rejected at compile time when it is a promise; the adapter also refuses a thenable at run time.
 */
export type TransactionWork<T> = () => T extends PromiseLike<unknown> ? never : T;

/** Access to the application database. */
export interface Db {
  /**
   * Prepares (and caches) a statement. `sql` must be a constant of the calling code; values are bound through the
   * statement's `run`, `get` or `all`.
   */
  prepare<Row extends object = SqlRow>(sql: string): Statement<Row>;

  /**
   * Runs `work` in one `BEGIN IMMEDIATE` transaction and commits, or rolls back when `work` throws. The write lock is
   * taken before `work` starts, so guard checks and the writes they protect are atomic (T10-F15).
   *
   * When called inside another transaction it runs `work` in a savepoint of the outer transaction: an error rolls
   * back only the savepoint and is rethrown; the outer transaction decides the commit.
   *
   * @throws DbError `transaction_async_work` when `work` returns a promise or another thenable (rolled back).
   */
  transaction<T>(work: TransactionWork<T>): T;

  /** True while a transaction is open on this connection. */
  readonly inTransaction: boolean;

  /** Closes the connection. Further use throws. */
  close(): void;
}
