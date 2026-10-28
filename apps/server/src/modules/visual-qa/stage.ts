/**
 * Visual QA stage (architecture.md sections 6 and 10; contracts/provider-ports.md section 3; AD-12; OD-09).
 *
 * - `load` reads the draft the content stage produced in this run, its current element versions still pending QA
 *   (every rendered slide and the caption) with their stored text and render model, the PNG size of each slide from
 *   the header of its stored file (read through the rendering module's hash-checked `readSlideImage`), the templates
 *   of the carousels' rendered slides, the facts of the draft's facts run and the known name forms of their teams
 *   re-read from the database (content module repository), the project's selection labels, and the configured
 *   format, palette, font roles and brand terms. A run without a draft fails with `no_data`.
 * - `run` is the pure core (`runVisualQa`): one result per version and check, and the version's `qa_status`.
 * - `persist` records every result and `qa_status` in one transaction. A version checked or superseded in the
 *   meantime fails the stage with `run_superseded` and nothing is recorded.
 *
 * The checks run and stored are those the `qa_results.check_name` constraint accepts (`storableChecks`): every
 * contract check, `capitalized_tokens` included, since migration 0002 (OD-56). A contract check the constraint does
 * not accept is logged (check name and run ID, no text) and neither run nor stored.
 *
 * QA findings are results, not stage failures: a slide that fails a blocking check stays blocked until a regenerated
 * version passes (OD-09); a warning is acknowledged by the operator (review module, T37).
 *
 * `qaElementVersion` checks one element version the same way (regeneration of one element, T37).
 */
import { randomUUID } from 'node:crypto';

import { QA_CHECKS, UuidSchema } from '@edr/contracts';

import type { AppContainer } from '../../container.js';
import { StageFailure } from '../../workflow/index.js';
import { ContentRepository } from '../content/index.js';
import type { Stage, StageContext } from '../module-kit.js';
import { type FontSet, fontSetFor, loadBundledFaces, pngSize, readSlideImage } from '../rendering/index.js';

import { checkVersion, qaContext, runVisualQa } from './core.js';
import { type StoredVersion, VisualQaRepository } from './repository.js';
import {
  type CarouselTemplate,
  type VersionResult,
  type VisualQaInput,
  VisualQaInputSchema,
  type VisualQaOutput,
  VisualQaOutputSchema,
} from './schemas.js';

export interface VisualQaOptions {
  /** Font set factory; default the bundled faces with the configured brand font roles (the faces rendering uses). */
  readonly fonts?: (container: AppContainer) => FontSet;
  /** ID generator of the result rows; default `crypto.randomUUID`. */
  readonly newId?: () => string;
}

interface ResolvedOptions {
  readonly fonts: (container: AppContainer) => FontSet;
  readonly newId: () => string;
}

function resolveOptions(options: VisualQaOptions): ResolvedOptions {
  return {
    fonts: options.fonts ?? ((container) => fontSetFor(container.config.brand.fonts, loadBundledFaces())),
    newId: options.newId ?? randomUUID,
  };
}

/** The PNG size of a slide version from its file header; null when the file is missing, altered or not a PNG. */
async function imageSize(
  container: AppContainer,
  versionId: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const png = await readSlideImage(container, versionId);
    return png === null ? null : pngSize(png);
  } catch {
    // A missing, unreadable or hash-mismatched file cannot be shown to have the configured size (dimensions fails).
    return null;
  }
}

/** Builds the (unvalidated) stage input from the database, the files and the configuration. */
async function buildInput(
  container: AppContainer,
  request: {
    readonly projectId: string;
    readonly factsRunId: string;
    readonly language: string;
    readonly versions: readonly StoredVersion[];
    readonly carouselTemplates: readonly CarouselTemplate[];
  },
): Promise<Record<keyof VisualQaInput, unknown>> {
  const content = new ContentRepository(container.db);
  const labels = content.projectLabels(request.projectId);
  if (labels === null) {
    throw new StageFailure('no_data');
  }
  const { config } = container;
  const versions = [];
  for (const version of request.versions) {
    versions.push({
      ...version,
      image: version.kind === 'slide' ? await imageSize(container, version.versionId) : null,
    });
  }
  return {
    projectId: request.projectId,
    language: request.language,
    settings: {
      width: config.format.width,
      height: config.format.height,
      utcOffsetMinutes: config.display.utcOffsetMinutes,
      palette: { ...config.brand.palette },
      fonts: {
        heading: { ...config.brand.fonts.heading },
        body: { ...config.brand.fonts.body },
        numeric: { ...config.brand.fonts.numeric },
      },
      brand: { name: config.brand.name, handle: config.brand.handle, mascotName: config.brand.mascotName },
    },
    labels: {
      competitionName: labels.competitionName,
      seasonLabel: labels.seasonLabel,
      stageLabel: labels.stageLabel,
    },
    facts: content.facts(request.factsRunId),
    teamAliases: content.teamAliases(request.factsRunId),
    checks: new VisualQaRepository(container.db).storableChecks(),
    carouselTemplates: [...request.carouselTemplates],
    versions,
  };
}

/** Records the results; throws `run_superseded` when a version cannot be recorded. */
function persistResults(container: AppContainer, output: VisualQaOutput, newId: () => string): void {
  const refused = new VisualQaRepository(container.db).saveResults(
    output.versions,
    newId,
    container.clock.now().toISOString(),
  );
  if (refused.length > 0) {
    throw new StageFailure('run_superseded');
  }
}

/**
 * Logs (without any text) every contract check that is not stored because the schema does not accept its name. None
 * after migration 0002; it guards a contract check added before the migration that lists it.
 */
function logUnstoredChecks(container: AppContainer, input: VisualQaInput, runId: string | null): void {
  for (const check of QA_CHECKS) {
    if (!input.checks.includes(check)) {
      container.logger.warn(
        { runId, check },
        'visual QA check not stored: the qa_results check_name constraint does not accept it',
      );
    }
  }
}

/** The visual QA stage with the given options. */
export function createVisualQaStage(options: VisualQaOptions = {}): Stage<VisualQaInput, VisualQaOutput> {
  const resolved = resolveOptions(options);
  return {
    name: 'visual_qa',
    input: VisualQaInputSchema,
    output: VisualQaOutputSchema,

    async load(ctx: StageContext): Promise<VisualQaInput> {
      const repository = new VisualQaRepository(ctx.container.db);
      const draft = repository.draftOfRun(ctx.projectId, ctx.runId);
      if (draft === null) {
        throw new StageFailure('no_data');
      }
      const input = VisualQaInputSchema.parse(
        await buildInput(ctx.container, {
          projectId: ctx.projectId,
          factsRunId: draft.factsRunId,
          language: draft.language,
          versions: repository.versionsOfDraft(draft.id),
          carouselTemplates: repository.templatesOfDraft(draft.id),
        }),
      );
      logUnstoredChecks(ctx.container, input, ctx.runId);
      return input;
    },

    async run(input: VisualQaInput, ctx: StageContext): Promise<VisualQaOutput> {
      await Promise.resolve();
      if (ctx.signal.aborted) {
        throw new StageFailure('interrupted');
      }
      return runVisualQa(input, resolved.fonts(ctx.container));
    },

    async persist(output: VisualQaOutput, ctx: StageContext): Promise<void> {
      await Promise.resolve();
      if (output.projectId !== ctx.projectId) {
        throw new Error('the QA results belong to another project');
      }
      persistResults(ctx.container, output, resolved.newId);
    },
  };
}

/** The visual QA stage of the static registry. */
export const visualQaStage = createVisualQaStage() as unknown as Stage<unknown, unknown>;

/** Why a single element version cannot be checked. */
export type QaVersionRefusal = 'not_found' | 'not_current' | 'not_rendered' | 'already_checked';

export class QaVersionRefused extends Error {
  override readonly name = 'QaVersionRefused';
  readonly reason: QaVersionRefusal;

  constructor(reason: QaVersionRefusal) {
    super(`element version cannot be checked: ${reason}`);
    this.reason = reason;
  }
}

/**
 * Checks one element version (the regeneration of one element, T37, after `renderElementVersion`): the version must
 * be the current, non-superseded version of its element, still pending QA, and rendered when it is a slide. The
 * results and `qa_status` are recorded as by the stage; a version checked or superseded in the meantime fails with
 * the `run_superseded` stage failure.
 */
export async function qaElementVersion(
  container: AppContainer,
  versionId: string,
  options: VisualQaOptions = {},
): Promise<VersionResult> {
  const resolved = resolveOptions(options);
  const repository = new VisualQaRepository(container.db);
  const version = UuidSchema.safeParse(versionId).success ? repository.version(versionId) : null;
  if (version === null) {
    throw new QaVersionRefused('not_found');
  }
  if (!version.current || version.superseded) {
    throw new QaVersionRefused('not_current');
  }
  if (version.qaStatus !== 'pending') {
    throw new QaVersionRefused('already_checked');
  }
  if (version.kind === 'slide' && version.renderModel === null) {
    throw new QaVersionRefused('not_rendered');
  }
  const input = VisualQaInputSchema.parse(
    await buildInput(container, {
      projectId: version.projectId,
      factsRunId: version.factsRunId,
      language: version.language,
      versions: [version].map(
        ({ versionId: id, elementId, carouselId, kind, slideType, text, renderModel }): StoredVersion => ({
          versionId: id,
          elementId,
          carouselId,
          kind,
          slideType,
          text,
          renderModel,
        }),
      ),
      carouselTemplates: repository.templatesOfCarousel(version.carouselId),
    }),
  );
  logUnstoredChecks(container, input, null);
  const [checked] = input.versions;
  if (checked === undefined) {
    throw new QaVersionRefused('not_found');
  }
  const result = checkVersion(checked, qaContext(input, resolved.fonts(container)), new Set(input.checks));
  persistResults(container, { projectId: input.projectId, versions: [result] }, resolved.newId);
  return result;
}
