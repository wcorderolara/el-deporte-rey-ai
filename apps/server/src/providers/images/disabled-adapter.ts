/**
 * The `disabled` image adapter (default, PD-ARCH-01G-B): no provider is configured, so nothing can be generated and
 * no request is ever sent. Capabilities report `disabled`; every call fails with `not_configured`.
 */
import { ImageProviderError } from './errors.js';
import type { ImageGenerationProvider, ImageProviderCapabilities } from './port.js';

const CAPABILITIES: ImageProviderCapabilities = Object.freeze({
  adapter: 'disabled',
  status: 'disabled',
  defaultModel: null,
  models: Object.freeze([]),
  outputFormat: 'png',
  limits: Object.freeze({
    maxImagesPerRequest: 1,
    maxReferences: 0,
    maxImagesPerDay: 1,
    monthlySpendLimit: null,
    spendReservePerImage: null,
    maxConcurrentRequests: 1,
  }),
});

export function createDisabledImageProvider(): ImageGenerationProvider {
  return Object.freeze({
    id: 'disabled' as const,
    capabilities: () => CAPABILITIES,
    checkModelAccess: () => Promise.reject(new ImageProviderError('not_configured')),
    generate: () => Promise.reject(new ImageProviderError('not_configured')),
  });
}
