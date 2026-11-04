-- Short-lived, immutable normalized import snapshots. These rows never write imported data into sports domain tables.
CREATE TABLE competition_import_previews (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  binding_id TEXT NOT NULL REFERENCES competition_provider_bindings(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  external_season_id TEXT NOT NULL,
  destination_season_id TEXT NULL REFERENCES competition_seasons(id) ON DELETE RESTRICT,
  resources_json TEXT NOT NULL CHECK (json_valid(resources_json)),
  preview_json TEXT NOT NULL CHECK (json_valid(preview_json)),
  retrieved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL CHECK (length(snapshot_hash) = 64),
  local_fingerprint TEXT NOT NULL CHECK (length(local_fingerprint) = 64)
) STRICT;

CREATE INDEX idx_competition_import_previews_scope_expiry
  ON competition_import_previews (competition_id, expires_at);
