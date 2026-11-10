/**
 * Client of the structured visual template operations (PD-ARCH-01G-C). Every JSON response is validated with its
 * contract schema; images (the pinned background and the engine preview) are shown only through API URLs built from
 * contract-validated IDs. Nothing here reaches an AI provider.
 */
import {
  VisualTemplateDetailSchema,
  VisualTemplateListSchema,
  VisualTemplatePreviewSchema,
  VisualTemplateSchema,
  VisualTemplateVersionSchema,
  type VisualTemplate,
  type VisualTemplateCreate,
  type VisualTemplateDetail,
  type VisualTemplatePreview,
  type VisualTemplatePreviewRequest,
  type VisualTemplateUpdate,
  type VisualTemplateVersion,
  type VisualTemplateVersionCreate,
  type VisualTemplateVersionSave,
} from '@edr/contracts';

import { API_BASE_PATH, createApiClient, type FetchFunction } from '../../api/client';

export interface VisualTemplatesApi {
  list(signal?: AbortSignal): Promise<VisualTemplate[]>;
  /** Creates a draft template from an approved design proposal (a local operation, no AI call). */
  create(input: VisualTemplateCreate, signal?: AbortSignal): Promise<VisualTemplateDetail>;
  get(templateId: string, signal?: AbortSignal): Promise<VisualTemplateDetail>;
  update(templateId: string, input: VisualTemplateUpdate, signal?: AbortSignal): Promise<VisualTemplate>;
  /** Logical deletion of a template that was never published; TEMPLATE_IN_USE otherwise. */
  remove(templateId: string, signal?: AbortSignal): Promise<void>;
  archive(templateId: string, signal?: AbortSignal): Promise<VisualTemplate>;
  restore(templateId: string, signal?: AbortSignal): Promise<VisualTemplate>;
  createVersion(
    templateId: string,
    input: VisualTemplateVersionCreate,
    signal?: AbortSignal,
  ): Promise<VisualTemplateVersion>;
  getVersion(templateId: string, versionId: string, signal?: AbortSignal): Promise<VisualTemplateVersion>;
  saveVersion(
    templateId: string,
    versionId: string,
    input: VisualTemplateVersionSave,
    signal?: AbortSignal,
  ): Promise<VisualTemplateVersion>;
  /** Discards a draft version (only when another version exists). */
  deleteVersion(templateId: string, versionId: string, signal?: AbortSignal): Promise<void>;
  publishVersion(
    templateId: string,
    versionId: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<VisualTemplateVersion>;
  /** Resolves the bindings with local sports data and returns the URL of the PNG drawn by the slide engine. */
  preview(
    templateId: string,
    versionId: string,
    input: VisualTemplatePreviewRequest,
    signal?: AbortSignal,
  ): Promise<VisualTemplatePreview>;
  /**
   * URL of getVisualTemplateBackground (the pinned background of a version). `key` (`?v=`, ignored by the server)
   * changes with the background: the version's address alone does not, and browsers reuse an image already decoded
   * for the same address in the page, so a changed background kept showing the previous one.
   */
  backgroundUrl(templateId: string, versionId: string, key: string): string;
}

export interface VisualTemplatesApiOptions {
  basePath?: string;
  fetch?: FetchFunction;
}

export function createVisualTemplatesApi(options: VisualTemplatesApiOptions = {}): VisualTemplatesApi {
  const basePath = options.basePath ?? API_BASE_PATH;
  const client = createApiClient({ basePath, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) });
  const withSignal = (signal: AbortSignal | undefined) => (signal === undefined ? {} : { signal });
  const id = (value: string) => encodeURIComponent(value);
  const template = (templateId: string) => `/visual-templates/${id(templateId)}`;
  const version = (templateId: string, versionId: string) => `${template(templateId)}/versions/${id(versionId)}`;

  return {
    async list(signal) {
      const body = await client.get('/visual-templates', { schema: VisualTemplateListSchema, ...withSignal(signal) });
      return body.templates;
    },
    create: (input, signal) =>
      client.post('/visual-templates', input, { schema: VisualTemplateDetailSchema, ...withSignal(signal) }),
    get: (templateId, signal) =>
      client.get(template(templateId), { schema: VisualTemplateDetailSchema, ...withSignal(signal) }),
    update: (templateId, input, signal) =>
      client.patch(template(templateId), input, { schema: VisualTemplateSchema, ...withSignal(signal) }),
    async remove(templateId, signal) {
      await client.delete(template(templateId), withSignal(signal));
    },
    archive: (templateId, signal) =>
      client.post(`${template(templateId)}/archive`, undefined, {
        schema: VisualTemplateSchema,
        ...withSignal(signal),
      }),
    restore: (templateId, signal) =>
      client.post(`${template(templateId)}/restore`, undefined, {
        schema: VisualTemplateSchema,
        ...withSignal(signal),
      }),
    createVersion: (templateId, input, signal) =>
      client.post(`${template(templateId)}/versions`, input, {
        schema: VisualTemplateVersionSchema,
        ...withSignal(signal),
      }),
    getVersion: (templateId, versionId, signal) =>
      client.get(version(templateId, versionId), { schema: VisualTemplateVersionSchema, ...withSignal(signal) }),
    saveVersion: (templateId, versionId, input, signal) =>
      client.put(version(templateId, versionId), input, { schema: VisualTemplateVersionSchema, ...withSignal(signal) }),
    async deleteVersion(templateId, versionId, signal) {
      await client.delete(version(templateId, versionId), withSignal(signal));
    },
    publishVersion: (templateId, versionId, revision, signal) =>
      client.post(
        `${version(templateId, versionId)}/release`,
        { revision },
        { schema: VisualTemplateVersionSchema, ...withSignal(signal) },
      ),
    preview: (templateId, versionId, input, signal) =>
      client.post(`${version(templateId, versionId)}/previews`, input, {
        schema: VisualTemplatePreviewSchema,
        ...withSignal(signal),
      }),
    backgroundUrl: (templateId, versionId, key) =>
      `${basePath}${version(templateId, versionId)}/background?v=${encodeURIComponent(key)}`,
  };
}

/** API used by the visual templates in the application. */
export const visualTemplatesApi: VisualTemplatesApi = createVisualTemplatesApi();
