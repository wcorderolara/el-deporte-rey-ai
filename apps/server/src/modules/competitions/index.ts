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
    },
  };
}

export const serverModule = createCompetitionModule();
