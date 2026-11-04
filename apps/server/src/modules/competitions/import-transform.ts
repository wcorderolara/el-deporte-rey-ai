import { createHash } from 'node:crypto';
import {
  DisplayNameSchema,
  TeamNameSchema,
  type ImportApplyAction,
  type ImportApplyCounts,
  type ImportApplyDecision,
  type ImportApplyPlanItem,
  type ImportPreview,
  type ImportPreviewItem,
  type ImportResource,
} from '@edr/contracts';
import { displayValue, identityKey } from './domain/identity.js';
import type { MatchStatus } from './calendar/domain/models.js';

/**
 * Provider-neutral transformation of a stored preview snapshot into an ordered, hashable application plan.
 *
 * The input is only the normalized `ImportPreviewItem` list (never a provider payload), the current local state and
 * the operator's explicit decisions. Identities come from persisted mappings or an explicit `link`; a name match only
 * produces candidates. Values of existing records follow a three-way rule: equal values are aligned, a value that
 * still equals the last imported baseline may be updated, and any other difference is a protected local value that
 * is kept unless the operator accepts the incoming value for that record.
 */

export type MappedResource = 'season' | 'teams' | 'stages' | 'rounds' | 'matches';
export type Baseline = Readonly<Record<string, string | number | null>>;
export interface Mapping {
  readonly localId: string;
  readonly baseline: Baseline | null;
}
export interface LocalLabel {
  readonly id: string;
  readonly label: string;
}
export interface LocalRound extends LocalLabel {
  readonly stageId: string | null;
}
export interface LocalMatch {
  readonly id: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly stageId: string | null;
  readonly roundId: string | null;
  readonly kickoffAt: string | null;
  readonly status: MatchStatus;
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly label: string;
}

/** Read-only view of local data needed by the transformation; the SQLite adapter lives in `import-local-state.ts`. */
export interface ImportLocalState {
  mapping(resource: MappedResource, scopeKey: string, externalId: string): Mapping | undefined;
  /** True when the local record already carries an identity of this provider resource in this competition. */
  isMapped(resource: MappedResource, localId: string): boolean;
  /** Local teams that carry this provider identity in another competition (evidence, never an automatic link). */
  teamsByIdentity(externalId: string): LocalLabel[];
  season(seasonId: string): LocalLabel | undefined;
  seasonsByLabel(normalizedLabel: string): LocalLabel[];
  team(teamId: string): LocalLabel | undefined;
  teamsByName(normalizedName: string): LocalLabel[];
  isCompetitionTeam(teamId: string): boolean;
  isParticipant(seasonId: string, teamId: string): boolean;
  stage(seasonId: string, stageId: string): LocalLabel | undefined;
  stagesByName(seasonId: string, normalizedName: string): LocalLabel[];
  round(seasonId: string, roundId: string): LocalRound | undefined;
  roundsByName(seasonId: string, stageId: string | null, normalizedName: string): LocalRound[];
  match(seasonId: string, matchId: string): LocalMatch | undefined;
  matchesBetween(seasonId: string, homeTeamId: string, awayTeamId: string): LocalMatch[];
}

/** A local identity: an existing row, or one created earlier in the same plan. */
export type Ref = { readonly id: string } | { readonly pending: string };
export interface MatchChange {
  kickoffAt?: string | null;
  status?: MatchStatus;
  score?: { home: number; away: number };
}
export type PlanStep =
  | { kind: 'season.create'; key: string; label: string }
  | { kind: 'team.create'; key: string; name: string }
  | { kind: 'competitionTeam.add'; team: Ref }
  | { kind: 'participant.add'; team: Ref }
  | { kind: 'stage.create'; key: string; name: string }
  | { kind: 'round.create'; key: string; stage: Ref | null; name: string }
  | {
      kind: 'match.create';
      key: string;
      home: Ref;
      away: Ref;
      stage: Ref | null;
      round: Ref | null;
      kickoffAt: string | null;
      status: MatchStatus;
      score: { home: number; away: number } | null;
    }
  | { kind: 'match.update'; matchId: string; change: MatchChange }
  | {
      kind: 'mapping.put';
      resource: MappedResource;
      scopeKey: string;
      externalId: string;
      externalLabel: string | null;
      local: Ref;
      origin: 'created' | 'linked';
      baseline: Baseline;
    };

export interface ImportPlan {
  readonly season: Ref | null;
  readonly destinationLabel: string;
  readonly destinationIsNew: boolean;
  readonly steps: readonly PlanStep[];
  readonly items: readonly ImportApplyPlanItem[];
  readonly decisions: readonly ImportApplyDecision[];
  readonly blockers: readonly { code: string; message: string; count: number }[];
  readonly warnings: readonly string[];
  readonly counts: ImportApplyCounts;
  readonly totals: {
    create: number;
    update: number;
    unchanged: number;
    keepLocal: number;
    skip: number;
    blocked: number;
  };
  readonly ready: boolean;
  readonly planHash: string;
}

export interface TransformInput {
  readonly competitionId: string;
  readonly snapshot: ImportPreview;
  /** External competition scope from the active provider binding, available even when season is not selected. */
  readonly externalCompetitionId?: string;
  readonly decisions: readonly ImportApplyDecision[];
  readonly state: ImportLocalState;
  /** Preview-level blockers established by the caller (expiry, stale fingerprint, binding change). */
  readonly blockers?: readonly { code: string; message: string }[];
}

const MATCH_STATUSES: readonly MatchStatus[] = ['scheduled', 'in_progress', 'finished', 'postponed', 'cancelled'];

export function emptyCounts(): ImportApplyCounts {
  return {
    seasonsCreated: 0,
    teamsCreated: 0,
    teamsReused: 0,
    associationsCreated: 0,
    participantsCreated: 0,
    stagesCreated: 0,
    roundsCreated: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    resultsApplied: 0,
    mappingsCreated: 0,
    unchanged: 0,
    skipped: 0,
    conflictsNotApplied: 0,
  };
}

export function decisionKey(resource: ImportResource, externalScope: string | null, externalId: string): string {
  return JSON.stringify([resource, externalScope ?? '', externalId]);
}

/**
 * Mapping scope. Every identity belongs to its local competition (ADR-01D-04, ADR-01D-07), including identities of
 * the global team catalogue; the external scope further separates provider IDs that are unique only per season.
 * Team references inside matches carry the external competition as scope, so team identities ignore it.
 */
export function mappingScope(competitionId: string, resource: MappedResource, externalScope: string | null): string {
  return `${competitionId}|${resource === 'teams' ? '' : (externalScope ?? '')}`;
}

function incoming(item: ImportPreviewItem, name: string) {
  return item.fields.find((field) => field.name === name)?.incomingValue ?? null;
}
function relation(item: ImportPreviewItem, role: ImportPreviewItem['relationships'][number]['role']) {
  return item.relationships.find((part) => part.role === role);
}
function sameRef(a: Ref | null, b: Ref | null) {
  if (a === null || b === null) return a === b;
  return 'id' in a ? 'id' in b && a.id === b.id : 'pending' in b && a.pending === b.pending;
}
function existingId(ref: Ref | null): string | null {
  return ref && 'id' in ref ? ref.id : null;
}
export function normalizeKickoff(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}
export function parseScore(value: unknown): { home: number; away: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = /^(\d{1,3})-(\d{1,3})$/.exec(value);
  return parsed ? { home: Number(parsed[1]), away: Number(parsed[2]) } : undefined;
}
function scoreText(home: number | null, away: number | null) {
  return home === null || away === null ? null : `${home}-${away}`;
}

/** Outcome of resolving one referenced identity. */
type Resolution =
  { state: 'ref'; ref: Ref; label: string } | { state: 'skipped' | 'blocked' | 'missing'; label: string };

export function transformSnapshot(input: TransformInput): ImportPlan {
  const { competitionId, snapshot, state } = input;
  const steps: PlanStep[] = [];
  const items: ImportApplyPlanItem[] = [];
  const blockers = new Map<string, { message: string; count: number }>();
  const warnings = new Set<string>();
  const block = (code: string, message: string) => {
    const current = blockers.get(code);
    if (current) current.count += 1;
    else blockers.set(code, { message, count: 1 });
  };
  for (const blocker of input.blockers ?? []) block(blocker.code, blocker.message);

  const decisionByKey = new Map<string, ImportApplyDecision>();
  for (const decision of input.decisions) {
    const key = decisionKey(decision.resource, decision.externalScope, decision.externalId);
    if (decisionByKey.has(key)) block('DECISION_DUPLICATED', 'Un registro tiene más de una decisión.');
    decisionByKey.set(key, decision);
  }
  const honoured: ImportApplyDecision[] = [];
  const consumed = new Set<string>();
  /** Decisions whose action is offered but whose target is not (for example a non-candidate `localId`). */
  const rejected = new Set<string>();

  const scope = (resource: MappedResource, item: { externalScope: string | null }) =>
    mappingScope(competitionId, resource, item.externalScope);
  const mappingOf = (resource: MappedResource, externalScope: string | null, externalId: string) =>
    state.mapping(resource, mappingScope(competitionId, resource, externalScope), externalId);
  const byResource = (resource: ImportResource) => snapshot.items.filter((item) => item.resource === resource);

  /** Records the plan line of one snapshot item and validates the decision taken for it. */
  const record = (
    item: ImportPreviewItem,
    action: ImportApplyPlanItem['action'],
    detail: {
      reason?: string | null;
      local?: LocalLabel | null;
      candidates?: readonly LocalLabel[];
      options?: readonly ImportApplyAction[];
      changes?: ImportApplyPlanItem['changes'];
      blockCode?: string;
    } = {},
  ) => {
    const key = decisionKey(item.resource, item.externalScope, item.externalId);
    const decision = decisionByKey.get(key);
    const options = [...(detail.options ?? [])];
    const valid = decision !== undefined && options.includes(decision.action) && !rejected.has(key);
    if (decision) {
      consumed.add(key);
      if (!valid)
        block(
          'DECISION_NOT_APPLICABLE',
          'Una decisión ya no corresponde a la propuesta actual. Revisa las decisiones.',
        );
      else honoured.push(decision);
    }
    if (action === 'blocked')
      block(
        detail.blockCode ?? `BLOCKED_${item.resource.toUpperCase()}`,
        detail.reason ?? 'Hay registros sin resolver.',
      );
    items.push({
      resource: item.resource,
      externalId: item.externalId,
      externalScope: item.externalScope,
      title: item.title,
      action,
      reason: detail.reason ?? null,
      localId: detail.local?.id ?? null,
      localLabel: detail.local?.label ?? null,
      candidates: (detail.candidates ?? []).slice(0, 20).map(({ id, label }) => ({ id, label })),
      options,
      decision: valid ? decision.action : null,
      changes: detail.changes ?? [],
    });
  };
  /** Applies an explicit link/skip decision to an identity that has local candidates but no mapping. */
  const decide = (item: ImportPreviewItem, candidates: readonly LocalLabel[], allowAccept = false) => {
    const decision = decisionByKey.get(decisionKey(item.resource, item.externalScope, item.externalId));
    if (!decision) return { kind: 'none' as const };
    if (decision.action === 'skip') return { kind: 'skip' as const };
    if (decision.action === 'link' || (allowAccept && decision.action === 'accept_incoming')) {
      const chosen = candidates.find((candidate) => candidate.id === decision.localId);
      if (chosen) return { kind: 'link' as const, local: chosen, accept: decision.action === 'accept_incoming' };
    }
    rejected.add(decisionKey(item.resource, item.externalScope, item.externalId));
    return { kind: 'invalid' as const };
  };
  const unresolved = (item: ImportPreviewItem) => item.operation === 'skipped';

  // 1. Season: an explicit preview destination, an existing mapping, an explicit link, or a new local season.
  let season: Ref | null = null;
  let seasonExists = false;
  let destinationLabel = 'Temporada local nueva';
  const seasonItem = byResource('season')[0];
  if (snapshot.destinationSeasonId) {
    const destination = state.season(snapshot.destinationSeasonId);
    if (!destination) block('DESTINATION_MISSING', 'La temporada de destino ya no existe en esta competición.');
    else {
      season = { id: destination.id };
      seasonExists = true;
      destinationLabel = destination.label;
    }
    if (seasonItem && destination) {
      const mapped = mappingOf('season', seasonItem.externalScope, seasonItem.externalId);
      if (mapped && mapped.localId !== destination.id)
        record(seasonItem, 'blocked', {
          reason: 'La temporada externa ya está vinculada con otra temporada local. Elige ese destino.',
          blockCode: 'SEASON_MAPPED_ELSEWHERE',
        });
      else if (!mapped && state.isMapped('season', destination.id))
        record(seasonItem, 'blocked', {
          reason: 'La temporada de destino ya está vinculada con otra temporada externa.',
          blockCode: 'SEASON_DESTINATION_MAPPED',
        });
      else {
        record(seasonItem, mapped ? 'reuse' : 'link', {
          local: destination,
          reason: 'Destino elegido en la vista previa.',
        });
        steps.push(seasonMapping(seasonItem, destination.id, mapped ? 'created' : 'linked'));
      }
    }
  } else if (!seasonItem) {
    const mapped = input.externalCompetitionId
      ? mappingOf('season', input.externalCompetitionId, snapshot.externalSeasonId)
      : undefined;
    const local = mapped ? state.season(mapped.localId) : undefined;
    if (mapped && local) {
      season = { id: local.id };
      seasonExists = true;
      destinationLabel = local.label;
      record(
        {
          resource: 'season',
          externalId: snapshot.externalSeasonId,
          externalScope: input.externalCompetitionId!,
          title: snapshot.externalSeasonLabel,
          operation: 'unchanged',
          localCandidate: { id: local.id, label: local.label },
          relationships: [],
          fields: [],
          warnings: [],
        },
        'reuse',
        { local, reason: 'Temporada resuelta mediante el mapping externo confirmado.' },
      );
    } else if (mapped) {
      block('SEASON_MAPPING_DANGLING', 'El mapping de temporada apunta a una temporada local que ya no existe.');
    } else {
      block(
        'DESTINATION_REQUIRED',
        'No hay una temporada local vinculada. Incluye «Temporada» o elige un destino local.',
      );
    }
  } else {
    const mapped = mappingOf('season', seasonItem.externalScope, seasonItem.externalId);
    const local = mapped ? state.season(mapped.localId) : undefined;
    const label = displayValue(String(incoming(seasonItem, 'label') ?? seasonItem.title));
    if (mapped && local) {
      season = { id: local.id };
      seasonExists = true;
      destinationLabel = local.label;
      record(seasonItem, 'reuse', { local });
      steps.push(seasonMapping(seasonItem, local.id, 'created'));
    } else if (mapped) {
      record(seasonItem, 'blocked', {
        reason: 'La temporada vinculada ya no existe localmente.',
        blockCode: 'SEASON_MAPPING_DANGLING',
      });
    } else if (!DisplayNameSchema.safeParse(label).success) {
      record(seasonItem, 'blocked', {
        reason: 'El nombre externo de la temporada no es compatible con el modelo local.',
        blockCode: 'SEASON_INVALID',
      });
    } else {
      const candidates = state.seasonsByLabel(identityKey(label)).filter((item) => !state.isMapped('season', item.id));
      const taken = state.seasonsByLabel(identityKey(label)).length > 0;
      const choice = decide(seasonItem, candidates);
      if (choice.kind === 'link') {
        season = { id: choice.local.id };
        seasonExists = true;
        destinationLabel = choice.local.label;
        record(seasonItem, 'link', { local: choice.local, candidates, options: ['link'] });
        steps.push(seasonMapping(seasonItem, choice.local.id, 'linked'));
      } else if (taken) {
        record(seasonItem, 'blocked', {
          reason: candidates.length
            ? 'Ya existe una temporada local con este nombre. Vincúlala explícitamente.'
            : 'Ya existe una temporada local con este nombre vinculada a otra fuente.',
          candidates,
          options: candidates.length ? ['link'] : [],
          blockCode: 'SEASON_NAME_TAKEN',
        });
      } else {
        const key = 'season';
        season = { pending: key };
        destinationLabel = label;
        steps.push({ kind: 'season.create', key, label });
        record(seasonItem, 'create');
        steps.push(seasonMapping(seasonItem, null, 'created', key, { label }));
      }
    }
  }
  const seasonId = seasonExists ? existingId(season) : null;
  function seasonMapping(
    item: ImportPreviewItem,
    id: string | null,
    origin: 'created' | 'linked',
    pending?: string,
    baseline: Baseline = {},
  ): PlanStep {
    return {
      kind: 'mapping.put',
      resource: 'season',
      scopeKey: scope('season', item),
      externalId: item.externalId,
      externalLabel: String(incoming(item, 'label') ?? item.title).slice(0, 200),
      local: id ? { id } : { pending: pending! },
      origin,
      baseline,
    };
  }

  // 2. Teams and their competition association.
  const teams = new Map<string, Resolution>();
  const plannedTeamNames = new Set<string>();
  const associated = new Set<string>();
  const associate = (ref: Ref) => {
    const key = 'id' in ref ? ref.id : ref.pending;
    if (associated.has(key)) return;
    associated.add(key);
    if ('pending' in ref || !state.isCompetitionTeam(ref.id)) steps.push({ kind: 'competitionTeam.add', team: ref });
  };
  for (const item of byResource('teams')) {
    const name = displayValue(String(incoming(item, 'name') ?? item.title));
    const mapped = mappingOf('teams', item.externalScope, item.externalId);
    const mapping = (local: Ref, origin: 'created' | 'linked'): PlanStep => ({
      kind: 'mapping.put',
      resource: 'teams',
      scopeKey: scope('teams', item),
      externalId: item.externalId,
      externalLabel: name.slice(0, 200) || null,
      local,
      origin,
      baseline: { name },
    });
    if (unresolved(item)) {
      teams.set(item.externalId, { state: 'skipped', label: item.title });
      record(item, 'skip', { reason: 'El proveedor no entregó este registro.' });
      continue;
    }
    if (mapped) {
      const local = state.team(mapped.localId);
      if (!local) {
        teams.set(item.externalId, { state: 'blocked', label: item.title });
        record(item, 'blocked', {
          reason: 'El equipo vinculado ya no existe localmente.',
          blockCode: 'TEAM_MAPPING_DANGLING',
        });
        continue;
      }
      teams.set(item.externalId, { state: 'ref', ref: { id: local.id }, label: local.label });
      const changes =
        identityKey(local.label) === identityKey(name)
          ? []
          : [{ field: 'name', localValue: local.label, incomingValue: name, applied: false }];
      record(item, 'reuse', {
        local,
        changes,
        reason: changes.length ? 'Se conserva el nombre del catálogo local.' : null,
      });
      associate({ id: local.id });
      steps.push(mapping({ id: local.id }, 'created'));
      continue;
    }
    const all = state.teamsByName(identityKey(name));
    const known = state.teamsByIdentity(item.externalId).filter((team) => !state.isMapped('teams', team.id));
    const candidates = [
      ...known,
      ...all.filter((team) => !state.isMapped('teams', team.id) && !known.some((other) => other.id === team.id)),
    ];
    const choice = decide(item, candidates);
    if (choice.kind === 'skip') {
      teams.set(item.externalId, { state: 'skipped', label: item.title });
      record(item, 'skip', { candidates, options: candidates.length ? ['link', 'skip'] : ['skip'] });
      continue;
    }
    if (choice.kind === 'link') {
      teams.set(item.externalId, { state: 'ref', ref: { id: choice.local.id }, label: choice.local.label });
      record(item, 'link', { local: choice.local, candidates, options: ['link', 'skip'] });
      associate({ id: choice.local.id });
      steps.push(mapping({ id: choice.local.id }, 'linked'));
      continue;
    }
    const validName = TeamNameSchema.safeParse(name).success;
    if (!validName || all.length > 0 || known.length > 0 || plannedTeamNames.has(identityKey(name))) {
      teams.set(item.externalId, { state: 'blocked', label: item.title });
      record(item, 'blocked', {
        reason: known.length
          ? 'Este equipo ya tiene la misma identidad externa en otra competición. Confirma el vínculo u omítelo.'
          : !validName
            ? 'El nombre del equipo no es compatible con el catálogo local.'
            : all.length > 0
              ? candidates.length
                ? 'Posible equipo duplicado: vincúlalo con un equipo local u omítelo.'
                : 'El nombre ya pertenece a un equipo vinculado a otra identidad externa.'
              : 'El snapshot contiene dos equipos externos con el mismo nombre.',
        candidates,
        options: candidates.length ? ['link', 'skip'] : ['skip'],
        blockCode: !validName ? 'TEAM_INVALID' : 'TEAM_IDENTITY_REQUIRED',
      });
      continue;
    }
    plannedTeamNames.add(identityKey(name));
    const key = `team:${item.externalId}`;
    teams.set(item.externalId, { state: 'ref', ref: { pending: key }, label: name });
    steps.push({ kind: 'team.create', key, name });
    record(item, 'create', { options: ['skip'] });
    associate({ pending: key });
    steps.push(mapping({ pending: key }, 'created'));
  }
  const resolveTeam = (externalId: string): Resolution => {
    const planned = teams.get(externalId);
    if (planned) return planned;
    const mapped = mappingOf('teams', null, externalId);
    const local = mapped ? state.team(mapped.localId) : undefined;
    if (local) {
      const ref = { id: local.id };
      teams.set(externalId, { state: 'ref', ref, label: local.label });
      associate(ref);
      return { state: 'ref', ref, label: local.label };
    }
    return { state: 'missing', label: externalId };
  };

  // 3. Season participants (explicit participant records and every team of an imported match).
  const enrolled = new Set<string>();
  const enroll = (ref: Ref) => {
    const key = 'id' in ref ? ref.id : ref.pending;
    if (enrolled.has(key)) return false;
    enrolled.add(key);
    associate(ref);
    if (!seasonId || 'pending' in ref || !state.isParticipant(seasonId, ref.id)) {
      steps.push({ kind: 'participant.add', team: ref });
      return true;
    }
    return false;
  };
  const dependency = (resolutions: readonly Resolution[]) => {
    const skipped = resolutions.find((item) => item.state === 'skipped');
    if (skipped) return { state: 'skipped' as const, reason: `Depende de «${skipped.label}», que no se importará.` };
    const blocked = resolutions.find((item) => item.state === 'blocked');
    if (blocked)
      return { state: 'blocked' as const, reason: `Depende de «${blocked.label}», que requiere una decisión.` };
    const missing = resolutions.find((item) => item.state === 'missing');
    if (missing)
      return {
        state: 'missing' as const,
        reason:
          'Depende de un registro que no está en la vista previa ni vinculado. Inclúyelo en una nueva vista previa.',
      };
    return null;
  };
  const dependent = (item: ImportPreviewItem, problem: NonNullable<ReturnType<typeof dependency>>) => {
    const choice = decisionByKey.get(decisionKey(item.resource, item.externalScope, item.externalId));
    if (problem.state === 'skipped' || choice?.action === 'skip')
      record(item, 'skip', { reason: problem.reason, options: ['skip'] });
    else
      record(item, 'blocked', {
        reason: problem.reason,
        options: ['skip'],
        blockCode: problem.state === 'missing' ? 'DEPENDENCY_MISSING' : 'DEPENDENCY_UNRESOLVED',
      });
  };
  for (const item of byResource('participants')) {
    const ref = relation(item, 'team');
    const team = ref ? resolveTeam(ref.externalId) : ({ state: 'missing', label: item.title } as const);
    const problem = dependency([team]);
    if (problem) {
      dependent(item, problem);
      continue;
    }
    if (team.state !== 'ref') continue;
    record(item, enroll(team.ref) ? 'create' : 'unchanged');
  }

  // 4. Stages. The visible title follows the local contract; the opaque provider label stays in the mapping.
  const stages = new Map<string, Resolution>();
  const plannedStageNames = new Set<string>();
  for (const item of byResource('stages')) {
    const name = displayValue(item.title);
    const externalLabel = String(incoming(item, 'name') ?? item.title).slice(0, 200);
    const mapped = mappingOf('stages', item.externalScope, item.externalId);
    const mapping = (local: Ref, origin: 'created' | 'linked'): PlanStep => ({
      kind: 'mapping.put',
      resource: 'stages',
      scopeKey: scope('stages', item),
      externalId: item.externalId,
      externalLabel,
      local,
      origin,
      baseline: { name },
    });
    if (mapped) {
      const local = seasonId ? state.stage(seasonId, mapped.localId) : undefined;
      if (!local) {
        stages.set(item.externalId, { state: 'blocked', label: item.title });
        record(item, 'blocked', {
          reason: 'La fase vinculada pertenece a otra temporada o ya no existe.',
          blockCode: 'STAGE_MAPPING_CONTEXT',
        });
        continue;
      }
      stages.set(item.externalId, { state: 'ref', ref: { id: local.id }, label: local.label });
      record(item, 'reuse', { local });
      steps.push(mapping({ id: local.id }, 'created'));
      continue;
    }
    const all = seasonId ? state.stagesByName(seasonId, identityKey(name)) : [];
    const candidates = all.filter((stage) => !state.isMapped('stages', stage.id));
    const choice = decide(item, candidates);
    if (choice.kind === 'skip') {
      stages.set(item.externalId, { state: 'skipped', label: item.title });
      record(item, 'skip', { candidates, options: candidates.length ? ['link', 'skip'] : ['skip'] });
    } else if (choice.kind === 'link') {
      stages.set(item.externalId, { state: 'ref', ref: { id: choice.local.id }, label: choice.local.label });
      record(item, 'link', { local: choice.local, candidates, options: ['link', 'skip'] });
      steps.push(mapping({ id: choice.local.id }, 'linked'));
    } else if (!DisplayNameSchema.safeParse(name).success || all.length || plannedStageNames.has(identityKey(name))) {
      stages.set(item.externalId, { state: 'blocked', label: item.title });
      record(item, 'blocked', {
        reason: !DisplayNameSchema.safeParse(name).success
          ? 'La fase externa no tiene un nombre local válido.'
          : candidates.length
            ? 'Ya existe una fase con este nombre en la temporada. Vincúlala u omítela.'
            : 'El nombre de la fase ya está ocupado en esta temporada.',
        candidates,
        options: candidates.length ? ['link', 'skip'] : ['skip'],
        blockCode: 'STAGE_IDENTITY_REQUIRED',
      });
    } else {
      plannedStageNames.add(identityKey(name));
      const key = `stage:${item.externalScope ?? ''}:${item.externalId}`;
      stages.set(item.externalId, { state: 'ref', ref: { pending: key }, label: name });
      steps.push({ kind: 'stage.create', key, name });
      record(item, 'create', {
        options: ['skip'],
        reason: externalLabel === name ? null : `Identificador externo conservado: ${externalLabel}`.slice(0, 240),
      });
      steps.push(mapping({ pending: key }, 'created'));
    }
  }
  const resolveStage = (ref: { externalId: string; externalScope: string | null }): Resolution => {
    const planned = stages.get(ref.externalId);
    if (planned) return planned;
    const mapped = mappingOf('stages', ref.externalScope, ref.externalId);
    const local = mapped && seasonId ? state.stage(seasonId, mapped.localId) : undefined;
    return local
      ? { state: 'ref', ref: { id: local.id }, label: local.label }
      : { state: 'missing', label: ref.externalId };
  };

  // 5. Rounds, in the provider's numbering order within each stage.
  const rounds = new Map<string, Resolution & { stage?: Ref | null }>();
  const plannedRoundNames = new Set<string>();
  const roundNumber = (item: ImportPreviewItem) =>
    Number(/:(\d+)$/.exec(item.externalId)?.[1] ?? Number.MAX_SAFE_INTEGER);
  const roundItems = byResource('rounds')
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const stageA = relation(a.item, 'stage')?.externalId ?? '';
      const stageB = relation(b.item, 'stage')?.externalId ?? '';
      return stageA === stageB ? roundNumber(a.item) - roundNumber(b.item) || a.index - b.index : a.index - b.index;
    })
    .map(({ item }) => item);
  for (const item of roundItems) {
    const stageRelation = relation(item, 'stage');
    const stage = stageRelation ? resolveStage(stageRelation) : null;
    const problem = stage ? dependency([stage]) : null;
    if (problem) {
      rounds.set(item.externalId, { state: problem.state === 'skipped' ? 'skipped' : 'blocked', label: item.title });
      dependent(item, problem);
      continue;
    }
    const stageRef = stage?.state === 'ref' ? stage.ref : null;
    const name = displayValue(item.title);
    const mapped = mappingOf('rounds', item.externalScope, item.externalId);
    const mapping = (local: Ref, origin: 'created' | 'linked'): PlanStep => ({
      kind: 'mapping.put',
      resource: 'rounds',
      scopeKey: scope('rounds', item),
      externalId: item.externalId,
      externalLabel: String(incoming(item, 'name') ?? item.title).slice(0, 200),
      local,
      origin,
      baseline: { name },
    });
    if (mapped) {
      const local = seasonId ? state.round(seasonId, mapped.localId) : undefined;
      if (!local || local.stageId !== existingId(stageRef)) {
        rounds.set(item.externalId, { state: 'blocked', label: item.title });
        record(item, 'blocked', {
          reason: 'La jornada vinculada ya no pertenece a la fase y temporada esperadas.',
          blockCode: 'ROUND_MAPPING_CONTEXT',
        });
        continue;
      }
      rounds.set(item.externalId, { state: 'ref', ref: { id: local.id }, label: local.label, stage: stageRef });
      record(item, 'reuse', { local });
      steps.push(mapping({ id: local.id }, 'created'));
      continue;
    }
    const stageId = existingId(stageRef);
    const all =
      seasonId && (stageRef === null || stageId !== null)
        ? state.roundsByName(seasonId, stageId, identityKey(name))
        : [];
    const candidates = all.filter((round) => !state.isMapped('rounds', round.id));
    const choice = decide(item, candidates);
    const plannedKey = JSON.stringify([stageRef, identityKey(name)]);
    if (choice.kind === 'skip') {
      rounds.set(item.externalId, { state: 'skipped', label: item.title });
      record(item, 'skip', { candidates, options: candidates.length ? ['link', 'skip'] : ['skip'] });
    } else if (choice.kind === 'link') {
      rounds.set(item.externalId, {
        state: 'ref',
        ref: { id: choice.local.id },
        label: choice.local.label,
        stage: stageRef,
      });
      record(item, 'link', { local: choice.local, candidates, options: ['link', 'skip'] });
      steps.push(mapping({ id: choice.local.id }, 'linked'));
    } else if (!DisplayNameSchema.safeParse(name).success || all.length || plannedRoundNames.has(plannedKey)) {
      rounds.set(item.externalId, { state: 'blocked', label: item.title });
      record(item, 'blocked', {
        reason: candidates.length
          ? 'Ya existe una jornada con este nombre en la misma fase. Vincúlala u omítela.'
          : 'La jornada no puede crearse con un nombre local único.',
        candidates,
        options: candidates.length ? ['link', 'skip'] : ['skip'],
        blockCode: 'ROUND_IDENTITY_REQUIRED',
      });
    } else {
      plannedRoundNames.add(plannedKey);
      const key = `round:${item.externalScope ?? ''}:${item.externalId}`;
      rounds.set(item.externalId, { state: 'ref', ref: { pending: key }, label: name, stage: stageRef });
      steps.push({ kind: 'round.create', key, stage: stageRef, name });
      record(item, 'create', { options: ['skip'] });
      steps.push(mapping({ pending: key }, 'created'));
    }
  }
  const resolveRound = (ref: { externalId: string; externalScope: string | null }) => {
    const planned = rounds.get(ref.externalId);
    if (planned) return planned;
    const mapped = mappingOf('rounds', ref.externalScope, ref.externalId);
    const local = mapped && seasonId ? state.round(seasonId, mapped.localId) : undefined;
    return local
      ? {
          state: 'ref' as const,
          ref: { id: local.id } as Ref,
          label: local.label,
          stage: local.stageId ? { id: local.stageId } : null,
        }
      : ({ state: 'missing', label: ref.externalId } as const);
  };

  // 6. Matches. New matches are created; mapped or explicitly linked matches follow the three-way field rule.
  interface PlannedMatch {
    ref: Ref;
    create: Extract<PlanStep, { kind: 'match.create' }> | null;
    existing: LocalMatch | null;
    change: MatchChange;
    /** Values aligned with the provider after this application (merged into the stored baseline). */
    baseline: Record<string, string | number | null>;
    /** Baseline stored by an earlier application; `null` for a record linked now (no imported history). */
    priorBaseline: Baseline | null;
    mapping: Extract<PlanStep, { kind: 'mapping.put' }>;
    inSnapshot: boolean;
  }
  const matches = new Map<string, PlannedMatch | Resolution>();
  const plannedMatches: PlannedMatch[] = [];
  const plannedMatchKeys = new Set<string>();
  const accepted = (item: ImportPreviewItem) =>
    decisionByKey.get(decisionKey(item.resource, item.externalScope, item.externalId))?.action === 'accept_incoming';
  /** Three-way merge of one field. Returns whether the incoming value is written. */
  const merge = (
    field: string,
    local: string | number | null,
    value: string | number | null,
    baseline: Baseline | null,
    accept: boolean,
    changes: ImportApplyPlanItem['changes'],
    aligned: Record<string, string | number | null>,
  ) => {
    if (local === value) {
      aligned[field] = value;
      return false;
    }
    const safe = baseline !== null && Object.hasOwn(baseline, field) && baseline[field] === local;
    const apply = safe || accept;
    changes.push({ field, localValue: local, incomingValue: value, applied: apply });
    if (apply) aligned[field] = value;
    return apply;
  };
  for (const item of byResource('matches')) {
    if (unresolved(item)) {
      record(item, 'skip', { reason: 'Esta selección no pudo consultarse en el proveedor.' });
      matches.set(item.externalId, { state: 'skipped', label: item.title });
      continue;
    }
    const status = incoming(item, 'estado');
    const kickoff = normalizeKickoff(incoming(item, 'fecha'));
    if (item.operation === 'invalid' || !MATCH_STATUSES.includes(status as MatchStatus) || kickoff === undefined) {
      record(item, 'skip', {
        reason: item.warnings[0] ?? 'El partido contiene un estado o una fecha que no puede importarse.',
      });
      warnings.add('Algunos partidos con estado o fecha no compatibles se omitirán.');
      matches.set(item.externalId, { state: 'skipped', label: item.title });
      continue;
    }
    const homeRelation = relation(item, 'home_team');
    const awayRelation = relation(item, 'away_team');
    const stageRelation = relation(item, 'stage');
    const roundRelation = relation(item, 'round');
    const home = homeRelation
      ? resolveTeam(homeRelation.externalId)
      : ({ state: 'missing', label: item.title } as const);
    const away = awayRelation
      ? resolveTeam(awayRelation.externalId)
      : ({ state: 'missing', label: item.title } as const);
    const stage = stageRelation ? resolveStage(stageRelation) : null;
    const round = roundRelation ? resolveRound(roundRelation) : null;
    const problem = dependency([home, away, ...(stage ? [stage] : []), ...(round ? [round] : [])]);
    if (problem) {
      dependent(item, problem);
      matches.set(item.externalId, { state: problem.state === 'skipped' ? 'skipped' : 'blocked', label: item.title });
      continue;
    }
    if (home.state !== 'ref' || away.state !== 'ref') continue;
    const stageRef = stage?.state === 'ref' ? stage.ref : null;
    const roundRef = round?.state === 'ref' ? round.ref : null;
    if (round?.state === 'ref' && !sameRef(round.stage ?? null, stageRef)) {
      record(item, 'blocked', {
        reason: 'La jornada del partido no pertenece a la fase indicada.',
        options: ['skip'],
        blockCode: 'MATCH_CONTEXT_INVALID',
      });
      matches.set(item.externalId, { state: 'blocked', label: item.title });
      continue;
    }
    if (sameRef(home.ref, away.ref)) {
      record(item, 'skip', { reason: 'El partido enfrenta al mismo equipo consigo mismo.' });
      matches.set(item.externalId, { state: 'skipped', label: item.title });
      continue;
    }
    const incomingStatus = status as MatchStatus;
    const mappingStep = (local: Ref, origin: 'created' | 'linked'): Extract<PlanStep, { kind: 'mapping.put' }> => ({
      kind: 'mapping.put',
      resource: 'matches',
      scopeKey: scope('matches', item),
      externalId: item.externalId,
      externalLabel: item.title,
      local,
      origin,
      baseline: {},
    });
    const mapped = mappingOf('matches', item.externalScope, item.externalId);
    const homeId = existingId(home.ref);
    const awayId = existingId(away.ref);
    const existingFor = (
      local: LocalMatch,
      baseline: Baseline | null,
      origin: 'created' | 'linked',
      accept: boolean,
    ) => {
      const changes: ImportApplyPlanItem['changes'] = [];
      const aligned: Record<string, string | number | null> = {};
      const change: MatchChange = {};
      if (merge('kickoffAt', local.kickoffAt, kickoff, baseline, accept, changes, aligned)) change.kickoffAt = kickoff;
      if (merge('status', local.status, incomingStatus, baseline, accept, changes, aligned))
        change.status = incomingStatus;
      const planned: PlannedMatch = {
        ref: { id: local.id },
        create: null,
        existing: local,
        change,
        baseline: aligned,
        priorBaseline: baseline,
        mapping: mappingStep({ id: local.id }, origin),
        inSnapshot: true,
      };
      return { planned, changes };
    };
    if (mapped) {
      const local = seasonId ? state.match(seasonId, mapped.localId) : undefined;
      if (!local || local.homeTeamId !== homeId || local.awayTeamId !== awayId) {
        record(item, 'blocked', {
          reason: 'El partido vinculado ya no coincide con la temporada o los equipos externos.',
          options: ['skip'],
          blockCode: 'MATCH_MAPPING_CONTEXT',
        });
        matches.set(item.externalId, { state: 'blocked', label: item.title });
        continue;
      }
      const { planned, changes } = existingFor(local, mapped.baseline, 'created', accepted(item));
      const protectedValues = changes.some((value) => !value.applied);
      record(item, changes.some((value) => value.applied) ? 'update' : protectedValues ? 'keep_local' : 'unchanged', {
        local: { id: local.id, label: local.label },
        changes,
        options: protectedValues || accepted(item) ? ['accept_incoming'] : [],
        reason: protectedValues ? 'El valor local difiere del último valor importado; se conserva.' : null,
      });
      matches.set(item.externalId, planned);
      plannedMatches.push(planned);
      continue;
    }
    const between = seasonId && homeId && awayId ? state.matchesBetween(seasonId, homeId, awayId) : [];
    const sameContext = between.filter(
      (local) =>
        (kickoff !== null && local.kickoffAt === kickoff) ||
        (roundRef !== null && 'id' in roundRef && local.roundId === roundRef.id),
    );
    const candidates = sameContext.filter((local) => !state.isMapped('matches', local.id));
    const candidateLabels = candidates.map((local) => ({ id: local.id, label: local.label }));
    const choice = decide(item, candidateLabels, true);
    if (choice.kind === 'skip') {
      record(item, 'skip', {
        candidates: candidateLabels,
        options: candidates.length ? ['link', 'accept_incoming', 'skip'] : ['skip'],
      });
      matches.set(item.externalId, { state: 'skipped', label: item.title });
      continue;
    }
    if (choice.kind === 'link') {
      const local = candidates.find((candidate) => candidate.id === choice.local.id)!;
      const { planned, changes } = existingFor(local, null, 'linked', choice.accept);
      record(item, 'link', {
        local: choice.local,
        candidates: candidateLabels,
        changes,
        options: ['link', 'accept_incoming', 'skip'],
        reason: changes.some((value) => !value.applied)
          ? 'Se vincula conservando los valores locales distintos.'
          : null,
      });
      matches.set(item.externalId, planned);
      plannedMatches.push(planned);
      continue;
    }
    const duplicateKey = JSON.stringify([home.ref, away.ref, stageRef, roundRef, kickoff]);
    const collides = between.some(
      (local) =>
        local.kickoffAt !== null &&
        local.kickoffAt === kickoff &&
        local.stageId === existingId(stageRef) &&
        local.roundId === existingId(roundRef),
    );
    if (candidates.length || collides || (kickoff !== null && plannedMatchKeys.has(duplicateKey))) {
      record(item, 'blocked', {
        reason: candidates.length
          ? 'Posible partido duplicado: vincúlalo con el partido local u omítelo.'
          : 'Ya existe un partido equivalente vinculado a otra identidad externa.',
        candidates: candidateLabels,
        options: candidates.length ? ['link', 'accept_incoming', 'skip'] : ['skip'],
        blockCode: 'MATCH_IDENTITY_REQUIRED',
      });
      matches.set(item.externalId, { state: 'blocked', label: item.title });
      continue;
    }
    plannedMatchKeys.add(duplicateKey);
    const key = `match:${item.externalScope ?? ''}:${item.externalId}`;
    enroll(home.ref);
    enroll(away.ref);
    const create: Extract<PlanStep, { kind: 'match.create' }> = {
      kind: 'match.create',
      key,
      home: home.ref,
      away: away.ref,
      stage: stageRef,
      round: roundRef,
      kickoffAt: kickoff,
      status: incomingStatus,
      score: null,
    };
    const planned: PlannedMatch = {
      ref: { pending: key },
      create,
      existing: null,
      change: {},
      baseline: { kickoffAt: kickoff, status: incomingStatus, homeScore: null, awayScore: null },
      priorBaseline: null,
      mapping: mappingStep({ pending: key }, 'created'),
      inSnapshot: true,
    };
    record(item, 'create', { options: ['skip'] });
    matches.set(item.externalId, planned);
    plannedMatches.push(planned);
  }
  const resolveMatch = (ref: { externalId: string; externalScope: string | null }): PlannedMatch | Resolution => {
    const planned = matches.get(ref.externalId);
    if (planned) return planned;
    const mapped = mappingOf('matches', ref.externalScope, ref.externalId);
    const local = mapped && seasonId ? state.match(seasonId, mapped.localId) : undefined;
    if (!local || !mapped) return { state: 'missing', label: ref.externalId };
    const resolved: PlannedMatch = {
      ref: { id: local.id },
      create: null,
      existing: local,
      change: {},
      baseline: {},
      priorBaseline: mapped.baseline,
      mapping: {
        kind: 'mapping.put',
        resource: 'matches',
        scopeKey: mappingScope(competitionId, 'matches', ref.externalScope),
        externalId: ref.externalId,
        externalLabel: null,
        local: { id: local.id },
        origin: 'created',
        baseline: {},
      },
      inSnapshot: false,
    };
    matches.set(ref.externalId, resolved);
    plannedMatches.push(resolved);
    return resolved;
  };

  // 7. Results. Unknown scores never appear as result records; `0-0` is an explicit score.
  for (const item of byResource('results')) {
    const score = parseScore(incoming(item, 'score'));
    const matchRelation = relation(item, 'match');
    const target = matchRelation ? resolveMatch(matchRelation) : ({ state: 'missing', label: item.title } as const);
    if ('state' in target) {
      const problem = dependency([target]);
      if (problem) dependent(item, problem);
      continue;
    }
    if (!score) {
      record(item, 'skip', { reason: 'El marcador externo no es válido.' });
      continue;
    }
    if (target.create) {
      target.create.score = score;
      target.baseline.homeScore = score.home;
      target.baseline.awayScore = score.away;
      record(item, 'create');
      continue;
    }
    const local = target.existing!;
    const baseline = target.priorBaseline;
    const localText = scoreText(local.homeScore, local.awayScore);
    const changes: ImportApplyPlanItem['changes'] = [];
    const incomingText = `${score.home}-${score.away}`;
    const accept = accepted(item);
    let apply = false;
    if (localText === incomingText) {
      target.baseline.homeScore = score.home;
      target.baseline.awayScore = score.away;
    } else {
      // An unknown local score is filled; a recorded one changes only while it still equals the imported baseline.
      const safe =
        localText === null ||
        (baseline !== null &&
          Object.hasOwn(baseline, 'homeScore') &&
          baseline.homeScore === local.homeScore &&
          baseline.awayScore === local.awayScore);
      apply = safe || accept;
      changes.push({ field: 'marcador', localValue: localText, incomingValue: incomingText, applied: apply });
      if (apply) {
        target.change.score = score;
        target.baseline.homeScore = score.home;
        target.baseline.awayScore = score.away;
      }
    }
    const protectedValue = changes.some((value) => !value.applied);
    record(item, apply ? 'update' : protectedValue ? 'keep_local' : 'unchanged', {
      local: { id: local.id, label: local.label },
      changes,
      options: protectedValue || accept ? ['accept_incoming'] : [],
      reason: protectedValue ? 'Hay un marcador local diferente; se conserva el valor local.' : null,
    });
  }

  // 8. Emit match steps after every result was folded into its match.
  for (const planned of plannedMatches) {
    if (planned.create) steps.push(planned.create);
    else if (Object.keys(planned.change).length)
      steps.push({ kind: 'match.update', matchId: existingId(planned.ref)!, change: planned.change });
    if (planned.inSnapshot || Object.keys(planned.baseline).length)
      steps.push({ ...planned.mapping, baseline: planned.baseline });
  }

  for (const key of decisionByKey.keys())
    if (!consumed.has(key))
      block('DECISION_NOT_APPLICABLE', 'Una decisión no corresponde a ningún registro de esta vista previa.');
  if (snapshot.summary.skipped > 0 || snapshot.warnings.some((warning) => warning.severity === 'error'))
    block(
      'SOURCE_INCOMPLETE',
      'Algunas selecciones no pudieron consultarse. Genera otra vista previa para importar el alcance completo.',
    );
  if (snapshot.warnings.some((warning) => warning.message.startsWith('Se limitaron las consultas')))
    block(
      'SOURCE_TRUNCATED',
      'La vista previa no contiene todas las selecciones del proveedor; no es seguro importarla.',
    );
  for (const warning of snapshot.warnings)
    if (warning.severity === 'info' || warning.severity === 'warning') warnings.add(warning.message);

  const counts = emptyCounts();
  for (const step of steps) {
    if (step.kind === 'season.create') counts.seasonsCreated += 1;
    else if (step.kind === 'team.create') counts.teamsCreated += 1;
    else if (step.kind === 'competitionTeam.add') counts.associationsCreated += 1;
    else if (step.kind === 'participant.add') counts.participantsCreated += 1;
    else if (step.kind === 'stage.create') counts.stagesCreated += 1;
    else if (step.kind === 'round.create') counts.roundsCreated += 1;
    else if (step.kind === 'match.create') {
      counts.matchesCreated += 1;
      if (step.score) counts.resultsApplied += 1;
    } else if (step.kind === 'match.update') {
      if (step.change.kickoffAt !== undefined || step.change.status !== undefined) counts.matchesUpdated += 1;
      if (step.change.score) counts.resultsApplied += 1;
    }
  }
  for (const item of items) {
    if (item.resource === 'teams' && (item.action === 'reuse' || item.action === 'link')) counts.teamsReused += 1;
    if (item.action === 'unchanged' || item.action === 'reuse') counts.unchanged += 1;
    if (item.action === 'skip') counts.skipped += 1;
    if (item.changes.some((change) => !change.applied) && item.resource !== 'teams' && item.resource !== 'stages')
      counts.conflictsNotApplied += 1;
  }
  const totals = {
    create: items.filter((item) => item.action === 'create').length,
    update: items.filter((item) => item.action === 'update' || item.action === 'link').length,
    unchanged: items.filter((item) => item.action === 'unchanged' || item.action === 'reuse').length,
    keepLocal: items.filter((item) => item.action === 'keep_local').length,
    skip: items.filter((item) => item.action === 'skip').length,
    blocked: items.filter((item) => item.action === 'blocked').length,
  };
  if (counts.conflictsNotApplied)
    warnings.add('Algunos valores locales distintos se conservarán; puedes aceptar el valor entrante por registro.');
  const blockerList = [...blockers.entries()].slice(0, 50).map(([code, value]) => ({ code, ...value }));
  const ready = blockerList.length === 0 && season !== null;
  const planHash = createHash('sha256')
    .update(
      JSON.stringify({
        previewId: snapshot.previewId,
        snapshotHash: snapshot.snapshotHash,
        season,
        steps,
        items: items.map((item) => [
          item.resource,
          item.externalScope,
          item.externalId,
          item.action,
          item.decision,
          item.localId,
        ]),
      }),
    )
    .digest('hex');
  return {
    season,
    destinationLabel,
    destinationIsNew: season !== null && 'pending' in season,
    steps,
    items,
    decisions: honoured,
    blockers: blockerList,
    warnings: [...warnings].slice(0, 50).map((warning) => warning.slice(0, 240)),
    counts,
    totals,
    ready,
    planHash,
  };
}
