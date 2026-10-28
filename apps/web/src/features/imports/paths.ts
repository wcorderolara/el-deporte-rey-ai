import { contractRegExp } from '@edr/contracts';

import { featurePaths } from '../../app/routes';

/** Address of the imports page (history, versions and the import forms). */
export const importsPath = featurePaths.imports;

/** Address of one applied import (getImport). */
export function importPath(importId: string): string {
  return `${featurePaths.imports}/${encodeURIComponent(importId)}`;
}

/** Address of one version of a MANUAL_DATA selection (getManualVersion). */
export function versionPath(versionId: string): string {
  return `${featurePaths.imports}/versions/${encodeURIComponent(versionId)}`;
}

/** Address of the project creation form of the projects feature (R-276). */
export const newProjectPath = `${featurePaths.projects}/new`;

const UUID = contractRegExp('Uuid');

/** True when the value is a server identifier (contract `Uuid`); other addresses make no request. */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}
