/**
 * Text layout (architecture.md section 9; AR-03): measurement with the bundled fonts, explicit lines, overflow flags
 * and font fitting are deterministic.
 */
import { describe, expect, it } from 'vitest';

import { fitText, layoutText, measureText, paragraphsOf } from './layout.js';
import { testFonts } from './test/support.js';

const fonts = testFonts();
const body = fonts.roles.body.font;
const heading = fonts.roles.heading.font;

describe('measureText', () => {
  it('sums glyph advances proportionally to the font size', () => {
    const at10 = measureText('Club Atlético 2-1', body, 10);
    expect(at10).toBeGreaterThan(0);
    expect(measureText('Club Atlético 2-1', body, 20)).toBeCloseTo(at10 * 2, 6);
    expect(measureText('', body, 40)).toBe(0);
  });

  it('measures identically across calls and NFC forms are equal after layout normalization', () => {
    const composed = 'Ñandú';
    const decomposed = composed.normalize('NFD');
    expect(measureText(composed, heading, 50)).toBe(measureText(composed, heading, 50));
    expect(layoutText(decomposed, heading, 50, 1000, 1).lines).toEqual([composed]);
  });
});

describe('layoutText', () => {
  it('keeps a short text on one line without overflow', () => {
    const layout = layoutText('Resultado final', body, 40, 960, 2);
    expect(layout.lines).toEqual(['Resultado final']);
    expect(layout.overflow).toBe(false);
    expect(layout.lineWidths[0]).toBeLessThanOrEqual(960);
  });

  it('breaks at spaces so that every line fits the box', () => {
    const text = 'Una descripción sintética bastante larga que necesita varias líneas para caber en la caja';
    const layout = layoutText(text, body, 32, 400, 10);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join(' ')).toBe(text);
    for (const width of layout.lineWidths) {
      expect(width).toBeLessThanOrEqual(400);
    }
    expect(layout.overflow).toBe(false);
  });

  it('flags overflow and keeps only maxLines lines when the text needs more', () => {
    const layout = layoutText('uno dos tres cuatro cinco seis siete ocho nueve diez', body, 40, 150, 2);
    expect(layout.overflow).toBe(true);
    expect(layout.lines).toHaveLength(2);
  });

  it('flags overflow for a single word wider than the box and keeps the word whole', () => {
    const layout = layoutText('Supercalifragilístico', heading, 60, 100, 3);
    expect(layout.overflow).toBe(true);
    expect(layout.lines).toEqual(['Supercalifragilístico']);
  });

  it('treats line feeds as hard breaks and collapses other whitespace', () => {
    expect(paragraphsOf('a  b\t c\n\nd')).toEqual([['a', 'b', 'c'], [], ['d']]);
    expect(layoutText('a  b\n\nd', body, 30, 900, 5).lines).toEqual(['a b', 'd']);
  });
});

describe('fitText', () => {
  it('returns the largest size that fits', () => {
    const fitted = fitText('Club Atlético', heading, { maxSize: 80, minSize: 20 }, 300, 1);
    expect(fitted.overflow).toBe(false);
    expect(fitted.fontSize).toBeLessThan(80);
    expect(measureText('Club Atlético', heading, fitted.fontSize)).toBeLessThanOrEqual(300);
    expect(measureText('Club Atlético', heading, fitted.fontSize + 2)).toBeGreaterThan(300);
  });

  it('returns the smallest size with overflow when nothing fits', () => {
    const fitted = fitText(
      'Nombre extremadamente largo de un club sintético',
      heading,
      { maxSize: 40, minSize: 30 },
      80,
      1,
    );
    expect(fitted.fontSize).toBe(30);
    expect(fitted.overflow).toBe(true);
  });

  it('is deterministic', () => {
    const run = () => fitText('Deportivo Árbol Sintético', heading, { maxSize: 50, minSize: 28 }, 460, 3);
    expect(run()).toEqual(run());
  });
});
