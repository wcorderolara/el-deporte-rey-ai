/**
 * Schema tests of the migrated schema (`0001_initial.sql`, then `0002_qa_capitalized_tokens.sql`, which rebuilds
 * `qa_results` with the `capitalized_tokens` check name; OD-56) on a temporary database (removed after the run).
 *
 * 1. R-233 schema test (data-model.md section 5; T10-F21; R-112, R-113, R-119, R-280): every table, column and index
 *    name is listed through `sqlite_master` and `pragma_table_info` and none matches the excluded-data pattern
 *    (player-level, person, user, account, session and credential names). Positive controls show the scan finds
 *    such names.
 * 2. Structure: the tables, columns, foreign keys and indexes of data-model.md sections 3 and 4 (as revised by
 *    T11G and T56), all tables STRICT; no table left over from the rebuild of migration 0002; the `qa_results`
 *    check-name list and its UNIQUE (element_version_id, check_name).
 *
 * The R-233 scan covers table, column and index names. `capitalized_tokens` (a check-name value) and the migration
 * name `qa_capitalized_tokens` (a `schema_migrations` value) are values, not schema names.
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
    'deleted_at',
    'content_kind',
    'visual_template_id',
    'visual_template_version_id',
    'badge_snapshot_json',
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
  manual_approvals: ['id', 'fact_id', 'action', 'carried_over_from_fact_id', 'at', 'origin'],
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
    'description',
    'mime',
    'file_path',
    'sha256',
    'width',
    'height',
    'byte_size',
    'usage_policy',
    'official',
    'is_primary',
    'variant',
    'pose',
    'expression',
    'active',
    'registered_at',
    'updated_at',
    'deactivated_at',
    'deleted_at',
  ],
  brand_identity: ['id', 'description', 'graphic_preferences', 'color_usage', 'typography_usage', 'updated_at'],
  design_generations: [
    'id',
    'request_key',
    'request_hash',
    'parent_proposal_id',
    'content_type',
    'format',
    'style',
    'instructions',
    'inherited_instructions',
    'quality',
    'requested_count',
    'provider',
    'model',
    'request_size',
    'output_width',
    'output_height',
    'adaptation',
    'prompt_version',
    'prompt',
    'references_json',
    'estimate_json',
    'status',
    'current_index',
    'completed_count',
    'usage_json',
    'cost',
    'error_code',
    'error_message',
    'retry_after_seconds',
    'created_at',
    'started_at',
    'updated_at',
    'completed_at',
    'mode',
    'instructions_text',
    'inherited_text',
  ],
  design_generation_events: [
    'sequence',
    'generation_id',
    'event_type',
    'status',
    'image_index',
    'proposal_id',
    'created_at',
  ],
  design_proposals: [
    'id',
    'generation_id',
    'sequence',
    'name',
    'content_type',
    'format',
    'width',
    'height',
    'mime',
    'file_path',
    'sha256',
    'byte_size',
    'usage_json',
    'cost',
    'status',
    'decision_note',
    'decided_at',
    'created_at',
    'background_file_path',
    'background_sha256',
    'layers_json',
    'deleted_at',
    'decision_note_text',
  ],
  design_proposal_decisions: ['sequence', 'proposal_id', 'decision', 'note', 'created_at', 'note_text'],
  visual_templates: [
    'id',
    'name',
    'description',
    'category',
    'content_type',
    'format',
    'source_proposal_id',
    'acknowledged_warnings',
    'created_at',
    'updated_at',
    'archived_at',
    'deleted_at',
  ],
  project_visual_templates: ['project_id', 'slide_type', 'visual_template_id', 'visual_template_version_id'],
  team_badges: [
    'id',
    'team_id',
    'file_path',
    'sha256',
    'mime',
    'width',
    'height',
    'byte_size',
    'origin',
    'source_note',
    'authorization_confirmed',
    'status',
    'created_at',
    'retired_at',
  ],
  visual_template_versions: [
    'id',
    'template_id',
    'version',
    'status',
    'revision',
    'canvas_width',
    'canvas_height',
    'background_source',
    'background_id',
    'background_sha256',
    'background_mime',
    'background_width',
    'background_height',
    'layers_json',
    'assets_json',
    'created_at',
    'updated_at',
    'published_at',
  ],
  competitions: ['id', 'name', 'created_at', 'updated_at'],
  competition_provider_bindings: [
    'id',
    'competition_id',
    'provider_key',
    'source_id',
    'external_competition_id',
    'mode',
    'status',
    'linked_at',
    'unlinked_at',
    'created_at',
    'updated_at',
    'provider_name',
    'external_competition_name',
  ],
  competition_import_operations: [
    'id',
    'competition_id',
    'binding_id',
    'provider_key',
    'external_season_id',
    'destination_season_id',
    'resources_json',
    'scope_key',
    'status',
    'current_stage',
    'completed_stages_json',
    'cancellation_requested',
    'preview_id',
    'error_code',
    'error_message',
    'created_at',
    'started_at',
    'updated_at',
    'completed_at',
  ],
  competition_import_operation_events: [
    'sequence',
    'operation_id',
    'event_type',
    'status',
    'stage',
    'preview_id',
    'created_at',
  ],
  competition_import_previews: [
    'id',
    'competition_id',
    'binding_id',
    'provider_key',
    'external_season_id',
    'destination_season_id',
    'resources_json',
    'preview_json',
    'retrieved_at',
    'expires_at',
    'snapshot_hash',
    'local_fingerprint',
  ],
  external_identity_mappings: [
    'id',
    'provider_key',
    'resource',
    'scope_key',
    'external_id',
    'local_id',
    'created_at',
    'updated_at',
    'competition_id',
    'binding_id',
    'external_label',
    'origin',
    'baseline_json',
    'last_application_id',
  ],
  competition_import_applications: [
    'id',
    'competition_id',
    'preview_id',
    'binding_id',
    'provider_key',
    'snapshot_hash',
    'destination_season_id',
    'result_json',
    'applied_at',
  ],
  competition_import_apply_operations: [
    'id',
    'competition_id',
    'preview_id',
    'binding_id',
    'provider_key',
    'snapshot_hash',
    'plan_hash',
    'decisions_json',
    'status',
    'current_stage',
    'completed_stages_json',
    'cancellation_requested',
    'application_id',
    'error_code',
    'error_message',
    'created_at',
    'started_at',
    'updated_at',
    'completed_at',
  ],
  competition_import_apply_events: [
    'sequence',
    'operation_id',
    'event_type',
    'status',
    'stage',
    'application_id',
    'created_at',
  ],
  competition_import_decisions: [
    'id',
    'application_id',
    'resource',
    'external_scope',
    'external_id',
    'action',
    'local_id',
    'recorded_at',
  ],
  sports_field_provenance: [
    'competition_id',
    'entity_type',
    'entity_id',
    'field_name',
    'origin',
    'provider_key',
    'external_reference',
    'provider_value_json',
    'provider_value_present',
    'manual_override',
    'last_application_id',
    'updated_at',
  ],
  sports_field_provenance_events: [
    'id',
    'competition_id',
    'entity_type',
    'entity_id',
    'field_name',
    'action',
    'previous_origin',
    'next_origin',
    'provider_value_json',
    'application_id',
    'recorded_at',
  ],
  content_generation_batches: [
    'id',
    'import_id',
    'request_key',
    'request_hash',
    'competition_id',
    'competition_name',
    'season_id',
    'season_label',
    'stage_id',
    'stage_name',
    'round_id',
    'round_name',
    'selection_label',
    'language',
    'created_at',
  ],
  content_generation_items: [
    'id',
    'batch_id',
    'position',
    'kind',
    'title',
    'project_id',
    'initial_run_id',
    'selection_version_id',
    'skip_reason',
  ],
  content_generation_item_matches: ['item_id', 'match_id', 'position'],
  competition_seasons: ['id', 'competition_id', 'label', 'normalized_label', 'created_at'],
  managed_teams: ['id', 'name', 'normalized_name', 'region', 'normalized_region', 'created_at', 'updated_at'],
  season_participants: ['season_id', 'team_id', 'joined_at'],
  competition_stages: ['id', 'season_id', 'name', 'normalized_name', 'display_order', 'created_at'],
  competition_rounds: ['id', 'season_id', 'stage_id', 'name', 'normalized_name', 'display_order', 'created_at'],
  competition_matches: [
    'id',
    'season_id',
    'stage_id',
    'round_id',
    'home_team_id',
    'away_team_id',
    'kickoff_at',
    'status',
    'home_score',
    'away_score',
    'created_at',
    'updated_at',
  ],
  match_results: ['match_id', 'home_score', 'away_score', 'updated_at'],
  match_result_history: [
    'id',
    'match_id',
    'change_type',
    'status',
    'home_score',
    'away_score',
    'kickoff_at',
    'recorded_at',
    'stage_id',
    'round_id',
  ],
  competition_teams: ['competition_id', 'team_id', 'associated_at'],
  // PD-ARCH-01H (0033): editorial copy.
  editorial_generations: [
    'id',
    'project_id',
    'draft_id',
    'request_key',
    'request_hash',
    'deliverables',
    'instructions',
    'adapter',
    'writer_kind',
    'model',
    'prompt_version',
    'research_mode',
    'context',
    'billed',
    'status',
    'error_code',
    'usage_input',
    'usage_output',
    'estimated_cost',
    'computed_cost',
    'created_at',
    'completed_at',
  ],
  editorial_versions: [
    'id',
    'project_id',
    'draft_id',
    'deliverable',
    'version_number',
    'origin',
    'generation_id',
    'base_version_id',
    'instructions',
    'raw',
    'fields',
    'flags',
    'fact_ids',
    'event_ids',
    'evidence_ids',
    'created_at',
    'approved_at',
    'superseded_at',
  ],
};

/** Foreign keys of data-model.md section 3 as `column -> table`. */
const EXPECTED_FOREIGN_KEYS: Readonly<Record<string, readonly string[]>> = {
  projects: [
    'source_id -> sources',
    'visual_template_id -> visual_templates',
    'visual_template_version_id -> visual_template_versions',
  ],
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
  competition_seasons: ['competition_id -> competitions'],
  season_participants: ['season_id -> competition_seasons', 'team_id -> managed_teams'],
  competition_stages: ['season_id -> competition_seasons'],
  competition_rounds: [
    'season_id -> competition_seasons',
    'season_id -> competition_stages',
    'stage_id -> competition_stages',
  ],
  competition_matches: [
    'away_team_id -> season_participants',
    'home_team_id -> season_participants',
    'round_id -> competition_rounds',
    'season_id -> competition_rounds',
    'season_id -> competition_seasons',
    'season_id -> competition_stages',
    'season_id -> season_participants',
    'season_id -> season_participants',
    'stage_id -> competition_rounds',
    'stage_id -> competition_stages',
  ],
  match_results: ['match_id -> competition_matches'],
  match_result_history: [
    'match_id -> competition_matches',
    'round_id -> competition_rounds',
    'stage_id -> competition_stages',
  ],
  competition_teams: ['competition_id -> competitions', 'team_id -> managed_teams'],
  competition_provider_bindings: ['competition_id -> competitions'],
  competition_import_operations: [
    'binding_id -> competition_provider_bindings',
    'competition_id -> competitions',
    'destination_season_id -> competition_seasons',
    'preview_id -> competition_import_previews',
  ],
  competition_import_operation_events: ['operation_id -> competition_import_operations'],
  external_identity_mappings: ['binding_id -> competition_provider_bindings', 'competition_id -> competitions'],
  competition_import_applications: [
    'binding_id -> competition_provider_bindings',
    'competition_id -> competitions',
    'destination_season_id -> competition_seasons',
  ],
  competition_import_apply_operations: [
    'application_id -> competition_import_applications',
    'binding_id -> competition_provider_bindings',
    'competition_id -> competitions',
  ],
  competition_import_apply_events: ['operation_id -> competition_import_apply_operations'],
  competition_import_decisions: ['application_id -> competition_import_applications'],
  sports_field_provenance: ['competition_id -> competitions'],
  sports_field_provenance_events: ['competition_id -> competitions'],
  content_generation_batches: [
    'competition_id -> competitions',
    'import_id -> imports',
    'season_id -> competition_seasons',
  ],
  content_generation_items: [
    'batch_id -> content_generation_batches',
    'initial_run_id -> workflow_runs',
    'project_id -> projects',
    'selection_version_id -> manual_selection_versions',
  ],
  content_generation_item_matches: ['item_id -> content_generation_items', 'match_id -> competition_matches'],
  competition_import_previews: [
    'binding_id -> competition_provider_bindings',
    'competition_id -> competitions',
    'destination_season_id -> competition_seasons',
  ],
  design_generations: ['parent_proposal_id -> design_proposals'],
  design_generation_events: ['generation_id -> design_generations'],
  design_proposals: ['generation_id -> design_generations'],
  design_proposal_decisions: ['proposal_id -> design_proposals'],
  visual_templates: ['source_proposal_id -> design_proposals'],
  visual_template_versions: ['template_id -> visual_templates'],
  team_badges: ['team_id -> managed_teams'],
  project_visual_templates: [
    'project_id -> projects',
    'visual_template_id -> visual_templates',
    'visual_template_version_id -> visual_template_versions',
  ],
  editorial_generations: ['draft_id -> content_drafts', 'project_id -> projects'],
  editorial_versions: [
    'base_version_id -> editorial_versions',
    'draft_id -> content_drafts',
    'generation_id -> editorial_generations',
    'project_id -> projects',
  ],
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
  'brand_assets (kind)',
  'design_generations (created_at)',
  'design_generations (parent_proposal_id)',
  'design_generation_events (generation_id, sequence)',
  'design_proposals (created_at)',
  'design_proposal_decisions (proposal_id, sequence)',
  'visual_templates (updated_at)',
  'visual_templates (source_proposal_id)',
  'visual_template_versions (template_id)',
  'visual_template_versions (background_source, background_id)',
  'team_badges (team_id)',
  'team_badges (team_id, created_at)',
  'project_visual_templates (visual_template_id)',
  'editorial_generations (project_id, created_at, id)',
  'editorial_generations (created_at)',
  'editorial_versions (draft_id, deliverable, version_number)',
  'imports (received_at)',
  'manual_selection_versions (competition_id, season_id, stage_id, matchday_key, superseded_at)',
  'competitions (created_at, id)',
  'competition_seasons (competition_id, created_at, id)',
  'managed_teams (normalized_name, normalized_region, id)',
  'season_participants (team_id, season_id)',
  'competition_teams (team_id, competition_id)',
  'competition_provider_bindings (competition_id, created_at)',
  'competition_import_previews (competition_id, expires_at)',
  'competition_import_operations (competition_id, created_at)',
  'competition_import_operations (scope_key, created_at)',
  'competition_import_operation_events (operation_id, sequence)',
  'external_identity_mappings (resource, local_id)',
  'external_identity_mappings (competition_id, resource)',
  'competition_import_applications (competition_id, applied_at)',
  'competition_import_apply_operations (competition_id, created_at)',
  'competition_import_apply_events (operation_id, sequence)',
  'sports_field_provenance (competition_id, entity_type, entity_id)',
  'sports_field_provenance (competition_id, manual_override)',
  'sports_field_provenance_events (competition_id, entity_type, entity_id, recorded_at)',
  'content_generation_batches (competition_id, created_at, id)',
  'content_generation_item_matches (match_id)',
  'competition_stages (season_id, display_order, created_at, id)',
  'competition_rounds (season_id, normalized_name)',
  'competition_rounds (season_id, stage_id, normalized_name)',
  'competition_rounds (season_id, stage_id, display_order, created_at, id)',
  'competition_matches (season_id, home_team_id, away_team_id, , , kickoff_at)',
  'competition_matches (season_id, kickoff_at, created_at, id)',
  'competition_matches (season_id, stage_id, round_id, kickoff_at, id)',
  'match_result_history (match_id, recorded_at, id)',
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

describe('structure of the migrated schema', () => {
  it('applies all migrations through the current provider binding schema', () => {
    expect(
      db
        .prepare<{ version: number; name: string }>('SELECT version, name FROM schema_migrations ORDER BY version')
        .all(),
    ).toEqual([
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
      { version: 33, name: 'editorial_copy' },
      { version: 34, name: 'editorial_naming_reconcile' },
      { version: 35, name: 'qa_team_badges' },
    ]);
  });

  it('qa_results accepts the seven QA check names (OD-26, OD-56, PD-ARCH-01G-E.1) and keeps one result per version and check', () => {
    const row = db
      .prepare<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'qa_results'")
      .get();
    const list = /check_name IN \(([^)]*)\)/.exec(row?.sql ?? '')?.[1] ?? '';
    expect(list.split(',').map((name) => name.trim())).toEqual([
      "'data_match'",
      "'team_names'",
      "'text_fit'",
      "'style_consistency'",
      "'dimensions'",
      "'capitalized_tokens'",
      "'team_badges'",
    ]);
    const unique = db
      .prepare<{ name: string }>(
        "SELECT name FROM pragma_index_list('qa_results') WHERE origin = 'u' AND \"unique\" = 1",
      )
      .all()
      .map((index) =>
        db
          .prepare<{ name: string }>('SELECT name FROM pragma_index_info(?) ORDER BY seqno')
          .all([index.name])
          .map((column) => column.name),
      );
    expect(unique).toEqual([['element_version_id', 'check_name']]);
  });

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
