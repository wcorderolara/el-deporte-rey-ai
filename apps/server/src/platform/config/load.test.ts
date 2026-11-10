/**
 * Configuration loading: files, environment and the committed configurations (architecture.md sections 5.1 and
 * 15.2; OD-20, PD-14, PD-17 to PD-20, AD-38; R-226, R-236, R-238, R-243, R-266), and a check that platform code
 * needs no provider identifier (AD-31, R-139).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import { CONFIG_ENVIRONMENT_VARIABLES, ConfigError, MAX_CONFIG_FILE_BYTES, loadConfig } from './index.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

type Json = Record<string, unknown>;

function readCommitted(name: string): Json {
  return JSON.parse(readFileSync(join(repoRoot, 'config', name), 'utf8')) as Json;
}

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

/** An environment that records every variable read and holds a synthetic token. */
function recordingEnvironment(values: Record<string, string>): { env: Record<string, string>; read: Set<string> } {
  const read = new Set<string>();
  const env = new Proxy(
    { FOOTBALL_DATA_API_TOKEN: TEST_MARKER_TOKEN, EDR_AI_API_KEY: TEST_MARKER_TOKEN, ...values },
    {
      get(target, property, receiver) {
        if (typeof property === 'string') {
          read.add(property);
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
      ownKeys(target) {
        read.add('*');
        return Reflect.ownKeys(target);
      },
    },
  );
  return { env, read };
}

describe('committed configuration (config/app.config.json)', () => {
  const config = loadConfig({ rootDir: repoRoot, env: {} });

  it('enables the DEMO_DATA sources demo-a and demo-b, the MANUAL_DATA sources manual and local and the stub AI only', () => {
    expect(
      config.providers.sports.sources.map((source) => [
        source.id,
        source.mode,
        source.role,
        source.accepted,
        source.officialPublication,
        source.enabled,
      ]),
    ).toEqual([
      ['demo-a', 'DEMO_DATA', 'primary', true, false, true],
      ['demo-b', 'DEMO_DATA', 'verification', true, true, true],
      ['manual', 'MANUAL_DATA', 'primary', false, false, true],
      ['local', 'MANUAL_DATA', 'primary', false, false, true],
    ]);
    expect(config.providers.sports.sources.some((source) => source.mode === 'LIVE_DATA')).toBe(false);
    expect(config.providers.ai.adapter).toBe('stub');
  });

  it('uses the decided policies and production allow-lists (PD-17, PD-18, T10-F02)', () => {
    expect(config.verificationPolicy).toEqual({
      manuallyApprovedPublication: 'allowed_without_accepted_source',
      livePublicationPermissionRule: 'every_supporting_source',
    });
    expect(config.server.allowedHosts).toEqual(['127.0.0.1:4300', 'localhost:4300']);
    expect(config.server.allowedOrigins).toEqual(['http://127.0.0.1:4300', 'http://localhost:4300']);
  });

  it('keeps the format, publication mode and languages as configuration (R-226, R-236, R-238)', () => {
    expect(config.format).toEqual({ width: 1080, height: 1350, maxSlidesPerCarousel: 20 });
    expect(config.publicationMode).toBe('manual');
    expect(config.languages.defaultLanguage).toBe('es');
    expect(config.languages.languages.map((language) => language.code)).toEqual(['es', 'en']);
    expect(config.brand.provisional).toBe(true);
    expect(config.paths.dataDir).toBe(join(repoRoot, 'data'));
  });

  it('links the fixture competitions liga-demo and copa-demo of demo-a and demo-b, copa-demo as reference', () => {
    const links = config.catalogue.links;
    expect(links.map((link) => [link.id, link.reference])).toEqual([
      ['copa-demo', true],
      ['liga-demo', false],
    ]);
    for (const link of links) {
      expect(link.bindings).toEqual([
        { sourceId: 'demo-a', competitionRef: link.id },
        { sourceId: 'demo-b', competitionRef: link.id },
      ]);
    }
  });

  it('restricts neither competitions nor stages and marks no link (PD-19, PD-20, AD-38)', () => {
    expect(config.catalogue.restrictToLinks).toBe(false);
    for (const link of config.catalogue.links) {
      expect(link.selectableStages).toBeNull();
      expect(link.noAcceptedPublicSource).toBe(false);
    }
  });

  it('has no competition list (PD-14)', () => {
    expect(Object.keys(readCommitted('app.config.json'))).not.toContain('competitions');
    expect(() => readFileSync(join(repoRoot, 'config', 'competitions.json'))).toThrow();
  });
});

describe('committed development configuration (config/dev.config.json)', () => {
  it('differs from the default configuration only by the 5173 development values (T10-F02)', () => {
    const production = readCommitted('app.config.json');
    const development = readCommitted('dev.config.json');
    const server = development['server'] as Json;
    expect(server['allowedHosts']).toEqual(['127.0.0.1:4300', 'localhost:4300', '127.0.0.1:5173', 'localhost:5173']);
    expect(server['allowedOrigins']).toEqual([
      'http://127.0.0.1:4300',
      'http://localhost:4300',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]);
    expect({ ...development, server: production['server'] }).toEqual(production);
  });

  it('loads through EDR_CONFIG', () => {
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev.config.json' } });
    expect(config.server.allowedOrigins).toContain('http://localhost:5173');
  });

  it('loads the Vite development configuration with a live data source enabled', () => {
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev-live.config.json' } });
    const source = config.providers.sports.sources.find((item) => item.mode === 'LIVE_DATA');
    expect(source).toMatchObject({ enabled: true, mode: 'LIVE_DATA' });
    expect(config.server.allowedOrigins).toContain('http://127.0.0.1:5173');
    expect(config.paths.dataDir).toBe(join(repoRoot, 'data'));
  });

  it('loads the Vite development configuration with the OpenAI image adapter (PD-ARCH-01G-B)', () => {
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev-images.config.json' } });
    expect(config.providers.images.adapter).toBe('openai');
    expect(config.providers.images.options['baseUrl']).toBe('https://api.openai.com/v1');
    expect(JSON.stringify(config.providers.images)).not.toMatch(/api_?key|secret|bearer|sk-/i);
    const development = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev.config.json' } });
    expect({ ...config, providers: { ...config.providers, images: development.providers.images } }).toEqual(
      development,
    );
    expect(development.providers.images).toEqual({ adapter: 'disabled', options: {} });
  });

  it('loads the full Vite development configuration: the live sports source and the OpenAI image adapter together', () => {
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev-full.config.json' } });
    const live = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev-live.config.json' } });
    const images = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: 'config/dev-images.config.json' } });
    expect(config.providers.sports).toEqual(live.providers.sports);
    expect(config.providers.images).toEqual(images.providers.images);
    expect({ ...config, providers: { ...config.providers, images: live.providers.images } }).toEqual(live);
  });
});

describe('environment (OD-20, R-266, AD-30)', () => {
  it('reads only EDR_CONFIG, EDR_DATA_DIR and EDR_PORT: never a credential', () => {
    const { env, read } = recordingEnvironment({});
    const config = loadConfig({ rootDir: repoRoot, env });
    expect([...read].sort()).toEqual([...CONFIG_ENVIRONMENT_VARIABLES].sort());
    expect(JSON.stringify(config)).not.toContain(TEST_MARKER_TOKEN);
  });

  it('needs no token without a LIVE_DATA source', () => {
    expect(() => loadConfig({ rootDir: repoRoot, env: {} })).not.toThrow();
  });

  it('applies EDR_DATA_DIR and EDR_PORT, and ignores empty values', () => {
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_DATA_DIR: '/var/tmp/edr-data', EDR_PORT: '4320' } });
    expect(config.paths.dataDir).toBe('/var/tmp/edr-data');
    expect(config.server.port).toBe(4320);
    const relative = loadConfig({ rootDir: repoRoot, env: { EDR_DATA_DIR: 'tmp/data', EDR_PORT: '', EDR_CONFIG: '' } });
    expect(relative.paths.dataDir).toBe(join(repoRoot, 'tmp/data'));
    expect(relative.server.port).toBe(4300);
  });

  it('stops on an invalid EDR_PORT, naming the variable and not the value', () => {
    for (const value of ['0', '65536', '43a0', '-1', `${TEST_MARKER_TOKEN}`]) {
      const error = configError(() => loadConfig({ rootDir: repoRoot, env: { EDR_PORT: value } }));
      expect(error.setting).toBe('EDR_PORT');
      expect(error.message).not.toContain(TEST_MARKER_TOKEN);
    }
  });
});

describe('configuration files', () => {
  let directory = '';

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'edr-config-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function write(name: string, content: unknown): string {
    const path = join(directory, name);
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
    return path;
  }

  function generatedApp(overrides: Json = {}): Json {
    return {
      ...readCommitted('app.config.json'),
      catalogue: { linksFile: join(directory, 'catalogue.json') },
      ...overrides,
    };
  }

  it('loads a generated configuration from a temporary directory through EDR_CONFIG', () => {
    write('catalogue.json', { links: [], restrictToLinks: false });
    const path = write('app.json', generatedApp({ dataDir: join(directory, 'data') }));
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: path } });
    expect(config.paths.dataDir).toBe(join(directory, 'data'));
    expect(config.catalogue.links).toEqual([]);
  });

  it('loads a LIVE_DATA configuration with any https: provider without a token in the environment', () => {
    const app = generatedApp();
    delete app['catalogue'];
    const providers = app['providers'] as { sports: { sources: Json[] } };
    providers.sports.sources.push({
      id: 'live-a',
      name: 'Live source',
      mode: 'LIVE_DATA',
      role: 'primary',
      accepted: true,
      adapter: 'any-kind',
      options: { baseUrl: 'https://sports.example.test/v4', requestsPerMinute: 10 },
    });
    const config = loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: write('live.json', app) } });
    expect(config.providers.sports.sources.at(-1)?.publicationPermission).toBe('unconfirmed');
  });

  it('names EDR_CONFIG for a missing, unreadable, invalid or oversize file, without its path or content', () => {
    const missing = configError(() =>
      loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: join(directory, 'none.json') } }),
    );
    expect(missing.setting).toBe('EDR_CONFIG');
    expect(missing.message).not.toContain(directory);

    const invalid = configError(() =>
      loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: write('bad.json', `{"x": "${TEST_MARKER_TOKEN}"`) } }),
    );
    expect(invalid.message).toBe('EDR_CONFIG names a file that is not valid JSON');

    const large = configError(() =>
      loadConfig({
        rootDir: repoRoot,
        env: { EDR_CONFIG: write('large.json', ' '.repeat(MAX_CONFIG_FILE_BYTES + 1)) },
      }),
    );
    expect(large.message).toContain('larger than');

    const notFile = configError(() => loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: directory } }));
    expect(notFile.message).toBe('EDR_CONFIG must name a regular file');
  });

  it('names catalogue.linksFile, languagesFile and brandFile for files that cannot be read', () => {
    const cases: [Json, string][] = [
      [generatedApp(), 'catalogue.linksFile'],
      [generatedApp({ catalogue: undefined, languagesFile: join(directory, 'none.json') }), 'languagesFile'],
      [generatedApp({ catalogue: undefined, brandFile: join(directory, 'none.json') }), 'brandFile'],
    ];
    for (const [app, setting] of cases) {
      const error = configError(() => loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: write('app.json', app) } }));
      expect(error.setting).toBe(setting);
    }
  });

  it('stops startup with the catalogue rules of a generated catalogue file', () => {
    write('catalogue.json', {
      links: [
        {
          id: 'mixed',
          name: 'Mixed',
          bindings: [
            { sourceId: 'demo-a', competitionRef: 'liga-demo' },
            { sourceId: 'manual', competitionRef: 'liga-manual' },
          ],
        },
      ],
    });
    const error = configError(() =>
      loadConfig({ rootDir: repoRoot, env: { EDR_CONFIG: write('app.json', generatedApp()) } }),
    );
    expect(error.message).toContain("the link 'mixed'");
  });
});

describe('provider neutrality (AD-31, R-139)', () => {
  it('lints platform/config, platform/format and platform/net without a provider-identifier or network finding', async () => {
    const eslint = new ESLint({ cwd: repoRoot });
    const results = await eslint.lintFiles([
      'apps/server/src/platform/config/**/*.ts',
      'apps/server/src/platform/format/**/*.ts',
      'apps/server/src/platform/net/**/*.ts',
    ]);
    expect(results.length).toBeGreaterThanOrEqual(10);
    const findings = results.flatMap((result) =>
      result.messages.map((message) => `${result.filePath}: ${message.ruleId ?? ''} ${message.message}`),
    );
    expect(findings).toEqual([]);
  });

  it('needs no provider base URL in the committed default and development configurations', () => {
    const text = ['app.config.json', 'dev.config.json', 'catalogue.json', 'languages.json', 'brand.json']
      .map((name) => readFileSync(join(repoRoot, 'config', name), 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/https:\/\//);
    expect(text).not.toContain('baseUrl');
  });
});
