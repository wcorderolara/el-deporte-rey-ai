/**
 * Brand and template operations against the contract (listBrandAssets, registerBrandAsset, updateBrandAsset,
 * getBrandAssetFile, listTemplates, previewTemplate), with an injected fake fetch (no network).
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import { createBrandApi, isAssetMime, MAX_ASSET_BYTES } from './brandApi';
import {
  ASSET_LOGO,
  ASSET_MASCOT,
  fakeFetch,
  IDENTITY,
  imageFile,
  jsonResponse,
  problemResponse,
  TEMPLATE_COVER,
  TEMPLATE_MATCH,
} from './testSupport';

describe('brandApi: reads', () => {
  it('lists brand assets with GET and without the client header', async () => {
    const { fetch, requests } = fakeFetch({
      'GET /brand/assets': () => jsonResponse({ assets: [ASSET_LOGO, ASSET_MASCOT] }),
    });
    const api = createBrandApi({ fetch });

    await expect(api.listAssets()).resolves.toEqual([ASSET_LOGO, ASSET_MASCOT]);
    expect(requests[0]?.url).toBe('/api/v1/brand/assets');
    expect(requests[0]?.headers['X-EDR-Client']).toBeUndefined();
  });

  it('lists templates', async () => {
    const { fetch, requests } = fakeFetch({
      'GET /templates': () => jsonResponse({ templates: [TEMPLATE_COVER, TEMPLATE_MATCH] }),
    });
    await expect(createBrandApi({ fetch }).listTemplates()).resolves.toEqual([TEMPLATE_COVER, TEMPLATE_MATCH]);
    expect(requests[0]?.url).toBe('/api/v1/templates');
  });

  it('refuses a list response that does not match the contract', async () => {
    const { fetch } = fakeFetch({
      'GET /brand/assets': () => jsonResponse({ assets: [{ ...ASSET_LOGO, kind: 'club_badge' }] }),
    });
    const error = await createBrandApi({ fetch })
      .listAssets()
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('invalid_response');
  });

  it('builds same-origin image URLs for asset files and template previews per language', () => {
    const api = createBrandApi({ fetch: fakeFetch({}).fetch });
    expect(api.assetFileUrl(ASSET_LOGO.id)).toBe(`/api/v1/brand/assets/${ASSET_LOGO.id}/file`);
    expect(api.templatePreviewUrl('match-result', 'es')).toBe('/api/v1/templates/match-result/preview?language=es');
    expect(api.templatePreviewUrl('match-result', 'en')).toBe('/api/v1/templates/match-result/preview?language=en');
  });
});

describe('brandApi: registerBrandAsset', () => {
  it('sends the raw PNG with its media type, kind and label in the query and the client header', async () => {
    const { fetch, requests } = fakeFetch({ 'POST /brand/assets': () => jsonResponse(ASSET_LOGO, 201) });
    const file = imageFile('logo.png', 'image/png');

    await expect(
      createBrandApi({ fetch }).registerAsset({ kind: 'brand_logo', label: 'Logotipo sintético & 2', file }),
    ).resolves.toEqual(ASSET_LOGO);

    const request = requests[0];
    expect(request?.method).toBe('POST');
    const url = new URL(request?.url ?? '', 'http://127.0.0.1');
    expect(url.pathname).toBe('/api/v1/brand/assets');
    expect(url.searchParams.get('kind')).toBe('brand_logo');
    expect(url.searchParams.get('label')).toBe('Logotipo sintético & 2');
    expect([...url.searchParams.keys()].sort()).toEqual(['kind', 'label']);
    expect(request?.headers['X-EDR-Client']).toBe('web');
    expect(request?.headers['Content-Type']).toBe('image/png');
    expect(request?.body).toBe(file);
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('same-origin');
    expect(init?.redirect).toBe('error');
  });

  it('sends a JPEG as image/jpeg', async () => {
    const { fetch, requests } = fakeFetch({ 'POST /brand/assets': () => jsonResponse(ASSET_MASCOT, 201) });
    await createBrandApi({ fetch }).registerAsset({
      kind: 'mascot',
      label: 'Mascota',
      file: imageFile('m.jpg', 'image/jpeg'),
    });
    expect(requests[0]?.headers['Content-Type']).toBe('image/jpeg');
  });

  it('refuses any other media type without sending a request', async () => {
    const { fetch } = fakeFetch({});
    const api = createBrandApi({ fetch });
    for (const type of ['image/svg+xml', 'image/gif', 'text/html', '']) {
      await expect(
        api.registerAsset({ kind: 'decoration', label: 'x', file: imageFile('x', type) }),
      ).rejects.toBeInstanceOf(TypeError);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'DUPLICATE_ASSET'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [400, 'VALIDATION_FAILED'],
    [403, 'FORBIDDEN_ORIGIN'],
  ])('turns a %i %s refusal into a problem error', async (status, code) => {
    const { fetch } = fakeFetch({ 'POST /brand/assets': () => problemResponse(status, code) });
    const error = await createBrandApi({ fetch })
      .registerAsset({ kind: 'brand_logo', label: 'Logo', file: imageFile('l.png', 'image/png') })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe('problem');
    expect((error as ApiError).status).toBe(status);
    expect((error as ApiError).problem?.code).toBe(code);
  });

  it('reports a failed connection as a network error and an unexpected body as an invalid response', async () => {
    const failing = fakeFetch({
      'POST /brand/assets': () => {
        throw new TypeError('connection refused');
      },
    });
    const networkError = await createBrandApi({ fetch: failing.fetch })
      .registerAsset({ kind: 'brand_logo', label: 'Logo', file: imageFile('l.png', 'image/png') })
      .catch((caught: unknown) => caught);
    expect((networkError as ApiError).kind).toBe('network');

    const invalid = fakeFetch({ 'POST /brand/assets': () => jsonResponse({ id: 'not-a-uuid' }, 201) });
    const invalidError = await createBrandApi({ fetch: invalid.fetch })
      .registerAsset({ kind: 'brand_logo', label: 'Logo', file: imageFile('l.png', 'image/png') })
      .catch((caught: unknown) => caught);
    expect((invalidError as ApiError).kind).toBe('invalid_response');
  });
});

describe('brandApi: updateBrandAsset', () => {
  it('sends PATCH with a JSON body of the active flag and the client header', async () => {
    const { fetch, requests } = fakeFetch({
      [`PATCH /brand/assets/${ASSET_LOGO.id}`]: () => jsonResponse({ ...ASSET_LOGO, active: false }),
    });
    const updated = await createBrandApi({ fetch }).setAssetActive(ASSET_LOGO.id, false);

    expect(updated.active).toBe(false);
    expect(requests[0]?.method).toBe('PATCH');
    expect(requests[0]?.headers['X-EDR-Client']).toBe('web');
    expect(requests[0]?.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(requests[0]?.body))).toEqual({ active: false });
  });
});

describe('brandApi: media types', () => {
  it('accepts PNG, JPEG and WebP (style references only), never SVG, with a 5 MiB size cap', async () => {
    expect(isAssetMime('image/png')).toBe(true);
    expect(isAssetMime('image/jpeg')).toBe(true);
    expect(isAssetMime('image/webp')).toBe(true);
    expect(isAssetMime('image/svg+xml')).toBe(false);
    expect(MAX_ASSET_BYTES).toBe(5 * 1024 * 1024);
    const { fetch } = fakeFetch({});
    await expect(
      createBrandApi({ fetch }).registerAsset({
        kind: 'brand_logo',
        label: 'x',
        file: imageFile('x.webp', 'image/webp'),
      }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('brandApi: library operations (PD-ARCH-01G-A)', () => {
  it('sends the registration metadata in the query, leaving empty values out', async () => {
    const { fetch, requests } = fakeFetch({ 'POST /brand/assets': () => jsonResponse(ASSET_LOGO, 201) });
    await createBrandApi({ fetch }).registerAsset({
      kind: 'style_reference',
      label: 'Referencia',
      file: imageFile('r.webp', 'image/webp'),
      description: 'Portada',
      usagePolicy: 'reference_only',
      official: false,
      variant: '',
    });
    const query = new URL(requests[0]?.url ?? '', 'http://local').searchParams;
    expect(Object.fromEntries(query)).toEqual({
      kind: 'style_reference',
      label: 'Referencia',
      description: 'Portada',
      usagePolicy: 'reference_only',
      official: 'false',
    });
    expect(requests[0]?.headers['Content-Type']).toBe('image/webp');
  });

  it('reads an asset detail, edits it, deletes it and reads and edits the identity', async () => {
    const { fetch, requests } = fakeFetch({
      [`GET /brand/assets/${ASSET_LOGO.id}`]: () =>
        jsonResponse({ asset: ASSET_LOGO, usage: { renderedVersions: 1, projects: 1, exports: 0 } }),
      [`PATCH /brand/assets/${ASSET_LOGO.id}`]: () => jsonResponse({ ...ASSET_LOGO, label: 'Nuevo' }),
      [`DELETE /brand/assets/${ASSET_LOGO.id}`]: () => new Response(null, { status: 204 }),
      'GET /brand/identity': () => jsonResponse(IDENTITY),
      'PATCH /brand/identity': () => jsonResponse({ ...IDENTITY, description: 'Marca' }),
    });
    const api = createBrandApi({ fetch });
    expect((await api.getAsset(ASSET_LOGO.id)).usage.renderedVersions).toBe(1);
    expect((await api.updateAsset(ASSET_LOGO.id, { label: 'Nuevo', primary: true })).label).toBe('Nuevo');
    await api.deleteAsset(ASSET_LOGO.id);
    expect((await api.getIdentity()).palette).toHaveLength(5);
    expect((await api.updateIdentity({ description: 'Marca' })).description).toBe('Marca');
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      `GET /api/v1/brand/assets/${ASSET_LOGO.id}`,
      `PATCH /api/v1/brand/assets/${ASSET_LOGO.id}`,
      `DELETE /api/v1/brand/assets/${ASSET_LOGO.id}`,
      'GET /api/v1/brand/identity',
      'PATCH /api/v1/brand/identity',
    ]);
    expect(JSON.parse(String(requests[1]?.body))).toEqual({ label: 'Nuevo', primary: true });
    expect(requests[2]?.headers['X-EDR-Client']).toBe('web');
  });

  it('refuses an identity response that does not match the contract', async () => {
    const { fetch } = fakeFetch({ 'GET /brand/identity': () => jsonResponse({ ...IDENTITY, palette: 'gold' }) });
    const error = await createBrandApi({ fetch })
      .getIdentity()
      .catch((caught: unknown) => caught);
    expect((error as ApiError).kind).toBe('invalid_response');
  });
});
