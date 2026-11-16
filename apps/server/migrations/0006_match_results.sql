-- Separate the current result from the match schedule while preserving the
-- score columns introduced in 0005 for databases where that migration ran.
CREATE TABLE match_results (
  match_id TEXT PRIMARY KEY REFERENCES competition_matches (id),
  home_score INTEGER NULL CHECK (home_score IS NULL OR home_score >= 0),
  away_score INTEGER NULL CHECK (away_score IS NULL OR away_score >= 0),
  updated_at TEXT NOT NULL,
  CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score IS NOT NULL AND away_score IS NOT NULL))
) STRICT;

INSERT INTO match_results (match_id, home_score, away_score, updated_at)
SELECT id, home_score, away_score, updated_at
FROM competition_matches;

ALTER TABLE match_result_history
  ADD COLUMN stage_id TEXT NULL REFERENCES competition_stages (id);
ALTER TABLE match_result_history
  ADD COLUMN round_id TEXT NULL REFERENCES competition_rounds (id);
