/**
 * Persistence of the AI design generations and proposals (migration 0025; PD-ARCH-01G-B section 16). Rows are never
 * deleted; files live under `<dataDir>/design-proposals/` and only their relative path and hash are stored here.
 */
import type {
  BrandAssetKind,
  DesignContentType,
  DesignMode,
  DesignCostEstimate,
  DesignDecision,
  DesignFormat,
  DesignGenerationErrorCode,
  DesignGenerationStatus,
  DesignProposalStatus,
  DesignReference,
} from '@edr/contracts';

import type { Db } from '../../platform/db/index.js';
import type { ImageUsage } from '../../providers/images/index.js';

import type { Adaptation } from './sizes.js';

export interface GenerationRecord {
  readonly id: string;
  readonly requestKey: string;
  readonly requestHash: string;
  readonly mode: DesignMode;
  readonly parentProposalId: string | null;
  readonly contentType: DesignContentType;
  readonly format: DesignFormat;
  readonly style: string | null;
  readonly instructions: string | null;
  readonly inheritedInstructions: string | null;
  readonly quality: string;
  readonly requestedCount: number;
  readonly provider: string;
  readonly model: string;
  readonly requestSize: string;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly adaptation: Adaptation;
  readonly promptVersion: string;
  readonly prompt: string;
  readonly references: readonly DesignReference[];
  readonly estimate: DesignCostEstimate;
  readonly status: DesignGenerationStatus;
  readonly currentIndex: number | null;
  readonly completedCount: number;
  readonly usage: ImageUsage | null;
  readonly cost: number | null;
  readonly errorCode: DesignGenerationErrorCode | null;
  readonly errorMessage: string | null;
  readonly retryAfterSeconds: number | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export type NewGeneration = Omit<
  GenerationRecord,
  | 'status'
  | 'currentIndex'
  | 'completedCount'
  | 'usage'
  | 'cost'
  | 'errorCode'
  | 'errorMessage'
  | 'retryAfterSeconds'
  | 'startedAt'
  | 'updatedAt'
  | 'completedAt'
>;

/** An original brand asset drawn over a proposal, with its pixel box. */
export interface ProposalLayer {
  readonly assetId: string;
  readonly label: string;
  readonly kind: BrandAssetKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ProposalRecord {
  readonly id: string;
  readonly generationId: string;
  readonly sequence: number;
  readonly name: string;
  readonly contentType: DesignContentType;
  readonly format: DesignFormat;
  readonly width: number;
  readonly height: number;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly filePath: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly usage: ImageUsage | null;
  readonly cost: number | null;
  readonly status: DesignProposalStatus;
  readonly decisionNote: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
  /** The generated bitmap when original layers were drawn over it (migration 0026); else the file is the bitmap. */
  readonly backgroundFilePath: string | null;
  readonly backgroundSha256: string | null;
  readonly layers: readonly ProposalLayer[];
  readonly deletedAt: string | null;
}

export interface GenerationEventRecord {
  readonly sequence: number;
  readonly generationId: string;
  readonly eventType: string;
  readonly status: DesignGenerationStatus;
  readonly imageIndex: number | null;
  readonly proposalId: string | null;
  readonly createdAt: string;
}

export interface DecisionRecord {
  readonly decision: DesignDecision;
  readonly note: string | null;
  readonly createdAt: string;
}

interface GenerationRow {
  id: string;
  request_key: string;
  request_hash: string;
  mode: DesignMode;
  instructions_text: string | null;
  inherited_text: string | null;
  parent_proposal_id: string | null;
  content_type: DesignContentType;
  format: DesignFormat;
  style: string | null;
  instructions: string | null;
  inherited_instructions: string | null;
  quality: string;
  requested_count: number;
  provider: string;
  model: string;
  request_size: string;
  output_width: number;
  output_height: number;
  adaptation: Adaptation;
  prompt_version: string;
  prompt: string;
  references_json: string;
  estimate_json: string;
  status: DesignGenerationStatus;
  current_index: number | null;
  completed_count: number;
  usage_json: string;
  cost: number | null;
  error_code: DesignGenerationErrorCode | null;
  error_message: string | null;
  retry_after_seconds: number | null;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
}

interface ProposalRow {
  id: string;
  generation_id: string;
  sequence: number;
  name: string;
  content_type: DesignContentType;
  format: DesignFormat;
  width: number;
  height: number;
  mime: 'image/png' | 'image/jpeg';
  file_path: string;
  sha256: string;
  byte_size: number;
  usage_json: string | null;
  cost: number | null;
  status: DesignProposalStatus;
  decision_note: string | null;
  decision_note_text: string | null;
  decided_at: string | null;
  created_at: string;
  background_file_path: string | null;
  background_sha256: string | null;
  layers_json: string | null;
  deleted_at: string | null;
}

interface EventRow {
  sequence: number;
  generation_id: string;
  event_type: string;
  status: DesignGenerationStatus;
  image_index: number | null;
  proposal_id: string | null;
  created_at: string;
}

/** Usage is stored as an object; `{}` means no usage was reported. */
function usageOf(text: string | null): ImageUsage | null {
  if (text === null) return null;
  const value = JSON.parse(text) as Partial<ImageUsage>;
  return Object.keys(value).length === 0 ? null : (value as ImageUsage);
}

function toGeneration(row: GenerationRow): GenerationRecord {
  return {
    id: row.id,
    requestKey: row.request_key,
    requestHash: row.request_hash,
    mode: row.mode,
    parentProposalId: row.parent_proposal_id,
    contentType: row.content_type,
    format: row.format,
    style: row.style,
    // Rows before migration 0027 keep their text in the old, shorter columns.
    instructions: row.instructions_text ?? row.instructions,
    inheritedInstructions: row.inherited_text ?? row.inherited_instructions,
    quality: row.quality,
    requestedCount: row.requested_count,
    provider: row.provider,
    model: row.model,
    requestSize: row.request_size,
    outputWidth: row.output_width,
    outputHeight: row.output_height,
    adaptation: row.adaptation,
    promptVersion: row.prompt_version,
    prompt: row.prompt,
    references: JSON.parse(row.references_json) as DesignReference[],
    estimate: JSON.parse(row.estimate_json) as DesignCostEstimate,
    status: row.status,
    currentIndex: row.current_index,
    completedCount: row.completed_count,
    usage: usageOf(row.usage_json),
    cost: row.cost,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryAfterSeconds: row.retry_after_seconds,
    createdAt: row.created_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function toProposal(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    generationId: row.generation_id,
    sequence: row.sequence,
    name: row.name,
    contentType: row.content_type,
    format: row.format,
    width: row.width,
    height: row.height,
    mime: row.mime,
    filePath: row.file_path,
    sha256: row.sha256,
    byteSize: row.byte_size,
    usage: usageOf(row.usage_json),
    cost: row.cost,
    status: row.status,
    decisionNote: row.decision_note_text ?? row.decision_note,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    backgroundFilePath: row.background_file_path,
    backgroundSha256: row.background_sha256,
    layers: row.layers_json === null ? [] : (JSON.parse(row.layers_json) as ProposalLayer[]),
    deletedAt: row.deleted_at,
  };
}

export interface GenerationProgress {
  readonly status: DesignGenerationStatus;
  readonly currentIndex?: number | null;
  readonly eventType: string;
  readonly proposalId?: string | null;
  readonly errorCode?: DesignGenerationErrorCode | null;
  readonly errorMessage?: string | null;
  readonly retryAfterSeconds?: number | null;
}

export class DesignRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  generationByKey(requestKey: string): GenerationRecord | null {
    const row = this.#db
      .prepare<GenerationRow>('SELECT * FROM design_generations WHERE request_key = ?')
      .get([requestKey]);
    return row === undefined ? null : toGeneration(row);
  }

  generation(id: string): GenerationRecord | null {
    const row = this.#db.prepare<GenerationRow>('SELECT * FROM design_generations WHERE id = ?').get([id]);
    return row === undefined ? null : toGeneration(row);
  }

  /** Generations that were running when the server stopped. */
  unfinishedGenerations(): GenerationRecord[] {
    return this.#db
      .prepare<GenerationRow>("SELECT * FROM design_generations WHERE status NOT IN ('completed', 'failed')")
      .all()
      .map(toGeneration);
  }

  runningCount(): number {
    return (
      this.#db
        .prepare<{ n: number }>(
          "SELECT count(*) AS n FROM design_generations WHERE status NOT IN ('completed', 'failed')",
        )
        .get()?.n ?? 0
    );
  }

  /**
   * Images counted against the daily limit since a time: the requested count, or for a failed generation every image
   * request that reached the provider (it may have been charged even when no image came back), and at least what it
   * produced.
   */
  imagesSince(since: string): number {
    return (
      this.#db
        .prepare<{ n: number | null }>(
          "SELECT sum(CASE g.status WHEN 'failed' THEN max(g.completed_count, (SELECT count(*) " +
            "FROM design_generation_events e WHERE e.generation_id = g.id AND e.event_type = 'image.requested')) " +
            'ELSE g.requested_count END) AS n FROM design_generations g WHERE g.created_at >= ?',
        )
        .get([since])?.n ?? 0
    );
  }

  /** Computed spend since a time, and whether a generation that produced images could not be priced. */
  spendSince(since: string): { total: number; unpriced: number } {
    const row = this.#db
      .prepare<{ total: number | null; unpriced: number }>(
        'SELECT sum(cost) AS total, sum(CASE WHEN cost IS NULL AND completed_count > 0 THEN 1 ELSE 0 END) AS unpriced ' +
          'FROM design_generations WHERE created_at >= ?',
      )
      .get([since]);
    return { total: row?.total ?? 0, unpriced: row?.unpriced ?? 0 };
  }

  insertGeneration(record: NewGeneration): void {
    this.#db
      .prepare(
        'INSERT INTO design_generations (id, request_key, request_hash, mode, parent_proposal_id, content_type, ' +
          'format, style, instructions_text, inherited_text, quality, requested_count, provider, model, request_size, ' +
          'output_width, output_height, adaptation, prompt_version, prompt, references_json, estimate_json, status, ' +
          "completed_count, usage_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, '{}', ?, ?)",
      )
      .run([
        record.id,
        record.requestKey,
        record.requestHash,
        record.mode,
        record.parentProposalId,
        record.contentType,
        record.format,
        record.style,
        record.instructions,
        record.inheritedInstructions,
        record.quality,
        record.requestedCount,
        record.provider,
        record.model,
        record.requestSize,
        record.outputWidth,
        record.outputHeight,
        record.adaptation,
        record.promptVersion,
        record.prompt,
        JSON.stringify(record.references),
        JSON.stringify(record.estimate),
        record.createdAt,
        record.createdAt,
      ]);
    this.#event(record.id, 'generation.queued', 'queued', null, null, record.createdAt);
  }

  /**
   * Records a status change and its event in one transaction. A terminal generation never changes again; returns
   * false when nothing changed.
   */
  progress(id: string, change: GenerationProgress, now: string): boolean {
    return this.#db.transaction(() => {
      const row = this.#db.prepare<GenerationRow>('SELECT * FROM design_generations WHERE id = ?').get([id]);
      if (row === undefined || row.status === 'completed' || row.status === 'failed') {
        return false;
      }
      const terminal = change.status === 'completed' || change.status === 'failed';
      this.#db
        .prepare(
          'UPDATE design_generations SET status = ?, current_index = ?, error_code = ?, error_message = ?, ' +
            'retry_after_seconds = ?, started_at = coalesce(started_at, ?), updated_at = ?, completed_at = ? WHERE id = ?',
        )
        .run([
          change.status,
          terminal ? null : (change.currentIndex ?? row.current_index),
          change.errorCode ?? null,
          change.errorMessage ?? null,
          change.retryAfterSeconds ?? null,
          change.status === 'queued' ? null : now,
          now,
          terminal ? now : null,
          id,
        ]);
      this.#event(
        id,
        change.eventType,
        change.status,
        terminal ? null : (change.currentIndex ?? row.current_index),
        change.proposalId ?? null,
        now,
      );
      return true;
    });
  }

  /** Stores a saved proposal and adds its usage and cost to the generation, in one transaction. */
  insertProposal(
    record: ProposalRecord,
    generationUsage: ImageUsage | null,
    generationCost: number | null,
    now: string,
  ): void {
    this.#db.transaction(() => {
      this.#db
        .prepare(
          'INSERT INTO design_proposals (id, generation_id, sequence, name, content_type, format, width, height, mime, ' +
            'file_path, sha256, byte_size, usage_json, cost, status, created_at, background_file_path, background_sha256, ' +
            "layers_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?)",
        )
        .run([
          record.id,
          record.generationId,
          record.sequence,
          record.name,
          record.contentType,
          record.format,
          record.width,
          record.height,
          record.mime,
          record.filePath,
          record.sha256,
          record.byteSize,
          record.usage === null ? null : JSON.stringify(record.usage),
          record.cost,
          record.createdAt,
          record.backgroundFilePath,
          record.backgroundSha256,
          record.layers.length === 0 ? null : JSON.stringify(record.layers),
        ]);
      this.#db
        .prepare(
          'UPDATE design_generations SET completed_count = completed_count + 1, usage_json = ?, cost = ?, updated_at = ? ' +
            'WHERE id = ?',
        )
        .run([JSON.stringify(generationUsage ?? {}), generationCost, now, record.generationId]);
    });
  }

  eventsSince(id: string, after: number): GenerationEventRecord[] {
    return this.#db
      .prepare<EventRow>(
        'SELECT * FROM design_generation_events WHERE generation_id = ? AND sequence > ? ORDER BY sequence',
      )
      .all([id, after])
      .map((row) => ({
        sequence: row.sequence,
        generationId: row.generation_id,
        eventType: row.event_type,
        status: row.status,
        imageIndex: row.image_index,
        proposalId: row.proposal_id,
        createdAt: row.created_at,
      }));
  }

  #event(
    id: string,
    type: string,
    status: DesignGenerationStatus,
    imageIndex: number | null,
    proposalId: string | null,
    now: string,
  ): void {
    this.#db
      .prepare(
        'INSERT INTO design_generation_events (generation_id, event_type, status, image_index, proposal_id, created_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run([id, type, status, imageIndex, proposalId, now]);
  }

  proposal(id: string): ProposalRecord | null {
    const row = this.#db.prepare<ProposalRow>('SELECT * FROM design_proposals WHERE id = ?').get([id]);
    return row === undefined ? null : toProposal(row);
  }

  proposals(): ProposalRecord[] {
    return this.#db
      .prepare<ProposalRow>(
        'SELECT p.* FROM design_proposals p JOIN design_generations g ON g.id = p.generation_id ' +
          'WHERE p.deleted_at IS NULL ORDER BY g.created_at DESC, g.id, p.sequence ASC',
      )
      .all()
      .map(toProposal);
  }

  proposalsOf(generationId: string): ProposalRecord[] {
    return this.#db
      .prepare<ProposalRow>(
        'SELECT * FROM design_proposals WHERE generation_id = ? AND deleted_at IS NULL ORDER BY sequence',
      )
      .all([generationId])
      .map(toProposal);
  }

  /** IDs of the proposals generated as variants of a proposal. */
  variantsOf(proposalId: string): string[] {
    return this.#db
      .prepare<{ id: string }>(
        'SELECT p.id AS id FROM design_proposals p JOIN design_generations g ON g.id = p.generation_id ' +
          'WHERE g.parent_proposal_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at, p.sequence',
      )
      .all([proposalId])
      .map((row) => row.id);
  }

  decisionsOf(proposalId: string): DecisionRecord[] {
    return this.#db
      .prepare<{ decision: DesignDecision; note: string | null; created_at: string }>(
        'SELECT decision, coalesce(note_text, note) AS note, created_at FROM design_proposal_decisions ' +
          'WHERE proposal_id = ? ORDER BY sequence',
      )
      .all([proposalId])
      .map((row) => ({ decision: row.decision, note: row.note, createdAt: row.created_at }));
  }

  /**
   * Visual templates (not deleted) made from a proposal or using its background in a kept version (PD-ARCH-01G-C).
   */
  templatesUsing(proposalId: string): number {
    return (
      this.#db
        .prepare<{ n: number }>(
          'SELECT count(DISTINCT t.id) AS n FROM visual_templates t WHERE t.deleted_at IS NULL AND ' +
            '(t.source_proposal_id = ? OR EXISTS (SELECT 1 FROM visual_template_versions v WHERE v.template_id = t.id ' +
            "AND v.status <> 'discarded' AND v.background_source = 'design_proposal' AND v.background_id = ?))",
        )
        .get([proposalId, proposalId])?.n ?? 0
    );
  }

  /** Generations still running from a proposal (a variant being generated). */
  runningVariantsOf(proposalId: string): number {
    return (
      this.#db
        .prepare<{ n: number }>(
          "SELECT count(*) AS n FROM design_generations WHERE parent_proposal_id = ? AND status NOT IN ('completed', 'failed')",
        )
        .get([proposalId])?.n ?? 0
    );
  }

  /** Hides a proposal (logical deletion); its row, decisions and files are kept. */
  markDeleted(proposalId: string, now: string): void {
    this.#db
      .prepare('UPDATE design_proposals SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run([now, proposalId]);
  }

  /** Appends a decision and makes it the proposal's current status. */
  decide(proposalId: string, decision: DesignDecision, note: string | null, now: string): void {
    this.#db.transaction(() => {
      this.#db
        .prepare(
          'INSERT INTO design_proposal_decisions (proposal_id, decision, note_text, created_at) VALUES (?, ?, ?, ?)',
        )
        .run([proposalId, decision, note, now]);
      this.#db
        .prepare(
          'UPDATE design_proposals SET status = ?, decision_note = NULL, decision_note_text = ?, decided_at = ? WHERE id = ?',
        )
        .run([decision, note, now, proposalId]);
    });
  }
}
