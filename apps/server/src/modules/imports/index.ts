/**
 * MANUAL_DATA import module (contracts/provider-ports.md section 1.6; architecture.md section 15.3; AD-29, AD-35;
 * T50). JSON-file, CSV-file and form imports are converted to one `ManualImportDocument`, validated, applied as a
 * whole and versioned per selection, with their originals preserved byte for byte. The ManualDataProvider
 * (`providers/sports/adapters/manual`) reads the stored versions; this module never imports it.
 */
import type { ServerModule } from '../module-kit.js';

import { registerImportRoutes } from './routes.js';

export const serverModule: ServerModule = { name: 'imports', routes: registerImportRoutes };
