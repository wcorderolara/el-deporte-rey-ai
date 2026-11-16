-- PD-ARCH-01D-D: field-level provenance keeps the effective value in the sports tables and records only its source,
-- last provider value and manual protection. Existing imported rows are backfilled from their confirmed baseline.
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

CREATE INDEX idx_sports_field_provenance_entity
  ON sports_field_provenance (competition_id, entity_type, entity_id);
CREATE INDEX idx_sports_field_provenance_protected
  ON sports_field_provenance (competition_id, manual_override) WHERE manual_override = 1;

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
CREATE INDEX idx_sports_field_provenance_events_entity
  ON sports_field_provenance_events (competition_id, entity_type, entity_id, recorded_at DESC);

-- Mappings created by 01D-C already contain the authoritative provider baseline. json_each preserves explicit JSON
-- null as the text "null" while the presence flag distinguishes it from a field absent from the provider response.
INSERT INTO sports_field_provenance (
  competition_id, entity_type, entity_id, field_name, origin, provider_key, external_reference,
  provider_value_json, provider_value_present, manual_override, last_application_id, updated_at
)
SELECT
  m.competition_id,
  CASE m.resource
    WHEN 'season' THEN 'season'
    WHEN 'teams' THEN 'team'
    WHEN 'stages' THEN 'stage'
    WHEN 'rounds' THEN 'round'
    WHEN 'matches' THEN CASE WHEN j.key IN ('homeScore','awayScore') THEN 'result' ELSE 'match' END
  END,
  m.local_id,
  j.key,
  'provider',
  m.provider_key,
  m.external_id,
  json_quote(j.value),
  1,
  0,
  m.last_application_id,
  m.updated_at
FROM external_identity_mappings m, json_each(m.baseline_json) j
WHERE m.competition_id IS NOT NULL
  AND m.baseline_json IS NOT NULL
  AND m.resource IN ('season','teams','stages','rounds','matches')
  AND j.type IN ('null','text','integer','real');

