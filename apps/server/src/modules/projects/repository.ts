/**
 * Projects repository (data-model.md section 3.1): `projects`, the `sources` rows upserted from the configuration,
 * and the read-only views of drafts, final approvals and exports that the project summary needs. A deleted project
 * keeps its row with a tombstone (`deleted_at`, PD-ARCH-01F, OD-08) and is excluded from every read. Every statement is
 * a constant with bound parameters (T10-F14).
 */
import {
  type ApprovalState,
  DataModeSchema,
  LanguageSchema,
  StandingsExpectationSchema,
  VisualTemplateContentTypeSchema,
  type VisualTemplateUsage,
} from '@edr/contracts';

import type { SourceConfig } from '../../platform/config/index.js';
import type { Db } from '../../platform/db/index.js';

/** A stored project with its source name. */
export interface ProjectRecord {
  readonly id: string;
  readonly competitionId: string;
  readonly competitionName: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly dataMode: 'LIVE_DATA' | 'MANUAL_DATA' | 'DEMO_DATA';
  readonly seasonId: string;
  readonly seasonLabel: string;
  readonly stageId: string;
  readonly stageLabel: string;
  readonly matchday: number | null;
  readonly standingsExpected: 'expected' | 'not_expected' | 'unknown';
  readonly language: 'es' | 'en';
  readonly createdAt: string;
}

/** A new project: the resolved selection with its opaque reference and label snapshots (AD-21, AD-24). */
export interface NewProject {
  readonly id: string;
  readonly competitionId: string;
  readonly competitionName: string;
  readonly sourceId: string;
  readonly dataMode: ProjectRecord['dataMode'];
  readonly seasonId: string;
  readonly seasonLabel: string;
  readonly stageId: string;
  readonly stageLabel: string;
  readonly matchday: number | null;
  /** Opaque adapter reference; stored and never parsed (AD-21). */
  readonly selectionRef: string;
  readonly standingsExpected: ProjectRecord['standingsExpected'];
  readonly language: ProjectRecord['language'];
  readonly createdAt: string;
  /** The structure of the project's carousels (PD-ARCH-01E-B); `results` when absent. */
  readonly contentKind?: 'results' | 'calendar' | 'upcoming' | 'preview';
}

/** Draft-related state of a project (`activeDraftId`, `approvalState`, `lastExportAt`). */
export interface ProjectDraftState {
  readonly activeDraftId: string | null;
  readonly approvalState: ApprovalState;
  readonly lastExportAt: string | null;
}

interface ProjectRow {
  id: string;
  competition_id: string;
  competition_name: string;
  source_id: string;
  source_name: string;
  data_mode: string;
  season_id: string;
  season_label: string;
  stage_id: string;
  stage_label: string;
  matchday: number | null;
  standings_expected: string;
  language: string;
  created_at: string;
}

const PROJECT_SELECT =
  'SELECT p.id, p.competition_id, p.competition_name, p.source_id, s.name AS source_name, p.data_mode, ' +
  'p.season_id, p.season_label, p.stage_id, p.stage_label, p.matchday, p.standings_expected, p.language, ' +
  'p.created_at FROM projects p JOIN sources s ON s.id = p.source_id';

const SQL = {
  upsertSource:
    'INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, ' +
    'publication_permission, adapter, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT (id) DO UPDATE SET name = excluded.name, mode = excluded.mode, role = excluded.role, ' +
    'official_publication = excluded.official_publication, accepted = excluded.accepted, ' +
    'independence_group = excluded.independence_group, publication_permission = excluded.publication_permission, ' +
    'adapter = excluded.adapter, last_seen_at = excluded.last_seen_at',
  insertProject:
    'INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, ' +
    'stage_id, stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at, ' +
    'content_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  project: `${PROJECT_SELECT} WHERE p.id = ? AND p.deleted_at IS NULL`,
  // PD-ARCH-01G-D: the visual template version of each slide type of a generated project (decision 01G-D-3) and
  // the badge of each of its teams (PD-ARCH-01G-E.1: for every generated project).
  assignVisualTemplate:
    'INSERT INTO project_visual_templates (project_id, slide_type, visual_template_id, visual_template_version_id) ' +
    'VALUES (?, ?, ?, ?)',
  assignBadges: 'UPDATE projects SET badge_snapshot_json = ? WHERE id = ?',
  visualTemplatesOf:
    'SELECT t.id AS template_id, v.id AS version_id, v.version, t.name, t.content_type FROM project_visual_templates pt ' +
    'JOIN visual_template_versions v ON v.id = pt.visual_template_version_id JOIN visual_templates t ' +
    "ON t.id = pt.visual_template_id WHERE pt.project_id = ? ORDER BY CASE pt.slide_type WHEN 'cover' THEN 0 " +
    "WHEN 'closing' THEN 2 ELSE 1 END, pt.slide_type",
  projects: `${PROJECT_SELECT} WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC, p.rowid DESC`,
  exists: 'SELECT 1 AS found FROM projects WHERE id = ? AND deleted_at IS NULL',
  deletedAt: 'SELECT deleted_at FROM projects WHERE id = ?',
  markDeleted: 'UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
  updateLanguage: 'UPDATE projects SET language = ?, updated_at = ? WHERE id = ?',
  supersedeDrafts: 'UPDATE content_drafts SET superseded_at = ? WHERE project_id = ? AND superseded_at IS NULL',
  activeDraft:
    'SELECT id FROM content_drafts WHERE project_id = ? AND superseded_at IS NULL ' +
    'ORDER BY created_at DESC, rowid DESC LIMIT 1',
  draftCarousels:
    'SELECT c.id AS id, ' +
    '(SELECT COUNT(*) FROM final_approvals f WHERE f.carousel_id = c.id AND f.invalidated_at IS NULL) AS approved, ' +
    '(SELECT COUNT(*) FROM exports e WHERE e.carousel_id = c.id) AS exported ' +
    'FROM carousels c WHERE c.draft_id = ?',
  lastExport:
    'SELECT MAX(e.exported_at) AS at FROM exports e JOIN carousels c ON c.id = e.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE d.project_id = ?',
} as const;

function toRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    sourceId: row.source_id,
    sourceName: row.source_name,
    dataMode: DataModeSchema.parse(row.data_mode),
    seasonId: row.season_id,
    seasonLabel: row.season_label,
    stageId: row.stage_id,
    stageLabel: row.stage_label,
    matchday: row.matchday,
    standingsExpected: StandingsExpectationSchema.parse(row.standings_expected),
    language: LanguageSchema.parse(row.language),
    createdAt: row.created_at,
  };
}

/** Persistence of projects over the `Db` port. */
export class ProjectRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** Upserts the `sources` row of a configured source (data-model.md: upserted from the configuration). */
  upsertSource(source: SourceConfig, at: string): void {
    this.#db
      .prepare(SQL.upsertSource)
      .run([
        source.id,
        source.name,
        source.mode,
        source.role,
        source.officialPublication ? 1 : 0,
        source.accepted ? 1 : 0,
        source.independenceGroup,
        source.publicationPermission,
        source.adapter,
        at,
        at,
      ]);
  }

  /**
   * The tombstone of a project (PD-ARCH-01F): `undefined` when no project has this ID, `null` when it is not deleted,
   * else the deletion time.
   */
  deletedAt(projectId: string): string | null | undefined {
    const row = this.#db.prepare<{ deleted_at: string | null }>(SQL.deletedAt).get([projectId]);
    return row === undefined ? undefined : row.deleted_at;
  }

  /** Records the tombstone of a visible project; returns false when it was already deleted. Call in a transaction. */
  markDeleted(projectId: string, at: string): boolean {
    return Number(this.#db.prepare(SQL.markDeleted).run([at, at, projectId]).changes) === 1;
  }

  insert(project: NewProject): void {
    this.#db
      .prepare(SQL.insertProject)
      .run([
        project.id,
        project.competitionId,
        project.competitionName,
        project.sourceId,
        project.dataMode,
        project.seasonId,
        project.seasonLabel,
        project.stageId,
        project.stageLabel,
        project.matchday,
        project.selectionRef,
        project.standingsExpected,
        project.language,
        project.createdAt,
        project.createdAt,
        project.contentKind ?? 'results',
      ]);
  }

  exists(projectId: string): boolean {
    return this.#db.prepare<{ found: number }>(SQL.exists).get([projectId]) !== undefined;
  }

  get(projectId: string): ProjectRecord | null {
    const row = this.#db.prepare<ProjectRow>(SQL.project).get([projectId]);
    return row === undefined ? null : toRecord(row);
  }

  /** Every project, newest first. */
  list(): ProjectRecord[] {
    return this.#db
      .prepare<ProjectRow>(SQL.projects)
      .all()
      .map((row) => toRecord(row));
  }

  updateLanguage(projectId: string, language: ProjectRecord['language'], at: string): void {
    this.#db.prepare(SQL.updateLanguage).run([language, at, projectId]);
  }

  /** Supersedes the project's active draft, if any (a language or exclusion change needs a redraft). */
  supersedeActiveDraft(projectId: string, at: string): number {
    return this.#db.prepare(SQL.supersedeDrafts).run([at, projectId]).changes;
  }

  /**
   * Records the visual template version of each slide type of a project (decision 01G-D-3), as it is when the project
   * is created (PD-ARCH-01G-D).
   */
  assignVisualTemplates(
    projectId: string,
    templates: readonly { readonly templateId: string; readonly versionId: string; readonly contentType: string }[],
  ): void {
    for (const template of templates) {
      this.#db
        .prepare(SQL.assignVisualTemplate)
        .run([projectId, template.contentType, template.templateId, template.versionId]);
    }
  }

  /**
   * Records the badge of each team of a project as it is when the project is created (PD-ARCH-01G-D; version 2 of the
   * snapshot since PD-ARCH-01G-E.1, `badge-snapshot.ts`).
   */
  recordBadgeSnapshot(projectId: string, snapshotJson: string): void {
    this.#db.prepare(SQL.assignBadges).run([snapshotJson, projectId]);
  }

  /** The visual template versions a project uses, one per slide type: cover, match slides, closing (PD-ARCH-01G-D). */
  visualTemplatesOf(projectId: string): VisualTemplateUsage[] {
    return this.#db
      .prepare<{ template_id: string; version_id: string; version: number; name: string; content_type: string }>(
        SQL.visualTemplatesOf,
      )
      .all([projectId])
      .map((row) => ({
        templateId: row.template_id,
        versionId: row.version_id,
        version: row.version,
        name: row.name,
        contentType: VisualTemplateContentTypeSchema.parse(row.content_type),
      }));
  }

  /**
   * Draft state: the active draft; `exported` when every carousel of the active draft was exported,
   * `final_approved` when every one has a valid final approval, `in_review` otherwise, `no_draft` without a draft;
   * the time of the project's latest export of any draft.
   */
  draftState(projectId: string): ProjectDraftState {
    const lastExportAt = this.#db.prepare<{ at: string | null }>(SQL.lastExport).get([projectId])?.at ?? null;
    const activeDraftId = this.#db.prepare<{ id: string }>(SQL.activeDraft).get([projectId])?.id ?? null;
    if (activeDraftId === null) {
      return { activeDraftId, approvalState: 'no_draft', lastExportAt };
    }
    const carousels = this.#db
      .prepare<{ id: string; approved: number; exported: number }>(SQL.draftCarousels)
      .all([activeDraftId]);
    let approvalState: ApprovalState = 'in_review';
    if (carousels.length > 0 && carousels.every((carousel) => carousel.exported > 0)) {
      approvalState = 'exported';
    } else if (carousels.length > 0 && carousels.every((carousel) => carousel.approved > 0)) {
      approvalState = 'final_approved';
    }
    return { activeDraftId, approvalState, lastExportAt };
  }
}
