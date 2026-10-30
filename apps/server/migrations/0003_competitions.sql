-- Locally managed competitions are distinct from provider catalogue slugs and import-scoped records.
CREATE TABLE competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_competitions_created ON competitions (created_at DESC, id DESC);
