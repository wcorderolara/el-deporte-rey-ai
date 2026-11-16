/**
 * Client rules of the brand library (PD-ARCH-01G-A): policies proposed and allowed per category, file and metadata
 * checks before an upload, the primary mark and the search. They mirror the server, which checks everything again.
 */
import { describe, expect, it } from 'vitest';

import {
  ASSET_KINDS,
  acceptFor,
  allowedPolicies,
  canBePrimary,
  checkMetadata,
  checkUpload,
  defaultPolicy,
  filterAssets,
} from './library';
import { asset, ASSET_LOGO, ASSET_MASCOT, ASSET_REFERENCE, imageFile } from './testSupport';

const DRAFT = { kind: 'brand_logo' as const, label: 'Logo', description: '', variant: '', pose: '', expression: '' };

describe('usage policies per category', () => {
  it('never proposes transformable and fixes style references to reference_only', () => {
    expect(ASSET_KINDS.map((kind) => [kind, defaultPolicy(kind)])).toEqual([
      ['brand_logo', 'protected'],
      ['mascot', 'protected'],
      ['decoration', 'reusable'],
      ['background', 'reusable'],
      ['style_reference', 'reference_only'],
    ]);
    expect(allowedPolicies('style_reference')).toEqual(['reference_only']);
    expect(allowedPolicies('background')).toContain('transformable');
    expect(acceptFor('brand_logo')).not.toContain('webp');
    expect(acceptFor('style_reference')).toContain('image/webp');
  });

  it('lets only an active, drawable logo or mascot be primary', () => {
    expect(canBePrimary(ASSET_LOGO)).toBe(true);
    expect(canBePrimary(ASSET_MASCOT)).toBe(false);
    expect(canBePrimary(ASSET_REFERENCE)).toBe(false);
    expect(canBePrimary({ ...ASSET_LOGO, usagePolicy: 'reference_only' })).toBe(false);
  });
});

describe('checks before an upload', () => {
  it('accepts a PNG or JPEG of any category and WebP for style references only', () => {
    expect(checkUpload({ ...DRAFT, file: imageFile('a.png', 'image/png'), dimensions: null })).toEqual({});
    expect(checkUpload({ ...DRAFT, file: imageFile('a.webp', 'image/webp'), dimensions: null }).file).toBeDefined();
    expect(
      checkUpload({ ...DRAFT, kind: 'style_reference', file: imageFile('a.webp', 'image/webp'), dimensions: null }),
    ).toEqual({});
  });

  it('refuses SVG, empty, oversize and over-dimension files and a missing file', () => {
    for (const file of [
      imageFile('a.svg', 'image/svg+xml'),
      imageFile('a.png', 'image/png', 0),
      imageFile('a.png', 'image/png', 5 * 1024 * 1024 + 1),
    ]) {
      expect(checkUpload({ ...DRAFT, file, dimensions: null }).file).toBeDefined();
    }
    expect(
      checkUpload({ ...DRAFT, file: imageFile('a.png', 'image/png'), dimensions: { width: 5000, height: 10 } }).file,
    ).toBeDefined();
    expect(checkUpload({ ...DRAFT, file: null, dimensions: null }).file).toBe('Selecciona un archivo.');
  });

  it('checks the name, description, variant, pose and expression', () => {
    expect(checkMetadata({ ...DRAFT, label: ' ' }).label).toBe('Escribe un nombre.');
    expect(checkMetadata({ ...DRAFT, label: 'x'.repeat(81) }).label).toBeDefined();
    expect(checkMetadata({ ...DRAFT, label: 'Logo​' }).label).toBeDefined();
    expect(checkMetadata({ ...DRAFT, description: 'Línea 1\nLínea 2' })).toEqual({});
    expect(checkMetadata({ ...DRAFT, description: 'x'.repeat(501) }).description).toBeDefined();
    expect(checkMetadata({ ...DRAFT, variant: 'x'.repeat(81) }).variant).toBeDefined();
    expect(checkMetadata({ ...DRAFT, kind: 'mascot', pose: 'x'.repeat(81) }).pose).toBeDefined();
    // Pose on a logo is not shown nor checked (the field does not exist for logos).
    expect(checkMetadata({ ...DRAFT, pose: 'x'.repeat(81) })).toEqual({});
  });
});

describe('search and category filter', () => {
  it('matches names and variants without accents or case, within a category', () => {
    const assets = [
      ASSET_LOGO,
      ASSET_MASCOT,
      asset({ id: '00000000-0000-4000-8000-0000000000e1', kind: 'background', label: 'Estadio Mateo Flores' }),
    ];
    expect(filterAssets(assets, 'mateo', '').map((item) => item.label)).toEqual(['Estadio Mateo Flores']);
    expect(filterAssets(assets, 'PRINCIPAL', '').map((item) => item.id)).toEqual([ASSET_LOGO.id]);
    expect(filterAssets(assets, '', 'mascot').map((item) => item.id)).toEqual([ASSET_MASCOT.id]);
    expect(filterAssets(assets, 'sintética', 'mascot')).toHaveLength(1);
    expect(filterAssets(assets, 'sintetica', 'brand_logo')).toEqual([]);
  });
});
