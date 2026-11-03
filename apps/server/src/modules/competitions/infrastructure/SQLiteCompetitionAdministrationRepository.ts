import type { CompetitionTeam, LocalSeason, LocalTeam, SeasonParticipant } from '../domain/models.js';
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
interface CompetitionTeamRow extends TeamRow {
  associated_at: string;
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
function competitionTeamFrom(row: CompetitionTeamRow): CompetitionTeam {
  return { team: teamFrom(row), associatedAt: row.associated_at };
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

  updateSeason(competitionId: string, seasonId: string, label: string, normalizedLabel: string): LocalSeason {
    try {
      this.#db.transaction(() => {
        this.#requireSeason(competitionId, seasonId);
        this.#db
          .prepare('UPDATE competition_seasons SET label = ?, normalized_label = ? WHERE competition_id = ? AND id = ?')
          .run([label, normalizedLabel, competitionId, seasonId]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new AdminError('duplicate_season');
      throw error;
    }
    return this.getSeason(competitionId, seasonId);
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

  updateTeam(
    teamId: string,
    input: Pick<NewManagedTeam, 'name' | 'normalizedName' | 'region' | 'normalizedRegion' | 'updatedAt'>,
  ): LocalTeam {
    try {
      const result = this.#db
        .prepare(
          'UPDATE managed_teams SET name = ?, normalized_name = ?, region = ?, normalized_region = ?, updated_at = ? WHERE id = ?',
        )
        .run([input.name, input.normalizedName, input.region, input.normalizedRegion, input.updatedAt, teamId]);
      if (result.changes === 0) throw new AdminError('team_not_found');
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new AdminError('duplicate_team');
      throw error;
    }
    return this.getTeam(teamId);
  }

  getTeam(teamId: string): LocalTeam {
    const row = this.#db
      .prepare<TeamRow>('SELECT id, name, region, created_at, updated_at FROM managed_teams WHERE id = ?')
      .get([teamId]);
    if (!row) throw new AdminError('team_not_found');
    return teamFrom(row);
  }

  listCompetitionTeams(competitionId: string): CompetitionTeam[] {
    this.#requireCompetition(competitionId);
    return this.#db
      .prepare<CompetitionTeamRow>(
        'SELECT t.id, t.name, t.region, t.created_at, t.updated_at, ct.associated_at FROM competition_teams ct JOIN managed_teams t ON t.id = ct.team_id WHERE ct.competition_id = ? ORDER BY t.normalized_name, t.normalized_region, t.id',
      )
      .all([competitionId])
      .map(competitionTeamFrom);
  }

  addCompetitionTeam(competitionId: string, teamId: string, associatedAt: string): CompetitionTeam {
    try {
      this.#db.transaction(() => {
        this.#requireCompetition(competitionId);
        if (!this.#db.prepare('SELECT 1 FROM managed_teams WHERE id = ?').get([teamId]))
          throw new AdminError('team_not_found');
        this.#db
          .prepare('INSERT INTO competition_teams (competition_id, team_id, associated_at) VALUES (?, ?, ?)')
          .run([competitionId, teamId, associatedAt]);
      });
    } catch (error) {
      if (constraintKind(error) === 'primary_key' || constraintKind(error) === 'unique')
        throw new AdminError('duplicate_competition_team');
      throw error;
    }
    return this.listCompetitionTeams(competitionId).find((item) => item.team.id === teamId)!;
  }

  createAndAssociateCompetitionTeam(competitionId: string, input: NewManagedTeam): CompetitionTeam {
    try {
      this.#db.transaction(() => {
        this.#requireCompetition(competitionId);
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
        this.#db
          .prepare('INSERT INTO competition_teams (competition_id, team_id, associated_at) VALUES (?, ?, ?)')
          .run([competitionId, input.id, input.createdAt]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new AdminError('duplicate_team');
      throw error;
    }
    return this.listCompetitionTeams(competitionId).find((item) => item.team.id === input.id)!;
  }

  removeCompetitionTeam(competitionId: string, teamId: string): void {
    this.#db.transaction(() => {
      this.#requireCompetition(competitionId);
      if (
        !this.#db
          .prepare('SELECT 1 FROM competition_teams WHERE competition_id = ? AND team_id = ?')
          .get([competitionId, teamId])
      ) {
        throw new AdminError('competition_team_not_found');
      }
      if (
        this.#db
          .prepare(
            'SELECT 1 FROM season_participants p JOIN competition_seasons s ON s.id = p.season_id WHERE s.competition_id = ? AND p.team_id = ? LIMIT 1',
          )
          .get([competitionId, teamId])
      )
        throw new AdminError('competition_team_in_use');
      this.#db
        .prepare('DELETE FROM competition_teams WHERE competition_id = ? AND team_id = ?')
        .run([competitionId, teamId]);
    });
  }

  listParticipants(competitionId: string, seasonId: string): SeasonParticipant[] {
    this.#requireSeason(competitionId, seasonId);
    return this.#db
      .prepare<ParticipantRow>(
        'SELECT t.id, t.name, t.region, t.created_at, t.updated_at, p.joined_at FROM season_participants p JOIN managed_teams t ON t.id = p.team_id JOIN competition_seasons s ON s.id = p.season_id JOIN competition_teams ct ON ct.competition_id = s.competition_id AND ct.team_id = p.team_id WHERE p.season_id = ? ORDER BY t.normalized_name, t.normalized_region, t.id',
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
        // Preserve the legacy single-participant contract by establishing the competition link atomically.
        this.#db
          .prepare(
            'INSERT INTO competition_teams (competition_id, team_id, associated_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
          )
          .run([competitionId, teamId, joinedAt]);
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

  addParticipants(competitionId: string, seasonId: string, teamIds: string[], joinedAt: string): SeasonParticipant[] {
    this.#db.transaction(() => {
      this.#requireSeason(competitionId, seasonId);
      for (const teamId of teamIds) {
        if (
          !this.#db
            .prepare('SELECT 1 FROM competition_teams WHERE competition_id = ? AND team_id = ?')
            .get([competitionId, teamId])
        ) {
          throw new AdminError('team_not_in_competition');
        }
        if (
          this.#db
            .prepare('SELECT 1 FROM season_participants WHERE season_id = ? AND team_id = ?')
            .get([seasonId, teamId])
        ) {
          throw new AdminError('duplicate_participant');
        }
      }
      const insert = this.#db.prepare(
        'INSERT INTO season_participants (season_id, team_id, joined_at) VALUES (?, ?, ?)',
      );
      for (const teamId of teamIds) insert.run([seasonId, teamId, joinedAt]);
    });
    const byId = new Map(this.listParticipants(competitionId, seasonId).map((item) => [item.team.id, item]));
    return teamIds.map((teamId) => {
      const participant = byId.get(teamId);
      if (!participant) throw new AdminError('participant_not_found');
      return participant;
    });
  }

  removeParticipant(competitionId: string, seasonId: string, teamId: string): void {
    this.#db.transaction(() => {
      this.#requireSeason(competitionId, seasonId);
      if (
        this.#db
          .prepare(
            'SELECT 1 FROM competition_matches WHERE season_id = ? AND (home_team_id = ? OR away_team_id = ?) LIMIT 1',
          )
          .get([seasonId, teamId, teamId])
      ) {
        throw new AdminError('participant_in_use');
      }
      const result = this.#db
        .prepare('DELETE FROM season_participants WHERE season_id = ? AND team_id = ?')
        .run([seasonId, teamId]);
      if (result.changes === 0) throw new AdminError('participant_not_found');
    });
  }
}
