import { randomUUID } from 'node:crypto';
import type { Db } from '../../platform/db/db.js';

export type SportsEntityType = 'season' | 'team' | 'stage' | 'round' | 'match' | 'result';
export type ProvenanceValue = string | number | boolean | null;

export interface FieldProvenance {
  field: string;
  origin: 'manual' | 'provider' | 'manual_override';
  providerKey: string | null;
  externalReference: string | null;
  providerValue: ProvenanceValue | undefined;
  protected: boolean;
  lastApplicationId: string | null;
  updatedAt: string;
}

interface MappingRow {
  competition_id: string;
  provider_key: string;
  external_id: string;
  baseline_json: string | null;
  last_application_id: string | null;
}

interface ProvenanceRow {
  field_name: string;
  origin: FieldProvenance['origin'];
  provider_key: string | null;
  external_reference: string | null;
  provider_value_json: string | null;
  provider_value_present: number;
  manual_override: number;
  last_application_id: string | null;
  updated_at: string;
}

const resourceOf = (entityType: SportsEntityType) =>
  entityType === 'team'
    ? 'teams'
    : entityType === 'stage'
      ? 'stages'
      : entityType === 'round'
        ? 'rounds'
        : entityType === 'result'
          ? 'matches'
          : entityType;

/** SQLite adapter for field provenance. Effective values remain in the existing sports tables. */
export class CompetitionFieldProvenanceService {
  constructor(
    readonly db: Db,
    readonly now: () => Date,
  ) {}

  list(competitionId: string, entityType: SportsEntityType, entityId: string): FieldProvenance[] {
    return this.db
      .prepare<ProvenanceRow>(
        'SELECT field_name, origin, provider_key, external_reference, provider_value_json, provider_value_present, manual_override, last_application_id, updated_at FROM sports_field_provenance WHERE competition_id = ? AND entity_type = ? AND entity_id = ? ORDER BY field_name',
      )
      .all([competitionId, entityType, entityId])
      .map((row) => ({
        field: row.field_name,
        origin: row.origin,
        providerKey: row.provider_key,
        externalReference: row.external_reference,
        providerValue: row.provider_value_present
          ? (JSON.parse(row.provider_value_json ?? 'null') as ProvenanceValue)
          : undefined,
        protected: row.manual_override === 1,
        lastApplicationId: row.last_application_id,
        updatedAt: row.updated_at,
      }));
  }

  protectedFields(competitionId: string, entityType: SportsEntityType, entityId: string): ReadonlySet<string> {
    return new Set(
      this.db
        .prepare<{ field_name: string }>(
          'SELECT field_name FROM sports_field_provenance WHERE competition_id = ? AND entity_type = ? AND entity_id = ? AND manual_override = 1',
        )
        .all([competitionId, entityType, entityId])
        .map((row) => row.field_name),
    );
  }

  recordManual(
    competitionId: string | null,
    entityType: SportsEntityType,
    entityId: string,
    fields: Readonly<Record<string, ProvenanceValue>>,
  ): void {
    const resource = resourceOf(entityType);
    const mappings = this.db
      .prepare<MappingRow>(
        `SELECT competition_id, provider_key, external_id, baseline_json, last_application_id
         FROM external_identity_mappings
         WHERE resource = ? AND local_id = ? AND competition_id IS NOT NULL
           AND (? IS NULL OR competition_id = ?)`,
      )
      .all([resource, entityId, competitionId, competitionId]);
    const targets = mappings.length
      ? mappings
      : competitionId
        ? [
            {
              competition_id: competitionId,
              provider_key: null,
              external_id: null,
              baseline_json: null,
              last_application_id: null,
            },
          ]
        : [];
    const at = this.now().toISOString();
    for (const target of targets) {
      const baseline = target.baseline_json
        ? (JSON.parse(target.baseline_json) as Record<string, ProvenanceValue>)
        : {};
      for (const field of Object.keys(fields)) {
        const previous = this.db
          .prepare<{ origin: string }>(
            'SELECT origin FROM sports_field_provenance WHERE competition_id = ? AND entity_type = ? AND entity_id = ? AND field_name = ?',
          )
          .get([target.competition_id, entityType, entityId, field]);
        const imported = Object.hasOwn(baseline, field) || target.provider_key !== null;
        const origin = imported ? 'manual_override' : 'manual';
        this.db
          .prepare(
            `INSERT INTO sports_field_provenance
           (competition_id, entity_type, entity_id, field_name, origin, provider_key, external_reference,
            provider_value_json, provider_value_present, manual_override, last_application_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (competition_id, entity_type, entity_id, field_name) DO UPDATE SET
             origin = excluded.origin, manual_override = excluded.manual_override, updated_at = excluded.updated_at,
             provider_key = COALESCE(sports_field_provenance.provider_key, excluded.provider_key),
             external_reference = COALESCE(sports_field_provenance.external_reference, excluded.external_reference)`,
          )
          .run([
            target.competition_id,
            entityType,
            entityId,
            field,
            origin,
            target.provider_key,
            target.external_id,
            Object.hasOwn(baseline, field) ? JSON.stringify(baseline[field]) : null,
            Object.hasOwn(baseline, field) ? 1 : 0,
            imported ? 1 : 0,
            target.last_application_id,
            at,
          ]);
        this.#event(
          target.competition_id,
          entityType,
          entityId,
          field,
          'manual_edit',
          previous?.origin ?? null,
          origin,
          Object.hasOwn(baseline, field) ? baseline[field]! : undefined,
          target.last_application_id,
          at,
        );
      }
    }
  }

  recordProvider(input: {
    competitionId: string;
    entityType: SportsEntityType;
    entityId: string;
    providerKey: string;
    externalReference: string;
    applicationId: string;
    values: Readonly<Record<string, ProvenanceValue>>;
  }): void {
    const at = this.now().toISOString();
    for (const [field, value] of Object.entries(input.values)) {
      const previous = this.db
        .prepare<{ origin: string; manual_override: number }>(
          'SELECT origin, manual_override FROM sports_field_provenance WHERE competition_id = ? AND entity_type = ? AND entity_id = ? AND field_name = ?',
        )
        .get([input.competitionId, input.entityType, input.entityId, field]);
      this.db
        .prepare(
          `INSERT INTO sports_field_provenance
         (competition_id, entity_type, entity_id, field_name, origin, provider_key, external_reference,
          provider_value_json, provider_value_present, manual_override, last_application_id, updated_at)
         VALUES (?, ?, ?, ?, 'provider', ?, ?, ?, 1, 0, ?, ?)
         ON CONFLICT (competition_id, entity_type, entity_id, field_name) DO UPDATE SET
           origin = 'provider', provider_key = excluded.provider_key, external_reference = excluded.external_reference,
           provider_value_json = excluded.provider_value_json, provider_value_present = 1, manual_override = 0,
           last_application_id = excluded.last_application_id, updated_at = excluded.updated_at`,
        )
        .run([
          input.competitionId,
          input.entityType,
          input.entityId,
          field,
          input.providerKey,
          input.externalReference,
          JSON.stringify(value),
          input.applicationId,
          at,
        ]);
      this.#event(
        input.competitionId,
        input.entityType,
        input.entityId,
        field,
        previous?.manual_override ? 'accept_provider' : 'provider_applied',
        previous?.origin ?? null,
        'provider',
        value,
        input.applicationId,
        at,
      );
    }
  }

  #event(
    competitionId: string,
    entityType: SportsEntityType,
    entityId: string,
    field: string,
    action: string,
    previousOrigin: string | null,
    nextOrigin: string,
    providerValue: ProvenanceValue | undefined,
    applicationId: string | null,
    at: string,
  ) {
    this.db
      .prepare(
        'INSERT INTO sports_field_provenance_events (id, competition_id, entity_type, entity_id, field_name, action, previous_origin, next_origin, provider_value_json, application_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run([
        randomUUID(),
        competitionId,
        entityType,
        entityId,
        field,
        action,
        previousOrigin,
        nextOrigin,
        providerValue === undefined ? null : JSON.stringify(providerValue),
        applicationId,
        at,
      ]);
  }
}
