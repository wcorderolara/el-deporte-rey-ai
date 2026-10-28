/**
 * Test-only sports-data adapter kind `test-live` (OD-24, AD-37, T11G LOW-3): declared mode LIVE_DATA, options
 * `{ baseUrl, scenario }`. It reads the multi-competition file `fixtures/sports/<scenario>/<sourceId>.json` exactly
 * like the fixture adapter (it delegates to it) and never makes a network request: `baseUrl` is validated and lands
 * in the egress allow-list like any LIVE_DATA base URL, but nothing is ever sent to it.
 *
 * It is registered only through the `createSportsSources` test seam (`extraAdapters`) by the test app factory; the
 * production adapter registry and `container.ts` never register it, and no committed configuration names it (V-52;
 * asserted by `test/integration/platform/test-live-adapter.test.ts`). It fills the secondary LIVE_DATA verification
 * role for R-256 and the OD-24 tests (T52).
 */
import { z } from 'zod';

import { ConfigError } from '../../src/platform/config/index.js';
import { createFixtureSource } from '../../src/providers/sports/adapters/fixture/index.js';
import {
  type AdapterContext,
  type AdapterRegistration,
  type IngestionSource,
  SourceError,
} from '../../src/providers/sports/index.js';

/** The adapter kind slug. */
export const TEST_LIVE_ADAPTER_KIND = 'test-live';

/** Options of a `test-live` source. */
export const testLiveOptionsSchema = z.strictObject({
  /** An `https:` URL, as for every LIVE_DATA source; never contacted. */
  baseUrl: z
    .string()
    .max(2048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.username === '' && url.password === '';
      } catch {
        return false;
      }
    }),
  scenario: z.string().regex(/^[a-z0-9-]{1,60}$/),
});

export type TestLiveOptions = z.output<typeof testLiveOptionsSchema>;

/** A source whose options are invalid: startup stops naming the setting, never a value. */
function invalidSource(context: AdapterContext): IngestionSource {
  const refuse = (): Promise<never> =>
    Promise.reject(new SourceError('unavailable', 'test-live options are invalid', context.descriptor.id));
  return Object.freeze({
    descriptor: context.descriptor,
    listCompetitions: refuse,
    listSeasons: refuse,
    listStages: refuse,
    fetchSelection: refuse,
    validateStartup(): void {
      throw new ConfigError(`${context.setting}.options`, 'must be { baseUrl: https: URL, scenario: a-z0-9- }');
    },
  });
}

function createTestLiveSource(context: AdapterContext): IngestionSource {
  const parsed = testLiveOptionsSchema.safeParse(context.options);
  if (!parsed.success) {
    return invalidSource(context);
  }
  // The fixture adapter reads `fixtures/sports/<scenario>/<sourceId>.json` and stamps the descriptor's mode
  // (LIVE_DATA here) on every snapshot; it never uses the egress client.
  const inner = createFixtureSource({ ...context, options: Object.freeze({ scenario: parsed.data.scenario }) });
  return Object.freeze({
    descriptor: context.descriptor,
    listCompetitions: (ctx) => inner.listCompetitions(ctx),
    listSeasons: (competition, ctx) => inner.listSeasons(competition, ctx),
    listStages: (competition, season, ctx) => inner.listStages(competition, season, ctx),
    fetchSelection: (selection, ctx) => inner.fetchSelection(selection, ctx),
    validateStartup: (): void => inner.validateStartup?.(),
  } satisfies IngestionSource);
}

/** Registration of the `test-live` kind, for the `createSportsSources` test seam only. */
export const testLiveAdapter: AdapterRegistration = Object.freeze({
  kind: TEST_LIVE_ADAPTER_KIND,
  mode: 'LIVE_DATA',
  create: createTestLiveSource,
});
