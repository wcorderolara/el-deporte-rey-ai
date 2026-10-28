/**
 * Fixture mode and provider swap (R-241, R-222, R-223, R-262, R-225):
 * - with a DEMO_DATA configuration the full workflow runs on one machine through the HTTP API with no egress request
 *   and no non-loopback connection, no provider token in the environment and an empty egress allow-list;
 * - replacing the configured sports-data and AI providers with stubs is a configuration change only (the same code,
 *   the same test seam), and the full workflow then runs end to end;
 * - no http-api response carries the synthetic marker token or the dummy key, even when they are in the process
 *   environment given to the server.
 *
 * Every stage a module registers runs for real (research, verification and, since T32, content); a stage that no
 * module registers yet runs as an explicit placeholder of the test support (`TestApp.placeholders`). The
 * LIVE-shaped side of the swap uses the OpenAI-compatible adapter against a loopback fake endpoint
 * (`startFakeAiServer`), so the run is deterministic and no request leaves the machine.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { loadConfig } from '../../../src/platform/config/index.js';
import { buildEgressAllowList } from '../../../src/platform/net/index.js';
import {
  type Json,
  LIGA_DEMO_MD1,
  REPO_ROOT,
  type TestApp,
  TOKEN_VARIABLE,
  expectNoNetworkViolations,
  expectNoProviderCredentials,
  fixtureConfigDocument,
  type FakeAiServer,
  startFakeAiServer,
  startTestApp,
} from '../../support/index.js';

const apps: TestApp[] = [];
const servers: FakeAiServer[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

async function start(options: Parameters<typeof startTestApp>[0] = {}): Promise<TestApp> {
  const app = await startTestApp(options);
  apps.push(app);
  return app;
}

const FULL_ORDER = ['research', 'verification', 'content', 'rendering', 'visual_qa'];

describe('DEMO_DATA fixtures only: no provider request (R-241, R-222)', () => {
  it('runs the full workflow through the HTTP API with no egress request and no non-loopback connection', async () => {
    expectNoProviderCredentials();
    const t = await start({ base: 'demo-only', scenario: 'default' });
    expect(buildEgressAllowList(t.container.config).isEmpty).toBe(true);
    expect(t.container.sources.descriptors.map((source) => [source.id, source.mode, source.adapter])).toEqual([
      ['demo-a', 'DEMO_DATA', 'fixture'],
      ['demo-b', 'DEMO_DATA', 'fixture'],
    ]);
    expect(t.container.aiProvider.id).toBe('stub');

    const catalogue = await t.get('/catalog/competitions');
    expect(catalogue.statusCode).toBe(200);
    const project = await t.createProject(LIGA_DEMO_MD1);
    expect(project.dataMode).toBe('DEMO_DATA');
    expect(project.demonstration).toBe(true);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual(
      FULL_ORDER.map((name) => [name, 'completed']),
    );
    const facts = await t.listFacts(project.id, run.id);
    expect(facts.facts.length).toBeGreaterThan(0);
    expect(facts.facts.every((fact) => fact.evidence.every((evidence) => evidence.dataMode === 'DEMO_DATA'))).toBe(
      true,
    );

    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
    expectNoProviderCredentials();
    expect(t.placeholders.every((name) => ['content', 'rendering', 'visual_qa'].includes(name))).toBe(true);
  });

  it.each(['dev.config.json', 'app.config.json'])(
    'the committed configuration %s selects no LIVE_DATA source and allows no egress origin',
    (file) => {
      const config = loadConfig({ rootDir: REPO_ROOT, env: { EDR_CONFIG: `config/${file}` } });
      expect(config.providers.sports.sources.filter((source) => source.mode === 'LIVE_DATA')).toEqual([]);
      expect(config.providers.ai.adapter).toBe('stub');
      expect(buildEgressAllowList(config).isEmpty).toBe(true);
    },
  );
});

describe('provider swap by configuration only (R-223)', () => {
  /** A configuration with a LIVE_DATA-shaped sports source and the OpenAI-compatible AI adapter. */
  function liveShaped(aiBaseUrl: string): (document: Json) => void {
    return (document) => {
      document['providers'] = {
        sports: {
          sources: [
            {
              id: 'live-secondary',
              name: 'Synthetic secondary live source',
              mode: 'LIVE_DATA',
              enabled: true,
              role: 'primary',
              accepted: true,
              independenceGroup: 'live-secondary',
              officialPublication: false,
              publicationPermission: 'unconfirmed',
              adapter: 'test-live',
              options: { baseUrl: 'https://live-secondary.invalid/v1', scenario: 'live-secondary-agree' },
            },
          ],
        },
        ai: {
          adapter: 'openai-compatible',
          options: { baseUrl: aiBaseUrl, model: 'synthetic-model', timeoutMs: 5000 },
        },
      };
      delete document['catalogue'];
    };
  }

  /** The stub providers of the DEMO_DATA configuration. */
  function stubbed(document: Json): void {
    const demo = fixtureConfigDocument('demo-only');
    document['providers'] = demo['providers'];
    document['catalogue'] = demo['catalogue'];
  }

  it('replacing the providers section with stubs is the only change, and the full workflow then runs end to end', async () => {
    const ai = await startFakeAiServer();
    servers.push(ai);
    let liveDocument: Json = {};
    let stubDocument: Json = {};

    const live = await start({ base: 'demo-only', mutate: liveShaped(ai.baseUrl) });
    liveDocument = live.config.document;
    expect(live.container.aiProvider.id).toBe('openai-compatible');
    // The fake endpoint's loopback origin is the only egress origin, and only because the configuration names it.
    expect([...buildEgressAllowList(live.container.config).origins].sort()).toEqual(
      [`http://127.0.0.1:${String(ai.port)}`, 'https://live-secondary.invalid'].sort(),
    );
    expect(live.container.sources.descriptors.map((source) => [source.id, source.mode])).toEqual([
      ['live-secondary', 'LIVE_DATA'],
    ]);
    const liveProject = await live.createProject({
      competitionId: 'live-secondary-copa-continental',
      sourceId: 'live-secondary',
      seasonId: '2026',
      stageId: 'league-stage',
      matchday: 1,
    });
    expect(liveProject.dataMode).toBe('LIVE_DATA');
    const liveRun = await live.runWorkflow(liveProject.id);
    expect(liveRun.status, JSON.stringify(liveRun.failure)).toBe('completed');
    expect(liveRun.stages.map((stage) => [stage.stage, stage.status])).toEqual(
      FULL_ORDER.map((name) => [name, 'completed']),
    );
    const liveFacts = await live.listFacts(liveProject.id, liveRun.id);
    // A single LIVE_DATA source cannot verify anything (R-055); the workflow still runs to the end.
    expect(liveFacts.dataMode).toBe('LIVE_DATA');
    expect(liveFacts.facts.every((fact) => fact.status === 'unverified')).toBe(true);
    // Egress only to the configured AI endpoint (drafting, when the content stage is real); never to a sports source.
    expect(live.egress.requests.every((request) => request.url.startsWith(ai.baseUrl))).toBe(true);
    expect(live.egress.requests.length).toBe(ai.requests.length);
    expect(live.egress.requests.length).toBe(live.aiRequests.length);
    if (!live.placeholders.includes('content')) {
      expect(ai.requests.length).toBeGreaterThan(0);
    }

    const aiCallsAfterLive = ai.requests.length;
    const stub = await start({
      base: 'demo-only',
      mutate: (document) => (liveShaped(ai.baseUrl)(document), stubbed(document)),
    });
    stubDocument = stub.config.document;
    expect(stub.container.aiProvider.id).toBe('stub');
    expect(stub.container.sources.descriptors.every((source) => source.adapter === 'fixture')).toBe(true);
    const project = await stub.createProject(LIGA_DEMO_MD1);
    const run = await stub.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual(
      FULL_ORDER.map((name) => [name, 'completed']),
    );
    const facts = await stub.listFacts(project.id, run.id);
    expect(facts.facts.length).toBeGreaterThan(0);
    expect(facts.facts.every((fact) => fact.status === 'verified')).toBe(true);
    expect(stub.egress.requests).toEqual([]);
    if (!stub.placeholders.includes('content')) {
      // The stub AI drafted the content, with no request to any endpoint.
      expect(stub.aiRequests.length).toBeGreaterThan(0);
    }
    // The stub configuration never reaches the AI endpoint of the previous configuration.
    expect(ai.requests.length).toBe(aiCallsAfterLive);

    // The two configurations differ only in the provider selection (and the catalogue links that name sources);
    // `server` and `dataDir` differ only because each test app has its own port and directory.
    const differing = Object.keys({ ...liveDocument, ...stubDocument }).filter(
      (key) => JSON.stringify(liveDocument[key]) !== JSON.stringify(stubDocument[key]),
    );
    expect(differing.filter((key) => key !== 'server').sort()).toEqual(['catalogue', 'providers']);
    expectNoNetworkViolations();
  });
});

describe('no marker in http-api responses (R-262)', () => {
  it('answers every read with no synthetic marker token, dummy key or base URL, even with them in the environment', async () => {
    const t = await start({
      base: 'demo-only',
      scenario: 'default',
      env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN, EDR_AI_API_KEY: TEST_DUMMY_API_KEY },
    });
    expect(process.env[TOKEN_VARIABLE]).toBeUndefined();
    const project = await t.createProject(LIGA_DEMO_MD1);
    const run = await t.runWorkflow(project.id);
    const bodies: string[] = [];
    for (const path of [
      '/health',
      '/settings',
      '/catalog/competitions',
      '/catalog/competitions/liga-demo/sources/demo-a/seasons',
      '/catalog/competitions/liga-demo/sources/demo-a/seasons/2026/stages',
      '/projects',
      `/projects/${project.id}`,
      `/projects/${project.id}/runs`,
      `/projects/${project.id}/runs/${run.id}`,
      `/projects/${project.id}/runs/${run.id}/facts`,
    ]) {
      const response = await t.get(path);
      expect(response.statusCode, path).toBe(200);
      bodies.push(response.body, JSON.stringify(response.headers));
    }
    const all = bodies.join('\n');
    expect(all).not.toContain(TEST_MARKER_TOKEN);
    expect(all).not.toContain(TEST_DUMMY_API_KEY);
    expect(all).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost)/);
    expect(t.log.text()).not.toContain(TEST_MARKER_TOKEN);
    expect(t.log.text()).not.toContain(TEST_DUMMY_API_KEY);
    expect(t.databaseText()).not.toContain(TEST_MARKER_TOKEN);
    expect(t.databaseText()).not.toContain(TEST_DUMMY_API_KEY);
  });
});
