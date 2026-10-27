import Fastify, { type FastifyInstance } from 'fastify';

import type { AppContainer } from './container.js';
import { serverModules } from './modules/registry.js';

/** Base path of every API route (contracts: http-api, servers[0]). */
export const API_PREFIX = '/api/v1';

/**
 * Builds the Fastify instance: platform routes and the module routes from the registry under `/api/v1`.
 *
 * Skeleton created by T15 (health route only). T19 adds the platform plugins (Host and origin guards, security
 * headers, problem+json errors, body limits) and the built UI.
 */
export async function buildApp(container: AppContainer): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: false });

  app.get(`${API_PREFIX}/health`, () => ({ status: 'ok' as const }));

  for (const serverModule of serverModules) {
    const { routes } = serverModule;
    if (routes !== undefined) {
      await app.register(
        async (scope) => {
          await routes(scope, container);
        },
        { prefix: API_PREFIX },
      );
    }
  }

  return app;
}
