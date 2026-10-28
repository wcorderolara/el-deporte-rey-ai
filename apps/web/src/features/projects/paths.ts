import { contractRegExp } from '@edr/contracts';

import { featurePaths } from '../../app/routes';

/** Address of the project creation page. */
export const newProjectPath = `${featurePaths.projects}/new`;

/** Address of a project's detail page. */
export function projectPath(projectId: string): string {
  return `${featurePaths.projects}/${encodeURIComponent(projectId)}`;
}

const UUID = contractRegExp('Uuid');

/** True when the value is a server identifier (contract `Uuid`); other addresses make no request. */
export function isProjectId(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}
