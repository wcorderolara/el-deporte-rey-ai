/**
 * Logger redaction and request-log content (R-263; T10-F11, T11H-F03, T11H-F12).
 */
import { describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import { REDACTED, REDACT_PATHS, createLogger, summarizeError } from './logger.js';
import { createHttpServer } from './server.js';

const HOST = '127.0.0.1:4300';

function capture(level: 'info' | 'trace' = 'trace') {
  const chunks: string[] = [];
  const logger = createLogger({ level, destination: { write: (line: string) => chunks.push(line) } });
  return { logger, text: () => chunks.join('') };
}

/** One log object per required path, with the marker at that path. */
const CASES: readonly [path: string, object: Record<string, unknown>][] = [
  ['req.headers.authorization', { req: { headers: { authorization: `Bearer ${TEST_MARKER_TOKEN}` } } }],
  ['headers.authorization', { headers: { authorization: `Bearer ${TEST_MARKER_TOKEN}` } }],
  ['req.headers["x-auth-token"]', { req: { headers: { 'x-auth-token': TEST_MARKER_TOKEN } } }],
  ['headers["x-auth-token"]', { headers: { 'x-auth-token': TEST_MARKER_TOKEN } }],
  ['*.apiKey', { provider: { apiKey: TEST_DUMMY_API_KEY } }],
  ['*.key', { options: { key: TEST_MARKER_TOKEN } }],
  ['*.token', { adapter: { token: TEST_MARKER_TOKEN } }],
  ['*.authToken', { adapter: { authToken: TEST_MARKER_TOKEN } }],
  ['*.secret', { settings: { secret: TEST_MARKER_TOKEN } }],
  ['*.password', { account: { password: TEST_MARKER_TOKEN } }],
  ['token (top level)', { token: TEST_MARKER_TOKEN }],
  ['apiKey (top level)', { apiKey: TEST_DUMMY_API_KEY }],
];

describe('logger redaction', () => {
  it('declares the explicit redaction paths of T10-F11 and T11H-F03', () => {
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'headers.authorization',
        'req.headers["x-auth-token"]',
        'headers["x-auth-token"]',
        '*.apiKey',
        '*.key',
        '*.token',
        '*.authToken',
        '*.secret',
        '*.password',
      ]),
    );
  });

  it.each(CASES)('never writes the marker placed at %s', (_path, object) => {
    for (const level of ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const) {
      const log = capture();
      log.logger[level](object, 'message');
      log.logger.child({ module: 'test' })[level](object, 'child message');
      const text = log.text();
      expect(text).not.toContain(TEST_MARKER_TOKEN);
      expect(text).not.toContain(TEST_DUMMY_API_KEY);
      expect(text).toContain('message');
    }
  });

  it('replaces redacted values with the censor text', () => {
    const log = capture();
    log.logger.info({ headers: { authorization: TEST_MARKER_TOKEN }, adapter: { token: TEST_MARKER_TOKEN } }, 'x');
    const line = JSON.parse(log.text()) as { headers: { authorization: string }; adapter: { token: string } };
    expect(line.headers.authorization).toBe(REDACTED);
    expect(line.adapter.token).toBe(REDACTED);
  });

  it('logs errors as type, code and stack frames, never their message', () => {
    const error = Object.assign(new Error(`provider said ${TEST_MARKER_TOKEN}`), { code: 'E_TEST' });
    expect(summarizeError(error)).toMatchObject({ type: 'Error', code: 'E_TEST' });
    const log = capture();
    log.logger.error({ err: error }, 'failed');
    expect(log.text()).not.toContain(TEST_MARKER_TOKEN);
    expect(log.text()).toContain('E_TEST');
  });

  it('writes no hostname or process ID', () => {
    const log = capture();
    log.logger.info('plain');
    const line = JSON.parse(log.text()) as Record<string, unknown>;
    expect(line).not.toHaveProperty('hostname');
    expect(line).not.toHaveProperty('pid');
  });
});

describe('request logging', () => {
  it('logs method, route, status and duration only: no URL, query, header or body (T10-F11, T11H-F12)', async () => {
    const log = capture();
    const app = createHttpServer({
      allowedHosts: [HOST],
      allowedOrigins: [`http://${HOST}`],
      logger: log.logger,
    });
    app.post('/api/v1/items/:id', async () => ({ ok: true }));
    await app.ready();
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/items/${TEST_MARKER_TOKEN}?q=${TEST_MARKER_TOKEN}`,
      headers: {
        host: HOST,
        'x-edr-client': 'web',
        authorization: `Bearer ${TEST_MARKER_TOKEN}`,
        'x-auth-token': TEST_MARKER_TOKEN,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ cell: TEST_MARKER_TOKEN }),
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(log.text()).not.toContain(TEST_MARKER_TOKEN);
    const lines = log
      .text()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const completed = lines.filter((line) => line['msg'] === 'request completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ method: 'POST', route: '/api/v1/items/:id', status: 200 });
    expect(Object.keys(completed[0] ?? {}).sort()).toEqual(
      ['durationMs', 'level', 'method', 'msg', 'reqId', 'route', 'status', 'time'].sort(),
    );
    expect(lines.some((line) => line['msg'] === 'incoming request')).toBe(false);
  });
});
