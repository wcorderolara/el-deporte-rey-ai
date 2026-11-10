-- Reconciles the field provenance tables with 0016 as it stands. An earlier draft of 0016 declared
-- `last_application_id` and `application_id` as foreign keys to competition_import_applications; databases migrated
-- with that draft reject every import confirmation, because the enclosing transaction inserts the application audit
-- row after all sports writes succeed. Both columns are soft references. The tables are rebuilt with the declared
-- definition and every row is kept; on a database already migrated with the final 0016 the result is identical.
ALTER TABLE sports_field_provenance RENAME TO sports_field_provenance_0031;
CREATE TABLE sports_field_provenance (
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('season','team','stage','round','match','result')),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('manual','provider','manual_override')),
  provider_key TEXT NULL,
  external_reference TEXT NULL,
  provider_value_json TEXT NULL CHECK (provider_value_json IS NULL OR json_valid(provider_value_json)),
  provider_value_present INTEGER NOT NULL DEFAULT 0 CHECK (provider_value_present IN (0, 1)),
  manual_override INTEGER NOT NULL DEFAULT 0 CHECK (manual_override IN (0, 1)),
  -- Soft reference: the enclosing transaction inserts the application audit row after all sports writes succeed.
  last_application_id TEXT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (competition_id, entity_type, entity_id, field_name)
) STRICT;
INSERT INTO sports_field_provenance (
  competition_id, entity_type, entity_id, field_name, origin, provider_key, external_reference,
  provider_value_json, provider_value_present, manual_override, last_application_id, updated_at
)
SELECT
  competition_id, entity_type, entity_id, field_name, origin, provider_key, external_reference,
  provider_value_json, provider_value_present, manual_override, last_application_id, updated_at
FROM sports_field_provenance_0031;
DROP TABLE sports_field_provenance_0031;
CREATE INDEX idx_sports_field_provenance_entity
  ON sports_field_provenance (competition_id, entity_type, entity_id);
CREATE INDEX idx_sports_field_provenance_protected
  ON sports_field_provenance (competition_id, manual_override) WHERE manual_override = 1;

ALTER TABLE sports_field_provenance_events RENAME TO sports_field_provenance_events_0031;
CREATE TABLE sports_field_provenance_events (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('season','team','stage','round','match','result')),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('manual_edit','provider_applied','keep_local','accept_provider','protection_removed')),
  previous_origin TEXT NULL,
  next_origin TEXT NOT NULL,
  provider_value_json TEXT NULL CHECK (provider_value_json IS NULL OR json_valid(provider_value_json)),
  application_id TEXT NULL,
  recorded_at TEXT NOT NULL
) STRICT;
INSERT INTO sports_field_provenance_events (
  id, competition_id, entity_type, entity_id, field_name, action, previous_origin, next_origin, provider_value_json,
  application_id, recorded_at
)
SELECT
  id, competition_id, entity_type, entity_id, field_name, action, previous_origin, next_origin, provider_value_json,
  application_id, recorded_at
FROM sports_field_provenance_events_0031;
DROP TABLE sports_field_provenance_events_0031;
CREATE INDEX idx_sports_field_provenance_events_entity
  ON sports_field_provenance_events (competition_id, entity_type, entity_id, recorded_at DESC);
