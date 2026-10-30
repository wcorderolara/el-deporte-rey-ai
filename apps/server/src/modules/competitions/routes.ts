import {
  ManagedCompetitionCreateSchema,
  ManagedCompetitionListResponseSchema,
  ManagedCompetitionParamsSchema,
  ManagedCompetitionSchema,
  ManagedSeasonCreateSchema,
  ManagedSeasonListResponseSchema,
  ManagedSeasonParamsSchema,
  ManagedSeasonSchema,
  ManagedTeamCreateSchema,
  ManagedTeamListResponseSchema,
  ManagedTeamParamsSchema,
  ManagedTeamSchema,
  SeasonParticipantCreateSchema,
  SeasonParticipantListResponseSchema,
  SeasonParticipantParamsSchema,
  SeasonParticipantsParamsSchema,
  SeasonParticipantSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import { contractResponse } from '../projects/respond.js';
import type { CompetitionService } from './service.js';
import type { CompetitionAdministrationService } from './application/CompetitionAdministrationService.js';
import { CompetitionAdministrationError } from './domain/errors.js';
import { HttpProblem } from '../../platform/http/problem.js';

function httpError(error: unknown): unknown {
  if (!(error instanceof CompetitionAdministrationError)) return error;
  switch (error.code) {
    case 'competition_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'La competición no existe.');
    case 'season_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'La temporada no existe en esta competición.');
    case 'team_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'El equipo no existe en el catálogo local.');
    case 'participant_not_found':
      return new HttpProblem(404, 'NOT_FOUND', 'El equipo no participa en esta temporada.');
    case 'duplicate_season':
      return new HttpProblem(409, 'DUPLICATE_SEASON', 'Ya existe una temporada con ese nombre en esta competición.');
    case 'duplicate_team':
      return new HttpProblem(
        409,
        'DUPLICATE_TEAM',
        'Ya existe un equipo con el mismo nombre y zona. Selecciónalo del catálogo local.',
      );
    case 'duplicate_participant':
      return new HttpProblem(409, 'DUPLICATE_PARTICIPANT', 'El equipo ya está asociado a esta temporada.');
    case 'invalid_season_label':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Escribe un nombre de temporada.', {
        errors: [{ path: '/label', message: 'El nombre debe contener al menos un carácter visible.' }],
      });
    case 'invalid_team_name':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Escribe el nombre del equipo.', {
        errors: [{ path: '/name', message: 'El nombre debe contener al menos un carácter visible.' }],
      });
    case 'invalid_team_region':
      return new HttpProblem(400, 'VALIDATION_FAILED', 'Revisa la zona o ciudad del equipo.', {
        errors: [{ path: '/region', message: 'La zona debe contener texto o dejarse vacía.' }],
      });
  }
}

async function translated<T>(action: () => T | Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw httpError(error);
  }
}

export function registerCompetitionRoutes(
  app: FastifyInstance,
  service: CompetitionService,
  administration: CompetitionAdministrationService,
): void {
  app.get('/competitions', async () =>
    contractResponse(ManagedCompetitionListResponseSchema, { competitions: service.list() }),
  );
  app.post('/competitions', async (request, reply) => {
    const item = service.create(ManagedCompetitionCreateSchema.parse(request.body));
    return reply.code(201).send(contractResponse(ManagedCompetitionSchema, item));
  });
  app.get('/competitions/:competitionId', async (request) => {
    const { competitionId } = ManagedCompetitionParamsSchema.parse(request.params);
    return contractResponse(ManagedCompetitionSchema, service.get(competitionId));
  });

  app.get('/competitions/:competitionId/seasons', async (request) =>
    translated(() => {
      const { competitionId } = ManagedCompetitionParamsSchema.parse(request.params);
      return contractResponse(ManagedSeasonListResponseSchema, { seasons: administration.listSeasons(competitionId) });
    }),
  );
  app.post('/competitions/:competitionId/seasons', async (request, reply) =>
    translated(() => {
      const { competitionId } = ManagedCompetitionParamsSchema.parse(request.params);
      const body = ManagedSeasonCreateSchema.parse(request.body);
      return reply
        .code(201)
        .send(contractResponse(ManagedSeasonSchema, administration.createSeason(competitionId, body.label)));
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId', async (request) =>
    translated(() => {
      const { competitionId, seasonId } = ManagedSeasonParamsSchema.parse(request.params);
      return contractResponse(ManagedSeasonSchema, administration.getSeason(competitionId, seasonId));
    }),
  );
  app.get('/teams', async () => contractResponse(ManagedTeamListResponseSchema, { teams: administration.listTeams() }));
  app.post('/teams', async (request, reply) =>
    translated(() => {
      const body = ManagedTeamCreateSchema.parse(request.body);
      const team = administration.createTeam(body.name, body.region ?? null);
      return reply.code(201).send(contractResponse(ManagedTeamSchema, team));
    }),
  );
  app.get('/teams/:teamId', async (request) =>
    translated(() => {
      const { teamId } = ManagedTeamParamsSchema.parse(request.params);
      return contractResponse(ManagedTeamSchema, administration.getTeam(teamId));
    }),
  );
  app.get('/competitions/:competitionId/seasons/:seasonId/participants', async (request) =>
    translated(() => {
      const { competitionId, seasonId } = SeasonParticipantsParamsSchema.parse(request.params);
      return contractResponse(SeasonParticipantListResponseSchema, {
        participants: administration.listParticipants(competitionId, seasonId),
      });
    }),
  );
  app.post('/competitions/:competitionId/seasons/:seasonId/participants', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId } = SeasonParticipantsParamsSchema.parse(request.params);
      const { teamId } = SeasonParticipantCreateSchema.parse(request.body);
      return reply
        .code(201)
        .send(
          contractResponse(SeasonParticipantSchema, administration.addParticipant(competitionId, seasonId, teamId)),
        );
    }),
  );
  app.delete('/competitions/:competitionId/seasons/:seasonId/participants/:teamId', async (request, reply) =>
    translated(() => {
      const { competitionId, seasonId, teamId } = SeasonParticipantParamsSchema.parse(request.params);
      administration.removeParticipant(competitionId, seasonId, teamId);
      return reply.code(204).send();
    }),
  );
}
