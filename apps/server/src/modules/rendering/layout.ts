/**
 * Deterministic text layout (architecture.md section 9; AD-07; AR-03).
 *
 * `layoutText` measures glyph advances with `opentype.js` from the bundled font files and breaks the text into
 * explicit lines; the renderer draws each line as its own non-wrapping node, so the lines measured are the lines
 * rendered. Visual QA re-measures with the same function (`text_fit`, architecture.md section 10).
 *
 * Measurement is the sum of the glyph advances at the font size. Kerning is not applied: the GPOS kerning of the
 * bundled faces is not read by `opentype.js` 2.0.0 (its shaping path also refuses some of their substitution
 * lookups), and kerning only narrows text, so the measured width is never smaller than the drawn width.
 *
 * Rules: the text is NFC-normalized; line feeds are hard breaks (blank lines are dropped); other whitespace runs
 * become one space; lines break
 * at spaces only. A word wider than the box stays whole on its own line and sets `overflow`. More lines than
 * `maxLines` set `overflow` and only the first `maxLines` lines are kept. `fitText` tries font sizes from the largest
 * down to the smallest and returns the first layout without overflow (or the smallest size, with `overflow`).
 */
import type { Font } from 'opentype.js';

/** Line height as a multiple of the font size. */
export const LINE_HEIGHT_FACTOR = 1.2;

/** Step between the font sizes tried by `fitText`. */
export const FIT_STEP = 2;

export interface TextLayout {
  readonly lines: readonly string[];
  /** True when the text needs more lines than allowed or a word is wider than the box. */
  readonly overflow: boolean;
  /** Width of each kept line at the font size, in pixels. */
  readonly lineWidths: readonly number[];
}

/** Width of a text at a font size: the sum of the glyph advances (missing glyphs use the font's `.notdef`). */
export function measureText(text: string, font: Font, size: number): number {
  let units = 0;
  for (const character of text) {
    units += font.charToGlyph(character).advanceWidth ?? 0;
  }
  return (units * size) / font.unitsPerEm;
}

/** Normalizes the text into paragraphs of single-spaced words. */
export function paragraphsOf(text: string): string[][] {
  return text
    .normalize('NFC')
    .split(/\r\n|\r|\n/u)
    .map((paragraph) => paragraph.split(/\s+/u).filter((word) => word !== ''));
}

/** Breaks a text into lines that fit `boxWidth` at `size`, at most `maxLines` (see the module notes). */
export function layoutText(text: string, font: Font, size: number, boxWidth: number, maxLines: number): TextLayout {
  const lines: string[] = [];
  let overflow = false;
  // Empty paragraphs (consecutive line feeds) are dropped: no blank line is drawn.
  for (const words of paragraphsOf(text).filter((paragraph) => paragraph.length > 0)) {
    let current = '';
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (current !== '' && measureText(candidate, font, size) > boxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      if (measureText(word, font, size) > boxWidth) {
        overflow = true;
      }
    }
    lines.push(current);
  }
  if (lines.length > maxLines) {
    overflow = true;
    lines.length = maxLines;
  }
  return Object.freeze({
    lines: Object.freeze(lines),
    overflow,
    lineWidths: Object.freeze(lines.map((line) => measureText(line, font, size))),
  });
}

export interface FittedText extends TextLayout {
  readonly fontSize: number;
}

/** The largest size from `maxSize` down to `minSize` (step `FIT_STEP`) whose layout does not overflow. */
export function fitText(
  text: string,
  font: Font,
  sizes: { readonly maxSize: number; readonly minSize: number },
  boxWidth: number,
  maxLines: number,
): FittedText {
  const minSize = Math.min(sizes.minSize, sizes.maxSize);
  for (let size = sizes.maxSize; size > minSize; size -= FIT_STEP) {
    const layout = layoutText(text, font, size, boxWidth, maxLines);
    if (!layout.overflow) {
      return { ...layout, fontSize: size };
    }
  }
  return { ...layoutText(text, font, minSize, boxWidth, maxLines), fontSize: minSize };
}
