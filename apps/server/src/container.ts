/**
 * Composition root: dependency injection by explicit construction (architecture.md section 3;
 * contracts/provider-ports.md sections 1.2, 2 and 3).
 *
 * The container holds the configuration, the database (typed as the narrow `Db` port), the clock, the redacting
 * logger, the egress client, the source registry and catalogue service, the AI provider and the paths. It holds no
 * secret: provider credentials reach the adapters only through the injected environment, a frozen snapshot of the
 * provider variables built once, after which `FOOTBALL_DATA_API_TOKEN` is deleted from `process.env` (AD-30,
 * T11H-F03). The configuration object is built from the configuration files and `EDR_CONFIG`, `EDR_DATA_DIR` and
 * `EDR_PORT` only, so the token never enters it or any snapshot made from it.
 */
import type { AppConfig, EnvironmentSource, PathsConfig } from './platform/config/index.js';
import type { Db } from './platform/db/index.js';
import { type Logger, createLogger } from './platform/http/index.js';
import {
  type EgressClient,
  IMAGE_EGRESS_LIMITS,
  buildEgressAllowList,
  buildImageEgressAllowList,
  createEgressClient,
} from './platform/net/index.js';
import { type AiTextProvider, createAiProvider } from './providers/ai/index.js';
import { type ImageGenerationProvider, createImageProvider } from './providers/images/index.js';
import { type SourceRegistry, createSportsSources } from './providers/sports/index.js';

export interface Clock {
  now(): Date;
}

/** The system clock. */
export const systemClock: Clock = Object.freeze({ now: (): Date => new Date() });

/** The injected environment handed to provider factories (`deps.env`). */
export type Env = EnvironmentSource;

/** Paths handed to providers and modules (`deps.paths`, `container.paths`). */
export type Paths = PathsConfig;

/** Provider variables copied into the injected environment; nothing else from `process.env` is passed on. */
export const PROVIDER_ENVIRONMENT_VARIABLES = [
  'FOOTBALL_DATA_API_TOKEN',
  'EDR_AI_API_KEY',
  'EDR_IMAGE_API_KEY',
] as const;

/**
 * Variables deleted from `process.env` once the injected environment exists (T11H-F03; the image provider key since
 * PD-ARCH-01G-B).
 */
export const DELETED_ENVIRONMENT_VARIABLES = ['FOOTBALL_DATA_API_TOKEN', 'EDR_IMAGE_API_KEY'] as const;

/**
 * Builds the injected environment: a frozen, null-prototype snapshot of `PROVIDER_ENVIRONMENT_VARIABLES` whose
 * properties are not enumerable, so that serializing or inspecting it shows no value. Then deletes
 * `DELETED_ENVIRONMENT_VARIABLES` from `process.env` (and from `source` when it is another object), so later code and
 * libraries cannot read the token.
 */
export function buildInjectedEnvironment(source: Record<string, string | undefined> = process.env): Env {
  const env = Object.create(null) as Record<string, string>;
  for (const name of PROVIDER_ENVIRONMENT_VARIABLES) {
    const value = source[name];
    if (typeof value === 'string') {
      Object.defineProperty(env, name, { value, enumerable: false, writable: false, configurable: false });
    }
  }
  Object.freeze(env);
  deleteProviderSecretsFromProcessEnvironment(source);
  return env;
}

function deleteProviderSecretsFromProcessEnvironment(source?: Record<string, string | undefined>): void {
  for (const name of DELETED_ENVIRONMENT_VARIABLES) {
    delete process.env[name];
    if (source !== undefined && source !== process.env) {
      delete source[name];
    }
  }
}

/** Dependencies of `createSportsSources` (contracts/provider-ports.md section 1.2). */
export interface SportsSourcesDeps {
  readonly egress: EgressClient;
  readonly env: Env;
  readonly clock: Clock;
  readonly db: Db;
  readonly paths: Paths;
  readonly logger: Logger;
}

/** Dependencies of `createAiProvider` (contracts/provider-ports.md section 2). */
export interface AiProviderDeps {
  readonly egress: EgressClient;
  readonly env: Env;
  readonly paths: Paths;
}

/** Dependencies of `createImageProvider` (PD-ARCH-01G-B): the image egress client and the injected environment. */
export interface ImageProviderDeps {
  readonly egress: EgressClient;
  readonly env: Env;
}

/** The provider entry points the container calls. */
export interface ProviderFactories {
  readonly createSportsSources: (config: AppConfig, deps: SportsSourcesDeps) => SourceRegistry;
  readonly createAiProvider: (config: AppConfig, deps: AiProviderDeps) => AiTextProvider;
  /** Image generation (PD-ARCH-01G-B); the production factory when absent. */
  readonly createImageProvider?: (config: AppConfig, deps: ImageProviderDeps) => ImageGenerationProvider;
}

/** The production provider entry points (`providers/sports`, `providers/ai` and `providers/images`). */
export const DEFAULT_PROVIDER_FACTORIES: ProviderFactories = Object.freeze({
  createSportsSources,
  createAiProvider,
  createImageProvider,
});

/**
 * The catalogue service. It is the registry's `catalogue` member when the source registry exposes one
 * (contracts/provider-ports.md section 1.2, T21), else null.
 */
export type CatalogueService = SourceRegistry extends { readonly catalogue: infer C } ? C : null;

function catalogueOf(registry: SourceRegistry): CatalogueService {
  const catalogue = (registry as { catalogue?: unknown }).catalogue;
  return (catalogue ?? null) as CatalogueService;
}

/**
 * Runs the registry's startup validation when the registry exposes it (each enabled adapter's `validateStartup`,
 * OD-20). A `ConfigError` names the setting or the variable, never a value, and stops startup.
 */
export function validateSourcesAtStartup(registry: SourceRegistry): void {
  const validate = (registry as { validateStartup?: unknown }).validateStartup;
  if (typeof validate === 'function') {
    (validate as (this: SourceRegistry) => void).call(registry);
  }
}

export interface AppContainer {
  readonly config: AppConfig;
  /** The database as the narrow `Db` port; modules cannot run unbound SQL scripts. */
  readonly db: Db;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly egress: EgressClient;
  readonly sources: SourceRegistry;
  readonly catalogue: CatalogueService;
  readonly aiProvider: AiTextProvider;
  /** Image generation for design proposals (PD-ARCH-01G-B), with its own egress client and allow-list. */
  readonly imageProvider: ImageGenerationProvider;
  readonly paths: Paths;
}

export interface ContainerOptions {
  readonly config: AppConfig;
  readonly db: Db;
  /** The injected environment; built from `process.env` when absent. */
  readonly env?: Env;
  readonly clock?: Clock;
  readonly logger?: Logger;
  /** Test seam (the test app factory); `main.ts` never passes it. */
  readonly providers?: ProviderFactories;
}

/**
 * Builds the container. Throws the `ConfigError` of an invalid egress base URL or of a source's startup validation,
 * which stops startup.
 */
export function createContainer(options: ContainerOptions): AppContainer {
  const env = options.env ?? buildInjectedEnvironment();
  deleteProviderSecretsFromProcessEnvironment();

  const { config, db } = options;
  const clock = options.clock ?? systemClock;
  const logger = options.logger ?? createLogger();
  const paths = config.paths;
  const providers = options.providers ?? DEFAULT_PROVIDER_FACTORIES;
  const egress = createEgressClient(buildEgressAllowList(config));

  const sources = providers.createSportsSources(config, { egress, env, clock, db, paths, logger });
  validateSourcesAtStartup(sources);
  const aiProvider = providers.createAiProvider(config, { egress, env, paths });
  const imageEgress = createEgressClient(buildImageEgressAllowList(config), IMAGE_EGRESS_LIMITS);
  const imageProvider = (providers.createImageProvider ?? createImageProvider)(config, { egress: imageEgress, env });

  return Object.freeze({
    config,
    db,
    clock,
    logger,
    egress,
    sources,
    catalogue: catalogueOf(sources),
    aiProvider,
    imageProvider,
    paths,
  });
}
