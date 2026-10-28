/**
 * The decision rule of one fact key (architecture.md section 7.3; PD-02, BR-01, BR-02, BR-12, BR-13, OD-10, OD-17,
 * OD-24; R-055, R-205, R-227, R-229, R-230, R-256, R-270, R-271, R-423). Pure and deterministic.
 *
 * - Only observations of accepted sources count, one value per independence group (a group with several sources
 *   counts once; differing values inside one group make the fact disputed). MANUAL_DATA observations never count
 *   (R-071). DEMO_DATA observations count only for facts of DEMO_DATA projects (OD-24); otherwise they are recorded
 *   as `consulted` at most and never make a fact disputed.
 * - No counted value: unverified `no_accepted_source`, candidate value the MANUAL_DATA value of a MANUAL_DATA project.
 * - One group: unverified `awaiting_independent_verification` ("single source"), candidate value that value.
 * - All groups agree: verified with the value; the agreeing observations are evidence (`supports`).
 * - Groups disagree: unverified `disputed` (no candidate value); the official publication is consulted. Its value
 *   counts once for its group; the fact is resolved only when at least two independent groups support that value and
 *   no other value has as many; otherwise it stays disputed (`same_source`, `no_match` or `unavailable`).
 * - A fact that involves an unmatched team is unverified `team_identity_unmatched` (RK-14).
 * - No rule here, and no operation anywhere, sets a fact to verified other than this decision (R-412).
 */
import type { DataMode, FactKind, FactValue } from '@edr/contracts';

export type UnverifiedReason =
  'awaiting_independent_verification' | 'disputed' | 'no_accepted_source' | 'team_identity_unmatched';

export type EvidenceRelation = 'supports' | 'disagrees' | 'consulted';

export type DisputeOutcome = 'resolved' | 'unavailable' | 'same_source' | 'no_match';

export type ObservationStage = 'research' | 'verification' | 'consultation';

/** The configured descriptor of a source as recorded for the run (`workflow_runs.config_snapshot`). */
export interface SourceInfo {
  readonly id: string;
  readonly name: string;
  readonly mode: DataMode;
  readonly role: 'primary' | 'verification';
  readonly accepted: boolean;
  readonly independenceGroup: string;
  readonly officialPublication: boolean;
  readonly publicationPermission: 'confirmed' | 'unconfirmed' | 'not_applicable';
}

/** One observation of a fact key with its canonical value. */
export interface CanonicalObservation {
  readonly observationId: string;
  readonly sourceId: string;
  readonly stage: ObservationStage;
  readonly value: FactValue;
  readonly retrievedAt: string;
}

export interface DecisionContext {
  readonly kind: FactKind;
  readonly projectMode: DataMode;
  readonly projectSourceId: string;
  readonly sources: ReadonlyMap<string, SourceInfo>;
  /** The fact involves a team without a matched identity. */
  readonly teamUnmatched: boolean;
}

export interface EvidenceLink {
  readonly observationId: string;
  readonly relation: EvidenceRelation;
}

export interface DisputeRecord {
  readonly sourceValues: readonly { sourceId: string; independenceGroup: string; value: FactValue }[];
  readonly consultedSourceId: string | null;
  readonly consultedObservationId: string | null;
  readonly consultedAt: string | null;
  readonly outcome: DisputeOutcome;
  readonly resolvedValue: FactValue | null;
}

export interface Decision {
  readonly status: 'verified' | 'unverified';
  readonly unverifiedReason: UnverifiedReason | null;
  readonly value: FactValue | null;
  readonly candidateValue: FactValue | null;
  readonly manualEligible: boolean;
  readonly reason: string;
  readonly evidence: readonly EvidenceLink[];
  readonly dispute: DisputeRecord | null;
}

/** Canonical JSON text of a value: object keys sorted, so equal values compare equal as strings. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Whether an observation of this source counts toward agreement for the project (R-046, R-071, OD-24). */
export function counts(source: SourceInfo | undefined, projectMode: DataMode): boolean {
  if (source === undefined || !source.accepted || source.mode === 'MANUAL_DATA') {
    return false;
  }
  return source.mode !== 'DEMO_DATA' || projectMode === 'DEMO_DATA';
}

interface GroupState {
  readonly group: string;
  readonly values: Map<string, FactValue>;
  readonly observations: CanonicalObservation[];
}

function groupsOf(observations: readonly CanonicalObservation[], ctx: DecisionContext): Map<string, GroupState> {
  const groups = new Map<string, GroupState>();
  for (const observation of observations) {
    const source = ctx.sources.get(observation.sourceId);
    if (source === undefined || !counts(source, ctx.projectMode)) {
      continue;
    }
    const state = groups.get(source.independenceGroup) ?? {
      group: source.independenceGroup,
      values: new Map<string, FactValue>(),
      observations: [],
    };
    state.values.set(canonicalJson(observation.value), observation.value);
    state.observations.push(observation);
    groups.set(source.independenceGroup, state);
  }
  return groups;
}

function sourceList(observations: readonly CanonicalObservation[]): string {
  return [...new Set(observations.map((observation) => observation.sourceId))].sort().join(', ');
}

function bounded(text: string): string {
  return text.length > 300 ? `${text.slice(0, 297)}...` : text;
}

/** The project's own MANUAL_DATA observation of the key, if any. */
function manualObservation(
  observations: readonly CanonicalObservation[],
  ctx: DecisionContext,
): CanonicalObservation | undefined {
  return observations.find(
    (observation) =>
      observation.sourceId === ctx.projectSourceId && ctx.sources.get(observation.sourceId)?.mode === 'MANUAL_DATA',
  );
}

/**
 * Evidence relations against a reference value: counted observations support or disagree; every other observation
 * (MANUAL_DATA, DEMO_DATA outside DEMO_DATA projects, non-accepted sources) is `consulted` only.
 */
function relate(
  observations: readonly CanonicalObservation[],
  ctx: DecisionContext,
  reference: FactValue | null,
): EvidenceLink[] {
  const referenceText = reference === null ? null : canonicalJson(reference);
  return observations.map((observation) => {
    const counted = counts(ctx.sources.get(observation.sourceId), ctx.projectMode);
    if (!counted) {
      return { observationId: observation.observationId, relation: 'consulted' };
    }
    return {
      observationId: observation.observationId,
      relation: referenceText !== null && canonicalJson(observation.value) === referenceText ? 'supports' : 'disagrees',
    };
  });
}

/**
 * Manual eligibility (architecture.md section 7.4): MANUAL_DATA project; unverified with `no_accepted_source` or
 * `awaiting_independent_verification`; a candidate value; the project's MANUAL_DATA value equals it; no counted
 * observation has a different value.
 */
function manualEligibility(
  observations: readonly CanonicalObservation[],
  ctx: DecisionContext,
  candidate: FactValue | null,
): boolean {
  if (ctx.projectMode !== 'MANUAL_DATA' || candidate === null) {
    return false;
  }
  const manual = manualObservation(observations, ctx);
  const candidateText = canonicalJson(candidate);
  if (manual === undefined || canonicalJson(manual.value) !== candidateText) {
    return false;
  }
  return observations.every(
    (observation) =>
      !counts(ctx.sources.get(observation.sourceId), ctx.projectMode) ||
      canonicalJson(observation.value) === candidateText,
  );
}

/**
 * Decides one fact key from the observations of the research and verification retrievals (`base`) and, for a
 * disputed fact, the observations of a dedicated consultation of the official publication (`consultation`).
 */
export function decideFact(
  base: readonly CanonicalObservation[],
  consultation: readonly CanonicalObservation[],
  ctx: DecisionContext,
): Decision {
  const groups = groupsOf(base, ctx);
  const distinct = new Map<string, FactValue>();
  let inconsistent = false;
  for (const state of groups.values()) {
    if (state.values.size > 1) {
      inconsistent = true;
    }
    for (const [text, value] of state.values) {
      distinct.set(text, value);
    }
  }

  if (ctx.teamUnmatched) {
    const own = base.find((observation) => observation.sourceId === ctx.projectSourceId);
    const candidate = own?.value ?? null;
    return {
      status: 'unverified',
      unverifiedReason: 'team_identity_unmatched',
      value: null,
      candidateValue: candidate,
      manualEligible: false,
      reason: 'Team identity unmatched: a team of this fact is not identified in every source.',
      evidence: relate(base, ctx, candidate),
      dispute: null,
    };
  }

  if (groups.size === 0) {
    const candidate = ctx.projectMode === 'MANUAL_DATA' ? (manualObservation(base, ctx)?.value ?? null) : null;
    return {
      status: 'unverified',
      unverifiedReason: 'no_accepted_source',
      value: null,
      candidateValue: candidate,
      manualEligible: manualEligibility(base, ctx, candidate),
      reason: 'No accepted source: no value from an accepted source counts for this fact.',
      evidence: relate(base, ctx, null),
      dispute: null,
    };
  }

  if (!inconsistent && distinct.size === 1) {
    const [value] = [...distinct.values()] as [FactValue];
    const counted = base.filter((observation) => counts(ctx.sources.get(observation.sourceId), ctx.projectMode));
    if (groups.size === 1) {
      // In a MANUAL_DATA project the relations are stated against the imported value, so an accepted source with a
      // different value is recorded as disagreeing (refusal accepted_source_disagrees, R-272).
      const manual = ctx.projectMode === 'MANUAL_DATA' ? manualObservation(base, ctx) : undefined;
      return {
        status: 'unverified',
        unverifiedReason: 'awaiting_independent_verification',
        value: null,
        candidateValue: value,
        manualEligible: manualEligibility(base, ctx, value),
        reason: bounded(`Awaiting independent verification; single source: ${sourceList(counted)}.`),
        evidence: relate(base, ctx, manual?.value ?? value),
        dispute: null,
      };
    }
    return {
      status: 'verified',
      unverifiedReason: null,
      value,
      candidateValue: null,
      manualEligible: false,
      reason: bounded(`Verified: independent accepted sources agree (${sourceList(counted)}).`),
      evidence: relate(base, ctx, value),
      dispute: null,
    };
  }

  return disputed(base, consultation, groups, ctx);
}

function disputed(
  base: readonly CanonicalObservation[],
  consultation: readonly CanonicalObservation[],
  groups: ReadonlyMap<string, GroupState>,
  ctx: DecisionContext,
): Decision {
  const counted = base.filter((observation) => counts(ctx.sources.get(observation.sourceId), ctx.projectMode));
  const sourceValues = counted.map((observation) => ({
    sourceId: observation.sourceId,
    independenceGroup: ctx.sources.get(observation.sourceId)?.independenceGroup ?? observation.sourceId,
    value: observation.value,
  }));
  const isOfficial = (observation: CanonicalObservation): boolean =>
    ctx.sources.get(observation.sourceId)?.officialPublication === true &&
    counts(ctx.sources.get(observation.sourceId), ctx.projectMode);
  const official = counted.find(isOfficial) ?? consultation.find(isOfficial);
  const disputedText = `Disputed: accepted sources disagree (${sourceList(counted)})`;

  if (official === undefined) {
    return {
      status: 'unverified',
      unverifiedReason: 'disputed',
      value: null,
      candidateValue: null,
      manualEligible: false,
      reason: bounded(`${disputedText}; official publication unavailable.`),
      evidence: relate(base, ctx, null),
      dispute: {
        sourceValues,
        consultedSourceId: null,
        consultedObservationId: null,
        consultedAt: null,
        outcome: 'unavailable',
        resolvedValue: null,
      },
    };
  }

  const officialGroup = ctx.sources.get(official.sourceId)?.independenceGroup ?? official.sourceId;
  const officialText = canonicalJson(official.value);
  // Supporters of each value: the consistent groups holding it, plus the official group once for its own value.
  const supporters = new Map<string, Set<string>>();
  for (const state of groups.values()) {
    if (state.values.size === 1) {
      const [text] = [...state.values.keys()] as [string];
      const set = supporters.get(text) ?? new Set<string>();
      set.add(state.group);
      supporters.set(text, set);
    }
  }
  const officialSupporters = supporters.get(officialText) ?? new Set<string>();
  officialSupporters.add(officialGroup);
  supporters.set(officialText, officialSupporters);
  const strongestOther = Math.max(
    0,
    ...[...supporters].filter(([text]) => text !== officialText).map(([, set]) => set.size),
  );
  const consulted = {
    consultedSourceId: official.sourceId,
    consultedObservationId: official.observationId,
    consultedAt: official.retrievedAt,
  };
  const fromConsultation = official.stage === 'consultation';

  if (officialSupporters.size >= 2 && officialSupporters.size > strongestOther) {
    const evidence = relate(base, ctx, official.value);
    if (fromConsultation) {
      evidence.push({ observationId: official.observationId, relation: 'supports' });
    }
    return {
      status: 'verified',
      unverifiedReason: null,
      value: official.value,
      candidateValue: null,
      manualEligible: false,
      reason: bounded(
        `Verified after a dispute: the official publication (${official.sourceId}) and another independent ` +
          'accepted source agree.',
      ),
      evidence,
      dispute: { sourceValues, ...consulted, outcome: 'resolved', resolvedValue: official.value },
    };
  }

  const outcome: DisputeOutcome = !fromConsultation && officialSupporters.size < 2 ? 'same_source' : 'no_match';
  const evidence = relate(base, ctx, null);
  if (fromConsultation) {
    evidence.push({ observationId: official.observationId, relation: 'consulted' });
  }
  const outcomeText =
    outcome === 'same_source'
      ? `the official publication (${official.sourceId}) is one of the disagreeing sources`
      : `the official publication (${official.sourceId}) does not settle it`;
  return {
    status: 'unverified',
    unverifiedReason: 'disputed',
    value: null,
    candidateValue: null,
    manualEligible: false,
    reason: bounded(`${disputedText}; ${outcomeText}.`),
    evidence,
    dispute: { sourceValues, ...consulted, outcome, resolvedValue: null },
  };
}

/**
 * Team official name (architecture.md section 7.2, OD-12): when the team's identity is supported by at least two
 * independent counted groups and the official publication names it, the fact is verified with the official
 * publication's name; the other names are recorded as `consulted` evidence (they are aliases, R-426). Otherwise the
 * general rule applies to the names.
 */
export function decideTeamName(
  base: readonly CanonicalObservation[],
  consultation: readonly CanonicalObservation[],
  ctx: DecisionContext,
): Decision {
  if (!ctx.teamUnmatched) {
    const groups = groupsOf(base, ctx);
    const official = base.find(
      (observation) =>
        ctx.sources.get(observation.sourceId)?.officialPublication === true &&
        counts(ctx.sources.get(observation.sourceId), ctx.projectMode),
    );
    if (groups.size >= 2 && official !== undefined) {
      const officialText = canonicalJson(official.value);
      const counted = base.filter((observation) => counts(ctx.sources.get(observation.sourceId), ctx.projectMode));
      return {
        status: 'verified',
        unverifiedReason: null,
        value: official.value,
        candidateValue: null,
        manualEligible: false,
        reason: bounded(
          `Verified: team identity confirmed by independent accepted sources (${sourceList(counted)}); ` +
            `official name from ${official.sourceId}.`,
        ),
        evidence: base.map((observation) => ({
          observationId: observation.observationId,
          relation:
            counts(ctx.sources.get(observation.sourceId), ctx.projectMode) &&
            canonicalJson(observation.value) === officialText
              ? 'supports'
              : 'consulted',
        })),
        dispute: null,
      };
    }
  }
  return decideFact(base, consultation, ctx);
}
