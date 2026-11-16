/**
 * Render models of structured visual templates (PD-ARCH-01G-C): the same render model, renderer, fonts, palette and
 * text layout as the built-in templates, so that a preview is drawn exactly as a final slide would be.
 *
 * - The input is a list of items in stacking order (bottom first): the background and image layers with their
 *   hash-pinned assets and fit, and text layers with their run, style and box. Boxes are fractions of the canvas;
 *   font sizes are pixels of the design canvas and are scaled by the smaller of the two canvas factors, as the
 *   built-in templates scale their reference layout.
 * - Text uses `layoutText` at the largest size from the maximum down to the minimum whose lines fit the box width and
 *   height (`shrink`), or at the maximum size (`fixed`). Nothing is cut: a text that still does not fit keeps `overflow` set and its layer is
 *   reported. An empty text adds nothing.
 * - Colours are palette roles and fonts are the three font roles: nothing else can reach the model. A text effect is a
 *   name of the closed list the renderer draws (decision 01G-C-2); capital letters change only the drawn lines, the
 *   element keeps the stored text (PD-29).
 */
import type { Language, SlideType, TextFieldName } from '@edr/contracts';

import type { FontRole, FontSet } from './fonts.js';
import { FIT_STEP, LINE_HEIGHT_FACTOR, layoutText } from './layout.js';
import {
  type Box,
  type ImageFit,
  type Palette,
  type PaletteRole,
  RENDER_MODEL_SCHEMA,
  RENDER_MODEL_VERSION,
  type RenderElement,
  type RenderModel,
  RenderModelSchema,
  type TextEffect,
  type TextSemantic,
} from './render-model.js';
import type { SegmentRun } from './slide-content.js';
import type { AssetRef } from './templates/common.js';

/** A box as fractions of the canvas. */
export interface FractionBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface StructuredTextStyle {
  readonly fontRole: FontRole;
  readonly maxFontSize: number;
  readonly minFontSize: number;
  readonly maxLines: number;
  readonly colorRole: PaletteRole;
  readonly align: 'left' | 'center' | 'right';
  readonly verticalAlign: 'top' | 'middle' | 'bottom';
  readonly overflow: 'shrink' | 'fixed';
  readonly effect?: TextEffect | undefined;
  /** Draw in capital letters; only the display changes (PD-29). */
  readonly uppercase?: boolean | undefined;
}

/** The text as it is drawn: in capital letters when the style asks for it (locale-independent). */
export function displayText(text: string, style: Pick<StructuredTextStyle, 'uppercase'>): string {
  return style.uppercase === true ? text.toUpperCase() : text;
}

export interface StructuredImageItem {
  readonly kind: 'image';
  readonly id: string;
  readonly slot: 'background' | 'layer';
  readonly box: FractionBox;
  readonly asset: AssetRef;
  readonly fit: ImageFit;
}

export interface StructuredTextItem {
  readonly kind: 'text';
  readonly id: string;
  readonly field: TextFieldName;
  readonly semantic: TextSemantic;
  readonly box: FractionBox;
  readonly style: StructuredTextStyle;
  readonly run: SegmentRun;
}

export type StructuredItem = StructuredImageItem | StructuredTextItem;

export interface StructuredDocument {
  /** A slug: `vt-` and the template ID. */
  readonly templateId: string;
  /** The version number as text. */
  readonly templateVersion: string;
  readonly slideType: SlideType;
  readonly language: Language;
  /** The canvas the font sizes were designed for. */
  readonly designCanvas: { readonly width: number; readonly height: number };
  /** The canvas to render. */
  readonly canvas: { readonly width: number; readonly height: number };
  readonly items: readonly StructuredItem[];
}

export interface StructuredModel {
  readonly model: RenderModel;
  /** IDs of the text items that do not fit their box. */
  readonly overflowing: readonly string[];
}

/** A fraction box in whole pixels of a canvas (edges rounded, as `ModelBuilder.box`). */
export function pixelBox(box: FractionBox, canvas: { readonly width: number; readonly height: number }): Box {
  const left = Math.round(box.x * canvas.width);
  const top = Math.round(box.y * canvas.height);
  return {
    x: left,
    y: top,
    width: Math.round((box.x + box.width) * canvas.width) - left,
    height: Math.round((box.y + box.height) * canvas.height) - top,
  };
}

/** The layout of a text in a box as it is drawn (capital letters when asked): its font size, lines and overflow. */
export function layoutTextBox(
  text: string,
  style: StructuredTextStyle,
  box: Box,
  fonts: FontSet,
  scale = 1,
): { fontSize: number; lineHeight: number; lines: readonly string[]; overflow: boolean } {
  const face = fonts.roles[style.fontRole];
  const shown = displayText(text, style);
  const maxSize = Math.max(1, Math.round(style.maxFontSize * scale));
  const minSize = Math.max(1, Math.round(style.minFontSize * scale));
  let fitted = { ...layoutText(shown, face.font, maxSize, box.width, style.maxLines), fontSize: maxSize };
  if (style.overflow === 'shrink') {
    // The largest size whose lines fit both the width and the height of the box (fitText checks the width only).
    const fits = (layout: { overflow: boolean; lines: readonly string[] }, size: number) =>
      !layout.overflow && layout.lines.length * size * LINE_HEIGHT_FACTOR <= box.height + 0.5;
    const bottom = Math.min(minSize, maxSize);
    for (let size = maxSize; size >= bottom; size -= FIT_STEP) {
      fitted = { ...layoutText(shown, face.font, size, box.width, style.maxLines), fontSize: size };
      if (fits(fitted, size)) {
        break;
      }
    }
    if (!fits(fitted, fitted.fontSize)) {
      fitted = { ...layoutText(shown, face.font, bottom, box.width, style.maxLines), fontSize: bottom };
    }
  }
  const lineHeight = fitted.fontSize * LINE_HEIGHT_FACTOR;
  return {
    fontSize: fitted.fontSize,
    lineHeight,
    lines: fitted.lines,
    // Lines that do not fit the box height also overflow.
    overflow: fitted.overflow || fitted.lines.length * lineHeight > box.height + 0.5,
  };
}

/** The render model of a structured template for one set of values. */
export function buildStructuredModel(
  document: StructuredDocument,
  resources: { readonly palette: Palette; readonly fonts: FontSet },
): StructuredModel {
  const { canvas, designCanvas } = document;
  const { palette, fonts } = resources;
  const scale = Math.min(canvas.width / designCanvas.width, canvas.height / designCanvas.height);
  const elements: RenderElement[] = [];
  const overflowing: string[] = [];
  for (const item of document.items) {
    const box = pixelBox(item.box, canvas);
    if (item.kind === 'image') {
      elements.push({
        kind: 'image',
        id: item.id,
        slot: item.slot,
        box,
        assetId: item.asset.id,
        sha256: item.asset.sha256,
        mime: item.asset.mime,
        fit: item.fit,
      });
      continue;
    }
    if (item.run.text.trim() === '') {
      continue;
    }
    const face = fonts.roles[item.style.fontRole];
    const layout = layoutTextBox(item.run.text, item.style, box, fonts, scale);
    if (layout.overflow) {
      overflowing.push(item.id);
    }
    elements.push({
      kind: 'text',
      id: item.id,
      field: item.field,
      semantic: item.semantic,
      box,
      fontRole: item.style.fontRole,
      fontFamily: face.family,
      fontWeight: face.weight,
      fontSize: layout.fontSize,
      lineHeight: layout.lineHeight,
      colorRole: item.style.colorRole,
      color: palette[item.style.colorRole],
      align: item.style.align,
      verticalAlign: item.style.verticalAlign,
      maxLines: item.style.maxLines,
      text: item.run.text,
      lines: [...layout.lines],
      overflow: layout.overflow,
      factIds: [...item.run.factIds],
      provenance: item.run.provenance,
      ...(item.style.effect === undefined || item.style.effect === 'none' ? {} : { effect: item.style.effect }),
      ...(item.style.uppercase === true ? { uppercase: true } : {}),
    });
  }
  const model = RenderModelSchema.parse({
    schema: RENDER_MODEL_SCHEMA,
    schemaVersion: RENDER_MODEL_VERSION,
    templateId: document.templateId,
    templateVersion: document.templateVersion,
    slideType: document.slideType,
    language: document.language,
    canvas: { width: canvas.width, height: canvas.height },
    background: { colorRole: 'primaryDark', color: palette.primaryDark },
    palette: { ...palette },
    fonts: (['heading', 'body', 'numeric'] as const).map((role) => ({
      role,
      family: fonts.roles[role].family,
      weight: fonts.roles[role].weight,
      file: fonts.roles[role].file,
      sha256: fonts.roles[role].sha256,
    })),
    demoLabel: null,
    elements,
  });
  return { model, overflowing };
}
