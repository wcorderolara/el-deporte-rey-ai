/**
 * Persistence of the content stage (data-model.md section 3.3; AD-05, AD-13; T10-F14, T10-F15).
 *
 * Reads: the project's selection labels and language, the facts of a run with their effective status (AD-28), the
 * known name forms of their teams, the run's standings availability, and the exclusions of the active draft. Writes:
 * a draft with its carousels, elements, element versions and fact references, superseding the previous draft; a
 * regenerated version of one element. Every statement is a constant with bound parameters; JSON columns are
 * validated on write and read; rows are never deleted (OD-08).
 */
import {
  MatchKeySchema,
  StandingsAvailabilitySchema,
  type StandingsAvailability,
  uniquePrimitives,
} from '@edr/contracts';
import { z } from 'zod';

import type { Db } from '../../platform/db/index.js';
import { readJsonColumn, readNullableJsonColumn, writeJsonColumn } from '../../platform/db/index.js';

import {
  ContentFlagListSchema,
  type DraftElement,
  ElementFactRefListSchema,
  ElementSubjectSchema,
  ElementTextSchema,
  type ElementSubject,
  type ElementVersionContent,
  LeftOutMatchListSchema,
} from './schemas.js';

const ExcludedKeysSchema = uniquePrimitives(z.array(MatchKeySchema).max(64));

const SQL = {
  project:
    'SELECT id, competition_name, season_label, stage_label, matchday, language FROM projects ' +
    'WHERE id = ? AND deleted_at IS NULL',
  facts:
    'SELECT f.id AS id, f.fact_key AS fact_key, f.kind AS kind, f.subject AS subject, f.status AS status, ' +
    'f.unverified_reason AS unverified_reason, f.value AS value, f.candidate_value AS candidate_value, ' +
    'f.manual_eligible AS manual_eligible, (SELECT m.action FROM manual_approvals m WHERE m.fact_id = f.id ' +
    'ORDER BY m.at DESC, m.rowid DESC LIMIT 1) AS manual_action FROM facts f WHERE f.run_id = ? ORDER BY f.fact_key',
  aliases:
    'SELECT DISTINCT a.team_id AS team_id, a.alias AS alias FROM team_aliases a WHERE a.team_id IN (' +
    "SELECT json_extract(f.subject, '$.teamId') FROM facts f WHERE f.run_id = ? AND f.kind = 'team_official_name') " +
    'ORDER BY a.team_id, a.alias',
  standings: 'SELECT standings_availability FROM workflow_runs WHERE id = ?',
  activeDraftExclusions:
    'SELECT excluded_match_keys FROM content_drafts WHERE project_id = ? AND superseded_at IS NULL ' +
    'ORDER BY created_at DESC, rowid DESC LIMIT 1',
  activeDrafts: 'SELECT id FROM content_drafts WHERE project_id = ? AND superseded_at IS NULL',
  supersedeDraft: 'UPDATE content_drafts SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL',
  supersedeDraftVersions:
    'UPDATE element_versions SET superseded_at = ? WHERE superseded_at IS NULL AND element_id IN (' +
    'SELECT e.id FROM elements e JOIN carousels c ON c.id = e.carousel_id WHERE c.draft_id = ?)',
  invalidateDraftFinalApprovals:
    'UPDATE final_approvals SET invalidated_at = ? WHERE invalidated_at IS NULL AND carousel_id IN (' +
    'SELECT id FROM carousels WHERE draft_id = ?)',
  insertDraft:
    'INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, ' +
    'excluded_match_keys, left_out_matches, created_at, superseded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
  insertCarousel: 'INSERT INTO carousels (id, draft_id, sequence, total) VALUES (?, ?, ?, ?)',
  insertElement:
    'INSERT INTO elements (id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
  insertVersion:
    'INSERT INTO element_versions (id, element_id, version_number, origin, text, content_flags, ai_adapter, ' +
    'template_id, template_version, render_model, image_path, image_sha256, width, height, qa_status, created_at, ' +
    "superseded_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', ?, NULL)",
  insertFactRef: 'INSERT INTO element_fact_refs (element_version_id, fact_id, usage) VALUES (?, ?, ?)',
  setCurrentVersion: 'UPDATE elements SET current_version_id = ? WHERE id = ?',
  element:
    'SELECT e.id AS id, e.carousel_id AS carousel_id, e.kind AS kind, e.position AS position, ' +
    'e.slide_type AS slide_type, e.slide_key AS slide_key, e.subject AS subject, ' +
    'e.current_version_id AS current_version_id, c.sequence AS sequence, c.total AS total, ' +
    'd.id AS draft_id, d.project_id AS project_id, d.facts_run_id AS facts_run_id, d.language AS language, ' +
    'd.superseded_at AS draft_superseded_at FROM elements e JOIN carousels c ON c.id = e.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE e.id = ?',
  carouselElements:
    'SELECT id, kind, position, slide_type, slide_key, subject FROM elements WHERE carousel_id = ? ORDER BY position',
  nextVersionNumber: 'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM element_versions WHERE element_id = ?',
  supersedeVersion: 'UPDATE element_versions SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL',
  invalidateCarouselFinalApprovals:
    'UPDATE final_approvals SET invalidated_at = ? WHERE carousel_id = ? AND invalidated_at IS NULL',
} as const;

interface ProjectRow {
  id: string;
  competition_name: string;
  season_label: string;
  stage_label: string;
  matchday: number | null;
  language: string;
}

interface FactRow {
  id: string;
  fact_key: string;
  kind: string;
  subject: string;
  status: string;
  unverified_reason: string | null;
  value: string | null;
  candidate_value: string | null;
  manual_eligible: number;
  manual_action: string | null;
}

/** The project's selection labels and language (snapshots taken at creation). */
export interface ProjectLabels {
  readonly competitionName: string;
  readonly seasonLabel: string;
  readonly stageLabel: string;
  readonly matchday: number | null;
  readonly language: string;
}

/** An element with its carousel and draft, as a regeneration needs it. */
export interface StoredElement {
  readonly id: string;
  readonly carouselId: string;
  readonly kind: string;
  readonly position: number;
  readonly slideType: string | null;
  readonly slideKey: string;
  readonly subject: ElementSubject;
  readonly currentVersionId: string | null;
  readonly sequence: number;
  readonly total: number;
  readonly draftId: string;
  readonly projectId: string;
  readonly factsRunId: string;
  readonly language: string;
  readonly draftSuperseded: boolean;
}

/** A sibling element of a carousel (the slides a regeneration request lists). */
export interface StoredCarouselElement {
  readonly id: string;
  readonly kind: string;
  readonly position: number;
  readonly slideType: string | null;
  readonly slideKey: string;
  readonly subject: ElementSubject;
}

function parseJson(text: string | null): unknown {
  return text === null ? null : (JSON.parse(text) as unknown);
}

/**
 * The contract subject of a stored fact (`matchKey`, `teamId`, `contextIndex`). The verification stage also stores
 * the canonical value of each evidence observation in `facts.subject` (T30); those entries are not part of the facts
 * view and never reach the content stage input or the AI request. Values are validated by the stage input schema.
 */
function contractSubject(stored: unknown): unknown {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return stored;
  }
  const subject: Record<string, unknown> = {};
  for (const key of ['matchKey', 'teamId', 'contextIndex'] as const) {
    if (Object.hasOwn(stored, key)) {
      subject[key] = (stored as Record<string, unknown>)[key];
    }
  }
  return subject;
}

/** The new draft rows (IDs and times chosen by the caller). */
export interface NewDraft {
  readonly id: string;
  readonly projectId: string;
  readonly runId: string;
  readonly factsRunId: string;
  readonly language: string;
  readonly standingsIncluded: boolean;
  readonly excludedMatchKeys: readonly string[];
  readonly leftOutMatches: unknown;
  readonly createdAt: string;
  readonly aiAdapter: string;
  readonly carousels: readonly {
    readonly id: string;
    readonly sequence: number;
    readonly total: number;
    readonly elements: readonly { readonly id: string; readonly versionId: string; readonly element: DraftElement }[];
  }[];
}

/** Database access of the content module over the `Db` port. */
export class ContentRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  projectLabels(projectId: string): ProjectLabels | null {
    const row = this.#db.prepare<ProjectRow>(SQL.project).get([projectId]);
    return row === undefined
      ? null
      : {
          competitionName: row.competition_name,
          seasonLabel: row.season_label,
          stageLabel: row.stage_label,
          matchday: row.matchday,
          language: row.language,
        };
  }

  /**
   * The facts of a run as plain objects for `ContentFactSchema` (validated by the stage input schema). The effective
   * status is `manually_approved` when the fact is manually eligible and its latest manual approval is `approved`.
   */
  facts(runId: string): Record<string, unknown>[] {
    return this.#db
      .prepare<FactRow>(SQL.facts)
      .all([runId])
      .map((row) => ({
        id: row.id,
        factKey: row.fact_key,
        kind: row.kind,
        subject: contractSubject(parseJson(row.subject)),
        status:
          row.status === 'unverified' && row.manual_eligible === 1 && row.manual_action === 'approved'
            ? 'manually_approved'
            : row.status,
        unverifiedReason:
          row.status === 'unverified' && row.manual_eligible === 1 && row.manual_action === 'approved'
            ? null
            : row.unverified_reason,
        value: parseJson(row.value),
        candidateValue: parseJson(row.candidate_value),
      }));
  }

  /** The known name forms of the teams named by the run's facts. */
  teamAliases(runId: string): { teamId: string; alias: string }[] {
    return this.#db
      .prepare<{ team_id: string; alias: string }>(SQL.aliases)
      .all([runId])
      .map((row) => ({ teamId: row.team_id, alias: row.alias }));
  }

  /** The standings availability research recorded on the run; null when none was recorded. */
  standingsAvailability(runId: string): StandingsAvailability | null {
    const row = this.#db.prepare<{ standings_availability: string | null }>(SQL.standings).get([runId]);
    return row === undefined
      ? null
      : readNullableJsonColumn(StandingsAvailabilitySchema, row.standings_availability, 'standings_availability');
  }

  /** The exclusions of the project's active draft; null when the project has no active draft. */
  activeDraftExclusions(projectId: string): string[] | null {
    const row = this.#db.prepare<{ excluded_match_keys: string }>(SQL.activeDraftExclusions).get([projectId]);
    return row === undefined
      ? null
      : readJsonColumn(ExcludedKeysSchema, row.excluded_match_keys, 'excluded_match_keys');
  }

  /**
   * Supersedes the project's active drafts: the drafts, their current element versions, and the final approvals of
   * their carousels (architecture.md sections 11.1 and 11.2). Call inside a transaction.
   */
  supersedeActiveDrafts(projectId: string, at: string): void {
    const drafts = this.#db.prepare<{ id: string }>(SQL.activeDrafts).all([projectId]);
    for (const draft of drafts) {
      this.#db.prepare(SQL.supersedeDraft).run([at, draft.id]);
      this.#db.prepare(SQL.supersedeDraftVersions).run([at, draft.id]);
      this.#db.prepare(SQL.invalidateDraftFinalApprovals).run([at, draft.id]);
    }
  }

  /** Inserts a draft with its carousels, elements, versions and fact references. Call inside a transaction. */
  insertDraft(draft: NewDraft): void {
    this.#db
      .prepare(SQL.insertDraft)
      .run([
        draft.id,
        draft.projectId,
        draft.runId,
        draft.factsRunId,
        draft.language,
        draft.standingsIncluded ? 1 : 0,
        writeJsonColumn(ExcludedKeysSchema, draft.excludedMatchKeys, 'excluded_match_keys'),
        writeJsonColumn(LeftOutMatchListSchema, draft.leftOutMatches, 'left_out_matches'),
        draft.createdAt,
      ]);
    for (const carousel of draft.carousels) {
      this.#db.prepare(SQL.insertCarousel).run([carousel.id, draft.id, carousel.sequence, carousel.total]);
      for (const { id, versionId, element } of carousel.elements) {
        this.#db
          .prepare(SQL.insertElement)
          .run([
            id,
            carousel.id,
            element.kind,
            element.position,
            element.slideType,
            element.slideKey,
            writeJsonColumn(ElementSubjectSchema, element.subject, 'subject'),
          ]);
        this.insertVersion({
          id: versionId,
          elementId: id,
          versionNumber: 1,
          origin: 'generated',
          content: element.version,
          aiAdapter: draft.aiAdapter,
          createdAt: draft.createdAt,
        });
      }
    }
  }

  /** Inserts an element version with its fact references and makes it the element's current version. */
  insertVersion(version: {
    readonly id: string;
    readonly elementId: string;
    readonly versionNumber: number;
    readonly origin: 'generated' | 'regenerated';
    readonly content: ElementVersionContent;
    readonly aiAdapter: string;
    readonly createdAt: string;
  }): void {
    this.#db
      .prepare(SQL.insertVersion)
      .run([
        version.id,
        version.elementId,
        version.versionNumber,
        version.origin,
        writeJsonColumn(ElementTextSchema, version.content.text, 'text'),
        writeJsonColumn(ContentFlagListSchema, version.content.contentFlags, 'content_flags'),
        version.aiAdapter,
        version.createdAt,
      ]);
    for (const ref of ElementFactRefListSchema.parse(version.content.factRefs)) {
      this.#db.prepare(SQL.insertFactRef).run([version.id, ref.factId, ref.usage]);
    }
    this.#db.prepare(SQL.setCurrentVersion).run([version.id, version.elementId]);
  }

  /** An element with its carousel and draft; null when it does not exist. */
  element(elementId: string): StoredElement | null {
    const row = this.#db
      .prepare<{
        id: string;
        carousel_id: string;
        kind: string;
        position: number;
        slide_type: string | null;
        slide_key: string;
        subject: string;
        current_version_id: string | null;
        sequence: number;
        total: number;
        draft_id: string;
        project_id: string;
        facts_run_id: string;
        language: string;
        draft_superseded_at: string | null;
      }>(SQL.element)
      .get([elementId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      carouselId: row.carousel_id,
      kind: row.kind,
      position: row.position,
      slideType: row.slide_type,
      slideKey: row.slide_key,
      subject: readJsonColumn(ElementSubjectSchema, row.subject, 'subject'),
      currentVersionId: row.current_version_id,
      sequence: row.sequence,
      total: row.total,
      draftId: row.draft_id,
      projectId: row.project_id,
      factsRunId: row.facts_run_id,
      language: row.language,
      draftSuperseded: row.draft_superseded_at !== null,
    };
  }

  /** The elements of a carousel in position order. */
  carouselElements(carouselId: string): StoredCarouselElement[] {
    return this.#db
      .prepare<{
        id: string;
        kind: string;
        position: number;
        slide_type: string | null;
        slide_key: string;
        subject: string;
      }>(SQL.carouselElements)
      .all([carouselId])
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        position: row.position,
        slideType: row.slide_type,
        slideKey: row.slide_key,
        subject: readJsonColumn(ElementSubjectSchema, row.subject, 'subject'),
      }));
  }

  nextVersionNumber(elementId: string): number {
    return this.#db.prepare<{ next: number }>(SQL.nextVersionNumber).get([elementId])?.next ?? 1;
  }

  /** Marks a version superseded. Returns false when it was already superseded. */
  supersedeVersion(versionId: string, at: string): boolean {
    return this.#db.prepare(SQL.supersedeVersion).run([at, versionId]).changes === 1;
  }

  /** Invalidates the valid final approvals of a carousel (its version set changes). */
  invalidateFinalApprovals(carouselId: string, at: string): void {
    this.#db.prepare(SQL.invalidateCarouselFinalApprovals).run([at, carouselId]);
  }
}
