/**
 * Template routes through the HTTP platform (contract operations listTemplates and previewTemplate; OD-13, OD-41,
 * T10-F03, T10-F04): contract bodies, PNG previews served with no-store and the sandboxed file CSP, problem codes for
 * unknown templates and invalid parameters, and previews that follow the brand registry (T33).
 */
import { join } from 'node:path';

import { ProblemSchema, TemplateListResponseSchema } from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { createContainer } from '../../container.js';
import { type SqliteDatabase, DATABASE_FILE_NAME, openMigratedDatabase } from '../../platform/db/index.js';
import { SANDBOXED_FILE_CONTENT_SECURITY_POLICY, createLogger } from '../../platform/http/index.js';
import type { AiTextProvider } from '../../providers/ai/index.js';
import type { SourceRegistry } from '../../providers/sports/index.js';
import { createBrandModule } from '../brand/index.js';
import { png } from '../brand/test/images.js';

import { createRenderingModule } from './index.js';
import { pngSize } from './renderer.js';
import { FIXED_AT, type RenderTestRoot, createRenderTestRoot, renderConfig } from './test/support.js';

const HOST = '127.0.0.1:4300';
const READ = { host: HOST };

let root: RenderTestRoot;
let db: SqliteDatabase;
let app: FastifyInstance;

beforeEach(async () => {
  root = createRenderTestRoot();
  const config = renderConfig(root.rootDir);
  ({ db } = openMigratedDatabase({ location: join(root.dataDir, DATABASE_FILE_NAME) }));
  const container = createContainer({
    config,
    db,
    env: Object.freeze({}),
    clock: { now: () => new Date(FIXED_AT) },
    logger: createLogger({ level: 'silent' }),
    providers: {
      createSportsSources: () => ({ sourceIds: [] }) as unknown as SourceRegistry,
      createAiProvider: () => ({ id: 'stub' }) as unknown as AiTextProvider,
    },
  });
  app = await buildApp(container, { webRoot: null, modules: [createBrandModule(), createRenderingModule()] });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
  root.remove();
});

describe('listTemplates', () => {
  it('returns the current templates in the contract shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/templates', headers: READ });
    expect(response.statusCode).toBe(200);
    const body = TemplateListResponseSchema.parse(response.json());
    expect(body.templates.map((template) => [template.id, template.version, template.badgeSlots])).toEqual([
      ['cover', '1.0.0', 0],
      ['match-result', '1.1.0', 2],
      ['standings', '1.0.0', 0],
      ['closing', '1.0.0', 0],
      // PD-ARCH-01G-E.2: six rows of two badge slots.
      ['round-overview', '2.0.0', 12],
      ['fixture', '1.1.0', 2],
      ['match-preview', '1.1.0', 2],
    ]);
  });
});

describe('previewTemplate', () => {
  it('serves a PNG at the configured size, not cacheable, with the sandboxed file CSP', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/templates/match-result/preview', headers: READ });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toBe(SANDBOXED_FILE_CONTENT_SECURITY_POLICY);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['etag']).toBeUndefined();
    expect(pngSize(response.rawPayload)).toEqual({ width: 1080, height: 1350 });
  });

  it('uses the default language unless another one is requested', async () => {
    const url = '/api/v1/templates/standings/preview';
    const byDefault = await app.inject({ method: 'GET', url, headers: READ });
    const spanish = await app.inject({ method: 'GET', url: `${url}?language=es`, headers: READ });
    const english = await app.inject({ method: 'GET', url: `${url}?language=en`, headers: READ });
    expect(byDefault.rawPayload.equals(spanish.rawPayload)).toBe(true);
    expect(english.rawPayload.equals(spanish.rawPayload)).toBe(false);
  });

  it('answers 404 for an unknown template and 400 for an invalid slug or language', async () => {
    const unknown = await app.inject({
      method: 'GET',
      url: '/api/v1/templates/unknown-template/preview',
      headers: READ,
    });
    expect(unknown.statusCode).toBe(404);
    expect(ProblemSchema.parse(unknown.json()).code).toBe('NOT_FOUND');
    for (const url of [
      '/api/v1/templates/Bad_Slug/preview',
      '/api/v1/templates/cover/preview?language=fr',
      `/api/v1/templates/${'a'.repeat(65)}/preview`,
    ]) {
      const response = await app.inject({ method: 'GET', url, headers: READ });
      expect(response.statusCode).toBe(400);
      expect(ProblemSchema.parse(response.json()).code).toBe('VALIDATION_FAILED');
    }
  });

  it('shows a newly registered brand logo at once, and no logo again after deactivation', async () => {
    const url = '/api/v1/templates/cover/preview';
    const before = (await app.inject({ method: 'GET', url, headers: READ })).rawPayload;
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/brand/assets?kind=brand_logo&label=Logo%20sintetico',
      headers: { host: HOST, origin: `http://${HOST}`, 'x-edr-client': 'web', 'content-type': 'image/png' },
      payload: png({ width: 64, height: 32, rgba: [212, 175, 55, 255] }),
    });
    expect(upload.statusCode).toBe(201);
    const withLogo = (await app.inject({ method: 'GET', url, headers: READ })).rawPayload;
    expect(withLogo.equals(before)).toBe(false);
    const { id } = upload.json<{ id: string }>();
    const deactivate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/brand/assets/${id}`,
      headers: { host: HOST, origin: `http://${HOST}`, 'x-edr-client': 'web', 'content-type': 'application/json' },
      payload: { active: false },
    });
    expect(deactivate.statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url, headers: READ })).rawPayload;
    expect(after.equals(before)).toBe(true);
  });
});
