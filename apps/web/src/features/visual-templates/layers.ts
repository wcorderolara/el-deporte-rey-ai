/**
 * Pure helpers of the visual template editor (PD-ARCH-01G-C): new layers with safe defaults, unique layer IDs,
 * geometry in canvas fractions (4 decimals, kept inside the canvas), stacking order and the assets each layer type may
 * place. The server validates everything again; these helpers only keep the draft consistent while editing.
 */
import {
  VISUAL_TEMPLATE_BINDINGS,
  VISUAL_TEMPLATE_FIXTURE_LIST_ROWS,
  type BrandAsset,
  type BrandColorRole,
  type VisualTemplateBadgeBinding,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplateFixtureListLayer,
  type VisualTemplateFixtureRow,
  type VisualTemplateFixtureRowPart,
  type VisualTemplateLayer,
  type VisualTemplateLayerType,
  type VisualTemplateTextEffect,
  type VisualTemplateTextStyle,
} from '@edr/contracts';

/** Rounds a fraction of the canvas to 4 decimals and keeps it between 0 and 1. */
export function fraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Math.round(value * 10_000) / 10_000));
}

/** A box kept inside the canvas: the size first (at least 1 %), then the position. */
export function clampBox(box: { x: number; y: number; width: number; height: number }) {
  const width = Math.max(0.01, fraction(box.width));
  const height = Math.max(0.01, fraction(box.height));
  return {
    width,
    height,
    x: fraction(Math.min(Math.max(0, box.x), 1 - width)),
    y: fraction(Math.min(Math.max(0, box.y), 1 - height)),
  };
}

/** Percent shown in a numeric control (2 decimals). */
export function percent(value: number): number {
  return Math.round(value * 10_000) / 100;
}

const PREFIX: Record<VisualTemplateLayerType, string> = {
  text: 'texto',
  sports_data: 'dato',
  image: 'imagen',
  brand_asset: 'marca',
  team_badge: 'escudo',
  fixture_list: 'partidos',
};

/** A layer ID not used by the given layers (contract `LayerId`). */
export function nextLayerId(type: VisualTemplateLayerType, layers: readonly VisualTemplateLayer[]): string {
  const used = new Set(layers.map((layer) => layer.id));
  for (let index = 1; ; index += 1) {
    const candidate = `${PREFIX[type]}-${String(index)}`;
    if (!used.has(candidate)) return candidate;
  }
}

export const DEFAULT_TEXT_STYLE: VisualTemplateTextStyle = {
  fontRole: 'heading',
  maxFontSize: 64,
  minFontSize: 32,
  maxLines: 1,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
  // A soft shadow keeps new text readable over a generated background (decision 01G-C-2).
  effect: 'soft_shadow',
};

/** The bindings available to a content type, in catalogue order. */
export function bindingsFor(contentType: VisualTemplateContentType): VisualTemplateBinding[] {
  return (Object.keys(VISUAL_TEMPLATE_BINDINGS) as VisualTemplateBinding[]).filter((binding) =>
    VISUAL_TEMPLATE_BINDINGS[binding].contentTypes.includes(contentType),
  );
}

/** Drawable, active assets of the library for an `image` layer: graphic elements and backgrounds. */
export function imageAssets(assets: readonly BrandAsset[]): BrandAsset[] {
  return assets.filter(
    (asset) =>
      asset.active &&
      asset.mime !== 'image/webp' &&
      asset.usagePolicy !== 'reference_only' &&
      (asset.kind === 'decoration' || asset.kind === 'background'),
  );
}

/** Active logos and mascots for a `brand_asset` layer (protected assets included: they are placed unchanged). */
export function brandMarkAssets(assets: readonly BrandAsset[], kind?: 'brand_logo' | 'mascot'): BrandAsset[] {
  return assets.filter(
    (asset) =>
      asset.active &&
      asset.mime !== 'image/webp' &&
      asset.usagePolicy !== 'reference_only' &&
      (kind === undefined ? asset.kind === 'brand_logo' || asset.kind === 'mascot' : asset.kind === kind),
  );
}

/** The official mark of a kind to offer first: the primary, else an official one, else the latest active one. */
export function officialMark(assets: readonly BrandAsset[], kind: 'brand_logo' | 'mascot'): BrandAsset | undefined {
  const marks = brandMarkAssets(assets, kind);
  return marks.find((asset) => asset.primary) ?? marks.find((asset) => asset.official) ?? marks.at(-1);
}

/**
 * Active backgrounds of Mi marca that can replace the template background. A protected background is left out: the
 * background covers the canvas and may be cropped, which a protected asset does not allow.
 */
export function backgroundAssets(assets: readonly BrandAsset[]): BrandAsset[] {
  return assets.filter(
    (asset) =>
      asset.active &&
      asset.kind === 'background' &&
      asset.mime !== 'image/webp' &&
      asset.usagePolicy !== 'reference_only' &&
      asset.usagePolicy !== 'protected',
  );
}

/** The zones of PD-ARCH-01G-B for the official marks, as a starting box. */
const MARK_BOX = {
  brand_logo: { x: 0.36, y: 0.03, width: 0.28, height: 0.12 },
  mascot: { x: 0.68, y: 0.6, width: 0.29, height: 0.37 },
} as const;

/** A text style of a match-list row: no effect, as in the built-in round calendar. */
function rowStyle(
  fontRole: VisualTemplateTextStyle['fontRole'],
  maxFontSize: number,
  minFontSize: number,
  maxLines: number,
  colorRole: VisualTemplateTextStyle['colorRole'],
  align: VisualTemplateTextStyle['align'],
): VisualTemplateTextStyle {
  return {
    fontRole,
    maxFontSize,
    minFontSize,
    maxLines,
    colorRole,
    align,
    verticalAlign: 'middle',
    overflow: 'shrink',
  };
}

/** The row of a new match list: the parts of the built-in round calendar (2.0.0) on a 1080 × 1350 canvas. */
function defaultFixtureRow(): VisualTemplateFixtureRow {
  return {
    homeBadge: { x: 0.0157, y: 0.1154, width: 0.0784, height: 0.7692, visible: true },
    homeName: {
      x: 0.1059,
      y: 0,
      width: 0.2941,
      height: 1,
      visible: true,
      style: rowStyle('heading', 30, 18, 2, 'light', 'right'),
    },
    kickoffDate: {
      x: 0.4118,
      y: 0.06,
      width: 0.1765,
      height: 0.3,
      visible: true,
      style: rowStyle('body', 24, 16, 1, 'light', 'center'),
    },
    kickoffTime: {
      x: 0.4118,
      y: 0.36,
      width: 0.1765,
      height: 0.33,
      visible: true,
      style: rowStyle('numeric', 30, 18, 1, 'accent', 'center'),
    },
    status: {
      x: 0.4118,
      y: 0.7,
      width: 0.1765,
      height: 0.26,
      visible: true,
      style: rowStyle('body', 20, 14, 1, 'accent', 'center'),
    },
    awayName: {
      x: 0.6,
      y: 0,
      width: 0.2941,
      height: 1,
      visible: true,
      style: rowStyle('heading', 30, 18, 2, 'light', 'left'),
    },
    awayBadge: { x: 0.9059, y: 0.1154, width: 0.0784, height: 0.7692, visible: true },
  };
}

export type NewLayerRequest =
  | { type: 'text' }
  | { type: 'sports_data' }
  | { type: 'image'; asset: BrandAsset }
  | { type: 'brand_asset'; asset: BrandAsset }
  | { type: 'team_badge'; binding: VisualTemplateBadgeBinding }
  | { type: 'fixture_list' };

/** A new layer with defaults, placed on top of the others. */
export function newLayer(request: NewLayerRequest, layers: readonly VisualTemplateLayer[]): VisualTemplateLayer {
  const id = nextLayerId(request.type, layers);
  const base = { id, visible: true };
  switch (request.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        name: 'Texto',
        x: 0.1,
        y: 0.1,
        width: 0.8,
        height: 0.1,
        text: 'Texto',
        style: { ...DEFAULT_TEXT_STYLE },
      };
    case 'sports_data':
      return {
        ...base,
        type: 'sports_data',
        name: 'Dato deportivo',
        x: 0.1,
        y: 0.45,
        width: 0.8,
        height: 0.1,
        binding: null,
        required: true,
        style: { ...DEFAULT_TEXT_STYLE },
      };
    case 'image':
      return {
        ...base,
        type: 'image',
        name: request.asset.label,
        x: 0.35,
        y: 0.35,
        width: 0.3,
        height: 0.3,
        assetId: request.asset.id,
        fit: request.asset.usagePolicy === 'protected' ? 'contain' : 'cover',
      };
    case 'brand_asset': {
      const box = request.asset.kind === 'mascot' ? MARK_BOX.mascot : MARK_BOX.brand_logo;
      return { ...base, type: 'brand_asset', name: request.asset.label, ...box, assetId: request.asset.id };
    }
    case 'team_badge': {
      // A square box on the side of its team (PD-ARCH-01G-D); the badge is drawn proportionally inside it.
      const home = request.binding === 'match.homeTeam.badge';
      return {
        ...base,
        type: 'team_badge',
        name: home ? 'Escudo local' : 'Escudo visitante',
        x: home ? 0.12 : 0.64,
        y: 0.22,
        width: 0.24,
        height: 0.192,
        binding: request.binding,
      };
    }
    case 'fixture_list':
      // The box is the first row; the slide engine repeats it for each match of the slide (PD-ARCH-01G-E.2).
      return {
        ...base,
        type: 'fixture_list',
        name: 'Lista de partidos',
        x: 0.0278,
        y: 0.2415,
        width: 0.9444,
        height: 0.077,
        rowGap: 0.0074,
        row: defaultFixtureRow(),
      };
  }
}

/** Content types whose slides show one match: the only ones with team badges (PD-ARCH-01G-D). */
export function hasTeamBadges(contentType: VisualTemplateContentType): boolean {
  return contentType === 'match_preview' || contentType === 'fixture' || contentType === 'match_result';
}

/** A match list can be added to a round calendar that has none yet (one per version, PD-ARCH-01G-E.2). */
export function canAddFixtureList(
  contentType: VisualTemplateContentType,
  layers: readonly VisualTemplateLayer[],
): boolean {
  return contentType === 'round_overview' && !layers.some((layer) => layer.type === 'fixture_list');
}

/** The parts of a match-list row drawn as text, with a text style. */
export type FixtureRowTextPart = Exclude<VisualTemplateFixtureRowPart, 'homeBadge' | 'awayBadge'>;

export function isFixtureTextPart(part: VisualTemplateFixtureRowPart): part is FixtureRowTextPart {
  return part !== 'homeBadge' && part !== 'awayBadge';
}

/** The team names of a row: always drawn, so they cannot be hidden. */
export function isFixtureNamePart(part: VisualTemplateFixtureRowPart): boolean {
  return part === 'homeName' || part === 'awayName';
}

/** Changes one part of the row of a match list. */
export function changeFixturePart<P extends VisualTemplateFixtureRowPart>(
  layer: VisualTemplateFixtureListLayer,
  part: P,
  change: Partial<VisualTemplateFixtureRow[P]>,
): VisualTemplateFixtureListLayer {
  return { ...layer, row: { ...layer.row, [part]: { ...layer.row[part], ...change } } };
}

/** The box of each row of a match list, in canvas fractions: row n is `height + rowGap` lower than row n - 1. */
export function fixtureRowBoxes(
  layer: VisualTemplateFixtureListLayer,
): { x: number; y: number; width: number; height: number }[] {
  return Array.from({ length: VISUAL_TEMPLATE_FIXTURE_LIST_ROWS }, (_, index) => ({
    x: layer.x,
    y: layer.y + index * (layer.height + layer.rowGap),
    width: layer.width,
    height: layer.height,
  }));
}

/** Moves a layer one step up (towards the top) or down in the stacking order. */
export function moveLayer(
  layers: readonly VisualTemplateLayer[],
  id: string,
  direction: 'up' | 'down',
): VisualTemplateLayer[] {
  const index = layers.findIndex((layer) => layer.id === id);
  const target = direction === 'up' ? index + 1 : index - 1;
  if (index < 0 || target < 0 || target >= layers.length) return [...layers];
  const next = [...layers];
  const [layer] = next.splice(index, 1);
  if (layer !== undefined) next.splice(target, 0, layer);
  return next;
}

/** Replaces one layer by ID. */
export function replaceLayer(
  layers: readonly VisualTemplateLayer[],
  id: string,
  change: (layer: VisualTemplateLayer) => VisualTemplateLayer,
): VisualTemplateLayer[] {
  return layers.map((layer) => (layer.id === id ? change(layer) : layer));
}

/** An outline drawn with eight shadows (the same technique as the renderer, without the marks of a text stroke). */
function outlineShadows(distance: number, color: string): string[] {
  const diagonal = Math.round(distance * 0.75 * 1000) / 1000;
  return [
    [distance, 0],
    [-distance, 0],
    [0, distance],
    [0, -distance],
    [diagonal, diagonal],
    [-diagonal, -diagonal],
    [diagonal, -diagonal],
    [-diagonal, diagonal],
  ].map(([x, y]) => `${String(x)}em ${String(y)}em 0 ${color}`);
}

/**
 * The CSS text shadow of a text effect for the editor canvas, in `em` so it follows the font size: an approximation of
 * what the renderer draws (the server preview is the reference). Undefined for no effect.
 */
export function effectShadow(
  effect: VisualTemplateTextEffect | undefined,
  palette: Partial<Record<BrandColorRole, string>>,
): string | undefined {
  const shade = 'rgba(0, 0, 0, 0.85)';
  const dark = palette.primaryDark ?? '#000000';
  const accent = palette.accent ?? '#ffffff';
  const primary = palette.primary ?? '#ffffff';
  switch (effect) {
    case undefined:
    case 'none':
      return undefined;
    case 'soft_shadow':
      return `0 0.06em 0.22em ${shade}`;
    case 'strong_shadow':
      return `0 0.1em 0 ${dark}, 0 0 0.4em ${shade}`;
    case 'glow_gold':
      return `0 0 0.3em ${accent}, 0 0 0.12em ${accent}`;
    case 'glow_purple':
      return `0 0 0.3em ${primary}, 0 0 0.12em ${primary}`;
    case 'outline_dark':
      return [...outlineShadows(0.05, dark), `0 0.08em 0.2em ${shade}`].join(', ');
    case 'scoreboard_gold':
      return [...outlineShadows(0.03, accent), `0 0.07em 0.12em ${shade}`].join(', ');
  }
}
