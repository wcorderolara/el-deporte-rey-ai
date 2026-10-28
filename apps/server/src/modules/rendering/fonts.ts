/**
 * Bundled slide fonts (architecture.md sections 2.2 and 9; AD-07; OD-07; T10-F09).
 *
 * - The only fonts the renderer knows are the files listed in `BUNDLED_FONT_FILES`, under `assets/fonts/` of the
 *   project. Each file is pinned by its SHA-256; a missing or changed file is refused (no fallback font exists).
 * - The same bytes are given to Satori (layout and glyph outlines), to `opentype.js` (text measurement) and, as file
 *   paths, to resvg (`fontFiles`, with system fonts disabled), so the layout measured is the layout rendered.
 * - The brand configuration names a family and a weight per font role (heading, body, numeric). A role that no
 *   bundled face provides is a configuration error: the renderer never substitutes another face.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import opentype, { type Font } from 'opentype.js';

import type { BrandConfig } from '../../platform/config/index.js';

/** Directory of the bundled fonts, relative to the project root. */
export const FONTS_DIRECTORY = join('assets', 'fonts');

/** A bundled font face. */
export interface BundledFontFile {
  readonly file: string;
  readonly family: string;
  readonly weight: number;
  readonly sha256: string;
}

/** The bundled faces (assets/fonts/README.md): provisional OFL fonts of the brand roles (OD-07, U-02). */
export const BUNDLED_FONT_FILES: readonly BundledFontFile[] = Object.freeze([
  {
    file: 'Montserrat-ExtraBold.ttf',
    family: 'Montserrat',
    weight: 800,
    sha256: '5cf0a23133ccce35f9e115b8dbbf90434201827bc2465d12f9d91bbf02cf9466',
  },
  {
    file: 'Inter-Regular.ttf',
    family: 'Inter',
    weight: 400,
    sha256: 'a414b48aa577ef2c62ebb135341ddeef33ee26a4f5dc9f787f93c1aab08ebb50',
  },
  {
    file: 'Inter-Bold.ttf',
    family: 'Inter',
    weight: 700,
    sha256: 'fbe825cbfc749317f57a1433d3905aa9d3f388732fd29b8e8a36f34845e3bc3e',
  },
]);

/** Font roles of the brand configuration. */
export const FONT_ROLES = ['heading', 'body', 'numeric'] as const;
export type FontRole = (typeof FONT_ROLES)[number];

/** A loaded face: its bytes, its absolute path (for resvg) and the parsed font (for measurement). */
export interface LoadedFontFace extends BundledFontFile {
  readonly path: string;
  readonly data: Buffer;
  readonly font: Font;
}

/** The bundled faces and the face of each brand font role. */
export interface FontSet {
  readonly faces: readonly LoadedFontFace[];
  readonly roles: Readonly<Record<FontRole, LoadedFontFace>>;
}

/** A font file or role problem; fixed messages without paths (T10-F10). */
export class FontError extends Error {
  override readonly name = 'FontError';
}

/**
 * The project's fonts directory, found from this module's location in the source layout
 * (`apps/server/src/modules/rendering`) or the build layout (`apps/server/dist/src/modules/rendering`).
 */
export function bundledFontsDirectory(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const root of [resolve(here, '../../../../..'), resolve(here, '../../../../../..')]) {
    const directory = join(root, FONTS_DIRECTORY);
    if (existsSync(join(root, 'apps', 'server', 'package.json')) && existsSync(directory)) {
      return directory;
    }
  }
  throw new FontError('the bundled fonts directory was not found');
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Reads, checks and parses one bundled face. */
function loadFace(directory: string, entry: BundledFontFile): LoadedFontFace {
  const path = join(directory, entry.file);
  let data: Buffer;
  try {
    data = readFileSync(path);
  } catch {
    throw new FontError('a bundled font file is missing');
  }
  if (sha256(data) !== entry.sha256) {
    throw new FontError('a bundled font file does not match its pinned SHA-256');
  }
  const font = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  return Object.freeze({ ...entry, path, data, font });
}

const cache = new Map<string, readonly LoadedFontFace[]>();

/** The bundled faces of a fonts directory, read and checked once per process. */
export function loadBundledFaces(directory: string = bundledFontsDirectory()): readonly LoadedFontFace[] {
  const cached = cache.get(directory);
  if (cached !== undefined) {
    return cached;
  }
  const faces = Object.freeze(BUNDLED_FONT_FILES.map((entry) => loadFace(directory, entry)));
  cache.set(directory, faces);
  return faces;
}

/** The face of each brand font role; a role without an exact bundled face is refused. */
export function fontSetFor(
  fonts: BrandConfig['fonts'],
  faces: readonly LoadedFontFace[] = loadBundledFaces(),
): FontSet {
  const pick = (role: FontRole): LoadedFontFace => {
    const wanted = fonts[role];
    const face = faces.find((candidate) => candidate.family === wanted.family && candidate.weight === wanted.weight);
    if (face === undefined) {
      throw new FontError(`the ${role} font role names a face that is not bundled`);
    }
    return face;
  };
  return Object.freeze({
    faces,
    roles: Object.freeze({ heading: pick('heading'), body: pick('body'), numeric: pick('numeric') }),
  });
}
