-- Migration 0001: initial MVP schema (WI-1-T18).
--
-- Source: docs/work-items/WI-1/architecture/data-model.md sections 2 to 5, as revised by T11G (PD-12, PD-13, PD-14):
-- every table, check constraint and index of sections 3 and 4. Conventions (section 2): STRICT tables; text UUID IDs
-- (slugs for catalogue, season, stage and team keys and configured source IDs); ISO-8601 UTC times with milliseconds;
-- JSON columns as TEXT with json_valid; enumerations as TEXT with CHECK (... IN (...)); no row is ever deleted (OD-08).
-- No table or column holds player-level, person, user-account, credential or secret data (section 5; R-112, R-113,
-- R-233), which the schema test of T18 checks.
--
-- Applied by the migration runner (apps/server/src/platform/db/migrations.ts) in one BEGIN IMMEDIATE transaction
-- with its schema_migrations row. This file must not contain transaction control statements.

-- 3.1 Projects and runs ------------------------------------------------------------------------------------------

-- The runner creates this table before applying any migration; the identical definition is repeated here so that
-- the migration describes the whole schema.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

-- 3.2 (first, referenced by projects) Sources: upserted from the configuration at startup.
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA')),
  role TEXT NOT NULL CHECK (role IN ('primary', 'verification')),
  official_publication INTEGER NOT NULL CHECK (official_publication IN (0, 1)),
  accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
  independence_group TEXT NOT NULL,
  publication_permission TEXT NOT NULL CHECK (publication_permission IN ('confirmed', 'unconfirmed', 'not_applicable')),
  adapter TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
) STRICT;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  competition_name TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources,
  data_mode TEXT NOT NULL CHECK (data_mode IN ('LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA')),
  season_id TEXT NOT NULL,
  season_label TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  matchday INTEGER NULL CHECK (matchday IS NULL OR matchday > 0),
  selection_ref TEXT NOT NULL CHECK (json_valid(selection_ref) AND length(selection_ref) <= 512),
  standings_expected TEXT NOT NULL CHECK (standings_expected IN ('expected', 'not_expected', 'unknown')),
  language TEXT NOT NULL CHECK (language IN ('es', 'en')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects,
  run_number INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('full', 'redraft')),
  base_run_id TEXT NULL REFERENCES workflow_runs,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  failure TEXT NULL CHECK (failure IS NULL OR (json_valid(failure) AND length(failure) <= 600)),
  config_snapshot TEXT NOT NULL CHECK (json_valid(config_snapshot)),
  standings_availability TEXT NULL CHECK (standings_availability IS NULL OR json_valid(standings_availability)),
  started_at TEXT NULL,
  finished_at TEXT NULL,
  UNIQUE (project_id, run_number)
) STRICT;

CREATE TABLE stage_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs,
  stage TEXT NOT NULL CHECK (stage IN ('research', 'verification', 'content', 'rendering', 'visual_qa')),
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  failure TEXT NULL CHECK (failure IS NULL OR (json_valid(failure) AND length(failure) <= 600)),
  started_at TEXT NULL,
  finished_at TEXT NULL,
  UNIQUE (run_id, stage)
) STRICT;

-- 3.5 MANUAL_DATA imports (AD-29); before 3.2 because retrievals and observations reference import versions -----

CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources,
  channel TEXT NOT NULL CHECK (channel IN ('json_file', 'csv_file', 'form')),
  file_name TEXT NULL CHECK (file_name IS NULL OR length(file_name) BETWEEN 6 AND 120),
  declared_source TEXT NULL CHECK (declared_source IS NULL OR length(declared_source) BETWEEN 1 AND 80),
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  original_path TEXT NOT NULL,
  original_sha256 TEXT NOT NULL,
  original_bytes INTEGER NOT NULL CHECK (original_bytes BETWEEN 1 AND 524288),
  received_at TEXT NOT NULL,
  CHECK ((channel = 'form') = (file_name IS NULL))
) STRICT;

CREATE TABLE manual_competitions (
  competition_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources,
  name TEXT NOT NULL,
  area_name TEXT NULL,
  first_import_id TEXT NOT NULL REFERENCES imports
) STRICT;

CREATE TABLE manual_seasons (
  competition_id TEXT NOT NULL REFERENCES manual_competitions,
  season_id TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (competition_id, season_id)
) STRICT;

CREATE TABLE manual_selection_versions (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES imports,
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  matchday_key INTEGER NOT NULL CHECK (matchday_key >= 0),
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL,
  superseded_at TEXT NULL,
  UNIQUE (competition_id, season_id, stage_id, matchday_key, version_number),
  FOREIGN KEY (competition_id, season_id) REFERENCES manual_seasons
) STRICT;

-- 3.2 Retrievals, teams, observations and facts ------------------------------------------------------------------

CREATE TABLE retrievals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs,
  source_id TEXT NOT NULL REFERENCES sources,
  data_mode TEXT NOT NULL CHECK (data_mode IN ('LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA')),
  stage TEXT NOT NULL CHECK (stage IN ('research', 'verification', 'consultation')),
  resource TEXT NOT NULL CHECK (resource IN ('selection_matches', 'selection_standings', 'selection')),
  retrieved_at TEXT NOT NULL,
  from_cache INTEGER NOT NULL CHECK (from_cache IN (0, 1)),
  outcome TEXT NOT NULL CHECK (outcome IN ('ok', 'failed', 'not_available')),
  failure TEXT NULL CHECK (failure IS NULL OR (json_valid(failure) AND length(failure) <= 600)),
  import_version_id TEXT NULL REFERENCES manual_selection_versions
) STRICT;

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  season_id TEXT NOT NULL
) STRICT;

CREATE TABLE team_aliases (
  team_id TEXT NOT NULL REFERENCES teams,
  source_id TEXT NULL REFERENCES sources,
  alias TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('source', 'identity_map')),
  PRIMARY KEY (team_id, alias)
) STRICT;

CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs,
  retrieval_id TEXT NOT NULL REFERENCES retrievals,
  source_id TEXT NOT NULL REFERENCES sources,
  data_mode TEXT NOT NULL CHECK (data_mode IN ('LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA')),
  import_version_id TEXT NULL REFERENCES manual_selection_versions,
  stage TEXT NOT NULL CHECK (stage IN ('research', 'verification', 'consultation')),
  fact_key TEXT NOT NULL,
  value TEXT NOT NULL CHECK (json_valid(value)),
  source_ref TEXT NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 512),
  retrieved_at TEXT NOT NULL,
  UNIQUE (run_id, source_id, stage, fact_key),
  CHECK ((data_mode = 'MANUAL_DATA') = (import_version_id IS NOT NULL))
) STRICT;

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs,
  fact_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'match_teams',
      'match_kickoff',
      'match_status',
      'match_score',
      'standing_row',
      'matchday_info',
      'context_item',
      'team_official_name'
    )
  ),
  subject TEXT NOT NULL CHECK (json_valid(subject)),
  status TEXT NOT NULL CHECK (status IN ('verified', 'unverified')),
  unverified_reason TEXT NULL CHECK (
    unverified_reason IN (
      'awaiting_independent_verification',
      'disputed',
      'no_accepted_source',
      'team_identity_unmatched'
    )
  ),
  value TEXT NULL CHECK (value IS NULL OR json_valid(value)),
  candidate_value TEXT NULL CHECK (candidate_value IS NULL OR json_valid(candidate_value)),
  manual_eligible INTEGER NOT NULL CHECK (manual_eligible IN (0, 1)),
  reason TEXT NULL,
  decided_at TEXT NOT NULL,
  UNIQUE (run_id, fact_key),
  CHECK ((status = 'verified') = (value IS NOT NULL)),
  CHECK ((status = 'verified') = (unverified_reason IS NULL)),
  CHECK (status = 'unverified' OR candidate_value IS NULL),
  CHECK (unverified_reason IS NOT 'disputed' OR candidate_value IS NULL),
  CHECK (
    manual_eligible = 0
    OR (status = 'unverified' AND unverified_reason IN ('no_accepted_source', 'awaiting_independent_verification'))
  )
) STRICT;

CREATE TABLE manual_approvals (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL REFERENCES facts,
  action TEXT NOT NULL CHECK (action IN ('approved', 'revoked')),
  carried_over_from_fact_id TEXT NULL REFERENCES facts,
  at TEXT NOT NULL
) STRICT;

CREATE TABLE fact_evidence (
  fact_id TEXT NOT NULL REFERENCES facts,
  observation_id TEXT NOT NULL REFERENCES observations,
  relation TEXT NOT NULL CHECK (relation IN ('supports', 'disagrees', 'consulted')),
  PRIMARY KEY (fact_id, observation_id)
) STRICT;

CREATE TABLE disputes (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL UNIQUE REFERENCES facts,
  source_values TEXT NOT NULL CHECK (json_valid(source_values)),
  consulted_source_id TEXT NULL REFERENCES sources,
  consulted_observation_id TEXT NULL REFERENCES observations,
  consulted_at TEXT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('resolved', 'unavailable', 'same_source', 'no_match')),
  resolved_value TEXT NULL CHECK (resolved_value IS NULL OR json_valid(resolved_value)),
  CHECK ((outcome = 'resolved') = (resolved_value IS NOT NULL))
) STRICT;

-- 3.3 Content, rendering and QA ----------------------------------------------------------------------------------

CREATE TABLE content_drafts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects,
  run_id TEXT NOT NULL REFERENCES workflow_runs,
  facts_run_id TEXT NOT NULL REFERENCES workflow_runs,
  language TEXT NOT NULL CHECK (language IN ('es', 'en')),
  standings_included INTEGER NOT NULL CHECK (standings_included IN (0, 1)),
  excluded_match_keys TEXT NOT NULL CHECK (json_valid(excluded_match_keys)),
  left_out_matches TEXT NOT NULL CHECK (json_valid(left_out_matches)),
  created_at TEXT NOT NULL,
  superseded_at TEXT NULL
) STRICT;

CREATE TABLE carousels (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES content_drafts,
  sequence INTEGER NOT NULL,
  total INTEGER NOT NULL,
  UNIQUE (draft_id, sequence)
) STRICT;

CREATE TABLE elements (
  id TEXT PRIMARY KEY,
  carousel_id TEXT NOT NULL REFERENCES carousels,
  kind TEXT NOT NULL CHECK (kind IN ('slide', 'caption')),
  position INTEGER NOT NULL,
  slide_type TEXT NULL CHECK (slide_type IN ('cover', 'match_result', 'standings', 'closing')),
  slide_key TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (json_valid(subject)),
  current_version_id TEXT NULL REFERENCES element_versions,
  UNIQUE (carousel_id, position),
  CHECK ((kind = 'slide') = (slide_type IS NOT NULL))
) STRICT;

CREATE TABLE element_versions (
  id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL REFERENCES elements,
  version_number INTEGER NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('generated', 'regenerated')),
  text TEXT NOT NULL CHECK (json_valid(text)),
  content_flags TEXT NOT NULL CHECK (json_valid(content_flags)),
  ai_adapter TEXT NOT NULL,
  template_id TEXT NULL,
  template_version TEXT NULL,
  render_model TEXT NULL CHECK (render_model IS NULL OR json_valid(render_model)),
  image_path TEXT NULL,
  image_sha256 TEXT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  qa_status TEXT NOT NULL CHECK (qa_status IN ('pending', 'passed', 'failed', 'warnings')),
  created_at TEXT NOT NULL,
  superseded_at TEXT NULL,
  UNIQUE (element_id, version_number)
) STRICT;

CREATE TABLE element_fact_refs (
  element_version_id TEXT NOT NULL REFERENCES element_versions,
  fact_id TEXT NOT NULL REFERENCES facts,
  usage TEXT NOT NULL CHECK (usage IN ('template', 'placeholder')),
  PRIMARY KEY (element_version_id, fact_id)
) STRICT;

CREATE TABLE qa_results (
  id TEXT PRIMARY KEY,
  element_version_id TEXT NOT NULL REFERENCES element_versions,
  check_name TEXT NOT NULL CHECK (
    check_name IN ('data_match', 'team_names', 'text_fit', 'style_consistency', 'dimensions')
  ),
  outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'fail')),
  severity TEXT NOT NULL CHECK (severity IN ('blocking', 'warning')),
  details TEXT NOT NULL CHECK (json_valid(details)),
  acknowledged_at TEXT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (element_version_id, check_name)
) STRICT;

-- 3.4 Approval, export and brand ---------------------------------------------------------------------------------

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  element_version_id TEXT NOT NULL REFERENCES element_versions,
  action TEXT NOT NULL CHECK (action IN ('approved', 'withdrawn')),
  at TEXT NOT NULL
) STRICT;

CREATE TABLE final_approvals (
  id TEXT PRIMARY KEY,
  carousel_id TEXT NOT NULL REFERENCES carousels,
  version_set TEXT NOT NULL CHECK (json_valid(version_set)),
  version_set_sha256 TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  invalidated_at TEXT NULL
) STRICT;

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  carousel_id TEXT NOT NULL REFERENCES carousels,
  final_approval_id TEXT NOT NULL REFERENCES final_approvals,
  exported_at TEXT NOT NULL,
  directory TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  data_mode TEXT NOT NULL CHECK (data_mode IN ('LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA'))
) STRICT;

CREATE TABLE export_files (
  export_id TEXT NOT NULL REFERENCES exports,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slide_image', 'caption_text', 'manifest')),
  element_version_id TEXT NULL REFERENCES element_versions,
  file_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY (export_id, file_name)
) STRICT;

CREATE TABLE brand_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('brand_logo', 'mascot', 'decoration')),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  registered_at TEXT NOT NULL,
  deactivated_at TEXT NULL
) STRICT;

-- 4. Indexes -----------------------------------------------------------------------------------------------------

CREATE INDEX idx_workflow_runs_project_status ON workflow_runs (project_id, status);
CREATE INDEX idx_stage_runs_run ON stage_runs (run_id);
CREATE INDEX idx_retrievals_run ON retrievals (run_id);
CREATE INDEX idx_observations_run_fact_key ON observations (run_id, fact_key);
CREATE INDEX idx_facts_run_status ON facts (run_id, status);
CREATE INDEX idx_manual_approvals_fact_at ON manual_approvals (fact_id, at);
CREATE INDEX idx_fact_evidence_observation ON fact_evidence (observation_id);
CREATE INDEX idx_content_drafts_project_superseded ON content_drafts (project_id, superseded_at);
CREATE INDEX idx_elements_carousel ON elements (carousel_id);
CREATE INDEX idx_element_versions_element_superseded ON element_versions (element_id, superseded_at);
CREATE INDEX idx_element_fact_refs_fact ON element_fact_refs (fact_id);
CREATE INDEX idx_approvals_element_version_at ON approvals (element_version_id, at);
CREATE INDEX idx_final_approvals_carousel_invalidated ON final_approvals (carousel_id, invalidated_at);
CREATE INDEX idx_exports_carousel ON exports (carousel_id);
CREATE INDEX idx_brand_assets_kind_active ON brand_assets (kind, active);
CREATE INDEX idx_imports_received ON imports (received_at);
CREATE INDEX idx_manual_selection_versions_selection
  ON manual_selection_versions (competition_id, season_id, stage_id, matchday_key, superseded_at);
