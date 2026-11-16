/**
 * Egress client against a loopback test server (contracts/provider-ports.md section 4; T10-F07): oversize after
 * decompression, slow-drip body hitting the deadline, redirect, foreign origin, `http:` to a non-loopback host, user
 * information. The test server listens on 127.0.0.1 only; the allowed origin is a loopback `http:` origin, which the
 * egress client admits only as a configured AI origin.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { gzipSync } from 'node:zlib';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN, takeNetworkViolations } from '../../../../../vitest.setup.js';

import {
  DEFAULT_AI_MAX_RESPONSE_BYTES,
  DEFAULT_SPORTS_MAX_RESPONSE_BYTES,
  EgressAllowList,
  EgressDenied,
  EgressError,
  type EgressClient,
  type EgressRequestInit,
  IMAGE_EGRESS_LIMITS,
  MAX_RESPONSE_BYTES_LIMIT,
  createEgressClient,
} from './index.js';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

interface TestServer {
  server: Server;
  origin: string;
  requests: string[];
}

async function startServer(handler: Handler): Promise<TestServer> {
  const requests: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    requests.push(`${request.method ?? ''} ${request.url ?? ''}`);
    handler(request, response);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('close', () => sockets.forEach((socket) => socket.destroy()));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${String(port)}`, requests };
}

async function stopServer(target: TestServer): Promise<void> {
  target.server.closeAllConnections();
  await new Promise<void>((resolve) => target.server.close(() => resolve()));
}

const ONE_MIB_OF_ZEROS = Buffer.alloc(1024 * 1024);
const GZIPPED = gzipSync(ONE_MIB_OF_ZEROS);

const routes: Record<string, Handler> = {
  '/json': (request, response) => {
    response.writeHead(200, { 'content-type': 'application/json', 'x-requests-available': '9' });
    response.end(JSON.stringify({ ok: true, method: request.method, header: request.headers['x-test'] ?? null }));
  },
  '/echo': (request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.on('end', () => {
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ body }));
    });
  },
  '/exact': (_request, response) => {
    response.writeHead(200);
    response.end('x'.repeat(1000));
  },
  '/gzip-bomb': (_request, response) => {
    // About 1 KiB on the wire, 1 MiB after decompression; Content-Length states the compressed size.
    response.writeHead(200, { 'content-encoding': 'gzip', 'content-length': String(GZIPPED.length) });
    response.end(GZIPPED);
  },
  '/large-chunked': (_request, response) => {
    // Chunked transfer encoding: no Content-Length at all.
    response.writeHead(200);
    for (let index = 0; index < 8; index += 1) {
      response.write('y'.repeat(512));
    }
    response.end();
  },
  '/slow-drip': (_request, response) => {
    response.writeHead(200);
    const timer = setInterval(() => response.write('a'), 40);
    response.on('close', () => clearInterval(timer));
  },
  '/no-headers': () => {
    // Never answers.
  },
  '/redirect': (_request, response) => {
    response.writeHead(302, { location: '/json' });
    response.end();
  },
  '/server-error': (_request, response) => {
    response.writeHead(503, { 'content-type': 'text/plain' });
    response.end('unavailable');
  },
};

let main: TestServer;
let foreign: TestServer;
let client: EgressClient;

beforeAll(async () => {
  main = await startServer((request, response) => {
    const route = routes[(request.url ?? '').split('?')[0] ?? ''];
    if (route === undefined) {
      response.writeHead(404);
      response.end();
      return;
    }
    route(request, response);
  });
  foreign = await startServer((_request, response) => {
    response.writeHead(200);
    response.end('foreign');
  });
  client = createEgressClient(new EgressAllowList([main.origin]));
});

afterAll(async () => {
  await stopServer(main);
  await stopServer(foreign);
});

beforeEach(() => {
  main.requests.length = 0;
  foreign.requests.length = 0;
});

const GET: EgressRequestInit = { method: 'GET', timeoutMs: 2000, maxResponseBytes: DEFAULT_SPORTS_MAX_RESPONSE_BYTES };

async function failure(promise: Promise<unknown>): Promise<EgressError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(EgressError);
    return error as EgressError;
  }
  throw new Error('expected an EgressError');
}

describe('successful requests', () => {
  it('returns status, headers and text of an allowed origin', async () => {
    const response = await client.request(`${main.origin}/json`, { ...GET, headers: { 'x-test': 'yes' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-requests-available')).toBe('9');
    expect(JSON.parse(response.text)).toEqual({ ok: true, method: 'GET', header: 'yes' });
  });

  it('sends a POST body', async () => {
    const response = await client.request(`${main.origin}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
      timeoutMs: 2000,
      maxResponseBytes: DEFAULT_AI_MAX_RESPONSE_BYTES,
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.text)).toEqual({ body: '{"a":1}' });
  });

  it('returns error statuses to the caller for classification', async () => {
    const response = await client.request(`${main.origin}/server-error`, GET);
    expect(response.status).toBe(503);
  });

  it('accepts a body of exactly the cap', async () => {
    const response = await client.request(`${main.origin}/exact`, { ...GET, maxResponseBytes: 1000 });
    expect(response.text).toHaveLength(1000);
    expect((await failure(client.request(`${main.origin}/exact`, { ...GET, maxResponseBytes: 999 }))).kind).toBe(
      'too_large',
    );
  });
});

describe('size cap on decoded bytes (T10-F07 item 1)', () => {
  it('aborts a gzip body that exceeds the cap after decompression', async () => {
    expect(GZIPPED.length).toBeLessThan(64 * 1024);
    const error = await failure(client.request(`${main.origin}/gzip-bomb`, { ...GET, maxResponseBytes: 64 * 1024 }));
    expect(error.kind).toBe('too_large');
  });

  it('counts streamed bytes, without relying on Content-Length', async () => {
    const error = await failure(client.request(`${main.origin}/large-chunked`, { ...GET, maxResponseBytes: 1024 }));
    expect(error.kind).toBe('too_large');
  });

  it('refuses caps above the 2 MiB schema maximum', async () => {
    const error = await failure(
      client.request(`${main.origin}/json`, { ...GET, maxResponseBytes: MAX_RESPONSE_BYTES_LIMIT + 1 }),
    );
    expect(error.kind).toBe('invalid_request');
    expect(main.requests).toEqual([]);
  });
});

describe('total deadline (T10-F07 item 2)', () => {
  it('fails a slow-drip body at the deadline', async () => {
    const started = Date.now();
    const error = await failure(client.request(`${main.origin}/slow-drip`, { ...GET, timeoutMs: 300 }));
    expect(error.kind).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('fails a server that never sends headers at the deadline', async () => {
    const error = await failure(client.request(`${main.origin}/no-headers`, { ...GET, timeoutMs: 200 }));
    expect(error.kind).toBe('timeout');
  });

  it('honours the caller signal', async () => {
    const controller = new AbortController();
    const pending = client.request(`${main.origin}/slow-drip`, { ...GET, timeoutMs: 5000, signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    expect((await failure(pending)).kind).toBe('aborted');
    const aborted = AbortSignal.abort();
    expect((await failure(client.request(`${main.origin}/json`, { ...GET, signal: aborted }))).kind).toBe('aborted');
  });

  it('refuses deadlines out of range', async () => {
    for (const timeoutMs of [0, 120_001, 1.5]) {
      expect((await failure(client.request(`${main.origin}/json`, { ...GET, timeoutMs }))).kind).toBe(
        'invalid_request',
      );
    }
  });
});

describe('refusals', () => {
  it('fails a redirect without following it (T10-F07 item 3)', async () => {
    const error = await failure(client.request(`${main.origin}/redirect`, GET));
    expect(error.kind).toBe('redirect');
    expect(main.requests).toEqual(['GET /redirect']);
  });

  it('refuses a foreign origin before connecting (T10-F07 item 4)', async () => {
    const error = await failure(client.request(`${foreign.origin}/`, GET));
    expect(error).toBeInstanceOf(EgressDenied);
    expect(foreign.requests).toEqual([]);
  });

  it('refuses http: to a non-loopback host before connecting', async () => {
    const error = await failure(client.request('http://203.0.113.10/', GET));
    expect(error).toBeInstanceOf(EgressDenied);
    expect(takeNetworkViolations()).toEqual([]);
  });

  it('refuses a URL with user information before connecting', async () => {
    const withUser = main.origin.replace('http://', 'http://user:secret@');
    const error = await failure(client.request(`${withUser}/json`, GET));
    expect(error).toBeInstanceOf(EgressDenied);
    expect(main.requests).toEqual([]);
  });

  it('refuses a body on GET', async () => {
    expect((await failure(client.request(`${main.origin}/echo`, { ...GET, body: 'x' }))).kind).toBe('invalid_request');
  });

  it('reports a connection failure as network', async () => {
    const closed = await startServer(() => undefined);
    await stopServer(closed);
    const closedClient = createEgressClient(new EgressAllowList([closed.origin]));
    expect((await failure(closedClient.request(`${closed.origin}/`, GET))).kind).toBe('network');
  });

  it('never puts the URL, query or headers into an error message', async () => {
    const errors = [
      await failure(client.request(`${foreign.origin}/x?token=${TEST_MARKER_TOKEN}`, GET)),
      await failure(
        client.request(`${main.origin}/no-headers?token=${TEST_MARKER_TOKEN}`, {
          ...GET,
          timeoutMs: 100,
          headers: { authorization: `Bearer ${TEST_MARKER_TOKEN}` },
        }),
      ),
      await failure(client.request(`${main.origin}/redirect?token=${TEST_MARKER_TOKEN}`, GET)),
    ];
    for (const error of errors) {
      expect(error.message).not.toContain(TEST_MARKER_TOKEN);
      expect(error.message).not.toContain('127.0.0.1');
      expect(error.cause).toBeUndefined();
    }
  });
});

describe('TLS verification (T10-F07 item 5)', () => {
  it('is never disabled in platform/net', () => {
    const directory = new URL('./', import.meta.url);
    const sources = readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const name of sources) {
      const text = readFileSync(new URL(name, directory), 'utf8');
      expect(text).not.toMatch(/rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED|setGlobalDispatcher|dispatcher\s*:/);
    }
  });
});

describe('bounds per client instance (PD-ARCH-01G-B)', () => {
  const allowList = new EgressAllowList(['https://images.example.test']);

  it('keeps the reviewed bounds on the default client', async () => {
    const client = createEgressClient(allowList);
    for (const init of [
      { method: 'POST', timeoutMs: 120_001, maxResponseBytes: 1024 },
      { method: 'POST', timeoutMs: 1000, maxResponseBytes: MAX_RESPONSE_BYTES_LIMIT + 1 },
    ] as const) {
      await expect(client.request('https://images.example.test/v1', init)).rejects.toMatchObject({
        kind: 'invalid_request',
      });
    }
  });

  it('accepts the larger image bounds only on the image client, before any connection', async () => {
    const client = createEgressClient(new EgressAllowList([]), IMAGE_EGRESS_LIMITS);
    await expect(
      client.request('https://images.example.test/v1', {
        method: 'POST',
        timeoutMs: IMAGE_EGRESS_LIMITS.maxTimeoutMs,
        maxResponseBytes: IMAGE_EGRESS_LIMITS.maxResponseBytes,
        body: '{}',
      }),
    ).rejects.toBeInstanceOf(EgressDenied);
    await expect(
      client.request('https://images.example.test/v1', {
        method: 'POST',
        timeoutMs: IMAGE_EGRESS_LIMITS.maxTimeoutMs + 1,
        maxResponseBytes: 1024,
      }),
    ).rejects.toMatchObject({ kind: 'invalid_request' });
  });
});
