/**
 * Projects service (architecture.md sections 6 and 15.2; contract operations createProject, listProjects,
 * getProject, updateProject, listRuns, startRun, getRun, setExcludedMatches).
 *
 * - Creation resolves the selection (competition, source, season, stage, matchday or whole stage) through the
 *   catalogue service and stores the source, the data mode, the opaque selection reference and the label snapshots
 *   (AD-21, AD-24; R-056, R-076, R-287). A refused selection is `SELECTION_UNAVAILABLE` with its `refusalReason`
 *   (R-243, R-286); an exhausted budget is `PROVIDER_RATE_LIMITED`; a transport failure of the source is
 *   `PROVIDER_FAILED`. The language defaults to the configured default, Spanish (R-236).
 * - DEMO_DATA projects report `demonstration: true` (OD-21, R-269).
 * - Every guard and the write it protects run in one `BEGIN IMMEDIATE` transaction (T10-F15).
 */
import type { Language, Project, ProjectCreate, ProjectSummary, Run } from '@edr/contracts';
import { randomUUID } from 'node:crypto';

import type { AppContainer } from '../../container.js';
import { stageDisplay } from '../../platform/format/index.js';
import { HttpProblem } from '../../platform/http/index.js';
import { type RunKind, RunStartRefused, type WorkflowRunner } from '../../workflow/index.js';

import { availabilityOf, catalogueOf, discoveryContext } from './catalog.js';
import { ContentBatchRepository } from './content-batches/repository.js';
import { projectSportsContext } from './content-batches/service.js';
import { type ProjectRecord, ProjectRepository } from './repository.js';

/** Longest project title (contract `ProjectSummaryFields.title`). */
export const MAX_TITLE_LENGTH = 200;

export function projectNotFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'The project does not exist.');
}

function runNotFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'The run does not exist for this project.');
}

function runInProgress(): HttpProblem {
  return new HttpProblem(409, 'RUN_IN_PROGRESS', 'A run of this project is in progress.');
}

/** The display title: competition, season and stage display (with the matchday in the project's language). */
export function projectTitle(project: ProjectRecord): string {
  const title = `${project.competitionName} ${project.seasonLabel} · ${stageDisplay(
    project.stageLabel,
    project.matchday,
    project.language,
  )}`;
  return title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH) : title;
}

export interface ProjectsServiceOptions {
  readonly container: AppContainer;
  readonly runner: WorkflowRunner;
  readonly newId?: () => string;
}

export class ProjectsService {
  readonly #container: AppContainer;
  readonly #runner: WorkflowRunner;
  readonly #projects: ProjectRepository;
  readonly #batches: ContentBatchRepository;
  readonly #newId: () => string;

  constructor(options: ProjectsServiceOptions) {
    this.#container = options.container;
    this.#runner = options.runner;
    this.#projects = new ProjectRepository(options.container.db);
    this.#batches = new ContentBatchRepository(options.container.db);
    this.#newId = options.newId ?? randomUUID;
  }

  #now(): string {
    return this.#container.clock.now().toISOString();
  }

  /** A configured language, or a validation problem when the configuration does not offer it. */
  #language(requested: Language | undefined): Language {
    const { languages } = this.#container.config;
    const language = requested ?? languages.defaultLanguage;
    if (!languages.languages.some((entry) => entry.code === language)) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'The request is invalid.', {
        errors: [{ path: '/language', message: 'is not an allowed value' }],
      });
    }
    return language;
  }

  /** The display title; a per-match piece of a content batch also names its match (PD-ARCH-01E-A). */
  #title(project: ProjectRecord): string {
    const title = projectTitle(project);
    const piece = projectSportsContext(this.#batches, project.id);
    if (piece === null || (piece.context.kind !== 'match_result' && piece.context.kind !== 'match_preview')) {
      return title;
    }
    const full = `${title} · ${piece.title}`;
    return full.length > MAX_TITLE_LENGTH ? full.slice(0, MAX_TITLE_LENGTH) : full;
  }

  #summary(project: ProjectRecord): ProjectSummary {
    const state = this.#projects.draftState(project.id);
    return {
      id: project.id,
      title: this.#title(project),
      competitionName: project.competitionName,
      seasonLabel: project.seasonLabel,
      stageLabel: project.stageLabel,
      matchday: project.matchday,
      sourceName: project.sourceName,
      dataMode: project.dataMode,
      demonstration: project.dataMode === 'DEMO_DATA',
      language: project.language,
      createdAt: project.createdAt,
      approvalState: state.approvalState,
      lastExportAt: state.lastExportAt,
      latestRunStatus: this.#runner.runs.latestView(project.id)?.status ?? null,
      sportsContext: projectSportsContext(this.#batches, project.id)?.context ?? null,
    };
  }

  #project(project: ProjectRecord): Project {
    return {
      ...this.#summary(project),
      competitionId: project.competitionId,
      sourceId: project.sourceId,
      seasonId: project.seasonId,
      stageId: project.stageId,
      latestRun: this.#runner.runs.latestView(project.id),
      activeDraftId: this.#projects.draftState(project.id).activeDraftId,
    };
  }

  /** Upserts the `sources` row of every configured source (startup). */
  syncSources(): void {
    const at = this.#now();
    this.#container.db.transaction(() => {
      for (const source of this.#container.config.providers.sports.sources) {
        this.#projects.upsertSource(source, at);
      }
    });
  }

  list(): ProjectSummary[] {
    return this.#projects.list().map((project) => this.#summary(project));
  }

  get(projectId: string): Project {
    const project = this.#projects.get(projectId);
    if (project === null) {
      throw projectNotFound();
    }
    return this.#project(project);
  }

  async create(request: ProjectCreate): Promise<Project> {
    const language = this.#language(request.language);
    const resolution = await catalogueOf(this.#container).resolveSelection(
      {
        competitionId: request.competitionId,
        sourceId: request.sourceId,
        seasonId: request.seasonId,
        stageId: request.stageId,
        matchday: request.matchday,
      },
      discoveryContext(),
    );
    if (!resolution.ok) {
      const availability = availabilityOf(resolution.availability);
      if (availability.reason === 'rate_limited') {
        throw new HttpProblem(503, 'PROVIDER_RATE_LIMITED', 'The request budget of the data source is exhausted.', {
          retryAfterSeconds: resolution.retryAfterSeconds,
        });
      }
      if (availability.reason === 'source_unavailable') {
        throw new HttpProblem(502, 'PROVIDER_FAILED', 'The data source could not be reached.');
      }
      throw new HttpProblem(409, 'SELECTION_UNAVAILABLE', 'The selection is not offered by the data source.', {
        refusalReason: resolution.reason,
      });
    }
    const { selection } = resolution;
    const source = this.#container.config.providers.sports.sources.find((entry) => entry.id === selection.sourceId);
    if (source === undefined) {
      throw new Error('the resolved source is not configured');
    }
    const id = this.#newId();
    const at = this.#now();
    this.#container.db.transaction(() => {
      this.#projects.upsertSource(source, at);
      this.#projects.insert({
        id,
        competitionId: selection.competitionId,
        competitionName: selection.competitionName,
        sourceId: selection.sourceId,
        dataMode: selection.mode,
        seasonId: selection.seasonId,
        seasonLabel: selection.seasonLabel,
        stageId: selection.stageId,
        stageLabel: selection.stageName,
        matchday: selection.matchday,
        selectionRef: selection.selectionRef,
        standingsExpected: selection.standingsExpected,
        language,
        createdAt: at,
      });
    });
    return this.get(id);
  }

  /**
   * Deletes a project logically (PD-ARCH-01F; OD-08 keeps every row): its runs executing in this process are cancelled
   * and must confirm their stop before the tombstone is written, so no stage writes on a deleted project; then every
   * read of the application excludes it. A deleted project answers as deleted again (idempotent); an unknown ID is
   * `NOT_FOUND`; a run that does not confirm its cancellation in time is `RUN_IN_PROGRESS` and nothing changes.
   * Shared resources (competitions, seasons, teams, matches, results, templates, brand assets, other projects) and
   * the project's own history and files are not touched.
   */
  async delete(projectId: string): Promise<void> {
    const deletedAt = this.#projects.deletedAt(projectId);
    if (deletedAt === undefined) {
      throw projectNotFound();
    }
    if (deletedAt !== null) {
      return;
    }
    if (!(await this.#runner.cancelProject(projectId))) {
      throw new HttpProblem(409, 'RUN_IN_PROGRESS', 'The run of the project has not confirmed its cancellation yet.');
    }
    const at = this.#now();
    this.#container.db.transaction(() => {
      if (this.#runner.runs.activeRunId(projectId) !== null) {
        throw runInProgress();
      }
      this.#projects.markDeleted(projectId, at);
    });
    this.#container.logger.info({ projectId }, 'project deleted');
  }

  /** Changes the content language; the active draft is superseded (a redraft is needed). Refused during a run. */
  updateLanguage(projectId: string, requested: Language): Project {
    const language = this.#language(requested);
    this.#container.db.transaction(() => {
      const project = this.#projects.get(projectId);
      if (project === null) {
        throw projectNotFound();
      }
      if (this.#runner.runs.activeRunId(projectId) !== null) {
        throw runInProgress();
      }
      if (project.language !== language) {
        const at = this.#now();
        this.#projects.updateLanguage(projectId, language, at);
        this.#projects.supersedeActiveDraft(projectId, at);
      }
    });
    return this.get(projectId);
  }

  listRuns(projectId: string): Run[] {
    if (!this.#projects.exists(projectId)) {
      throw projectNotFound();
    }
    return this.#runner.runs.listViews(projectId);
  }

  getRun(projectId: string, runId: string): Run {
    if (!this.#projects.exists(projectId)) {
      throw projectNotFound();
    }
    const run = this.#runner.runs.viewOfProject(projectId, runId);
    if (run === null) {
      throw runNotFound();
    }
    return run;
  }

  startRun(projectId: string, kind: RunKind): Run {
    return this.#start(projectId, kind, null);
  }

  /** Sets the matches to leave out: supersedes the active draft and starts a redraft run with them (OD-03). */
  setExcludedMatches(projectId: string, excludedMatchKeys: readonly string[]): Run {
    return this.#start(projectId, 'redraft', [...excludedMatchKeys]);
  }

  #start(projectId: string, kind: RunKind, excludedMatchKeys: string[] | null): Run {
    try {
      return this.#runner.start(projectId, kind, {
        parameters: { excludedMatchKeys },
        before: () => {
          if (!this.#projects.exists(projectId)) {
            throw projectNotFound();
          }
        },
        afterGuards: () => {
          if (excludedMatchKeys !== null) {
            this.#projects.supersedeActiveDraft(projectId, this.#now());
          }
        },
      });
    } catch (error) {
      if (error instanceof RunStartRefused) {
        throw error.reason === 'run_in_progress'
          ? runInProgress()
          : new HttpProblem(409, 'NO_VERIFIED_RUN', 'No completed verification exists for a redraft.');
      }
      throw error;
    }
  }
}
