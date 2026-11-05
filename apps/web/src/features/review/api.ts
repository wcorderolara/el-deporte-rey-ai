/**
 * Operations of the HTTP contract used by the review feature (`contracts/http-api.openapi.yaml` 1.0.0, tags drafts,
 * review and facts): getProject (review header), getActiveDraft, setExcludedMatches, getSlideImage (as an image address), regenerateElement,
 * approveElement, withdrawElementApproval, acknowledgeQaWarnings, approveCarousel and listFacts (match labels for the
 * exclusions editor). Paths come from the contract's operation registry in `@edr/contracts`, and every successful
 * JSON response is validated with the contract schema by the API client; nothing here adds an operation or a field.
 *
 * Every guard (current version, publishability, flags, QA, final-approval readiness) runs on the server (AD-13,
 * T10-F15); the UI shows the server's answer and never assumes that a request succeeded.
 */
import {
  DraftSchema,
  ElementSchema,
  FactListResponseSchema,
  FinalApprovalSchema,
  operations,
  ProjectSchema,
  RunSchema,
  type Draft,
  type Element,
  type FactListResponse,
  type FinalApproval,
  type OperationId,
  type Project,
  type QaWarningCheck,
  type Run,
} from '@edr/contracts';

import { API_BASE_PATH, apiClient, type ApiClient } from '../../api/client';

export interface ReviewApi {
  /** getProject: the project the review belongs to (header context, PD-ARCH-01F). */
  getProject(projectId: string, signal?: AbortSignal): Promise<Project>;
  /** getActiveDraft: carousels, elements, current versions, review states, QA results and provenance. */
  getActiveDraft(projectId: string, signal?: AbortSignal): Promise<Draft>;
  /** listFacts: facts of the draft's facts run (used for the match labels of the exclusions editor). */
  listFacts(projectId: string, runId: string, signal?: AbortSignal): Promise<FactListResponse>;
  /** setExcludedMatches: starts a redraft run; approvals do not carry over (OD-03). */
  setExcludedMatches(projectId: string, excludedMatchKeys: string[]): Promise<Run>;
  /** regenerateElement: new version of one element only (R-040, R-217). */
  regenerateElement(carouselId: string, elementId: string): Promise<Element>;
  /** approveElement: approve the exact current version (R-406). */
  approveElement(carouselId: string, elementId: string, versionId: string): Promise<Element>;
  /** withdrawElementApproval. */
  withdrawElementApproval(carouselId: string, elementId: string): Promise<Element>;
  /** acknowledgeQaWarnings: one warning check per request (OD-09, OD-26, OD-38). */
  acknowledgeQaWarning(
    carouselId: string,
    elementId: string,
    versionId: string,
    check: QaWarningCheck,
  ): Promise<Element>;
  /** approveCarousel: final approval (R-240). */
  approveCarousel(carouselId: string): Promise<FinalApproval>;
  /** Same-origin address of getSlideImage for an element version (used as an image source, not fetched here). */
  slideImageUrl(versionId: string): string;
}

/** Builds the path of a contract operation, encoding every path parameter. */
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

/** Review API on top of the shared client (which adds `X-EDR-Client` to the mutating requests). */
export function createReviewApi(client: ApiClient, basePath: string = API_BASE_PATH): ReviewApi {
  return {
    getProject(projectId, signal) {
      return client.get(operationPath('getProject', { projectId }), { schema: ProjectSchema, ...withSignal(signal) });
    },
    getActiveDraft(projectId, signal) {
      return client.get(operationPath('getActiveDraft', { projectId }), {
        schema: DraftSchema,
        ...withSignal(signal),
      });
    },
    listFacts(projectId, runId, signal) {
      return client.get(operationPath('listFacts', { projectId, runId }), {
        schema: FactListResponseSchema,
        ...withSignal(signal),
      });
    },
    setExcludedMatches(projectId, excludedMatchKeys) {
      return client.put(
        operationPath('setExcludedMatches', { projectId }),
        { excludedMatchKeys },
        { schema: RunSchema },
      );
    },
    regenerateElement(carouselId, elementId) {
      return client.post(operationPath('regenerateElement', { carouselId, elementId }), undefined, {
        schema: ElementSchema,
      });
    },
    approveElement(carouselId, elementId, versionId) {
      return client.put(
        operationPath('approveElement', { carouselId, elementId }),
        { versionId },
        { schema: ElementSchema },
      );
    },
    withdrawElementApproval(carouselId, elementId) {
      return client.delete(operationPath('withdrawElementApproval', { carouselId, elementId }), {
        schema: ElementSchema,
      });
    },
    acknowledgeQaWarning(carouselId, elementId, versionId, check) {
      return client.post(
        operationPath('acknowledgeQaWarnings', { carouselId, elementId }),
        { versionId, checks: [check] },
        { schema: ElementSchema },
      );
    },
    approveCarousel(carouselId) {
      return client.put(operationPath('approveCarousel', { carouselId }), undefined, {
        schema: FinalApprovalSchema,
      });
    },
    slideImageUrl(versionId) {
      return `${basePath}${operationPath('getSlideImage', { versionId })}`;
    },
  };
}

/** Review API of the running application (same-origin client of `api/client.ts`). */
export const defaultReviewApi: ReviewApi = createReviewApi(apiClient);
