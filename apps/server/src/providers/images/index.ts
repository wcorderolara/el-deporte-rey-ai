/**
 * Image generation provider entry point (PD-ARCH-01G-B). The design module depends only on this file: the
 * `ImageGenerationProvider` port, `createImageProvider(config, deps)` and the closed failure type. Adapters:
 * `disabled` (default; never sends anything) and `openai` (Image API, through the image egress client).
 */
export { IMAGE_FAILURE_CODES, type ImageFailureCode, ImageProviderError, isImageProviderError } from './errors.js';
export { createDisabledImageProvider } from './disabled-adapter.js';
export { createImageProvider } from './factory.js';
export {
  EDITS_PATH,
  GENERATIONS_PATH,
  MODELS_PATH,
  buildImageRequestBody,
  createOpenAiImageProvider,
  endpointUrl,
  parseImageResponse,
  statusFailure,
} from './openai-adapter.js';
export { LIMIT_BOUNDS, type OpenAiImageOptions, parseOpenAiImageOptions } from './options.js';
export {
  IMAGE_ADAPTER_KINDS,
  IMAGE_API_KEY_VARIABLE,
  type GeneratedImage,
  type ImageAdapterKind,
  type ImageEnvironment,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageInput,
  type ImageInputMime,
  type ImageModel,
  type ImageOrientation,
  type ImageOutputFormat,
  type ImagePricing,
  type ImageProviderCapabilities,
  type ImageProviderDeps,
  type ImageProviderStatus,
  type ImageUsage,
  type ImageUsageLimits,
  type ModelAccess,
} from './port.js';
