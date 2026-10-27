/**
 * Stub AI adapter (contracts/provider-ports.md section 2; architecture.md section 5.3; R-223). It performs no network
 * I/O and is the adapter of the default configuration and of every test.
 *
 * - It reads `fixtures/ai/<scenario>.json` under the project root at call time. The scenario matches
 *   `STUB_SCENARIO_PATTERN`, and the resolved file must stay under `fixtures/ai/` (also after resolving symbolic
 *   links) and be a regular file of at most `MAX_STUB_FIXTURE_BYTES`.
 * - Each requested slide takes the fixture texts of its slide key, else of its slide type, else the built-in text.
 *   Without a fixture file the whole draft is built in: deterministic, placeholders only, no digits, number words or
 *   team names.
 * - `simulate: "unavailable"` fails with `unavailable`; `simulate: "invalid_json"` returns text that is not JSON,
 *   which fails with `ai_response_invalid` like a real invalid response.
 * - The response goes through the same JSON parse and response schema as the OpenAI-compatible adapter.
 * - It records the last validated request (`lastRequest`) for test assertions, for example the language (R-236).
 */
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';

import { AiProviderError } from './errors.js';
import { type StubAdapterOptions, parseStubOptions } from './options.js';
import type { AiDraftContext, AiPaths, AiTextProvider } from './port.js';
import {
  type AiStubFixture,
  type DraftFact,
  type DraftLanguage,
  type DraftRequest,
  type DraftResponse,
  type DraftSlide,
  type SlideType,
  codePointLength,
  parseAiStubFixture,
  parseDraftRequest,
  parseDraftResponseText,
  requestedSlideKeys,
} from './schemas.js';

/** Largest stub fixture file read (the AI response cap, T10-F07). */
export const MAX_STUB_FIXTURE_BYTES = 256 * 1024;

/** Text returned by `simulate: "invalid_json"`. */
const INVALID_JSON_TEXT = '{"slides": [';

interface BuiltInTexts {
  readonly slides: Readonly<Record<SlideType, { readonly headline: string; readonly description: string }>>;
  readonly caption: string;
  readonly hashtags: readonly string[];
}

/** Built-in texts: no digits, number words, team names, persons or venues (AD-11, T10-F06). */
const BUILT_IN: Readonly<Record<DraftLanguage, BuiltInTexts>> = {
  es: {
    slides: {
      cover: { headline: 'Resumen', description: 'Lo más destacado de la selección' },
      match_result: { headline: 'Partido', description: 'Datos del partido' },
      standings: { headline: 'Clasificación', description: 'Tabla de posiciones' },
      closing: { headline: 'Gracias por seguirnos', description: 'Síguenos para más resultados' },
    },
    caption: 'Resumen de resultados',
    hashtags: ['#futbol'],
  },
  en: {
    slides: {
      cover: { headline: 'Roundup', description: 'Highlights of the selection' },
      match_result: { headline: 'Match', description: 'Match details' },
      standings: { headline: 'Standings', description: 'League table' },
      closing: { headline: 'Thanks for following', description: 'Follow us for more results' },
    },
    caption: 'Results roundup',
    hashtags: ['#football'],
  },
};

function truncate(value: string, max: number): string {
  return codePointLength(value) <= max ? value : [...value].slice(0, max).join('').trimEnd();
}

/** Fixed text followed by as many whole placeholders as fit in `max` code points. */
function fitWithPlaceholders(fixed: string, placeholders: readonly string[], max: number): string {
  let text = truncate(fixed, max);
  let separator = ': ';
  for (const placeholder of placeholders) {
    const candidate = `${text}${separator}${placeholder}`;
    if (codePointLength(candidate) > max) {
      break;
    }
    text = candidate;
    separator = ' · ';
  }
  return text;
}

function placeholders(facts: readonly DraftFact[], teamsOnly: boolean): string[] {
  return facts.map((fact) => fact.placeholder).filter((value) => !teamsOnly || value.startsWith('{{t:'));
}

function builtInSlide(slide: DraftSlide, request: DraftRequest): { headline: string; description: string } {
  const texts = BUILT_IN[request.language].slides[slide.slideType];
  return {
    headline: fitWithPlaceholders(texts.headline, placeholders(slide.facts, true), request.limits.headlineMaxChars),
    description: fitWithPlaceholders(
      texts.description,
      placeholders(slide.facts, false),
      request.limits.descriptionMaxChars,
    ),
  };
}

/** The draft of the stub: fixture texts where given, built-in texts otherwise. */
function buildDraft(request: DraftRequest, fixture: AiStubFixture | null): DraftResponse {
  const slideByKey = new Map(request.slides.map((slide) => [slide.slideKey, slide]));
  const slides = requestedSlideKeys(request).flatMap((key) => {
    const slide = slideByKey.get(key);
    if (slide === undefined) {
      return [];
    }
    const texts =
      fixture?.slides.get(slide.slideKey) ?? fixture?.slides.get(slide.slideType) ?? builtInSlide(slide, request);
    return [{ slideKey: slide.slideKey, headline: texts.headline, description: texts.description }];
  });
  const draft: DraftResponse = { slides };
  if (request.only === undefined) {
    const builtIn = BUILT_IN[request.language];
    draft.caption =
      fixture?.caption ??
      fitWithPlaceholders(builtIn.caption, placeholders(request.captionFacts, false), request.limits.captionMaxChars);
    draft.hashtags = [...(fixture?.hashtags ?? builtIn.hashtags.slice(0, request.limits.maxHashtags))];
  }
  return draft;
}

function isMissingFile(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * Reads and validates the scenario's fixture file, or returns null when there is none. A file outside
 * `fixtures/ai/`, a non-regular file or an unreadable file fails with `unavailable`; an oversize, non-UTF-8,
 * non-JSON or invalid fixture fails with `ai_response_invalid`.
 */
async function readFixture(rootDir: string, scenario: string): Promise<AiStubFixture | null> {
  const directory = path.resolve(rootDir, 'fixtures', 'ai');
  const file = path.join(directory, `${scenario}.json`);
  let realDirectory: string;
  let realFile: string;
  try {
    realDirectory = await realpath(directory);
    realFile = await realpath(file);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw new AiProviderError('unavailable');
  }
  if (path.dirname(realFile) !== realDirectory || !realFile.startsWith(realDirectory + path.sep)) {
    throw new AiProviderError('unavailable');
  }

  let bytes: Uint8Array;
  try {
    const handle = await open(realFile, 'r');
    try {
      const stats = await handle.stat();
      if (!stats.isFile()) {
        throw new AiProviderError('unavailable');
      }
      if (stats.size > MAX_STUB_FIXTURE_BYTES) {
        throw new AiProviderError('ai_response_invalid');
      }
      const buffer = new Uint8Array(MAX_STUB_FIXTURE_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > MAX_STUB_FIXTURE_BYTES) {
        throw new AiProviderError('ai_response_invalid');
      }
      bytes = buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch (error) {
    throw error instanceof AiProviderError ? error : new AiProviderError('unavailable');
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AiProviderError('ai_response_invalid');
  }
  return parseAiStubFixture(value);
}

/** The stub adapter, with the last validated request it received. */
export interface StubAiTextProvider extends AiTextProvider {
  readonly id: 'stub';
  readonly scenario: string;
  /** The last request that passed the strict request schema, frozen; null before the first one. */
  readonly lastRequest: DraftRequest | null;
}

class StubAdapter implements StubAiTextProvider {
  readonly id = 'stub' as const;
  readonly #options: StubAdapterOptions;
  readonly #paths: AiPaths;
  #lastRequest: DraftRequest | null = null;

  constructor(options: StubAdapterOptions, paths: AiPaths) {
    this.#options = options;
    this.#paths = Object.freeze({ rootDir: paths.rootDir });
  }

  get scenario(): string {
    return this.#options.scenario;
  }

  get lastRequest(): DraftRequest | null {
    return this.#lastRequest;
  }

  async generateDraft(req: DraftRequest, ctx: AiDraftContext): Promise<DraftResponse> {
    const request = parseDraftRequest(req);
    this.#lastRequest = request;
    if (ctx.signal.aborted) {
      throw new AiProviderError('unavailable');
    }
    const fixture = await readFixture(this.#paths.rootDir, this.#options.scenario);
    if (fixture?.simulate === 'unavailable') {
      throw new AiProviderError('unavailable');
    }
    const text =
      fixture?.simulate === 'invalid_json' ? INVALID_JSON_TEXT : JSON.stringify(buildDraft(request, fixture));
    return parseDraftResponseText(text, request);
  }
}

/** Creates the stub adapter; invalid options stop startup with a `ConfigError`. */
export function createStubAiProvider(options: unknown, deps: { readonly paths: AiPaths }): StubAiTextProvider {
  return new StubAdapter(parseStubOptions(options), deps.paths);
}
