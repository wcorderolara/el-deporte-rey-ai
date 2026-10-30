-- Competition-local seasons and a reusable local team catalogue.
CREATE TABLE competition_seasons (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  normalized_label TEXT NOT NULL CHECK (length(normalized_label) >= 1),
  created_at TEXT NOT NULL,
  UNIQUE (competition_id, normalized_label)
) STRICT;

CREATE INDEX idx_competition_seasons_competition_created
  ON competition_seasons (competition_id, created_at DESC, id DESC);

CREATE TABLE managed_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64),
  normalized_name TEXT NOT NULL CHECK (length(normalized_name) >= 1),
  region TEXT NULL CHECK (region IS NULL OR length(region) BETWEEN 1 AND 80),
  normalized_region TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (normalized_name, normalized_region)
) STRICT;

CREATE INDEX idx_managed_teams_name ON managed_teams (normalized_name, normalized_region, id);

CREATE TABLE season_participants (
  season_id TEXT NOT NULL REFERENCES competition_seasons,
  team_id TEXT NOT NULL REFERENCES managed_teams,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (season_id, team_id)
) STRICT;

CREATE INDEX idx_season_participants_team ON season_participants (team_id, season_id);
