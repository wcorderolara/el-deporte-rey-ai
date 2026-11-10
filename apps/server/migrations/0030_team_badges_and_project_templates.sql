-- PD-ARCH-01G-D: team badges and the visual template of a project. Additive only; no existing column changes.
--
-- team_badges keeps every badge uploaded for a local team (PD-28: uploaded manually by the operator as a PNG or JPEG
-- file, with its declared source and a confirmed authorization; never downloaded from a provider or a URL). The file
-- is under `<dataDir>/team-badges/` in the confined file store, never in SQLite. At most one badge of a team is
-- active; replacing it adds a row and retires the previous one, and retiring keeps the row and the file, so a project
-- that used a badge can always draw it again. `origin` records where the badge came from; only `manual` is created
-- (PD-28).
--
-- projects gains the visual template version a generated project uses (a published, immutable version) and the
-- badge of each team of its matches when it was created (`{ "<teamId>": "<badgeId>" | null }`); both are null for
-- projects without a visual template, which render exactly as before.
CREATE TABLE team_badges (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES managed_teams (id) ON DELETE RESTRICT,
  file_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 1),
  origin TEXT NOT NULL CHECK (origin IN ('manual', 'provider')),
  source_note TEXT NOT NULL CHECK (length(source_note) BETWEEN 1 AND 200),
  authorization_confirmed INTEGER NOT NULL CHECK (authorization_confirmed = 1),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at TEXT NOT NULL,
  retired_at TEXT NULL,
  CHECK ((status = 'retired') = (retired_at IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX idx_team_badges_active ON team_badges (team_id) WHERE status = 'active';
CREATE INDEX idx_team_badges_team ON team_badges (team_id, created_at);

ALTER TABLE projects ADD COLUMN visual_template_id TEXT NULL REFERENCES visual_templates (id);
ALTER TABLE projects ADD COLUMN visual_template_version_id TEXT NULL REFERENCES visual_template_versions (id);
ALTER TABLE projects ADD COLUMN badge_snapshot_json TEXT NULL
  CHECK (badge_snapshot_json IS NULL OR (json_valid(badge_snapshot_json) AND json_type(badge_snapshot_json) = 'object'));
