/**
 * Stub AI adapter (provider-ports section 2; R-223, R-236, R-241): fixture files confined to `fixtures/ai/`, the
 * deterministic placeholder-only draft, simulations, the recorded last request and the strict request schema. The
 * fixture files are written to a temporary project root; no network is used (the Vitest network guard is active).
 */
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConfigError } from '../../platform/config/index.js';

import {
  AiProviderError,
  type DraftRequest,
  type DraftResponse,
  MAX_STUB_FIXTURE_BYTES,
  createStubAiProvider,
} from './index.js';

const PLACEHOLDER = /\{\{[ft]:[A-Za-z0-9][A-Za-z0-9:._-]{0,127}\}\}/g;

function sampleRequest(language: 'es' | 'en' = 'es'): DraftRequest {
  return {
    language,
    brand: { name: 'Marca Sintética', handle: '@MarcaDemo' },
    limits: { headlineMaxChars: 80, descriptionMaxChars: 300, captionMaxChars: 600, maxHashtags: 3 },
    slides: [
      { slideKey: 'cover', slideType: 'cover', facts: [] },
      {
        slideKey: 'match:demo-1',
        slideType: 'match_result',
        facts: [
          { placeholder: '{{t:equipo-norte}}', kind: 'team', display: 'Equipo Norte' },
          { placeholder: '{{t:equipo-sur}}', kind: 'team', display: 'Equipo Sur' },
          { placeholder: '{{f:match-demo-1-score}}', kind: 'score', display: '2-1' },
          { placeholder: '{{f:match-demo-1-relation}}', kind: 'result_relation', display: 'Equipo Norte gana' },
        ],
      },
      {
        slideKey: 'standings:1',
        slideType: 'standings',
        facts: [
          { placeholder: '{{t:equipo-norte}}', kind: 'team', display: 'Equipo Norte' },
          { placeholder: '{{f:standing-1-points}}', kind: 'points', display: '9' },
        ],
      },
      { slideKey: 'closing', slideType: 'closing', facts: [] },
    ],
    captionFacts: [{ placeholder: '{{f:matchday}}', kind: 'matchday', display: 'Jornada 3' }],
  };
}

const signal = (): { signal: AbortSignal } => ({ signal: new AbortController().signal });

function allText(response: DraftResponse): string[] {
  return [
    ...response.slides.flatMap((slide) => [slide.headline, slide.description]),
    response.caption ?? '',
    ...(response.hashtags ?? []),
  ];
}

async function failure(promise: Promise<unknown>): Promise<AiProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('the draft succeeded');
}

let rootDir: string;
let outsideDir: string;

async function writeFixture(scenario: string, content: unknown): Promise<void> {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  await writeFile(path.join(rootDir, 'fixtures', 'ai', `${scenario}.json`), text);
}

beforeAll(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), 'edr-ai-stub-'));
  outsideDir = await mkdtemp(path.join(tmpdir(), 'edr-ai-outside-'));
  await mkdir(path.join(rootDir, 'fixtures', 'ai'), { recursive: true });

  await writeFixture('invented-score', {
    slides: { 'match:demo-1': { headline: '{{t:equipo-norte}} golea', description: 'Ganó por 3 goles' } },
    caption: 'Una jornada de 4 goles',
    hashtags: ['#demo'],
  });
  await writeFixture('by-type', {
    slides: {
      match_result: { headline: 'Tipo partido', description: 'Texto por tipo' },
      cover: { headline: 'Portada', description: 'Por tipo' },
    },
  });
  await writeFixture('unavailable', { slides: {}, simulate: 'unavailable' });
  await writeFixture('invalid-json', { slides: {}, simulate: 'invalid_json' });
  await writeFixture('too-many-hashtags', { slides: {}, hashtags: ['#a', '#b', '#c', '#d'] });
  await writeFixture('too-long', { slides: { cover: { headline: 'h'.repeat(81), description: 'd' } } });
  await writeFixture('not-json', 'this is not JSON');
  await writeFixture('bad-shape', { slides: {}, sourceRef: 'fixture:x' });
  await writeFixture('oversize', { slides: {}, caption: 'x'.repeat(MAX_STUB_FIXTURE_BYTES) });
  await writeFile(path.join(rootDir, 'fixtures', 'ai', 'not-utf8.json'), Buffer.from([0x7b, 0xff, 0xfe, 0x7d]));

  await writeFile(path.join(outsideDir, 'escape.json'), JSON.stringify({ slides: {}, caption: 'outside' }));
  await symlink(path.join(outsideDir, 'escape.json'), path.join(rootDir, 'fixtures', 'ai', 'escape.json'));
  await mkdir(path.join(rootDir, 'fixtures', 'ai', 'directory.json'));
});

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true });
  await rm(outsideDir, { recursive: true, force: true });
});

describe('stub adapter options', () => {
  it('defaults the scenario to default', () => {
    expect(createStubAiProvider({}, { paths: { rootDir: '/nonexistent' } }).scenario).toBe('default');
  });

  it.each([['../escape'], ['Default'], ['a/b'], [''], ['x'.repeat(61)]])(
    'refuses the scenario %j at startup without echoing it',
    (scenario) => {
      let error: unknown;
      try {
        createStubAiProvider({ scenario }, { paths: { rootDir } });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).setting).toBe('providers.ai.options.scenario');
      if (scenario.length > 0) {
        expect((error as ConfigError).message).not.toContain(scenario);
      }
    },
  );

  it('refuses unknown options, including an API key option', () => {
    expect(() => createStubAiProvider({ scenario: 'default', apiKey: 'x' }, { paths: { rootDir } })).toThrow(
      ConfigError,
    );
  });
});

describe('built-in deterministic draft (no fixture file)', () => {
  it('answers every slide with placeholders only: no digits, no team names', async () => {
    const stub = createStubAiProvider({ scenario: 'no-such-file' }, { paths: { rootDir } });
    const response = await stub.generateDraft(sampleRequest(), signal());
    expect(response.slides.map((slide) => slide.slideKey)).toEqual(['cover', 'match:demo-1', 'standings:1', 'closing']);
    expect(response.caption).toBeDefined();
    expect(response.hashtags).toEqual(['#futbol']);

    const known = new Set(sampleRequest().slides.flatMap((slide) => slide.facts.map((fact) => fact.placeholder)));
    known.add('{{f:matchday}}');
    for (const text of allText(response)) {
      for (const placeholder of text.match(PLACEHOLDER) ?? []) {
        expect(known.has(placeholder)).toBe(true);
      }
      const withoutPlaceholders = text.replace(PLACEHOLDER, '');
      expect(withoutPlaceholders).not.toMatch(/\p{N}/u);
      expect(withoutPlaceholders).not.toContain('Equipo');
    }
    const match = response.slides[1];
    expect(match?.headline).toContain('{{t:equipo-norte}}');
    expect(match?.description).toContain('{{f:match-demo-1-score}}');
  });

  it('is deterministic and follows the language of the request (R-236)', async () => {
    const stub = createStubAiProvider({}, { paths: { rootDir } });
    const first = await stub.generateDraft(sampleRequest('es'), signal());
    const second = await stub.generateDraft(sampleRequest('es'), signal());
    expect(second).toEqual(first);
    const english = await stub.generateDraft(sampleRequest('en'), signal());
    expect(english.slides[0]?.headline).toBe('Roundup');
    expect(first.slides[0]?.headline).toBe('Resumen');
    expect(english.hashtags).toEqual(['#football']);
  });

  it('keeps within the request limits by dropping whole placeholders', async () => {
    const request = sampleRequest();
    request.limits = { headlineMaxChars: 10, descriptionMaxChars: 25, captionMaxChars: 10, maxHashtags: 0 };
    const response = await createStubAiProvider({}, { paths: { rootDir } }).generateDraft(request, signal());
    for (const slide of response.slides) {
      expect([...slide.headline].length).toBeLessThanOrEqual(10);
      expect([...slide.description].length).toBeLessThanOrEqual(25);
      expect(slide.description.replace(PLACEHOLDER, '')).not.toContain('{{');
    }
    expect(response.hashtags).toEqual([]);
  });

  it('regenerates only the requested slides, without caption', async () => {
    const response = await createStubAiProvider({}, { paths: { rootDir } }).generateDraft(
      { ...sampleRequest(), only: ['match:demo-1'] },
      signal(),
    );
    expect(response.slides.map((slide) => slide.slideKey)).toEqual(['match:demo-1']);
    expect(response.caption).toBeUndefined();
    expect(response.hashtags).toBeUndefined();
  });
});

describe('fixture files', () => {
  it('returns fixture texts by slide key, as given (content checks run later)', async () => {
    const response = await createStubAiProvider({ scenario: 'invented-score' }, { paths: { rootDir } }).generateDraft(
      sampleRequest(),
      signal(),
    );
    expect(response.slides[1]).toEqual({
      slideKey: 'match:demo-1',
      headline: '{{t:equipo-norte}} golea',
      description: 'Ganó por 3 goles',
    });
    expect(response.caption).toBe('Una jornada de 4 goles');
    expect(response.hashtags).toEqual(['#demo']);
    expect(response.slides[0]?.headline).toBe('Resumen');
  });

  it('falls back to the slide type entry', async () => {
    const response = await createStubAiProvider({ scenario: 'by-type' }, { paths: { rootDir } }).generateDraft(
      sampleRequest(),
      signal(),
    );
    expect(response.slides[0]?.headline).toBe('Portada');
    expect(response.slides[1]?.headline).toBe('Tipo partido');
    expect(response.slides[3]?.headline).toBe('Gracias por seguirnos');
  });

  it.each([
    ['unavailable', 'unavailable'],
    ['invalid-json', 'ai_response_invalid'],
    ['too-many-hashtags', 'ai_response_invalid'],
    ['too-long', 'ai_response_invalid'],
    ['not-json', 'ai_response_invalid'],
    ['bad-shape', 'ai_response_invalid'],
    ['oversize', 'ai_response_invalid'],
    ['not-utf8', 'ai_response_invalid'],
    ['escape', 'unavailable'],
    ['directory', 'unavailable'],
  ])('scenario %s fails with %s', async (scenario, code) => {
    const stub = createStubAiProvider({ scenario }, { paths: { rootDir } });
    const error = await failure(stub.generateDraft(sampleRequest(), signal()));
    expect(error.code).toBe(code);
    expect(error.message).not.toContain(rootDir);
    expect(error.message).not.toContain(scenario === 'escape' ? outsideDir : rootDir);
    expect(error.message).not.toContain('outside');
  });
});

describe('recorded request and strict request schema', () => {
  it('records the last validated request, frozen', async () => {
    const stub = createStubAiProvider({}, { paths: { rootDir } });
    expect(stub.lastRequest).toBeNull();
    await stub.generateDraft(sampleRequest('en'), signal());
    expect(stub.lastRequest?.language).toBe('en');
    await stub.generateDraft(sampleRequest('es'), signal());
    expect(stub.lastRequest?.language).toBe('es');
    expect(stub.lastRequest).toEqual(sampleRequest('es'));
    expect(Object.isFrozen(stub.lastRequest)).toBe(true);
  });

  it.each(['sourceRef', 'fileName'])('refuses a request carrying %s before drafting', async (field) => {
    const stub = createStubAiProvider({}, { paths: { rootDir } });
    const request = sampleRequest();
    const fact = request.slides[1]?.facts[0] as unknown as Record<string, unknown>;
    fact[field] = 'fixture:demo-a/marker.json';
    const error = await failure(stub.generateDraft(request, signal()));
    expect(error.code).toBe('invalid');
    expect(error.path).toBe('slides[1].facts[0]');
    expect(stub.lastRequest).toBeNull();
  });

  it('fails with unavailable when the caller already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await failure(
      createStubAiProvider({}, { paths: { rootDir } }).generateDraft(sampleRequest(), { signal: controller.signal }),
    );
    expect(error.code).toBe('unavailable');
  });
});
