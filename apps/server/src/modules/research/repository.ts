/**
 * Research persistence (data-model.md sections 3.1 and 3.2; AD-34): reads the project's selection, writes the
 * `retrievals` row, the `observations` and `workflow_runs.standings_availability`, and reads them back for the
 * verification stage and the tests. Every statement is a constant with bound parameters (T10-F14); JSON columns are
 * validated on write and read; failures are stored only as the closed `Failure` (T10-F10).
 */
import { DataModeSchema, FailureSchema } from '@edr/contracts';

import { type Db, readJsonColumn, readNullableJsonColumn, writeJsonColumn } from '../../platform/db/index.js';

import {
  type ResearchInput,
  type ResearchObservation,
  type ResearchObservationValue,
  ResearchObservationValueSchema,
  type ResearchRetrieval,
  RETRIEVAL_OUTCOMES,
  type StandingsAvailability,
  StandingsAvailabilitySchema,
} from './core.js';

/** The research stage name in `retrievals.stage` and `observations.stage`. */
const STAGE = 'research';

const SQL = {
  projectSelection: 'SELECT id, source_id, data_mode, selection_ref FROM projects WHERE id = ?',
  insertRetrieval:
    'INSERT INTO retrievals (id, run_id, source_id, data_mode, stage, resource, retrieved_at, from_cache, outcome, ' +
    'failure, import_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  insertObservation:
    'INSERT INTO observations (id, run_id, retrieval_id, source_id, data_mode, import_version_id, stage, fact_key, ' +
    'value, source_ref, retrieved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  setStandingsAvailability: 'UPDATE workflow_runs SET standings_availability = ? WHERE id = ?',
  standingsAvailability: 'SELECT standings_availability FROM workflow_runs WHERE id = ?',
  retrievalsOfRun:
    'SELECT id, source_id, data_mode, resource, retrieved_at, from_cache, outcome, failure, import_version_id ' +
    'FROM retrievals WHERE run_id = ? AND stage = ? ORDER BY rowid',
  observationsOfRun:
    'SELECT id, retrieval_id, source_id, data_mode, import_version_id, fact_key, value, source_ref, retrieved_at ' +
    'FROM observations WHERE run_id = ? AND stage = ? ORDER BY rowid',
} as const;

interface ProjectSelectionRow {
  id: string;
  source_id: string;
  data_mode: string;
  selection_ref: string;
}

interface RetrievalRow {
  id: string;
  source_id: string;
  data_mode: string;
  resource: string;
  retrieved_at: string;
  from_cache: number;
  outcome: string;
  failure: string | null;
  import_version_id: string | null;
}

interface ObservationRow {
  id: string;
  retrieval_id: string;
  source_id: string;
  data_mode: string;
  import_version_id: string | null;
  fact_key: string;
  value: string;
  source_ref: string;
  retrieved_at: string;
}

/** A stored research retrieval. */
export interface StoredRetrieval {
  readonly id: string;
  readonly sourceId: string;
  readonly dataMode: ResearchRetrieval['dataMode'];
  readonly resource: string;
  readonly retrievedAt: string;
  readonly fromCache: boolean;
  readonly outcome: ResearchRetrieval['outcome'];
  readonly failure: ResearchRetrieval['failure'];
  readonly importVersionId: string | null;
}

/** A stored research observation with its attribution (R-024, R-204, R-287). */
export interface StoredObservation {
  readonly id: string;
  readonly retrievalId: string;
  readonly sourceId: string;
  readonly dataMode: ResearchRetrieval['dataMode'];
  readonly importVersionId: string | null;
  readonly factKey: string;
  readonly value: ResearchObservationValue;
  readonly sourceRef: string;
  readonly retrievedAt: string;
}

function outcomeOf(value: string): ResearchRetrieval['outcome'] {
  const outcome = RETRIEVAL_OUTCOMES.find((candidate) => candidate === value);
  if (outcome === undefined) {
    throw new Error('stored retrieval outcome is not a known outcome');
  }
  return outcome;
}

/** Persistence of the research stage over the `Db` port. */
export class ResearchRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** The stored selection of a project (unvalidated; the stage validates it with its input schema), or null. */
  projectSelection(projectId: string): Record<keyof ResearchInput, unknown> | null {
    const row = this.#db.prepare<ProjectSelectionRow>(SQL.projectSelection).get([projectId]);
    return row === undefined
      ? null
      : { projectId: row.id, sourceId: row.source_id, dataMode: row.data_mode, selectionRef: row.selection_ref };
  }

  /** Inserts the run's retrieval row. Call inside a transaction. */
  insertRetrieval(id: string, runId: string, retrieval: ResearchRetrieval): void {
    this.#db
      .prepare(SQL.insertRetrieval)
      .run([
        id,
        runId,
        retrieval.sourceId,
        retrieval.dataMode,
        STAGE,
        retrieval.resource,
        retrieval.retrievedAt,
        retrieval.fromCache ? 1 : 0,
        retrieval.outcome,
        retrieval.failure === null ? null : writeJsonColumn(FailureSchema, retrieval.failure, 'failure'),
        retrieval.importVersionId,
      ]);
  }

  /** Inserts one observation of the retrieval. Call inside a transaction. */
  insertObservation(id: string, runId: string, retrievalId: string, observation: ResearchObservation): void {
    this.#db
      .prepare(SQL.insertObservation)
      .run([
        id,
        runId,
        retrievalId,
        observation.sourceId,
        observation.dataMode,
        observation.importVersionId,
        STAGE,
        observation.factKey,
        writeJsonColumn(ResearchObservationValueSchema, observation.value, 'value'),
        observation.sourceRef,
        observation.retrievedAt,
      ]);
  }

  /** Records the standings availability on the run (R-254). Call inside a transaction. */
  setStandingsAvailability(runId: string, standings: StandingsAvailability): void {
    const stored = writeJsonColumn(StandingsAvailabilitySchema, standings, 'standings_availability');
    if (this.#db.prepare(SQL.setStandingsAvailability).run([stored, runId]).changes !== 1) {
      throw new Error('the run of the research stage was not found');
    }
  }

  /** The standings availability recorded on a run, or null when research did not record one. */
  standingsAvailability(runId: string): StandingsAvailability | null {
    const row = this.#db.prepare<{ standings_availability: string | null }>(SQL.standingsAvailability).get([runId]);
    return row === undefined
      ? null
      : readNullableJsonColumn(StandingsAvailabilitySchema, row.standings_availability, 'standings_availability');
  }

  /** The research retrievals of a run, in insertion order. */
  retrievals(runId: string): StoredRetrieval[] {
    return this.#db
      .prepare<RetrievalRow>(SQL.retrievalsOfRun)
      .all([runId, STAGE])
      .map((row) => ({
        id: row.id,
        sourceId: row.source_id,
        dataMode: DataModeSchema.parse(row.data_mode),
        resource: row.resource,
        retrievedAt: row.retrieved_at,
        fromCache: row.from_cache === 1,
        outcome: outcomeOf(row.outcome),
        failure: readNullableJsonColumn(FailureSchema, row.failure, 'failure'),
        importVersionId: row.import_version_id,
      }));
  }

  /** The research observations of a run with their attribution, in insertion order (validated on read). */
  observations(runId: string): StoredObservation[] {
    return this.#db
      .prepare<ObservationRow>(SQL.observationsOfRun)
      .all([runId, STAGE])
      .map((row) => ({
        id: row.id,
        retrievalId: row.retrieval_id,
        sourceId: row.source_id,
        dataMode: DataModeSchema.parse(row.data_mode),
        importVersionId: row.import_version_id,
        factKey: row.fact_key,
        value: readJsonColumn(ResearchObservationValueSchema, row.value, 'value'),
        sourceRef: row.source_ref,
        retrievedAt: row.retrieved_at,
      }));
  }
}
