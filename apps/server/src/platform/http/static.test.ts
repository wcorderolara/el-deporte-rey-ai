/**
 * Static UI and SPA fallback (T10-F13; TB-5): rooted only at the web root, dotfiles denied, no listing, SPA fallback
 * never under /api, every response behind the Host guard and with the security headers.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import { createLogger } from './logger.js';
import { createHttpServer, registerStaticUi } from './server.js';

const HOST = '127.0.0.1:4300';
const INDEX = '<!doctype html><title>EDR</title><div id="root"></div>';

let base: string;
let app: FastifyInstance;

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'edr-static-'));
  const webRoot = join(base, 'dist');
  mkdirSync(join(webRoot, 'assets'), { recursive: true });
  writeFileSync(join(webRoot, 'index.html'), INDEX);
  writeFileSync(join(webRoot, 'assets', 'app.js'), 'console.log("app");');
  writeFileSync(join(webRoot, '.env'), `TOKEN=${TEST_MARKER_TOKEN}`);
  writeFileSync(join(webRoot, 'assets', '.hidden'), TEST_MARKER_TOKEN);
  // Outside the web root (as the data directory would be).
  mkdirSync(join(base, 'data'));
  writeFileSync(join(base, 'data', 'edr.sqlite'), TEST_MARKER_TOKEN);
  writeFileSync(join(base, 'secret.txt'), TEST_MARKER_TOKEN);

  app = createHttpServer({
    allowedHosts: [HOST],
    allowedOrigins: [`http://${HOST}`],
    logger: createLogger({ level: 'silent' }),
  });
  app.get('/api/v1/ping', async () => ({ ok: true }));
  await registerStaticUi(app, webRoot);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(base, { recursive: true, force: true });
});

const get = (url: string, host = HOST) => app.inject({ method: 'GET', url, headers: { host } });

describe('static UI', () => {
  it('serves the entry document and assets with the security headers', async () => {
    const index = await get('/');
    expect(index.statusCode).toBe(200);
    expect(index.body).toBe(INDEX);
    expect(index.headers['content-security-policy']).toContain("connect-src 'self'");
    expect(index.headers['x-content-type-options']).toBe('nosniff');
    const asset = await get('/assets/app.js');
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it.each(['/.env', '/assets/.hidden', '/%2e%65nv'])('denies the dotfile %s', async (url) => {
    const response = await get(url);
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(TEST_MARKER_TOKEN);
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    '/../secret.txt',
    '/%2e%2e/secret.txt',
    '/assets/..%2f..%2fsecret.txt',
    '/%2e%2e/data/edr.sqlite',
    '/..%5csecret.txt',
  ])('never serves files outside the web root: %s', async (url) => {
    const response = await get(url);
    expect(response.body).not.toContain(TEST_MARKER_TOKEN);
    expect(response.statusCode).not.toBe(500);
  });

  // @fastify/static 10.1.11 (UI-06.3): non-canonical paths and other spellings of a file are refused, so they never
  // reach a file through an alias; the answer is the product's 404 problem, never a 500.
  it.each(['/assets//app.js', '//assets/app.js', '/ASSETS/app.js', '/assets/APP.JS', '/assets/app.js%3Fx'])(
    'answers the non-canonical or differently spelled path %s with the 404 problem',
    async (url) => {
      const response = await get(url);
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect(response.body).not.toContain('console.log');
    },
  );

  it('still serves an asset requested with a query string and a normalized path', async () => {
    for (const url of ['/assets/app.js?v=1', '/assets/./app.js']) {
      const response = await get(url);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('console.log("app");');
    }
  });

  it('lists no directory', async () => {
    const response = await get('/assets/');
    expect(response.body).not.toContain('app.js');
  });

  it('answers SPA navigations with the entry document', async () => {
    for (const url of ['/projects', '/projects/0f8fad5b-d9cb-469f-a165-70867728950e', '/imports?x=1']) {
      const response = await get(url);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(INDEX);
    }
  });

  it('never answers /api with the SPA fallback', async () => {
    for (const url of ['/api/v1/missing', '/api', '/api/', '//api/v1/missing', '/%61pi/v1/missing']) {
      const response = await get(url);
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('answers a missing file with 404 instead of the entry document', async () => {
    const response = await get('/assets/missing.js');
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toBe(INDEX);
  });

  it('applies the Host guard to static files and the SPA fallback', async () => {
    for (const url of ['/', '/assets/app.js', '/projects', '/.env']) {
      const response = await get(url, 'evil.example:4300');
      expect(response.statusCode).toBe(421);
      expect(response.json()).toMatchObject({ code: 'MISDIRECTED_HOST' });
    }
  });

  it('applies the mutating-request guard outside /api', async () => {
    expect((await app.inject({ method: 'POST', url: '/', headers: { host: HOST } })).statusCode).toBe(403);
    const withHeader = await app.inject({ method: 'POST', url: '/', headers: { host: HOST, 'x-edr-client': 'web' } });
    expect(withHeader.statusCode).toBe(404);
    expect(withHeader.body).not.toBe(INDEX);
  });
});

describe('without a built UI', () => {
  it('answers every unknown path with 404 NOT_FOUND', async () => {
    const bare = createHttpServer({
      allowedHosts: [HOST],
      allowedOrigins: [`http://${HOST}`],
      logger: createLogger({ level: 'silent' }),
    });
    await registerStaticUi(bare, null);
    await bare.ready();
    const response = await bare.inject({ method: 'GET', url: '/', headers: { host: HOST } });
    await bare.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });
});
