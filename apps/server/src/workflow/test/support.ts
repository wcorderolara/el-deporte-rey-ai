/**
 * Test-only support of the workflow unit tests: an in-memory migrated database, a minimal container, a synthetic
 * project row and fake stages. Synthetic data only; not used by production code.
 */
import { z } from 'zod';

import type { AppContainer, Clock } from '../../container.js';
import type { Stage, StageContext, StageName } from '../../modules/module-kit.js';
import type { AppConfig } from '../../platform/config/index.js';
import { type SqliteDatabase, openMigratedDatabase } from '../../platform/db/index.js';
import { createLogger } from '../../platform/http/index.js';
import { config as syntheticConfig, demoSource } from '../../providers/sports/test/synthetic.js';

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

/** A clock that advances one second per reading, from a fixed synthetic time. */
export function steppingClock(start = '2026-10-27T12:00:00.000Z'): Clock {
  let time = Date.parse(start);
  return {
    now: () => {
      const value = new Date(time);
      time += 1000;
      return value;
    },
  };
}

/** A synthetic configuration with two DEMO_DATA sources. */
export function testConfig(): AppConfig {
  return syntheticConfig([demoSource('demo-a'), demoSource('demo-b', { role: 'verification' })]);
}

export interface WorkflowFixture {
  readonly container: AppContainer;
  readonly db: SqliteDatabase;
  close(): void;
}

/** A container over an in-memory database with one source and one project row. */
export function workflowFixture(config: AppConfig = testConfig()): WorkflowFixture {
  const { db } = openMigratedDatabase({ location: ':memory:' });
  const at = '2026-10-27T11:00:00.000Z';
  db.prepare(
    'INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, ' +
      'publication_permission, adapter, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)',
  ).run(['demo-a', 'Synthetic demo-a', 'DEMO_DATA', 'primary', 'demo-a', 'not_applicable', 'fixture', at, at]);
  db.prepare(
    'INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, ' +
      'stage_id, stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run([
    PROJECT_ID,
    'liga-demo',
    'Liga Demo',
    'demo-a',
    'DEMO_DATA',
    '2026',
    '2026/27',
    'regular',
    'Fase Regular',
    1,
    '{"c":"liga-demo"}',
    'expected',
    'es',
    at,
    at,
  ]);
  const container = {
    config,
    db,
    clock: steppingClock(),
    logger: createLogger({ level: 'silent' }),
  } as unknown as AppContainer;
  return { container, db, close: () => db.close() };
}

export interface StageCall {
  readonly stage: StageName;
  readonly step: 'load' | 'run' | 'persist';
  readonly runKind: StageContext['runKind'];
}

export interface FakeStageOptions {
  /** Thrown (or returned as a rejected promise) by `run`. */
  readonly fail?: () => unknown;
  /** Raw output returned by `run` instead of the valid one. */
  readonly output?: unknown;
  /** Awaited by `run` before it returns. */
  readonly gate?: Promise<void>;
}

/** A fake stage recording its calls; input and output are `{ stage, value }` objects. */
export function fakeStage(
  name: StageName,
  calls: StageCall[],
  options: FakeStageOptions = {},
): Stage<unknown, unknown> {
  const schema = z.strictObject({ stage: z.literal(name), value: z.int() });
  return {
    name,
    input: schema,
    output: schema,
    load: async (ctx) => {
      calls.push({ stage: name, step: 'load', runKind: ctx.runKind });
      await Promise.resolve();
      return { stage: name, value: 1 };
    },
    run: async (input, ctx) => {
      calls.push({ stage: name, step: 'run', runKind: ctx.runKind });
      if (options.gate !== undefined) {
        await options.gate;
      }
      if (options.fail !== undefined) {
        throw options.fail();
      }
      return options.output ?? { ...(input as object) };
    },
    persist: async (_output, ctx) => {
      calls.push({ stage: name, step: 'persist', runKind: ctx.runKind });
      await Promise.resolve();
    },
  } as Stage<unknown, unknown>;
}

/** A promise with its resolver. */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
