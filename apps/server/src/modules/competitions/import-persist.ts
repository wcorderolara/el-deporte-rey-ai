import { randomUUID } from 'node:crypto';
import type { Db } from '../../platform/db/db.js';
import { CompetitionAdministrationService } from './application/CompetitionAdministrationService.js';
import { SQLiteCompetitionAdministrationRepository } from './infrastructure/SQLiteCompetitionAdministrationRepository.js';
import { CompetitionCalendarService } from './calendar/application/CompetitionCalendarService.js';
import { SQLiteCompetitionCalendarRepository } from './calendar/infrastructure/SQLiteCompetitionCalendarRepository.js';
import { emptyCounts, type ImportPlan, type Ref } from './import-transform.js';
import type { ImportApplyCounts } from '@edr/contracts';

export interface PersistContext {
  readonly db: Db;
  readonly competitionId: string;
  readonly providerKey: string;
  readonly bindingId: string;
  readonly applicationId: string;
  readonly now: () => Date;
}

/**
 * Executes a validated plan. Must run inside the caller's `BEGIN IMMEDIATE` transaction: every write goes through the
 * existing local domain services (whose own transactions become savepoints), so any thrown error rolls back the whole
 * application. Counts reflect the rows actually written by this execution.
 */
export function executePlan(
  plan: ImportPlan,
  context: PersistContext,
): { seasonId: string; counts: ImportApplyCounts } {
  const { db, competitionId } = context;
  if (!db.inTransaction) throw new Error('executePlan requires an open transaction');
  const options = { newId: randomUUID, now: context.now };
  const admin = new CompetitionAdministrationService(new SQLiteCompetitionAdministrationRepository(db), options);
  const calendar = new CompetitionCalendarService(new SQLiteCompetitionCalendarRepository(db), options);
  const created = new Map<string, string>();
  const resolve = (ref: Ref) => {
    if ('id' in ref) return ref.id;
    const id = created.get(ref.pending);
    if (!id) throw new Error('plan references an entity that was not created');
    return id;
  };
  const resolveOptional = (ref: Ref | null) => (ref === null ? null : resolve(ref));
  if (!plan.season) throw new Error('plan has no season');
  let seasonId = 'id' in plan.season ? plan.season.id : null;
  const season = () => {
    if (!seasonId) throw new Error('season referenced before creation');
    return seasonId;
  };
  const counts = { ...emptyCounts(), teamsReused: plan.counts.teamsReused, unchanged: plan.counts.unchanged };
  counts.skipped = plan.counts.skipped;
  counts.conflictsNotApplied = plan.counts.conflictsNotApplied;
  const at = () => context.now().toISOString();

  for (const step of plan.steps) {
    switch (step.kind) {
      case 'season.create': {
        const local = admin.createSeason(competitionId, step.label);
        created.set(step.key, local.id);
        seasonId = local.id;
        counts.seasonsCreated += 1;
        break;
      }
      case 'team.create': {
        created.set(step.key, admin.createTeam(step.name, null).id);
        counts.teamsCreated += 1;
        break;
      }
      case 'competitionTeam.add': {
        admin.addCompetitionTeam(competitionId, resolve(step.team));
        counts.associationsCreated += 1;
        break;
      }
      case 'participant.add': {
        admin.addParticipant(competitionId, season(), resolve(step.team));
        counts.participantsCreated += 1;
        break;
      }
      case 'stage.create': {
        created.set(step.key, calendar.createStage(competitionId, season(), step.name).id);
        counts.stagesCreated += 1;
        break;
      }
      case 'round.create': {
        created.set(step.key, calendar.createRound(competitionId, season(), resolveOptional(step.stage), step.name).id);
        counts.roundsCreated += 1;
        break;
      }
      case 'match.create': {
        const match = calendar.createMatch(competitionId, season(), {
          homeTeamId: resolve(step.home),
          awayTeamId: resolve(step.away),
          kickoffAt: step.kickoffAt,
          stageId: resolveOptional(step.stage),
          roundId: resolveOptional(step.round),
        });
        created.set(step.key, match.id);
        if (step.status !== 'scheduled' || step.score)
          calendar.updateResult(
            competitionId,
            season(),
            match.id,
            step.status,
            step.score?.home ?? null,
            step.score?.away ?? null,
          );
        counts.matchesCreated += 1;
        if (step.score) counts.resultsApplied += 1;
        break;
      }
      case 'match.update': {
        const { change } = step;
        if (change.kickoffAt !== undefined)
          calendar.updateSchedule(competitionId, season(), step.matchId, { kickoffAt: change.kickoffAt });
        if (change.status !== undefined || change.score) {
          const current = calendar.getMatch(competitionId, season(), step.matchId);
          calendar.updateResult(
            competitionId,
            season(),
            step.matchId,
            change.status ?? current.status,
            change.score ? change.score.home : current.homeScore,
            change.score ? change.score.away : current.awayScore,
          );
        }
        if (change.kickoffAt !== undefined || change.status !== undefined) counts.matchesUpdated += 1;
        if (change.score) counts.resultsApplied += 1;
        break;
      }
      case 'mapping.put': {
        const localId = resolve(step.local);
        const existing = db
          .prepare<{ id: string; local_id: string; baseline_json: string | null }>(
            'SELECT id, local_id, baseline_json FROM external_identity_mappings WHERE provider_key = ? AND resource = ? AND scope_key = ? AND external_id = ?',
          )
          .get([context.providerKey, step.resource, step.scopeKey, step.externalId]);
        if (existing) {
          // A confirmed identity is never re-pointed by an application; the plan validated the same local record.
          if (existing.local_id !== localId) throw new Error('mapping points to another local record');
          const baseline = {
            ...(existing.baseline_json ? (JSON.parse(existing.baseline_json) as object) : {}),
            ...step.baseline,
          };
          db.prepare(
            'UPDATE external_identity_mappings SET baseline_json = ?, external_label = COALESCE(?, external_label), last_application_id = ?, updated_at = ? WHERE id = ?',
          ).run([JSON.stringify(baseline), step.externalLabel, context.applicationId, at(), existing.id]);
        } else {
          const now = at();
          db.prepare(
            'INSERT INTO external_identity_mappings (id, provider_key, resource, scope_key, external_id, local_id, created_at, updated_at, competition_id, binding_id, external_label, origin, baseline_json, last_application_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ).run([
            randomUUID(),
            context.providerKey,
            step.resource,
            step.scopeKey,
            step.externalId,
            localId,
            now,
            now,
            competitionId,
            context.bindingId,
            step.externalLabel,
            step.origin,
            JSON.stringify(step.baseline),
            context.applicationId,
          ]);
          counts.mappingsCreated += 1;
        }
        break;
      }
    }
  }
  return { seasonId: season(), counts };
}
