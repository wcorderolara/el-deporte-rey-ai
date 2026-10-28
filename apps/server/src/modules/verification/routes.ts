/**
 * Facts routes (contract operations listFacts, approveFactManually, revokeManualFactApproval). Path parameters are
 * validated with the contract schemas (400 `VALIDATION_FAILED`); every success body is parsed with its contract schema
 * before it is sent, so a response never carries an undocumented field. GET only reads; PUT and DELETE take no body
 * and pass the platform guards (Host, origin, client header) unchanged. No route sets a fact status (R-412).
 */
import { FactListResponseSchema, FactParamsSchema, FactSchema, RunParamsSchema } from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import type { VerificationService } from './service.js';

/** A response that does not match its contract schema is a server defect (500 `INTERNAL`, fixed text). */
export class ContractResponseError extends Error {
  override readonly name = 'ContractResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

export function contractResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ContractResponseError();
  }
  return parsed.data;
}

export function registerFactRoutes(app: FastifyInstance, service: VerificationService): void {
  app.get('/projects/:projectId/runs/:runId/facts', async (request) => {
    const { projectId, runId } = RunParamsSchema.parse(request.params);
    return contractResponse(FactListResponseSchema, service.listFacts(projectId, runId));
  });

  app.put('/projects/:projectId/runs/:runId/facts/:factId/manual-approval', async (request) => {
    const { projectId, runId, factId } = FactParamsSchema.parse(request.params);
    return contractResponse(FactSchema, service.approve(projectId, runId, factId));
  });

  app.delete('/projects/:projectId/runs/:runId/facts/:factId/manual-approval', async (request) => {
    const { projectId, runId, factId } = FactParamsSchema.parse(request.params);
    return contractResponse(FactSchema, service.revoke(projectId, runId, factId));
  });
}
