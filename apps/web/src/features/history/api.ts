/**
 * API access of the export, history and traceability views (contract `http-api.openapi.yaml` 1.0.0: getProject,
 * getActiveDraft, exportCarousel, listProjectExports, getExport, traceExportedSlide; getSlideImage as an image
 * source). Paths come from the contract's operation registry; every JSON response is validated with the
 * `@edr/contracts` schema. The client is provided through a context so that tests inject one built on a fake fetch.
 *
 * No operation here publishes anything (R-219): `exportCarousel` writes local files only, and there is no deletion
 * (OD-08).
 */
import {
  DraftSchema,
  ExportDetailSchema,
  ExportListResponseSchema,
  ExportSchema,
  operations,
  ProjectSchema,
  ProjectListResponseSchema,
  SlideTraceSchema,
  type Draft,
  type Export,
  type ExportDetail,
  type OperationId,
  type Project,
  type ProjectSummary,
  type SlideTrace,
} from '@edr/contracts';
import { createContext, useContext } from 'react';

import { API_BASE_PATH, ApiError, apiClient, type ApiClient } from '../../api/client';

export const HistoryApiContext = createContext<ApiClient>(apiClient);

export function useHistoryApi(): ApiClient {
  return useContext(HistoryApiContext);
}

/** Path of a contract operation relative to the API base, with every path parameter encoded. */
export function operationPath(id: OperationId, params: Record<string, string> = {}): string {
  return operations[id].path.replace(/\{([A-Za-z]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new TypeError(`Missing path parameter ${name}`);
    }
    return encodeURIComponent(value);
  });
}

function withSignal(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

export interface ExportsPageData {
  project: Project;
  exports: Export[];
}

export interface GlobalExportHistoryItem {
  readonly project: ProjectSummary;
  readonly export: Export;
}

/** Uses only the existing project list and project-scoped history operations; no global history API is assumed. */
export async function loadGlobalExportHistory(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<GlobalExportHistoryItem[]> {
  const projects = await client.get(operationPath('listProjects'), {
    ...withSignal(signal),
    schema: ProjectListResponseSchema,
  });
  const result: GlobalExportHistoryItem[] = [];
  // Bound simultaneous requests so large local libraries do not fan out without limit.
  for (let offset = 0; offset < projects.projects.length; offset += 4) {
    const batch = projects.projects.slice(offset, offset + 4);
    const histories = await Promise.all(
      batch.map(async (project) => {
        const response = await client.get(operationPath('listProjectExports', { projectId: project.id }), {
          ...withSignal(signal),
          schema: ExportListResponseSchema,
        });
        return response.exports.map((item) => ({ project, export: item }));
      }),
    );
    result.push(...histories.flat());
  }
  return result.sort((a, b) => Date.parse(b.export.exportedAt) - Date.parse(a.export.exportedAt));
}

/** getProject and listProjectExports (exports newest first, R-220). */
export async function loadExportsPage(
  client: ApiClient,
  projectId: string,
  signal?: AbortSignal,
): Promise<ExportsPageData> {
  const options = withSignal(signal);
  const [project, list] = await Promise.all([
    client.get(operationPath('getProject', { projectId }), { ...options, schema: ProjectSchema }),
    client.get(operationPath('listProjectExports', { projectId }), { ...options, schema: ExportListResponseSchema }),
  ]);
  return { project, exports: list.exports };
}

/** Existing project-scoped history operation, used to surface the newest saved ZIP from a project workspace. */
export async function loadProjectExports(
  client: ApiClient,
  projectId: string,
  signal?: AbortSignal,
): Promise<Export[]> {
  const response = await client.get(operationPath('listProjectExports', { projectId }), {
    ...withSignal(signal),
    schema: ExportListResponseSchema,
  });
  return response.exports.toSorted((a, b) => Date.parse(b.exportedAt) - Date.parse(a.exportedAt));
}

/** getActiveDraft; null when the project has no active draft (404 NOT_FOUND). */
export async function loadActiveDraft(client: ApiClient, projectId: string, signal?: AbortSignal) {
  try {
    return await client.get<Draft>(operationPath('getActiveDraft', { projectId }), {
      ...withSignal(signal),
      schema: DraftSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'problem' && error.problem?.code === 'NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

/** exportCarousel: POST with no request body; answers 201 with the export written. */
export function exportCarousel(client: ApiClient, carouselId: string): Promise<Export> {
  return client.post<Export>(operationPath('exportCarousel', { carouselId }), undefined, { schema: ExportSchema });
}

/** getExport: the export with the exact exported element versions, in carousel order (R-220). */
export function loadExport(client: ApiClient, exportId: string, signal?: AbortSignal): Promise<ExportDetail> {
  return client.get<ExportDetail>(operationPath('getExport', { exportId }), {
    ...withSignal(signal),
    schema: ExportDetailSchema,
  });
}

/** Download original persisted export artifacts as a ZIP. */
export function downloadExport(client: ApiClient, exportId: string): Promise<Blob> {
  return client.getBlob(operationPath('downloadExport', { exportId }));
}

export function saveExportZip(blob: Blob, exportId: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `carrusel-${exportId.slice(0, 8)}.zip`;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** traceExportedSlide: facts of the exported slide with statuses, evidence and disputes (R-221, R-287). */
export function loadSlideTrace(
  client: ApiClient,
  exportId: string,
  position: number,
  signal?: AbortSignal,
): Promise<SlideTrace> {
  return client.get<SlideTrace>(operationPath('traceExportedSlide', { exportId, position: String(position) }), {
    ...withSignal(signal),
    schema: SlideTraceSchema,
  });
}

/**
 * Same-origin source of an exported slide image (getSlideImage). It is built from the validated version ID and the
 * contract path, never taken from a server-provided URL, so the browser never loads an image from another host.
 */
export function slideImageSource(versionId: string): string {
  return `${API_BASE_PATH}${operationPath('getSlideImage', { versionId })}`;
}
