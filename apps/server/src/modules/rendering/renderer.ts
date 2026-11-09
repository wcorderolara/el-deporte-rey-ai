/**
 * PNG renderer (architecture.md section 9; AD-07; T10-F09).
 *
 * The render model becomes a Satori element tree built from plain objects (no React runtime on the server): one
 * absolutely positioned, non-wrapping node per measured text line, one box per rectangle, one `img` per image element
 * (fitted as the element says, `contain` by default).
 * Satori lays the tree out with the bundled fonts and draws glyphs as paths (no `<text>` element), then resvg
 * rasterizes the SVG at the canvas size.
 *
 * Data only (T10-F09): image slots receive only `data:` URIs built from stored, hash-checked asset bytes, never a URL
 * or a file path; Satori gets no `loadAdditionalAsset` callback (a glyph missing from the bundled fonts is not
 * fetched); resvg runs with `loadSystemFonts: false`, the bundled font files as its only `fontFiles` and no resources
 * directory. Text reaches Satori only as text content. The renderer opens no socket.
 *
 * Determinism (R-213): the same render model, template version, fonts and pinned library versions give the same SVG
 * and a byte-identical PNG.
 */
import { createHash } from 'node:crypto';

import { renderAsync } from '@resvg/resvg-js';
import satori, { type SatoriOptions } from 'satori';

import type { FontSet } from './fonts.js';
import type { Palette, RenderElement, RenderModel, TextEffect, TextElement } from './render-model.js';

/** An image asset for an image slot: hash-checked bytes and their MIME type. */
export interface EmbeddedAsset {
  readonly id: string;
  readonly sha256: string;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly content: Uint8Array;
}

export interface RenderResources {
  readonly fonts: FontSet;
  /** Assets by ID; every image element of the model must have its asset here, with the same SHA-256. */
  readonly assets: ReadonlyMap<string, EmbeddedAsset>;
}

export interface RenderedSlide {
  readonly svg: string;
  readonly png: Buffer;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
}

/** A render model the renderer refuses; fixed messages (T10-F10). */
export class RenderError extends Error {
  override readonly name = 'RenderError';
}

/** A plain Satori node. */
interface SatoriNode {
  readonly type: 'div' | 'img';
  readonly props: Readonly<Record<string, unknown>>;
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** The `data:` URI of an asset whose bytes match the hash in the model. */
function dataUri(assets: ReadonlyMap<string, EmbeddedAsset>, assetId: string, expected: string): string {
  const asset = assets.get(assetId);
  if (asset === undefined || asset.sha256 !== expected || sha256(asset.content) !== expected) {
    throw new RenderError('an image slot has no matching asset');
  }
  return `data:${asset.mime};base64,${Buffer.from(asset.content).toString('base64')}`;
}

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

/** A length in pixels, a fraction of the font size, rounded to hundredths (deterministic output). */
function px(fontSize: number, factor: number): string {
  return `${String(Math.round(fontSize * factor * 100) / 100)}px`;
}

/** A shadow in each of eight directions at a distance: an outline without the inner marks of a text stroke. */
function outline(fontSize: number, factor: number, color: string): string[] {
  const d = Math.max(1, Math.round(fontSize * factor * 100) / 100);
  const diagonal = Math.round(d * 0.75 * 100) / 100;
  return [
    [d, 0],
    [-d, 0],
    [0, d],
    [0, -d],
    [diagonal, diagonal],
    [-diagonal, -diagonal],
    [diagonal, -diagonal],
    [-diagonal, diagonal],
  ].map(([x, y]) => `${String(x)}px ${String(y)}px 0px ${color}`);
}

/**
 * The CSS text shadow of a text effect (decision 01G-C-2), in the palette colours and scaled with the font size; null
 * for no effect.
 */
export function textShadowOf(effect: TextEffect | undefined, fontSize: number, palette: Palette): string | null {
  const shade = 'rgba(0, 0, 0, 0.85)';
  switch (effect) {
    case undefined:
    case 'none':
      return null;
    case 'soft_shadow':
      return `0px ${px(fontSize, 0.06)} ${px(fontSize, 0.22)} ${shade}`;
    case 'strong_shadow':
      return `0px ${px(fontSize, 0.1)} 0px ${palette.primaryDark}, 0px 0px ${px(fontSize, 0.4)} ${shade}`;
    case 'glow_gold':
      return `0px 0px ${px(fontSize, 0.3)} ${palette.accent}, 0px 0px ${px(fontSize, 0.12)} ${palette.accent}`;
    case 'glow_purple':
      return `0px 0px ${px(fontSize, 0.3)} ${palette.primary}, 0px 0px ${px(fontSize, 0.12)} ${palette.primary}`;
    case 'outline_dark':
      return [
        ...outline(fontSize, 0.05, palette.primaryDark),
        `0px ${px(fontSize, 0.08)} ${px(fontSize, 0.2)} ${shade}`,
      ].join(', ');
    case 'scoreboard_gold':
      return [
        ...outline(fontSize, 0.03, palette.accent),
        `0px ${px(fontSize, 0.07)} ${px(fontSize, 0.12)} ${shade}`,
      ].join(', ');
  }
}

function textNodes(element: TextElement, palette: Palette): SatoriNode[] {
  const { box, lineHeight, lines } = element;
  const shadow = textShadowOf(element.effect, element.fontSize, palette);
  const blockHeight = lines.length * lineHeight;
  const offset =
    element.verticalAlign === 'top'
      ? 0
      : element.verticalAlign === 'bottom'
        ? box.height - blockHeight
        : (box.height - blockHeight) / 2;
  return lines.flatMap((line, index) =>
    line === ''
      ? []
      : [
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                left: box.x,
                top: box.y + offset + index * lineHeight,
                width: box.width,
                height: lineHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: JUSTIFY[element.align],
                whiteSpace: 'nowrap',
                fontFamily: element.fontFamily,
                fontWeight: element.fontWeight,
                fontSize: element.fontSize,
                lineHeight: `${String(lineHeight)}px`,
                color: element.color,
                ...(shadow === null ? {} : { textShadow: shadow }),
              },
              children: line,
            },
          },
        ],
  );
}

function elementNodes(element: RenderElement, resources: RenderResources, palette: Palette): SatoriNode[] {
  switch (element.kind) {
    case 'rect':
      return [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: element.box.x,
              top: element.box.y,
              width: element.box.width,
              height: element.box.height,
              backgroundColor: element.color,
              borderRadius: element.radius,
            },
          },
        },
      ];
    case 'text':
      return textNodes(element, palette);
    case 'image':
      return [
        {
          type: 'img',
          props: {
            src: dataUri(resources.assets, element.assetId, element.sha256),
            width: element.box.width,
            height: element.box.height,
            style: {
              position: 'absolute',
              left: element.box.x,
              top: element.box.y,
              width: element.box.width,
              height: element.box.height,
              objectFit: element.fit ?? 'contain',
            },
          },
        },
      ];
    case 'badge_slot':
      // Reserved and always empty (PD-03, R-231): nothing is drawn.
      return [];
  }
}

/** The Satori element tree of a render model. */
export function satoriTree(model: RenderModel, resources: RenderResources): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'relative',
        width: model.canvas.width,
        height: model.canvas.height,
        backgroundColor: model.background.color,
      },
      children: model.elements.flatMap((element) => elementNodes(element, resources, model.palette)),
    },
  };
}

const satoriFonts = new WeakMap<FontSet, SatoriOptions['fonts']>();

/** The Satori font list of a font set (one array per set, so Satori can reuse its parsed fonts). */
function fontsFor(fonts: FontSet): SatoriOptions['fonts'] {
  let list = satoriFonts.get(fonts);
  if (list === undefined) {
    list = fonts.faces.map((face) => ({
      name: face.family,
      data: face.data,
      weight: face.weight as 400,
      style: 'normal' as const,
    }));
    satoriFonts.set(fonts, list);
  }
  return list;
}

/** The checks on a model's fonts: only the faces of the font set. */
function checkFonts(model: RenderModel, fonts: FontSet): void {
  for (const entry of model.fonts) {
    const face = fonts.roles[entry.role];
    if (face.family !== entry.family || face.weight !== entry.weight || face.sha256 !== entry.sha256) {
      throw new RenderError('the render model names a font that is not bundled');
    }
  }
}

/** The SVG of a render model (Satori, glyphs as paths). */
export async function renderSvg(model: RenderModel, resources: RenderResources): Promise<string> {
  checkFonts(model, resources.fonts);
  const tree = satoriTree(model, resources);
  // Options are complete: no loadAdditionalAsset, no graphemeImages, no debug (T10-F09).
  const options: SatoriOptions = {
    width: model.canvas.width,
    height: model.canvas.height,
    fonts: fontsFor(resources.fonts),
    embedFont: true,
  };
  return satori(tree as unknown as Parameters<typeof satori>[0], options);
}

/**
 * Rasterizes an SVG with resvg, off the main thread, with the bundled fonts only (T10-F09). No abort signal is passed
 * to resvg (its native binding accepts only its own signal type); callers check their signal between slides.
 */
export async function rasterize(svg: string, fonts: FontSet): Promise<Buffer> {
  const rendered = await renderAsync(
    svg,
    {
      fitTo: { mode: 'original' },
      font: {
        loadSystemFonts: false,
        fontFiles: fonts.faces.map((face) => face.path),
        defaultFontFamily: fonts.roles.body.family,
      },
      logLevel: 'off',
    },
    null,
  );
  return rendered.asPng();
}

/** Reads the width and height of a PNG from its IHDR chunk; null when the bytes are not a PNG. */
export function pngSize(png: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 24 || signature.some((byte, index) => png[index] !== byte)) {
    return null;
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (String.fromCharCode(...png.subarray(12, 16)) !== 'IHDR') {
    return null;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Renders a slide: SVG, PNG, its SHA-256 and its size (checked against the canvas, R-238). */
export async function renderSlide(
  model: RenderModel,
  resources: RenderResources,
  signal?: AbortSignal,
): Promise<RenderedSlide> {
  const svg = await renderSvg(model, resources);
  if (signal?.aborted === true) {
    throw new RenderError('the render was cancelled');
  }
  const png = await rasterize(svg, resources.fonts);
  const size = pngSize(png);
  if (size === null || size.width !== model.canvas.width || size.height !== model.canvas.height) {
    throw new RenderError('the rendered image does not have the canvas size');
  }
  return { svg, png, sha256: sha256(png), width: size.width, height: size.height };
}
