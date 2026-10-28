/**
 * OpenAI-compatible adapter against a loopback test server only (provider-ports section 2; T10-F06, T10-F07,
 * T10-F10). No real provider is called: the egress allow-list holds only the loopback origin of the test server, and
 * the Vitest network guard fails any non-loopback connection.
 */
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { inspect } from 'node:util';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { ConfigError } from '../../platform/config/index.js';
import {
  DEFAULT_AI_MAX_RESPONSE_BYTES,
  EgressAllowList,
  type EgressClient,
  type EgressRequestInit,
  EgressError,
  createEgressClient,
} from '../../platform/net/index.js';

import {
  AI_SYSTEM_INSTRUCTION,
  AiProviderError,
  DATA_BLOCK_HEADER,
  type DraftRequest,
  type DraftResponse,
  createOpenAiCompatibleProvider,
} from './index.js';

interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

type Handler = (request: IncomingMessage, body: string, response: ServerResponse) => void;

function sampleRequest(): DraftRequest {
  return {
    language: 'es',
    brand: { name: 'Marca Sintética', handle: '@MarcaDemo' },
    limits: { headlineMaxChars: 80, descriptionMaxChars: 300, captionMaxChars: 600, maxHashtags: 3 },
    slides: [
      { slideKey: 'cover', slideType: 'cover', facts: [] },
      {
        slideKey: 'match:demo-1',
        slideType: 'match_result',
        facts: [
          { placeholder: '{{t:equipo-norte}}', kind: 'team', display: 'Equipo Norte' },
          { placeholder: '{{f:match-demo-1-score}}', kind: 'score', display: '2-1' },
        ],
      },
    ],
    captionFacts: [],
  };
}

const VALID_DRAFT: DraftResponse = {
  slides: [
    { slideKey: 'cover', headline: 'Resumen', description: 'Lo más destacado' },
    {
      slideKey: 'match:demo-1',
      headline: '{{t:equipo-norte}} brilla',
      description: 'Marcador {{f:match-demo-1-score}}',
    },
  ],
  caption: 'Resumen de la selección',
  hashtags: ['#futbol'],
};

function completion(content: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'chatcmpl-synthetic',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  });
}

const routes = new Map<string, Handler>([
  [
    '/v1/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(completion(JSON.stringify(VALID_DRAFT)));
    },
  ],
  [
    '/echo-auth/chat/completions',
    (request, body, response) => {
      // A provider error body that echoes the Authorization header and the request (T10-F10).
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          error: { message: `Incorrect API key provided: ${request.headers.authorization ?? ''}`, request: body },
        }),
      );
    },
  ],
  [
    '/echo-auth-200/chat/completions',
    (request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(completion(`not JSON ${request.headers.authorization ?? ''}`));
    },
  ],
  [
    '/rate-limited/chat/completions',
    (_request, _body, response) => {
      response.writeHead(429, { 'retry-after': '30' });
      response.end('{"error":"slow down"}');
    },
  ],
  [
    '/server-error/chat/completions',
    (_request, _body, response) => {
      response.writeHead(500);
      response.end('internal failure at /srv/provider/handler.js');
    },
  ],
  [
    '/redirect/chat/completions',
    (_request, _body, response) => {
      response.writeHead(302, { location: 'https://example.invalid/chat/completions' });
      response.end();
    },
  ],
  [
    '/slow/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{"choices":');
      // Never finishes within the adapter's deadline.
    },
  ],
  [
    '/oversize/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(completion('x'.repeat(DEFAULT_AI_MAX_RESPONSE_BYTES + 1024)));
    },
  ],
  [
    '/tool-call/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        completion(JSON.stringify(VALID_DRAFT), {
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'run', arguments: '{}' } }],
        }),
      );
    },
  ],
  [
    '/fenced/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(completion('```json\n' + JSON.stringify(VALID_DRAFT) + '\n```'));
    },
  ],
  [
    '/truncated/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(VALID_DRAFT) }, finish_reason: 'length' }] }),
      );
    },
  ],
  [
    '/unknown-slide/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      const draft = {
        ...VALID_DRAFT,
        slides: [...VALID_DRAFT.slides, { slideKey: 'x', headline: 'h', description: 'd' }],
      };
      response.end(completion(JSON.stringify(draft)));
    },
  ],
  [
    '/not-envelope/chat/completions',
    (_request, _body, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(VALID_DRAFT));
    },
  ],
]);

let server: Server;
let origin: string;
const recorded: Recorded[] = [];

beforeAll(async () => {
  const sockets = new Set<Socket>();
  server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.on('end', () => {
      recorded.push({ method: request.method ?? '', url: request.url ?? '', headers: request.headers, body });
      const handler = routes.get(request.url ?? '');
      if (handler === undefined) {
        response.writeHead(404);
        response.end();
        return;
      }
      handler(request, body, response);
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('close', () => sockets.forEach((socket) => socket.destroy()));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  recorded.length = 0;
  vi.restoreAllMocks();
});

function egress(): EgressClient {
  return createEgressClient(new EgressAllowList([origin]));
}

function provider(
  pathPrefix: string,
  env: Record<string, string | undefined> = {},
  extra: Record<string, unknown> = {},
) {
  return createOpenAiCompatibleProvider(
    { baseUrl: `${origin}${pathPrefix}`, model: 'synthetic-local-model', timeoutMs: 2000, ...extra },
    { egress: egress(), env },
  );
}

const signal = (): { signal: AbortSignal } => ({ signal: new AbortController().signal });

async function failure(promise: Promise<unknown>): Promise<AiProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('the draft succeeded');
}

/** Captures everything written to stdout, stderr and the console while `run` executes. */
async function captureOutput(run: () => Promise<unknown>): Promise<string> {
  const chunks: string[] = [];
  const record = (...args: unknown[]): void => {
    chunks.push(args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 10 }))).join(' '));
  };
  const write = (chunk: unknown): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8'));
    return true;
  };
  vi.spyOn(process.stdout, 'write').mockImplementation(write);
  vi.spyOn(process.stderr, 'write').mockImplementation(write);
  for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const) {
    vi.spyOn(console, method).mockImplementation(record);
  }
  try {
    await run();
  } catch (error) {
    // Uncaught output of the failure as a caller would log it.
    record(error);
  } finally {
    vi.restoreAllMocks();
  }
  return chunks.join('\n');
}

function expectNoSecret(error: AiProviderError, secret: string): void {
  for (const rendering of [
    error.message,
    String(error),
    JSON.stringify(error),
    JSON.stringify(error.toJSON()),
    inspect(error, { depth: 10, showHidden: true }),
    error.stack ?? '',
  ]) {
    expect(rendering).not.toContain(secret);
  }
  expect(error.cause).toBeUndefined();
}

describe('successful draft', () => {
  it('posts one chat-completions request with the fixed instruction, the data block and no tools', async () => {
    const response = await provider('/v1', { EDR_AI_API_KEY: TEST_DUMMY_API_KEY }, { temperature: 0.2 }).generateDraft(
      sampleRequest(),
      signal(),
    );
    expect(response).toEqual(VALID_DRAFT);

    expect(recorded).toHaveLength(1);
    const sent = recorded[0];
    expect(sent?.method).toBe('POST');
    expect(sent?.url).toBe('/v1/chat/completions');
    expect(sent?.headers.authorization).toBe(`Bearer ${TEST_DUMMY_API_KEY}`);
    expect(sent?.headers['content-type']).toBe('application/json');

    const body = JSON.parse(sent?.body ?? '') as Record<string, unknown> & {
      messages: { role: string; content: string }[];
      response_format: { type: string; json_schema: { strict: boolean } };
    };
    expect(body['model']).toBe('synthetic-local-model');
    expect(body['temperature']).toBe(0.2);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: 'system', content: AI_SYSTEM_INSTRUCTION });
    expect(body.messages[1]?.role).toBe('user');
    expect(body.messages[1]?.content.startsWith(`${DATA_BLOCK_HEADER}\n`)).toBe(true);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    for (const key of ['tools', 'tool_choice', 'functions', 'function_call', 'parallel_tool_calls']) {
      expect(Object.hasOwn(body, key)).toBe(false);
    }
    expect(sent?.body).not.toContain(TEST_DUMMY_API_KEY);
  });

  it('sends no Authorization header without a key, and omits an unset temperature', async () => {
    await provider('/v1', { EDR_AI_API_KEY: '' }).generateDraft(sampleRequest(), signal());
    await provider('/v1').generateDraft(sampleRequest(), signal());
    expect(recorded).toHaveLength(2);
    for (const sent of recorded) {
      expect(sent.headers.authorization).toBeUndefined();
      expect(Object.hasOwn(JSON.parse(sent.body) as object, 'temperature')).toBe(false);
    }
  });

  it('reads the key at call time from the injected environment', async () => {
    const env: Record<string, string | undefined> = {};
    const adapter = provider('/v1', env);
    await adapter.generateDraft(sampleRequest(), signal());
    env['EDR_AI_API_KEY'] = TEST_DUMMY_API_KEY;
    await adapter.generateDraft(sampleRequest(), signal());
    expect(recorded.map((sent) => sent.headers.authorization)).toEqual([undefined, `Bearer ${TEST_DUMMY_API_KEY}`]);
  });
});

describe('failures carry a closed code and the HTTP status only (T10-F10)', () => {
  it('a 401 whose body echoes the Authorization header leaks the key to neither the failure nor the log output', async () => {
    let error: AiProviderError | undefined;
    const output = await captureOutput(async () => {
      error = await failure(
        provider('/echo-auth', { EDR_AI_API_KEY: TEST_DUMMY_API_KEY }).generateDraft(sampleRequest(), signal()),
      );
      throw error;
    });
    expect(recorded[0]?.headers.authorization).toBe(`Bearer ${TEST_DUMMY_API_KEY}`);
    expect(error?.code).toBe('unavailable');
    expect(error?.httpStatus).toBe(401);
    expect(error?.toJSON()).toEqual({ code: 'unavailable', httpStatus: 401, path: null });
    expectNoSecret(error as AiProviderError, TEST_DUMMY_API_KEY);
    expectNoSecret(error as AiProviderError, 'Incorrect API key');
    expect(output).toContain('AI provider unavailable (HTTP 401)');
    expect(output).not.toContain(TEST_DUMMY_API_KEY);
    expect(output).not.toContain('Incorrect API key');
  });

  it('a 200 whose content echoes the key is invalid without keeping the key', async () => {
    const error = await failure(
      provider('/echo-auth-200', { EDR_AI_API_KEY: TEST_MARKER_TOKEN }).generateDraft(sampleRequest(), signal()),
    );
    expect(error.code).toBe('ai_response_invalid');
    expect(error.httpStatus).toBe(200);
    expectNoSecret(error, TEST_MARKER_TOKEN);
  });

  it.each([
    ['/rate-limited', 'rate_limited', 429],
    ['/server-error', 'unavailable', 500],
    ['/missing', 'unavailable', 404],
    ['/redirect', 'unavailable', null],
    ['/slow', 'timeout', null],
    ['/oversize', 'ai_response_invalid', null],
    ['/tool-call', 'ai_response_invalid', 200],
    ['/fenced', 'ai_response_invalid', 200],
    ['/truncated', 'ai_response_invalid', 200],
    ['/unknown-slide', 'ai_response_invalid', 200],
    ['/not-envelope', 'ai_response_invalid', 200],
  ])('%s fails with %s', async (pathPrefix, code, httpStatus) => {
    const error = await failure(
      provider(pathPrefix, { EDR_AI_API_KEY: TEST_DUMMY_API_KEY }, { timeoutMs: 300 }).generateDraft(
        sampleRequest(),
        signal(),
      ),
    );
    expect(error.code).toBe(code);
    expect(error.httpStatus).toBe(httpStatus);
    expectNoSecret(error, TEST_DUMMY_API_KEY);
    expectNoSecret(error, '/srv/provider');
    expectNoSecret(error, origin);
  });

  it('a connection failure is unavailable and names no URL', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const closedOrigin = `http://127.0.0.1:${String((closed.address() as AddressInfo).port)}`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    const adapter = createOpenAiCompatibleProvider(
      { baseUrl: closedOrigin, model: 'synthetic-local-model', timeoutMs: 1000 },
      { egress: createEgressClient(new EgressAllowList([closedOrigin])), env: {} },
    );
    const error = await failure(adapter.generateDraft(sampleRequest(), signal()));
    expect(error.code).toBe('unavailable');
    expectNoSecret(error, closedOrigin);
  });

  it('an origin outside the allow-list is refused before any connection', async () => {
    const adapter = createOpenAiCompatibleProvider(
      { baseUrl: `${origin}/v1`, model: 'synthetic-local-model', timeoutMs: 1000 },
      { egress: createEgressClient(new EgressAllowList([])), env: { EDR_AI_API_KEY: TEST_DUMMY_API_KEY } },
    );
    const error = await failure(adapter.generateDraft(sampleRequest(), signal()));
    expect(error.code).toBe('unavailable');
    expect(recorded).toHaveLength(0);
  });

  it('a key that cannot be sent in a header fails before sending, without echo', async () => {
    const error = await failure(
      provider('/v1', { EDR_AI_API_KEY: `${TEST_DUMMY_API_KEY}\r\nX-Injected: 1` }).generateDraft(
        sampleRequest(),
        signal(),
      ),
    );
    expect(error.code).toBe('unavailable');
    expectNoSecret(error, TEST_DUMMY_API_KEY);
    expect(recorded).toHaveLength(0);
  });
});

describe('strict request schema before sending (T11H-F16, V-13a)', () => {
  it.each(['sourceRef', 'fileName', 'declaredSource', 'ref'])(
    'refuses a request carrying %s and sends nothing',
    async (field) => {
      const request = sampleRequest() as unknown as Record<string, unknown>;
      request[field] = 'marker-value';
      const error = await failure(provider('/v1').generateDraft(request as unknown as DraftRequest, signal()));
      expect(error.code).toBe('invalid');
      expect(error.message).not.toContain('marker-value');
      expect(recorded).toHaveLength(0);
    },
  );
});

describe('egress parameters (T10-F07)', () => {
  function recordingEgress(calls: { url: string; init: EgressRequestInit }[], failWith?: EgressError): EgressClient {
    return {
      request: (url, init) => {
        calls.push({ url, init });
        if (failWith !== undefined) {
          return Promise.reject(failWith);
        }
        return Promise.resolve({ status: 200, headers: new Headers(), text: completion(JSON.stringify(VALID_DRAFT)) });
      },
    };
  }

  it('uses the 256 KiB default cap, the configured deadline and the caller signal', async () => {
    const calls: { url: string; init: EgressRequestInit }[] = [];
    const adapter = createOpenAiCompatibleProvider(
      { baseUrl: 'https://ai.example.invalid/api/v1/', model: 'm', timeoutMs: 45_000 },
      { egress: recordingEgress(calls), env: {} },
    );
    const controller = new AbortController();
    await adapter.generateDraft(sampleRequest(), { signal: controller.signal });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://ai.example.invalid/api/v1/chat/completions');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.maxResponseBytes).toBe(DEFAULT_AI_MAX_RESPONSE_BYTES);
    expect(DEFAULT_AI_MAX_RESPONSE_BYTES).toBe(256 * 1024);
    expect(calls[0]?.init.timeoutMs).toBe(45_000);
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });

  it('uses a configured cap', async () => {
    const calls: { url: string; init: EgressRequestInit }[] = [];
    await createOpenAiCompatibleProvider(
      { baseUrl: 'https://ai.example.invalid', model: 'm', timeoutMs: 1000, maxResponseBytes: 65_536 },
      { egress: recordingEgress(calls), env: {} },
    ).generateDraft(sampleRequest(), signal());
    expect(calls[0]?.init.maxResponseBytes).toBe(65_536);
    expect(calls[0]?.url).toBe('https://ai.example.invalid/chat/completions');
  });

  it.each([
    ['timeout', 'timeout'],
    ['aborted', 'unavailable'],
    ['too_large', 'ai_response_invalid'],
    ['redirect', 'unavailable'],
    ['denied', 'unavailable'],
    ['network', 'unavailable'],
    ['invalid_request', 'unavailable'],
  ] as const)('maps the egress failure %s to %s', async (kind, code) => {
    const adapter = createOpenAiCompatibleProvider(
      { baseUrl: 'https://ai.example.invalid', model: 'm', timeoutMs: 1000 },
      { egress: recordingEgress([], new EgressError(kind, `egress failure with ${TEST_DUMMY_API_KEY}`)), env: {} },
    );
    const error = await failure(adapter.generateDraft(sampleRequest(), signal()));
    expect(error.code).toBe(code);
    expectNoSecret(error, TEST_DUMMY_API_KEY);
  });
});

describe('options (startup validation)', () => {
  const base = { baseUrl: 'https://ai.example.invalid/v1', model: 'm', timeoutMs: 1000 };

  function configError(options: unknown): ConfigError {
    try {
      createOpenAiCompatibleProvider(options, { egress: createEgressClient(new EgressAllowList([])), env: {} });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      return error as ConfigError;
    }
    throw new Error('the options were accepted');
  }

  it.each([
    ['baseUrl', { ...base, baseUrl: `https://user:${TEST_DUMMY_API_KEY}@ai.example.invalid/v1` }],
    ['baseUrl', { ...base, baseUrl: 'http://ai.example.invalid/v1' }],
    ['baseUrl', { ...base, baseUrl: `https://ai.example.invalid/v1?key=${TEST_DUMMY_API_KEY}` }],
    ['baseUrl', { ...base, baseUrl: 'ftp://127.0.0.1/v1' }],
    ['model', { ...base, model: '' }],
    ['model', { ...base, model: 'model\nname' }],
    ['temperature', { ...base, temperature: 3 }],
    ['timeoutMs', { ...base, timeoutMs: 0 }],
    ['timeoutMs', { ...base, timeoutMs: 120_001 }],
    ['maxResponseBytes', { ...base, maxResponseBytes: 2 * 1024 * 1024 + 1 }],
  ])('refuses an invalid %s naming the setting and not the value', (field, options) => {
    const error = configError(options);
    expect(error.setting).toBe(`providers.ai.options.${field}`);
    expect(error.message).not.toContain(TEST_DUMMY_API_KEY);
    expect(error.message).not.toContain('ai.example.invalid');
  });

  it('requires baseUrl, model and timeoutMs', () => {
    const error = configError({});
    expect(error.issues.map((issue) => issue.setting).sort()).toEqual([
      'providers.ai.options.baseUrl',
      'providers.ai.options.model',
      'providers.ai.options.timeoutMs',
    ]);
    expect(error.issues.every((issue) => issue.problem === 'is required')).toBe(true);
  });

  it('refuses unknown options such as tools', () => {
    expect(configError({ ...base, tools: [] }).setting).toBe('providers.ai.options');
  });

  it('accepts https and loopback http base URLs', () => {
    for (const baseUrl of [
      'https://ai.example.invalid',
      'http://127.0.0.1:11434/v1',
      'http://localhost:8080',
      'http://[::1]:8080/v1',
    ]) {
      expect(() =>
        createOpenAiCompatibleProvider(
          { ...base, baseUrl },
          { egress: createEgressClient(new EgressAllowList([])), env: {} },
        ),
      ).not.toThrow();
    }
  });
});
