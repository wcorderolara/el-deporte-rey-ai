/**
 * Bundled fonts (architecture.md section 2.2; OD-07, U-02; OD-33, SOT-4): the committed files match their pinned
 * hashes, carry their OFL licence texts, are plain TrueType (so no WOFF inflate path of Satori or `fflate` runs on
 * them), and the configured brand font roles resolve to bundled faces only.
 */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BUNDLED_FONT_FILES, FontError, bundledFontsDirectory, fontSetFor, loadBundledFaces } from './fonts.js';
import { COMMITTED_FONT_ROLES } from './test/support.js';

const temporary: string[] = [];

afterEach(() => {
  for (const directory of temporary.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('bundled font files', () => {
  it('are present with their pinned SHA-256 and parse', () => {
    const faces = loadBundledFaces();
    expect(faces.map((face) => face.file)).toEqual(BUNDLED_FONT_FILES.map((entry) => entry.file));
    for (const face of faces) {
      expect(face.font.unitsPerEm).toBeGreaterThan(0);
      expect(face.font.charToGlyphIndex('Ñ')).toBeGreaterThan(0);
      expect(face.font.charToGlyphIndex('·')).toBeGreaterThan(0);
    }
  });

  it('are plain TrueType files, never WOFF (no inflate path runs on them, OD-33)', () => {
    for (const face of loadBundledFaces()) {
      expect([...face.data.subarray(0, 4)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    }
  });

  it('ship with the OFL licence texts and the provenance notes', () => {
    const directory = bundledFontsDirectory();
    for (const licence of ['OFL-Montserrat.txt', 'OFL-Inter.txt']) {
      expect(readFileSync(join(directory, licence), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
    const readme = readFileSync(join(directory, 'README.md'), 'utf8');
    for (const entry of BUNDLED_FONT_FILES) {
      expect(readme).toContain(entry.sha256);
    }
  });

  it('refuses a changed font file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'edr-t34-fonts-'));
    temporary.push(directory);
    for (const entry of BUNDLED_FONT_FILES) {
      copyFileSync(join(bundledFontsDirectory(), entry.file), join(directory, entry.file));
    }
    const first = BUNDLED_FONT_FILES[0]?.file ?? '';
    const bytes = readFileSync(join(directory, first));
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    writeFileSync(join(directory, first), bytes);
    expect(() => loadBundledFaces(directory)).toThrow(FontError);
  });

  it('refuses a missing font file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'edr-t34-fonts-'));
    temporary.push(directory);
    expect(() => loadBundledFaces(directory)).toThrow('a bundled font file is missing');
  });
});

describe('fontSetFor', () => {
  it('maps the committed brand roles to the bundled faces', () => {
    const committed = JSON.parse(
      readFileSync(join(bundledFontsDirectory(), '..', '..', 'config', 'brand.json'), 'utf8'),
    ) as {
      fonts: typeof COMMITTED_FONT_ROLES;
    };
    expect(committed.fonts).toEqual(COMMITTED_FONT_ROLES);
    const set = fontSetFor(committed.fonts);
    expect(set.roles.heading.file).toBe('Montserrat-ExtraBold.ttf');
    expect(set.roles.body.file).toBe('Inter-Regular.ttf');
    expect(set.roles.numeric.file).toBe('Inter-Bold.ttf');
  });

  it('refuses a role whose face is not bundled (no substitute font, no system font)', () => {
    expect(() => fontSetFor({ ...COMMITTED_FONT_ROLES, heading: { family: 'Arial', weight: 800 } })).toThrow(FontError);
    expect(() => fontSetFor({ ...COMMITTED_FONT_ROLES, body: { family: 'Inter', weight: 300 } })).toThrow(FontError);
  });
});
