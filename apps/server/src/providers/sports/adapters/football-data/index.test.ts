/**
 * FootballDataProvider stub (T21; replaced by T49): an enabled source using the kind stops startup with "adapter not
 * available", without reading the environment or making a request; a disabled one does not.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';
import { ConfigError } from '../../../../platform/config/index.js';
import { createSportsSources } from '../../index.js';
import { config, deps, discovery } from '../../test/synthetic.js';
import { ADAPTER_NOT_AVAILABLE } from '../unavailable.js';

const SOURCE = {
  id: 'live-a',
  name: 'Live source',
  mode: 'LIVE_DATA',
  role: 'primary',
  accepted: true,
  adapter: 'football-data',
  options: { baseUrl: 'https://sports.example.test/v4' },
};

describe('FootballDataProvider stub', () => {
  it('stops startup with "adapter not available" when enabled', () => {
    const testDeps = deps('/srv/edr-test-root', { FOOTBALL_DATA_API_TOKEN: TEST_MARKER_TOKEN });
    let error: unknown;
    try {
      createSportsSources(config([SOURCE]), testDeps);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).setting).toBe('providers.sports.sources[0].adapter');
    expect((error as ConfigError).message).toContain(ADAPTER_NOT_AVAILABLE);
    expect((error as ConfigError).message).not.toContain(TEST_MARKER_TOKEN);
    expect(testDeps.egress.calls).toEqual([]);
  });

  it('is accepted while disabled', async () => {
    const extra = {
      id: 'demo-a',
      name: 'Demo',
      mode: 'DEMO_DATA',
      role: 'primary',
      accepted: true,
      adapter: 'stub-ok',
      options: {},
    };
    const registry = createSportsSources(config([{ ...SOURCE, enabled: false }, extra]), deps('/srv/edr-test-root'), {
      extraAdapters: [
        {
          kind: 'stub-ok',
          mode: 'DEMO_DATA',
          create: ({ descriptor }) => ({
            descriptor,
            listCompetitions: () =>
              Promise.resolve({
                items: [],
                availability: { available: true },
                retrievedAt: null,
                fromCache: false,
                stale: false,
                retryAfterSeconds: null,
              }),
            listSeasons: () => Promise.reject(new Error('unused')),
            listStages: () => Promise.reject(new Error('unused')),
            fetchSelection: () => Promise.reject(new Error('unused')),
          }),
        },
      ],
    });
    expect(registry.sourceIds).toEqual(['demo-a']);
    expect((await registry.catalogue.listCatalogue(discovery())).competitions).toEqual([]);
  });
});
