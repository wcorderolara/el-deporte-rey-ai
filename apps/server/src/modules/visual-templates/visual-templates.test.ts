/**
 * Unit tests of the visual template catalogue, contrast and validation (PD-ARCH-01G-C) on synthetic inputs: no
 * database, no file and no network.
 */
import {
  type BrandAsset,
  VISUAL_TEMPLATE_BINDINGS,
  VISUAL_TEMPLATE_FIXTURE_LIST_ROWS,
  type VisualTemplateFixtureListLayer,
  type VisualTemplateLayer,
  type VisualTemplateTextStyle,
  VisualTemplateBindingSchema,
} from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import { measureText } from '../rendering/index.js';
import { PALETTE, testFonts } from '../rendering/test/support.js';
import type { LocalMatchRecord } from '../projects/content-batches/repository.js';

import { BINDING_ELEMENT, type LocalSelectionData, STRESS_VALUES, bindingAllowed, resolveBinding } from './catalog.js';
import { contrastRatio, hexLuminance } from './contrast.js';
import { type ComposeRow, composeItems } from './compose.js';
import { type AssetState, type ValidationInput, usedBindings, validateVersion } from './validation.js';

const fonts = testFonts();

function match(overrides: Partial<LocalMatchRecord> = {}): LocalMatchRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    roundId: '00000000-0000-4000-8000-000000000002',
    status: 'scheduled',
    kickoffAt: '2027-05-10T18:00:00Z',
    homeScore: null,
    awayScore: null,
    homeTeamId: '00000000-0000-4000-8000-000000000003',
    homeTeamName: 'Club Deportivo Ejemplo',
    awayTeamId: '00000000-0000-4000-8000-000000000004',
    awayTeamName: 'Atlético Muestra',
    ...overrides,
  };
}

function data(overrides: Partial<LocalSelectionData> = {}): LocalSelectionData {
  return {
    competitionName: 'Liga Ejemplo',
    seasonLabel: '2026/27',
    stageName: null,
    roundName: 'Jornada 9',
    match: match(),
    roundMatches: [match(), match({ homeTeamName: 'Unión Ficticia', awayTeamName: 'Racing Prueba', kickoffAt: null })],
    displayNames: {},
    ...overrides,
  };
}

describe('binding catalogue', () => {
  it('maps every binding to a text element and a stress value, and limits bindings by content type', () => {
    for (const binding of VisualTemplateBindingSchema.options) {
      expect(BINDING_ELEMENT[binding]).toBeDefined();
      expect(STRESS_VALUES[binding].length).toBeGreaterThan(0);
      expect(VISUAL_TEMPLATE_BINDINGS[binding].contentTypes.length).toBeGreaterThan(0);
    }
    expect(bindingAllowed('match.homeTeam.name', 'match_preview')).toBe(true);
    expect(bindingAllowed('match.score', 'match_preview')).toBe(false);
    expect(bindingAllowed('round.fixtures', 'round_overview')).toBe(true);
    expect(bindingAllowed('match.homeTeam.name', 'round_overview')).toBe(false);
  });

  it('resolves the local values in the display forms of the content generation', () => {
    const values = data();
    expect(resolveBinding('competition.name', values, 'es', -360)).toBe('Liga Ejemplo');
    expect(resolveBinding('season.label', values, 'es', -360)).toBe('2026/27');
    expect(resolveBinding('round.name', values, 'es', -360)).toBe('Jornada 9');
    expect(resolveBinding('match.homeTeam.name', values, 'es', -360)).toBe('Club Deportivo Ejemplo');
    expect(resolveBinding('match.kickoffDate', values, 'es', -360)).toBe('10 may 2027');
    expect(resolveBinding('match.kickoffDate', values, 'en', -360)).toBe('10 May 2027');
    expect(resolveBinding('match.kickoffTime', values, 'es', -360)).toBe('12:00');
    expect(resolveBinding('match.status', values, 'es', -360)).toBe('Programado');
    expect(resolveBinding('match.status', data({ match: match({ status: 'in_progress' }) }), 'en', -360)).toBe(
      'In play',
    );
    expect(resolveBinding('round.fixtures', values, 'es', -360)).toBe(
      'Club Deportivo Ejemplo vs Atlético Muestra · 10 may 2027\nUnión Ficticia vs Racing Prueba',
    );
  });

  it('previews a team with its presentation name by its local ID, and a team without one with its official name (TEAM-DISPLAY-01)', () => {
    const named = data({
      roundMatches: [
        match(),
        match({ homeTeamId: '00000000-0000-4000-8000-000000000005', homeTeamName: 'Unión Ficticia' }),
      ],
      displayNames: { '00000000-0000-4000-8000-000000000003': 'Ejemplo CD' },
    });
    expect(resolveBinding('match.homeTeam.name', named, 'es', -360)).toBe('Ejemplo CD');
    expect(resolveBinding('match.awayTeam.name', named, 'es', -360)).toBe('Atlético Muestra');
    expect(resolveBinding('round.fixtures', named, 'es', -360)).toBe(
      'Ejemplo CD vs Atlético Muestra · 10 may 2027\nUnión Ficticia vs Atlético Muestra · 10 may 2027',
    );
  });

  it('never invents a value: no stage, no kickoff, no score before the end, no match', () => {
    expect(resolveBinding('stage.name', data(), 'es', 0)).toBeNull();
    expect(resolveBinding('match.kickoffTime', data({ match: match({ kickoffAt: null }) }), 'es', 0)).toBeNull();
    const live = data({ match: match({ status: 'in_progress', homeScore: 1, awayScore: 0 }) });
    expect(resolveBinding('match.score', live, 'es', 0)).toBeNull();
    expect(resolveBinding('match.homeScore', live, 'es', 0)).toBeNull();
    const finished = data({ match: match({ status: 'finished', homeScore: 2, awayScore: 1 }) });
    expect(resolveBinding('match.score', finished, 'es', 0)).toBe('2-1');
    expect(resolveBinding('match.awayScore', finished, 'es', 0)).toBe('1');
    expect(resolveBinding('match.homeTeam.name', data({ match: null }), 'es', 0)).toBeNull();
    expect(resolveBinding('round.fixtures', data({ roundMatches: [] }), 'es', 0)).toBeNull();
  });
});

describe('contrast', () => {
  it('computes the WCAG contrast ratio of palette colours', () => {
    expect(contrastRatio(hexLuminance('#FFFFFF'), hexLuminance('#000000'))).toBeCloseTo(21, 5);
    expect(contrastRatio(hexLuminance('#777777'), hexLuminance('#777777'))).toBe(1);
    expect(contrastRatio(hexLuminance(PALETTE.light), hexLuminance(PALETTE.primaryDark))).toBeGreaterThan(10);
  });
});

const STYLE: VisualTemplateTextStyle = {
  fontRole: 'heading',
  maxFontSize: 56,
  minFontSize: 28,
  maxLines: 2,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
};

const BOX = { x: 0.05, y: 0.4, width: 0.42, height: 0.1, visible: true };

function team(id: string, binding: 'match.homeTeam.name' | 'match.awayTeam.name', x: number): VisualTemplateLayer {
  return { ...BOX, x, id, name: id, type: 'sports_data', binding, required: true, style: STYLE };
}

const LOGO_ID = '00000000-0000-4000-8000-000000000010';

function brandAsset(overrides: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: LOGO_ID,
    kind: 'brand_logo',
    label: 'Logo oficial',
    description: null,
    mime: 'image/png',
    width: 64,
    height: 64,
    byteSize: 100,
    sha256: 'ab'.repeat(32),
    usagePolicy: 'protected',
    official: true,
    primary: true,
    variant: null,
    pose: null,
    expression: null,
    active: true,
    registeredAt: '2026-11-06T10:00:00Z',
    updatedAt: '2026-11-06T10:00:00Z',
    ...overrides,
  };
}

function input(layers: VisualTemplateLayer[], overrides: Partial<ValidationInput> = {}): ValidationInput {
  return {
    contentType: 'match_preview',
    canvas: { width: 1080, height: 1350 },
    background: {
      source: 'design_proposal',
      found: true,
      deleted: false,
      approved: true,
      mode: 'guided',
      sentBrandImage: false,
      width: 1024,
      height: 1280,
    },
    layers,
    assets: new Map<string, AssetState>([[LOGO_ID, { asset: brandAsset(), deleted: false }]]),
    fonts,
    palette: { ...PALETTE },
    sampler: () => 0,
    ...overrides,
  };
}

const TEAMS = [team('home', 'match.homeTeam.name', 0.05), team('away', 'match.awayTeam.name', 0.53)];

function codes(result: ReturnType<typeof validateVersion>, severity?: 'error' | 'warning'): string[] {
  return result.issues
    .filter((issue) => severity === undefined || issue.severity === severity)
    .map((issue) => issue.code);
}

describe('validateVersion', () => {
  it('accepts the required data over a dark background, with the review notice of an AI background', () => {
    const result = validateVersion(input(TEAMS));
    expect(result.publishable).toBe(true);
    expect(codes(result)).toEqual(['BACKGROUND_REVIEW']);
  });

  it('requires the values of the content type (the score as one value or both team scores)', () => {
    expect(codes(validateVersion(input([])), 'error')).toEqual([
      'REQUIRED_BINDING_MISSING',
      'REQUIRED_BINDING_MISSING',
    ]);
    const result = validateVersion(input(TEAMS, { contentType: 'match_result' }));
    expect(result.publishable).toBe(false);
    expect(result.issues.find((issue) => issue.code === 'REQUIRED_BINDING_MISSING')?.message).toContain(
      'match.score o match.homeScore + match.awayScore',
    );
    const scores: VisualTemplateLayer[] = [
      {
        ...BOX,
        y: 0.6,
        id: 'hs',
        name: 'hs',
        type: 'sports_data',
        binding: 'match.homeScore',
        required: true,
        style: STYLE,
      },
      {
        ...BOX,
        x: 0.53,
        y: 0.6,
        id: 'as',
        name: 'as',
        type: 'sports_data',
        binding: 'match.awayScore',
        required: true,
        style: STYLE,
      },
    ];
    expect(validateVersion(input([...TEAMS, ...scores], { contentType: 'match_result' })).publishable).toBe(true);
    const hidden = TEAMS.map((layer) => ({ ...layer, visible: false }));
    expect(codes(validateVersion(input(hidden)), 'error')).toContain('REQUIRED_BINDING_MISSING');
  });

  it('reports geometry, font size, binding and fixed-text errors', () => {
    const layers: VisualTemplateLayer[] = [
      ...TEAMS,
      { ...BOX, id: 'out', name: 'out', x: 0.8, y: 0.8, type: 'text', text: 'X', style: STYLE },
      { ...BOX, id: 'tiny', name: 'tiny', y: 0.9, width: 0.001, type: 'image', assetId: LOGO_ID, fit: 'contain' },
      { ...BOX, id: 'sizes', name: 'sizes', y: 0.7, type: 'text', text: 'A', style: { ...STYLE, minFontSize: 80 } },
      {
        ...BOX,
        id: 'unbound',
        name: 'unbound',
        y: 0.2,
        type: 'sports_data',
        binding: null,
        required: false,
        style: STYLE,
      },
      {
        ...BOX,
        id: 'other',
        name: 'other',
        y: 0.0,
        type: 'sports_data',
        binding: 'round.fixtures',
        required: false,
        style: STYLE,
      },
      {
        ...BOX,
        id: 'long',
        name: 'long',
        y: 0.55,
        type: 'text',
        text: 'Un texto fijo demasiado largo para caber en esta caja tan pequeña del lienzo',
        style: { ...STYLE, overflow: 'fixed' },
      },
    ];
    const issues = validateVersion(input(layers)).issues.filter((issue) => issue.severity === 'error');
    expect(issues.map((issue) => `${issue.layerId ?? ''}:${issue.code}`)).toEqual(
      expect.arrayContaining([
        'out:OUT_OF_CANVAS',
        'tiny:TOO_SMALL',
        'tiny:ASSET_NOT_ALLOWED',
        'sizes:FONT_SIZE_INVALID',
        'unbound:BINDING_MISSING',
        'other:BINDING_NOT_ALLOWED',
        'long:TEXT_TOO_LONG',
      ]),
    );
  });

  it('enforces the asset rules: missing, deleted, inactive, reference only, protected only proportional', () => {
    const asset = (id: string, type: 'image' | 'brand_asset', assetId: string, extra = {}): VisualTemplateLayer =>
      type === 'image'
        ? { ...BOX, y: 0.7, id, name: id, type, assetId, fit: 'cover', ...extra }
        : { ...BOX, y: 0.7, id, name: id, type, assetId, ...extra };
    const ids = (n: number) => `00000000-0000-4000-8000-0000000000${String(20 + n)}`;
    const assets = new Map<string, AssetState>([
      [ids(1), { asset: brandAsset({ id: ids(1) }), deleted: true }],
      [ids(2), { asset: brandAsset({ id: ids(2), active: false }), deleted: false }],
      [
        ids(3),
        {
          asset: brandAsset({ id: ids(3), kind: 'style_reference', usagePolicy: 'reference_only', mime: 'image/webp' }),
          deleted: false,
        },
      ],
      [ids(4), { asset: brandAsset({ id: ids(4), kind: 'decoration', usagePolicy: 'protected' }), deleted: false }],
      [ids(5), { asset: brandAsset({ id: ids(5), kind: 'decoration', usagePolicy: 'reusable' }), deleted: false }],
      [ids(6), null],
    ]);
    const layers = [
      ...TEAMS,
      asset('deleted', 'brand_asset', ids(1)),
      asset('inactive', 'brand_asset', ids(2)),
      asset('reference', 'image', ids(3)),
      asset('protected', 'image', ids(4)),
      asset('graphic', 'brand_asset', ids(5)),
      asset('missing', 'image', ids(6)),
    ];
    const result = validateVersion(input(layers, { assets }));
    const errors = result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.layerId ?? ''}:${issue.code}`);
    expect(errors).toEqual(
      expect.arrayContaining([
        'deleted:ASSET_DELETED',
        'inactive:ASSET_INACTIVE',
        'reference:ASSET_NOT_ALLOWED',
        'protected:ASSET_NOT_ALLOWED',
        'graphic:ASSET_NOT_ALLOWED',
        'missing:ASSET_MISSING',
      ]),
    );
    const fine = validateVersion(input([...TEAMS, asset('ok', 'image', ids(5))], { assets }));
    expect(fine.publishable).toBe(true);
  });

  it('warns about overlaps, a covered protected asset, hidden layers, long values and low contrast', () => {
    const logo: VisualTemplateLayer = {
      ...BOX,
      x: 0.36,
      y: 0.03,
      width: 0.28,
      height: 0.12,
      id: 'logo',
      name: 'logo',
      type: 'brand_asset',
      assetId: LOGO_ID,
    };
    const over: VisualTemplateLayer = {
      ...BOX,
      x: 0.4,
      y: 0.05,
      width: 0.2,
      height: 0.05,
      id: 'over',
      name: 'over',
      type: 'text',
      text: 'Hola',
      style: STYLE,
    };
    const twin = { ...team('twin', 'match.homeTeam.name', 0.06) };
    const hidden: VisualTemplateLayer = {
      ...BOX,
      y: 0.8,
      id: 'hidden',
      name: 'hidden',
      type: 'text',
      text: 'Oculto',
      style: STYLE,
      visible: false,
    };
    const tight: VisualTemplateLayer = {
      ...BOX,
      y: 0.6,
      width: 0.12,
      id: 'tight',
      name: 'tight',
      type: 'sports_data',
      binding: 'competition.name',
      required: false,
      style: { ...STYLE, maxLines: 1, overflow: 'fixed' },
    };
    const result = validateVersion(input([...TEAMS, logo, over, twin, hidden, tight], { sampler: () => 1 }));
    const warnings = result.issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => `${issue.layerId ?? ''}:${issue.code}`);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'over:PROTECTED_OVERLAP',
        'twin:OVERLAP',
        'hidden:HIDDEN_LAYER',
        'tight:TEXT_MAY_NOT_FIT',
        'home:LOW_CONTRAST',
      ]),
    );
    expect(result.publishable).toBe(true);
  });

  it('does not warn about contrast under an effect with a dark halo, and measures capital letters as drawn', () => {
    const bright = { sampler: () => 1 };
    expect(codes(validateVersion(input(TEAMS, bright)), 'warning')).toContain('LOW_CONTRAST');
    const shadowed = TEAMS.map((layer) =>
      layer.type === 'sports_data' ? { ...layer, style: { ...STYLE, effect: 'outline_dark' as const } } : layer,
    );
    expect(codes(validateVersion(input(shadowed, bright)), 'warning')).not.toContain('LOW_CONTRAST');
    const glowing = TEAMS.map((layer) =>
      layer.type === 'sports_data' ? { ...layer, style: { ...STYLE, effect: 'glow_gold' as const } } : layer,
    );
    expect(codes(validateVersion(input(glowing, bright)), 'warning')).toContain('LOW_CONTRAST');
    // A text that fits in lower case but not in capital letters (the box is 5 % wider than the lower-case text).
    const width = (measureText('final de temporada', fonts.roles.heading.font, 50) * 1.05) / 1080;
    const fits: VisualTemplateLayer = {
      ...BOX,
      y: 0.7,
      width,
      id: 'fits',
      name: 'fits',
      type: 'text',
      text: 'final de temporada',
      style: { ...STYLE, maxLines: 1, overflow: 'fixed', maxFontSize: 50 },
    };
    const shout = { ...fits, id: 'shout', style: { ...fits.style, uppercase: true } } as VisualTemplateLayer;
    expect(codes(validateVersion(input([...TEAMS, fits])), 'error')).not.toContain('TEXT_TOO_LONG');
    expect(validateVersion(input([...TEAMS, shout])).issues).toContainEqual(
      expect.objectContaining({ code: 'TEXT_TOO_LONG', layerId: 'shout' }),
    );
  });

  it('reports the background: own prompt, brand images sent, aspect ratio, unavailable or inactive source', () => {
    const own = validateVersion(
      input(TEAMS, {
        background: {
          source: 'design_proposal',
          found: true,
          deleted: false,
          approved: true,
          mode: 'own_prompt',
          sentBrandImage: true,
          width: 1024,
          height: 1024,
        },
      }),
    );
    expect(codes(own, 'warning')).toEqual(['BACKGROUND_OWN_PROMPT', 'BACKGROUND_GENERATED_BRAND', 'BACKGROUND_ASPECT']);
    const rejected = validateVersion(
      input(TEAMS, {
        background: {
          source: 'design_proposal',
          found: true,
          deleted: false,
          approved: false,
          mode: 'guided',
          sentBrandImage: false,
          width: 1024,
          height: 1280,
        },
      }),
    );
    expect(codes(rejected, 'error')).toEqual(['BACKGROUND_UNAVAILABLE']);
    const inactive = validateVersion(
      input(TEAMS, {
        background: {
          source: 'brand_asset',
          state: { asset: brandAsset({ kind: 'background', usagePolicy: 'reusable', active: false }), deleted: false },
          width: 1080,
          height: 1350,
        },
      }),
    );
    expect(codes(inactive)).toEqual(['BACKGROUND_UNAVAILABLE']);
  });
});

describe('team badges in a template (PD-ARCH-01G-D)', () => {
  const badgeLayer = (binding: 'match.homeTeam.badge' | 'match.awayTeam.badge'): VisualTemplateLayer => ({
    ...BOX,
    y: 0.1,
    id: binding === 'match.homeTeam.badge' ? 'home-badge' : 'away-badge',
    name: 'Escudo',
    type: 'team_badge',
    binding,
  });

  it('allows team badges only in content types with one match', () => {
    expect(codes(validateVersion(input([...TEAMS, badgeLayer('match.homeTeam.badge')])), 'error')).toEqual([]);
    const calendar: VisualTemplateLayer = {
      ...BOX,
      id: 'fixtures',
      name: 'fixtures',
      type: 'sports_data',
      binding: 'round.fixtures',
      required: true,
      style: STYLE,
    };
    const issues = validateVersion(
      input([calendar, badgeLayer('match.homeTeam.badge')], { contentType: 'round_overview' }),
    ).issues;
    expect(issues).toContainEqual(expect.objectContaining({ code: 'BINDING_NOT_ALLOWED', layerId: 'home-badge' }));
  });

  it('draws a badge proportionally by binding and leaves a missing badge out with a warning', () => {
    const background = {
      id: '00000000-0000-4000-8000-000000000090',
      sha256: 'ab'.repeat(32),
      mime: 'image/png' as const,
    };
    const badge = { id: '00000000-0000-4000-8000-000000000091', sha256: 'cd'.repeat(32), mime: 'image/png' as const };
    const { items, issues } = composeItems(
      { background, layers: [badgeLayer('match.homeTeam.badge'), badgeLayer('match.awayTeam.badge')] },
      {
        text: () => null,
        badge: (binding) => (binding === 'match.homeTeam.badge' ? badge : null),
        asset: () => null,
        rows: () => [],
      },
    );
    expect(items.map((item) => item.id)).toEqual(['background', 'layer-home-badge']);
    expect(items[1]).toMatchObject({ kind: 'image', fit: 'contain', asset: badge });
    expect(issues).toEqual([
      expect.objectContaining({ code: 'VALUE_MISSING', severity: 'warning', layerId: 'away-badge' }),
    ]);
  });

  it('reports a missing required value as an error and an optional one as a warning', () => {
    const background = {
      id: '00000000-0000-4000-8000-000000000090',
      sha256: 'ab'.repeat(32),
      mime: 'image/png' as const,
    };
    const optional: VisualTemplateLayer = {
      ...BOX,
      id: 'stage',
      name: 'stage',
      type: 'sports_data',
      binding: 'stage.name',
      required: false,
      style: STYLE,
    };
    const { items, issues } = composeItems(
      { background, layers: [...TEAMS, optional] },
      { text: () => null, badge: () => null, asset: () => null, rows: () => [] },
    );
    expect(items).toHaveLength(1);
    expect(issues.map((issue) => `${issue.layerId ?? ''}:${issue.severity}`)).toEqual([
      'home:error',
      'away:error',
      'stage:warning',
    ]);
  });
});

describe('match lists of round calendars (PD-ARCH-01G-E.2)', () => {
  const TEXT_STYLE = (overrides: Partial<VisualTemplateTextStyle> = {}): VisualTemplateTextStyle => ({
    ...STYLE,
    maxFontSize: 30,
    minFontSize: 18,
    ...overrides,
  });
  /** The row of the built-in calendar 2.0.0, in fractions (the web editor's defaults). */
  function list(overrides: Partial<VisualTemplateFixtureListLayer> = {}): VisualTemplateFixtureListLayer {
    return {
      id: 'partidos',
      name: 'Lista de partidos',
      type: 'fixture_list',
      x: 0.0278,
      y: 0.2415,
      width: 0.9444,
      height: 0.077,
      visible: true,
      rowGap: 0.0074,
      row: {
        homeBadge: { x: 0.0157, y: 0.1154, width: 0.0784, height: 0.7692, visible: true },
        homeName: { x: 0.1059, y: 0, width: 0.2941, height: 1, visible: true, style: TEXT_STYLE({ align: 'right' }) },
        kickoffDate: {
          x: 0.4118,
          y: 0.06,
          width: 0.1765,
          height: 0.3,
          visible: true,
          style: TEXT_STYLE({ fontRole: 'body', maxFontSize: 24, minFontSize: 16, maxLines: 1 }),
        },
        kickoffTime: {
          x: 0.4118,
          y: 0.36,
          width: 0.1765,
          height: 0.33,
          visible: true,
          style: TEXT_STYLE({ fontRole: 'numeric', maxLines: 1, colorRole: 'accent' }),
        },
        status: {
          x: 0.4118,
          y: 0.7,
          width: 0.1765,
          height: 0.26,
          visible: true,
          style: TEXT_STYLE({ fontRole: 'body', maxFontSize: 20, minFontSize: 14, maxLines: 1, colorRole: 'accent' }),
        },
        awayName: { x: 0.6, y: 0, width: 0.2941, height: 1, visible: true, style: TEXT_STYLE({ align: 'left' }) },
        awayBadge: { x: 0.9059, y: 0.1154, width: 0.0784, height: 0.7692, visible: true },
      },
      ...overrides,
    };
  }
  const calendar = (layers: VisualTemplateLayer[]) => input(layers, { contentType: 'round_overview' });

  it('meets the round calendar requirement and validates the six rows of the default row', () => {
    const result = validateVersion(calendar([list()]));
    expect(codes(result, 'error')).toEqual([]);
    expect(codes(result, 'warning')).toEqual(['BACKGROUND_REVIEW']);
    expect(usedBindings([list()])).toEqual(['round.fixtures']);
    expect(VISUAL_TEMPLATE_FIXTURE_LIST_ROWS).toBe(6);
  });

  it('refuses a list outside a calendar, a second list, rows that leave the canvas and hidden names', () => {
    expect(validateVersion(input([...TEAMS, list()])).issues).toContainEqual(
      expect.objectContaining({ code: 'BINDING_NOT_ALLOWED', severity: 'error', layerId: 'partidos' }),
    );
    const second = list({ id: 'otra', y: 0.05, height: 0.02, rowGap: 0 });
    expect(validateVersion(calendar([list(), second])).issues).toContainEqual(
      expect.objectContaining({ code: 'BINDING_NOT_ALLOWED', severity: 'error', layerId: 'otra' }),
    );
    // The first row fits; the sixth does not.
    const low = validateVersion(calendar([list({ y: 0.6 })]));
    expect(low.issues).toContainEqual(
      expect.objectContaining({
        code: 'OUT_OF_CANVAS',
        severity: 'error',
        message: expect.stringContaining('6 filas'),
      }),
    );
    const row = list().row;
    const hidden = list({ row: { ...row, awayName: { ...row.awayName, visible: false } } });
    expect(codes(validateVersion(calendar([hidden])), 'error')).toEqual(['REQUIRED_BINDING_MISSING']);
    const outside = list({ row: { ...row, awayBadge: { ...row.awayBadge, x: 0.95 } } });
    expect(codes(validateVersion(calendar([outside])), 'error')).toEqual(['OUT_OF_CANVAS']);
    const sizes = list({ row: { ...row, status: { ...row.status, style: TEXT_STYLE({ minFontSize: 40 }) } } });
    expect(codes(validateVersion(calendar([sizes])), 'error')).toEqual(['FONT_SIZE_INVALID']);
  });

  it('warns about parts that overlap, values that may not fit and low contrast in any row', () => {
    const row = list().row;
    const crowded = list({
      row: {
        ...row,
        awayName: { ...row.awayName, width: 0.05, style: TEXT_STYLE({ minFontSize: 28, maxLines: 1 }) },
        kickoffTime: { ...row.kickoffTime, x: 0.3 },
      },
    });
    const result = validateVersion(calendar([crowded]));
    expect(codes(result, 'error')).toEqual([]);
    expect(codes(result, 'warning')).toEqual(
      expect.arrayContaining(['TEXT_MAY_NOT_FIT', 'OVERLAP', 'BACKGROUND_REVIEW']),
    );
    // A light background under the fourth row only.
    const bright = validateVersion(calendar([list()]));
    expect(codes(bright, 'warning')).not.toContain('LOW_CONTRAST');
    const sampler = (box: { y: number }) => (box.y > 0.5 && box.y < 0.6 ? 1 : 0);
    const lowContrast = validateVersion({ ...calendar([list()]), sampler });
    expect(lowContrast.issues.filter((issue) => issue.code === 'LOW_CONTRAST').length).toBeGreaterThan(0);
    // One warning per part at most, whatever the number of low rows.
    const names = lowContrast.issues.filter((issue) => issue.code === 'LOW_CONTRAST').map((issue) => issue.message);
    expect(new Set(names).size).toBe(names.length);
  });

  it('draws one row per match, its badges by row and each value as its own element; reports what is missing', () => {
    const background = {
      id: '00000000-0000-4000-8000-000000000090',
      sha256: 'ab'.repeat(32),
      mime: 'image/png' as const,
    };
    const badge = (n: number) => ({
      id: `00000000-0000-4000-8000-00000000009${String(n)}`,
      sha256: 'cd'.repeat(32),
      mime: 'image/png' as const,
    });
    const run = (text: string, factId: string) => ({ text, factIds: [factId], provenance: 'fact' as const });
    const rows: ComposeRow[] = [
      {
        homeName: run('Club Deportivo Ejemplo B', 'f1'),
        awayName: run('Club Deportivo Ejemplo', 'f2'),
        kickoffDate: run('10 may 2027', 'f3'),
        kickoffTime: run('12:00', 'f3'),
        status: null,
        homeBadge: badge(1),
        awayBadge: badge(2),
      },
      {
        homeName: run('Unión Ficticia', 'f4'),
        awayName: run('Racing Prueba', 'f5'),
        kickoffDate: run('11 may 2027', 'f6'),
        kickoffTime: run('18:30', 'f6'),
        status: run('Aplazado', 'f7'),
        homeBadge: null,
        awayBadge: badge(3),
      },
    ];
    const { items, issues } = composeItems(
      { background, layers: [list()] },
      { text: () => null, badge: () => null, asset: () => null, rows: () => rows },
    );
    expect(items.map((item) => item.id)).toEqual([
      'background',
      'layer-partidos-r1-home-badge',
      'layer-partidos-r1-away-badge',
      'layer-partidos-r1-home',
      'layer-partidos-r1-date',
      'layer-partidos-r1-time',
      'layer-partidos-r1-away',
      'layer-partidos-r2-away-badge',
      'layer-partidos-r2-home',
      'layer-partidos-r2-date',
      'layer-partidos-r2-time',
      'layer-partidos-r2-status',
      'layer-partidos-r2-away',
    ]);
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get('layer-partidos-r1-home-badge')).toMatchObject({ kind: 'image', fit: 'contain', asset: badge(1) });
    expect(byId.get('layer-partidos-r2-away')).toMatchObject({
      kind: 'text',
      field: 'fixtures',
      semantic: 'team_name',
      run: rows[1]?.awayName,
    });
    expect(byId.get('layer-partidos-r2-status')).toMatchObject({ semantic: 'match_status' });
    // Row 2 sits one row height and one gap below row 1.
    const first = byId.get('layer-partidos-r1-home')?.box;
    const second = byId.get('layer-partidos-r2-home')?.box;
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBeCloseTo(0.077 + 0.0074, 6);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'VALUE_MISSING',
        severity: 'warning',
        layerId: 'partidos',
        message: expect.stringContaining('partido 2, escudo local'),
      }),
    ]);

    const missingName = composeItems(
      { background, layers: [list()] },
      {
        text: () => null,
        badge: () => null,
        asset: () => null,
        rows: () => [{ ...(rows[0] as ComposeRow), awayName: null }],
      },
    );
    expect(missingName.issues).toContainEqual(expect.objectContaining({ code: 'VALUE_MISSING', severity: 'error' }));
    const none = composeItems(
      { background, layers: [list()] },
      { text: () => null, badge: () => null, asset: () => null, rows: () => [] },
    );
    expect(none.issues).toEqual([expect.objectContaining({ code: 'VALUE_MISSING', severity: 'error' })]);
    const seven = composeItems(
      { background, layers: [list()] },
      {
        text: () => null,
        badge: () => null,
        asset: () => null,
        rows: () => Array.from({ length: 7 }, () => rows[0] as ComposeRow),
      },
    );
    expect(seven.items).toHaveLength(1);
    expect(seven.issues).toEqual([expect.objectContaining({ code: 'TEXT_OVERFLOW', severity: 'error' })]);
  });
});
