/**
 * Harness checks: the runner forwards no provider credential or live-test switch to the test processes (and so to the
 * browser) (T10-F11, AD-30, R-257, R-258), keeps browsers in the project-local cache (AD-16), serves the
 * application on a loopback address, and generates the DEMO_DATA plus MANUAL_DATA configuration (OD-44) whose
 * scenario overrides reach only DEMO_DATA fixture sources.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { INCLUDED_MODES, baseConfigPath, serverConfigDocument } from '../support/harness.mjs';
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

  test('generates the DEMO_DATA plus MANUAL_DATA configuration; scenario overrides reach only fixture sources', () => {
    expect(INCLUDED_MODES).toEqual(['DEMO_DATA', 'MANUAL_DATA']);
    const base: unknown = JSON.parse(readFileSync(resolve(PROJECT_ROOT, baseConfigPath(PROJECT_ROOT)), 'utf8'));
    interface Source {
      id: string;
      mode: string;
      options: { scenario?: string };
    }
    const sourcesOf = (document: unknown) =>
      (document as { providers: { sports: { sources: Source[] }; ai: { adapter: string } } }).providers;
    const plain = sourcesOf(serverConfigDocument(base, 4999));
    expect(plain.sports.sources.map((source) => source.mode)).toEqual(['DEMO_DATA', 'DEMO_DATA', 'MANUAL_DATA']);
    expect(plain.ai.adapter).toBe('stub');
    const failing = sourcesOf(serverConfigDocument(base, 4999, { 'demo-a': 'provider-unavailable' }));
    expect(failing.sports.sources.map((source) => source.options.scenario ?? null)).toEqual([
      'provider-unavailable',
      'default',
      null,
    ]);
    expect(() => serverConfigDocument(base, 4999, { manual: 'default' })).toThrow(/No included DEMO_DATA source/);
    expect(() => serverConfigDocument(base, 4999, { 'demo-a': '../outside' })).toThrow(/must match/);
  });
});
