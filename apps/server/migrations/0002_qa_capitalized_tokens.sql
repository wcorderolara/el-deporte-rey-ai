-- Migration 0002: the qa_results check-name constraint accepts capitalized_tokens (WI-1-T56; OD-56, OD-26, OD-38).
--
-- Source: docs/work-items/WI-1/architecture/data-model.md section 3.3. Migration 0001 limits qa_results.check_name
-- to five names, so the capitalized_tokens warning of visual QA (OD-26; contract QA check list, OD-38) could not be
-- stored. SQLite cannot alter a CHECK constraint, so the table is rebuilt with the documented procedure
-- (https://www.sqlite.org/lang_altertable.html, section "Making Other Kinds Of Table Schema Changes"): create the new
-- table, copy every row, drop the old table, rename the new one. Every other column, type, constraint, the UNIQUE
-- (element_version_id, check_name) and STRICT are unchanged; the only change is the sixth name in the CHECK list.
--
-- Applied by the migration runner in one BEGIN IMMEDIATE transaction with its schema_migrations row and a
-- PRAGMA foreign_key_check. Foreign keys stay enforced (PRAGMA foreign_keys cannot change inside a transaction, and
-- the runner forbids it): no table references qa_results, so dropping it removes no parent row, and its own
-- reference to element_versions is copied with the rows unchanged. qa_results has no index other than the automatic
-- ones of its PRIMARY KEY and UNIQUE (data-model.md section 4), and no trigger or view refers to it; the automatic
-- indexes are rebuilt with the table and renamed with it. This file must not contain transaction control statements.

CREATE TABLE qa_results_next (
  id TEXT PRIMARY KEY,
  element_version_id TEXT NOT NULL REFERENCES element_versions,
  check_name TEXT NOT NULL CHECK (
    check_name IN (
      'data_match', 'team_names', 'text_fit', 'style_consistency', 'dimensions', 'capitalized_tokens'
    )
  ),
  outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'fail')),
  severity TEXT NOT NULL CHECK (severity IN ('blocking', 'warning')),
  details TEXT NOT NULL CHECK (json_valid(details)),
  acknowledged_at TEXT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (element_version_id, check_name)
) STRICT;

INSERT INTO qa_results_next (
  id, element_version_id, check_name, outcome, severity, details, acknowledged_at, created_at
)
SELECT id, element_version_id, check_name, outcome, severity, details, acknowledged_at, created_at
FROM qa_results;

DROP TABLE qa_results;

ALTER TABLE qa_results_next RENAME TO qa_results;
