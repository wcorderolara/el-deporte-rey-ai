/**
 * The editorial writer port (PD-ARCH-01H): writes the five editorial deliverables of a project from the confirmed
 * sports context. Separate from the draft port (`providers.ai`, slide commentary) so that the content stage and the
 * wizard runs never call a billed writer: only the editorial module does, after the operator's confirmation.
 *
 * Configuration `providers.editorial` (default `stub`):
 * - `stub`: deterministic test text, no network, labelled "sin IA" (writer kind `test`);
 * - `openai-compatible`: one chat-completions request through the egress client with the versioned editorial prompt
 *   and a strict JSON-schema response format, no tools. An `https:` base URL is a hosted provider (`hosted_ai`,
 *   billed: PD-30 limits, prices and cost confirmation are mandatory); an `http:` loopback URL is a local model
 *   server (`local_ai`, not billed). The key comes only from `EDR_AI_API_KEY`, read at call time (AD-30).
 */
import { z } from 'zod';

import { ConfigError, type ConfigIssue, httpsOrigin } from '../../platform/config/index.js';
import { DEFAULT_AI_MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES_LIMIT, MAX_TIMEOUT_MS } from '../../platform/net/index.js';

import type { EditorialRequest, EditorialResult } from './editorial-schemas.js';
import { isAcceptedAiBaseUrl } from './options.js';

export const EDITORIAL_ADAPTER_KINDS = ['stub', 'openai-compatible'] as const;
export type EditorialAdapterKind = (typeof EDITORIAL_ADAPTER_KINDS)[number];

export type EditorialWriterKind = 'test' | 'hosted_ai' | 'local_ai';

export interface EditorialPricing {
  readonly currency: 'USD';
  readonly inputPerMillionTokens: number;
  readonly outputPerMillionTokens: number;
  /** Where the prices were copied from, and when (the provider's invoice stays authoritative). */
  readonly source: string;
  readonly checkedOn: string;
}

export interface EditorialWriterLimits {
  readonly maxGenerationsPerDay: number;
  /** Highest computed spend in a calendar month (UTC); null only for a writer that is not billed. */
  readonly monthlySpendLimit: number | null;
  /** One generation at a time (PD-30). */
  readonly maxConcurrentGenerations: 1;
}

export interface EditorialWriterDescription {
  readonly adapter: EditorialAdapterKind;
  readonly kind: EditorialWriterKind;
  readonly model: string | null;
  /** False when a hosted writer has no `EDR_AI_API_KEY`. */
  readonly ready: boolean;
  /** True for a hosted writer: every generation needs `confirmCost`. */
  readonly billed: boolean;
  readonly pricing: EditorialPricing | null;
  readonly limits: EditorialWriterLimits;
  /** Upper bound of the output tokens of one request (`max_completion_tokens`); null for the stub. */
  readonly maxOutputTokens: number | null;
  /** Reasoning effort sent to a reasoning model (`reasoning_effort`); null when not configured or for the stub. */
  readonly reasoningEffort: EditorialReasoningEffort | null;
}

export interface EditorialWriteContext {
  readonly signal: AbortSignal;
}

export interface AiEditorialWriter {
  readonly id: EditorialAdapterKind;
  describe(): EditorialWriterDescription;
  /** Validates the request, writes, and returns the validated response. Throws `AiProviderError` only. */
  write(request: EditorialRequest, ctx: EditorialWriteContext): Promise<EditorialResult>;
}

// ---------------------------------------------------------------------------------------------------------------
// Options (validated at startup; a ConfigError names the setting and never echoes a value, OD-20)
// ---------------------------------------------------------------------------------------------------------------

const OPTIONS_SETTING = 'providers.editorial.options';
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}]*$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reasoning effort values of the Chat Completions reference; a model accepts only some of them (`gpt-6.1-sol`: low,
 * medium, high, xhigh, max). Reasoning tokens are billed as output and count toward `max_completion_tokens`.
 */
export const EDITORIAL_REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EditorialReasoningEffort = (typeof EDITORIAL_REASONING_EFFORTS)[number];

export const EDITORIAL_STUB_SCENARIOS = ['default', 'invalid-json', 'unavailable', 'timeout', 'flagged'] as const;
export type EditorialStubScenario = (typeof EDITORIAL_STUB_SCENARIOS)[number];

export interface EditorialStubOptions {
  readonly scenario: EditorialStubScenario;
  readonly limits: EditorialWriterLimits;
}

export interface EditorialOpenAiOptions {
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature?: number;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxOutputTokens: number;
  readonly reasoningEffort?: EditorialReasoningEffort;
  readonly pricing: EditorialPricing | null;
  readonly limits: EditorialWriterLimits;
}

const price = z.number().min(0).max(1000);

const pricingSchema = z.strictObject({
  currency: z.literal('USD'),
  inputPerMillionTokens: price,
  outputPerMillionTokens: price,
  source: z.string().min(1).max(300).regex(NO_CONTROL_OR_FORMAT),
  checkedOn: z.string().regex(ISO_DATE),
});

const limitsSchema = z.strictObject({
  maxGenerationsPerDay: z.number().int().min(1).max(500).default(30),
  monthlySpendLimit: z.number().min(0).max(1000).nullable().default(null),
});

const stubSchema = z.strictObject({
  scenario: z.enum(EDITORIAL_STUB_SCENARIOS).default('default'),
  limits: limitsSchema.prefault({ maxGenerationsPerDay: 500 }),
});

const openAiSchema = z.strictObject({
  baseUrl: z.custom<string>(isAcceptedAiBaseUrl),
  model: z.string().regex(MODEL_ID),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().min(1).max(MAX_TIMEOUT_MS),
  maxResponseBytes: z.number().int().min(1).max(MAX_RESPONSE_BYTES_LIMIT).default(DEFAULT_AI_MAX_RESPONSE_BYTES),
  maxOutputTokens: z.number().int().min(256).max(32000),
  reasoningEffort: z.enum(EDITORIAL_REASONING_EFFORTS).optional(),
  pricing: pricingSchema.nullable().default(null),
  limits: limitsSchema.prefault({}),
});

const PROBLEMS: Readonly<Record<string, string>> = {
  scenario: `must be one of: ${EDITORIAL_STUB_SCENARIOS.join(', ')}`,
  baseUrl: 'must be an https: URL, or an http: URL on a loopback host, without user information, query or fragment',
  model: 'must be a model identifier of 1 to 100 letters, digits, dots, colons, underscores or hyphens',
  temperature: 'must be a number from 0 to 2',
  timeoutMs: `must be an integer from 1 to ${String(MAX_TIMEOUT_MS)}`,
  maxResponseBytes: `must be an integer from 1 to ${String(MAX_RESPONSE_BYTES_LIMIT)}`,
  maxOutputTokens: 'must be an integer from 256 to 32000',
  reasoningEffort: `must be one of: ${EDITORIAL_REASONING_EFFORTS.join(', ')}`,
  pricing: 'must give the USD prices per million input and output tokens with their source and check date',
  limits: 'must give maxGenerationsPerDay from 1 to 500 and monthlySpendLimit from 0 to 1000 or null',
};

function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys' && issue.path.length === 0) {
      return { setting: OPTIONS_SETTING, problem: 'contains unknown keys' };
    }
    const field = issue.path[0];
    const known = typeof field === 'string' && Object.hasOwn(PROBLEMS, field);
    return known
      ? {
          setting: `${OPTIONS_SETTING}.${field}`,
          problem:
            issue.input === undefined && issue.path.length === 1 ? 'is required' : (PROBLEMS[field] ?? 'is invalid'),
        }
      : { setting: OPTIONS_SETTING, problem: 'is invalid' };
  });
}

function parse<T>(schema: z.ZodType<T>, options: unknown): T {
  const result = schema.safeParse(options, { reportInput: true });
  if (!result.success) {
    throw new ConfigError(toIssues(result.error));
  }
  return result.data;
}

function frozenLimits(limits: {
  maxGenerationsPerDay: number;
  monthlySpendLimit: number | null;
}): EditorialWriterLimits {
  return Object.freeze({
    maxGenerationsPerDay: limits.maxGenerationsPerDay,
    monthlySpendLimit: limits.monthlySpendLimit,
    maxConcurrentGenerations: 1 as const,
  });
}

/** Validates the stub writer options. */
export function parseEditorialStubOptions(options: unknown): EditorialStubOptions {
  const parsed = parse(stubSchema, options);
  return Object.freeze({ scenario: parsed.scenario, limits: frozenLimits(parsed.limits) });
}

/** True when the base URL is a hosted (`https:`) provider rather than a local model server. */
export function isHostedBaseUrl(baseUrl: string): boolean {
  return httpsOrigin(baseUrl) !== null;
}

/**
 * Validates the OpenAI-compatible writer options. A hosted (`https:`) writer is billed: it must have prices and a
 * monthly spend limit, otherwise the spend could not be controlled (PD-30, as PD-27 point 4 for images).
 */
export function parseEditorialOpenAiOptions(options: unknown): EditorialOpenAiOptions {
  const parsed = parse(openAiSchema, options);
  if (isHostedBaseUrl(parsed.baseUrl)) {
    const issues: ConfigIssue[] = [];
    if (parsed.pricing === null) {
      issues.push({ setting: `${OPTIONS_SETTING}.pricing`, problem: 'is required for a hosted provider (PD-30)' });
    }
    if (parsed.limits.monthlySpendLimit === null) {
      issues.push({
        setting: `${OPTIONS_SETTING}.limits.monthlySpendLimit`,
        problem: 'is required for a hosted provider (PD-30)',
      });
    }
    if (issues.length > 0) {
      throw new ConfigError(issues);
    }
  }
  const result: EditorialOpenAiOptions = {
    baseUrl: parsed.baseUrl,
    model: parsed.model,
    timeoutMs: parsed.timeoutMs,
    maxResponseBytes: parsed.maxResponseBytes,
    maxOutputTokens: parsed.maxOutputTokens,
    pricing: parsed.pricing === null ? null : Object.freeze({ ...parsed.pricing }),
    limits: frozenLimits(parsed.limits),
    ...(parsed.temperature === undefined ? {} : { temperature: parsed.temperature }),
    ...(parsed.reasoningEffort === undefined ? {} : { reasoningEffort: parsed.reasoningEffort }),
  };
  return Object.freeze(result);
}
