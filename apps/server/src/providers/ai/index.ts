/**
 * AI text provider entry point (contracts/provider-ports.md section 2).
 *
 * Stub created by T15. T22 replaces it with `createAiProvider(config, deps)`, the `AiTextProvider` port, the stub
 * adapter and the OpenAI-compatible adapter.
 */

/** AI text provider (stub shape; T22 defines the full port). */
export interface AiTextProvider {
  readonly id: string;
}

export function createAiProvider(): AiTextProvider {
  throw new Error('the AI text provider is not available yet');
}
