/**
 * Integration tests of the brand library (PD-ARCH-01G-A) over a temporary data directory: categories and metadata at
 * registration, default and explicit usage policies, WebP style references, unsafe files, metadata edits and their
 * rules, the primary logo and mascot of the renderer, logical deletion and restoration, the identity and the brand
 * context, and persistence after a restart. All images are synthetic.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  BrandAssetDetailSchema,
  BrandAssetListResponseSchema,
  BrandAssetSchema,
  BrandIdentitySchema,
  type BrandAsset,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { brandAssetLookup, brandContextOf } from './index.js';
import { gif, jpeg, png, svg, text, webp } from './test/images.js';
import {
  type BrandTestApp,
  type BrandTestOptions,
  FIXED_NOW,
  JSON_HEADERS,
  READ_HEADERS,
  brandTestApp,
  createBrandTestRoot,
  uploadHeaders,
} from './test/support.js';

const apps: BrandTestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

async function start(options: BrandTestOptions = {}): Promise<BrandTestApp> {
  const app = await brandTestApp(options);
  apps.push(app);
  return app;
}

function upload(app: BrandTestApp, body: Buffer, contentType: string, query: Record<string, string>) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/brand/assets',
    query,
    headers: uploadHeaders(contentType),
    payload: body,
  });
}

async function register(app: BrandTestApp, body: Buffer, query: Record<string, string>, contentType = 'image/png') {
  const response = await upload(app, body, contentType, query);
  expect(response.statusCode, response.body).toBe(201);
  return BrandAssetSchema.parse(response.json());
}

function patch(app: BrandTestApp, id: string, body: unknown) {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/brand/assets/${id}`,
    headers: JSON_HEADERS,
    payload: JSON.stringify(body),
  });
}

async function patched(app: BrandTestApp, id: string, body: unknown): Promise<BrandAsset> {
  const response = await patch(app, id, body);
  expect(response.statusCode, response.body).toBe(200);
  return BrandAssetSchema.parse(response.json());
}

function remove(app: BrandTestApp, id: string) {
  return app.inject({
    method: 'DELETE',
    url: `/api/v1/brand/assets/${id}`,
    headers: { host: JSON_HEADERS.host, origin: JSON_HEADERS.origin, 'x-edr-client': 'web' },
  });
}

function brandFiles(app: BrandTestApp): string[] {
  try {
    return readdirSync(join(app.root.dataDir, 'brand-assets')).sort();
  } catch {
    return [];
  }
}

function get(app: BrandTestApp, url: string) {
  return app.inject({ method: 'GET', url: `/api/v1${url}`, headers: READ_HEADERS });
}

async function list(app: BrandTestApp): Promise<BrandAsset[]> {
  return BrandAssetListResponseSchema.parse((await get(app, '/brand/assets')).json()).assets;
}

function expectProblem(response: { statusCode: number; json: () => unknown }, status: number, code: string): void {
  expect(response.statusCode, JSON.stringify(response.json())).toBe(status);
  expect(response.json()).toMatchObject({ status, code });
}

const LOGO = { kind: 'brand_logo', label: 'Logo principal' };

/** Marks an asset as drawn by a stored rendered slide version (the render model names its asset ID). */
function seedRenderedUse(app: BrandTestApp, assetId: string, exported: boolean): void {
  const at = FIXED_NOW;
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  app.db.execScript(`
INSERT OR IGNORE INTO sources (id, name, mode, role, official_publication, accepted, independence_group,
  publication_permission, adapter, first_seen_at, last_seen_at)
VALUES ('demo-a', 'Synthetic source', 'DEMO_DATA', 'primary', 1, 1, 'group-a', 'not_applicable', 'fixture',
  '${at}', '${at}');
INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, stage_id,
  stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at)
VALUES ('${id(1)}', 'demo-a-league', 'Liga Sintética', 'demo-a', 'DEMO_DATA', '2026', '2026', 'regular',
  'Temporada Regular', 3, '{}', 'expected', 'es', '${at}', '${at}');
INSERT INTO workflow_runs (id, project_id, run_number, kind, base_run_id, status, failure, config_snapshot,
  standings_availability, started_at, finished_at)
VALUES ('${id(2)}', '${id(1)}', 1, 'full', NULL, 'completed', NULL, '{}', NULL, '${at}', '${at}');
INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, excluded_match_keys,
  left_out_matches, created_at, superseded_at)
VALUES ('${id(3)}', '${id(1)}', '${id(2)}', '${id(2)}', 'es', 0, '[]', '[]', '${at}', NULL);
INSERT INTO carousels (id, draft_id, sequence, total) VALUES ('${id(4)}', '${id(3)}', 1, 1);
INSERT INTO elements (id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id)
VALUES ('${id(5)}', '${id(4)}', 'slide', 1, 'cover', 'cover', '{}', NULL);
INSERT INTO element_versions (id, element_id, version_number, origin, text, content_flags, ai_adapter, template_id,
  template_version, render_model, image_path, image_sha256, width, height, qa_status, created_at, superseded_at)
VALUES ('${id(6)}', '${id(5)}', 1, 'generated', '{"fields":[]}', '[]', 'stub', 'cover', '1.0.0',
  '{"elements":[{"kind":"image","slot":"brand_logo","assetId":"${assetId}"}]}', NULL, NULL, 1080, 1350, 'passed',
  '${at}', NULL);
`);
  if (exported) {
    app.db.execScript(`
INSERT INTO final_approvals (id, carousel_id, version_set, version_set_sha256, approved_at, invalidated_at)
VALUES ('${id(7)}', '${id(4)}', '["${id(6)}"]', '${'a'.repeat(64)}', '${at}', NULL);
INSERT INTO exports (id, carousel_id, final_approval_id, exported_at, directory, manifest_sha256, data_mode)
VALUES ('${id(8)}', '${id(4)}', '${id(7)}', '${at}', 'exports/x/y', '${'b'.repeat(64)}', 'DEMO_DATA');
INSERT INTO export_files (export_id, position, kind, element_version_id, file_name, sha256)
VALUES ('${id(8)}', 1, 'slide_image', '${id(6)}', '01.png', '${'c'.repeat(64)}');
`);
  }
}

describe('registration of the library categories (PD-ARCH-01G-A)', () => {
  it('stores the metadata of the query and applies the category default policy, never transformable', async () => {
    const app = await start();
    const mascot = await register(app, png({ note: 'ketsi' }), {
      kind: 'mascot',
      label: 'Ketsi',
      description: 'Mascota oficial.\nPose de celebración.',
      official: 'true',
      variant: 'Principal',
      pose: 'Celebración',
      expression: 'Alegre',
    });
    expect(mascot).toMatchObject({
      kind: 'mascot',
      usagePolicy: 'protected',
      official: true,
      primary: false,
      description: 'Mascota oficial.\nPose de celebración.',
      variant: 'Principal',
      pose: 'Celebración',
      expression: 'Alegre',
    });
    const defaults = await Promise.all(
      (['brand_logo', 'decoration', 'background', 'style_reference'] as const).map((kind, index) =>
        register(app, png({ note: `default-${String(index)}` }), { kind, label: `Recurso ${String(index)}` }),
      ),
    );
    expect(defaults.map((asset) => [asset.kind, asset.usagePolicy])).toEqual([
      ['brand_logo', 'protected'],
      ['decoration', 'reusable'],
      ['background', 'reusable'],
      ['style_reference', 'reference_only'],
    ]);
    const transformable = await register(app, png({ note: 'transformable' }), {
      kind: 'background',
      label: 'Estadio',
      usagePolicy: 'transformable',
    });
    expect(transformable.usagePolicy).toBe('transformable');
  });

  it('refuses a style reference that could be placed in content, and pose or expression outside the mascot', async () => {
    const app = await start();
    expectProblem(
      await upload(app, png({ note: 'a' }), 'image/png', {
        kind: 'style_reference',
        label: 'Ref',
        usagePolicy: 'reusable',
      }),
      400,
      'VALIDATION_FAILED',
    );
    expectProblem(
      await upload(app, png({ note: 'b' }), 'image/png', { ...LOGO, pose: 'De pie' }),
      400,
      'VALIDATION_FAILED',
    );
    expectProblem(
      await upload(app, png({ note: 'c' }), 'image/png', { ...LOGO, usagePolicy: 'everything' }),
      400,
      'VALIDATION_FAILED',
    );
    expectProblem(
      await upload(app, png({ note: 'd' }), 'image/png', { ...LOGO, official: 'yes' }),
      400,
      'VALIDATION_FAILED',
    );
    expect(await list(app)).toEqual([]);
  });

  it('accepts WebP for style references only, with its header dimensions, and refuses a broken container', async () => {
    const app = await start();
    const image = webp({ width: 300, height: 200 });
    const reference = await register(
      app,
      image,
      { kind: 'style_reference', label: 'Portada de referencia' },
      'image/webp',
    );
    expect(reference).toMatchObject({ mime: 'image/webp', width: 300, height: 200, byteSize: image.length });
    expect(brandFiles(app)).toEqual([`${reference.id}.webp`]);
    const file = await get(app, `/brand/assets/${reference.id}/file`);
    expect(file.headers['content-type']).toBe('image/webp');
    expect(file.headers['content-security-policy']).toBe("default-src 'none'; sandbox");

    expectProblem(await upload(app, webp({ note: 'logo' }), 'image/webp', LOGO), 415, 'UNSUPPORTED_MEDIA_TYPE');
    for (const broken of [
      webp({ brokenSize: true }),
      webp({ unknownChunk: true }),
      webp({ width: 5000, height: 10 }),
    ]) {
      expectProblem(
        await upload(app, broken, 'image/webp', { kind: 'style_reference', label: 'Rota' }),
        400,
        'VALIDATION_FAILED',
      );
    }
    // The declared type must match the signature.
    expectProblem(
      await upload(app, webp({ note: 'mismatch' }), 'image/png', { kind: 'style_reference', label: 'Ref' }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
  });

  it('refuses SVG (active content), GIF, text and fonts whatever the declared type, and stores nothing', async () => {
    const app = await start();
    const font = Buffer.from('\u0000\u0001\u0000\u0000font-bytes', 'latin1');
    for (const [body, type] of [
      [svg(), 'image/svg+xml'],
      [svg(), 'image/png'],
      [gif(), 'image/gif'],
      [text(), 'image/png'],
      [font, 'font/ttf'],
      [font, 'image/webp'],
    ] as const) {
      const response = await upload(app, body, type, LOGO);
      expect(response.statusCode, type).toBe(415);
    }
    expect(await list(app)).toEqual([]);
    expect(brandFiles(app)).toEqual([]);
  });

  it('refuses identifiers that are not UUIDs and paths outside the API on every asset route', async () => {
    const app = await start();
    for (const url of [
      '/brand/assets/..%2F..%2Fetc%2Fpasswd',
      '/brand/assets/not-a-uuid',
      '/brand/assets/00000000-0000-4000-8000-00000000000G/file',
    ]) {
      expect((await get(app, url)).statusCode, url).toBe(400);
    }
    expectProblem(await patch(app, 'not-a-uuid', { label: 'x' }), 400, 'VALIDATION_FAILED');
    expectProblem(await remove(app, 'not-a-uuid'), 400, 'VALIDATION_FAILED');
    // A dot segment is resolved by the router: it never reaches a brand route.
    expectProblem(await remove(app, '..'), 404, 'NOT_FOUND');
    expectProblem(await get(app, '/brand/assets/00000000-0000-4000-8000-000000000999'), 404, 'NOT_FOUND');
  });
});

describe('metadata edits (PD-ARCH-01G-A)', () => {
  it('edits name, description, policy, marks and variants without touching the file', async () => {
    const app = await start();
    const image = png({ note: 'edit' });
    const asset = await register(app, image, LOGO);
    const edited = await patched(app, asset.id, {
      label: 'Logo horizontal',
      description: 'Versión horizontal.',
      official: true,
      variant: 'Horizontal',
      usagePolicy: 'reusable',
    });
    expect(edited).toMatchObject({
      label: 'Logo horizontal',
      description: 'Versión horizontal.',
      official: true,
      variant: 'Horizontal',
      usagePolicy: 'reusable',
      sha256: asset.sha256,
      registeredAt: asset.registeredAt,
    });
    expect((await get(app, `/brand/assets/${asset.id}/file`)).rawPayload).toEqual(image);
    const cleared = await patched(app, asset.id, { description: null, variant: null });
    expect(cleared).toMatchObject({ description: null, variant: null, label: 'Logo horizontal' });
    const detail = BrandAssetDetailSchema.parse((await get(app, `/brand/assets/${asset.id}`)).json());
    expect(detail).toEqual({ asset: cleared, usage: { renderedVersions: 0, projects: 0, exports: 0 } });
  });

  it('refuses an empty edit, a reference that could be placed, pose on a logo and an unknown field', async () => {
    const app = await start();
    const logo = await register(app, png({ note: 'rules' }), LOGO);
    const reference = await register(app, png({ note: 'ref' }), { kind: 'style_reference', label: 'Ref' });
    expectProblem(await patch(app, logo.id, {}), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, reference.id, { usagePolicy: 'transformable' }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, logo.id, { pose: 'Saltando' }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, logo.id, { kind: 'mascot' }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, logo.id, { label: 'x'.repeat(81) }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, reference.id, { primary: true }), 400, 'VALIDATION_FAILED');
    expect((await list(app)).map((asset) => asset.updatedAt)).toEqual([FIXED_NOW, FIXED_NOW]);
  });

  it('keeps one primary logo, moves the mark, and clears it on deactivation or reference_only', async () => {
    const app = await start();
    const first = await register(app, png({ note: 'first' }), LOGO);
    const second = await register(app, png({ note: 'second' }), { kind: 'brand_logo', label: 'Logo monocromo' });
    const mascot = await register(app, png({ note: 'mascot' }), { kind: 'mascot', label: 'Ketsi' });
    await patched(app, first.id, { primary: true });
    await patched(app, mascot.id, { primary: true });
    await patched(app, second.id, { primary: true });
    const primaries = (await list(app)).filter((asset) => asset.primary).map((asset) => asset.id);
    expect(primaries.sort()).toEqual([mascot.id, second.id].sort());
    expect((await patched(app, second.id, { active: false })).primary).toBe(false);
    expectProblem(await patch(app, second.id, { primary: true }), 400, 'VALIDATION_FAILED');
    expect((await patched(app, mascot.id, { usagePolicy: 'reference_only' })).primary).toBe(false);
  });
});

describe('renderer lookup with the library (PD-ARCH-01G-A)', () => {
  it('draws the primary logo, else the most recent drawable one, and never a reference or reference_only asset', async () => {
    const app = await start();
    const lookup = brandAssetLookup(app.container);
    const first = await register(app, png({ note: 'l1' }), LOGO);
    const second = await register(app, png({ note: 'l2' }), { kind: 'brand_logo', label: 'Logo nuevo' });
    expect(lookup.activeAssets('brand_logo').at(-1)?.id).toBe(second.id);
    await patched(app, first.id, { primary: true });
    expect(lookup.activeAssets('brand_logo').at(-1)?.id).toBe(first.id);
    await patched(app, first.id, { primary: false });
    await patched(app, second.id, { usagePolicy: 'reference_only' });
    expect(lookup.activeAssets('brand_logo').map((asset) => asset.id)).toEqual([first.id]);
    await register(app, png({ note: 'r' }), { kind: 'style_reference', label: 'Referencia' });
    await register(app, png({ note: 'bg' }), { kind: 'background', label: 'Fondo' });
    expect(lookup.activeAssets('style_reference')).toEqual([]);
    expect(lookup.activeAssets('background')).toEqual([]);
  });
});

describe('deletion with dependencies (PD-ARCH-01G-A)', () => {
  it('refuses to delete an asset drawn by a rendered version, naming its usage, and allows deactivation', async () => {
    const app = await start();
    const asset = await register(app, png({ note: 'used' }), LOGO);
    seedRenderedUse(app, asset.id, true);
    const detail = BrandAssetDetailSchema.parse((await get(app, `/brand/assets/${asset.id}`)).json());
    expect(detail.usage).toEqual({ renderedVersions: 1, projects: 1, exports: 1 });
    const refused = await remove(app, asset.id);
    expectProblem(refused, 409, 'ASSET_IN_USE');
    expect((refused.json() as { detail: string }).detail).toContain(
      '1 rendered slide versions of 1 projects (1 exports)',
    );
    expect((await list(app)).map((item) => item.id)).toEqual([asset.id]);
    expect((await patched(app, asset.id, { active: false })).active).toBe(false);
  });

  it('restores a deleted asset when the same file is uploaded again, with the new metadata', async () => {
    const app = await start();
    const image = png({ note: 'restore' });
    const asset = await register(app, image, LOGO);
    expect((await remove(app, asset.id)).statusCode).toBe(204);
    expect(await list(app)).toEqual([]);
    const restored = await register(app, image, { kind: 'decoration', label: 'Marco dorado' });
    expect(restored).toMatchObject({
      id: asset.id,
      kind: 'decoration',
      label: 'Marco dorado',
      usagePolicy: 'reusable',
      active: true,
    });
    expect((await list(app)).map((item) => item.id)).toEqual([asset.id]);
    expectProblem(await upload(app, image, 'image/png', LOGO), 409, 'DUPLICATE_ASSET');
  });
});

describe('identity and brand context (PD-ARCH-01G-A)', () => {
  it('shows the renderer palette and fonts read only and edits the descriptive fields', async () => {
    const app = await start();
    const identity = BrandIdentitySchema.parse((await get(app, '/brand/identity')).json());
    const config = app.container.config.brand;
    expect(identity.palette.map((color) => [color.role, color.value])).toEqual(
      Object.entries(config.palette).map(([role, value]) => [role, value.toLowerCase()]),
    );
    expect(identity.typography.map((font) => [font.role, font.family, font.weight])).toEqual(
      Object.entries(config.fonts).map(([role, font]) => [role, font.family, font.weight]),
    );
    expect(identity).toMatchObject({ name: config.name, description: null, updatedAt: null });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/brand/identity',
      headers: JSON_HEADERS,
      payload: JSON.stringify({
        description: 'Fútbol guatemalteco con identidad propia.',
        graphicPreferences: 'Contraste alto, dorado como acento.',
        colorUsage: { accent: 'Botones y datos destacados.' },
        typographyUsage: { heading: 'Titulares en mayúsculas.' },
      }),
    });
    expect(response.statusCode, response.body).toBe(200);
    const updated = BrandIdentitySchema.parse(response.json());
    expect(updated.palette.find((color) => color.role === 'accent')?.usage).toBe('Botones y datos destacados.');
    expect(updated.typography.find((font) => font.role === 'heading')?.usage).toBe('Titulares en mayúsculas.');
    expect(updated.updatedAt).toBe(FIXED_NOW);
    // Values of the configuration are not writable through the identity.
    const refused = await app.inject({
      method: 'PATCH',
      url: '/api/v1/brand/identity',
      headers: JSON_HEADERS,
      payload: JSON.stringify({ palette: [{ role: 'accent', value: '#000000' }] }),
    });
    expectProblem(refused, 400, 'VALIDATION_FAILED');
    const cleared = await app.inject({
      method: 'PATCH',
      url: '/api/v1/brand/identity',
      headers: JSON_HEADERS,
      payload: JSON.stringify({ colorUsage: { accent: null } }),
    });
    expect(BrandIdentitySchema.parse(cleared.json()).palette.every((color) => color.usage === null)).toBe(true);
  });

  it('builds the internal brand context with active assets and their permissions, without bytes or paths', async () => {
    const app = await start();
    const logo = await register(app, png({ note: 'ctx-logo' }), { ...LOGO, official: 'true' });
    await register(app, png({ note: 'ctx-ref' }), { kind: 'style_reference', label: 'Referencia' });
    const stadium = await register(
      app,
      jpeg(),
      { kind: 'background', label: 'Estadio', usagePolicy: 'transformable' },
      'image/jpeg',
    );
    const inactive = await register(app, png({ note: 'ctx-off' }), { kind: 'decoration', label: 'Apagado' });
    await patched(app, inactive.id, { active: false });
    await patched(app, logo.id, { primary: true });
    const context = brandContextOf(app.container);
    expect(context.format).toBe('edr-brand-context/1');
    expect(context.assets.map((asset) => [asset.label, asset.usagePolicy, asset.permissions])).toEqual([
      [
        'Logo principal',
        'protected',
        { placeInContent: true, alterPixels: false, generateVariants: false, styleReference: true },
      ],
      [
        'Referencia',
        'reference_only',
        { placeInContent: false, alterPixels: false, generateVariants: false, styleReference: true },
      ],
      [
        'Estadio',
        'transformable',
        { placeInContent: true, alterPixels: true, generateVariants: true, styleReference: true },
      ],
    ]);
    expect(context.assets[0]).toMatchObject({ primary: true, official: true });
    expect(context.assets.some((asset) => asset.id === stadium.id)).toBe(true);
    const serialized = JSON.stringify(context);
    expect(serialized).not.toMatch(/brand-assets|base64|file_path|filePath|\/api\//u);
  });
});

describe('persistence after a restart (PD-ARCH-01G-A)', () => {
  it('keeps the library metadata, the primary mark, deletions and the identity notes', async () => {
    const root = createBrandTestRoot();
    try {
      const first = await brandTestApp({ root });
      const logo = await register(first, png({ note: 'persist' }), { ...LOGO, description: 'Persistente' });
      await patched(first, logo.id, { primary: true, official: true });
      const gone = await register(first, png({ note: 'gone' }), { kind: 'decoration', label: 'Eliminado' });
      expect((await remove(first, gone.id)).statusCode).toBe(204);
      await first.inject({
        method: 'PATCH',
        url: '/api/v1/brand/identity',
        headers: JSON_HEADERS,
        payload: JSON.stringify({ description: 'Identidad persistente' }),
      });
      await first.close();

      const second = await brandTestApp({ root });
      try {
        expect(await list(second)).toEqual([
          expect.objectContaining({ id: logo.id, description: 'Persistente', primary: true, official: true }),
        ]);
        expect(BrandIdentitySchema.parse((await get(second, '/brand/identity')).json()).description).toBe(
          'Identidad persistente',
        );
        expect((await get(second, `/brand/assets/${logo.id}/file`)).statusCode).toBe(200);
      } finally {
        await second.close();
      }
    } finally {
      root.remove();
    }
  });
});
