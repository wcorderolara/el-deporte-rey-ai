/**
 * The "blocked" overlay of drafted content (architecture.md sections 7.4, 8.3 and 11.1; AD-28, AD-38; R-026, R-271,
 * R-272; OD-29).
 *
 * "Blocked" is derived, never stored: it is recomputed at read and approval time from the publishability of every
 * fact an element version references (`element_fact_refs`), so a revoked manual approval or a stricter policy blocks
 * content again. The publishability function is injected (`PublishabilityFunction`). The verification module
 * (T30) owns the canonical function; until it exports one, `storedFactsPublishability` applies the rules of
 * architecture.md section 7.4 to the stored facts:
 * - `verified` without a supporting LIVE_DATA observation: publishable. `verified` with LIVE_DATA support: publishable
 *   only when every supporting LIVE_DATA source has `publicationPermission: confirmed` in the current configuration
 *   (rule `every_supporting_source`, PD-18), otherwise `publication_permission_unconfirmed` (R-271, R-078);
 * - `manually_approved` (latest manual approval `approved` and the fact manually eligible): publishable only under
 *   `allowed_without_accepted_source` for a project whose competition is a catalogue link marked
 *   `noAcceptedPublicSource` that binds the project's source (PD-17, AD-38), otherwise
 *   `manually_approved_not_publishable` (R-272);
 * - `unverified` (including single-source candidate values, R-055, R-271): never publishable, `not_verified`.
 */
import type { BlockReason, FactRef, FactStatus, UnverifiedReason } from '@edr/contracts';
import {
  FactSubjectSchema,
  FactValueSchemasByKind,
  FactKindSchema,
  LanguageSchema,
  UnverifiedReasonSchema,
} from '@edr/contracts';

import type { z } from 'zod';

import type { AppConfig } from '../../platform/config/index.js';
import type { Db } from '../../platform/db/index.js';
import { readJsonColumn, readNullableJsonColumn } from '../../platform/db/index.js';
import { formatDate, formatScore, stageDisplay } from '../../platform/format/index.js';

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
  project: 'SELECT competition_id, source_id, language FROM projects WHERE id = ?',
  fact: 'SELECT id, status, unverified_reason, manual_eligible FROM facts WHERE id = ?',
  latestManualApproval: 'SELECT action FROM manual_approvals WHERE fact_id = ? ORDER BY at DESC, rowid DESC LIMIT 1',
  liveSupport:
    'SELECT DISTINCT o.source_id AS source_id FROM fact_evidence e JOIN observations o ON o.id = e.observation_id ' +
    "WHERE e.fact_id = ? AND e.relation = 'supports' AND o.data_mode = 'LIVE_DATA' ORDER BY o.source_id",
  versionProject:
    'SELECT d.project_id AS project_id, d.language AS language FROM element_versions v ' +
    'JOIN elements e ON e.id = v.element_id JOIN carousels c ON c.id = e.carousel_id ' +
    'JOIN content_drafts d ON d.id = c.draft_id WHERE v.id = ?',
  versionRefs: 'SELECT fact_id FROM element_fact_refs WHERE element_version_id = ? ORDER BY fact_id',
  factView: 'SELECT id, fact_key, kind, subject, value, candidate_value, reason FROM facts WHERE id = ?',
} as const;

interface ProjectRow {
  competition_id: string;
  source_id: string;
  language: string;
}

interface FactRow {
  id: string;
  status: string;
  unverified_reason: string | null;
  manual_eligible: number;
}

function verdict(
  factId: string,
  status: FactStatus,
  unverifiedReason: UnverifiedReason,
  blockReason: BlockReason | null,
): PublishabilityVerdict {
  return { factId, status, unverifiedReason, publishable: blockReason === null, blockReason };
}

/**
 * Interim publishability of stored facts (architecture.md section 7.4), used until the verification module exports
 * its function. An unknown fact is not publishable (`not_verified`).
 */
export const storedFactsPublishability: PublishabilityFunction = (context, projectId, factIds) => {
  const { db, config } = context;
  const result = new Map<string, PublishabilityVerdict>();
  const project = db.prepare<ProjectRow>(SQL.project).get([projectId]);
  const link = project === undefined ? undefined : config.catalogue.getLink(project.competition_id);
  const manualPublishable =
    project !== undefined &&
    config.verificationPolicy.manuallyApprovedPublication === 'allowed_without_accepted_source' &&
    link !== undefined &&
    link.noAcceptedPublicSource &&
    link.bindings.some((binding) => binding.sourceId === project.source_id);
  const permission = new Map(
    config.providers.sports.sources.map((source) => [source.id, source.publicationPermission]),
  );

  for (const factId of factIds) {
    const row = db.prepare<FactRow>(SQL.fact).get([factId]);
    if (row === undefined) {
      result.set(factId, verdict(factId, 'unverified', null, 'not_verified'));
      continue;
    }
    const reason = UnverifiedReasonSchema.parse(row.unverified_reason);
    if (row.status === 'verified') {
      const live = db
        .prepare<{ source_id: string }>(SQL.liveSupport)
        .all([factId])
        .map((support) => support.source_id);
      const confirmed = live.every((sourceId) => permission.get(sourceId) === 'confirmed');
      result.set(factId, verdict(factId, 'verified', null, confirmed ? null : 'publication_permission_unconfirmed'));
      continue;
    }
    const latest = db.prepare<{ action: string }>(SQL.latestManualApproval).get([factId]);
    if (row.manual_eligible === 1 && latest?.action === 'approved') {
      result.set(
        factId,
        verdict(factId, 'manually_approved', null, manualPublishable ? null : 'manually_approved_not_publishable'),
      );
      continue;
    }
    result.set(factId, verdict(factId, 'unverified', reason, 'not_verified'));
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
  subject: string;
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
  publishability: PublishabilityFunction = storedFactsPublishability,
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
  const verdicts = publishability(context, owner.project_id, factIds);
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
    readJsonColumn(FactSubjectSchema, row.subject, 'subject');
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
