/**
 * Research stage (architecture.md sections 6 and 15; contracts/provider-ports.md sections 1.2 and 3; AD-34).
 *
 * - `load` reads the project's chosen source, its data mode and the opaque selection reference (AD-21, AD-24).
 * - `run` asks the project's source for the selection through the source registry only (`container.sources`), with
 *   purpose `research`; it never imports an adapter and has no branch on a data mode, provider or competition
 *   (R-118, R-268). The snapshot is validated again with the shared domain schema (R-224) and handed to the pure
 *   core. A source failure becomes a refused output with the closed failure (T10-F10); no database write happens here.
 * - `persist` writes, in one transaction, the `retrievals` row and, for a retrieved selection, every observation and
 *   the standings availability of the run. For a refused selection it records the failed retrieval (AD-34) and then
 *   fails the stage with the same closed code (`access_refused`, `not_available`, `rate_limited`, `unavailable`,
 *   `timeout`, `invalid`, `no_data`, `bad_request`), so later stages are skipped (R-203).
 */
import { randomUUID } from 'node:crypto';

import { asSourceRef, SourceError, validateSelectionSnapshot } from '../../providers/sports/index.js';
import { StageFailure, failureOf } from '../../workflow/index.js';
import type { Stage, StageContext } from '../module-kit.js';

import {
  type ResearchInput,
  ResearchInputSchema,
  type ResearchOutput,
  ResearchOutputSchema,
  refusedResearch,
  researchSnapshot,
} from './core.js';
import { ResearchRepository } from './repository.js';

export interface ResearchStageOptions {
  /** ID generator of retrievals and observations; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

/**
 * Reads the project's selection, validated with the input schema (a stored value that does not match fails the
 * stage as `invalid`); a missing project fails it as `internal`.
 */
async function load(ctx: StageContext): Promise<ResearchInput> {
  await Promise.resolve();
  const selection = new ResearchRepository(ctx.container.db).projectSelection(ctx.projectId);
  if (selection === null) {
    throw new Error('the project of the run was not found');
  }
  return ResearchInputSchema.parse(selection);
}

/** Retrieves the selection from the project's source and builds the observations (no database write). */
async function run(input: ResearchInput, ctx: StageContext): Promise<ResearchOutput> {
  const { sources, clock, logger } = ctx.container;
  const source = sources.get(input.sourceId);
  if (source === undefined) {
    // The chosen source is no longer configured or enabled: no retrieval is attempted.
    throw new StageFailure('unavailable', { sourceId: input.sourceId });
  }
  if (source.descriptor.mode !== input.dataMode) {
    // The project records the source and mode it was created with (R-287); a reconfigured mode is refused.
    throw new StageFailure('invalid', { sourceId: input.sourceId, path: '/dataMode' });
  }
  const attemptedAt = clock.now().toISOString();
  try {
    const raw: unknown = await source.fetchSelection(asSourceRef(input.selectionRef), {
      signal: ctx.signal,
      purpose: 'research',
    });
    const snapshot = validateSelectionSnapshot(raw, source.descriptor, logger);
    const output = researchSnapshot(snapshot);
    logger.debug(
      {
        runId: ctx.runId,
        sourceId: input.sourceId,
        observations: output.observations.length,
        fromCache: output.retrieval.fromCache,
      },
      'research retrieved the selection',
    );
    return output;
  } catch (error) {
    if (ctx.signal.aborted) {
      // A cancelled run fails as `interrupted`, not with the source error the cancellation caused.
      throw ctx.signal.reason ?? error;
    }
    if (!(error instanceof SourceError)) {
      throw error;
    }
    return refusedResearch({
      sourceId: input.sourceId,
      dataMode: source.descriptor.mode,
      attemptedAt,
      failure: failureOf(error),
    });
  }
}

/** Builds the research stage. */
export function createResearchStage(options: ResearchStageOptions = {}): Stage<ResearchInput, ResearchOutput> {
  const newId = options.newId ?? randomUUID;
  return {
    name: 'research',
    input: ResearchInputSchema,
    output: ResearchOutputSchema,
    load,
    run,
    async persist(output, ctx) {
      await Promise.resolve();
      const { db } = ctx.container;
      const repository = new ResearchRepository(db);
      db.transaction(() => {
        const retrievalId = newId();
        repository.insertRetrieval(retrievalId, ctx.runId, output.retrieval);
        if (output.status === 'retrieved') {
          for (const observation of output.observations) {
            repository.insertObservation(newId(), ctx.runId, retrievalId, observation);
          }
          repository.setStandingsAvailability(ctx.runId, output.standings);
        }
      });
      if (output.status === 'refused') {
        throw new StageFailure(output.failure.code, output.failure);
      }
    },
  };
}

/** The research stage of the module registry. */
export const researchStage = createResearchStage();
