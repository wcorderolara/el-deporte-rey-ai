/**
 * Test-only support of the brand integration tests: a temporary project root whose data directory (mode 0700) is
 * created like `main.ts` does, a container over a migrated database in that directory, fake sports and AI providers
 * (no connection is opened), and the app with the brand module. All data is synthetic; the root is removed by
 * `close`. Not used by production code.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

import { buildApp } from '../../../app.js';
import { type AppContainer, createContainer } from '../../../container.js';
import { type SqliteDatabase, DATABASE_FILE_NAME, openMigratedDatabase } from '../../../platform/db/index.js';
import { createLogger } from '../../../platform/http/index.js';
import type { AiTextProvider } from '../../../providers/ai/index.js';
import type { SourceRegistry } from '../../../providers/sports/index.js';
import { FIXED_NOW, config as buildConfig, demoSource } from '../../../providers/sports/test/synthetic.js';
import { type BrandModuleOptions, createBrandModule } from '../index.js';

export { FIXED_NOW };

export const HOST = '127.0.0.1:4300';
export const ORIGIN = 'http://127.0.0.1:4300';

/** Headers of a read from the UI. */
export const READ_HEADERS = Object.freeze({ host: HOST });

/** Headers of a well-formed upload from the UI (T36: raw bytes, the client header, the image media type). */
export function uploadHeaders(contentType: string): Record<string, string> {
  return { host: HOST, origin: ORIGIN, 'x-edr-client': 'web', 'content-type': contentType };
}

/** Headers of a well-formed JSON write from the UI. */
export const JSON_HEADERS = Object.freeze({
  host: HOST,
  origin: ORIGIN,
  'x-edr-client': 'web',
  'content-type': 'application/json',
});

export interface BrandTestRoot {
  readonly rootDir: string;
  readonly dataDir: string;
  remove(): void;
}

/** A temporary project root with its data directory (mode 0700). */
export function createBrandTestRoot(): BrandTestRoot {
  const rootDir = mkdtempSync(join(tmpdir(), 'edr-t33-'));
  const dataDir = join(rootDir, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return { rootDir, dataDir, remove: () => rmSync(rootDir, { recursive: true, force: true }) };
}

export interface BrandTestApp {
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  readonly db: SqliteDatabase;
  readonly root: BrandTestRoot;
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  /** Closes the app and the database; removes the root unless it was passed in. */
  close(): Promise<void>;
}

export interface BrandTestOptions extends BrandModuleOptions {
  /** Reuses a root (to restart over the same data directory and database file). */
  readonly root?: BrandTestRoot;
}

/** Builds the app with the brand module over a database file in a temporary data directory. */
export async function brandTestApp(options: BrandTestOptions = {}): Promise<BrandTestApp> {
  const root = options.root ?? createBrandTestRoot();
  const config = buildConfig([demoSource('demo-a')], undefined, root.rootDir);
  if (config.paths.dataDir !== root.dataDir) {
    throw new Error('the test configuration does not use the temporary data directory');
  }
  const { db } = openMigratedDatabase({ location: join(root.dataDir, DATABASE_FILE_NAME) });
  const container = createContainer({
    config,
    db,
    env: Object.freeze({}),
    clock: { now: () => new Date(FIXED_NOW) },
    logger: createLogger({ level: 'silent' }),
    providers: {
      createSportsSources: () => ({ sourceIds: [] }) as unknown as SourceRegistry,
      createAiProvider: () => ({ id: 'stub' }) as unknown as AiTextProvider,
    },
  });
  const { root: _root, ...moduleOptions } = options;
  const app = await buildApp(container, { webRoot: null, modules: [createBrandModule(moduleOptions)] });
  await app.ready();
  return {
    app,
    container,
    db,
    root,
    inject: (request) => app.inject(request),
    close: async () => {
      await app.close();
      db.close();
      if (options.root === undefined) {
        root.remove();
      }
    },
  };
}
