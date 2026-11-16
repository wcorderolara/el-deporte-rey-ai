import { displayValue, identityKey } from '../../domain/identity.js';
import { CalendarError } from '../domain/errors.js';
import type { MatchStatus } from '../domain/models.js';
import type { CompetitionCalendarPort, MatchSchedulePatch } from '../domain/port.js';

export interface CalendarOptions {
  readonly newId: () => string;
  readonly now: () => Date;
  readonly transaction?: <T>(action: () => T) => T;
  readonly onManualMutation?: (mutation: {
    competitionId: string;
    entityType: 'stage' | 'round' | 'match' | 'result';
    entityId: string;
    fields: Readonly<Record<string, string | number | null>>;
  }) => void;
}

function nextOrder(values: readonly { displayOrder: number }[]): number {
  return values.reduce((max, value) => Math.max(max, value.displayOrder), -1) + 1;
}

function validPair(homeScore: number | null, awayScore: number | null): boolean {
  return (homeScore === null && awayScore === null) || (homeScore !== null && awayScore !== null);
}

export class CompetitionCalendarService {
  readonly #repository: CompetitionCalendarPort;
  readonly #newId: () => string;
  readonly #now: () => Date;
  readonly #transaction: <T>(action: () => T) => T;
  readonly #onManualMutation?: CalendarOptions['onManualMutation'];

  constructor(repository: CompetitionCalendarPort, options: CalendarOptions) {
    this.#repository = repository;
    this.#newId = options.newId;
    this.#now = options.now;
    this.#transaction = options.transaction ?? ((action) => action());
    this.#onManualMutation = options.onManualMutation;
  }

  listStages(competitionId: string, seasonId: string) {
    return this.#repository.listStages(competitionId, seasonId);
  }
  getStage(competitionId: string, seasonId: string, stageId: string) {
    return this.#repository.getStage(competitionId, seasonId, stageId);
  }

  createStage(competitionId: string, seasonId: string, rawName: string, displayOrder?: number) {
    const name = displayValue(rawName);
    if (!name) throw new CalendarError('invalid_calendar_name');
    const existing = this.listStages(competitionId, seasonId);
    return this.#repository.createStage(competitionId, {
      id: this.#newId(),
      seasonId,
      name,
      normalizedName: identityKey(name),
      displayOrder: displayOrder ?? nextOrder(existing),
      createdAt: this.#now().toISOString(),
    });
  }

  updateStage(competitionId: string, seasonId: string, stageId: string, rawName: string) {
    const name = displayValue(rawName);
    if (!name) throw new CalendarError('invalid_calendar_name');
    return this.#transaction(() => {
      const updated = this.#repository.updateStage(competitionId, seasonId, stageId, {
        name,
        normalizedName: identityKey(name),
      });
      this.#onManualMutation?.({ competitionId, entityType: 'stage', entityId: stageId, fields: { name } });
      return updated;
    });
  }

  listRounds(competitionId: string, seasonId: string, stageId: string | null) {
    return this.#repository.listRounds(competitionId, seasonId, stageId);
  }
  getRound(competitionId: string, seasonId: string, roundId: string) {
    return this.#repository.getRound(competitionId, seasonId, roundId);
  }

  createRound(competitionId: string, seasonId: string, stageId: string | null, rawName: string, displayOrder?: number) {
    const name = displayValue(rawName);
    if (!name) throw new CalendarError('invalid_calendar_name');
    const existing = this.listRounds(competitionId, seasonId, stageId);
    return this.#repository.createRound(competitionId, {
      id: this.#newId(),
      seasonId,
      stageId,
      name,
      normalizedName: identityKey(name),
      displayOrder: displayOrder ?? nextOrder(existing),
      createdAt: this.#now().toISOString(),
    });
  }

  updateRound(
    competitionId: string,
    seasonId: string,
    roundId: string,
    input: { name?: string; stageId?: string | null },
  ) {
    const current = this.#repository.getRound(competitionId, seasonId, roundId);
    const name = input.name === undefined ? current.name : displayValue(input.name);
    if (!name) throw new CalendarError('invalid_calendar_name');
    const targetStageId = input.stageId === undefined ? current.stageId : input.stageId;
    const history =
      targetStageId === current.stageId
        ? []
        : this.#repository
            .listMatches(competitionId, seasonId)
            .filter((match) => match.round?.id === roundId)
            .map((match) => ({ matchId: match.id, id: this.#newId() }));
    return this.#transaction(() => {
      const updated = this.#repository.updateRound(
        competitionId,
        seasonId,
        roundId,
        {
          ...(input.name === undefined ? {} : { name, normalizedName: identityKey(name) }),
          ...(input.stageId === undefined ? {} : { stageId: targetStageId }),
        },
        history,
        this.#now().toISOString(),
      );
      this.#onManualMutation?.({
        competitionId,
        entityType: 'round',
        entityId: roundId,
        fields: {
          ...(input.name === undefined ? {} : { name }),
          ...(input.stageId === undefined ? {} : { stageId: targetStageId }),
        },
      });
      return updated;
    });
  }
  deleteRound(competitionId: string, seasonId: string, roundId: string) {
    return this.#repository.deleteRound(competitionId, seasonId, roundId);
  }

  listMatches(competitionId: string, seasonId: string) {
    return this.#repository.listMatches(competitionId, seasonId);
  }
  getMatch(competitionId: string, seasonId: string, matchId: string) {
    return this.#repository.getMatch(competitionId, seasonId, matchId);
  }
  listParticipants(competitionId: string, seasonId: string) {
    return this.#repository.listParticipants(competitionId, seasonId);
  }

  createMatch(
    competitionId: string,
    seasonId: string,
    input: {
      homeTeamId: string;
      awayTeamId: string;
      kickoffAt: string | null;
      stageId: string | null;
      roundId: string | null;
    },
  ) {
    if (input.homeTeamId === input.awayTeamId) throw new CalendarError('invalid_team_pair');
    if (input.roundId && !input.stageId) {
      const round = this.#repository.getRound(competitionId, seasonId, input.roundId);
      input = { ...input, stageId: round.stageId };
    }
    if (input.roundId) {
      const round = this.#repository.getRound(competitionId, seasonId, input.roundId);
      if (round.stageId !== input.stageId) throw new CalendarError('invalid_stage_round');
    }
    const kickoffAt = input.kickoffAt === null ? null : new Date(input.kickoffAt).toISOString();
    const at = this.#now().toISOString();
    const match = this.#repository.createMatch(competitionId, {
      id: this.#newId(),
      historyId: this.#newId(),
      seasonId,
      ...input,
      kickoffAt,
      createdAt: at,
      updatedAt: at,
    });
    return match;
  }

  updateSchedule(competitionId: string, seasonId: string, matchId: string, patch: MatchSchedulePatch) {
    const current = this.#repository.getMatchCurrent(competitionId, seasonId, matchId);
    const next = { ...patch };
    const targetRoundId = Object.hasOwn(next, 'roundId') ? (next.roundId ?? null) : current.roundId;
    let targetStageId = Object.hasOwn(next, 'stageId') ? (next.stageId ?? null) : current.stageId;
    if (targetRoundId) {
      const round = this.#repository.getRound(competitionId, seasonId, targetRoundId);
      if (!Object.hasOwn(next, 'stageId')) targetStageId = round.stageId;
      if (round.stageId !== targetStageId) throw new CalendarError('invalid_stage_round');
    }
    next.stageId = targetStageId;
    next.roundId = targetRoundId;
    if (next.kickoffAt !== undefined && next.kickoffAt !== null)
      next.kickoffAt = new Date(next.kickoffAt).toISOString();
    return this.#transaction(() => {
      const updated = this.#repository.updateSchedule(
        competitionId,
        seasonId,
        matchId,
        next,
        this.#newId(),
        this.#now().toISOString(),
      );
      this.#onManualMutation?.({
        competitionId,
        entityType: 'match',
        entityId: matchId,
        fields: {
          ...(patch.kickoffAt === undefined ? {} : { kickoffAt: next.kickoffAt ?? null }),
          ...(patch.stageId === undefined ? {} : { stageId: targetStageId }),
          ...(patch.roundId === undefined ? {} : { roundId: targetRoundId }),
        },
      });
      return updated;
    });
  }

  updateResult(
    competitionId: string,
    seasonId: string,
    matchId: string,
    status: MatchStatus,
    homeScore?: number | null,
    awayScore?: number | null,
  ) {
    const current = this.#repository.getMatchCurrent(competitionId, seasonId, matchId);
    const nextHomeScore = homeScore === undefined ? current.homeScore : homeScore;
    const nextAwayScore = awayScore === undefined ? current.awayScore : awayScore;
    if (!validPair(nextHomeScore, nextAwayScore)) throw new CalendarError('invalid_match_scores');
    const statusChanged = status !== current.status;
    const scoreChanged = nextHomeScore !== current.homeScore || nextAwayScore !== current.awayScore;
    if (!statusChanged && !scoreChanged) return this.#repository.getMatch(competitionId, seasonId, matchId);
    const recordingFirstScore = current.homeScore === null && nextHomeScore !== null;
    const changeType = scoreChanged ? (recordingFirstScore ? 'result_recorded' : 'result_corrected') : 'status_updated';
    return this.#transaction(() => {
      const updated = this.#repository.updateResult(
        competitionId,
        seasonId,
        matchId,
        status,
        nextHomeScore,
        nextAwayScore,
        this.#newId(),
        this.#now().toISOString(),
        changeType,
      );
      if (statusChanged)
        this.#onManualMutation?.({ competitionId, entityType: 'match', entityId: matchId, fields: { status } });
      if (scoreChanged)
        this.#onManualMutation?.({
          competitionId,
          entityType: 'result',
          entityId: matchId,
          fields: { homeScore: nextHomeScore, awayScore: nextAwayScore },
        });
      return updated;
    });
  }

  listResultHistory(competitionId: string, seasonId: string, matchId: string) {
    return this.#repository.listResultHistory(competitionId, seasonId, matchId);
  }
}
