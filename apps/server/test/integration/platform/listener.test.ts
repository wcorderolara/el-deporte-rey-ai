/**
 * Loopback-only listener (R-234, PD-05) and the development origin set (T10-F02, OD-37), on servers started by the
 * shared test app factory with generated configurations.
 *
 * - The listener is bound to 127.0.0.1; a connection to a non-loopback interface address of this host is refused
 *   (checked from a separate Node process, outside the test network guard, which would refuse it on its own).
 * - The Vite development Host and Origin (port 5173) are accepted only with the allow-lists of
 *   `config/dev.config.json`, and refused with those of `config/app.config.json`.
 */
import { execFile } from 'node:child_process';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  API,
  type Json,
  REPO_ROOT,
  type TestApp,
  expectNoNetworkViolations,
  readJson,
  startTestApp,
} from '../../support/index.js';

const apps: TestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

async function start(options: Parameters<typeof startTestApp>[0] = {}): Promise<TestApp> {
  const app = await startTestApp(options);
  apps.push(app);
  return app;
}

/** Connection outcome to `host:port` from a separate Node process. */
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

/** The non-internal IPv4 and IPv6 addresses of this host. */
function nonLoopbackAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal && !entry.address.startsWith('fe80'))
    .map((entry) => entry.address);
}

describe('listener (R-234)', () => {
  it('binds 127.0.0.1 only and answers over loopback TCP', async () => {
    const t = await start();
    expect(t.server.address.address).toBe('127.0.0.1');
    expect(t.server.address.family).toMatch(/^(IPv4|4)$/);
    expect(t.app.server.listening).toBe(true);
    const response = await t.request({ path: `${API}/health`, headers: { host: t.host } });
    expect(response.status).toBe(200);
    expect(await connectFromChild('127.0.0.1', t.port)).toBe('CONNECTED');
  });

  it('refuses connections through every non-loopback interface address of this host', async () => {
    const t = await start();
    const addresses = nonLoopbackAddresses();
    for (const address of addresses) {
      const outcome = await connectFromChild(address, t.port);
      expect(outcome, `connection through ${address}`).not.toBe('CONNECTED');
    }
    // Without any non-loopback interface the refusal holds trivially; the binding check above still applies.
    expect(t.server.address.address).toBe('127.0.0.1');
  });

  it('opens no non-loopback socket from the test process', async () => {
    const t = await start();
    await new Promise<void>((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port: t.port }, () => {
        socket.destroy();
        resolve();
      });
    });
    expectNoNetworkViolations();
  });
});

describe('development origin set (T10-F02, OD-37)', () => {
  const VITE_HOST = '127.0.0.1:5173';
  const VITE_ORIGIN = 'http://localhost:5173';

  /** A server whose Host and Origin allow-lists are those of a committed configuration file. */
  async function withAllowListsOf(file: string): Promise<TestApp> {
    const committed = readJson<Json>(join(REPO_ROOT, 'config', file));
    const server = committed['server'] as Json;
    return start({
      mutate: (document) => {
        const generated = document['server'] as Json;
        generated['allowedHosts'] = server['allowedHosts'];
        generated['allowedOrigins'] = server['allowedOrigins'];
      },
    });
  }

  async function viteRequests(t: TestApp): Promise<[number, number]> {
    const read = await t.inject({ method: 'GET', url: `${API}/projects`, headers: { host: VITE_HOST } });
    const write = await t.inject({
      method: 'POST',
      url: `${API}/projects`,
      headers: { host: VITE_HOST, origin: VITE_ORIGIN, 'x-edr-client': 'web', 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });
    return [read.statusCode, write.statusCode];
  }

  it('accepts the 5173 Host and Origin with the development configuration', async () => {
    const t = await withAllowListsOf('dev.config.json');
    const [read, write] = await viteRequests(t);
    expect(read).toBe(200);
    // Past the guards: the empty body is refused by validation, not by the origin protection.
    expect(write).toBe(400);
  });

  it('refuses the 5173 Host (421) and Origin (403) with the production configuration', async () => {
    const t = await withAllowListsOf('app.config.json');
    const [read] = await viteRequests(t);
    expect(read).toBe(421);
    const write = await t.inject({
      method: 'POST',
      url: `${API}/projects`,
      headers: {
        host: '127.0.0.1:4300',
        origin: VITE_ORIGIN,
        'x-edr-client': 'web',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });
    expect(write.statusCode).toBe(403);
    expect(write.json()).toMatchObject({ code: 'FORBIDDEN_ORIGIN' });
  });

  it('keeps the committed production allow-lists loopback-only, without the development port', () => {
    const server = readJson<Json>(join(REPO_ROOT, 'config', 'app.config.json'))['server'] as Json;
    const values = [...(server['allowedHosts'] as string[]), ...(server['allowedOrigins'] as string[])];
    expect(values.every((value) => /^(http:\/\/)?(127\.0\.0\.1|localhost):4300$/.test(value))).toBe(true);
    expect(server['host']).toBe('127.0.0.1');
  });
});
