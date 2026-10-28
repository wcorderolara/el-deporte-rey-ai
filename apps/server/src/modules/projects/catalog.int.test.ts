/**
 * Integration tests of the settings and catalogue routes with DEMO fixtures and a counting stub source
 * (architecture.md section 15.2; R-141, R-243, R-282, R-284, R-286, R-291; T11H-F06, V-42; T10-F04).
 */
import { CatalogueSchema, SeasonListSchema, SettingsSchema, StageListSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { SourceError } from '../../providers/sports/index.js';
import { FIXED_NOW, competition, fixtureDocument, league, season } from '../../providers/sports/test/synthetic.js';

import { READ_HEADERS, type ProjectsTestApp, projectsTestApp, testSources } from './test/support.js';

const apps: ProjectsTestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

async function start(options: Parameters<typeof projectsTestApp>[0] = {}): Promise<ProjectsTestApp> {
  const app = await projectsTestApp(options);
  apps.push(app);
  return app;
}

async function get(app: ProjectsTestApp, url: string, method: 'GET' | 'HEAD' = 'GET') {
  return app.inject({ method, url: `/api/v1${url}`, headers: READ_HEADERS });
}

function totalChanges(app: ProjectsTestApp): number {
  return (app.db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
}

describe('GET /settings', () => {
  it('returns data modes, verification policy and every source, without options, URLs or credentials', async () => {
    const app = await start({ sources: testSources({ stubBEnabled: false }) });
    const response = await get(app, '/settings');
    expect(response.statusCode).toBe(200);
    const body = SettingsSchema.parse(response.json());
    expect(body.defaultLanguage).toBe('es');
    expect(body.languages.map((language) => language.code)).toEqual(['es', 'en']);
    expect(body.dataModes).toEqual(['DEMO_DATA', 'LIVE_DATA']);
    expect(body.verificationPolicy).toEqual({
      manuallyApprovedPublication: 'allowed_without_accepted_source',
      livePublicationPermissionRule: 'every_supporting_source',
    });
    expect(body.providers.ai).toBe('stub');
    expect(body.providers.sources.map((source) => [source.id, source.mode, source.role, source.enabled])).toEqual([
      ['demo-a', 'DEMO_DATA', 'primary', true],
      ['demo-b', 'DEMO_DATA', 'verification', true],
      ['stub-a', 'LIVE_DATA', 'primary', true],
      ['stub-b', 'LIVE_DATA', 'primary', false],
    ]);
    expect(body.providers.sources[2]?.publicationPermission).toBe('unconfirmed');
    expect(response.body).not.toMatch(/https?:|baseUrl|options|scenario|token/i);
  });
});

describe('GET /catalog/competitions (R-073, R-282)', () => {
  it('merges DEMO fixtures and stub competitions with their sources, reference first', async () => {
    const app = await start();
    const response = await get(app, '/catalog/competitions');
    expect(response.statusCode).toBe(200);
    const body = CatalogueSchema.parse(response.json());
    expect(body.competitions.map((entry) => entry.id)).toEqual([
      'copa-demo',
      'liga-demo',
      'liga-stub',
      'stub-a-copa-stub',
      'stub-b-copa-stub',
    ]);
    expect(body.competitions[0]?.reference).toBe(true);
    const copa = body.competitions[0];
    expect(copa?.sources.map((source) => [source.sourceId, source.mode, source.selectable])).toEqual([
      ['demo-a', 'DEMO_DATA', true],
      ['demo-b', 'DEMO_DATA', false],
    ]);
    // A competition with two selectable sources: either can be chosen (R-287, OD-16).
    const ligaStub = body.competitions.find((entry) => entry.id === 'liga-stub');
    expect(ligaStub?.sources.map((source) => [source.sourceId, source.selectable, source.availability])).toEqual([
      ['stub-a', true, { available: true, reason: null }],
      ['stub-b', true, { available: true, reason: null }],
    ]);
    expect(body.sources.map((source) => [source.sourceId, source.mode, source.listing.retrievedAt])).toEqual([
      ['demo-a', 'DEMO_DATA', FIXED_NOW],
      ['demo-b', 'DEMO_DATA', FIXED_NOW],
      ['stub-a', 'LIVE_DATA', FIXED_NOW],
      ['stub-b', 'LIVE_DATA', FIXED_NOW],
    ]);
  });

  it('shows a competition added to or removed from the stub response without a code change or restart', async () => {
    const app = await start();
    const ids = async (): Promise<string[]> =>
      CatalogueSchema.parse((await get(app, '/catalog/competitions')).json()).competitions.map((entry) => entry.id);

    app.stub.documents.set(
      'stub-a',
      fixtureDocument([
        league('liga-stub', 'Liga Stub'),
        competition('copa-stub', 'Copa Stub', []),
        competition('torneo-nuevo', 'Torneo Nuevo', [season('2026', [])]),
      ]),
    );
    expect(await ids()).toContain('stub-a-torneo-nuevo');

    app.stub.documents.set('stub-a', fixtureDocument([league('liga-stub', 'Liga Stub')]));
    const after = await ids();
    expect(after).not.toContain('stub-a-torneo-nuevo');
    expect(after).not.toContain('stub-a-copa-stub');
    expect(after).toContain('stub-b-copa-stub');
  });

  it('follows a source added to or removed from the configuration', async () => {
    const first = await start({ sources: testSources({ stubBEnabled: false }) });
    const without = CatalogueSchema.parse((await get(first, '/catalog/competitions')).json());
    expect(without.sources.map((source) => source.sourceId)).toEqual(['demo-a', 'demo-b', 'stub-a']);
    expect(without.competitions.find((entry) => entry.id === 'liga-stub')?.sources.map((s) => s.sourceId)).toEqual([
      'stub-a',
    ]);
    expect(without.competitions.map((entry) => entry.id)).not.toContain('stub-b-copa-stub');

    const second = await start({ sources: testSources({ stubBEnabled: true }) });
    const withSource = CatalogueSchema.parse((await get(second, '/catalog/competitions')).json());
    expect(withSource.competitions.map((entry) => entry.id)).toContain('stub-b-copa-stub');
  });

  it('keeps other sources usable when one source fails, and reports its availability', async () => {
    const app = await start();
    app.stub.documents.set('stub-b', { simulate: 'access_refused', competitions: [] });
    const body = CatalogueSchema.parse((await get(app, '/catalog/competitions')).json());
    expect(body.sources.find((source) => source.sourceId === 'stub-b')?.availability).toEqual({
      available: false,
      reason: 'access_refused',
    });
    expect(body.competitions.map((entry) => entry.id)).toContain('stub-a-copa-stub');
  });
});

describe('GET seasons and stages (R-074, R-243, R-284)', () => {
  it('lists the seasons the chosen source reports', async () => {
    const app = await start();
    const response = await get(app, '/catalog/competitions/copa-demo/sources/demo-a/seasons');
    expect(response.statusCode).toBe(200);
    expect(SeasonListSchema.parse(response.json())).toEqual({
      competitionId: 'copa-demo',
      sourceId: 'demo-a',
      availability: { available: true, reason: null },
      listing: { retrievedAt: FIXED_NOW, fromCache: false, stale: false, retryAfterSeconds: null },
      seasons: [{ id: '2026', label: '2026/27', current: true, startDate: '2026-08-01', endDate: '2027-05-31' }],
    });
  });

  it('lists every stage the source reports, including stages after the league stage, by its own names', async () => {
    const app = await start();
    const response = await get(app, '/catalog/competitions/copa-demo/sources/demo-a/seasons/2026/stages');
    expect(response.statusCode).toBe(200);
    const body = StageListSchema.parse(response.json());
    expect(
      body.stages.map((entry) => [entry.id, entry.name, entry.standings, entry.selectableAsWhole, entry.matchdays]),
    ).toEqual([
      ['fase-liga', 'Fase de Liga', 'expected', false, [1, 2]],
      ['octavos', 'Octavos de Final', 'not_expected', true, []],
      ['semifinal', 'Semifinal', 'not_expected', false, [1, 2]],
      ['final', 'Final', 'not_expected', true, []],
    ]);
    expect(body.stages.every((entry) => entry.availability.available)).toBe(true);
  });

  it('reports a season list refused by the source with availability false and a reason (R-286)', async () => {
    const app = await start();
    app.stub.overrides.set('stub-a/listSeasons', new SourceError('not_available', 'restricted', 'stub-a', null, 403));
    const response = await get(app, '/catalog/competitions/liga-stub/sources/stub-a/seasons');
    expect(response.statusCode).toBe(200);
    expect(SeasonListSchema.parse(response.json())).toMatchObject({
      availability: { available: false, reason: 'subscription_restricted' },
      seasons: [],
    });
    // The other source of the competition stays usable.
    const other = await get(app, '/catalog/competitions/liga-stub/sources/stub-b/seasons');
    expect(SeasonListSchema.parse(other.json()).seasons).toHaveLength(1);
  });

  it('refuses an ID that breaks the contract pattern with 400', async () => {
    const app = await start();
    const response = await get(app, '/catalog/competitions/Copa_Demo/sources/demo-a/seasons');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('unknown IDs answer 404 without a provider request for that ID (T11H-F06, V-42)', () => {
  it.each(['GET', 'HEAD'] as const)(
    'for an unknown source, competition, unbound source or season (%s)',
    async (method) => {
      const app = await start();
      const { stub } = app;
      const probes: [string, (count: typeof stub.count) => number][] = [
        // A source that is not configured: no call at all.
        ['/catalog/competitions/liga-stub/sources/stub-z/seasons', () => stub.targetedCalls()],
        // A competition not in the catalogue listing: no seasons request.
        ['/catalog/competitions/stub-a-nope/sources/stub-a/seasons', (count) => count('stub-a', 'listSeasons')],
        // A configured source that the link does not bind.
        ['/catalog/competitions/liga-stub/sources/demo-a/seasons', () => stub.targetedCalls()],
        // A season not in the source's seasons listing: no stages request.
        [
          '/catalog/competitions/liga-stub/sources/stub-a/seasons/1999/stages',
          (count) => count('stub-a', 'listStages'),
        ],
        // A competition ID that is not in the listing, at the stages level.
        [
          '/catalog/competitions/stub-a-nope/sources/stub-a/seasons/2026/stages',
          (count) => count('stub-a', 'listStages'),
        ],
      ];
      for (const [url, requests] of probes) {
        const before = requests(stub.count.bind(stub));
        const response = await get(app, url, method);
        expect(response.statusCode, url).toBe(404);
        if (method === 'GET') {
          expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
        }
        expect(requests(stub.count.bind(stub)) - before, url).toBe(0);
      }
      expect(stub.count('stub-a', 'fetchSelection')).toBe(0);
    },
  );
});

describe('request budget exhausted (R-141, R-291)', () => {
  it('serves a stale cached listing with its retrieval time', async () => {
    const app = await start();
    app.stub.overrides.set('stub-a/listStages', {
      items: [
        {
          id: 'regular',
          name: 'Fase Regular',
          order: 1,
          standings: 'expected',
          wholeStageRef: null,
          matchdays: [{ number: 1, ref: '{"c":"liga-stub","s":"2026","st":"regular","md":1}' }],
        },
      ],
      availability: { available: true },
      retrievedAt: '2026-10-27T11:00:00.000Z',
      fromCache: true,
      stale: true,
      retryAfterSeconds: 42,
    });
    const response = await get(app, '/catalog/competitions/liga-stub/sources/stub-a/seasons/2026/stages');
    expect(response.statusCode).toBe(200);
    expect(StageListSchema.parse(response.json()).listing).toEqual({
      retrievedAt: '2026-10-27T11:00:00.000Z',
      fromCache: true,
      stale: true,
      retryAfterSeconds: 42,
    });
  });

  it('answers 503 PROVIDER_RATE_LIMITED with retryAfterSeconds at once when nothing is cached', async () => {
    const app = await start();
    app.stub.overrides.set(
      'stub-a/listSeasons',
      new SourceError('rate_limited', 'budget exhausted', 'stub-a', null, null, 37),
    );
    const started = Date.now();
    const response = await get(app, '/catalog/competitions/liga-stub/sources/stub-a/seasons');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ code: 'PROVIDER_RATE_LIMITED', retryAfterSeconds: 37 });
    expect(response.body).not.toContain('budget exhausted');
  });

  it('reports a rate-limited source in the catalogue without failing the catalogue', async () => {
    const app = await start();
    app.stub.overrides.set(
      'stub-b/listCompetitions',
      new SourceError('rate_limited', 'budget exhausted', 'stub-b', null, null, 20),
    );
    const body = CatalogueSchema.parse((await get(app, '/catalog/competitions')).json());
    expect(body.sources.find((source) => source.sourceId === 'stub-b')).toMatchObject({
      availability: { available: false, reason: 'rate_limited' },
      listing: { retryAfterSeconds: 20 },
    });
  });
});

describe('GET handlers have no persistent side effects (T10-F04)', () => {
  it('leaves the database unchanged', async () => {
    const app = await start();
    const before = totalChanges(app);
    for (const url of [
      '/settings',
      '/catalog/competitions',
      '/catalog/competitions/copa-demo/sources/demo-a/seasons',
      '/catalog/competitions/copa-demo/sources/demo-a/seasons/2026/stages',
      '/projects',
    ]) {
      expect((await get(app, url)).statusCode).toBe(200);
      expect((await get(app, url, 'HEAD')).statusCode).toBe(200);
    }
    expect(totalChanges(app)).toBe(before);
  });
});
