/**
 * Configuration schema and startup rules (architecture.md sections 5.1, 12.1 and 15.2; OD-20, OD-24, OD-27, AD-37,
 * AD-38; R-226, R-236, R-238, R-243, R-266; T10-F02, T11H-F07, T11H-F13). Documents are built inline from synthetic
 * values; host names use the reserved `.test` domain.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import { type AppConfig, type ConfigEnvironment, ConfigError, buildAppConfig } from './index.js';

type Json = Record<string, unknown>;

const ROOT = '/srv/edr-test-root';
const NO_ENVIRONMENT: ConfigEnvironment = { configFile: null, dataDir: null, port: null };

const LANGUAGES: Json = {
  defaultLanguage: 'es',
  languages: [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ],
};

const BRAND: Json = {
  name: 'Synthetic Brand',
  handle: '@SyntheticBrand',
  provisional: true,
  palette: { primary: '#5B2A86', primaryDark: '#2E1145', accent: '#D4AF37', secondary: '#1F4FB8', light: '#FFFFFF' },
  fonts: {
    heading: { family: 'Heading Sans', weight: 800 },
    body: { family: 'Body Sans', weight: 400 },
    numeric: { family: 'Body Sans', weight: 700 },
  },
};

function demo(id: string, overrides: Json = {}): Json {
  return {
    id,
    name: `Synthetic ${id}`,
    mode: 'DEMO_DATA',
    role: 'primary',
    accepted: true,
    adapter: 'fixture',
    options: { scenario: 'default' },
    ...overrides,
  };
}

function manual(id: string, overrides: Json = {}): Json {
  return { id, name: `Manual ${id}`, mode: 'MANUAL_DATA', role: 'primary', adapter: 'manual', ...overrides };
}

function live(id: string, overrides: Json = {}): Json {
  return {
    id,
    name: `Live ${id}`,
    mode: 'LIVE_DATA',
    role: 'primary',
    accepted: true,
    adapter: 'live-kind',
    options: { baseUrl: 'https://sports.example.test/v1' },
    ...overrides,
  };
}

function app(sources: Json[], extra: Json = {}): Json {
  return { providers: { sports: { sources }, ai: { adapter: 'stub' } }, ...extra };
}

function build(appDocument: Json, catalogue?: Json, environment = NO_ENVIRONMENT): AppConfig {
  return buildAppConfig(
    { app: appDocument, catalogue, languages: LANGUAGES, brand: BRAND },
    { rootDir: ROOT, environment },
  );
}

/** The ConfigError thrown by `action`; fails the test when nothing or something else is thrown. */
function configError(action: () => unknown): ConfigError {
  try {
    action();
  } catch (error) {
    if (error instanceof ConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a ConfigError');
}

function settings(error: ConfigError): string[] {
  return error.issues.map((issue) => issue.setting);
}

const DEFAULT_SOURCES = (): Json[] => [demo('demo-a'), demo('demo-b', { role: 'verification' }), manual('manual')];

describe('defaults (R-226, R-236, R-238)', () => {
  const config = build(app(DEFAULT_SOURCES()));

  it('uses the 1080 x 1350 format and the published carousel maximum', () => {
    expect(config.format).toEqual({ width: 1080, height: 1350, maxSlidesPerCarousel: 20 });
    expect(config.standingsRowsPerSlide).toBe(12);
  });

  it('has manual publication only and the display offset of America/Guatemala', () => {
    expect(config.publicationMode).toBe('manual');
    expect(config.display.utcOffsetMinutes).toBe(-360);
  });

  it('listens on the loopback address with the production allow-lists', () => {
    expect(config.server).toEqual({
      host: '127.0.0.1',
      port: 4300,
      allowedHosts: ['127.0.0.1:4300', 'localhost:4300'],
      allowedOrigins: ['http://127.0.0.1:4300', 'http://localhost:4300'],
    });
  });

  it('resolves the data directory against the project root', () => {
    expect(config.paths).toEqual({ rootDir: ROOT, dataDir: `${ROOT}/data` });
  });

  it('applies the PD-17 and PD-18 policy defaults', () => {
    expect(config.verificationPolicy).toEqual({
      manuallyApprovedPublication: 'allowed_without_accepted_source',
      livePublicationPermissionRule: 'every_supporting_source',
    });
  });

  it('defaults the source fields by mode', () => {
    const [demoA, , manualSource] = config.providers.sports.sources;
    expect(demoA).toMatchObject({ enabled: true, independenceGroup: 'demo-a', officialPublication: false });
    expect(demoA?.publicationPermission).toBe('not_applicable');
    expect(manualSource).toMatchObject({ accepted: false, publicationPermission: 'not_applicable' });
    const liveConfig = build(app([live('live-a')]));
    expect(liveConfig.providers.sports.sources[0]?.publicationPermission).toBe('unconfirmed');
    expect(liveConfig.providers.sports.sources[0]?.publicationPermissionDecision).toBeNull();
  });

  it('defaults to Spanish content with English selectable (R-236, OD-11)', () => {
    expect(config.languages.defaultLanguage).toBe('es');
    expect(config.languages.languages.map((language) => language.code)).toEqual(['es', 'en']);
  });

  it('has an empty catalogue configuration without a links file', () => {
    expect(config.catalogue.links).toEqual([]);
    expect(config.catalogue.restrictToLinks).toBe(false);
  });

  it('is deeply frozen', () => {
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.providers.sports.sources)).toBe(true);
    expect(Object.isFrozen(config.providers.sports.sources[0]?.options)).toBe(true);
    expect(() => {
      (config.format as { width: number }).width = 1;
    }).toThrow(TypeError);
  });
});

describe('format, publication mode and competition are configuration (R-226, R-238)', () => {
  it('accepts another format within the bounds', () => {
    const config = build(app(DEFAULT_SOURCES(), { format: { width: 1080, height: 1080, maxSlidesPerCarousel: 10 } }));
    expect(config.format).toEqual({ width: 1080, height: 1080, maxSlidesPerCarousel: 10 });
  });

  it('refuses more slides than Instagram publishes and fewer than a minimal carousel', () => {
    for (const maxSlidesPerCarousel of [21, 2, 5.5]) {
      const error = configError(() => build(app(DEFAULT_SOURCES(), { format: { maxSlidesPerCarousel } })));
      expect(settings(error)).toEqual(['format.maxSlidesPerCarousel']);
    }
  });

  it('refuses any publication mode other than manual (BR-11)', () => {
    const error = configError(() => build(app(DEFAULT_SOURCES(), { publicationMode: 'automatic' })));
    expect(settings(error)).toEqual(['publicationMode']);
    expect(error.message).toContain('no automatic publication');
  });

  it('has no competition list setting (PD-14)', () => {
    const error = configError(() => build(app(DEFAULT_SOURCES(), { competitions: [{ id: 'x' }] })));
    expect(error.message).toContain('unknown keys: competitions');
  });
});

describe('server host and Host and Origin allow-lists (PD-05, T10-F02)', () => {
  it('refuses any host other than 127.0.0.1', () => {
    for (const host of ['0.0.0.0', 'localhost', '::', '192.0.2.10']) {
      const error = configError(() => build(app(DEFAULT_SOURCES(), { server: { host } })));
      expect(settings(error)).toEqual(['server.host']);
    }
  });

  it('refuses wildcards, 0.0.0.0, non-loopback hosts and missing or invalid ports', () => {
    for (const entry of [
      '*',
      '0.0.0.0:4300',
      '192.0.2.10:4300',
      'host.test:4300',
      '127.0.0.1',
      '127.0.0.1:0',
      '127.0.0.1:70000',
      '*:4300',
      '[::1]:4300',
    ]) {
      const error = configError(() => build(app(DEFAULT_SOURCES(), { server: { allowedHosts: [entry] } })));
      expect(settings(error)).toEqual(['server.allowedHosts[0]']);
    }
    for (const entry of [
      '*',
      'http://0.0.0.0:4300',
      'https://127.0.0.1:4300',
      'http://host.test:4300',
      'http://127.0.0.1:4300/',
      'null',
      'http://*:4300',
    ]) {
      const error = configError(() => build(app(DEFAULT_SOURCES(), { server: { allowedOrigins: [entry] } })));
      expect(settings(error)).toEqual(['server.allowedOrigins[0]']);
    }
  });

  it('accepts the development set when configured', () => {
    const config = build(
      app(DEFAULT_SOURCES(), {
        server: {
          allowedHosts: ['127.0.0.1:4300', 'localhost:4300', '127.0.0.1:5173', 'localhost:5173'],
          allowedOrigins: [
            'http://127.0.0.1:4300',
            'http://localhost:4300',
            'http://127.0.0.1:5173',
            'http://localhost:5173',
          ],
        },
      }),
    );
    expect(config.server.allowedHosts).toContain('localhost:5173');
    expect(config.server.allowedOrigins).toContain('http://127.0.0.1:5173');
  });

  it('refuses empty and duplicated lists', () => {
    expect(settings(configError(() => build(app(DEFAULT_SOURCES(), { server: { allowedHosts: [] } }))))).toEqual([
      'server.allowedHosts',
    ]);
    const error = configError(() =>
      build(app(DEFAULT_SOURCES(), { server: { allowedOrigins: ['http://localhost:4300', 'http://localhost:4300'] } })),
    );
    expect(settings(error)).toEqual(['server.allowedOrigins']);
  });

  it('derives the default lists from the effective port, EDR_PORT included', () => {
    const config = build(app(DEFAULT_SOURCES()), undefined, { ...NO_ENVIRONMENT, port: 4310 });
    expect(config.server.port).toBe(4310);
    expect(config.server.allowedHosts).toEqual(['127.0.0.1:4310', 'localhost:4310']);
    expect(config.server.allowedOrigins).toEqual(['http://127.0.0.1:4310', 'http://localhost:4310']);
  });
});

describe('unknown and secret-like keys (architecture.md section 5.1)', () => {
  it('refuses unknown keys at every level', () => {
    expect(settings(configError(() => build(app(DEFAULT_SOURCES(), { extra: 1 }))))).toEqual(['configuration']);
    const error = configError(() => build(app([demo('demo-a', { colour: 'red' })])));
    expect(settings(error)).toEqual(['providers.sports.sources[0]']);
    expect(error.message).toContain('unknown keys: colour');
  });

  it('refuses secret-like keys anywhere, also inside adapter options, without echoing the value', () => {
    const cases: [Json, string][] = [
      [app(DEFAULT_SOURCES(), { apiKey: TEST_MARKER_TOKEN }), 'apiKey'],
      [
        {
          ...app(DEFAULT_SOURCES()),
          providers: {
            sports: { sources: DEFAULT_SOURCES() },
            ai: { adapter: 'stub', options: { apiKey: TEST_MARKER_TOKEN } },
          },
        },
        'providers.ai.options.apiKey',
      ],
      [
        app([live('live-a', { options: { baseUrl: 'https://sports.example.test', token: TEST_MARKER_TOKEN } })]),
        'providers.sports.sources[0].options.token',
      ],
      [
        app([
          live('live-a', {
            options: { baseUrl: 'https://sports.example.test', headers: { 'X-Auth-Token': TEST_MARKER_TOKEN } },
          }),
        ]),
        'providers.sports.sources[0].options.headers.X-Auth-Token',
      ],
      [
        app([demo('demo-a', { options: { password: TEST_MARKER_TOKEN } })]),
        'providers.sports.sources[0].options.password',
      ],
      [
        app([demo('demo-a', { options: { client_secret: TEST_MARKER_TOKEN } })]),
        'providers.sports.sources[0].options.client_secret',
      ],
    ];
    for (const [document, setting] of cases) {
      const error = configError(() => build(document));
      expect(settings(error)).toEqual([setting]);
      expect(error.message).toContain('looks like a secret');
      expect(error.message).not.toContain(TEST_MARKER_TOKEN);
    }
  });

  it('refuses secret-like keys in the catalogue, languages and brand documents', () => {
    const error = configError(() =>
      buildAppConfig(
        {
          app: app(DEFAULT_SOURCES()),
          catalogue: { links: [], restrictToLinks: false, secret: TEST_MARKER_TOKEN },
          languages: { ...LANGUAGES, token: TEST_MARKER_TOKEN },
          brand: { ...BRAND, password: TEST_MARKER_TOKEN },
        },
        { rootDir: ROOT, environment: NO_ENVIRONMENT },
      ),
    );
    expect(settings(error)).toEqual(['catalogue.secret', 'languages.token', 'brand.password']);
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
  });

  it('refuses a __proto__ key anywhere and leaves Object.prototype untouched', () => {
    const document = JSON.parse(
      '{"providers":{"sports":{"sources":[{"id":"demo-a","name":"A","mode":"DEMO_DATA","role":"primary",' +
        '"adapter":"fixture","options":{"__proto__":{"polluted":true}}}]},"ai":{"adapter":"stub"}}}',
    ) as Json;
    const error = configError(() => build(document));
    expect(settings(error)).toEqual(['providers.sports.sources[0].options']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('data-mode startup rules (OD-20, R-266)', () => {
  it('stops on an unknown mode, naming the setting', () => {
    const error = configError(() => build(app([demo('demo-a', { mode: 'FAKE_DATA' })])));
    expect(settings(error)).toEqual(['providers.sports.sources[0].mode']);
    expect(error.message).toContain('is not a known data mode');
    expect(error.message).not.toContain('FAKE_DATA');
  });

  it('stops on duplicate source IDs', () => {
    const error = configError(() => build(app([demo('demo-a'), demo('demo-a', { role: 'verification' })])));
    expect(settings(error)).toEqual(['providers.sports.sources[1].id']);
  });

  it('stops on an accepted MANUAL_DATA source', () => {
    const error = configError(() => build(app([demo('demo-a'), manual('manual', { accepted: true })])));
    expect(settings(error)).toEqual(['providers.sports.sources[1].accepted']);
    expect(error.message).toContain("'manual'");
  });

  it('stops on a LIVE_DATA source without an https: base URL', () => {
    const invalid: unknown[] = [
      undefined,
      'http://sports.example.test/v1',
      'https://user:pw@sports.example.test',
      'not a url',
      42,
    ];
    for (const baseUrl of invalid) {
      const options = baseUrl === undefined ? {} : { baseUrl };
      const error = configError(() => build(app([live('live-a', { options })])));
      expect(settings(error)).toEqual(['providers.sports.sources[0].options.baseUrl']);
    }
  });

  it('stops without an enabled primary source', () => {
    for (const sources of [[], [demo('demo-a', { enabled: false })], [demo('demo-b', { role: 'verification' })]]) {
      const error = configError(() => build(app(sources)));
      expect(settings(error)).toEqual(['providers.sports.sources']);
      expect(error.message).toContain('at least one enabled source with role primary');
    }
  });

  it('reports every problem at once', () => {
    const error = configError(() =>
      build(app([demo('demo-a', { enabled: false }), manual('manual', { accepted: true, role: 'verification' })])),
    );
    expect(settings(error)).toEqual(['providers.sports.sources[1].accepted', 'providers.sports.sources']);
  });

  it('accepts any adapter kind slug: the adapter registry resolves kinds, not the configuration', () => {
    const config = build(app([live('live-a', { adapter: 'any-provider-kind' })]));
    expect(config.providers.sports.sources[0]?.adapter).toBe('any-provider-kind');
  });
});

describe('verification policy (PD-17, PD-18, AD-38)', () => {
  it('refuses allowed_labelled naming the setting', () => {
    const error = configError(() =>
      build(app(DEFAULT_SOURCES(), { verificationPolicy: { manuallyApprovedPublication: 'allowed_labelled' } })),
    );
    expect(settings(error)).toEqual(['verificationPolicy.manuallyApprovedPublication']);
    expect(error.message).toContain('PD-17');
  });

  it('refuses any_supporting_source naming the setting', () => {
    const error = configError(() =>
      build(app(DEFAULT_SOURCES(), { verificationPolicy: { livePublicationPermissionRule: 'any_supporting_source' } })),
    );
    expect(settings(error)).toEqual(['verificationPolicy.livePublicationPermissionRule']);
    expect(error.message).toContain('PD-18');
  });

  it('accepts blocked and refuses unknown values', () => {
    const config = build(app(DEFAULT_SOURCES(), { verificationPolicy: { manuallyApprovedPublication: 'blocked' } }));
    expect(config.verificationPolicy.manuallyApprovedPublication).toBe('blocked');
    const error = configError(() =>
      build(app(DEFAULT_SOURCES(), { verificationPolicy: { manuallyApprovedPublication: TEST_MARKER_TOKEN } })),
    );
    expect(settings(error)).toEqual(['verificationPolicy.manuallyApprovedPublication']);
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
  });
});

describe('publication permission (PD-18, AD-38 item 6)', () => {
  it('refuses a confirmed LIVE_DATA source without a decision, naming the source', () => {
    const error = configError(() => build(app([live('live-a', { publicationPermission: 'confirmed' })])));
    expect(settings(error)).toEqual(['providers.sports.sources[0].publicationPermissionDecision']);
    expect(error.message).toContain("'live-a'");
  });

  it('accepts a confirmed LIVE_DATA source naming a decision', () => {
    const config = build(
      app([live('live-a', { publicationPermission: 'confirmed', publicationPermissionDecision: 'PD-21' })]),
    );
    expect(config.providers.sports.sources[0]).toMatchObject({
      publicationPermission: 'confirmed',
      publicationPermissionDecision: 'PD-21',
    });
  });

  it('refuses a decision on MANUAL_DATA and DEMO_DATA sources and with unconfirmed', () => {
    const cases: [Json, string][] = [
      [manual('manual', { publicationPermissionDecision: 'PD-21' }), 'manual'],
      [demo('demo-x', { publicationPermissionDecision: 'PD-21' }), 'demo-x'],
      [live('live-a', { publicationPermissionDecision: 'PD-21' }), 'live-a'],
    ];
    for (const [source, id] of cases) {
      const error = configError(() => build(app([demo('demo-a'), source])));
      expect(settings(error)).toEqual(['providers.sports.sources[1].publicationPermissionDecision']);
      expect(error.message).toContain(`'${id}'`);
    }
  });

  it('refuses a permission that does not fit the mode', () => {
    for (const [source, setting] of [
      [demo('demo-a', { publicationPermission: 'confirmed' }), 'providers.sports.sources[0].publicationPermission'],
      [
        live('live-a', { publicationPermission: 'not_applicable' }),
        'providers.sports.sources[0].publicationPermission',
      ],
    ] as const) {
      expect(settings(configError(() => build(app([source]))))).toEqual([setting]);
    }
  });

  it('refuses a malformed decision ID', () => {
    for (const decision of ['PD-1', 'PD-12345', 'pd-21', 'OD-21']) {
      const error = configError(() =>
        build(app([live('live-a', { publicationPermission: 'confirmed', publicationPermissionDecision: decision })])),
      );
      expect(settings(error)).toEqual(['providers.sports.sources[0].publicationPermissionDecision']);
    }
  });
});

describe('source independence (OD-24, T11H-F13)', () => {
  it('stops when two enabled sources share adapter kind and base URL origin but not the group, naming both', () => {
    const error = configError(() =>
      build(
        app([
          live('constructor', { independenceGroup: 'constructor' }),
          live('prototype', {
            role: 'verification',
            independenceGroup: 'prototype',
            options: { baseUrl: 'https://SPORTS.example.test:443/other' },
          }),
        ]),
      ),
    );
    expect(settings(error)).toEqual(['providers.sports.sources']);
    expect(error.message).toContain("'constructor' and 'prototype'");
  });

  it('accepts such sources in one group, with different adapters or origins, or when one is disabled', () => {
    const variants: Json[][] = [
      [live('live-a', { independenceGroup: 'upstream' }), live('live-b', { independenceGroup: 'upstream' })],
      [live('live-a'), live('live-b', { adapter: 'other-kind' })],
      [live('live-a'), live('live-b', { options: { baseUrl: 'https://other.example.test/v1' } })],
      [live('live-a'), live('live-b', { enabled: false })],
    ];
    for (const sources of variants) {
      expect(build(app(sources)).providers.sports.sources).toHaveLength(2);
    }
  });

  it('stops on a link binding a DEMO_DATA source with a LIVE_DATA or MANUAL_DATA source, naming the link', () => {
    for (const other of [live('live-a'), manual('manual')]) {
      for (const linkId of ['constructor', 'mixed-link']) {
        const error = configError(() =>
          build(app([demo('demo-a'), other]), {
            links: [
              {
                id: linkId,
                name: 'Mixed',
                bindings: [
                  { sourceId: 'demo-a', competitionRef: 'liga-demo' },
                  { sourceId: other['id'], competitionRef: 'ref-1' },
                ],
              },
            ],
          }),
        );
        expect(settings(error)).toEqual(['catalogue.links[0]']);
        expect(error.message).toContain(`the link '${linkId}'`);
        expect(error.message).toContain('OD-24');
      }
    }
  });

  it('refuses __proto__ as a link ID without touching Object.prototype', () => {
    const catalogue = JSON.parse(
      '{"links":[{"id":"__proto__","name":"P","bindings":[{"sourceId":"demo-a","competitionRef":"x"}]}]}',
    ) as Json;
    const error = configError(() => build(app([demo('demo-a')]), catalogue));
    expect(settings(error)).toEqual(['catalogue.links[0].id']);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it('accepts links of LIVE_DATA and MANUAL_DATA sources together, and of DEMO_DATA sources together', () => {
    const config = build(app([live('live-a'), manual('manual'), demo('demo-a'), demo('demo-b')]), {
      links: [
        {
          id: 'real',
          name: 'Real',
          bindings: [
            { sourceId: 'live-a', competitionRef: 'r' },
            { sourceId: 'manual', competitionRef: 'm' },
          ],
        },
        {
          id: 'demo',
          name: 'Demo',
          bindings: [
            { sourceId: 'demo-a', competitionRef: 'd' },
            { sourceId: 'demo-b', competitionRef: 'd' },
          ],
        },
      ],
    });
    expect(config.catalogue.links.map((link) => link.id)).toEqual(['real', 'demo']);
  });
});

describe('catalogue links (architecture.md section 15.2; AD-38)', () => {
  const sources = (): Json[] => [
    demo('demo-a'),
    demo('demo-b', { role: 'verification' }),
    manual('manual'),
    live('live-a'),
  ];

  it('stops on a noAcceptedPublicSource link binding a LIVE_DATA, DEMO_DATA or accepted source, naming the link', () => {
    for (const sourceId of ['live-a', 'demo-a']) {
      const error = configError(() =>
        build(app(sources()), {
          links: [
            {
              id: 'marked',
              name: 'Marked',
              noAcceptedPublicSource: true,
              bindings: [
                { sourceId: 'manual', competitionRef: 'm' },
                { sourceId, competitionRef: 'x' },
              ],
            },
          ],
        }),
      );
      expect(settings(error)).toContain('catalogue.links[0]');
      expect(error.message).toContain("the link 'marked' is marked noAcceptedPublicSource");
    }
  });

  it('stops on a noAcceptedPublicSource link without bindings', () => {
    const error = configError(() =>
      build(app(sources()), { links: [{ id: 'marked', name: 'Marked', noAcceptedPublicSource: true, bindings: [] }] }),
    );
    expect(settings(error)).toEqual(['catalogue.links[0]']);
    expect(error.message).toContain('must bind at least one MANUAL_DATA source');
  });

  it('accepts a noAcceptedPublicSource link that binds MANUAL_DATA sources only', () => {
    const config = build(app(sources()), {
      links: [
        {
          id: 'marked',
          name: 'Marked',
          noAcceptedPublicSource: true,
          bindings: [{ sourceId: 'manual', competitionRef: 'm' }],
        },
      ],
    });
    expect(config.catalogue.getLink('marked')?.noAcceptedPublicSource).toBe(true);
  });

  it('stops on unknown sources, duplicate links, double bindings and aliases of unbound sources', () => {
    const error = configError(() =>
      build(app(sources()), {
        links: [
          { id: 'one', name: 'One', bindings: [{ sourceId: 'missing', competitionRef: 'x' }] },
          {
            id: 'one',
            name: 'Again',
            bindings: [
              { sourceId: 'demo-a', competitionRef: 'a' },
              { sourceId: 'demo-a', competitionRef: 'b' },
            ],
          },
          { id: 'three', name: 'Three', bindings: [{ sourceId: 'demo-a', competitionRef: 'a' }] },
          {
            id: 'four',
            name: 'Four',
            bindings: [{ sourceId: 'demo-b', competitionRef: 'z' }],
            stageAliases: { 'demo-a': { 'league-stage': 'league' } },
          },
        ],
      }),
    );
    expect(settings(error)).toEqual([
      'catalogue.links[0].bindings[0].sourceId',
      'catalogue.links[1].id',
      'catalogue.links[1].bindings[1].sourceId',
      'catalogue.links[2].bindings[0]',
      'catalogue.links[3].stageAliases',
    ]);
  });

  it('keeps restrictToLinks and selectableStages as configuration (PD-19, PD-20)', () => {
    const config = build(app(sources()), {
      links: [
        {
          id: 'one',
          name: 'One',
          bindings: [{ sourceId: 'demo-a', competitionRef: 'a' }],
          selectableStages: ['league'],
        },
      ],
      restrictToLinks: true,
    });
    expect(config.catalogue.restrictToLinks).toBe(true);
    expect(config.catalogue.getLink('one')?.selectableStages).toEqual(['league']);
  });

  it('looks links, bindings and stage aliases up with Map semantics (T11H-F07)', () => {
    const config = build(app(sources()), {
      links: [
        {
          id: 'constructor',
          name: 'Constructor',
          reference: true,
          bindings: [
            { sourceId: 'demo-a', competitionRef: 'toString' },
            { sourceId: 'demo-b', competitionRef: 'b' },
          ],
          stageAliases: { 'demo-b': { constructor: 'league', prototype: 'final' } },
        },
      ],
    });
    const catalogue = config.catalogue;
    expect(catalogue.getLink('constructor')?.reference).toBe(true);
    expect(catalogue.getLink('toString')).toBeUndefined();
    expect(catalogue.getLink('__proto__')).toBeUndefined();
    expect(catalogue.linkOfBinding('demo-a', 'toString')?.id).toBe('constructor');
    expect(catalogue.linkOfBinding('demo-a', 'constructor')).toBeUndefined();
    expect(catalogue.linksOfSource('demo-b').map((link) => link.id)).toEqual(['constructor']);
    expect(catalogue.linksOfSource('__proto__')).toEqual([]);
    expect(catalogue.stageAlias('constructor', 'demo-b', 'constructor')).toBe('league');
    expect(catalogue.stageAlias('constructor', 'demo-b', 'prototype')).toBe('final');
    expect(catalogue.stageAlias('constructor', 'demo-b', 'toString')).toBeUndefined();
    expect(catalogue.stageAlias('constructor', 'demo-a', 'constructor')).toBeUndefined();
  });

  it('refuses __proto__ and other non-slug stage alias keys without touching Object.prototype', () => {
    const catalogue = JSON.parse(
      '{"links":[{"id":"one","name":"One","bindings":[{"sourceId":"demo-a","competitionRef":"a"}],' +
        '"stageAliases":{"demo-a":{"__proto__":"x"}}}]}',
    ) as Json;
    const error = configError(() => build(app(sources()), catalogue));
    expect(settings(error)).toEqual(['catalogue.links[0].stageAliases.demo-a']);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();

    const upper = configError(() =>
      build(app(sources()), {
        links: [
          {
            id: 'one',
            name: 'One',
            bindings: [{ sourceId: 'demo-a', competitionRef: 'a' }],
            stageAliases: { 'demo-a': { toString: 'x' } },
          },
        ],
      }),
    );
    expect(settings(upper)).toEqual(['catalogue.links[0].stageAliases.demo-a']);
  });

  it('does not treat stage IDs in stageAliases as setting names', () => {
    const config = build(app(sources()), {
      links: [
        {
          id: 'one',
          name: 'One',
          bindings: [{ sourceId: 'demo-a', competitionRef: 'a' }],
          stageAliases: { 'demo-a': { 'token-cup': 'cup' } },
        },
      ],
    });
    expect(config.catalogue.stageAlias('one', 'demo-a', 'token-cup')).toBe('cup');
  });
});

describe('languages and brand documents', () => {
  const withDocuments =
    (languages: unknown, brand: unknown): (() => AppConfig) =>
    () =>
      buildAppConfig({ app: app(DEFAULT_SOURCES()), languages, brand }, { rootDir: ROOT, environment: NO_ENVIRONMENT });

  it('refuses a default language that is not listed, duplicates and unknown codes', () => {
    expect(
      settings(
        configError(withDocuments({ defaultLanguage: 'en', languages: [{ code: 'es', label: 'Español' }] }, BRAND)),
      ),
    ).toEqual(['languages.defaultLanguage']);
    expect(
      settings(
        configError(
          withDocuments(
            {
              defaultLanguage: 'es',
              languages: [
                { code: 'es', label: 'A' },
                { code: 'es', label: 'B' },
              ],
            },
            BRAND,
          ),
        ),
      ),
    ).toEqual(['languages.languages']);
    expect(
      settings(
        configError(withDocuments({ defaultLanguage: 'fr', languages: [{ code: 'fr', label: 'Français' }] }, BRAND)),
      ),
    ).toEqual(['languages.defaultLanguage', 'languages.languages[0].code']);
  });

  it('refuses palette values that are not colours and handles that are not handles', () => {
    const error = configError(
      withDocuments(LANGUAGES, {
        ...BRAND,
        handle: 'no handle',
        palette: { ...(BRAND['palette'] as Json), accent: 'gold' },
      }),
    );
    expect(settings(error)).toEqual(['brand.handle', 'brand.palette.accent']);
  });
});

describe('error text (OD-20)', () => {
  it('never contains a configured value', () => {
    const error = configError(() =>
      build(
        app([demo('demo-a', { mode: TEST_MARKER_TOKEN, role: TEST_MARKER_TOKEN, name: 7 })], {
          server: { host: TEST_MARKER_TOKEN, allowedHosts: [TEST_MARKER_TOKEN] },
          dataDir: 5,
          publicationMode: TEST_MARKER_TOKEN,
        }),
      ),
    );
    expect(error.issues.length).toBeGreaterThanOrEqual(6);
    expect(error.message).not.toContain(TEST_MARKER_TOKEN);
    expect(error.message).toContain('providers.sports.sources[0].mode');
  });

  it('names a missing required setting', () => {
    const error = configError(() => build({ providers: { sports: { sources: [] } } }));
    expect(error.issues).toEqual([{ setting: 'providers.ai', problem: 'is required' }]);
  });
});
