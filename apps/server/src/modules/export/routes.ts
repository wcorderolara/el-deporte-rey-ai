/**
 * Export routes (contract operations exportCarousel, listProjectExports, getExport, traceExportedSlide). Path
 * parameters are validated with the contract schemas (400 `VALIDATION_FAILED`) before any lookup or path building;
 * every success body is parsed with its contract schema before it is sent, so a response never carries an
 * undocumented field. exportCarousel reads no request body and passes the platform guards (Host, origin, client
 * header) unchanged; GET handlers only read. No route publishes anything (R-219, BR-11).
 */
import {
  CarouselParamsSchema,
  ExportDetailSchema,
  ExportListResponseSchema,
  ExportParamsSchema,
  ExportSchema,
  ProjectParamsSchema,
  SlideTraceParamsSchema,
  SlideTraceSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';

import type { ExportService } from './service.js';

/** A response that does not match its contract schema is a server defect (500 `INTERNAL`, fixed text). */
export class ExportResponseError extends Error {
  override readonly name = 'ExportResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

function contractResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ExportResponseError();
  }
  return parsed.data;
}

export function registerExportRoutes(app: FastifyInstance, service: ExportService): void {
  app.post('/carousels/:carouselId/exports', async (request, reply) => {
    const { carouselId } = CarouselParamsSchema.parse(request.params);
    const written = await service.exportCarousel(carouselId);
    return reply.code(201).send(contractResponse(ExportSchema, written));
  });

  app.get('/projects/:projectId/exports', async (request) => {
    const { projectId } = ProjectParamsSchema.parse(request.params);
    return contractResponse(ExportListResponseSchema, service.listProjectExports(projectId));
  });

  app.get('/exports/:exportId', async (request) => {
    const { exportId } = ExportParamsSchema.parse(request.params);
    return contractResponse(ExportDetailSchema, service.getExport(exportId));
  });

  app.get('/exports/:exportId/download', async (request, reply) => {
    const { exportId } = ExportParamsSchema.parse(request.params);
    const zip = await service.downloadExport(exportId);
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="carrusel-${exportId.slice(0, 8)}.zip"`)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'no-store')
      .send(zip);
  });

  app.get('/exports/:exportId/slides/:position/trace', async (request) => {
    const { exportId, position } = SlideTraceParamsSchema.parse(request.params);
    return contractResponse(SlideTraceSchema, service.traceSlide(exportId, position));
  });
}
