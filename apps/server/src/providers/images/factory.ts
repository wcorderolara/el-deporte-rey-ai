/**
 * Selection of the image adapter by configuration only (PD-ARCH-01G-B). No request is sent at creation.
 */
import { type AppConfig, ConfigError } from '../../platform/config/index.js';

import { createDisabledImageProvider } from './disabled-adapter.js';
import { createOpenAiImageProvider } from './openai-adapter.js';
import { IMAGE_ADAPTER_KINDS, type ImageGenerationProvider, type ImageProviderDeps } from './port.js';

/** Creates the configured image provider; an unknown kind or invalid options stop startup with a `ConfigError`. */
export function createImageProvider(config: AppConfig, deps: ImageProviderDeps): ImageGenerationProvider {
  const { adapter, options } = config.providers.images;
  switch (adapter) {
    case 'disabled':
      return createDisabledImageProvider();
    case 'openai':
      return createOpenAiImageProvider(options, deps);
    default:
      throw new ConfigError('providers.images.adapter', `must be one of: ${IMAGE_ADAPTER_KINDS.join(', ')}`);
  }
}
