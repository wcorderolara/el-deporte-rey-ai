/**
 * Facts service (contract operations listFacts, approveFactManually, revokeManualFactApproval; architecture.md
 * section 7.4; OD-17, OD-40, AD-28, AD-38; R-071, R-204, R-227, R-230, R-270, R-272, R-287, R-412).
 *
 * - The effective status of a fact is `verified` or `unverified` as decided by the verification stage, or
 *   `manually_approved` for an eligible MANUAL_DATA fact whose latest manual approval row is `approved`. Manual
 *   approval is never verification: the stored status stays `unverified`, and nothing here writes a fact status.
 * - Every fact carries its block reason when it is not publishable (`not_verified`,
 *   `manually_approved_not_publishable`, `publication_permission_unconfirmed`; OD-40), from the single
 *   publishability function under the current configuration.
 * - Approve and revoke run their guards and the write in one synchronous `BEGIN IMMEDIATE` transaction (T10-F15) and
 *   append an audit row to `manual_approvals` (never updated or deleted, OD-08). Refusals are `MANUAL_APPROVAL_REFUSED`
 *   with a closed `refusalReason`.
 */
import { randomUUID } from 'node:crypto';

import type {
  BlockReason,
  Evidence,
  Fact,
  FactListResponse,
  FactRef,
  LeftOutMatch,
  RefusalReason,
} from '@edr/contracts';

import type { AppContainer } from '../../container.js';
import { HttpProblem } from '../../platform/http/index.js';
import { ResearchRepository } from '../research/index.js';

import { counts } from './decision.js';
import { type DisplayContext, displayOf } from './display.js';
import { publishability, publishabilitySettings } from './publishability.js';
import {
  type ApprovalRow,
  type DisputeRow,
  type EvidenceRow,
  type FactRow,
  type ProjectRow,
  type RunRow,
  VerificationRepository,
} from './repository.js';

const MANUALLY_APPROVED_REASON = 'Manually approved by the operator (operator-attested); not verified.';

function notFound(detail: string): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', detail);
}

function refused(refusalReason: RefusalReason): HttpProblem {
  return new HttpProblem(409, 'MANUAL_APPROVAL_REFUSED', 'The manual approval request is refused.', {
    refusalReason,
  });
}

/** The latest audit row of each fact (the latest row decides, data-model.md section 3.2). */
function latestApprovals(rows: readonly ApprovalRow[]): Map<string, ApprovalRow> {
  const latest = new Map<string, ApprovalRow>();
  for (const row of rows) {
    latest.set(row.factId, row);
  }
  return latest;
}

/** Effective status (OD-17): `manually_approved` only for an eligible fact whose latest row is `approved`. */
export function isManuallyApproved(fact: FactRow, latest: ApprovalRow | undefined): boolean {
  return fact.status === 'unverified' && fact.manualEligible && latest?.action === 'approved';
}

interface RunView {
  readonly project: ProjectRow;
  readonly run: RunRow;
  readonly facts: readonly FactRow[];
  readonly evidence: ReadonlyMap<string, EvidenceRow[]>;
  readonly disputes: ReadonlyMap<string, DisputeRow>;
  readonly approvals: ReadonlyMap<string, ApprovalRow>;
}

function groupEvidence(rows: readonly EvidenceRow[]): Map<string, EvidenceRow[]> {
  const grouped = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.factId) ?? [];
    list.push(row);
    grouped.set(row.factId, list);
  }
  return grouped;
}

export interface VerificationServiceOptions {
  readonly container: AppContainer;
  readonly newId?: () => string;
}

export class VerificationService {
  readonly #container: AppContainer;
  readonly #repository: VerificationRepository;
  readonly #newId: () => string;

  constructor(options: VerificationServiceOptions) {
    this.#container = options.container;
    this.#repository = new VerificationRepository(options.container.db);
    this.#newId = options.newId ?? randomUUID;
  }

  #now(): string {
    return this.#container.clock.now().toISOString();
  }

  #projectAndRun(projectId: string, runId: string): { project: ProjectRow; run: RunRow } {
    const project = this.#repository.project(projectId);
    if (project === null) {
      throw notFound('The project does not exist.');
    }
    const run = this.#repository.runOfProject(projectId, runId);
    if (run === null) {
      throw notFound('The run does not exist for this project.');
    }
    return { project, run };
  }

  #view(projectId: string, runId: string): RunView {
    const { project, run } = this.#projectAndRun(projectId, runId);
    return {
      project,
      run,
      facts: this.#repository.facts(runId),
      evidence: groupEvidence(this.#repository.evidence(runId)),
      disputes: new Map(this.#repository.disputes(runId).map((row) => [row.factId, row])),
      approvals: latestApprovals(this.#repository.approvals(runId)),
    };
  }

  /** Builds contract facts from a run view. */
  #facts(view: RunView): Fact[] {
    const { project, run } = view;
    const sources = new Map(run.snapshot.sources.map((source) => [source.id, source]));
    const settings = publishabilitySettings(this.#container.config, project);
    const names = new Map<string, string>();
    for (const fact of view.facts) {
      if (fact.kind === 'team_official_name') {
        const value = (fact.value ?? fact.candidateValue) as { teamId: string; officialName: string } | null;
        if (value !== null) {
          names.set(value.teamId, value.officialName);
        }
      }
    }
    const display: DisplayContext = {
      language: project.language,
      utcOffsetMinutes: this.#container.config.display.utcOffsetMinutes,
      teamName: (teamId) => names.get(teamId),
    };

    return view.facts.map((fact) => {
      const latest = view.approvals.get(fact.id);
      const approved = isManuallyApproved(fact, latest);
      const status = fact.status === 'verified' ? 'verified' : approved ? 'manually_approved' : 'unverified';
      const evidenceRows = view.evidence.get(fact.id) ?? [];
      const values = new Map(fact.subject.evidence.map((entry) => [entry.observationId, entry.value]));
      const evidence: Evidence[] = evidenceRows.flatMap((row) => {
        const value = values.get(row.observationId);
        const source = sources.get(row.sourceId);
        if (value === undefined) {
          return [];
        }
        return [
          {
            sourceId: row.sourceId,
            sourceName: (source?.name ?? row.sourceId).slice(0, 80),
            dataMode: row.dataMode,
            role: source?.role ?? 'primary',
            accepted: source?.accepted ?? false,
            officialPublication: source?.officialPublication ?? false,
            relation: row.relation,
            value,
            sourceRef: row.sourceRef,
            retrievedAt: row.retrievedAt,
            importVersionId: row.importVersionId,
          },
        ];
      });
      const outcome = publishability(
        {
          status,
          supportingSources: evidenceRows
            .filter((row) => row.relation === 'supports')
            .map((row) => ({ sourceId: row.sourceId, dataMode: row.dataMode })),
        },
        settings,
      );
      const dispute = view.disputes.get(fact.id);
      const shown = fact.status === 'verified' ? fact.value : fact.candidateValue;
      const subject = {
        ...(fact.subject.matchKey === undefined ? {} : { matchKey: fact.subject.matchKey }),
        ...(fact.subject.teamId === undefined ? {} : { teamId: fact.subject.teamId }),
        ...(fact.subject.contextIndex === undefined ? {} : { contextIndex: fact.subject.contextIndex }),
      };
      const result = {
        factId: fact.id,
        factKey: fact.factKey,
        kind: fact.kind,
        status,
        unverifiedReason: status === 'unverified' ? fact.unverifiedReason : null,
        reason: approved ? MANUALLY_APPROVED_REASON : fact.reason,
        display: displayOf(fact.kind, shown, display),
        ...(outcome.publishable ? {} : { blockReason: outcome.blockReason }),
        value: fact.status === 'verified' ? fact.value : null,
        candidateValue: fact.status === 'verified' ? null : fact.candidateValue,
        subject,
        evidence,
        dispute:
          dispute === undefined
            ? null
            : {
                sourceValues: dispute.sourceValues,
                consultedSourceId: dispute.consultedSourceId,
                consultedAt: dispute.consultedAt,
                outcome: dispute.outcome,
                resolvedValue: dispute.resolvedValue,
              },
        manualApproval:
          approved && latest !== undefined
            ? { approvedAt: latest.at, carriedOverFromFactId: latest.carriedOverFromFactId }
            : null,
      };
      return result as Fact;
    });
  }

  /** Matches left out of the carousel with their status (OD-05, R-255, R-409). */
  #leftOutMatches(view: RunView, facts: readonly Fact[]): LeftOutMatch[] {
    const byMatch = new Map<string, Map<string, Fact>>();
    for (const fact of facts) {
      const matchKey = fact.subject.matchKey;
      if (matchKey === undefined) {
        continue;
      }
      const kinds = byMatch.get(matchKey) ?? new Map<string, Fact>();
      kinds.set(fact.kind, fact);
      byMatch.set(matchKey, kinds);
    }
    const excluded = new Set(view.run.snapshot.parameters.excludedMatchKeys ?? []);
    const usable = (fact: Fact | undefined): Record<string, unknown> | null =>
      fact === undefined ? null : ((fact.value ?? fact.candidateValue) as Record<string, unknown> | null);
    const result: LeftOutMatch[] = [];
    for (const [matchKey, kinds] of byMatch) {
      const status = usable(kinds.get('match_status'));
      const matchStatus = (status?.['matchStatus'] as LeftOutMatch['status'] | undefined) ?? null;
      const teamsFact = kinds.get('match_teams');
      const label = (teamsFact?.display ?? matchKey).slice(0, 200);
      if (matchStatus !== null && matchStatus !== 'finished') {
        result.push({ matchKey, label, status: matchStatus, reason: 'not_finished' });
      } else if (matchStatus === null || usable(teamsFact) === null || usable(kinds.get('match_score')) === null) {
        result.push({ matchKey, label, status: matchStatus, reason: 'not_verified' });
      } else if (excluded.has(matchKey)) {
        result.push({ matchKey, label, status: matchStatus, reason: 'excluded_by_operator' });
      }
    }
    return result;
  }

  /** Facts of a run with statuses, reasons, candidate values, evidence, disputes and block reasons (listFacts). */
  listFacts(projectId: string, runId: string): FactListResponse {
    const view = this.#view(projectId, runId);
    const facts = this.#facts(view);
    const recorded = new ResearchRepository(this.#container.db).standingsAvailability(runId);
    const standings =
      recorded ??
      (facts.some((fact) => fact.kind === 'standing_row')
        ? { available: true, reason: null }
        : { available: false, reason: 'not_provided_by_source' as const });
    return {
      dataMode: view.project.dataMode,
      facts,
      leftOutMatches: this.#leftOutMatches(view, facts),
      standings,
    };
  }

  /**
   * Fact references with their block reasons (contract `FactRef`), for the content blocking overlay and the
   * approval problems (R-026, R-206, R-271, R-272). All facts of the run when `factIds` is omitted.
   */
  factRefs(projectId: string, runId: string, factIds?: readonly string[]): FactRef[] {
    const wanted = factIds === undefined ? null : new Set(factIds);
    return this.#facts(this.#view(projectId, runId))
      .filter((fact) => wanted === null || wanted.has(fact.factId))
      .map((fact) => ({
        factId: fact.factId,
        factKey: fact.factKey,
        kind: fact.kind,
        status: fact.status,
        unverifiedReason: fact.unverifiedReason,
        reason: fact.reason,
        display: fact.display,
        ...(fact.blockReason === undefined ? {} : { blockReason: fact.blockReason }),
      }));
  }

  /** Block reasons of the run's facts that are not publishable, keyed by fact ID. */
  blockReasons(projectId: string, runId: string): Map<string, BlockReason> {
    const result = new Map<string, BlockReason>();
    for (const fact of this.factRefs(projectId, runId)) {
      if (fact.blockReason !== undefined) {
        result.set(fact.factId, fact.blockReason);
      }
    }
    return result;
  }

  #fact(projectId: string, runId: string, factId: string): Fact {
    const fact = this.#facts(this.#view(projectId, runId)).find((candidate) => candidate.factId === factId);
    if (fact === undefined) {
      throw notFound('The fact does not exist for this run.');
    }
    return fact;
  }

  /** Manually approves an eligible MANUAL_DATA fact of the project's latest completed full run (R-071, R-272). */
  approve(projectId: string, runId: string, factId: string): Fact {
    this.#container.db.transaction(() => {
      const { project, run } = this.#projectAndRun(projectId, runId);
      const fact = this.#repository.fact(runId, factId);
      if (fact === null) {
        throw notFound('The fact does not exist for this run.');
      }
      if (project.dataMode !== 'MANUAL_DATA') {
        throw refused('not_manual_data');
      }
      if (this.#repository.latestCompletedFullRunId(projectId) !== runId) {
        throw refused('not_latest_run');
      }
      if (fact.status === 'verified') {
        throw refused('verified');
      }
      if (fact.unverifiedReason === 'disputed') {
        throw refused('disputed');
      }
      if (fact.unverifiedReason === 'team_identity_unmatched') {
        throw refused('team_identity_unmatched');
      }
      const history = this.#repository.approvalsOfFact(factId);
      if (isManuallyApproved(fact, history.at(-1))) {
        throw refused('already_approved');
      }
      if (!fact.manualEligible) {
        const sources = new Map(run.snapshot.sources.map((source) => [source.id, source]));
        const disagrees = this.#repository
          .evidenceOfFact(factId)
          .some((row) => row.relation === 'disagrees' && counts(sources.get(row.sourceId), project.dataMode));
        throw refused(disagrees ? 'accepted_source_disagrees' : 'not_manual_data');
      }
      this.#repository.insertApproval(this.#newId(), factId, 'approved', null, this.#now());
    });
    this.#container.logger.info({ projectId, runId, factId, action: 'approved' }, 'manual fact approval recorded');
    return this.#fact(projectId, runId, factId);
  }

  /** Revokes a manual approval; final approvals of carousels that use the fact are invalidated. */
  revoke(projectId: string, runId: string, factId: string): Fact {
    let invalidated = 0;
    this.#container.db.transaction(() => {
      this.#projectAndRun(projectId, runId);
      const fact = this.#repository.fact(runId, factId);
      if (fact === null) {
        throw notFound('The fact does not exist for this run.');
      }
      if (!isManuallyApproved(fact, this.#repository.approvalsOfFact(factId).at(-1))) {
        throw refused('not_approved');
      }
      const at = this.#now();
      this.#repository.insertApproval(this.#newId(), factId, 'revoked', null, at);
      invalidated = this.#repository.invalidateFinalApprovalsUsing(factId, at);
    });
    this.#container.logger.info(
      { projectId, runId, factId, action: 'revoked', invalidatedFinalApprovals: invalidated },
      'manual fact approval revoked',
    );
    return this.#fact(projectId, runId, factId);
  }
}
