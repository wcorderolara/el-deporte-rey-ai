/**
 * Request logs and redaction (T10-F11, T11H-F03, T11H-F12; R-260, R-263): a request carrying the synthetic marker
 * token in `X-Auth-Token` (and the dummy key in `Authorization`, the query and the body) leaves no trace of either in
 * the server log, whose request lines hold method, route, status and duration only; objects logged with credential
 * headers or fields are redacted.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { REDACTED } from '../../../src/platform/http/index.js';
import { API, type TestApp, startTestApp } from '../../support/index.js';

let t: TestApp;

beforeAll(async () => {
  t = await startTestApp({ base: 'demo-only', scenario: 'default' });
});

afterAll(async () => {
  await t.close();
});

const CREDENTIAL_HEADERS = {
  'x-auth-token': TEST_MARKER_TOKEN,
  authorization: `Bearer ${TEST_DUMMY_API_KEY}`,
};

describe('X-Auth-Token and other credentials in request logs', () => {
  it('logs one line per request with method, route, status and duration only, never a header, query or body', async () => {
    const before = t.log.lines().length;
    const responses = [
      await t.request({
        path: `${API}/health?token=${TEST_MARKER_TOKEN}`,
        headers: { host: t.host, ...CREDENTIAL_HEADERS },
      }),
      await t.request({
        method: 'POST',
        path: `${API}/projects?key=${TEST_DUMMY_API_KEY}`,
        headers: { ...t.writeHeaders, ...CREDENTIAL_HEADERS },
        body: JSON.stringify({ competitionId: TEST_MARKER_TOKEN, apiKey: TEST_DUMMY_API_KEY }),
      }),
      await t.request({
        path: `${API}/projects/${TEST_MARKER_TOKEN}`,
        headers: { host: t.host, ...CREDENTIAL_HEADERS },
      }),
      await t.request({ path: `${API}/health`, headers: { host: 'foreign.example:1', ...CREDENTIAL_HEADERS } }),
    ];
    expect(responses.map((response) => response.status)).toEqual([200, 400, 400, 421]);
    for (const response of responses) {
      expect(response.body).not.toContain(TEST_MARKER_TOKEN);
      expect(response.body).not.toContain(TEST_DUMMY_API_KEY);
    }

    const text = t.log.text();
    expect(text).not.toContain(TEST_MARKER_TOKEN);
    expect(text).not.toContain(TEST_DUMMY_API_KEY);
    const requestLines = t.log
      .lines()
      .slice(before)
      .filter((line) => line['msg'] === 'request completed');
    expect(requestLines).toHaveLength(4);
    for (const line of requestLines) {
      expect(Object.keys(line).sort()).toEqual([
        'durationMs',
        'level',
        'method',
        'msg',
        'reqId',
        'route',
        'status',
        'time',
      ]);
    }
  });

  it('redacts credential headers and fields in logged objects', () => {
    t.container.logger.warn(
      {
        req: { headers: { 'x-auth-token': TEST_MARKER_TOKEN, authorization: `Bearer ${TEST_DUMMY_API_KEY}` } },
        headers: { 'x-auth-token': TEST_MARKER_TOKEN, authorization: `Bearer ${TEST_DUMMY_API_KEY}` },
        token: TEST_MARKER_TOKEN,
        provider: { apiKey: TEST_DUMMY_API_KEY },
      },
      'synthetic credential redaction check',
    );
    const line = t.log.lines().find((entry) => entry['msg'] === 'synthetic credential redaction check');
    expect(line).toBeDefined();
    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain(TEST_MARKER_TOKEN);
    expect(serialized).not.toContain(TEST_DUMMY_API_KEY);
    expect((line?.['headers'] as Record<string, unknown>)['x-auth-token']).toBe(REDACTED);
    expect(line?.['token']).toBe(REDACTED);
  });
});
