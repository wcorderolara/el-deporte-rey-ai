/**
 * Network guard of the shared Vitest setup (R-241, R-225, R-257, T10-F08): third-party-style connections to
 * non-loopback addresses fail at socket level, loopback connections work, and the provider credentials and the
 * live-test switch are absent from the environment of the default projects.
 */
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  NETWORK_GUARD_ERROR_CODE,
  SCRUBBED_ENV_VARIABLES,
  TEST_DUMMY_API_KEY,
  TEST_MARKER_TOKEN,
  isLoopbackHost,
  takeNetworkViolations,
} from '../../../../vitest.setup.js';

/** TEST-NET-1 (RFC 5737) documentation address: never routable, never a real service. */
const NON_LOOPBACK = '192.0.2.1';

function socketError(socket: net.Socket): Promise<NodeJS.ErrnoException> {
  return new Promise((resolve, reject) => {
    socket.once('error', resolve);
    socket.once('connect', () => reject(new Error('unexpected connection')));
  });
}

describe('network guard', () => {
  let server: net.Server;
  let port: number;

  beforeAll(async () => {
    server = net.createServer((socket) => socket.end('ok'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('refuses a direct socket connection to a non-loopback address', async () => {
    const error = await socketError(new net.Socket().connect(443, NON_LOOPBACK));
    expect(error.code).toBe(NETWORK_GUARD_ERROR_CODE);
    expect(takeNetworkViolations()).toEqual([`${NON_LOOPBACK}:443`]);
  });

  it('refuses net.connect and net.createConnection to a non-loopback host name', async () => {
    const first = await socketError(net.connect({ host: 'provider.example.com', port: 443 }));
    const second = await socketError(net.createConnection(80, 'provider.example.com'));
    expect([first.code, second.code]).toEqual([NETWORK_GUARD_ERROR_CODE, NETWORK_GUARD_ERROR_CODE]);
    expect(takeNetworkViolations()).toEqual(['provider.example.com:443', 'provider.example.com:80']);
  });

  it('refuses TLS and HTTP client connections to a non-loopback address', async () => {
    const tlsError = await socketError(tls.connect({ host: NON_LOOPBACK, port: 443, servername: 'example.com' }));
    expect(tlsError.code).toBe(NETWORK_GUARD_ERROR_CODE);
    const httpError = await new Promise<NodeJS.ErrnoException>((resolve) => {
      http.get(`http://${NON_LOOPBACK}/`).once('error', resolve);
    });
    expect(httpError.code).toBe(NETWORK_GUARD_ERROR_CODE);
    expect(takeNetworkViolations()).toEqual([`${NON_LOOPBACK}:443`, `${NON_LOOPBACK}:80`]);
  });

  it('refuses fetch to a non-loopback origin through the undici global dispatcher', async () => {
    await expect(fetch(`https://${NON_LOOPBACK}/`)).rejects.toThrow();
    expect(takeNetworkViolations()).toEqual([`https://${NON_LOOPBACK}`]);
  });

  it('allows loopback connections', async () => {
    const socket = net.connect(port, '127.0.0.1');
    const data = await new Promise<string>((resolve, reject) => {
      let text = '';
      socket.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')));
      socket.on('end', () => resolve(text));
      socket.on('error', reject);
    });
    expect(data).toBe('ok');
    expect(takeNetworkViolations()).toEqual([]);
  });

  it('classifies loopback hosts', () => {
    for (const host of [undefined, '', 'localhost', '127.0.0.1', '127.8.9.10', '::1', '[::1]', '::ffff:127.0.0.1']) {
      expect(isLoopbackHost(host), String(host)).toBe(true);
    }
    for (const host of ['0.0.0.0', '10.0.0.1', '192.0.2.1', '::', '2001:db8::1', 'example.com', 'localhost.example']) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });
});

describe('test environment', () => {
  it('has no provider credential and no live-test switch', () => {
    for (const name of SCRUBBED_ENV_VARIABLES) {
      expect(process.env[name], name).toBeUndefined();
    }
  });

  it('provides recognizable synthetic credential values', () => {
    expect(TEST_MARKER_TOKEN).toBe('edr-test-marker-token-0000');
    expect(TEST_DUMMY_API_KEY).toMatch(/^edr-test-/);
  });
});
