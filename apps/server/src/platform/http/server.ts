/**
 * The Fastify instance with the HTTP platform installed (architecture.md section 4 `platform/http`; AD-03, AD-14).
 *
 * Order on the root instance, before any route or plugin: security headers (`onSend`), request guards
 * (`onRequest`), request logging (`onResponse`), body parsers, error handler. Hooks of the root instance apply to
 * every route, the static files and the not-found handler.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, LogController } from 'fastify';

import { GLOBAL_BODY_LIMIT, installBodyParsers } from './body.js';
import { errorHandler, frameworkErrorHandler, sendProblem } from './errors.js';
import { type GuardOptions, hostAllowed, installRequestGuards, isApiPath, normalizedPath } from './guards.js';
import { installSecurityHeaders } from './headers.js';
import { type Logger, installRequestLogging } from './logger.js';
import { platformProblems } from './problem.js';

export interface HttpServerOptions extends GuardOptions {
  readonly logger: Logger;
}

/** Creates the Fastify instance with the platform plugins; routes are added by the caller. */
export function createHttpServer(options: HttpServerOptions): FastifyInstance {
  const hosts = new Set(options.allowedHosts.map((host) => host.toLowerCase()));
  const app = Fastify({
    loggerInstance: options.logger,
    // Fastify's request lines (URL, host, remote address) are replaced by `installRequestLogging`.
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: false,
    bodyLimit: GLOBAL_BODY_LIMIT,
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
    requestIdHeader: false,
    return503OnClosing: true,
    frameworkErrors: frameworkErrorHandler((request) => hostAllowed(request, hosts)),
  });
  installSecurityHeaders(app);
  installRequestGuards(app, options);
  installRequestLogging(app);
  installBodyParsers(app);
  app.setErrorHandler(errorHandler);
  return app;
}

/** Name of the SPA entry document in the web root. */
export const SPA_INDEX = 'index.html';

/** The built UI directory, `apps/web/dist` under the project root. */
export function defaultWebRoot(rootDir: string): string {
  return join(rootDir, 'apps', 'web', 'dist');
}

/** True when `webRoot` is a directory with the SPA entry document. */
export function isWebRoot(webRoot: string): boolean {
  try {
    return statSync(webRoot).isDirectory() && existsSync(join(webRoot, SPA_INDEX));
  } catch {
    return false;
  }
}

/** True for a request the SPA fallback answers: GET or HEAD, outside `/api`, last segment without a dot. */
function isSpaNavigation(method: string, url: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  if (isApiPath(url)) {
    return false;
  }
  const lastSegment = normalizedPath(url).split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

/**
 * Serves the built UI (T10-F13): `@fastify/static` rooted only at `webRoot` (the built `apps/web/dist`), dotfiles
 * denied, no directory listing, nothing under `/api`; the not-found handler answers SPA navigations with the entry
 * document and everything else, `/api` included, with 404 `NOT_FOUND`. With `webRoot` null (no built UI, for
 * example in development where Vite serves it) only the problem 404 remains.
 */
export async function registerStaticUi(app: FastifyInstance, webRoot: string | null): Promise<void> {
  if (webRoot !== null) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      dotfiles: 'deny',
      list: false,
      index: [SPA_INDEX],
      redirect: false,
      wildcard: true,
      allowedPath: (pathName: string) => !isApiPath(pathName),
    });
  }
  app.setNotFoundHandler(async (request, reply) => {
    if (webRoot !== null && isSpaNavigation(request.method, request.url)) {
      return reply.header('cache-control', 'no-cache').sendFile(SPA_INDEX);
    }
    return sendProblem(reply, platformProblems.notFound());
  });
}
