/**
 * Schemas of the AI port: the strict `DraftRequest` schema (T11H-F16, V-13a), the response schema validated against
 * its request (provider-ports section 2) and the stub fixture format.
 */
import { describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';

import {
  AiProviderError,
  type DraftRequest,
  parseAiStubFixture,
  parseDraftRequest,
  parseDraftResponse,
  parseDraftResponseText,
} from './index.js';

function sampleRequest(): DraftRequest {
  return {
    language: 'es',
    brand: { name: 'Marca Sintética', handle: '@MarcaDemo' },
    limits: { headlineMaxChars: 40, descriptionMaxChars: 120, captionMaxChars: 300, maxHashtags: 2 },
    slides: [
      { slideKey: 'cover', slideType: 'cover', facts: [] },
      {
        slideKey: 'match:demo-1',
        slideType: 'match_result',
        facts: [
          { placeholder: '{{t:equipo-norte}}', kind: 'team', display: 'Equipo Norte' },
          { placeholder: '{{t:equipo-sur}}', kind: 'team', display: 'Equipo Sur' },
          { placeholder: '{{f:match-demo-1-score}}', kind: 'score', display: '2-1' },
        ],
      },
      { slideKey: 'closing', slideType: 'closing', facts: [] },
    ],
    captionFacts: [{ placeholder: '{{f:matchday}}', kind: 'matchday', display: 'Jornada 3' }],
  };
}

function refusal(input: unknown): AiProviderError {
  try {
    parseDraftRequest(input);
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('the request was accepted');
}

describe('DraftRequest strict schema (T11H-F16, V-13a)', () => {
  it('accepts a valid request and returns a frozen copy', () => {
    const request = parseDraftRequest(sampleRequest());
    expect(request).toEqual(sampleRequest());
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.slides[1]?.facts[0])).toBe(true);
  });

  it.each([
    ['sourceRef on a fact', (r: Record<string, unknown>) => addTo(r, ['slides', 1, 'facts', 0], 'sourceRef')],
    ['ref on a fact', (r: Record<string, unknown>) => addTo(r, ['slides', 1, 'facts', 0], 'ref')],
    ['fileName at the top level', (r: Record<string, unknown>) => addTo(r, [], 'fileName')],
    ['declaredSource at the top level', (r: Record<string, unknown>) => addTo(r, [], 'declaredSource')],
    ['dataMode on a slide', (r: Record<string, unknown>) => addTo(r, ['slides', 0], 'dataMode')],
    ['sourceRef on a caption fact', (r: Record<string, unknown>) => addTo(r, ['captionFacts', 0], 'sourceRef')],
    ['a brand field', (r: Record<string, unknown>) => addTo(r, ['brand'], 'logoPath')],
    ['a limits field', (r: Record<string, unknown>) => addTo(r, ['limits'], 'tools')],
  ])('refuses an extra field: %s', (_label, mutate) => {
    const input = structuredClone(sampleRequest()) as unknown as Record<string, unknown>;
    mutate(input);
    const error = refusal(input);
    expect(error.code).toBe('invalid');
    expect(error.message).not.toContain('fixture:');
    expect(error.message).not.toContain('marker');
  });

  it('reports the validation path of a refused field without its value', () => {
    const input = structuredClone(sampleRequest()) as unknown as Record<string, unknown>;
    addTo(input, ['slides', 1, 'facts', 0], 'sourceRef');
    const error = refusal(input);
    expect(error.path).toBe('slides[1].facts[0]');
    expect(error.toJSON()).toEqual({ code: 'invalid', httpStatus: null, path: 'slides[1].facts[0]' });
    expect(JSON.stringify(error.toJSON())).not.toContain('fixture:demo');
  });

  it('refuses a language other than es and en', () => {
    expect(refusal({ ...sampleRequest(), language: 'fr' }).path).toBe('language');
  });

  it.each([
    ['a control character', 'Equipo\nNorte'],
    ['a zero-width character', 'Equipo​Norte'],
    ['a bidi control', 'Equipo‮Norte'],
    ['placeholder delimiters', 'Equipo {{t:otro}}'],
    ['an empty value', ''],
    ['a value over the length limit', 'x'.repeat(201)],
  ])('refuses a display value with %s', (_label, display) => {
    const input = sampleRequest();
    const fact = input.slides[1]?.facts[0];
    if (fact === undefined) {
      throw new Error('sample fact missing');
    }
    fact.display = display;
    expect(refusal(input).path).toBe('slides[1].facts[0].display');
  });

  it('refuses a malformed placeholder, slide key, kind or brand handle', () => {
    const badPlaceholder = sampleRequest();
    badPlaceholder.captionFacts = [{ placeholder: '{{x:matchday}}', kind: 'matchday', display: 'Jornada 3' }];
    expect(refusal(badPlaceholder).path).toBe('captionFacts[0].placeholder');

    const badKey = sampleRequest();
    badKey.slides[0] = { slideKey: '../cover', slideType: 'cover', facts: [] };
    expect(refusal(badKey).path).toBe('slides[0].slideKey');

    const badKind = sampleRequest();
    badKind.captionFacts = [{ placeholder: '{{f:matchday}}', kind: 'Match Day', display: 'Jornada 3' }];
    expect(refusal(badKind).path).toBe('captionFacts[0].kind');

    expect(refusal({ ...sampleRequest(), brand: { name: 'Marca', handle: 'MarcaDemo' } }).path).toBe('brand.handle');
  });

  it('refuses duplicate slide keys, an empty slide list and an `only` key that is not a slide', () => {
    const duplicate = sampleRequest();
    duplicate.slides.push({ slideKey: 'cover', slideType: 'cover', facts: [] });
    expect(refusal(duplicate).path).toBe('slides[3].slideKey');
    expect(refusal({ ...sampleRequest(), slides: [] }).path).toBe('slides');
    expect(refusal({ ...sampleRequest(), only: ['match:other'] }).path).toBe('only[0]');
    expect(refusal({ ...sampleRequest(), only: ['cover', 'cover'] }).path).toBe('only[1]');
    expect(parseDraftRequest({ ...sampleRequest(), only: ['match:demo-1'] }).only).toEqual(['match:demo-1']);
  });

  it('refuses limits out of their bounds', () => {
    const request = sampleRequest();
    expect(refusal({ ...request, limits: { ...request.limits, maxHashtags: 31 } }).path).toBe('limits.maxHashtags');
    expect(refusal({ ...request, limits: { ...request.limits, headlineMaxChars: 2.5 } }).path).toBe(
      'limits.headlineMaxChars',
    );
  });

  it('refuses non-object input and prototype keys', () => {
    expect(refusal(null).code).toBe('invalid');
    expect(refusal('request').code).toBe('invalid');
    const withProto = JSON.parse(
      JSON.stringify(sampleRequest()).replace('"language"', '"__proto__":{"polluted":true},"language"'),
    ) as unknown;
    expect(refusal(withProto).code).toBe('invalid');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('DraftResponse schema', () => {
  const request = parseDraftRequest(sampleRequest());
  const valid = {
    slides: [
      { slideKey: 'closing', headline: 'Gracias', description: 'Hasta pronto' },
      { slideKey: 'cover', headline: 'Resumen', description: 'Lo más destacado' },
      { slideKey: 'match:demo-1', headline: '{{t:equipo-norte}} y {{t:equipo-sur}}', description: 'Gran partido' },
    ],
    caption: 'Resumen {{f:matchday}}',
    hashtags: ['#futbol'],
  };

  function invalid(input: unknown, against: DraftRequest = request): AiProviderError {
    try {
      parseDraftResponse(input, against, 200);
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe('ai_response_invalid');
      return error as AiProviderError;
    }
    throw new Error('the response was accepted');
  }

  it('accepts a valid response and returns its slides in request order', () => {
    const response = parseDraftResponse(valid, request);
    expect(response.slides.map((slide) => slide.slideKey)).toEqual(['cover', 'match:demo-1', 'closing']);
    expect(Object.isFrozen(response)).toBe(true);
  });

  it('accepts content-check material: the response schema does not run the content checks', () => {
    const response = parseDraftResponse({ ...valid, caption: 'Ganó por ２ goles​' }, request);
    expect(response.caption).toBe('Ganó por ２ goles​');
  });

  it('rejects an unknown slide key, a repeated slide and a missing slide', () => {
    invalid({ ...valid, slides: [...valid.slides.slice(0, 2), { ...valid.slides[2], slideKey: 'match:other' }] });
    invalid({ ...valid, slides: [valid.slides[0], valid.slides[1], valid.slides[1]] });
    invalid({ ...valid, slides: valid.slides.slice(0, 2) });
  });

  it('rejects unknown keys at the top level and on slides', () => {
    invalid({ ...valid, tool_calls: [] });
    invalid({ ...valid, slides: valid.slides.map((slide) => ({ ...slide, html: '<b>x</b>' })) });
  });

  it('applies the field limits in code points and the hashtag count', () => {
    invalid({ ...valid, slides: valid.slides.map((slide) => ({ ...slide, headline: 'h'.repeat(41) })) });
    expect(
      parseDraftResponse({ ...valid, slides: valid.slides.map((s) => ({ ...s, headline: '⚽'.repeat(40) })) }, request)
        .slides[0]?.headline,
    ).toBe('⚽'.repeat(40));
    invalid({ ...valid, slides: valid.slides.map((slide) => ({ ...slide, description: 'd'.repeat(121) })) });
    invalid({ ...valid, caption: 'c'.repeat(301) });
    invalid({ ...valid, hashtags: ['#a', '#b', '#c'] });
    invalid({ ...valid, slides: valid.slides.map((slide) => ({ ...slide, headline: '   ' })) });
  });

  it('answers only the `only` slides when the request regenerates a subset', () => {
    const subset = parseDraftRequest({ ...sampleRequest(), only: ['match:demo-1'] });
    const response = parseDraftResponse({ slides: [valid.slides[2]] }, subset);
    expect(response.slides).toHaveLength(1);
    invalid({ slides: valid.slides }, subset);
  });

  it('parses JSON text only and keeps nothing of an invalid body on the error', () => {
    expect(parseDraftResponseText(JSON.stringify(valid), request).slides).toHaveLength(3);
    const error = invalid('not used');
    expect(error.message).toBe('AI response invalid (HTTP 200)');
    for (const text of ['```json\n{}\n```', `secret-looking text ${TEST_DUMMY_API_KEY}`, '']) {
      try {
        parseDraftResponseText(text, request, 200);
        throw new Error('accepted');
      } catch (failure) {
        expect((failure as AiProviderError).code).toBe('ai_response_invalid');
        expect(JSON.stringify(failure)).not.toContain(TEST_DUMMY_API_KEY);
        expect(String(failure)).not.toContain(TEST_DUMMY_API_KEY);
      }
    }
  });
});

describe('stub fixture format', () => {
  it('reads slide texts into a map keyed by slide key or slide type', () => {
    const fixture = parseAiStubFixture({
      slides: { 'match:demo-1': { headline: 'H', description: 'D' }, cover: { headline: 'C', description: 'E' } },
      caption: 'Leyenda',
      hashtags: ['#demo'],
      simulate: 'invalid_json',
    });
    expect(fixture.slides.get('match:demo-1')).toEqual({ headline: 'H', description: 'D' });
    expect(fixture.slides.get('cover')?.headline).toBe('C');
    expect(fixture.caption).toBe('Leyenda');
    expect(fixture.simulate).toBe('invalid_json');
  });

  it.each([
    ['an unknown top-level key', { slides: {}, sourceRef: 'x' }],
    ['an unknown slide key', { slides: { cover: { headline: 'H', description: 'D', extra: 1 } } }],
    ['a prototype key', JSON.parse('{"slides":{"__proto__":{"headline":"H","description":"D"}}}') as unknown],
    ['an unknown simulation', { slides: {}, simulate: 'timeout' }],
    ['slides as an array', { slides: [] }],
  ])('rejects %s', (_label, input) => {
    expect(() => parseAiStubFixture(input)).toThrow(AiProviderError);
  });
});

/** Adds an extra member at a path of a JSON-like object. */
function addTo(root: Record<string, unknown>, path: readonly (string | number)[], key: string): void {
  let target: unknown = root;
  for (const segment of path) {
    target = (target as Record<string | number, unknown>)[segment];
  }
  (target as Record<string, unknown>)[key] = key === 'sourceRef' || key === 'ref' ? 'fixture:demo/marker.json' : 'x';
}
