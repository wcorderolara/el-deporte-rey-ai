/**
 * Test-only builders of the verification unit tests: source descriptors, canonical observations and research-format
 * observations of synthetic selections. All data is invented (no real team, competition or provider). Not used by
 * production code.
 */
import { type DataMode, type FactValue, SelectionSnapshotSchema } from '@edr/contracts';

import { FIXED_NOW, type Json, selection } from '../../../providers/sports/test/synthetic.js';
import { researchSnapshot } from '../../research/index.js';
import type { SourceObservation } from '../core.js';
import type { CanonicalObservation, DecisionContext, ObservationStage, SourceInfo } from '../decision.js';

export const MANUAL_VERSION_ID = '00000000-0000-4000-8000-000000000001';

let counter = 0;

/** A deterministic UUID-shaped identifier. */
export function nextId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

export function source(id: string, mode: DataMode, overrides: Partial<SourceInfo> = {}): SourceInfo {
  return {
    id,
    name: `Synthetic ${id}`,
    mode,
    role: 'primary',
    accepted: mode !== 'MANUAL_DATA',
    independenceGroup: id,
    officialPublication: false,
    publicationPermission: mode === 'LIVE_DATA' ? 'unconfirmed' : 'not_applicable',
    ...overrides,
  };
}

export function sourcesOf(...list: SourceInfo[]): Map<string, SourceInfo> {
  return new Map(list.map((entry) => [entry.id, entry]));
}

export function observation(
  sourceId: string,
  value: FactValue,
  stage: ObservationStage = 'verification',
): CanonicalObservation {
  return { observationId: nextId(), sourceId, stage, value, retrievedAt: FIXED_NOW };
}

export function context(
  projectMode: DataMode,
  projectSourceId: string,
  sources: Map<string, SourceInfo>,
  overrides: Partial<DecisionContext> = {},
): DecisionContext {
  return { kind: 'match_score', projectMode, projectSourceId, sources, teamUnmatched: false, ...overrides };
}

export interface SnapshotOptions {
  readonly mode?: DataMode;
  readonly stage?: ObservationStage;
  /** Changes applied to the synthetic selection payload before validation. */
  readonly edit?: (payload: Json) => void;
  readonly payload?: Json;
}

/** Research-format observations of a synthetic selection of one source (built with the research core). */
export function snapshotObservations(sourceId: string, options: SnapshotOptions = {}): SourceObservation[] {
  const mode = options.mode ?? 'DEMO_DATA';
  const payload = options.payload ?? selection();
  options.edit?.(payload);
  const sourceRef =
    mode === 'MANUAL_DATA'
      ? `import:${MANUAL_VERSION_ID}/v1`
      : mode === 'LIVE_DATA'
        ? `source:${sourceId}/matches@${FIXED_NOW}`
        : `fixture:default/${sourceId}.json`;
  const snapshot = SelectionSnapshotSchema.parse({
    ...payload,
    sourceId,
    mode,
    retrievedAt: FIXED_NOW,
    fromCache: false,
    sourceRef,
    importVersionId: mode === 'MANUAL_DATA' ? MANUAL_VERSION_ID : null,
  });
  return researchSnapshot(snapshot).observations.map((entry) => ({
    id: nextId(),
    sourceId,
    stage: options.stage ?? 'research',
    factKey: entry.factKey,
    value: entry.value,
    retrievedAt: entry.retrievedAt,
  }));
}

/** Mutable access to a synthetic selection payload's arrays (test edits only). */
export function arrayOf(payload: Json, key: string): Json[] {
  return payload[key] as Json[];
}
