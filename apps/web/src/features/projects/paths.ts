import { contractRegExp } from '@edr/contracts';

import { featurePaths } from '../../app/routes';

/** Address of the project creation page. */
export const newProjectPath = `${featurePaths.projects}/new`;

/** Address of the content generation from a local competition (PD-ARCH-01E-A). */
export const generateContentPath = `${featurePaths.projects}/generate`;

/** Address of the result of a content generation batch. */
export function contentBatchPath(batchId: string): string {
  return `${featurePaths.projects}/batches/${encodeURIComponent(batchId)}`;
}

/** Address of a project's detail page. */
export function projectPath(projectId: string): string {
  return `${featurePaths.projects}/${encodeURIComponent(projectId)}`;
}

const UUID = contractRegExp('Uuid');

/** True when the value is a server identifier (contract `Uuid`); other addresses make no request. */
export function isProjectId(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}
