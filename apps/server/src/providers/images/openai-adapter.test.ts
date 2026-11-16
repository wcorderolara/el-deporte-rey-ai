/**
 * The OpenAI image adapter over a recorded egress client (PD-ARCH-01G-B): request bodies and endpoints, the key read
 * at call time and sent only as `Authorization`, the concurrency limit, the closed failure mapping without provider
 * text, the strict response parsing and the option validation. No connection is opened.
 */
import { describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import { ConfigError } from '../../platform/config/index.js';
import {
  EgressError,
  type EgressClient,
  type EgressRequestInit,
  IMAGE_EGRESS_LIMITS,
} from '../../platform/net/index.js';
import { png } from '../../modules/brand/test/images.js';

import {
  ImageProviderError,
  createDisabledImageProvider,
  createOpenAiImageProvider,
  parseImageResponse,
  parseOpenAiImageOptions,
  statusFailure,
} from './index.js';

const OPTIONS = {
  baseUrl: 'https://images.example.test/v1/',
  defaultModel: 'model-a',
  models: [{ id: 'model-a', label: 'Modelo A', flexibleSizes: true, qualities: ['low', 'high'] }],
};

interface Call {
  readonly url: string;
  readonly init: EgressRequestInit;
}

function egress(answer: (call: Call) => Promise<{ status: number; text: string; headers?: Headers }>) {
  const calls: Call[] = [];
  const client: EgressClient = {
    request: async (url, init) => {
      const call = { url, init };
      calls.push(call);
      const result = await answer(call);
      return { status: result.status, text: result.text, headers: result.headers ?? new Headers() };
    },
  };
  return { client, calls };
}

const IMAGE = png({ width: 16, height: 16 });
const OK = { status: 200, text: JSON.stringify({ data: [{ b64_json: IMAGE.toString('base64') }] }) };

function request(images: { mime: 'image/png'; content: Buffer }[] = []) {
  return {
    model: 'model-a',
    prompt: 'Design',
    size: '1024x1280',
    quality: 'low',
    images,
    signal: new AbortController().signal,
  };
}

describe('openai image adapter: requests', () => {
  it('posts one image to /images/generations with the key only in Authorization', async () => {
    const { client, calls } = egress(async () => OK);
    const provider = createOpenAiImageProvider(OPTIONS, {
      egress: client,
      env: { EDR_IMAGE_API_KEY: TEST_DUMMY_API_KEY },
    });
    const generated = await provider.generate(request());
    expect(generated.content.equals(IMAGE)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://images.example.test/v1/images/generations');
    expect(calls[0]?.init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${TEST_DUMMY_API_KEY}`,
    });
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      model: 'model-a',
      prompt: 'Design',
      n: 1,
      size: '1024x1280',
      quality: 'low',
      output_format: 'png',
    });
    expect(calls[0]?.init.body).not.toContain(TEST_DUMMY_API_KEY);
    expect(calls[0]?.init.maxResponseBytes).toBe(IMAGE_EGRESS_LIMITS.maxResponseBytes);
  });

  it('posts input images in order as data URLs to /images/edits', async () => {
    const { client, calls } = egress(async () => OK);
    const provider = createOpenAiImageProvider(OPTIONS, { egress: client, env: { EDR_IMAGE_API_KEY: 'k' } });
    const first = png({ width: 4, height: 4, note: 'a' });
    const second = png({ width: 4, height: 4, note: 'b' });
    await provider.generate(
      request([
        { mime: 'image/png', content: first },
        { mime: 'image/png', content: second },
      ]),
    );
    expect(calls[0]?.url).toBe('https://images.example.test/v1/images/edits');
    expect(JSON.parse(calls[0]?.init.body ?? '').images).toEqual([
      { image_url: `data:image/png;base64,${first.toString('base64')}` },
      { image_url: `data:image/png;base64,${second.toString('base64')}` },
    ]);
  });

  it('sends nothing without a key or for an unconfigured model', async () => {
    const { client, calls } = egress(async () => OK);
    const provider = createOpenAiImageProvider(OPTIONS, { egress: client, env: {} });
    expect(provider.capabilities().status).toBe('missing_api_key');
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'missing_api_key' });
    const keyed = createOpenAiImageProvider(OPTIONS, { egress: client, env: { EDR_IMAGE_API_KEY: 'k' } });
    await expect(keyed.generate({ ...request(), model: 'other' })).rejects.toMatchObject({ code: 'model_unavailable' });
    expect(calls).toHaveLength(0);
  });

  it('refuses a second request in flight beyond the concurrency limit', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { client, calls } = egress(async () => {
      await gate;
      return OK;
    });
    const provider = createOpenAiImageProvider(OPTIONS, { egress: client, env: { EDR_IMAGE_API_KEY: 'k' } });
    const first = provider.generate(request());
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'busy' });
    release();
    await first;
    expect(calls).toHaveLength(1);
  });

  it('checks model access with GET /models/{id}', async () => {
    const answers = [200, 404, 401];
    const { client, calls } = egress(async () => ({ status: answers.shift() ?? 500, text: '{}' }));
    const provider = createOpenAiImageProvider(OPTIONS, { egress: client, env: { EDR_IMAGE_API_KEY: 'k' } });
    const signal = new AbortController().signal;
    expect(await provider.checkModelAccess('model-a', signal)).toBe('available');
    expect(await provider.checkModelAccess('model-a', signal)).toBe('unavailable');
    expect(await provider.checkModelAccess('model-a', signal)).toBe('not_authorized');
    expect(calls.map((call) => [call.init.method, call.url])).toEqual(
      Array(3).fill(['GET', 'https://images.example.test/v1/models/model-a']),
    );
  });

  it('maps egress failures to closed codes', async () => {
    for (const [kind, code] of [
      ['timeout', 'timeout'],
      ['too_large', 'response_invalid'],
      ['network', 'unavailable'],
      ['denied', 'unavailable'],
      ['aborted', 'aborted'],
    ] as const) {
      const { client } = egress(async () => {
        throw new EgressError(kind, 'egress failure');
      });
      const provider = createOpenAiImageProvider(OPTIONS, { egress: client, env: { EDR_IMAGE_API_KEY: 'k' } });
      await expect(provider.generate(request())).rejects.toMatchObject({ code });
    }
  });
});

describe('openai image adapter: responses and failures', () => {
  it('maps statuses and closed error markers; never keeps the provider message', () => {
    const body = (error: Record<string, unknown>) =>
      JSON.stringify({ error: { message: 'sk-secret detail', ...error } });
    const cases: [number, string, Record<string, string>, string][] = [
      [401, body({}), {}, 'not_authorized'],
      [403, body({}), {}, 'not_authorized'],
      [404, body({}), {}, 'model_unavailable'],
      [400, body({ code: 'model_not_found' }), {}, 'model_unavailable'],
      [429, body({ type: 'insufficient_quota' }), {}, 'quota_exceeded'],
      [429, body({ code: 'project_spend_limit_exceeded' }), {}, 'quota_exceeded'],
      [429, body({}), { 'retry-after': '7' }, 'rate_limited'],
      [400, body({ code: 'moderation_blocked' }), {}, 'rejected'],
      [400, body({ code: 'other' }), {}, 'invalid_request'],
      [500, 'not json', {}, 'unavailable'],
    ];
    for (const [status, text, headers, code] of cases) {
      const failure = statusFailure(status, new Headers(headers), text);
      expect(failure.code, `${String(status)} ${text}`).toBe(code);
      expect(failure.message).not.toContain('sk-secret');
      expect(JSON.stringify(failure)).not.toContain('sk-secret');
    }
    expect(statusFailure(429, new Headers({ 'retry-after': '7' }), '{}').retryAfterSeconds).toBe(7);
    expect(statusFailure(429, new Headers({ 'retry-after': '99999' }), '{}').retryAfterSeconds).toBe(3600);
  });

  it('parses the image and the token usage strictly', () => {
    const parsed = parseImageResponse(
      JSON.stringify({
        data: [{ b64_json: IMAGE.toString('base64') }],
        usage: {
          input_tokens: 50,
          output_tokens: 1000,
          total_tokens: 1050,
          input_tokens_details: { text_tokens: 40, image_tokens: 10 },
        },
      }),
      200,
    );
    expect(parsed.usage).toEqual({
      inputTextTokens: 40,
      inputImageTokens: 10,
      outputImageTokens: 1000,
      outputTextTokens: null,
      totalTokens: 1050,
    });
    for (const text of [
      '',
      'null',
      '{"data":[]}',
      '{"data":[{"url":"https://x"}]}',
      '{"data":[{"b64_json":"@@@@"}]}',
    ]) {
      expect(() => parseImageResponse(text, 200)).toThrow(ImageProviderError);
    }
  });
});

describe('image adapter options and the disabled adapter', () => {
  it('applies the defaults and refuses bad options without echoing values', () => {
    const options = parseOpenAiImageOptions(OPTIONS);
    expect(options).toMatchObject({
      outputFormat: 'png',
      timeoutMs: 240_000,
      limits: {
        maxImagesPerRequest: 4,
        maxReferences: 4,
        maxImagesPerDay: 20,
        monthlySpendLimit: null,
        spendReservePerImage: null,
        maxConcurrentRequests: 1,
      },
    });
    expect(options.models[0]).toMatchObject({ pricing: null, publishedImageCosts: null });
    const bad = [
      { ...OPTIONS, baseUrl: 'http://images.example.test/v1' },
      { ...OPTIONS, defaultModel: 'missing' },
      { ...OPTIONS, models: [] },
      { ...OPTIONS, apiKey: 'edr-test-key-never-echoed' },
      { ...OPTIONS, timeoutMs: 999_999 },
      { ...OPTIONS, limits: { maxImagesPerRequest: 50 } },
    ];
    for (const value of bad) {
      expect(() => parseOpenAiImageOptions(value)).toThrow(ConfigError);
      try {
        parseOpenAiImageOptions(value);
      } catch (error) {
        expect(String(error)).not.toContain('edr-test-key-never-echoed');
        expect(String(error)).toContain('providers.images.options');
      }
    }
  });

  it('never sends anything when disabled', async () => {
    const provider = createDisabledImageProvider();
    expect(provider.capabilities()).toMatchObject({ adapter: 'disabled', status: 'disabled', models: [] });
    await expect(provider.generate(request())).rejects.toMatchObject({ code: 'not_configured' });
  });
});
