/**
 * Persistence of the editorial copy (PD-ARCH-01H; migration 0033). Every statement is a constant with bound
 * parameters; JSON columns are validated on write and read; rows are never deleted (OD-08).
 */
import {
  EDITORIAL_DELIVERABLES,
  type EditorialDeliverable,
  EditorialDeliverableSchema,
  type EditorialField,
  EditorialFieldSchema,
  type EditorialFlag,
  EditorialFlagSchema,
  type EditorialGenerationErrorCode,
  EditorialGenerationErrorCodeSchema,
  type EditorialGenerationStatus,
  EditorialGenerationStatusSchema,
  type EditorialResearchMode,
  EditorialResearchModeSchema,
  type EditorialVersionOrigin,
  EditorialVersionOriginSchema,
  type EditorialWriterKind,
  EditorialWriterKindSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

import type { Db, TransactionWork } from '../../platform/db/index.js';
import { readJsonColumn, writeJsonColumn } from '../../platform/db/index.js';

const DeliverableListSchema = z.array(EditorialDeliverableSchema).min(1).max(EDITORIAL_DELIVERABLES.length);
const FieldListSchema = z.array(EditorialFieldSchema).min(1).max(4);
const FlagListSchema = z.array(EditorialFlagSchema).max(40);
const IdListSchema = z.array(z.string().min(1).max(64)).max(400);
const FactIdListSchema = z.array(UuidSchema).max(2000);
const RawSchema = z.record(z.string(), z.union([z.string().max(20000), z.array(z.string().max(200)).max(30)]));
const ContextSnapshotSchema = z.record(z.string(), z.unknown());

const GENERATION_COLUMNS =
  'id, project_id, draft_id, request_key, request_hash, deliverables, instructions, adapter, writer_kind, model, ' +
  'prompt_version, research_mode, context, billed, status, error_code, usage_input, usage_output, estimated_cost, ' +
  'computed_cost, created_at, completed_at';

const VERSION_COLUMNS =
  'id, project_id, draft_id, deliverable, version_number, origin, generation_id, base_version_id, instructions, raw, ' +
  'fields, flags, fact_ids, event_ids, evidence_ids, created_at, approved_at, superseded_at';

const SQL = {
  project: 'SELECT id, source_id FROM projects WHERE id = ? AND deleted_at IS NULL',
  activeDraft:
    'SELECT id, facts_run_id, language, excluded_match_keys, created_at FROM content_drafts ' +
    'WHERE project_id = ? AND superseded_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1',
  roundCounts:
    'SELECT status, COUNT(*) AS n FROM competition_matches WHERE round_id = ? GROUP BY status ORDER BY status',
  insertGeneration: `INSERT INTO editorial_generations (${GENERATION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  generation: `SELECT ${GENERATION_COLUMNS} FROM editorial_generations WHERE id = ?`,
  generationByKey: `SELECT ${GENERATION_COLUMNS} FROM editorial_generations WHERE request_key = ?`,
  latestGeneration: `SELECT ${GENERATION_COLUMNS} FROM editorial_generations WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  completeGeneration:
    "UPDATE editorial_generations SET status = 'succeeded', usage_input = ?, usage_output = ?, computed_cost = ?, " +
    "completed_at = ? WHERE id = ? AND status = 'running'",
  failGeneration:
    "UPDATE editorial_generations SET status = 'failed', error_code = ?, usage_input = ?, usage_output = ?, " +
    "computed_cost = ?, completed_at = ? WHERE id = ? AND status = 'running'",
  interruptRunning:
    "UPDATE editorial_generations SET status = 'failed', error_code = 'interrupted', completed_at = ? WHERE status = 'running'",
  runningCount: "SELECT COUNT(*) AS n FROM editorial_generations WHERE status = 'running'",
  countSince: 'SELECT COUNT(*) AS n FROM editorial_generations WHERE created_at >= ?',
  // Spend of billed generations: the computed cost, else the conservative estimate (the request may have been billed).
  spendSince:
    'SELECT COALESCE(SUM(COALESCE(computed_cost, estimated_cost, 0)), 0) AS total, ' +
    'SUM(CASE WHEN computed_cost IS NULL AND estimated_cost IS NULL THEN 1 ELSE 0 END) AS unknown ' +
    'FROM editorial_generations WHERE billed = 1 AND created_at >= ?',
  currentVersions: `SELECT ${VERSION_COLUMNS} FROM editorial_versions WHERE draft_id = ? AND superseded_at IS NULL ORDER BY deliverable`,
  versionCounts: 'SELECT deliverable, COUNT(*) AS n FROM editorial_versions WHERE draft_id = ? GROUP BY deliverable',
  currentVersion: `SELECT ${VERSION_COLUMNS} FROM editorial_versions WHERE draft_id = ? AND deliverable = ? AND superseded_at IS NULL`,
  version: `SELECT ${VERSION_COLUMNS} FROM editorial_versions WHERE id = ?`,
  nextVersionNumber:
    'SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM editorial_versions WHERE draft_id = ? AND deliverable = ?',
  supersede: 'UPDATE editorial_versions SET superseded_at = ? WHERE id = ? AND superseded_at IS NULL',
  insertVersion: `INSERT INTO editorial_versions (${VERSION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  approve:
    'UPDATE editorial_versions SET approved_at = ? WHERE id = ? AND superseded_at IS NULL AND approved_at IS NULL',
  withdraw: 'UPDATE editorial_versions SET approved_at = NULL WHERE id = ? AND superseded_at IS NULL',
} as const;

interface GenerationRow {
  id: string;
  project_id: string;
  draft_id: string;
  request_key: string;
  request_hash: string;
  deliverables: string;
  instructions: string | null;
  adapter: string;
  writer_kind: string;
  model: string | null;
  prompt_version: string;
  research_mode: string;
  context: string;
  billed: number;
  status: string;
  error_code: string | null;
  usage_input: number | null;
  usage_output: number | null;
  estimated_cost: number | null;
  computed_cost: number | null;
  created_at: string;
  completed_at: string | null;
}

interface VersionRow {
  id: string;
  project_id: string;
  draft_id: string;
  deliverable: string;
  version_number: number;
  origin: string;
  generation_id: string | null;
  base_version_id: string | null;
  instructions: string | null;
  raw: string | null;
  fields: string;
  flags: string;
  fact_ids: string;
  event_ids: string;
  evidence_ids: string;
  created_at: string;
  approved_at: string | null;
  superseded_at: string | null;
}

export interface GenerationRecord {
  readonly id: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly requestKey: string;
  readonly requestHash: string;
  readonly deliverables: readonly EditorialDeliverable[];
  readonly instructions: string | null;
  readonly adapter: string;
  readonly writerKind: EditorialWriterKind;
  readonly model: string | null;
  readonly promptVersion: string;
  readonly researchMode: EditorialResearchMode;
  readonly billed: boolean;
  readonly status: EditorialGenerationStatus;
  readonly errorCode: EditorialGenerationErrorCode | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly estimatedCost: number | null;
  readonly computedCost: number | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface NewGeneration extends Omit<
  GenerationRecord,
  'status' | 'errorCode' | 'inputTokens' | 'outputTokens' | 'computedCost' | 'completedAt'
> {
  readonly context: Record<string, unknown>;
}

export interface VersionRecord {
  readonly id: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly deliverable: EditorialDeliverable;
  readonly versionNumber: number;
  readonly origin: EditorialVersionOrigin;
  readonly generationId: string | null;
  readonly baseVersionId: string | null;
  readonly instructions: string | null;
  readonly raw: Record<string, string | string[]> | null;
  readonly fields: EditorialField[];
  readonly flags: EditorialFlag[];
  readonly factIds: string[];
  readonly eventIds: string[];
  readonly evidenceIds: string[];
  readonly createdAt: string;
  readonly approvedAt: string | null;
  readonly supersededAt: string | null;
}

export type NewVersion = Omit<VersionRecord, 'approvedAt' | 'supersededAt'>;

export interface ActiveDraft {
  readonly id: string;
  readonly factsRunId: string;
  readonly language: string;
  readonly excludedMatchKeys: string[];
  readonly createdAt: string;
}

function generationOf(row: GenerationRow): GenerationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    draftId: row.draft_id,
    requestKey: row.request_key,
    requestHash: row.request_hash,
    deliverables: readJsonColumn(DeliverableListSchema, row.deliverables, 'deliverables'),
    instructions: row.instructions,
    adapter: row.adapter,
    writerKind: EditorialWriterKindSchema.parse(row.writer_kind),
    model: row.model,
    promptVersion: row.prompt_version,
    researchMode: EditorialResearchModeSchema.parse(row.research_mode),
    billed: row.billed === 1,
    status: EditorialGenerationStatusSchema.parse(row.status),
    errorCode: row.error_code === null ? null : EditorialGenerationErrorCodeSchema.parse(row.error_code),
    inputTokens: row.usage_input,
    outputTokens: row.usage_output,
    estimatedCost: row.estimated_cost,
    computedCost: row.computed_cost,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function versionOf(row: VersionRow): VersionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    draftId: row.draft_id,
    deliverable: EditorialDeliverableSchema.parse(row.deliverable),
    versionNumber: row.version_number,
    origin: EditorialVersionOriginSchema.parse(row.origin),
    generationId: row.generation_id,
    baseVersionId: row.base_version_id,
    instructions: row.instructions,
    raw: row.raw === null ? null : readJsonColumn(RawSchema, row.raw, 'raw'),
    fields: readJsonColumn(FieldListSchema, row.fields, 'fields'),
    flags: readJsonColumn(FlagListSchema, row.flags, 'flags'),
    factIds: readJsonColumn(FactIdListSchema, row.fact_ids, 'fact_ids'),
    eventIds: readJsonColumn(IdListSchema, row.event_ids, 'event_ids'),
    evidenceIds: readJsonColumn(IdListSchema, row.evidence_ids, 'evidence_ids'),
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    supersededAt: row.superseded_at,
  };
}

export class EditorialRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  transaction<T>(work: TransactionWork<T>): T {
    return this.#db.transaction(work);
  }

  project(projectId: string): { readonly id: string; readonly sourceId: string } | null {
    const row = this.#db.prepare<{ id: string; source_id: string }>(SQL.project).get([projectId]);
    return row === undefined ? null : { id: row.id, sourceId: row.source_id };
  }

  activeDraft(projectId: string): ActiveDraft | null {
    const row = this.#db
      .prepare<{ id: string; facts_run_id: string; language: string; excluded_match_keys: string; created_at: string }>(
        SQL.activeDraft,
      )
      .get([projectId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      factsRunId: row.facts_run_id,
      language: row.language,
      excludedMatchKeys: readJsonColumn(
        z.array(z.string().max(128)).max(64),
        row.excluded_match_keys,
        'excluded_match_keys',
      ),
      createdAt: row.created_at,
    };
  }

  /** Local status counts of every match of a round. */
  roundCounts(roundId: string): Map<string, number> {
    const rows = this.#db.prepare<{ status: string; n: number }>(SQL.roundCounts).all([roundId]);
    return new Map(rows.map((row) => [row.status, row.n]));
  }

  insertGeneration(generation: NewGeneration): void {
    this.#db
      .prepare(SQL.insertGeneration)
      .run([
        generation.id,
        generation.projectId,
        generation.draftId,
        generation.requestKey,
        generation.requestHash,
        writeJsonColumn(DeliverableListSchema, generation.deliverables, 'deliverables'),
        generation.instructions,
        generation.adapter,
        generation.writerKind,
        generation.model,
        generation.promptVersion,
        generation.researchMode,
        writeJsonColumn(ContextSnapshotSchema, generation.context, 'context'),
        generation.billed ? 1 : 0,
        'running',
        null,
        null,
        null,
        generation.estimatedCost,
        null,
        generation.createdAt,
        null,
      ]);
  }

  generation(id: string): GenerationRecord | null {
    const row = this.#db.prepare<GenerationRow>(SQL.generation).get([id]);
    return row === undefined ? null : generationOf(row);
  }

  generationByKey(requestKey: string): GenerationRecord | null {
    const row = this.#db.prepare<GenerationRow>(SQL.generationByKey).get([requestKey]);
    return row === undefined ? null : generationOf(row);
  }

  latestGeneration(projectId: string): GenerationRecord | null {
    const row = this.#db.prepare<GenerationRow>(SQL.latestGeneration).get([projectId]);
    return row === undefined ? null : generationOf(row);
  }

  completeGeneration(
    id: string,
    usage: { inputTokens: number | null; outputTokens: number | null; computedCost: number | null },
    at: string,
  ): void {
    this.#db.prepare(SQL.completeGeneration).run([usage.inputTokens, usage.outputTokens, usage.computedCost, at, id]);
  }

  failGeneration(
    id: string,
    code: EditorialGenerationErrorCode,
    usage: { inputTokens: number | null; outputTokens: number | null; computedCost: number | null },
    at: string,
  ): void {
    this.#db.prepare(SQL.failGeneration).run([code, usage.inputTokens, usage.outputTokens, usage.computedCost, at, id]);
  }

  /** Marks the generations a restart interrupted as failed; returns how many. */
  interruptRunning(at: string): number {
    return Number(this.#db.prepare(SQL.interruptRunning).run([at]).changes);
  }

  runningCount(): number {
    return this.#db.prepare<{ n: number }>(SQL.runningCount).get([])?.n ?? 0;
  }

  countSince(since: string): number {
    return this.#db.prepare<{ n: number }>(SQL.countSince).get([since])?.n ?? 0;
  }

  /** Spend of billed generations since a time; `unknown` counts generations without any cost figure. */
  spendSince(since: string): { readonly total: number; readonly unknown: number } {
    const row = this.#db.prepare<{ total: number; unknown: number | null }>(SQL.spendSince).get([since]);
    return { total: row?.total ?? 0, unknown: row?.unknown ?? 0 };
  }

  currentVersions(draftId: string): VersionRecord[] {
    return this.#db.prepare<VersionRow>(SQL.currentVersions).all([draftId]).map(versionOf);
  }

  versionCounts(draftId: string): Map<EditorialDeliverable, number> {
    const rows = this.#db.prepare<{ deliverable: string; n: number }>(SQL.versionCounts).all([draftId]);
    return new Map(rows.map((row) => [EditorialDeliverableSchema.parse(row.deliverable), row.n]));
  }

  currentVersion(draftId: string, deliverable: EditorialDeliverable): VersionRecord | null {
    const row = this.#db.prepare<VersionRow>(SQL.currentVersion).get([draftId, deliverable]);
    return row === undefined ? null : versionOf(row);
  }

  version(id: string): VersionRecord | null {
    const row = this.#db.prepare<VersionRow>(SQL.version).get([id]);
    return row === undefined ? null : versionOf(row);
  }

  nextVersionNumber(draftId: string, deliverable: EditorialDeliverable): number {
    return this.#db.prepare<{ n: number }>(SQL.nextVersionNumber).get([draftId, deliverable])?.n ?? 1;
  }

  supersede(versionId: string, at: string): boolean {
    return Number(this.#db.prepare(SQL.supersede).run([at, versionId]).changes) === 1;
  }

  insertVersion(version: NewVersion): void {
    this.#db
      .prepare(SQL.insertVersion)
      .run([
        version.id,
        version.projectId,
        version.draftId,
        version.deliverable,
        version.versionNumber,
        version.origin,
        version.generationId,
        version.baseVersionId,
        version.instructions,
        version.raw === null ? null : writeJsonColumn(RawSchema, version.raw, 'raw'),
        writeJsonColumn(FieldListSchema, version.fields, 'fields'),
        writeJsonColumn(FlagListSchema, version.flags, 'flags'),
        writeJsonColumn(FactIdListSchema, version.factIds, 'fact_ids'),
        writeJsonColumn(IdListSchema, version.eventIds, 'event_ids'),
        writeJsonColumn(IdListSchema, version.evidenceIds, 'evidence_ids'),
        version.createdAt,
        null,
        null,
      ]);
  }

  approve(versionId: string, at: string): boolean {
    return Number(this.#db.prepare(SQL.approve).run([at, versionId]).changes) === 1;
  }

  withdraw(versionId: string): boolean {
    return Number(this.#db.prepare(SQL.withdraw).run([versionId]).changes) === 1;
  }
}
