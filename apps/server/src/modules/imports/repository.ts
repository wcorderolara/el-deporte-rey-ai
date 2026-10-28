/**
 * Import repository (data-model.md section 3.5; AD-05, T10-F14, T10-F15): every read and write of the import tables
 * through the `Db` port, with constant SQL and bound parameters only. Rows are never deleted (OD-08); a reimport
 * supersedes the current version of a selection and inserts the next one (R-068, R-278).
 *
 * `applyImport` runs inside the caller's `BEGIN IMMEDIATE` transaction (`db.transaction`), synchronously.
 */
import { type ManualSelection, ManualSelectionSchema } from '@edr/contracts';

import type { SourceConfig } from '../../platform/config/index.js';
import { type Db, readJsonColumn, toSqlBoolean, writeJsonColumn } from '../../platform/db/index.js';

export type ImportChannel = 'json_file' | 'csv_file' | 'form';

/** A stored import record with its competition name and season label. */
export interface ImportRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly channel: ImportChannel;
  readonly fileName: string | null;
  readonly declaredSource: string | null;
  readonly competitionId: string;
  readonly competitionName: string;
  readonly seasonId: string;
  readonly seasonLabel: string;
  readonly originalPath: string;
  readonly originalSha256: string;
  readonly originalBytes: number;
  readonly receivedAt: string;
}

/** A stored selection version without its data. */
export interface VersionHeader {
  readonly id: string;
  readonly importId: string;
  readonly competitionId: string;
  readonly seasonId: string;
  readonly stageId: string;
  readonly stageName: string;
  readonly stageOrder: number;
  /** 0 = the stage selected as a whole. */
  readonly matchdayKey: number;
  readonly versionNumber: number;
  readonly createdAt: string;
  readonly supersededAt: string | null;
}

/** A stored selection version with its validated data. */
export interface VersionRecord extends VersionHeader {
  readonly selection: ManualSelection;
}

/** One new version to insert. */
export interface NewVersion {
  readonly id: string;
  readonly selection: ManualSelection;
}

/** Everything one applied import writes. */
export interface ImportApplication {
  readonly source: SourceConfig;
  readonly importId: string;
  readonly channel: ImportChannel;
  readonly fileName: string | null;
  readonly declaredSource: string | null;
  readonly competition: { readonly id: string; readonly name: string; readonly areaName: string | null };
  readonly season: { readonly id: string; readonly label: string };
  readonly originalPath: string;
  readonly originalSha256: string;
  readonly originalBytes: number;
  readonly receivedAt: string;
  readonly versions: readonly NewVersion[];
}

/** A stored competition or season whose name differs from the import; detected again inside the transaction. */
export class MetadataChangedError extends Error {
  override readonly name = 'MetadataChangedError';
  constructor() {
    super('manual metadata changed during the import');
  }
}

const CHANNELS: ReadonlySet<string> = new Set(['json_file', 'csv_file', 'form']);

function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('a stored text column has an unexpected type');
  }
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
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

function channelOf(value: unknown): ImportChannel {
  const channel = text(value);
  if (!CHANNELS.has(channel)) {
    throw new TypeError('a stored import channel is unknown');
  }
  return channel as ImportChannel;
}

type Row = Record<string, unknown>;

const IMPORT_COLUMNS = `
  i.id, i.source_id, i.channel, i.file_name, i.declared_source, i.competition_id, c.name AS competition_name,
  i.season_id, s.label AS season_label, i.original_path, i.original_sha256, i.original_bytes, i.received_at`;

const SELECT_IMPORT =
  'SELECT' +
  IMPORT_COLUMNS +
  ` FROM imports i
    JOIN manual_competitions c ON c.competition_id = i.competition_id
    JOIN manual_seasons s ON s.competition_id = i.competition_id AND s.season_id = i.season_id
    WHERE i.id = ?`;

const SELECT_IMPORTS =
  'SELECT' +
  IMPORT_COLUMNS +
  ` FROM imports i
    JOIN manual_competitions c ON c.competition_id = i.competition_id
    JOIN manual_seasons s ON s.competition_id = i.competition_id AND s.season_id = i.season_id
    ORDER BY i.received_at DESC, i.rowid DESC`;

const VERSION_COLUMNS = `id, import_id, competition_id, season_id, stage_id, stage_name, stage_order, matchday_key,
  version_number, created_at, superseded_at`;

const SELECT_CURRENT_VERSION =
  'SELECT ' +
  VERSION_COLUMNS +
  `, data FROM manual_selection_versions
    WHERE competition_id = ? AND season_id = ? AND stage_id = ? AND matchday_key = ? AND superseded_at IS NULL`;

const SELECT_VERSION = 'SELECT ' + VERSION_COLUMNS + ', data FROM manual_selection_versions WHERE id = ?';

const SELECT_VERSIONS_OF_IMPORT =
  'SELECT ' +
  VERSION_COLUMNS +
  ` FROM manual_selection_versions WHERE import_id = ?
    ORDER BY stage_order, stage_id, matchday_key`;

const SELECT_VERSIONS_OF_SEASON =
  'SELECT ' +
  VERSION_COLUMNS +
  ` FROM manual_selection_versions WHERE competition_id = ? AND season_id = ?
    ORDER BY stage_order, stage_id, matchday_key, version_number`;

function toImport(row: Row): ImportRecord {
  return {
    id: text(row['id']),
    sourceId: text(row['source_id']),
    channel: channelOf(row['channel']),
    fileName: nullableText(row['file_name']),
    declaredSource: nullableText(row['declared_source']),
    competitionId: text(row['competition_id']),
    competitionName: text(row['competition_name']),
    seasonId: text(row['season_id']),
    seasonLabel: text(row['season_label']),
    originalPath: text(row['original_path']),
    originalSha256: text(row['original_sha256']),
    originalBytes: integer(row['original_bytes']),
    receivedAt: text(row['received_at']),
  };
}

function toHeader(row: Row): VersionHeader {
  return {
    id: text(row['id']),
    importId: text(row['import_id']),
    competitionId: text(row['competition_id']),
    seasonId: text(row['season_id']),
    stageId: text(row['stage_id']),
    stageName: text(row['stage_name']),
    stageOrder: integer(row['stage_order']),
    matchdayKey: integer(row['matchday_key']),
    versionNumber: integer(row['version_number']),
    createdAt: text(row['created_at']),
    supersededAt: nullableText(row['superseded_at']),
  };
}

/** The matchday key of a selection: its matchday, or 0 for the stage as a whole. */
export function matchdayKeyOf(matchday: number | null): number {
  return matchday ?? 0;
}

export class ImportRepository {
  constructor(private readonly db: Db) {}

  /** Name of a stored manual competition, or undefined. */
  competitionName(competitionId: string): string | undefined {
    const row = this.db
      .prepare<Row>('SELECT name FROM manual_competitions WHERE competition_id = ?')
      .get([competitionId]);
    return row === undefined ? undefined : text(row['name']);
  }

  /** Label of a stored manual season, or undefined. */
  seasonLabel(competitionId: string, seasonId: string): string | undefined {
    const row = this.db
      .prepare<Row>('SELECT label FROM manual_seasons WHERE competition_id = ? AND season_id = ?')
      .get([competitionId, seasonId]);
    return row === undefined ? undefined : text(row['label']);
  }

  /** Number of stored seasons of a competition. */
  seasonCount(competitionId: string): number {
    const row = this.db
      .prepare<Row>('SELECT count(*) AS n FROM manual_seasons WHERE competition_id = ?')
      .get([competitionId]);
    return integer(row?.['n'] ?? 0);
  }

  /** Stage IDs with a current version in a season. */
  currentStageIds(competitionId: string, seasonId: string): ReadonlySet<string> {
    const rows = this.db
      .prepare<Row>(
        `SELECT DISTINCT stage_id FROM manual_selection_versions
          WHERE competition_id = ? AND season_id = ? AND superseded_at IS NULL`,
      )
      .all([competitionId, seasonId]);
    return new Set(rows.map((row) => text(row['stage_id'])));
  }

  /** Matchday numbers (not 0) with a current version in a stage. */
  currentMatchdays(competitionId: string, seasonId: string, stageId: string): ReadonlySet<number> {
    const rows = this.db
      .prepare<Row>(
        `SELECT DISTINCT matchday_key FROM manual_selection_versions
          WHERE competition_id = ? AND season_id = ? AND stage_id = ? AND matchday_key > 0 AND superseded_at IS NULL`,
      )
      .all([competitionId, seasonId, stageId]);
    return new Set(rows.map((row) => integer(row['matchday_key'])));
  }

  /** The current version of a selection, or undefined. */
  currentVersion(
    competitionId: string,
    seasonId: string,
    stageId: string,
    matchday: number | null,
  ): VersionRecord | undefined {
    const row = this.db
      .prepare<Row>(SELECT_CURRENT_VERSION)
      .get([competitionId, seasonId, stageId, matchdayKeyOf(matchday)]);
    return row === undefined ? undefined : this.#toVersion(row);
  }

  #toVersion(row: Row): VersionRecord {
    return {
      ...toHeader(row),
      selection: readJsonColumn(ManualSelectionSchema, row['data'], 'manual_selection_versions.data'),
    };
  }

  /**
   * Writes an applied import (inside the caller's transaction): the source row when absent, the import record, the
   * competition and season when new, and per selection the next version with the previous one superseded. Throws
   * `MetadataChangedError` when a stored competition name or season label differs (checked again here).
   */
  applyImport(application: ImportApplication): void {
    const { source, competition, season, receivedAt } = application;
    this.db
      .prepare(
        `INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group,
                              publication_permission, adapter, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
      )
      .run([
        source.id,
        source.name,
        source.mode,
        source.role,
        toSqlBoolean(source.officialPublication),
        toSqlBoolean(source.accepted),
        source.independenceGroup,
        source.publicationPermission,
        source.adapter,
        receivedAt,
        receivedAt,
      ]);

    this.db
      .prepare(
        `INSERT INTO imports (id, source_id, channel, file_name, declared_source, competition_id, season_id,
                              original_path, original_sha256, original_bytes, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run([
        application.importId,
        source.id,
        application.channel,
        application.fileName,
        application.declaredSource,
        competition.id,
        season.id,
        application.originalPath,
        application.originalSha256,
        application.originalBytes,
        receivedAt,
      ]);

    const storedName = this.competitionName(competition.id);
    if (storedName === undefined) {
      this.db
        .prepare(
          `INSERT INTO manual_competitions (competition_id, source_id, name, area_name, first_import_id)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run([competition.id, source.id, competition.name, competition.areaName, application.importId]);
    } else if (storedName !== competition.name) {
      throw new MetadataChangedError();
    }

    const storedLabel = this.seasonLabel(competition.id, season.id);
    if (storedLabel === undefined) {
      this.db
        .prepare('INSERT INTO manual_seasons (competition_id, season_id, label) VALUES (?, ?, ?)')
        .run([competition.id, season.id, season.label]);
    } else if (storedLabel !== season.label) {
      throw new MetadataChangedError();
    }

    const supersede = this.db.prepare(
      'UPDATE manual_selection_versions SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL',
    );
    const nextNumber = this.db.prepare<Row>(
      `SELECT coalesce(max(version_number), 0) + 1 AS next FROM manual_selection_versions
        WHERE competition_id = ? AND season_id = ? AND stage_id = ? AND matchday_key = ?`,
    );
    const current = this.db.prepare<Row>(
      `SELECT id FROM manual_selection_versions
        WHERE competition_id = ? AND season_id = ? AND stage_id = ? AND matchday_key = ? AND superseded_at IS NULL`,
    );
    const insert = this.db.prepare(
      `INSERT INTO manual_selection_versions (id, import_id, competition_id, season_id, stage_id, stage_name,
                                              stage_order, matchday_key, version_number, data, created_at,
                                              superseded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    );
    for (const version of application.versions) {
      const { stage, matchday } = version.selection;
      const key = [competition.id, season.id, stage.id, matchdayKeyOf(matchday)];
      const previous = current.get(key);
      if (previous !== undefined) {
        supersede.run([receivedAt, text(previous['id'])]);
      }
      const number = integer(nextNumber.get(key)?.['next'] ?? 1);
      insert.run([
        version.id,
        application.importId,
        competition.id,
        season.id,
        stage.id,
        stage.name,
        stage.order,
        matchdayKeyOf(matchday),
        number,
        writeJsonColumn(ManualSelectionSchema, version.selection, 'manual_selection_versions.data'),
        receivedAt,
      ]);
    }
  }

  /** An import record, or undefined. */
  findImport(importId: string): ImportRecord | undefined {
    const row = this.db.prepare<Row>(SELECT_IMPORT).get([importId]);
    return row === undefined ? undefined : toImport(row);
  }

  /** Every import, newest first. */
  listImports(): ImportRecord[] {
    return this.db.prepare<Row>(SELECT_IMPORTS).all().map(toImport);
  }

  /** The versions created by an import, by stage order, stage ID and matchday. */
  versionsOfImport(importId: string): VersionHeader[] {
    return this.db.prepare<Row>(SELECT_VERSIONS_OF_IMPORT).all([importId]).map(toHeader);
  }

  /** Every version of a competition season, by stage order, stage ID, matchday and version number. */
  versionsOfSeason(competitionId: string, seasonId: string): VersionHeader[] {
    return this.db.prepare<Row>(SELECT_VERSIONS_OF_SEASON).all([competitionId, seasonId]).map(toHeader);
  }

  /** One version with its data, or undefined. */
  findVersion(versionId: string): VersionRecord | undefined {
    const row = this.db.prepare<Row>(SELECT_VERSION).get([versionId]);
    return row === undefined ? undefined : this.#toVersion(row);
  }
}
