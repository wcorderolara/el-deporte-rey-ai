/**
 * The committed LIVE_DATA example `config/live.config.json` (architecture.md section 5.1; contracts/provider-ports.md
 * section 1.4; PD-12, PD-18, AD-38; Q8): it loads with the project's configuration rules, holds DEMO_DATA, MANUAL_DATA
 * and the enabled football-data source with the PD-12 reference competition, keeps `publicationPermission`
 * unconfirmed without a decision, sets the stage-discovery override to 1 MiB within the reviewed 2 MiB bound (FU-4,
 * OD-60; Q8, T11H-F20), and adds only the pinned origin to the egress allow-list. It holds no token.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../../../platform/config/index.js';
import { buildEgressAllowList } from '../../../../platform/net/index.js';

import { PINNED_ORIGIN } from './constants.js';
import { parseFootballDataOptions } from './options.js';
import { projectRootDir } from './test/replay.js';

function liveConfig() {
  return loadConfig({ rootDir: projectRootDir(), env: { EDR_CONFIG: 'config/live.config.json' } });
}

function readJson(file: string): { links: unknown[] } & Record<string, unknown> {
  return JSON.parse(readFileSync(join(projectRootDir(), file), 'utf8')) as { links: unknown[] } & Record<
    string,
    unknown
  >;
}

const CL_LINK = {
  id: 'uefa-champions-league',
  name: 'UEFA Champions League',
  reference: true,
  bindings: [{ sourceId: 'football-data', competitionRef: 'cl' }],
};

describe('config/live.config.json', () => {
  it('loads with the configuration rules and holds DEMO_DATA, MANUAL_DATA and the enabled LIVE_DATA source', () => {
    const config = liveConfig();
    expect(config.providers.sports.sources.map((source) => [source.id, source.mode, source.enabled])).toEqual([
      ['demo-a', 'DEMO_DATA', true],
      ['demo-b', 'DEMO_DATA', true],
      ['manual', 'MANUAL_DATA', true],
      ['local', 'MANUAL_DATA', true],
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

  it('uses the section 1.4 defaults, the reference competition CL and a 1 MiB stage-discovery override', () => {
    const live = liveConfig().providers.sports.sources.find((source) => source.id === 'football-data');
    const parsed = parseFootballDataOptions(live?.options, 'providers.sports.sources[4]');
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
      maxResponseBytesByResource: { stageDiscovery: 1_048_576 },
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
    expect(live?.options['maxResponseBytesByResource']).toEqual({ stageDiscovery: 1_048_576 });
  });

  it('keeps the stage-discovery override within the reviewed 2 MiB bound and above the 512 KiB default (FU-4, Q8)', () => {
    const live = liveConfig().providers.sports.sources.find((source) => source.id === 'football-data');
    const parsed = parseFootballDataOptions(live?.options, 'providers.sports.sources[4]');
    const limit = parsed.ok ? parsed.options.maxResponseBytesByResource.stageDiscovery : null;
    expect(limit).toBe(1_048_576);
    expect(limit).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(limit).toBeGreaterThan(parsed.ok ? parsed.options.maxResponseBytes : Number.POSITIVE_INFINITY);
  });

  it('adds only the pinned origin to the egress allow-list', () => {
    expect(buildEgressAllowList(liveConfig()).origins).toEqual([PINNED_ORIGIN]);
  });

  it('binds the reference competition by its local key in config/live.catalogue.json (OD-51)', () => {
    const config = liveConfig();
    const link = config.catalogue.getLink('uefa-champions-league');
    expect(link).toMatchObject({
      name: 'UEFA Champions League',
      reference: true,
      noAcceptedPublicSource: false,
      bindings: [{ sourceId: 'football-data', competitionRef: 'cl' }],
    });
    expect(config.catalogue.links.map((item) => item.id)).toEqual(['copa-demo', 'liga-demo', 'uefa-champions-league']);
  });

  it('copies the links of config/catalogue.json unchanged and adds only the reference link', () => {
    const live = readJson('config/live.catalogue.json');
    const base = readJson('config/catalogue.json');
    expect(live.links).toEqual([...base.links, CL_LINK]);
    expect(live['restrictToLinks']).toBe(base['restrictToLinks']);
  });

  it.each(['config/app.config.json', 'config/dev.config.json'])(
    '%s still loads with config/catalogue.json and no LIVE_DATA link',
    (file) => {
      expect(readJson(file)['catalogue']).toEqual({ linksFile: 'config/catalogue.json' });
      const config = loadConfig({ rootDir: projectRootDir(), env: { EDR_CONFIG: file } });
      expect(config.catalogue.links.map((item) => item.id)).toEqual(['copa-demo', 'liga-demo']);
      expect(config.providers.sports.sources.some((source) => source.mode === 'LIVE_DATA')).toBe(false);
    },
  );

  it('names the test-only adapter kind test-live in no committed configuration', () => {
    const dir = join(projectRootDir(), 'config');
    const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
    expect(files).toContain('live.catalogue.json');
    for (const name of files) {
      expect(readFileSync(join(dir, name), 'utf8')).not.toContain('test-live');
    }
  });
});
