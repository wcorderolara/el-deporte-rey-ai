import type { FastifyInstance } from 'fastify';

import type { AppContainer } from './container.js';
import type { ServerModule } from './modules/module-kit.js';
import { serverModules } from './modules/registry.js';
import { createHttpServer, defaultWebRoot, isWebRoot, registerStaticUi } from './platform/http/index.js';

/** Base path of every API route (contracts: http-api, servers[0]). */
export const API_PREFIX = '/api/v1';

export interface BuildAppOptions {
  /**
   * Directory of the built UI. Default: `apps/web/dist` under the project root when it holds `index.html`, else none
   * (the API alone; in development Vite serves the UI). `null` disables static serving.
   */
  readonly webRoot?: string | null;
  /** The modules to register; default the static registry. Tests pass their own list. */
  readonly modules?: readonly ServerModule[];
}

function resolveWebRoot(container: AppContainer, option: string | null | undefined): string | null {
  if (option !== undefined) {
    return option;
  }
  const candidate = defaultWebRoot(container.paths.rootDir);
  return isWebRoot(candidate) ? candidate : null;
}

/**
 * Builds the Fastify instance: the HTTP platform (Host and origin guards, security headers, body limits,
 * problem+json errors, request logging), the health route and the module routes from the registry under `/api/v1`,
 * then the built UI with the SPA fallback.
 */
export async function buildApp(container: AppContainer, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { server } = container.config;
  const app = createHttpServer({
    allowedHosts: server.allowedHosts,
    allowedOrigins: server.allowedOrigins,
    logger: container.logger,
  });

  app.get(`${API_PREFIX}/health`, () => ({ status: 'ok' as const }));

  for (const serverModule of options.modules ?? serverModules) {
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

  await registerStaticUi(app, resolveWebRoot(container, options.webRoot));
  return app;
}
