/**
 * Rendering repository (data-model.md section 3.3): reads the slides to render from the shared content tables and
 * records each render on its element version.
 *
 * - The content stage (T32) creates element versions with the render columns NULL; the rendering stage sets them
 *   once (`template_id`, `template_version`, `render_model`, `image_path`, `image_sha256`, `width`, `height`). The
 *   update is guarded by `render_model IS NULL AND superseded_at IS NULL`, so a rendered version is never changed
 *   and a superseded version is never rendered (R-406, R-211).
 * - Every value is a bound parameter of constant SQL (T10-F14). JSON columns are validated with the module's schemas.
 */
import { type DataMode, DataModeSchema, LanguageSchema, SlideTypeSchema, UuidSchema } from '@edr/contracts';
import { z } from 'zod';

import { type Db, readJsonColumn } from '../../platform/db/index.js';

import { type StoredElementText, StoredElementTextSchema } from './slide-content.js';

const SQL = {
  project: 'SELECT id, data_mode FROM projects WHERE id = ?',
  draftOfRun:
    'SELECT id, facts_run_id, language FROM content_drafts ' +
    'WHERE project_id = ? AND run_id = ? AND superseded_at IS NULL ORDER BY created_at DESC LIMIT 1',
  slidesToRender:
    'SELECT e.id AS element_id, e.slide_type AS slide_type, v.id AS version_id, v.text AS text ' +
    'FROM carousels c JOIN elements e ON e.carousel_id = c.id ' +
    'JOIN element_versions v ON v.id = e.current_version_id ' +
    "WHERE c.draft_id = ? AND e.kind = 'slide' AND v.render_model IS NULL AND v.superseded_at IS NULL " +
    'ORDER BY c.sequence, e.position',
  standingsAsOf:
    'SELECT MAX(retrieved_at) AS at FROM retrievals ' + "WHERE run_id = ? AND stage = 'research' AND outcome = 'ok'",
  version:
    'SELECT v.id AS version_id, v.text AS text, v.render_model AS render_model, v.superseded_at AS superseded_at, ' +
    'e.id AS element_id, e.kind AS kind, e.slide_type AS slide_type, e.current_version_id AS current_version_id, ' +
    'd.id AS draft_id, d.project_id AS project_id, d.facts_run_id AS facts_run_id, d.language AS language, ' +
    'p.data_mode AS data_mode ' +
    'FROM element_versions v JOIN elements e ON e.id = v.element_id JOIN carousels c ON c.id = e.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id JOIN projects p ON p.id = d.project_id WHERE v.id = ?',
  saveRender:
    'UPDATE element_versions SET template_id = ?, template_version = ?, render_model = ?, image_path = ?, ' +
    'image_sha256 = ?, width = ?, height = ? WHERE id = ? AND render_model IS NULL AND superseded_at IS NULL',
  renderedImage:
    'SELECT v.id AS version_id, v.image_path AS image_path, v.image_sha256 AS image_sha256, ' +
    'd.project_id AS project_id FROM element_versions v JOIN elements e ON e.id = v.element_id ' +
    'JOIN carousels c ON c.id = e.carousel_id JOIN content_drafts d ON d.id = c.draft_id WHERE v.id = ?',
} as const;

/** A slide whose current version has not been rendered. */
export interface SlideToRender {
  readonly elementId: string;
  readonly versionId: string;
  readonly slideType: z.infer<typeof SlideTypeSchema>;
  readonly text: StoredElementText;
}

/** The draft a run produced. */
export interface RunDraft {
  readonly id: string;
  readonly factsRunId: string;
  readonly language: z.infer<typeof LanguageSchema>;
}

/** One element version with its draft and project, for a single-version render (regeneration, T37). */
export interface VersionToRender {
  readonly versionId: string;
  readonly elementId: string;
  readonly kind: 'slide' | 'caption';
  readonly slideType: z.infer<typeof SlideTypeSchema> | null;
  readonly current: boolean;
  readonly rendered: boolean;
  readonly superseded: boolean;
  readonly text: StoredElementText;
  readonly draftId: string;
  readonly projectId: string;
  readonly factsRunId: string;
  readonly language: z.infer<typeof LanguageSchema>;
  readonly dataMode: DataMode;
}

/** The values recorded for one rendered version. */
export interface SavedRender {
  readonly versionId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly renderModel: unknown;
  readonly imagePath: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
}

/** A stored image reference of an element version. */
export interface RenderedImageRef {
  readonly versionId: string;
  readonly projectId: string;
  readonly imagePath: string | null;
  readonly sha256: string | null;
}

const nullableText = z.string().nullable();

export class RenderingRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** The data mode of a project, or null when the project does not exist. */
  projectDataMode(projectId: string): DataMode | null {
    const row = this.#db.prepare<{ data_mode: unknown }>(SQL.project).get([projectId]);
    return row === undefined ? null : DataModeSchema.parse(row.data_mode);
  }

  /** The non-superseded draft produced by a run of the project, or null. */
  draftOfRun(projectId: string, runId: string): RunDraft | null {
    const row = this.#db
      .prepare<{ id: unknown; facts_run_id: unknown; language: unknown }>(SQL.draftOfRun)
      .get([projectId, runId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: UuidSchema.parse(row.id),
      factsRunId: UuidSchema.parse(row.facts_run_id),
      language: LanguageSchema.parse(row.language),
    };
  }

  /** The slides of a draft whose current version is not rendered yet, in carousel and position order. */
  slidesToRender(draftId: string): SlideToRender[] {
    return this.#db
      .prepare<{ element_id: unknown; slide_type: unknown; version_id: unknown; text: unknown }>(SQL.slidesToRender)
      .all([draftId])
      .map((row) => ({
        elementId: UuidSchema.parse(row.element_id),
        versionId: UuidSchema.parse(row.version_id),
        slideType: SlideTypeSchema.parse(row.slide_type),
        text: readJsonColumn(StoredElementTextSchema, row.text as string, 'text'),
      }));
  }

  /** The latest successful research retrieval time of a run (the "as of" time of its standings), or null. */
  standingsAsOf(factsRunId: string): string | null {
    const row = this.#db.prepare<{ at: unknown }>(SQL.standingsAsOf).get([factsRunId]);
    return nullableText.parse(row?.at ?? null);
  }

  /** One element version with its draft and project, or null. */
  version(versionId: string): VersionToRender | null {
    const row = this.#db.prepare<Record<string, unknown>>(SQL.version).get([versionId]);
    if (row === undefined) {
      return null;
    }
    const kind = z.enum(['slide', 'caption']).parse(row['kind']);
    return {
      versionId: UuidSchema.parse(row['version_id']),
      elementId: UuidSchema.parse(row['element_id']),
      kind,
      slideType: SlideTypeSchema.nullable().parse(row['slide_type']),
      current: row['current_version_id'] === row['version_id'],
      rendered: row['render_model'] !== null,
      superseded: row['superseded_at'] !== null,
      text: readJsonColumn(StoredElementTextSchema, row['text'] as string, 'text'),
      draftId: UuidSchema.parse(row['draft_id']),
      projectId: UuidSchema.parse(row['project_id']),
      factsRunId: UuidSchema.parse(row['facts_run_id']),
      language: LanguageSchema.parse(row['language']),
      dataMode: DataModeSchema.parse(row['data_mode']),
    };
  }

  /**
   * Records the renders in one transaction. Returns the IDs of the versions that could not be recorded (rendered or
   * superseded in the meantime); nothing is recorded when there is any (the transaction is rolled back).
   */
  saveRenders(renders: readonly SavedRender[]): string[] {
    const refused: string[] = [];
    try {
      this.#db.transaction(() => {
        const statement = this.#db.prepare(SQL.saveRender);
        for (const render of renders) {
          const result = statement.run([
            render.templateId,
            render.templateVersion,
            JSON.stringify(render.renderModel),
            render.imagePath,
            render.sha256,
            render.width,
            render.height,
            render.versionId,
          ]);
          if (result.changes !== 1) {
            refused.push(render.versionId);
          }
        }
        if (refused.length > 0) {
          throw new RenderSaveRefused();
        }
      });
    } catch (error) {
      if (!(error instanceof RenderSaveRefused)) {
        throw error;
      }
    }
    return refused;
  }

  /** The stored image of an element version and its project, or null when the version does not exist. */
  renderedImage(versionId: string): RenderedImageRef | null {
    const row = this.#db.prepare<Record<string, unknown>>(SQL.renderedImage).get([versionId]);
    if (row === undefined) {
      return null;
    }
    return {
      versionId: UuidSchema.parse(row['version_id']),
      projectId: UuidSchema.parse(row['project_id']),
      imagePath: nullableText.parse(row['image_path']),
      sha256: nullableText.parse(row['image_sha256']),
    };
  }
}

class RenderSaveRefused extends Error {
  override readonly name = 'RenderSaveRefused';
}
