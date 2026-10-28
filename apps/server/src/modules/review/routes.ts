/**
 * Review routes (contract operations getActiveDraft, getSlideImage, regenerateElement, approveElement,
 * withdrawElementApproval, acknowledgeQaWarnings, approveCarousel). Path parameters and bodies are validated with the
 * contract schemas (400 `VALIDATION_FAILED` with closed pointers); every success body is parsed with its contract
 * schema before it is sent, so a response never carries an undocumented field. Operations without a request body
 * read none. The platform guards (Host, Sec-Fetch-Site, client header and Origin, media type, body limit) apply
 * unchanged. GET handlers only read.
 */
import {
  CarouselParamsSchema,
  DraftSchema,
  ElementParamsSchema,
  ElementSchema,
  FinalApprovalSchema,
  ProjectParamsSchema,
  QaAcknowledgementSchema,
  VersionParamsSchema,
  VersionRefSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import { SANDBOXED_FILE_CONTENT_SECURITY_POLICY } from '../../platform/http/index.js';

import type { ReviewService } from './service.js';

/** A response that does not match its contract schema is a server defect (500 `INTERNAL`, fixed text). */
export class ReviewResponseError extends Error {
  override readonly name = 'ReviewResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

function contractResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ReviewResponseError();
  }
  return parsed.data;
}

export function registerReviewRoutes(app: FastifyInstance, service: ReviewService): void {
  app.get('/projects/:projectId/draft', async (request) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    return contractResponse(DraftSchema, service.activeDraft(projectId));
  });

  app.get('/element-versions/:versionId/image', async (request, reply) => {
    const { versionId } = VersionParamsSchema.parse(request.params);
    const png = await service.slideImage(versionId);
    return reply
      .header('content-type', 'image/png')
      .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
      .header('cache-control', 'no-store')
      .header('content-disposition', `inline; filename="slide-${versionId}.png"`)
      .send(png);
  });

  app.post('/carousels/:carouselId/elements/:elementId/regenerate', async (request, reply) => {
    const { carouselId, elementId } = ElementParamsSchema.parse(request.params);
    const element = await service.regenerateElement(carouselId, elementId);
    return reply.code(201).send(contractResponse(ElementSchema, element));
  });

  app.put('/carousels/:carouselId/elements/:elementId/approval', async (request) => {
    const { carouselId, elementId } = ElementParamsSchema.parse(request.params);
    const { versionId } = VersionRefSchema.parse(request.body);
    return contractResponse(ElementSchema, service.approveElement(carouselId, elementId, versionId));
  });

  app.delete('/carousels/:carouselId/elements/:elementId/approval', async (request) => {
    const { carouselId, elementId } = ElementParamsSchema.parse(request.params);
    return contractResponse(ElementSchema, service.withdrawElementApproval(carouselId, elementId));
  });

  app.post('/carousels/:carouselId/elements/:elementId/qa-acknowledgements', async (request) => {
    const { carouselId, elementId } = ElementParamsSchema.parse(request.params);
    const { versionId, checks } = QaAcknowledgementSchema.parse(request.body);
    return contractResponse(ElementSchema, service.acknowledgeQaWarnings(carouselId, elementId, versionId, checks));
  });

  app.put('/carousels/:carouselId/final-approval', async (request) => {
    const { carouselId } = CarouselParamsSchema.parse(request.params);
    return contractResponse(FinalApprovalSchema, service.approveCarousel(carouselId));
  });
}
