/**
 * FootballDataProvider credential handling (PD-12 credential rules; contracts/provider-ports.md section 1.4,
 * "Credential" and "Credential containment"; R-260, R-263, R-266; T11H-F03). Only the synthetic marker token is
 * used; no socket is opened.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';
import { ConfigError, isSecretLikeKey } from '../../../../platform/config/index.js';
import { createSportsSources } from '../../index.js';
import { SourceError } from '../../ingestion/index.js';
import { VirtualClock } from '../../support/test/virtual-clock.js';
import { CapturingLogger, config, demoSource } from '../../test/synthetic.js';

import { AUTH_HEADER, PINNED_ORIGIN, TOKEN_VARIABLE } from './constants.js';
import { authHeadersFor } from './credentials.js';
import { ORIGIN_PROBLEM, parseFootballDataOptions } from './options.js';
import { HARNESS_START, discoveryCtx, harness, refOf, researchCtx, walkReference } from './test/harness.js';
import { BASE_OPTIONS, ReplayEgress, projectRootDir, replyOf } from './test/replay.js';

const TOKEN_MESSAGE =
  'FOOTBALL_DATA_API_TOKEN is required when an enabled LIVE_DATA source uses the football-data adapter';
const CLIENT_MARKER = 'edr-test-client-marker-0000';

function startupError(action: () => void): ConfigError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return error as ConfigError;
  }
  throw new Error('expected a ConfigError');
}

/** A live source in the configuration format of `createSportsSources`. */
function liveSource(options: Record<string, unknown> = BASE_OPTIONS, overrides: Record<string, unknown> = {}) {
  return {
    id: 'football-data',
    name: 'Synthetic live source',
    mode: 'LIVE_DATA',
    role: 'primary',
    accepted: true,
    adapter: 'football-data',
    options,
    ...overrides,
  };
}

function sportsDeps(env: Readonly<Record<string, string | undefined>>, egress = new ReplayEgress()) {
  return {
    egress,
    env,
    clock: new VirtualClock(HARNESS_START),
    db: {} as never,
    paths: { rootDir: projectRootDir(), dataDir: join(projectRootDir(), 'data') },
    logger: new CapturingLogger(),
  };
}

describe('credential rule 1: the token travels only in X-Auth-Token (R-260)', () => {
  it('sends the marker token only as the X-Auth-Token header, never in a URL or query', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    await walkReference(h);
    h.egress.serve('cl-matches-2026-md1.json').serve('cl-standings-2026-md1.json');
    const { stages } = await walkReference(h);
    await h.clock.run(h.source.fetchSelection(refOf(stages.items[0]?.matchdays[0]?.ref), researchCtx()));
    expect(h.egress.calls.length).toBeGreaterThanOrEqual(5);
    for (const call of h.egress.calls) {
      expect(call.headers).toEqual({ Accept: 'application/json', [AUTH_HEADER]: TEST_MARKER_TOKEN });
      expect(call.url.startsWith(`${PINNED_ORIGIN}/v4/`)).toBe(true);
      expect(call.url).not.toContain(TEST_MARKER_TOKEN);
      expect(decodeURIComponent(call.url)).not.toContain(TEST_MARKER_TOKEN);
    }
  });

  it('holds no token on the adapter object: serializing or inspecting it shows none', () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    expect(JSON.stringify(h.source)).not.toContain(TEST_MARKER_TOKEN);
    expect(inspect(h.source, { depth: 10, showHidden: true })).not.toContain(TEST_MARKER_TOKEN);
  });

  it('keeps every credential out of the adapter code and the committed LIVE_DATA configuration', () => {
    const root = projectRootDir();
    const dir = join(root, 'apps', 'server', 'src', 'providers', 'sports', 'adapters', 'football-data');
    const code = readdirSync(dir)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(dir, name), 'utf8'))
      .join('\n');
    expect(code).not.toContain(TEST_MARKER_TOKEN);
    expect(code).not.toMatch(/FOOTBALL_DATA_API_TOKEN\s*=/);

    const text = readFileSync(join(root, 'config', 'live.config.json'), 'utf8');
    expect(text).not.toContain(TEST_MARKER_TOKEN);
    expect(text).not.toContain(TOKEN_VARIABLE);
    const keys: string[] = [];
    JSON.parse(text, (key: string, value: unknown) => {
      keys.push(key);
      return value;
    });
    expect(keys.filter((key) => key !== '' && isSecretLikeKey(key))).toEqual([]);
  });
});

describe('credential rule 4: no marker in logs, errors or the cache (R-263)', () => {
  it('after success and failure scenarios no output holds the marker token or the client value', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    const { stages } = await walkReference(h);
    const ref = refOf(stages.items[0]?.matchdays[0]?.ref);
    const failures: SourceError[] = [];
    h.egress.on(
      'GET /v4/competitions/CL/matches?matchday=1&season=2026',
      ...['error-400.json', 'error-403-anonymous.json', 'error-403-authenticated.json', 'error-404.json'].map((file) =>
        replyOf(file),
      ),
      replyOf('cl-matches-2026-md1.json'),
    );
    h.egress.serve('cl-standings-2026-md1.json');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
      } catch (error) {
        failures.push(error as SourceError);
      }
    }
    const snapshot = await h.clock.run(h.source.fetchSelection(ref, researchCtx()));
    expect(failures.map((failure) => failure.code)).toEqual([
      'bad_request',
      'access_refused',
      'not_available',
      'not_available',
    ]);
    const outputs = JSON.stringify([
      h.logger.lines,
      failures.map((failure) => [failure.message, failure.toJSON(), inspect(failure)]),
      h.source.cacheEntries(),
      snapshot,
    ]);
    expect(outputs).not.toContain(TEST_MARKER_TOKEN);
    expect(outputs).not.toContain(CLIENT_MARKER);
    expect(outputs).not.toContain('X-Auth-Token');
    expect(outputs).not.toContain('Synthetic error');
  });
});

describe('credential rule 7: startup validation (R-266)', () => {
  it.each([
    ['missing', {}],
    ['empty', { [TOKEN_VARIABLE]: '' }],
    ['with a space', { [TOKEN_VARIABLE]: `${TEST_MARKER_TOKEN} x` }],
    ['with a line break', { [TOKEN_VARIABLE]: `${TEST_MARKER_TOKEN}\n` }],
    ['too long', { [TOKEN_VARIABLE]: `${TEST_MARKER_TOKEN}${'x'.repeat(256)}` }],
  ])('a %s token stops startup naming the variable, never its value', (_label, env) => {
    const egress = new ReplayEgress();
    const error = startupError(() => createSportsSources(config([liveSource()]), sportsDeps(env, egress)));
    expect(error.message).toBe(TOKEN_MESSAGE);
    expect(error.issues).toEqual([
      { setting: TOKEN_VARIABLE, problem: TOKEN_MESSAGE.slice(TOKEN_VARIABLE.length + 1) },
    ]);
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
    expect(egress.calls).toEqual([]);
  });

  it('starts with the token and makes no request at startup', () => {
    const egress = new ReplayEgress();
    const registry = createSportsSources(
      config([liveSource()]),
      sportsDeps({ [TOKEN_VARIABLE]: TEST_MARKER_TOKEN }, egress),
    );
    expect(registry.sourceIds).toEqual(['football-data']);
    expect(egress.calls).toEqual([]);
  });

  it('never reads the token without an enabled LIVE_DATA source using the adapter', () => {
    const reads: string[] = [];
    const env = new Proxy({ [TOKEN_VARIABLE]: TEST_MARKER_TOKEN } as Record<string, string>, {
      get(target, property, receiver) {
        reads.push(String(property));
        return Reflect.get(target, property, receiver) as unknown;
      },
      getOwnPropertyDescriptor(target, property) {
        reads.push(String(property));
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      has(target, property) {
        reads.push(String(property));
        return Reflect.has(target, property);
      },
    });
    const registry = createSportsSources(
      config([demoSource('demo-a'), liveSource(BASE_OPTIONS, { enabled: false })], undefined, projectRootDir()),
      sportsDeps(env),
    );
    expect(registry.sourceIds).toEqual(['demo-a']);
    expect(reads).not.toContain(TOKEN_VARIABLE);
  });

  it('a missing token makes every method refuse without a request even if startup was skipped', async () => {
    const h = harness({ token: null });
    const failure = await h.source.listCompetitions(discoveryCtx()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SourceError);
    expect(h.egress.calls).toEqual([]);
  });
});

describe('credential containment (T11H-F03)', () => {
  it('refuses a base URL whose origin is not the pinned origin with a fixed ConfigError', () => {
    const egress = new ReplayEgress();
    const error = startupError(() =>
      createSportsSources(
        config([liveSource({ ...BASE_OPTIONS, baseUrl: 'https://sports.example.test/v4' })]),
        sportsDeps({ [TOKEN_VARIABLE]: TEST_MARKER_TOKEN }, egress),
      ),
    );
    expect(error.issues).toEqual([{ setting: 'providers.sports.sources[0].options.baseUrl', problem: ORIGIN_PROBLEM }]);
    expect(egress.calls).toEqual([]);
  });

  it('sends nothing, and no header, for a source whose origin is not pinned', async () => {
    const h = harness({
      token: TEST_MARKER_TOKEN,
      options: { ...BASE_OPTIONS, baseUrl: 'https://sports.example.test/v4' },
    });
    const failure = await h.source.listCompetitions(discoveryCtx()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SourceError);
    expect(h.egress.calls).toEqual([]);
  });

  it('attaches X-Auth-Token only to a URL whose parsed origin is the pinned origin', () => {
    for (const url of [
      'https://sports.example.test/v4/competitions',
      'https://api.football-data.org.example.test/v4/competitions',
      'http://api.football-data.org/v4/competitions',
      'https://api.football-data.org:8443/v4/competitions',
      'https://user@sports.example.test/',
      'not a url',
    ]) {
      expect(authHeadersFor(url, TEST_MARKER_TOKEN)).toEqual({ Accept: 'application/json' });
    }
    expect(authHeadersFor('https://API.football-data.org/v4/competitions', TEST_MARKER_TOKEN)).toEqual({
      Accept: 'application/json',
      [AUTH_HEADER]: TEST_MARKER_TOKEN,
    });
  });

  it.each([
    ['an invalid number', { requestsPerMinute: TEST_MARKER_TOKEN }],
    ['an invalid base URL', { baseUrl: `https://api.football-data.org/v4?t=${TEST_MARKER_TOKEN}` }],
    ['an invalid code', { referenceCompetitionRefs: [`${TEST_MARKER_TOKEN}!`] }],
    ['an unknown key', { unknownOption: TEST_MARKER_TOKEN }],
    ['an invalid override', { maxResponseBytesByResource: { stageDiscovery: 4_194_304, extra: TEST_MARKER_TOKEN } }],
    ['too many reserved slots', { requestsPerMinute: 2, researchReservedSlots: 2 }],
  ])('reports %s in the options with fixed texts only', (_label, extra) => {
    const error = startupError(() =>
      createSportsSources(
        config([liveSource({ ...BASE_OPTIONS, ...extra })]),
        sportsDeps({ [TOKEN_VARIABLE]: TEST_MARKER_TOKEN }),
      ),
    );
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
    expect(JSON.stringify(error.issues)).not.toContain(TEST_MARKER_TOKEN);
    expect(error.issues.every((issue) => issue.setting.startsWith('providers.sports.sources[0].options'))).toBe(true);
  });

  it('reports an unknown option key without naming it', () => {
    const result = parseFootballDataOptions(
      { ...BASE_OPTIONS, [TEST_MARKER_TOKEN]: true },
      'providers.sports.sources[0]',
    );
    expect(result).toEqual({
      ok: false,
      issues: [{ setting: 'providers.sports.sources[0].options', problem: 'contains unknown keys' }],
    });
  });

  it('refuses a stage-discovery override above 2 MiB (SC-05 re-review trigger)', () => {
    const error = startupError(() =>
      createSportsSources(
        config([liveSource({ ...BASE_OPTIONS, maxResponseBytesByResource: { stageDiscovery: 2_097_153 } })]),
        sportsDeps({ [TOKEN_VARIABLE]: TEST_MARKER_TOKEN }),
      ),
    );
    expect(error.setting).toBe('providers.sports.sources[0].options.maxResponseBytesByResource');
  });
});
