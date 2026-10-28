/**
 * Startup and composition root (R-234, R-266; OD-20; T10-F13; T11H-F03; AD-30): loopback-only listener, data
 * directory mode 0700, migrations before the module hooks, hooks before listen, startup failures with exit code 1
 * and a message naming the setting or variable and never a value, the injected environment and the removal of
 * `FOOTBALL_DATA_API_TOKEN` from `process.env`, and no login or account route.
 */
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { buildApp } from '../../../src/app.js';
import type { Env, SportsSourcesDeps } from '../../../src/container.js';
import {
  DATA_DIRECTORY_MODE,
  type ProcessIo,
  type RunningServer,
  describeStartupError,
  main,
  prepareDataDirectory,
  startServer,
} from '../../../src/main.js';
import type { ServerModule } from '../../../src/modules/module-kit.js';
import { serverModules } from '../../../src/modules/registry.js';
import { ConfigError, loadConfig } from '../../../src/platform/config/index.js';
import { DATABASE_FILE_NAME } from '../../../src/platform/db/index.js';
import { createLogger } from '../../../src/platform/http/index.js';

import {
  REPO_ROOT,
  createTestContainer,
  fakeProviders,
  freePort,
  temporaryDirectory,
  writeTestConfig,
} from './support.js';

const TOKEN_VARIABLE = 'FOOTBALL_DATA_API_TOKEN';
const silent = createLogger({ level: 'silent' });
const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
  delete process.env[TOKEN_VARIABLE];
});

/** A generated configuration on a free port, with its data directory under a removed temporary directory. */
async function testEnvironment(): Promise<{ env: Record<string, string>; port: number }> {
  const dir = temporaryDirectory('startup');
  cleanups.push(dir.remove);
  const port = await freePort();
  return { env: { ...writeTestConfig(dir.path, { port }), EDR_PORT: String(port) }, port };
}

async function start(options: Parameters<typeof startServer>[0]): Promise<RunningServer> {
  const server = await startServer({ rootDir: REPO_ROOT, logger: silent, webRoot: null, ...options });
  cleanups.push(() => server.close());
  return server;
}

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** A raw HTTP request to the loopback listener, with full control of the Host header. */
function request(
  port: number,
  options: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: options.method ?? 'GET', path: options.path ?? '/', headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}

/** Connection outcome to `host:port` from a separate Node process (outside the test network guard). */
function connectFromChild(host: string, port: number): Promise<string> {
  const script = [
    "const s = require('net').connect({ host: process.argv[1], port: Number(process.argv[2]) });",
    "s.setTimeout(3000, () => { console.log('TIMEOUT'); s.destroy(); });",
    "s.on('connect', () => { console.log('CONNECTED'); s.destroy(); });",
    "s.on('error', (e) => console.log(e.code));",
  ].join('');
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['-e', script, host, String(port)], { timeout: 10_000 }, (error, stdout) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/** Connection outcome from this process (loopback only, allowed by the network guard). */
function connectHere(port: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve('CONNECTED');
    });
    socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'ERROR'));
  });
}

function nonLoopbackAddress(): string | null {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

interface FakeIo extends ProcessIo {
  readonly out: string[];
  readonly err: string[];
  readonly codes: number[];
}

function fakeIo(): FakeIo {
  const out: string[] = [];
  const err: string[] = [];
  const codes: number[] = [];
  return {
    out,
    err,
    codes,
    stdout: { write: (text: string) => out.push(text) },
    stderr: { write: (text: string) => err.push(text) },
    exit: (code: number) => {
      codes.push(code);
    },
    onSignal: () => undefined,
  };
}

describe('listener (R-234, PD-05)', () => {
  it('listens on 127.0.0.1 only and answers the configured Host over TCP', async () => {
    const { env, port } = await testEnvironment();
    const server = await start({ env, providers: fakeProviders() });
    expect(server.address).toMatchObject({ address: '127.0.0.1', family: 'IPv4', port });

    const health = await request(port, { path: '/api/v1/health', headers: { host: `127.0.0.1:${String(port)}` } });
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ status: 'ok' });
    expect(await connectFromChild('127.0.0.1', port)).toBe('CONNECTED');
  });

  it('refuses connections to a non-loopback interface address of this host', async () => {
    const address = nonLoopbackAddress();
    const { env, port } = await testEnvironment();
    const server = await start({ env, providers: fakeProviders() });
    expect(server.address.address).toBe('127.0.0.1');
    if (address === null) {
      // No non-loopback interface exists on this host; the bind address above is the evidence.
      return;
    }
    expect(await connectFromChild(address, port)).toBe('ECONNREFUSED');
  });

  it('refuses a foreign Host and cross-origin mutating requests over TCP', async () => {
    const { env, port } = await testEnvironment();
    await start({ env, providers: fakeProviders() });
    const host = `127.0.0.1:${String(port)}`;

    const foreign = await request(port, { path: '/api/v1/health', headers: { host: `evil.example:${String(port)}` } });
    expect(foreign.status).toBe(421);
    expect(JSON.parse(foreign.body)).toMatchObject({ code: 'MISDIRECTED_HOST' });

    const rebinding = await request(port, { path: '/', headers: { host: `0.0.0.0:${String(port)}` } });
    expect(rebinding.status).toBe(421);

    const crossOrigin = await request(port, {
      method: 'POST',
      path: '/api/v1/projects',
      headers: { host, origin: 'http://evil.example', 'x-edr-client': 'web', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(crossOrigin.status).toBe(403);
    expect(JSON.parse(crossOrigin.body)).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
    expect(Object.keys(crossOrigin.headers).some((name) => name.startsWith('access-control-'))).toBe(false);

    const withoutHeader = await request(port, {
      method: 'POST',
      path: '/api/v1/projects',
      headers: { host, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(withoutHeader.status).toBe(403);
  });
});

describe('development origin set (T10-F02, OD-37)', () => {
  it('config/dev.config.json accepts the Vite Host and Origin; config/app.config.json refuses them', async () => {
    const dir = temporaryDirectory('dev-config');
    cleanups.push(dir.remove);
    const echo: ServerModule = {
      name: 'echo',
      routes: async (app) => {
        app.post('/echo', async () => ({ ok: true }));
      },
    };
    const devRequest = {
      method: 'POST' as const,
      url: '/api/v1/echo',
      headers: {
        host: '127.0.0.1:5173',
        origin: 'http://127.0.0.1:5173',
        'x-edr-client': 'web',
        'content-type': 'application/json',
      },
      payload: '{}',
    };
    for (const [file, expected] of [
      ['config/dev.config.json', 200],
      ['config/app.config.json', 421],
    ] as const) {
      const config = loadConfig({ rootDir: REPO_ROOT, env: { EDR_CONFIG: file, EDR_DATA_DIR: dir.path } });
      const test = createTestContainer();
      cleanups.push(() => test.close());
      const app = await buildApp({ ...test.container, config }, { webRoot: null, modules: [echo] });
      cleanups.push(() => app.close());
      expect((await app.inject(devRequest)).statusCode).toBe(expected);
    }
  });
});

describe('startup sequence', () => {
  it('creates the data directory (0700), migrates, then runs the module hooks in order before listening', async () => {
    const { env, port } = await testEnvironment();
    const dataDir = env['EDR_DATA_DIR'] ?? '';
    const calls: string[] = [];
    const hook =
      (name: string): NonNullable<ServerModule['onStartup']> =>
      async (container) => {
        const row = container.db.prepare<{ n: number }>('SELECT count(*) AS n FROM schema_migrations').get();
        calls.push(`${name}:migrated=${String((row?.n ?? 0) > 0)}`, `${name}:${await connectHere(port)}`);
      };
    await start({
      env,
      providers: fakeProviders(),
      modules: [
        { name: 'first', onStartup: hook('first') },
        { name: 'second', onStartup: hook('second') },
      ],
    });

    expect(calls).toEqual(['first:migrated=true', 'first:ECONNREFUSED', 'second:migrated=true', 'second:ECONNREFUSED']);
    expect(statSync(dataDir).mode & 0o777).toBe(DATA_DIRECTORY_MODE);
    expect(existsSync(join(dataDir, DATABASE_FILE_NAME))).toBe(true);
    expect(await connectHere(port)).toBe('CONNECTED');
  });

  it('narrows an existing data directory to 0700 and names the setting when it cannot be used', () => {
    const dir = temporaryDirectory('data-dir');
    cleanups.push(dir.remove);
    const dataDir = join(dir.path, 'data');
    mkdirSync(dataDir, { mode: 0o755 });
    chmodSync(dataDir, 0o755);
    prepareDataDirectory(dataDir);
    expect(statSync(dataDir).mode & 0o777).toBe(0o700);

    const unusable = join(dataDir, `x\u0000${TEST_MARKER_TOKEN}`);
    expect(() => prepareDataDirectory(unusable)).toThrow(
      new ConfigError('dataDir', 'names a directory that cannot be created or used'),
    );
  });

  it('turns off Node diagnostic reports (T11H-F03)', async () => {
    const { env } = await testEnvironment();
    process.report.reportOnFatalError = true;
    process.report.reportOnUncaughtException = true;
    await start({ env, providers: fakeProviders() });
    expect(process.report.reportOnFatalError).toBe(false);
    expect(process.report.reportOnSignal).toBe(false);
    expect(process.report.reportOnUncaughtException).toBe(false);
  });
});

describe('startup failures (OD-20, R-266, T11H-F03)', () => {
  it('exits 1 when a source adapter startup validation fails, naming the variable and never its value', async () => {
    const { env, port } = await testEnvironment();
    process.env[TOKEN_VARIABLE] = TEST_MARKER_TOKEN;
    const io = fakeIo();
    const providers = fakeProviders({
      validateStartup: () => {
        throw new ConfigError(
          TOKEN_VARIABLE,
          'is required when an enabled LIVE_DATA source uses this adapter and must be 1 to 256 printable ASCII characters',
        );
      },
    });
    const result = await main(
      {
        rootDir: REPO_ROOT,
        env: { ...env, [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
        providers,
        logger: silent,
        webRoot: null,
      },
      io,
    );

    expect(result).toBeNull();
    expect(io.codes).toEqual([1]);
    expect(io.err).toHaveLength(1);
    expect(io.err[0]).toMatch(/^Startup failed: FOOTBALL_DATA_API_TOKEN is required/);
    expect(io.err.join('')).not.toContain(TEST_MARKER_TOKEN);
    expect(io.err.join('')).not.toMatch(/\bat\s.+:\d+:\d+|issues|ConfigError/);
    expect(io.out).toEqual([]);
    expect(process.env[TOKEN_VARIABLE]).toBeUndefined();
    expect(await connectHere(port)).toBe('ECONNREFUSED');
  });

  it('names EDR_PORT, never its value', async () => {
    const { env } = await testEnvironment();
    const io = fakeIo();
    await main(
      { rootDir: REPO_ROOT, env: { ...env, EDR_PORT: TEST_MARKER_TOKEN }, providers: fakeProviders(), logger: silent },
      io,
    );
    expect(io.codes).toEqual([1]);
    expect(io.err.join('')).toBe('Startup failed: EDR_PORT must be an integer from 1 to 65535\n');
  });

  it('names a secret-like configuration key, never its value', async () => {
    const dir = temporaryDirectory('secret-key');
    cleanups.push(dir.remove);
    const env = writeTestConfig(dir.path, { extra: { apiKey: TEST_MARKER_TOKEN } });
    const io = fakeIo();
    await main({ rootDir: REPO_ROOT, env, providers: fakeProviders(), logger: silent }, io);
    expect(io.codes).toEqual([1]);
    expect(io.err.join('')).toMatch(/^Startup failed: apiKey looks like a secret/);
    expect(io.err.join('')).not.toContain(TEST_MARKER_TOKEN);
  });

  it('reduces other errors to their type and system code', () => {
    expect(describeStartupError(new Error(`boom ${TEST_MARKER_TOKEN} /home/operator`))).toBe(
      'Startup failed: unexpected error',
    );
    const inUse = Object.assign(new Error('listen EADDRINUSE 127.0.0.1:4300'), { code: 'EADDRINUSE' });
    expect(describeStartupError(inUse)).toBe('Startup failed: unexpected error (EADDRINUSE)');
    expect(describeStartupError(TEST_MARKER_TOKEN)).toBe('Startup failed: unexpected error');
  });

  it('reports the listening address on success', async () => {
    const { env, port } = await testEnvironment();
    const io = fakeIo();
    const server = await main(
      { rootDir: REPO_ROOT, env, providers: fakeProviders(), logger: silent, webRoot: null },
      io,
    );
    cleanups.push(() => server?.close());
    expect(server).not.toBeNull();
    expect(io.out).toEqual([`El Deporte Rey server listening on http://127.0.0.1:${String(port)}\n`]);
    expect(io.codes).toEqual([]);
  });
});

describe('injected environment and the provider token (AD-30, T11H-F03)', () => {
  it('passes the token to the providers only, then removes it from process.env', async () => {
    const { env } = await testEnvironment();
    process.env[TOKEN_VARIABLE] = TEST_MARKER_TOKEN;
    const captured: { sports: SportsSourcesDeps | null; ai: Env | null } = { sports: null, ai: null };
    const seenByModule: (string | undefined)[] = [];
    const server = await start({
      env: { ...process.env, ...env },
      providers: fakeProviders({
        onSportsDeps: (deps) => {
          captured.sports = deps;
        },
        onAiDeps: (deps) => {
          captured.ai = deps.env;
        },
      }),
      modules: [
        {
          name: 'reader',
          onStartup: async () => {
            seenByModule.push(process.env[TOKEN_VARIABLE]);
          },
        },
      ],
    });

    const injected = captured.sports?.env;
    expect(injected?.[TOKEN_VARIABLE]).toBe(TEST_MARKER_TOKEN);
    expect(captured.ai?.[TOKEN_VARIABLE]).toBe(TEST_MARKER_TOKEN);
    expect(JSON.stringify(injected)).toBe('{}');
    expect(Object.keys(injected ?? {})).toEqual([]);
    expect(Object.isFrozen(injected)).toBe(true);

    expect(process.env[TOKEN_VARIABLE]).toBeUndefined();
    expect(seenByModule).toEqual([undefined]);
    expect(JSON.stringify(server.container.config)).not.toContain(TEST_MARKER_TOKEN);
    expect(Object.keys(server.container).sort()).toEqual(
      ['aiProvider', 'catalogue', 'clock', 'config', 'db', 'egress', 'logger', 'paths', 'sources'].sort(),
    );
  });

  it('copies no other environment variable into the injected environment', async () => {
    const { env } = await testEnvironment();
    const captured: { ai: Env | null } = { ai: null };
    await start({
      env: { ...env, HOME: '/home/operator', EDR_AI_API_KEY: TEST_DUMMY_API_KEY },
      providers: fakeProviders({
        onAiDeps: (deps) => {
          captured.ai = deps.env;
        },
      }),
    });
    expect(captured.ai?.['HOME']).toBeUndefined();
    expect(captured.ai?.['EDR_CONFIG']).toBeUndefined();
    expect(captured.ai?.['EDR_AI_API_KEY']).toBe(TEST_DUMMY_API_KEY);
  });
});

describe('no login or account route (R-235, PD-05)', () => {
  it('registers no authentication, session or account route', async () => {
    const test = createTestContainer();
    cleanups.push(() => test.close());
    const app = await buildApp(test.container, { webRoot: null, modules: serverModules });
    cleanups.push(() => app.close());
    await app.ready();
    expect(app.printRoutes({ commonPrefix: false })).not.toMatch(
      /login|logout|signin|signup|auth|session|account|user|password/i,
    );
    for (const path of ['/api/v1/login', '/api/v1/auth', '/api/v1/session', '/api/v1/accounts', '/api/v1/users']) {
      for (const method of ['GET', 'POST'] as const) {
        const response = await app.inject({
          method,
          url: path,
          headers: { host: '127.0.0.1:4300', 'x-edr-client': 'web' },
        });
        expect(response.statusCode).toBe(404);
      }
    }
  });
});
