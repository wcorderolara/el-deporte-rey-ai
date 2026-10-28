/**
 * Operations of the HTTP contract used by the projects feature (`contracts/http-api.openapi.yaml` 1.0.0, tags
 * catalog, projects and runs). Paths come from the contract's operation registry in `@edr/contracts`, and every
 * successful response is validated with the contract schema by the API client; nothing here adds an operation or a
 * response field.
 */
import {
  CatalogueSchema,
  operations,
  ProjectListResponseSchema,
  ProjectSchema,
  RunSchema,
  SeasonListSchema,
  StageListSchema,
  type Catalogue,
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
  };
}

/** Projects API of the running application (same-origin client of `api/client.ts`). */
export const defaultProjectsApi: ProjectsApi = createProjectsApi(apiClient);
