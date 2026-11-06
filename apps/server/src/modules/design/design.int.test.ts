/**
 * Integration tests of the AI design proposals (PD-ARCH-01G-B) on a temporary app whose image provider is the
 * `openai` adapter over a scripted egress client: no connection is opened, no real request reaches OpenAI and no
 * credit is used. Covered: capabilities and the key on the server only, the usage policies of the selected brand
 * assets, the prompt, sizes and estimate, confirmation and idempotency, limits and concurrency, the recorded statuses,
 * the stored proposals and their files, the provider failures, variants, review decisions, recovery after a restart,
 * and that nothing else changes (brand assets, templates).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BrandAssetSchema,
  DesignCapabilitiesSchema,
  DesignEstimateSchema,
  DesignGenerationSchema,
  DesignGenerationStartSchema,
  DesignProposalDetailSchema,
  DesignProposalListSchema,
  DesignProposalSchema,
  type BrandAsset,
  type DesignGeneration,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import { EgressError } from '../../platform/net/index.js';
import {
  type Json,
  type ScriptedImageEgress,
  type TestApp,
  TEST_IMAGE_BASE_URL,
  scriptedImageEgress,
  startTestApp,
  testImageProviderConfig,
} from '../../../test/support/index.js';
import { png } from '../brand/test/images.js';

import { designServiceOf } from './index.js';

const apps: TestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

interface DesignApp {
  readonly app: TestApp;
  readonly egress: ScriptedImageEgress;
}

async function start(
  options: {
    key?: boolean;
    images?: Record<string, unknown> | null;
    dataDir?: string;
    egress?: ScriptedImageEgress;
  } = {},
): Promise<DesignApp> {
  const egress = options.egress ?? scriptedImageEgress();
  const app = await startTestApp({
    mutate: (document: Json) => {
      const providers = document['providers'] as Json;
      if (options.images !== null) {
        providers['images'] = (options.images ?? testImageProviderConfig()) as Json;
      }
    },
    imageEgress: egress,
    ...(options.key === false ? {} : { env: { EDR_IMAGE_API_KEY: TEST_DUMMY_API_KEY } }),
    ...(options.dataDir === undefined ? {} : { dataDir: options.dataDir }),
  });
  apps.push(app);
  return { app, egress };
}

let pixel = 0;

async function asset(app: TestApp, query: Record<string, string>, mime = 'image/png'): Promise<BrandAsset> {
  pixel += 1;
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/brand/assets',
    query,
    headers: { host: app.host, origin: app.origin, 'x-edr-client': 'web', 'content-type': mime },
    payload: png({ width: 64, height: 64, rgba: [pixel % 255, 80, 120, 255] }),
  });
  expect(response.statusCode, response.body).toBe(201);
  return BrandAssetSchema.parse(response.json());
}

const BASE_REQUEST = { contentType: 'match_preview', format: '4:5', quality: 'low', count: 1, references: [] };

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...BASE_REQUEST, ...overrides };
}

let key = 0;
function requestKey(): string {
  key += 1;
  return `00000000-0000-4000-8000-${String(900_000 + key).padStart(12, '0')}`;
}

async function generate(app: TestApp, body: Record<string, unknown>): Promise<DesignGeneration> {
  const response = await app.send('POST', '/design/generations', {
    requestKey: requestKey(),
    confirmCost: true,
    ...body,
  });
  expect(response.statusCode, response.body).toBe(202);
  const started = DesignGenerationStartSchema.parse(response.json());
  await designServiceOf(app.container).settled(started.generation.id);
  return generation(app, started.generation.id);
}

async function generation(app: TestApp, id: string): Promise<DesignGeneration> {
  const response = await app.get(`/design/generations/${id}`);
  expect(response.statusCode, response.body).toBe(200);
  return DesignGenerationSchema.parse(response.json());
}

function imageRequests(egress: ScriptedImageEgress) {
  return egress.requests.filter((entry) => entry.url.includes('/images/'));
}

function proposalFiles(app: TestApp): string[] {
  try {
    return readdirSync(join(app.container.paths.dataDir, 'design-proposals')).sort();
  } catch {
    return [];
  }
}

describe('design capabilities and configuration', () => {
  it('reports a disabled provider and refuses every generation without sending anything', async () => {
    const { app, egress } = await start({ images: null });
    const capabilities = DesignCapabilitiesSchema.parse((await app.get('/design/capabilities')).json());
    expect(capabilities).toMatchObject({ adapter: 'disabled', status: 'disabled', models: [] });

    const estimate = await app.send('POST', '/design/estimates', request());
    expect(estimate.statusCode).toBe(503);
    expect(estimate.json()).toMatchObject({ code: 'IMAGE_PROVIDER_UNAVAILABLE' });
    expect(egress.requests).toHaveLength(0);
  });

  it('reports a missing key, estimates without it, and refuses to generate', async () => {
    const { app, egress } = await start({ key: false });
    const capabilities = DesignCapabilitiesSchema.parse((await app.get('/design/capabilities')).json());
    expect(capabilities.status).toBe('missing_api_key');
    expect(JSON.stringify(capabilities)).not.toContain(TEST_DUMMY_API_KEY);

    expect((await app.send('POST', '/design/estimates', request())).statusCode).toBe(200);
    const created = await app.send('POST', '/design/generations', {
      ...request(),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(created.statusCode).toBe(503);
    expect(created.json()).toMatchObject({ code: 'IMAGE_PROVIDER_UNAVAILABLE' });
    expect(egress.requests).toHaveLength(0);
  });

  it('lists the configured models, limits, policy roles and the prompt version; the key never leaves the server', async () => {
    const { app } = await start();
    const response = await app.get('/design/capabilities');
    const capabilities = DesignCapabilitiesSchema.parse(response.json());
    expect(capabilities.status).toBe('ready');
    expect(capabilities.defaultModel).toBe('test-image-flex');
    expect(capabilities.models.map((model) => [model.id, model.estimable])).toEqual([
      ['test-image-flex', true],
      ['test-image-standard', false],
    ]);
    expect(capabilities.policyRoles).toContainEqual({ policy: 'protected', roles: ['reserved_placement'] });
    expect(capabilities.limits).toMatchObject({ maxImagesPerRequest: 4, imagesUsedToday: 0, maxImagesPerDay: 20 });
    expect(response.body).not.toContain(TEST_DUMMY_API_KEY);
    expect(response.body).not.toContain(TEST_IMAGE_BASE_URL);
  });

  it('checks model access with the free metadata request only', async () => {
    const { app, egress } = await start();
    const response = await app.send('POST', '/design/capabilities/check', { model: 'test-image-flex' });
    expect(response.json()).toEqual({ model: 'test-image-flex', access: 'available', errorCode: null });
    expect(egress.requests.map((entry) => [entry.method, entry.url])).toEqual([
      ['GET', `${TEST_IMAGE_BASE_URL}/models/test-image-flex`],
    ]);
    expect(egress.requests[0]?.headers['Authorization']).toBe(`Bearer ${TEST_DUMMY_API_KEY}`);
  });
});

describe('design estimates: policies, prompt and sizes', () => {
  it('builds the scope: exact 4:5 size, the prompt without sports data, and an estimate from published costs', async () => {
    const { app } = await start();
    const estimate = DesignEstimateSchema.parse(
      (
        await app.send(
          'POST',
          '/design/estimates',
          request({ count: 2, instructions: 'Estadio nocturno, luces frías.' }),
        )
      ).json(),
    );
    expect(estimate).toMatchObject({
      model: 'test-image-flex',
      requestSize: '1024x1280',
      outputWidth: 1024,
      outputHeight: 1280,
      adaptation: 'none',
      cost: { status: 'estimated', perImage: 0.02, total: 0.04, basis: 'published_output_cost' },
    });
    expect(estimate.prompt).toContain('No text of any kind');
    expect(estimate.prompt).toContain('<<<\nEstadio nocturno, luces frías.\n>>>');
    expect(estimate.prompt).toContain('El Deporte Rey');
  });

  it('uses a standard size with a centred crop for a model without flexible sizes; no estimate without published costs', async () => {
    const { app } = await start();
    const estimate = DesignEstimateSchema.parse(
      (await app.send('POST', '/design/estimates', request({ model: 'test-image-standard', format: '9:16' }))).json(),
    );
    expect(estimate).toMatchObject({
      requestSize: '1024x1536',
      outputWidth: 864,
      outputHeight: 1536,
      adaptation: 'center_crop',
      cost: { status: 'unavailable', total: null },
    });
  });

  it('applies the usage policies: protected only reserves a zone; reference_only only informs the style', async () => {
    const { app } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo oficial' });
    const reference = await asset(app, { kind: 'style_reference', label: 'Póster de estilo' });
    expect([logo.usagePolicy, reference.usagePolicy]).toEqual(['protected', 'reference_only']);

    const refused = await app.send(
      'POST',
      '/design/estimates',
      request({ references: [{ assetId: logo.id, role: 'style_reference' }] }),
    );
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'DESIGN_REFERENCE_REFUSED' });
    expect(refused.json().detail).toContain('Protegido');

    for (const role of ['transform_base', 'reserved_placement']) {
      const response = await app.send(
        'POST',
        '/design/estimates',
        request({ references: [{ assetId: reference.id, role }] }),
      );
      expect(response.statusCode, role).toBe(409);
    }

    const accepted = DesignEstimateSchema.parse(
      (
        await app.send(
          'POST',
          '/design/estimates',
          request({
            references: [
              { assetId: logo.id, role: 'reserved_placement' },
              { assetId: reference.id, role: 'style_reference' },
            ],
          }),
        )
      ).json(),
    );
    expect(accepted.references.map((entry) => [entry.label, entry.role, entry.sent])).toEqual([
      ['Logo oficial', 'reserved_placement', false],
      ['Póster de estilo', 'style_reference', true],
    ]);
    expect(accepted.prompt).toContain('official logo "Logo oficial"');
    expect(accepted.prompt).toContain('Image 1 ("Póster de estilo") is a style reference only');
  });

  it('allows a transformable asset as the base and refuses two bases, inactive, deleted or repeated assets', async () => {
    const { app } = await start();
    const background = await asset(app, { kind: 'background', label: 'Fondo A', usagePolicy: 'transformable' });
    const second = await asset(app, { kind: 'background', label: 'Fondo B', usagePolicy: 'transformable' });
    const reusable = await asset(app, { kind: 'decoration', label: 'Textura' });
    expect(reusable.usagePolicy).toBe('reusable');

    const estimate = DesignEstimateSchema.parse(
      (
        await app.send(
          'POST',
          '/design/estimates',
          request({ references: [{ assetId: background.id, role: 'transform_base' }] }),
        )
      ).json(),
    );
    expect(estimate.prompt).toContain('Image 1 is the authorized brand graphic "Fondo A"');

    const twoBases = await app.send(
      'POST',
      '/design/estimates',
      request({
        references: [
          { assetId: background.id, role: 'transform_base' },
          { assetId: second.id, role: 'transform_base' },
        ],
      }),
    );
    expect(twoBases.statusCode).toBe(400);
    const reusableBase = await app.send(
      'POST',
      '/design/estimates',
      request({ references: [{ assetId: reusable.id, role: 'transform_base' }] }),
    );
    expect(reusableBase.statusCode).toBe(409);
    const repeated = await app.send(
      'POST',
      '/design/estimates',
      request({
        references: [
          { assetId: reusable.id, role: 'style_reference' },
          { assetId: reusable.id, role: 'reserved_placement' },
        ],
      }),
    );
    expect(repeated.statusCode).toBe(400);

    await app.send('PATCH', `/brand/assets/${second.id}`, { active: false });
    const inactive = await app.send(
      'POST',
      '/design/estimates',
      request({ references: [{ assetId: second.id, role: 'style_reference' }] }),
    );
    expect(inactive.statusCode).toBe(409);
    expect(inactive.json().detail).toContain('desactivado');

    const gone = await app.send(
      'POST',
      '/design/estimates',
      request({ references: [{ assetId: '00000000-0000-4000-8000-000000000999', role: 'style_reference' }] }),
    );
    expect(gone.statusCode).toBe(409);
  });

  it('refuses an unknown model, an unsupported quality, too many images and malformed bodies', async () => {
    const { app } = await start();
    expect((await app.send('POST', '/design/estimates', request({ model: 'other-model' }))).statusCode).toBe(400);
    expect((await app.send('POST', '/design/estimates', request({ quality: 'ultra' }))).statusCode).toBe(400);
    expect((await app.send('POST', '/design/estimates', request({ count: 5 }))).statusCode).toBe(400);
    expect((await app.send('POST', '/design/estimates', request({ format: '3:4' }))).statusCode).toBe(400);
    expect((await app.send('POST', '/design/estimates', request({ instructions: 'a\u0000b' }))).statusCode).toBe(400);
    expect((await app.send('POST', '/design/estimates', request({ extra: true }))).statusCode).toBe(400);
  });
});

describe('design generations', () => {
  it('needs an explicit cost confirmation and sends nothing without it', async () => {
    const { app, egress } = await start();
    for (const confirmCost of [undefined, false]) {
      const response = await app.send('POST', '/design/generations', {
        ...request(),
        requestKey: requestKey(),
        ...(confirmCost === undefined ? {} : { confirmCost }),
      });
      expect(response.statusCode).toBe(400);
    }
    expect(egress.requests).toHaveLength(0);
  });

  it('generates, records the statuses, stores each proposal file and its usage and cost', async () => {
    const { app, egress } = await start();
    const done = await generate(app, request({ count: 2 }));
    expect(done).toMatchObject({ status: 'completed', completedCount: 2, requestedCount: 2, errorCode: null });
    expect(done.proposalIds).toHaveLength(2);
    // 2 x (120 text input tokens x $5/M + 1600 output tokens x $30/M)
    expect(done.cost).toBeCloseTo((2 * (120 * 5 + 1600 * 30)) / 1_000_000, 6);

    const sent = imageRequests(egress);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ method: 'POST', url: `${TEST_IMAGE_BASE_URL}/images/generations` });
    expect(sent[0]?.body).toMatchObject({
      model: 'test-image-flex',
      n: 1,
      size: '1024x1280',
      quality: 'low',
      output_format: 'png',
    });
    expect(sent[0]?.body).not.toHaveProperty('images');

    const events = designServiceOf(app.container).eventsSince(done.id, 0);
    expect(events.map((event) => event.status)).toEqual([
      'queued',
      'preparing_references',
      'sending_request',
      'generating',
      'saving',
      'saving',
      'sending_request',
      'generating',
      'saving',
      'saving',
      'completed',
    ]);
    expect(events.filter((event) => event.type === 'proposal.saved').map((event) => event.proposalId)).toEqual(
      done.proposalIds,
    );

    expect(proposalFiles(app)).toEqual(done.proposalIds.map((id) => `${id}.png`).sort());
    const file = await app.get(`/design/proposals/${done.proposalIds[0] ?? ''}/file`);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-security-policy']).toContain('sandbox');
    expect(file.rawPayload.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const list = DesignProposalListSchema.parse((await app.get('/design/proposals')).json());
    expect(list.proposals.map((proposal) => [proposal.status, proposal.width, proposal.height])).toEqual([
      ['pending_review', 1024, 1280],
      ['pending_review', 1024, 1280],
    ]);
    expect(list.proposals[0]?.name).toBe('Previa individual · 4:5 · 1/2');

    // The image is stored as a file, never in SQLite.
    expect(app.databaseText()).not.toContain(
      png({ width: 1024, height: 1280, rgba: [46, 17, 69, 255] })
        .toString('base64')
        .slice(0, 200),
    );
  });

  it('sends the selected references in order as base64 data URLs to the edits endpoint, never protected assets', async () => {
    const { app, egress } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo' });
    const base = await asset(app, { kind: 'background', label: 'Fondo', usagePolicy: 'transformable' });
    const reference = await asset(app, { kind: 'style_reference', label: 'Estilo' });
    await generate(
      app,
      request({
        references: [
          { assetId: reference.id, role: 'style_reference' },
          { assetId: logo.id, role: 'reserved_placement' },
          { assetId: base.id, role: 'transform_base' },
        ],
      }),
    );
    const sent = imageRequests(egress);
    expect(sent[0]?.url).toBe(`${TEST_IMAGE_BASE_URL}/images/edits`);
    const images = sent[0]?.body?.['images'] as { image_url: string }[];
    expect(images).toHaveLength(2);
    const files = await Promise.all(
      [base.id, reference.id].map(async (id) =>
        (await app.get(`/brand/assets/${id}/file`)).rawPayload.toString('base64'),
      ),
    );
    expect(images.map((image) => image.image_url)).toEqual(files.map((file) => `data:image/png;base64,${file}`));
    const logoFile = (await app.get(`/brand/assets/${logo.id}/file`)).rawPayload.toString('base64');
    expect(JSON.stringify(sent[0]?.body)).not.toContain(logoFile);
  });

  it('adapts a standard-size image by a centred crop to the target ratio', async () => {
    const { app } = await start();
    const done = await generate(app, request({ model: 'test-image-standard', format: '9:16' }));
    const detail = DesignProposalDetailSchema.parse(
      (await app.get(`/design/proposals/${done.proposalIds[0] ?? ''}`)).json(),
    );
    expect(detail.proposal).toMatchObject({ width: 864, height: 1536, mime: 'image/png' });
    expect(detail.generation).toMatchObject({ requestSize: '1024x1536', adaptation: 'center_crop' });
    expect(detail.cost).toBeNull();
  });

  it('returns the same generation for a repeated request key and refuses the key for another request', async () => {
    const { app, egress } = await start();
    const body = { ...request(), requestKey: requestKey(), confirmCost: true };
    const first = await app.send('POST', '/design/generations', body);
    const again = await app.send('POST', '/design/generations', body);
    expect(again.statusCode).toBe(202);
    expect(DesignGenerationStartSchema.parse(again.json()).generation.id).toBe(
      DesignGenerationStartSchema.parse(first.json()).generation.id,
    );
    const other = await app.send('POST', '/design/generations', { ...body, count: 2 });
    expect(other.statusCode).toBe(409);
    expect(other.json()).toMatchObject({ code: 'REQUEST_KEY_REUSED' });
    await designServiceOf(app.container).settled(DesignGenerationStartSchema.parse(first.json()).generation.id);
    expect(imageRequests(egress)).toHaveLength(1);
  });

  it('allows one generation at a time and enforces the daily image limit', async () => {
    const { app, egress } = await start({
      images: testImageProviderConfig({
        limits: { maxImagesPerRequest: 4, maxImagesPerDay: 3, maxConcurrentRequests: 1 },
      }),
    });
    egress.hold();
    const first = await app.send('POST', '/design/generations', {
      ...request(),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(first.statusCode).toBe(202);
    const busy = await app.send('POST', '/design/generations', {
      ...request(),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(busy.statusCode).toBe(429);
    expect(busy.json()).toMatchObject({ code: 'GENERATION_LIMIT_REACHED' });
    egress.release();
    await designServiceOf(app.container).settled(DesignGenerationStartSchema.parse(first.json()).generation.id);

    const over = await app.send('POST', '/design/generations', {
      ...request({ count: 3 }),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(over.statusCode).toBe(429);
    expect(over.json().detail).toContain('límite diario');
  });

  it('counts against the daily limit the requests of a failed generation that reached the provider', async () => {
    const { app, egress } = await start({
      images: testImageProviderConfig({
        limits: { maxImagesPerRequest: 4, maxImagesPerDay: 3, maxConcurrentRequests: 1 },
      }),
    });
    egress.answer({ error: new EgressError('timeout', 'egress deadline exceeded') });
    const done = await generate(app, request({ count: 2 }));
    expect(done).toMatchObject({ status: 'failed', completedCount: 0 });
    expect(imageRequests(egress)).toHaveLength(1);
    const capabilities = DesignCapabilitiesSchema.parse((await app.get('/design/capabilities')).json());
    expect(capabilities.limits.imagesUsedToday).toBe(1);
    const over = await app.send('POST', '/design/generations', {
      ...request({ count: 3 }),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(over.statusCode).toBe(429);
    expect(over.json().detail).toContain('llevas 1 hoy');
  });

  it('checks the monthly limit against the configured reserve when the cost cannot be estimated', async () => {
    const { app, egress } = await start({
      images: testImageProviderConfig({
        limits: { monthlySpendLimit: 0.5, spendReservePerImage: { high: 0.25 }, maxConcurrentRequests: 1 },
      }),
    });
    const over = await app.send('POST', '/design/generations', {
      ...request({ quality: 'high', count: 3 }),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(over.statusCode).toBe(429);
    expect(over.json().detail).toContain('gasto mensual');
    const done = await generate(app, request({ quality: 'high', count: 2 }));
    expect(done.status).toBe('completed');
    expect(imageRequests(egress)).toHaveLength(2);
  });

  it('refuses a request whose cost can be neither estimated nor reserved while a monthly limit is set', async () => {
    const { app, egress } = await start({
      images: testImageProviderConfig({
        limits: { monthlySpendLimit: 5, spendReservePerImage: { low: 0.06 }, maxConcurrentRequests: 1 },
      }),
    });
    const refused = await app.send('POST', '/design/generations', {
      ...request({ quality: 'high' }),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(refused.statusCode).toBe(429);
    expect(refused.json().detail).toContain('no hay una reserva configurada para esta calidad');
    expect(imageRequests(egress)).toHaveLength(0);
  });

  it('refuses a model without prices while a monthly spend limit is configured', async () => {
    const { app, egress } = await start({
      images: testImageProviderConfig({ limits: { monthlySpendLimit: 5, maxConcurrentRequests: 1 } }),
    });
    const refused = await app.send('POST', '/design/generations', {
      ...request({ model: 'test-image-standard', quality: 'low' }),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(refused.statusCode).toBe(429);
    expect(refused.json().detail).toContain('no tiene precios configurados');
    expect(imageRequests(egress)).toHaveLength(0);
  });

  it('enforces the monthly spend limit with the computed cost', async () => {
    const { app } = await start({
      images: testImageProviderConfig({ limits: { monthlySpendLimit: 0.05, maxConcurrentRequests: 1 } }),
    });
    await generate(app, request());
    const capabilities = DesignCapabilitiesSchema.parse((await app.get('/design/capabilities')).json());
    expect(capabilities.limits.spentThisMonth).toBeCloseTo(0.0486, 6);
    const refused = await app.send('POST', '/design/generations', {
      ...request(),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(refused.statusCode).toBe(429);
    expect(refused.json().detail).toContain('gasto mensual');
  });

  it.each([
    [
      { status: 401, body: { error: { message: 'secret detail sk-xyz', type: 'invalid_request_error' } } },
      'ACCOUNT_NOT_AUTHORIZED',
    ],
    [{ status: 403, body: { error: { message: 'verify org', code: null } } }, 'ACCOUNT_NOT_AUTHORIZED'],
    [{ status: 404, body: { error: { code: 'model_not_found' } } }, 'MODEL_UNAVAILABLE'],
    [{ status: 429, body: { error: { type: 'rate_limit_error' } }, headers: { 'retry-after': '20' } }, 'RATE_LIMITED'],
    [{ status: 429, body: { error: { code: 'insufficient_quota' } } }, 'QUOTA_EXCEEDED'],
    [{ status: 400, body: { error: { code: 'moderation_blocked' } } }, 'PROVIDER_REJECTED'],
    [{ status: 400, body: { error: { code: 'invalid_value' } } }, 'INVALID_REQUEST'],
    [{ status: 503, body: 'overloaded' }, 'PROVIDER_UNAVAILABLE'],
    [{ status: 200, body: '{"data":[]}' }, 'RESPONSE_INVALID'],
    [
      { status: 200, body: { data: [{ b64_json: Buffer.from('not an image').toString('base64') }] } },
      'RESPONSE_INVALID',
    ],
    [{ error: new EgressError('timeout', 'egress request exceeded its deadline') }, 'TIMEOUT'],
    [{ error: new EgressError('network', 'egress request failed') }, 'PROVIDER_UNAVAILABLE'],
    [{ error: new EgressError('too_large', 'egress response exceeded its size cap') }, 'RESPONSE_INVALID'],
  ] as const)('maps a provider failure to a closed code without its body (%#)', async (answer, code) => {
    const { app, egress } = await start();
    egress.answer(answer);
    const done = await generate(app, request());
    expect(done).toMatchObject({ status: 'failed', errorCode: code, completedCount: 0 });
    expect(done.errorMessage).not.toMatch(/secret|sk-|verify|overloaded/);
    expect(app.databaseText()).not.toContain('sk-xyz');
    expect(app.log.text()).not.toContain('sk-xyz');
    expect(imageRequests(egress)).toHaveLength(1);
    if (code === 'RATE_LIMITED') {
      expect(done.retryAfterSeconds).toBe(20);
    }
  });

  it('keeps the proposals saved before a failure and never retries', async () => {
    const { app, egress } = await start();
    egress.answer(
      {
        status: 200,
        body: JSON.parse(
          JSON.stringify({ data: [{ b64_json: png({ width: 1024, height: 1280 }).toString('base64') }] }),
        ),
      },
      { status: 500, body: {} },
    );
    const done = await generate(app, request({ count: 3 }));
    expect(done).toMatchObject({ status: 'failed', errorCode: 'PROVIDER_UNAVAILABLE', completedCount: 1 });
    expect(done.proposalIds).toHaveLength(1);
    expect(imageRequests(egress)).toHaveLength(2);
  });

  it('never logs the API key, the prompt or the image data', async () => {
    const { app } = await start();
    await generate(app, request({ instructions: 'Instrucción privada del operador' }));
    const log = app.log.text();
    expect(log).not.toContain(TEST_DUMMY_API_KEY);
    expect(log).not.toContain('Instrucción privada');
    expect(log).not.toContain('b64_json');
    expect(log).toContain('design generation completed');
  });
});

describe('design proposals: review, variants and recovery', () => {
  it('records append-only decisions; a change request needs a note; nothing else changes', async () => {
    const { app } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo' });
    const templatesBefore = (await app.get('/templates')).body;
    const done = await generate(app, request({ references: [{ assetId: logo.id, role: 'reserved_placement' }] }));
    const id = done.proposalIds[0] ?? '';

    expect(
      (await app.send('POST', `/design/proposals/${id}/decisions`, { decision: 'changes_requested' })).statusCode,
    ).toBe(400);
    const changes = await app.send('POST', `/design/proposals/${id}/decisions`, {
      decision: 'changes_requested',
      note: 'Más contraste en la zona del marcador.',
    });
    expect(DesignProposalSchema.parse(changes.json()).status).toBe('changes_requested');
    const approved = DesignProposalSchema.parse(
      (await app.send('POST', `/design/proposals/${id}/decisions`, { decision: 'approved' })).json(),
    );
    expect(approved).toMatchObject({ status: 'approved', decisionNote: null });

    const detail = DesignProposalDetailSchema.parse((await app.get(`/design/proposals/${id}`)).json());
    expect(detail.decisions.map((decision) => decision.decision)).toEqual(['changes_requested', 'approved']);
    expect(detail.proposal.references).toMatchObject([{ assetId: logo.id, role: 'reserved_placement', sent: false }]);

    expect((await app.get('/templates')).body).toBe(templatesBefore);
    const after = BrandAssetSchema.parse((await app.get(`/brand/assets/${logo.id}`)).json().asset);
    expect(after).toEqual(logo);
  });

  it('keeps change notes of up to 1200 characters whole and refuses longer ones', async () => {
    const { app } = await start();
    const id = (await generate(app, request())).proposalIds[0] ?? '';
    const long = `Deja vacíos los escudos.\n${'x'.repeat(1175)}`;
    expect([...long]).toHaveLength(1200);

    const refused = await app.send('POST', `/design/proposals/${id}/decisions`, {
      decision: 'changes_requested',
      note: `${long}x`,
    });
    expect(refused.statusCode).toBe(400);
    const accepted = await app.send('POST', `/design/proposals/${id}/decisions`, {
      decision: 'changes_requested',
      note: long,
    });
    expect(DesignProposalSchema.parse(accepted.json()).decisionNote).toBe(long);
    const detail = DesignProposalDetailSchema.parse((await app.get(`/design/proposals/${id}`)).json());
    expect(detail.decisions.map((decision) => decision.note)).toEqual([long]);
  });

  it('generates a variant from a proposal with its image as the base and the original instructions kept', async () => {
    const { app, egress } = await start();
    const first = await generate(app, request({ instructions: 'Estadio de noche.' }));
    const parentId = first.proposalIds[0] ?? '';
    const parentFile = (await app.get(`/design/proposals/${parentId}/file`)).rawPayload.toString('base64');

    const variant = await generate(app, request({ parentProposalId: parentId, instructions: 'Más dorado.' }));
    expect(variant.parentProposalId).toBe(parentId);
    const sent = imageRequests(egress)[1];
    expect(sent?.url).toBe(`${TEST_IMAGE_BASE_URL}/images/edits`);
    expect((sent?.body?.['images'] as { image_url: string }[])[0]?.image_url).toBe(
      `data:image/png;base64,${parentFile}`,
    );
    expect(String(sent?.body?.['prompt'])).toContain('- Original instructions:\n<<<\nEstadio de noche.\n>>>');
    expect(String(sent?.body?.['prompt'])).toContain('- New instructions:\n<<<\nMás dorado.\n>>>');

    const parent = DesignProposalDetailSchema.parse((await app.get(`/design/proposals/${parentId}`)).json());
    expect(parent.variantIds).toEqual(variant.proposalIds);
    expect(parent.proposal.status).toBe('pending_review');
    expect((await app.get(`/design/proposals/${parentId}/file`)).rawPayload.toString('base64')).toBe(parentFile);
    expect(proposalFiles(app)).toHaveLength(2);

    const unknownParent = await app.send(
      'POST',
      '/design/estimates',
      request({ parentProposalId: '00000000-0000-4000-8000-000000000998' }),
    );
    expect(unknownParent.statusCode).toBe(404);
  });

  it('marks a generation interrupted by a restart as failed and keeps proposals after a restart', async () => {
    const egress = scriptedImageEgress();
    const { app } = await start({ egress });
    const done = await generate(app, request());
    egress.hold();
    const pending = await app.send('POST', '/design/generations', {
      ...request(),
      requestKey: requestKey(),
      confirmCost: true,
    });
    const pendingId = DesignGenerationStartSchema.parse(pending.json()).generation.id;
    const dataDir = app.container.paths.dataDir;
    // Copy the database state by restarting on the same data directory while the request is held.
    const restarted = await start({ dataDir, egress: scriptedImageEgress() });
    const interrupted = await generation(restarted.app, pendingId);
    expect(interrupted).toMatchObject({ status: 'failed', errorCode: 'INTERRUPTED' });
    const list = DesignProposalListSchema.parse((await restarted.app.get('/design/proposals')).json());
    expect(list.proposals.map((proposal) => proposal.id)).toEqual(done.proposalIds);
    egress.release();
    await designServiceOf(app.container).settled(pendingId);
    expect(readFileSync(join(dataDir, 'design-proposals', `${done.proposalIds[0] ?? ''}.png`)).length).toBeGreaterThan(
      0,
    );
  });
});

describe('design proposals: original brand layers and deletion', () => {
  it('draws the protected logo locally in its zone, keeps the generated background apart and never sends the logo', async () => {
    const { app, egress } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo' });
    const done = await generate(
      app,
      request({ style: 'estilo MR BEAST', references: [{ assetId: logo.id, role: 'reserved_placement' }] }),
    );
    const prompt = String(imageRequests(egress)[0]?.body?.['prompt']);
    expect(prompt).toContain('from 36% to 64% of the width and from 3% to 15% of the height');
    expect(prompt).toContain('No people at all');
    expect(prompt).toContain('never people, faces or characters');
    const logoFile = (await app.get(`/brand/assets/${logo.id}/file`)).rawPayload.toString('base64');
    expect(JSON.stringify(imageRequests(egress)[0]?.body)).not.toContain(logoFile);

    const id = done.proposalIds[0] ?? '';
    const detail = DesignProposalDetailSchema.parse((await app.get(`/design/proposals/${id}`)).json());
    expect(detail.hasBackground).toBe(true);
    expect(detail.layers).toEqual([
      { assetId: logo.id, label: 'Logo', kind: 'brand_logo', x: 369, y: 38, width: 287, height: 154 },
    ]);
    const preview = (await app.get(`/design/proposals/${id}/file`)).rawPayload;
    const background = (await app.get(`/design/proposals/${id}/background`)).rawPayload;
    expect(preview.equals(background)).toBe(false);
    expect(background.equals(png({ width: 1024, height: 1280, rgba: [46, 17, 69, 255] }))).toBe(true);
    expect(proposalFiles(app)).toHaveLength(2);
  });

  it('starts a variant from the generated background, never from the preview with the logo', async () => {
    const { app, egress } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo' });
    const first = await generate(app, request({ references: [{ assetId: logo.id, role: 'reserved_placement' }] }));
    const parentId = first.proposalIds[0] ?? '';
    const background = (await app.get(`/design/proposals/${parentId}/background`)).rawPayload.toString('base64');
    await generate(
      app,
      request({ parentProposalId: parentId, references: [{ assetId: logo.id, role: 'reserved_placement' }] }),
    );
    const images = imageRequests(egress)[1]?.body?.['images'] as { image_url: string }[];
    expect(images.map((image) => image.image_url)).toEqual([`data:image/png;base64,${background}`]);
  });

  it('places at most one original per zone', async () => {
    const { app } = await start();
    const first = await asset(app, { kind: 'brand_logo', label: 'Logo A' });
    const second = await asset(app, { kind: 'brand_logo', label: 'Logo B' });
    const response = await app.send(
      'POST',
      '/design/estimates',
      request({
        references: [
          { assetId: first.id, role: 'reserved_placement' },
          { assetId: second.id, role: 'reserved_placement' },
        ],
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toContain('un original por zona');
  });

  it('discards a proposal logically: out of the library and unusable, with its row and files kept', async () => {
    const { app, egress } = await start();
    const done = await generate(app, request({ count: 2 }));
    const [discarded = '', kept = ''] = done.proposalIds;
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/design/proposals/${discarded}`,
      headers: { host: app.host, origin: app.origin, 'x-edr-client': 'web' },
    });
    expect(deleted.statusCode).toBe(204);
    const list = DesignProposalListSchema.parse((await app.get('/design/proposals')).json());
    expect(list.proposals.map((proposal) => proposal.id)).toEqual([kept]);
    expect((await app.get(`/design/proposals/${discarded}`)).statusCode).toBe(404);
    expect((await app.get(`/design/proposals/${discarded}/file`)).statusCode).toBe(404);
    expect(
      (await app.send('POST', `/design/proposals/${discarded}/decisions`, { decision: 'approved' })).statusCode,
    ).toBe(404);
    expect((await app.send('POST', '/design/estimates', request({ parentProposalId: discarded }))).statusCode).toBe(
      404,
    );
    expect((await generation(app, done.id)).proposalIds).toEqual([kept]);
    expect(proposalFiles(app)).toHaveLength(2);
    expect(app.databaseText()).toContain(discarded);

    egress.hold();
    const variant = await app.send('POST', '/design/generations', {
      ...request({ parentProposalId: kept }),
      requestKey: requestKey(),
      confirmCost: true,
    });
    expect(variant.statusCode).toBe(202);
    const busy = await app.inject({
      method: 'DELETE',
      url: `/api/v1/design/proposals/${kept}`,
      headers: { host: app.host, origin: app.origin, 'x-edr-client': 'web' },
    });
    expect(busy.statusCode).toBe(409);
    egress.release();
    await designServiceOf(app.container).settled(DesignGenerationStartSchema.parse(variant.json()).generation.id);
  });
});

describe('design generation modes', () => {
  const MASTER = [
    '# MASTER PROMPT — EL DEPORTE REY',
    '',
    'Create a high-impact 4:5 results template with the texts "EQUIPO A", "EQUIPO B" and "0 - 0".',
    '',
    ...Array.from({ length: 120 }, (_, index) => `- Detail ${String(index + 1)}: cinematic floodlights and confetti.`),
  ].join('\n');

  it('sends an own prompt of more than 2000 characters whole, with its lines and without the guided rules', async () => {
    expect(MASTER.length).toBeGreaterThan(5000);
    const { app, egress } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo' });
    const ketsi = await asset(app, { kind: 'mascot', label: 'Ketsi transformable', usagePolicy: 'transformable' });
    const done = await generate(
      app,
      request({
        mode: 'own_prompt',
        instructions: MASTER,
        references: [
          { assetId: logo.id, role: 'reserved_placement' },
          { assetId: ketsi.id, role: 'style_reference' },
        ],
      }),
    );
    expect(done).toMatchObject({ status: 'completed', mode: 'own_prompt' });
    const sent = imageRequests(egress)[0];
    const prompt = String(sent?.body?.['prompt']);
    expect(prompt.startsWith(MASTER)).toBe(true);
    expect(prompt).toContain('Image 1: "Ketsi transformable".');
    expect(prompt).toContain('the official logo "Logo" is placed there afterwards as an original layer');
    expect(prompt).not.toContain('No text of any kind');
    expect((sent?.body?.['images'] as unknown[]).length).toBe(1);

    const detail = DesignProposalDetailSchema.parse(
      (await app.get(`/design/proposals/${done.proposalIds[0] ?? ''}`)).json(),
    );
    expect(detail.proposal.mode).toBe('own_prompt');
    expect(detail.generation).toMatchObject({
      mode: 'own_prompt',
      instructions: MASTER,
      promptVersion: 'edr-own-prompt/3',
    });
    expect(detail.layers.map((layer) => layer.label)).toEqual(['Logo']);
  });

  it('sends only the operator text in an own prompt variant, with the previous image as the base to edit', async () => {
    const { app, egress } = await start();
    const first = await generate(app, request({ mode: 'own_prompt', instructions: MASTER }));
    const parentId = first.proposalIds[0] ?? '';
    const edited = 'Deja vacíos los escudos y el marcador.';

    const variant = await generate(
      app,
      request({ mode: 'own_prompt', parentProposalId: parentId, instructions: edited }),
    );
    const prompt = String(imageRequests(egress)[1]?.body?.['prompt']);
    expect(prompt.startsWith(edited)).toBe(true);
    expect(prompt).not.toContain(MASTER);
    expect(prompt).toContain('Image 1: the previous version of this design. Edit it:');
    expect(prompt).toContain('keep everything else as it is; do not return it unchanged');

    const detail = DesignProposalDetailSchema.parse(
      (await app.get(`/design/proposals/${variant.proposalIds[0] ?? ''}`)).json(),
    );
    expect(detail.generation).toMatchObject({ mode: 'own_prompt', instructions: edited, inheritedInstructions: null });
  });

  it('keeps the usage policies in the own prompt mode: protected assets are never sent', async () => {
    const { app } = await start();
    const ketsi = await asset(app, { kind: 'mascot', label: 'Ketsi oficial' });
    const response = await app.send(
      'POST',
      '/design/estimates',
      request({
        mode: 'own_prompt',
        instructions: MASTER,
        references: [{ assetId: ketsi.id, role: 'style_reference' }],
      }),
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'DESIGN_REFERENCE_REFUSED' });
  });

  it('needs the prompt in the own prompt mode and refuses a separate style there', async () => {
    const { app } = await start();
    expect((await app.send('POST', '/design/estimates', request({ mode: 'own_prompt' }))).statusCode).toBe(400);
    const styled = await app.send(
      'POST',
      '/design/estimates',
      request({ mode: 'own_prompt', instructions: 'Un póster.', style: 'Épico' }),
    );
    expect(styled.statusCode).toBe(400);
    expect(styled.json().detail).toContain('dentro de tu prompt');
  });

  it('accepts long guided instructions with their lines and keeps the guided rules', async () => {
    const { app } = await start();
    const estimate = DesignEstimateSchema.parse(
      (await app.send('POST', '/design/estimates', request({ instructions: MASTER }))).json(),
    );
    expect(estimate.mode).toBe('guided');
    expect(estimate.prompt).toContain(`<<<\n${MASTER}\n>>>`);
    expect(estimate.prompt).toContain('No text of any kind');
    expect(estimate.promptVersion).toBe('edr-design-prompt/3');
    const tooLong = await app.send('POST', '/design/estimates', request({ instructions: 'x'.repeat(12001) }));
    expect(tooLong.statusCode).toBe(400);
  });
});
