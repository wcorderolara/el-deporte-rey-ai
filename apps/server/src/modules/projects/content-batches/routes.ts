/**
 * Content generation batch routes (PD-ARCH-01E-A; contract operations previewContentBatch, createContentBatch,
 * getContentBatch). Bodies and parameters are validated with the contract schemas and responses are checked against
 * theirs. The preview is a POST because the selection is a body, but it writes nothing; GET handlers only read.
 */
import {
  ContentBatchCreateSchema,
  ContentBatchParamsSchema,
  ContentBatchPreviewSchema,
  ContentBatchSchema,
  ContentBatchSelectionSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';

import { contractResponse } from '../respond.js';

import type { ContentBatchService } from './service.js';

export function registerContentBatchRoutes(app: FastifyInstance, service: ContentBatchService): void {
  app.post('/content-batches/previews', async (request) => {
    const body = ContentBatchSelectionSchema.parse(request.body);
    return contractResponse(ContentBatchPreviewSchema, service.preview(body));
  });

  app.post('/content-batches', async (request, reply) => {
    const body = ContentBatchCreateSchema.parse(request.body);
    return reply.code(202).send(contractResponse(ContentBatchSchema, service.create(body)));
  });

  app.get('/content-batches/:batchId', async (request) => {
    const { batchId } = ContentBatchParamsSchema.parse(request.params);
    return contractResponse(ContentBatchSchema, service.get(batchId));
  });
}
