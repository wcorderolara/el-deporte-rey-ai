import { serverModule as brand } from './brand/index.js';
import { serverModule as content } from './content/index.js';
import { serverModule as exportModule } from './export/index.js';
import { serverModule as imports } from './imports/index.js';
import type { ServerModule } from './module-kit.js';
import { serverModule as projects } from './projects/index.js';
import { serverModule as rendering } from './rendering/index.js';
import { serverModule as research } from './research/index.js';
import { serverModule as review } from './review/index.js';
import { serverModule as verification } from './verification/index.js';
import { serverModule as visualQa } from './visual-qa/index.js';

/**
 * Static, ordered list of the server modules (contracts/provider-ports.md section 3). The order is the order of
 * route registration and of the `onStartup` hooks.
 */
export const serverModules: readonly ServerModule[] = [
  projects,
  imports,
  research,
  verification,
  content,
  brand,
  rendering,
  visualQa,
  review,
  exportModule,
];
