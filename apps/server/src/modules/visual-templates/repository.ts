/**
 * Visual template repository (PD-ARCH-01G-C; migration 0029). Every statement is a constant with bound parameters
 * (T10-F14). The layer and asset documents are JSON columns validated with the contract schemas on every read, so a
 * row that does not match the contract is refused instead of being served.
 *
 * Published versions are never updated or deleted (the migration's triggers refuse it as well); a discarded draft is
 * kept with the status `discarded`.
 */
import {
  type DesignFormat,
  DesignFormatSchema,
  type VisualTemplateAssetRef,
  VisualTemplateAssetRefSchema,
  type VisualTemplateBackgroundSource,
  VisualTemplateBackgroundSourceSchema,
  type VisualTemplateContentType,
  VisualTemplateContentTypeSchema,
  type VisualTemplateLayer,
  VisualTemplateLayerSchema,
} from '@edr/contracts';
import { z } from 'zod';

import type { Db, TransactionWork } from '../../platform/db/index.js';

export interface TemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly contentType: VisualTemplateContentType;
  readonly format: DesignFormat;
  readonly sourceProposalId: string | null;
  readonly acknowledgedWarnings: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

export type StoredVersionStatus = 'draft' | 'published' | 'discarded';

export interface StoredBackground {
  readonly source: VisualTemplateBackgroundSource;
  readonly id: string;
  readonly sha256: string;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly width: number;
  readonly height: number;
}

export interface VersionRecord {
  readonly id: string;
  readonly templateId: string;
  readonly version: number;
  readonly status: StoredVersionStatus;
  readonly revision: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly background: StoredBackground;
  readonly layers: readonly VisualTemplateLayer[];
  readonly assets: readonly VisualTemplateAssetRef[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  content_type: string;
  format: string;
  source_proposal_id: string | null;
  acknowledged_warnings: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

interface VersionRow {
  id: string;
  template_id: string;
  version: number;
  status: string;
  revision: number;
  canvas_width: number;
  canvas_height: number;
  background_source: string;
  background_id: string;
  background_sha256: string;
  background_mime: string;
  background_width: number;
  background_height: number;
  layers_json: string;
  assets_json: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

const TEMPLATE_COLUMNS =
  'id, name, description, category, content_type, format, source_proposal_id, acknowledged_warnings, created_at, ' +
  'updated_at, archived_at, deleted_at';

const VERSION_COLUMNS =
  'id, template_id, version, status, revision, canvas_width, canvas_height, background_source, background_id, ' +
  'background_sha256, background_mime, background_width, background_height, layers_json, assets_json, created_at, ' +
  'updated_at, published_at';

const SQL = {
  templates: `SELECT ${TEMPLATE_COLUMNS} FROM visual_templates WHERE deleted_at IS NULL ORDER BY updated_at DESC, id`,
  template: `SELECT ${TEMPLATE_COLUMNS} FROM visual_templates WHERE id = ?`,
  insertTemplate: `INSERT INTO visual_templates (${TEMPLATE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  updateTemplate: 'UPDATE visual_templates SET name = ?, description = ?, category = ?, updated_at = ? WHERE id = ?',
  touchTemplate: 'UPDATE visual_templates SET updated_at = ? WHERE id = ?',
  archiveTemplate: 'UPDATE visual_templates SET archived_at = ?, updated_at = ? WHERE id = ?',
  deleteTemplate: 'UPDATE visual_templates SET deleted_at = ?, updated_at = ? WHERE id = ?',
  versions: `SELECT ${VERSION_COLUMNS} FROM visual_template_versions WHERE template_id = ? AND status <> 'discarded' ORDER BY version`,
  version: `SELECT ${VERSION_COLUMNS} FROM visual_template_versions WHERE id = ? AND template_id = ?`,
  latestVersionNumber: 'SELECT max(version) AS n FROM visual_template_versions WHERE template_id = ?',
  insertVersion: `INSERT INTO visual_template_versions (${VERSION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  saveDraft:
    'UPDATE visual_template_versions SET revision = revision + 1, background_source = ?, background_id = ?, ' +
    'background_sha256 = ?, background_mime = ?, background_width = ?, background_height = ?, layers_json = ?, ' +
    "assets_json = ?, updated_at = ? WHERE id = ? AND status = 'draft' AND revision = ?",
  publish:
    "UPDATE visual_template_versions SET status = 'published', published_at = ?, updated_at = ? WHERE id = ? " +
    "AND status = 'draft' AND revision = ?",
  discard: "UPDATE visual_template_versions SET status = 'discarded', updated_at = ? WHERE id = ? AND status = 'draft'",
} as const;

const LayersSchema = z.array(VisualTemplateLayerSchema);
const AssetsSchema = z.array(VisualTemplateAssetRefSchema);
const StoredStatusSchema = z.enum(['draft', 'published', 'discarded']);
const MimeSchema = z.enum(['image/png', 'image/jpeg']);

function templateOf(row: TemplateRow): TemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    contentType: VisualTemplateContentTypeSchema.parse(row.content_type),
    format: DesignFormatSchema.parse(row.format),
    sourceProposalId: row.source_proposal_id,
    acknowledgedWarnings: row.acknowledged_warnings === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
  };
}

function versionOf(row: VersionRow): VersionRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    status: StoredStatusSchema.parse(row.status),
    revision: row.revision,
    canvasWidth: row.canvas_width,
    canvasHeight: row.canvas_height,
    background: {
      source: VisualTemplateBackgroundSourceSchema.parse(row.background_source),
      id: row.background_id,
      sha256: row.background_sha256,
      mime: MimeSchema.parse(row.background_mime),
      width: row.background_width,
      height: row.background_height,
    },
    layers: LayersSchema.parse(JSON.parse(row.layers_json)),
    assets: AssetsSchema.parse(JSON.parse(row.assets_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export interface DraftContent {
  readonly background: StoredBackground;
  readonly layers: readonly VisualTemplateLayer[];
  readonly assets: readonly VisualTemplateAssetRef[];
}

export class VisualTemplateRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** Runs synchronous work in one `BEGIN IMMEDIATE` transaction (T10-F15). */
  transaction<T>(work: TransactionWork<T>): T {
    return this.#db.transaction(work);
  }

  /** Templates that are not deleted, most recently changed first. */
  templates(): TemplateRecord[] {
    return this.#db.prepare<TemplateRow>(SQL.templates).all().map(templateOf);
  }

  template(id: string): TemplateRecord | null {
    const row = this.#db.prepare<TemplateRow>(SQL.template).get([id]);
    return row === undefined ? null : templateOf(row);
  }

  /** The kept versions of a template (discarded drafts left out), oldest first. */
  versions(templateId: string): VersionRecord[] {
    return this.#db.prepare<VersionRow>(SQL.versions).all([templateId]).map(versionOf);
  }

  version(templateId: string, versionId: string): VersionRecord | null {
    const row = this.#db.prepare<VersionRow>(SQL.version).get([versionId, templateId]);
    return row === undefined ? null : versionOf(row);
  }

  /** The highest version number used by the template, discarded drafts included (numbers are never reused). */
  latestVersionNumber(templateId: string): number {
    return this.#db.prepare<{ n: number | null }>(SQL.latestVersionNumber).get([templateId])?.n ?? 0;
  }

  insertTemplate(record: TemplateRecord): void {
    this.#db
      .prepare(SQL.insertTemplate)
      .run([
        record.id,
        record.name,
        record.description,
        record.category,
        record.contentType,
        record.format,
        record.sourceProposalId,
        record.acknowledgedWarnings ? 1 : 0,
        record.createdAt,
        record.updatedAt,
        record.archivedAt,
        record.deletedAt,
      ]);
  }

  updateTemplate(id: string, values: Pick<TemplateRecord, 'name' | 'description' | 'category'>, now: string): void {
    this.#db.prepare(SQL.updateTemplate).run([values.name, values.description, values.category, now, id]);
  }

  touchTemplate(id: string, now: string): void {
    this.#db.prepare(SQL.touchTemplate).run([now, id]);
  }

  setArchived(id: string, archivedAt: string | null, now: string): void {
    this.#db.prepare(SQL.archiveTemplate).run([archivedAt, now, id]);
  }

  markDeleted(id: string, now: string): void {
    this.#db.prepare(SQL.deleteTemplate).run([now, now, id]);
  }

  insertVersion(record: Omit<VersionRecord, 'status' | 'publishedAt'>): void {
    this.#db
      .prepare(SQL.insertVersion)
      .run([
        record.id,
        record.templateId,
        record.version,
        'draft',
        record.revision,
        record.canvasWidth,
        record.canvasHeight,
        record.background.source,
        record.background.id,
        record.background.sha256,
        record.background.mime,
        record.background.width,
        record.background.height,
        JSON.stringify(record.layers),
        JSON.stringify(record.assets),
        record.createdAt,
        record.updatedAt,
        null,
      ]);
  }

  /** Saves a draft when its revision is still `revision`; false when another save came first. */
  saveDraft(versionId: string, revision: number, content: DraftContent, now: string): boolean {
    const { background } = content;
    const result = this.#db
      .prepare(SQL.saveDraft)
      .run([
        background.source,
        background.id,
        background.sha256,
        background.mime,
        background.width,
        background.height,
        JSON.stringify(content.layers),
        JSON.stringify(content.assets),
        now,
        versionId,
        revision,
      ]);
    return result.changes === 1;
  }

  /** Publishes a draft at `revision`; false when the draft changed or is no longer a draft. */
  publish(versionId: string, revision: number, now: string): boolean {
    return this.#db.prepare(SQL.publish).run([now, now, versionId, revision]).changes === 1;
  }

  discard(versionId: string, now: string): boolean {
    return this.#db.prepare(SQL.discard).run([now, versionId]).changes === 1;
  }
}
