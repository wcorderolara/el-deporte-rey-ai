import { randomUUID } from 'node:crypto';
import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';
import { registerCompetitionRoutes } from './routes.js';
import { CompetitionService } from './service.js';
import { CompetitionAdministrationService } from './application/CompetitionAdministrationService.js';
import { SQLiteCompetitionAdministrationRepository } from './infrastructure/SQLiteCompetitionAdministrationRepository.js';

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
    },
  };
}

export const serverModule = createCompetitionModule();
