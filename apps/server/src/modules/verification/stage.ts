/**
 * Verification stage (architecture.md sections 6 and 7; contracts/provider-ports.md sections 1.2 and 3).
 *
 * - `load` reads the project, the run's source descriptors (configuration snapshot), the research observations of
 *   the project's source (`ResearchRepository`), the identity map of the competition and season, whether the
 *   competition is configured as having no accepted public source (pinned team names, AD-38) and the manual approvals
 *   of the previous completed full run.
 * - `run` asks every enabled verification-role source bound to the project's catalogue link for the same selection
 *   through `catalogue.resolveCounterpart` (a source that cannot be resolved or fails contributes no observation and
 *   gets a retrieval record), decides every fact with the pure core, and, when a fact is disputed, consults the
 *   official-publication sources of the link that were not yet observed (stage `consultation`) and decides again.
 *   It uses only the source registry and the catalogue service; there is no adapter import and no branch on a
 *   provider or a competition (R-118, R-268).
 * - `persist` writes, in one transaction, the retrievals and observations of the verification and consultation
 *   retrievals, the teams and their aliases, the facts with their evidence and disputes, and the carried-over manual
 *   approvals (R-068, R-278). Facts are written only here; no API operation sets a status (R-412).
 */
import { randomUUID } from 'node:crypto';

import {
  DataModeSchema,
  DisputeOutcomeSchema,
  FactKindSchema,
  FactValueSchema,
  FailureSchema,
  OpaqueSourceRefSchema,
  SlugSchema,
  SourceIdSchema,
  TeamNameSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

import type { AppContainer } from '../../container.js';
import {
  type CatalogueService,
  type IngestionContext,
  type SourceRef,
  counterpartFailureCode,
} from '../../providers/sports/index.js';
import { StageFailure, failureOf } from '../../workflow/index.js';
import type { Stage, StageContext } from '../module-kit.js';
import { ResearchObservationValueSchema, ResearchRepository, researchSnapshot } from '../research/index.js';

import { type SourceObservation, type VerifyResult, verifyRun } from './core.js';
import type { SourceInfo } from './decision.js';
import { IdentityMapSchema, loadIdentityMap } from './identity.js';
import { isOperatorAttestedCompetition } from './publishability.js';
import {
  type NewObservation,
  type NewRetrieval,
  SourceValuesSchema,
  StoredSubjectSchema,
  VerificationRepository,
} from './repository.js';

// ---------------------------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------------------------

const SourceInfoSchema = z.strictObject({
  id: SourceIdSchema,
  name: z.string().max(80),
  mode: DataModeSchema,
  role: z.enum(['primary', 'verification']),
  accepted: z.boolean(),
  independenceGroup: z.string().max(64),
  officialPublication: z.boolean(),
  publicationPermission: z.enum(['confirmed', 'unconfirmed', 'not_applicable']),
});

const ObservationInputSchema = z.strictObject({
  id: UuidSchema,
  sourceId: SourceIdSchema,
  factKey: z.string().min(1).max(200),
  value: ResearchObservationValueSchema,
  retrievedAt: z.string().max(40),
});

export const VerificationInputSchema = z.strictObject({
  project: z.strictObject({
    id: UuidSchema,
    competitionId: SlugSchema,
    seasonId: SlugSchema,
    stageId: SlugSchema,
    matchday: z.int().min(1).nullable(),
    sourceId: SourceIdSchema,
    dataMode: DataModeSchema,
    selectionRef: OpaqueSourceRefSchema,
  }),
  sources: z.array(SourceInfoSchema).max(100),
  research: z.array(ObservationInputSchema).max(20_000),
  identityMap: IdentityMapSchema.nullable(),
  pinned: z.boolean(),
  previousApprovals: z
    .array(z.strictObject({ factId: UuidSchema, factKey: z.string().max(200), candidateValue: z.string() }))
    .max(20_000),
});
export type VerificationInput = z.infer<typeof VerificationInputSchema>;

const RetrievalOutputSchema = z.strictObject({
  id: UuidSchema,
  sourceId: SourceIdSchema,
  dataMode: DataModeSchema,
  stage: z.enum(['verification', 'consultation']),
  retrievedAt: z.string().max(40),
  fromCache: z.boolean(),
  outcome: z.enum(['ok', 'failed', 'not_available']),
  failure: FailureSchema.nullable(),
  importVersionId: UuidSchema.nullable(),
});

const ObservationOutputSchema = z.strictObject({
  id: UuidSchema,
  retrievalId: UuidSchema,
  sourceId: SourceIdSchema,
  dataMode: DataModeSchema,
  importVersionId: UuidSchema.nullable(),
  stage: z.enum(['verification', 'consultation']),
  factKey: z.string().min(1).max(200),
  value: ResearchObservationValueSchema,
  sourceRef: z.string().min(1).max(512),
  retrievedAt: z.string().max(40),
});

const UnverifiedReasonSchema = z
  .enum(['awaiting_independent_verification', 'disputed', 'no_accepted_source', 'team_identity_unmatched'])
  .nullable();

const FactOutputSchema = z
  .strictObject({
    id: UuidSchema,
    factKey: z.string().min(1).max(200),
    kind: FactKindSchema,
    subject: StoredSubjectSchema,
    status: z.enum(['verified', 'unverified']),
    unverifiedReason: UnverifiedReasonSchema,
    value: FactValueSchema.nullable(),
    candidateValue: FactValueSchema.nullable(),
    manualEligible: z.boolean(),
    reason: z.string().max(300),
    evidence: z
      .array(z.strictObject({ observationId: UuidSchema, relation: z.enum(['supports', 'disagrees', 'consulted']) }))
      .max(64),
    dispute: z
      .strictObject({
        sourceValues: SourceValuesSchema,
        consultedSourceId: SourceIdSchema.nullable(),
        consultedObservationId: UuidSchema.nullable(),
        consultedAt: z.string().max(40).nullable(),
        outcome: DisputeOutcomeSchema,
        resolvedValue: FactValueSchema.nullable(),
      })
      .nullable(),
    carriedOverFrom: UuidSchema.nullable(),
  })
  .refine((fact) => (fact.status === 'verified') === (fact.value !== null), { message: 'verified iff value' })
  .refine((fact) => (fact.status === 'verified') === (fact.unverifiedReason === null), {
    message: 'reason iff unverified',
  })
  .refine((fact) => fact.status === 'unverified' || fact.candidateValue === null, {
    message: 'candidate only when unverified',
  })
  .refine((fact) => fact.unverifiedReason !== 'disputed' || fact.candidateValue === null, {
    message: 'no candidate when disputed',
  })
  .refine(
    (fact) =>
      !fact.manualEligible ||
      fact.unverifiedReason === 'no_accepted_source' ||
      fact.unverifiedReason === 'awaiting_independent_verification',
    { message: 'manual eligibility only for no_accepted_source or awaiting_independent_verification' },
  )
  .refine((fact) => fact.carriedOverFrom === null || fact.manualEligible, {
    message: 'carry-over only for eligible facts',
  });

export const VerificationOutputSchema = z.strictObject({
  retrievals: z.array(RetrievalOutputSchema).max(100),
  observations: z.array(ObservationOutputSchema).max(100_000),
  teams: z
    .array(
      z.strictObject({
        teamId: SlugSchema,
        aliases: z.array(z.strictObject({ sourceId: SourceIdSchema.nullable(), alias: TeamNameSchema })).max(512),
      }),
    )
    .max(5_000),
  facts: z.array(FactOutputSchema).max(20_000),
});
export type VerificationOutput = z.infer<typeof VerificationOutputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------------------------------------------

/** Reads the stage input from the database and the configuration. */
export function loadVerificationInput(container: AppContainer, runId: string, projectId: string): VerificationInput {
  const repository = new VerificationRepository(container.db);
  const project = repository.project(projectId);
  const run = repository.runOfProject(projectId, runId);
  if (project === null || run === null) {
    throw new StageFailure('no_data');
  }
  const sources: SourceInfo[] = run.snapshot.sources.map((source) => ({
    id: source.id,
    name: source.name,
    mode: source.mode,
    role: source.role,
    accepted: source.accepted,
    independenceGroup: source.independenceGroup,
    officialPublication: source.officialPublication,
    publicationPermission: source.publicationPermission,
  }));
  const research = new ResearchRepository(container.db)
    .observations(runId)
    .filter((observation) => observation.sourceId === project.sourceId)
    .map((observation) => ({
      id: observation.id,
      sourceId: observation.sourceId,
      factKey: observation.factKey,
      value: observation.value,
      retrievedAt: observation.retrievedAt,
    }));
  return {
    project: {
      id: project.id,
      competitionId: project.competitionId,
      seasonId: project.seasonId,
      stageId: project.stageId,
      matchday: project.matchday,
      sourceId: project.sourceId,
      dataMode: project.dataMode,
      selectionRef: project.selectionRef,
    },
    sources,
    research,
    identityMap: loadIdentityMap(container.paths.rootDir, project.competitionId, project.seasonId),
    pinned: isOperatorAttestedCompetition(container.config.catalogue, project),
    previousApprovals: repository.previousApprovals(projectId, run.runNumber),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------------------------

interface Retrieved {
  readonly retrievals: NewRetrieval[];
  readonly observations: NewObservation[];
}

function now(container: AppContainer): string {
  return container.clock.now().toISOString();
}

/** Asks one counterpart source for the project's selection; failures become a retrieval record only. */
async function retrieveCounterpart(
  container: AppContainer,
  catalogue: CatalogueService,
  input: VerificationInput,
  sourceId: string,
  stage: 'verification' | 'consultation',
  signal: AbortSignal,
  newId: () => string,
  into: Retrieved,
): Promise<void> {
  const source = container.sources.get(sourceId);
  if (source === undefined) {
    return;
  }
  const ctx: IngestionContext = { signal, purpose: stage };
  const { project } = input;
  const record = (outcome: NewRetrieval['outcome'], failure: NewRetrieval['failure']): void => {
    into.retrievals.push({
      id: newId(),
      sourceId,
      dataMode: source.descriptor.mode,
      stage,
      retrievedAt: now(container),
      fromCache: false,
      outcome,
      failure,
      importVersionId: null,
    });
  };
  try {
    const counterpart = await catalogue.resolveCounterpart(
      {
        competitionId: project.competitionId,
        sourceId: project.sourceId,
        seasonId: project.seasonId,
        stageId: project.stageId,
        matchday: project.matchday,
      },
      sourceId,
      ctx,
    );
    if (!counterpart.resolved) {
      // A counterpart that cannot be resolved because the source failed keeps the source failure as the catalogue
      // reports it (architecture.md 7.3, OD-56): the closed SourceError code and HTTP status, or the code of the
      // listing's availability reason, never another code and never provider text (T10-F10). As for a failed
      // selection retrieval, `not_available` is a `not_available` attempt and any other code a failed one. A
      // counterpart the source does not list or bind is `not_available`.
      if (counterpart.reason === 'source_unavailable') {
        const { failure } = counterpart;
        const code = counterpartFailureCode(failure);
        const httpStatus = failure.kind === 'source_error' ? failure.httpStatus : null;
        record(code === 'not_available' ? 'not_available' : 'failed', { code, sourceId, path: null, httpStatus });
      } else {
        record('not_available', { code: 'not_available', sourceId, path: null, httpStatus: null });
      }
      return;
    }
    const snapshot = await source.fetchSelection(counterpart.selectionRef as SourceRef, ctx);
    const research = researchSnapshot(snapshot);
    const retrievalId = newId();
    into.retrievals.push({
      id: retrievalId,
      sourceId,
      dataMode: research.retrieval.dataMode,
      stage,
      retrievedAt: research.retrieval.retrievedAt,
      fromCache: research.retrieval.fromCache,
      outcome: 'ok',
      failure: null,
      importVersionId: research.retrieval.importVersionId,
    });
    for (const observation of research.observations) {
      into.observations.push({
        id: newId(),
        retrievalId,
        sourceId,
        dataMode: observation.dataMode,
        importVersionId: observation.importVersionId,
        stage,
        factKey: observation.factKey,
        value: observation.value,
        sourceRef: observation.sourceRef,
        retrievedAt: observation.retrievedAt,
      });
    }
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    const failure = failureOf(error);
    record(failure.code === 'not_available' ? 'not_available' : 'failed', {
      ...failure,
      sourceId: failure.sourceId ?? sourceId,
    });
  }
}

function sourceObservations(input: VerificationInput, retrieved: Retrieved): SourceObservation[] {
  return [
    ...input.research.map((observation) => ({ ...observation, stage: 'research' as const })),
    ...retrieved.observations.map((observation) => ({
      id: observation.id,
      sourceId: observation.sourceId,
      stage: observation.stage,
      factKey: observation.factKey,
      value: observation.value,
      retrievedAt: observation.retrievedAt,
    })),
  ];
}

function verify(input: VerificationInput, retrieved: Retrieved): VerifyResult {
  return verifyRun({
    project: input.project,
    sources: new Map(input.sources.map((source) => [source.id, source])),
    observations: sourceObservations(input, retrieved),
    identityMap: input.identityMap,
    pinned: input.pinned,
    previousApprovals: input.previousApprovals,
    attempts: retrieved.retrievals.map((retrieval) => ({
      sourceId: retrieval.sourceId,
      attemptedAt: retrieval.retrievedAt,
      failureCode: retrieval.failure?.code ?? null,
    })),
  });
}

/** Retrieves the counterparts and decides every fact. */
export async function runVerification(
  input: VerificationInput,
  container: AppContainer,
  signal: AbortSignal,
  newId: () => string = randomUUID,
): Promise<VerificationOutput> {
  const catalogue = container.catalogue as CatalogueService | null;
  const retrieved: Retrieved = { retrievals: [], observations: [] };
  const linked = catalogue === null ? [] : catalogue.linkedSources(input.project.competitionId);
  const asked = new Set<string>([input.project.sourceId]);

  if (catalogue !== null) {
    for (const descriptor of linked) {
      if (!asked.has(descriptor.id) && descriptor.role === 'verification') {
        asked.add(descriptor.id);
        await retrieveCounterpart(container, catalogue, input, descriptor.id, 'verification', signal, newId, retrieved);
      }
    }
  }
  let result = verify(input, retrieved);

  if (result.disputed && catalogue !== null) {
    const officials = linked.filter((descriptor) => descriptor.officialPublication && !asked.has(descriptor.id));
    for (const descriptor of officials) {
      asked.add(descriptor.id);
      await retrieveCounterpart(container, catalogue, input, descriptor.id, 'consultation', signal, newId, retrieved);
    }
    if (officials.length > 0) {
      result = verify(input, retrieved);
    }
  }

  const factIds = new Map(result.facts.map((fact) => [fact.factKey, newId()]));
  return {
    retrievals: retrieved.retrievals,
    observations: retrieved.observations,
    teams: result.teams.map((team) => ({ teamId: team.teamId, aliases: [...team.aliases] })),
    facts: result.facts.map((fact) => ({
      id: factIds.get(fact.factKey) as string,
      factKey: fact.factKey,
      kind: fact.kind,
      subject: {
        ...fact.subject,
        evidence: fact.evidence.flatMap((link) => {
          const value = fact.evidenceValues.get(link.observationId);
          return value === undefined ? [] : [{ observationId: link.observationId, value }];
        }),
      },
      status: fact.status,
      unverifiedReason: fact.unverifiedReason,
      value: fact.value,
      candidateValue: fact.candidateValue,
      manualEligible: fact.manualEligible,
      reason: fact.reason,
      evidence: fact.evidence.map((link) => ({ observationId: link.observationId, relation: link.relation })),
      dispute:
        fact.dispute === null
          ? null
          : {
              sourceValues: fact.dispute.sourceValues.map((entry) => ({ ...entry })),
              consultedSourceId: fact.dispute.consultedSourceId,
              consultedObservationId: fact.dispute.consultedObservationId,
              consultedAt: fact.dispute.consultedAt,
              outcome: fact.dispute.outcome,
              resolvedValue: fact.dispute.resolvedValue,
            },
      carriedOverFrom: fact.carriedOverFrom,
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Persist
// ---------------------------------------------------------------------------------------------------------------

/** Writes the stage output in one transaction. */
export function persistVerification(
  output: VerificationOutput,
  container: AppContainer,
  runId: string,
  projectId: string,
  newId: () => string = randomUUID,
): void {
  const repository = new VerificationRepository(container.db);
  const at = now(container);
  container.db.transaction(() => {
    const project = repository.project(projectId);
    if (project === null) {
      throw new StageFailure('no_data');
    }
    for (const retrieval of output.retrievals) {
      repository.insertRetrieval(runId, retrieval);
    }
    for (const observation of output.observations) {
      repository.insertObservation(runId, observation);
    }
    for (const team of output.teams) {
      repository.insertTeam(team.teamId, project.competitionId, project.seasonId);
      for (const alias of team.aliases) {
        repository.insertAlias(team.teamId, alias.sourceId, alias.alias);
      }
    }
    for (const fact of output.facts) {
      repository.insertFact(runId, fact, at);
      for (const link of fact.evidence) {
        repository.insertEvidence(fact.id, link.observationId, link.relation);
      }
      if (fact.dispute !== null) {
        repository.insertDispute({ id: newId(), factId: fact.id, ...fact.dispute });
      }
      if (fact.carriedOverFrom !== null) {
        repository.insertApproval(newId(), fact.id, 'approved', fact.carriedOverFrom, at);
      }
    }
  });
}

export interface VerificationStageOptions {
  readonly newId?: () => string;
}

/** Creates the verification stage (contracts/provider-ports.md section 3). */
export function createVerificationStage(
  options: VerificationStageOptions = {},
): Stage<VerificationInput, VerificationOutput> {
  const newId = options.newId ?? randomUUID;
  return {
    name: 'verification',
    input: VerificationInputSchema,
    output: VerificationOutputSchema,
    load: async (ctx: StageContext) => {
      await Promise.resolve();
      return loadVerificationInput(ctx.container, ctx.runId, ctx.projectId);
    },
    run: async (input, ctx) => runVerification(input, ctx.container, ctx.signal, newId),
    persist: async (output, ctx) => {
      await Promise.resolve();
      persistVerification(output, ctx.container, ctx.runId, ctx.projectId, newId);
    },
  };
}

export const verificationStage = createVerificationStage();
