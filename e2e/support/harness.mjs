// Pure helpers of the end-to-end runner (architecture-delta.md section 7.1; architecture.md section 12).
//
// - Environment filtering: provider credentials and live-test switches never reach the server, the Playwright runner,
//   its workers or the browser (T10-F11, AD-30, R-257, R-258).
// - Generated configuration: the DEMO_DATA fixture sources and the stub AI adapter, bound to 127.0.0.1 on the
//   verification port, with Host and Origin allow-lists listing exactly that port (architecture.md section 12.1).
//   Written to a temporary directory outside the repository; the committed configuration files are only read.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Verification port of gate runs (architecture.md section 12; source of truth section 7). */
export const VERIFICATION_PORT = 4310;

/** Loopback address every server of the harness binds. */
export const LOOPBACK_HOST = '127.0.0.1';

/**
 * Base configuration documents, in order of preference. T23 adds the test configurations under `fixtures/config/`;
 * until the DEMO_DATA plus MANUAL_DATA one exists, the committed default configuration (DEMO_DATA and MANUAL_DATA,
 * architecture.md section 5.1) is read instead. Neither file is ever modified.
 */
export const BASE_CONFIG_CANDIDATES = ['fixtures/config/demo-manual.config.json', 'config/app.config.json'];

/**
 * Data modes of the sources kept from the base configuration. MANUAL_DATA is left out until the manual adapter is
 * integrated (T50): with its T21 stub enabled, startup stops with "adapter not available" (Orchestrator note for T24).
 * Add 'MANUAL_DATA' here once T50 is integrated. LIVE_DATA is never kept: no run can reach a provider.
 */
export const INCLUDED_MODES = Object.freeze(['DEMO_DATA']);

/** AI provider of every run: the deterministic stub (no network). */
export const AI_PROVIDER = Object.freeze({ adapter: 'stub', options: Object.freeze({ scenario: 'default' }) });

/** Project-local browser cache (AD-16; never host-wide). */
export const BROWSERS_DIRECTORY = '.cache/ms-playwright';

/** Variables never forwarded to a child process, by exact name. */
export const BLOCKED_VARIABLES = Object.freeze(['FOOTBALL_DATA_API_TOKEN', 'EDR_LIVE_TESTS']);

/**
 * Variables never forwarded, by pattern: every `EDR_*` variable (credentials such as `EDR_AI_API_KEY`, and the
 * configuration variables, which the runner sets itself) and any name that looks like a credential.
 */
export const BLOCKED_VARIABLE_PATTERNS = Object.freeze([/^EDR_/i, /API_?KEY/i, /TOKEN/i, /SECRET/i, /PASSWORD/i]);

/** True when the variable must not reach a child process. */
export function isBlockedVariable(name) {
  return BLOCKED_VARIABLES.includes(name) || BLOCKED_VARIABLE_PATTERNS.some((pattern) => pattern.test(name));
}

/** A copy of `env` without the blocked variables, plus `extra` (which is never filtered). */
export function childEnvironment(env, extra = {}) {
  const result = {};
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === 'string' && !isBlockedVariable(name)) {
      result[name] = value;
    }
  }
  return { ...result, ...extra };
}

/** The first existing base configuration document, relative to `rootDir`. */
export function baseConfigPath(rootDir) {
  for (const candidate of BASE_CONFIG_CANDIDATES) {
    if (existsSync(resolve(rootDir, candidate))) {
      return candidate;
    }
  }
  throw new Error(`No base configuration found (looked for ${BASE_CONFIG_CANDIDATES.join(', ')}).`);
}

/** Enabled sources of a configuration document. */
export function enabledSources(document) {
  const sources = document?.providers?.sports?.sources;
  return Array.isArray(sources) ? sources.filter((source) => source?.enabled === true) : [];
}

/**
 * The configuration document of the run: the base document reduced to its enabled sources of `INCLUDED_MODES`, the
 * stub AI provider, and the server bound to 127.0.0.1 on `port` with Host and Origin allow-lists of exactly that port.
 * Refuses a base without an enabled DEMO_DATA primary source.
 */
export function serverConfigDocument(base, port) {
  const sources = enabledSources(base).filter((source) => INCLUDED_MODES.includes(source.mode));
  if (!sources.some((source) => source.mode === 'DEMO_DATA' && source.role === 'primary')) {
    throw new Error('The base configuration has no enabled DEMO_DATA primary source.');
  }
  const p = String(port);
  return {
    ...base,
    server: {
      ...base.server,
      host: LOOPBACK_HOST,
      port,
      allowedHosts: [`127.0.0.1:${p}`, `localhost:${p}`],
      allowedOrigins: [`http://127.0.0.1:${p}`, `http://localhost:${p}`],
    },
    providers: { ...base.providers, sports: { ...base.providers.sports, sources }, ai: AI_PROVIDER },
  };
}

/**
 * Creates the temporary run directory (outside the repository) with the generated configuration and an empty data
 * directory location. Returns the paths, the server environment variables and `remove`.
 */
export function prepareRunDirectory(rootDir, port) {
  const source = baseConfigPath(rootDir);
  const base = JSON.parse(readFileSync(resolve(rootDir, source), 'utf8'));
  const document = serverConfigDocument(base, port);
  const dir = mkdtempSync(join(tmpdir(), 'edr-e2e-'));
  const configFile = join(dir, 'app.config.json');
  const dataDir = join(dir, 'data');
  writeFileSync(configFile, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return {
    dir,
    source,
    sourceIds: document.providers.sports.sources.map((entry) => entry.id),
    configFile,
    dataDir,
    serverVariables: { EDR_CONFIG: configFile, EDR_DATA_DIR: dataDir, EDR_PORT: String(port) },
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Text of the T15 sports-data stub, which throws on startup until T21 is integrated. */
export const SPORTS_STUB_MARKER = 'sports-data sources are not available yet';

/**
 * True while the built sports-data entry point is still the T15 stub, so the real server cannot start. Remove this
 * check and the seam launcher once T21 is integrated.
 */
export function sportsProviderIsStub(rootDir) {
  const file = resolve(rootDir, 'apps/server/dist/src/providers/sports/index.js');
  return existsSync(file) && readFileSync(file, 'utf8').includes(SPORTS_STUB_MARKER);
}

/** Paths of the build output the harness needs. */
export function buildOutput(rootDir) {
  return {
    serverEntry: resolve(rootDir, 'apps/server/dist/src/main.js'),
    webIndex: resolve(rootDir, 'apps/web/dist/index.html'),
  };
}
