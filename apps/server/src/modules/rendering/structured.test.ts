/**
 * Render models of structured visual templates (PD-ARCH-01G-C): the same model and renderer as the built-in
 * templates, stacking order, fit, scaling, overflow without cutting, empty text, and deterministic output.
 */
import { createHash } from 'node:crypto';

import { renderAsync } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';

import { png } from '../brand/test/images.js';

import { RenderModelSchema } from './render-model.js';
import { renderSlide, textShadowOf } from './renderer.js';
import { type StructuredDocument, type StructuredTextStyle, buildStructuredModel, pixelBox } from './structured.js';
import { PALETTE, testFonts, uuid } from './test/support.js';

const fonts = testFonts();

/** The RGB of each pixel of a PNG, decoded by resvg. */
async function pixelsOf(image: Buffer, width: number, height: number): Promise<(x: number, y: number) => number[]> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(width)}" ` +
    `height="${String(height)}"><image width="${String(width)}" height="${String(height)}" ` +
    `xlink:href="data:image/png;base64,${image.toString('base64')}"/></svg>`;
  const pixels = (await renderAsync(svg, { font: { loadSystemFonts: false } })).pixels;
  return (x, y) => [...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 3)];
}
const palette = { ...PALETTE };

const STYLE: StructuredTextStyle = {
  fontRole: 'heading',
  maxFontSize: 56,
  minFontSize: 28,
  maxLines: 1,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
};

const backgroundBytes = png({ width: 40, height: 50, rgba: [46, 17, 69, 255] });
const logoBytes = png({ width: 20, height: 10, rgba: [212, 175, 55, 255] });
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const background = { id: uuid(1), sha256: sha(backgroundBytes), mime: 'image/png' as const, content: backgroundBytes };
const logo = { id: uuid(2), sha256: sha(logoBytes), mime: 'image/png' as const, content: logoBytes };

function document(overrides: Partial<StructuredDocument> = {}): StructuredDocument {
  return {
    templateId: `vt-${uuid(9)}`,
    templateVersion: '1',
    slideType: 'match_preview',
    language: 'es',
    designCanvas: { width: 1080, height: 1350 },
    canvas: { width: 1080, height: 1350 },
    items: [
      {
        kind: 'image',
        id: 'background',
        slot: 'background',
        box: { x: 0, y: 0, width: 1, height: 1 },
        asset: background,
        fit: 'cover',
      },
      {
        kind: 'image',
        id: 'layer-logo',
        slot: 'layer',
        box: { x: 0.36, y: 0.03, width: 0.28, height: 0.12 },
        asset: logo,
        fit: 'contain',
      },
      {
        kind: 'text',
        id: 'layer-home',
        field: 'team_home',
        semantic: 'team_name',
        box: { x: 0.05, y: 0.4, width: 0.42, height: 0.1 },
        style: STYLE,
        run: { text: 'Club Deportivo Ejemplo', factIds: [], provenance: 'fact' },
      },
    ],
    ...overrides,
  };
}

describe('buildStructuredModel', () => {
  it('builds a valid render model with the items in stacking order, their fit and palette colours', () => {
    const { model, overflowing } = buildStructuredModel(document(), { palette, fonts });
    expect(RenderModelSchema.parse(model)).toEqual(model);
    expect(model.elements.map((element) => element.id)).toEqual(['background', 'layer-logo', 'layer-home']);
    expect(model.elements[0]).toMatchObject({
      kind: 'image',
      slot: 'background',
      fit: 'cover',
      box: { x: 0, y: 0, width: 1080, height: 1350 },
    });
    expect(model.elements[1]).toMatchObject({
      kind: 'image',
      slot: 'layer',
      fit: 'contain',
      assetId: logo.id,
      sha256: logo.sha256,
    });
    expect(model.elements[2]).toMatchObject({
      kind: 'text',
      color: PALETTE.light,
      fontFamily: fonts.roles.heading.family,
      overflow: false,
    });
    expect(model.demoLabel).toBeNull();
    expect(overflowing).toEqual([]);
  });

  it('places boxes from canvas fractions and scales font sizes by the smaller canvas factor', () => {
    expect(pixelBox({ x: 0.05, y: 0.4, width: 0.42, height: 0.1 }, { width: 1080, height: 1350 })).toEqual({
      x: 54,
      y: 540,
      width: 454,
      height: 135,
    });
    const half = buildStructuredModel(document({ canvas: { width: 540, height: 675 } }), { palette, fonts });
    const full = buildStructuredModel(document(), { palette, fonts });
    const size = (model: typeof half) =>
      model.model.elements[2]?.kind === 'text' ? model.model.elements[2].fontSize : 0;
    expect(size(half)).toBeLessThanOrEqual(Math.ceil(size(full) / 2));
  });

  it('never cuts a long text: it keeps every word, sets overflow and reports the layer', () => {
    const long = 'Real Sociedad Deportiva Ejemplo de la Ciudad de Muestra';
    const items = document().items.map((item) =>
      item.kind === 'text'
        ? { ...item, style: { ...STYLE, overflow: 'fixed' as const }, run: { ...item.run, text: long } }
        : item,
    );
    const { model, overflowing } = buildStructuredModel(document({ items }), { palette, fonts });
    const text = model.elements[2];
    expect(text?.kind === 'text' && text.overflow).toBe(true);
    expect(text?.kind === 'text' && text.text).toBe(long);
    expect(overflowing).toEqual(['layer-home']);
  });

  it('shows capital letters only in the drawn lines, keeping the stored text (PD-29), and measures what is drawn', () => {
    const items = document().items.map((item) =>
      item.kind === 'text'
        ? {
            ...item,
            style: { ...STYLE, uppercase: true, effect: 'soft_shadow' as const },
            run: { ...item.run, text: 'Atlético de Madrid' },
          }
        : item,
    );
    const { model } = buildStructuredModel(document({ items }), { palette, fonts });
    const text = model.elements[2];
    expect(text).toMatchObject({ kind: 'text', text: 'Atlético de Madrid', uppercase: true, effect: 'soft_shadow' });
    expect(text?.kind === 'text' ? text.lines.join(' ') : '').toBe('ATLÉTICO DE MADRID');
    const plain = buildStructuredModel(document(), { palette, fonts }).model.elements[2];
    expect(plain).not.toHaveProperty('effect');
    expect(plain).not.toHaveProperty('uppercase');
  });

  it('draws each text effect of the closed palette in the palette colours, scaled with the font size', async () => {
    expect(textShadowOf(undefined, 50, palette)).toBeNull();
    expect(textShadowOf('none', 50, palette)).toBeNull();
    expect(textShadowOf('soft_shadow', 50, palette)).toBe('0px 3px 11px rgba(0, 0, 0, 0.85)');
    expect(textShadowOf('soft_shadow', 100, palette)).toBe('0px 6px 22px rgba(0, 0, 0, 0.85)');
    expect(textShadowOf('strong_shadow', 50, palette)).toContain(PALETTE.primaryDark);
    expect(textShadowOf('glow_gold', 50, palette)).toContain(PALETTE.accent);
    expect(textShadowOf('glow_purple', 50, palette)).toContain(PALETTE.primary);
    expect(
      textShadowOf('outline_dark', 50, palette)
        ?.split(', ')
        .filter((part) => part.endsWith(PALETTE.primaryDark)),
    ).toHaveLength(8);
    expect(
      textShadowOf('scoreboard_gold', 120, palette)
        ?.split(', ')
        .filter((part) => part.endsWith(PALETTE.accent)),
    ).toHaveLength(8);

    const items = document().items.map((item) =>
      item.kind === 'text' ? { ...item, style: { ...STYLE, effect: 'scoreboard_gold' as const } } : item,
    );
    const { model } = buildStructuredModel(document({ items }), { palette, fonts });
    const assets = new Map([background, logo].map((asset) => [asset.id, asset]));
    const plain = await renderSlide(buildStructuredModel(document(), { palette, fonts }).model, { fonts, assets });
    const first = await renderSlide(model, { fonts, assets });
    const second = await renderSlide(model, { fonts, assets });
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).not.toBe(plain.sha256);
    expect(first.svg).toContain('feGaussianBlur');
  });

  it('adds nothing for an empty text', () => {
    const items = document().items.map((item) =>
      item.kind === 'text' ? { ...item, run: { ...item.run, text: '  ' } } : item,
    );
    expect(buildStructuredModel(document({ items }), { palette, fonts }).model.elements).toHaveLength(2);
  });

  it('renders with the slide renderer at the canvas size, byte for byte the same twice', async () => {
    const { model } = buildStructuredModel(document(), { palette, fonts });
    const assets = new Map([background, logo].map((asset) => [asset.id, asset]));
    const first = await renderSlide(model, { fonts, assets });
    const second = await renderSlide(model, { fonts, assets });
    expect(first).toMatchObject({ width: 1080, height: 1350 });
    expect(first.sha256).toBe(second.sha256);
    const pixel = await pixelsOf(first.png, 1080, 1350);
    // The background covers the whole canvas; the logo is drawn from its own bytes, unchanged, in its box.
    expect(pixel(5, 5)).toEqual([46, 17, 69]);
    expect(pixel(1070, 1340)).toEqual([46, 17, 69]);
    expect(pixel(540, 121)).toEqual([212, 175, 55]);
  });

  it('refuses to render an image whose bytes do not match the hash in the model', async () => {
    const { model } = buildStructuredModel(document(), { palette, fonts });
    const altered = { ...logo, content: png({ width: 20, height: 10, rgba: [0, 0, 0, 255] }) };
    await expect(
      renderSlide(model, {
        fonts,
        assets: new Map([
          [background.id, background],
          [logo.id, altered],
        ]),
      }),
    ).rejects.toThrow('an image slot has no matching asset');
  });
});
