/**
 * Constraint tests of the migrated schema (`0001_initial.sql`, `0002_qa_capitalized_tokens.sql`) on a temporary
 * database (removed after the run), with synthetic team- and competition-level rows only.
 *
 * Each rule of data-model.md section 3 that the database enforces is shown to accept a valid row and to refuse the
 * invalid ones, with the constraint kind that refuses them:
 * - R-204: an observation (a stored fact value) without source, source reference or retrieval time;
 * - a verified fact without value, and the other status consistency checks (OD-17, AD-28);
 * - a dispute without a consistent outcome (R-048, R-230);
 * - a MANUAL_DATA observation without import version, and an import version on another mode (AD-29);
 * - a disputed fact with a candidate value;
 * - manual eligibility on an ineligible status (AD-28, AD-38);
 * - an unknown data mode on every data-mode column (PD-13);
 * - the closed failure JSON columns (T10-F10), STRICT types, selection references and import metadata;
 * - the closed QA check names of `qa_results`, including `capitalized_tokens` (migration 0002; OD-26, OD-56).
 */
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SqlValue } from './db.js';
import { constraintKind, type ConstraintKind } from './errors.js';
import { openMigratedDatabase } from './migrations.js';
import { pickIdentifier, placeholders } from './sql.js';
import { DATABASE_FILE_NAME, type SqliteDatabase } from './sqlite.js';

const NOW = '2026-10-27T16:32:21.123Z';
const SHA = 'a'.repeat(64);
const FAILURE = JSON.stringify({ code: 'timeout', sourceId: 'demo-a', path: null, httpStatus: null });

/** Tables written by these tests; identifiers are code constants (T10-F14). */
const TABLES = [
  'sources',
  'projects',
  'workflow_runs',
  'stage_runs',
  'retrievals',
  'observations',
  'facts',
  'manual_approvals',
  'disputes',
  'imports',
  'manual_competitions',
  'manual_seasons',
  'manual_selection_versions',
  'content_drafts',
  'carousels',
  'elements',
  'element_versions',
  'qa_results',
  'final_approvals',
  'exports',
] as const;
type Table = (typeof TABLES)[number];
type Row = Record<string, SqlValue>;

let dir: string;
let db: SqliteDatabase;

/** IDs of the seeded base rows. */
const base = {
  demoSource: 'demo-a',
  manualSource: 'manual-a',
  project: randomUUID(),
  run: randomUUID(),
  retrieval: randomUUID(),
  manualRetrieval: randomUUID(),
  importId: randomUUID(),
  competition: 'manual-a-liga',
  season: '2026',
  selectionVersion: randomUUID(),
  draft: randomUUID(),
  carousel: randomUUID(),
  finalApproval: randomUUID(),
};

/** Inserts `row` into `table`. Table and column names are test constants checked against an allow-list. */
function insert(table: Table, row: Row): void {
  const columns = Object.keys(row);
  const tableName = pickIdentifier(TABLES, table);
  const columnNames = columns.map((column) => pickIdentifier(columns, column));
  const sql =
    'INSERT INTO ' + tableName + ' (' + columnNames.join(', ') + ') VALUES (' + placeholders(columns.length) + ')';
  db.prepare(sql).run(columns.map((column) => row[column] ?? null));
}

/** Asserts that `action` is refused by a SQLite constraint of the given kind. */
function expectRefused(action: () => void, kind: ConstraintKind): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected the write to be refused').toBeDefined();
  expect(constraintKind(caught)).toBe(kind);
}

// Valid rows with fresh IDs; tests override single columns.

function sourceRow(overrides: Row = {}): Row {
  return {
    id: `src-${randomUUID()}`,
    name: 'Synthetic source',
    mode: 'DEMO_DATA',
    role: 'verification',
    official_publication: 0,
    accepted: 1,
    independence_group: 'group-b',
    publication_permission: 'not_applicable',
    adapter: 'fixture',
    first_seen_at: NOW,
    last_seen_at: NOW,
    ...overrides,
  };
}

function projectRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    competition_id: 'demo-a-league',
    competition_name: 'Synthetic League',
    source_id: base.demoSource,
    data_mode: 'DEMO_DATA',
    season_id: '2026',
    season_label: '2026',
    stage_id: 'regular',
    stage_label: 'Regular season',
    matchday: 3,
    selection_ref: '{"stage":"regular","matchday":3}',
    standings_expected: 'expected',
    language: 'es',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function runRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    project_id: base.project,
    run_number: Math.floor(Math.random() * 1_000_000) + 2,
    kind: 'full',
    base_run_id: null,
    status: 'running',
    failure: null,
    config_snapshot: '{"sources":[]}',
    standings_availability: null,
    started_at: NOW,
    finished_at: null,
    ...overrides,
  };
}

function retrievalRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    run_id: base.run,
    source_id: base.demoSource,
    data_mode: 'DEMO_DATA',
    stage: 'research',
    resource: 'selection_matches',
    retrieved_at: NOW,
    from_cache: 0,
    outcome: 'ok',
    failure: null,
    import_version_id: null,
    ...overrides,
  };
}

function observationRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    run_id: base.run,
    retrieval_id: base.retrieval,
    source_id: base.demoSource,
    data_mode: 'DEMO_DATA',
    import_version_id: null,
    stage: 'research',
    fact_key: `match:${randomUUID()}:score`,
    value: '{"home":2,"away":1}',
    source_ref: 'fixture:reference/matches.json',
    retrieved_at: NOW,
    ...overrides,
  };
}

function manualObservationRow(overrides: Row = {}): Row {
  return observationRow({
    retrieval_id: base.manualRetrieval,
    source_id: base.manualSource,
    data_mode: 'MANUAL_DATA',
    import_version_id: base.selectionVersion,
    source_ref: `import:${base.importId}/v1`,
    ...overrides,
  });
}

function verifiedFactRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    run_id: base.run,
    fact_key: `match:${randomUUID()}:score`,
    kind: 'match_score',
    subject: '{"matchKey":"m1"}',
    status: 'verified',
    unverified_reason: null,
    value: '{"home":2,"away":1}',
    candidate_value: null,
    manual_eligible: 0,
    reason: null,
    decided_at: NOW,
    ...overrides,
  };
}

function unverifiedFactRow(reason: string, overrides: Row = {}): Row {
  return verifiedFactRow({ status: 'unverified', unverified_reason: reason, value: null, ...overrides });
}

function disputeRow(overrides: Row = {}): Row {
  const factId = randomUUID();
  insert('facts', unverifiedFactRow('disputed', { id: factId }));
  return {
    id: randomUUID(),
    fact_id: factId,
    source_values: '[{"sourceId":"demo-a","independenceGroup":"group-a","value":{"home":2,"away":1}}]',
    consulted_source_id: null,
    consulted_observation_id: null,
    consulted_at: null,
    outcome: 'unavailable',
    resolved_value: null,
    ...overrides,
  };
}

function importRow(overrides: Row = {}): Row {
  const id = randomUUID();
  return {
    id,
    source_id: base.manualSource,
    channel: 'json_file',
    file_name: 'liga-2026.json',
    declared_source: 'Synthetic league bulletin',
    competition_id: base.competition,
    season_id: base.season,
    original_path: `imports/${id}/original.json`,
    original_sha256: SHA,
    original_bytes: 2048,
    received_at: NOW,
    ...overrides,
  };
}

function selectionVersionRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    import_id: base.importId,
    competition_id: base.competition,
    season_id: base.season,
    stage_id: 'apertura',
    stage_name: 'Apertura',
    stage_order: 1,
    matchday_key: 1,
    version_number: Math.floor(Math.random() * 1_000_000) + 2,
    data: '{"matches":[]}',
    created_at: NOW,
    superseded_at: null,
    ...overrides,
  };
}

function exportRow(overrides: Row = {}): Row {
  return {
    id: randomUUID(),
    carousel_id: base.carousel,
    final_approval_id: base.finalApproval,
    exported_at: NOW,
    directory: `exports/${base.project}/${randomUUID()}`,
    manifest_sha256: SHA,
    data_mode: 'DEMO_DATA',
    ...overrides,
  };
}

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'edr-t18-constraints-'));
  db = openMigratedDatabase({ location: path.join(dir, DATABASE_FILE_NAME) }).db;
  db.transaction(() => {
    insert(
      'sources',
      sourceRow({ id: base.demoSource, role: 'primary', independence_group: 'group-a', official_publication: 1 }),
    );
    insert(
      'sources',
      sourceRow({ id: base.manualSource, mode: 'MANUAL_DATA', role: 'primary', accepted: 0, adapter: 'manual' }),
    );
    insert('projects', projectRow({ id: base.project }));
    insert('workflow_runs', runRow({ id: base.run, run_number: 1 }));
    insert('retrievals', retrievalRow({ id: base.retrieval }));
    insert('imports', importRow({ id: base.importId }));
    insert('manual_competitions', {
      competition_id: base.competition,
      source_id: base.manualSource,
      name: 'Synthetic Manual League',
      area_name: null,
      first_import_id: base.importId,
    });
    insert('manual_seasons', { competition_id: base.competition, season_id: base.season, label: '2026' });
    insert('manual_selection_versions', selectionVersionRow({ id: base.selectionVersion, version_number: 1 }));
    insert(
      'retrievals',
      retrievalRow({
        id: base.manualRetrieval,
        source_id: base.manualSource,
        data_mode: 'MANUAL_DATA',
        resource: 'selection',
        import_version_id: base.selectionVersion,
      }),
    );
    insert('content_drafts', {
      id: base.draft,
      project_id: base.project,
      run_id: base.run,
      facts_run_id: base.run,
      language: 'es',
      standings_included: 1,
      excluded_match_keys: '[]',
      left_out_matches: '[]',
      created_at: NOW,
      superseded_at: null,
    });
    insert('carousels', { id: base.carousel, draft_id: base.draft, sequence: 1, total: 1 });
    insert('final_approvals', {
      id: base.finalApproval,
      carousel_id: base.carousel,
      version_set: '[]',
      version_set_sha256: SHA,
      approved_at: NOW,
      invalidated_at: null,
    });
  });
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('R-204: a stored fact value needs a source, a source reference and a retrieval time', () => {
  it('accepts an attributed observation', () => {
    insert('observations', observationRow());
  });

  it('refuses an observation without source', () => {
    expectRefused(() => insert('observations', observationRow({ source_id: null })), 'not_null');
    expectRefused(() => insert('observations', observationRow({ source_id: 'unknown-source' })), 'foreign_key');
  });

  it('refuses an observation without a usable source reference', () => {
    expectRefused(() => insert('observations', observationRow({ source_ref: null })), 'not_null');
    expectRefused(() => insert('observations', observationRow({ source_ref: '' })), 'check');
    expectRefused(() => insert('observations', observationRow({ source_ref: 'x'.repeat(513) })), 'check');
  });

  it('refuses an observation without retrieval time or retrieval record', () => {
    expectRefused(() => insert('observations', observationRow({ retrieved_at: null })), 'not_null');
    expectRefused(() => insert('observations', observationRow({ retrieval_id: null })), 'not_null');
    expectRefused(() => insert('observations', observationRow({ retrieval_id: randomUUID() })), 'foreign_key');
  });

  it('refuses an observation value that is not JSON', () => {
    expectRefused(() => insert('observations', observationRow({ value: 'two-one' })), 'check');
  });
});

describe('fact status consistency (OD-17, AD-28)', () => {
  it('accepts a verified fact with value and an unverified fact with reason', () => {
    insert('facts', verifiedFactRow());
    insert('facts', unverifiedFactRow('no_accepted_source'));
    insert('facts', unverifiedFactRow('awaiting_independent_verification', { candidate_value: '{"home":2,"away":1}' }));
    insert('facts', unverifiedFactRow('team_identity_unmatched'));
  });

  it('refuses a verified fact without value', () => {
    expectRefused(() => insert('facts', verifiedFactRow({ value: null })), 'check');
  });

  it('refuses a verified fact with an unverified reason or a candidate value', () => {
    expectRefused(() => insert('facts', verifiedFactRow({ unverified_reason: 'disputed' })), 'check');
    expectRefused(() => insert('facts', verifiedFactRow({ candidate_value: '{"home":2,"away":1}' })), 'check');
  });

  it('refuses an unverified fact without reason, with a value, or with an unknown reason or status', () => {
    expectRefused(() => insert('facts', unverifiedFactRow('no_accepted_source', { unverified_reason: null })), 'check');
    expectRefused(() => insert('facts', unverifiedFactRow('no_accepted_source', { value: '{"home":2}' })), 'check');
    expectRefused(() => insert('facts', unverifiedFactRow('rumour')), 'check');
    expectRefused(() => insert('facts', verifiedFactRow({ status: 'manually_approved' })), 'check');
  });

  it('refuses a disputed fact with a candidate value', () => {
    insert('facts', unverifiedFactRow('disputed'));
    expectRefused(
      () => insert('facts', unverifiedFactRow('disputed', { candidate_value: '{"home":2,"away":1}' })),
      'check',
    );
  });

  it('refuses a second fact for the same key in one run', () => {
    const fact = verifiedFactRow();
    insert('facts', fact);
    expectRefused(() => insert('facts', verifiedFactRow({ fact_key: fact['fact_key'] ?? null })), 'unique');
  });
});

describe('manual eligibility (AD-28, AD-38)', () => {
  it('accepts eligibility on facts without an accepted source or awaiting independent verification', () => {
    insert('facts', unverifiedFactRow('no_accepted_source', { manual_eligible: 1, candidate_value: '{"v":1}' }));
    insert(
      'facts',
      unverifiedFactRow('awaiting_independent_verification', { manual_eligible: 1, candidate_value: '{"v":1}' }),
    );
  });

  it('refuses eligibility on an ineligible status', () => {
    expectRefused(() => insert('facts', verifiedFactRow({ manual_eligible: 1 })), 'check');
    expectRefused(() => insert('facts', unverifiedFactRow('disputed', { manual_eligible: 1 })), 'check');
    expectRefused(() => insert('facts', unverifiedFactRow('team_identity_unmatched', { manual_eligible: 1 })), 'check');
    expectRefused(() => insert('facts', unverifiedFactRow('no_accepted_source', { manual_eligible: 2 })), 'check');
  });

  it('records manual approvals only with a known action on an existing fact', () => {
    const fact = unverifiedFactRow('no_accepted_source', { manual_eligible: 1, candidate_value: '{"v":1}' });
    insert('facts', fact);
    const approval = { id: randomUUID(), fact_id: fact['id'] ?? null, carried_over_from_fact_id: null, at: NOW };
    insert('manual_approvals', { ...approval, action: 'approved' });
    insert('manual_approvals', { ...approval, id: randomUUID(), action: 'revoked' });
    expectRefused(() => insert('manual_approvals', { ...approval, id: randomUUID(), action: 'verified' }), 'check');
    expectRefused(
      () => insert('manual_approvals', { ...approval, id: randomUUID(), action: 'approved', fact_id: randomUUID() }),
      'foreign_key',
    );
  });
});

describe('disputes need a consistent outcome (R-048, R-230)', () => {
  it('accepts a resolved dispute with its value and an unresolved one without', () => {
    insert('disputes', disputeRow({ outcome: 'resolved', resolved_value: '{"home":2,"away":1}' }));
    insert('disputes', disputeRow({ outcome: 'unavailable' }));
    insert('disputes', disputeRow({ outcome: 'same_source' }));
    insert('disputes', disputeRow({ outcome: 'no_match' }));
  });

  it('refuses a resolved dispute without value', () => {
    expectRefused(() => insert('disputes', disputeRow({ outcome: 'resolved', resolved_value: null })), 'check');
  });

  it('refuses an unresolved dispute with a value, or an unknown outcome', () => {
    for (const outcome of ['unavailable', 'same_source', 'no_match']) {
      expectRefused(() => insert('disputes', disputeRow({ outcome, resolved_value: '{"home":2,"away":1}' })), 'check');
    }
    expectRefused(() => insert('disputes', disputeRow({ outcome: 'ignored' })), 'check');
  });

  it('refuses a second dispute for the same fact', () => {
    const dispute = disputeRow();
    insert('disputes', dispute);
    expectRefused(() => insert('disputes', { ...dispute, id: randomUUID() }), 'unique');
  });
});

describe('MANUAL_DATA observations carry their import version (AD-29)', () => {
  it('accepts a MANUAL_DATA observation with its import version', () => {
    insert('observations', manualObservationRow());
  });

  it('refuses a MANUAL_DATA observation without import version', () => {
    expectRefused(() => insert('observations', manualObservationRow({ import_version_id: null })), 'check');
  });

  it('refuses an import version on a LIVE_DATA or DEMO_DATA observation', () => {
    expectRefused(() => insert('observations', observationRow({ import_version_id: base.selectionVersion })), 'check');
    expectRefused(
      () =>
        insert('observations', observationRow({ data_mode: 'LIVE_DATA', import_version_id: base.selectionVersion })),
      'check',
    );
  });

  it('refuses an unknown import version', () => {
    expectRefused(
      () => insert('observations', manualObservationRow({ import_version_id: randomUUID() })),
      'foreign_key',
    );
  });
});

describe('data modes are a closed set (PD-13)', () => {
  const UNKNOWN_MODES = ['TEST_DATA', 'live_data', ''];

  it('accepts the three modes', () => {
    for (const mode of ['LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA']) {
      insert('sources', sourceRow({ mode }));
      insert('projects', projectRow({ data_mode: mode }));
      insert('retrievals', retrievalRow({ data_mode: mode }));
      insert('exports', exportRow({ data_mode: mode }));
    }
  });

  it('refuses an unknown data mode on projects, sources, retrievals, observations and exports', () => {
    for (const mode of UNKNOWN_MODES) {
      expectRefused(() => insert('projects', projectRow({ data_mode: mode })), 'check');
      expectRefused(() => insert('sources', sourceRow({ mode })), 'check');
      expectRefused(() => insert('retrievals', retrievalRow({ data_mode: mode })), 'check');
      expectRefused(() => insert('observations', observationRow({ data_mode: mode })), 'check');
      expectRefused(() => insert('exports', exportRow({ data_mode: mode })), 'check');
    }
  });

  it('refuses an unknown publication permission', () => {
    expectRefused(() => insert('sources', sourceRow({ publication_permission: 'assumed' })), 'check');
  });
});

describe('failure columns hold the closed failure JSON (T10-F10)', () => {
  it('accepts a closed failure object on runs, stage runs and retrievals', () => {
    insert('workflow_runs', runRow({ status: 'failed', failure: FAILURE }));
    insert('stage_runs', {
      id: randomUUID(),
      run_id: base.run,
      stage: 'research',
      position: 1,
      status: 'failed',
      failure: FAILURE,
      started_at: NOW,
      finished_at: NOW,
    });
    insert('retrievals', retrievalRow({ outcome: 'failed', failure: FAILURE }));
  });

  it('refuses free text and oversized values', () => {
    const freeText = 'Incorrect API key provided: sk-ab****xyz';
    const oversized = JSON.stringify({ code: 'timeout', sourceId: 'demo-a', path: 'p'.repeat(600), httpStatus: null });
    for (const failure of [freeText, oversized]) {
      expectRefused(() => insert('workflow_runs', runRow({ failure })), 'check');
      expectRefused(() => insert('retrievals', retrievalRow({ failure })), 'check');
      expectRefused(
        () =>
          insert('stage_runs', {
            id: randomUUID(),
            run_id: base.run,
            stage: 'content',
            position: 3,
            status: 'failed',
            failure,
            started_at: NOW,
            finished_at: NOW,
          }),
        'check',
      );
    }
  });
});

describe('projects: selection and STRICT types (AD-21, AD-24)', () => {
  it('accepts a whole-stage selection without matchday', () => {
    insert('projects', projectRow({ matchday: null, standings_expected: 'not_expected' }));
  });

  it('refuses invalid matchdays and selection references', () => {
    expectRefused(() => insert('projects', projectRow({ matchday: 0 })), 'check');
    expectRefused(() => insert('projects', projectRow({ matchday: 'three' })), 'datatype');
    expectRefused(() => insert('projects', projectRow({ selection_ref: 'stage=regular' })), 'check');
    expectRefused(
      () => insert('projects', projectRow({ selection_ref: JSON.stringify({ ref: 'r'.repeat(510) }) })),
      'check',
    );
    expectRefused(() => insert('projects', projectRow({ language: 'fr' })), 'check');
    expectRefused(() => insert('projects', projectRow({ source_id: 'unknown-source' })), 'foreign_key');
  });

  it('refuses a second run with the same number in one project', () => {
    expectRefused(() => insert('workflow_runs', runRow({ run_number: 1 })), 'unique');
  });
});

describe('MANUAL_DATA import records (AD-29)', () => {
  it('accepts file and form imports with consistent file names', () => {
    insert('imports', importRow());
    insert('imports', importRow({ channel: 'csv_file', file_name: 'liga-2026.csv' }));
    insert('imports', importRow({ channel: 'form', file_name: null, declared_source: null }));
  });

  it('refuses inconsistent channels, file names and sizes', () => {
    expectRefused(() => insert('imports', importRow({ channel: 'form' })), 'check');
    expectRefused(() => insert('imports', importRow({ file_name: null })), 'check');
    expectRefused(() => insert('imports', importRow({ channel: 'xlsx_file' })), 'check');
    expectRefused(() => insert('imports', importRow({ file_name: 'a.csv' })), 'check');
    expectRefused(() => insert('imports', importRow({ original_bytes: 0 })), 'check');
    expectRefused(() => insert('imports', importRow({ original_bytes: 524_289 })), 'check');
    expectRefused(() => insert('imports', importRow({ declared_source: '' })), 'check');
  });

  it('versions selections under a known season and refuses a duplicate version number', () => {
    const version = selectionVersionRow({ matchday_key: 0 });
    insert('manual_selection_versions', version);
    expectRefused(() => insert('manual_selection_versions', { ...version, id: randomUUID() }), 'unique');
    expectRefused(() => insert('manual_selection_versions', selectionVersionRow({ season_id: '1999' })), 'foreign_key');
    expectRefused(() => insert('manual_selection_versions', selectionVersionRow({ matchday_key: -1 })), 'check');
    expectRefused(() => insert('manual_selection_versions', selectionVersionRow({ version_number: 0 })), 'check');
  });
});

describe('content elements', () => {
  it('requires a slide type exactly for slides', () => {
    const element = {
      carousel_id: base.carousel,
      slide_key: 'cover',
      subject: '{}',
      current_version_id: null,
    };
    insert('elements', { ...element, id: randomUUID(), kind: 'slide', position: 1, slide_type: 'cover' });
    insert('elements', { ...element, id: randomUUID(), kind: 'caption', position: 0, slide_type: null });
    expectRefused(
      () => insert('elements', { ...element, id: randomUUID(), kind: 'slide', position: 2, slide_type: null }),
      'check',
    );
    expectRefused(
      () => insert('elements', { ...element, id: randomUUID(), kind: 'caption', position: 3, slide_type: 'cover' }),
      'check',
    );
  });
});

describe('QA results (data-model.md section 3.3; OD-09, OD-26, OD-56)', () => {
  /** The six check names of the contract QA check list (OD-38); 0002 adds the sixth. */
  const CHECK_NAMES = [
    'data_match',
    'team_names',
    'text_fit',
    'style_consistency',
    'dimensions',
    'capitalized_tokens',
  ] as const;

  function versionRow(): Row {
    const elementId = randomUUID();
    insert('elements', {
      id: elementId,
      carousel_id: base.carousel,
      kind: 'caption',
      position: 100 + Math.floor(Math.random() * 1_000_000),
      slide_type: null,
      slide_key: 'caption',
      subject: '{}',
      current_version_id: null,
    });
    const id = randomUUID();
    insert('element_versions', {
      id,
      element_id: elementId,
      version_number: 1,
      origin: 'generated',
      text: '{"fields":[]}',
      content_flags: '[]',
      ai_adapter: 'stub',
      template_id: null,
      template_version: null,
      render_model: null,
      image_path: null,
      image_sha256: null,
      width: null,
      height: null,
      qa_status: 'pending',
      created_at: NOW,
      superseded_at: null,
    });
    return { id };
  }

  function qaRow(versionId: SqlValue, overrides: Row = {}): Row {
    return {
      id: randomUUID(),
      element_version_id: versionId,
      check_name: 'capitalized_tokens',
      outcome: 'fail',
      severity: 'warning',
      details: '{"tokens":["Ezequiel"]}',
      acknowledged_at: null,
      created_at: NOW,
      ...overrides,
    };
  }

  it('accepts every check name of the contract, capitalized_tokens included', () => {
    const version = versionRow()['id'] ?? null;
    for (const checkName of CHECK_NAMES) {
      insert('qa_results', qaRow(version, { check_name: checkName }));
    }
    expect(
      db
        .prepare<{ check_name: string }>(
          'SELECT check_name FROM qa_results WHERE element_version_id = ? ORDER BY rowid',
        )
        .all([version])
        .map((row) => row.check_name),
    ).toEqual([...CHECK_NAMES]);
  });

  it('refuses an unknown check name, outcome or severity, invalid details and an unknown version', () => {
    const version = versionRow()['id'] ?? null;
    expectRefused(() => insert('qa_results', qaRow(version, { check_name: 'unknown_check' })), 'check');
    expectRefused(() => insert('qa_results', qaRow(version, { check_name: 'Capitalized_Tokens' })), 'check');
    expectRefused(() => insert('qa_results', qaRow(version, { check_name: 'person_names' })), 'check');
    expectRefused(() => insert('qa_results', qaRow(version, { outcome: 'skipped' })), 'check');
    expectRefused(() => insert('qa_results', qaRow(version, { severity: 'info' })), 'check');
    expectRefused(() => insert('qa_results', qaRow(version, { details: 'not json' })), 'check');
    // STRICT is kept by the rebuild of migration 0002: a BLOB is refused in a TEXT column.
    expectRefused(() => insert('qa_results', qaRow(version, { created_at: new Uint8Array([1, 2]) })), 'datatype');
    expectRefused(() => insert('qa_results', qaRow(randomUUID())), 'foreign_key');
  });

  it('keeps one result per version and check', () => {
    const version = versionRow()['id'] ?? null;
    insert('qa_results', qaRow(version));
    expectRefused(() => insert('qa_results', qaRow(version, { outcome: 'pass' })), 'unique');
    insert('qa_results', qaRow(versionRow()['id'] ?? null));
  });
});
