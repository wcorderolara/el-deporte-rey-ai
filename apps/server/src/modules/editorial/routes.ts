/**
 * Routes of the editorial copy (PD-ARCH-01H; contract operations getEditorialPackage, createEditorialGeneration,
 * editEditorialDeliverable, approveEditorialDeliverable, withdrawEditorialApproval). Bodies and parameters are parsed
 * with the contract schemas; every answer is checked against its contract schema before it is sent.
 */
import {
  EditorialDeliverableParamsSchema,
  EditorialEditCreateSchema,
  EditorialGenerationCreateSchema,
  EditorialGenerationResultSchema,
  EditorialPackageSchema,
  EditorialVersionSchema,
  ProjectParamsSchema,
  VersionRefSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import type { EditorialService } from './service.js';

/** A response that does not match its contract schema is a server defect (500 `INTERNAL`, fixed text). */
export class EditorialResponseError extends Error {
  override readonly name = 'EditorialResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

function contractResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new EditorialResponseError();
  }
  return parsed.data;
}

export function registerEditorialRoutes(app: FastifyInstance, service: EditorialService): void {
  app.get('/projects/:projectId/editorial', async (request) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    return contractResponse(EditorialPackageSchema, service.package(projectId));
  });

  app.post('/projects/:projectId/editorial/generations', async (request, reply) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    const body = EditorialGenerationCreateSchema.parse(request.body);
    const result = await service.generate(projectId, body);
    return reply.code(201).send(contractResponse(EditorialGenerationResultSchema, result));
  });

  app.post('/projects/:projectId/editorial/deliverables/:deliverable/edits', async (request, reply) => {
    const { projectId, deliverable } = EditorialDeliverableParamsSchema.parse(request.params);
    const body = EditorialEditCreateSchema.parse(request.body);
    return reply.code(201).send(contractResponse(EditorialVersionSchema, service.edit(projectId, deliverable, body)));
  });

  app.put('/projects/:projectId/editorial/deliverables/:deliverable/approval', async (request) => {
    const { projectId, deliverable } = EditorialDeliverableParamsSchema.parse(request.params);
    const { versionId } = VersionRefSchema.parse(request.body);
    return contractResponse(EditorialVersionSchema, service.approve(projectId, deliverable, versionId));
  });

  app.delete('/projects/:projectId/editorial/deliverables/:deliverable/approval', async (request) => {
    const { projectId, deliverable } = EditorialDeliverableParamsSchema.parse(request.params);
    return contractResponse(EditorialVersionSchema, service.withdraw(projectId, deliverable));
  });
}
