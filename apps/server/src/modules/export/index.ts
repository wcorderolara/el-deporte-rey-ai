/**
 * Export module (architecture.md sections 4, 11.2 and 14; AD-17, AD-33, AD-38; BR-11; R-041 to R-044, R-216,
 * R-218 to R-221, R-240, R-269, R-272, R-287; T10-F08, T10-F13, T10-F15): the export of a carousel's finally
 * approved version set into `exports/<projectId>/<exportId>/` (`01.png` to `NN.png`, `caption.txt`, `manifest.json`),
 * the export history (list and detail with the exact exported versions) and the trace of an exported slide.
 *
 * The module receives no egress client and has no publication function (R-219, BR-11); its code imports no network
 * API, tests included (ESLint rule of T10-F08). The final approval and its version set come from the review module
 * (T37); fact statuses and publishability come from the verification module's single function (T30).
 */
import type { ServerModule } from '../module-kit.js';

import type { ExportFileStore } from './files.js';
import { registerExportRoutes } from './routes.js';
import { ExportService, exportDependencies } from './service.js';

export {
  EXPORT_DIRECTORY_MODE,
  EXPORT_FILE_MODE,
  EXPORT_FILE_NAME_PATTERN,
  EXPORTS_DIRECTORY,
  ExportFileError,
  ExportFileStore,
  type ExportFolder,
  exportRelativeDirectory,
} from './files.js';
export {
  CAPTION_FILE_NAME,
  type ExportFileContent,
  type ExportPlan,
  MANIFEST_FILE_NAME,
  MANIFEST_FORMAT,
  MAX_EXPORTED_SLIDES,
  type Manifest,
  ManifestSchema,
  buildManifest,
  captionText,
  exportFiles,
  sha256Of,
  slideFileName,
} from './manifest.js';
export { ExportRepository } from './repository.js';
export { ExportResponseError, registerExportRoutes } from './routes.js';
export { type ExportDependencies, ExportService, type ExportServiceOptions, exportDependencies } from './service.js';

/** Options of the export module (tests pass their own ID generator or file store). */
export interface ExportModuleOptions {
  readonly newId?: () => string;
  readonly files?: ExportFileStore;
}

/** The export module with the given options. */
export function createExportModule(options: ExportModuleOptions = {}): ServerModule {
  return {
    name: 'export',
    routes: async (app, container) => {
      registerExportRoutes(app, new ExportService({ deps: exportDependencies(container), ...options }));
      await Promise.resolve();
    },
  };
}

/** The export module of the static registry. */
export const serverModule: ServerModule = createExportModule();
