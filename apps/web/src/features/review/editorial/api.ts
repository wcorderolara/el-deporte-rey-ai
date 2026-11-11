/**
 * Operations of the HTTP contract used by the editorial copy of the review (PD-ARCH-01H, tag editorial):
 * getEditorialPackage, createEditorialGeneration, editEditorialDeliverable, approveEditorialDeliverable and
 * withdrawEditorialApproval. Every successful response is validated with the contract schema by the API client.
 * Every guard (cost confirmation, limits, current version, flags, publishability) runs on the server.
 */
import {
  EditorialGenerationResultSchema,
  EditorialPackageSchema,
  EditorialVersionSchema,
  type EditorialDeliverable,
  type EditorialEditField,
  type EditorialGenerationCreate,
  type EditorialGenerationResult,
  type EditorialPackage,
  type EditorialVersion,
} from '@edr/contracts';

import { apiClient, type ApiClient } from '../../../api/client';
import { operationPath } from '../api';

export interface EditorialApi {
  getPackage(projectId: string, signal?: AbortSignal): Promise<EditorialPackage>;
  generate(projectId: string, input: EditorialGenerationCreate): Promise<EditorialGenerationResult>;
  edit(
    projectId: string,
    deliverable: EditorialDeliverable,
    baseVersionId: string,
    fields: EditorialEditField[],
  ): Promise<EditorialVersion>;
  approve(projectId: string, deliverable: EditorialDeliverable, versionId: string): Promise<EditorialVersion>;
  withdraw(projectId: string, deliverable: EditorialDeliverable): Promise<EditorialVersion>;
}

export function createEditorialApi(client: ApiClient): EditorialApi {
  return {
    getPackage(projectId, signal) {
      return client.get(operationPath('getEditorialPackage', { projectId }), {
        schema: EditorialPackageSchema,
        ...(signal === undefined ? {} : { signal }),
      });
    },
    generate(projectId, input) {
      return client.post(operationPath('createEditorialGeneration', { projectId }), input, {
        schema: EditorialGenerationResultSchema,
      });
    },
    edit(projectId, deliverable, baseVersionId, fields) {
      return client.post(
        operationPath('editEditorialDeliverable', { projectId, deliverable }),
        { baseVersionId, fields },
        { schema: EditorialVersionSchema },
      );
    },
    approve(projectId, deliverable, versionId) {
      return client.put(
        operationPath('approveEditorialDeliverable', { projectId, deliverable }),
        { versionId },
        { schema: EditorialVersionSchema },
      );
    },
    withdraw(projectId, deliverable) {
      return client.delete(operationPath('withdrawEditorialApproval', { projectId, deliverable }), {
        schema: EditorialVersionSchema,
      });
    },
  };
}

export const defaultEditorialApi: EditorialApi = createEditorialApi(apiClient);
