/**
 * Migration runner (data-model.md section 2).
 *
 * Migrations are the files `apps/server/migrations/NNNN_<name>.sql`, numbered from 0001 without gaps. At startup the
 * runner applies every migration not yet recorded in `schema_migrations`, in order, each in its own `BEGIN IMMEDIATE`
 * transaction together with its `schema_migrations` row and a foreign-key check, so that a failing migration leaves
 * the schema unchanged.
 *
 * The runner refuses to start when the recorded history and the files disagree: an applied version without a file
 * (a database newer than the code), an applied version whose file has another name, or a pending version below the
 * latest applied one. A migration must not contain transaction control statements (`BEGIN`, `COMMIT`) or change
 * `PRAGMA foreign_keys` (which SQLite ignores inside a transaction).
 *
 * A schema change after `0001_initial.sql` is a new migration and a decision above LOW (schema change).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DbError } from './errors.js';
import { openDatabase, type OpenDatabaseOptions, type SqliteDatabase } from './sqlite.js';

/** `NNNN_<name>.sql` with a lowercase snake-case name. */
export const MIGRATION_FILE_PATTERN = /^([0-9]{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

/** Definition of the history table; `0001_initial.sql` repeats it with `IF NOT EXISTS` (data-model.md section 3.1). */
export const SCHEMA_MIGRATIONS_DDL =
  'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
  '  version INTEGER PRIMARY KEY,\n' +
  '  name TEXT NOT NULL,\n' +
  '  applied_at TEXT NOT NULL\n' +
  ') STRICT;';

export interface MigrationFile {
  /** Number of the migration (0001 is 1). */
  readonly version: number;
  /** Name part of the file name, recorded in `schema_migrations.name`. */
  readonly name: string;
  /** File name, used in error messages (never the absolute path). */
  readonly fileName: string;
  /** SQL script. */
  readonly sql: string;
}

export interface AppliedMigration {
  readonly version: number;
  readonly name: string;
  readonly appliedAt: string;
}

export interface RunMigrationsOptions {
  /** Directory of the migration files (default: `apps/server/migrations`). */
  readonly directory?: string;
  /** Clock for `applied_at` (default: the system clock). */
  readonly now?: () => Date;
}

export interface MigrationReport {
  /** Migrations applied by this call, in order. */
  readonly applied: readonly { readonly version: number; readonly name: string }[];
  /** Highest version recorded after this call (0 when there is none). */
  readonly currentVersion: number;
}

/**
 * Directory of the committed migrations, `apps/server/migrations`, from both the source layout
 * (`apps/server/src/platform/db`) and the build layout (`apps/server/dist/src/platform/db`).
 */
export function defaultMigrationsDirectory(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '../../../migrations'), path.resolve(here, '../../../../migrations')];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, '0001_initial.sql'))) {
      return candidate;
    }
  }
  throw new DbError('migration_directory_unreadable', 'The migrations directory of the server package was not found');
}

/**
 * Reads and checks the migration files of `directory`: every `.sql` file must match `NNNN_<name>.sql`, and the
 * versions must run from 1 without gaps or duplicates. Other files are ignored.
 */
export function readMigrations(directory: string): MigrationFile[] {
  let fileNames: string[];
  try {
    fileNames = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name);
  } catch (cause) {
    throw new DbError('migration_directory_unreadable', 'The migrations directory could not be read', { cause });
  }

  const migrations: MigrationFile[] = [];
  for (const fileName of fileNames) {
    const match = MIGRATION_FILE_PATTERN.exec(fileName);
    if (match === null || match[1] === undefined || match[2] === undefined) {
      throw new DbError(
        'migration_file_name_invalid',
        `Migration file ${JSON.stringify(fileName)} does not match NNNN_<name>.sql`,
      );
    }
    const sql = readFileSync(path.join(directory, fileName), 'utf8');
    migrations.push({ version: Number(match[1]), name: match[2], fileName, sql });
  }

  migrations.sort((a, b) => a.version - b.version);
  migrations.forEach((migration, index) => {
    const previous = migrations[index - 1];
    if (previous !== undefined && previous.version === migration.version) {
      throw new DbError(
        'migration_version_duplicate',
        `Migrations ${previous.fileName} and ${migration.fileName} have the same version`,
      );
    }
    if (migration.version !== index + 1) {
      throw new DbError(
        'migration_sequence_gap',
        `Migration ${migration.fileName} breaks the sequence: version ${index + 1} is missing`,
      );
    }
  });
  return migrations;
}

interface HistoryRow {
  version: number;
  name: string;
  applied_at: string;
}

/** Returns the recorded migrations in version order (empty when `schema_migrations` does not exist yet). */
export function appliedMigrations(db: SqliteDatabase): AppliedMigration[] {
  const table = db
    .prepare<{ name: string }>("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (table === undefined) {
    return [];
  }
  return db
    .prepare<HistoryRow>('SELECT version, name, applied_at FROM schema_migrations ORDER BY version')
    .all()
    .map((row) => ({ version: row.version, name: row.name, appliedAt: row.applied_at }));
}

function checkHistory(applied: readonly AppliedMigration[], files: readonly MigrationFile[]): void {
  const byVersion = new Map(files.map((file) => [file.version, file]));
  for (const record of applied) {
    const file = byVersion.get(record.version);
    if (file === undefined) {
      throw new DbError(
        'migration_unknown_applied',
        `The database has migration version ${record.version}, which this build does not know`,
      );
    }
    if (file.name !== record.name) {
      throw new DbError(
        'migration_name_mismatch',
        `Applied migration version ${record.version} is recorded under another name than ${file.fileName}`,
      );
    }
  }
  const latest = applied.reduce((max, record) => Math.max(max, record.version), 0);
  const appliedVersions = new Set(applied.map((record) => record.version));
  const late = files.find((file) => !appliedVersions.has(file.version) && file.version < latest);
  if (late !== undefined) {
    throw new DbError(
      'migration_out_of_order',
      `Migration ${late.fileName} is not applied but a later version is (version ${latest})`,
    );
  }
}

function applyMigration(db: SqliteDatabase, migration: MigrationFile, now: () => Date): boolean {
  return db.transaction(() => {
    const recorded = db
      .prepare<{ name: string }>('SELECT name FROM schema_migrations WHERE version = ?')
      .get([migration.version]);
    if (recorded !== undefined) {
      // Applied by another connection since the history was read.
      if (recorded.name !== migration.name) {
        throw new DbError(
          'migration_name_mismatch',
          `Applied migration version ${migration.version} is recorded under another name than ${migration.fileName}`,
        );
      }
      return false;
    }
    try {
      db.execScript(migration.sql);
    } catch (cause) {
      throw new DbError('migration_failed', `Migration ${migration.fileName} failed`, { cause });
    }
    if (!db.inTransaction) {
      throw new DbError(
        'migration_left_transaction',
        `Migration ${migration.fileName} ended the transaction; migrations must not contain BEGIN, COMMIT or ROLLBACK`,
      );
    }
    const violation = db.prepare('PRAGMA foreign_key_check').get();
    if (violation !== undefined) {
      throw new DbError(
        'foreign_key_violation',
        `Migration ${migration.fileName} leaves rows that violate a foreign key`,
      );
    }
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run([
      migration.version,
      migration.name,
      now().toISOString(),
    ]);
    return true;
  });
}

/**
 * Applies the pending migrations of `options.directory` to `db`, in order, one transaction each.
 *
 * @throws DbError when the files or the recorded history are inconsistent, or a migration fails (the failing
 *   migration is rolled back; earlier ones of the same call stay applied).
 */
export function runMigrations(db: SqliteDatabase, options: RunMigrationsOptions = {}): MigrationReport {
  const files = readMigrations(options.directory ?? defaultMigrationsDirectory());
  const now = options.now ?? (() => new Date());

  db.execScript(SCHEMA_MIGRATIONS_DDL);
  const history = appliedMigrations(db);
  checkHistory(history, files);

  const done = new Set(history.map((record) => record.version));
  const applied: { version: number; name: string }[] = [];
  for (const migration of files) {
    if (!done.has(migration.version) && applyMigration(db, migration, now)) {
      applied.push({ version: migration.version, name: migration.name });
    }
  }
  const currentVersion = appliedMigrations(db).reduce((max, record) => Math.max(max, record.version), 0);
  return { applied, currentVersion };
}

/**
 * Opens the database and applies the pending migrations; closes the connection again when a migration fails.
 * Used by the composition root at startup and by tests on temporary databases.
 */
export function openMigratedDatabase(options: OpenDatabaseOptions & RunMigrationsOptions): {
  db: SqliteDatabase;
  report: MigrationReport;
} {
  const db = openDatabase(options);
  try {
    const report = runMigrations(db, options);
    return { db, report };
  } catch (error) {
    db.close();
    throw error;
  }
}
