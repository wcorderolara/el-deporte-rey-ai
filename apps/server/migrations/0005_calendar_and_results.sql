-- Optional calendar hierarchy and manually managed season matches.
CREATE TABLE competition_stages (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES competition_seasons,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  normalized_name TEXT NOT NULL CHECK (length(normalized_name) >= 1),
  display_order INTEGER NOT NULL CHECK (display_order >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (season_id, normalized_name),
  UNIQUE (id, season_id)
) STRICT;

CREATE INDEX idx_competition_stages_season_order
  ON competition_stages (season_id, display_order, created_at, id);

CREATE TABLE competition_rounds (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES competition_seasons,
  stage_id TEXT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  normalized_name TEXT NOT NULL CHECK (length(normalized_name) >= 1),
  display_order INTEGER NOT NULL CHECK (display_order >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (stage_id, season_id) REFERENCES competition_stages (id, season_id),
  UNIQUE (id, season_id, stage_id)
) STRICT;

CREATE UNIQUE INDEX idx_competition_rounds_direct_unique
  ON competition_rounds (season_id, normalized_name) WHERE stage_id IS NULL;
CREATE UNIQUE INDEX idx_competition_rounds_stage_unique
  ON competition_rounds (season_id, stage_id, normalized_name) WHERE stage_id IS NOT NULL;
CREATE INDEX idx_competition_rounds_order
  ON competition_rounds (season_id, stage_id, display_order, created_at, id);

CREATE TABLE competition_matches (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES competition_seasons,
  stage_id TEXT NULL,
  round_id TEXT NULL,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  kickoff_at TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'finished', 'postponed', 'cancelled')),
  home_score INTEGER NULL CHECK (home_score IS NULL OR home_score >= 0),
  away_score INTEGER NULL CHECK (away_score IS NULL OR away_score >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (home_team_id <> away_team_id),
  CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score IS NOT NULL AND away_score IS NOT NULL)),
  CHECK ((status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL)
    OR (status <> 'finished' AND status NOT IN ('scheduled', 'postponed', 'cancelled'))
    OR (status IN ('scheduled', 'postponed', 'cancelled') AND home_score IS NULL AND away_score IS NULL)),
  FOREIGN KEY (stage_id, season_id) REFERENCES competition_stages (id, season_id),
  FOREIGN KEY (round_id, season_id, stage_id) REFERENCES competition_rounds (id, season_id, stage_id),
  FOREIGN KEY (season_id, home_team_id) REFERENCES season_participants (season_id, team_id),
  FOREIGN KEY (season_id, away_team_id) REFERENCES season_participants (season_id, team_id)
) STRICT;

CREATE UNIQUE INDEX idx_competition_matches_obvious_duplicate
  ON competition_matches (season_id, home_team_id, away_team_id, ifnull(stage_id, ''), ifnull(round_id, ''), kickoff_at)
  WHERE kickoff_at IS NOT NULL;
CREATE INDEX idx_competition_matches_calendar
  ON competition_matches (season_id, kickoff_at, created_at, id);
CREATE INDEX idx_competition_matches_stage_round
  ON competition_matches (season_id, stage_id, round_id, kickoff_at, id);

CREATE TRIGGER trg_match_round_context_insert
BEFORE INSERT ON competition_matches
WHEN NEW.round_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM competition_rounds r
  WHERE r.id = NEW.round_id AND r.season_id = NEW.season_id AND r.stage_id IS NEW.stage_id
)
BEGIN
  SELECT RAISE(ABORT, 'match round must belong to the selected season and stage');
END;

CREATE TRIGGER trg_match_round_context_update
BEFORE UPDATE OF season_id, stage_id, round_id ON competition_matches
WHEN NEW.round_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM competition_rounds r
  WHERE r.id = NEW.round_id AND r.season_id = NEW.season_id AND r.stage_id IS NEW.stage_id
)
BEGIN
  SELECT RAISE(ABORT, 'match round must belong to the selected season and stage');
END;

CREATE TABLE match_result_history (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES competition_matches,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'schedule_updated', 'status_updated', 'result_recorded', 'result_corrected')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'finished', 'postponed', 'cancelled')),
  home_score INTEGER NULL CHECK (home_score IS NULL OR home_score >= 0),
  away_score INTEGER NULL CHECK (away_score IS NULL OR away_score >= 0),
  kickoff_at TEXT NULL,
  recorded_at TEXT NOT NULL,
  CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score IS NOT NULL AND away_score IS NOT NULL))
) STRICT;

CREATE INDEX idx_match_result_history_match_time
  ON match_result_history (match_id, recorded_at, id);
