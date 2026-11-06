/**
 * Egress allow-list (contracts/provider-ports.md section 4; architecture.md section 5.1; T10-F07, T10-F08): built
 * from the enabled sources' and the AI adapter's base URL origins only; exact origin match after WHATWG parsing;
 * `https:` only, loopback `http:` only for the configured AI origin; user information refused. Pure checks: no
 * connection is opened here.
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type AppConfig, ConfigError, buildAppConfig, loadConfig } from '../config/index.js';

import {
  EgressAllowList,
  EgressDenied,
  buildEgressAllowList,
  buildImageEgressAllowList,
  isLoopbackHostname,
} from './index.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

type Json = Record<string, unknown>;

const LANGUAGES = { defaultLanguage: 'es', languages: [{ code: 'es', label: 'Español' }] };
const BRAND = {
  name: 'Synthetic Brand',
  handle: '@SyntheticBrand',
  provisional: true,
  palette: { primary: '#000000', primaryDark: '#000000', accent: '#000000', secondary: '#000000', light: '#FFFFFF' },
  fonts: {
    heading: { family: 'Sans', weight: 800 },
    body: { family: 'Sans', weight: 400 },
    numeric: { family: 'Sans', weight: 700 },
  },
};

function configWith(sources: Json[], aiOptions: Json = {}, images: Json | null = null): AppConfig {
  return buildAppConfig(
    {
      app: {
        providers: {
          sports: { sources },
          ai: { adapter: 'openai-compatible', options: aiOptions },
          ...(images === null ? {} : { images }),
        },
      },
      languages: LANGUAGES,
      brand: BRAND,
    },
    { rootDir: repoRoot, environment: { configFile: null, dataDir: null, port: null } },
  );
}

function liveSource(id: string, baseUrl: string, overrides: Json = {}): Json {
  return {
    id,
    name: id,
    mode: 'LIVE_DATA',
    role: 'primary',
    accepted: true,
    adapter: `${id}-kind`,
    options: { baseUrl },
    ...overrides,
  };
}

const DEMO = { id: 'demo-a', name: 'A', mode: 'DEMO_DATA', role: 'primary', adapter: 'fixture' };

describe('allow-list from the configuration', () => {
  it('is empty for the committed default configuration (fixture, manual and stub adapters)', () => {
    const allowList = buildEgressAllowList(loadConfig({ rootDir: repoRoot, env: {} }));
    expect(allowList.isEmpty).toBe(true);
    expect(allowList.origins).toEqual([]);
    expect(() => allowList.check('https://sports.example.test/v1')).toThrow(EgressDenied);
  });

  it('contains the base URL origins of enabled sources only', () => {
    const allowList = buildEgressAllowList(
      configWith([
        liveSource('live-a', 'https://sports.example.test/v4'),
        liveSource('live-b', 'https://disabled.example.test/v1', { enabled: false }),
        DEMO,
      ]),
    );
    expect(allowList.origins).toEqual(['https://sports.example.test']);
  });

  it('adds the AI origin: https:, or http: on a loopback host', () => {
    expect(buildEgressAllowList(configWith([DEMO], { baseUrl: 'https://ai.example.test/v1' })).origins).toEqual([
      'https://ai.example.test',
    ]);
    for (const [baseUrl, origin] of [
      ['http://127.0.0.1:11434/v1', 'http://127.0.0.1:11434'],
      ['http://localhost:8080/v1', 'http://localhost:8080'],
      ['http://[::1]:8080/v1', 'http://[::1]:8080'],
    ] as const) {
      expect(buildEgressAllowList(configWith([DEMO], { baseUrl })).origins).toEqual([origin]);
    }
  });

  it('stops startup for an http: AI base URL on a non-loopback host or with user information', () => {
    for (const baseUrl of [
      'http://ai.example.test/v1',
      'http://192.0.2.10/v1',
      'https://u:p@ai.example.test',
      'ftp://ai.example.test',
      42,
    ]) {
      let error: unknown;
      try {
        buildEgressAllowList(configWith([DEMO], { baseUrl }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).setting).toBe('providers.ai.options.baseUrl');
    }
  });
});

describe('image generation allow-list (PD-ARCH-01G-B)', () => {
  it('is empty while the image adapter is disabled, the default', () => {
    expect(buildImageEgressAllowList(configWith([DEMO])).isEmpty).toBe(true);
    expect(configWith([DEMO]).providers.images).toEqual({ adapter: 'disabled', options: {} });
  });

  it('holds only the image origin, which the default client never gets', () => {
    const config = configWith(
      [DEMO],
      { baseUrl: 'https://ai.example.test/v1' },
      {
        adapter: 'openai',
        options: { baseUrl: 'https://images.example.test/v1' },
      },
    );
    expect(buildImageEgressAllowList(config).origins).toEqual(['https://images.example.test']);
    expect(buildEgressAllowList(config).origins).toEqual(['https://ai.example.test']);
  });

  it('stops startup for an http: image base URL, even on a loopback host', () => {
    for (const baseUrl of ['http://127.0.0.1:8080/v1', 'https://user:pw@images.example.test/v1']) {
      expect(() =>
        buildImageEgressAllowList(configWith([DEMO], {}, { adapter: 'openai', options: { baseUrl } })),
      ).toThrow(/providers\.images\.options\.baseUrl/);
    }
  });
});

describe('URL check before any connection', () => {
  const allowList = new EgressAllowList(['https://sports.example.test', 'http://127.0.0.1:11434']);

  function denied(url: string): string {
    try {
      allowList.check(url);
    } catch (error) {
      expect(error).toBeInstanceOf(EgressDenied);
      expect((error as EgressDenied).kind).toBe('denied');
      return (error as EgressDenied).message;
    }
    throw new Error('expected EgressDenied');
  }

  it('accepts exact allowed origins, with host case and default port normalized', () => {
    expect(allowList.check('https://sports.example.test/v4/x?y=1').pathname).toBe('/v4/x');
    expect(allowList.check('https://SPORTS.Example.TEST:443/v4').origin).toBe('https://sports.example.test');
    expect(allowList.check('http://127.0.0.1:11434/v1/chat').origin).toBe('http://127.0.0.1:11434');
  });

  it('refuses foreign origins, other ports and other schemes', () => {
    denied('https://other.example.test/');
    denied('https://sports.example.test.evil.test/');
    denied('https://sports.example.test:8443/');
    denied('http://sports.example.test/');
    denied('http://127.0.0.1:11435/');
    denied('https://127.0.0.1:11434/');
    denied('ftp://sports.example.test/');
    denied('data:text/plain,hello');
    denied('javascript:alert(1)');
  });

  it('refuses http: to a non-loopback host even when listed by mistake', () => {
    expect(() => new EgressAllowList(['http://sports.example.test'])).toThrow(TypeError);
    denied('http://203.0.113.10/');
  });

  it('refuses user information', () => {
    denied('https://user:pass@sports.example.test/');
    denied('https://user@sports.example.test/');
    denied('http://user:pass@127.0.0.1:11434/');
  });

  it('refuses invalid and over-long URLs, and never echoes the URL', () => {
    expect(denied('not a url')).not.toContain('not a url');
    denied(`https://sports.example.test/${'a'.repeat(9000)}`);
    expect(denied('https://other.example.test/path?secret=marker')).not.toContain('marker');
  });

  it('compares IDNA-processed hosts', () => {
    const idna = buildEgressAllowList(configWith([liveSource('live-a', 'https://BÜCHER.example.test/v1')]));
    expect(idna.origins).toEqual(['https://xn--bcher-kva.example.test']);
    expect(idna.check('https://bücher.EXAMPLE.test/x').hostname).toBe('xn--bcher-kva.example.test');
    expect(() => idna.check('https://bucher.example.test/x')).toThrow(EgressDenied);
  });

  it('accepts only normalized origins as entries', () => {
    for (const entry of [
      'https://sports.example.test/',
      'https://SPORTS.example.test',
      'sports.example.test',
      'https://u@sports.example.test',
    ]) {
      expect(() => new EgressAllowList([entry])).toThrow(TypeError);
    }
  });
});

describe('loopback host names', () => {
  it('recognizes 127.0.0.0/8, [::1] and localhost only', () => {
    for (const host of ['127.0.0.1', '127.1.2.3', '[::1]', 'localhost']) {
      expect(isLoopbackHostname(host)).toBe(true);
    }
    for (const host of ['0.0.0.0', '128.0.0.1', '[::]', 'localhost.example.test', '127.0.0.1.example.test']) {
      expect(isLoopbackHostname(host)).toBe(false);
    }
  });
});
