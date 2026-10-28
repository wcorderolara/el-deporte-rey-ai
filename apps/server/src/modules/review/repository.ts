/**
 * Review repository (data-model.md sections 3.3 and 3.4: `content_drafts`, `carousels`, `elements`,
 * `element_versions`, `qa_results`, `approvals`, `final_approvals`; AD-13; T10-F14).
 *
 * Reads the active draft with its carousels, elements and versions, the latest approval row of a version, the stored
 * QA results, and the final approvals; writes append-only approval rows, QA acknowledgements, final approvals and
 * their invalidation. Every statement is a constant with bound parameters; JSON columns and enumerations are
 * validated on read; rows are never deleted (OD-08). Callers that guard a write run the reads and the write in one
 * transaction (`Db.transaction`, T10-F15).
 */
import {
  DataModeSchema,
  LanguageSchema,
  MatchKeySchema,
  QaResultSchema,
  type QaResult,
  SlideTypeSchema,
  UuidSchema,
  uniquePrimitives,
} from '@edr/contracts';
import { z } from 'zod';

import { type Db, readJsonColumn, writeJsonColumn } from '../../platform/db/index.js';
import {
  ContentFlagListSchema,
  type ElementText,
  ElementTextSchema,
  LeftOutMatchListSchema,
} from '../content/index.js';

import type { StoredQaStatus, VersionSet } from './state.js';

const SQL = {
  project: 'SELECT id, data_mode FROM projects WHERE id = ?',
  activeDraft:
    'SELECT id, project_id, run_id, facts_run_id, language, standings_included, excluded_match_keys, ' +
    'left_out_matches, created_at FROM content_drafts WHERE project_id = ? AND superseded_at IS NULL ' +
    'ORDER BY created_at DESC, rowid DESC LIMIT 1',
  draftCarousels: 'SELECT id FROM carousels WHERE draft_id = ? ORDER BY sequence',
  carousel:
    'SELECT c.id AS id, c.sequence AS sequence, c.total AS total, c.draft_id AS draft_id, ' +
    'd.project_id AS project_id, d.superseded_at AS draft_superseded_at FROM carousels c ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE c.id = ?',
  carouselElements:
    'SELECT id, carousel_id, kind, position, slide_type, current_version_id FROM elements WHERE carousel_id = ? ' +
    'ORDER BY position',
  element: 'SELECT id, carousel_id, kind, position, slide_type, current_version_id FROM elements WHERE id = ?',
  version:
    'SELECT id, element_id, version_number, text, content_flags, image_path, width, height, qa_status, created_at, ' +
    'superseded_at FROM element_versions WHERE id = ?',
  latestApproval: 'SELECT action FROM approvals WHERE element_version_id = ? ORDER BY at DESC, rowid DESC LIMIT 1',
  qaResults:
    'SELECT check_name, outcome, severity, details, acknowledged_at FROM qa_results WHERE element_version_id = ? ' +
    'ORDER BY check_name',
  failedWarning:
    'SELECT acknowledged_at FROM qa_results WHERE element_version_id = ? AND check_name = ? ' +
    "AND severity = 'warning' AND outcome = 'fail'",
  acknowledge:
    'UPDATE qa_results SET acknowledged_at = ? WHERE element_version_id = ? AND check_name = ? ' +
    "AND severity = 'warning' AND outcome = 'fail' AND acknowledged_at IS NULL",
  insertApproval: 'INSERT INTO approvals (id, element_version_id, action, at) VALUES (?, ?, ?, ?)',
  latestFinalApproval:
    'SELECT id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at FROM final_approvals ' +
    'WHERE carousel_id = ? ORDER BY approved_at DESC, rowid DESC LIMIT 1',
  finalApproval:
    'SELECT id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at FROM final_approvals ' +
    'WHERE id = ?',
  validFinalApprovalsOfCarousel:
    'SELECT id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at FROM final_approvals ' +
    'WHERE carousel_id = ? AND invalidated_at IS NULL ORDER BY approved_at, rowid',
  validFinalApprovals:
    'SELECT id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at FROM final_approvals ' +
    'WHERE invalidated_at IS NULL ORDER BY approved_at, rowid',
  insertFinalApproval:
    'INSERT INTO final_approvals (id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at) ' +
    'VALUES (?, ?, ?, ?, ?, NULL)',
  invalidateFinalApproval: 'UPDATE final_approvals SET invalidated_at = ? WHERE id = ? AND invalidated_at IS NULL',
  invalidateCarouselFinalApprovals:
    'UPDATE final_approvals SET invalidated_at = ? WHERE carousel_id = ? AND invalidated_at IS NULL',
} as const;

const ExcludedKeysSchema = uniquePrimitives(z.array(MatchKeySchema).max(64));
const KindSchema = z.enum(['slide', 'caption']);
const QaStatusSchema = z.enum(['pending', 'passed', 'failed', 'warnings']);
const ApprovalActionSchema = z.enum(['approved', 'withdrawn']);
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
/** `final_approvals.version_set`: the sorted element version IDs. */
export const VersionSetSchema = z.array(UuidSchema).max(2000);

export interface StoredProject {
  readonly id: string;
  readonly dataMode: z.infer<typeof DataModeSchema>;
}

export interface StoredDraft {
  readonly id: string;
  readonly projectId: string;
  readonly runId: string;
  readonly factsRunId: string;
  readonly language: z.infer<typeof LanguageSchema>;
  readonly standingsIncluded: boolean;
  readonly excludedMatchKeys: string[];
  readonly leftOutMatches: z.infer<typeof LeftOutMatchListSchema>;
  readonly createdAt: string;
}

export interface StoredCarousel {
  readonly id: string;
  readonly sequence: number;
  readonly total: number;
  readonly draftId: string;
  readonly projectId: string;
  readonly draftSuperseded: boolean;
}

export interface StoredElement {
  readonly id: string;
  readonly carouselId: string;
  readonly kind: 'slide' | 'caption';
  readonly position: number;
  readonly slideType: z.infer<typeof SlideTypeSchema> | null;
  readonly currentVersionId: string | null;
}

export interface StoredVersion {
  readonly id: string;
  readonly elementId: string;
  readonly versionNumber: number;
  readonly text: ElementText;
  readonly contentFlags: z.infer<typeof ContentFlagListSchema>;
  readonly hasImage: boolean;
  readonly width: number | null;
  readonly height: number | null;
  readonly qaStatus: StoredQaStatus;
  readonly createdAt: string;
  readonly superseded: boolean;
}

export interface StoredFinalApproval {
  readonly id: string;
  readonly carouselId: string;
  readonly versionSet: string[];
  readonly versionSetSha256: string;
  readonly approvedAt: string;
  readonly invalidatedAt: string | null;
}

type Row = Record<string, unknown>;

const IntSchema = z.int();
const NullableIntSchema = z.int().nullable();
const TimeSchema = z.string().min(1).max(40);

function element(row: Row): StoredElement {
  return {
    id: UuidSchema.parse(row['id']),
    carouselId: UuidSchema.parse(row['carousel_id']),
    kind: KindSchema.parse(row['kind']),
    position: IntSchema.parse(row['position']),
    slideType: SlideTypeSchema.nullable().parse(row['slide_type']),
    currentVersionId: UuidSchema.nullable().parse(row['current_version_id']),
  };
}

function finalApproval(row: Row): StoredFinalApproval {
  return {
    id: UuidSchema.parse(row['id']),
    carouselId: UuidSchema.parse(row['carousel_id']),
    versionSet: readJsonColumn(VersionSetSchema, row['version_set'], 'version_set'),
    versionSetSha256: Sha256Schema.parse(row['version_set_sha256']),
    approvedAt: TimeSchema.parse(row['approved_at']),
    invalidatedAt: TimeSchema.nullable().parse(row['invalidated_at']),
  };
}

/** A stored QA result in the contract shape (closed details per check, T10-F17). */
function qaResult(row: Row): QaResult {
  return QaResultSchema.parse({
    check: row['check_name'],
    outcome: row['outcome'],
    severity: row['severity'],
    details: readJsonColumn(z.unknown(), row['details'], 'details'),
    acknowledgedAt: row['acknowledged_at'],
  });
}

/** Database access of the review module over the `Db` port. */
export class ReviewRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  project(projectId: string): StoredProject | null {
    const row = this.#db.prepare<Row>(SQL.project).get([projectId]);
    return row === undefined
      ? null
      : { id: UuidSchema.parse(row['id']), dataMode: DataModeSchema.parse(row['data_mode']) };
  }

  /** The project's active (non-superseded) draft, or null. */
  activeDraft(projectId: string): StoredDraft | null {
    const row = this.#db.prepare<Row>(SQL.activeDraft).get([projectId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      projectId: UuidSchema.parse(row['project_id']),
      runId: UuidSchema.parse(row['run_id']),
      factsRunId: UuidSchema.parse(row['facts_run_id']),
      language: LanguageSchema.parse(row['language']),
      standingsIncluded: row['standings_included'] === 1,
      excludedMatchKeys: readJsonColumn(ExcludedKeysSchema, row['excluded_match_keys'], 'excluded_match_keys'),
      leftOutMatches: readJsonColumn(LeftOutMatchListSchema, row['left_out_matches'], 'left_out_matches'),
      createdAt: TimeSchema.parse(row['created_at']),
    };
  }

  /** The carousel IDs of a draft in sequence order. */
  draftCarouselIds(draftId: string): string[] {
    return this.#db
      .prepare<Row>(SQL.draftCarousels)
      .all([draftId])
      .map((row) => UuidSchema.parse(row['id']));
  }

  carousel(carouselId: string): StoredCarousel | null {
    const row = this.#db.prepare<Row>(SQL.carousel).get([carouselId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      sequence: IntSchema.parse(row['sequence']),
      total: IntSchema.parse(row['total']),
      draftId: UuidSchema.parse(row['draft_id']),
      projectId: UuidSchema.parse(row['project_id']),
      draftSuperseded: row['draft_superseded_at'] !== null,
    };
  }

  /** The elements of a carousel in position order (the caption first, position 0). */
  carouselElements(carouselId: string): StoredElement[] {
    return this.#db.prepare<Row>(SQL.carouselElements).all([carouselId]).map(element);
  }

  element(elementId: string): StoredElement | null {
    const row = this.#db.prepare<Row>(SQL.element).get([elementId]);
    return row === undefined ? null : element(row);
  }

  version(versionId: string): StoredVersion | null {
    const row = this.#db.prepare<Row>(SQL.version).get([versionId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      elementId: UuidSchema.parse(row['element_id']),
      versionNumber: IntSchema.parse(row['version_number']),
      text: readJsonColumn(ElementTextSchema, row['text'], 'text'),
      contentFlags: readJsonColumn(ContentFlagListSchema, row['content_flags'], 'content_flags'),
      hasImage: row['image_path'] !== null,
      width: NullableIntSchema.parse(row['width']),
      height: NullableIntSchema.parse(row['height']),
      qaStatus: QaStatusSchema.parse(row['qa_status']),
      createdAt: TimeSchema.parse(row['created_at']),
      superseded: row['superseded_at'] !== null,
    };
  }

  /** True when the latest approval row of the version is `approved` (R-405, R-406). */
  isApproved(versionId: string): boolean {
    const row = this.#db.prepare<Row>(SQL.latestApproval).get([versionId]);
    return row !== undefined && ApprovalActionSchema.parse(row['action']) === 'approved';
  }

  /** The stored QA results of a version in the contract shape, by check name. */
  qaResults(versionId: string): QaResult[] {
    return this.#db.prepare<Row>(SQL.qaResults).all([versionId]).map(qaResult);
  }

  /**
   * The failed warning result of a check of a version: its acknowledgement time (null while unacknowledged), or
   * undefined when the version has no failed warning of that check.
   */
  failedWarning(versionId: string, check: string): { readonly acknowledgedAt: string | null } | undefined {
    const row = this.#db.prepare<Row>(SQL.failedWarning).get([versionId, check]);
    return row === undefined ? undefined : { acknowledgedAt: TimeSchema.nullable().parse(row['acknowledged_at']) };
  }

  /** Acknowledges the failed warning of a check (once; the first acknowledgement time is kept). */
  acknowledge(versionId: string, check: string, at: string): void {
    this.#db.prepare(SQL.acknowledge).run([at, versionId, check]);
  }

  /** Appends an approval row (append-only; R-405, R-406). */
  insertApproval(id: string, versionId: string, action: 'approved' | 'withdrawn', at: string): void {
    this.#db.prepare(SQL.insertApproval).run([id, versionId, action, at]);
  }

  /** The latest final approval of a carousel, valid or not, or null. */
  latestFinalApproval(carouselId: string): StoredFinalApproval | null {
    const row = this.#db.prepare<Row>(SQL.latestFinalApproval).get([carouselId]);
    return row === undefined ? null : finalApproval(row);
  }

  finalApproval(finalApprovalId: string): StoredFinalApproval | null {
    const row = this.#db.prepare<Row>(SQL.finalApproval).get([finalApprovalId]);
    return row === undefined ? null : finalApproval(row);
  }

  /** The final approvals of a carousel that are not invalidated. */
  validFinalApprovals(carouselId: string): StoredFinalApproval[] {
    return this.#db.prepare<Row>(SQL.validFinalApprovalsOfCarousel).all([carouselId]).map(finalApproval);
  }

  /** Every final approval that is not invalidated. */
  allValidFinalApprovals(): StoredFinalApproval[] {
    return this.#db.prepare<Row>(SQL.validFinalApprovals).all().map(finalApproval);
  }

  /** Records a final approval; `version_set` is exactly the hashed text of the version set (R-240). */
  insertFinalApproval(record: {
    readonly id: string;
    readonly carouselId: string;
    readonly versionSet: VersionSet;
    readonly approvedAt: string;
  }): void {
    const stored = writeJsonColumn(VersionSetSchema, record.versionSet.ids, 'version_set');
    if (stored !== record.versionSet.json) {
      throw new Error('the version set text differs from its hashed form');
    }
    this.#db
      .prepare(SQL.insertFinalApproval)
      .run([record.id, record.carouselId, stored, Sha256Schema.parse(record.versionSet.sha256), record.approvedAt]);
  }

  /** Invalidates one final approval; returns true when it was valid. */
  invalidateFinalApproval(finalApprovalId: string, at: string): boolean {
    return this.#db.prepare(SQL.invalidateFinalApproval).run([at, finalApprovalId]).changes === 1;
  }

  /** Invalidates every valid final approval of a carousel (its version set or approvals changed). */
  invalidateCarouselFinalApprovals(carouselId: string, at: string): number {
    return this.#db.prepare(SQL.invalidateCarouselFinalApprovals).run([at, carouselId]).changes;
  }
}
