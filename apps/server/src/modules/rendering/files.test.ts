/**
 * Render files (T10-F13, TB-5): paths built from validated UUIDs only, containment against the real data directory,
 * exclusive creation (nothing overwritten, links never followed), owner-only modes.
 */
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RENDERS_DIRECTORY, RenderFileError, RenderFileStore, renderRelativePath } from './files.js';
import { uuid } from './test/support.js';

const PROJECT = uuid(1);
const VERSION = uuid(2);
const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

let root: string;
let dataDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'edr-t34-files-'));
  dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('RenderFileStore', () => {
  it('creates renders/<projectId>/<versionId>.png with owner-only modes and reads it back', async () => {
    const store = new RenderFileStore(dataDir);
    const path = await store.create(PROJECT, VERSION, BYTES);
    expect(path).toBe(`${RENDERS_DIRECTORY}/${PROJECT}/${VERSION}.png`);
    expect(statSync(join(dataDir, path)).mode & 0o777).toBe(0o600);
    expect(statSync(join(dataDir, RENDERS_DIRECTORY)).mode & 0o777).toBe(0o700);
    expect(statSync(join(dataDir, RENDERS_DIRECTORY, PROJECT)).mode & 0o777).toBe(0o700);
    expect(await store.read(PROJECT, VERSION)).toEqual(BYTES);
  });

  it('never overwrites an existing render (exclusive flag)', async () => {
    const store = new RenderFileStore(dataDir);
    await store.create(PROJECT, VERSION, BYTES);
    await expect(store.create(PROJECT, VERSION, Buffer.from('other'))).rejects.toThrow(RenderFileError);
    expect(await store.read(PROJECT, VERSION)).toEqual(BYTES);
  });

  it('refuses IDs that are not UUIDs before building any path', async () => {
    const store = new RenderFileStore(dataDir);
    for (const bad of ['../x', `${PROJECT}/..`, 'ABCDEF00-0000-4000-8000-000000000001', '']) {
      await expect(store.create(bad, VERSION, BYTES)).rejects.toThrow(RenderFileError);
      await expect(store.create(PROJECT, bad, BYTES)).rejects.toThrow(RenderFileError);
      expect(() => renderRelativePath(bad, VERSION)).toThrow(RenderFileError);
    }
  });

  it('refuses a renders directory that is a symbolic link out of the data directory', async () => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(dataDir, RENDERS_DIRECTORY));
    await expect(new RenderFileStore(dataDir).create(PROJECT, VERSION, BYTES)).rejects.toThrow(RenderFileError);
  });

  it('refuses a project directory that is a symbolic link', async () => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    mkdirSync(join(dataDir, RENDERS_DIRECTORY), { mode: 0o700 });
    symlinkSync(outside, join(dataDir, RENDERS_DIRECTORY, PROJECT));
    await expect(new RenderFileStore(dataDir).create(PROJECT, VERSION, BYTES)).rejects.toThrow(RenderFileError);
  });

  it('does not follow a pre-planted link with the file name', async () => {
    const store = new RenderFileStore(dataDir);
    await store.create(PROJECT, uuid(3), BYTES);
    const target = join(root, 'victim.txt');
    writeFileSync(target, 'keep');
    symlinkSync(target, join(dataDir, RENDERS_DIRECTORY, PROJECT, `${VERSION}.png`));
    await expect(store.create(PROJECT, VERSION, BYTES)).rejects.toThrow(RenderFileError);
    await expect(store.read(PROJECT, VERSION)).rejects.toThrow(RenderFileError);
  });

  it('reports a missing file without its path', async () => {
    const error = await new RenderFileStore(dataDir).read(PROJECT, VERSION).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RenderFileError);
    expect(String((error as Error).message)).not.toContain(dataDir);
  });
});
