/**
 * Design proposal routes (PD-ARCH-01G-B; contract operations getDesignCapabilities, checkDesignModelAccess,
 * estimateDesignGeneration, createDesignGeneration, getDesignGeneration, streamDesignGenerationEvents,
 * listDesignProposals, getDesignProposal, deleteDesignProposal, getDesignProposalFile, getDesignProposalBackground,
 * decideDesignProposal).
 *
 * - Parameters and JSON bodies are validated with the contract schemas; success bodies are checked against their
 *   contract schemas before they are sent. GET handlers only read; only `createDesignGeneration` can cost money, and
 *   only with `confirmCost: true`.
 * - Proposal files are served after a database lookup and a hash check, with the stored MIME type, a sandboxed CSP,
 *   `no-store` and a server-generated file name, as brand files are.
 */
import {
  DesignCapabilitiesSchema,
  DesignEstimateSchema,
  DesignGenerationCreateSchema,
  DesignGenerationEventSchema,
  DesignGenerationInputSchema,
  DesignGenerationParamsSchema,
  DesignGenerationSchema,
  DesignGenerationStartSchema,
  DesignModelAccessCheckSchema,
  DesignModelAccessSchema,
  DesignProposalDecisionInputSchema,
  DesignProposalDetailSchema,
  DesignProposalListSchema,
  DesignProposalParamsSchema,
  DesignProposalSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';

import { SANDBOXED_FILE_CONTENT_SECURITY_POLICY, streamEvents } from '../../platform/http/index.js';
import { contractResponse } from '../projects/respond.js';

import type { DesignService } from './service.js';

export function registerDesignRoutes(app: FastifyInstance, service: DesignService): void {
  app.get('/design/capabilities', async () => contractResponse(DesignCapabilitiesSchema, service.capabilities()));

  app.post('/design/capabilities/check', async (request) => {
    const body = DesignModelAccessCheckSchema.parse(request.body);
    return contractResponse(DesignModelAccessSchema, await service.checkModelAccess(body.model));
  });

  app.post('/design/estimates', async (request) => {
    const body = DesignGenerationInputSchema.parse(request.body);
    return contractResponse(DesignEstimateSchema, service.estimate(body));
  });

  app.post('/design/generations', async (request, reply) => {
    const body = DesignGenerationCreateSchema.parse(request.body);
    const { generation } = service.create(body);
    const base = `/api/v1/design/generations/${generation.id}`;
    return reply
      .code(202)
      .send(
        contractResponse(DesignGenerationStartSchema, { generation, statusUrl: base, eventsUrl: `${base}/events` }),
      );
  });

  app.get('/design/generations/:generationId', async (request) => {
    const { generationId } = DesignGenerationParamsSchema.parse(request.params);
    return contractResponse(DesignGenerationSchema, service.generation(generationId));
  });

  app.get('/design/generations/:generationId/events', async (request, reply) => {
    const { generationId } = DesignGenerationParamsSchema.parse(request.params);
    service.generation(generationId);
    streamEvents(request, reply, {
      eventsSince: (after) => service.eventsSince(generationId, after),
      status: () => service.generation(generationId).status,
      subscribe: (listener) => service.subscribe(generationId, listener),
      schema: DesignGenerationEventSchema,
    });
  });

  app.get('/design/proposals', async () =>
    contractResponse(DesignProposalListSchema, { proposals: service.proposals() }),
  );

  app.get('/design/proposals/:proposalId', async (request) => {
    const { proposalId } = DesignProposalParamsSchema.parse(request.params);
    return contractResponse(DesignProposalDetailSchema, service.proposalDetail(proposalId));
  });

  app.post('/design/proposals/:proposalId/decisions', async (request) => {
    const { proposalId } = DesignProposalParamsSchema.parse(request.params);
    const body = DesignProposalDecisionInputSchema.parse(request.body);
    return contractResponse(DesignProposalSchema, service.decide(proposalId, body));
  });

  app.delete('/design/proposals/:proposalId', async (request, reply) => {
    const { proposalId } = DesignProposalParamsSchema.parse(request.params);
    service.delete(proposalId);
    return reply.code(204).send();
  });

  for (const [path, which] of [
    ['/design/proposals/:proposalId/file', 'preview'],
    ['/design/proposals/:proposalId/background', 'background'],
  ] as const) {
    app.get(path, async (request, reply) => {
      const { proposalId } = DesignProposalParamsSchema.parse(request.params);
      const { proposal, mime, content } = await service.readFile(proposalId, which);
      const extension = mime === 'image/png' ? 'png' : 'jpg';
      return reply
        .header('content-type', mime)
        .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
        .header('cache-control', 'no-store')
        .header('content-disposition', `inline; filename="design-${which}-${proposal.id}.${extension}"`)
        .send(content);
    });
  }
}
