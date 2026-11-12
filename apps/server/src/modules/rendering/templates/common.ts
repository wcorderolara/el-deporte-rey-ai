/**
 * Shared template machinery (architecture.md section 9; OD-13): the template definition type, the render context and
 * the model builder that every template uses.
 *
 * - Layouts are written for the 1080 x 1350 reference canvas and scaled to the configured format (OD-04, PD-09):
 *   horizontal positions by width / 1080, vertical positions by height / 1350, font sizes by the smaller factor.
 * - Colours are palette roles only (OD-07); fonts are the three brand font roles (bundled faces only).
 * - Common chrome of every template: the background, the header band, the brand logo slot (drawn only when an
 *   active brand logo exists, R-034) and, on DEMO_DATA slides, the demonstration band with the fixed per-language
 *   label of `platform/format` (OD-21, R-269, AD-33).
 * - Text boxes are filled with `fitText`: the largest size that fits, else the smallest size with `overflow` set
 *   (visual QA then blocks the slide; nothing is cut silently).
 */
import type { SlideType, TextFieldName } from '@edr/contracts';

import { templateText } from '../../../platform/format/index.js';
import { type FontRole, type FontSet } from '../fonts.js';
import { LINE_HEIGHT_FACTOR, fitText } from '../layout.js';
import {
  type BadgeSlot,
  type Box,
  type ImageSlot,
  type Palette,
  type PaletteRole,
  RENDER_MODEL_SCHEMA,
  RENDER_MODEL_VERSION,
  type RenderElement,
  type RenderModel,
  RenderModelSchema,
  type TextSemantic,
} from '../render-model.js';
import type { SegmentRun, SlideContent } from '../slide-content.js';

/** Reference canvas of the template layouts. */
export const REFERENCE_WIDTH = 1080;
export const REFERENCE_HEIGHT = 1350;

/** An active brand asset a template may place (its bytes are embedded by the renderer). */
export interface AssetRef {
  readonly id: string;
  readonly sha256: string;
  /** The renderer draws PNG and JPEG only (WebP style references never reach a template; PD-ARCH-01G-A). */
  readonly mime: 'image/png' | 'image/jpeg';
}

/** Everything a template needs besides the slide content. */
export interface TemplateContext {
  readonly canvas: { readonly width: number; readonly height: number };
  readonly palette: Palette;
  readonly fonts: FontSet;
  /** The active asset of each image slot, or absent when none is active (no substitute, OD-07). */
  readonly assets: Readonly<Partial<Record<ImageSlot, AssetRef>>>;
  readonly utcOffsetMinutes: number;
}

/** A versioned template (OD-13, R-211). */
export interface TemplateDefinition {
  readonly id: string;
  readonly version: string;
  readonly slideType: SlideType;
  /** Label shown in the template list (contract `Template.label`). */
  readonly label: string;
  readonly imageSlots: readonly ImageSlot[];
  readonly badgeSlots: readonly BadgeSlot[];
  /**
   * True when the template fills its badge slots with the slide's badges (`SlideContent.badges`; PD-ARCH-01G-E.1,
   * version 1.1.0 of the match templates). Absent or false: the slots stay empty and record no team.
   */
  readonly drawsBadges?: boolean;
  build(content: SlideContent, ctx: TemplateContext): RenderModel;
}

/** A text box of the reference layout. */
export interface TextSpec {
  readonly id: string;
  readonly field: TextFieldName;
  readonly semantic: TextSemantic;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role: FontRole;
  readonly maxSize: number;
  readonly minSize: number;
  readonly maxLines: number;
  readonly colorRole: PaletteRole;
  readonly align?: 'left' | 'center' | 'right';
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
  /** Set when the box itself lies outside its template area (for example table rows beyond the table). */
  readonly forceOverflow?: boolean;
  readonly run: SegmentRun;
}

/** Builds the render model of one slide. */
export class ModelBuilder {
  readonly #template: TemplateDefinition;
  readonly #content: SlideContent;
  readonly #ctx: TemplateContext;
  readonly #elements: RenderElement[] = [];
  readonly #sx: number;
  readonly #sy: number;
  readonly #sf: number;

  constructor(template: TemplateDefinition, content: SlideContent, ctx: TemplateContext) {
    this.#template = template;
    this.#content = content;
    this.#ctx = ctx;
    this.#sx = ctx.canvas.width / REFERENCE_WIDTH;
    this.#sy = ctx.canvas.height / REFERENCE_HEIGHT;
    this.#sf = Math.min(this.#sx, this.#sy);
  }

  /** A box of the reference layout, scaled to the canvas and rounded to whole pixels. */
  box(x: number, y: number, width: number, height: number): Box {
    const left = Math.round(x * this.#sx);
    const top = Math.round(y * this.#sy);
    return {
      x: left,
      y: top,
      width: Math.round((x + width) * this.#sx) - left,
      height: Math.round((y + height) * this.#sy) - top,
    };
  }

  /** A font size of the reference layout, scaled. */
  size(value: number): number {
    return Math.max(1, Math.round(value * this.#sf));
  }

  rect(id: string, x: number, y: number, width: number, height: number, colorRole: PaletteRole, radius = 0): void {
    this.#elements.push({
      kind: 'rect',
      id,
      box: this.box(x, y, width, height),
      colorRole,
      color: this.#ctx.palette[colorRole],
      radius: this.size(radius),
    });
  }

  /** A text box; nothing is added for an empty text. */
  text(spec: TextSpec): void {
    if (spec.run.text.trim() === '') {
      return;
    }
    const face = this.#ctx.fonts.roles[spec.role];
    const box = this.box(spec.x, spec.y, spec.width, spec.height);
    const fitted = fitText(
      spec.run.text,
      face.font,
      { maxSize: this.size(spec.maxSize), minSize: this.size(spec.minSize) },
      box.width,
      spec.maxLines,
    );
    const lineHeight = fitted.fontSize * LINE_HEIGHT_FACTOR;
    this.#elements.push({
      kind: 'text',
      id: spec.id,
      field: spec.field,
      semantic: spec.semantic,
      box,
      fontRole: spec.role,
      fontFamily: face.family,
      fontWeight: face.weight,
      fontSize: fitted.fontSize,
      lineHeight,
      colorRole: spec.colorRole,
      color: this.#ctx.palette[spec.colorRole],
      align: spec.align ?? 'center',
      verticalAlign: spec.verticalAlign ?? 'middle',
      maxLines: spec.maxLines,
      text: spec.run.text,
      lines: [...fitted.lines],
      // Lines that do not fit the box height also overflow.
      overflow: spec.forceOverflow === true || fitted.overflow || fitted.lines.length * lineHeight > box.height + 0.5,
      factIds: [...spec.run.factIds],
      provenance: spec.run.provenance,
    });
  }

  /** An image slot, drawn only when an active asset of that kind exists (R-034); no substitute otherwise. */
  image(slot: ImageSlot, x: number, y: number, width: number, height: number): void {
    if (!this.#template.imageSlots.includes(slot)) {
      throw new TypeError('the template does not declare this image slot');
    }
    const asset = this.#ctx.assets[slot];
    if (asset === undefined) {
      return;
    }
    this.#elements.push({
      kind: 'image',
      id: slot.replace('_', '-'),
      slot,
      box: this.box(x, y, width, height),
      assetId: asset.id,
      sha256: asset.sha256,
      mime: asset.mime,
    });
  }

  /**
   * A reserved badge slot. A template that draws badges records the slide's team and its snapshot badge
   * (PD-ARCH-01G-E.1); otherwise, or without slide badges, the slot is empty and records no team (PD-03, R-231).
   */
  badge(slot: BadgeSlot, x: number, y: number, width: number, height: number): void {
    if (!this.#template.badgeSlots.includes(slot)) {
      throw new TypeError('the template does not declare this badge slot');
    }
    const box = this.box(x, y, width, height);
    const badges = this.#template.drawsBadges === true ? this.#content.badges : undefined;
    if (badges === undefined) {
      this.#elements.push({ kind: 'badge_slot', id: slot, slot, box, empty: true });
      return;
    }
    const side = slot === 'team-badge-home' ? badges.home : badges.away;
    const badge =
      side.badge === null || side.teamId === null
        ? null
        : { assetId: side.badge.id, sha256: side.badge.sha256, mime: side.badge.mime };
    this.#elements.push({
      kind: 'badge_slot',
      id: slot,
      slot,
      box,
      empty: badge === null,
      team: { teamId: side.teamId, badge },
    });
  }

  /** Background, header band, brand logo slot and, on DEMO_DATA slides, the demonstration band. */
  chrome(): void {
    this.rect('header', 0, 0, REFERENCE_WIDTH, 140, 'primary');
    this.rect('header-rule', 0, 140, REFERENCE_WIDTH, 8, 'accent');
    this.image('brand_logo', 40, 20, 240, 100);
    if (this.#content.demonstration) {
      this.rect('demo-band', 0, 148, REFERENCE_WIDTH, 56, 'accent');
      this.text({
        id: 'demo-label',
        field: 'demo_label',
        semantic: 'demo_label',
        x: 40,
        y: 152,
        width: 1000,
        height: 48,
        role: 'numeric',
        maxSize: 30,
        minSize: 18,
        maxLines: 1,
        colorRole: 'primaryDark',
        run: { text: this.demoLabel() ?? '', factIds: [], provenance: 'template_text' },
      });
    }
  }

  /** The demonstration label of the slide, or null when the project is not DEMO_DATA. */
  demoLabel(): string | null {
    return this.#content.demonstration ? templateText(this.#content.language).demonstrationLabel : null;
  }

  /** The finished, validated render model. */
  build(): RenderModel {
    const { fonts, palette, canvas } = this.#ctx;
    return RenderModelSchema.parse({
      schema: RENDER_MODEL_SCHEMA,
      schemaVersion: RENDER_MODEL_VERSION,
      templateId: this.#template.id,
      templateVersion: this.#template.version,
      slideType: this.#template.slideType,
      language: this.#content.language,
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
      demoLabel: this.demoLabel(),
      elements: this.#elements,
    });
  }
}

/** A run of template text without facts. */
export function templateRun(text: string): SegmentRun {
  return { text, factIds: [], provenance: 'template_text' };
}
