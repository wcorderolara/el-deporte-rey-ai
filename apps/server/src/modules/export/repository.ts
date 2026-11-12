/**
 * Export repository (data-model.md sections 3.2 to 3.4 and 6: `projects`, `sources`, `final_approvals`,
 * `element_versions`, `elements`, `element_fact_refs`, `facts`, `fact_evidence`, `observations`, `exports`,
 * `export_files`; T10-F14, T10-F15).
 *
 * Reads what an export writes (the final-approval row with its stored version-set text, the versions of the set,
 * their fact references, the facts' keys, kinds and evidence sources, the project and its source, and the approved
 * current editorial versions of the carousel's draft, REVIEW-APPROVAL-01) and records an export with its files. Every statement is a constant with bound parameters; enumerations and IDs are validated on
 * read (IDs against the UUID pattern before any path is built from them, T10-F13); rows are never updated or deleted
 * (OD-08). The export record and its guard run in one transaction of the caller (`Db.transaction`).
 */
import {
  DataModeSchema,
  type DataMode,
  EDITORIAL_DELIVERABLES,
  type EditorialDeliverable,
  EditorialDeliverableSchema,
  EditorialFieldNameSchema,
  FactKindSchema,
  LanguageSchema,
  Sha256Schema,
  SlideTypeSchema,
  SourceIdSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

import { type Db, readJsonColumn } from '../../platform/db/index.js';

const SQL = {
  project:
    'SELECT p.id AS id, p.competition_id AS competition_id, p.competition_name AS competition_name, ' +
    'p.source_id AS source_id, p.data_mode AS data_mode, p.season_id AS season_id, p.season_label AS season_label, ' +
    'p.stage_id AS stage_id, p.stage_label AS stage_label, p.matchday AS matchday, p.language AS language, ' +
    's.name AS source_name, s.mode AS source_mode FROM projects p JOIN sources s ON s.id = p.source_id ' +
    'WHERE p.id = ? AND p.deleted_at IS NULL',
  projectExists: 'SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL',
  validFinalApprovals:
    'SELECT id, carousel_id, version_set, version_set_sha256, approved_at FROM final_approvals ' +
    'WHERE carousel_id = ? AND invalidated_at IS NULL ORDER BY approved_at DESC, rowid DESC',
  finalApprovalInvalidatedAt: 'SELECT invalidated_at FROM final_approvals WHERE id = ?',
  version:
    'SELECT v.id AS id, v.element_id AS element_id, v.version_number AS version_number, v.text AS text, ' +
    'v.image_path AS image_path, v.image_sha256 AS image_sha256, v.width AS width, v.height AS height, ' +
    'e.carousel_id AS carousel_id, e.kind AS kind, e.position AS position, e.slide_type AS slide_type ' +
    'FROM element_versions v JOIN elements e ON e.id = v.element_id WHERE v.id = ?',
  factRefs: 'SELECT fact_id FROM element_fact_refs WHERE element_version_id = ? ORDER BY fact_id',
  fact: 'SELECT id, run_id, fact_key, kind FROM facts WHERE id = ?',
  factEvidence:
    'SELECT DISTINCT o.source_id AS source_id, o.data_mode AS data_mode, e.relation AS relation, ' +
    'o.import_version_id AS import_version_id FROM fact_evidence e JOIN observations o ON o.id = e.observation_id ' +
    'WHERE e.fact_id = ? ORDER BY o.source_id, e.relation, o.import_version_id',
  source: 'SELECT id, name, mode FROM sources WHERE id = ?',
  insertExport:
    'INSERT INTO exports (id, carousel_id, final_approval_id, exported_at, directory, manifest_sha256, data_mode) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)',
  insertExportFile:
    'INSERT INTO export_files (export_id, position, kind, element_version_id, file_name, sha256) ' +
    'VALUES (?, ?, ?, ?, ?, ?)',
  exportsOfProject:
    'SELECT x.id AS id, x.carousel_id AS carousel_id, x.final_approval_id AS final_approval_id, ' +
    'x.exported_at AS exported_at, x.directory AS directory, x.manifest_sha256 AS manifest_sha256, ' +
    'x.data_mode AS data_mode, d.project_id AS project_id FROM exports x ' +
    'JOIN carousels c ON c.id = x.carousel_id JOIN content_drafts d ON d.id = c.draft_id ' +
    'JOIN projects p ON p.id = d.project_id AND p.deleted_at IS NULL ' +
    'WHERE d.project_id = ? ORDER BY x.exported_at DESC, x.rowid DESC',
  export:
    'SELECT x.id AS id, x.carousel_id AS carousel_id, x.final_approval_id AS final_approval_id, ' +
    'x.exported_at AS exported_at, x.directory AS directory, x.manifest_sha256 AS manifest_sha256, ' +
    'x.data_mode AS data_mode, d.project_id AS project_id FROM exports x ' +
    'JOIN carousels c ON c.id = x.carousel_id JOIN content_drafts d ON d.id = c.draft_id ' +
    'JOIN projects p ON p.id = d.project_id AND p.deleted_at IS NULL WHERE x.id = ?',
  exportFiles:
    'SELECT position, kind, element_version_id, file_name, sha256 FROM export_files WHERE export_id = ? ' +
    'ORDER BY position, file_name',
  carouselDraft: 'SELECT draft_id FROM carousels WHERE id = ?',
  // The current, approved version of each editorial deliverable of a draft (PD-ARCH-01H; REVIEW-APPROVAL-01).
  approvedEditorialVersions:
    'SELECT id, deliverable, version_number, fields, flags, fact_ids, approved_at FROM editorial_versions ' +
    'WHERE draft_id = ? AND superseded_at IS NULL AND approved_at IS NOT NULL',
} as const;

type Row = Record<string, unknown>;

const IntSchema = z.int();
const TimeSchema = z.string().min(1).max(40);
const TextSchema = z.string().min(1);
const ElementKindSchema = z.enum(['slide', 'caption']);
const RelationSchema = z.enum(['supports', 'disagrees', 'consulted']);
const FileKindSchema = z.enum(['slide_image', 'caption_text', 'manifest', 'editorial_text']);
const FileNameSchema = z.string().regex(/^([0-9]{2}\.png|caption\.txt|copy-editorial\.txt|manifest\.json)$/);
const EditorialFieldsSchema = z.array(z.looseObject({ name: EditorialFieldNameSchema, text: z.string() })).min(1);
const FactIdsSchema = z.array(UuidSchema);

/** A project with its chosen source (R-287). */
export interface ExportProject {
  readonly id: string;
  readonly competitionId: string;
  readonly competitionName: string;
  readonly seasonId: string;
  readonly seasonLabel: string;
  readonly stageId: string;
  readonly stageLabel: string;
  readonly matchday: number | null;
  readonly language: z.infer<typeof LanguageSchema>;
  readonly dataMode: DataMode;
  readonly source: ExportSource;
}

export interface ExportSource {
  readonly id: string;
  readonly name: string;
  readonly dataMode: DataMode;
}

/** A valid-looking final-approval row with its stored version-set text (never re-serialized). */
export interface FinalApprovalRow {
  readonly id: string;
  readonly carouselId: string;
  /** The stored `version_set` text, exactly as hashed by the review module (T37). */
  readonly versionSetText: string;
  readonly versionSetSha256: string;
  readonly approvedAt: string;
}

/** An element version with its element (kind, position, slide type) and render reference. */
export interface ExportVersionRow {
  readonly id: string;
  readonly elementId: string;
  readonly carouselId: string;
  readonly versionNumber: number;
  readonly kind: 'slide' | 'caption';
  readonly position: number;
  readonly slideType: z.infer<typeof SlideTypeSchema> | null;
  /** The stored text JSON (validated by the caller with the content module's schema). */
  readonly text: string;
  readonly hasImage: boolean;
  readonly imageSha256: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface ExportFactRow {
  readonly id: string;
  readonly runId: string;
  readonly factKey: string;
  readonly kind: z.infer<typeof FactKindSchema>;
}

export interface ExportEvidenceRow {
  readonly sourceId: string;
  readonly dataMode: DataMode;
  readonly relation: z.infer<typeof RelationSchema>;
  readonly importVersionId: string | null;
}

export interface StoredExport {
  readonly id: string;
  readonly projectId: string;
  readonly carouselId: string;
  readonly finalApprovalId: string;
  readonly exportedAt: string;
  readonly directory: string;
  readonly manifestSha256: string;
  readonly dataMode: DataMode;
}

export interface StoredExportFile {
  readonly position: number;
  readonly kind: z.infer<typeof FileKindSchema>;
  readonly elementVersionId: string | null;
  readonly fileName: string;
  readonly sha256: string;
}

/** An approved current version of an editorial deliverable of a draft (REVIEW-APPROVAL-01). */
export interface ApprovedEditorialVersion {
  readonly id: string;
  readonly deliverable: EditorialDeliverable;
  readonly versionNumber: number;
  readonly approvedAt: string;
  readonly fields: readonly { readonly name: z.infer<typeof EditorialFieldNameSchema>; readonly text: string }[];
  readonly flagCount: number;
  readonly factIds: readonly string[];
}

/** The record of a new export with its files. */
export interface NewExport {
  readonly id: string;
  readonly carouselId: string;
  readonly finalApprovalId: string;
  readonly exportedAt: string;
  readonly directory: string;
  readonly manifestSha256: string;
  readonly dataMode: DataMode;
  readonly files: readonly StoredExportFile[];
}

function storedExport(row: Row): StoredExport {
  return {
    id: UuidSchema.parse(row['id']),
    projectId: UuidSchema.parse(row['project_id']),
    carouselId: UuidSchema.parse(row['carousel_id']),
    finalApprovalId: UuidSchema.parse(row['final_approval_id']),
    exportedAt: TimeSchema.parse(row['exported_at']),
    directory: z.string().min(1).max(200).parse(row['directory']),
    manifestSha256: Sha256Schema.parse(row['manifest_sha256']),
    dataMode: DataModeSchema.parse(row['data_mode']),
  };
}

/** Database access of the export module over the `Db` port. */
export class ExportRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** The project with its chosen source, or null. */
  project(projectId: string): ExportProject | null {
    const row = this.#db.prepare<Row>(SQL.project).get([projectId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      competitionId: TextSchema.parse(row['competition_id']),
      competitionName: TextSchema.parse(row['competition_name']),
      seasonId: TextSchema.parse(row['season_id']),
      seasonLabel: TextSchema.parse(row['season_label']),
      stageId: TextSchema.parse(row['stage_id']),
      stageLabel: TextSchema.parse(row['stage_label']),
      matchday: IntSchema.nullable().parse(row['matchday']),
      language: LanguageSchema.parse(row['language']),
      dataMode: DataModeSchema.parse(row['data_mode']),
      source: {
        id: SourceIdSchema.parse(row['source_id']),
        name: TextSchema.parse(row['source_name']).slice(0, 80),
        dataMode: DataModeSchema.parse(row['source_mode']),
      },
    };
  }

  projectExists(projectId: string): boolean {
    return this.#db.prepare<Row>(SQL.projectExists).get([projectId]) !== undefined;
  }

  /** The final approvals of a carousel that are not invalidated, newest first, with their stored set text. */
  validFinalApprovals(carouselId: string): FinalApprovalRow[] {
    return this.#db
      .prepare<Row>(SQL.validFinalApprovals)
      .all([carouselId])
      .map((row) => ({
        id: UuidSchema.parse(row['id']),
        carouselId: UuidSchema.parse(row['carousel_id']),
        versionSetText: TextSchema.parse(row['version_set']),
        versionSetSha256: Sha256Schema.parse(row['version_set_sha256']),
        approvedAt: TimeSchema.parse(row['approved_at']),
      }));
  }

  /** True while the final-approval row exists and `invalidated_at IS NULL`. */
  finalApprovalNotInvalidated(finalApprovalId: string): boolean {
    const row = this.#db.prepare<Row>(SQL.finalApprovalInvalidatedAt).get([finalApprovalId]);
    return row !== undefined && row['invalidated_at'] === null;
  }

  version(versionId: string): ExportVersionRow | null {
    const row = this.#db.prepare<Row>(SQL.version).get([versionId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      elementId: UuidSchema.parse(row['element_id']),
      carouselId: UuidSchema.parse(row['carousel_id']),
      versionNumber: IntSchema.parse(row['version_number']),
      kind: ElementKindSchema.parse(row['kind']),
      position: IntSchema.parse(row['position']),
      slideType: SlideTypeSchema.nullable().parse(row['slide_type']),
      text: TextSchema.parse(row['text']),
      hasImage: row['image_path'] !== null,
      imageSha256: Sha256Schema.nullable().parse(row['image_sha256']),
      width: IntSchema.nullable().parse(row['width']),
      height: IntSchema.nullable().parse(row['height']),
    };
  }

  /** The facts a version references (`element_fact_refs`), by fact ID. */
  factRefs(versionId: string): string[] {
    return this.#db
      .prepare<Row>(SQL.factRefs)
      .all([versionId])
      .map((row) => UuidSchema.parse(row['fact_id']));
  }

  fact(factId: string): ExportFactRow | null {
    const row = this.#db.prepare<Row>(SQL.fact).get([factId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      runId: UuidSchema.parse(row['run_id']),
      factKey: TextSchema.parse(row['fact_key']).slice(0, 200),
      kind: FactKindSchema.parse(row['kind']),
    };
  }

  /** The distinct sources, modes, relations and import versions of a fact's evidence. */
  factEvidence(factId: string): ExportEvidenceRow[] {
    return this.#db
      .prepare<Row>(SQL.factEvidence)
      .all([factId])
      .map((row) => ({
        sourceId: SourceIdSchema.parse(row['source_id']),
        dataMode: DataModeSchema.parse(row['data_mode']),
        relation: RelationSchema.parse(row['relation']),
        importVersionId: UuidSchema.nullable().parse(row['import_version_id']),
      }));
  }

  source(sourceId: string): ExportSource | null {
    const row = this.#db.prepare<Row>(SQL.source).get([sourceId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: SourceIdSchema.parse(row['id']),
      name: TextSchema.parse(row['name']).slice(0, 80),
      dataMode: DataModeSchema.parse(row['mode']),
    };
  }

  /** Records an export and its files (inside the caller's guard transaction). */
  insertExport(record: NewExport): void {
    this.#db
      .prepare(SQL.insertExport)
      .run([
        UuidSchema.parse(record.id),
        record.carouselId,
        record.finalApprovalId,
        record.exportedAt,
        record.directory,
        Sha256Schema.parse(record.manifestSha256),
        record.dataMode,
      ]);
    const insertFile = this.#db.prepare(SQL.insertExportFile);
    for (const file of record.files) {
      insertFile.run([
        record.id,
        file.position,
        file.kind,
        file.elementVersionId,
        FileNameSchema.parse(file.fileName),
        Sha256Schema.parse(file.sha256),
      ]);
    }
  }

  /** The exports of a project, newest first (R-220). */
  /** The draft of a carousel, or null. */
  carouselDraftId(carouselId: string): string | null {
    const row = this.#db.prepare<Row>(SQL.carouselDraft).get([carouselId]);
    return row === undefined ? null : UuidSchema.parse(row['draft_id']);
  }

  /** The approved current versions of the editorial deliverables of a draft, in the contract's deliverable order. */
  approvedEditorialVersions(draftId: string): ApprovedEditorialVersion[] {
    return this.#db
      .prepare<Row>(SQL.approvedEditorialVersions)
      .all([draftId])
      .map((row) => ({
        id: UuidSchema.parse(row['id']),
        deliverable: EditorialDeliverableSchema.parse(row['deliverable']),
        versionNumber: IntSchema.min(1).parse(row['version_number']),
        approvedAt: TimeSchema.parse(row['approved_at']),
        fields: readJsonColumn(EditorialFieldsSchema, TextSchema.parse(row['fields']), 'fields').map((field) => ({
          name: field.name,
          text: field.text,
        })),
        flagCount: readJsonColumn(z.array(z.unknown()), TextSchema.parse(row['flags']), 'flags').length,
        factIds: readJsonColumn(FactIdsSchema, TextSchema.parse(row['fact_ids']), 'fact_ids'),
      }))
      .sort((a, b) => EDITORIAL_DELIVERABLES.indexOf(a.deliverable) - EDITORIAL_DELIVERABLES.indexOf(b.deliverable));
  }

  exportsOfProject(projectId: string): StoredExport[] {
    return this.#db.prepare<Row>(SQL.exportsOfProject).all([projectId]).map(storedExport);
  }

  export(exportId: string): StoredExport | null {
    const row = this.#db.prepare<Row>(SQL.export).get([exportId]);
    return row === undefined ? null : storedExport(row);
  }

  /** The files of an export in position order. */
  exportFiles(exportId: string): StoredExportFile[] {
    return this.#db
      .prepare<Row>(SQL.exportFiles)
      .all([exportId])
      .map((row) => ({
        position: IntSchema.parse(row['position']),
        kind: FileKindSchema.parse(row['kind']),
        elementVersionId: UuidSchema.nullable().parse(row['element_version_id']),
        fileName: FileNameSchema.parse(row['file_name']),
        sha256: Sha256Schema.parse(row['sha256']),
      }));
  }
}
