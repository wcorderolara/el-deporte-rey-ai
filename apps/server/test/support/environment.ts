/**
 * Shared test support (T41): repository paths, temporary directories, generated configurations per scenario from
 * `fixtures/config/`, a captured logger and the network-guard assertion. All data is synthetic; every directory is
 * temporary and removed by its owner.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'vitest';

import { takeNetworkViolations } from '../../../../vitest.setup.js';
import { type Logger, createLogger } from '../../src/platform/http/index.js';

/** The repository root (the project root of the server). */
export const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

/** `fixtures/` and its sub-directories. */
export const FIXTURES_DIR = join(REPO_ROOT, 'fixtures');
export const FIXTURE_CONFIG_DIR = join(FIXTURES_DIR, 'config');
export const SPORTS_FIXTURES_DIR = join(FIXTURES_DIR, 'sports');

/** The provider token variable, which no default test may see. */
export const TOKEN_VARIABLE = 'FOOTBALL_DATA_API_TOKEN';

/** Prefix of every synthetic person-level value in the fixtures (R-232). */
export const PERSON_MARKER_PREFIX = 'edr-person-marker-';

export type Json = Record<string, unknown>;

export interface TemporaryDirectory {
  readonly path: string;
  remove(): void;
}

/** A temporary directory under the OS temporary directory. */
export function temporaryDirectory(prefix: string): TemporaryDirectory {
  const path = mkdtempSync(join(tmpdir(), `edr-${prefix}-`));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** A free loopback TCP port (closed again before it is returned). */
export async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}

// ---------------------------------------------------------------------------------------------------------------
// Generated configuration
// ---------------------------------------------------------------------------------------------------------------

export interface ServerSettings {
  readonly port: number;
  /** Extra Host values (for example the Vite development origin); the port's loopback pair is always included. */
  readonly extraHosts?: readonly string[];
  readonly extraOrigins?: readonly string[];
}

export interface GeneratedConfigOptions {
  /** Base file under `fixtures/config/` without `.config.json` (for example `demo-only`), or a document. */
  readonly base: string | Json;
  /** Scenario of every DEMO_DATA fixture source and every `test-live` source. */
  readonly scenario?: string;
  /** Per-source scenario overrides (source ID to scenario). */
  readonly scenarios?: Readonly<Record<string, string>>;
  readonly server: ServerSettings;
  /** Final changes to the document (sources, AI adapter, catalogue). */
  readonly mutate?: (document: Json) => void;
}

/** The sports sources of a configuration document (mutable). */
export function sourcesOf(document: Json): Json[] {
  const providers = document['providers'] as Json;
  const sports = providers['sports'] as Json;
  return sports['sources'] as Json[];
}

/** Reads a configuration document of `fixtures/config/` (deep copy). */
export function fixtureConfigDocument(name: string): Json {
  return readJson<Json>(join(FIXTURE_CONFIG_DIR, `${name}.config.json`));
}

function serverBlock(settings: ServerSettings): Json {
  const port = String(settings.port);
  return {
    host: '127.0.0.1',
    port: settings.port,
    allowedHosts: [`127.0.0.1:${port}`, `localhost:${port}`, ...(settings.extraHosts ?? [])],
    allowedOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...(settings.extraOrigins ?? [])],
  };
}

/**
 * Builds a configuration document for one scenario: the base document, a loopback `server` block on the given port,
 * the scenario of every fixture and `test-live` source, then `mutate`.
 */
export function generateConfigDocument(options: GeneratedConfigOptions): Json {
  const document =
    typeof options.base === 'string' ? fixtureConfigDocument(options.base) : structuredClone(options.base);
  document['server'] = serverBlock(options.server);
  for (const source of sourcesOf(document)) {
    const id = String(source['id']);
    const scenario = options.scenarios?.[id] ?? options.scenario;
    const adapter = source['adapter'];
    if (scenario !== undefined && (adapter === 'fixture' || adapter === 'test-live')) {
      source['options'] = { ...(source['options'] as Json), scenario };
    }
  }
  options.mutate?.(document);
  return document;
}

export interface WrittenConfig {
  /** The configuration file. */
  readonly file: string;
  /** The data directory. */
  readonly dataDir: string;
  /** The process environment that selects them: `EDR_CONFIG`, `EDR_DATA_DIR`, `EDR_PORT`; no credential. */
  readonly env: Record<string, string>;
  readonly document: Json;
}

/** Writes a generated configuration into `dir` and returns the environment that selects it. */
export function writeConfig(dir: string, document: Json, dataDir = join(dir, 'data')): WrittenConfig {
  const file = join(dir, 'app.config.json');
  writeFileSync(file, JSON.stringify(document, null, 2), 'utf8');
  const server = document['server'] as Json;
  return {
    file,
    dataDir,
    env: { EDR_CONFIG: file, EDR_DATA_DIR: dataDir, EDR_PORT: String(server['port'] as number) },
    document,
  };
}

/** Writes a catalogue links document into `dir` and returns its path (for `catalogue.linksFile`). */
export function writeCatalogue(dir: string, catalogue: Json): string {
  const file = join(dir, 'catalogue.json');
  writeFileSync(file, JSON.stringify(catalogue), 'utf8');
  return file;
}

// ---------------------------------------------------------------------------------------------------------------
// Logs and the network guard
// ---------------------------------------------------------------------------------------------------------------

/** Captured log lines of a redacting logger. */
export interface LogCapture {
  readonly logger: Logger;
  text(): string;
  lines(): Json[];
}

/** A redacting logger (the production `createLogger`) writing into memory. */
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
        .map((line) => JSON.parse(line) as Json),
  };
}

/**
 * Asserts that no non-loopback connection was attempted since the last check (the shared Vitest network guard also
 * fails the test in `afterEach`; this makes the expectation explicit where a test is about it).
 */
export function expectNoNetworkViolations(): void {
  expect(takeNetworkViolations()).toEqual([]);
}

/** Asserts the default test environment: no provider token and no live-test switch (R-257, AD-30). */
export function expectNoProviderCredentials(): void {
  expect(process.env[TOKEN_VARIABLE]).toBeUndefined();
  expect(process.env['EDR_LIVE_TESTS']).toBeUndefined();
}
