/**
 * Export folders under `<dataDir>/exports/<projectId>/<exportId>/` (architecture.md section 11.2; data-model.md
 * sections 1 and 2; AD-17, AD-19; T10-F13, T10-F15).
 *
 * - Paths are built only from IDs checked against the UUID pattern (also IDs read back from the database) and from
 *   the fixed file names of an export (`01.png` to `99.png`, `caption.txt`, `copy-editorial.txt`, `manifest.json`).
 * - Containment is checked against `fs.realpath(dataDir)`: `exports` and the project directory must be plain
 *   directories (not links) that resolve to `<realDataDir>/exports/<projectId>`.
 * - Every export gets a fresh directory: it is created with `mkdir` without `recursive`, so an existing directory or
 *   link with the export's name is refused, never reused. Directories have mode 0700.
 * - Files are created with the exclusive flag (`wx`) and mode 0600: a pre-planted file or link is never followed or
 *   overwritten (OD-08: nothing is overwritten or deleted).
 *
 * Errors are `ExportFileError` with fixed messages that never contain a path (T10-F10).
 */
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** Directory of the exports inside the data directory. */
export const EXPORTS_DIRECTORY = 'exports';
/** Mode of the export directories: owner only. */
export const EXPORT_DIRECTORY_MODE = 0o700;
/** Mode of an exported file: owner read and write. */
export const EXPORT_FILE_MODE = 0o600;

/** Lowercase UUID (contract schema `Uuid`). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The file names an export may contain (contract `ExportFile.fileName`). */
export const EXPORT_FILE_NAME_PATTERN = /^([0-9]{2}\.png|caption\.txt|copy-editorial\.txt|manifest\.json)$/;

/** An export file operation failed; the message is fixed text without any path. */
export class ExportFileError extends Error {
  override readonly name = 'ExportFileError';
}

function checkUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new ExportFileError('an export path ID is not a UUID');
  }
}

function checkFileName(name: string): void {
  if (!EXPORT_FILE_NAME_PATTERN.test(name)) {
    throw new ExportFileError('an export file name is not allowed');
  }
}

/** The directory stored in `exports.directory`, relative to the data directory and built from IDs only. */
export function exportRelativeDirectory(projectId: string, exportId: string): string {
  checkUuid(projectId);
  checkUuid(exportId);
  return `${EXPORTS_DIRECTORY}/${projectId}/${exportId}`;
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/** The real path of a plain directory (not a link), created first when `create` is set and it is missing. */
async function plainDirectory(path: string, create: boolean): Promise<string> {
  if (create) {
    try {
      await mkdir(path, { mode: EXPORT_DIRECTORY_MODE });
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') {
        throw new ExportFileError('an export directory cannot be created');
      }
    }
  }
  try {
    const status = await lstat(path);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new ExportFileError('an export directory is not a plain directory');
    }
    return await realpath(path);
  } catch (error) {
    throw error instanceof ExportFileError ? error : new ExportFileError('an export directory is not available');
  }
}

/** A fresh export directory, ready for its files. */
export interface ExportFolder {
  /** Relative to the data directory (`exports/<projectId>/<exportId>`). */
  readonly relativeDirectory: string;
  /** Creates one file with the exclusive flag; fails when a file or link with the name exists. */
  writeFile(name: string, bytes: Uint8Array): Promise<void>;
}

/** Creates export folders and their files under one data directory. */
export class ExportFileStore {
  readonly #dataDir: string;

  constructor(dataDir: string) {
    this.#dataDir = dataDir;
  }

  async #realDataDir(): Promise<string> {
    try {
      return await realpath(this.#dataDir);
    } catch {
      throw new ExportFileError('the data directory is not available');
    }
  }

  /**
   * Creates the fresh directory of an export (mode 0700). Refuses an existing directory, file or link with the
   * export's name, and any `exports` or project directory that is a link or resolves outside the data directory.
   */
  async createFolder(projectId: string, exportId: string): Promise<ExportFolder> {
    const relativeDirectory = exportRelativeDirectory(projectId, exportId);
    const realDataDir = await this.#realDataDir();
    const exportsRoot = await plainDirectory(join(realDataDir, EXPORTS_DIRECTORY), true);
    const project = await plainDirectory(join(exportsRoot, projectId), true);
    if (relative(realDataDir, project) !== `${EXPORTS_DIRECTORY}${sep}${projectId}`) {
      throw new ExportFileError('an export directory is outside the data directory');
    }
    const target = join(project, exportId);
    try {
      await mkdir(target, { mode: EXPORT_DIRECTORY_MODE });
    } catch {
      throw new ExportFileError('the export directory cannot be created fresh');
    }
    const directory = await plainDirectory(target, false);
    if (relative(realDataDir, directory) !== [EXPORTS_DIRECTORY, projectId, exportId].join(sep)) {
      throw new ExportFileError('an export directory is outside the data directory');
    }
    return {
      relativeDirectory,
      writeFile: async (name, bytes) => {
        checkFileName(name);
        let handle;
        try {
          handle = await open(join(directory, name), 'wx', EXPORT_FILE_MODE);
        } catch {
          throw new ExportFileError('an export file cannot be created');
        }
        try {
          await handle.writeFile(bytes);
          await handle.datasync();
        } catch {
          throw new ExportFileError('an export file cannot be written');
        } finally {
          await handle.close();
        }
      },
    };
  }

  /** Reads only named artifacts from a validated export folder; paths from records are never trusted. */
  async readFiles(
    projectId: string,
    exportId: string,
    names: readonly string[],
  ): Promise<readonly { name: string; bytes: Buffer }[]> {
    exportRelativeDirectory(projectId, exportId);
    const realDataDir = await this.#realDataDir();
    const root = await plainDirectory(join(realDataDir, EXPORTS_DIRECTORY), false);
    const project = await plainDirectory(join(root, projectId), false);
    const directory = await plainDirectory(join(project, exportId), false);
    if (relative(realDataDir, directory) !== [EXPORTS_DIRECTORY, projectId, exportId].join(sep)) {
      throw new ExportFileError('an export directory is outside the data directory');
    }
    const files: { name: string; bytes: Buffer }[] = [];
    let total = 0;
    for (const name of names) {
      checkFileName(name);
      try {
        const handle = await open(join(directory, name), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          const stat = await handle.stat();
          if (!stat.isFile()) throw new ExportFileError('an export artifact is not a regular file');
          total += stat.size;
          if (total > 256 * 1024 * 1024) throw new ExportFileError('export artifacts exceed the download limit');
          files.push({ name, bytes: await handle.readFile() });
        } finally {
          await handle.close();
        }
      } catch (error) {
        if (error instanceof ExportFileError) throw error;
        throw new ExportFileError('an export artifact is missing or unreadable');
      }
    }
    return files;
  }
}
