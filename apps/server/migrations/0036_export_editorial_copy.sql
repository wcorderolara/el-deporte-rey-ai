-- Migration 0036: the export_files kind constraint accepts editorial_text (REVIEW-APPROVAL-01; amendment of PD-33).
--
-- An export of a carousel also carries the approved editorial copy of its draft (PD-ARCH-01H deliverables), in one
-- text file next to the slides, when at least one deliverable is approved (Product Owner, 2026-11-12, option b). The
-- copy is not required for the final approval nor for the export. Migration 0001 limits export_files.kind to
-- slide_image, caption_text and manifest, so the file could not be recorded. SQLite cannot alter a CHECK constraint,
-- so the table is rebuilt with the procedure of 0002 and 0035 (https://www.sqlite.org/lang_altertable.html, section
-- "Making Other Kinds Of Table Schema Changes"): create the new table, copy every row, drop the old table, rename the
-- new one. Every other column, type, constraint, the PRIMARY KEY (export_id, file_name) and STRICT are unchanged; the
-- only change is the fourth kind in the CHECK list.
--
-- Applied by the migration runner in one BEGIN IMMEDIATE transaction with its schema_migrations row and a
-- PRAGMA foreign_key_check. No table references export_files, so dropping it removes no parent row, and its own
-- references to exports and element_versions are copied with the rows unchanged. export_files has no index other
-- than the automatic one of its PRIMARY KEY, and no trigger or view refers to it. No row changes. This file must not
-- contain transaction control statements.

CREATE TABLE export_files_next (
  export_id TEXT NOT NULL REFERENCES exports,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slide_image', 'caption_text', 'manifest', 'editorial_text')),
  element_version_id TEXT NULL REFERENCES element_versions,
  file_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY (export_id, file_name)
) STRICT;

INSERT INTO export_files_next (export_id, position, kind, element_version_id, file_name, sha256)
SELECT export_id, position, kind, element_version_id, file_name, sha256
FROM export_files;

DROP TABLE export_files;

ALTER TABLE export_files_next RENAME TO export_files;
