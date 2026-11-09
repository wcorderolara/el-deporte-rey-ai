/** Pure helpers of the visual template editor (PD-ARCH-01G-C). */
import { VisualTemplateLayerSchema } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { asset } from '../brand/testSupport';
import {
  backgroundAssets,
  bindingsFor,
  brandMarkAssets,
  clampBox,
  fraction,
  imageAssets,
  moveLayer,
  newLayer,
  nextLayerId,
  officialMark,
} from './layers';
import { DECORATION, KETSI, LOGO, uuid, version } from './testSupport';

describe('geometry', () => {
  it('rounds fractions to 4 decimals inside the canvas', () => {
    expect(fraction(0.123456)).toBe(0.1235);
    expect(fraction(-1)).toBe(0);
    expect(fraction(3)).toBe(1);
    expect(fraction(Number.NaN)).toBe(0);
  });

  it('keeps a moved or resized box inside the canvas', () => {
    expect(clampBox({ x: 0.9, y: -0.2, width: 0.3, height: 0.2 })).toEqual({ x: 0.7, y: 0, width: 0.3, height: 0.2 });
    expect(clampBox({ x: 0.5, y: 0.5, width: 0, height: 2 })).toEqual({ x: 0.5, y: 0, width: 0.01, height: 1 });
  });
});

describe('layers', () => {
  const { layers } = version();

  it('gives each new layer a free contract-valid ID', () => {
    expect(nextLayerId('sports_data', layers)).toBe('dato-2');
    expect(nextLayerId('text', layers)).toBe('texto-1');
  });

  it('creates schema-valid layers of every type, with protected assets proportional', () => {
    const created = [
      newLayer({ type: 'text' }, layers),
      newLayer({ type: 'sports_data' }, layers),
      newLayer({ type: 'image', asset: DECORATION }, layers),
      newLayer({ type: 'brand_asset', asset: KETSI }, layers),
    ];
    for (const layer of created) {
      expect(VisualTemplateLayerSchema.safeParse(layer).success).toBe(true);
    }
    expect(created[1]).toMatchObject({ binding: null, required: true });
    expect(created[2]).toMatchObject({ fit: 'cover' });
    const protectedImage = newLayer(
      { type: 'image', asset: asset({ id: uuid(0xa9), kind: 'decoration', label: 'Sello', usagePolicy: 'protected' }) },
      layers,
    );
    expect(protectedImage).toMatchObject({ fit: 'contain' });
  });

  it('moves a layer one step in the stacking order and stops at the ends', () => {
    expect(moveLayer(layers, 'marca-1', 'up').map((layer) => layer.id)).toEqual(['dato-1', 'marca-1']);
    expect(moveLayer(layers, 'marca-1', 'down').map((layer) => layer.id)).toEqual(['marca-1', 'dato-1']);
  });
});

describe('catalogue and assets', () => {
  it('offers only the bindings of the content type (no venue, no crest)', () => {
    expect(bindingsFor('round_overview')).toEqual([
      'competition.name',
      'season.label',
      'stage.name',
      'round.name',
      'round.fixtures',
    ]);
    expect(bindingsFor('match_result')).toContain('match.score');
    expect(bindingsFor('match_preview')).not.toContain('match.score');
  });

  it('separates image assets, official marks and backgrounds, never style references or inactive assets', () => {
    const reference = asset({ id: uuid(0xb1), kind: 'style_reference', label: 'Ref', mime: 'image/webp' });
    const inactive = asset({
      id: uuid(0xb2),
      kind: 'decoration',
      label: 'Vieja',
      usagePolicy: 'reusable',
      active: false,
    });
    const background = asset({ id: uuid(0xb3), kind: 'background', label: 'Estadio', usagePolicy: 'reusable' });
    const sealed = asset({ id: uuid(0xb4), kind: 'background', label: 'Fondo oficial', usagePolicy: 'protected' });
    const library = [LOGO, KETSI, DECORATION, reference, inactive, background, sealed];
    expect(imageAssets(library).map((item) => item.label)).toEqual(['Trazo dorado', 'Estadio', 'Fondo oficial']);
    expect(brandMarkAssets(library).map((item) => item.label)).toEqual(['Logotipo oficial', 'Ketsi oficial']);
    expect(backgroundAssets(library).map((item) => item.label)).toEqual(['Estadio']);
    expect(officialMark(library, 'mascot')?.id).toBe(KETSI.id);
    expect(officialMark([DECORATION], 'brand_logo')).toBeUndefined();
  });
});
