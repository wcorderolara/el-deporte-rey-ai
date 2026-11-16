/**
 * Client of the AI design proposal operations (PD-ARCH-01G-B). Every response is validated with its contract schema.
 * The browser never sees the provider's API key, URL or response: only the server's contract answers.
 */
import {
  DesignCapabilitiesSchema,
  DesignEstimateSchema,
  DesignGenerationSchema,
  DesignGenerationStartSchema,
  DesignModelAccessSchema,
  DesignProposalDetailSchema,
  DesignProposalListSchema,
  DesignProposalSchema,
  type DesignCapabilities,
  type DesignEstimate,
  type DesignGeneration,
  type DesignGenerationCreate,
  type DesignGenerationInput,
  type DesignGenerationStart,
  type DesignModelAccess,
  type DesignProposal,
  type DesignProposalDecisionInput,
  type DesignProposalDetail,
} from '@edr/contracts';

import { API_BASE_PATH, createApiClient, type FetchFunction } from '../../api/client';

export interface DesignApi {
  getCapabilities(signal?: AbortSignal): Promise<DesignCapabilities>;
  checkModelAccess(model: string, signal?: AbortSignal): Promise<DesignModelAccess>;
  estimate(input: DesignGenerationInput, signal?: AbortSignal): Promise<DesignEstimate>;
  /** Starts a confirmed generation; the same request key returns the same generation. */
  createGeneration(input: DesignGenerationCreate, signal?: AbortSignal): Promise<DesignGenerationStart>;
  getGeneration(generationId: string, signal?: AbortSignal): Promise<DesignGeneration>;
  listProposals(signal?: AbortSignal): Promise<DesignProposal[]>;
  getProposal(proposalId: string, signal?: AbortSignal): Promise<DesignProposalDetail>;
  decide(proposalId: string, input: DesignProposalDecisionInput, signal?: AbortSignal): Promise<DesignProposal>;
  /** Logical deletion: the proposal leaves the library. */
  deleteProposal(proposalId: string, signal?: AbortSignal): Promise<void>;
  /** URL of streamDesignGenerationEvents (Server-Sent Events). */
  eventsUrl(generationId: string): string;
  /** URL of getDesignProposalFile (the preview with the original brand layers). */
  proposalFileUrl(proposalId: string): string;
  /** URL of getDesignProposalBackground (the generated bitmap alone). */
  proposalBackgroundUrl(proposalId: string): string;
}

export interface DesignApiOptions {
  basePath?: string;
  fetch?: FetchFunction;
}

export function createDesignApi(options: DesignApiOptions = {}): DesignApi {
  const basePath = options.basePath ?? API_BASE_PATH;
  const client = createApiClient({ basePath, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) });
  const withSignal = (signal: AbortSignal | undefined) => (signal === undefined ? {} : { signal });
  const id = (value: string) => encodeURIComponent(value);

  return {
    getCapabilities: (signal) =>
      client.get('/design/capabilities', { schema: DesignCapabilitiesSchema, ...withSignal(signal) }),
    checkModelAccess: (model, signal) =>
      client.post('/design/capabilities/check', { model }, { schema: DesignModelAccessSchema, ...withSignal(signal) }),
    estimate: (input, signal) =>
      client.post('/design/estimates', input, { schema: DesignEstimateSchema, ...withSignal(signal) }),
    createGeneration: (input, signal) =>
      client.post('/design/generations', input, { schema: DesignGenerationStartSchema, ...withSignal(signal) }),
    getGeneration: (generationId, signal) =>
      client.get(`/design/generations/${id(generationId)}`, { schema: DesignGenerationSchema, ...withSignal(signal) }),
    async listProposals(signal) {
      const body = await client.get('/design/proposals', { schema: DesignProposalListSchema, ...withSignal(signal) });
      return body.proposals;
    },
    getProposal: (proposalId, signal) =>
      client.get(`/design/proposals/${id(proposalId)}`, { schema: DesignProposalDetailSchema, ...withSignal(signal) }),
    decide: (proposalId, input, signal) =>
      client.post(`/design/proposals/${id(proposalId)}/decisions`, input, {
        schema: DesignProposalSchema,
        ...withSignal(signal),
      }),
    async deleteProposal(proposalId, signal) {
      await client.delete(`/design/proposals/${id(proposalId)}`, withSignal(signal));
    },
    eventsUrl: (generationId) => `${basePath}/design/generations/${id(generationId)}/events`,
    proposalFileUrl: (proposalId) => `${basePath}/design/proposals/${id(proposalId)}/file`,
    proposalBackgroundUrl: (proposalId) => `${basePath}/design/proposals/${id(proposalId)}/background`,
  };
}

/** API used by the design proposals in the application. */
export const designApi: DesignApi = createDesignApi();
