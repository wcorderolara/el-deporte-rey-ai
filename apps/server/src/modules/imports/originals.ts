/**
 * Import originals on disk (data-model.md section 1 "Import originals"; T10-F13, T11H-F01, T11H-F10, T11H-F11).
 *
 * - Path: `<dataDir>/imports/<importId>/original.<json|csv|form.json>`, built from the server-generated UUID and the
 *   channel only, never from a file name; the UUID is checked against the pattern before any path is built (also when
 *   read back from the database).
 * - Containment is checked against `realpath(dataDir)`: the `imports` directory and the import directory must
 *   resolve inside it (no symbolic link can redirect a write or a read).
 * - Directories are created with mode 0700 and the file with the exclusive flag (`wx`) and mode 0600: an original is
 *   never overwritten. The write is synchronous so that the whole application of an import runs without interleaving.
 * - Reading returns the stored bytes after checking their SHA-256 against the record.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

import { contractRegExp } from '@edr/contracts';

import { sha256Hex } from './encoding.js';
import type { ImportChannel } from './repository.js';

const UUID = contractRegExp('Uuid');
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const IMPORTS_DIRECTORY = 'imports';

/** Extension of the stored original per channel. */
export const ORIGINAL_EXTENSIONS: Readonly<Record<ImportChannel, string>> = Object.freeze({
  json_file: 'json',
  csv_file: 'csv',
  form: 'form.json',
});

/** A failure of the original store; its message is fixed text without any path. */
export class OriginalStoreError extends Error {
  override readonly name = 'OriginalStoreError';
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** The relative path (from the data directory) of an import's original. */
export function originalPathOf(importId: string, channel: ImportChannel): string {
  if (!UUID.test(importId)) {
    throw new OriginalStoreError('import ID is not a UUID');
  }
  return `${IMPORTS_DIRECTORY}/${importId}/original.${ORIGINAL_EXTENSIONS[channel]}`;
}

/** Writes an original with the exclusive flag under a realpath-checked UUID directory; returns its relative path. */
export function writeOriginal(dataDir: string, importId: string, channel: ImportChannel, bytes: Uint8Array): string {
  const relativePath = originalPathOf(importId, channel);
  let realData: string;
  try {
    realData = realpathSync(dataDir);
    const importsDir = join(realData, IMPORTS_DIRECTORY);
    mkdirSync(importsDir, { recursive: true, mode: DIRECTORY_MODE });
    const realImports = realpathSync(importsDir);
    if (!isInside(realData, realImports)) {
      throw new OriginalStoreError('the imports directory is outside the data directory');
    }
    const importDir = join(realImports, importId);
    mkdirSync(importDir, { mode: DIRECTORY_MODE });
    const realImportDir = realpathSync(importDir);
    if (!isInside(realImports, realImportDir)) {
      throw new OriginalStoreError('the import directory is outside the data directory');
    }
    writeFileSync(join(realImportDir, `original.${ORIGINAL_EXTENSIONS[channel]}`), bytes, {
      flag: 'wx',
      mode: FILE_MODE,
    });
  } catch (error) {
    throw error instanceof OriginalStoreError ? error : new OriginalStoreError('the original could not be written');
  }
  return relativePath;
}

/**
 * Reads a stored original after checking the stored path against the one built from the import ID and channel, the
 * realpath containment and the SHA-256.
 */
export function readOriginal(
  dataDir: string,
  record: {
    readonly id: string;
    readonly channel: ImportChannel;
    readonly originalPath: string;
    readonly originalSha256: string;
  },
): Buffer {
  const expected = originalPathOf(record.id, record.channel);
  if (record.originalPath !== expected) {
    throw new OriginalStoreError('the stored original path is not the expected path');
  }
  let bytes: Buffer;
  try {
    const realData = realpathSync(dataDir);
    const realFile = realpathSync(join(realData, ...expected.split('/')));
    if (!isInside(realData, realFile)) {
      throw new OriginalStoreError('the original is outside the data directory');
    }
    bytes = readFileSync(realFile);
  } catch (error) {
    throw error instanceof OriginalStoreError ? error : new OriginalStoreError('the original could not be read');
  }
  if (sha256Hex(bytes) !== record.originalSha256) {
    throw new OriginalStoreError('the original does not match its recorded hash');
  }
  return bytes;
}
