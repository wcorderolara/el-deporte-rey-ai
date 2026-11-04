-- Provider identities point to existing local sports entities; no parallel sports model.
CREATE TABLE external_identity_mappings (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  resource TEXT NOT NULL CHECK (resource IN ('season','teams','stages','rounds','matches','results')),
  scope_key TEXT NOT NULL,
  external_id TEXT NOT NULL,
  local_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider_key, resource, scope_key, external_id)
) STRICT;
CREATE INDEX idx_external_identity_local ON external_identity_mappings(resource, local_id);

-- Successful applications survive preview expiry and can be reopened by the operator.
CREATE TABLE competition_import_applications (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  preview_id TEXT NOT NULL UNIQUE,
  binding_id TEXT NOT NULL REFERENCES competition_provider_bindings(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL CHECK (length(snapshot_hash) = 64),
  destination_season_id TEXT NOT NULL REFERENCES competition_seasons(id) ON DELETE RESTRICT,
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  applied_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_competition_import_applications_competition
  ON competition_import_applications(competition_id, applied_at DESC);
