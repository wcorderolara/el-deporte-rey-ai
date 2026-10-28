/**
 * Export folder confinement (T10-F13, T10-F15; data-model.md section 2): UUID validation before any path is built,
 * realpath containment, plain directories only, a fresh directory per export, exclusive file creation, fixed file
 * names, owner-only modes, and errors without paths. Temporary directories only.
 */
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ExportFileError, ExportFileStore, exportRelativeDirectory } from './files.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const EXPORT = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

let root = '';
let dataDir = '';
let outside = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'edr-t38-files-'));
  dataDir = join(root, 'data');
  outside = join(root, 'outside');
  mkdirSync(dataDir, { mode: 0o700 });
  mkdirSync(outside, { mode: 0o700 });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

async function refusal(promise: Promise<unknown>): Promise<ExportFileError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ExportFileError);
    expect((error as Error).message).not.toContain(root);
    return error as ExportFileError;
  }
  throw new Error('expected a refusal');
}

describe('exportRelativeDirectory', () => {
  it('builds exports/<projectId>/<exportId> from UUIDs only', () => {
    expect(exportRelativeDirectory(PROJECT, EXPORT)).toBe(`exports/${PROJECT}/${EXPORT}`);
    const upper = 'ABCDEF01-1111-4111-8111-111111111111';
    for (const bad of ['..', '../etc', upper, `${PROJECT}/x`, '', 'a'.repeat(36)]) {
      expect(() => exportRelativeDirectory(bad, EXPORT)).toThrow(ExportFileError);
      expect(() => exportRelativeDirectory(PROJECT, bad)).toThrow(ExportFileError);
    }
  });
});

describe('ExportFileStore', () => {
  it('creates a fresh owner-only folder and owner-only files with the exclusive flag', async () => {
    const store = new ExportFileStore(dataDir);
    const folder = await store.createFolder(PROJECT, EXPORT);
    expect(folder.relativeDirectory).toBe(`exports/${PROJECT}/${EXPORT}`);
    await folder.writeFile('01.png', Buffer.from([1, 2, 3]));
    await folder.writeFile('caption.txt', Buffer.from('texto\n', 'utf8'));
    await folder.writeFile('manifest.json', Buffer.from('{}\n', 'utf8'));
    const directory = join(dataDir, 'exports', PROJECT, EXPORT);
    expect(readdirSync(directory).sort()).toEqual(['01.png', 'caption.txt', 'manifest.json']);
    for (const path of [join(dataDir, 'exports'), join(dataDir, 'exports', PROJECT), directory]) {
      expect(statSync(path).mode & 0o777).toBe(0o700);
    }
    expect(statSync(join(directory, '01.png')).mode & 0o777).toBe(0o600);
    expect([...readFileSync(join(directory, '01.png'))]).toEqual([1, 2, 3]);

    // Nothing is overwritten: the same name again is refused and the first content stays.
    await refusal(folder.writeFile('01.png', Buffer.from([9])));
    expect([...readFileSync(join(directory, '01.png'))]).toEqual([1, 2, 3]);
  });

  it('refuses to reuse an existing export directory (every export is a fresh folder)', async () => {
    const store = new ExportFileStore(dataDir);
    await store.createFolder(PROJECT, EXPORT);
    await refusal(store.createFolder(PROJECT, EXPORT));
    const other = await store.createFolder(PROJECT, OTHER);
    expect(other.relativeDirectory).toBe(`exports/${PROJECT}/${OTHER}`);
  });

  it('refuses IDs that are not UUIDs before touching the file system', async () => {
    const store = new ExportFileStore(dataDir);
    await refusal(store.createFolder('../outside', EXPORT));
    await refusal(store.createFolder(PROJECT, '..'));
    expect(readdirSync(dataDir)).toEqual([]);
  });

  it('refuses file names outside the fixed export names', async () => {
    const folder = await new ExportFileStore(dataDir).createFolder(PROJECT, EXPORT);
    for (const name of ['../escape.png', '1.png', '100.png', 'notes.txt', 'manifest.json/..', '.hidden', '']) {
      await refusal(folder.writeFile(name, Buffer.from('x')));
    }
    expect(readdirSync(join(dataDir, 'exports', PROJECT, EXPORT))).toEqual([]);
    expect(readdirSync(join(dataDir, 'exports', PROJECT))).toEqual([EXPORT]);
  });

  it('refuses an exports directory or a project directory that is a link (containment)', async () => {
    symlinkSync(outside, join(dataDir, 'exports'), 'dir');
    await refusal(new ExportFileStore(dataDir).createFolder(PROJECT, EXPORT));
    expect(readdirSync(outside)).toEqual([]);

    rmSync(join(dataDir, 'exports'));
    mkdirSync(join(dataDir, 'exports'), { mode: 0o700 });
    symlinkSync(outside, join(dataDir, 'exports', PROJECT), 'dir');
    await refusal(new ExportFileStore(dataDir).createFolder(PROJECT, EXPORT));
    expect(readdirSync(outside)).toEqual([]);
  });

  it('refuses a pre-planted link in place of the export directory or of a file', async () => {
    mkdirSync(join(dataDir, 'exports', PROJECT), { recursive: true, mode: 0o700 });
    symlinkSync(outside, join(dataDir, 'exports', PROJECT, EXPORT), 'dir');
    await refusal(new ExportFileStore(dataDir).createFolder(PROJECT, EXPORT));
    expect(readdirSync(outside)).toEqual([]);

    const folder = await new ExportFileStore(dataDir).createFolder(PROJECT, OTHER);
    const target = join(outside, 'target.txt');
    writeFileSync(target, 'original');
    symlinkSync(target, join(dataDir, 'exports', PROJECT, OTHER, 'caption.txt'));
    await refusal(folder.writeFile('caption.txt', Buffer.from('replaced')));
    expect(readFileSync(target, 'utf8')).toBe('original');
    expect(lstatSync(join(dataDir, 'exports', PROJECT, OTHER, 'caption.txt')).isSymbolicLink()).toBe(true);
  });

  it('refuses a missing data directory', async () => {
    await refusal(new ExportFileStore(join(root, 'missing')).createFolder(PROJECT, EXPORT));
  });

  it('accepts a data directory reached through a link (containment uses its real path)', async () => {
    const linked = join(root, 'linked-data');
    symlinkSync(dataDir, linked, 'dir');
    const folder = await new ExportFileStore(linked).createFolder(PROJECT, EXPORT);
    await folder.writeFile('manifest.json', Buffer.from('{}'));
    expect(readdirSync(join(dataDir, 'exports', PROJECT, EXPORT))).toEqual(['manifest.json']);
  });
});
