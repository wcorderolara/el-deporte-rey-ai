/**
 * Configuration loading and startup validation (architecture.md section 5.1; OD-20, R-226, R-266).
 *
 * Order: environment (`EDR_CONFIG`, `EDR_DATA_DIR`, `EDR_PORT` only); the application document; the documents it
 * names (catalogue links, languages, brand); for each document a key scan (secret-like and `__proto__` keys) and a
 * closed Zod schema; then the startup rules across settings and documents. Every problem found is reported in one
 * `ConfigError` that names the settings and never a value. The result is deeply frozen and holds no secret.
 */
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import type { ZodType } from 'zod';

import { CatalogueConfig, toCatalogueLinks } from './catalogue.js';
import { readConfigEnvironment, type ConfigEnvironment, type EnvironmentSource } from './environment.js';
import { ConfigError, type ConfigIssue } from './errors.js';
import { scanKeys } from './keys.js';
import { checkCatalogueLinks, checkSourceList, resolveSources } from './rules.js';
import {
  type AppDocument,
  DEFAULT_CONFIG_FILE,
  PARSE_PARAMS,
  appDocumentSchema,
  brandDocumentSchema,
  catalogueDocumentSchema,
  isStageAliasDataPath,
  languagesDocumentSchema,
  toConfigIssues,
} from './schema.js';
import type { AppConfig, BrandConfig, LanguagesConfig } from './types.js';

/** Largest configuration file read (a configuration is a few kilobytes). */
export const MAX_CONFIG_FILE_BYTES = 1024 * 1024;

/** Parsed (not yet validated) JSON of the configuration documents. */
export interface ConfigDocuments {
  readonly app: unknown;
  /** `config/catalogue.json` content; absent when the application document names no links file. */
  readonly catalogue?: unknown;
  readonly languages: unknown;
  readonly brand: unknown;
}

export interface BuildContext {
  /** Absolute project root; relative paths resolve against it. */
  readonly rootDir: string;
  readonly environment: ConfigEnvironment;
}

export interface LoadConfigOptions {
  /** Absolute project root; relative paths (also in `EDR_CONFIG`) resolve against it. */
  readonly rootDir: string;
  /** The environment, for example `process.env`; only `EDR_CONFIG`, `EDR_DATA_DIR` and `EDR_PORT` are read. */
  readonly env: EnvironmentSource;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value) && !(value instanceof Map)) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function absolute(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(rootDir, path);
}

/** Validates one document: key scan, then schema. Issues are appended; the parsed value or null is returned. */
function validateDocument<T>(
  raw: unknown,
  schema: ZodType<T>,
  prefix: string,
  issues: ConfigIssue[],
  dataKeyPaths?: (path: readonly PropertyKey[]) => boolean,
): T | null {
  const keyIssues = scanKeys(raw, { prefix, dataKeyPaths });
  if (keyIssues.length > 0) {
    issues.push(...keyIssues);
    return null;
  }
  const result = schema.safeParse(raw, PARSE_PARAMS);
  if (!result.success) {
    issues.push(...toConfigIssues(result.error, prefix));
    return null;
  }
  return result.data;
}

/** Validates the application document alone (keys and schema); throws a `ConfigError` naming every problem. */
export function parseAppDocument(raw: unknown): AppDocument {
  const issues: ConfigIssue[] = [];
  const document = validateDocument(raw, appDocumentSchema, '', issues);
  if (document === null) {
    throw new ConfigError(issues);
  }
  return document;
}

/** Validates every document and the startup rules, and returns the frozen configuration. */
export function buildAppConfig(documents: ConfigDocuments, context: BuildContext): AppConfig {
  const app = parseAppDocument(documents.app);
  const issues: ConfigIssue[] = [];

  const sources = resolveSources(app.providers.sports.sources, issues);
  checkSourceList(sources, issues);

  let catalogue = CatalogueConfig.empty();
  if (documents.catalogue !== undefined) {
    const document = validateDocument(
      documents.catalogue,
      catalogueDocumentSchema,
      'catalogue',
      issues,
      isStageAliasDataPath,
    );
    if (document !== null) {
      const links = toCatalogueLinks(document.links);
      checkCatalogueLinks(links, sources, issues);
      catalogue = new CatalogueConfig(links, document.restrictToLinks);
    }
  } else if (app.catalogue !== undefined) {
    issues.push({ setting: 'catalogue.linksFile', problem: 'names a file that was not provided' });
  }

  const languages = validateDocument(documents.languages, languagesDocumentSchema, 'languages', issues);
  const brand = validateDocument(documents.brand, brandDocumentSchema, 'brand', issues);

  if (issues.length > 0 || languages === null || brand === null) {
    throw new ConfigError(issues);
  }

  const port = context.environment.port ?? app.server.port;
  const languagesConfig: LanguagesConfig = {
    defaultLanguage: languages.defaultLanguage,
    languages: languages.languages.map((language) => ({ code: language.code, label: language.label })),
  };
  const brandConfig: BrandConfig = {
    name: brand.name,
    handle: brand.handle,
    mascotName: brand.mascotName ?? null,
    provisional: brand.provisional,
    palette: { ...brand.palette },
    fonts: {
      heading: { ...brand.fonts.heading },
      body: { ...brand.fonts.body },
      numeric: { ...brand.fonts.numeric },
    },
  };

  return deepFreeze<AppConfig>({
    server: {
      host: app.server.host,
      port,
      allowedHosts: app.server.allowedHosts ?? [`127.0.0.1:${String(port)}`, `localhost:${String(port)}`],
      allowedOrigins: app.server.allowedOrigins ?? [
        `http://127.0.0.1:${String(port)}`,
        `http://localhost:${String(port)}`,
      ],
    },
    paths: {
      rootDir: context.rootDir,
      dataDir: absolute(context.rootDir, context.environment.dataDir ?? app.dataDir),
    },
    display: { utcOffsetMinutes: app.display.utcOffsetMinutes },
    format: { ...app.format },
    standingsRowsPerSlide: app.standingsRowsPerSlide,
    publicationMode: app.publicationMode,
    providers: {
      sports: { sources },
      ai: { adapter: app.providers.ai.adapter, options: app.providers.ai.options },
      images: { adapter: app.providers.images.adapter, options: app.providers.images.options },
      editorial: { adapter: app.providers.editorial.adapter, options: app.providers.editorial.options },
    },
    verificationPolicy: { ...app.verificationPolicy },
    catalogue,
    languages: languagesConfig,
    brand: brandConfig,
  });
}

/** Reads and parses one JSON document; errors name the setting that points to the file, never its path or content. */
export function readJsonDocument(path: string, setting: string): unknown {
  let text: string;
  try {
    const stats = statSync(path);
    if (!stats.isFile()) {
      throw new ConfigError(setting, 'must name a regular file');
    }
    if (stats.size > MAX_CONFIG_FILE_BYTES) {
      throw new ConfigError(setting, `names a file larger than ${String(MAX_CONFIG_FILE_BYTES)} bytes`);
    }
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(setting, 'names a file that cannot be read');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ConfigError(setting, 'names a file that is not valid JSON');
  }
}

/**
 * Loads the configuration named by `EDR_CONFIG` (default `config/app.config.json`) and the documents it names, and
 * validates them. Throws a `ConfigError` that stops startup (OD-20).
 */
export function loadConfig(options: LoadConfigOptions): AppConfig {
  const environment = readConfigEnvironment(options.env);
  const rootDir = resolve(options.rootDir);
  const appSetting = environment.configFile === null ? DEFAULT_CONFIG_FILE : 'EDR_CONFIG';
  const appRaw = readJsonDocument(absolute(rootDir, environment.configFile ?? DEFAULT_CONFIG_FILE), appSetting);
  const app = parseAppDocument(appRaw);

  return buildAppConfig(
    {
      app: appRaw,
      catalogue:
        app.catalogue === undefined
          ? undefined
          : readJsonDocument(absolute(rootDir, app.catalogue.linksFile), 'catalogue.linksFile'),
      languages: readJsonDocument(absolute(rootDir, app.languagesFile), 'languagesFile'),
      brand: readJsonDocument(absolute(rootDir, app.brandFile), 'brandFile'),
    },
    { rootDir, environment },
  );
}
