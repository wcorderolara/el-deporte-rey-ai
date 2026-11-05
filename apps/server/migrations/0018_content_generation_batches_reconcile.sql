-- PD-ARCH-01E-A reconciliation: a development database applied an early draft of 0017 whose content generation
-- tables lack the frozen-selection columns (`import_id`, `selection_version_id`). The migration runner never applies a
-- version twice, so this migration recreates the three tables with their final definition (identical to 0017).
--
-- Those draft tables can hold no usable row: every batch insert of the final code writes the missing columns. The
-- guard below aborts the whole migration, changing nothing, if any row exists, so no data can be dropped silently.
CREATE TEMP TABLE content_generation_reconcile_guard (rows INTEGER NOT NULL CHECK (rows = 0));
INSERT INTO content_generation_reconcile_guard (rows)
  SELECT (SELECT COUNT(*) FROM content_generation_item_matches)
       + (SELECT COUNT(*) FROM content_generation_items)
       + (SELECT COUNT(*) FROM content_generation_batches);
DROP TABLE content_generation_reconcile_guard;

DROP INDEX IF EXISTS idx_content_generation_item_matches_match;
DROP INDEX IF EXISTS idx_content_generation_batches_competition;
DROP TABLE content_generation_item_matches;
DROP TABLE content_generation_items;
DROP TABLE content_generation_batches;

CREATE TABLE content_generation_batches (
  id TEXT PRIMARY KEY,
  -- The form import that froze the batch's local values (one version per generated item).
  import_id TEXT NOT NULL UNIQUE REFERENCES imports(id) ON DELETE RESTRICT,
  -- Client-generated idempotency key: a retried confirmation returns the same batch instead of a second one.
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  competition_name TEXT NOT NULL CHECK (length(competition_name) BETWEEN 1 AND 80),
  season_id TEXT NOT NULL REFERENCES competition_seasons(id) ON DELETE RESTRICT,
  season_label TEXT NOT NULL CHECK (length(season_label) BETWEEN 1 AND 80),
  -- Soft references: rounds without matches may be deleted later; the labels keep the generated context readable.
  stage_id TEXT NULL,
  stage_name TEXT NULL CHECK (stage_name IS NULL OR length(stage_name) BETWEEN 1 AND 80),
  round_id TEXT NOT NULL,
  round_name TEXT NOT NULL CHECK (length(round_name) BETWEEN 1 AND 80),
  -- The stage label of every project of the batch and of its research snapshots: the round, prefixed by its stage.
  selection_label TEXT NOT NULL CHECK (length(selection_label) BETWEEN 1 AND 80),
  language TEXT NOT NULL CHECK (language IN ('es', 'en')),
  created_at TEXT NOT NULL,
  CHECK ((stage_id IS NULL) = (stage_name IS NULL))
) STRICT;

CREATE INDEX idx_content_generation_batches_competition
  ON content_generation_batches (competition_id, created_at DESC, id DESC);

CREATE TABLE content_generation_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES content_generation_batches(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('round_results', 'match_result')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  project_id TEXT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
  initial_run_id TEXT NULL REFERENCES workflow_runs(id) ON DELETE RESTRICT,
  selection_version_id TEXT NULL UNIQUE REFERENCES manual_selection_versions(id) ON DELETE RESTRICT,
  skip_reason TEXT NULL CHECK (skip_reason IS NULL OR skip_reason IN ('no_eligible_matches', 'not_finished',
    'score_missing', 'kickoff_missing', 'team_name_not_supported', 'context_not_supported')),
  UNIQUE (batch_id, position),
  CHECK ((project_id IS NULL) = (initial_run_id IS NULL)),
  CHECK ((project_id IS NULL) = (selection_version_id IS NULL)),
  CHECK ((project_id IS NULL) <> (skip_reason IS NULL))
) STRICT;

CREATE TABLE content_generation_item_matches (
  item_id TEXT NOT NULL REFERENCES content_generation_items(id) ON DELETE RESTRICT,
  match_id TEXT NOT NULL REFERENCES competition_matches(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 1),
  PRIMARY KEY (item_id, match_id),
  UNIQUE (item_id, position)
) STRICT;

CREATE INDEX idx_content_generation_item_matches_match ON content_generation_item_matches (match_id);
