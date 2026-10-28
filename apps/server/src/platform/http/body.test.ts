import { describe, expect, it } from 'vitest';

import {
  BRAND_UPLOAD_BODY_LIMIT,
  GLOBAL_BODY_LIMIT,
  IMPORT_BODY_LIMIT,
  binaryBodyRoute,
  jsonDepthExceeds,
  mediaTypeOf,
  routeBodyLimit,
} from './body.js';

describe('body limits', () => {
  it('uses 64 KiB globally, 1.5 MiB for imports and 5 MiB for the brand upload', () => {
    expect(GLOBAL_BODY_LIMIT).toBe(65536);
    expect(IMPORT_BODY_LIMIT).toBe(1572864);
    expect(BRAND_UPLOAD_BODY_LIMIT).toBe(5242880);
  });

  it('accepts route limits up to the brand-upload limit only', () => {
    expect(routeBodyLimit(IMPORT_BODY_LIMIT)).toBe(IMPORT_BODY_LIMIT);
    expect(routeBodyLimit(BRAND_UPLOAD_BODY_LIMIT)).toBe(BRAND_UPLOAD_BODY_LIMIT);
    expect(() => routeBodyLimit(BRAND_UPLOAD_BODY_LIMIT + 1)).toThrow(RangeError);
    expect(() => routeBodyLimit(0)).toThrow(RangeError);
    expect(() => routeBodyLimit(1.5)).toThrow(RangeError);
  });
});

describe('binary body exception', () => {
  it('allows image/png and image/jpeg only', () => {
    expect(binaryBodyRoute(['image/png', 'image/jpeg'])).toEqual({
      edr: { bodyMediaTypes: ['image/png', 'image/jpeg'] },
    });
    expect(() => binaryBodyRoute([])).toThrow(TypeError);
    expect(() => binaryBodyRoute(['image/svg+xml' as never])).toThrow(TypeError);
    expect(() => binaryBodyRoute(['application/json' as never])).toThrow(TypeError);
  });
});

describe('mediaTypeOf', () => {
  it('returns the lowercase media type without parameters', () => {
    expect(mediaTypeOf('Application/JSON; charset=utf-8')).toBe('application/json');
    expect(mediaTypeOf('image/png')).toBe('image/png');
    expect(mediaTypeOf('')).toBeNull();
    expect(mediaTypeOf(undefined)).toBeNull();
  });
});

describe('jsonDepthExceeds', () => {
  it('counts object and array nesting', () => {
    expect(jsonDepthExceeds('{"a":[{"b":1}]}', 3)).toBe(false);
    expect(jsonDepthExceeds('{"a":[{"b":[1]}]}', 3)).toBe(true);
  });

  it('ignores brackets inside strings, including after escaped quotes', () => {
    expect(jsonDepthExceeds('{"a":"[[[[{{{{"}', 1)).toBe(false);
    expect(jsonDepthExceeds('{"a":"\\"[[[[\\\\"}', 1)).toBe(false);
  });

  it('handles a 1.5 MiB nesting quickly and without recursion', () => {
    const text = '['.repeat(786432) + ']'.repeat(786432);
    const started = performance.now();
    expect(jsonDepthExceeds(text, 64)).toBe(true);
    expect(jsonDepthExceeds(`"${'['.repeat(786432)}"`, 64)).toBe(false);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
