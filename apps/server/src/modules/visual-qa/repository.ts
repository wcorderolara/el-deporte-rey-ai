/**
 * Visual QA repository (data-model.md section 3.3: `element_versions`, `qa_results`): reads the element versions to
 * check and the templates of their carousels from the shared content tables, and records the QA results.
 *
 * - The content stage (T32) creates element versions with `qa_status` pending; QA sets it once (`passed`, `failed`
 *   or `warnings`), guarded by `qa_status = 'pending' AND superseded_at IS NULL`, so a checked version is never
 *   changed and a superseded version is never checked (R-406). Its results are inserted in the same transaction, one
 *   row per check (`UNIQUE (element_version_id, check_name)`), not acknowledged.
 * - Only the checks that the `qa_results.check_name` constraint of the migrated schema accepts are stored
 *   (`storableChecks`): migration 0001 does not list `capitalized_tokens` (OD-26 came after it).
 * - Every value is a bound parameter of constant SQL (T10-F14); JSON columns are validated with the module schemas.
 */
import { QA_CHECKS, type QaCheck, type QaResult, LanguageSchema, SlideTypeSchema, UuidSchema } from '@edr/contracts';
import { z } from 'zod';

import { type Db, readJsonColumn } from '../../platform/db/index.js';
import { ElementTextSchema } from '../content/index.js';
import { RenderModelSchema } from '../rendering/index.js';

import type { CarouselTemplate, QaStatus } from './schemas.js';

const SQL = {
  draftOfRun:
    'SELECT id, facts_run_id, language FROM content_drafts ' +
    'WHERE project_id = ? AND run_id = ? AND superseded_at IS NULL ORDER BY created_at DESC LIMIT 1',
  versionsOfDraft:
    'SELECT e.id AS element_id, e.kind AS kind, e.slide_type AS slide_type, e.carousel_id AS carousel_id, ' +
    'v.id AS version_id, v.text AS text, v.render_model AS render_model ' +
    'FROM carousels c JOIN elements e ON e.carousel_id = c.id ' +
    'JOIN element_versions v ON v.id = e.current_version_id ' +
    "WHERE c.draft_id = ? AND v.superseded_at IS NULL AND v.qa_status = 'pending' " +
    "AND (e.kind = 'caption' OR v.render_model IS NOT NULL) ORDER BY c.sequence, e.position",
  templatesOfDraft:
    'SELECT c.id AS carousel_id, v.id AS version_id, v.template_id AS template_id, ' +
    'v.template_version AS template_version FROM carousels c JOIN elements e ON e.carousel_id = c.id ' +
    'JOIN element_versions v ON v.id = e.current_version_id ' +
    "WHERE c.draft_id = ? AND e.kind = 'slide' AND v.superseded_at IS NULL AND v.template_id IS NOT NULL " +
    'AND v.template_version IS NOT NULL ORDER BY c.sequence, e.position',
  templatesOfCarousel:
    'SELECT c.id AS carousel_id, v.id AS version_id, v.template_id AS template_id, ' +
    'v.template_version AS template_version FROM carousels c JOIN elements e ON e.carousel_id = c.id ' +
    'JOIN element_versions v ON v.id = e.current_version_id ' +
    "WHERE c.id = ? AND e.kind = 'slide' AND v.superseded_at IS NULL AND v.template_id IS NOT NULL " +
    'AND v.template_version IS NOT NULL ORDER BY e.position',
  version:
    'SELECT v.id AS version_id, v.text AS text, v.render_model AS render_model, v.qa_status AS qa_status, ' +
    'v.superseded_at AS superseded_at, e.id AS element_id, e.kind AS kind, e.slide_type AS slide_type, ' +
    'e.carousel_id AS carousel_id, e.current_version_id AS current_version_id, d.id AS draft_id, ' +
    'd.project_id AS project_id, d.facts_run_id AS facts_run_id, d.language AS language ' +
    'FROM element_versions v JOIN elements e ON e.id = v.element_id JOIN carousels c ON c.id = e.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE v.id = ?',
  qaResultsTable: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'qa_results'",
  setQaStatus:
    "UPDATE element_versions SET qa_status = ? WHERE id = ? AND qa_status = 'pending' AND superseded_at IS NULL",
  insertResult:
    'INSERT INTO qa_results (id, element_version_id, check_name, outcome, severity, details, acknowledged_at, ' +
    'created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
} as const;

/** The draft a run produced. */
export interface QaDraft {
  readonly id: string;
  readonly factsRunId: string;
  readonly language: z.infer<typeof LanguageSchema>;
}

/** A stored element version to check (its PNG is read by the stage). */
export interface StoredVersion {
  readonly versionId: string;
  readonly elementId: string;
  readonly carouselId: string;
  readonly kind: 'slide' | 'caption';
  readonly slideType: z.infer<typeof SlideTypeSchema> | null;
  readonly text: z.infer<typeof ElementTextSchema>;
  readonly renderModel: z.infer<typeof RenderModelSchema> | null;
}

/** One element version with its state, draft and project (QA of a single version, T37). */
export interface StoredVersionState extends StoredVersion {
  readonly current: boolean;
  readonly superseded: boolean;
  readonly qaStatus: string;
  readonly draftId: string;
  readonly projectId: string;
  readonly factsRunId: string;
  readonly language: z.infer<typeof LanguageSchema>;
}

/** The results of one version to record. */
export interface SavedQa {
  readonly versionId: string;
  readonly qaStatus: QaStatus;
  readonly results: readonly QaResult[];
}

const KindSchema = z.enum(['slide', 'caption']);

function storedVersion(row: Record<string, unknown>): StoredVersion {
  const renderModel = row['render_model'];
  return {
    versionId: UuidSchema.parse(row['version_id']),
    elementId: UuidSchema.parse(row['element_id']),
    carouselId: UuidSchema.parse(row['carousel_id']),
    kind: KindSchema.parse(row['kind']),
    slideType: SlideTypeSchema.nullable().parse(row['slide_type']),
    text: readJsonColumn(ElementTextSchema, row['text'], 'text'),
    renderModel: renderModel === null ? null : readJsonColumn(RenderModelSchema, renderModel, 'render_model'),
  };
}

function carouselTemplate(row: Record<string, unknown>): CarouselTemplate {
  return {
    carouselId: UuidSchema.parse(row['carousel_id']),
    versionId: UuidSchema.parse(row['version_id']),
    templateId: z.string().min(1).max(64).parse(row['template_id']),
    templateVersion: z.string().min(1).max(32).parse(row['template_version']),
  };
}

export class VisualQaRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** The non-superseded draft produced by a run of the project, or null. */
  draftOfRun(projectId: string, runId: string): QaDraft | null {
    const row = this.#db.prepare<Record<string, unknown>>(SQL.draftOfRun).get([projectId, runId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row['id']),
      factsRunId: UuidSchema.parse(row['facts_run_id']),
      language: LanguageSchema.parse(row['language']),
    };
  }

  /**
   * The current versions of a draft still pending QA, in carousel and position order: the caption, and every slide
   * that has been rendered (a slide without a render has nothing to check yet).
   */
  versionsOfDraft(draftId: string): StoredVersion[] {
    return this.#db.prepare<Record<string, unknown>>(SQL.versionsOfDraft).all([draftId]).map(storedVersion);
  }

  /** The template of every rendered current slide of a draft. */
  templatesOfDraft(draftId: string): CarouselTemplate[] {
    return this.#db.prepare<Record<string, unknown>>(SQL.templatesOfDraft).all([draftId]).map(carouselTemplate);
  }

  /** The template of every rendered current slide of a carousel. */
  templatesOfCarousel(carouselId: string): CarouselTemplate[] {
    return this.#db.prepare<Record<string, unknown>>(SQL.templatesOfCarousel).all([carouselId]).map(carouselTemplate);
  }

  /** One element version with its state, draft and project, or null. */
  version(versionId: string): StoredVersionState | null {
    const row = this.#db.prepare<Record<string, unknown>>(SQL.version).get([versionId]);
    if (row === undefined) {
      return null;
    }
    return {
      ...storedVersion(row),
      current: row['current_version_id'] === row['version_id'],
      superseded: row['superseded_at'] !== null,
      qaStatus: z.string().parse(row['qa_status']),
      draftId: UuidSchema.parse(row['draft_id']),
      projectId: UuidSchema.parse(row['project_id']),
      factsRunId: UuidSchema.parse(row['facts_run_id']),
      language: LanguageSchema.parse(row['language']),
    };
  }

  /** The checks whose names the `qa_results.check_name` constraint of the schema accepts, in contract order. */
  storableChecks(): QaCheck[] {
    const row = this.#db.prepare<{ sql: unknown }>(SQL.qaResultsTable).get();
    const ddl = typeof row?.sql === 'string' ? row.sql : '';
    return QA_CHECKS.filter((check) => ddl.includes(`'${check}'`));
  }

  /**
   * Records the results of every version in one transaction. Returns the IDs of the versions that could not be
   * recorded (checked or superseded in the meantime); nothing is recorded when there is any (rolled back).
   */
  saveResults(saved: readonly SavedQa[], newId: () => string, at: string): string[] {
    const refused: string[] = [];
    try {
      this.#db.transaction(() => {
        for (const version of saved) {
          if (this.#db.prepare(SQL.setQaStatus).run([version.qaStatus, version.versionId]).changes !== 1) {
            refused.push(version.versionId);
            continue;
          }
          for (const item of version.results) {
            this.#db
              .prepare(SQL.insertResult)
              .run([
                newId(),
                version.versionId,
                item.check,
                item.outcome,
                item.severity,
                JSON.stringify(item.details),
                at,
              ]);
          }
        }
        if (refused.length > 0) {
          throw new QaSaveRefused();
        }
      });
    } catch (error) {
      if (!(error instanceof QaSaveRefused)) {
        throw error;
      }
    }
    return refused;
  }
}

class QaSaveRefused extends Error {
  override readonly name = 'QaSaveRefused';
}
