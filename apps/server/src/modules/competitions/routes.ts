import {
  ManagedCompetitionCreateSchema,
  ManagedCompetitionListResponseSchema,
  ManagedCompetitionParamsSchema,
  ManagedCompetitionSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import { contractResponse } from '../projects/respond.js';
import type { CompetitionService } from './service.js';

export function registerCompetitionRoutes(app: FastifyInstance, service: CompetitionService): void {
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
}
