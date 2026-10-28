/**
 * Verification persistence (data-model.md section 3.2; AD-28, AD-34; T10-F14, T10-F15). Every statement is a
 * constant with bound parameters; JSON columns are validated with Zod on write and on read; failures are stored only
 * as the closed `Failure` (T10-F10). Rows are never deleted or rewritten (OD-08): manual approvals are append-only.
 *
 * `facts.subject` holds the contract subject plus the canonical value of each evidence observation: the stored
 * observations keep each source's own team and match keys (research value format, T10-A1-06), and the evidence of
 * the facts API serves canonical `FactValue`s with slug team IDs.
 */
import {
  DataModeSchema,
  DisputeOutcomeSchema,
  FactKindSchema,
  FactValueSchema,
  FailureSchema,
  MatchKeySchema,
  SlugSchema,
  SourceIdSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

import {
  type Db,
  readJsonColumn,
  readNullableJsonColumn,
  toSqlBoolean,
  writeJsonColumn,
} from '../../platform/db/index.js';
import { type ResearchObservationValue, ResearchObservationValueSchema } from '../research/index.js';
import { type ConfigSnapshot, ConfigSnapshotSchema } from '../../workflow/index.js';

import { canonicalJson } from './decision.js';

export const StoredSubjectSchema = z.strictObject({
  matchKey: MatchKeySchema.optional(),
  teamId: SlugSchema.optional(),
  contextIndex: z.int().min(0).optional(),
  evidence: z.array(z.strictObject({ observationId: UuidSchema, value: FactValueSchema })).max(64),
});
export type StoredSubject = z.infer<typeof StoredSubjectSchema>;

export const SourceValuesSchema = z
  .array(z.strictObject({ sourceId: SourceIdSchema, independenceGroup: z.string().max(64), value: FactValueSchema }))
  .max(64);

const SQL = {
  project:
    'SELECT id, competition_id, season_id, stage_id, matchday, source_id, data_mode, selection_ref, language ' +
    'FROM projects WHERE id = ?',
  runOfProject:
    'SELECT id, project_id, run_number, kind, status, config_snapshot FROM workflow_runs WHERE id = ? AND project_id = ?',
  run: 'SELECT id, project_id, run_number, kind, status, config_snapshot FROM workflow_runs WHERE id = ?',
  latestCompletedFullRun:
    "SELECT id FROM workflow_runs WHERE project_id = ? AND kind = 'full' AND status = 'completed' " +
    'ORDER BY run_number DESC LIMIT 1',
  previousCompletedFullRun:
    "SELECT id FROM workflow_runs WHERE project_id = ? AND kind = 'full' AND status = 'completed' AND run_number < ? " +
    'ORDER BY run_number DESC LIMIT 1',
  approvedFactsOfRun:
    'SELECT f.id AS id, f.fact_key AS fact_key, f.candidate_value AS candidate_value, ' +
    '(SELECT m.action FROM manual_approvals m WHERE m.fact_id = f.id ORDER BY m.at DESC, m.rowid DESC LIMIT 1) ' +
    'AS action FROM facts f WHERE f.run_id = ? AND f.manual_eligible = 1 ORDER BY f.rowid',
  insertRetrieval:
    'INSERT INTO retrievals (id, run_id, source_id, data_mode, stage, resource, retrieved_at, from_cache, outcome, ' +
    "failure, import_version_id) VALUES (?, ?, ?, ?, ?, 'selection', ?, ?, ?, ?, ?)",
  insertObservation:
    'INSERT INTO observations (id, run_id, retrieval_id, source_id, data_mode, import_version_id, stage, fact_key, ' +
    'value, source_ref, retrieved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  insertTeam: 'INSERT OR IGNORE INTO teams (id, competition_id, season_id) VALUES (?, ?, ?)',
  insertAlias: 'INSERT OR IGNORE INTO team_aliases (team_id, source_id, alias, origin) VALUES (?, ?, ?, ?)',
  insertFact:
    'INSERT INTO facts (id, run_id, fact_key, kind, subject, status, unverified_reason, value, candidate_value, ' +
    'manual_eligible, reason, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  insertEvidence: 'INSERT INTO fact_evidence (fact_id, observation_id, relation) VALUES (?, ?, ?)',
  insertDispute:
    'INSERT INTO disputes (id, fact_id, source_values, consulted_source_id, consulted_observation_id, consulted_at, ' +
    'outcome, resolved_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  insertApproval:
    'INSERT INTO manual_approvals (id, fact_id, action, carried_over_from_fact_id, at) VALUES (?, ?, ?, ?, ?)',
  factsOfRun:
    'SELECT id, fact_key, kind, subject, status, unverified_reason, value, candidate_value, manual_eligible, reason ' +
    'FROM facts WHERE run_id = ? ORDER BY rowid',
  factOfRun:
    'SELECT id, fact_key, kind, subject, status, unverified_reason, value, candidate_value, manual_eligible, reason ' +
    'FROM facts WHERE id = ? AND run_id = ?',
  evidenceOfRun:
    'SELECT e.fact_id AS fact_id, e.relation AS relation, o.id AS observation_id, o.source_id AS source_id, ' +
    'o.data_mode AS data_mode, o.source_ref AS source_ref, o.retrieved_at AS retrieved_at, ' +
    'o.import_version_id AS import_version_id FROM fact_evidence e JOIN facts f ON f.id = e.fact_id ' +
    'JOIN observations o ON o.id = e.observation_id WHERE f.run_id = ? ORDER BY f.rowid, o.rowid',
  evidenceOfFact:
    'SELECT e.fact_id AS fact_id, e.relation AS relation, o.id AS observation_id, o.source_id AS source_id, ' +
    'o.data_mode AS data_mode, o.source_ref AS source_ref, o.retrieved_at AS retrieved_at, ' +
    'o.import_version_id AS import_version_id FROM fact_evidence e JOIN observations o ON o.id = e.observation_id ' +
    'WHERE e.fact_id = ? ORDER BY o.rowid',
  disputesOfRun:
    'SELECT d.fact_id AS fact_id, d.source_values AS source_values, d.consulted_source_id AS consulted_source_id, ' +
    'd.consulted_at AS consulted_at, d.outcome AS outcome, d.resolved_value AS resolved_value FROM disputes d ' +
    'JOIN facts f ON f.id = d.fact_id WHERE f.run_id = ?',
  disputeOfFact:
    'SELECT fact_id, source_values, consulted_source_id, consulted_at, outcome, resolved_value FROM disputes ' +
    'WHERE fact_id = ?',
  approvalsOfRun:
    'SELECT m.fact_id AS fact_id, m.action AS action, m.carried_over_from_fact_id AS carried_over_from_fact_id, ' +
    'm.at AS at FROM manual_approvals m JOIN facts f ON f.id = m.fact_id WHERE f.run_id = ? ORDER BY m.at, m.rowid',
  approvalsOfFact:
    'SELECT fact_id, action, carried_over_from_fact_id, at FROM manual_approvals WHERE fact_id = ? ORDER BY at, rowid',
  invalidateFinalApprovals:
    'UPDATE final_approvals SET invalidated_at = ? WHERE invalidated_at IS NULL AND carousel_id IN (' +
    'SELECT e.carousel_id FROM element_fact_refs r JOIN element_versions v ON v.id = r.element_version_id ' +
    'JOIN elements e ON e.id = v.element_id WHERE r.fact_id = ?)',
} as const;

export interface ProjectRow {
  readonly id: string;
  readonly competitionId: string;
  readonly seasonId: string;
  readonly stageId: string;
  readonly matchday: number | null;
  readonly sourceId: string;
  readonly dataMode: z.infer<typeof DataModeSchema>;
  readonly selectionRef: string;
  readonly language: 'es' | 'en';
}

export interface RunRow {
  readonly id: string;
  readonly projectId: string;
  readonly runNumber: number;
  readonly kind: 'full' | 'redraft';
  readonly status: string;
  readonly snapshot: ConfigSnapshot;
}

export interface FactRow {
  readonly id: string;
  readonly factKey: string;
  readonly kind: z.infer<typeof FactKindSchema>;
  readonly subject: StoredSubject;
  readonly status: 'verified' | 'unverified';
  readonly unverifiedReason:
    'awaiting_independent_verification' | 'disputed' | 'no_accepted_source' | 'team_identity_unmatched' | null;
  readonly value: z.infer<typeof FactValueSchema> | null;
  readonly candidateValue: z.infer<typeof FactValueSchema> | null;
  readonly manualEligible: boolean;
  readonly reason: string | null;
}

export interface EvidenceRow {
  readonly factId: string;
  readonly relation: 'supports' | 'disagrees' | 'consulted';
  readonly observationId: string;
  readonly sourceId: string;
  readonly dataMode: z.infer<typeof DataModeSchema>;
  readonly sourceRef: string;
  readonly retrievedAt: string;
  readonly importVersionId: string | null;
}

export interface DisputeRow {
  readonly factId: string;
  readonly sourceValues: z.infer<typeof SourceValuesSchema>;
  readonly consultedSourceId: string | null;
  readonly consultedAt: string | null;
  readonly outcome: z.infer<typeof DisputeOutcomeSchema>;
  readonly resolvedValue: z.infer<typeof FactValueSchema> | null;
}

export interface ApprovalRow {
  readonly factId: string;
  readonly action: 'approved' | 'revoked';
  readonly carriedOverFromFactId: string | null;
  readonly at: string;
}

export interface NewRetrieval {
  readonly id: string;
  readonly sourceId: string;
  readonly dataMode: z.infer<typeof DataModeSchema>;
  readonly stage: 'verification' | 'consultation';
  readonly retrievedAt: string;
  readonly fromCache: boolean;
  readonly outcome: 'ok' | 'failed' | 'not_available';
  readonly failure: z.infer<typeof FailureSchema> | null;
  readonly importVersionId: string | null;
}

export interface NewObservation {
  readonly id: string;
  readonly retrievalId: string;
  readonly sourceId: string;
  readonly dataMode: z.infer<typeof DataModeSchema>;
  readonly importVersionId: string | null;
  readonly stage: 'verification' | 'consultation';
  readonly factKey: string;
  readonly value: ResearchObservationValue;
  readonly sourceRef: string;
  readonly retrievedAt: string;
}

const UnverifiedReasonColumn = z
  .enum(['awaiting_independent_verification', 'disputed', 'no_accepted_source', 'team_identity_unmatched'])
  .nullable();

type Row = Record<string, unknown>;

function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('a stored text column is not text');
  }
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function toFactRow(row: Row): FactRow {
  return {
    id: text(row['id']),
    factKey: text(row['fact_key']),
    kind: FactKindSchema.parse(row['kind']),
    subject: readJsonColumn(StoredSubjectSchema, row['subject'], 'subject'),
    status: z.enum(['verified', 'unverified']).parse(row['status']),
    unverifiedReason: UnverifiedReasonColumn.parse(row['unverified_reason']),
    value: readNullableJsonColumn(FactValueSchema, row['value'], 'value'),
    candidateValue: readNullableJsonColumn(FactValueSchema, row['candidate_value'], 'candidate_value'),
    manualEligible: row['manual_eligible'] === 1,
    reason: nullableText(row['reason']),
  };
}

function toEvidenceRow(row: Row): EvidenceRow {
  return {
    factId: text(row['fact_id']),
    relation: z.enum(['supports', 'disagrees', 'consulted']).parse(row['relation']),
    observationId: text(row['observation_id']),
    sourceId: text(row['source_id']),
    dataMode: DataModeSchema.parse(row['data_mode']),
    sourceRef: text(row['source_ref']),
    retrievedAt: text(row['retrieved_at']),
    importVersionId: nullableText(row['import_version_id']),
  };
}

function toDisputeRow(row: Row): DisputeRow {
  return {
    factId: text(row['fact_id']),
    sourceValues: readJsonColumn(SourceValuesSchema, row['source_values'], 'source_values'),
    consultedSourceId: nullableText(row['consulted_source_id']),
    consultedAt: nullableText(row['consulted_at']),
    outcome: DisputeOutcomeSchema.parse(row['outcome']),
    resolvedValue: readNullableJsonColumn(FactValueSchema, row['resolved_value'], 'resolved_value'),
  };
}

function toApprovalRow(row: Row): ApprovalRow {
  return {
    factId: text(row['fact_id']),
    action: z.enum(['approved', 'revoked']).parse(row['action']),
    carriedOverFromFactId: nullableText(row['carried_over_from_fact_id']),
    at: text(row['at']),
  };
}

function toRunRow(row: Row): RunRow {
  return {
    id: text(row['id']),
    projectId: text(row['project_id']),
    runNumber: Number(row['run_number']),
    kind: z.enum(['full', 'redraft']).parse(row['kind']),
    status: text(row['status']),
    snapshot: readJsonColumn(ConfigSnapshotSchema, row['config_snapshot'], 'config_snapshot'),
  };
}

/** Persistence of the verification stage and the facts routes over the `Db` port. */
export class VerificationRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  project(projectId: string): ProjectRow | null {
    const row = this.#db.prepare<Row>(SQL.project).get([projectId]);
    if (row === undefined) {
      return null;
    }
    return {
      id: text(row['id']),
      competitionId: text(row['competition_id']),
      seasonId: text(row['season_id']),
      stageId: text(row['stage_id']),
      matchday: row['matchday'] === null ? null : Number(row['matchday']),
      sourceId: text(row['source_id']),
      dataMode: DataModeSchema.parse(row['data_mode']),
      selectionRef: text(row['selection_ref']),
      language: z.enum(['es', 'en']).parse(row['language']),
    };
  }

  run(runId: string): RunRow | null {
    const row = this.#db.prepare<Row>(SQL.run).get([runId]);
    return row === undefined ? null : toRunRow(row);
  }

  runOfProject(projectId: string, runId: string): RunRow | null {
    const row = this.#db.prepare<Row>(SQL.runOfProject).get([runId, projectId]);
    return row === undefined ? null : toRunRow(row);
  }

  latestCompletedFullRunId(projectId: string): string | null {
    const row = this.#db.prepare<{ id: string }>(SQL.latestCompletedFullRun).get([projectId]);
    return row?.id ?? null;
  }

  /** Manually approved, eligible facts of the project's previous completed full run (carry-over, R-068, R-278). */
  previousApprovals(
    projectId: string,
    runNumber: number,
  ): { factId: string; factKey: string; candidateValue: string }[] {
    const previous = this.#db.prepare<{ id: string }>(SQL.previousCompletedFullRun).get([projectId, runNumber]);
    if (previous === undefined) {
      return [];
    }
    return this.#db
      .prepare<Row>(SQL.approvedFactsOfRun)
      .all([previous.id])
      .filter((row) => row['action'] === 'approved' && typeof row['candidate_value'] === 'string')
      .map((row) => ({
        factId: text(row['id']),
        factKey: text(row['fact_key']),
        candidateValue: canonicalJson(readJsonColumn(FactValueSchema, row['candidate_value'], 'candidate_value')),
      }));
  }

  insertRetrieval(runId: string, retrieval: NewRetrieval): void {
    this.#db
      .prepare(SQL.insertRetrieval)
      .run([
        retrieval.id,
        runId,
        retrieval.sourceId,
        retrieval.dataMode,
        retrieval.stage,
        retrieval.retrievedAt,
        toSqlBoolean(retrieval.fromCache),
        retrieval.outcome,
        retrieval.failure === null ? null : writeJsonColumn(FailureSchema, retrieval.failure, 'failure'),
        retrieval.importVersionId,
      ]);
  }

  insertObservation(runId: string, observation: NewObservation): void {
    this.#db
      .prepare(SQL.insertObservation)
      .run([
        observation.id,
        runId,
        observation.retrievalId,
        observation.sourceId,
        observation.dataMode,
        observation.importVersionId,
        observation.stage,
        observation.factKey,
        writeJsonColumn(ResearchObservationValueSchema, observation.value, 'value'),
        observation.sourceRef,
        observation.retrievedAt,
      ]);
  }

  insertTeam(teamId: string, competitionId: string, seasonId: string): void {
    this.#db.prepare(SQL.insertTeam).run([teamId, competitionId, seasonId]);
  }

  insertAlias(teamId: string, sourceId: string | null, alias: string): void {
    this.#db.prepare(SQL.insertAlias).run([teamId, sourceId, alias, sourceId === null ? 'identity_map' : 'source']);
  }

  insertFact(
    runId: string,
    fact: {
      readonly id: string;
      readonly factKey: string;
      readonly kind: string;
      readonly subject: StoredSubject;
      readonly status: 'verified' | 'unverified';
      readonly unverifiedReason: string | null;
      readonly value: unknown;
      readonly candidateValue: unknown;
      readonly manualEligible: boolean;
      readonly reason: string;
    },
    decidedAt: string,
  ): void {
    this.#db
      .prepare(SQL.insertFact)
      .run([
        fact.id,
        runId,
        fact.factKey,
        fact.kind,
        writeJsonColumn(StoredSubjectSchema, fact.subject, 'subject'),
        fact.status,
        fact.unverifiedReason,
        fact.value === null ? null : writeJsonColumn(FactValueSchema, fact.value, 'value'),
        fact.candidateValue === null ? null : writeJsonColumn(FactValueSchema, fact.candidateValue, 'candidate_value'),
        toSqlBoolean(fact.manualEligible),
        fact.reason,
        decidedAt,
      ]);
  }

  insertEvidence(factId: string, observationId: string, relation: string): void {
    this.#db.prepare(SQL.insertEvidence).run([factId, observationId, relation]);
  }

  insertDispute(dispute: {
    readonly id: string;
    readonly factId: string;
    readonly sourceValues: unknown;
    readonly consultedSourceId: string | null;
    readonly consultedObservationId: string | null;
    readonly consultedAt: string | null;
    readonly outcome: string;
    readonly resolvedValue: unknown;
  }): void {
    this.#db
      .prepare(SQL.insertDispute)
      .run([
        dispute.id,
        dispute.factId,
        writeJsonColumn(SourceValuesSchema, dispute.sourceValues, 'source_values'),
        dispute.consultedSourceId,
        dispute.consultedObservationId,
        dispute.consultedAt,
        dispute.outcome,
        dispute.resolvedValue === null
          ? null
          : writeJsonColumn(FactValueSchema, dispute.resolvedValue, 'resolved_value'),
      ]);
  }

  insertApproval(
    id: string,
    factId: string,
    action: 'approved' | 'revoked',
    carriedOverFromFactId: string | null,
    at: string,
  ): void {
    this.#db.prepare(SQL.insertApproval).run([id, factId, action, carriedOverFromFactId, at]);
  }

  /** Invalidates the open final approvals of carousels whose element versions use the fact; returns the count. */
  invalidateFinalApprovalsUsing(factId: string, at: string): number {
    return this.#db.prepare(SQL.invalidateFinalApprovals).run([at, factId]).changes;
  }

  facts(runId: string): FactRow[] {
    return this.#db.prepare<Row>(SQL.factsOfRun).all([runId]).map(toFactRow);
  }

  fact(runId: string, factId: string): FactRow | null {
    const row = this.#db.prepare<Row>(SQL.factOfRun).get([factId, runId]);
    return row === undefined ? null : toFactRow(row);
  }

  evidence(runId: string): EvidenceRow[] {
    return this.#db.prepare<Row>(SQL.evidenceOfRun).all([runId]).map(toEvidenceRow);
  }

  evidenceOfFact(factId: string): EvidenceRow[] {
    return this.#db.prepare<Row>(SQL.evidenceOfFact).all([factId]).map(toEvidenceRow);
  }

  disputes(runId: string): DisputeRow[] {
    return this.#db.prepare<Row>(SQL.disputesOfRun).all([runId]).map(toDisputeRow);
  }

  disputeOfFact(factId: string): DisputeRow | null {
    const row = this.#db.prepare<Row>(SQL.disputeOfFact).get([factId]);
    return row === undefined ? null : toDisputeRow(row);
  }

  approvals(runId: string): ApprovalRow[] {
    return this.#db.prepare<Row>(SQL.approvalsOfRun).all([runId]).map(toApprovalRow);
  }

  approvalsOfFact(factId: string): ApprovalRow[] {
    return this.#db.prepare<Row>(SQL.approvalsOfFact).all([factId]).map(toApprovalRow);
  }
}
