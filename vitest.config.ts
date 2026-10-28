import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Vitest projects (architecture-delta.md section 7.1):
 * - unit: `*.test.ts` next to the code (server, packages, fixtures), `apps/server/test/static/**`, `scripts/**` tests;
 * - unit-web: web unit tests in jsdom (`apps/web/**`); `npm run test:unit` runs both unit projects;
 * - integration: `*.int.test.ts` next to server code and every test under `apps/server/test/integration/`;
 * - contract: `apps/server/test/contract/`;
 * - live: optional live tests (`*.live.test.ts`), excluded from every other project, never in a gate; it does not
 *   use the shared setup, which removes the credentials and blocks non-loopback connections.
 */

const SETUP = ['./vitest.setup.ts'];
const LIVE = '**/*.live.test.ts';
const INTEGRATION = ['apps/server/src/**/*.int.test.ts', 'apps/server/test/integration/**/*.test.ts'];
const ALWAYS_EXCLUDED = ['**/node_modules/**', '**/dist/**', '.cache/**', 'data/**', 'e2e/**', '.claude/**'];

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@edr\/contracts$/,
        replacement: fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    // node:sqlite prints an ExperimentalWarning on Node.js 22 (OD-30).
    execArgv: ['--disable-warning=ExperimentalWarning'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          setupFiles: SETUP,
          include: [
            'apps/server/src/**/*.test.ts',
            'apps/server/scripts/**/*.test.ts',
            'apps/server/test/static/**/*.test.ts',
            'packages/*/src/**/*.test.ts',
            'fixtures/**/*.test.ts',
            'scripts/**/*.test.mjs',
          ],
          exclude: [...ALWAYS_EXCLUDED, LIVE, ...INTEGRATION],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-web',
          environment: 'jsdom',
          setupFiles: SETUP,
          include: ['apps/web/**/*.test.{ts,tsx}'],
          exclude: [...ALWAYS_EXCLUDED, LIVE, '**/*.int.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          setupFiles: SETUP,
          include: INTEGRATION,
          exclude: [...ALWAYS_EXCLUDED, LIVE],
        },
      },
      {
        extends: true,
        test: {
          name: 'contract',
          environment: 'node',
          setupFiles: SETUP,
          include: ['apps/server/test/contract/**/*.test.ts'],
          exclude: [...ALWAYS_EXCLUDED, LIVE],
        },
      },
      {
        extends: true,
        test: {
          name: 'live',
          environment: 'node',
          include: [LIVE],
          exclude: ALWAYS_EXCLUDED,
        },
      },
    ],
  },
});
