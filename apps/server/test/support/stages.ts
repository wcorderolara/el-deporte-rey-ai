/**
 * Workflow stages for the test app: the stages registered by the server modules (the real research and verification
 * stages, and every later stage once its module registers it), with an explicit placeholder for each stage of the
 * fixed order that no module registers yet, so that a full run can complete end to end. The placeholders are listed
 * so that tests and reports can say which stages were real. Stages can also be overridden one by one.
 */
import { z } from 'zod';

import type { ServerModule, Stage, StageContext, StageName } from '../../src/modules/module-kit.js';
import { type AnyStage, STAGE_ORDER, type StageProvider } from '../../src/workflow/index.js';

/** A pass-through stage standing in for a stage that no module registers yet; it reads and writes nothing. */
export function placeholderStage(name: StageName): AnyStage {
  const schema = z.strictObject({ placeholder: z.literal(true), stage: z.literal(name) });
  const stage: Stage<z.output<typeof schema>, z.output<typeof schema>> = {
    name,
    input: schema,
    output: schema,
    load: async () => {
      await Promise.resolve();
      return { placeholder: true as const, stage: name };
    },
    run: async (input) => {
      await Promise.resolve();
      return input;
    },
    persist: async () => {
      await Promise.resolve();
    },
  };
  return stage as unknown as AnyStage;
}

/** A stage that runs `body` in `run` (for probes such as the echoing-key test); nothing is loaded or persisted. */
export function probeStage(name: StageName, body: (ctx: StageContext) => Promise<void>): AnyStage {
  const schema = z.strictObject({ probe: z.literal(true) });
  const stage: Stage<z.output<typeof schema>, z.output<typeof schema>> = {
    name,
    input: schema,
    output: schema,
    load: async () => {
      await Promise.resolve();
      return { probe: true as const };
    },
    run: async (input, ctx) => {
      await body(ctx);
      return input;
    },
    persist: async () => {
      await Promise.resolve();
    },
  };
  return stage as unknown as AnyStage;
}

export interface WorkflowStages {
  readonly provider: StageProvider;
  /** The stages of the fixed order that are placeholders (no module registers them and no override was given). */
  readonly placeholders: readonly StageName[];
  /** The stages that are overridden by the test. */
  readonly overridden: readonly StageName[];
}

/** The registered stages of `modules`, overrides first, placeholders for the rest. */
export function workflowStages(
  modules: readonly ServerModule[],
  overrides: Partial<Record<StageName, AnyStage>> = {},
): WorkflowStages {
  const registered = new Map<StageName, AnyStage>();
  for (const serverModule of modules) {
    for (const stage of serverModule.stages ?? []) {
      registered.set(stage.name, stage);
    }
  }
  const placeholders: StageName[] = [];
  const overridden: StageName[] = [];
  const stages = STAGE_ORDER.map((name) => {
    const override = overrides[name];
    if (override !== undefined) {
      overridden.push(name);
      return override;
    }
    const stage = registered.get(name);
    if (stage !== undefined) {
      return stage;
    }
    placeholders.push(name);
    return placeholderStage(name);
  });
  return { provider: () => stages, placeholders, overridden };
}
