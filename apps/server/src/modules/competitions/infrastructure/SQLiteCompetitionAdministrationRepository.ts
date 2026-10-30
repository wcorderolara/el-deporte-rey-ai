import type { LocalSeason, LocalTeam, SeasonParticipant } from '../domain/models.js';
import type { Db } from '../../../platform/db/db.js';
import { constraintKind } from '../../../platform/db/errors.js';
import { CompetitionAdministrationError as AdminError } from '../domain/errors.js';
import type { CompetitionAdministrationPort, NewManagedSeason, NewManagedTeam } from '../domain/ports.js';

interface SeasonRow {
  id: string;
  competition_id: string;
  label: string;
  created_at: string;
}
interface TeamRow {
  id: string;
  name: string;
  region: string | null;
  created_at: string;
  updated_at: string;
}
interface ParticipantRow extends TeamRow {
  joined_at: string;
}

function seasonFrom(row: SeasonRow): LocalSeason {
  return { id: row.id, competitionId: row.competition_id, label: row.label, createdAt: row.created_at };
}
function teamFrom(row: TeamRow): LocalTeam {
  return { id: row.id, name: row.name, region: row.region, createdAt: row.created_at, updatedAt: row.updated_at };
}
function participantFrom(row: ParticipantRow): SeasonParticipant {
  return { team: teamFrom(row), joinedAt: row.joined_at };
}

export class SQLiteCompetitionAdministrationRepository implements CompetitionAdministrationPort {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  #competitionExists(competitionId: string): boolean {
    return (
      this.#db.prepare<{ found: number }>('SELECT 1 AS found FROM competitions WHERE id = ?').get([competitionId]) !==
      undefined
    );
  }
  #seasonExists(competitionId: string, seasonId: string): boolean {
    return (
      this.#db
        .prepare<{ found: number }>('SELECT 1 AS found FROM competition_seasons WHERE competition_id = ? AND id = ?')
        .get([competitionId, seasonId]) !== undefined
    );
  }
  #requireCompetition(competitionId: string): void {
    if (!this.#competitionExists(competitionId)) throw new AdminError('competition_not_found');
  }
  #requireSeason(competitionId: string, seasonId: string): void {
    this.#requireCompetition(competitionId);
    if (!this.#seasonExists(competitionId, seasonId)) throw new AdminError('season_not_found');
  }

  listSeasons(competitionId: string): LocalSeason[] {
    this.#requireCompetition(competitionId);
    return this.#db
      .prepare<SeasonRow>(
        'SELECT id, competition_id, label, created_at FROM competition_seasons WHERE competition_id = ? ORDER BY created_at DESC, id DESC',
      )
      .all([competitionId])
      .map(seasonFrom);
  }

  createSeason(input: NewManagedSeason): LocalSeason {
    try {
      this.#db.transaction(() => {
        this.#requireCompetition(input.competitionId);
        this.#db
          .prepare(
            'INSERT INTO competition_seasons (id, competition_id, label, normalized_label, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .run([input.id, input.competitionId, input.label, input.normalizedLabel, input.createdAt]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new AdminError('duplicate_season');
      throw error;
    }
    return this.getSeason(input.competitionId, input.id);
  }

  getSeason(competitionId: string, seasonId: string): LocalSeason {
    this.#requireCompetition(competitionId);
    const row = this.#db
      .prepare<SeasonRow>(
        'SELECT id, competition_id, label, created_at FROM competition_seasons WHERE competition_id = ? AND id = ?',
      )
      .get([competitionId, seasonId]);
    if (!row) throw new AdminError('season_not_found');
    return seasonFrom(row);
  }

  listTeams(): LocalTeam[] {
    return this.#db
      .prepare<TeamRow>(
        'SELECT id, name, region, created_at, updated_at FROM managed_teams ORDER BY normalized_name, normalized_region, id',
      )
      .all()
      .map(teamFrom);
  }

  createTeam(input: NewManagedTeam): LocalTeam {
    try {
      this.#db
        .prepare(
          'INSERT INTO managed_teams (id, name, normalized_name, region, normalized_region, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run([
          input.id,
          input.name,
          input.normalizedName,
          input.region,
          input.normalizedRegion,
          input.createdAt,
          input.updatedAt,
        ]);
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new AdminError('duplicate_team');
      throw error;
    }
    return this.getTeam(input.id);
  }

  getTeam(teamId: string): LocalTeam {
    const row = this.#db
      .prepare<TeamRow>('SELECT id, name, region, created_at, updated_at FROM managed_teams WHERE id = ?')
      .get([teamId]);
    if (!row) throw new AdminError('team_not_found');
    return teamFrom(row);
  }

  listParticipants(competitionId: string, seasonId: string): SeasonParticipant[] {
    this.#requireSeason(competitionId, seasonId);
    return this.#db
      .prepare<ParticipantRow>(
        'SELECT t.id, t.name, t.region, t.created_at, t.updated_at, p.joined_at FROM season_participants p JOIN managed_teams t ON t.id = p.team_id WHERE p.season_id = ? ORDER BY t.normalized_name, t.normalized_region, t.id',
      )
      .all([seasonId])
      .map(participantFrom);
  }

  addParticipant(competitionId: string, seasonId: string, teamId: string, joinedAt: string): SeasonParticipant {
    try {
      this.#db.transaction(() => {
        this.#requireSeason(competitionId, seasonId);
        if (!this.#db.prepare<{ found: number }>('SELECT 1 AS found FROM managed_teams WHERE id = ?').get([teamId])) {
          throw new AdminError('team_not_found');
        }
        this.#db
          .prepare('INSERT INTO season_participants (season_id, team_id, joined_at) VALUES (?, ?, ?)')
          .run([seasonId, teamId, joinedAt]);
      });
    } catch (error) {
      if (constraintKind(error) === 'primary_key' || constraintKind(error) === 'unique') {
        throw new AdminError('duplicate_participant');
      }
      throw error;
    }
    const result = this.#db
      .prepare<ParticipantRow>(
        'SELECT t.id, t.name, t.region, t.created_at, t.updated_at, p.joined_at FROM season_participants p JOIN managed_teams t ON t.id = p.team_id WHERE p.season_id = ? AND p.team_id = ?',
      )
      .get([seasonId, teamId]);
    if (!result) throw new AdminError('participant_not_found');
    return participantFrom(result);
  }

  removeParticipant(competitionId: string, seasonId: string, teamId: string): void {
    this.#requireSeason(competitionId, seasonId);
    const result = this.#db
      .prepare('DELETE FROM season_participants WHERE season_id = ? AND team_id = ?')
      .run([seasonId, teamId]);
    if (result.changes === 0) throw new AdminError('participant_not_found');
  }
}
