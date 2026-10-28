/**
 * Test support of the T19 platform and startup tests: temporary directories, generated configurations, fake provider
 * factories, a test container and log capture. All data is synthetic; directories are removed by the caller.
 * (T41 builds the shared test support under `apps/server/test/support/`.)
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type AiProviderDeps,
  type AppContainer,
  type ProviderFactories,
  type SportsSourcesDeps,
  createContainer,
} from '../../../src/container.js';
import { type AppConfig, loadConfig } from '../../../src/platform/config/index.js';
import { openMigratedDatabase } from '../../../src/platform/db/index.js';
import { type Logger, createLogger } from '../../../src/platform/http/index.js';
import type { AiTextProvider } from '../../../src/providers/ai/index.js';
import type { SourceRegistry } from '../../../src/providers/sports/index.js';

/** The repository root. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..');

/** Host and origin of the committed configuration (port 4300). */
export const TEST_HOST = '127.0.0.1:4300';
export const TEST_ORIGIN = 'http://127.0.0.1:4300';

/** Headers of a well-formed mutating request from the UI. */
export const UI_HEADERS = Object.freeze({ host: TEST_HOST, origin: TEST_ORIGIN, 'x-edr-client': 'web' });

/** A temporary directory, removed by `remove`. */
export function temporaryDirectory(prefix: string): { path: string; remove: () => void } {
  const path = mkdtempSync(join(tmpdir(), `edr-${prefix}-`));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

export interface TestConfigOptions {
  readonly port?: number;
  readonly allowedHosts?: readonly string[];
  readonly allowedOrigins?: readonly string[];
  /** Extra settings merged into the application document (top level). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Writes a configuration derived from `config/app.config.json` into `dir` and returns the environment that selects
 * it, with the data directory under `dir`.
 */
export function writeTestConfig(dir: string, options: TestConfigOptions = {}): Record<string, string> {
  const document = JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'app.config.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const server = { ...(document['server'] as Record<string, unknown>) };
  if (options.port !== undefined) {
    server['port'] = options.port;
    server['allowedHosts'] = [`127.0.0.1:${String(options.port)}`, `localhost:${String(options.port)}`];
    server['allowedOrigins'] = [`http://127.0.0.1:${String(options.port)}`, `http://localhost:${String(options.port)}`];
  }
  if (options.allowedHosts !== undefined) {
    server['allowedHosts'] = options.allowedHosts;
  }
  if (options.allowedOrigins !== undefined) {
    server['allowedOrigins'] = options.allowedOrigins;
  }
  const file = join(dir, 'app.config.json');
  writeFileSync(file, JSON.stringify({ ...document, ...options.extra, server }), 'utf8');
  return { EDR_CONFIG: file, EDR_DATA_DIR: join(dir, 'data') };
}

/** Loads a test configuration written by `writeTestConfig`. */
export function loadTestConfig(dir: string, options: TestConfigOptions = {}): AppConfig {
  return loadConfig({ rootDir: REPO_ROOT, env: writeTestConfig(dir, options) });
}

export interface FakeProviderOptions {
  /** The fake registry's startup validation. */
  readonly validateStartup?: () => void;
  /** Receives the dependencies handed to `createSportsSources`. */
  readonly onSportsDeps?: (deps: SportsSourcesDeps) => void;
  /** Receives the dependencies handed to `createAiProvider`. */
  readonly onAiDeps?: (deps: AiProviderDeps) => void;
}

/**
 * Fake provider factories. The provider stubs of T15 throw until T21 and T22 land, so the platform tests use these;
 * the casts keep the fakes compatible with the final port types.
 */
export function fakeProviders(options: FakeProviderOptions = {}): ProviderFactories {
  return {
    createSportsSources: (_config, deps) => {
      options.onSportsDeps?.(deps);
      const registry = {
        sourceIds: [] as string[],
        ...(options.validateStartup === undefined ? {} : { validateStartup: options.validateStartup }),
      };
      return registry as unknown as SourceRegistry;
    },
    createAiProvider: (_config, deps) => {
      options.onAiDeps?.(deps);
      return { id: 'stub' } as unknown as AiTextProvider;
    },
  };
}

/** Captured log lines. */
export interface LogCapture {
  readonly logger: Logger;
  text(): string;
  lines(): Record<string, unknown>[];
}

/** A logger writing into memory. */
export function captureLog(level: 'info' | 'debug' | 'trace' = 'trace'): LogCapture {
  const chunks: string[] = [];
  const logger = createLogger({ level, destination: { write: (line: string) => chunks.push(line) } });
  return {
    logger,
    text: () => chunks.join(''),
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

export interface TestContainer {
  readonly container: AppContainer;
  readonly dir: string;
  close(): void;
}

/** A container on a generated configuration and an in-memory database, with fake providers. */
export function createTestContainer(
  options: TestConfigOptions & { readonly logger?: Logger; readonly providers?: ProviderFactories } = {},
): TestContainer {
  const dir = temporaryDirectory('container');
  const config = loadTestConfig(dir.path, options);
  const { db } = openMigratedDatabase({ location: ':memory:' });
  const container = createContainer({
    config,
    db,
    env: Object.freeze({}),
    logger: options.logger ?? createLogger({ level: 'silent' }),
    providers: options.providers ?? fakeProviders(),
  });
  return {
    container,
    dir: dir.path,
    close: () => {
      db.close();
      dir.remove();
    },
  };
}

/** A free loopback TCP port (closed again before it is returned). */
export async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}
