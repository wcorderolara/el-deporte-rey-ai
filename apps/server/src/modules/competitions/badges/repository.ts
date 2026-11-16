/**
 * Team badge repository (PD-ARCH-01G-D; migration 0030). Every statement is a constant with bound parameters
 * (T10-F14). Rows are never deleted: replacing a badge retires the active row, and retiring keeps the row and the
 * file, so a project can always draw the badge it used.
 */
import type { Db, TransactionWork } from '../../../platform/db/index.js';

export interface TeamBadgeRecord {
  readonly id: string;
  readonly teamId: string;
  readonly filePath: string;
  readonly sha256: string;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly origin: 'manual' | 'provider';
  readonly source: string;
  readonly status: 'active' | 'retired';
  readonly createdAt: string;
  readonly retiredAt: string | null;
}

interface Row {
  id: string;
  team_id: string;
  file_path: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  byte_size: number;
  origin: string;
  source_note: string;
  status: string;
  created_at: string;
  retired_at: string | null;
}

const COLUMNS =
  'id, team_id, file_path, sha256, mime, width, height, byte_size, origin, source_note, status, created_at, retired_at';

const SQL = {
  badge: `SELECT ${COLUMNS} FROM team_badges WHERE id = ?`,
  active: `SELECT ${COLUMNS} FROM team_badges WHERE team_id = ? AND status = 'active'`,
  teamExists: 'SELECT 1 AS found FROM managed_teams WHERE id = ?',
  retire: "UPDATE team_badges SET status = 'retired', retired_at = ? WHERE team_id = ? AND status = 'active'",
  insert:
    'INSERT INTO team_badges (id, team_id, file_path, sha256, mime, width, height, byte_size, origin, source_note, ' +
    "authorization_confirmed, status, created_at, retired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, 1, 'active', ?, NULL)",
} as const;

function recordOf(row: Row): TeamBadgeRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filePath: row.file_path,
    sha256: row.sha256,
    mime: row.mime === 'image/jpeg' ? 'image/jpeg' : 'image/png',
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    origin: row.origin === 'provider' ? 'provider' : 'manual',
    source: row.source_note,
    status: row.status === 'retired' ? 'retired' : 'active',
    createdAt: row.created_at,
    retiredAt: row.retired_at,
  };
}

export class TeamBadgeRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  transaction<T>(work: TransactionWork<T>): T {
    return this.#db.transaction(work);
  }

  teamExists(teamId: string): boolean {
    return this.#db.prepare<{ found: number }>(SQL.teamExists).get([teamId]) !== undefined;
  }

  /** Any badge (active or retired) by its ID. */
  badge(id: string): TeamBadgeRecord | null {
    const row = this.#db.prepare<Row>(SQL.badge).get([id]);
    return row === undefined ? null : recordOf(row);
  }

  /** The active badge of a team, or null. */
  active(teamId: string): TeamBadgeRecord | null {
    const row = this.#db.prepare<Row>(SQL.active).get([teamId]);
    return row === undefined ? null : recordOf(row);
  }

  /** Retires the active badge of a team (if any); returns whether one was retired. */
  retire(teamId: string, now: string): boolean {
    return this.#db.prepare(SQL.retire).run([now, teamId]).changes > 0;
  }

  insert(record: Omit<TeamBadgeRecord, 'origin' | 'status' | 'retiredAt'>): void {
    this.#db
      .prepare(SQL.insert)
      .run([
        record.id,
        record.teamId,
        record.filePath,
        record.sha256,
        record.mime,
        record.width,
        record.height,
        record.byteSize,
        record.source,
        record.createdAt,
      ]);
  }
}
