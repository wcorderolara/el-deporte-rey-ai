/**
 * Brand library repository (data-model.md section 3.4, tables `brand_assets` and `brand_identity`; PD-ARCH-01G-A).
 * Every statement is a constant with bound parameters (T10-F14). Rows are validated when read: the ID against the UUID
 * pattern (T10-F13), the kind, MIME type and usage policy against their closed lists, the hash against its pattern; a
 * row that does not validate is a server defect.
 *
 * Rows are never deleted (OD-08): deactivation sets `active = 0` and `deactivated_at`; a deletion sets `deleted_at`
 * and keeps the row and its file. Deleted assets are left out of every list and lookup.
 */
import {
  type BrandAsset,
  type BrandAssetKind,
  type BrandAssetMime,
  BrandAssetSchema,
  type BrandAssetUsage,
  type BrandAssetUsagePolicy,
  type BrandColorRole,
  type BrandFontRole,
  BrandUsageNoteSchema,
  DateTimeSchema,
} from '@edr/contracts';
import { z } from 'zod';

import { type Db, type TransactionWork, fromSqlBoolean, toSqlBoolean } from '../../platform/db/index.js';

/** A stored asset: the contract view plus the relative file path and the lifecycle times. */
export interface BrandAssetRecord extends BrandAsset {
  readonly filePath: string;
  readonly deactivatedAt: string | null;
  readonly deletedAt: string | null;
}

/** A new asset row. */
export interface NewBrandAsset {
  readonly id: string;
  readonly kind: BrandAssetKind;
  readonly label: string;
  readonly description: string | null;
  readonly mime: BrandAssetMime;
  readonly filePath: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly usagePolicy: BrandAssetUsagePolicy;
  readonly official: boolean;
  readonly variant: string | null;
  readonly pose: string | null;
  readonly expression: string | null;
  readonly registeredAt: string;
}

/** The editable metadata of an asset row (the file never changes). */
export interface BrandAssetMetadata {
  readonly kind: BrandAssetKind;
  readonly label: string;
  readonly description: string | null;
  readonly usagePolicy: BrandAssetUsagePolicy;
  readonly official: boolean;
  readonly primary: boolean;
  readonly variant: string | null;
  readonly pose: string | null;
  readonly expression: string | null;
  readonly active: boolean;
  readonly deactivatedAt: string | null;
  readonly updatedAt: string;
}

interface BrandAssetRow {
  id: string;
  kind: string;
  label: string;
  description: string | null;
  mime: string;
  file_path: string;
  sha256: string;
  width: number;
  height: number;
  byte_size: number | null;
  usage_policy: string;
  official: number;
  is_primary: number;
  variant: string | null;
  pose: string | null;
  expression: string | null;
  active: number;
  registered_at: string;
  updated_at: string;
  deactivated_at: string | null;
  deleted_at: string | null;
}

/** A stored row is a server defect when it does not validate; the message is fixed text. */
export class BrandRowError extends Error {
  override readonly name = 'BrandRowError';

  constructor() {
    super('a brand row does not validate');
  }
}

const COLUMNS =
  'SELECT id, kind, label, description, mime, file_path, sha256, width, height, byte_size, usage_policy, official, ' +
  'is_primary, variant, pose, expression, active, registered_at, updated_at, deactivated_at, deleted_at ' +
  'FROM brand_assets';

/** The element versions whose render model draws the asset (image elements name their asset ID). */
const VERSIONS_USING =
  'SELECT v.id AS version_id, d.project_id AS project_id FROM element_versions v ' +
  'JOIN elements e ON e.id = v.element_id JOIN carousels c ON c.id = e.carousel_id ' +
  'JOIN content_drafts d ON d.id = c.draft_id ' +
  "WHERE v.render_model IS NOT NULL AND json_valid(v.render_model) AND EXISTS (SELECT 1 FROM json_each(v.render_model, '$.elements') x " +
  "WHERE json_extract(x.value, '$.kind') = 'image' AND json_extract(x.value, '$.assetId') = ?)";

const SQL = {
  insert:
    'INSERT INTO brand_assets (id, kind, label, description, mime, file_path, sha256, width, height, byte_size, ' +
    'usage_policy, official, is_primary, variant, pose, expression, active, registered_at, updated_at, ' +
    'deactivated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?, NULL, NULL)',
  byId: `${COLUMNS} WHERE id = ?`,
  bySha256: `${COLUMNS} WHERE sha256 = ?`,
  all: `${COLUMNS} WHERE deleted_at IS NULL ORDER BY registered_at, rowid`,
  activeByKind: `${COLUMNS} WHERE kind = ? AND active = 1 AND deleted_at IS NULL ORDER BY registered_at, rowid`,
  unmeasured: `${COLUMNS} WHERE byte_size IS NULL ORDER BY rowid`,
  updateMetadata:
    'UPDATE brand_assets SET kind = ?, label = ?, description = ?, usage_policy = ?, official = ?, is_primary = ?, ' +
    'variant = ?, pose = ?, expression = ?, active = ?, deactivated_at = ?, updated_at = ? WHERE id = ?',
  clearPrimary: 'UPDATE brand_assets SET is_primary = 0, updated_at = ? WHERE kind = ? AND is_primary = 1 AND id <> ?',
  setByteSize: 'UPDATE brand_assets SET byte_size = ? WHERE id = ? AND byte_size IS NULL',
  markDeleted:
    'UPDATE brand_assets SET active = 0, is_primary = 0, deactivated_at = coalesce(deactivated_at, ?), ' +
    'deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
  restore:
    'UPDATE brand_assets SET kind = ?, label = ?, description = ?, usage_policy = ?, official = ?, is_primary = 0, ' +
    'variant = ?, pose = ?, expression = ?, active = 1, deactivated_at = NULL, deleted_at = NULL, updated_at = ? ' +
    'WHERE id = ? AND deleted_at IS NOT NULL',
  versionsUsing: VERSIONS_USING,
  exportsOf:
    'SELECT count(DISTINCT export_id) AS n FROM export_files WHERE element_version_id IN (SELECT value FROM json_each(?))',
  identity:
    'SELECT description, graphic_preferences, color_usage, typography_usage, updated_at FROM brand_identity ' +
    "WHERE id = 'primary'",
  updateIdentity:
    'UPDATE brand_identity SET description = ?, graphic_preferences = ?, color_usage = ?, typography_usage = ?, ' +
    "updated_at = ? WHERE id = 'primary'",
} as const;

const RowExtrasSchema = z.strictObject({
  filePath: z.string().min(1).max(200),
  deactivatedAt: DateTimeSchema.nullable(),
  deletedAt: DateTimeSchema.nullable(),
});

function sqlBoolean(value: number, name: string): boolean | null {
  return value === 0 || value === 1 ? fromSqlBoolean(value, name) : null;
}

function toRecord(row: BrandAssetRow): BrandAssetRecord {
  const asset = BrandAssetSchema.safeParse({
    id: row.id,
    kind: row.kind,
    label: row.label,
    description: row.description,
    mime: row.mime,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    sha256: row.sha256,
    usagePolicy: row.usage_policy,
    official: sqlBoolean(row.official, 'official'),
    primary: sqlBoolean(row.is_primary, 'is_primary'),
    variant: row.variant,
    pose: row.pose,
    expression: row.expression,
    active: sqlBoolean(row.active, 'active'),
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  });
  const extras = RowExtrasSchema.safeParse({
    filePath: row.file_path,
    deactivatedAt: row.deactivated_at,
    deletedAt: row.deleted_at,
  });
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
    description: record.description,
    mime: record.mime,
    width: record.width,
    height: record.height,
    byteSize: record.byteSize,
    sha256: record.sha256,
    usagePolicy: record.usagePolicy,
    official: record.official,
    primary: record.primary,
    variant: record.variant,
    pose: record.pose,
    expression: record.expression,
    active: record.active,
    registeredAt: record.registeredAt,
    updatedAt: record.updatedAt,
  };
}

/** The stored descriptive fields of the identity. */
export interface StoredIdentity {
  readonly description: string | null;
  readonly graphicPreferences: string | null;
  readonly colorUsage: Partial<Record<BrandColorRole, string>>;
  readonly typographyUsage: Partial<Record<BrandFontRole, string>>;
  readonly updatedAt: string | null;
}

const UsageNotesSchema = z.record(z.string(), BrandUsageNoteSchema);

function usageNotes<T extends string>(text: string): Partial<Record<T, string>> {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new BrandRowError();
  }
  const parsed = UsageNotesSchema.safeParse(value);
  if (!parsed.success) {
    throw new BrandRowError();
  }
  return parsed.data as Partial<Record<T, string>>;
}

export class BrandAssetRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** Inserts a new, active asset (never primary: the primary mark is set by an update). */
  insert(asset: NewBrandAsset): void {
    this.#db
      .prepare(SQL.insert)
      .run([
        asset.id,
        asset.kind,
        asset.label,
        asset.description,
        asset.mime,
        asset.filePath,
        asset.sha256,
        asset.width,
        asset.height,
        asset.byteSize,
        asset.usagePolicy,
        toSqlBoolean(asset.official),
        asset.variant,
        asset.pose,
        asset.expression,
        asset.registeredAt,
        asset.registeredAt,
      ]);
  }

  /** An asset by ID, deleted ones included (the caller decides). */
  get(id: string): BrandAssetRecord | null {
    const row = this.#db.prepare<BrandAssetRow>(SQL.byId).get([id]);
    return row === undefined ? null : toRecord(row);
  }

  /** The asset with this content hash, deleted ones included, or null. */
  bySha256(sha256: string): BrandAssetRecord | null {
    const row = this.#db.prepare<BrandAssetRow>(SQL.bySha256).get([sha256]);
    return row === undefined ? null : toRecord(row);
  }

  /** Every asset of the library (not deleted) in registration order. */
  list(): BrandAssetRecord[] {
    return this.#db.prepare<BrandAssetRow>(SQL.all).all().map(toRecord);
  }

  /** The active assets of a kind (not deleted) in registration order. */
  activeByKind(kind: BrandAssetKind): BrandAssetRecord[] {
    return this.#db.prepare<BrandAssetRow>(SQL.activeByKind).all([kind]).map(toRecord);
  }

  /** The assets whose file size has not been measured yet (registered before 01G-A). */
  unmeasured(): BrandAssetRecord[] {
    return this.#db.prepare<BrandAssetRow>(SQL.unmeasured).all().map(toRecord);
  }

  /** Records the measured file size of an asset that has none. */
  setByteSize(id: string, byteSize: number): void {
    this.#db.prepare(SQL.setByteSize).run([byteSize, id]);
  }

  /** Writes the editable metadata; a primary asset first clears the primary mark of its kind. */
  updateMetadata(id: string, metadata: BrandAssetMetadata): void {
    if (metadata.primary) {
      this.#db.prepare(SQL.clearPrimary).run([metadata.updatedAt, metadata.kind, id]);
    }
    this.#db
      .prepare(SQL.updateMetadata)
      .run([
        metadata.kind,
        metadata.label,
        metadata.description,
        metadata.usagePolicy,
        toSqlBoolean(metadata.official),
        toSqlBoolean(metadata.primary),
        metadata.variant,
        metadata.pose,
        metadata.expression,
        toSqlBoolean(metadata.active),
        metadata.deactivatedAt,
        metadata.updatedAt,
        id,
      ]);
  }

  /** Marks an asset deleted (inactive, not primary; row and file kept). Returns false when it already was. */
  markDeleted(id: string, at: string): boolean {
    return this.#db.prepare(SQL.markDeleted).run([at, at, at, id]).changes === 1;
  }

  /** Restores a deleted asset with new metadata (its file is the same, active, not primary). */
  restore(
    id: string,
    metadata: Omit<
      NewBrandAsset,
      'id' | 'mime' | 'filePath' | 'sha256' | 'width' | 'height' | 'byteSize' | 'registeredAt'
    >,
    at: string,
  ): void {
    this.#db
      .prepare(SQL.restore)
      .run([
        metadata.kind,
        metadata.label,
        metadata.description,
        metadata.usagePolicy,
        toSqlBoolean(metadata.official),
        metadata.variant,
        metadata.pose,
        metadata.expression,
        at,
        id,
      ]);
  }

  /** Where an asset has been drawn: rendered slide versions, their projects and the exports holding them. */
  usage(id: string): BrandAssetUsage {
    const rows = this.#db.prepare<{ version_id: string; project_id: string }>(SQL.versionsUsing).all([id]);
    const versions = rows.map((row) => row.version_id);
    const exports =
      versions.length === 0
        ? 0
        : (this.#db.prepare<{ n: number }>(SQL.exportsOf).get([JSON.stringify(versions)])?.n ?? 0);
    return {
      renderedVersions: versions.length,
      projects: new Set(rows.map((row) => row.project_id)).size,
      exports,
    };
  }

  /** The descriptive fields of the identity. */
  identity(): StoredIdentity {
    const row = this.#db
      .prepare<{
        description: string | null;
        graphic_preferences: string | null;
        color_usage: string;
        typography_usage: string;
        updated_at: string | null;
      }>(SQL.identity)
      .get();
    if (row === undefined) {
      throw new BrandRowError();
    }
    return {
      description: row.description,
      graphicPreferences: row.graphic_preferences,
      colorUsage: usageNotes<BrandColorRole>(row.color_usage),
      typographyUsage: usageNotes<BrandFontRole>(row.typography_usage),
      updatedAt: row.updated_at,
    };
  }

  /** Writes the descriptive fields of the identity. */
  updateIdentity(identity: StoredIdentity & { readonly updatedAt: string }): void {
    this.#db
      .prepare(SQL.updateIdentity)
      .run([
        identity.description,
        identity.graphicPreferences,
        JSON.stringify(identity.colorUsage),
        JSON.stringify(identity.typographyUsage),
        identity.updatedAt,
      ]);
  }

  /** Runs synchronous work in one `BEGIN IMMEDIATE` transaction (T10-F15). */
  transaction<T>(work: TransactionWork<T>): T {
    return this.#db.transaction(work);
  }
}
