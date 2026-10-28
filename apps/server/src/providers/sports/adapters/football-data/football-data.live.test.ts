/**
 * Optional live test of FootballDataProvider (contracts/provider-ports.md section 1.4 "Tests"; AD-32; R-135, R-258).
 *
 * - Runs only in the Vitest project `live` (`npm run test:live`), and only when `EDR_LIVE_TESTS=1` and
 *   `FOOTBALL_DATA_API_TOKEN` are both set; otherwise every test is skipped. It is never part of a configured gate.
 * - At most 5 requests per run (a counting transport refuses a sixth), within the 10 per minute budget.
 * - It asserts shapes only, never provider values, and checks with booleans that no output holds the token, so a
 *   failing assertion can never print it.
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildInjectedEnvironment } from '../../../../container.js';
import { loadConfig } from '../../../../platform/config/index.js';
import { EgressAllowList, type EgressClient, EgressError, createEgressClient } from '../../../../platform/net/index.js';
import type { IngestionContext } from '../../ingestion/index.js';
import { CapturingLogger } from '../../test/synthetic.js';

import { PINNED_ORIGIN, TOKEN_VARIABLE } from './constants.js';
import { createFootballDataSource } from './provider.js';
import { projectRootDir } from './test/replay.js';

const MAX_LIVE_REQUESTS = 5;
const enabled = process.env['EDR_LIVE_TESTS'] === '1' && (process.env[TOKEN_VARIABLE] ?? '') !== '';

function research(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'research' };
}

describe.skipIf(!enabled)('FootballDataProvider live (R-258)', () => {
  it('lists competitions, seasons and stages and fetches one matchday with at most 5 requests', async () => {
    const env = buildInjectedEnvironment();
    const token = env[TOKEN_VARIABLE] ?? '';
    const root = projectRootDir();
    const config = loadConfig({ rootDir: root, env: { EDR_CONFIG: 'config/live.config.json' } });
    const index = config.providers.sports.sources.findIndex((source) => source.adapter === 'football-data');
    const source = config.providers.sports.sources[index];
    if (source === undefined) {
      throw new Error('live configuration without the football-data source');
    }
    const real = createEgressClient(new EgressAllowList([PINNED_ORIGIN]));
    let requests = 0;
    const egress: EgressClient = {
      request(url, init) {
        requests += 1;
        if (requests > MAX_LIVE_REQUESTS) {
          return Promise.reject(new EgressError('invalid_request', 'live test request limit reached'));
        }
        return real.request(url, init);
      },
    };
    const logger = new CapturingLogger();
    const adapter = createFootballDataSource({
      source,
      descriptor: {
        id: source.id,
        name: source.name,
        mode: source.mode,
        adapter: source.adapter,
        role: source.role,
        officialPublication: source.officialPublication,
        accepted: source.accepted,
        independenceGroup: source.independenceGroup,
        publicationPermission: source.publicationPermission,
        enabled: source.enabled,
      },
      setting: `providers.sports.sources[${String(index)}]`,
      options: source.options,
      deps: {
        egress,
        env,
        clock: { now: () => new Date() },
        db: {} as never,
        paths: { rootDir: root, dataDir: join(root, 'data') },
        logger,
      },
    });
    adapter.validateStartup();

    const competitions = await adapter.listCompetitions(research());
    expect(competitions.availability.available).toBe(true);
    expect(competitions.items.length).toBeGreaterThan(0);
    const reference = competitions.items[0];
    expect(typeof reference?.localKey).toBe('string');

    const seasons = await adapter.listSeasons(reference?.ref ?? ('' as never), research());
    expect(seasons.items.length).toBeGreaterThan(0);
    const season = seasons.items.find((item) => item.current) ?? seasons.items[0];
    expect(season?.startYear).toEqual(expect.any(Number));

    const stages = await adapter.listStages(reference?.ref ?? ('' as never), season?.ref ?? ('' as never), research());
    expect(Array.isArray(stages.items)).toBe(true);
    const stage = stages.items.find((item) => item.matchdays.length > 0);
    if (stage !== undefined) {
      const snapshot = await adapter.fetchSelection(stage.matchdays[0]?.ref ?? ('' as never), research());
      expect(snapshot.mode).toBe('LIVE_DATA');
      expect(Array.isArray(snapshot.matches)).toBe(true);
      expect(typeof snapshot.standings.available).toBe('boolean');
      expect(snapshot.sourceRef.startsWith('source:')).toBe(true);
    }

    expect(requests).toBeLessThanOrEqual(MAX_LIVE_REQUESTS);
    const outputs = JSON.stringify([competitions, seasons, stages, logger.lines, adapter.cacheEntries()]);
    expect(token !== '' && outputs.includes(token)).toBe(false);
  }, 180_000);
});
