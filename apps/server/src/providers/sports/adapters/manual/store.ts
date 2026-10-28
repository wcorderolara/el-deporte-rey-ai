/**
 * Read access of the ManualDataProvider to the import tables (data-model.md section 3.5) through the `Db` port, with
 * constant SQL and bound parameters only. The adapter only reads; the import module writes (T50).
 */
import { type ManualSelection, ManualSelectionSchema } from '@edr/contracts';

import { type Db, readJsonColumn } from '../../../../platform/db/index.js';

export interface StoredCompetition {
  readonly competitionId: string;
  readonly name: string;
  readonly areaName: string | null;
}

export interface StoredSeason {
  readonly seasonId: string;
  readonly label: string;
}

/** A current selection version without its data. */
export interface CurrentVersionHeader {
  readonly stageId: string;
  readonly stageName: string;
  readonly stageOrder: number;
  /** 0 = the stage selected as a whole. */
  readonly matchdayKey: number;
  readonly hasStandings: boolean;
}

/** The current version of one selection with its data. */
export interface CurrentVersion {
  readonly versionId: string;
  readonly importId: string;
  readonly versionNumber: number;
  readonly selection: ManualSelection;
}

type Row = Record<string, unknown>;

const SELECT_COMPETITIONS = `SELECT competition_id, name, area_name FROM manual_competitions
  WHERE source_id = ? ORDER BY competition_id`;

const SELECT_COMPETITION = `SELECT competition_id, name, area_name FROM manual_competitions
  WHERE source_id = ? AND competition_id = ?`;

const SELECT_SEASONS = `SELECT season_id, label FROM manual_seasons WHERE competition_id = ? ORDER BY season_id`;

const SELECT_SEASON = 'SELECT season_id, label FROM manual_seasons WHERE competition_id = ? AND season_id = ?';

/** Current versions of a season, newest first (the stage name and order of the newest version win). */
const SELECT_CURRENT_HEADERS = `SELECT stage_id, stage_name, stage_order, matchday_key,
       coalesce(json_type(data, '$.standings') = 'object', 0) AS has_standings
  FROM manual_selection_versions
 WHERE competition_id = ? AND season_id = ? AND superseded_at IS NULL
 ORDER BY created_at DESC, rowid DESC`;

const SELECT_CURRENT_VERSION = `SELECT id, import_id, version_number, data FROM manual_selection_versions
 WHERE competition_id = ? AND season_id = ? AND stage_id = ? AND matchday_key = ? AND superseded_at IS NULL`;

function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('a stored text column has an unexpected type');
  }
  return value;
}

function integer(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  throw new TypeError('a stored integer column has an unexpected type');
}

function toCompetition(row: Row): StoredCompetition {
  const area = row['area_name'];
  return {
    competitionId: text(row['competition_id']),
    name: text(row['name']),
    areaName: area === null ? null : text(area),
  };
}

export class ManualStore {
  constructor(private readonly db: Db) {}

  competitions(sourceId: string): StoredCompetition[] {
    return this.db.prepare<Row>(SELECT_COMPETITIONS).all([sourceId]).map(toCompetition);
  }

  competition(sourceId: string, competitionId: string): StoredCompetition | undefined {
    const row = this.db.prepare<Row>(SELECT_COMPETITION).get([sourceId, competitionId]);
    return row === undefined ? undefined : toCompetition(row);
  }

  seasons(competitionId: string): StoredSeason[] {
    return this.db
      .prepare<Row>(SELECT_SEASONS)
      .all([competitionId])
      .map((row) => ({ seasonId: text(row['season_id']), label: text(row['label']) }));
  }

  season(competitionId: string, seasonId: string): StoredSeason | undefined {
    const row = this.db.prepare<Row>(SELECT_SEASON).get([competitionId, seasonId]);
    return row === undefined ? undefined : { seasonId: text(row['season_id']), label: text(row['label']) };
  }

  /** Current version headers of a season, newest first. */
  currentHeaders(competitionId: string, seasonId: string): CurrentVersionHeader[] {
    return this.db
      .prepare<Row>(SELECT_CURRENT_HEADERS)
      .all([competitionId, seasonId])
      .map((row) => ({
        stageId: text(row['stage_id']),
        stageName: text(row['stage_name']),
        stageOrder: integer(row['stage_order']),
        matchdayKey: integer(row['matchday_key']),
        hasStandings: integer(row['has_standings']) === 1,
      }));
  }

  /** The current version of a selection, or undefined. */
  currentVersion(
    competitionId: string,
    seasonId: string,
    stageId: string,
    matchdayKey: number,
  ): CurrentVersion | undefined {
    const row = this.db.prepare<Row>(SELECT_CURRENT_VERSION).get([competitionId, seasonId, stageId, matchdayKey]);
    if (row === undefined) {
      return undefined;
    }
    return {
      versionId: text(row['id']),
      importId: text(row['import_id']),
      versionNumber: integer(row['version_number']),
      selection: readJsonColumn(ManualSelectionSchema, row['data'], 'manual_selection_versions.data'),
    };
  }
}
