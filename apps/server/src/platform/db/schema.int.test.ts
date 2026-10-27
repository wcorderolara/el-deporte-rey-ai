/**
 * Schema tests of migration `0001_initial.sql` on a temporary database (removed after the run).
 *
 * 1. R-233 schema test (data-model.md section 5; T10-F21; R-112, R-113, R-119, R-280): every table, column and index
 *    name is listed through `sqlite_master` and `pragma_table_info` and none matches the excluded-data pattern
 *    (player-level, person, user, account, session and credential names). Positive controls show the scan finds
 *    such names.
 * 2. Structure: the tables, columns, foreign keys and indexes of data-model.md sections 3 and 4 (as revised by
 *    T11G), all tables STRICT.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openMigratedDatabase } from './migrations.js';
import { DATABASE_FILE_NAME, MEMORY_LOCATION, openDatabase, type SqliteDatabase } from './sqlite.js';

/**
 * Names that must not appear in the schema. data-model.md section 5 lists
 * `player|scorer|lineup|line_up|referee|coach|squad|user|account|password|session|email|login|token|secret`; the T18
 * scope extends it with person and credential names (`person|people|credential|api_?key`).
 */
const EXCLUDED_NAME_PATTERN =
  /player|scorer|lineup|line_up|referee|coach|squad|user|account|password|session|email|login|token|secret|person|people|credential|api_?key/i;

interface SchemaName {
  readonly kind: 'table' | 'column' | 'index';
  /** Bare name, tested against the pattern. */
  readonly name: string;
  /** Table of a column, for reporting. */
  readonly table?: string;
}

/** Lists every user table, column and index name of `db` through `sqlite_master` and `pragma_table_info`. */
function schemaNames(db: SqliteDatabase): SchemaName[] {
  const names: SchemaName[] = [];
  const tables = db
    .prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  for (const { name: table } of tables) {
    names.push({ kind: 'table', name: table });
    const columns = db.prepare<{ name: string }>('SELECT name FROM pragma_table_info(?) ORDER BY cid').all([table]);
    for (const { name } of columns) {
      names.push({ kind: 'column', name, table });
    }
  }
  const indexes = db
    .prepare<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  for (const { name } of indexes) {
    names.push({ kind: 'index', name });
  }
  return names;
}

function excludedNames(db: SqliteDatabase): string[] {
  return schemaNames(db)
    .filter((entry) => EXCLUDED_NAME_PATTERN.test(entry.name))
    .map((entry) => `${entry.kind} ${entry.table === undefined ? '' : `${entry.table}.`}${entry.name}`);
}

/** Tables and columns of data-model.md section 3, in declaration order. */
const EXPECTED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  schema_migrations: ['version', 'name', 'applied_at'],
  sources: [
    'id',
    'name',
    'mode',
    'role',
    'official_publication',
    'accepted',
    'independence_group',
    'publication_permission',
    'adapter',
    'first_seen_at',
    'last_seen_at',
  ],
  projects: [
    'id',
    'competition_id',
    'competition_name',
    'source_id',
    'data_mode',
    'season_id',
    'season_label',
    'stage_id',
    'stage_label',
    'matchday',
    'selection_ref',
    'standings_expected',
    'language',
    'created_at',
    'updated_at',
  ],
  workflow_runs: [
    'id',
    'project_id',
    'run_number',
    'kind',
    'base_run_id',
    'status',
    'failure',
    'config_snapshot',
    'standings_availability',
    'started_at',
    'finished_at',
  ],
  stage_runs: ['id', 'run_id', 'stage', 'position', 'status', 'failure', 'started_at', 'finished_at'],
  imports: [
    'id',
    'source_id',
    'channel',
    'file_name',
    'declared_source',
    'competition_id',
    'season_id',
    'original_path',
    'original_sha256',
    'original_bytes',
    'received_at',
  ],
  manual_competitions: ['competition_id', 'source_id', 'name', 'area_name', 'first_import_id'],
  manual_seasons: ['competition_id', 'season_id', 'label'],
  manual_selection_versions: [
    'id',
    'import_id',
    'competition_id',
    'season_id',
    'stage_id',
    'stage_name',
    'stage_order',
    'matchday_key',
    'version_number',
    'data',
    'created_at',
    'superseded_at',
  ],
  retrievals: [
    'id',
    'run_id',
    'source_id',
    'data_mode',
    'stage',
    'resource',
    'retrieved_at',
    'from_cache',
    'outcome',
    'failure',
    'import_version_id',
  ],
  teams: ['id', 'competition_id', 'season_id'],
  team_aliases: ['team_id', 'source_id', 'alias', 'origin'],
  observations: [
    'id',
    'run_id',
    'retrieval_id',
    'source_id',
    'data_mode',
    'import_version_id',
    'stage',
    'fact_key',
    'value',
    'source_ref',
    'retrieved_at',
  ],
  facts: [
    'id',
    'run_id',
    'fact_key',
    'kind',
    'subject',
    'status',
    'unverified_reason',
    'value',
    'candidate_value',
    'manual_eligible',
    'reason',
    'decided_at',
  ],
  manual_approvals: ['id', 'fact_id', 'action', 'carried_over_from_fact_id', 'at'],
  fact_evidence: ['fact_id', 'observation_id', 'relation'],
  disputes: [
    'id',
    'fact_id',
    'source_values',
    'consulted_source_id',
    'consulted_observation_id',
    'consulted_at',
    'outcome',
    'resolved_value',
  ],
  content_drafts: [
    'id',
    'project_id',
    'run_id',
    'facts_run_id',
    'language',
    'standings_included',
    'excluded_match_keys',
    'left_out_matches',
    'created_at',
    'superseded_at',
  ],
  carousels: ['id', 'draft_id', 'sequence', 'total'],
  elements: ['id', 'carousel_id', 'kind', 'position', 'slide_type', 'slide_key', 'subject', 'current_version_id'],
  element_versions: [
    'id',
    'element_id',
    'version_number',
    'origin',
    'text',
    'content_flags',
    'ai_adapter',
    'template_id',
    'template_version',
    'render_model',
    'image_path',
    'image_sha256',
    'width',
    'height',
    'qa_status',
    'created_at',
    'superseded_at',
  ],
  element_fact_refs: ['element_version_id', 'fact_id', 'usage'],
  qa_results: [
    'id',
    'element_version_id',
    'check_name',
    'outcome',
    'severity',
    'details',
    'acknowledged_at',
    'created_at',
  ],
  approvals: ['id', 'element_version_id', 'action', 'at'],
  final_approvals: ['id', 'carousel_id', 'version_set', 'version_set_sha256', 'approved_at', 'invalidated_at'],
  exports: ['id', 'carousel_id', 'final_approval_id', 'exported_at', 'directory', 'manifest_sha256', 'data_mode'],
  export_files: ['export_id', 'position', 'kind', 'element_version_id', 'file_name', 'sha256'],
  brand_assets: [
    'id',
    'kind',
    'label',
    'mime',
    'file_path',
    'sha256',
    'width',
    'height',
    'active',
    'registered_at',
    'deactivated_at',
  ],
};

/** Foreign keys of data-model.md section 3 as `column -> table`. */
const EXPECTED_FOREIGN_KEYS: Readonly<Record<string, readonly string[]>> = {
  projects: ['source_id -> sources'],
  workflow_runs: ['base_run_id -> workflow_runs', 'project_id -> projects'],
  stage_runs: ['run_id -> workflow_runs'],
  imports: ['source_id -> sources'],
  manual_competitions: ['first_import_id -> imports', 'source_id -> sources'],
  manual_seasons: ['competition_id -> manual_competitions'],
  manual_selection_versions: [
    'competition_id -> manual_seasons',
    'import_id -> imports',
    'season_id -> manual_seasons',
  ],
  retrievals: ['import_version_id -> manual_selection_versions', 'run_id -> workflow_runs', 'source_id -> sources'],
  team_aliases: ['source_id -> sources', 'team_id -> teams'],
  observations: [
    'import_version_id -> manual_selection_versions',
    'retrieval_id -> retrievals',
    'run_id -> workflow_runs',
    'source_id -> sources',
  ],
  facts: ['run_id -> workflow_runs'],
  manual_approvals: ['carried_over_from_fact_id -> facts', 'fact_id -> facts'],
  fact_evidence: ['fact_id -> facts', 'observation_id -> observations'],
  disputes: ['consulted_observation_id -> observations', 'consulted_source_id -> sources', 'fact_id -> facts'],
  content_drafts: ['facts_run_id -> workflow_runs', 'project_id -> projects', 'run_id -> workflow_runs'],
  carousels: ['draft_id -> content_drafts'],
  elements: ['carousel_id -> carousels', 'current_version_id -> element_versions'],
  element_versions: ['element_id -> elements'],
  element_fact_refs: ['element_version_id -> element_versions', 'fact_id -> facts'],
  qa_results: ['element_version_id -> element_versions'],
  approvals: ['element_version_id -> element_versions'],
  final_approvals: ['carousel_id -> carousels'],
  exports: ['carousel_id -> carousels', 'final_approval_id -> final_approvals'],
  export_files: ['element_version_id -> element_versions', 'export_id -> exports'],
};

/** Indexes of data-model.md section 4 as `table (columns)`. */
const EXPECTED_INDEXES = [
  'workflow_runs (project_id, status)',
  'stage_runs (run_id)',
  'retrievals (run_id)',
  'observations (run_id, fact_key)',
  'facts (run_id, status)',
  'manual_approvals (fact_id, at)',
  'fact_evidence (observation_id)',
  'content_drafts (project_id, superseded_at)',
  'elements (carousel_id)',
  'element_versions (element_id, superseded_at)',
  'element_fact_refs (fact_id)',
  'approvals (element_version_id, at)',
  'final_approvals (carousel_id, invalidated_at)',
  'exports (carousel_id)',
  'brand_assets (kind, active)',
  'imports (received_at)',
  'manual_selection_versions (competition_id, season_id, stage_id, matchday_key, superseded_at)',
];

let dir: string;
let db: SqliteDatabase;

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'edr-t18-schema-'));
  db = openMigratedDatabase({ location: path.join(dir, DATABASE_FILE_NAME) }).db;
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('R-233 schema test: no player-level, person, user-account or credential data', () => {
  it('finds no excluded name among the tables, columns and indexes', () => {
    const names = schemaNames(db);
    expect(names.filter((entry) => entry.kind === 'table')).toHaveLength(Object.keys(EXPECTED_COLUMNS).length);
    expect(names.filter((entry) => entry.kind === 'column').length).toBeGreaterThan(200);
    expect(excludedNames(db)).toEqual([]);
  });

  it('pattern covers every name class of data-model.md section 5 and the T18 extension', () => {
    const forbidden = [
      'player_name',
      'goal_scorer',
      'lineup',
      'line_up_json',
      'referee',
      'coach_id',
      'squad',
      'user_id',
      'account',
      'password_hash',
      'session_id',
      'email',
      'login_at',
      'api_token',
      'client_secret',
      'person_id',
      'people',
      'credential',
      'apikey',
      'API_KEY',
    ];
    expect(forbidden.filter((name) => !EXCLUDED_NAME_PATTERN.test(name))).toEqual([]);
  });

  it('positive control: the scan reports seeded excluded tables, columns and indexes', () => {
    const seeded = openDatabase({ location: MEMORY_LOCATION });
    try {
      seeded.execScript(
        'CREATE TABLE players (id TEXT PRIMARY KEY) STRICT;' +
          'CREATE TABLE matches (id TEXT PRIMARY KEY, referee_name TEXT, user_id TEXT) STRICT;' +
          'CREATE INDEX idx_matches_session ON matches (id);',
      );
      expect(excludedNames(seeded)).toEqual([
        'column matches.referee_name',
        'column matches.user_id',
        'table players',
        'index idx_matches_session',
      ]);
    } finally {
      seeded.close();
    }
  });
});

describe('structure of migration 0001_initial.sql', () => {
  it('has exactly the tables of data-model.md section 3, all STRICT', () => {
    const tables = db
      .prepare<{ name: string; strict: number }>(
        "SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all();
    expect(tables.map((table) => table.name)).toEqual(Object.keys(EXPECTED_COLUMNS).sort());
    expect(tables.filter((table) => table.strict !== 1)).toEqual([]);
  });

  it('has the columns of every table in the documented order', () => {
    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
      const actual = db
        .prepare<{ name: string }>('SELECT name FROM pragma_table_info(?) ORDER BY cid')
        .all([table])
        .map((column) => column.name);
      expect({ table, columns: actual }).toEqual({ table, columns });
    }
  });

  it('has the documented foreign keys', () => {
    for (const table of Object.keys(EXPECTED_COLUMNS)) {
      const actual = db
        .prepare<{ from: string; table: string }>('SELECT "from", "table" FROM pragma_foreign_key_list(?)')
        .all([table])
        .map((key) => `${key.from} -> ${key.table}`)
        .sort();
      expect({ table, keys: actual }).toEqual({ table, keys: EXPECTED_FOREIGN_KEYS[table] ?? [] });
    }
  });

  it('has the documented indexes', () => {
    const indexes = db
      .prepare<{ name: string; tbl_name: string }>(
        "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
      )
      .all()
      .map((index) => {
        const columns = db
          .prepare<{ name: string }>('SELECT name FROM pragma_index_info(?) ORDER BY seqno')
          .all([index.name])
          .map((column) => column.name);
        return `${index.tbl_name} (${columns.join(', ')})`;
      });
    expect(indexes.sort()).toEqual([...EXPECTED_INDEXES].sort());
  });
});
