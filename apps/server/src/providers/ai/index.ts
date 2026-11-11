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
export {
  EDITORIAL_DATA_HEADER,
  EDITORIAL_PROMPT_VERSION,
  EDITORIAL_SYSTEM_MESSAGE,
  type EditorialPrompt,
  buildEditorialDataBlock,
  buildEditorialPrompt,
  editorialOutputJsonSchema,
} from './editorial-prompt.js';
export {
  EDITORIAL_ADAPTER_KINDS,
  EDITORIAL_REASONING_EFFORTS,
  EDITORIAL_STUB_SCENARIOS,
  type AiEditorialWriter,
  type EditorialAdapterKind,
  type EditorialOpenAiOptions,
  type EditorialPricing,
  type EditorialReasoningEffort,
  type EditorialStubOptions,
  type EditorialWriteContext,
  type EditorialWriterDescription,
  type EditorialWriterKind,
  type EditorialWriterLimits,
  isHostedBaseUrl,
  parseEditorialOpenAiOptions,
  parseEditorialStubOptions,
} from './editorial-port.js';
export {
  EDITORIAL_CONTENT_KINDS,
  EDITORIAL_EVENT_KINDS,
  EVENT_ID_PATTERN,
  EVIDENCE_ID_PATTERN,
  MATCH_REF_PATTERN,
  RESPONSE_KEY,
  type EditorialContentKind,
  type EditorialEventKind,
  type EditorialEvidenceRef,
  type EditorialFact,
  type EditorialFacebookInstagram,
  type EditorialKeyEvent,
  type EditorialLimits,
  type EditorialMatch,
  type EditorialRequest,
  type EditorialResponse,
  type EditorialResult,
  type EditorialRound,
  type EditorialTeamHashtag,
  type EditorialUsage,
  parseEditorialRequest,
  parseEditorialResponse,
  parseEditorialResponseText,
} from './editorial-schemas.js';
export {
  EDITORIAL_RESPONSE_FORMAT_NAME,
  EDITORIAL_SYSTEM_MESSAGE_BYTES,
  EditorialWriteError,
  type EditorialOpenAiDeps,
  buildEditorialChatBody,
  createOpenAiEditorialWriter,
} from './editorial-openai.js';
export { type StubEditorialWriter, createStubEditorialWriter, stubEditorialAnswer } from './editorial-stub.js';
export { createEditorialWriter } from './editorial-factory.js';
