/**
 * The "blocked" overlay of drafted content (architecture.md sections 7.4, 8.3 and 11.1; AD-28, AD-38; R-026, R-271,
 * R-272; OD-29, OD-49).
 *
 * "Blocked" is derived, never stored: it is recomputed at read and approval time from the publishability of every
 * fact an element version references (`element_fact_refs`), so a revoked manual approval or a stricter policy blocks
 * content again. The rules are not implemented here: `verificationPublishability` reads each fact's effective status
 * (`manually_approved` for a manually eligible fact whose latest manual approval row is `approved`) and the sources
 * and data modes of its `supports` evidence, and applies the verification module's single publishability function
 * (`publishability` with `publishabilitySettings` of the project under the current configuration). A fact that does
 * not exist is not publishable (`not_verified`).
 */
import type { BlockReason, FactRef, FactStatus, UnverifiedReason } from '@edr/contracts';
import {
  DataModeSchema,
  FactKindSchema,
  FactValueSchemasByKind,
  LanguageSchema,
  UnverifiedReasonSchema,
} from '@edr/contracts';
import type { z } from 'zod';

import type { AppConfig } from '../../platform/config/index.js';
import type { Db } from '../../platform/db/index.js';
import { readNullableJsonColumn } from '../../platform/db/index.js';
import { formatDate, formatScore, stageDisplay } from '../../platform/format/index.js';
import { publishability, publishabilitySettings } from '../verification/index.js';

import { standingRowCells } from './compose.js';

/** Publishability of one fact. */
export interface PublishabilityVerdict {
  readonly factId: string;
  /** Effective status (`manually_approved` derived from the manual approvals). */
  readonly status: FactStatus;
  readonly unverifiedReason: UnverifiedReason;
  readonly publishable: boolean;
  readonly blockReason: BlockReason | null;
}

export interface PublishabilityContext {
  readonly db: Db;
  readonly config: AppConfig;
}

/** Decides the publishability of facts of a project (architecture.md section 7.4). */
export type PublishabilityFunction = (
  context: PublishabilityContext,
  projectId: string,
  factIds: readonly string[],
) => ReadonlyMap<string, PublishabilityVerdict>;

const SQL = {
  project: 'SELECT competition_id, source_id FROM projects WHERE id = ?',
  fact: 'SELECT id, status, unverified_reason, manual_eligible FROM facts WHERE id = ?',
  latestManualApproval: 'SELECT action FROM manual_approvals WHERE fact_id = ? ORDER BY at DESC, rowid DESC LIMIT 1',
  supportingSources:
    'SELECT DISTINCT o.source_id AS source_id, o.data_mode AS data_mode FROM fact_evidence e ' +
    "JOIN observations o ON o.id = e.observation_id WHERE e.fact_id = ? AND e.relation = 'supports' " +
    'ORDER BY o.source_id',
  versionProject:
    'SELECT d.project_id AS project_id, d.language AS language FROM element_versions v ' +
    'JOIN elements e ON e.id = v.element_id JOIN carousels c ON c.id = e.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE v.id = ?',
  versionRefs: 'SELECT fact_id FROM element_fact_refs WHERE element_version_id = ? ORDER BY fact_id',
  factView: 'SELECT id, fact_key, kind, value, candidate_value, reason FROM facts WHERE id = ?',
} as const;

interface ProjectRow {
  competition_id: string;
  source_id: string;
}

interface FactRow {
  id: string;
  status: string;
  unverified_reason: string | null;
  manual_eligible: number;
}

/**
 * Publishability of stored facts through the verification module's function (one implementation of the rules,
 * OD-49). The settings are those of the project under the current configuration.
 */
export const verificationPublishability: PublishabilityFunction = (context, projectId, factIds) => {
  const { db, config } = context;
  const result = new Map<string, PublishabilityVerdict>();
  const project = db.prepare<ProjectRow>(SQL.project).get([projectId]);
  const settings =
    project === undefined
      ? null
      : publishabilitySettings(config, { competitionId: project.competition_id, sourceId: project.source_id });

  for (const factId of factIds) {
    const row = db.prepare<FactRow>(SQL.fact).get([factId]);
    if (row === undefined || settings === null) {
      result.set(factId, {
        factId,
        status: 'unverified',
        unverifiedReason: null,
        publishable: false,
        blockReason: 'not_verified',
      });
      continue;
    }
    const latest = db.prepare<{ action: string }>(SQL.latestManualApproval).get([factId]);
    const status: FactStatus =
      row.status === 'verified'
        ? 'verified'
        : row.manual_eligible === 1 && latest?.action === 'approved'
          ? 'manually_approved'
          : 'unverified';
    const supportingSources = db
      .prepare<{ source_id: string; data_mode: string }>(SQL.supportingSources)
      .all([factId])
      .map((support) => ({ sourceId: support.source_id, dataMode: DataModeSchema.parse(support.data_mode) }));
    const decision = publishability({ status, supportingSources }, settings);
    result.set(factId, {
      factId,
      status,
      unverifiedReason: status === 'unverified' ? UnverifiedReasonSchema.parse(row.unverified_reason) : null,
      publishable: decision.publishable,
      blockReason: decision.blockReason,
    });
  }
  return result;
};

// ---------------------------------------------------------------------------------------------------------------
// Overlay of an element version
// ---------------------------------------------------------------------------------------------------------------

export interface BlockedOverlay {
  /** True when a referenced fact is not publishable. */
  readonly blocked: boolean;
  /** The facts that block, with status, unverified reason and block reason (contract `FactRef`). */
  readonly blockingFacts: FactRef[];
}

interface FactViewRow {
  id: string;
  fact_key: string;
  kind: string;
  value: string | null;
  candidate_value: string | null;
  reason: string | null;
}

const PRINTABLE_REASON = /^[^\p{Cc}\p{Cf}]{1,300}$/u;

/** The deterministic display form of a stored fact's verified or candidate value, where the kind has one. */
function displayOf(row: FactViewRow, language: 'es' | 'en', utcOffsetMinutes: number): string | null {
  const kind = FactKindSchema.parse(row.kind);
  const schema: z.ZodType<unknown> = FactValueSchemasByKind[kind];
  const value: unknown =
    readNullableJsonColumn(schema, row.value, 'value') ??
    readNullableJsonColumn(schema, row.candidate_value, 'candidate_value');
  if (value === null) {
    return null;
  }
  switch (kind) {
    case 'match_score':
      return formatScore(FactValueSchemasByKind.match_score.parse(value));
    case 'match_kickoff':
      return formatDate(FactValueSchemasByKind.match_kickoff.parse(value).kickoff, language, utcOffsetMinutes);
    case 'team_official_name':
      return FactValueSchemasByKind.team_official_name.parse(value).officialName;
    case 'standing_row':
      return standingRowCells(FactValueSchemasByKind.standing_row.parse(value)).join(' ');
    case 'matchday_info': {
      const info = FactValueSchemasByKind.matchday_info.parse(value);
      return stageDisplay(info.stageLabel, info.matchdayNumber, language);
    }
    case 'match_status':
      return FactValueSchemasByKind.match_status.parse(value).matchStatus;
    default:
      return null;
  }
}

/**
 * The blocked overlay of an element version: every referenced fact that is not publishable, as a contract
 * `FactRef`. A version that does not exist has no overlay (null).
 */
export function blockedOverlay(
  context: PublishabilityContext,
  versionId: string,
  decide: PublishabilityFunction = verificationPublishability,
): BlockedOverlay | null {
  const { db, config } = context;
  const owner = db.prepare<{ project_id: string; language: string }>(SQL.versionProject).get([versionId]);
  if (owner === undefined) {
    return null;
  }
  const language = LanguageSchema.parse(owner.language);
  const factIds = db
    .prepare<{ fact_id: string }>(SQL.versionRefs)
    .all([versionId])
    .map((row) => row.fact_id);
  const verdicts = decide(context, owner.project_id, factIds);
  const blockingFacts: FactRef[] = [];
  for (const factId of factIds) {
    const decision = verdicts.get(factId);
    if (decision === undefined || decision.publishable) {
      continue;
    }
    const row = db.prepare<FactViewRow>(SQL.factView).get([factId]);
    if (row === undefined) {
      continue;
    }
    const reference: FactRef = {
      factId,
      factKey: row.fact_key.slice(0, 200),
      kind: FactKindSchema.parse(row.kind),
      status: decision.status,
      unverifiedReason: decision.unverifiedReason,
      reason: row.reason !== null && PRINTABLE_REASON.test(row.reason) ? row.reason : null,
      display: displayOf(row, language, config.display.utcOffsetMinutes),
    };
    if (decision.blockReason !== null) {
      reference.blockReason = decision.blockReason;
    }
    blockingFacts.push(reference);
  }
  return { blocked: blockingFacts.length > 0, blockingFacts };
}
