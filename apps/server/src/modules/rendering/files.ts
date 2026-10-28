/**
 * Rendered slide files under `<dataDir>/renders/<projectId>/<elementVersionId>.png` (architecture.md section 9;
 * data-model.md section 1; T10-F13, TB-5).
 *
 * - Paths are built only from IDs checked against the UUID pattern, also for IDs read back from the database.
 * - Containment is checked against `fs.realpath(dataDir)`: `renders` and the project directory must be plain
 *   directories (not links) that resolve to `<realDataDir>/renders/<projectId>`; a file must resolve inside it.
 * - Directories are created with mode 0700, files with mode 0600 and the exclusive flag (`wx`): a pre-planted file or
 *   link is never followed or overwritten, and a rendered version is never replaced.
 * - Reads open the file without following links and accept only a regular file within the size cap.
 *
 * Errors are `RenderFileError` with fixed messages that never contain a path (T10-F10).
 */
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';

/** Directory of the rendered slides inside the data directory. */
export const RENDERS_DIRECTORY = 'renders';
/** Mode of the render directories: owner only. */
export const RENDER_DIRECTORY_MODE = 0o700;
/** Mode of a rendered file: owner read and write. */
export const RENDER_FILE_MODE = 0o600;
/** Largest rendered file read back (a 4096 x 4096 RGBA PNG stays far below). */
export const MAX_RENDER_FILE_BYTES = 64 * 1024 * 1024;

/** Lowercase UUID (contract schema `Uuid`). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A render file operation failed; the message is fixed text without any path. */
export class RenderFileError extends Error {
  override readonly name = 'RenderFileError';
}

function checkUuid(value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new RenderFileError('a render path ID is not a UUID');
  }
}

/** The path stored in `element_versions.image_path`, relative to the data directory and built from IDs only. */
export function renderRelativePath(projectId: string, versionId: string): string {
  checkUuid(projectId);
  checkUuid(versionId);
  return `${RENDERS_DIRECTORY}/${projectId}/${versionId}.png`;
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

async function plainDirectory(path: string, create: boolean): Promise<string> {
  if (create) {
    try {
      await mkdir(path, { mode: RENDER_DIRECTORY_MODE });
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') {
        throw new RenderFileError('a render directory cannot be created');
      }
    }
  }
  try {
    const status = await lstat(path);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new RenderFileError('a render directory is not a plain directory');
    }
    return await realpath(path);
  } catch (error) {
    throw error instanceof RenderFileError ? error : new RenderFileError('a render directory is not available');
  }
}

/** Creates and reads rendered slide files under one data directory. */
export class RenderFileStore {
  readonly #dataDir: string;

  constructor(dataDir: string) {
    this.#dataDir = dataDir;
  }

  /** The real path of `renders/<projectId>`, created (mode 0700) when `create` is set. */
  async #projectDirectory(projectId: string, create: boolean): Promise<string> {
    checkUuid(projectId);
    let realDataDir: string;
    try {
      realDataDir = await realpath(this.#dataDir);
    } catch {
      throw new RenderFileError('the data directory is not available');
    }
    const renders = await plainDirectory(join(realDataDir, RENDERS_DIRECTORY), create);
    const project = await plainDirectory(join(renders, projectId), create);
    if (relative(realDataDir, project) !== `${RENDERS_DIRECTORY}${sep}${projectId}`) {
      throw new RenderFileError('a render directory is outside the data directory');
    }
    return project;
  }

  /**
   * Writes a new rendered file with the exclusive flag and returns its relative path. Fails when the file (or a link
   * with its name) already exists; nothing is overwritten.
   */
  async create(projectId: string, versionId: string, png: Uint8Array): Promise<string> {
    const relativePath = renderRelativePath(projectId, versionId);
    const directory = await this.#projectDirectory(projectId, true);
    let handle;
    try {
      handle = await open(join(directory, `${versionId}.png`), 'wx', RENDER_FILE_MODE);
    } catch {
      throw new RenderFileError('the render file cannot be created');
    }
    try {
      await handle.writeFile(png);
      await handle.datasync();
    } catch {
      throw new RenderFileError('the render file cannot be written');
    } finally {
      await handle.close();
    }
    return relativePath;
  }

  /** Reads a rendered file, confined to its project directory, within the size cap. */
  async read(projectId: string, versionId: string): Promise<Buffer> {
    checkUuid(versionId);
    const directory = await this.#projectDirectory(projectId, false);
    const name = `${versionId}.png`;
    let realFile: string;
    try {
      realFile = await realpath(join(directory, name));
    } catch {
      throw new RenderFileError('the render file is missing');
    }
    if (dirname(realFile) !== directory || basename(realFile) !== name) {
      throw new RenderFileError('the render file is outside its directory');
    }
    let handle;
    try {
      handle = await open(realFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch {
      throw new RenderFileError('the render file cannot be opened');
    }
    try {
      const status = await handle.stat();
      if (!status.isFile() || status.size < 1 || status.size > MAX_RENDER_FILE_BYTES) {
        throw new RenderFileError('the render file is not a regular file within the size cap');
      }
      return await handle.readFile();
    } catch (error) {
      throw error instanceof RenderFileError ? error : new RenderFileError('the render file cannot be read');
    } finally {
      await handle.close();
    }
  }
}
