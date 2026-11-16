/** Pure helpers of the visual template editor (PD-ARCH-01G-C). */
import { VISUAL_TEMPLATE_FIXTURE_LIST_ROWS, VisualTemplateLayerSchema } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { asset } from '../brand/testSupport';
import {
  backgroundAssets,
  bindingsFor,
  brandMarkAssets,
  canAddFixtureList,
  changeFixturePart,
  clampBox,
  fixtureRowBoxes,
  fraction,
  imageAssets,
  isFixtureNamePart,
  isFixtureTextPart,
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

describe('match list (PD-ARCH-01G-E.2)', () => {
  const { layers } = version();
  const style = (
    fontRole: string,
    maxFontSize: number,
    minFontSize: number,
    maxLines: number,
    colorRole: string,
    align: string,
  ) => ({
    fontRole,
    maxFontSize,
    minFontSize,
    maxLines,
    colorRole,
    align,
    verticalAlign: 'middle',
    overflow: 'shrink',
  });

  it('creates a schema-valid list with the row of the built-in round calendar 2.0.0', () => {
    const list = newLayer({ type: 'fixture_list' }, layers);
    expect(VisualTemplateLayerSchema.safeParse(list).success).toBe(true);
    expect(list).toEqual({
      id: 'partidos-1',
      type: 'fixture_list',
      name: 'Lista de partidos',
      visible: true,
      x: 0.0278,
      y: 0.2415,
      width: 0.9444,
      height: 0.077,
      rowGap: 0.0074,
      row: {
        homeBadge: { x: 0.0157, y: 0.1154, width: 0.0784, height: 0.7692, visible: true },
        homeName: {
          x: 0.1059,
          y: 0,
          width: 0.2941,
          height: 1,
          visible: true,
          style: style('heading', 30, 18, 2, 'light', 'right'),
        },
        kickoffDate: {
          x: 0.4118,
          y: 0.06,
          width: 0.1765,
          height: 0.3,
          visible: true,
          style: style('body', 24, 16, 1, 'light', 'center'),
        },
        kickoffTime: {
          x: 0.4118,
          y: 0.36,
          width: 0.1765,
          height: 0.33,
          visible: true,
          style: style('numeric', 30, 18, 1, 'accent', 'center'),
        },
        status: {
          x: 0.4118,
          y: 0.7,
          width: 0.1765,
          height: 0.26,
          visible: true,
          style: style('body', 20, 14, 1, 'accent', 'center'),
        },
        awayName: {
          x: 0.6,
          y: 0,
          width: 0.2941,
          height: 1,
          visible: true,
          style: style('heading', 30, 18, 2, 'light', 'left'),
        },
        awayBadge: { x: 0.9059, y: 0.1154, width: 0.0784, height: 0.7692, visible: true },
      },
    });
    // Each new list has its own row: changing one never changes another.
    const other = newLayer({ type: 'fixture_list' }, [...layers, list]);
    expect(other.id).toBe('partidos-2');
    expect(other.type === 'fixture_list' && list.type === 'fixture_list' && other.row !== list.row).toBe(true);
  });

  it('is offered to a round calendar without one, never to other content types', () => {
    const list = newLayer({ type: 'fixture_list' }, layers);
    expect(canAddFixtureList('round_overview', layers)).toBe(true);
    expect(canAddFixtureList('round_overview', [...layers, list])).toBe(false);
    for (const contentType of ['cover', 'match_preview', 'fixture', 'match_result', 'closing'] as const) {
      expect(canAddFixtureList(contentType, layers)).toBe(false);
    }
  });

  it('places the six rows one under the other, a row gap apart', () => {
    const list = newLayer({ type: 'fixture_list' }, layers);
    if (list.type !== 'fixture_list') throw new Error('Expected a match list.');
    const rows = fixtureRowBoxes(list);
    expect(rows).toHaveLength(VISUAL_TEMPLATE_FIXTURE_LIST_ROWS);
    expect(rows[0]).toEqual({ x: 0.0278, y: 0.2415, width: 0.9444, height: 0.077 });
    expect(rows[1]?.y).toBeCloseTo(0.2415 + 0.077 + 0.0074, 6);
    expect(rows[5]?.y).toBeCloseTo(0.2415 + 5 * (0.077 + 0.0074), 6);
    expect(rows.every((row) => row.x === list.x && row.width === list.width && row.height === list.height)).toBe(true);
  });

  it('changes one part of the row and tells text parts and name parts apart', () => {
    const list = newLayer({ type: 'fixture_list' }, layers);
    if (list.type !== 'fixture_list') throw new Error('Expected a match list.');
    const changed = changeFixturePart(list, 'status', { visible: false, y: 0.5 });
    expect(changed.row.status).toEqual({ ...list.row.status, visible: false, y: 0.5 });
    expect(changed.row.kickoffTime).toBe(list.row.kickoffTime);
    expect(list.row.status.visible).toBe(true);
    expect(VisualTemplateLayerSchema.safeParse(changed).success).toBe(true);
    expect(isFixtureTextPart('homeBadge') || isFixtureTextPart('awayBadge')).toBe(false);
    expect(isFixtureTextPart('kickoffDate')).toBe(true);
    expect(isFixtureNamePart('homeName') && isFixtureNamePart('awayName')).toBe(true);
    expect(isFixtureNamePart('status')).toBe(false);
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
