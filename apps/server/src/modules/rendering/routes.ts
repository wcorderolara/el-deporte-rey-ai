/**
 * Template routes (contract operations listTemplates and previewTemplate; OD-13, R-031, R-050).
 *
 * - listTemplates returns the current version of each template with its badge slots (always reserved, empty while no
 *   authorized badge exists) and image slots; the body is checked against the contract schema before it is sent.
 * - previewTemplate validates the slug parameter and the optional `language` query with the contract schemas
 *   (400 `VALIDATION_FAILED`), answers 404 `NOT_FOUND` for an unknown template, and serves the PNG with
 *   `Cache-Control: no-store` (OD-41), the sandboxed file CSP of T19 and an inline disposition. GET handlers only
 *   read: the preview cache lives in memory (T10-F04).
 */
import { TemplateListResponseSchema, TemplateParamsSchema, TemplatePreviewQuerySchema } from '@edr/contracts';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../../platform/config/index.js';
import { HttpProblem, SANDBOXED_FILE_CONTENT_SECURITY_POLICY } from '../../platform/http/index.js';

import type { TemplatePreviewService } from './preview.js';
import { type TemplateRegistry, toContractTemplate } from './templates/registry.js';

/** A success body that does not match its contract schema is a server defect (500 `INTERNAL`). */
export class TemplateResponseError extends Error {
  override readonly name = 'TemplateResponseError';

  constructor() {
    super('a response does not match its contract schema');
  }
}

export function registerTemplateRoutes(
  app: FastifyInstance,
  deps: { readonly registry: TemplateRegistry; readonly previews: TemplatePreviewService; readonly config: AppConfig },
): void {
  app.get('/templates', async () => {
    const parsed = TemplateListResponseSchema.safeParse({ templates: deps.registry.list().map(toContractTemplate) });
    if (!parsed.success) {
      throw new TemplateResponseError();
    }
    return parsed.data;
  });

  app.get('/templates/:templateId/preview', async (request, reply) => {
    const { templateId } = TemplateParamsSchema.parse(request.params);
    const query = TemplatePreviewQuerySchema.parse(request.query);
    const template = deps.previews.template(templateId);
    if (template === undefined) {
      throw new HttpProblem(404, 'NOT_FOUND', 'The template does not exist.');
    }
    const png = await deps.previews.preview(template, query.language ?? deps.config.languages.defaultLanguage);
    return reply
      .header('content-type', 'image/png')
      .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
      .header('cache-control', 'no-store')
      .header('content-disposition', `inline; filename="template-${template.id}-preview.png"`)
      .send(png);
  });
}
