/**
 * AI text provider entry point (contracts/provider-ports.md section 2; architecture.md section 5.3; AD-08, AD-11).
 *
 * Downstream code (the content stage) depends only on this entry point: `createAiProvider(config, deps)`, the
 * `AiTextProvider` port, the `DraftRequest` and `DraftResponse` schemas and the closed failure type. Adapters:
 * `stub` (default configuration and tests; no network) and `openai-compatible` (through the egress client).
 */
export { AI_FAILURE_CODES, type AiFailureCode, AiProviderError, isAiProviderError } from './errors.js';
export { createAiProvider } from './factory.js';
export {
  CHAT_COMPLETIONS_PATH,
  type OpenAiCompatibleDeps,
  RESPONSE_FORMAT_NAME,
  buildChatCompletionsBody,
  chatCompletionsUrl,
  createOpenAiCompatibleProvider,
} from './openai-compatible-adapter.js';
export {
  DEFAULT_STUB_SCENARIO,
  type OpenAiCompatibleOptions,
  STUB_SCENARIO_PATTERN,
  type StubAdapterOptions,
  isAcceptedAiBaseUrl,
  parseOpenAiCompatibleOptions,
  parseStubOptions,
} from './options.js';
export {
  AI_ADAPTER_KINDS,
  AI_API_KEY_VARIABLE,
  type AiAdapterKind,
  type AiDraftContext,
  type AiEnvironment,
  type AiPaths,
  type AiProviderDeps,
  type AiTextProvider,
} from './port.js';
export {
  AI_SYSTEM_INSTRUCTION,
  AI_SYSTEM_INSTRUCTION_VERSION,
  DATA_BLOCK_HEADER,
  type DraftPrompt,
  buildDataBlock,
  buildDraftPrompt,
  buildUserMessage,
  draftOutputJsonSchema,
} from './prompt.js';
export {
  type AiStubFixture,
  type AiStubFixtureSlide,
  DRAFT_LANGUAGES,
  type DraftFact,
  type DraftLanguage,
  type DraftLimits,
  type DraftRequest,
  DraftRequestSchema,
  type DraftResponse,
  type DraftResponseSlide,
  type DraftSlide,
  FACT_KIND_PATTERN,
  LIMIT_BOUNDS,
  PLACEHOLDER_PATTERN,
  SLIDE_KEY_PATTERN,
  SLIDE_TYPES,
  STUB_SIMULATIONS,
  type SlideType,
  type StubSimulation,
  codePointLength,
  draftResponseSchema,
  parseAiStubFixture,
  parseDraftRequest,
  parseDraftResponse,
  parseDraftResponseText,
  requestedSlideKeys,
} from './schemas.js';
export { MAX_STUB_FIXTURE_BYTES, type StubAiTextProvider, createStubAiProvider } from './stub-adapter.js';
