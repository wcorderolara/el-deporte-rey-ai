/**
 * The test-only `test-live` adapter kind (OD-24, AD-37, T11G LOW-3, V-52):
 * - registered only through the `createSportsSources` test seam: the production adapter registry does not list it,
 *   `container.ts` passes no seam, and no committed configuration under `config/` names it;
 * - without the seam a configuration naming it stops startup; with the seam it serves the T23 `live-secondary`
 *   fixture files as LIVE_DATA and makes no network request (the base URL is in the egress allow-list but never
 *   contacted).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ADAPTER_KINDS } from '../../../src/providers/sports/index.js';
import { buildEgressAllowList } from '../../../src/platform/net/index.js';
import {
  type Json,
  REPO_ROOT,
  TEST_LIVE_ADAPTER_KIND,
  type TestApp,
  expectNoNetworkViolations,
  readJson,
  startTestApp,
} from '../../support/index.js';

const apps: TestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

/** The `live-secondary` source of `fixtures/config/live-secondary.config.json`, made primary, alone. */
function liveSecondaryOnly(scenario: string): (document: Json) => void {
  return (document) => {
    const base = readJson<Json>(join(REPO_ROOT, 'fixtures', 'config', 'live-secondary.config.json'));
    const sources = ((base['providers'] as Json)['sports'] as Json)['sources'] as Json[];
    const live = sources.find((source) => source['adapter'] === TEST_LIVE_ADAPTER_KIND);
    expect(live).toBeDefined();
    const source = {
      ...(live as Json),
      role: 'primary',
      options: { ...((live as Json)['options'] as Json), scenario },
    };
    ((document['providers'] as Json)['sports'] as Json)['sources'] = [source];
    delete document['catalogue'];
  };
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}

describe('registration only through the test seam (V-52)', () => {
  it('is not in the production adapter registry, and container.ts passes no seam', () => {
    expect(ADAPTER_KINDS).not.toContain(TEST_LIVE_ADAPTER_KIND);
    const container = readFileSync(join(REPO_ROOT, 'apps', 'server', 'src', 'container.ts'), 'utf8');
    expect(container).not.toContain('extraAdapters');
    expect(container).not.toContain(TEST_LIVE_ADAPTER_KIND);
    // The only createSportsSources call of the composition root passes the configuration and the dependencies.
    expect(container).toMatch(/providers\.createSportsSources\(config, \{ egress, env, clock, db, paths, logger \}\)/);
    const registry = readFileSync(
      join(REPO_ROOT, 'apps', 'server', 'src', 'providers', 'sports', 'adapters', 'index.ts'),
      'utf8',
    );
    expect(registry).not.toMatch(/['"]test-live['"]/);
  });

  it('is named by no committed configuration under config/', () => {
    const files = filesUnder(join(REPO_ROOT, 'config'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toContain(TEST_LIVE_ADAPTER_KIND);
    }
  });

  it('stops startup without the seam (unknown adapter kind), naming the setting', async () => {
    await expect(
      startTestApp({ mutate: liveSecondaryOnly('live-secondary-agree'), extraAdapters: [] }),
    ).rejects.toThrow(/providers\.sports\.sources\[0\]\.adapter/);
  });
});

describe('behaviour with the seam (OD-24)', () => {
  it('serves the live-secondary fixture as LIVE_DATA with no network request', async () => {
    const t = await startTestApp({ mutate: liveSecondaryOnly('live-secondary-agree') });
    apps.push(t);
    const [descriptor] = t.container.sources.descriptors;
    expect(descriptor).toMatchObject({ id: 'live-secondary', mode: 'LIVE_DATA', adapter: TEST_LIVE_ADAPTER_KIND });
    expect(buildEgressAllowList(t.container.config).origins).toEqual(['https://live-secondary.invalid']);

    const project = await t.createProject({
      competitionId: 'live-secondary-copa-continental',
      sourceId: 'live-secondary',
      seasonId: '2026',
      stageId: 'league-stage',
      matchday: 1,
    });
    expect(project).toMatchObject({ dataMode: 'LIVE_DATA', demonstration: false });
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await t.listFacts(project.id, run.id);
    expect(facts.dataMode).toBe('LIVE_DATA');
    const scores = facts.facts.filter((fact) => fact.kind === 'match_score');
    expect(scores).toHaveLength(18);
    expect(facts.facts.every((fact) => fact.evidence.every((evidence) => evidence.dataMode === 'LIVE_DATA'))).toBe(
      true,
    );
    // One accepted LIVE_DATA source cannot verify (R-055); the second source of R-256 is T52's configuration.
    expect(facts.facts.every((fact) => fact.unverifiedReason === 'awaiting_independent_verification')).toBe(true);
    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
  });

  it('reads the disagreeing scenario file: match 5 has a home score one higher', async () => {
    const match5 = (scenario: string): Json => {
      const file = readJson<Json>(join(REPO_ROOT, 'fixtures', 'sports', scenario, 'live-secondary.json'));
      const [competition] = file['competitions'] as Json[];
      const [season] = (competition as Json)['seasons'] as Json[];
      const [stage] = (season as Json)['stages'] as Json[];
      const matchday = ((stage as Json)['matchdays'] as Json)['1'] as Json;
      return (matchday['matches'] as Json[])[4] as Json;
    };
    const agree = match5('live-secondary-agree');
    const disagree = match5('live-secondary-disagree');
    const agreeScore = agree['score'] as { home: number; away: number };
    expect(disagree['score']).toEqual({ home: agreeScore.home + 1, away: agreeScore.away });

    const t = await startTestApp({ mutate: liveSecondaryOnly('live-secondary-disagree') });
    apps.push(t);
    const project = await t.createProject({
      competitionId: 'live-secondary-copa-continental',
      sourceId: 'live-secondary',
      seasonId: '2026',
      stageId: 'league-stage',
      matchday: 1,
    });
    const run = await t.runWorkflow(project.id);
    expect(run.status).toBe('completed');
    const facts = await t.listFacts(project.id, run.id);
    const score = facts.facts.find(
      (fact) => fact.kind === 'match_score' && fact.evidence.some((evidence) => evidence.sourceRef === disagree['ref']),
    );
    expect(score?.candidateValue).toEqual(disagree['score']);
    expect(score?.evidence.map((evidence) => [evidence.sourceId, evidence.dataMode])).toEqual([
      ['live-secondary', 'LIVE_DATA'],
    ]);
    const refs = facts.facts.flatMap((fact) => fact.evidence.map((evidence) => evidence.sourceRef));
    expect(refs.every((ref) => !/^https?:/i.test(ref))).toBe(true);
    expect(t.egress.requests).toEqual([]);
  });

  it('refuses invalid options at startup, naming the setting and never the value', async () => {
    const mutate = (document: Json): void => {
      liveSecondaryOnly('live-secondary-agree')(document);
      const [source] = ((document['providers'] as Json)['sports'] as Json)['sources'] as Json[];
      (source as Json)['options'] = { baseUrl: 'https://live-secondary.invalid/v1', scenario: 'Not A Scenario!' };
    };
    const error = await startTestApp({ mutate }).then(
      async (t) => {
        await t.close();
        return null;
      },
      (caught: unknown) => caught,
    );
    expect(String(error)).toMatch(/providers\.sports\.sources\[0\]\.options/);
    expect(String(error)).not.toContain('Not A Scenario!');
  });
});
