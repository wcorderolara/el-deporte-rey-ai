/**
 * Visual template routes (PD-ARCH-01G-C; contract operations listVisualTemplates, createVisualTemplate,
 * getVisualTemplate, updateVisualTemplate, deleteVisualTemplate, archiveVisualTemplate, restoreVisualTemplate,
 * createVisualTemplateVersion, getVisualTemplateVersion, saveVisualTemplateVersion, deleteVisualTemplateVersion,
 * releaseVisualTemplateVersion, getVisualTemplateBackground, previewVisualTemplate, renderVisualTemplatePreview).
 *
 * Parameters, queries and JSON bodies are validated with the contract schemas; success bodies are checked against
 * their contract schemas before they are sent. Images are served with their MIME type, a sandboxed CSP, `no-store`
 * and a server-generated file name. No route calls an AI provider.
 */
import {
  VisualTemplateCreateSchema,
  VisualTemplateDetailSchema,
  VisualTemplateListSchema,
  VisualTemplateParamsSchema,
  VisualTemplatePreviewQuerySchema,
  VisualTemplatePreviewRequestSchema,
  VisualTemplatePreviewSchema,
  VisualTemplatePublishSchema,
  VisualTemplateSchema,
  VisualTemplateUpdateSchema,
  VisualTemplateVersionCreateSchema,
  VisualTemplateVersionParamsSchema,
  VisualTemplateVersionSaveSchema,
  VisualTemplateVersionSchema,
} from '@edr/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { SANDBOXED_FILE_CONTENT_SECURITY_POLICY } from '../../platform/http/index.js';
import { contractResponse } from '../projects/respond.js';

import type { VisualTemplateService } from './service.js';

function sendImage(reply: FastifyReply, mime: 'image/png' | 'image/jpeg', content: Buffer, name: string) {
  return reply
    .header('content-type', mime)
    .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
    .header('cache-control', 'no-store')
    .header('content-disposition', `inline; filename="${name}.${mime === 'image/png' ? 'png' : 'jpg'}"`)
    .send(content);
}

export function registerVisualTemplateRoutes(app: FastifyInstance, service: VisualTemplateService): void {
  app.get('/visual-templates', async () => contractResponse(VisualTemplateListSchema, { templates: service.list() }));

  app.post('/visual-templates', async (request, reply) => {
    const body = VisualTemplateCreateSchema.parse(request.body);
    return reply.code(201).send(contractResponse(VisualTemplateDetailSchema, service.create(body)));
  });

  app.get('/visual-templates/:templateId', async (request) => {
    const { templateId } = VisualTemplateParamsSchema.parse(request.params);
    return contractResponse(VisualTemplateDetailSchema, service.detail(templateId));
  });

  app.patch('/visual-templates/:templateId', async (request) => {
    const { templateId } = VisualTemplateParamsSchema.parse(request.params);
    const body = VisualTemplateUpdateSchema.parse(request.body);
    return contractResponse(VisualTemplateSchema, service.update(templateId, body));
  });

  app.delete('/visual-templates/:templateId', async (request, reply) => {
    const { templateId } = VisualTemplateParamsSchema.parse(request.params);
    service.delete(templateId);
    return reply.code(204).send();
  });

  for (const [path, archived] of [
    ['/visual-templates/:templateId/archive', true],
    ['/visual-templates/:templateId/restore', false],
  ] as const) {
    app.post(path, async (request) => {
      const { templateId } = VisualTemplateParamsSchema.parse(request.params);
      return contractResponse(VisualTemplateSchema, service.archive(templateId, archived));
    });
  }

  app.post('/visual-templates/:templateId/versions', async (request, reply) => {
    const { templateId } = VisualTemplateParamsSchema.parse(request.params);
    const body = VisualTemplateVersionCreateSchema.parse(request.body ?? {});
    const version = await service.createVersion(templateId, body);
    return reply.code(201).send(contractResponse(VisualTemplateVersionSchema, version));
  });

  app.get('/visual-templates/:templateId/versions/:versionId', async (request) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    return contractResponse(VisualTemplateVersionSchema, await service.version(templateId, versionId));
  });

  app.put('/visual-templates/:templateId/versions/:versionId', async (request) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    const body = VisualTemplateVersionSaveSchema.parse(request.body);
    return contractResponse(VisualTemplateVersionSchema, await service.save(templateId, versionId, body));
  });

  app.delete('/visual-templates/:templateId/versions/:versionId', async (request, reply) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    service.discardVersion(templateId, versionId);
    return reply.code(204).send();
  });

  app.post('/visual-templates/:templateId/versions/:versionId/release', async (request) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    const body = VisualTemplatePublishSchema.parse(request.body);
    return contractResponse(VisualTemplateVersionSchema, await service.publish(templateId, versionId, body.revision));
  });

  app.get('/visual-templates/:templateId/versions/:versionId/background', async (request, reply) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    const { mime, content } = await service.background(templateId, versionId);
    return sendImage(reply, mime, content, `template-background-${versionId}`);
  });

  app.post('/visual-templates/:templateId/versions/:versionId/previews', async (request) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    const body = VisualTemplatePreviewRequestSchema.parse(request.body);
    return contractResponse(VisualTemplatePreviewSchema, await service.preview(templateId, versionId, body));
  });

  app.get('/visual-templates/:templateId/versions/:versionId/preview', async (request, reply) => {
    const { templateId, versionId } = VisualTemplateVersionParamsSchema.parse(request.params);
    // An unknown template or version is 404 before the query is looked at.
    service.requireVersion(templateId, versionId);
    const query = VisualTemplatePreviewQuerySchema.parse(request.query);
    const png = await service.renderPreview(
      templateId,
      versionId,
      {
        competitionId: query.competitionId,
        seasonId: query.seasonId,
        roundId: query.roundId ?? null,
        matchId: query.matchId ?? null,
      },
      query.language ?? 'es',
    );
    return sendImage(reply, 'image/png', png, `template-preview-${versionId}`);
  });
}
