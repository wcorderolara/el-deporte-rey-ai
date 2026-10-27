/**
 * Adapter options of the AI port (contracts/provider-ports.md section 2), validated at startup. An invalid option
 * stops startup with a `ConfigError` that names the setting with fixed problem text and never echoes a configured
 * value (OD-20). The API key is never an option: it comes only from `EDR_AI_API_KEY` (AD-30).
 */
import { z } from 'zod';

import { ConfigError, type ConfigIssue, httpsOrigin } from '../../platform/config/index.js';
import {
  DEFAULT_AI_MAX_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES_LIMIT,
  MAX_TIMEOUT_MS,
  isLoopbackHostname,
} from '../../platform/net/index.js';

const OPTIONS_SETTING = 'providers.ai.options';

/** Stub scenarios: the file read is `fixtures/ai/<scenario>.json`. */
export const STUB_SCENARIO_PATTERN = /^[a-z0-9-]{1,60}$/;
export const DEFAULT_STUB_SCENARIO = 'default';

export interface StubAdapterOptions {
  readonly scenario: string;
}

export interface OpenAiCompatibleOptions {
  /** `https:` URL, or `http:` on a loopback host; no user information, query or fragment. */
  readonly baseUrl: string;
  /** Model identifier; no model name is fixed by the design (R-106). */
  readonly model: string;
  readonly temperature?: number;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

const NO_CONTROL_OR_FORMAT = /^[^\p{Cc}\p{Cf}]*$/u;

/** True for an `https:` URL, or an `http:` URL on a loopback host, without user information, query or fragment. */
export function isAcceptedAiBaseUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.search !== '' || url.hash !== '' || value.includes('?') || value.includes('#')) {
    return false;
  }
  if (httpsOrigin(value) !== null) {
    return true;
  }
  return url.protocol === 'http:' && url.username === '' && url.password === '' && isLoopbackHostname(url.hostname);
}

const PROBLEMS: Readonly<Record<string, string>> = {
  scenario: 'must be a scenario name of 1 to 60 lower-case letters, digits or hyphens',
  baseUrl: 'must be an https: URL, or an http: URL on a loopback host, without user information, query or fragment',
  model: 'must be a model identifier of 1 to 200 printable characters',
  temperature: 'must be a number from 0 to 2',
  timeoutMs: `must be an integer from 1 to ${String(MAX_TIMEOUT_MS)}`,
  maxResponseBytes: `must be an integer from 1 to ${String(MAX_RESPONSE_BYTES_LIMIT)}`,
};

const stubSchema = z.strictObject({
  scenario: z.string().regex(STUB_SCENARIO_PATTERN).default(DEFAULT_STUB_SCENARIO),
});

const openAiCompatibleSchema = z.strictObject({
  baseUrl: z.custom<string>(isAcceptedAiBaseUrl),
  model: z.string().min(1).max(200).regex(NO_CONTROL_OR_FORMAT),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().min(1).max(MAX_TIMEOUT_MS),
  maxResponseBytes: z.number().int().min(1).max(MAX_RESPONSE_BYTES_LIMIT).default(DEFAULT_AI_MAX_RESPONSE_BYTES),
});

function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return { setting: OPTIONS_SETTING, problem: 'contains unknown keys' };
    }
    const field = issue.path[0];
    const known = typeof field === 'string' && Object.hasOwn(PROBLEMS, field);
    return known
      ? {
          setting: `${OPTIONS_SETTING}.${field}`,
          problem: issue.input === undefined ? 'is required' : (PROBLEMS[field] ?? 'is invalid'),
        }
      : { setting: OPTIONS_SETTING, problem: 'is invalid' };
  });
}

function parseOptions<T>(schema: z.ZodType<T>, options: unknown): T {
  const result = schema.safeParse(options, { reportInput: true });
  if (!result.success) {
    throw new ConfigError(toIssues(result.error));
  }
  return Object.freeze(result.data);
}

/** Validates the stub adapter options (`scenario` defaults to `default`). */
export function parseStubOptions(options: unknown): StubAdapterOptions {
  return parseOptions(stubSchema, options);
}

/** Validates the OpenAI-compatible adapter options (`maxResponseBytes` defaults to 256 KiB, T10-F07). */
export function parseOpenAiCompatibleOptions(options: unknown): OpenAiCompatibleOptions {
  const parsed = parseOptions(openAiCompatibleSchema, options);
  const result: {
    baseUrl: string;
    model: string;
    temperature?: number;
    timeoutMs: number;
    maxResponseBytes: number;
  } = {
    baseUrl: parsed.baseUrl,
    model: parsed.model,
    timeoutMs: parsed.timeoutMs,
    maxResponseBytes: parsed.maxResponseBytes,
  };
  if (parsed.temperature !== undefined) {
    result.temperature = parsed.temperature;
  }
  return Object.freeze(result);
}
