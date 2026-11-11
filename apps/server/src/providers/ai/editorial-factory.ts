/**
 * Selection of the editorial writer by configuration only (PD-ARCH-01H): `providers.editorial`, `stub` by default. An
 * unknown adapter kind or invalid options stop startup with a `ConfigError` naming the setting. No request is sent at
 * creation.
 */
import { type AppConfig, ConfigError } from '../../platform/config/index.js';

import { createOpenAiEditorialWriter } from './editorial-openai.js';
import { type AiEditorialWriter, EDITORIAL_ADAPTER_KINDS } from './editorial-port.js';
import { createStubEditorialWriter } from './editorial-stub.js';
import type { AiProviderDeps } from './port.js';

export function createEditorialWriter(
  config: AppConfig,
  deps: Pick<AiProviderDeps, 'egress' | 'env'>,
): AiEditorialWriter {
  const { adapter, options } = config.providers.editorial;
  switch (adapter) {
    case 'stub':
      return createStubEditorialWriter(options);
    case 'openai-compatible':
      return createOpenAiEditorialWriter(options, { egress: deps.egress, env: deps.env });
    default:
      throw new ConfigError('providers.editorial.adapter', `must be one of: ${EDITORIAL_ADAPTER_KINDS.join(', ')}`);
  }
}
