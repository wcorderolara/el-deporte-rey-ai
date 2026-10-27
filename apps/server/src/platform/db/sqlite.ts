/**
 * `node:sqlite` adapter of the `Db` port (AD-05; data-model.md sections 1 and 2).
 *
 * The connection is opened with foreign keys enforced, double-quoted string literals and extensions disabled, a busy
 * timeout, and (for a file database) the WAL journal. Statements are prepared once and cached by their SQL text,
 * which is always a code constant (T10-F14).
 *
 * Scripts that load this module need `--disable-warning=ExperimentalWarning` on Node.js 22 (OD-30).
 */
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

import type { Db, RunResult, SqlParams, SqlRow, Statement, TransactionWork } from './db.js';
import { DbError } from './errors.js';

/** File name of the application database inside the data directory (data-model.md section 1). */
export const DATABASE_FILE_NAME = 'edr.sqlite';

/** Location of a private in-memory database (unit tests). */
export const MEMORY_LOCATION = ':memory:';

/** Default time a statement waits for a lock held by another connection before failing. */
export const DEFAULT_BUSY_TIMEOUT_MS = 5000;

/** Upper bound of cached prepared statements; SQL texts are code constants, so the bound is rarely reached. */
const STATEMENT_CACHE_LIMIT = 500;

export interface OpenDatabaseOptions {
  /** Path of the database file (normally `<dataDir>/edr.sqlite`), or `:memory:`. */
  readonly location: string;
  /** Busy timeout in milliseconds (default 5000). */
  readonly busyTimeoutMs?: number;
}

/**
 * The adapter as seen by the composition root and the migration runner. Modules receive it typed as `Db`, which has
 * no way to run unbound SQL text.
 */
export interface SqliteDatabase extends Db {
  /**
   * Runs a SQL script of one or more statements without parameters. Reserved for the migration runner, which reads
   * the scripts from the committed `apps/server/migrations` directory.
   */
  execScript(sql: string): void;
}

function bind(params: SqlParams | undefined): SQLInputValue[] | [Record<string, SQLInputValue>] {
  if (params === undefined) {
    return [];
  }
  if (Array.isArray(params)) {
    return params as SQLInputValue[];
  }
  return [params as Record<string, SQLInputValue>];
}

class NodeSqliteStatement<Row extends object> implements Statement<Row> {
  readonly #statement: StatementSync;

  constructor(statement: StatementSync) {
    this.#statement = statement;
  }

  run(params?: SqlParams): RunResult {
    const result = this.#statement.run(...(bind(params) as SQLInputValue[]));
    return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
  }

  get(params?: SqlParams): Row | undefined {
    return this.#statement.get(...(bind(params) as SQLInputValue[])) as Row | undefined;
  }

  all(params?: SqlParams): Row[] {
    return this.#statement.all(...(bind(params) as SQLInputValue[])) as Row[];
  }
}

function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function asyncWorkError(): DbError {
  return new DbError(
    'transaction_async_work',
    'Transaction work must be synchronous: it returned a promise, so the transaction was rolled back (T10-F15)',
  );
}

class NodeSqliteDatabase implements SqliteDatabase {
  readonly #db: DatabaseSync;
  readonly #statements = new Map<string, StatementSync>();

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  get inTransaction(): boolean {
    return this.#db.isTransaction;
  }

  prepare<Row extends object = SqlRow>(sql: string): Statement<Row> {
    let statement = this.#statements.get(sql);
    if (statement === undefined) {
      statement = this.#db.prepare(sql);
      if (this.#statements.size >= STATEMENT_CACHE_LIMIT) {
        const oldest = this.#statements.keys().next();
        if (oldest.done !== true) {
          this.#statements.delete(oldest.value);
        }
      }
      this.#statements.set(sql, statement);
    }
    return new NodeSqliteStatement<Row>(statement);
  }

  execScript(sql: string): void {
    this.#db.exec(sql);
  }

  transaction<T>(work: TransactionWork<T>): T {
    if (this.#db.isTransaction) {
      return this.#inSavepoint(work);
    }
    this.#db.exec('BEGIN IMMEDIATE');
    let result: unknown;
    try {
      result = work();
      if (isThenable(result)) {
        throw asyncWorkError();
      }
    } catch (error) {
      this.#rollback();
      throw error;
    }
    try {
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#rollback();
      throw error;
    }
    return result as T;
  }

  close(): void {
    this.#statements.clear();
    this.#db.close();
  }

  /** Nested transaction: a savepoint named `edr_nested`; SQLite resolves a reused name to the innermost one. */
  #inSavepoint<T>(work: TransactionWork<T>): T {
    this.#db.exec('SAVEPOINT edr_nested');
    let result: unknown;
    try {
      result = work();
      if (isThenable(result)) {
        throw asyncWorkError();
      }
    } catch (error) {
      if (this.#db.isTransaction) {
        this.#db.exec('ROLLBACK TO edr_nested');
        this.#db.exec('RELEASE edr_nested');
      }
      throw error;
    }
    this.#db.exec('RELEASE edr_nested');
    return result as T;
  }

  #rollback(): void {
    // SQLite may already have rolled back on its own (for example after SQLITE_FULL); ROLLBACK would then fail.
    if (this.#db.isTransaction) {
      this.#db.exec('ROLLBACK');
    }
  }
}

function readPragma(db: DatabaseSync, sql: string, column: string): unknown {
  const row = db.prepare(sql).get();
  return row === undefined ? undefined : row[column];
}

function configure(db: DatabaseSync, location: string): void {
  db.exec('PRAGMA foreign_keys = ON');
  if (readPragma(db, 'PRAGMA foreign_keys', 'foreign_keys') !== 1) {
    throw new DbError('pragma_failed', 'Foreign key enforcement could not be enabled');
  }
  if (location !== MEMORY_LOCATION) {
    const mode = readPragma(db, 'PRAGMA journal_mode = WAL', 'journal_mode');
    if (mode !== 'wal') {
      throw new DbError('pragma_failed', 'The WAL journal mode could not be enabled');
    }
  }
}

/**
 * Opens (creating when absent) the database at `options.location`. The parent directory must exist; the data
 * directory and its permissions are prepared by the composition root (T10-F13).
 *
 * @throws DbError `open_failed` or `pragma_failed`; the message names no path.
 */
export function openDatabase(options: OpenDatabaseOptions): SqliteDatabase {
  const busyTimeoutMs = options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS;
  if (!Number.isInteger(busyTimeoutMs) || busyTimeoutMs < 0) {
    throw new DbError('open_failed', 'The busy timeout must be a non-negative integer of milliseconds');
  }
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(options.location, {
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
      readBigInts: false,
      timeout: busyTimeoutMs,
    });
  } catch (cause) {
    throw new DbError('open_failed', 'The database could not be opened', { cause });
  }
  try {
    configure(db, options.location);
  } catch (cause) {
    db.close();
    if (cause instanceof DbError) {
      throw cause;
    }
    throw new DbError('pragma_failed', 'The database connection could not be configured', { cause });
  }
  return new NodeSqliteDatabase(db);
}
