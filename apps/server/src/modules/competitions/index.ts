import { randomUUID } from 'node:crypto';
import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';
import { registerCompetitionRoutes } from './routes.js';
import { CompetitionService } from './service.js';
import { CompetitionAdministrationService } from './application/CompetitionAdministrationService.js';
import { SQLiteCompetitionAdministrationRepository } from './infrastructure/SQLiteCompetitionAdministrationRepository.js';
import { CompetitionCalendarService } from './calendar/application/CompetitionCalendarService.js';
import { SQLiteCompetitionCalendarRepository } from './calendar/infrastructure/SQLiteCompetitionCalendarRepository.js';
import { registerCompetitionCalendarRoutes } from './calendar/routes.js';
import { CompetitionProviderBindingService, bindingResponse } from './provider-binding.js';
import {
  SportsProviderListResponseSchema,
  SportsProviderParamsSchema,
  ExternalCompetitionListResponseSchema,
  CompetitionProviderBindingParamsSchema,
  CompetitionProviderBindingCreateSchema,
  CompetitionProviderBindingResponseSchema,
} from '@edr/contracts';
import { contractResponse } from '../projects/respond.js';

export function createCompetitionModule(): ServerModule {
  return {
    name: 'competitions',
    routes: async (app, container: AppContainer) => {
      const now = () => container.clock.now();
      registerCompetitionRoutes(
        app,
        new CompetitionService(container),
        new CompetitionAdministrationService(new SQLiteCompetitionAdministrationRepository(container.db), {
          newId: randomUUID,
          now,
        }),
      );
      registerCompetitionCalendarRoutes(
        app,
        new CompetitionCalendarService(new SQLiteCompetitionCalendarRepository(container.db), {
          newId: randomUUID,
          now,
        }),
      );
      const bindings = new CompetitionProviderBindingService(container);
      app.get('/sports/providers', async () =>
        contractResponse(SportsProviderListResponseSchema, { providers: bindings.providers() }),
      );
      app.get('/sports/providers/:providerKey/competitions', async (request) => {
        const { providerKey } = SportsProviderParamsSchema.parse(request.params);
        return contractResponse(ExternalCompetitionListResponseSchema, {
          competitions: await bindings.externalCompetitions(providerKey),
        });
      });
      app.get('/competitions/:competitionId/provider-binding', async (request) => {
        const { competitionId } = CompetitionProviderBindingParamsSchema.parse(request.params);
        return contractResponse(CompetitionProviderBindingResponseSchema, bindingResponse(bindings.get(competitionId)));
      });
      app.post('/competitions/:competitionId/provider-binding', async (request, reply) => {
        const { competitionId } = CompetitionProviderBindingParamsSchema.parse(request.params);
        const body = CompetitionProviderBindingCreateSchema.parse(request.body);
        const row = await bindings.link(
          competitionId,
          body.providerKey,
          body.externalCompetitionId,
          body.mode,
          body.replaceExisting ?? false,
        );
        return reply.code(201).send(contractResponse(CompetitionProviderBindingResponseSchema, bindingResponse(row)));
      });
      app.delete('/competitions/:competitionId/provider-binding', async (request, reply) => {
        const { competitionId } = CompetitionProviderBindingParamsSchema.parse(request.params);
        bindings.unlink(competitionId);
        return reply.code(204).send();
      });
    },
  };
}

export const serverModule = createCompetitionModule();
