/**
 * Selection of the AI adapter by configuration only (contracts/provider-ports.md section 2; R-106, R-223).
 */
import { type AppConfig, ConfigError } from '../../platform/config/index.js';

import { createOpenAiCompatibleProvider } from './openai-compatible-adapter.js';
import { AI_ADAPTER_KINDS, type AiProviderDeps, type AiTextProvider } from './port.js';
import { createStubAiProvider } from './stub-adapter.js';

/**
 * Creates the configured AI text provider. An unknown adapter kind or invalid adapter options stop startup with a
 * `ConfigError` naming the setting (OD-20). No request is sent at creation.
 */
export function createAiProvider(config: AppConfig, deps: AiProviderDeps): AiTextProvider {
  const { adapter, options } = config.providers.ai;
  switch (adapter) {
    case 'stub':
      return createStubAiProvider(options, { paths: deps.paths });
    case 'openai-compatible':
      return createOpenAiCompatibleProvider(options, { egress: deps.egress, env: deps.env });
    default:
      throw new ConfigError('providers.ai.adapter', `must be one of: ${AI_ADAPTER_KINDS.join(', ')}`);
  }
}
