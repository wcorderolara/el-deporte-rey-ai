-- Durable preview work and event log. No imported sports entity is changed here.
CREATE TABLE competition_import_operations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  binding_id TEXT NOT NULL REFERENCES competition_provider_bindings(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  external_season_id TEXT NOT NULL,
  destination_season_id TEXT REFERENCES competition_seasons(id) ON DELETE RESTRICT,
  resources_json TEXT NOT NULL CHECK (json_valid(resources_json)),
  scope_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
  current_stage TEXT CHECK (current_stage IN ('fetching','normalizing','comparing','preparing_preview')),
  completed_stages_json TEXT NOT NULL CHECK (json_valid(completed_stages_json)),
  cancellation_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_requested IN (0,1)),
  preview_id TEXT REFERENCES competition_import_previews(id) ON DELETE SET NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  completed_at TEXT
) STRICT;
CREATE INDEX idx_import_operations_competition ON competition_import_operations(competition_id, created_at DESC);
CREATE INDEX idx_import_operations_scope ON competition_import_operations(scope_key, created_at DESC);
CREATE TABLE competition_import_operation_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES competition_import_operations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  preview_id TEXT,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_import_operation_events_operation ON competition_import_operation_events(operation_id, sequence);
