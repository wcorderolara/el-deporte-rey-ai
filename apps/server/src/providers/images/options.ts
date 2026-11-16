/**
 * Options of the `openai` image adapter (`providers.images.options`), validated at startup (PD-ARCH-01G-B). An invalid
 * option stops startup with a `ConfigError` that names the setting with fixed text and never echoes a configured
 * value (OD-20). The API key is never an option: it comes only from `EDR_IMAGE_API_KEY`.
 *
 * Models, their size rules, qualities and prices are configuration: no model is assumed to exist for every account
 * and no price is fixed in code. `pricing` and `publishedImageCosts` are copied from the provider's published price
 * list with the date they were checked; without them no cost is estimated or computed.
 */
import { z } from 'zod';

import { ConfigError, type ConfigIssue, httpsOrigin } from '../../platform/config/index.js';
import { IMAGE_EGRESS_LIMITS } from '../../platform/net/index.js';

import type { ImageModel, ImageOutputFormat, ImageUsageLimits } from './port.js';

const OPTIONS_SETTING = 'providers.images.options';

/** Upper bounds of the usage limits. */
export const LIMIT_BOUNDS = Object.freeze({
  maxImagesPerRequest: 8,
  maxReferences: 8,
  maxImagesPerDay: 500,
  maxConcurrentRequests: 4,
});

export interface OpenAiImageOptions {
  /** `https:` base URL of the Image API (for example `https://api.openai.com/v1`); no query or fragment. */
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly models: readonly ImageModel[];
  readonly outputFormat: ImageOutputFormat;
  readonly timeoutMs: number;
  readonly limits: ImageUsageLimits;
}

const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}]*$/u;
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const QUALITY = /^[a-z]{2,16}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isAcceptedBaseUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('?') || value.includes('#')) {
    return false;
  }
  return httpsOrigin(value) !== null;
}

const price = z.number().min(0).max(1000);

const pricingSchema = z.strictObject({
  currency: z.literal('USD'),
  textInputPerMillionTokens: price,
  imageInputPerMillionTokens: price,
  imageOutputPerMillionTokens: price,
  textOutputPerMillionTokens: price.nullable().default(null),
  source: z.string().min(1).max(300).regex(NO_CONTROL_OR_FORMAT),
  checkedOn: z.string().regex(ISO_DATE),
});

const orientationCosts = z.strictObject({
  square: price.optional(),
  portrait: price.optional(),
  landscape: price.optional(),
});

const modelSchema = z.strictObject({
  id: z.string().regex(MODEL_ID),
  label: z.string().min(1).max(80).regex(NO_CONTROL_OR_FORMAT),
  flexibleSizes: z.boolean(),
  qualities: z.array(z.string().regex(QUALITY)).min(1).max(8),
  pricing: pricingSchema.nullable().default(null),
  publishedImageCosts: z.record(z.string().regex(QUALITY), orientationCosts).nullable().default(null),
});

const limitsSchema = z.strictObject({
  maxImagesPerRequest: z.int().min(1).max(LIMIT_BOUNDS.maxImagesPerRequest).default(4),
  maxReferences: z.int().min(0).max(LIMIT_BOUNDS.maxReferences).default(4),
  maxImagesPerDay: z.int().min(1).max(LIMIT_BOUNDS.maxImagesPerDay).default(20),
  monthlySpendLimit: z.number().min(0).max(100_000).nullable().default(null),
  spendReservePerImage: z.record(z.string().regex(QUALITY), z.number().positive().max(1000)).nullable().default(null),
  maxConcurrentRequests: z.int().min(1).max(LIMIT_BOUNDS.maxConcurrentRequests).default(1),
});

const optionsSchema = z
  .strictObject({
    baseUrl: z.custom<string>(isAcceptedBaseUrl),
    defaultModel: z.string().regex(MODEL_ID),
    models: z.array(modelSchema).min(1).max(12),
    outputFormat: z.enum(['png', 'jpeg']).default('png'),
    timeoutMs: z.int().min(1000).max(IMAGE_EGRESS_LIMITS.maxTimeoutMs).default(240_000),
    limits: limitsSchema.prefault({}),
  })
  .superRefine((value, ctx) => {
    const ids = value.models.map((model) => model.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['models'], message: 'duplicate' });
    }
    if (!ids.includes(value.defaultModel)) {
      ctx.addIssue({ code: 'custom', path: ['defaultModel'], message: 'unknown' });
    }
  });

const PROBLEMS: Readonly<Record<string, string>> = {
  baseUrl: 'must be an https: URL without user information, query or fragment',
  defaultModel: 'must be the identifier of one of the configured models',
  models:
    'must list 1 to 12 models with distinct identifiers, a label, flexibleSizes, qualities and optional published prices',
  outputFormat: 'must be png or jpeg',
  timeoutMs: `must be an integer from 1000 to ${String(IMAGE_EGRESS_LIMITS.maxTimeoutMs)}`,
  limits:
    'must hold the image, reference, daily, monthly spend, spend reserve and concurrency limits within their bounds',
};

function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys' && issue.path.length === 0) {
      return { setting: OPTIONS_SETTING, problem: 'contains unknown keys' };
    }
    const field = issue.path[0];
    const known = typeof field === 'string' && Object.hasOwn(PROBLEMS, field);
    return known
      ? { setting: `${OPTIONS_SETTING}.${field}`, problem: PROBLEMS[field] ?? 'is invalid' }
      : { setting: OPTIONS_SETTING, problem: 'is invalid' };
  });
}

/** Validates the `openai` image adapter options; the limits default to 4 images, 4 references and 20 a day. */
export function parseOpenAiImageOptions(options: unknown): OpenAiImageOptions {
  const result = optionsSchema.safeParse(options);
  if (!result.success) {
    throw new ConfigError(toIssues(result.error));
  }
  const parsed = result.data;
  return Object.freeze({
    baseUrl: parsed.baseUrl,
    defaultModel: parsed.defaultModel,
    models: Object.freeze(parsed.models.map((model) => Object.freeze({ ...model }))),
    outputFormat: parsed.outputFormat,
    timeoutMs: parsed.timeoutMs,
    limits: Object.freeze({
      ...parsed.limits,
      spendReservePerImage:
        parsed.limits.spendReservePerImage === null ? null : Object.freeze({ ...parsed.limits.spendReservePerImage }),
    }),
  });
}
