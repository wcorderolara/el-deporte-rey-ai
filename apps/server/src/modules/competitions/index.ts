import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';
import { registerCompetitionRoutes } from './routes.js';
import { CompetitionService } from './service.js';

export function createCompetitionModule(): ServerModule {
  return {
    name: 'competitions',
    routes: async (app, container: AppContainer) => {
      registerCompetitionRoutes(app, new CompetitionService(container));
    },
  };
}

export const serverModule = createCompetitionModule();
