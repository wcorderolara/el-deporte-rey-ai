/**
 * The image generation provider port (PD-ARCH-01G-B). Only the design module uses it, to generate visual proposals
 * from the brand identity; the deterministic slide renderer never calls it.
 *
 * Business code depends on this port and on the closed failure type only, never on a vendor SDK or a provider
 * response shape. The first and only adapter is `openai` (Image API, through the image egress client).
 */
import type { EgressClient } from '../../platform/net/index.js';

/** Adapter kinds of the image port; `disabled` means no generation is possible. */
export const IMAGE_ADAPTER_KINDS = ['disabled', 'openai'] as const;
export type ImageAdapterKind = (typeof IMAGE_ADAPTER_KINDS)[number];

/** Environment variable holding the image provider's API key; read at call time, never from configuration. */
export const IMAGE_API_KEY_VARIABLE = 'EDR_IMAGE_API_KEY';

/** Media types an input image may have (the brand library's types). */
export type ImageInputMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** Media types a generated image is requested in. */
export type ImageOutputFormat = 'png' | 'jpeg';

/** Image sizes of a published per-image cost table. */
export type ImageOrientation = 'square' | 'portrait' | 'landscape';

/** Prices per million tokens, as configured from the provider's published price list (never fixed in code). */
export interface ImagePricing {
  readonly currency: 'USD';
  readonly textInputPerMillionTokens: number;
  readonly imageInputPerMillionTokens: number;
  readonly imageOutputPerMillionTokens: number;
  /** Price of text output tokens, for models that report them; null when the provider publishes none. */
  readonly textOutputPerMillionTokens: number | null;
  /** Where and when the prices were checked; shown with every estimate. */
  readonly source: string;
  readonly checkedOn: string;
}

/** A configured model and what it supports. */
export interface ImageModel {
  readonly id: string;
  readonly label: string;
  /** True when the model accepts arbitrary `WIDTHxHEIGHT` sizes (multiples of 16); else the standard sizes only. */
  readonly flexibleSizes: boolean;
  readonly qualities: readonly string[];
  readonly pricing: ImagePricing | null;
  /** Published output cost of one standard-size image by quality and orientation, when the provider publishes one. */
  readonly publishedImageCosts: Readonly<Record<string, Partial<Record<ImageOrientation, number>>>> | null;
}

/** Usage limits of the configured provider. */
export interface ImageUsageLimits {
  readonly maxImagesPerRequest: number;
  readonly maxReferences: number;
  readonly maxImagesPerDay: number;
  /** Highest computed spend in a calendar month (UTC), or null for no spend limit. */
  readonly monthlySpendLimit: number | null;
  /**
   * Conservative spend reserved per requested image, by quality, when the model has no published per-image cost: the
   * monthly limit is checked against it before generating (PD-27). Null when none is configured; a request whose cost
   * can be neither estimated nor reserved is then refused while a monthly limit is set.
   */
  readonly spendReservePerImage: Readonly<Record<string, number>> | null;
  readonly maxConcurrentRequests: number;
}

export type ImageProviderStatus = 'disabled' | 'missing_api_key' | 'ready';

/** What the configured provider offers; built from configuration and the presence of the key, no request is sent. */
export interface ImageProviderCapabilities {
  readonly adapter: ImageAdapterKind;
  readonly status: ImageProviderStatus;
  readonly defaultModel: string | null;
  readonly models: readonly ImageModel[];
  readonly outputFormat: ImageOutputFormat;
  readonly limits: ImageUsageLimits;
}

export interface ImageInput {
  readonly mime: ImageInputMime;
  readonly content: Buffer;
}

export interface ImageGenerationRequest {
  readonly model: string;
  readonly prompt: string;
  /** `WIDTHxHEIGHT` within the model's size rules. */
  readonly size: string;
  readonly quality: string;
  /** Input images in prompt order ("Image 1", "Image 2"...); empty for a text-only generation. */
  readonly images: readonly ImageInput[];
  readonly signal: AbortSignal;
}

/** Token usage reported by the provider; null fields were not reported. */
export interface ImageUsage {
  readonly inputTextTokens: number | null;
  readonly inputImageTokens: number | null;
  readonly outputImageTokens: number | null;
  readonly outputTextTokens: number | null;
  readonly totalTokens: number | null;
}

export interface GeneratedImage {
  /** The decoded bytes; the caller checks their type and dimensions before storing them. */
  readonly content: Buffer;
  readonly usage: ImageUsage | null;
}

export type ModelAccess = 'available' | 'unavailable' | 'not_authorized';

export interface ImageGenerationProvider {
  readonly id: ImageAdapterKind;
  capabilities(): ImageProviderCapabilities;
  /** Asks the provider whether the account can use a configured model (a free metadata request). */
  checkModelAccess(model: string, signal: AbortSignal): Promise<ModelAccess>;
  /**
   * Generates one image. Throws `ImageProviderError` with a closed code only; never retries, because a repeated
   * request could be charged twice.
   */
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
}

/** The injected environment, as a read-only lookup. */
export type ImageEnvironment = Readonly<Record<string, string | undefined>>;

export interface ImageProviderDeps {
  /** The image egress client: its own allow-list and bounds (`IMAGE_EGRESS_LIMITS`). */
  readonly egress: EgressClient;
  readonly env: ImageEnvironment;
}
