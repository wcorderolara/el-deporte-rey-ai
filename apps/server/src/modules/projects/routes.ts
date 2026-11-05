/**
 * Project, run and exclusion routes (contract operations listProjects, createProject, getProject, deleteProject, updateProject,
 * listRuns, startRun, getRun, setExcludedMatches). Parameters and bodies are validated with the contract schemas
 * (400 `VALIDATION_FAILED` with closed pointers); responses are checked against their contract schemas. The platform
 * guards (Host, Sec-Fetch-Site, client header and Origin, media type, body limit) apply unchanged: no route raises
 * its body limit or declares a media-type exception. GET handlers only read.
 */
import {
  ExcludedMatchesUpdateSchema,
  ProjectCreateSchema,
  ProjectListResponseSchema,
  ProjectParamsSchema,
  ProjectSchema,
  ProjectUpdateSchema,
  RunListResponseSchema,
  RunParamsSchema,
  RunSchema,
  RunStartSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';

import { contractResponse } from './respond.js';
import type { ProjectsService } from './service.js';

export function registerProjectRoutes(app: FastifyInstance, service: ProjectsService): void {
  app.get('/projects', async () => contractResponse(ProjectListResponseSchema, { projects: service.list() }));

  app.post('/projects', async (request, reply) => {
    const body = ProjectCreateSchema.parse(request.body);
    const project = await service.create(body);
    return reply.code(201).send(contractResponse(ProjectSchema, project));
  });

  app.get('/projects/:projectId', async (request) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    return contractResponse(ProjectSchema, service.get(projectId));
  });

  app.delete('/projects/:projectId', async (request, reply) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    await service.delete(projectId);
    return reply.code(204).send();
  });

  app.patch('/projects/:projectId', async (request) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    const body = ProjectUpdateSchema.parse(request.body);
    return contractResponse(ProjectSchema, service.updateLanguage(projectId, body.language));
  });

  app.get('/projects/:projectId/runs', async (request) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    return contractResponse(RunListResponseSchema, { runs: service.listRuns(projectId) });
  });

  app.post('/projects/:projectId/runs', async (request, reply) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    const body = RunStartSchema.parse(request.body);
    return reply.code(202).send(contractResponse(RunSchema, service.startRun(projectId, body.kind)));
  });

  app.get('/projects/:projectId/runs/:runId', async (request) => {
    const { projectId, runId } = RunParamsSchema.parse(request.params);
    return contractResponse(RunSchema, service.getRun(projectId, runId));
  });

  app.put('/projects/:projectId/draft/exclusions', async (request, reply) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    const body = ExcludedMatchesUpdateSchema.parse(request.body);
    const run = service.setExcludedMatches(projectId, body.excludedMatchKeys);
    return reply.code(202).send(contractResponse(RunSchema, run));
  });
}
