/**
 * Brand asset files under `<dataDir>/brand-assets/` (data-model.md sections 1 and 2; T10-F13; AD-19, OD-08).
 *
 * - File names are generated: `<assetId>.png`, `<assetId>.jpg` or `<assetId>.webp`, with the ID checked against the UUID pattern
 *   before any path is built, also for IDs read back from the database.
 * - Containment is checked against `fs.realpath(dataDir)`: the `brand-assets` directory must resolve to
 *   `<realDataDir>/brand-assets` (a symbolic link elsewhere is refused), and a file must resolve inside it.
 * - The directory is created with mode 0700 and files with mode 0600 and the exclusive flag (`wx`), so a pre-planted
 *   file or link is never followed or overwritten.
 * - Reads open the file without following links, refuse anything that is not a regular file within the upload cap,
 *   and return the bytes for a hash check by the caller.
 *
 * Errors are `BrandFileError` with fixed messages that never contain a path; the platform answers them with 500
 * `INTERNAL` (T10-F10).
 *
 * The same store keeps the AI design proposals (PD-ARCH-01G-B) in their own directory, `design-proposals`, with a
 * larger file cap: one store class, the same containment rules, never the brand directory.
 */
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

import type { BrandAssetMime } from '@edr/contracts';

import { BRAND_UPLOAD_BODY_LIMIT } from '../../platform/http/index.js';

/** Directory of the brand files inside the data directory. */
export const BRAND_ASSET_DIRECTORY = 'brand-assets';
/** Mode of the brand directory: owner only. */
export const BRAND_DIRECTORY_MODE = 0o700;
/** Mode of a brand file: owner read and write. */
export const BRAND_FILE_MODE = 0o600;

/** Lowercase UUID (contract schema `Uuid`). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const EXTENSIONS: Readonly<Record<BrandAssetMime, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** A brand file operation failed; the message is fixed text without any path. */
export class BrandFileError extends Error {
  override readonly name = 'BrandFileError';
}

/** The file extension of a stored MIME type. */
export function brandFileExtension(mime: BrandAssetMime): string {
  return EXTENSIONS[mime];
}

/** The generated file name of an asset (`<id>.png`, `<id>.jpg` or `<id>.webp`); refuses an ID that is not a UUID. */
export function brandFileName(assetId: string, mime: BrandAssetMime): string {
  if (!UUID_PATTERN.test(assetId)) {
    throw new BrandFileError('a brand asset ID is not a UUID');
  }
  return `${assetId}.${brandFileExtension(mime)}`;
}

/** The path stored in `brand_assets.file_path`: relative to the data directory, built from the ID only. */
export function brandRelativePath(assetId: string, mime: BrandAssetMime): string {
  return `${BRAND_ASSET_DIRECTORY}/${brandFileName(assetId, mime)}`;
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== '' && !path.startsWith('..') && !path.startsWith('/') && path === basename(path);
}

/** Where a store keeps its files: a plain directory name inside the data directory, and the largest file read. */
export interface FileStoreLayout {
  readonly directory: string;
  readonly maxFileBytes: number;
}

/** The brand library layout (the default). */
export const BRAND_FILE_LAYOUT: FileStoreLayout = Object.freeze({
  directory: BRAND_ASSET_DIRECTORY,
  maxFileBytes: BRAND_UPLOAD_BODY_LIMIT,
});

/** Creates, reads and discards brand files under one data directory. */
export class BrandFileStore {
  readonly #dataDir: string;
  readonly #layout: FileStoreLayout;

  constructor(dataDir: string, layout: FileStoreLayout = BRAND_FILE_LAYOUT) {
    if (!/^[a-z][a-z-]{0,40}$/.test(layout.directory)) {
      throw new BrandFileError('a file store directory is not a plain name');
    }
    this.#dataDir = dataDir;
    this.#layout = layout;
  }

  /** The stored relative path of a file of this store. */
  relativePath(assetId: string, mime: BrandAssetMime): string {
    return `${this.#layout.directory}/${brandFileName(assetId, mime)}`;
  }

  /** The real path of the brand directory, created with mode 0700 when `create` is set and it is missing. */
  async #directory(create: boolean): Promise<string> {
    let realDataDir: string;
    try {
      realDataDir = await realpath(this.#dataDir);
    } catch {
      throw new BrandFileError('the data directory is not available');
    }
    const directory = join(realDataDir, this.#layout.directory);
    if (create) {
      try {
        await mkdir(directory, { mode: BRAND_DIRECTORY_MODE });
      } catch (error) {
        if (errorCode(error) !== 'EEXIST') {
          throw new BrandFileError('the brand directory cannot be created');
        }
      }
    }
    let realDirectory: string;
    try {
      const status = await lstat(directory);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new BrandFileError('the brand directory is not a plain directory');
      }
      realDirectory = await realpath(directory);
    } catch (error) {
      throw error instanceof BrandFileError ? error : new BrandFileError('the brand directory is not available');
    }
    if (relative(realDataDir, realDirectory) !== this.#layout.directory) {
      throw new BrandFileError('the brand directory is outside the data directory');
    }
    return realDirectory;
  }

  /**
   * Writes a new file with the exclusive flag and returns its relative path. Fails when the file (or a link with
   * its name) already exists; nothing is overwritten.
   */
  async create(assetId: string, mime: BrandAssetMime, content: Uint8Array): Promise<string> {
    const name = brandFileName(assetId, mime);
    const directory = await this.#directory(true);
    const path = join(directory, name);
    let handle;
    try {
      handle = await open(path, 'wx', BRAND_FILE_MODE);
    } catch {
      throw new BrandFileError('the brand file cannot be created');
    }
    let written = false;
    try {
      await handle.writeFile(content);
      await handle.datasync();
      written = true;
    } catch {
      // Handled below, after the handle is closed.
    } finally {
      await handle.close();
    }
    if (!written) {
      // The partial file was created by this call (exclusive flag) and is not registered.
      await unlink(path).catch(() => undefined);
      throw new BrandFileError('the brand file cannot be written');
    }
    return this.relativePath(assetId, mime);
  }

  /**
   * Removes a file this process has just created and that no database row references (a registration that failed
   * after the write, for example a concurrent duplicate). Registered files are never removed (OD-08).
   */
  async discardUnregistered(assetId: string, mime: BrandAssetMime): Promise<void> {
    const name = brandFileName(assetId, mime);
    const directory = await this.#directory(false);
    try {
      await unlink(join(directory, name));
    } catch {
      // Best effort: an unreferenced file is never served or used.
    }
  }

  /** Reads a registered file, confined to the store's directory, at most the store's file cap in size. */
  async read(assetId: string, mime: BrandAssetMime): Promise<Buffer> {
    const name = brandFileName(assetId, mime);
    const directory = await this.#directory(false);
    const path = join(directory, name);
    let realFile: string;
    try {
      realFile = await realpath(path);
    } catch {
      throw new BrandFileError('the brand file is missing');
    }
    if (dirname(realFile) !== directory || !isInside(directory, realFile) || basename(realFile) !== name) {
      throw new BrandFileError('the brand file is outside the brand directory');
    }
    let handle;
    try {
      handle = await open(realFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch {
      throw new BrandFileError('the brand file cannot be opened');
    }
    try {
      const status = await handle.stat();
      if (!status.isFile() || status.size < 1 || status.size > this.#layout.maxFileBytes) {
        throw new BrandFileError('the brand file is not a regular file within the size cap');
      }
      return await handle.readFile();
    } catch (error) {
      throw error instanceof BrandFileError ? error : new BrandFileError('the brand file cannot be read');
    } finally {
      await handle.close();
    }
  }
}
