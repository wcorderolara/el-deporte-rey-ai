/**
 * OpenAI-compatible editorial writer (PD-ARCH-01H; same controls as the draft adapter, T10-F06, T10-F07, T10-F10).
 *
 * - One `POST <baseUrl>/chat/completions` through the egress client: the allow-list holds the configured base URL's
 *   exact origin, redirects fail, one total deadline (`timeoutMs`) and a decoded-byte cap apply. No retry: a failed
 *   request is reported and the operator decides whether to try again.
 * - Body: the configured model, the versioned editorial system message, the data-block user message, a strict
 *   JSON-schema response format, `max_completion_tokens` (the output bound the cost reserve uses), `stream: false`,
 *   `n: 1`, and the reasoning effort (`reasoning_effort`) and the temperature only when configured. No tools, functions or tool choice; a response that calls a
 *   tool, is refused, is cut by the length limit or is filtered is invalid.
 * - The key is read from `EDR_AI_API_KEY` at call time and sent only in the `Authorization` header. A hosted writer
 *   without a key is not ready; a local model server needs none.
 * - Usage: the reported `prompt_tokens` and `completion_tokens`, used to compute the cost with the configured prices.
 * - Failures map to the closed codes with the HTTP status only; the provider's body, the key, the request body and
 *   exception messages are never kept, returned or logged.
 */
import { z } from 'zod';

import type { EgressClient } from '../../platform/net/index.js';

import { AiProviderError } from './errors.js';
import { EDITORIAL_SYSTEM_MESSAGE, buildEditorialPrompt, editorialOutputJsonSchema } from './editorial-prompt.js';
import {
  type AiEditorialWriter,
  type EditorialOpenAiOptions,
  type EditorialWriteContext,
  type EditorialWriterDescription,
  isHostedBaseUrl,
  parseEditorialOpenAiOptions,
} from './editorial-port.js';
import {
  type EditorialRequest,
  type EditorialResult,
  type EditorialUsage,
  parseEditorialRequest,
  parseEditorialResponseText,
} from './editorial-schemas.js';
import { SENDABLE_KEY, chatCompletionsUrl, egressFailure, messageContent } from './openai-compatible-adapter.js';
import { AI_API_KEY_VARIABLE, type AiEnvironment } from './port.js';

/** Name of the JSON-schema response format. */
export const EDITORIAL_RESPONSE_FORMAT_NAME = 'editorial_copy';

const usageSchema = z.object({
  usage: z
    .object({
      prompt_tokens: z.number().int().min(0).max(100_000_000).optional(),
      completion_tokens: z.number().int().min(0).max(100_000_000).optional(),
    })
    .optional(),
});

/** The request body sent to the provider (no tools, no functions). */
export function buildEditorialChatBody(request: EditorialRequest, options: EditorialOpenAiOptions): string {
  const prompt = buildEditorialPrompt(request);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: EDITORIAL_RESPONSE_FORMAT_NAME, strict: true, schema: editorialOutputJsonSchema(request) },
    },
    max_completion_tokens: options.maxOutputTokens,
    stream: false,
    n: 1,
  };
  if (options.temperature !== undefined) {
    body['temperature'] = options.temperature;
  }
  if (options.reasoningEffort !== undefined) {
    body['reasoning_effort'] = options.reasoningEffort;
  }
  return JSON.stringify(body);
}

/** The usage of a 2xx response, or null when the provider reported none. */
function usageOf(text: string): EditorialUsage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = usageSchema.safeParse(value);
  const usage = parsed.success ? parsed.data.usage : undefined;
  if (usage === undefined) {
    return null;
  }
  return { inputTokens: usage.prompt_tokens ?? null, outputTokens: usage.completion_tokens ?? null };
}

/** A failure after the provider answered: the closed code with the usage it reported (null when none). */
export class EditorialWriteError extends AiProviderError {
  readonly usage: EditorialUsage | null;

  constructor(cause: AiProviderError, usage: EditorialUsage | null) {
    super(cause.code, { httpStatus: cause.httpStatus, path: cause.path });
    this.usage = usage;
  }
}

export interface EditorialOpenAiDeps {
  readonly egress: EgressClient;
  readonly env: AiEnvironment;
}

class OpenAiEditorialWriter implements AiEditorialWriter {
  readonly id = 'openai-compatible' as const;
  readonly #options: EditorialOpenAiOptions;
  readonly #url: string;
  readonly #hosted: boolean;
  readonly #egress: EgressClient;
  readonly #env: AiEnvironment;

  constructor(options: EditorialOpenAiOptions, deps: EditorialOpenAiDeps) {
    this.#options = options;
    this.#url = chatCompletionsUrl(options.baseUrl);
    this.#hosted = isHostedBaseUrl(options.baseUrl);
    this.#egress = deps.egress;
    this.#env = deps.env;
  }

  #key(): string | null {
    const key = Object.hasOwn(this.#env, AI_API_KEY_VARIABLE) ? this.#env[AI_API_KEY_VARIABLE] : undefined;
    return key === undefined || key === '' ? null : key;
  }

  describe(): EditorialWriterDescription {
    return {
      adapter: 'openai-compatible',
      kind: this.#hosted ? 'hosted_ai' : 'local_ai',
      model: this.#options.model,
      ready: !this.#hosted || this.#key() !== null,
      billed: this.#hosted,
      pricing: this.#options.pricing,
      limits: this.#options.limits,
      maxOutputTokens: this.#options.maxOutputTokens,
      reasoningEffort: this.#options.reasoningEffort ?? null,
    };
  }

  #authorization(): Record<string, string> {
    const key = this.#key();
    if (key === null) {
      if (this.#hosted) {
        throw new AiProviderError('unavailable');
      }
      return {};
    }
    if (!SENDABLE_KEY.test(key)) {
      throw new AiProviderError('unavailable');
    }
    return { Authorization: `Bearer ${key}` };
  }

  async write(req: EditorialRequest, ctx: EditorialWriteContext): Promise<EditorialResult> {
    const request = parseEditorialRequest(req);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...this.#authorization() };
    let response: { status: number; text: string };
    try {
      response = await this.#egress.request(this.#url, {
        method: 'POST',
        headers,
        body: buildEditorialChatBody(request, this.#options),
        timeoutMs: this.#options.timeoutMs,
        maxResponseBytes: this.#options.maxResponseBytes,
        signal: ctx.signal,
      });
    } catch (error) {
      throw egressFailure(error);
    }
    const { status } = response;
    if (status === 429) {
      throw new AiProviderError('rate_limited', { httpStatus: status });
    }
    if (status < 200 || status > 299) {
      throw new AiProviderError('unavailable', { httpStatus: status });
    }
    const usage = usageOf(response.text);
    try {
      return { response: parseEditorialResponseText(messageContent(response.text, status), request, status), usage };
    } catch (error) {
      // The provider answered (and billed) the request: the usage is kept so that the spend is still recorded.
      throw error instanceof AiProviderError ? new EditorialWriteError(error, usage) : error;
    }
  }
}

/** Creates the OpenAI-compatible editorial writer; invalid options stop startup with a `ConfigError`. */
export function createOpenAiEditorialWriter(options: unknown, deps: EditorialOpenAiDeps): AiEditorialWriter {
  return new OpenAiEditorialWriter(parseEditorialOpenAiOptions(options), deps);
}

/** Size of the fixed system message in bytes (the cost reserve's input bound includes it). */
export const EDITORIAL_SYSTEM_MESSAGE_BYTES = Buffer.byteLength(EDITORIAL_SYSTEM_MESSAGE, 'utf8');
