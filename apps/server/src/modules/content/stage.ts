/**
 * Content stage (architecture.md sections 6 and 8; contracts/provider-ports.md sections 2 and 3; AD-10, AD-11).
 *
 * - `load` reads the facts of the run whose facts the draft uses (the run itself for a full run, its `base_run_id`
 *   for a redraft), their effective statuses, the teams' known name forms, the standings availability recorded by
 *   research for that run, the project's selection labels and language, the brand and display settings of the
 *   configuration, the format of the run's configuration snapshot, and the operator's exclusions: the run parameter
 *   `excludedMatchKeys` when the run sets them (OD-43, a redraft started by `setExcludedMatches`), else those of the
 *   project's active draft, else none. Nothing else is read: no source reference, attribution, import metadata or
 *   data mode reaches the stage input (T11H-F16).
 * - `run` drafts with the configured AI provider (`draftContent`); no database write.
 * - `persist` supersedes the project's active draft (its current versions and the final approvals of its carousels)
 *   and stores the new draft, its carousels, elements, first versions (`qa_status` pending) and fact references, in
 *   one transaction.
 */
import { randomUUID } from 'node:crypto';

import type { AppContainer } from '../../container.js';
import { RunRepository } from '../../workflow/index.js';
import type { Stage, StageContext } from '../module-kit.js';

import { draftContent } from './core.js';
import { ContentRepository, type NewDraft } from './repository.js';
import { type ContentInput, ContentInputSchema, type ContentOutput, ContentOutputSchema } from './schemas.js';

export interface ContentStageOptions {
  /** ID generator of drafts, carousels, elements and versions; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

/** What `buildContentInput` needs besides the stored facts. */
export interface ContentInputRequest {
  readonly projectId: string;
  readonly runId: string;
  readonly factsRunId: string;
  /** The draft language; the project's language when absent (R-236). */
  readonly language?: string;
  readonly excludedMatchKeys: readonly string[];
  readonly maxSlidesPerCarousel: number;
  readonly standingsRowsPerSlide: number;
}

/** Builds the (unvalidated) stage input from the database and the configuration. */
export function buildContentInput(
  container: Pick<AppContainer, 'db' | 'config'>,
  request: ContentInputRequest,
): Record<keyof ContentInput, unknown> {
  const repository = new ContentRepository(container.db);
  const labels = repository.projectLabels(request.projectId);
  if (labels === null) {
    throw new Error('the project of the run was not found');
  }
  const { config } = container;
  return {
    projectId: request.projectId,
    runId: request.runId,
    factsRunId: request.factsRunId,
    language: request.language ?? labels.language,
    competitionName: labels.competitionName,
    seasonLabel: labels.seasonLabel,
    stageLabel: labels.stageLabel,
    matchday: labels.matchday,
    contentKind: labels.contentKind,
    brand: { name: config.brand.name, handle: config.brand.handle },
    utcOffsetMinutes: config.display.utcOffsetMinutes,
    maxSlidesPerCarousel: request.maxSlidesPerCarousel,
    standingsRowsPerSlide: request.standingsRowsPerSlide,
    standings: repository.standingsAvailability(request.factsRunId),
    excludedMatchKeys: [...request.excludedMatchKeys],
    facts: repository.facts(request.factsRunId),
    teamAliases: repository.teamAliases(request.factsRunId),
  };
}

async function load(ctx: StageContext): Promise<ContentInput> {
  await Promise.resolve();
  const { db } = ctx.container;
  const runs = new RunRepository(db);
  const record = runs.record(ctx.runId);
  const snapshot = runs.snapshot(ctx.runId);
  if (record === null || snapshot === null) {
    throw new Error('the run was not found');
  }
  const factsRunId = ctx.runKind === 'redraft' ? record.baseRunId : ctx.runId;
  if (factsRunId === null) {
    throw new Error('the redraft has no base run');
  }
  const excludedMatchKeys =
    snapshot.parameters.excludedMatchKeys ?? new ContentRepository(db).activeDraftExclusions(ctx.projectId) ?? [];
  return ContentInputSchema.parse(
    buildContentInput(ctx.container, {
      projectId: ctx.projectId,
      runId: ctx.runId,
      factsRunId,
      excludedMatchKeys,
      maxSlidesPerCarousel: snapshot.format.maxSlidesPerCarousel,
      standingsRowsPerSlide: snapshot.standingsRowsPerSlide,
    }),
  );
}

async function run(input: ContentInput, ctx: StageContext): Promise<ContentOutput> {
  try {
    return await draftContent(input, ctx.container.aiProvider, ctx.signal);
  } catch (error) {
    if (ctx.signal.aborted) {
      // A cancelled run fails as `interrupted`, not with the provider error the cancellation caused.
      throw ctx.signal.reason ?? error;
    }
    throw error;
  }
}

/** Builds the content stage. */
export function createContentStage(options: ContentStageOptions = {}): Stage<ContentInput, ContentOutput> {
  const newId = options.newId ?? randomUUID;
  return {
    name: 'content',
    input: ContentInputSchema,
    output: ContentOutputSchema,
    load,
    run,
    async persist(output, ctx) {
      await Promise.resolve();
      if (output.projectId !== ctx.projectId) {
        throw new Error('the draft belongs to another project');
      }
      const { db, clock } = ctx.container;
      const repository = new ContentRepository(db);
      const at = clock.now().toISOString();
      const draft: NewDraft = {
        id: newId(),
        projectId: ctx.projectId,
        runId: ctx.runId,
        factsRunId: output.factsRunId,
        language: output.language,
        standingsIncluded: output.standingsIncluded,
        excludedMatchKeys: output.excludedMatchKeys,
        leftOutMatches: output.leftOutMatches,
        createdAt: at,
        aiAdapter: output.aiAdapter,
        carousels: output.carousels.map((carousel) => ({
          id: newId(),
          sequence: carousel.sequence,
          total: carousel.total,
          elements: carousel.elements.map((element) => ({ id: newId(), versionId: newId(), element })),
        })),
      };
      db.transaction(() => {
        repository.supersedeActiveDrafts(ctx.projectId, at);
        repository.insertDraft(draft);
      });
    },
  };
}

/** The content stage of the module registry. */
export const contentStage = createContentStage();
