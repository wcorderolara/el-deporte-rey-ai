/**
 * Schemas of the AI port (contracts/provider-ports.md section 2; T11H-F16, V-13a; AD-11).
 *
 * - `DraftRequest` is validated with a strict schema (unknown keys rejected at every level) before any adapter sends
 *   it, so that a field such as `sourceRef`, `ref`, `declaredSource`, `fileName` or a data mode can never reach a
 *   prompt. Every string is bounded and free of control and format characters.
 * - `DraftResponse` is validated against the request it answers: closed objects, only the requested slide keys, each
 *   exactly once, field lengths limited by `limits`, at most `maxHashtags` hashtags. Content rules (numbers, names,
 *   control characters, URLs) are the content checks of the content stage, not this schema.
 * - The stub fixture file format (`fixtures/ai/<scenario>.json`) is validated by `parseAiStubFixture`.
 */
import { z } from 'zod';

import { AiProviderError } from './errors.js';

// ---------------------------------------------------------------------------------------------------------------
// Types (contracts/provider-ports.md section 2)
// ---------------------------------------------------------------------------------------------------------------

export const DRAFT_LANGUAGES = ['es', 'en'] as const;
export type DraftLanguage = (typeof DRAFT_LANGUAGES)[number];

export const SLIDE_TYPES = ['cover', 'match_result', 'standings', 'closing'] as const;
export type SlideType = (typeof SLIDE_TYPES)[number];

export interface DraftFact {
  /** `{{f:<ref>}}` for a value or `{{t:<teamId>}}` for a team name (architecture.md section 8.2). */
  placeholder: string;
  kind: string;
  /** The deterministic display value, shown to the AI next to its placeholder. */
  display: string;
}

export interface DraftSlide {
  /** Stable key, for example `match:<matchKey>`. */
  slideKey: string;
  slideType: SlideType;
  facts: DraftFact[];
}

export interface DraftLimits {
  headlineMaxChars: number;
  descriptionMaxChars: number;
  captionMaxChars: number;
  maxHashtags: number;
}

export interface DraftRequest {
  language: DraftLanguage;
  brand: { name: string; handle: string };
  limits: DraftLimits;
  slides: DraftSlide[];
  captionFacts: DraftFact[];
  /** Slide keys to (re)generate; absent means all slides and the caption. */
  only?: string[];
}

export interface DraftResponseSlide {
  slideKey: string;
  headline: string;
  description: string;
}

export interface DraftResponse {
  slides: DraftResponseSlide[];
  caption?: string;
  hashtags?: string[];
}

// ---------------------------------------------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------------------------------------------

/** Slide keys: `cover`, `match:<matchKey>`, `standings:2`, ... */
export const SLIDE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
/** Fact placeholders: `{{f:<factRef>}}` (a value) or `{{t:<teamId>}}` (a team name). */
export const PLACEHOLDER_PATTERN = /^\{\{[ft]:[A-Za-z0-9][A-Za-z0-9:._-]{0,127}\}\}$/;
/** Fact kinds: lower-case identifiers such as `score` or `team`. */
export const FACT_KIND_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
/** The brand handle, as the configuration accepts it. */
export const BRAND_HANDLE_PATTERN = /^@[A-Za-z0-9._]{1,30}$/;

export const MAX_DISPLAY_CHARS = 200;
export const MAX_BRAND_NAME_CHARS = 80;
export const MAX_SLIDES = 200;
export const MAX_FACTS_PER_LIST = 400;
export const MAX_FACTS_TOTAL = 2000;
export const MAX_HASHTAG_CHARS = 100;
/** Bounds of `limits` (Instagram allows captions of up to 2200 characters and 30 hashtags). */
export const LIMIT_BOUNDS = {
  headlineMaxChars: { min: 10, max: 500 },
  descriptionMaxChars: { min: 10, max: 2000 },
  captionMaxChars: { min: 10, max: 2200 },
  maxHashtags: { min: 0, max: 30 },
} as const;

const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}]*$/u;

/** Length in Unicode code points, the unit of every `...MaxChars` limit. */
export function codePointLength(value: string): number {
  let count = 0;
  for (const _ of value) {
    count += 1;
  }
  return count;
}

const boundedText = (max: number): z.ZodString =>
  z
    .string()
    .min(1)
    .max(max * 2)
    .regex(NO_CONTROL_OR_FORMAT)
    .refine((value) => codePointLength(value) <= max, { message: 'is too long' });

const integer = (bounds: { min: number; max: number }): z.ZodNumber => z.number().int().min(bounds.min).max(bounds.max);

// ---------------------------------------------------------------------------------------------------------------
// DraftRequest (strict, T11H-F16)
// ---------------------------------------------------------------------------------------------------------------

const factSchema = z.strictObject({
  placeholder: z.string().regex(PLACEHOLDER_PATTERN),
  kind: z.string().regex(FACT_KIND_PATTERN),
  // A display value never contains placeholder delimiters, so that data cannot imitate a placeholder.
  display: boundedText(MAX_DISPLAY_CHARS).refine((value) => !value.includes('{{') && !value.includes('}}'), {
    message: 'must not contain placeholder delimiters',
  }),
});

const slideSchema = z.strictObject({
  slideKey: z.string().regex(SLIDE_KEY_PATTERN),
  slideType: z.enum(SLIDE_TYPES),
  facts: z.array(factSchema).max(MAX_FACTS_PER_LIST),
});

export const DraftRequestSchema: z.ZodType<DraftRequest> = z
  .strictObject({
    language: z.enum(DRAFT_LANGUAGES),
    brand: z.strictObject({
      name: boundedText(MAX_BRAND_NAME_CHARS),
      handle: z.string().regex(BRAND_HANDLE_PATTERN),
    }),
    limits: z.strictObject({
      headlineMaxChars: integer(LIMIT_BOUNDS.headlineMaxChars),
      descriptionMaxChars: integer(LIMIT_BOUNDS.descriptionMaxChars),
      captionMaxChars: integer(LIMIT_BOUNDS.captionMaxChars),
      maxHashtags: integer(LIMIT_BOUNDS.maxHashtags),
    }),
    slides: z.array(slideSchema).min(1).max(MAX_SLIDES),
    captionFacts: z.array(factSchema).max(MAX_FACTS_PER_LIST),
    only: z.array(z.string().regex(SLIDE_KEY_PATTERN)).min(1).max(MAX_SLIDES).optional(),
  })
  .superRefine((request, ctx) => {
    const keys = new Set<string>();
    let facts = request.captionFacts.length;
    request.slides.forEach((slide, index) => {
      facts += slide.facts.length;
      if (keys.has(slide.slideKey)) {
        ctx.addIssue({ code: 'custom', path: ['slides', index, 'slideKey'], message: 'duplicates a slide key' });
      }
      keys.add(slide.slideKey);
    });
    if (facts > MAX_FACTS_TOTAL) {
      ctx.addIssue({ code: 'custom', path: ['slides'], message: 'holds too many facts' });
    }
    const only = new Set<string>();
    request.only?.forEach((key, index) => {
      if (!keys.has(key) || only.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['only', index], message: 'must name each slide of the request once' });
      }
      only.add(key);
    });
  });

/** Renders a Zod issue path from schema field names and array indexes only (never a value). */
function issuePath(path: readonly PropertyKey[]): string {
  let text = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      text += `[${String(segment)}]`;
    } else {
      const name = typeof segment === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(segment) ? segment : '?';
      text += text === '' ? name : `.${name}`;
    }
  }
  return text === '' ? 'request' : text;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const member of Object.values(value)) {
      deepFreeze(member);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Validates a draft request with the strict schema and returns a frozen copy holding only the schema's fields.
 * Throws `AiProviderError('invalid')` with the validation path of the first issue; the message names no value.
 */
export function parseDraftRequest(input: unknown): DraftRequest {
  const result = DraftRequestSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AiProviderError('invalid', { path: issuePath(issue?.path ?? []) });
  }
  return deepFreeze(result.data);
}

// ---------------------------------------------------------------------------------------------------------------
// DraftResponse (validated against the request it answers)
// ---------------------------------------------------------------------------------------------------------------

/** The slide keys a request asks for: `only`, or every slide. */
export function requestedSlideKeys(request: DraftRequest): string[] {
  return request.only !== undefined ? [...request.only] : request.slides.map((slide) => slide.slideKey);
}

const limitedString = (max: number): z.ZodType<string> =>
  z
    .string()
    .max(max * 2)
    .refine((value) => codePointLength(value) <= max, { message: 'is too long' });

/** The closed response schema for one request. */
export function draftResponseSchema(request: DraftRequest): z.ZodType<DraftResponse> {
  const expected = requestedSlideKeys(request);
  const expectedSet = new Set(expected);
  const { limits } = request;
  return z
    .strictObject({
      slides: z
        .array(
          z.strictObject({
            slideKey: z.string().max(128),
            headline: limitedString(limits.headlineMaxChars).refine((value) => value.trim() !== ''),
            description: limitedString(limits.descriptionMaxChars).refine((value) => value.trim() !== ''),
          }),
        )
        .max(expected.length),
      caption: limitedString(limits.captionMaxChars).optional(),
      hashtags: z.array(z.string().min(1).max(MAX_HASHTAG_CHARS)).max(limits.maxHashtags).optional(),
    })
    .superRefine((response, ctx) => {
      const seen = new Set<string>();
      response.slides.forEach((slide, index) => {
        if (!expectedSet.has(slide.slideKey)) {
          ctx.addIssue({ code: 'custom', path: ['slides', index, 'slideKey'], message: 'is not a requested slide' });
        } else if (seen.has(slide.slideKey)) {
          ctx.addIssue({ code: 'custom', path: ['slides', index, 'slideKey'], message: 'is repeated' });
        }
        seen.add(slide.slideKey);
      });
      if (seen.size !== expectedSet.size || expected.some((key) => !seen.has(key))) {
        ctx.addIssue({ code: 'custom', path: ['slides'], message: 'must answer every requested slide' });
      }
    });
}

/**
 * Validates a parsed response against its request and returns a frozen copy with the slides in request order.
 * Throws `AiProviderError('ai_response_invalid')`; no part of the response is kept on the error.
 */
export function parseDraftResponse(input: unknown, request: DraftRequest, httpStatus?: number): DraftResponse {
  const result = draftResponseSchema(request).safeParse(input);
  if (!result.success) {
    throw new AiProviderError('ai_response_invalid', { httpStatus: httpStatus ?? null });
  }
  const order = new Map(requestedSlideKeys(request).map((key, index) => [key, index]));
  const slides = [...result.data.slides].sort((a, b) => (order.get(a.slideKey) ?? 0) - (order.get(b.slideKey) ?? 0));
  return deepFreeze({ ...result.data, slides });
}

/** Parses response text as JSON (JSON only: no code fences, no prose) and validates it against its request. */
export function parseDraftResponseText(text: string, request: DraftRequest, httpStatus?: number): DraftResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AiProviderError('ai_response_invalid', { httpStatus: httpStatus ?? null });
  }
  return parseDraftResponse(value, request, httpStatus);
}

// ---------------------------------------------------------------------------------------------------------------
// Stub fixture files (`fixtures/ai/<scenario>.json`)
// ---------------------------------------------------------------------------------------------------------------

export const STUB_SIMULATIONS = ['unavailable', 'invalid_json'] as const;
export type StubSimulation = (typeof STUB_SIMULATIONS)[number];

/** Longest fixture text field; the response schema applies the request's limits afterwards. */
export const MAX_FIXTURE_TEXT_CHARS = 5000;

export interface AiStubFixtureSlide {
  readonly headline: string;
  readonly description: string;
}

export interface AiStubFixture {
  /** Texts keyed by slide key or slide type; a slide key wins over its slide type. */
  readonly slides: ReadonlyMap<string, AiStubFixtureSlide>;
  readonly caption?: string;
  readonly hashtags?: readonly string[];
  readonly simulate?: StubSimulation;
}

// Fixture texts may hold any characters (the content-check bypass fixtures of T23 carry format characters).
const fixtureText = z.string().max(MAX_FIXTURE_TEXT_CHARS);

const fixtureSchema = z.strictObject({
  slides: z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  ),
  caption: fixtureText.optional(),
  hashtags: z.array(z.string().max(MAX_HASHTAG_CHARS)).max(LIMIT_BOUNDS.maxHashtags.max).optional(),
  simulate: z.enum(STUB_SIMULATIONS).optional(),
});

const fixtureSlideSchema = z.strictObject({ headline: fixtureText, description: fixtureText });

/**
 * Validates a parsed stub fixture document. Slide entries are read as own properties into a `Map` (T11H-F07), keyed
 * by slide key or slide type (`SLIDE_KEY_PATTERN`). Throws `AiProviderError('ai_response_invalid')` when invalid.
 */
export function parseAiStubFixture(input: unknown): AiStubFixture {
  const result = fixtureSchema.safeParse(input);
  if (!result.success) {
    throw new AiProviderError('ai_response_invalid');
  }
  const slides = new Map<string, AiStubFixtureSlide>();
  for (const [key, value] of Object.entries(result.data.slides)) {
    const slide = fixtureSlideSchema.safeParse(value);
    if (!SLIDE_KEY_PATTERN.test(key) || !slide.success) {
      throw new AiProviderError('ai_response_invalid');
    }
    slides.set(key, Object.freeze({ ...slide.data }));
  }
  const fixture: {
    slides: ReadonlyMap<string, AiStubFixtureSlide>;
    caption?: string;
    hashtags?: readonly string[];
    simulate?: StubSimulation;
  } = { slides };
  if (result.data.caption !== undefined) {
    fixture.caption = result.data.caption;
  }
  if (result.data.hashtags !== undefined) {
    fixture.hashtags = Object.freeze([...result.data.hashtags]);
  }
  if (result.data.simulate !== undefined) {
    fixture.simulate = result.data.simulate;
  }
  return Object.freeze(fixture);
}
