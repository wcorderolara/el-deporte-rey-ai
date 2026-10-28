/**
 * Unit tests of the brand file store (T10-F13; OD-08): generated names from validated UUIDs, the realpath-checked
 * brand directory (mode 0700), exclusive creation (mode 0600), confined reads that never follow links, and the size
 * cap. Temporary directories only.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BRAND_UPLOAD_BODY_LIMIT } from '../../platform/http/index.js';

import { BrandFileError, BrandFileStore, brandFileName, brandRelativePath } from './storage.js';
import { type BrandTestRoot, createBrandTestRoot } from './test/support.js';

const ID = '3f0c1d2e-4b5a-4c6d-8e7f-901234567890';
const OTHER_ID = '7a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d';
const CONTENT = Buffer.from('synthetic brand bytes');

const roots: BrandTestRoot[] = [];

function root(): BrandTestRoot {
  const created = createBrandTestRoot();
  roots.push(created);
  return created;
}

afterEach(() => {
  for (const created of roots.splice(0)) {
    created.remove();
  }
});

describe('brand file names', () => {
  it('builds names and relative paths from the ID and the MIME type only', () => {
    expect(brandFileName(ID, 'image/png')).toBe(`${ID}.png`);
    expect(brandFileName(ID, 'image/jpeg')).toBe(`${ID}.jpg`);
    expect(brandRelativePath(ID, 'image/png')).toBe(`brand-assets/${ID}.png`);
  });

  it('refuses IDs that are not lowercase UUIDs before building a path', () => {
    for (const id of ['../escape', `${ID}/..`, ID.toUpperCase(), '', `${ID}\n`, 'brand-assets']) {
      expect(() => brandFileName(id, 'image/png')).toThrow(BrandFileError);
    }
  });
});

describe('BrandFileStore', () => {
  it('creates the directory with mode 0700 and the file with mode 0600', async () => {
    const { dataDir } = root();
    const store = new BrandFileStore(dataDir);
    await expect(store.create(ID, 'image/png', CONTENT)).resolves.toBe(`brand-assets/${ID}.png`);
    const directory = join(dataDir, 'brand-assets');
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, `${ID}.png`)).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(directory, `${ID}.png`))).toEqual(CONTENT);
    await expect(store.read(ID, 'image/png')).resolves.toEqual(CONTENT);
  });

  it('never overwrites: an existing file or a planted link with the generated name is refused', async () => {
    const { dataDir, rootDir } = root();
    const store = new BrandFileStore(dataDir);
    await store.create(ID, 'image/png', CONTENT);
    await expect(store.create(ID, 'image/png', Buffer.from('other'))).rejects.toThrow(BrandFileError);
    expect(readFileSync(join(dataDir, 'brand-assets', `${ID}.png`))).toEqual(CONTENT);

    const outside = join(rootDir, 'outside.png');
    writeFileSync(outside, 'outside content');
    symlinkSync(outside, join(dataDir, 'brand-assets', `${OTHER_ID}.png`));
    await expect(store.create(OTHER_ID, 'image/png', CONTENT)).rejects.toThrow(BrandFileError);
    expect(readFileSync(outside, 'utf8')).toBe('outside content');
  });

  it('refuses a brand directory that is a link to another place', async () => {
    const { dataDir, rootDir } = root();
    const elsewhere = join(rootDir, 'elsewhere');
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, join(dataDir, 'brand-assets'));
    const store = new BrandFileStore(dataDir);
    await expect(store.create(ID, 'image/png', CONTENT)).rejects.toThrow(BrandFileError);
    await expect(store.read(ID, 'image/png')).rejects.toThrow(BrandFileError);
    expect(readdirSync(elsewhere)).toEqual([]);
  });

  it('refuses to read a file replaced by a link, a directory, an empty file or a file above the cap', async () => {
    const { dataDir, rootDir } = root();
    const store = new BrandFileStore(dataDir);
    await store.create(ID, 'image/png', CONTENT);
    const directory = join(dataDir, 'brand-assets');

    const outside = join(rootDir, 'secret.txt');
    writeFileSync(outside, 'not a brand file');
    symlinkSync(outside, join(directory, `${OTHER_ID}.png`));
    await expect(store.read(OTHER_ID, 'image/png')).rejects.toThrow(BrandFileError);

    mkdirSync(join(directory, `${OTHER_ID}.jpg`));
    await expect(store.read(OTHER_ID, 'image/jpeg')).rejects.toThrow(BrandFileError);

    const third = '0e1d2c3b-4a59-4687-a5b4-c3d2e1f0a9b8';
    writeFileSync(join(directory, `${third}.png`), '');
    await expect(store.read(third, 'image/png')).rejects.toThrow(BrandFileError);
    writeFileSync(join(directory, `${third}.jpg`), Buffer.alloc(BRAND_UPLOAD_BODY_LIMIT + 1));
    await expect(store.read(third, 'image/jpeg')).rejects.toThrow(BrandFileError);
  });

  it('reports a missing file or data directory without any path in the message', async () => {
    const { dataDir } = root();
    const store = new BrandFileStore(dataDir);
    const missing = await store.read(ID, 'image/png').catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(BrandFileError);
    expect((missing as Error).message).not.toContain(dataDir);
    const gone = new BrandFileStore(join(dataDir, 'absent'));
    const error = await gone.create(ID, 'image/png', CONTENT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BrandFileError);
    expect((error as Error).message).not.toContain(dataDir);
  });

  it('discards only the named unregistered file', async () => {
    const { dataDir } = root();
    const store = new BrandFileStore(dataDir);
    await store.create(ID, 'image/png', CONTENT);
    await store.create(OTHER_ID, 'image/png', CONTENT);
    await store.discardUnregistered(ID, 'image/png');
    expect(existsSync(join(dataDir, 'brand-assets', `${ID}.png`))).toBe(false);
    expect(existsSync(join(dataDir, 'brand-assets', `${OTHER_ID}.png`))).toBe(true);
  });
});
