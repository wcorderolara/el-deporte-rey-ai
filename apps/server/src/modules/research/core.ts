/**
 * Pure core of the research stage (architecture.md sections 6 and 15; data-model.md section 3.2; AD-34): turns the
 * validated `SelectionSnapshot` of the project's source into one retrieval record, the attributed observations and
 * the standings availability of the run. It has no I/O and is deterministic, so the tests call it with inline fixture
 * inputs in isolation (R-225).
 *
 * - Observations are written for every team, match (teams, kickoff, status, and the score when the source gives one),
 *   standings row and context item, plus the matchday information of the selection (R-202). Each carries its source,
 *   data mode, import version, attribution reference and retrieval time (R-024, R-204, R-287).
 * - Values are the source's own: team and match keys are the source keys (canonical team IDs and match keys are
 *   assigned by the verification stage, T10-A1-06), and nothing is filled, derived or normalized (R-069, R-254).
 * - Every value is built field by field from the schema's own keys, never by spreading a snapshot object, so a field
 *   the adapter layer stripped can never be stored (R-119, R-232); the output schemas are closed objects.
 * - Missing standings are recorded as `{ available: false, reason }` with the source's reason (R-254).
 * - Nothing here depends on a data mode, a provider or a competition (R-268): the mode and the import version are
 *   copied from the snapshot, never inspected.
 */
import {
  AttributionRefSchema,
  CountSchema,
  DataModeSchema,
  DomainStageNameSchema,
  DomainTeamNameSchema,
  type Failure,
  type FailureCode,
  FailureSchema,
  MatchStatusSchema,
  OffsetDateTimeSchema,
  OpaqueSourceRefSchema,
  SNAPSHOT_LIMITS,
  type SelectionSnapshot,
  type SnapshotContextItem,
  SourceIdSchema,
  SourceKeySchema,
  StandingsAvailabilitySchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

// ---------------------------------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------------------------------

/** The project's selection as stored (AD-21, AD-24): the chosen source, its mode and the opaque selection reference. */
export const ResearchInputSchema = z.strictObject({
  projectId: UuidSchema,
  sourceId: SourceIdSchema,
  dataMode: DataModeSchema,
  /** Opaque adapter reference; passed back to the source unchanged and never parsed (AD-21). */
  selectionRef: OpaqueSourceRefSchema,
});

export type ResearchInput = z.infer<typeof ResearchInputSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Observation values (stored in `observations.value`)
// ---------------------------------------------------------------------------------------------------------------

const MatchTeamsObservationSchema = z.strictObject({
  kind: z.literal('match_teams'),
  matchKey: SourceKeySchema,
  homeTeamKey: SourceKeySchema,
  awayTeamKey: SourceKeySchema,
});

const MatchKickoffObservationSchema = z.strictObject({
  kind: z.literal('match_kickoff'),
  matchKey: SourceKeySchema,
  /** As the source gives it (ISO-8601 with an explicit offset). */
  kickoff: OffsetDateTimeSchema,
});

const MatchStatusObservationSchema = z.strictObject({
  kind: z.literal('match_status'),
  matchKey: SourceKeySchema,
  matchStatus: MatchStatusSchema,
});

const MatchScoreObservationSchema = z.strictObject({
  kind: z.literal('match_score'),
  matchKey: SourceKeySchema,
  home: CountSchema,
  away: CountSchema,
});

const StandingRowObservationSchema = z.strictObject({
  kind: z.literal('standing_row'),
  teamKey: SourceKeySchema,
  position: z.int().min(1),
  played: CountSchema,
  won: CountSchema,
  drawn: CountSchema,
  lost: CountSchema,
  goalsFor: CountSchema,
  goalsAgainst: CountSchema,
  goalDifference: z.int(),
  points: z.int(),
});

const MatchdayInfoObservationSchema = z.strictObject({
  kind: z.literal('matchday_info'),
  stageLabel: DomainStageNameSchema,
  matchdayNumber: z.int().min(1).nullable(),
  totalMatchdays: z.int().min(1).nullable(),
});

/** A context item without its reference (the reference is the observation's `sourceRef`). */
export const ContextItemContentSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('matchday_of_total'), matchday: z.int().min(1), totalMatchdays: z.int().min(1) }),
  z.strictObject({ type: z.literal('teams_in_table'), count: CountSchema }),
  z.strictObject({ type: z.literal('matches_in_selection'), count: CountSchema }),
]);

const ContextItemObservationSchema = z.strictObject({
  kind: z.literal('context_item'),
  /** Position of the item in the snapshot's context list. */
  index: z.int().min(0),
  item: ContextItemContentSchema,
});

const TeamObservationSchema = z.strictObject({
  kind: z.literal('team'),
  teamKey: SourceKeySchema,
  /** The name the source gives (the official name is decided by the verification stage, OD-12). */
  name: DomainTeamNameSchema,
  aliases: z.array(DomainTeamNameSchema).max(SNAPSHOT_LIMITS.aliases),
});

/**
 * The value of a research observation, self-describing by `kind`. Keys are the source's own team and match keys.
 * The verification stage reads these values (`readResearchObservations`) to build the facts.
 */
export const ResearchObservationValueSchema = z.discriminatedUnion('kind', [
  MatchTeamsObservationSchema,
  MatchKickoffObservationSchema,
  MatchStatusObservationSchema,
  MatchScoreObservationSchema,
  StandingRowObservationSchema,
  MatchdayInfoObservationSchema,
  ContextItemObservationSchema,
  TeamObservationSchema,
]);

export type ResearchObservationValue = z.infer<typeof ResearchObservationValueSchema>;
export type ResearchObservationKind = ResearchObservationValue['kind'];

/**
 * Observation keys (`observations.fact_key`; architecture.md section 7.1), unique within a run, source and stage.
 * The variable part is a source key; the fixed suffix contains no `:`, so different keys never collide.
 */
export const researchFactKey = Object.freeze({
  matchTeams: (matchKey: string): string => `match:${matchKey}:teams`,
  matchKickoff: (matchKey: string): string => `match:${matchKey}:kickoff`,
  matchStatus: (matchKey: string): string => `match:${matchKey}:status`,
  matchScore: (matchKey: string): string => `match:${matchKey}:score`,
  standingRow: (teamKey: string): string => `standings:row:${teamKey}`,
  matchdayInfo: (): string => 'matchday:info',
  contextItem: (type: SnapshotContextItem['type'], index: number): string => `context:${type}:${String(index)}`,
  team: (teamKey: string): string => `team:${teamKey}:name`,
});

/** Longest observation key: a 128-character source key with the longest prefix and suffix. */
export const MAX_FACT_KEY_LENGTH = 200;

/** Upper bound of the observations of one selection (every snapshot cap fully used, with four per match). */
export const MAX_OBSERVATIONS =
  SNAPSHOT_LIMITS.teams + SNAPSHOT_LIMITS.matches * 4 + SNAPSHOT_LIMITS.standingRows + SNAPSHOT_LIMITS.context + 1;

// ---------------------------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------------------------

/** Attribution that every stored observation carries (R-024, R-204, R-287). */
const attributionShape = {
  sourceId: SourceIdSchema,
  dataMode: DataModeSchema,
  /** The MANUAL_DATA version the value comes from; null for other modes (copied from the snapshot). */
  importVersionId: UuidSchema.nullable(),
  /** Provider-neutral attribution reference: never a URL (T11H-F14, AD-36). */
  sourceRef: AttributionRefSchema,
  /** ISO-8601 UTC time of the source retrieval the value comes from. */
  retrievedAt: z.iso.datetime(),
};

export const ResearchObservationSchema = z.strictObject({
  factKey: z.string().min(1).max(MAX_FACT_KEY_LENGTH),
  value: ResearchObservationValueSchema,
  ...attributionShape,
});

export type ResearchObservation = z.infer<typeof ResearchObservationSchema>;

export const RETRIEVAL_OUTCOMES = ['ok', 'failed', 'not_available'] as const;

/** One `retrievals` row (AD-34): no payload, header, URL or credential. */
export const ResearchRetrievalSchema = z
  .strictObject({
    sourceId: SourceIdSchema,
    dataMode: DataModeSchema,
    /** The port returns a selection in one call; its matches and standings are one retrieval. */
    resource: z.literal('selection'),
    /** Time of the source retrieval (or of the failed attempt). */
    retrievedAt: z.iso.datetime(),
    fromCache: z.boolean(),
    outcome: z.enum(RETRIEVAL_OUTCOMES),
    failure: FailureSchema.nullable(),
    importVersionId: UuidSchema.nullable(),
  })
  .refine((retrieval) => (retrieval.outcome === 'ok') === (retrieval.failure === null), {
    message: 'A failure is recorded exactly when the retrieval did not succeed',
    path: ['failure'],
  });

export type ResearchRetrieval = z.infer<typeof ResearchRetrievalSchema>;

/** Standings availability recorded on the run (`workflow_runs.standings_availability`; R-254, R-284). */
export { StandingsAvailabilitySchema };
export type StandingsAvailability = z.infer<typeof StandingsAvailabilitySchema>;

const RetrievedResearchSchema = z.strictObject({
  status: z.literal('retrieved'),
  retrieval: ResearchRetrievalSchema,
  observations: z.array(ResearchObservationSchema).max(MAX_OBSERVATIONS),
  standings: StandingsAvailabilitySchema,
});

const RefusedResearchSchema = z.strictObject({
  status: z.literal('refused'),
  retrieval: ResearchRetrievalSchema,
  /** The stage failure; equal to the retrieval's failure. */
  failure: FailureSchema,
});

function sameFailure(left: Failure | null, right: Failure): boolean {
  return (
    left !== null &&
    left.code === right.code &&
    left.sourceId === right.sourceId &&
    left.path === right.path &&
    left.httpStatus === right.httpStatus
  );
}

/**
 * Output of the research stage. A retrieved selection carries its observations, each attributed to the retrieval's
 * source, mode, import version and time; a refused one carries the failed retrieval and the stage failure.
 */
export const ResearchOutputSchema = z
  .discriminatedUnion('status', [RetrievedResearchSchema, RefusedResearchSchema])
  .superRefine((output, ctx) => {
    if (output.status === 'refused') {
      if (output.retrieval.outcome === 'ok' || !sameFailure(output.retrieval.failure, output.failure)) {
        ctx.addIssue({ code: 'custom', path: ['failure'], message: 'A refused research records its failure' });
      }
      return;
    }
    if (output.retrieval.outcome !== 'ok') {
      ctx.addIssue({ code: 'custom', path: ['retrieval', 'outcome'], message: 'A retrieved research succeeded' });
    }
    const { sourceId, dataMode, importVersionId, retrievedAt } = output.retrieval;
    const keys = new Set<string>();
    output.observations.forEach((observation, index) => {
      if (keys.has(observation.factKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['observations', index, 'factKey'],
          message: 'Duplicate observation key',
        });
      }
      keys.add(observation.factKey);
      if (
        observation.sourceId !== sourceId ||
        observation.dataMode !== dataMode ||
        observation.importVersionId !== importVersionId ||
        observation.retrievedAt !== retrievedAt
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['observations', index],
          message: 'An observation is attributed to the retrieval it comes from',
        });
      }
    });
  });

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;
export type RetrievedResearch = Extract<ResearchOutput, { status: 'retrieved' }>;
export type RefusedResearch = Extract<ResearchOutput, { status: 'refused' }>;

// ---------------------------------------------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------------------------------------------

/** ISO-8601 UTC with milliseconds (data-model.md section 2) of a time with an explicit offset; the same instant. */
export function utcTime(value: string): string {
  return new Date(value).toISOString();
}

function contextContent(item: SnapshotContextItem): z.infer<typeof ContextItemContentSchema> {
  switch (item.type) {
    case 'matchday_of_total':
      return { type: item.type, matchday: item.matchday, totalMatchdays: item.totalMatchdays };
    case 'teams_in_table':
      return { type: item.type, count: item.count };
    case 'matches_in_selection':
      return { type: item.type, count: item.count };
  }
}

/**
 * The research output of a validated selection snapshot: the retrieval record, one observation per team, match
 * fact, standings row and context item, the matchday information, and the standings availability.
 */
export function researchSnapshot(snapshot: SelectionSnapshot): RetrievedResearch {
  const retrievedAt = utcTime(snapshot.retrievedAt);
  const attribution = {
    sourceId: snapshot.sourceId,
    dataMode: snapshot.mode,
    importVersionId: snapshot.importVersionId,
    retrievedAt,
  };
  const observations: ResearchObservation[] = [];
  const add = (factKey: string, value: ResearchObservationValue, sourceRef: string): void => {
    observations.push({
      factKey,
      value,
      sourceId: attribution.sourceId,
      dataMode: attribution.dataMode,
      importVersionId: attribution.importVersionId,
      sourceRef,
      retrievedAt,
    });
  };

  add(
    researchFactKey.matchdayInfo(),
    {
      kind: 'matchday_info',
      stageLabel: snapshot.stage.name,
      matchdayNumber: snapshot.stage.matchday,
      totalMatchdays: snapshot.stage.totalMatchdays,
    },
    snapshot.sourceRef,
  );

  for (const team of snapshot.teams) {
    add(
      researchFactKey.team(team.teamKey),
      { kind: 'team', teamKey: team.teamKey, name: team.name, aliases: [...team.aliases] },
      team.ref,
    );
  }

  for (const match of snapshot.matches) {
    const matchKey = match.matchKey;
    add(
      researchFactKey.matchTeams(matchKey),
      { kind: 'match_teams', matchKey, homeTeamKey: match.homeTeamKey, awayTeamKey: match.awayTeamKey },
      match.ref,
    );
    add(researchFactKey.matchKickoff(matchKey), { kind: 'match_kickoff', matchKey, kickoff: match.kickoff }, match.ref);
    add(
      researchFactKey.matchStatus(matchKey),
      { kind: 'match_status', matchKey, matchStatus: match.status },
      match.ref,
    );
    // A score exists only for a finished match (shared schema); nothing is filled for the others (OD-05, R-069).
    if (match.score !== null) {
      add(
        researchFactKey.matchScore(matchKey),
        { kind: 'match_score', matchKey, home: match.score.home, away: match.score.away },
        match.ref,
      );
    }
  }

  let standings: StandingsAvailability;
  if (snapshot.standings.available) {
    for (const row of snapshot.standings.rows) {
      add(
        researchFactKey.standingRow(row.teamKey),
        {
          kind: 'standing_row',
          teamKey: row.teamKey,
          position: row.position,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
        },
        row.ref,
      );
    }
    standings = { available: true, reason: null };
  } else {
    // Recorded with the source's reason; no standings are invented or derived (R-254).
    standings = { available: false, reason: snapshot.standings.reason };
  }

  snapshot.context.forEach((item, index) => {
    add(
      researchFactKey.contextItem(item.type, index),
      { kind: 'context_item', index, item: contextContent(item) },
      item.ref,
    );
  });

  return {
    status: 'retrieved',
    retrieval: {
      sourceId: snapshot.sourceId,
      dataMode: snapshot.mode,
      resource: 'selection',
      retrievedAt,
      fromCache: snapshot.fromCache,
      outcome: 'ok',
      failure: null,
      importVersionId: snapshot.importVersionId,
    },
    observations,
    standings,
  };
}

/** Retrieval outcome of a source failure: `not_available` for a refused selection, `failed` otherwise. */
export function retrievalOutcomeOf(code: FailureCode): 'failed' | 'not_available' {
  return code === 'not_available' ? 'not_available' : 'failed';
}

export interface RefusedRetrieval {
  readonly sourceId: string;
  readonly dataMode: ResearchRetrieval['dataMode'];
  /** Time of the failed attempt (ISO-8601 UTC). */
  readonly attemptedAt: string;
  /** The closed failure of the source error (T10-F10). */
  readonly failure: Failure;
}

/** The research output of a source failure: the failed retrieval record and the stage failure with the same code. */
export function refusedResearch(refusal: RefusedRetrieval): RefusedResearch {
  const failure: Failure = {
    code: refusal.failure.code,
    sourceId: refusal.failure.sourceId,
    path: refusal.failure.path,
    httpStatus: refusal.failure.httpStatus,
  };
  return {
    status: 'refused',
    retrieval: {
      sourceId: refusal.sourceId,
      dataMode: refusal.dataMode,
      resource: 'selection',
      retrievedAt: utcTime(refusal.attemptedAt),
      fromCache: false,
      outcome: retrievalOutcomeOf(failure.code),
      failure: { ...failure },
      importVersionId: null,
    },
    failure,
  };
}
