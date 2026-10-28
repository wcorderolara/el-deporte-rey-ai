// TEMPORARY launcher, used by e2e/run.mjs only while the built sports-data entry point is the T15 stub (pending T21).
//
// It starts the same built server as `apps/server/dist/src/main.js` (same `main`, configuration, data directory,
// migrations, HTTP platform, modules and built UI, on 127.0.0.1), through the T19 test seam `providers`: the real AI
// provider factory and an empty sports-data source registry in place of the stub that throws. Remove this file and
// the stub check in e2e/support/harness.mjs once T21 is integrated.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.argv[2];
if (rootDir === undefined) {
  process.stderr.write('usage: node e2e/support/seam-server.mjs <project root>\n');
  process.exit(2);
}

const load = (path) => import(pathToFileURL(resolve(rootDir, path)).href);
const { main } = await load('apps/server/dist/src/main.js');
const { createAiProvider } = await load('apps/server/dist/src/providers/ai/index.js');

const providers = Object.freeze({
  createSportsSources: () => Object.freeze({ sourceIds: Object.freeze([]) }),
  createAiProvider,
});

await main({ rootDir, providers });
