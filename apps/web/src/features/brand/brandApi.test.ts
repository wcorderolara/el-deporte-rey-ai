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
  it('accepts only PNG and JPEG, with a 5 MiB size cap', () => {
    expect(isAssetMime('image/png')).toBe(true);
    expect(isAssetMime('image/jpeg')).toBe(true);
    expect(isAssetMime('image/svg+xml')).toBe(false);
    expect(isAssetMime('image/webp')).toBe(false);
    expect(MAX_ASSET_BYTES).toBe(5 * 1024 * 1024);
  });
});
