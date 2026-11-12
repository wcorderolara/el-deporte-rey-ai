/**
 * Validation of a visual template version (PD-ARCH-01G-C): deterministic checks of the document, its assets and its
 * background. An `error` blocks publication; a `warning` is for the operator to review. No check claims a perfect
 * visual result: the operator keeps the final approval.
 *
 * Errors: a layer outside the canvas or too small; a team badge layer in a content type without a match; a minimum font size above the maximum; a sports-data layer without
 * a binding or with a binding the content type does not have; a value the content type requires that no visible layer
 * shows; a missing, deleted, inactive or not allowed asset (style references, `reference_only`, WebP, a logo or mascot
 * in an image layer, a protected asset that is not scaled proportionally); fixed text that does not fit; an unusable
 * background.
 *
 * Warnings: overlapping text, a layer over a protected asset, a long value that may not fit, low contrast over the
 * background (not checked under a text effect with a dark halo), a hidden layer, no layer, a background of another
 * aspect ratio, and the review notices of a background made by AI (guided, own prompt, brand images sent to the
 * provider). Text is measured as it is drawn, in capital letters when the style asks for it.
 *
 * A match list (`fixture_list`, PD-ARCH-01G-E.2) is checked as all its rows together (`fixture-list.ts`): errors when
 * it is not in a round calendar, when the version has another list, when its rows leave the canvas, when a part leaves
 * its row or is too small, when a team name is hidden (PD-28 point 4) or a minimum font size is above the maximum;
 * warnings when a long value may not fit a part, when a part has low contrast over the background in any row, and
 * when two parts of the row overlap.
 */
import {
  type BrandAsset,
  VISUAL_TEMPLATE_FIXTURE_LIST_ROWS,
  VISUAL_TEMPLATE_REQUIRED_BINDINGS,
  type VisualTemplateBadgeBinding,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplateIssue,
  type VisualTemplateLayer,
  type VisualTemplateValidation,
} from '@edr/contracts';

import { type FontSet, type FractionBox, type Palette, layoutTextBox, pixelBox } from '../rendering/index.js';

import { STRESS_VALUES, bindingAllowed } from './catalog.js';
import {
  FIXTURE_ROW_BADGE_PARTS,
  FIXTURE_ROW_TEXT_PARTS,
  type FixtureRowBadgePart,
  type FixtureRowTextPart,
  type Fractions,
  layerArea,
  partBox,
  rowBox,
} from './fixture-list.js';
import { issueOf } from './issues.js';
import { type LuminanceSampler, contrastRatio, hexLuminance } from './contrast.js';

/** The smallest layer side, in canvas pixels. */
export const MIN_LAYER_PIXELS = 8;
/** Tolerance of the canvas edges (fractions are stored with 4 decimals). */
const EDGE = 1e-6;
/** Text at or above this size (canvas pixels) is large text for contrast (WCAG: 3:1 instead of 4.5:1). */
const LARGE_TEXT = 24;
/** Effects with a dark halo around the letters (decision 01G-C-2): the text reads over any background. */
const DARK_HALO: ReadonlySet<string> = new Set(['soft_shadow', 'strong_shadow', 'outline_dark', 'scoreboard_gold']);

/** A brand asset as found for a layer: missing, or the asset with whether it was deleted. */
export type AssetState = { readonly asset: BrandAsset; readonly deleted: boolean } | null;

/** The background as found when validating. */
export type BackgroundState =
  | {
      readonly source: 'design_proposal';
      readonly found: boolean;
      readonly deleted: boolean;
      readonly approved: boolean;
      readonly mode: 'guided' | 'own_prompt';
      /** A logo or the mascot was sent to the provider as an image (it may appear redrawn by the AI). */
      readonly sentBrandImage: boolean;
    }
  | {
      readonly source: 'brand_asset';
      readonly state: AssetState;
    };

export interface ValidationInput {
  readonly contentType: VisualTemplateContentType;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly background: BackgroundState & { readonly width: number; readonly height: number };
  readonly layers: readonly VisualTemplateLayer[];
  readonly assets: ReadonlyMap<string, AssetState>;
  readonly fonts: FontSet;
  readonly palette: Palette;
  /** Luminance under a box; null when the background could not be read. */
  readonly sampler: LuminanceSampler | null;
}

function intersects(a: FractionBox, b: FractionBox): boolean {
  return (
    a.x + a.width > b.x + EDGE &&
    b.x + b.width > a.x + EDGE &&
    a.y + a.height > b.y + EDGE &&
    b.y + b.height > a.y + EDGE
  );
}

function isText(layer: VisualTemplateLayer): boolean {
  return layer.type === 'text' || layer.type === 'sports_data' || layer.type === 'fixture_list';
}

function assetIssues(
  layer: VisualTemplateLayer & { assetId: string },
  state: AssetState | undefined,
): VisualTemplateIssue[] {
  if (state === undefined || state === null) {
    return [issueOf('ASSET_MISSING', 'error', layer.id)];
  }
  const { asset, deleted } = state;
  const issues: VisualTemplateIssue[] = [];
  if (deleted) {
    issues.push(issueOf('ASSET_DELETED', 'error', layer.id));
  } else if (!asset.active) {
    issues.push(issueOf('ASSET_INACTIVE', 'error', layer.id));
  }
  if (asset.usagePolicy === 'reference_only' || asset.kind === 'style_reference') {
    issues.push(
      issueOf('ASSET_NOT_ALLOWED', 'error', layer.id, 'Las referencias de estilo nunca se colocan en el contenido.'),
    );
  } else if (asset.mime === 'image/webp') {
    issues.push(issueOf('ASSET_NOT_ALLOWED', 'error', layer.id, 'El motor no dibuja WebP.'));
  } else if (layer.type === 'brand_asset' && asset.kind !== 'brand_logo' && asset.kind !== 'mascot') {
    issues.push(issueOf('ASSET_NOT_ALLOWED', 'error', layer.id, 'Usa una capa de imagen para este recurso.'));
  } else if (layer.type === 'image' && (asset.kind === 'brand_logo' || asset.kind === 'mascot')) {
    issues.push(
      issueOf('ASSET_NOT_ALLOWED', 'error', layer.id, 'El logotipo y la mascota van en una capa de recurso oficial.'),
    );
  } else if (layer.type === 'image' && asset.usagePolicy === 'protected' && layer.fit !== 'contain') {
    issues.push(
      issueOf('ASSET_NOT_ALLOWED', 'error', layer.id, 'Un recurso protegido solo se escala proporcionalmente.'),
    );
  }
  return issues;
}

function backgroundIssues(
  background: ValidationInput['background'],
  canvas: ValidationInput['canvas'],
): VisualTemplateIssue[] {
  const issues: VisualTemplateIssue[] = [];
  if (background.source === 'design_proposal') {
    if (!background.found) {
      issues.push(issueOf('BACKGROUND_UNAVAILABLE', 'error', null, 'La propuesta de origen no existe.'));
    } else if (background.deleted) {
      issues.push(issueOf('BACKGROUND_SOURCE_DELETED', 'error', null, 'La propuesta se eliminó de la biblioteca.'));
    } else if (!background.approved) {
      issues.push(issueOf('BACKGROUND_UNAVAILABLE', 'error', null, 'La propuesta ya no está aprobada.'));
    }
    issues.push(
      background.mode === 'own_prompt'
        ? issueOf('BACKGROUND_OWN_PROMPT', 'warning', null)
        : issueOf('BACKGROUND_REVIEW', 'warning', null),
    );
    if (background.sentBrandImage) {
      issues.push(issueOf('BACKGROUND_GENERATED_BRAND', 'warning', null));
    }
  } else {
    const { state } = background;
    if (state === null) {
      issues.push(issueOf('BACKGROUND_UNAVAILABLE', 'error', null, 'El fondo no existe en Mi marca.'));
    } else if (state.deleted) {
      issues.push(issueOf('BACKGROUND_SOURCE_DELETED', 'error', null, 'El fondo se eliminó de Mi marca.'));
    } else if (!state.asset.active) {
      issues.push(issueOf('BACKGROUND_UNAVAILABLE', 'error', null, 'El fondo está desactivado en Mi marca.'));
    }
  }
  const ratio = background.width / background.height;
  const target = canvas.width / canvas.height;
  if (Math.abs(ratio - target) / target > 0.01) {
    issues.push(issueOf('BACKGROUND_ASPECT', 'warning', null));
  }
  return issues;
}

/** Content types whose slides show one match: the only ones with team badges. */
const MATCH_TYPES: ReadonlySet<string> = new Set(['match_preview', 'fixture', 'match_result']);

/** The badge bindings of the team badge layers, once each, in layer order. */
export function usedBadgeBindings(layers: readonly VisualTemplateLayer[]): VisualTemplateBadgeBinding[] {
  const used: VisualTemplateBadgeBinding[] = [];
  for (const layer of layers) {
    if (layer.type === 'team_badge' && !used.includes(layer.binding)) {
      used.push(layer.binding);
    }
  }
  return used;
}

/** The binding a layer shows: its own for a sports-data layer, `round.fixtures` for a match list; else null. */
function bindingOf(layer: VisualTemplateLayer): VisualTemplateBinding | null {
  if (layer.type === 'sports_data') {
    return layer.binding;
  }
  return layer.type === 'fixture_list' ? 'round.fixtures' : null;
}

/** The bindings of the sports-data layers and match lists, once each, in layer order. */
export function usedBindings(layers: readonly VisualTemplateLayer[]): VisualTemplateBinding[] {
  const used: VisualTemplateBinding[] = [];
  for (const layer of layers) {
    const binding = bindingOf(layer);
    if (binding !== null && !used.includes(binding)) {
      used.push(binding);
    }
  }
  return used;
}

/** A low-contrast warning for a text style over a box, or null (not checked under a text effect with a dark halo). */
function contrastIssue(
  input: ValidationInput,
  style: { readonly colorRole: keyof Palette; readonly maxFontSize: number; readonly effect?: string | undefined },
  box: Fractions,
  layerId: string,
  label?: string,
): VisualTemplateIssue | null {
  if (input.sampler === null || DARK_HALO.has(style.effect ?? 'none')) {
    return null;
  }
  const background = input.sampler(box);
  if (background === null) {
    return null;
  }
  const ratio = contrastRatio(hexLuminance(input.palette[style.colorRole]), background);
  const minimum = style.maxFontSize >= LARGE_TEXT ? 3 : 4.5;
  if (ratio >= minimum) {
    return null;
  }
  const where = label === undefined ? '' : `(${label}) `;
  return issueOf(
    'LOW_CONTRAST',
    'warning',
    layerId,
    `${where}Relación ${ratio.toFixed(1)}:1 (mínimo recomendado ${String(minimum)}:1).`,
  );
}

/** The issues of a match list (see the module notes). */
function fixtureListIssues(
  layer: Extract<VisualTemplateLayer, { type: 'fixture_list' }>,
  input: ValidationInput,
): VisualTemplateIssue[] {
  const issues: VisualTemplateIssue[] = [];
  if (input.contentType !== 'round_overview') {
    issues.push(issueOf('BINDING_NOT_ALLOWED', 'error', layer.id, 'La lista de partidos es de un calendario.'));
  }
  const firstRow = rowBox(layer, 0);
  const parts: { name: string; box: Fractions; text: boolean; visible: boolean }[] = [];
  const check = (part: FixtureRowTextPart | FixtureRowBadgePart, label: string): void => {
    const value = layer.row[part];
    if (value.x + value.width > 1 + EDGE || value.y + value.height > 1 + EDGE) {
      issues.push(issueOf('OUT_OF_CANVAS', 'error', layer.id, `(${label}) La parte sale de la fila.`));
    }
    const box = partBox(firstRow, value);
    const pixels = pixelBox(box, input.canvas);
    if (value.visible && (pixels.width < MIN_LAYER_PIXELS || pixels.height < MIN_LAYER_PIXELS)) {
      issues.push(issueOf('TOO_SMALL', 'error', layer.id, `(${label})`));
    }
    parts.push({ name: label, box, text: part in FIXTURE_ROW_TEXT_PARTS, visible: value.visible });
  };
  for (const [part, { label }] of Object.entries(FIXTURE_ROW_BADGE_PARTS) as [
    FixtureRowBadgePart,
    { label: string },
  ][]) {
    check(part, label);
  }
  for (const [part, spec] of Object.entries(FIXTURE_ROW_TEXT_PARTS) as [
    FixtureRowTextPart,
    (typeof FIXTURE_ROW_TEXT_PARTS)[FixtureRowTextPart],
  ][]) {
    check(part, spec.label);
    const value = layer.row[part];
    if ((part === 'homeName' || part === 'awayName') && !value.visible) {
      issues.push(
        issueOf('REQUIRED_BINDING_MISSING', 'error', layer.id, `(${spec.label}) Los nombres se dibujan siempre.`),
      );
    }
    const { style } = value;
    if (style.minFontSize > style.maxFontSize) {
      issues.push(issueOf('FONT_SIZE_INVALID', 'error', layer.id, `(${spec.label})`));
      continue;
    }
    const sample = STRESS_VALUES[spec.binding];
    if (layoutTextBox(sample, style, pixelBox(partBox(firstRow, value), input.canvas), input.fonts).overflow) {
      issues.push(issueOf('TEXT_MAY_NOT_FIT', 'warning', layer.id, `(${spec.label}) Prueba: «${sample}».`));
    }
    if (layer.visible && value.visible) {
      // Every row has its own background under the part: one warning for the part when any row is low.
      for (let index = 0; index < VISUAL_TEMPLATE_FIXTURE_LIST_ROWS; index += 1) {
        const issue = contrastIssue(input, style, partBox(rowBox(layer, index), value), layer.id, spec.label);
        if (issue !== null) {
          issues.push(issue);
          break;
        }
      }
    }
  }
  const shown = parts.filter((part) => part.visible);
  shown.forEach((part, index) => {
    for (const other of shown.slice(index + 1)) {
      if ((part.text || other.text) && intersects(part.box, other.box)) {
        issues.push(issueOf('OVERLAP', 'warning', layer.id, `(${part.name} y ${other.name})`));
      }
    }
  });
  return issues;
}

/** Validates a version (see the module notes). */
export function validateVersion(input: ValidationInput): VisualTemplateValidation {
  const { canvas, layers, fonts } = input;
  const issues: VisualTemplateIssue[] = backgroundIssues(input.background, canvas);
  if (layers.length === 0) {
    issues.push(issueOf('NO_LAYERS', 'warning', null));
  }
  const visible = layers.filter((layer) => layer.visible);
  const shown = new Set(visible.flatMap((layer) => bindingOf(layer) ?? []));
  // One match list per version (PD-ARCH-01G-E.2): every list after the first is refused.
  for (const extra of layers.filter((layer) => layer.type === 'fixture_list').slice(1)) {
    issues.push(issueOf('BINDING_NOT_ALLOWED', 'error', extra.id, 'Una plantilla tiene una sola lista de partidos.'));
  }
  for (const requirement of VISUAL_TEMPLATE_REQUIRED_BINDINGS[input.contentType]) {
    if (!requirement.anyOf.some((bindings) => bindings.every((binding) => shown.has(binding)))) {
      issues.push(
        issueOf(
          'REQUIRED_BINDING_MISSING',
          'error',
          null,
          `Agrega: ${requirement.anyOf.map((set) => set.join(' + ')).join(' o ')}.`,
        ),
      );
    }
  }

  layers.forEach((layer, index) => {
    if (!layer.visible) {
      issues.push(issueOf('HIDDEN_LAYER', 'warning', layer.id));
    }
    const area = layerArea(layer);
    if (area.x + area.width > 1 + EDGE || area.y + area.height > 1 + EDGE) {
      issues.push(
        issueOf(
          'OUT_OF_CANVAS',
          'error',
          layer.id,
          layer.type === 'fixture_list'
            ? `Las ${String(VISUAL_TEMPLATE_FIXTURE_LIST_ROWS)} filas no caben en el lienzo.`
            : undefined,
        ),
      );
    }
    const box = pixelBox(layer, canvas);
    if (box.width < MIN_LAYER_PIXELS || box.height < MIN_LAYER_PIXELS) {
      issues.push(issueOf('TOO_SMALL', 'error', layer.id));
    }
    if (layer.type === 'image' || layer.type === 'brand_asset') {
      issues.push(...assetIssues(layer, input.assets.get(layer.assetId)));
    } else if (layer.type === 'team_badge') {
      // A team badge exists for the teams of a match only (PD-ARCH-01G-D).
      if (!MATCH_TYPES.has(input.contentType)) {
        issues.push(issueOf('BINDING_NOT_ALLOWED', 'error', layer.id));
      }
    } else if (layer.type === 'fixture_list') {
      issues.push(...fixtureListIssues(layer, input));
    } else {
      const { style } = layer;
      if (style.minFontSize > style.maxFontSize) {
        issues.push(issueOf('FONT_SIZE_INVALID', 'error', layer.id));
      } else {
        const sample =
          layer.type === 'text' ? layer.text : layer.binding === null ? null : STRESS_VALUES[layer.binding];
        if (sample !== null && layoutTextBox(sample, style, box, fonts).overflow) {
          issues.push(
            layer.type === 'text'
              ? issueOf('TEXT_TOO_LONG', 'error', layer.id)
              : issueOf('TEXT_MAY_NOT_FIT', 'warning', layer.id, `Prueba: «${sample.split('\n')[0] ?? ''}».`),
          );
        }
      }
      if (layer.type === 'sports_data') {
        if (layer.binding === null) {
          issues.push(issueOf('BINDING_MISSING', 'error', layer.id));
        } else if (!bindingAllowed(layer.binding, input.contentType)) {
          issues.push(issueOf('BINDING_NOT_ALLOWED', 'error', layer.id));
        }
      }
      const contrast = layer.visible ? contrastIssue(input, style, layer, layer.id) : null;
      if (contrast !== null) {
        issues.push(contrast);
      }
    }
    if (!layer.visible) {
      return;
    }
    // Layers above this one (later in the list) that cover it.
    for (const above of layers.slice(index + 1)) {
      if (!above.visible || !intersects(area, layerArea(above))) {
        continue;
      }
      if (layer.type === 'brand_asset' && input.assets.get(layer.assetId)?.asset.usagePolicy === 'protected') {
        issues.push(issueOf('PROTECTED_OVERLAP', 'warning', above.id));
      } else if (isText(layer)) {
        issues.push(issueOf('OVERLAP', 'warning', above.id));
      }
    }
  });
  return { publishable: !issues.some((candidate) => candidate.severity === 'error'), issues };
}
