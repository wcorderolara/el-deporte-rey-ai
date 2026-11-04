-- Additive completion of 0013. Mappings gain their owning competition/binding, the opaque provider label and the
-- last imported baseline of each synchronized field; confirmed applications run as durable operations.
ALTER TABLE external_identity_mappings
  ADD COLUMN competition_id TEXT NULL REFERENCES competitions(id) ON DELETE RESTRICT;
ALTER TABLE external_identity_mappings
  ADD COLUMN binding_id TEXT NULL REFERENCES competition_provider_bindings(id) ON DELETE RESTRICT;
ALTER TABLE external_identity_mappings
  ADD COLUMN external_label TEXT NULL CHECK (external_label IS NULL OR length(external_label) BETWEEN 1 AND 200);
ALTER TABLE external_identity_mappings
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'created' CHECK (origin IN ('created', 'linked'));
ALTER TABLE external_identity_mappings
  ADD COLUMN baseline_json TEXT NULL CHECK (baseline_json IS NULL OR json_valid(baseline_json));
ALTER TABLE external_identity_mappings
  ADD COLUMN last_application_id TEXT NULL;

-- One external identity per local record and provider resource: two external teams can never merge into one.
CREATE UNIQUE INDEX uq_external_identity_local
  ON external_identity_mappings (provider_key, resource, local_id);
CREATE INDEX idx_external_identity_competition
  ON external_identity_mappings (competition_id, resource);

CREATE TABLE competition_import_apply_operations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  preview_id TEXT NOT NULL,
  binding_id TEXT NOT NULL REFERENCES competition_provider_bindings(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL CHECK (length(snapshot_hash) = 64),
  plan_hash TEXT NOT NULL CHECK (length(plan_hash) = 64),
  decisions_json TEXT NOT NULL CHECK (json_valid(decisions_json)),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  current_stage TEXT CHECK (current_stage IN ('validating', 'resolving_identities', 'transforming', 'persisting')),
  completed_stages_json TEXT NOT NULL CHECK (json_valid(completed_stages_json)),
  cancellation_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_requested IN (0, 1)),
  application_id TEXT REFERENCES competition_import_applications(id) ON DELETE RESTRICT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK ((status = 'completed') = (application_id IS NOT NULL))
) STRICT;

-- At most one write operation per competition, and one live or completed application per snapshot.
CREATE UNIQUE INDEX uq_import_apply_active_competition
  ON competition_import_apply_operations (competition_id) WHERE status IN ('queued', 'running');
CREATE UNIQUE INDEX uq_import_apply_preview
  ON competition_import_apply_operations (preview_id) WHERE status IN ('queued', 'running', 'completed');
CREATE INDEX idx_import_apply_operations_competition
  ON competition_import_apply_operations (competition_id, created_at DESC);

CREATE TABLE competition_import_apply_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES competition_import_apply_operations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  application_id TEXT,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_import_apply_events_operation ON competition_import_apply_events (operation_id, sequence);

-- Audit of every explicit operator decision that a confirmed application honoured.
CREATE TABLE competition_import_decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES competition_import_applications(id) ON DELETE RESTRICT,
  resource TEXT NOT NULL CHECK (resource IN ('season', 'teams', 'participants', 'stages', 'rounds', 'matches', 'results')),
  external_scope TEXT NOT NULL,
  external_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('link', 'skip', 'accept_incoming')),
  local_id TEXT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (application_id, resource, external_scope, external_id)
) STRICT;
