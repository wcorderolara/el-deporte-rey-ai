-- PD-ARCH-01E-B reconciliation: a development database applied an early draft of 0021 that only added
-- `projects.content_kind`, without rebuilding the content generation item tables. Their CHECK constraints still refuse
-- the piece kinds and skip reasons of matches not played yet. The migration runner never applies a version twice, so
-- this migration rebuilds both tables again with their final definition (identical to 0021).
--
-- Every row, ID and order is preserved, so the migration is safe on every database: where 0021 already rebuilt the
-- tables it recreates the same definition with the same rows.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE content_generation_items_new (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES content_generation_batches(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('round_results', 'match_result', 'round_calendar', 'upcoming_matches',
    'match_preview')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  project_id TEXT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
  initial_run_id TEXT NULL REFERENCES workflow_runs(id) ON DELETE RESTRICT,
  selection_version_id TEXT NULL UNIQUE REFERENCES manual_selection_versions(id) ON DELETE RESTRICT,
  skip_reason TEXT NULL CHECK (skip_reason IS NULL OR skip_reason IN ('no_eligible_matches', 'not_finished',
    'score_missing', 'kickoff_missing', 'team_name_not_supported', 'context_not_supported', 'not_upcoming',
    'already_finished')),
  UNIQUE (batch_id, position),
  CHECK ((project_id IS NULL) = (initial_run_id IS NULL)),
  CHECK ((project_id IS NULL) = (selection_version_id IS NULL)),
  CHECK ((project_id IS NULL) <> (skip_reason IS NULL))
) STRICT;

INSERT INTO content_generation_items_new
  (id, batch_id, position, kind, title, project_id, initial_run_id, selection_version_id, skip_reason)
SELECT id, batch_id, position, kind, title, project_id, initial_run_id, selection_version_id, skip_reason
FROM content_generation_items ORDER BY rowid;

CREATE TABLE content_generation_item_matches_new (
  item_id TEXT NOT NULL REFERENCES content_generation_items_new(id) ON DELETE RESTRICT,
  match_id TEXT NOT NULL REFERENCES competition_matches(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 1),
  PRIMARY KEY (item_id, match_id),
  UNIQUE (item_id, position)
) STRICT;

INSERT INTO content_generation_item_matches_new (item_id, match_id, position)
SELECT item_id, match_id, position FROM content_generation_item_matches ORDER BY rowid;

DROP INDEX IF EXISTS idx_content_generation_item_matches_match;
DROP TABLE content_generation_item_matches;
DROP TABLE content_generation_items;

ALTER TABLE content_generation_items_new RENAME TO content_generation_items;
ALTER TABLE content_generation_item_matches_new RENAME TO content_generation_item_matches;

CREATE INDEX idx_content_generation_item_matches_match ON content_generation_item_matches (match_id);
