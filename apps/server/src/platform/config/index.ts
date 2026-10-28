/**
 * Configuration (architecture.md sections 5.1, 12.1 and 15.2): loading and validating `config/*.json` and the
 * environment at startup: sources, catalogue links, verification policy, languages, format, brand and server
 * settings. It reads no secret and holds no provider identifier.
 */
export { CatalogueConfig, type CatalogueBinding, type CatalogueLink } from './catalogue.js';
export {
  CONFIG_ENVIRONMENT_VARIABLES,
  type ConfigEnvironment,
  type EnvironmentSource,
  readConfigEnvironment,
} from './environment.js';
export { ConfigError, type ConfigIssue } from './errors.js';
export { isSecretLikeKey } from './keys.js';
export {
  type BuildContext,
  type ConfigDocuments,
  type LoadConfigOptions,
  MAX_CONFIG_FILE_BYTES,
  buildAppConfig,
  loadConfig,
  parseAppDocument,
  readJsonDocument,
} from './load.js';
export { httpsOrigin, optionBaseUrl } from './rules.js';
export {
  DECISION_ID_PATTERN,
  DEFAULT_CONFIG_FILE,
  DEFAULT_FORMAT,
  DEFAULT_PORT,
  DEFAULT_STANDINGS_ROWS_PER_SLIDE,
  DEFAULT_UTC_OFFSET_MINUTES,
  INSTAGRAM_MAX_CAROUSEL_ITEMS,
  LOOPBACK_HOST,
  SLUG_PATTERN,
  SOURCE_ID_PATTERN,
} from './schema.js';
export {
  type AdapterOptions,
  type AiProviderConfig,
  type AppConfig,
  type BrandConfig,
  DATA_MODES,
  type DataMode,
  type FontRole,
  type FormatConfig,
  LIVE_PUBLICATION_PERMISSION_RULES,
  type LanguagesConfig,
  type LivePublicationPermissionRule,
  MANUALLY_APPROVED_PUBLICATION_POLICIES,
  type ManuallyApprovedPublicationPolicy,
  PUBLICATION_PERMISSIONS,
  type PathsConfig,
  type PublicationPermission,
  SOURCE_ROLES,
  type ServerConfig,
  type SourceConfig,
  type SourceRole,
  type VerificationPolicy,
} from './types.js';
