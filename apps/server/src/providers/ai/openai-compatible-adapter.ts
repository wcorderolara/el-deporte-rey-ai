/**
 * OpenAI-compatible chat-completions adapter (contracts/provider-ports.md section 2; architecture.md section 5.3;
 * AD-08; T10-F06, T10-F07, T10-F10). Works with a local model server exposing the same protocol, or with a hosted
 * provider only after Product Owner authorization (R-111, SC-05).
 *
 * - One `POST <baseUrl>/chat/completions` through the egress client: the allow-list holds the configured base URL's
 *   exact origin, redirects fail, one total deadline (`timeoutMs`) and a decoded-byte cap (`maxResponseBytes`,
 *   default 256 KiB) apply.
 * - Body: the model identifier from configuration, the fixed system instruction, the data-block user message, the
 *   optional temperature, and a JSON-schema response format. No tools, functions or tool choice are sent, and a
 *   response that calls a tool is invalid.
 * - The key is read from `EDR_AI_API_KEY` in the injected environment at call time and sent only in the
 *   `Authorization` header. Without a key no `Authorization` header is sent (local model servers).
 * - Failures map to the closed codes with the HTTP status only: 429 is `rate_limited`, any other non-2xx status and
 *   every connection failure is `unavailable`, an exceeded deadline is `timeout`, and an oversize, non-JSON or
 *   schema-invalid response is `ai_response_invalid`. The provider's response body, the key, the request body and
 *   exception messages are never kept, returned or logged; this adapter logs nothing.
 * - The response text is parsed as JSON only; it is never executed, evaluated or rendered as HTML.
 */
import { z } from 'zod';

import { EgressError, type EgressClient } from '../../platform/net/index.js';

import { AiProviderError } from './errors.js';
import { type OpenAiCompatibleOptions, parseOpenAiCompatibleOptions } from './options.js';
import { AI_API_KEY_VARIABLE, type AiDraftContext, type AiEnvironment, type AiTextProvider } from './port.js';
import { buildDraftPrompt, draftOutputJsonSchema } from './prompt.js';
import { type DraftRequest, type DraftResponse, parseDraftRequest, parseDraftResponseText } from './schemas.js';

/** Path appended to the base URL. */
export const CHAT_COMPLETIONS_PATH = '/chat/completions';

/** Name of the JSON-schema response format. */
export const RESPONSE_FORMAT_NAME = 'carousel_draft';

/** A key that can be sent in an HTTP header: printable ASCII without spaces. */
const SENDABLE_KEY = /^[\x21-\x7e]{1,4096}$/;

/** Finish reasons that mean the answer is incomplete or not a plain message. */
const REFUSED_FINISH_REASONS = new Set(['length', 'tool_calls', 'function_call', 'content_filter']);

/** The chat-completions envelope; only the first choice's message content is used. */
const envelopeSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
          tool_calls: z.unknown().optional(),
          function_call: z.unknown().optional(),
          refusal: z.unknown().optional(),
        }),
        finish_reason: z.unknown().optional(),
      }),
    )
    .min(1),
});

/** The endpoint URL: the base URL's origin and path with `/chat/completions` appended. */
export function chatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${CHAT_COMPLETIONS_PATH}`;
}

/** The request body sent to the provider (no tools, no functions). */
export function buildChatCompletionsBody(request: DraftRequest, options: OpenAiCompatibleOptions): string {
  const prompt = buildDraftPrompt(request);
  const body: Record<string, unknown> = {
    model: options.model,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: RESPONSE_FORMAT_NAME, strict: true, schema: draftOutputJsonSchema(request) },
    },
    stream: false,
    n: 1,
  };
  if (options.temperature !== undefined) {
    body['temperature'] = options.temperature;
  }
  return JSON.stringify(body);
}

function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === '') {
    return false;
  }
  return !(Array.isArray(value) && value.length === 0);
}

/** Extracts the message content of a 2xx response; anything unexpected is `ai_response_invalid`. */
function messageContent(text: string, status: number): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AiProviderError('ai_response_invalid', { httpStatus: status });
  }
  const envelope = envelopeSchema.safeParse(value);
  const choice = envelope.success ? envelope.data.choices[0] : undefined;
  if (
    choice === undefined ||
    isNonEmpty(choice.message.tool_calls) ||
    isNonEmpty(choice.message.function_call) ||
    isNonEmpty(choice.message.refusal) ||
    (typeof choice.finish_reason === 'string' && REFUSED_FINISH_REASONS.has(choice.finish_reason))
  ) {
    throw new AiProviderError('ai_response_invalid', { httpStatus: status });
  }
  return choice.message.content;
}

/** Maps an egress failure to a closed code; the original error is dropped. */
function egressFailure(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) {
    return error;
  }
  if (error instanceof EgressError) {
    switch (error.kind) {
      case 'timeout':
        return new AiProviderError('timeout');
      case 'too_large':
        return new AiProviderError('ai_response_invalid');
      default:
        return new AiProviderError('unavailable');
    }
  }
  return new AiProviderError('unavailable');
}

export interface OpenAiCompatibleDeps {
  readonly egress: EgressClient;
  readonly env: AiEnvironment;
}

class OpenAiCompatibleAdapter implements AiTextProvider {
  readonly id = 'openai-compatible' as const;
  readonly #options: OpenAiCompatibleOptions;
  readonly #url: string;
  readonly #egress: EgressClient;
  readonly #env: AiEnvironment;

  constructor(options: OpenAiCompatibleOptions, deps: OpenAiCompatibleDeps) {
    this.#options = options;
    this.#url = chatCompletionsUrl(options.baseUrl);
    this.#egress = deps.egress;
    this.#env = deps.env;
  }

  /** The `Authorization` header from `EDR_AI_API_KEY`, read now; none when the variable is unset or empty. */
  #authorization(): Record<string, string> {
    const key = Object.hasOwn(this.#env, AI_API_KEY_VARIABLE) ? this.#env[AI_API_KEY_VARIABLE] : undefined;
    if (key === undefined || key === '') {
      return {};
    }
    if (!SENDABLE_KEY.test(key)) {
      throw new AiProviderError('unavailable');
    }
    return { Authorization: `Bearer ${key}` };
  }

  async generateDraft(req: DraftRequest, ctx: AiDraftContext): Promise<DraftResponse> {
    const request = parseDraftRequest(req);
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.#authorization(),
    };
    let response: { status: number; text: string };
    try {
      response = await this.#egress.request(this.#url, {
        method: 'POST',
        headers,
        body: buildChatCompletionsBody(request, this.#options),
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
    return parseDraftResponseText(messageContent(response.text, status), request, status);
  }
}

/** Creates the OpenAI-compatible adapter; invalid options stop startup with a `ConfigError`. */
export function createOpenAiCompatibleProvider(options: unknown, deps: OpenAiCompatibleDeps): AiTextProvider {
  return new OpenAiCompatibleAdapter(parseOpenAiCompatibleOptions(options), deps);
}
