import { contractRegExp, PositionParamSchema } from '@edr/contracts';

import { featurePaths } from '../../app/routes';

/** Address of the project's exports and history page. */
export function exportsPath(projectId: string): string {
  return featurePaths.history(projectId);
}

/** Address of one export of the project. */
export function exportPath(projectId: string, exportId: string): string {
  return `${exportsPath(projectId)}/${encodeURIComponent(exportId)}`;
}

/** Address of the trace of one exported slide. */
export function tracePath(projectId: string, exportId: string, position: number): string {
  return `${exportPath(projectId, exportId)}/slides/${position}/trace`;
}

/** Address of the project's detail page (projects feature). */
export function projectPath(projectId: string): string {
  return `${featurePaths.projects}/${encodeURIComponent(projectId)}`;
}

const UUID = contractRegExp('Uuid');

/** True when the value is a server identifier (contract `Uuid`); other addresses make no request. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}

/** Slide position of the address (1 to 99 in canonical decimal form, contract `Position`), or null. */
export function parsePosition(value: string | undefined): number | null {
  const parsed = PositionParamSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
