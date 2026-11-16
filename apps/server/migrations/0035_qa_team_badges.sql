-- Migration 0035: the qa_results check-name constraint accepts team_badges (PD-ARCH-01G-E.1; decision DE-E4).
--
-- The team_badges warning of visual QA (contract QA check list) flags a badge slot of an engine match template left
-- empty because its team has no badge in the project's snapshot (PD-28 point 4). Migrations 0001 and 0002 limit
-- qa_results.check_name to six names, so it could not be stored, and the QA stage runs only the checks the constraint
-- accepts. SQLite cannot alter a CHECK constraint, so the table is rebuilt with the procedure of 0002
-- (https://www.sqlite.org/lang_altertable.html, section "Making Other Kinds Of Table Schema Changes"): create the new
-- table, copy every row, drop the old table, rename the new one. Every other column, type, constraint, the UNIQUE
-- (element_version_id, check_name) and STRICT are unchanged; the only change is the seventh name in the CHECK list.
--
-- Applied by the migration runner in one BEGIN IMMEDIATE transaction with its schema_migrations row and a
-- PRAGMA foreign_key_check. No table references qa_results, so dropping it removes no parent row, and its own
-- reference to element_versions is copied with the rows unchanged. qa_results has no index other than the automatic
-- ones of its PRIMARY KEY and UNIQUE, and no trigger or view refers to it. No row changes. This file must not contain
-- transaction control statements.

CREATE TABLE qa_results_next (
  id TEXT PRIMARY KEY,
  element_version_id TEXT NOT NULL REFERENCES element_versions,
  check_name TEXT NOT NULL CHECK (
    check_name IN (
      'data_match', 'team_names', 'text_fit', 'style_consistency', 'dimensions', 'capitalized_tokens', 'team_badges'
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
