-- PD-ARCH-01E-B: slide types of matches not played yet (round_overview, fixture, match_preview). SQLite cannot change
-- the slide_type CHECK of `elements`, so the table is rebuilt in this transaction without touching any other table:
-- its rows are copied aside, the table is dropped and created again under the same name with the wider CHECK, and
-- the rows are inserted back in their order. References from element_versions resolve again before the commit
-- (deferred foreign keys), and the runner's foreign_key_check confirms it. IDs, columns and values are unchanged.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE elements_rebuild (
  id TEXT NOT NULL,
  carousel_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  position INTEGER NOT NULL,
  slide_type TEXT NULL,
  slide_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  current_version_id TEXT NULL,
  original_rowid INTEGER NOT NULL
) STRICT;

INSERT INTO elements_rebuild
  (id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id, original_rowid)
SELECT id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id, rowid
FROM elements ORDER BY rowid;

DROP INDEX IF EXISTS idx_elements_carousel;
DROP TABLE elements;

CREATE TABLE elements (
  id TEXT PRIMARY KEY,
  carousel_id TEXT NOT NULL REFERENCES carousels,
  kind TEXT NOT NULL CHECK (kind IN ('slide', 'caption')),
  position INTEGER NOT NULL,
  slide_type TEXT NULL CHECK (slide_type IN ('cover', 'match_result', 'standings', 'closing', 'round_overview',
    'fixture', 'match_preview')),
  slide_key TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (json_valid(subject)),
  current_version_id TEXT NULL REFERENCES element_versions,
  UNIQUE (carousel_id, position),
  CHECK ((kind = 'slide') = (slide_type IS NOT NULL))
) STRICT;

INSERT INTO elements (rowid, id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id)
SELECT original_rowid, id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id
FROM elements_rebuild ORDER BY original_rowid;

DROP TABLE elements_rebuild;

CREATE INDEX idx_elements_carousel ON elements (carousel_id);
