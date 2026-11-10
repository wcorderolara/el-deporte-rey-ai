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
  { version: 3, name: 'competitions' },
  { version: 4, name: 'seasons_and_participants' },
  { version: 5, name: 'calendar_and_results' },
  { version: 6, name: 'match_results' },
  { version: 7, name: 'competition_teams' },
  { version: 8, name: 'independent_match_state_and_scores' },
  { version: 9, name: 'provider_competition_bindings' },
  { version: 10, name: 'provider_binding_display_names' },
  { version: 11, name: 'competition_import_previews' },
  { version: 12, name: 'import_preview_operations' },
  { version: 13, name: 'confirmed_competition_imports' },
  { version: 14, name: 'import_application_operations' },
  { version: 15, name: 'competition_scoped_identity_uniqueness' },
  { version: 16, name: 'sports_field_provenance' },
  { version: 17, name: 'content_generation_batches' },
  { version: 18, name: 'content_generation_batches_reconcile' },
  { version: 19, name: 'operator_validated_approvals' },
  { version: 20, name: 'project_deletion' },
  { version: 21, name: 'project_content_kind' },
  { version: 22, name: 'unplayed_slide_types' },
  { version: 23, name: 'content_kinds_reconcile' },
  { version: 24, name: 'brand_asset_library' },
  { version: 25, name: 'design_proposals' },
  { version: 26, name: 'design_proposal_layers' },
  { version: 27, name: 'design_generation_modes' },
  { version: 28, name: 'design_decision_notes' },
  { version: 29, name: 'visual_templates' },
  { version: 30, name: 'team_badges_and_project_templates' },
  { version: 31, name: 'reconcile_field_provenance_references' },
  { version: 32, name: 'engine_slide_type_templates' },
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
      { version: 3, name: 'competitions', fileName: '0003_competitions.sql' },
      { version: 4, name: 'seasons_and_participants', fileName: '0004_seasons_and_participants.sql' },
      { version: 5, name: 'calendar_and_results', fileName: '0005_calendar_and_results.sql' },
      { version: 6, name: 'match_results', fileName: '0006_match_results.sql' },
      { version: 7, name: 'competition_teams', fileName: '0007_competition_teams.sql' },
      {
        version: 8,
        name: 'independent_match_state_and_scores',
        fileName: '0008_independent_match_state_and_scores.sql',
      },
      { version: 9, name: 'provider_competition_bindings', fileName: '0009_provider_competition_bindings.sql' },
      { version: 10, name: 'provider_binding_display_names', fileName: '0010_provider_binding_display_names.sql' },
      { version: 11, name: 'competition_import_previews', fileName: '0011_competition_import_previews.sql' },
      { version: 12, name: 'import_preview_operations', fileName: '0012_import_preview_operations.sql' },
      { version: 13, name: 'confirmed_competition_imports', fileName: '0013_confirmed_competition_imports.sql' },
      { version: 14, name: 'import_application_operations', fileName: '0014_import_application_operations.sql' },
      {
        version: 15,
        name: 'competition_scoped_identity_uniqueness',
        fileName: '0015_competition_scoped_identity_uniqueness.sql',
      },
      { version: 16, name: 'sports_field_provenance', fileName: '0016_sports_field_provenance.sql' },
      { version: 17, name: 'content_generation_batches', fileName: '0017_content_generation_batches.sql' },
      {
        version: 18,
        name: 'content_generation_batches_reconcile',
        fileName: '0018_content_generation_batches_reconcile.sql',
      },
      { version: 19, name: 'operator_validated_approvals', fileName: '0019_operator_validated_approvals.sql' },
      { version: 20, name: 'project_deletion', fileName: '0020_project_deletion.sql' },
      { version: 21, name: 'project_content_kind', fileName: '0021_project_content_kind.sql' },
      { version: 22, name: 'unplayed_slide_types', fileName: '0022_unplayed_slide_types.sql' },
      { version: 23, name: 'content_kinds_reconcile', fileName: '0023_content_kinds_reconcile.sql' },
      { version: 24, name: 'brand_asset_library', fileName: '0024_brand_asset_library.sql' },
      { version: 25, name: 'design_proposals', fileName: '0025_design_proposals.sql' },
      { version: 26, name: 'design_proposal_layers', fileName: '0026_design_proposal_layers.sql' },
      { version: 27, name: 'design_generation_modes', fileName: '0027_design_generation_modes.sql' },
      { version: 28, name: 'design_decision_notes', fileName: '0028_design_decision_notes.sql' },
      { version: 29, name: 'visual_templates', fileName: '0029_visual_templates.sql' },
      {
        version: 30,
        name: 'team_badges_and_project_templates',
        fileName: '0030_team_badges_and_project_templates.sql',
      },
      {
        version: 31,
        name: 'reconcile_field_provenance_references',
        fileName: '0031_reconcile_field_provenance_references.sql',
      },
      { version: 32, name: 'engine_slide_type_templates', fileName: '0032_engine_slide_type_templates.sql' },
    ]);
  });

  it('adds display names to an existing provider-binding database and preserves its binding history', () => {
    const committed = defaultMigrationsDirectory();
    const throughNine = migrationDir(
      Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 9)
          .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
      ),
    );
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db } = openMigratedDatabase({ location, directory: throughNine });
    try {
      expect(() =>
        db.prepare(
          `INSERT INTO competition_provider_bindings
            (id, competition_id, provider_key, provider_name, source_id, external_competition_id, external_competition_name, mode, status, linked_at, created_at, updated_at)
            VALUES ('bad', 'missing', 'sample-provider', 'Sample', 'sample-provider', 'league-1', 'League', 'provider', 'active', ?, ?, ?)`,
        ),
      ).toThrow(/table competition_provider_bindings has no column named provider_name/i);

      db.prepare('INSERT INTO competitions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run([
        'c1',
        'Liga',
        FIXED_NOW.toISOString(),
        FIXED_NOW.toISOString(),
      ]);
      const externalId = 'x'.repeat(120);
      db.prepare(
        `INSERT INTO competition_provider_bindings
          (id, competition_id, provider_key, source_id, external_competition_id, mode, status, linked_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run([
        'b1',
        'c1',
        'sample-provider',
        'sample-provider',
        externalId,
        'provider',
        'active',
        FIXED_NOW.toISOString(),
        FIXED_NOW.toISOString(),
        FIXED_NOW.toISOString(),
      ]);

      expect(runMigrations(db)).toEqual({
        applied: [
          { version: 10, name: 'provider_binding_display_names' },
          { version: 11, name: 'competition_import_previews' },
          { version: 12, name: 'import_preview_operations' },
          { version: 13, name: 'confirmed_competition_imports' },
          { version: 14, name: 'import_application_operations' },
          { version: 15, name: 'competition_scoped_identity_uniqueness' },
          { version: 16, name: 'sports_field_provenance' },
          { version: 17, name: 'content_generation_batches' },
          { version: 18, name: 'content_generation_batches_reconcile' },
          { version: 19, name: 'operator_validated_approvals' },
          { version: 20, name: 'project_deletion' },
          { version: 21, name: 'project_content_kind' },
          { version: 22, name: 'unplayed_slide_types' },
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });
      expect(
        db
          .prepare('SELECT id, provider_name, external_competition_name, status FROM competition_provider_bindings')
          .get(),
      ).toEqual({
        id: 'b1',
        provider_name: 'sample-provider',
        external_competition_name: 'Competición externa',
        status: 'active',
      });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('adds content generation batches to a database at 0016 without changing any existing row (PD-ARCH-01E-A)', () => {
    const committed = defaultMigrationsDirectory();
    const throughSixteen = migrationDir(
      Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 16)
          .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
      ),
    );
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db } = openMigratedDatabase({ location, directory: throughSixteen });
    try {
      const at = FIXED_NOW.toISOString();
      db.prepare('INSERT INTO competitions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run([
        'c1',
        'Liga',
        at,
        at,
      ]);
      db.prepare(
        'INSERT INTO competition_seasons (id, competition_id, label, normalized_label, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(['s1', 'c1', '2026/27', '2026/27', at]);
      const snapshot = (): unknown[] => [
        db.prepare('SELECT * FROM competitions').all(),
        db.prepare('SELECT * FROM competition_seasons').all(),
      ];
      const before = JSON.stringify(snapshot());
      expect(tableExists(db, 'content_generation_batches')).toBe(false);

      expect(runMigrations(db)).toEqual({
        applied: [
          { version: 17, name: 'content_generation_batches' },
          { version: 18, name: 'content_generation_batches_reconcile' },
          { version: 19, name: 'operator_validated_approvals' },
          { version: 20, name: 'project_deletion' },
          { version: 21, name: 'project_content_kind' },
          { version: 22, name: 'unplayed_slide_types' },
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });
      expect(JSON.stringify(snapshot())).toBe(before);
      for (const table of [
        'content_generation_batches',
        'content_generation_items',
        'content_generation_item_matches',
      ]) {
        expect(tableExists(db, table)).toBe(true);
      }
      expect(db.prepare('SELECT COUNT(*) AS n FROM content_generation_batches').get()).toEqual({ n: 0 });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it('reconciles a database that applied the draft 0017 tables, and refuses to drop rows (PD-ARCH-01E-A)', () => {
    const committed = defaultMigrationsDirectory();
    const draft17 = `CREATE TABLE content_generation_batches (id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE) STRICT;
CREATE INDEX idx_content_generation_batches_competition ON content_generation_batches (request_key);
CREATE TABLE content_generation_items (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL) STRICT;
CREATE TABLE content_generation_item_matches (item_id TEXT NOT NULL, match_id TEXT NOT NULL) STRICT;
CREATE INDEX idx_content_generation_item_matches_match ON content_generation_item_matches (match_id);`;
    const withDraft = (): string =>
      migrationDir({
        ...Object.fromEntries(
          readMigrations(committed)
            .filter(({ version }) => version <= 16)
            .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
        ),
        '0017_content_generation_batches.sql': draft17,
      });
    const columns = (db: SqliteDatabase): string[] =>
      db
        .prepare<{ name: string }>("SELECT name FROM pragma_table_info('content_generation_batches')")
        .all()
        .map((row) => row.name);

    const empty = openMigratedDatabase({
      location: path.join(freshDir('data'), DATABASE_FILE_NAME),
      directory: withDraft(),
    });
    try {
      expect(columns(empty.db)).toEqual(['id', 'request_key']);
      expect(runMigrations(empty.db)).toEqual({
        applied: [
          { version: 18, name: 'content_generation_batches_reconcile' },
          { version: 19, name: 'operator_validated_approvals' },
          { version: 20, name: 'project_deletion' },
          { version: 21, name: 'project_content_kind' },
          { version: 22, name: 'unplayed_slide_types' },
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });
      expect(columns(empty.db)).toContain('import_id');
      expect(empty.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      empty.db.close();
    }

    const used = openMigratedDatabase({
      location: path.join(freshDir('data'), DATABASE_FILE_NAME),
      directory: withDraft(),
    });
    try {
      used.db.prepare("INSERT INTO content_generation_batches (id, request_key) VALUES ('b1', 'k1')").run();
      expect(() => runMigrations(used.db)).toThrow();
      expect(columns(used.db)).toEqual(['id', 'request_key']);
      expect(used.db.prepare('SELECT id FROM content_generation_batches').all()).toEqual([{ id: 'b1' }]);
    } finally {
      used.db.close();
    }
  });

  it('reconciles a database that applied the draft 0021 and keeps every content generation row (PD-ARCH-01E-B)', () => {
    const committed = defaultMigrationsDirectory();
    const draft21 = `ALTER TABLE projects ADD COLUMN content_kind TEXT NOT NULL DEFAULT 'results'
  CHECK (content_kind IN ('results', 'calendar', 'upcoming', 'preview'));`;
    const withDraft = migrationDir({
      ...Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 22 && version !== 21)
          .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
      ),
      '0021_project_content_kind.sql': draft21,
    });
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const draft = openMigratedDatabase({ location, directory: withDraft });
    const at = FIXED_NOW.toISOString();
    const item = (id: string, position: number, kind: string, reason: string): void => {
      draft.db
        .prepare(
          'INSERT INTO content_generation_items (id, batch_id, position, kind, title, skip_reason) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run([id, 'b1', position, kind, 'Pieza sintética', reason]);
    };
    let before: string;
    try {
      expect(draft.report.currentVersion).toBe(22);
      draft.db.execScript(`
INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, publication_permission,
  adapter, first_seen_at, last_seen_at)
VALUES ('local-a', 'Synthetic local source', 'MANUAL_DATA', 'primary', 0, 0, 'group-a', 'not_applicable', 'manual',
  '${at}', '${at}');
INSERT INTO competitions (id, name, created_at, updated_at) VALUES ('c1', 'Liga', '${at}', '${at}');
INSERT INTO competition_seasons (id, competition_id, label, normalized_label, created_at)
VALUES ('s1', 'c1', '2026/27', '2026/27', '${at}');
INSERT INTO imports (id, source_id, channel, file_name, declared_source, competition_id, season_id, original_path,
  original_sha256, original_bytes, received_at)
VALUES ('i1', 'local-a', 'form', NULL, NULL, 'c1', 's1', 'imports/i1.json', '${'a'.repeat(64)}', 10, '${at}');
INSERT INTO content_generation_batches (id, import_id, request_key, request_hash, competition_id, competition_name,
  season_id, season_label, stage_id, stage_name, round_id, round_name, selection_label, language, created_at)
VALUES ('b1', 'i1', 'k1', '${'b'.repeat(64)}', 'c1', 'Liga', 's1', '2026/27', NULL, NULL, 'r1', 'Jornada 1',
  'Jornada 1', 'es', '${at}');`);
      item('it1', 1, 'round_results', 'no_eligible_matches');
      // The draft 0021 left the item tables refusing the piece kinds of matches not played yet.
      expect(refusal(() => item('it2', 2, 'round_calendar', 'already_finished'))).toBe('check');
      before = JSON.stringify(draft.db.prepare('SELECT rowid, * FROM content_generation_items ORDER BY rowid').all());
    } finally {
      draft.db.close();
    }

    const reconciled = openMigratedDatabase({ location, now: () => FIXED_NOW });
    try {
      expect(reconciled.report).toEqual({
        applied: [
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });
      expect(
        JSON.stringify(reconciled.db.prepare('SELECT rowid, * FROM content_generation_items ORDER BY rowid, id').all()),
      ).toBe(before);
      for (const [position, kind, reason] of [
        [2, 'round_calendar', 'already_finished'],
        [3, 'upcoming_matches', 'not_upcoming'],
        [4, 'match_preview', 'kickoff_missing'],
      ] as const) {
        reconciled.db
          .prepare(
            'INSERT INTO content_generation_items (id, batch_id, position, kind, title, skip_reason) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run([`it${String(position)}`, 'b1', position, kind, 'Pieza sintética', reason]);
      }
      expect(
        reconciled.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'content_generation_%_new'").all(),
      ).toEqual([]);
      expect(reconciled.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(reconciled.db.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
    } finally {
      reconciled.db.close();
    }
  });

  it('apply to a new file database in WAL mode with foreign keys, once', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const first = openMigratedDatabase({ location, now: () => FIXED_NOW });
    try {
      expect(first.report).toEqual({ applied: COMMITTED, currentVersion: 32 });
      expect(first.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
      expect(first.db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
      expect(appliedMigrations(first.db)).toEqual(
        COMMITTED.map((record) => ({ ...record, appliedAt: '2026-10-27T16:32:21.123Z' })),
      );
      expect(runMigrations(first.db)).toEqual({ applied: [], currentVersion: 32 });
    } finally {
      first.db.close();
    }

    const second = openMigratedDatabase({ location });
    try {
      expect(second.report).toEqual({ applied: [], currentVersion: 32 });
      expect(tableExists(second.db, 'competition_teams')).toBe(true);
      expect(tableExists(second.db, 'facts')).toBe(true);
      expect(tableExists(second.db, 'competitions')).toBe(true);
      expect(tableExists(second.db, 'competition_seasons')).toBe(true);
      expect(tableExists(second.db, 'managed_teams')).toBe(true);
      expect(tableExists(second.db, 'competition_provider_bindings')).toBe(true);
      expect(
        second.db
          .prepare<{ name: string }>('PRAGMA table_info(competition_provider_bindings)')
          .all()
          .map((column) => column.name),
      ).toContain('external_competition_name');
      expect(tableExists(second.db, 'season_participants')).toBe(true);
      expect(tableExists(second.db, 'match_results')).toBe(true);
      expect(
        second.db
          .prepare<{ name: string }>('PRAGMA table_info(match_result_history)')
          .all()
          .map((column) => column.name),
      ).toContain('stage_id');
    } finally {
      second.db.close();
    }
  });

  it('adds result storage to an already migrated 0005 database and preserves existing scores', () => {
    const committed = defaultMigrationsDirectory();
    const throughFive = migrationDir(
      Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 5)
          .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
      ),
    );
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db } = openMigratedDatabase({ location, directory: throughFive });
    try {
      db.transaction(() => {
        db.prepare('INSERT INTO competitions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run([
          'c1',
          'Liga',
          FIXED_NOW.toISOString(),
          FIXED_NOW.toISOString(),
        ]);
        db.prepare(
          'INSERT INTO competition_seasons (id, competition_id, label, normalized_label, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(['s1', 'c1', '2026/27', '2026/27', FIXED_NOW.toISOString()]);
        for (const [id, name] of [
          ['t1', 'Local'],
          ['t2', 'Visitante'],
        ] as const) {
          db.prepare(
            'INSERT INTO managed_teams (id, name, normalized_name, region, normalized_region, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',
          ).run([id, name, name.toLowerCase(), '', FIXED_NOW.toISOString(), FIXED_NOW.toISOString()]);
          db.prepare('INSERT INTO season_participants (season_id, team_id, joined_at) VALUES (?, ?, ?)').run([
            's1',
            id,
            FIXED_NOW.toISOString(),
          ]);
        }
        db.prepare(
          "INSERT INTO competition_matches (id, season_id, stage_id, round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, created_at, updated_at) VALUES ('m1', 's1', NULL, NULL, 't1', 't2', NULL, 'finished', 2, 1, ?, ?)",
        ).run([FIXED_NOW.toISOString(), FIXED_NOW.toISOString()]);
        db.prepare(
          "INSERT INTO match_result_history (id, match_id, change_type, status, home_score, away_score, kickoff_at, recorded_at) VALUES ('h1', 'm1', 'result_recorded', 'finished', 2, 1, NULL, ?)",
        ).run([FIXED_NOW.toISOString()]);
      });

      expect(runMigrations(db)).toEqual({
        applied: [
          { version: 6, name: 'match_results' },
          { version: 7, name: 'competition_teams' },
          { version: 8, name: 'independent_match_state_and_scores' },
          { version: 9, name: 'provider_competition_bindings' },
          { version: 10, name: 'provider_binding_display_names' },
          { version: 11, name: 'competition_import_previews' },
          { version: 12, name: 'import_preview_operations' },
          { version: 13, name: 'confirmed_competition_imports' },
          { version: 14, name: 'import_application_operations' },
          { version: 15, name: 'competition_scoped_identity_uniqueness' },
          { version: 16, name: 'sports_field_provenance' },
          { version: 17, name: 'content_generation_batches' },
          { version: 18, name: 'content_generation_batches_reconcile' },
          { version: 19, name: 'operator_validated_approvals' },
          { version: 20, name: 'project_deletion' },
          { version: 21, name: 'project_content_kind' },
          { version: 22, name: 'unplayed_slide_types' },
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });
      expect(db.prepare('SELECT competition_id, team_id FROM competition_teams ORDER BY team_id').all()).toEqual([
        { competition_id: 'c1', team_id: 't1' },
        { competition_id: 'c1', team_id: 't2' },
      ]);
      expect(db.prepare('SELECT match_id, home_score, away_score FROM match_results').all()).toEqual([
        { match_id: 'm1', home_score: 2, away_score: 1 },
      ]);
      expect(db.prepare('SELECT stage_id, round_id FROM match_result_history WHERE id = ?').get(['h1'])).toEqual({
        stage_id: null,
        round_id: null,
      });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      db.close();
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

describe('migrations 0021 and 0022 upgrade a database at version 20 (PD-ARCH-01E-B)', () => {
  it('adds the content kind and the unplayed slide types and keeps every existing row, rowid and reference', () => {
    const committed = defaultMigrationsDirectory();
    const throughTwenty = migrationDir(
      Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 20)
          .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
      ),
    );
    const onlyFirst = migrationDir({
      '0001_initial.sql': readFileSync(path.join(committed, '0001_initial.sql'), 'utf8'),
    });
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const first = openMigratedDatabase({ location, directory: onlyFirst });
    first.db.transaction(() => first.db.execScript(SEED_VERSION_1));
    first.db.close();
    const { db, report } = openMigratedDatabase({ location, directory: throughTwenty });
    try {
      expect(report.currentVersion).toBe(20);
      const snapshot = (): unknown[] => [
        db.prepare('SELECT rowid, * FROM elements ORDER BY rowid').all(),
        db.prepare('SELECT rowid, * FROM element_versions ORDER BY rowid').all(),
        db.prepare('SELECT * FROM qa_results ORDER BY id').all(),
        db.prepare('SELECT * FROM carousels ORDER BY id').all(),
      ];
      const before = JSON.stringify(snapshot());
      const projectBefore = db.prepare<Record<string, unknown>>('SELECT * FROM projects').all();
      // Version 20 refuses the slide types of matches not played yet.
      expect(
        refusal(() => db.prepare("UPDATE elements SET slide_type = 'fixture' WHERE slide_type = 'cover'").run([])),
      ).toBe('check');

      expect(runMigrations(db, { now: () => FIXED_NOW })).toEqual({
        applied: [
          { version: 21, name: 'project_content_kind' },
          { version: 22, name: 'unplayed_slide_types' },
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });

      expect(JSON.stringify(snapshot())).toBe(before);
      // Existing projects are results projects without a visual template (0030); every other value is unchanged.
      // A new statement text: a statement prepared before the migration keeps its former column list.
      expect(db.prepare<Record<string, unknown>>('SELECT * FROM projects ORDER BY id').all()).toEqual(
        projectBefore.map((row) => ({
          ...row,
          content_kind: 'results',
          visual_template_id: null,
          visual_template_version_id: null,
          badge_snapshot_json: null,
        })),
      );
      for (const slideType of ['round_overview', 'fixture', 'match_preview', 'cover']) {
        db.prepare("UPDATE elements SET slide_type = ? WHERE kind = 'slide'").run([slideType]);
      }
      expect(
        refusal(() => db.prepare("UPDATE elements SET slide_type = 'prediction' WHERE kind = 'slide'").run([])),
      ).toBe('check');
      for (const kind of ['calendar', 'upcoming', 'preview', 'results']) {
        db.prepare('UPDATE projects SET content_kind = ?').run([kind]);
      }
      expect(refusal(() => db.prepare("UPDATE projects SET content_kind = 'betting'").run([]))).toBe('check');
      expect(
        db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%_rebuild' OR name LIKE '%_new'").all(),
      ).toEqual([]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'idx_elements_carousel'").all()).toHaveLength(1);
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(db.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
    } finally {
      db.close();
    }
  });
});

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
        applied: [
          { version: 2, name: 'qa_capitalized_tokens' },
          { version: 3, name: 'competitions' },
          { version: 4, name: 'seasons_and_participants' },
          { version: 5, name: 'calendar_and_results' },
          { version: 6, name: 'match_results' },
          { version: 7, name: 'competition_teams' },
          { version: 8, name: 'independent_match_state_and_scores' },
          { version: 9, name: 'provider_competition_bindings' },
          { version: 10, name: 'provider_binding_display_names' },
          { version: 11, name: 'competition_import_previews' },
          { version: 12, name: 'import_preview_operations' },
          { version: 13, name: 'confirmed_competition_imports' },
          { version: 14, name: 'import_application_operations' },
          { version: 15, name: 'competition_scoped_identity_uniqueness' },
          { version: 16, name: 'sports_field_provenance' },
          { version: 17, name: 'content_generation_batches' },
          { version: 18, name: 'content_generation_batches_reconcile' },
          { version: 19, name: 'operator_validated_approvals' },
          { version: 20, name: 'project_deletion' },
          { version: 21, name: 'project_content_kind' },
          { version: 22, name: 'unplayed_slide_types' },
          { version: 23, name: 'content_kinds_reconcile' },
          { version: 24, name: 'brand_asset_library' },
          { version: 25, name: 'design_proposals' },
          { version: 26, name: 'design_proposal_layers' },
          { version: 27, name: 'design_generation_modes' },
          { version: 28, name: 'design_decision_notes' },
          { version: 29, name: 'visual_templates' },
          { version: 30, name: 'team_badges_and_project_templates' },
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
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
      expect(reopened.report).toEqual({ applied: [], currentVersion: 32 });
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
          'INSERT INTO brand_assets (id, kind, label, mime, file_path, sha256, width, height, usage_policy, official, ' +
            "is_primary, active, registered_at, updated_at) VALUES (?, 'brand_logo', 'Logo', 'image/png', ?, ?, 10, 10, " +
            "'protected', 0, 0, 1, ?, ?)",
        ).run([id, `brand-assets/${id}.png`, id.padEnd(64, '0'), FIXED_NOW.toISOString(), FIXED_NOW.toISOString()]);
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

describe('migration 0031_reconcile_field_provenance_references.sql', () => {
  /** Migrations 1–30 with the earlier draft of 0016 that declared the application ids as foreign keys. */
  function draftDirectory(): string {
    const committed = defaultMigrationsDirectory();
    return migrationDir(
      Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 30)
          .map(({ version, fileName }) => {
            const sql = readFileSync(path.join(committed, fileName), 'utf8');
            return [
              fileName,
              version === 16
                ? sql
                    .replace(
                      /last_application_id TEXT NULL,/,
                      'last_application_id TEXT NULL REFERENCES competition_import_applications(id) ON DELETE RESTRICT,',
                    )
                    .replace(
                      /application_id TEXT NULL,\n {2}recorded_at/,
                      'application_id TEXT NULL REFERENCES competition_import_applications(id) ON DELETE RESTRICT,\n  recorded_at',
                    )
                : sql,
            ];
          }),
      ),
    );
  }
  const references = (db: SqliteDatabase, table: string) =>
    db
      .prepare<{ table: string; from: string }>(
        `SELECT "table", "from" FROM pragma_foreign_key_list(?) ORDER BY "from"`,
      )
      .all([table]);

  it('drops the draft application foreign keys, keeps every row and accepts a provenance write before its application row', () => {
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db } = openMigratedDatabase({ location, directory: draftDirectory(), now: () => FIXED_NOW });
    try {
      const at = FIXED_NOW.toISOString();
      db.prepare('INSERT INTO competitions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run([
        'c1',
        'Liga',
        at,
        at,
      ]);
      db.prepare(
        `INSERT INTO sports_field_provenance (competition_id, entity_type, entity_id, field_name, origin, updated_at)
         VALUES ('c1', 'round', 'r1', 'name', 'manual', ?)`,
      ).run([at]);
      db.prepare(
        `INSERT INTO sports_field_provenance_events (id, competition_id, entity_type, entity_id, field_name, action, next_origin, recorded_at)
         VALUES ('e1', 'c1', 'round', 'r1', 'name', 'manual_edit', 'manual', ?)`,
      ).run([at]);
      const pending = `UPDATE sports_field_provenance SET last_application_id = 'pending-application' WHERE entity_id = 'r1'`;
      expect(references(db, 'sports_field_provenance').map((row) => row.from)).toEqual([
        'competition_id',
        'last_application_id',
      ]);
      expect(() => db.prepare(pending).run()).toThrow(/FOREIGN KEY constraint failed/);
      const provenance = db.prepare('SELECT * FROM sports_field_provenance').all();
      const events = db.prepare('SELECT * FROM sports_field_provenance_events').all();

      expect(runMigrations(db, { now: () => FIXED_NOW })).toEqual({
        applied: [
          { version: 31, name: 'reconcile_field_provenance_references' },
          { version: 32, name: 'engine_slide_type_templates' },
        ],
        currentVersion: 32,
      });
      for (const table of ['sports_field_provenance', 'sports_field_provenance_events'])
        expect(references(db, table)).toEqual([{ table: 'competitions', from: 'competition_id' }]);
      expect(db.prepare('SELECT * FROM sports_field_provenance').all()).toEqual(provenance);
      expect(db.prepare('SELECT * FROM sports_field_provenance_events').all()).toEqual(events);
      expect(
        db
          .prepare<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'sports_field_provenance%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all()
          .map((row) => row.name),
      ).toEqual([
        'idx_sports_field_provenance_entity',
        'idx_sports_field_provenance_events_entity',
        'idx_sports_field_provenance_protected',
      ]);
      expect(() => db.prepare(pending).run()).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('leaves a database migrated with the final 0016 with the same definition as a fresh one', () => {
    const schema = (db: SqliteDatabase) =>
      db
        .prepare<{ sql: string }>(
          "SELECT sql FROM sqlite_master WHERE tbl_name LIKE 'sports_field_provenance%' AND sql IS NOT NULL ORDER BY name",
        )
        .all()
        .map((row) => row.sql);
    const reconciled = openMigratedDatabase({ location: path.join(freshDir('data'), DATABASE_FILE_NAME) });
    const draft = openMigratedDatabase({
      location: path.join(freshDir('data'), DATABASE_FILE_NAME),
      directory: draftDirectory(),
    });
    try {
      runMigrations(draft.db);
      expect(schema(draft.db)).toEqual(schema(reconciled.db));
      expect(schema(reconciled.db).join('\n')).not.toMatch(/competition_import_applications/);
    } finally {
      reconciled.db.close();
      draft.db.close();
    }
  });
});

describe('migration 0032_engine_slide_type_templates.sql (decision 01G-D-3)', () => {
  it('keeps every template row, moves the project template into one pin per slide type and accepts a cover', () => {
    const committed = defaultMigrationsDirectory();
    const throughThirtyOne = migrationDir(
      Object.fromEntries(
        readMigrations(committed)
          .filter(({ version }) => version <= 31)
          .map(({ fileName }) => [fileName, readFileSync(path.join(committed, fileName), 'utf8')]),
      ),
    );
    const location = path.join(freshDir('data'), DATABASE_FILE_NAME);
    const { db } = openMigratedDatabase({ location, directory: throughThirtyOne, now: () => FIXED_NOW });
    try {
      const at = FIXED_NOW.toISOString();
      const insertTemplate = (id: string, contentType: string) =>
        db
          .prepare(
            'INSERT INTO visual_templates (id, name, content_type, format, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run([id, `Plantilla ${id}`, contentType, '4:5', at, at]);
      insertTemplate('t-result', 'match_result');
      expect(() => insertTemplate('t-cover-early', 'cover')).toThrow(/CHECK constraint failed/);
      db.prepare(
        `INSERT INTO visual_template_versions (id, template_id, version, status, revision, canvas_width, canvas_height,
           background_source, background_id, background_sha256, background_mime, background_width, background_height,
           layers_json, assets_json, created_at, updated_at, published_at)
         VALUES ('v-result', 't-result', 1, 'published', 1, 1080, 1350, 'brand_asset', ?, ?, 'image/png', 1080, 1350,
           '[]', '[]', ?, ?, ?)`,
      ).run(['b'.repeat(36), 'c'.repeat(64), at, at, at]);
      db.prepare(
        `INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group,
           publication_permission, adapter, first_seen_at, last_seen_at)
         VALUES ('local-a', 'Synthetic local source', 'MANUAL_DATA', 'primary', 0, 0, 'group-a', 'not_applicable',
           'manual', ?, ?)`,
      ).run([at, at]);
      db.prepare(
        `INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label,
           stage_id, stage_label, selection_ref, standings_expected, language, created_at, updated_at)
         VALUES ('p1', 'c1', 'Liga', 'local-a', 'MANUAL_DATA', 's1', '2026/27', 'r1', 'Jornada 1', '{}',
           'not_expected', 'es', ?, ?)`,
      ).run([at, at]);
      db.prepare(
        "UPDATE projects SET visual_template_id = 't-result', visual_template_version_id = 'v-result', badge_snapshot_json = '{}' WHERE id = 'p1'",
      ).run();
      const templates = db.prepare('SELECT * FROM visual_templates ORDER BY id').all();
      const versions = db.prepare('SELECT * FROM visual_template_versions ORDER BY id').all();

      expect(runMigrations(db, { now: () => FIXED_NOW })).toEqual({
        applied: [{ version: 32, name: 'engine_slide_type_templates' }],
        currentVersion: 32,
      });
      expect(db.prepare('SELECT * FROM visual_templates ORDER BY id').all()).toEqual(templates);
      expect(db.prepare('SELECT * FROM visual_template_versions ORDER BY id').all()).toEqual(versions);
      expect(db.prepare('SELECT * FROM project_visual_templates').all()).toEqual([
        {
          project_id: 'p1',
          slide_type: 'match_result',
          visual_template_id: 't-result',
          visual_template_version_id: 'v-result',
        },
      ]);
      expect(
        db.prepare('SELECT visual_template_id, visual_template_version_id, badge_snapshot_json FROM projects').all(),
      ).toEqual([{ visual_template_id: null, visual_template_version_id: null, badge_snapshot_json: '{}' }]);
      for (const contentType of ['cover', 'closing']) {
        expect(() => insertTemplate(`t-${contentType}`, contentType)).not.toThrow();
      }
      expect(() => insertTemplate('t-standings', 'standings')).toThrow(/CHECK constraint failed/);
      // The published version stays immutable and still references the rebuilt table.
      expect(() => db.prepare("DELETE FROM visual_template_versions WHERE id = 'v-result'").run()).toThrow(/immutable/);
      expect(() => db.prepare("DELETE FROM visual_templates WHERE id = 't-result'").run()).toThrow(
        /FOREIGN KEY constraint failed/,
      );
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
