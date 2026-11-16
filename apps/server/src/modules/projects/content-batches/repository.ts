/**
 * Content generation batch repository (PD-ARCH-01E-A; migration 0017): the read-only views of the locally managed
 * sports context a batch selects, and the batch, item and item-match rows. Every statement is a constant with bound
 * parameters (T10-F14). Sports values are read from the operational tables, which already hold the effective values
 * (manual data, confirmed imports and protected overrides); import previews and provider snapshots are never read.
 */
import {
  CompetitionMatchStatusSchema,
  ContentPieceKindSchema,
  ContentPieceSkipReasonSchema,
  LanguageSchema,
} from '@edr/contracts';
import type { ContentPieceKind, ContentPieceSkipReason, Language } from '@edr/contracts';

import type { Db } from '../../../platform/db/index.js';
import type { LocalMatchValues } from '../../../providers/sports/index.js';

export interface LocalContextRecord {
  readonly competitionId: string;
  readonly competitionName: string;
  readonly seasonId: string;
  readonly seasonLabel: string;
  readonly stageId: string | null;
  readonly stageName: string | null;
  readonly roundId: string;
  readonly roundName: string;
}

export interface LocalMatchRecord extends LocalMatchValues {
  readonly id: string;
  readonly roundId: string | null;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
}

export interface BatchRecord extends LocalContextRecord {
  readonly id: string;
  readonly importId: string;
  readonly requestKey: string;
  readonly requestHash: string;
  readonly selectionLabel: string;
  readonly language: Language;
  readonly createdAt: string;
}

export interface BatchItemRecord {
  readonly id: string;
  readonly batchId: string;
  readonly position: number;
  readonly kind: ContentPieceKind;
  readonly title: string;
  readonly projectId: string | null;
  readonly initialRunId: string | null;
  readonly selectionVersionId: string | null;
  readonly skipReason: ContentPieceSkipReason | null;
  readonly matchIds: readonly string[];
}

export interface NewBatch extends LocalContextRecord {
  readonly id: string;
  readonly importId: string;
  readonly requestKey: string;
  readonly requestHash: string;
  readonly selectionLabel: string;
  readonly language: Language;
  readonly createdAt: string;
}

export type NewBatchItem = Omit<BatchItemRecord, 'batchId'>;

interface ContextRow {
  competition_id: string;
  competition_name: string;
  season_id: string;
  season_label: string;
  stage_id: string | null;
  stage_name: string | null;
  round_id: string;
  round_name: string;
}

interface MatchRow {
  id: string;
  round_id: string | null;
  kickoff_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_id: string;
  home_name: string;
  away_id: string;
  away_name: string;
}

interface BatchRow extends ContextRow {
  id: string;
  import_id: string;
  request_key: string;
  request_hash: string;
  selection_label: string;
  language: string;
  created_at: string;
}

interface ItemRow {
  id: string;
  batch_id: string;
  position: number;
  kind: string;
  title: string;
  project_id: string | null;
  initial_run_id: string | null;
  selection_version_id: string | null;
  skip_reason: string | null;
}

const BATCH_COLUMNS =
  'id, import_id, request_key, request_hash, competition_id, competition_name, season_id, season_label, stage_id, stage_name, ' +
  'round_id, round_name, selection_label, language, created_at';

const ITEM_COLUMNS =
  'id, batch_id, position, kind, title, project_id, initial_run_id, selection_version_id, skip_reason';

const SQL = {
  context:
    'SELECT c.id AS competition_id, c.name AS competition_name, s.id AS season_id, s.label AS season_label, ' +
    'st.id AS stage_id, st.name AS stage_name, r.id AS round_id, r.name AS round_name FROM competition_rounds r ' +
    'JOIN competition_seasons s ON s.id = r.season_id JOIN competitions c ON c.id = s.competition_id ' +
    'LEFT JOIN competition_stages st ON st.id = r.stage_id WHERE c.id = ? AND s.id = ? AND r.id = ?',
  seasonMatches:
    'SELECT m.id, m.round_id, m.kickoff_at, m.status, mr.home_score, mr.away_score, h.id AS home_id, ' +
    'h.name AS home_name, a.id AS away_id, a.name AS away_name FROM competition_matches m JOIN match_results mr ON mr.match_id = m.id ' +
    'JOIN managed_teams h ON h.id = m.home_team_id JOIN managed_teams a ON a.id = m.away_team_id ' +
    'WHERE m.season_id = ? ORDER BY m.kickoff_at IS NULL, m.kickoff_at, m.created_at, m.id',
  teamDisplayName: 'SELECT display_name FROM managed_teams WHERE id = ?',
  insertBatch: `INSERT INTO content_generation_batches (${BATCH_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  insertItem: `INSERT INTO content_generation_items (${ITEM_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  insertItemMatch: 'INSERT INTO content_generation_item_matches (item_id, match_id, position) VALUES (?, ?, ?)',
  batch: `SELECT ${BATCH_COLUMNS} FROM content_generation_batches WHERE id = ?`,
  batchByKey: `SELECT ${BATCH_COLUMNS} FROM content_generation_batches WHERE request_key = ?`,
  items: `SELECT ${ITEM_COLUMNS} FROM content_generation_items WHERE batch_id = ? ORDER BY position`,
  itemOfProject: `SELECT ${ITEM_COLUMNS} FROM content_generation_items WHERE project_id = ?`,
  itemMatches: 'SELECT match_id FROM content_generation_item_matches WHERE item_id = ? ORDER BY position',
} as const;

function contextOf(row: ContextRow): LocalContextRecord {
  return {
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    seasonId: row.season_id,
    seasonLabel: row.season_label,
    stageId: row.stage_id,
    stageName: row.stage_name,
    roundId: row.round_id,
    roundName: row.round_name,
  };
}

function batchOf(row: BatchRow): BatchRecord {
  return {
    ...contextOf(row),
    id: row.id,
    importId: row.import_id,
    requestKey: row.request_key,
    requestHash: row.request_hash,
    selectionLabel: row.selection_label,
    language: LanguageSchema.parse(row.language),
    createdAt: row.created_at,
  };
}

export class ContentBatchRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** The competition, season, optional stage and round, or null when the round is not in that season and competition. */
  context(competitionId: string, seasonId: string, roundId: string): LocalContextRecord | null {
    const row = this.#db.prepare<ContextRow>(SQL.context).get([competitionId, seasonId, roundId]);
    return row === undefined ? null : contextOf(row);
  }

  /**
   * The current presentation name of each given team that has one (TEAM-DISPLAY-01), for the project snapshot; a team
   * without one (or not found) is left out.
   */
  teamDisplayNames(teamIds: Iterable<string>): Record<string, string> {
    const statement = this.#db.prepare<{ display_name: string | null }>(SQL.teamDisplayName);
    const names: Record<string, string> = {};
    for (const teamId of teamIds) {
      const name = statement.get([teamId])?.display_name ?? null;
      if (name !== null) {
        names[teamId] = name;
      }
    }
    return names;
  }

  /** Every match of the season with its current effective values, in calendar order. */
  seasonMatches(seasonId: string): LocalMatchRecord[] {
    return this.#db
      .prepare<MatchRow>(SQL.seasonMatches)
      .all([seasonId])
      .map((row) => ({
        id: row.id,
        roundId: row.round_id,
        status: CompetitionMatchStatusSchema.parse(row.status),
        kickoffAt: row.kickoff_at,
        homeScore: row.home_score,
        awayScore: row.away_score,
        homeTeamId: row.home_id,
        homeTeamName: row.home_name,
        awayTeamId: row.away_id,
        awayTeamName: row.away_name,
      }));
  }

  batch(batchId: string): BatchRecord | null {
    const row = this.#db.prepare<BatchRow>(SQL.batch).get([batchId]);
    return row === undefined ? null : batchOf(row);
  }

  batchByKey(requestKey: string): BatchRecord | null {
    const row = this.#db.prepare<BatchRow>(SQL.batchByKey).get([requestKey]);
    return row === undefined ? null : batchOf(row);
  }

  items(batchId: string): BatchItemRecord[] {
    return this.#db
      .prepare<ItemRow>(SQL.items)
      .all([batchId])
      .map((row) => this.#item(row));
  }

  /** The generation item that owns a project, or null for a project created from the catalogue. */
  itemOfProject(projectId: string): BatchItemRecord | null {
    const row = this.#db.prepare<ItemRow>(SQL.itemOfProject).get([projectId]);
    return row === undefined ? null : this.#item(row);
  }

  insertBatch(batch: NewBatch): void {
    this.#db
      .prepare(SQL.insertBatch)
      .run([
        batch.id,
        batch.importId,
        batch.requestKey,
        batch.requestHash,
        batch.competitionId,
        batch.competitionName,
        batch.seasonId,
        batch.seasonLabel,
        batch.stageId,
        batch.stageName,
        batch.roundId,
        batch.roundName,
        batch.selectionLabel,
        batch.language,
        batch.createdAt,
      ]);
  }

  insertItem(batchId: string, item: NewBatchItem): void {
    this.#db
      .prepare(SQL.insertItem)
      .run([
        item.id,
        batchId,
        item.position,
        item.kind,
        item.title,
        item.projectId,
        item.initialRunId,
        item.selectionVersionId,
        item.skipReason,
      ]);
    item.matchIds.forEach((matchId, index) => {
      this.#db.prepare(SQL.insertItemMatch).run([item.id, matchId, index + 1]);
    });
  }

  #item(row: ItemRow): BatchItemRecord {
    return {
      id: row.id,
      batchId: row.batch_id,
      position: row.position,
      kind: ContentPieceKindSchema.parse(row.kind),
      title: row.title,
      projectId: row.project_id,
      initialRunId: row.initial_run_id,
      selectionVersionId: row.selection_version_id,
      skipReason: row.skip_reason === null ? null : ContentPieceSkipReasonSchema.parse(row.skip_reason),
      matchIds: this.#db
        .prepare<{ match_id: string }>(SQL.itemMatches)
        .all([row.id])
        .map((match) => match.match_id),
    };
  }
}
