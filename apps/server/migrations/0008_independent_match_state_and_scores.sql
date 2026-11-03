-- Match state and score are independent operator-managed values. Rebuild the
-- referenced tables transactionally because SQLite cannot drop the old CHECK.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE competition_matches_new (
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
  FOREIGN KEY (stage_id, season_id) REFERENCES competition_stages (id, season_id),
  FOREIGN KEY (round_id, season_id, stage_id) REFERENCES competition_rounds (id, season_id, stage_id),
  FOREIGN KEY (season_id, home_team_id) REFERENCES season_participants (season_id, team_id),
  FOREIGN KEY (season_id, away_team_id) REFERENCES season_participants (season_id, team_id)
) STRICT;

INSERT INTO competition_matches_new
  (id, season_id, stage_id, round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, created_at, updated_at)
SELECT id, season_id, stage_id, round_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, created_at, updated_at
FROM competition_matches;

CREATE TABLE match_results_new (
  match_id TEXT PRIMARY KEY REFERENCES competition_matches_new (id),
  home_score INTEGER NULL CHECK (home_score IS NULL OR home_score >= 0),
  away_score INTEGER NULL CHECK (away_score IS NULL OR away_score >= 0),
  updated_at TEXT NOT NULL,
  CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score IS NOT NULL AND away_score IS NOT NULL))
) STRICT;

INSERT INTO match_results_new (match_id, home_score, away_score, updated_at)
SELECT match_id, home_score, away_score, updated_at FROM match_results;

CREATE TABLE match_result_history_new (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES competition_matches_new,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'schedule_updated', 'status_updated', 'result_recorded', 'result_corrected')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'finished', 'postponed', 'cancelled')),
  home_score INTEGER NULL CHECK (home_score IS NULL OR home_score >= 0),
  away_score INTEGER NULL CHECK (away_score IS NULL OR away_score >= 0),
  kickoff_at TEXT NULL,
  recorded_at TEXT NOT NULL,
  stage_id TEXT NULL REFERENCES competition_stages (id),
  round_id TEXT NULL REFERENCES competition_rounds (id),
  CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score IS NOT NULL AND away_score IS NOT NULL))
) STRICT;

INSERT INTO match_result_history_new
  (rowid, id, match_id, change_type, status, home_score, away_score, kickoff_at, recorded_at, stage_id, round_id)
SELECT rowid, id, match_id, change_type, status, home_score, away_score, kickoff_at, recorded_at, stage_id, round_id
FROM match_result_history;

DROP TABLE match_result_history;
DROP TABLE match_results;
DROP TABLE competition_matches;

ALTER TABLE competition_matches_new RENAME TO competition_matches;
ALTER TABLE match_results_new RENAME TO match_results;
ALTER TABLE match_result_history_new RENAME TO match_result_history;

CREATE UNIQUE INDEX idx_competition_matches_obvious_duplicate
  ON competition_matches (season_id, home_team_id, away_team_id, ifnull(stage_id, ''), ifnull(round_id, ''), kickoff_at)
  WHERE kickoff_at IS NOT NULL;
CREATE INDEX idx_competition_matches_calendar
  ON competition_matches (season_id, kickoff_at, created_at, id);
CREATE INDEX idx_competition_matches_stage_round
  ON competition_matches (season_id, stage_id, round_id, kickoff_at, id);
CREATE INDEX idx_match_result_history_match_time
  ON match_result_history (match_id, recorded_at, id);

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
