/**
 * Pure core of the verification stage (architecture.md sections 7.1 to 7.4; OD-10, OD-12, OD-17, OD-24, AD-18,
 * AD-28, AD-38; R-068, R-205, R-227, R-229, R-230, R-256, R-270, R-271, R-272, R-278). No I/O, deterministic: the
 * tests call it with inline fixture inputs in isolation (R-225).
 *
 * Input: the observations of every source of the run in the research value format (`ResearchObservationValue`,
 * holding each source's own team and match keys): the project's source (research stage), the verification sources
 * (verification stage) and an official publication consulted for disputes (consultation stage).
 *
 * 1. Team identity (`identity.ts`) gives every source team key a canonical slug team ID or a placeholder.
 * 2. Every observation gets a canonical fact key and a canonical value (contract `FactValue` with slug team IDs):
 *    `match:<matchKey>:{teams|kickoff|status|score}` where the canonical match key is built from the unordered pair of
 *    canonical team IDs (so a home/away disagreement is a disputed `match_teams` value, not two matches),
 *    `standings:row:<teamId>`, `team:<teamId>:name`, `matchday:info`, `context:<type>:<n>`. Kickoffs are compared
 *    as UTC instants truncated to the minute.
 * 3. The facts are the canonical keys observed by the project's source; each is decided by `decideFact`
 *    (`decideTeamName` for official names). Every fact kind follows the two-source rule (OD-10).
 * 4. Manual approvals of the previous completed full run carry over only to facts whose key and candidate value are
 *    unchanged and which are eligible again (R-068, R-278).
 *
 * Every grouping and lookup keyed by source, team, match or fact key uses `Map` or `Set` (T11H-F07).
 */
import { createHash } from 'node:crypto';

import { type DataMode, type FactKind, type FactValue, FactValueSchemasByKind, MatchKeySchema } from '@edr/contracts';

import type { ResearchObservationValue } from '../research/index.js';

import {
  type CanonicalObservation,
  type Decision,
  type ObservationStage,
  type RetrievalAttempt,
  type SourceInfo,
  canonicalJson,
  counts,
  decideFact,
  decideTeamName,
} from './decision.js';
import { IdentityMap, type IdentityMapDocument, type IdentityResult, resolveIdentities } from './identity.js';

/** One stored or newly retrieved observation in the research value format. */
export interface SourceObservation {
  readonly id: string;
  readonly sourceId: string;
  readonly stage: ObservationStage;
  readonly factKey: string;
  readonly value: ResearchObservationValue;
  readonly retrievedAt: string;
}

export interface VerificationProject {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly sourceId: string;
  readonly dataMode: DataMode;
}

/** A manually approved fact of the previous completed full run (carry-over candidates). */
export interface PreviousApproval {
  readonly factId: string;
  readonly factKey: string;
  /** Canonical JSON of the candidate value. */
  readonly candidateValue: string;
}

export interface VerifyInput {
  readonly project: VerificationProject;
  readonly sources: ReadonlyMap<string, SourceInfo>;
  readonly observations: readonly SourceObservation[];
  readonly identityMap: IdentityMapDocument | null;
  /** The project's competition is configured as having no accepted public source (AD-38 item 4). */
  readonly pinned: boolean;
  readonly previousApprovals: readonly PreviousApproval[];
  /**
   * Retrieval attempts of the counterpart sources (verification and consultation stages, successful or not), in
   * order. A disputed fact whose official publication gave no value records the attempt (architecture.md 7.3).
   */
  readonly attempts?: readonly RetrievalAttempt[];
}

/** The subject of a fact (contract `FactSubject`). */
export interface FactSubjectValue {
  readonly matchKey?: string;
  readonly teamId?: string;
  readonly contextIndex?: number;
}

export interface DecidedFact extends Decision {
  readonly factKey: string;
  readonly kind: FactKind;
  readonly subject: FactSubjectValue;
  /** Canonical value of each evidence observation (the stored observations keep the source's own keys). */
  readonly evidenceValues: ReadonlyMap<string, FactValue>;
  /** Fact ID of the previous run's manually approved fact whose approval carries over, or null. */
  readonly carriedOverFrom: string | null;
}

export interface TeamRecord {
  readonly teamId: string;
  readonly aliases: readonly { readonly sourceId: string | null; readonly alias: string }[];
}

export interface VerifyResult {
  readonly facts: readonly DecidedFact[];
  readonly teams: readonly TeamRecord[];
  /** Whether a fact is disputed (a consultation of the official publication may settle it). */
  readonly disputed: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// Canonical keys and values
// ---------------------------------------------------------------------------------------------------------------

/** Canonical match key of an unordered pair of canonical team IDs and its occurrence (contract `MatchKey`). */
export function canonicalMatchKey(teamA: string, teamB: string, occurrence: number): string {
  const [first, second] = teamA <= teamB ? [teamA, teamB] : [teamB, teamA];
  const suffix = occurrence > 1 ? `_${String(occurrence)}` : '';
  const plain = `${first}_${second}${suffix}`;
  if (plain.length <= 128 && MatchKeySchema.safeParse(plain).success) {
    return plain;
  }
  const hash = createHash('sha256').update(`${first}\u0000${second}`, 'utf8').digest('hex').slice(0, 32);
  return `m-${hash}${suffix}`;
}

/** UTC instant truncated to the minute (architecture.md section 7.1). */
export function kickoffMinute(iso: string): string {
  const time = Date.parse(iso);
  return new Date(time - (((time % 60_000) + 60_000) % 60_000)).toISOString();
}

interface Canonical {
  readonly factKey: string;
  readonly kind: FactKind;
  readonly subject: FactSubjectValue;
  readonly value: FactValue;
  /** Canonical team IDs the fact involves. */
  readonly teams: readonly string[];
}

/** Per-source canonical mapping of match keys (from the source's teams observations and kickoffs). */
function matchKeysOf(
  observations: readonly SourceObservation[],
  teamOf: (teamKey: string) => string | undefined,
): Map<string, { matchKey: string; home: string; away: string }> {
  const kickoffs = new Map<string, number>();
  const pairs: { sourceMatchKey: string; home: string; away: string }[] = [];
  for (const observation of observations) {
    const value = observation.value;
    if (value.kind === 'match_kickoff') {
      kickoffs.set(value.matchKey, Date.parse(value.kickoff));
    }
  }
  for (const observation of observations) {
    const value = observation.value;
    if (value.kind !== 'match_teams') {
      continue;
    }
    const home = teamOf(value.homeTeamKey);
    const away = teamOf(value.awayTeamKey);
    if (home !== undefined && away !== undefined && home !== away) {
      pairs.push({ sourceMatchKey: value.matchKey, home, away });
    }
  }
  pairs.sort((left, right) => {
    const byTime = (kickoffs.get(left.sourceMatchKey) ?? 0) - (kickoffs.get(right.sourceMatchKey) ?? 0);
    if (byTime !== 0) {
      return byTime;
    }
    return left.sourceMatchKey < right.sourceMatchKey ? -1 : left.sourceMatchKey > right.sourceMatchKey ? 1 : 0;
  });
  const occurrences = new Map<string, number>();
  const result = new Map<string, { matchKey: string; home: string; away: string }>();
  for (const pair of pairs) {
    const base = canonicalMatchKey(pair.home, pair.away, 1);
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    result.set(pair.sourceMatchKey, {
      matchKey: canonicalMatchKey(pair.home, pair.away, occurrence),
      home: pair.home,
      away: pair.away,
    });
  }
  return result;
}

/** Canonical observations of one source; values that do not fit the contract value schema are left out. */
function canonicalize(
  observations: readonly SourceObservation[],
  teamOf: (teamKey: string) => string | undefined,
): Map<string, Canonical & { readonly observation: SourceObservation }> {
  const matches = matchKeysOf(observations, teamOf);
  const contextOrdinals = new Map<string, number>();
  const result = new Map<string, Canonical & { readonly observation: SourceObservation }>();
  const add = (observation: SourceObservation, canonical: Canonical | null): void => {
    if (canonical === null || result.has(canonical.factKey)) {
      return;
    }
    if (!FactValueSchemasByKind[canonical.kind].safeParse(canonical.value).success) {
      return;
    }
    result.set(canonical.factKey, { ...canonical, observation });
  };

  const ordered = [...observations].sort((left, right) => {
    const a = left.value.kind === 'context_item' ? left.value.index : -1;
    const b = right.value.kind === 'context_item' ? right.value.index : -1;
    return a - b;
  });
  for (const observation of ordered) {
    const value = observation.value;
    switch (value.kind) {
      case 'match_teams':
      case 'match_kickoff':
      case 'match_status':
      case 'match_score': {
        const match = matches.get(value.matchKey);
        if (match === undefined) {
          break;
        }
        const subject = { matchKey: match.matchKey };
        const teams = [match.home, match.away];
        if (value.kind === 'match_teams') {
          add(observation, {
            factKey: `match:${match.matchKey}:teams`,
            kind: 'match_teams',
            subject,
            value: { homeTeamId: match.home, awayTeamId: match.away },
            teams,
          });
        } else if (value.kind === 'match_kickoff') {
          add(observation, {
            factKey: `match:${match.matchKey}:kickoff`,
            kind: 'match_kickoff',
            subject,
            value: { kickoff: kickoffMinute(value.kickoff) },
            teams,
          });
        } else if (value.kind === 'match_status') {
          add(observation, {
            factKey: `match:${match.matchKey}:status`,
            kind: 'match_status',
            subject,
            value: { matchStatus: value.matchStatus },
            teams,
          });
        } else {
          add(observation, {
            factKey: `match:${match.matchKey}:score`,
            kind: 'match_score',
            subject,
            value: { home: value.home, away: value.away },
            teams,
          });
        }
        break;
      }
      case 'standing_row': {
        const teamId = teamOf(value.teamKey);
        if (teamId === undefined) {
          break;
        }
        add(observation, {
          factKey: `standings:row:${teamId}`,
          kind: 'standing_row',
          subject: { teamId },
          value: {
            position: value.position,
            teamId,
            played: value.played,
            won: value.won,
            drawn: value.drawn,
            lost: value.lost,
            goalsFor: value.goalsFor,
            goalsAgainst: value.goalsAgainst,
            goalDifference: value.goalDifference,
            points: value.points,
          },
          teams: [teamId],
        });
        break;
      }
      case 'team': {
        const teamId = teamOf(value.teamKey);
        if (teamId === undefined) {
          break;
        }
        add(observation, {
          factKey: `team:${teamId}:name`,
          kind: 'team_official_name',
          subject: { teamId },
          value: { teamId, officialName: value.name },
          teams: [teamId],
        });
        break;
      }
      case 'matchday_info':
        add(observation, {
          factKey: 'matchday:info',
          kind: 'matchday_info',
          subject: {},
          value: {
            stageLabel: value.stageLabel,
            matchdayNumber: value.matchdayNumber,
            totalMatchdays: value.totalMatchdays,
          },
          teams: [],
        });
        break;
      case 'context_item': {
        const ordinal = (contextOrdinals.get(value.item.type) ?? 0) + 1;
        contextOrdinals.set(value.item.type, ordinal);
        add(observation, {
          factKey: `context:${value.item.type}:${String(ordinal)}`,
          kind: 'context_item',
          subject: { contextIndex: value.index },
          value: value.item,
          teams: [],
        });
        break;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Verification of a run
// ---------------------------------------------------------------------------------------------------------------

function bySource(observations: readonly SourceObservation[]): Map<string, SourceObservation[]> {
  const grouped = new Map<string, SourceObservation[]>();
  for (const observation of observations) {
    const key = `${observation.stage}\u0000${observation.sourceId}`;
    const list = grouped.get(key) ?? [];
    list.push(observation);
    grouped.set(key, list);
  }
  return grouped;
}

function identityOf(input: VerifyInput, groups: Map<string, SourceObservation[]>): IdentityResult {
  const sources = [...groups.values()].map((observations) => {
    const first = observations[0] as SourceObservation;
    return {
      sourceId: first.sourceId,
      teams: observations.flatMap((observation) =>
        observation.value.kind === 'team'
          ? [{ teamKey: observation.value.teamKey, name: observation.value.name, aliases: observation.value.aliases }]
          : [],
      ),
    };
  });
  const identitySourceIds = new Set<string>([input.project.sourceId]);
  for (const observations of groups.values()) {
    const first = observations[0] as SourceObservation;
    if (first.stage !== 'consultation' && counts(input.sources.get(first.sourceId), input.project.dataMode)) {
      identitySourceIds.add(first.sourceId);
    }
  }
  // The project's source first; a source observed in two stages is resolved once (same keys, same result).
  const unique = new Map<string, (typeof sources)[number]>();
  for (const source of [...sources].sort((a, b) =>
    a.sourceId === input.project.sourceId ? -1 : b.sourceId === input.project.sourceId ? 1 : 0,
  )) {
    if (!unique.has(source.sourceId)) {
      unique.set(source.sourceId, source);
    }
  }
  return resolveIdentities({
    competitionId: input.project.competitionId,
    seasonId: input.project.seasonId,
    sources: [...unique.values()],
    identitySourceIds,
    map: input.identityMap === null ? null : new IdentityMap(input.identityMap),
    pinned: input.pinned,
  });
}

const KIND_ORDER: readonly FactKind[] = [
  'matchday_info',
  'context_item',
  'match_teams',
  'match_kickoff',
  'match_status',
  'match_score',
  'standing_row',
  'team_official_name',
];

/** Verifies every fact of a run (pure). */
export function verifyRun(input: VerifyInput): VerifyResult {
  const groups = bySource(input.observations);
  const identity = identityOf(input, groups);

  const base = new Map<string, CanonicalObservation[]>();
  const consultation = new Map<string, CanonicalObservation[]>();
  const primary = new Map<string, Canonical>();
  for (const observations of groups.values()) {
    const first = observations[0] as SourceObservation;
    const teams = identity.bySource.get(first.sourceId);
    const teamOf = (teamKey: string): string | undefined => teams?.get(teamKey)?.teamId;
    for (const [factKey, canonical] of canonicalize(observations, teamOf)) {
      const target = first.stage === 'consultation' ? consultation : base;
      const list = target.get(factKey) ?? [];
      list.push({
        observationId: canonical.observation.id,
        sourceId: canonical.observation.sourceId,
        stage: canonical.observation.stage,
        value: canonical.value,
        retrievedAt: canonical.observation.retrievedAt,
      });
      target.set(factKey, list);
      if (first.sourceId === input.project.sourceId && first.stage === 'research' && !primary.has(factKey)) {
        primary.set(factKey, canonical);
      }
    }
  }

  const previous = new Map(input.previousApprovals.map((approval) => [approval.factKey, approval]));
  const facts: DecidedFact[] = [];
  let anyDisputed = false;
  for (const [factKey, canonical] of primary) {
    const baseObservations = base.get(factKey) ?? [];
    const consulted = consultation.get(factKey) ?? [];
    const ctx = {
      kind: canonical.kind,
      projectMode: input.project.dataMode,
      projectSourceId: input.project.sourceId,
      sources: input.sources,
      teamUnmatched: canonical.teams.some((teamId) => identity.unmatched.has(teamId)),
      attempts: input.attempts ?? [],
    };
    const decision =
      canonical.kind === 'team_official_name'
        ? decideTeamName(baseObservations, consulted, ctx)
        : decideFact(baseObservations, consulted, ctx);
    if (decision.unverifiedReason === 'disputed') {
      anyDisputed = true;
    }
    const evidenceValues = new Map<string, FactValue>();
    for (const observation of [...baseObservations, ...consulted]) {
      evidenceValues.set(observation.observationId, observation.value);
    }
    const prior = previous.get(factKey);
    const carriedOverFrom =
      prior !== undefined &&
      decision.manualEligible &&
      decision.candidateValue !== null &&
      canonicalJson(decision.candidateValue) === prior.candidateValue
        ? prior.factId
        : null;
    facts.push({
      ...decision,
      evidence: decision.evidence.filter((link) => evidenceValues.has(link.observationId)),
      factKey,
      kind: canonical.kind,
      subject: canonical.subject,
      evidenceValues,
      carriedOverFrom,
    });
  }

  facts.sort((left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind));

  return { facts, teams: teamsOf(input, groups, identity), disputed: anyDisputed };
}

/** Teams seen in the run with every name form of every source and of the identity map (aliases, R-426, R-237). */
function teamsOf(input: VerifyInput, groups: Map<string, SourceObservation[]>, identity: IdentityResult): TeamRecord[] {
  const teams = new Map<string, Map<string, string | null>>();
  const addAlias = (teamId: string, alias: string, sourceId: string | null): void => {
    const aliases = teams.get(teamId) ?? new Map<string, string | null>();
    if (!aliases.has(alias)) {
      aliases.set(alias, sourceId);
    }
    teams.set(teamId, aliases);
  };
  for (const observations of groups.values()) {
    for (const observation of observations) {
      const value = observation.value;
      if (value.kind !== 'team') {
        continue;
      }
      const teamId = identity.bySource.get(observation.sourceId)?.get(value.teamKey)?.teamId;
      if (teamId === undefined) {
        continue;
      }
      addAlias(teamId, value.name, observation.sourceId);
      for (const alias of value.aliases) {
        addAlias(teamId, alias, observation.sourceId);
      }
    }
  }
  for (const entry of input.identityMap?.teams ?? []) {
    if (teams.has(entry.teamId)) {
      for (const alias of [entry.officialName, ...entry.aliases]) {
        addAlias(entry.teamId, alias, null);
      }
    }
  }
  return [...teams].map(([teamId, aliases]) => ({
    teamId,
    aliases: [...aliases].map(([alias, sourceId]) => ({ sourceId, alias })),
  }));
}
