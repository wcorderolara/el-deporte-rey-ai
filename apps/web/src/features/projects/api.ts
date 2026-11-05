/**
 * Operations of the HTTP contract used by the projects feature (`contracts/http-api.openapi.yaml` 1.0.0, tags
 * catalog, projects and runs). Paths come from the contract's operation registry in `@edr/contracts`, and every
 * successful response is validated with the contract schema by the API client; nothing here adds an operation or a
 * response field.
 */
import {
  CatalogueSchema,
  CompetitionMatchListResponseSchema,
  CompetitionRoundListResponseSchema,
  CompetitionStageListResponseSchema,
  ContentBatchPreviewSchema,
  ContentBatchSchema,
  ManagedCompetitionListResponseSchema,
  ManagedSeasonListResponseSchema,
  operations,
  ProjectListResponseSchema,
  ProjectSchema,
  RunSchema,
  SeasonListSchema,
  StageListSchema,
  type Catalogue,
  type CompetitionMatch,
  type CompetitionRound,
  type CompetitionStage,
  type ContentBatch,
  type ContentBatchCreate,
  type ContentBatchPreview,
  type ContentBatchSelection,
  type ManagedCompetition,
  type ManagedSeason,
  type OperationId,
  type Project,
  type ProjectCreate,
  type ProjectSummary,
  type ProjectUpdate,
  type Run,
  type RunStart,
  type SeasonList,
  type StageList,
} from '@edr/contracts';

import { apiClient, type ApiClient } from '../../api/client';

export interface ProjectsApi {
  /** listProjects: project list and history, newest first. */
  listProjects(signal?: AbortSignal): Promise<ProjectSummary[]>;
  /** createProject: create a project from a catalogue selection. */
  createProject(body: ProjectCreate): Promise<Project>;
  /** getProject. */
  getProject(projectId: string, signal?: AbortSignal): Promise<Project>;
  /** deleteProject: logical deletion of a project in any state (PD-ARCH-01F). */
  deleteProject(projectId: string): Promise<void>;
  /** updateProject: change the content language. */
  updateProject(projectId: string, body: ProjectUpdate): Promise<Project>;
  /** startRun: start a full run or a redraft. */
  startRun(projectId: string, body: RunStart): Promise<Run>;
  /** getRun: run with per-stage status, polled while the run is active. */
  getRun(projectId: string, runId: string, signal?: AbortSignal): Promise<Run>;
  /** listCompetitions: dynamic catalogue with sources, availability and listing provenance. */
  listCompetitions(signal?: AbortSignal): Promise<Catalogue>;
  /** listSeasons: seasons the chosen source reports for the competition. */
  listSeasons(competitionId: string, sourceId: string, signal?: AbortSignal): Promise<SeasonList>;
  /** listStages: stages of the season by the source's names, with matchdays and standings expectation. */
  listStages(competitionId: string, sourceId: string, seasonId: string, signal?: AbortSignal): Promise<StageList>;
  /** listManagedCompetitions: locally managed competitions (content batches, PD-ARCH-01E-A). */
  listLocalCompetitions(signal?: AbortSignal): Promise<ManagedCompetition[]>;
  /** listManagedSeasons. */
  listLocalSeasons(competitionId: string, signal?: AbortSignal): Promise<ManagedSeason[]>;
  /** listCompetitionStages. */
  listLocalStages(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<CompetitionStage[]>;
  /** listSeasonRounds and listStageRounds: every round of the season, direct and staged. */
  listLocalRounds(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<CompetitionRound[]>;
  /** listCompetitionMatches: the season's matches with their current local values. */
  listLocalMatches(competitionId: string, seasonId: string, signal?: AbortSignal): Promise<CompetitionMatch[]>;
  /** previewContentBatch: read-only plan of a selection. */
  previewContentBatch(body: ContentBatchSelection, signal?: AbortSignal): Promise<ContentBatchPreview>;
  /** createContentBatch: confirms a selection; a retry with the same request key returns the same batch. */
  createContentBatch(body: ContentBatchCreate): Promise<ContentBatch>;
  /** getContentBatch: real state of every piece, polled while pieces are pending. */
  getContentBatch(batchId: string, signal?: AbortSignal): Promise<ContentBatch>;
}

/** Builds the path of a contract operation, encoding every path parameter. */
export function operationPath(id: OperationId, params: Record<string, string> = {}): string {
  return operations[id].path.replace(/\{([A-Za-z]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new TypeError(`Missing path parameter ${name}`);
    }
    return encodeURIComponent(value);
  });
}

function withSignal(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

/** Projects API on top of the shared client (which adds `X-EDR-Client` to the mutating requests). */
export function createProjectsApi(client: ApiClient): ProjectsApi {
  const listLocalStages = async (competitionId: string, seasonId: string, signal?: AbortSignal) => {
    const body = await client.get(operationPath('listCompetitionStages', { competitionId, seasonId }), {
      schema: CompetitionStageListResponseSchema,
      ...withSignal(signal),
    });
    return body.stages;
  };
  return {
    async listProjects(signal) {
      const body = await client.get(operationPath('listProjects'), {
        schema: ProjectListResponseSchema,
        ...withSignal(signal),
      });
      return body.projects;
    },
    createProject(body) {
      return client.post(operationPath('createProject'), body, { schema: ProjectSchema });
    },
    async deleteProject(projectId) {
      await client.delete(operationPath('deleteProject', { projectId }));
    },
    getProject(projectId, signal) {
      return client.get(operationPath('getProject', { projectId }), { schema: ProjectSchema, ...withSignal(signal) });
    },
    updateProject(projectId, body) {
      return client.patch(operationPath('updateProject', { projectId }), body, { schema: ProjectSchema });
    },
    startRun(projectId, body) {
      return client.post(operationPath('startRun', { projectId }), body, { schema: RunSchema });
    },
    getRun(projectId, runId, signal) {
      return client.get(operationPath('getRun', { projectId, runId }), { schema: RunSchema, ...withSignal(signal) });
    },
    listCompetitions(signal) {
      return client.get(operationPath('listCompetitions'), { schema: CatalogueSchema, ...withSignal(signal) });
    },
    listSeasons(competitionId, sourceId, signal) {
      return client.get(operationPath('listSeasons', { competitionId, sourceId }), {
        schema: SeasonListSchema,
        ...withSignal(signal),
      });
    },
    listStages(competitionId, sourceId, seasonId, signal) {
      return client.get(operationPath('listStages', { competitionId, sourceId, seasonId }), {
        schema: StageListSchema,
        ...withSignal(signal),
      });
    },
    async listLocalCompetitions(signal) {
      const body = await client.get(operationPath('listManagedCompetitions'), {
        schema: ManagedCompetitionListResponseSchema,
        ...withSignal(signal),
      });
      return body.competitions;
    },
    async listLocalSeasons(competitionId, signal) {
      const body = await client.get(operationPath('listManagedSeasons', { competitionId }), {
        schema: ManagedSeasonListResponseSchema,
        ...withSignal(signal),
      });
      return body.seasons;
    },
    listLocalStages,
    async listLocalRounds(competitionId, seasonId, signal) {
      const direct = await client.get(operationPath('listSeasonRounds', { competitionId, seasonId }), {
        schema: CompetitionRoundListResponseSchema,
        ...withSignal(signal),
      });
      const stages = await listLocalStages(competitionId, seasonId, signal);
      const staged = await Promise.all(
        stages.map((stage) =>
          client.get(operationPath('listStageRounds', { competitionId, seasonId, stageId: stage.id }), {
            schema: CompetitionRoundListResponseSchema,
            ...withSignal(signal),
          }),
        ),
      );
      const all = [...direct.rounds, ...staged.flatMap((list) => list.rounds)];
      return all.filter((round, index) => all.findIndex((other) => other.id === round.id) === index);
    },
    async listLocalMatches(competitionId, seasonId, signal) {
      const body = await client.get(operationPath('listCompetitionMatches', { competitionId, seasonId }), {
        schema: CompetitionMatchListResponseSchema,
        ...withSignal(signal),
      });
      return body.matches;
    },
    previewContentBatch(body, signal) {
      return client.post(operationPath('previewContentBatch'), body, {
        schema: ContentBatchPreviewSchema,
        ...withSignal(signal),
      });
    },
    createContentBatch(body) {
      return client.post(operationPath('createContentBatch'), body, { schema: ContentBatchSchema });
    },
    getContentBatch(batchId, signal) {
      return client.get(operationPath('getContentBatch', { batchId }), {
        schema: ContentBatchSchema,
        ...withSignal(signal),
      });
    },
  };
}

/** Projects API of the running application (same-origin client of `api/client.ts`). */
export const defaultProjectsApi: ProjectsApi = createProjectsApi(apiClient);
