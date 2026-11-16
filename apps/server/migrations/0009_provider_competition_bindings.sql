-- Provider bindings are separate from locally managed competition data. Unlinked/replaced records remain auditable.
CREATE TABLE competition_provider_bindings (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL CHECK (length(provider_key) BETWEEN 1 AND 40),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 41),
  external_competition_id TEXT NOT NULL CHECK (length(external_competition_id) BETWEEN 1 AND 120),
  mode TEXT NOT NULL CHECK (mode IN ('provider', 'hybrid')),
  status TEXT NOT NULL CHECK (status IN ('active', 'replaced', 'unlinked')),
  linked_at TEXT NOT NULL,
  unlinked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((status = 'active' AND unlinked_at IS NULL) OR (status <> 'active' AND unlinked_at IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX uq_competition_provider_binding_active
  ON competition_provider_bindings (competition_id) WHERE status = 'active';
CREATE INDEX idx_competition_provider_bindings_history
  ON competition_provider_bindings (competition_id, created_at DESC);
