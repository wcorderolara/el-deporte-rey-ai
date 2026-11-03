-- Separate reusable global Team identities from competition and season membership.
CREATE TABLE competition_teams (
  competition_id TEXT NOT NULL REFERENCES competitions,
  team_id TEXT NOT NULL REFERENCES managed_teams,
  associated_at TEXT NOT NULL,
  PRIMARY KEY (competition_id, team_id)
) STRICT;

CREATE INDEX idx_competition_teams_team ON competition_teams (team_id, competition_id);

-- Preserve every historical season participant and establish its parent competition link.
INSERT INTO competition_teams (competition_id, team_id, associated_at)
SELECT DISTINCT s.competition_id, p.team_id, p.joined_at
FROM season_participants p
JOIN competition_seasons s ON s.id = p.season_id;

-- Keep the additive schema safe for older callers and direct SQL writers too.
CREATE TRIGGER season_participant_requires_competition_team
BEFORE INSERT ON season_participants
WHEN NOT EXISTS (
  SELECT 1
  FROM competition_seasons s
  JOIN competition_teams ct ON ct.competition_id = s.competition_id
  WHERE s.id = NEW.season_id AND ct.team_id = NEW.team_id
)
BEGIN
  SELECT RAISE(ABORT, 'season participant must belong to the competition');
END;

CREATE TRIGGER competition_team_cannot_be_removed_while_participating
BEFORE DELETE ON competition_teams
WHEN EXISTS (
  SELECT 1
  FROM competition_seasons s
  JOIN season_participants p ON p.season_id = s.id
  WHERE s.competition_id = OLD.competition_id AND p.team_id = OLD.team_id
)
BEGIN
  SELECT RAISE(ABORT, 'competition team is in use by a season');
END;
