import type { Db } from '../../../../platform/db/db.js';
import { constraintKind } from '../../../../platform/db/errors.js';
import { CalendarError } from '../domain/errors.js';
import type {
  CompetitionMatch,
  CompetitionRound,
  CompetitionStage,
  MatchResultHistory,
  MatchStatus,
} from '../domain/models.js';
import type {
  CalendarNamePatch,
  CompetitionCalendarPort,
  MatchCurrent,
  MatchSchedulePatch,
  NewMatch,
  NewRound,
  NewStage,
  RoundHistoryEntry,
  RoundUpdatePatch,
} from '../domain/port.js';

interface StageRow {
  id: string;
  season_id: string;
  name: string;
  display_order: number;
  created_at: string;
}
interface RoundRow {
  id: string;
  season_id: string;
  stage_id: string | null;
  name: string;
  display_order: number;
  created_at: string;
}
interface TeamRow {
  id: string;
  name: string;
  region: string | null;
  created_at: string;
  updated_at: string;
}
interface MatchRow extends TeamRow {
  match_id: string;
  season_id: string;
  stage_id: string | null;
  stage_name: string | null;
  round_id: string | null;
  round_name: string | null;
  kickoff_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  match_created_at: string;
  match_updated_at: string;
  away_id: string;
  away_name: string;
  away_region: string | null;
  away_created_at: string;
  away_updated_at: string;
}
interface MatchRowRaw {
  id: string;
  season_id: string;
  stage_id: string | null;
  round_id: string | null;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
}
interface HistoryRow extends Omit<
  MatchResultHistory,
  'matchId' | 'changeType' | 'homeScore' | 'awayScore' | 'kickoffAt' | 'recordedAt'
> {
  match_id: string;
  change_type: MatchResultHistory['changeType'];
  stage_id: string | null;
  round_id: string | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string | null;
  recorded_at: string;
}

const stageFrom = (row: StageRow): CompetitionStage => ({
  id: row.id,
  seasonId: row.season_id,
  name: row.name,
  displayOrder: row.display_order,
  createdAt: row.created_at,
});
const roundFrom = (row: RoundRow): CompetitionRound => ({
  id: row.id,
  seasonId: row.season_id,
  stageId: row.stage_id,
  name: row.name,
  displayOrder: row.display_order,
  createdAt: row.created_at,
});

function matchFrom(row: MatchRow): CompetitionMatch {
  return {
    id: row.match_id,
    seasonId: row.season_id,
    stage: row.stage_id ? { id: row.stage_id, name: row.stage_name ?? '' } : null,
    round: row.round_id ? { id: row.round_id, name: row.round_name ?? '' } : null,
    homeTeam: { id: row.id, name: row.name, region: row.region, createdAt: row.created_at, updatedAt: row.updated_at },
    awayTeam: {
      id: row.away_id,
      name: row.away_name,
      region: row.away_region,
      createdAt: row.away_created_at,
      updatedAt: row.away_updated_at,
    },
    kickoffAt: row.kickoff_at,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    createdAt: row.match_created_at,
    updatedAt: row.match_updated_at,
  };
}

const MATCH_SELECT = `
  SELECT m.id AS match_id, m.season_id, m.stage_id, s.name AS stage_name, m.round_id, r.name AS round_name,
    m.kickoff_at, m.status, mr.home_score, mr.away_score, m.created_at AS match_created_at, m.updated_at AS match_updated_at,
    h.id, h.name, h.region, h.created_at, h.updated_at, a.id AS away_id, a.name AS away_name,
    a.region AS away_region, a.created_at AS away_created_at, a.updated_at AS away_updated_at
  FROM competition_matches m
  JOIN match_results mr ON mr.match_id = m.id
  JOIN managed_teams h ON h.id = m.home_team_id
  JOIN managed_teams a ON a.id = m.away_team_id
  LEFT JOIN competition_stages s ON s.id = m.stage_id
  LEFT JOIN competition_rounds r ON r.id = m.round_id`;

export class SQLiteCompetitionCalendarRepository implements CompetitionCalendarPort {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  #requireCompetition(competitionId: string) {
    if (!this.#db.prepare('SELECT 1 FROM competitions WHERE id = ?').get([competitionId]))
      throw new CalendarError('competition_not_found');
  }
  #requireSeason(competitionId: string, seasonId: string) {
    this.#requireCompetition(competitionId);
    if (
      !this.#db
        .prepare('SELECT 1 FROM competition_seasons WHERE id = ? AND competition_id = ?')
        .get([seasonId, competitionId])
    ) {
      throw new CalendarError('season_not_found');
    }
  }
  #requireStage(competitionId: string, seasonId: string, stageId: string) {
    this.#requireSeason(competitionId, seasonId);
    const row = this.#db
      .prepare('SELECT 1 FROM competition_stages WHERE id = ? AND season_id = ?')
      .get([stageId, seasonId]);
    if (!row) throw new CalendarError('stage_not_found');
  }
  #requireRound(competitionId: string, seasonId: string, roundId: string) {
    this.#requireSeason(competitionId, seasonId);
    if (!this.#db.prepare('SELECT 1 FROM competition_rounds WHERE id = ? AND season_id = ?').get([roundId, seasonId])) {
      throw new CalendarError('round_not_found');
    }
  }

  listStages(competitionId: string, seasonId: string) {
    this.#requireSeason(competitionId, seasonId);
    return this.#db
      .prepare<StageRow>(
        'SELECT id, season_id, name, display_order, created_at FROM competition_stages WHERE season_id = ? ORDER BY display_order, created_at, id',
      )
      .all([seasonId])
      .map(stageFrom);
  }
  getStage(competitionId: string, seasonId: string, stageId: string) {
    this.#requireStage(competitionId, seasonId, stageId);
    const row = this.#db
      .prepare<StageRow>('SELECT id, season_id, name, display_order, created_at FROM competition_stages WHERE id = ?')
      .get([stageId]);
    if (!row) throw new CalendarError('stage_not_found');
    return stageFrom(row);
  }
  createStage(competitionId: string, input: NewStage) {
    try {
      this.#db.transaction(() => {
        this.#requireSeason(competitionId, input.seasonId);
        this.#db
          .prepare(
            'INSERT INTO competition_stages (id, season_id, name, normalized_name, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run([input.id, input.seasonId, input.name, input.normalizedName, input.displayOrder, input.createdAt]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new CalendarError('duplicate_stage');
      throw error;
    }
    return this.getStage(competitionId, input.seasonId, input.id);
  }
  updateStage(competitionId: string, seasonId: string, stageId: string, patch: CalendarNamePatch) {
    try {
      this.#db.transaction(() => {
        this.#requireStage(competitionId, seasonId, stageId);
        this.#db
          .prepare('UPDATE competition_stages SET name = ?, normalized_name = ? WHERE id = ? AND season_id = ?')
          .run([patch.name, patch.normalizedName, stageId, seasonId]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new CalendarError('duplicate_stage');
      throw error;
    }
    return this.getStage(competitionId, seasonId, stageId);
  }

  listRounds(competitionId: string, seasonId: string, stageId: string | null) {
    this.#requireSeason(competitionId, seasonId);
    if (stageId) this.#requireStage(competitionId, seasonId, stageId);
    const rows = stageId
      ? this.#db
          .prepare<RoundRow>(
            'SELECT id, season_id, stage_id, name, display_order, created_at FROM competition_rounds WHERE season_id = ? AND stage_id = ? ORDER BY display_order, created_at, id',
          )
          .all([seasonId, stageId])
      : this.#db
          .prepare<RoundRow>(
            'SELECT id, season_id, stage_id, name, display_order, created_at FROM competition_rounds WHERE season_id = ? AND stage_id IS NULL ORDER BY display_order, created_at, id',
          )
          .all([seasonId]);
    return rows.map(roundFrom);
  }
  getRound(competitionId: string, seasonId: string, roundId: string) {
    this.#requireRound(competitionId, seasonId, roundId);
    const row = this.#db
      .prepare<RoundRow>(
        'SELECT id, season_id, stage_id, name, display_order, created_at FROM competition_rounds WHERE id = ?',
      )
      .get([roundId]);
    if (!row) throw new CalendarError('round_not_found');
    return roundFrom(row);
  }
  createRound(competitionId: string, input: NewRound) {
    try {
      this.#db.transaction(() => {
        this.#requireSeason(competitionId, input.seasonId);
        if (input.stageId) this.#requireStage(competitionId, input.seasonId, input.stageId);
        this.#db
          .prepare(
            'INSERT INTO competition_rounds (id, season_id, stage_id, name, normalized_name, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .run([
            input.id,
            input.seasonId,
            input.stageId,
            input.name,
            input.normalizedName,
            input.displayOrder,
            input.createdAt,
          ]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new CalendarError('duplicate_round');
      throw error;
    }
    return this.getRound(competitionId, input.seasonId, input.id);
  }
  updateRound(
    competitionId: string,
    seasonId: string,
    roundId: string,
    patch: RoundUpdatePatch,
    history: readonly RoundHistoryEntry[],
    at: string,
  ) {
    let roundUpdated = false;
    try {
      this.#db.transaction(() => {
        this.#requireRound(competitionId, seasonId, roundId);
        const current = this.#db
          .prepare<{ stage_id: string | null; name: string; normalized_name: string }>(
            'SELECT stage_id, name, normalized_name FROM competition_rounds WHERE id = ? AND season_id = ?',
          )
          .get([roundId, seasonId]);
        if (!current) throw new CalendarError('round_not_found');
        const targetStageId = patch.stageId === undefined ? current.stage_id : patch.stageId;
        const targetName = patch.name ?? current.name;
        const targetNormalizedName = patch.normalizedName ?? current.normalized_name;
        const moving = targetStageId !== current.stage_id;
        if (targetStageId !== null) this.#requireStage(competitionId, seasonId, targetStageId);

        const attachedMatches = moving
          ? this.#db
              .prepare<{
                id: string;
                status: MatchStatus;
                home_score: number | null;
                away_score: number | null;
                kickoff_at: string | null;
              }>(
                'SELECT id, status, home_score, away_score, kickoff_at FROM competition_matches WHERE season_id = ? AND round_id = ? ORDER BY id',
              )
              .all([seasonId, roundId])
          : [];
        const historyByMatch = new Map(history.map((item) => [item.matchId, item.id]));
        if (
          moving &&
          (attachedMatches.length !== historyByMatch.size ||
            attachedMatches.some((match) => !historyByMatch.has(match.id)))
        ) {
          throw new CalendarError('calendar_changed');
        }

        if (moving && attachedMatches.length > 0) {
          // Detach only within this transaction so the round can change its composite parent key.
          // Clear kickoff during the intermediate state to avoid the duplicate-match index.
          this.#db
            .prepare(
              'UPDATE competition_matches SET stage_id = ?, round_id = NULL, kickoff_at = NULL WHERE season_id = ? AND round_id = ?',
            )
            .run([targetStageId, seasonId, roundId]);
        }
        this.#db
          .prepare(
            'UPDATE competition_rounds SET stage_id = ?, name = ?, normalized_name = ? WHERE id = ? AND season_id = ?',
          )
          .run([targetStageId, targetName, targetNormalizedName, roundId, seasonId]);
        roundUpdated = true;

        if (moving) {
          for (const match of attachedMatches) {
            this.#db
              .prepare(
                'UPDATE competition_matches SET round_id = ?, stage_id = ?, kickoff_at = ?, updated_at = ? WHERE id = ? AND season_id = ?',
              )
              .run([roundId, targetStageId, match.kickoff_at, at, match.id, seasonId]);
            const historyId = historyByMatch.get(match.id);
            if (!historyId) throw new CalendarError('calendar_changed');
            this.#db
              .prepare(
                "INSERT INTO match_result_history (id, match_id, change_type, stage_id, round_id, status, home_score, away_score, kickoff_at, recorded_at) VALUES (?, ?, 'schedule_updated', ?, ?, ?, ?, ?, ?, ?)",
              )
              .run([
                historyId,
                match.id,
                targetStageId,
                roundId,
                match.status,
                match.home_score,
                match.away_score,
                match.kickoff_at,
                at,
              ]);
          }
        }
      });
    } catch (error) {
      if (constraintKind(error) === 'unique')
        throw new CalendarError(roundUpdated ? 'duplicate_match' : 'duplicate_round');
      if (constraintKind(error) === 'foreign_key') throw new CalendarError('invalid_stage_round');
      throw error;
    }
    return this.getRound(competitionId, seasonId, roundId);
  }

  deleteRound(competitionId: string, seasonId: string, roundId: string): void {
    this.#db.transaction(() => {
      this.#requireRound(competitionId, seasonId, roundId);
      const inUse = this.#db
        .prepare<{ found: number }>(
          'SELECT 1 AS found FROM competition_matches WHERE season_id = ? AND round_id = ? UNION ALL SELECT 1 AS found FROM match_result_history WHERE round_id = ? LIMIT 1',
        )
        .get([seasonId, roundId, roundId]);
      if (inUse) throw new CalendarError('round_in_use');
      this.#db.prepare('DELETE FROM competition_rounds WHERE season_id = ? AND id = ?').run([seasonId, roundId]);
    });
  }

  listParticipants(competitionId: string, seasonId: string) {
    this.#requireSeason(competitionId, seasonId);
    return this.#db
      .prepare<{ id: string; name: string; region: string | null; created_at: string; updated_at: string }>(
        'SELECT t.id, t.name, t.region, t.created_at, t.updated_at FROM season_participants p JOIN managed_teams t ON t.id = p.team_id WHERE p.season_id = ? ORDER BY t.normalized_name, t.normalized_region, t.id',
      )
      .all([seasonId])
      .map((row) => ({
        id: row.id,
        name: row.name,
        region: row.region,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  listMatches(competitionId: string, seasonId: string) {
    this.#requireSeason(competitionId, seasonId);
    return this.#db
      .prepare<MatchRow>(
        MATCH_SELECT + ' WHERE m.season_id = ? ORDER BY m.kickoff_at IS NULL, m.kickoff_at, m.created_at, m.id',
      )
      .all([seasonId])
      .map(matchFrom);
  }
  getMatch(competitionId: string, seasonId: string, matchId: string) {
    this.#requireSeason(competitionId, seasonId);
    const row = this.#db
      .prepare<MatchRow>(MATCH_SELECT + ' WHERE m.season_id = ? AND m.id = ?')
      .get([seasonId, matchId]);
    if (!row) throw new CalendarError('match_not_found');
    return matchFrom(row);
  }
  getMatchCurrent(competitionId: string, seasonId: string, matchId: string): MatchCurrent {
    this.#requireSeason(competitionId, seasonId);
    const row = this.#db
      .prepare<MatchRowRaw>(
        'SELECT m.id, m.season_id, m.stage_id, m.round_id, m.home_team_id, m.away_team_id, m.kickoff_at, m.status, r.home_score, r.away_score FROM competition_matches m JOIN match_results r ON r.match_id = m.id WHERE m.id = ? AND m.season_id = ?',
      )
      .get([matchId, seasonId]);
    if (!row) throw new CalendarError('match_not_found');
    return {
      id: row.id,
      seasonId: row.season_id,
      stageId: row.stage_id,
      roundId: row.round_id,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      kickoffAt: row.kickoff_at,
    };
  }

  createMatch(competitionId: string, input: NewMatch) {
    try {
      this.#db.transaction(() => {
        this.#requireSeason(competitionId, input.seasonId);
        if (input.homeTeamId === input.awayTeamId) throw new CalendarError('invalid_team_pair');
        for (const teamId of [input.homeTeamId, input.awayTeamId]) {
          if (
            !this.#db
              .prepare('SELECT 1 FROM season_participants WHERE season_id = ? AND team_id = ?')
              .get([input.seasonId, teamId])
          )
            throw new CalendarError('team_not_participant');
        }
        if (input.stageId) this.#requireStage(competitionId, input.seasonId, input.stageId);
        if (input.roundId) this.#requireRound(competitionId, input.seasonId, input.roundId);
        this.#db
          .prepare(
            "INSERT INTO competition_matches (id, season_id, stage_id, round_id, home_team_id, away_team_id, kickoff_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
          )
          .run([
            input.id,
            input.seasonId,
            input.stageId,
            input.roundId,
            input.homeTeamId,
            input.awayTeamId,
            input.kickoffAt,
            input.createdAt,
            input.updatedAt,
          ]);
        this.#db
          .prepare('INSERT INTO match_results (match_id, home_score, away_score, updated_at) VALUES (?, NULL, NULL, ?)')
          .run([input.id, input.createdAt]);
        this.#db
          .prepare(
            "INSERT INTO match_result_history (id, match_id, change_type, stage_id, round_id, status, home_score, away_score, kickoff_at, recorded_at) VALUES (?, ?, 'created', ?, ?, 'scheduled', NULL, NULL, ?, ?)",
          )
          .run([input.historyId, input.id, input.stageId, input.roundId, input.kickoffAt, input.createdAt]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new CalendarError('duplicate_match');
      if (constraintKind(error) === 'foreign_key') throw new CalendarError('invalid_stage_round');
      throw error;
    }
    return this.getMatch(competitionId, input.seasonId, input.id);
  }

  updateSchedule(
    competitionId: string,
    seasonId: string,
    matchId: string,
    patch: MatchSchedulePatch,
    historyId: string,
    at: string,
  ) {
    const current = this.getMatchCurrent(competitionId, seasonId, matchId);
    const stageId = patch.stageId ?? null;
    const roundId = patch.roundId ?? null;
    const kickoffAt = patch.kickoffAt === undefined ? current.kickoffAt : patch.kickoffAt;
    try {
      this.#db.transaction(() => {
        if (stageId) this.#requireStage(competitionId, seasonId, stageId);
        if (roundId) this.#requireRound(competitionId, seasonId, roundId);
        this.#db
          .prepare(
            'UPDATE competition_matches SET stage_id = ?, round_id = ?, kickoff_at = ?, updated_at = ? WHERE id = ? AND season_id = ?',
          )
          .run([stageId, roundId, kickoffAt, at, matchId, seasonId]);
        this.#db
          .prepare(
            'INSERT INTO match_result_history (id, match_id, change_type, stage_id, round_id, status, home_score, away_score, kickoff_at, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run([
            historyId,
            matchId,
            'schedule_updated',
            stageId,
            roundId,
            current.status,
            current.homeScore,
            current.awayScore,
            kickoffAt,
            at,
          ]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique') throw new CalendarError('duplicate_match');
      if (constraintKind(error) === 'foreign_key') throw new CalendarError('invalid_stage_round');
      throw error;
    }
    return this.getMatch(competitionId, seasonId, matchId);
  }

  updateResult(
    competitionId: string,
    seasonId: string,
    matchId: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    historyId: string,
    at: string,
    changeType: string,
  ) {
    const current = this.getMatchCurrent(competitionId, seasonId, matchId);
    this.#db.transaction(() => {
      this.#db
        .prepare('UPDATE match_results SET home_score = ?, away_score = ?, updated_at = ? WHERE match_id = ?')
        .run([homeScore, awayScore, at, matchId]);
      this.#db
        .prepare(
          'UPDATE competition_matches SET status = ?, home_score = ?, away_score = ?, updated_at = ? WHERE id = ? AND season_id = ?',
        )
        .run([status, homeScore, awayScore, at, matchId, seasonId]);
      this.#db
        .prepare(
          'INSERT INTO match_result_history (id, match_id, change_type, stage_id, round_id, status, home_score, away_score, kickoff_at, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run([
          historyId,
          matchId,
          changeType,
          current.stageId,
          current.roundId,
          status,
          homeScore,
          awayScore,
          current.kickoffAt,
          at,
        ]);
    });
    return this.getMatch(competitionId, seasonId, matchId);
  }

  listResultHistory(competitionId: string, seasonId: string, matchId: string): MatchResultHistory[] {
    this.getMatchCurrent(competitionId, seasonId, matchId);
    return this.#db
      .prepare<HistoryRow>(
        'SELECT h.id, h.match_id, h.change_type, h.stage_id, h.round_id, h.status, h.home_score, h.away_score, h.kickoff_at, h.recorded_at FROM match_result_history h JOIN competition_matches m ON m.id = h.match_id WHERE m.season_id = ? AND m.id = ? ORDER BY h.rowid',
      )
      .all([seasonId, matchId])
      .map((row) => ({
        id: row.id,
        matchId: row.match_id,
        changeType: row.change_type,
        stageId: row.stage_id,
        roundId: row.round_id,
        status: row.status,
        homeScore: row.home_score,
        awayScore: row.away_score,
        kickoffAt: row.kickoff_at,
        recordedAt: row.recorded_at,
      }));
  }
}
