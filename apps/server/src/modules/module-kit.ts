/**
 * Server module kit (contracts/provider-ports.md section 3). Created by T15; it fixes the seams that let the module
 * tasks run in parallel with disjoint files.
 *
 * Conventions:
 * - Every module directory `modules/<name>/` has an `index.ts` that exports `serverModule: ServerModule`.
 * - `modules/registry.ts` lists the modules in a fixed order; each module task replaces only its own `index.ts`.
 * - Routes are registered under `/api/v1`. `onStartup` hooks run in registry order after migrations, before listen.
 * - Stage inputs are validated with `input.parse` after `load`, outputs with `output.parse` before `persist`.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodType } from 'zod';

import type { AppContainer } from '../container.js';

export type StageName = 'research' | 'verification' | 'content' | 'rendering' | 'visual_qa';

export interface StageContext {
  runId: string;
  projectId: string;
  runKind: 'full' | 'redraft';
  /** config, db, clock, logger, egress, sources (SourceRegistry), catalogue, aiProvider, paths (T19). */
  container: AppContainer;
  signal: AbortSignal;
}

export interface Stage<I, O> {
  name: StageName;
  input: ZodType<I>;
  output: ZodType<O>;
  /** Reads the inputs from the database. */
  load(ctx: StageContext): Promise<I>;
  /** Pure core plus provider calls; no database writes. */
  run(input: I, ctx: StageContext): Promise<O>;
  /** Persists the output in one transaction. */
  persist(output: O, ctx: StageContext): Promise<void>;
}

export interface ServerModule {
  name: string;
  /** Registered under /api/v1. */
  routes?: (app: FastifyInstance, container: AppContainer) => Promise<void>;
  stages?: Stage<unknown, unknown>[];
  /** Run by main.ts after migrations, before listen, in registry order. */
  onStartup?: (container: AppContainer) => Promise<void>;
}
