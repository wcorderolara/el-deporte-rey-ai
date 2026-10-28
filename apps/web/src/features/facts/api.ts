/**
 * API access of the facts view (contract `http-api.openapi.yaml` 1.0.0: listFacts, listRuns, approveFactManually,
 * revokeManualFactApproval). Responses are validated with the `@edr/contracts` schemas. The client is provided
 * through a context so that tests inject one built on a fake fetch.
 */
import {
  FactListResponseSchema,
  FactSchema,
  RunListResponseSchema,
  type Fact,
  type FactListResponse,
  type RunListResponse,
} from '@edr/contracts';
import { createContext, useContext } from 'react';

import { apiClient, type ApiClient } from '../../api/client';

export const FactsApiContext = createContext<ApiClient>(apiClient);

export function useFactsApi(): ApiClient {
  return useContext(FactsApiContext);
}

function runPath(projectId: string, runId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/runs/${encodeURIComponent(runId)}`;
}

function manualApprovalPath(projectId: string, runId: string, factId: string): string {
  return `${runPath(projectId, runId)}/facts/${encodeURIComponent(factId)}/manual-approval`;
}

export interface FactsViewData {
  facts: FactListResponse;
  runs: RunListResponse['runs'];
}

/** listFacts and listRuns (the runs tell whether the viewed run is the latest completed full run). */
export async function loadFactsView(
  client: ApiClient,
  projectId: string,
  runId: string,
  signal?: AbortSignal,
): Promise<FactsViewData> {
  const options = signal === undefined ? {} : { signal };
  const [facts, runList] = await Promise.all([
    client.get(`${runPath(projectId, runId)}/facts`, { ...options, schema: FactListResponseSchema }),
    client.get(`/projects/${encodeURIComponent(projectId)}/runs`, { ...options, schema: RunListResponseSchema }),
  ]);
  return { facts, runs: runList.runs };
}

/** approveFactManually: PUT with no request body. */
export function approveFactManually(client: ApiClient, projectId: string, runId: string, factId: string) {
  return client.put<Fact>(manualApprovalPath(projectId, runId, factId), undefined, { schema: FactSchema });
}

/** revokeManualFactApproval: DELETE with no request body. */
export function revokeManualFactApproval(client: ApiClient, projectId: string, runId: string, factId: string) {
  return client.delete<Fact>(manualApprovalPath(projectId, runId, factId), { schema: FactSchema });
}
