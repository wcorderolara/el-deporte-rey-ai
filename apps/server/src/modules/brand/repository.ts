/**
 * Brand asset repository (data-model.md section 3.4, table `brand_assets`). Every statement is a constant with bound
 * parameters (T10-F14). Rows are validated when read: the ID against the UUID pattern (T10-F13), the kind and MIME
 * type against their closed lists, the hash against its pattern; a row that does not validate is a server defect.
 * Rows are never deleted (OD-08): deactivation sets `active = 0` and `deactivated_at`.
 */
import {
  type BrandAsset,
  type BrandAssetKind,
  BrandAssetSchema,
  type BrandAssetMime,
  DateTimeSchema,
} from '@edr/contracts';
import { z } from 'zod';

import { type Db, type TransactionWork, fromSqlBoolean, toSqlBoolean } from '../../platform/db/index.js';

/** A stored asset: the contract view plus the relative file path. */
export interface BrandAssetRecord extends BrandAsset {
  readonly filePath: string;
  readonly deactivatedAt: string | null;
}

/** A new asset row. */
export interface NewBrandAsset {
  readonly id: string;
  readonly kind: BrandAssetKind;
  readonly label: string;
  readonly mime: BrandAssetMime;
  readonly filePath: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly registeredAt: string;
}

interface BrandAssetRow {
  id: string;
  kind: string;
  label: string;
  mime: string;
  file_path: string;
  sha256: string;
  width: number;
  height: number;
  active: number;
  registered_at: string;
  deactivated_at: string | null;
}

/** A stored row is a server defect when it does not validate; the message is fixed text. */
export class BrandRowError extends Error {
  override readonly name = 'BrandRowError';

  constructor() {
    super('a brand_assets row does not validate');
  }
}

const COLUMNS =
  'SELECT id, kind, label, mime, file_path, sha256, width, height, active, registered_at, deactivated_at ' +
  'FROM brand_assets';

const SQL = {
  insert:
    'INSERT INTO brand_assets (id, kind, label, mime, file_path, sha256, width, height, active, registered_at, ' +
    'deactivated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)',
  byId: `${COLUMNS} WHERE id = ?`,
  idBySha256: 'SELECT id FROM brand_assets WHERE sha256 = ?',
  all: `${COLUMNS} ORDER BY registered_at, rowid`,
  activeByKind: `${COLUMNS} WHERE kind = ? AND active = 1 ORDER BY registered_at, rowid`,
  setActive: 'UPDATE brand_assets SET active = ?, deactivated_at = ? WHERE id = ?',
} as const;

const RowExtrasSchema = z.strictObject({
  filePath: z.string().min(1).max(200),
  deactivatedAt: DateTimeSchema.nullable(),
});

function toRecord(row: BrandAssetRow): BrandAssetRecord {
  const asset = BrandAssetSchema.safeParse({
    id: row.id,
    kind: row.kind,
    label: row.label,
    mime: row.mime,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    active: row.active === 0 || row.active === 1 ? fromSqlBoolean(row.active, 'active') : null,
    registeredAt: row.registered_at,
  });
  const extras = RowExtrasSchema.safeParse({ filePath: row.file_path, deactivatedAt: row.deactivated_at });
  if (!asset.success || !extras.success) {
    throw new BrandRowError();
  }
  return { ...asset.data, ...extras.data };
}

/** The public view of a record (contract `BrandAsset`). */
export function toBrandAsset(record: BrandAssetRecord): BrandAsset {
  return {
    id: record.id,
    kind: record.kind,
    label: record.label,
    mime: record.mime,
    width: record.width,
    height: record.height,
    sha256: record.sha256,
    active: record.active,
    registeredAt: record.registeredAt,
  };
}

export class BrandAssetRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** Inserts a new, active asset. */
  insert(asset: NewBrandAsset): void {
    this.#db
      .prepare(SQL.insert)
      .run([
        asset.id,
        asset.kind,
        asset.label,
        asset.mime,
        asset.filePath,
        asset.sha256,
        asset.width,
        asset.height,
        asset.registeredAt,
      ]);
  }

  get(id: string): BrandAssetRecord | null {
    const row = this.#db.prepare<BrandAssetRow>(SQL.byId).get([id]);
    return row === undefined ? null : toRecord(row);
  }

  /** The ID of the asset with this content hash, or null. */
  idBySha256(sha256: string): string | null {
    const row = this.#db.prepare<{ id: string }>(SQL.idBySha256).get([sha256]);
    return row === undefined ? null : row.id;
  }

  /** Every asset in registration order. */
  list(): BrandAssetRecord[] {
    return this.#db.prepare<BrandAssetRow>(SQL.all).all().map(toRecord);
  }

  /** The active assets of a kind in registration order. */
  activeByKind(kind: BrandAssetKind): BrandAssetRecord[] {
    return this.#db.prepare<BrandAssetRow>(SQL.activeByKind).all([kind]).map(toRecord);
  }

  /** Sets the active flag; `deactivatedAt` is the time of deactivation or null when active. */
  setActive(id: string, active: boolean, deactivatedAt: string | null): void {
    this.#db.prepare(SQL.setActive).run([toSqlBoolean(active), deactivatedAt, id]);
  }

  /** Runs synchronous work in one `BEGIN IMMEDIATE` transaction (T10-F15). */
  transaction<T>(work: TransactionWork<T>): T {
    return this.#db.transaction(work);
  }
}
