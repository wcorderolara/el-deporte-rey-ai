/**
 * Process entry (architecture.md sections 3, 5.1 and 12; contracts/provider-ports.md section 3).
 *
 * Startup order: injected environment (then `FOOTBALL_DATA_API_TOKEN` leaves `process.env`), configuration, data
 * directory (mode 0700), database with migrations, container (egress client, source registry with its startup
 * validation, AI provider), every module's `onStartup` hook in registry order, HTTP application, listen on
 * `127.0.0.1` only. Any failure stops startup with exit code 1 and one line that names the setting or the variable,
 * never a value (OD-20, R-266): a `ConfigError` is printed as its fixed message only, never as an error object, an
 * issue list or a stack (T11H-F03).
 */
import { chmodSync, existsSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { FastifyInstance } from 'fastify';

import { buildApp } from './app.js';
import { type AppContainer, type ProviderFactories, buildInjectedEnvironment, createContainer } from './container.js';
import type { ServerModule } from './modules/module-kit.js';
import { serverModules } from './modules/registry.js';
import { ConfigError, LOOPBACK_HOST, loadConfig } from './platform/config/index.js';
import { DATABASE_FILE_NAME, DbError, openMigratedDatabase } from './platform/db/index.js';
import type { Logger } from './platform/http/index.js';
import { EgressError } from './platform/net/index.js';

/** Mode of the data directory: owner only (T10-F13). */
export const DATA_DIRECTORY_MODE = 0o700;

/**
 * The project root: the directory holding `apps/server` and `config`, found from this module's location in the
 * source layout (`apps/server/src`) or the build layout (`apps/server/dist/src`).
 */
export function projectRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, '../../..'), resolve(here, '../../../..')]) {
    if (existsSync(join(candidate, 'apps', 'server', 'package.json')) && existsSync(join(candidate, 'config'))) {
      return candidate;
    }
  }
  throw new ConfigError('project root', 'was not found next to the server package');
}

/**
 * Creates the data directory with mode 0700 (and narrows an existing one to 0700). Errors name the setting, never
 * the path.
 */
export function prepareDataDirectory(dataDir: string): void {
  try {
    mkdirSync(dataDir, { recursive: true, mode: DATA_DIRECTORY_MODE });
    if (!statSync(dataDir).isDirectory()) {
      throw new ConfigError('dataDir', 'must name a directory');
    }
    chmodSync(dataDir, DATA_DIRECTORY_MODE);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError('dataDir', 'names a directory that cannot be created or used');
  }
}

/** Turns off Node diagnostic reports, which would include the environment (T11H-F03). */
export function disableDiagnosticReports(): void {
  const { report } = process;
  report.reportOnFatalError = false;
  report.reportOnSignal = false;
  report.reportOnUncaughtException = false;
}

const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,40}$/;

/**
 * The single startup failure line. A `ConfigError`, `DbError` or `EgressError` message is fixed text that names
 * settings and never a value; any other error is reduced to its type and system code.
 */
export function describeStartupError(error: unknown): string {
  if (error instanceof ConfigError || error instanceof DbError || error instanceof EgressError) {
    return `Startup failed: ${error.message}`;
  }
  const code = (error as { code?: unknown } | null)?.code;
  const suffix = typeof code === 'string' && SAFE_CODE.test(code) ? ` (${code})` : '';
  return `Startup failed: unexpected error${suffix}`;
}

export interface StartOptions {
  /** Project root; default `projectRoot()`. */
  readonly rootDir?: string;
  /** Process environment; default `process.env`. */
  readonly env?: Record<string, string | undefined>;
  /** Test seam (the test app factory); the process entry never passes it. */
  readonly providers?: ProviderFactories;
  /** Modules to start and register; default the static registry. */
  readonly modules?: readonly ServerModule[];
  readonly logger?: Logger;
  /** Built UI directory; see `BuildAppOptions.webRoot`. */
  readonly webRoot?: string | null;
}

/** The listening address (the shape Node reports for a TCP listener). */
export interface ListenAddress {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

export interface RunningServer {
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  readonly address: ListenAddress;
  /** Stops listening and closes the database. */
  close(): Promise<void>;
}

/** Starts the server; rejects with the startup error after releasing what was opened. */
export async function startServer(options: StartOptions = {}): Promise<RunningServer> {
  disableDiagnosticReports();
  const processEnv = options.env ?? process.env;
  const env = buildInjectedEnvironment(processEnv);
  const config = loadConfig({ rootDir: options.rootDir ?? projectRoot(), env: processEnv });
  if (config.server.host !== LOOPBACK_HOST) {
    throw new ConfigError('server.host', 'must be 127.0.0.1');
  }
  prepareDataDirectory(config.paths.dataDir);
  const { db } = openMigratedDatabase({ location: join(config.paths.dataDir, DATABASE_FILE_NAME) });

  let app: FastifyInstance | null = null;
  try {
    const container = createContainer({
      config,
      db,
      env,
      ...(options.logger === undefined ? {} : { logger: options.logger }),
      ...(options.providers === undefined ? {} : { providers: options.providers }),
    });
    const modules = options.modules ?? serverModules;
    for (const serverModule of modules) {
      await serverModule.onStartup?.(container);
    }
    app = await buildApp(container, {
      modules,
      ...(options.webRoot === undefined ? {} : { webRoot: options.webRoot }),
    });
    await app.listen({ host: LOOPBACK_HOST, port: config.server.port });
    const address = app.server.address() as ListenAddress;
    const running = app;
    return {
      app: running,
      container,
      address,
      close: async () => {
        try {
          await running.close();
        } finally {
          db.close();
        }
      },
    };
  } catch (error) {
    await app?.close();
    db.close();
    throw error;
  }
}

/** The process facilities `main` uses; tests pass their own. */
export interface ProcessIo {
  readonly stdout: { write(text: string): unknown };
  readonly stderr: { write(text: string): unknown };
  exit(code: number): void;
  onSignal(signal: 'SIGINT' | 'SIGTERM', handler: () => void): void;
}

const PROCESS_IO: ProcessIo = {
  stdout: process.stdout,
  stderr: process.stderr,
  exit: (code) => process.exit(code),
  onSignal: (signal, handler) => {
    process.once(signal, handler);
  },
};

/**
 * Starts the server and reports the address; on a startup failure writes the single failure line to stderr and
 * exits with code 1. Returns the running server, or null after a failure.
 */
export async function main(options: StartOptions = {}, io: ProcessIo = PROCESS_IO): Promise<RunningServer | null> {
  let server: RunningServer;
  try {
    server = await startServer(options);
  } catch (error) {
    io.stderr.write(`${describeStartupError(error)}\n`);
    io.exit(1);
    return null;
  }
  const { address, port } = server.address;
  io.stdout.write(`El Deporte Rey server listening on http://${address}:${String(port)}\n`);

  const shutdown = (): void => {
    void server.close().finally(() => io.exit(0));
  };
  io.onSignal('SIGINT', shutdown);
  io.onSignal('SIGTERM', shutdown);
  return server;
}

function isEntryPoint(): boolean {
  const script = process.argv[1];
  if (script === undefined) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(script)).href;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  void main();
}
