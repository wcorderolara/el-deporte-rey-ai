/**
 * Playwright configuration of the end-to-end and accessibility suites (architecture-delta.md section 7.1).
 *
 * Run only through `e2e/run.mjs` (`npm run test:e2e`, `npm run test:a11y`), which builds the configuration, starts the
 * built server on 127.0.0.1 and passes its address in `E2E_BASE_URL`. Accessibility tests carry the `@a11y` tag in
 * their title. Deterministic settings: one worker, no retries, fixed locale and time zone, no traces, screenshots or
 * videos, no HTML report (output under the git-ignored `.cache/`).
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'];
if (baseURL === undefined || baseURL === '') {
  throw new Error('Run the end-to-end tests through e2e/run.mjs (npm run test:e2e or npm run test:a11y).');
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  outputDir: '../.cache/e2e/test-results',
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'es-GT',
    timezoneId: 'America/Guatemala',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  // Full Chromium in new headless mode: axe's color-contrast rule never completes in the headless shell.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } }],
});
