/**
 * Schemas of the editorial writer port (PD-ARCH-01H; same rules as the draft port, T11H-F16, V-13a).
 *
 * - `EditorialRequest` is validated with a strict schema before any adapter sends it: only placeholders with their
 *   deterministic display values, the confirmed match references, the round state, the deterministic key events and
 *   the evidence identifiers reach a prompt. No source reference, data mode, file path, URL, person or provider text.
 *   The operator instruction is one bounded printable line, sent as a preference inside the data block.
 * - `EditorialResponse` is validated against the request it answers: exactly the requested deliverables, closed
 *   objects, bounded strings, and only the key event and evidence identifiers the request gave. Content rules
 *   (numbers, names, lengths, hook, hashtags, claims) are the editorial checks of the module, not this schema.
 */
import { EDITORIAL_DELIVERABLES, type EditorialDeliverable } from '@edr/contracts';
import { z } from 'zod';

import { AiProviderError } from './errors.js';
import { BRAND_HANDLE_PATTERN, FACT_KIND_PATTERN, MAX_DISPLAY_CHARS, PLACEHOLDER_PATTERN } from './schemas.js';

export const EDITORIAL_CONTENT_KINDS = ['results', 'calendar', 'upcoming', 'preview'] as const;
export type EditorialContentKind = (typeof EDITORIAL_CONTENT_KINDS)[number];

export const EDITORIAL_EVENT_KINDS = [
  'thrashing',
  'high_scoring',
  'away_win',
  'home_win',
  'goalless_draw',
  'scoring_draw',
  'round_incomplete',
  'postponed_matches',
  'upcoming_matches',
] as const;
export type EditorialEventKind = (typeof EDITORIAL_EVENT_KINDS)[number];

export const MATCH_REF_PATTERN = /^m[1-9][0-9]{0,2}$/;
export const EVENT_ID_PATTERN = /^evt-[a-z0-9][a-z0-9-]{0,59}$/;
export const EVIDENCE_ID_PATTERN = /^ev-[a-z0-9][a-z0-9-]{0,59}$/;
const INSTRUCTIONS_PATTERN = /^[^\p{Cc}\p{Cf}]{1,500}$/u;
const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}]*$/u;
const HASHTAG = /^#[\p{L}\p{M}\p{N}_]{1,60}$/u;

export const MAX_EDITORIAL_MATCHES = 120;
export const MAX_EDITORIAL_FACTS = 1200;
export const MAX_EDITORIAL_EVENTS = 40;
export const MAX_EDITORIAL_EVIDENCE = 400;
/** Longest string of any field of a response (the YouTube description limit). */
export const MAX_EDITORIAL_RESPONSE_TEXT = 5000;

/** Limits the writer is asked to respect; the module checks them on the final text. */
export interface EditorialLimits {
  readonly headlineMaxChars: number;
  readonly bodyMinWords: number;
  readonly bodyMaxWords: number;
  readonly questionMaxChars: number;
  readonly minHashtags: number;
  readonly maxHashtags: number;
  readonly shortCopyMaxWords: number;
  readonly viralHeadlineMaxChars: number;
  readonly youtubeTitleMaxChars: number;
  readonly youtubeDescriptionMaxChars: number;
}

export interface EditorialFact {
  readonly placeholder: string;
  readonly kind: string;
  readonly display: string;
}

/** A confirmed match, by placeholders only. Results have a score and result; fixtures a kickoff and status. */
export interface EditorialMatch {
  readonly ref: string;
  readonly home: string;
  readonly away: string;
  readonly played: boolean;
  readonly score: string | null;
  readonly result: string | null;
  readonly kickoff: string | null;
  readonly status: string | null;
}

export interface EditorialRound {
  readonly status: 'complete' | 'incomplete' | 'unknown';
  /** Placeholders of the counts, or null when the count is unknown. */
  readonly total: string | null;
  readonly finished: string | null;
  readonly pending: string | null;
  readonly inProgress: string | null;
}

export interface EditorialKeyEvent {
  readonly id: string;
  readonly kind: EditorialEventKind;
  readonly matchRef: string | null;
}

export interface EditorialEvidenceRef {
  readonly id: string;
  readonly verification: 'CONFIRMED' | 'VERIFIED_EXTERNAL';
  readonly matchRef: string | null;
}

export interface EditorialTeamHashtag {
  readonly team: string;
  readonly hashtag: string;
}

export interface EditorialRequest {
  readonly language: 'es' | 'en';
  readonly brand: { readonly name: string; readonly handle: string };
  readonly contentKind: EditorialContentKind;
  readonly deliverables: readonly EditorialDeliverable[];
  readonly selection: { readonly competition: string; readonly stage: string; readonly season: string };
  readonly facts: readonly EditorialFact[];
  readonly matches: readonly EditorialMatch[];
  readonly round: EditorialRound;
  readonly standingsAvailable: boolean;
  readonly keyEvents: readonly EditorialKeyEvent[];
  readonly evidence: readonly EditorialEvidenceRef[];
  readonly teamHashtags: readonly EditorialTeamHashtag[];
  readonly research: { readonly mode: 'local_context' | 'verified_research' };
  readonly operatorInstructions: string | null;
  readonly limits: EditorialLimits;
}

export interface EditorialFacebookInstagram {
  readonly headline: string;
  readonly body: string;
  readonly question: string;
  readonly hashtags: readonly string[];
}

/** The writer's answer: the requested deliverables, with placeholders not yet substituted. */
export interface EditorialResponse {
  readonly facebookInstagram?: EditorialFacebookInstagram;
  readonly tiktokReels?: { readonly copy: string };
  readonly viralHeadlines?: { readonly headline_1: string; readonly headline_2: string; readonly headline_3: string };
  readonly youtube?: { readonly title: string; readonly description: string };
  readonly debateQuestion?: { readonly question: string };
  readonly keyEventIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

/** Response property of each deliverable. */
export const RESPONSE_KEY: Readonly<Record<EditorialDeliverable, keyof EditorialResponse>> = Object.freeze({
  facebook_instagram: 'facebookInstagram',
  tiktok_reels: 'tiktokReels',
  viral_headlines: 'viralHeadlines',
  youtube: 'youtube',
  debate_question: 'debateQuestion',
});

/** Usage reported by the provider, in tokens; null counts when it reported none. */
export interface EditorialUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface EditorialResult {
  readonly response: EditorialResponse;
  readonly usage: EditorialUsage | null;
}

// ---------------------------------------------------------------------------------------------------------------
// Request (strict)
// ---------------------------------------------------------------------------------------------------------------

const placeholder = z.string().regex(PLACEHOLDER_PATTERN);
const bounded = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(NO_CONTROL_OR_FORMAT)
    .refine((value) => !value.includes('{{') && !value.includes('}}'), { message: 'holds placeholder delimiters' });
const limit = (min: number, max: number) => z.number().int().min(min).max(max);

const requestSchema = z
  .strictObject({
    language: z.enum(['es', 'en']),
    brand: z.strictObject({ name: bounded(80), handle: z.string().regex(BRAND_HANDLE_PATTERN) }),
    contentKind: z.enum(EDITORIAL_CONTENT_KINDS),
    deliverables: z.array(z.enum(EDITORIAL_DELIVERABLES)).min(1).max(EDITORIAL_DELIVERABLES.length),
    selection: z.strictObject({ competition: placeholder, stage: placeholder, season: placeholder }),
    facts: z
      .array(
        z.strictObject({
          placeholder,
          kind: z.string().regex(FACT_KIND_PATTERN),
          display: bounded(MAX_DISPLAY_CHARS),
        }),
      )
      .min(1)
      .max(MAX_EDITORIAL_FACTS),
    matches: z
      .array(
        z.strictObject({
          ref: z.string().regex(MATCH_REF_PATTERN),
          home: placeholder,
          away: placeholder,
          played: z.boolean(),
          score: placeholder.nullable(),
          result: placeholder.nullable(),
          kickoff: placeholder.nullable(),
          status: placeholder.nullable(),
        }),
      )
      .min(1)
      .max(MAX_EDITORIAL_MATCHES),
    round: z.strictObject({
      status: z.enum(['complete', 'incomplete', 'unknown']),
      total: placeholder.nullable(),
      finished: placeholder.nullable(),
      pending: placeholder.nullable(),
      inProgress: placeholder.nullable(),
    }),
    standingsAvailable: z.boolean(),
    keyEvents: z
      .array(
        z.strictObject({
          id: z.string().regex(EVENT_ID_PATTERN),
          kind: z.enum(EDITORIAL_EVENT_KINDS),
          matchRef: z.string().regex(MATCH_REF_PATTERN).nullable(),
        }),
      )
      .max(MAX_EDITORIAL_EVENTS),
    evidence: z
      .array(
        z.strictObject({
          id: z.string().regex(EVIDENCE_ID_PATTERN),
          verification: z.enum(['CONFIRMED', 'VERIFIED_EXTERNAL']),
          matchRef: z.string().regex(MATCH_REF_PATTERN).nullable(),
        }),
      )
      .max(MAX_EDITORIAL_EVIDENCE),
    teamHashtags: z.array(z.strictObject({ team: placeholder, hashtag: z.string().regex(HASHTAG) })).max(240),
    research: z.strictObject({ mode: z.enum(['local_context', 'verified_research']) }),
    operatorInstructions: z.string().regex(INSTRUCTIONS_PATTERN).nullable(),
    limits: z.strictObject({
      headlineMaxChars: limit(10, 300),
      bodyMinWords: limit(1, 1000),
      bodyMaxWords: limit(1, 1000),
      questionMaxChars: limit(10, 500),
      minHashtags: limit(0, 30),
      maxHashtags: limit(0, 30),
      shortCopyMaxWords: limit(1, 1000),
      viralHeadlineMaxChars: limit(10, 300),
      youtubeTitleMaxChars: limit(10, 100),
      youtubeDescriptionMaxChars: limit(10, MAX_EDITORIAL_RESPONSE_TEXT),
    }),
  })
  .superRefine((request, ctx) => {
    const known = new Set(request.facts.map((fact) => fact.placeholder));
    if (known.size !== request.facts.length) {
      ctx.addIssue({ code: 'custom', path: ['facts'], message: 'duplicates a placeholder' });
    }
    if (new Set(request.deliverables).size !== request.deliverables.length) {
      ctx.addIssue({ code: 'custom', path: ['deliverables'], message: 'duplicates a deliverable' });
    }
    const refs = new Set<string>();
    request.matches.forEach((match, index) => {
      if (refs.has(match.ref)) {
        ctx.addIssue({ code: 'custom', path: ['matches', index, 'ref'], message: 'duplicates a match reference' });
      }
      refs.add(match.ref);
      for (const value of [match.home, match.away, match.score, match.result, match.kickoff, match.status]) {
        if (value !== null && !known.has(value)) {
          ctx.addIssue({ code: 'custom', path: ['matches', index], message: 'names an unknown placeholder' });
        }
      }
    });
    for (const value of [request.selection.competition, request.selection.stage, request.selection.season]) {
      if (!known.has(value)) {
        ctx.addIssue({ code: 'custom', path: ['selection'], message: 'names an unknown placeholder' });
      }
    }
    const events = new Set<string>();
    request.keyEvents.forEach((event, index) => {
      if (events.has(event.id) || (event.matchRef !== null && !refs.has(event.matchRef))) {
        ctx.addIssue({ code: 'custom', path: ['keyEvents', index], message: 'is not a unique event of a match' });
      }
      events.add(event.id);
    });
    const evidence = new Set<string>();
    request.evidence.forEach((item, index) => {
      if (evidence.has(item.id) || (item.matchRef !== null && !refs.has(item.matchRef))) {
        ctx.addIssue({ code: 'custom', path: ['evidence', index], message: 'is not a unique evidence of a match' });
      }
      evidence.add(item.id);
    });
    if (
      request.research.mode === 'verified_research' &&
      request.evidence.every((item) => item.verification !== 'VERIFIED_EXTERNAL')
    ) {
      ctx.addIssue({ code: 'custom', path: ['research'], message: 'claims research without external evidence' });
    }
    if (
      request.limits.bodyMinWords > request.limits.bodyMaxWords ||
      request.limits.minHashtags > request.limits.maxHashtags
    ) {
      ctx.addIssue({ code: 'custom', path: ['limits'], message: 'has a minimum above its maximum' });
    }
  });

/** Renders a Zod issue path from field names and indexes only (never a value). */
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

/** Validates an editorial request; a refused request is `invalid` with the field path only. */
export function parseEditorialRequest(value: unknown): EditorialRequest {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) {
    throw new AiProviderError('invalid', { path: issuePath(parsed.error.issues[0]?.path ?? []) });
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------------------------------------------
// Response (validated against the request)
// ---------------------------------------------------------------------------------------------------------------

const answerText = z.string().max(MAX_EDITORIAL_RESPONSE_TEXT);

const DELIVERABLE_SCHEMAS = {
  facebookInstagram: z.strictObject({
    headline: answerText,
    body: answerText,
    question: answerText,
    hashtags: z.array(z.string().max(100)).max(30),
  }),
  tiktokReels: z.strictObject({ copy: answerText }),
  viralHeadlines: z.strictObject({ headline_1: answerText, headline_2: answerText, headline_3: answerText }),
  youtube: z.strictObject({ title: answerText, description: answerText }),
  debateQuestion: z.strictObject({ question: answerText }),
} as const;

/** Validates a parsed response against its request; anything unexpected is `ai_response_invalid`. */
export function parseEditorialResponse(
  value: unknown,
  request: EditorialRequest,
  httpStatus?: number,
): EditorialResponse {
  const shape: Record<string, z.ZodType> = {
    keyEventIds: z.array(z.string().max(64)).max(MAX_EDITORIAL_EVENTS),
    evidenceIds: z.array(z.string().max(64)).max(MAX_EDITORIAL_EVIDENCE),
  };
  for (const deliverable of request.deliverables) {
    const key = RESPONSE_KEY[deliverable];
    shape[key] = DELIVERABLE_SCHEMAS[key as keyof typeof DELIVERABLE_SCHEMAS];
  }
  const parsed = z.strictObject(shape).safeParse(value);
  if (!parsed.success) {
    throw new AiProviderError('ai_response_invalid', { httpStatus: httpStatus ?? null });
  }
  // Unknown event or evidence identifiers are not a parse failure: the module flags them
  // (`UNKNOWN_EVENT_REFERENCE`, `UNKNOWN_EVIDENCE_REFERENCE`) so the operator sees them.
  return parsed.data as unknown as EditorialResponse;
}

/** Parses the writer's message text as JSON, then validates it. */
export function parseEditorialResponseText(
  text: string,
  request: EditorialRequest,
  httpStatus?: number,
): EditorialResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AiProviderError('ai_response_invalid', { httpStatus: httpStatus ?? null });
  }
  return parseEditorialResponse(value, request, httpStatus);
}
