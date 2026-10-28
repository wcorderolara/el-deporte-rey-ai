/**
 * Renderer security items (T10-F09; architecture.md section 9): render inputs are data only. Text with markup
 * characters reaches Satori only as text content (valid PNG, well-formed SVG, no added element); image slots are
 * `data:` URIs only; glyphs missing from the bundled fonts are not fetched; rendering opens no socket.
 */
import net from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildRenderModel, renderContent } from './core.js';
import { renderSlide, renderSvg, pngSize } from './renderer.js';
import { TemplateRegistry } from './templates/registry.js';
import { MATCH_A, closingText, commentary, content, matchText, testFonts, testSettings, uuid } from './test/support.js';

const fonts = testFonts();
const deps = { registry: new TemplateRegistry(), fonts, settings: testSettings(), assets: [] };

/** Elements Satori emits for this renderer's trees (glyphs as paths, boxes as rects, clipping, image slots). */
const ALLOWED_ELEMENTS = new Set(['svg', 'defs', 'clipPath', 'mask', 'g', 'rect', 'path', 'image', 'pattern']);

/**
 * Checks that an SVG is well formed (every tag closed in order, attribute values quoted, no stray markup in text) and
 * returns the element names in document order.
 */
function wellFormedElements(svg: string): string[] {
  const tag = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"<]*")*)\s*(\/?)>/gy;
  const names: string[] = [];
  const stack: string[] = [];
  let index = 0;
  while (index < svg.length) {
    const next = svg.indexOf('<', index);
    const text = svg.slice(index, next === -1 ? svg.length : next);
    expect(text.includes('>')).toBe(false);
    if (next === -1) {
      break;
    }
    tag.lastIndex = next;
    const match = tag.exec(svg);
    expect(match, `malformed markup at ${String(next)}`).not.toBeNull();
    const [whole, closing, name, , selfClosing] = match as RegExpExecArray;
    if (closing === '/') {
      expect(stack.pop()).toBe(name);
    } else {
      names.push(name as string);
      if (selfClosing !== '/') {
        stack.push(name as string);
      }
    }
    index = next + whole.length;
  }
  expect(stack).toEqual([]);
  return names;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('render inputs are data only (T10-F09)', () => {
  const hostile = [
    '<script>alert(1)</script>',
    'a < b > c & d " e',
    ']]>',
    '</text><image href="https://example.invalid/x.png"/>',
    '<image href="file:///etc/passwd"/>',
  ];

  it('renders markup characters as text: valid PNG, well-formed SVG, no added element', async () => {
    const stored = matchText(MATCH_A, { headline: hostile.join(' '), description: hostile.join(' ') });
    const titleIndex = stored.fields.findIndex((field) => field.field === 'title');
    const fields = stored.fields.map((field, index) =>
      index === titleIndex
        ? { ...field, segments: [...field.segments, commentary(' </text><image href="x"/>')] }
        : field,
    );
    const model = buildRenderModel(content('match_result', { ...stored, fields }), deps);
    const rendered = await renderSlide(model, { fonts, assets: new Map() });
    expect(pngSize(rendered.png)).toEqual({ width: 1080, height: 1350 });
    const names = wellFormedElements(rendered.svg);
    expect(names[0]).toBe('svg');
    expect(names.filter((name) => !ALLOWED_ELEMENTS.has(name))).toEqual([]);
    expect(names.filter((name) => name === 'image')).toEqual([]);
    expect(names.includes('text')).toBe(false);
    expect(names.includes('script')).toBe(false);
    for (const needle of ['<script', 'example.invalid', 'file://', ']]>', 'href="x"']) {
      expect(rendered.svg.includes(needle)).toBe(false);
    }
    // The hostile text is in the model as plain text, drawn as glyph outlines.
    expect(model.elements.some((element) => element.kind === 'text' && element.text.includes('</text><image'))).toBe(
      true,
    );
  });

  it('embeds image slots only as data: URIs', async () => {
    const { png } = await import('../brand/test/images.js');
    const { createHash } = await import('node:crypto');
    const bytes = png({ width: 20, height: 20 });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const logo = { slot: 'brand_logo' as const, id: uuid(950), sha256, mime: 'image/png' as const, content: bytes };
    const model = buildRenderModel(content('closing', closingText()), { ...deps, assets: [logo] });
    const svg = await renderSvg(model, { fonts, assets: new Map([[logo.id, logo]]) });
    const names = wellFormedElements(svg);
    expect(names.filter((name) => name === 'image')).toHaveLength(1);
    const hrefs = [...svg.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? '');
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith('data:image/png;base64,') || href.startsWith('#')).toBe(true);
    }
  });

  it('does not fetch glyphs missing from the bundled fonts (no loadAdditionalAsset)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const stored = matchText(MATCH_A, { headline: 'Emoji 😀 y 漢字 y العربية', description: '✓ ★' });
    const render = await renderContent(content('match_result', stored), deps, '/t');
    expect(pngSize(render.png)).toEqual({ width: 1080, height: 1350 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opens no socket while rendering (network guard)', async () => {
    const connect = vi.spyOn(net.Socket.prototype, 'connect');
    const netConnect = vi.spyOn(net, 'connect');
    const createConnection = vi.spyOn(net, 'createConnection');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const slideType of ['match_result', 'closing'] as const) {
      const stored = slideType === 'closing' ? closingText() : matchText(MATCH_A);
      await renderContent(content(slideType, stored, { demonstration: true }), deps, '/t');
    }
    expect(connect).not.toHaveBeenCalled();
    expect(netConnect).not.toHaveBeenCalled();
    expect(createConnection).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
