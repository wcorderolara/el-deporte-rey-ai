/**
 * Smoke integration test: the Fastify application answers the health operation (getHealth) through `inject`, and the
 * shared network guard is active in the integration project (R-225, R-257).
 */
import net from 'node:net';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NETWORK_GUARD_ERROR_CODE, takeNetworkViolations } from '../../../../../vitest.setup.js';
import { API_PREFIX, buildApp } from '../../../src/app.js';
import { createContainer } from '../../../src/container.js';

describe('server smoke', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(createContainer());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers GET /api/v1/health with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/health` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers 404 for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: `${API_PREFIX}/unknown` });
    expect(response.statusCode).toBe(404);
  });

  it('runs with the network guard and without provider credentials', async () => {
    expect(process.env['FOOTBALL_DATA_API_TOKEN']).toBeUndefined();
    expect(process.env['EDR_LIVE_TESTS']).toBeUndefined();
    const socket = net.connect({ host: '192.0.2.1', port: 443 });
    const error = await new Promise<NodeJS.ErrnoException>((resolve) => socket.once('error', resolve));
    expect(error.code).toBe(NETWORK_GUARD_ERROR_CODE);
    expect(takeNetworkViolations()).toEqual(['192.0.2.1:443']);
  });
});
