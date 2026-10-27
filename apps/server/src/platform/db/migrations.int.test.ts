/**
 * Integration tests of the migration runner and the file-database adapter on temporary directories (removed after
 * the run): WAL and foreign keys, idempotent startup, history consistency checks, rollback of a failing migration,
 * and the write lock that `BEGIN IMMEDIATE` takes before the guard work starts (T10-F15).
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DbError, type DbErrorCode } from './errors.js';
import {
  appliedMigrations,
  defaultMigrationsDirectory,
  openMigratedDatabase,
  readMigrations,
  runMigrations,
} from './migrations.js';
import { DATABASE_FILE_NAME, openDatabase, type SqliteDatabase } from './sqlite.js';

let root: string;
let counter = 0;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'edr-t18-migrations-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A fresh empty directory under the temporary root. */
function freshDir(label: string): string {
  counter += 1;
  const dir = path.join(root, `${label}-${counter}`);
  mkdirSync(dir);
  return dir;
}

/** Writes migration files into a fresh directory. */
function migrationDir(files: Record<string, string>): string {
  const dir = freshDir('migrations');
  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), sql);
  }
  return dir;
}

function openFresh(): SqliteDatabase {
  return openDatabase({ location: path.join(freshDir('data'), DATABASE_FILE_NAME) });
}

function failureOf(action: () => unknown): DbError {
  try {
    action();
  } catch (error) {
    if (error instanceof DbError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a DbError');
}

function expectCode(action: () => unknown, code: DbErrorCode): DbError {
  const error = failureOf(action);
  expect(error.code).toBe(code);
  // Messages name migration files only, never the absolute directory (T10-F10).
  expect(error.message).not.toContain(root);
  return error;
}

function tableExists(db: SqliteDatabase, name: string): boolean {
  return (
    db.prepare("SELECT 1 AS present FROM sqlite_schema WHERE type = 'table' AND name = ?").get([name]) !== undefined
  );
}

const FIXED_NOW = new Date('2026-10-27T16:32:21.123Z');

describe('committed migrations', () => {
  it('are found next to the server package and numbered without gaps', () => {
    const directory = defaultMigrationsDirectory();
    expect(path.basename(directory)).toBe('migrations');
    expect(path.basename(path.dirname(directory))).toBe('server');
    const files = readMigrations(directory);
    expect(files[0]).toMatchObject({ version: 1, name: 'initial', fileName: '0001_initial.sql' });
  });

  it('apply to a new file database in WAL mode with foreign keys, once', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const first = openMigratedDatabase({ location, now: () => FIXED_NOW });
    try {
      expect(first.report).toEqual({ applied: [{ version: 1, name: 'initial' }], currentVersion: 1 });
      expect(first.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
      expect(first.db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
      expect(appliedMigrations(first.db)).toEqual([
        { version: 1, name: 'initial', appliedAt: '2026-10-27T16:32:21.123Z' },
      ]);
      expect(runMigrations(first.db)).toEqual({ applied: [], currentVersion: 1 });
    } finally {
      first.db.close();
    }

    const second = openMigratedDatabase({ location });
    try {
      expect(second.report).toEqual({ applied: [], currentVersion: 1 });
      expect(tableExists(second.db, 'facts')).toBe(true);
    } finally {
      second.db.close();
    }
  });
});

describe('migration files', () => {
  it('ignore non-SQL files and sort by version', () => {
    const dir = migrationDir({
      '0002_second.sql': 'CREATE TABLE b (id TEXT PRIMARY KEY) STRICT;',
      '0001_first.sql': 'CREATE TABLE a (id TEXT PRIMARY KEY) STRICT;',
      'README.txt': 'not a migration',
    });
    expect(readMigrations(dir).map((file) => file.fileName)).toEqual(['0001_first.sql', '0002_second.sql']);
  });

  it('refuse a SQL file with an invalid name', () => {
    const dir = migrationDir({ '0001_first.sql': '', '2_second.sql': '' });
    expectCode(() => readMigrations(dir), 'migration_file_name_invalid');
    expectCode(() => readMigrations(migrationDir({ '0001_First.sql': '' })), 'migration_file_name_invalid');
  });

  it('refuse duplicate versions and gaps', () => {
    expectCode(
      () => readMigrations(migrationDir({ '0001_a.sql': '', '0001_b.sql': '' })),
      'migration_version_duplicate',
    );
    expectCode(() => readMigrations(migrationDir({ '0001_a.sql': '', '0003_c.sql': '' })), 'migration_sequence_gap');
    expectCode(() => readMigrations(migrationDir({ '0002_b.sql': '' })), 'migration_sequence_gap');
  });

  it('refuse an unreadable directory', () => {
    expectCode(() => readMigrations(path.join(root, 'does-not-exist')), 'migration_directory_unreadable');
  });
});

describe('runMigrations', () => {
  const FIRST = 'CREATE TABLE a (id TEXT PRIMARY KEY) STRICT;';
  const SECOND = 'CREATE TABLE b (id TEXT PRIMARY KEY, a_id TEXT NOT NULL REFERENCES a) STRICT;';

  it('applies pending migrations in order and records each one', () => {
    const db = openFresh();
    try {
      expect(runMigrations(db, { directory: migrationDir({ '0001_first.sql': FIRST }) }).applied).toEqual([
        { version: 1, name: 'first' },
      ]);
      const report = runMigrations(db, {
        directory: migrationDir({ '0001_first.sql': FIRST, '0002_second.sql': SECOND }),
      });
      expect(report).toEqual({ applied: [{ version: 2, name: 'second' }], currentVersion: 2 });
      expect(appliedMigrations(db).map((record) => record.version)).toEqual([1, 2]);
    } finally {
      db.close();
    }
  });

  it('rolls back a failing migration and keeps the earlier ones', () => {
    const db = openFresh();
    try {
      const dir = migrationDir({
        '0001_first.sql': FIRST,
        '0002_broken.sql': 'CREATE TABLE b (id TEXT PRIMARY KEY) STRICT; INSERT INTO missing_table VALUES (1);',
      });
      const error = expectCode(() => runMigrations(db, { directory: dir }), 'migration_failed');
      expect(error.message).toContain('0002_broken.sql');
      expect(tableExists(db, 'a')).toBe(true);
      expect(tableExists(db, 'b')).toBe(false);
      expect(appliedMigrations(db).map((record) => record.version)).toEqual([1]);
      expect(db.inTransaction).toBe(false);
    } finally {
      db.close();
    }
  });

  it('refuses a migration that leaves foreign-key violations', () => {
    const db = openFresh();
    try {
      const dir = migrationDir({
        '0001_first.sql': `${FIRST}\n${SECOND}`,
        '0002_orphan.sql': "PRAGMA defer_foreign_keys = ON; INSERT INTO b (id, a_id) VALUES ('b1', 'missing');",
      });
      expectCode(() => runMigrations(db, { directory: dir }), 'foreign_key_violation');
      expect(db.prepare<{ n: number }>('SELECT count(*) AS n FROM b').get()).toEqual({ n: 0 });
      expect(appliedMigrations(db).map((record) => record.version)).toEqual([1]);
    } finally {
      db.close();
    }
  });

  it('refuses a migration that ends the transaction', () => {
    const db = openFresh();
    try {
      const dir = migrationDir({ '0001_commit.sql': `${FIRST} COMMIT;` });
      expectCode(() => runMigrations(db, { directory: dir }), 'migration_left_transaction');
      expect(appliedMigrations(db)).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('refuses a migration that opens its own transaction', () => {
    const db = openFresh();
    try {
      const dir = migrationDir({ '0001_begin.sql': `BEGIN; ${FIRST}` });
      expectCode(() => runMigrations(db, { directory: dir }), 'migration_failed');
      expect(tableExists(db, 'a')).toBe(false);
    } finally {
      db.close();
    }
  });

  it('refuses a database that has a migration this build does not know', () => {
    const db = openFresh();
    try {
      runMigrations(db, { directory: migrationDir({ '0001_first.sql': FIRST, '0002_second.sql': SECOND }) });
      expectCode(
        () => runMigrations(db, { directory: migrationDir({ '0001_first.sql': FIRST }) }),
        'migration_unknown_applied',
      );
    } finally {
      db.close();
    }
  });

  it('refuses an applied migration recorded under another name', () => {
    const db = openFresh();
    try {
      runMigrations(db, { directory: migrationDir({ '0001_first.sql': FIRST }) });
      expectCode(
        () => runMigrations(db, { directory: migrationDir({ '0001_renamed.sql': FIRST }) }),
        'migration_name_mismatch',
      );
    } finally {
      db.close();
    }
  });

  it('refuses a pending migration below the latest applied version', () => {
    const db = openFresh();
    try {
      runMigrations(db, { directory: migrationDir({ '0001_first.sql': FIRST }) });
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run([
        3,
        'third',
        FIXED_NOW.toISOString(),
      ]);
      const dir = migrationDir({
        '0001_first.sql': FIRST,
        '0002_second.sql': SECOND,
        '0003_third.sql': 'CREATE TABLE c (id TEXT PRIMARY KEY) STRICT;',
      });
      expectCode(() => runMigrations(db, { directory: dir }), 'migration_out_of_order');
    } finally {
      db.close();
    }
  });

  it('closes the connection when opening a migrated database fails', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const dir = migrationDir({ '0001_broken.sql': 'NOT SQL;' });
    expectCode(() => openMigratedDatabase({ location, directory: dir }), 'migration_failed');
    expect(existsSync(location)).toBe(true);
    // The file is not held by a lingering connection: a new connection can take the write lock at once.
    const db = openDatabase({ location, busyTimeoutMs: 0 });
    try {
      expect(db.transaction(() => 'locked')).toBe('locked');
    } finally {
      db.close();
    }
  });
});

describe('BEGIN IMMEDIATE on a file database (T10-F15)', () => {
  it('takes the write lock before the work runs, so a second writer cannot interleave', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db: first } = openMigratedDatabase({ location });
    const second = openDatabase({ location, busyTimeoutMs: 0 });
    try {
      const insertBrandAsset = (db: SqliteDatabase, id: string): void => {
        db.prepare(
          'INSERT INTO brand_assets (id, kind, label, mime, file_path, sha256, width, height, active, registered_at) ' +
            "VALUES (?, 'brand_logo', 'Logo', 'image/png', ?, ?, 10, 10, 1, ?)",
        ).run([id, `brand-assets/${id}.png`, id.padEnd(64, '0'), FIXED_NOW.toISOString()]);
      };

      first.transaction(() => {
        // The guard of the first connection has not written anything yet, but it already holds the write lock.
        expect(() => second.transaction(() => insertBrandAsset(second, 'b'))).toThrow(/locked|busy/i);
        expect(second.inTransaction).toBe(false);
        // Readers are not blocked (WAL).
        expect(second.prepare<{ n: number }>('SELECT count(*) AS n FROM brand_assets').get()).toEqual({ n: 0 });
        insertBrandAsset(first, 'a');
      });

      second.transaction(() => insertBrandAsset(second, 'b'));
      expect(first.prepare<{ id: string }>('SELECT id FROM brand_assets ORDER BY id').all()).toEqual([
        { id: 'a' },
        { id: 'b' },
      ]);
    } finally {
      second.close();
      first.close();
    }
  });
});
