/**
 * Harness checks: the runner forwards no provider credential or live-test switch to the test processes (and so to the
 * browser) (T10-F11, AD-30, R-257, R-258), keeps browsers in the project-local cache (AD-16), and serves the
 * application on a loopback address.
 */
import { resolve } from 'node:path';

import { expect, test } from '../support/test.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

test.describe('End-to-end harness', () => {
  test('forwards no credential or live-test variable', () => {
    const names = Object.keys(process.env);
    expect(names).not.toContain('FOOTBALL_DATA_API_TOKEN');
    expect(names).not.toContain('EDR_LIVE_TESTS');
    expect(names.filter((name) => /^EDR_/i.test(name))).toEqual([]);
    expect(names.filter((name) => /API_?KEY|TOKEN|SECRET|PASSWORD/i.test(name))).toEqual([]);
  });

  test('uses the project-local browser cache', () => {
    expect(process.env['PLAYWRIGHT_BROWSERS_PATH']).toBe(resolve(PROJECT_ROOT, '.cache/ms-playwright'));
  });

  test('serves the application on the loopback address', async ({ baseURL, request }) => {
    expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:[0-9]+$/);
    const health = await request.get('/api/v1/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
  });
});
