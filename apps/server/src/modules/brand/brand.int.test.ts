/**
 * Integration tests of the brand routes and the renderer lookup over a temporary data directory (contract
 * operations listBrandAssets, registerBrandAsset, updateBrandAsset, getBrandAssetFile; R-033, R-034, R-228, R-231;
 * PD-03, PD-15, OD-08, OD-41; T10-F12, T10-F13, T11H-F11; AD-14). All images are synthetic.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, symlinkSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { BrandAssetListResponseSchema, BrandAssetSchema, type BrandAsset } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { BRAND_UPLOAD_BODY_LIMIT, SANDBOXED_FILE_CONTENT_SECURITY_POLICY } from '../../platform/http/index.js';

import { resvgDecodeCheck, type ImageDecodeCheck } from './decode.js';
import { brandAssetLookup } from './index.js';
import { gif, ihdr, jpeg, png, pngHeaderOnly, svg, text } from './test/images.js';
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

/** A decode check that counts its calls and delegates to resvg. */
function countingDecode(): { check: ImageDecodeCheck; calls: () => number } {
  let calls = 0;
  return {
    check: async (content, header) => {
      calls += 1;
      return resvgDecodeCheck(content, header);
    },
    calls: () => calls,
  };
}

function upload(
  app: BrandTestApp,
  body: Buffer,
  contentType: string,
  query: Record<string, string> = { kind: 'brand_logo', label: 'Logo principal' },
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/brand/assets',
    query,
    headers: uploadHeaders(contentType),
    payload: body,
  });
}

function patch(app: BrandTestApp, id: string, body: unknown) {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/brand/assets/${id}`,
    headers: JSON_HEADERS,
    payload: JSON.stringify(body),
  });
}

function get(app: BrandTestApp, url: string, method: 'GET' | 'HEAD' = 'GET') {
  return app.inject({ method, url: `/api/v1${url}`, headers: READ_HEADERS });
}

async function register(app: BrandTestApp, body: Buffer, contentType: string, query?: Record<string, string>) {
  const response = await upload(app, body, contentType, query);
  expect(response.statusCode, response.body).toBe(201);
  return BrandAssetSchema.parse(response.json());
}

function rowCount(app: BrandTestApp): number {
  return (app.db.prepare('SELECT COUNT(*) AS n FROM brand_assets').get() as { n: number }).n;
}

function brandFiles(app: BrandTestApp): string[] {
  try {
    return readdirSync(join(app.root.dataDir, 'brand-assets')).sort();
  } catch {
    return [];
  }
}

function expectProblem(response: { statusCode: number; json: () => unknown }, status: number, code: string): void {
  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ status, code });
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('registerBrandAsset', () => {
  it('registers a PNG under a generated name, active, with header dimensions and SHA-256', async () => {
    const app = await start();
    const image = png({ width: 20, height: 10, note: 'logo' });
    const asset = await register(app, image, 'image/png');
    expect(asset).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown as string,
      kind: 'brand_logo',
      label: 'Logo principal',
      mime: 'image/png',
      width: 20,
      height: 10,
      sha256: sha256(image),
      active: true,
      registeredAt: FIXED_NOW,
    });
    const directory = join(app.root.dataDir, 'brand-assets');
    expect(brandFiles(app)).toEqual([`${asset.id}.png`]);
    expect(readFileSync(join(directory, `${asset.id}.png`))).toEqual(image);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, `${asset.id}.png`)).mode & 0o777).toBe(0o600);
    const row = app.db.prepare('SELECT file_path FROM brand_assets WHERE id = ?').get([asset.id]) as {
      file_path: string;
    };
    expect(row.file_path).toBe(`brand-assets/${asset.id}.png`);
  });

  it('registers a JPEG as image/jpeg with a .jpg file, for each allowed kind', async () => {
    const app = await start();
    const mascot = await register(app, jpeg({ width: 24, height: 16 }), 'image/jpeg', {
      kind: 'mascot',
      label: 'Mascota',
    });
    expect(mascot).toMatchObject({ kind: 'mascot', mime: 'image/jpeg', width: 24, height: 16 });
    expect(brandFiles(app)).toEqual([`${mascot.id}.jpg`]);
    const decoration = await register(app, png({ note: 'decoration' }), 'image/png', {
      kind: 'decoration',
      label: 'Franja dorada',
    });
    expect(decoration.kind).toBe('decoration');
  });

  it('accepts a media type with parameters and in another letter case', async () => {
    const app = await start();
    const asset = await register(app, png({ note: 'case' }), 'IMAGE/PNG; charset=binary');
    expect(asset.mime).toBe('image/png');
  });

  it('refuses a duplicate by SHA-256 with 409 DUPLICATE_ASSET, whatever the kind or label', async () => {
    const app = await start();
    const image = png({ note: 'twice' });
    const first = await register(app, image, 'image/png');
    const second = await upload(app, image, 'image/png', { kind: 'mascot', label: 'Otra etiqueta' });
    expectProblem(second, 409, 'DUPLICATE_ASSET');
    expect((second.json() as { detail: string }).detail).toContain(first.id);
    expect(rowCount(app)).toBe(1);
    expect(brandFiles(app)).toEqual([`${first.id}.png`]);
  });

  it('keeps one registration when the same file is uploaded twice concurrently', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = 0;
    const app = await start({
      decodeCheck: async (content, header) => {
        waiting += 1;
        if (waiting === 2) {
          release();
        }
        await gate;
        return resvgDecodeCheck(content, header);
      },
    });
    const image = png({ note: 'race' });
    const responses = await Promise.all([upload(app, image, 'image/png'), upload(app, image, 'image/png')]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(rowCount(app)).toBe(1);
    const created = responses.find((response) => response.statusCode === 201);
    expect(brandFiles(app)).toEqual([`${BrandAssetSchema.parse(created?.json()).id}.png`]);
  });

  describe('file type (PD-15, T10-F12)', () => {
    it('refuses an SVG declared as SVG before the body is read (415)', async () => {
      const app = await start();
      expectProblem(await upload(app, svg(), 'image/svg+xml'), 415, 'UNSUPPORTED_MEDIA_TYPE');
      expect(rowCount(app)).toBe(0);
    });

    it('refuses an SVG, a GIF and a text file renamed and declared as PNG or JPEG (415, by signature)', async () => {
      const decode = countingDecode();
      const app = await start({ decodeCheck: decode.check });
      for (const [body, type] of [
        [svg(), 'image/png'],
        [svg(), 'image/jpeg'],
        [gif(), 'image/png'],
        [text(), 'image/png'],
        [text(), 'image/jpeg'],
      ] as const) {
        const response = await upload(app, body, type);
        expectProblem(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
        expect((response.json() as { detail: string }).detail).toContain('file signature');
      }
      expect(decode.calls()).toBe(0);
      expect(rowCount(app)).toBe(0);
      expect(brandFiles(app)).toEqual([]);
    });

    it('refuses a declared Content-Type that does not match the detected signature (415)', async () => {
      const app = await start();
      for (const [body, type] of [
        [png(), 'image/jpeg'],
        [jpeg(), 'image/png'],
      ] as const) {
        const response = await upload(app, body, type);
        expectProblem(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
        expect((response.json() as { detail: string }).detail).toContain('does not match');
      }
      expect(rowCount(app)).toBe(0);
    });

    it('refuses a JSON or text body on the upload route (415)', async () => {
      const app = await start();
      expectProblem(await upload(app, Buffer.from('{}'), 'application/json'), 415, 'UNSUPPORTED_MEDIA_TYPE');
      expectProblem(await upload(app, text(), 'text/plain'), 415, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('refuses an empty body (400)', async () => {
      const app = await start();
      expectProblem(await upload(app, Buffer.alloc(0), 'image/png'), 400, 'VALIDATION_FAILED');
    });
  });

  describe('size and dimension caps (PD-15, T10-F12)', () => {
    it('refuses a body above 5 MiB with 413 on the upload route', async () => {
      const app = await start();
      const oversize = Buffer.concat([png(), Buffer.alloc(BRAND_UPLOAD_BODY_LIMIT)]);
      expectProblem(await upload(app, oversize, 'image/png'), 413, 'PAYLOAD_TOO_LARGE');
      expect(rowCount(app)).toBe(0);
    });

    it('accepts a body close to 5 MiB on the upload route only; the JSON routes keep the small limit', async () => {
      const app = await start();
      const large = png({ width: 1200, height: 1200, noise: true });
      expect(large.length).toBeGreaterThan(BRAND_UPLOAD_BODY_LIMIT - 512 * 1024);
      expect(large.length).toBeLessThanOrEqual(BRAND_UPLOAD_BODY_LIMIT);
      const asset = await register(app, large, 'image/png');
      expect([asset.width, asset.height]).toEqual([1200, 1200]);
      const big = await app.inject({
        method: 'PATCH',
        url: `/api/v1/brand/assets/${asset.id}`,
        headers: JSON_HEADERS,
        payload: JSON.stringify({ active: false, pad: 'x'.repeat(128 * 1024) }),
      });
      expectProblem(big, 413, 'PAYLOAD_TOO_LARGE');
    });

    it('refuses an oversize dimension from the header, before any decode (400)', async () => {
      const decode = countingDecode();
      const app = await start({ decodeCheck: decode.check });
      for (const [body, type] of [
        [pngHeaderOnly(ihdr(4097, 16)), 'image/png'],
        [pngHeaderOnly(ihdr(16, 30000)), 'image/png'],
        [jpeg({ width: 5000, height: 16, truncated: true }), 'image/jpeg'],
      ] as const) {
        const response = await upload(app, body, type);
        expectProblem(response, 400, 'VALIDATION_FAILED');
        expect((response.json() as { detail: string }).detail).toContain('4096 x 4096');
      }
      expect(decode.calls()).toBe(0);
      expect(rowCount(app)).toBe(0);
    });

    it('accepts the dimension cap on each axis', async () => {
      const app = await start();
      const wide = await register(app, png({ width: 4096, height: 1 }), 'image/png');
      const tall = await register(app, png({ width: 1, height: 4096 }), 'image/png');
      expect([wide.width, wide.height, tall.width, tall.height]).toEqual([4096, 1, 1, 4096]);
    });
  });

  describe('header and decode checks (T10-F12)', () => {
    it('refuses a malformed header (400) without decoding', async () => {
      const decode = countingDecode();
      const app = await start({ decodeCheck: decode.check });
      const response = await upload(app, pngHeaderOnly(ihdr(16, 16), { crc: 'broken' }), 'image/png');
      expectProblem(response, 400, 'VALIDATION_FAILED');
      expect(decode.calls()).toBe(0);
    });

    it('decodes once and refuses corrupt or unsupported images (400), writing nothing', async () => {
      const decode = countingDecode();
      const app = await start({ decodeCheck: decode.check });
      for (const [body, type] of [
        [png({ corruptData: true }), 'image/png'],
        [jpeg({ components: 4 }), 'image/jpeg'],
        [jpeg({ width: 64, height: 64, truncated: true }), 'image/jpeg'],
      ] as const) {
        const response = await upload(app, body, type);
        expectProblem(response, 400, 'VALIDATION_FAILED');
        expect((response.json() as { detail: string }).detail).toContain('cannot be decoded');
      }
      expect(decode.calls()).toBe(3);
      expect(rowCount(app)).toBe(0);
      expect(brandFiles(app)).toEqual([]);
      await register(app, png({ note: 'valid' }), 'image/png');
      expect(decode.calls()).toBe(4);
    });
  });

  describe('query (PD-03, R-231, T10-F03)', () => {
    it('refuses badge and competition-mark kinds and any kind outside the three allowed ones', async () => {
      const decode = countingDecode();
      const app = await start({ decodeCheck: decode.check });
      for (const kind of ['team_badge', 'badge', 'club_badge', 'competition_mark', 'logo', '']) {
        const response = await upload(app, png(), 'image/png', { kind, label: 'Escudo' });
        expectProblem(response, 400, 'VALIDATION_FAILED');
        expect(response.json()).toMatchObject({ errors: [{ path: '/kind' }] });
      }
      const missing = await app.inject({
        method: 'POST',
        url: '/api/v1/brand/assets?label=Logo',
        headers: uploadHeaders('image/png'),
        payload: png(),
      });
      expectProblem(missing, 400, 'VALIDATION_FAILED');
      expect(decode.calls()).toBe(0);
      expect(rowCount(app)).toBe(0);
    });

    it('refuses labels with control or format characters, empty or longer than 80 characters', async () => {
      const app = await start();
      for (const label of ['Logo\u0007', 'Logo​', 'Logo\nprincipal', '‮ogol', '', 'x'.repeat(81)]) {
        const response = await upload(app, png(), 'image/png', { kind: 'brand_logo', label });
        expectProblem(response, 400, 'VALIDATION_FAILED');
        const { errors } = response.json() as { errors: { path: string }[] };
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.every((error) => error.path === '/label')).toBe(true);
        expect(response.body).not.toContain(label === '' ? '\u0000' : label);
      }
      expect(rowCount(app)).toBe(0);
    });

    it('accepts printable labels with accents and symbols, up to 80 characters', async () => {
      const app = await start();
      const asset = await register(app, png({ note: 'accent' }), 'image/png', {
        kind: 'brand_logo',
        label: 'Águila dorada — versión 2 (oficial) ⚽',
      });
      expect(asset.label).toBe('Águila dorada — versión 2 (oficial) ⚽');
      await register(app, png({ note: 'long' }), 'image/png', { kind: 'mascot', label: 'y'.repeat(80) });
    });
  });

  describe('request guards (AD-14)', () => {
    it('refuses an upload without the client header or from a foreign origin (403), before decoding', async () => {
      const decode = countingDecode();
      const app = await start({ decodeCheck: decode.check });
      const noClient = await app.inject({
        method: 'POST',
        url: '/api/v1/brand/assets?kind=brand_logo&label=Logo',
        headers: { host: '127.0.0.1:4300', 'content-type': 'image/png' },
        payload: png(),
      });
      expectProblem(noClient, 403, 'FORBIDDEN_ORIGIN');
      const foreign = await app.inject({
        method: 'POST',
        url: '/api/v1/brand/assets?kind=brand_logo&label=Logo',
        headers: { ...uploadHeaders('image/png'), origin: 'http://attacker.example' },
        payload: png(),
      });
      expectProblem(foreign, 403, 'FORBIDDEN_ORIGIN');
      expect(decode.calls()).toBe(0);
      expect(rowCount(app)).toBe(0);
    });

    it('keeps the image exception on the upload route only: PATCH with an image body is 415', async () => {
      const app = await start();
      const asset = await register(app, png({ note: 'patch' }), 'image/png');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/brand/assets/${asset.id}`,
        headers: uploadHeaders('image/png'),
        payload: png(),
      });
      expectProblem(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
    });
  });
});

describe('listBrandAssets', () => {
  it('lists every asset in registration order with the contract shape, and only reads', async () => {
    const app = await start();
    expect((await get(app, '/brand/assets')).json()).toEqual({ assets: [] });
    const logo = await register(app, png({ note: 'a' }), 'image/png');
    const mascot = await register(app, jpeg({ note: 'b' }), 'image/jpeg', { kind: 'mascot', label: 'Mascota' });
    await patch(app, mascot.id, { active: false });
    const response = await get(app, '/brand/assets');
    expect(response.statusCode).toBe(200);
    const body = BrandAssetListResponseSchema.parse(response.json());
    expect(body.assets.map((asset) => [asset.id, asset.active])).toEqual([
      [logo.id, true],
      [mascot.id, false],
    ]);
    expect(rowCount(app)).toBe(2);
  });
});

describe('updateBrandAsset (OD-08)', () => {
  it('deactivates and reactivates without deleting anything; repeated calls are idempotent', async () => {
    const app = await start();
    const asset = await register(app, png({ note: 'toggle' }), 'image/png');
    const off = await patch(app, asset.id, { active: false });
    expect(off.statusCode).toBe(200);
    expect(BrandAssetSchema.parse(off.json())).toEqual({ ...asset, active: false });
    const stored = () =>
      app.db.prepare('SELECT active, deactivated_at FROM brand_assets WHERE id = ?').get([asset.id]) as {
        active: number;
        deactivated_at: string | null;
      };
    expect(stored()).toEqual({ active: 0, deactivated_at: FIXED_NOW });
    expect((await patch(app, asset.id, { active: false })).statusCode).toBe(200);
    const on = await patch(app, asset.id, { active: true });
    expect(BrandAssetSchema.parse(on.json())).toEqual(asset);
    expect(stored()).toEqual({ active: 1, deactivated_at: null });
    expect(rowCount(app)).toBe(1);
    expect(brandFiles(app)).toEqual([`${asset.id}.png`]);
  });

  it('answers 404 for an unknown asset and 400 for an invalid ID or body', async () => {
    const app = await start();
    const asset = await register(app, png({ note: 'p' }), 'image/png');
    expectProblem(await patch(app, '6f9619ff-8b86-4d01-b42d-00cf4fc964ff', { active: false }), 404, 'NOT_FOUND');
    expectProblem(await patch(app, asset.id.toUpperCase(), { active: false }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, 'not-a-uuid', { active: false }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, asset.id, { active: 'no' }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, asset.id, { active: false, deleted: true }), 400, 'VALIDATION_FAILED');
    expectProblem(await patch(app, asset.id, {}), 400, 'VALIDATION_FAILED');
  });

  it('offers no deletion route', async () => {
    const app = await start();
    const asset = await register(app, png({ note: 'keep' }), 'image/png');
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/brand/assets/${asset.id}`,
      headers: { host: JSON_HEADERS.host, origin: JSON_HEADERS.origin, 'x-edr-client': 'web' },
    });
    expectProblem(response, 404, 'NOT_FOUND');
    expect(rowCount(app)).toBe(1);
  });
});

describe('getBrandAssetFile (T10-F12, T10-F13, OD-41, T11H-F11)', () => {
  it('serves the stored bytes with the stored MIME type and the sandbox headers, without caching', async () => {
    const app = await start();
    const image = jpeg({ note: 'serve' });
    const asset = await register(app, image, 'image/jpeg', { kind: 'mascot', label: 'Mascota' });
    const response = await get(app, `/brand/assets/${asset.id}/file`);
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(image);
    expect(response.headers['content-type']).toBe('image/jpeg');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe(SANDBOXED_FILE_CONTENT_SECURITY_POLICY);
    expect(response.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['etag']).toBeUndefined();
    expect(response.headers['last-modified']).toBeUndefined();
    expect(response.headers['content-disposition']).toBe(`inline; filename="brand-asset-${asset.id}.jpg"`);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves deactivated assets too (the UI preview), and answers HEAD without a body', async () => {
    const app = await start();
    const image = png({ note: 'head' });
    const asset = await register(app, image, 'image/png');
    await patch(app, asset.id, { active: false });
    expect((await get(app, `/brand/assets/${asset.id}/file`)).rawPayload).toEqual(image);
    const head = await get(app, `/brand/assets/${asset.id}/file`, 'HEAD');
    expect(head.statusCode).toBe(200);
    expect(head.headers['content-type']).toBe('image/png');
    expect(head.rawPayload.length).toBe(0);
  });

  it('answers 404 for an unknown ID and 400 for an ID that is not a UUID', async () => {
    const app = await start();
    expectProblem(await get(app, '/brand/assets/6f9619ff-8b86-4d01-b42d-00cf4fc964ff/file'), 404, 'NOT_FOUND');
    expectProblem(await get(app, '/brand/assets/..%2F..%2Fedr.sqlite/file'), 400, 'VALIDATION_FAILED');
    expectProblem(await get(app, '/brand/assets/not-a-uuid/file'), 400, 'VALIDATION_FAILED');
  });

  it('refuses an altered, missing or relinked file and a tampered stored path with 500, revealing no path', async () => {
    const app = await start();
    const first = await register(app, png({ note: 'one' }), 'image/png');
    const second = await register(app, png({ note: 'two' }), 'image/png');
    const third = await register(app, png({ note: 'three' }), 'image/png');
    const fourth = await register(app, png({ note: 'four' }), 'image/png');
    const directory = join(app.root.dataDir, 'brand-assets');

    writeFileSync(join(directory, `${first.id}.png`), png({ note: 'altered' }));
    rmSync(join(directory, `${second.id}.png`));
    const outside = join(app.root.rootDir, 'outside.png');
    writeFileSync(outside, readFileSync(join(directory, `${third.id}.png`)));
    rmSync(join(directory, `${third.id}.png`));
    symlinkSync(outside, join(directory, `${third.id}.png`));
    app.db.prepare('UPDATE brand_assets SET file_path = ? WHERE id = ?').run(['../edr.sqlite', fourth.id]);

    for (const asset of [first, second, third, fourth]) {
      const response = await get(app, `/brand/assets/${asset.id}/file`);
      expectProblem(response, 500, 'INTERNAL');
      expect(response.body).not.toContain(app.root.rootDir);
      expect(response.body).not.toContain('brand-assets');
    }
  });
});

describe('file-system confinement (T10-F13)', () => {
  it('never overwrites a planted file with the generated name (exclusive flag) and records nothing', async () => {
    const id = '0b6a8e2c-3d1f-4c5e-9a7b-6c5d4e3f2a1b';
    const app = await start({ newId: () => id });
    const directory = join(app.root.dataDir, 'brand-assets');
    mkdirSync(directory, { mode: 0o700 });
    writeFileSync(join(directory, `${id}.png`), 'planted');
    expectProblem(await upload(app, png({ note: 'planted' }), 'image/png'), 500, 'INTERNAL');
    expect(readFileSync(join(directory, `${id}.png`), 'utf8')).toBe('planted');
    expect(rowCount(app)).toBe(0);
  });

  it('refuses a generated ID that is not a UUID before building a path', async () => {
    const app = await start({ newId: () => '../../escape' });
    expectProblem(await upload(app, png({ note: 'escape' }), 'image/png'), 500, 'INTERNAL');
    expect(readdirSync(app.root.rootDir).sort()).toEqual(['data']);
    expect(rowCount(app)).toBe(0);
  });

  it('refuses a brand directory that links outside the data directory', async () => {
    const app = await start();
    const elsewhere = join(app.root.rootDir, 'elsewhere');
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, join(app.root.dataDir, 'brand-assets'));
    expectProblem(await upload(app, png({ note: 'link' }), 'image/png'), 500, 'INTERNAL');
    expect(readdirSync(elsewhere)).toEqual([]);
    expect(rowCount(app)).toBe(0);
  });
});

describe('renderer lookup (R-034, R-228, R-231)', () => {
  it('returns the active assets of a kind in registration order and their verified bytes', async () => {
    const app = await start();
    const lookup = brandAssetLookup(app.container);
    expect(lookup.activeAssets('brand_logo')).toEqual([]);
    const logoA = await register(app, png({ note: 'logo-a' }), 'image/png');
    const logoB = await register(app, png({ note: 'logo-b' }), 'image/png', { kind: 'brand_logo', label: 'Logo B' });
    const mascotImage = jpeg({ note: 'mascot' });
    const mascot = await register(app, mascotImage, 'image/jpeg', { kind: 'mascot', label: 'Mascota' });
    await patch(app, logoA.id, { active: false });
    expect(lookup.activeAssets('brand_logo').map((asset) => asset.id)).toEqual([logoB.id]);
    expect(lookup.activeAssets('mascot')).toEqual([mascot]);
    expect(lookup.activeAssets('decoration')).toEqual([]);
    await expect(lookup.readFile(mascot.id)).resolves.toEqual({ asset: mascot, content: mascotImage });
    await expect(lookup.readFile('6f9619ff-8b86-4d01-b42d-00cf4fc964ff')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('keeps a registered asset available after a restart, for every later project (R-228)', async () => {
    const root = createBrandTestRoot();
    try {
      const image = png({ note: 'persisted' });
      let asset: BrandAsset;
      const first = await brandTestApp({ root });
      try {
        asset = await register(first, image, 'image/png');
      } finally {
        await first.close();
      }
      const second = await brandTestApp({ root });
      try {
        const lookup = brandAssetLookup(second.container);
        expect(lookup.activeAssets('brand_logo')).toEqual([asset]);
        await expect(lookup.readFile(asset.id)).resolves.toMatchObject({ content: image });
        expect(BrandAssetListResponseSchema.parse((await get(second, '/brand/assets')).json()).assets).toEqual([asset]);
      } finally {
        await second.close();
      }
    } finally {
      root.remove();
    }
  });
});
