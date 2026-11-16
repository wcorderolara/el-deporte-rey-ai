/**
 * OpenAI Image API adapter (PD-ARCH-01G-B; official guide "Image generation", checked 2026-11-05).
 *
 * - A request without input images is one `POST <baseUrl>/images/generations`; a request with input images (style
 *   references, a transformable brand asset or a previous proposal) is one `POST <baseUrl>/images/edits` with the
 *   images as base64 `data:` URLs in the JSON `images` array, in prompt order. Both ask for one image (`n: 1`) in the
 *   configured output format, at the requested size and quality, with the provider's default moderation.
 * - Every request goes through the image egress client: its allow-list holds only the configured base URL's origin,
 *   redirects fail, and the deadline (`timeoutMs`) and the response cap are those of `IMAGE_EGRESS_LIMITS`.
 * - The key is read from `EDR_IMAGE_API_KEY` in the injected environment at call time and sent only in the
 *   `Authorization` header. Without a key nothing is sent.
 * - At most `limits.maxConcurrentRequests` requests are in flight; another one fails with `busy` before it is sent.
 * - Nothing is retried: a repeated request could be charged twice. A failure keeps the HTTP status and, for 429, the
 *   `Retry-After` seconds; of the provider's error body only `error.code` and `error.type` are compared with closed
 *   lists, and the body itself is never kept, returned or logged. This adapter logs nothing.
 * - The response is parsed as JSON; the image is the strictly decoded `data[0].b64_json`, and `usage` keeps only its
 *   token counts. The caller checks the image's type and dimensions before storing it.
 */
import { z } from 'zod';

import { EgressError, type EgressClient, IMAGE_EGRESS_LIMITS } from '../../platform/net/index.js';

import { ImageProviderError } from './errors.js';
import { type OpenAiImageOptions, parseOpenAiImageOptions } from './options.js';
import {
  IMAGE_API_KEY_VARIABLE,
  type GeneratedImage,
  type ImageEnvironment,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageProviderCapabilities,
  type ImageUsage,
  type ModelAccess,
} from './port.js';

export const GENERATIONS_PATH = '/images/generations';
export const EDITS_PATH = '/images/edits';
export const MODELS_PATH = '/models';

/** Deadline of the free model metadata request. */
export const MODEL_CHECK_TIMEOUT_MS = 15_000;
const MODEL_CHECK_MAX_RESPONSE_BYTES = 64 * 1024;

/** A key that can be sent in an HTTP header: printable ASCII without spaces. */
const SENDABLE_KEY = /^[\x21-\x7e]{1,4096}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** `error.code` or `error.type` values that mean the provider refused the content (no retry helps). */
const REJECTED_CODES = new Set([
  'moderation_blocked',
  'content_policy_violation',
  'image_generation_user_error',
  'safety_violation',
]);
/** Values that mean the configured model does not exist for the account. */
const MODEL_CODES = new Set(['model_not_found', 'invalid_model', 'model_not_available']);
/** Values of a 429 that mean billing, quota or spend limits, not request rate. */
const QUOTA_CODES = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'billing_hard_limit_reached',
]);

const tokenCount = z.int().min(0).nullable().optional();

const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(4) })).min(1),
  usage: z
    .object({
      input_tokens: tokenCount,
      output_tokens: tokenCount,
      total_tokens: tokenCount,
      input_tokens_details: z.object({ text_tokens: tokenCount, image_tokens: tokenCount }).nullable().optional(),
      output_tokens_details: z.object({ text_tokens: tokenCount, image_tokens: tokenCount }).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const errorSchema = z.object({
  error: z.object({ code: z.unknown().optional(), type: z.unknown().optional() }),
});

/** An endpoint URL: the base URL's origin and path with the endpoint path appended. */
export function endpointUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${path}`;
}

/** The JSON body of a generation or edit request (one image, no streaming). */
export function buildImageRequestBody(request: ImageGenerationRequest, options: OpenAiImageOptions): string {
  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    n: 1,
    size: request.size,
    quality: request.quality,
    output_format: options.outputFormat,
  };
  if (request.images.length > 0) {
    body['images'] = request.images.map((image) => ({
      image_url: `data:${image.mime};base64,${image.content.toString('base64')}`,
    }));
  }
  return JSON.stringify(body);
}

/** The closed `error.code` and `error.type` strings of an error body; never the message. */
function errorMarkers(text: string): string[] {
  try {
    const parsed = errorSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return [];
    }
    return [parsed.data.error.code, parsed.data.error.type].filter(
      (value): value is string => typeof value === 'string' && value.length <= 80,
    );
  } catch {
    return [];
  }
}

function retryAfter(headers: Headers): number | null {
  const value = headers.get('retry-after');
  return value !== null && /^\d{1,6}$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** Maps a non-2xx response to a closed failure. */
export function statusFailure(status: number, headers: Headers, text: string): ImageProviderError {
  const markers = errorMarkers(text);
  const has = (set: ReadonlySet<string>) => markers.some((marker) => set.has(marker));
  if (status === 401 || status === 403) {
    return new ImageProviderError('not_authorized', { httpStatus: status });
  }
  if (status === 404 || has(MODEL_CODES)) {
    return new ImageProviderError('model_unavailable', { httpStatus: status });
  }
  if (status === 429) {
    return has(QUOTA_CODES)
      ? new ImageProviderError('quota_exceeded', { httpStatus: status })
      : new ImageProviderError('rate_limited', { httpStatus: status, retryAfterSeconds: retryAfter(headers) });
  }
  if (has(REJECTED_CODES)) {
    return new ImageProviderError('rejected', { httpStatus: status });
  }
  if (status >= 400 && status < 500) {
    return new ImageProviderError('invalid_request', { httpStatus: status });
  }
  return new ImageProviderError('unavailable', { httpStatus: status });
}

function egressFailure(error: unknown): ImageProviderError {
  if (error instanceof ImageProviderError) {
    return error;
  }
  if (error instanceof EgressError) {
    switch (error.kind) {
      case 'timeout':
        return new ImageProviderError('timeout');
      case 'aborted':
        return new ImageProviderError('aborted');
      case 'too_large':
        return new ImageProviderError('response_invalid');
      default:
        return new ImageProviderError('unavailable');
    }
  }
  return new ImageProviderError('unavailable');
}

function count(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

/** Parses a 2xx response: the decoded image and the token counts. */
export function parseImageResponse(text: string, status: number): GeneratedImage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ImageProviderError('response_invalid', { httpStatus: status });
  }
  const parsed = responseSchema.safeParse(value);
  const encoded = parsed.success ? parsed.data.data[0]?.b64_json : undefined;
  if (encoded === undefined || !BASE64.test(encoded) || encoded.length % 4 !== 0) {
    throw new ImageProviderError('response_invalid', { httpStatus: status });
  }
  const content = Buffer.from(encoded, 'base64');
  if (content.length === 0) {
    throw new ImageProviderError('response_invalid', { httpStatus: status });
  }
  const usage = parsed.success ? parsed.data.usage : null;
  const tokens: ImageUsage | null =
    usage === null || usage === undefined
      ? null
      : {
          inputTextTokens: count(usage.input_tokens_details?.text_tokens),
          inputImageTokens: count(usage.input_tokens_details?.image_tokens),
          outputImageTokens: count(usage.output_tokens_details?.image_tokens ?? usage.output_tokens),
          outputTextTokens: count(usage.output_tokens_details?.text_tokens),
          totalTokens: count(usage.total_tokens),
        };
  return { content, usage: tokens };
}

export interface OpenAiImageDeps {
  readonly egress: EgressClient;
  readonly env: ImageEnvironment;
}

class OpenAiImageAdapter implements ImageGenerationProvider {
  readonly id = 'openai' as const;
  readonly #options: OpenAiImageOptions;
  readonly #egress: EgressClient;
  readonly #env: ImageEnvironment;
  #inFlight = 0;

  constructor(options: OpenAiImageOptions, deps: OpenAiImageDeps) {
    this.#options = options;
    this.#egress = deps.egress;
    this.#env = deps.env;
  }

  #key(): string | null {
    const key = Object.hasOwn(this.#env, IMAGE_API_KEY_VARIABLE) ? this.#env[IMAGE_API_KEY_VARIABLE] : undefined;
    return key === undefined || key === '' ? null : key;
  }

  #authorization(): Record<string, string> {
    const key = this.#key();
    if (key === null) {
      throw new ImageProviderError('missing_api_key');
    }
    if (!SENDABLE_KEY.test(key)) {
      throw new ImageProviderError('not_authorized');
    }
    return { Authorization: `Bearer ${key}` };
  }

  #model(id: string): void {
    if (!this.#options.models.some((model) => model.id === id)) {
      throw new ImageProviderError('model_unavailable');
    }
  }

  capabilities(): ImageProviderCapabilities {
    return {
      adapter: 'openai',
      status: this.#key() === null ? 'missing_api_key' : 'ready',
      defaultModel: this.#options.defaultModel,
      models: this.#options.models,
      outputFormat: this.#options.outputFormat,
      limits: this.#options.limits,
    };
  }

  async checkModelAccess(model: string, signal: AbortSignal): Promise<ModelAccess> {
    this.#model(model);
    const headers = { Accept: 'application/json', ...this.#authorization() };
    let response;
    try {
      response = await this.#egress.request(
        endpointUrl(this.#options.baseUrl, `${MODELS_PATH}/${encodeURIComponent(model)}`),
        {
          method: 'GET',
          headers,
          timeoutMs: MODEL_CHECK_TIMEOUT_MS,
          maxResponseBytes: MODEL_CHECK_MAX_RESPONSE_BYTES,
          signal,
        },
      );
    } catch (error) {
      throw egressFailure(error);
    }
    if (response.status >= 200 && response.status <= 299) {
      return 'available';
    }
    if (response.status === 401 || response.status === 403) {
      return 'not_authorized';
    }
    if (response.status === 404) {
      return 'unavailable';
    }
    throw statusFailure(response.status, response.headers, response.text);
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    this.#model(request.model);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...this.#authorization() };
    if (this.#inFlight >= this.#options.limits.maxConcurrentRequests) {
      throw new ImageProviderError('busy');
    }
    this.#inFlight += 1;
    let response;
    try {
      response = await this.#egress.request(
        endpointUrl(this.#options.baseUrl, request.images.length > 0 ? EDITS_PATH : GENERATIONS_PATH),
        {
          method: 'POST',
          headers,
          body: buildImageRequestBody(request, this.#options),
          timeoutMs: this.#options.timeoutMs,
          maxResponseBytes: IMAGE_EGRESS_LIMITS.maxResponseBytes,
          signal: request.signal,
        },
      );
    } catch (error) {
      throw egressFailure(error);
    } finally {
      this.#inFlight -= 1;
    }
    if (response.status < 200 || response.status > 299) {
      throw statusFailure(response.status, response.headers, response.text);
    }
    return parseImageResponse(response.text, response.status);
  }
}

/** Creates the OpenAI image adapter; invalid options stop startup with a `ConfigError`. */
export function createOpenAiImageProvider(options: unknown, deps: OpenAiImageDeps): ImageGenerationProvider {
  return new OpenAiImageAdapter(parseOpenAiImageOptions(options), deps);
}
