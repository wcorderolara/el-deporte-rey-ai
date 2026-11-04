import { randomUUID } from 'node:crypto';
import type { AppContainer } from '../../container.js';
import type { ServerModule } from '../module-kit.js';
import { registerCompetitionRoutes } from './routes.js';
import { CompetitionService } from './service.js';
import { CompetitionAdministrationService } from './application/CompetitionAdministrationService.js';
import { SQLiteCompetitionAdministrationRepository } from './infrastructure/SQLiteCompetitionAdministrationRepository.js';
import { CompetitionCalendarService } from './calendar/application/CompetitionCalendarService.js';
import { SQLiteCompetitionCalendarRepository } from './calendar/infrastructure/SQLiteCompetitionCalendarRepository.js';
import { registerCompetitionCalendarRoutes } from './calendar/routes.js';
import { CompetitionProviderBindingService, bindingResponse } from './provider-binding.js';
import {
  SportsProviderListResponseSchema,
  SportsProviderParamsSchema,
  ExternalCompetitionListResponseSchema,
  CompetitionProviderBindingParamsSchema,
  CompetitionProviderBindingCreateSchema,
  CompetitionProviderBindingResponseSchema,
} from '@edr/contracts';
import { contractResponse } from '../projects/respond.js';
import { CompetitionImportPreviewService } from './import-preview.js';
import { ImportPreviewOperationService } from './import-operation.js';
import { CompetitionImportApplyService } from './import-apply.js';
import {
  ImportExternalSeasonsParamsSchema,
  ImportPreviewCreateSchema,
  ImportPreviewParamsSchema,
  ImportPreviewResponseSchema,
  ImportSeasonCapabilitiesParamsSchema,
  ExternalSeasonListResponseSchema,
  ImportCapabilitiesResponseSchema,
  ImportOperationParamsSchema,
  ImportOperationResponseSchema,
  ImportOperationStartResponseSchema,
  ImportOperationEventSchema,
  ImportApplyPlanRequestSchema,
  ImportApplyPlanResponseSchema,
  ImportApplyStartSchema,
  ImportApplyOperationParamsSchema,
  ImportApplyOperationResponseSchema,
  ImportApplyOperationStartResponseSchema,
  ImportApplyEventSchema,
} from '@edr/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';
import { HttpProblem } from '../../platform/http/problem.js';
import { SourceError } from '../../providers/sports/ingestion/errors.js';

async function providerSafe<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SourceError) {
      if (error.code === 'rate_limited')
        throw new HttpProblem(503, 'PROVIDER_RATE_LIMITED', 'Se alcanzó el límite de solicitudes del proveedor.', {
          retryAfterSeconds: error.retryAfterSeconds,
        });
      throw new HttpProblem(
        502,
        'PROVIDER_FAILED',
        'No se pudieron consultar los datos del proveedor. Inténtalo de nuevo.',
      );
    }
    throw error;
  }
}

/**
 * Streams the persisted events of an operation as SSE. SQLite stays authoritative: every wake-up re-reads events
 * after the last sent sequence (`Last-Event-ID` resumes after a reconnect) and the stream ends at a terminal status.
 */
function streamEvents<Event extends { id: number; type: string }>(
  request: FastifyRequest,
  reply: FastifyReply,
  source: {
    eventsSince: (after: number) => unknown[];
    status: () => string;
    subscribe: (listener: () => void) => () => void;
    schema: ZodType<Event>;
  },
) {
  const last = request.headers['last-event-id'];
  const from = typeof last === 'string' && /^\d+$/.test(last) ? Number(last) : 0;
  if (!Number.isSafeInteger(from))
    throw new HttpProblem(400, 'VALIDATION_FAILED', 'El identificador de evento no es válido.');
  let closed = false;
  let cursor = from;
  let unsubscribe = () => {};
  const flush = () => {
    if (closed) return;
    for (const event of source.eventsSince(cursor)) {
      const checked = source.schema.parse(event);
      cursor = checked.id;
      reply.raw.write(`id: ${checked.id}\nevent: ${checked.type}\ndata: ${JSON.stringify(checked)}\n\n`);
    }
    if (['completed', 'failed', 'cancelled'].includes(source.status())) {
      closed = true;
      unsubscribe();
      clearInterval(heartbeat);
      reply.raw.end();
    }
  };
  unsubscribe = source.subscribe(flush);
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  });
  const heartbeat = setInterval(() => {
    if (!closed) reply.raw.write(': keep-alive\n\n');
  }, 20000);
  reply.raw.on('close', () => {
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
  });
  flush();
}

export function createCompetitionModule(): ServerModule {
  return {
    name: 'competitions',
    routes: async (app, container: AppContainer) => {
      const now = () => container.clock.now();
      registerCompetitionRoutes(
        app,
        new CompetitionService(container),
        new CompetitionAdministrationService(new SQLiteCompetitionAdministrationRepository(container.db), {
          newId: randomUUID,
          now,
        }),
      );
      registerCompetitionCalendarRoutes(
        app,
        new CompetitionCalendarService(new SQLiteCompetitionCalendarRepository(container.db), {
          newId: randomUUID,
          now,
        }),
      );
      const bindings = new CompetitionProviderBindingService(container);
      const importPreviews = new CompetitionImportPreviewService(container);
      const importOperations = new ImportPreviewOperationService(container, importPreviews);
      const importApply = new CompetitionImportApplyService(container, importPreviews);
      app.get('/sports/providers', async () =>
        contractResponse(SportsProviderListResponseSchema, { providers: bindings.providers() }),
      );
      app.get('/sports/providers/:providerKey/competitions', async (request) => {
        const { providerKey } = SportsProviderParamsSchema.parse(request.params);
        return contractResponse(ExternalCompetitionListResponseSchema, {
          competitions: await bindings.externalCompetitions(providerKey),
        });
      });
      app.get('/competitions/:competitionId/provider-binding', async (request) => {
        const { competitionId } = CompetitionProviderBindingParamsSchema.parse(request.params);
        return contractResponse(CompetitionProviderBindingResponseSchema, bindingResponse(bindings.get(competitionId)));
      });
      app.post('/competitions/:competitionId/provider-binding', async (request, reply) => {
        const { competitionId } = CompetitionProviderBindingParamsSchema.parse(request.params);
        const body = CompetitionProviderBindingCreateSchema.parse(request.body);
        const row = await bindings.link(
          competitionId,
          body.providerKey,
          body.externalCompetitionId,
          body.mode,
          body.replaceExisting ?? false,
        );
        return reply.code(201).send(contractResponse(CompetitionProviderBindingResponseSchema, bindingResponse(row)));
      });
      app.delete('/competitions/:competitionId/provider-binding', async (request, reply) => {
        const { competitionId } = CompetitionProviderBindingParamsSchema.parse(request.params);
        bindings.unlink(competitionId);
        return reply.code(204).send();
      });
      app.get('/competitions/:competitionId/provider-binding/seasons', async (request) => {
        const { competitionId } = ImportExternalSeasonsParamsSchema.parse(request.params);
        return contractResponse(
          ExternalSeasonListResponseSchema,
          await providerSafe(() => importPreviews.seasons(competitionId)),
        );
      });
      app.get(
        '/competitions/:competitionId/provider-binding/seasons/:externalSeasonId/capabilities',
        async (request) => {
          const { competitionId, externalSeasonId } = ImportSeasonCapabilitiesParamsSchema.parse(request.params);
          return contractResponse(
            ImportCapabilitiesResponseSchema,
            await providerSafe(() => importPreviews.capabilities(competitionId, externalSeasonId)),
          );
        },
      );
      app.post('/competitions/:competitionId/import-operations', async (request, reply) => {
        const { competitionId } = ImportExternalSeasonsParamsSchema.parse(request.params);
        const body = ImportPreviewCreateSchema.parse(request.body);
        const operation = importOperations.start(competitionId, body);
        const base = `/api/v1/competitions/${competitionId}/import-operations/${operation.operationId}`;
        return reply.code(202).send(
          contractResponse(ImportOperationStartResponseSchema, {
            operation,
            statusUrl: base,
            eventsUrl: `${base}/events`,
          }),
        );
      });
      app.get('/competitions/:competitionId/import-operations/:operationId', async (request) => {
        const { competitionId, operationId } = ImportOperationParamsSchema.parse(request.params);
        return contractResponse(ImportOperationResponseSchema, {
          operation: importOperations.get(competitionId, operationId),
        });
      });
      app.post('/competitions/:competitionId/import-operations/:operationId/cancel', async (request) => {
        const { competitionId, operationId } = ImportOperationParamsSchema.parse(request.params);
        return contractResponse(ImportOperationResponseSchema, {
          operation: importOperations.cancel(competitionId, operationId),
        });
      });
      app.get('/competitions/:competitionId/import-operations/:operationId/events', async (request, reply) => {
        const { competitionId, operationId } = ImportOperationParamsSchema.parse(request.params);
        importOperations.get(competitionId, operationId);
        streamEvents(request, reply, {
          eventsSince: (after) => importOperations.eventsSince(competitionId, operationId, after),
          status: () => importOperations.get(competitionId, operationId).status,
          subscribe: (listener) => importOperations.subscribe(operationId, listener),
          schema: ImportOperationEventSchema,
        });
      });
      app.post('/competitions/:competitionId/import-previews', async (request, reply) => {
        const { competitionId } = ImportExternalSeasonsParamsSchema.parse(request.params);
        const body = ImportPreviewCreateSchema.parse(request.body);
        const preview = await providerSafe(() => importPreviews.create(competitionId, body));
        return reply
          .code(201)
          .send(contractResponse(ImportPreviewResponseSchema, { preview }, 'ImportPreviewResponse'));
      });
      app.get('/competitions/:competitionId/import-previews/:previewId', async (request) => {
        const { competitionId, previewId } = ImportPreviewParamsSchema.parse(request.params);
        return contractResponse(ImportPreviewResponseSchema, { preview: importPreviews.get(competitionId, previewId) });
      });
      app.post('/competitions/:competitionId/import-previews/:previewId/application-plan', async (request) => {
        const { competitionId, previewId } = ImportPreviewParamsSchema.parse(request.params);
        const { decisions } = ImportApplyPlanRequestSchema.parse(request.body);
        return contractResponse(ImportApplyPlanResponseSchema, {
          plan: importApply.plan(competitionId, previewId, decisions),
        });
      });
      app.post('/competitions/:competitionId/import-previews/:previewId/applications', async (request, reply) => {
        const { competitionId, previewId } = ImportPreviewParamsSchema.parse(request.params);
        const body = ImportApplyStartSchema.parse(request.body);
        const operation = importApply.start(competitionId, previewId, body);
        const base = `/api/v1/competitions/${competitionId}/import-applications/${operation.operationId}`;
        return reply.code(202).send(
          contractResponse(ImportApplyOperationStartResponseSchema, {
            operation,
            statusUrl: base,
            eventsUrl: `${base}/events`,
          }),
        );
      });
      app.get('/competitions/:competitionId/import-applications/:operationId', async (request) => {
        const { competitionId, operationId } = ImportApplyOperationParamsSchema.parse(request.params);
        return contractResponse(ImportApplyOperationResponseSchema, {
          operation: importApply.get(competitionId, operationId),
        });
      });
      app.post('/competitions/:competitionId/import-applications/:operationId/cancel', async (request) => {
        const { competitionId, operationId } = ImportApplyOperationParamsSchema.parse(request.params);
        return contractResponse(ImportApplyOperationResponseSchema, {
          operation: importApply.cancel(competitionId, operationId),
        });
      });
      app.get('/competitions/:competitionId/import-applications/:operationId/events', async (request, reply) => {
        const { competitionId, operationId } = ImportApplyOperationParamsSchema.parse(request.params);
        importApply.get(competitionId, operationId);
        streamEvents(request, reply, {
          eventsSince: (after) => importApply.eventsSince(competitionId, operationId, after),
          status: () => importApply.get(competitionId, operationId).status,
          subscribe: (listener) => importApply.subscribe(operationId, listener),
          schema: ImportApplyEventSchema,
        });
      });
    },
  };
}

export const serverModule = createCompetitionModule();
