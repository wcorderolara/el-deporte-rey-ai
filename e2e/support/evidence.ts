/**
 * Where the journeys write their screenshots (UI-06.1): under the git-ignored `.cache/e2e/evidence/<increment>/`, so
 * that a suite run never overwrites the evidence an accepted increment committed under `docs/design/WI-2/evidence/`.
 * To refresh committed evidence, copy the files from this directory deliberately.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EVIDENCE_ROOT = resolve(import.meta.dirname, '../../.cache/e2e/evidence');

/** The path of evidence file `name` of `increment` (for example `UI-02`), creating its directory. */
export function evidencePath(increment: string, name: string): string {
  const directory = join(EVIDENCE_ROOT, increment);
  mkdirSync(directory, { recursive: true });
  return join(directory, name);
}
