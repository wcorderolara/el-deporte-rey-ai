/**
 * The committed LIVE_DATA example `config/live.config.json` (architecture.md section 5.1; contracts/provider-ports.md
 * section 1.4; PD-12, PD-18, AD-38; Q8): it loads with the project's configuration rules, holds DEMO_DATA, MANUAL_DATA
 * and the enabled football-data source with the PD-12 reference competition, keeps `publicationPermission`
 * unconfirmed without a decision, leaves the stage-discovery override unset, and adds only the pinned origin to the
 * egress allow-list. It holds no token.
 */
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../../platform/config/index.js';
import { buildEgressAllowList } from '../../../../platform/net/index.js';

import { PINNED_ORIGIN } from './constants.js';
import { parseFootballDataOptions } from './options.js';
import { projectRootDir } from './test/replay.js';

function liveConfig() {
  return loadConfig({ rootDir: projectRootDir(), env: { EDR_CONFIG: 'config/live.config.json' } });
}

describe('config/live.config.json', () => {
  it('loads with the configuration rules and holds DEMO_DATA, MANUAL_DATA and the enabled LIVE_DATA source', () => {
    const config = liveConfig();
    expect(config.providers.sports.sources.map((source) => [source.id, source.mode, source.enabled])).toEqual([
      ['demo-a', 'DEMO_DATA', true],
      ['demo-b', 'DEMO_DATA', true],
      ['manual', 'MANUAL_DATA', true],
      ['football-data', 'LIVE_DATA', true],
    ]);
    expect(config.verificationPolicy).toEqual({
      manuallyApprovedPublication: 'allowed_without_accepted_source',
      livePublicationPermissionRule: 'every_supporting_source',
    });
  });

  it('keeps publicationPermission unconfirmed without a decision (PD-18)', () => {
    const live = liveConfig().providers.sports.sources.find((source) => source.id === 'football-data');
    expect(live).toMatchObject({
      adapter: 'football-data',
      role: 'primary',
      accepted: true,
      independenceGroup: 'football-data',
      publicationPermission: 'unconfirmed',
      publicationPermissionDecision: null,
    });
  });

  it('uses the section 1.4 defaults, the reference competition CL and no stage-discovery override', () => {
    const live = liveConfig().providers.sports.sources.find((source) => source.id === 'football-data');
    const parsed = parseFootballDataOptions(live?.options, 'providers.sports.sources[3]');
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.options).toEqual({
      baseUrl: `${PINNED_ORIGIN}/v4`,
      referenceCompetitionRefs: ['CL'],
      areaIds: [],
      requestsPerMinute: 10,
      timeoutMs: 10_000,
      maxRetries: 2,
      backoffMs: 1000,
      maxRateLimitWaitSeconds: 65,
      maxResponseBytes: 524_288,
      maxResponseBytesByResource: { stageDiscovery: null },
      researchReservedSlots: 2,
      maxDiscoveryWaiters: 20,
      cacheTtlSeconds: {
        competitions: 86_400,
        seasons: 21_600,
        stagesCurrent: 3_600,
        stagesPast: 86_400,
        selectionLive: 60,
        selectionCurrent: 900,
        selectionPast: 86_400,
      },
    });
    expect(Object.hasOwn(live?.options ?? {}, 'maxResponseBytesByResource')).toBe(false);
  });

  it('adds only the pinned origin to the egress allow-list', () => {
    expect(buildEgressAllowList(liveConfig()).origins).toEqual([PINNED_ORIGIN]);
  });
});
