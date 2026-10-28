/**
 * The AI text provider port (contracts/provider-ports.md section 2; AD-08). Only the content stage uses it.
 */
import type { EgressClient } from '../../platform/net/index.js';

import type { DraftRequest, DraftResponse } from './schemas.js';

/** Adapter kinds of the AI port. */
export const AI_ADAPTER_KINDS = ['stub', 'openai-compatible'] as const;
export type AiAdapterKind = (typeof AI_ADAPTER_KINDS)[number];

/** Environment variable holding the AI API key; read at call time, never from configuration (AD-30). */
export const AI_API_KEY_VARIABLE = 'EDR_AI_API_KEY';

export interface AiDraftContext {
  readonly signal: AbortSignal;
}

export interface AiTextProvider {
  readonly id: AiAdapterKind;
  /**
   * Validates the request with the strict schema, drafts, and returns a validated response. Throws
   * `AiProviderError` with a closed code only.
   */
  generateDraft(req: DraftRequest, ctx: AiDraftContext): Promise<DraftResponse>;
}

/** The injected environment, as a read-only lookup. */
export type AiEnvironment = Readonly<Record<string, string | undefined>>;

/** The paths the AI port needs: the project root, under which `fixtures/ai/` lives. */
export interface AiPaths {
  readonly rootDir: string;
}

export interface AiProviderDeps {
  readonly egress: EgressClient;
  readonly env: AiEnvironment;
  readonly paths: AiPaths;
}
