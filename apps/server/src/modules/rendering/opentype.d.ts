/**
 * Minimal type declaration of the parts of `opentype.js` 2.0.0 the renderer uses (the package ships no types).
 * Only parsing a font from bytes and reading glyph advances and vertical metrics are declared.
 */
declare module 'opentype.js' {
  export interface Glyph {
    readonly index: number;
    readonly advanceWidth: number | undefined;
  }

  export interface Font {
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    charToGlyph(character: string): Glyph;
    charToGlyphIndex(character: string): number;
  }

  export function parse(buffer: ArrayBuffer): Font;

  const opentype: { parse: typeof parse };
  export default opentype;
}
