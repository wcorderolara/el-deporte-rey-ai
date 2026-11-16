import {
  CompetitionMatchCreateSchema,
  CompetitionMatchListResponseSchema,
  CompetitionMatchParamsSchema,
  CompetitionMatchResultUpdateSchema,
  CompetitionMatchScheduleUpdateSchema,
  CompetitionMatchSchema,
  CompetitionMatchesParamsSchema,
  CompetitionRoundCreateSchema,
  CompetitionRoundListResponseSchema,
  CompetitionRoundParamsSchema,
  CompetitionRoundSchema,
  CompetitionRoundsParamsSchema,
  CompetitionStageCreateSchema,
  CompetitionStageListResponseSchema,
  CompetitionStageParamsSchema,
  CompetitionStageSchema,
  CompetitionStageRoundsParamsSchema,
  CompetitionCalendarNameUpdateSchema,
  CompetitionRoundUpdateSchema,
  MatchResultHistoryListResponseSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import { contractResponse } from '../../projects/respond.js';
import { HttpProblem } from '../../../platform/http/problem.js';
import { CalendarError } from './domain/errors.js';
import type { CompetitionCalendarService } from './application/CompetitionCalendarService.js';

function mapError(error: unknown): unknown {
  if (!(error instanceof CalendarError)) return error;
  switch (error.code) {
    case 'competition_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'La competición no existe.');
    case 'season_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'La temporada no existe en esta competición.');
    case 'stage_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'La fase no existe en esta temporada.');
    case 'round_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'La jornada o ronda no existe en esta temporada.');
    case 'match_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'El partido no existe en esta temporada.');
    case 'team_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'El equipo no existe.');
    case 'team_not_participant':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Ambos equipos deben participar en esta temporada.');
    case 'duplicate_match':
      return new HttpProblem(409, 'DUPLICATE_MATCH', 'Ya existe ese encuentro en el mismo contexto y horario.');
    case 'duplicate_stage':
      return new HttpProblem(409, 'DUPLICATE_STAGE', 'Ya existe una fase con ese nombre en esta temporada.');
    case 'duplicate_round':
      return new HttpProblem(409, 'DUPLICATE_ROUND', 'Ya existe una jornada o ronda con ese nombre en este contexto.');
    case 'invalid_calendar_name':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Escribe un nombre para la fase, jornada o ronda.');
    case 'calendar_changed':
      return new HttpProblem(
        409,
        'VERSION_CONFLICT',
        'El calendario cambió mientras se actualizaba. Vuelve a cargar la temporada e inténtalo de nuevo.',
      );
    case 'invalid_team_pair':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Selecciona dos equipos distintos.');
    case 'invalid_stage_round':
      return new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'La fase y la jornada deben pertenecer a esta temporada y contexto.',
      );
    case 'invalid_match_status':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Revisa el estado del partido.');
    case 'invalid_match_scores':
      return new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'Ingresa ambos marcadores como enteros no negativos o deja ambos sin registrar.',
      );
    case 'round_in_use':
      return new HttpProblem(
        409,
        'ROUND_HAS_MATCHES',
        'No se puede eliminar esta jornada porque tiene partidos o historial asociado.',
      );
  }
}

async function translated<T>(action: () => T | Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw mapError(error);
  }
}

export function registerCompetitionCalendarRoutes(app: FastifyInstance, calendar: CompetitionCalendarService): void {
  app.get('/competitions/:competitionId/seasons/:seasonId/stages', async (request) =>
    translated(() => {
      const { competitionId, seasonId } = CompetitionRoundsParamsSchema.parse(request.params);
      return contractResponse(CompetitionStageListResponseSchema, {
        stages: calendar.listStages(competitionId, seasonId),
      });
    }),
  );
  app.post('/competitions/:competitionId/seasons/:seasonId/stages', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId } = CompetitionRoundsParamsSchema.parse(request.params);
      const body = CompetitionStageCreateSchema.parse(request.body);
      return reply
        .code(201)
        .send(
          contractResponse(
            CompetitionStageSchema,
            calendar.createStage(competitionId, seasonId, body.name, body.displayOrder),
          ),
        );
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId/stages/:stageId', async (request) =>
    translated(() => {
      const { competitionId, seasonId, stageId } = CompetitionStageParamsSchema.parse(request.params);
      return contractResponse(CompetitionStageSchema, calendar.getStage(competitionId, seasonId, stageId));
    }),
  );
  app.patch('/competitions/:competitionId/seasons/:seasonId/stages/:stageId', async (request) =>
    translated(() => {
      const { competitionId, seasonId, stageId } = CompetitionStageParamsSchema.parse(request.params);
      const body = CompetitionCalendarNameUpdateSchema.parse(request.body);
      return contractResponse(
        CompetitionStageSchema,
        calendar.updateStage(competitionId, seasonId, stageId, body.name),
      );
    }),
  );

  app.get('/competitions/:competitionId/seasons/:seasonId/rounds', async (request) =>
    translated(() => {
      const { competitionId, seasonId } = CompetitionRoundsParamsSchema.parse(request.params);
      return contractResponse(CompetitionRoundListResponseSchema, {
        rounds: calendar.listRounds(competitionId, seasonId, null),
      });
    }),
  );
  app.post('/competitions/:competitionId/seasons/:seasonId/rounds', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId } = CompetitionRoundsParamsSchema.parse(request.params);
      const body = CompetitionRoundCreateSchema.parse(request.body);
      return reply
        .code(201)
        .send(
          contractResponse(
            CompetitionRoundSchema,
            calendar.createRound(competitionId, seasonId, null, body.name, body.displayOrder),
          ),
        );
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId/rounds/:roundId', async (request) =>
    translated(() => {
      const { competitionId, seasonId, roundId } = CompetitionRoundParamsSchema.parse(request.params);
      return contractResponse(CompetitionRoundSchema, calendar.getRound(competitionId, seasonId, roundId));
    }),
  );
  app.patch('/competitions/:competitionId/seasons/:seasonId/rounds/:roundId', async (request) =>
    translated(() => {
      const { competitionId, seasonId, roundId } = CompetitionRoundParamsSchema.parse(request.params);
      const body = CompetitionRoundUpdateSchema.parse(request.body);
      return contractResponse(CompetitionRoundSchema, calendar.updateRound(competitionId, seasonId, roundId, body));
    }),
  );
  app.delete('/competitions/:competitionId/seasons/:seasonId/rounds/:roundId', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId, roundId } = CompetitionRoundParamsSchema.parse(request.params);
      calendar.deleteRound(competitionId, seasonId, roundId);
      return reply.code(204).send();
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId/stages/:stageId/rounds', async (request) =>
    translated(() => {
      const { competitionId, seasonId, stageId } = CompetitionStageRoundsParamsSchema.parse(request.params);
      return contractResponse(CompetitionRoundListResponseSchema, {
        rounds: calendar.listRounds(competitionId, seasonId, stageId),
      });
    }),
  );
  app.post('/competitions/:competitionId/seasons/:seasonId/stages/:stageId/rounds', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId, stageId } = CompetitionStageRoundsParamsSchema.parse(request.params);
      const body = CompetitionRoundCreateSchema.parse(request.body);
      return reply
        .code(201)
        .send(
          contractResponse(
            CompetitionRoundSchema,
            calendar.createRound(competitionId, seasonId, stageId, body.name, body.displayOrder),
          ),
        );
    }),
  );

  app.get('/competitions/:competitionId/seasons/:seasonId/matches', async (request) =>
    translated(() => {
      const { competitionId, seasonId } = CompetitionMatchesParamsSchema.parse(request.params);
      return contractResponse(CompetitionMatchListResponseSchema, {
        matches: calendar.listMatches(competitionId, seasonId),
      });
    }),
  );
  app.post('/competitions/:competitionId/seasons/:seasonId/matches', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId } = CompetitionMatchesParamsSchema.parse(request.params);
      const body = CompetitionMatchCreateSchema.parse(request.body);
      const match = calendar.createMatch(competitionId, seasonId, {
        homeTeamId: body.homeTeamId,
        awayTeamId: body.awayTeamId,
        kickoffAt: body.kickoffAt ?? null,
        stageId: body.stageId ?? null,
        roundId: body.roundId ?? null,
      });
      return reply.code(201).send(contractResponse(CompetitionMatchSchema, match));
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId/matches/:matchId', async (request) =>
    translated(() => {
      const { competitionId, seasonId, matchId } = CompetitionMatchParamsSchema.parse(request.params);
      return contractResponse(CompetitionMatchSchema, calendar.getMatch(competitionId, seasonId, matchId));
    }),
  );
  app.patch('/competitions/:competitionId/seasons/:seasonId/matches/:matchId/schedule', async (request) =>
    translated(() => {
      const { competitionId, seasonId, matchId } = CompetitionMatchParamsSchema.parse(request.params);
      const body = CompetitionMatchScheduleUpdateSchema.parse(request.body);
      return contractResponse(CompetitionMatchSchema, calendar.updateSchedule(competitionId, seasonId, matchId, body));
    }),
  );
  app.post('/competitions/:competitionId/seasons/:seasonId/matches/:matchId/result', async (request) =>
    translated(() => {
      const { competitionId, seasonId, matchId } = CompetitionMatchParamsSchema.parse(request.params);
      const body = CompetitionMatchResultUpdateSchema.parse(request.body);
      return contractResponse(
        CompetitionMatchSchema,
        calendar.updateResult(competitionId, seasonId, matchId, body.status, body.homeScore, body.awayScore),
      );
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId/matches/:matchId/result-history', async (request) =>
    translated(() => {
      const { competitionId, seasonId, matchId } = CompetitionMatchParamsSchema.parse(request.params);
      return contractResponse(MatchResultHistoryListResponseSchema, {
        history: calendar.listResultHistory(competitionId, seasonId, matchId),
      });
    }),
  );
}
