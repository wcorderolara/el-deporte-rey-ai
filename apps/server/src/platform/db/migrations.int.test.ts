/**
 * Integration tests of the migration runner and the file-database adapter on temporary directories (removed after
 * the run): WAL and foreign keys, idempotent startup, history consistency checks, rollback of a failing migration,
 * the write lock that `BEGIN IMMEDIATE` takes before the guard work starts (T10-F15), and the upgrade of a database
 * at version 1 by migration `0002_qa_capitalized_tokens.sql` (OD-56) with its `qa_results` rows preserved.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { constraintKind, DbError, type DbErrorCode } from './errors.js';
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

/** The committed migrations, in order (data-model.md section 2). */
const COMMITTED = [
  { version: 1, name: 'initial' },
  { version: 2, name: 'qa_capitalized_tokens' },
];

describe('committed migrations', () => {
  it('are found next to the server package and numbered without gaps', () => {
    const directory = defaultMigrationsDirectory();
    expect(path.basename(directory)).toBe('migrations');
    expect(path.basename(path.dirname(directory))).toBe('server');
    const files = readMigrations(directory);
    expect(files.map(({ version, name, fileName }) => ({ version, name, fileName }))).toEqual([
      { version: 1, name: 'initial', fileName: '0001_initial.sql' },
      { version: 2, name: 'qa_capitalized_tokens', fileName: '0002_qa_capitalized_tokens.sql' },
    ]);
  });

  it('apply to a new file database in WAL mode with foreign keys, once', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const first = openMigratedDatabase({ location, now: () => FIXED_NOW });
    try {
      expect(first.report).toEqual({ applied: COMMITTED, currentVersion: 2 });
      expect(first.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
      expect(first.db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
      expect(appliedMigrations(first.db)).toEqual(
        COMMITTED.map((record) => ({ ...record, appliedAt: '2026-10-27T16:32:21.123Z' })),
      );
      expect(runMigrations(first.db)).toEqual({ applied: [], currentVersion: 2 });
    } finally {
      first.db.close();
    }

    const second = openMigratedDatabase({ location });
    try {
      expect(second.report).toEqual({ applied: [], currentVersion: 2 });
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

/**
 * Synthetic team-level rows of a database at version 1: one project, run, draft, carousel, two elements with one
 * version each, and `qa_results` rows of the five check names that 0001 accepts. The details texts keep non-ASCII
 * characters and irregular JSON spacing so that a byte change would show.
 */
const SEED_VERSION_1 = `
INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, publication_permission,
  adapter, first_seen_at, last_seen_at)
VALUES ('demo-a', 'Synthetic source', 'DEMO_DATA', 'primary', 1, 1, 'group-a', 'not_applicable', 'fixture',
  '2026-10-27T16:32:21.123Z', '2026-10-27T16:32:21.123Z');
INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, stage_id,
  stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'demo-a-league', 'Liga Sintética', 'demo-a', 'DEMO_DATA', '2026',
  '2026', 'regular', 'Temporada Regular', 3, '{"stage":"regular","matchday":3}', 'expected', 'es',
  '2026-10-27T16:32:21.123Z', '2026-10-27T16:32:21.123Z');
INSERT INTO workflow_runs (id, project_id, run_number, kind, base_run_id, status, failure, config_snapshot,
  standings_availability, started_at, finished_at)
VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 1, 'full', NULL,
  'completed', NULL, '{"sources":[]}', NULL, '2026-10-27T16:32:21.123Z', '2026-10-27T16:33:21.123Z');
INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, excluded_match_keys,
  left_out_matches, created_at, superseded_at)
VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'es', 0, '[]', '[]',
  '2026-10-27T16:32:21.123Z', NULL);
INSERT INTO carousels (id, draft_id, sequence, total)
VALUES ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 1, 1);
INSERT INTO elements (id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id)
VALUES ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'slide', 1, 'cover',
  'cover', '{}', NULL),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004', 'caption', 0, NULL, 'caption',
  '{}', NULL);
INSERT INTO element_versions (id, element_id, version_number, origin, text, content_flags, ai_adapter, template_id,
  template_version, render_model, image_path, image_sha256, width, height, qa_status, created_at, superseded_at)
VALUES ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000005', 1, 'generated',
  '{"fields":[]}', '[]', 'stub', 'cover', '1', '{}', NULL, NULL, 1080, 1350, 'warnings', '2026-10-27T16:32:21.123Z',
  NULL),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000006', 1, 'generated',
  '{"fields":[]}', '[]', 'stub', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', '2026-10-27T16:32:21.123Z',
  NULL);
INSERT INTO qa_results (id, element_version_id, check_name, outcome, severity, details, acknowledged_at, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000007', 'data_match', 'pass', 'blocking',
  '{"mismatches":[]}', NULL, '2026-10-27T16:34:21.123Z'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000007', 'team_names', 'pass', 'blocking',
  '{"mismatches":[{"elementId":"headline","expected":"Atlético Río Ébano","actual":"Atlético Río Ébano"}]}', NULL,
  '2026-10-27T16:34:21.123Z'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000007', 'text_fit', 'pass', 'blocking',
  '{ "overflows" : [ ] }', NULL, '2026-10-27T16:34:21.123Z'),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000007', 'style_consistency', 'fail',
  'warning', '{"colors":["#ABCDEF"],"note":"ñ ü ß 日本"}', '2026-10-27T16:40:00.000Z', '2026-10-27T16:34:21.123Z'),
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000007', 'dimensions', 'pass', 'blocking',
  '{"expectedWidth":1080,"expectedHeight":1350,"actualWidth":1080,"actualHeight":1350}', NULL,
  '2026-10-27T16:34:21.123Z');
`;

/** Every `qa_results` value as its storage type and the hex of its bytes, in ID order. */
const QA_RESULT_BYTES =
  "SELECT typeof(id) || ':' || hex(id) AS id, " +
  "typeof(element_version_id) || ':' || hex(element_version_id) AS element_version_id, " +
  "typeof(check_name) || ':' || hex(check_name) AS check_name, typeof(outcome) || ':' || hex(outcome) AS outcome, " +
  "typeof(severity) || ':' || hex(severity) AS severity, typeof(details) || ':' || hex(details) AS details, " +
  "typeof(acknowledged_at) || ':' || hex(acknowledged_at) AS acknowledged_at, " +
  "typeof(created_at) || ':' || hex(created_at) AS created_at FROM qa_results ORDER BY id";

const QA_RESULTS_DDL = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'qa_results'";

interface QaStructure {
  readonly columns: unknown[];
  readonly foreignKeys: unknown[];
  readonly indexes: unknown[];
  readonly strict: unknown;
}

/** Columns, foreign keys, automatic indexes (with their columns) and STRICT flag of `qa_results`. */
function qaStructure(db: SqliteDatabase): QaStructure {
  const indexes = db
    .prepare<{ name: string; unique: number; origin: string; partial: number }>(
      'SELECT name, "unique", origin, partial FROM pragma_index_list(\'qa_results\') ORDER BY name',
    )
    .all()
    .map((index) => ({
      ...index,
      columns: db
        .prepare<{ name: string }>('SELECT name FROM pragma_index_info(?) ORDER BY seqno')
        .all([index.name])
        .map((column) => column.name),
    }));
  return {
    columns: db
      .prepare('SELECT cid, name, type, "notnull", dflt_value, pk FROM pragma_table_info(\'qa_results\') ORDER BY cid')
      .all(),
    foreignKeys: db
      .prepare(
        'SELECT "table", "from", "to", on_update, on_delete, "match" FROM pragma_foreign_key_list(\'qa_results\')',
      )
      .all(),
    indexes,
    strict: db.prepare("SELECT strict FROM pragma_table_list WHERE schema = 'main' AND name = 'qa_results'").get(),
  };
}

/** The table definition with whitespace normalized and the name unquoted (SQLite quotes it after a rename). */
function normalizedDdl(db: SqliteDatabase): string {
  const row = db.prepare<{ sql: string }>(QA_RESULTS_DDL).get();
  return (row?.sql ?? '')
    .replace('CREATE TABLE "qa_results"', 'CREATE TABLE qa_results')
    .replace(/\s+/g, ' ')
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')');
}

function insertQaResult(db: SqliteDatabase, id: string, versionId: string, checkName: string, outcome = 'fail'): void {
  db.prepare(
    'INSERT INTO qa_results (id, element_version_id, check_name, outcome, severity, details, acknowledged_at, ' +
      "created_at) VALUES (?, ?, ?, ?, 'warning', '{\"tokens\":[\"Ezequiel\"]}', NULL, '2026-10-28T09:00:00.000Z')",
  ).run([id, versionId, checkName, outcome]);
}

function refusal(action: () => void): string | null {
  try {
    action();
  } catch (error) {
    return constraintKind(error);
  }
  return 'accepted';
}

describe('migration 0002_qa_capitalized_tokens.sql upgrades a database at version 1 (OD-56)', () => {
  const VERSION = '00000000-0000-4000-8000-000000000007';
  const CAPTION_VERSION = '00000000-0000-4000-8000-000000000008';

  it('rebuilds qa_results with capitalized_tokens and keeps every existing row byte for byte', () => {
    const committed = defaultMigrationsDirectory();
    const onlyFirst = migrationDir({
      '0001_initial.sql': readFileSync(path.join(committed, '0001_initial.sql'), 'utf8'),
    });
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db, report } = openMigratedDatabase({ location, directory: onlyFirst });
    try {
      expect(report).toEqual({ applied: [{ version: 1, name: 'initial' }], currentVersion: 1 });
      db.transaction(() => db.execScript(SEED_VERSION_1));
      // Version 1 refuses the sixth check name.
      expect(refusal(() => insertQaResult(db, 'before', CAPTION_VERSION, 'capitalized_tokens'))).toBe('check');

      const bytesBefore = db.prepare(QA_RESULT_BYTES).all();
      const rowsBefore = db.prepare('SELECT * FROM qa_results ORDER BY id').all();
      const structureBefore = qaStructure(db);
      const ddlBefore = normalizedDdl(db);
      expect(bytesBefore).toHaveLength(5);

      expect(runMigrations(db, { now: () => FIXED_NOW })).toEqual({
        applied: [{ version: 2, name: 'qa_capitalized_tokens' }],
        currentVersion: 2,
      });

      expect(db.prepare(QA_RESULT_BYTES).all()).toEqual(bytesBefore);
      expect(db.prepare('SELECT * FROM qa_results ORDER BY id').all()).toEqual(rowsBefore);
      // Every column, type, foreign key, automatic index (PRIMARY KEY, UNIQUE) and STRICT are unchanged.
      expect(qaStructure(db)).toEqual(structureBefore);
      expect(structureBefore.indexes).toEqual([
        { name: 'sqlite_autoindex_qa_results_1', unique: 1, origin: 'pk', partial: 0, columns: ['id'] },
        {
          name: 'sqlite_autoindex_qa_results_2',
          unique: 1,
          origin: 'u',
          partial: 0,
          columns: ['element_version_id', 'check_name'],
        },
      ]);
      expect(structureBefore.strict).toEqual({ strict: 1 });
      // The definition differs from 0001 only by the sixth name of the check-name list.
      expect(normalizedDdl(db)).toBe(ddlBefore.replace("'dimensions')", "'dimensions', 'capitalized_tokens')"));
      expect(
        db
          .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'qa_results_next%' OR tbl_name = 'qa_results_next'")
          .all(),
      ).toEqual([]);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(db.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
      expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    } finally {
      db.close();
    }

    // Reopening applies nothing more.
    const reopened = openMigratedDatabase({ location });
    try {
      expect(reopened.report).toEqual({ applied: [], currentVersion: 2 });
    } finally {
      reopened.db.close();
    }
  });

  it('accepts capitalized_tokens afterwards and still refuses an unknown name, a duplicate and an unknown version', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const onlyFirst = migrationDir({
      '0001_initial.sql': readFileSync(path.join(defaultMigrationsDirectory(), '0001_initial.sql'), 'utf8'),
    });
    const { db } = openMigratedDatabase({ location, directory: onlyFirst });
    try {
      db.transaction(() => db.execScript(SEED_VERSION_1));
      runMigrations(db);
      expect(refusal(() => insertQaResult(db, 'cap-1', CAPTION_VERSION, 'capitalized_tokens'))).toBe('accepted');
      expect(refusal(() => insertQaResult(db, 'cap-2', VERSION, 'capitalized_tokens', 'pass'))).toBe('accepted');
      expect(refusal(() => insertQaResult(db, 'unknown', VERSION, 'unknown_check'))).toBe('check');
      expect(refusal(() => insertQaResult(db, 'upper', VERSION, 'CAPITALIZED_TOKENS'))).toBe('check');
      expect(refusal(() => insertQaResult(db, 'outcome', CAPTION_VERSION, 'data_match', 'maybe'))).toBe('check');
      expect(refusal(() => insertQaResult(db, 'duplicate', CAPTION_VERSION, 'capitalized_tokens'))).toBe('unique');
      expect(refusal(() => insertQaResult(db, 'orphan', '00000000-0000-4000-8000-0000000fffff', 'data_match'))).toBe(
        'foreign_key',
      );
      expect(
        db.prepare<{ n: number }>("SELECT count(*) AS n FROM qa_results WHERE check_name = 'capitalized_tokens'").get(),
      ).toEqual({ n: 2 });
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
