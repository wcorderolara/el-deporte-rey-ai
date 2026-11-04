import type { Db } from '../../platform/db/db.js';
import type { MatchStatus } from './calendar/domain/models.js';
import type {
  Baseline,
  ImportLocalState,
  LocalLabel,
  LocalMatch,
  LocalRound,
  MappedResource,
  Mapping,
} from './import-transform.js';

interface MatchRow {
  id: string;
  home_team_id: string;
  away_team_id: string;
  stage_id: string | null;
  round_id: string | null;
  kickoff_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_name: string;
  away_name: string;
}
const MATCH_SELECT =
  'SELECT m.id, m.home_team_id, m.away_team_id, m.stage_id, m.round_id, m.kickoff_at, m.status, r.home_score, r.away_score, h.name AS home_name, a.name AS away_name FROM competition_matches m JOIN match_results r ON r.match_id = m.id JOIN managed_teams h ON h.id = m.home_team_id JOIN managed_teams a ON a.id = m.away_team_id';

function matchFrom(row: MatchRow): LocalMatch {
  return {
    id: row.id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    stageId: row.stage_id,
    roundId: row.round_id,
    kickoffAt: row.kickoff_at,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    label: `${row.home_name} vs ${row.away_name}`.slice(0, 160),
  };
}

function baselineFrom(value: string | null): Baseline | null {
  if (value === null) return null;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const entries = Object.entries(parsed).filter(
    (entry): entry is [string, string | number | null] =>
      entry[1] === null || typeof entry[1] === 'string' || typeof entry[1] === 'number',
  );
  return Object.fromEntries(entries);
}

/** Read-only adapter over the existing sports tables and the identity mappings (used inside and outside the write lock). */
export class SQLiteImportLocalState implements ImportLocalState {
  readonly #db: Db;
  readonly #competitionId: string;
  readonly #providerKey: string;
  constructor(db: Db, competitionId: string, providerKey: string) {
    this.#db = db;
    this.#competitionId = competitionId;
    this.#providerKey = providerKey;
  }

  mapping(resource: MappedResource, scopeKey: string, externalId: string): Mapping | undefined {
    const row = this.#db
      .prepare<{ local_id: string; baseline_json: string | null }>(
        'SELECT local_id, baseline_json FROM external_identity_mappings WHERE provider_key = ? AND resource = ? AND scope_key = ? AND external_id = ?',
      )
      .get([this.#providerKey, resource, scopeKey, externalId]);
    return row ? { localId: row.local_id, baseline: baselineFrom(row.baseline_json) } : undefined;
  }
  isMapped(resource: MappedResource, localId: string): boolean {
    return Boolean(
      this.#db
        .prepare(
          'SELECT 1 FROM external_identity_mappings WHERE provider_key = ? AND resource = ? AND local_id = ? AND competition_id = ?',
        )
        .get([this.#providerKey, resource, localId, this.#competitionId]),
    );
  }
  teamsByIdentity(externalId: string): LocalLabel[] {
    return this.#db
      .prepare<LocalLabel>(
        "SELECT DISTINCT t.id, CASE WHEN t.region IS NULL THEN t.name ELSE t.name || ' · ' || t.region END AS label FROM external_identity_mappings m JOIN managed_teams t ON t.id = m.local_id WHERE m.provider_key = ? AND m.resource = 'teams' AND m.external_id = ? AND m.competition_id <> ? ORDER BY t.id LIMIT 20",
      )
      .all([this.#providerKey, externalId, this.#competitionId]);
  }
  season(seasonId: string): LocalLabel | undefined {
    return this.#db
      .prepare<LocalLabel>('SELECT id, label FROM competition_seasons WHERE id = ? AND competition_id = ?')
      .get([seasonId, this.#competitionId]);
  }
  seasonsByLabel(normalizedLabel: string): LocalLabel[] {
    return this.#db
      .prepare<LocalLabel>(
        'SELECT id, label FROM competition_seasons WHERE competition_id = ? AND normalized_label = ? ORDER BY created_at, id',
      )
      .all([this.#competitionId, normalizedLabel]);
  }
  team(teamId: string): LocalLabel | undefined {
    return this.#db.prepare<LocalLabel>('SELECT id, name AS label FROM managed_teams WHERE id = ?').get([teamId]);
  }
  teamsByName(normalizedName: string): LocalLabel[] {
    return this.#db
      .prepare<LocalLabel>(
        "SELECT id, CASE WHEN region IS NULL THEN name ELSE name || ' · ' || region END AS label FROM managed_teams WHERE normalized_name = ? ORDER BY normalized_region, id LIMIT 20",
      )
      .all([normalizedName]);
  }
  isCompetitionTeam(teamId: string): boolean {
    return Boolean(
      this.#db
        .prepare('SELECT 1 FROM competition_teams WHERE competition_id = ? AND team_id = ?')
        .get([this.#competitionId, teamId]),
    );
  }
  isParticipant(seasonId: string, teamId: string): boolean {
    return Boolean(
      this.#db.prepare('SELECT 1 FROM season_participants WHERE season_id = ? AND team_id = ?').get([seasonId, teamId]),
    );
  }
  stage(seasonId: string, stageId: string): LocalLabel | undefined {
    return this.#db
      .prepare<LocalLabel>('SELECT id, name AS label FROM competition_stages WHERE id = ? AND season_id = ?')
      .get([stageId, seasonId]);
  }
  stagesByName(seasonId: string, normalizedName: string): LocalLabel[] {
    return this.#db
      .prepare<LocalLabel>(
        'SELECT id, name AS label FROM competition_stages WHERE season_id = ? AND normalized_name = ? ORDER BY id',
      )
      .all([seasonId, normalizedName]);
  }
  round(seasonId: string, roundId: string): LocalRound | undefined {
    const row = this.#db
      .prepare<{ id: string; label: string; stage_id: string | null }>(
        'SELECT id, name AS label, stage_id FROM competition_rounds WHERE id = ? AND season_id = ?',
      )
      .get([roundId, seasonId]);
    return row ? { id: row.id, label: row.label, stageId: row.stage_id } : undefined;
  }
  roundsByName(seasonId: string, stageId: string | null, normalizedName: string): LocalRound[] {
    return this.#db
      .prepare<{ id: string; label: string; stage_id: string | null }>(
        'SELECT id, name AS label, stage_id FROM competition_rounds WHERE season_id = ? AND stage_id IS ? AND normalized_name = ? ORDER BY id',
      )
      .all([seasonId, stageId, normalizedName])
      .map((row) => ({ id: row.id, label: row.label, stageId: row.stage_id }));
  }
  match(seasonId: string, matchId: string): LocalMatch | undefined {
    const row = this.#db
      .prepare<MatchRow>(MATCH_SELECT + ' WHERE m.id = ? AND m.season_id = ?')
      .get([matchId, seasonId]);
    return row ? matchFrom(row) : undefined;
  }
  matchesBetween(seasonId: string, homeTeamId: string, awayTeamId: string): LocalMatch[] {
    return this.#db
      .prepare<MatchRow>(
        MATCH_SELECT + ' WHERE m.season_id = ? AND m.home_team_id = ? AND m.away_team_id = ? ORDER BY m.id',
      )
      .all([seasonId, homeTeamId, awayTeamId])
      .map(matchFrom);
  }
}
