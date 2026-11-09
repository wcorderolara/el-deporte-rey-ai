/**
 * Validation of a visual template version (PD-ARCH-01G-C): deterministic checks of the document, its assets and its
 * background. An `error` blocks publication; a `warning` is for the operator to review. No check claims a perfect
 * visual result: the operator keeps the final approval.
 *
 * Errors: a layer outside the canvas or too small; a minimum font size above the maximum; a sports-data layer without
 * a binding or with a binding the content type does not have; a value the content type requires that no visible layer
 * shows; a missing, deleted, inactive or not allowed asset (style references, `reference_only`, WebP, a logo or mascot
 * in an image layer, a protected asset that is not scaled proportionally); fixed text that does not fit; an unusable
 * background.
 *
 * Warnings: overlapping text, a layer over a protected asset, a long value that may not fit, low contrast over the
 * background (not checked under a text effect with a dark halo), a hidden layer, no layer, a background of another
 * aspect ratio, and the review notices of a background made by AI (guided, own prompt, brand images sent to the
 * provider). Text is measured as it is drawn, in capital letters when the style asks for it.
 */
import {
  type BrandAsset,
  VISUAL_TEMPLATE_REQUIRED_BINDINGS,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplateIssue,
  type VisualTemplateIssueCode,
  type VisualTemplateLayer,
  type VisualTemplateValidation,
} from '@edr/contracts';

import { type FontSet, type FractionBox, type Palette, layoutTextBox, pixelBox } from '../rendering/index.js';

import { STRESS_VALUES, bindingAllowed } from './catalog.js';
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

const MESSAGES: Readonly<Record<VisualTemplateIssueCode, string>> = {
  OUT_OF_CANVAS: 'La capa sale del lienzo.',
  TOO_SMALL: 'La capa es demasiado pequeña.',
  FONT_SIZE_INVALID: 'El tamaño mínimo de letra es mayor que el máximo.',
  OVERLAP: 'La capa se superpone a un texto.',
  PROTECTED_OVERLAP: 'La capa tapa un recurso protegido (logotipo o mascota oficial).',
  BINDING_MISSING: 'El dato deportivo no tiene un campo asociado.',
  BINDING_NOT_ALLOWED: 'El campo no existe para este tipo de contenido.',
  REQUIRED_BINDING_MISSING: 'Falta un dato obligatorio del tipo de contenido.',
  ASSET_MISSING: 'El recurso no existe en Mi marca.',
  ASSET_INACTIVE: 'El recurso está desactivado en Mi marca.',
  ASSET_DELETED: 'El recurso se eliminó de Mi marca.',
  ASSET_NOT_ALLOWED: 'Este recurso no se puede usar en esta capa.',
  TEXT_TOO_LONG: 'El texto no cabe en su caja.',
  TEXT_MAY_NOT_FIT: 'Un valor largo puede no caber en la caja.',
  LOW_CONTRAST: 'El contraste del texto con el fondo es bajo.',
  HIDDEN_LAYER: 'La capa está oculta y no se dibuja.',
  NO_LAYERS: 'La plantilla no tiene capas sobre el fondo.',
  BACKGROUND_UNAVAILABLE: 'El fondo no está disponible.',
  BACKGROUND_SOURCE_DELETED: 'El origen del fondo se eliminó.',
  BACKGROUND_ASPECT: 'El fondo tiene otra proporción y se recorta para cubrir el lienzo.',
  BACKGROUND_REVIEW:
    'El fondo lo generó la IA: revisa que no tenga textos, logos, escudos ni personas que impidan reutilizarlo.',
  BACKGROUND_OWN_PROMPT:
    'El fondo viene de un prompt propio: puede contener textos, personas, logos o una mascota generados por la IA.',
  BACKGROUND_GENERATED_BRAND:
    'Se enviaron imágenes de la marca a la IA: el fondo puede mostrar un logotipo o una Ketsi redibujados. Usa las capas oficiales.',
  VALUE_MISSING: 'Los datos elegidos no tienen este valor.',
  TEXT_OVERFLOW: 'El texto no cabe en su caja con los datos elegidos.',
};

/** An issue with its fixed message, and an optional detail appended. */
export function issueOf(
  code: VisualTemplateIssueCode,
  severity: 'error' | 'warning',
  layerId: string | null,
  detail?: string,
): VisualTemplateIssue {
  const message = detail === undefined ? MESSAGES[code] : `${MESSAGES[code]} ${detail}`;
  return { code, severity, layerId, message: message.slice(0, 300) };
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
  return layer.type === 'text' || layer.type === 'sports_data';
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

/** The bindings of the visible sports-data layers. */
export function usedBindings(layers: readonly VisualTemplateLayer[]): VisualTemplateBinding[] {
  const used: VisualTemplateBinding[] = [];
  for (const layer of layers) {
    if (layer.type === 'sports_data' && layer.binding !== null && !used.includes(layer.binding)) {
      used.push(layer.binding);
    }
  }
  return used;
}

/** Validates a version (see the module notes). */
export function validateVersion(input: ValidationInput): VisualTemplateValidation {
  const { canvas, layers, fonts } = input;
  const issues: VisualTemplateIssue[] = backgroundIssues(input.background, canvas);
  if (layers.length === 0) {
    issues.push(issueOf('NO_LAYERS', 'warning', null));
  }
  const visible = layers.filter((layer) => layer.visible);
  const shown = new Set(
    visible.flatMap((layer) => (layer.type === 'sports_data' && layer.binding !== null ? [layer.binding] : [])),
  );
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
    if (layer.x + layer.width > 1 + EDGE || layer.y + layer.height > 1 + EDGE) {
      issues.push(issueOf('OUT_OF_CANVAS', 'error', layer.id));
    }
    const box = pixelBox(layer, canvas);
    if (box.width < MIN_LAYER_PIXELS || box.height < MIN_LAYER_PIXELS) {
      issues.push(issueOf('TOO_SMALL', 'error', layer.id));
    }
    if (layer.type === 'image' || layer.type === 'brand_asset') {
      issues.push(...assetIssues(layer, input.assets.get(layer.assetId)));
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
      if (input.sampler !== null && layer.visible && !DARK_HALO.has(style.effect ?? 'none')) {
        const background = input.sampler(layer);
        if (background !== null) {
          const ratio = contrastRatio(hexLuminance(input.palette[style.colorRole]), background);
          const minimum = style.maxFontSize >= LARGE_TEXT ? 3 : 4.5;
          if (ratio < minimum) {
            issues.push(
              issueOf(
                'LOW_CONTRAST',
                'warning',
                layer.id,
                `Relación ${ratio.toFixed(1)}:1 (mínimo recomendado ${String(minimum)}:1).`,
              ),
            );
          }
        }
      }
    }
    if (!layer.visible) {
      return;
    }
    // Layers above this one (later in the list) that cover it.
    for (const above of layers.slice(index + 1)) {
      if (!above.visible || !intersects(layer, above)) {
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
