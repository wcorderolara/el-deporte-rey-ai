/**
 * Adapter selection by configuration only (R-106, R-223, AD-08): the committed default configuration selects the stub;
 * changing only `providers.ai` in the configuration document selects the OpenAI-compatible adapter, whose base URL
 * origin is then the only AI origin of the egress allow-list. The adapter is exercised against a loopback server only.
 */
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AppConfig,
  ConfigError,
  buildAppConfig,
  loadConfig,
  readConfigEnvironment,
  readJsonDocument,
} from '../../platform/config/index.js';
import { buildEgressAllowList, createEgressClient } from '../../platform/net/index.js';

import { type DraftRequest, type StubAiTextProvider, createAiProvider } from './index.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
/** A project root without `fixtures/ai/`: the stub then builds its deterministic draft. */
const NO_FIXTURES_ROOT = path.join(ROOT_DIR, 'apps', 'server', 'src', 'providers', 'ai');

function sampleRequest(): DraftRequest {
  return {
    language: 'en',
    brand: { name: 'Synthetic Brand', handle: '@SyntheticBrand' },
    limits: { headlineMaxChars: 80, descriptionMaxChars: 300, captionMaxChars: 600, maxHashtags: 3 },
    slides: [
      { slideKey: 'cover', slideType: 'cover', facts: [] },
      { slideKey: 'closing', slideType: 'closing', facts: [] },
    ],
    captionFacts: [],
  };
}

function withAi(config: AppConfig, ai: { adapter: string; options: Record<string, unknown> }): AppConfig {
  return { ...config, providers: { ...config.providers, ai } };
}

/** Builds the configuration from the committed documents with `providers.ai` replaced. */
function configWithAiDocument(ai: unknown): AppConfig {
  const appFile = path.join(ROOT_DIR, 'config', 'app.config.json');
  const app = readJsonDocument(appFile, 'config/app.config.json') as {
    providers: Record<string, unknown>;
    catalogue?: { linksFile: string };
    languagesFile: string;
    brandFile: string;
  };
  app.providers['ai'] = ai;
  return buildAppConfig(
    {
      app,
      ...(app.catalogue === undefined
        ? {}
        : { catalogue: readJsonDocument(path.join(ROOT_DIR, app.catalogue.linksFile), 'catalogue.linksFile') }),
      languages: readJsonDocument(path.join(ROOT_DIR, app.languagesFile), 'languagesFile'),
      brand: readJsonDocument(path.join(ROOT_DIR, app.brandFile), 'brandFile'),
    },
    { rootDir: ROOT_DIR, environment: readConfigEnvironment({}) },
  );
}

let server: Server;
let origin: string;
let requests = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    requests += 1;
    request.resume();
    request.on('end', () => {
      const draft = {
        slides: [
          { slideKey: 'cover', headline: 'Roundup', description: 'Highlights' },
          { slideKey: 'closing', headline: 'Thanks', description: 'See you soon' },
        ],
        caption: 'Results roundup',
        hashtags: ['#football'],
      };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(draft) }, finish_reason: 'stop' }] }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('createAiProvider', () => {
  it('selects the stub adapter with the committed default configuration, with an empty egress allow-list', async () => {
    const config = loadConfig({ rootDir: ROOT_DIR, env: {} });
    expect(config.providers.ai.adapter).toBe('stub');
    const allowList = buildEgressAllowList(config);
    expect(allowList.origins).toEqual([]);
    const provider = createAiProvider(config, {
      egress: createEgressClient(allowList),
      env: {},
      paths: { rootDir: NO_FIXTURES_ROOT },
    }) as StubAiTextProvider;
    expect(provider.id).toBe('stub');
    const response = await provider.generateDraft(sampleRequest(), { signal: new AbortController().signal });
    expect(response.slides).toHaveLength(2);
    expect(provider.lastRequest?.language).toBe('en');
  });

  it('selects the OpenAI-compatible adapter by a configuration change only (R-223)', async () => {
    const config = configWithAiDocument({
      adapter: 'openai-compatible',
      options: { baseUrl: `${origin}/v1`, model: 'synthetic-local-model', timeoutMs: 2000 },
    });
    const allowList = buildEgressAllowList(config);
    expect(allowList.origins).toEqual([origin]);
    const provider = createAiProvider(config, {
      egress: createEgressClient(allowList),
      env: {},
      paths: { rootDir: NO_FIXTURES_ROOT },
    });
    expect(provider.id).toBe('openai-compatible');
    const before = requests;
    const response = await provider.generateDraft(sampleRequest(), { signal: new AbortController().signal });
    expect(response.caption).toBe('Results roundup');
    expect(requests).toBe(before + 1);
  });

  it('refuses a key-like AI option in the configuration document (secrets only from EDR_AI_API_KEY)', () => {
    expect(() =>
      configWithAiDocument({
        adapter: 'openai-compatible',
        options: { baseUrl: `${origin}/v1`, model: 'm', timeoutMs: 1000, apiKey: 'x' },
      }),
    ).toThrow(ConfigError);
  });

  it('refuses an unknown adapter kind, naming the setting', () => {
    const config = withAi(loadConfig({ rootDir: ROOT_DIR, env: {} }), { adapter: 'vendor-sdk', options: {} });
    let error: unknown;
    try {
      createAiProvider(config, {
        egress: createEgressClient(buildEgressAllowList(config)),
        env: {},
        paths: { rootDir: NO_FIXTURES_ROOT },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).setting).toBe('providers.ai.adapter');
  });

  it('validates the adapter options at creation', () => {
    const config = withAi(loadConfig({ rootDir: ROOT_DIR, env: {} }), {
      adapter: 'openai-compatible',
      options: { baseUrl: `${origin}/v1`, model: 'm' },
    });
    expect(() =>
      createAiProvider(config, {
        egress: createEgressClient(buildEgressAllowList(config)),
        env: {},
        paths: { rootDir: NO_FIXTURES_ROOT },
      }),
    ).toThrow(/providers\.ai\.options\.timeoutMs is required/);
  });
});
