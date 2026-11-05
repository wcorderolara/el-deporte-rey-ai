/**
 * LocalCompetitionDataProvider (MANUAL_DATA; PD-ARCH-01E-A): the source of projects generated from locally managed
 * competitions (PD-ARCH-01A to 01D).
 *
 * - It is not a catalogue source: `listCompetitions` answers an empty listing, so the legacy project creation never
 *   offers it and every local project is created by a content generation batch that keeps its sports context.
 * - A selection reference names one generation item (`{ i: <itemId> }`). When the operator confirms a batch, the
 *   effective local values of each piece (manual data, confirmed imports and protected overrides) are frozen as one
 *   version of a form import of this source. `fetchSelection` reads that frozen version through the `Db` port and
 *   builds the snapshot exactly as the ManualDataProvider does, so the evidence of every fact references the import
 *   version it came from and a later run of the same project reproduces the same data.
 * - Standings are not frozen: `not_provided_by_source`; nothing is derived from the results (R-069, R-279).
 * - It never uses the egress client or any network API, and never reads import previews or provider snapshots.
 */
import {
  ManualSelectionSchema,
  type SelectionSnapshot,
  SelectionSnapshotSchema,
  UuidSchema,
  parseDomain,
} from '@edr/contracts';
import { z } from 'zod';

import { ConfigError } from '../../../../platform/config/index.js';
import { readJsonColumn } from '../../../../platform/db/index.js';
import {
  type AdapterContext,
  type AdapterRegistration,
  type IngestionSource,
  type Listing,
  type SourceCompetition,
  type SourceRef,
  type SourceSeason,
  type SourceStage,
  SourceError,
} from '../../ingestion/index.js';
import { snapshotOfVersion } from '../manual/index.js';

export const LOCAL_COMPETITIONS_ADAPTER_KIND = 'local-competitions';

const optionsSchema = z.strictObject({});

const selectionRefSchema = z.strictObject({ i: UuidSchema });

interface FrozenRow {
  competition_name: string;
  season_label: string;
  version_id: string;
  import_id: string;
  version_number: number;
  data: unknown;
}

const SELECT_FROZEN_SELECTION =
  'SELECT b.competition_name, b.season_label, v.id AS version_id, v.import_id, v.version_number, v.data ' +
  'FROM content_generation_items i JOIN content_generation_batches b ON b.id = i.batch_id ' +
  'JOIN manual_selection_versions v ON v.id = i.selection_version_id WHERE i.id = ?';

export function createLocalCompetitionsSource(context: AdapterContext): IngestionSource {
  const { descriptor, deps, setting } = context;
  const sourceId = descriptor.id;

  const fail = (code: SourceError['code'], message: string, path: string | null = null): SourceError =>
    new SourceError(code, message, sourceId, path);

  function readRef(ref: SourceRef): z.infer<typeof selectionRefSchema> {
    let raw: unknown;
    try {
      raw = JSON.parse(ref) as unknown;
    } catch {
      throw fail('bad_request', 'local reference is malformed');
    }
    const parsed = selectionRefSchema.safeParse(raw);
    if (!parsed.success) {
      throw fail('bad_request', 'local reference is malformed');
    }
    return parsed.data;
  }

  function snapshotOf(itemId: string): SelectionSnapshot {
    const row = deps.db.prepare<FrozenRow>(SELECT_FROZEN_SELECTION).get([itemId]);
    if (row === undefined) {
      throw fail('no_data', 'local selection has no frozen version');
    }
    const selection = readJsonColumn(ManualSelectionSchema, row.data, 'manual_selection_versions.data');
    const candidate = snapshotOfVersion(
      { versionId: row.version_id, importId: row.import_id, versionNumber: row.version_number, selection },
      { competitionName: row.competition_name, seasonLabel: row.season_label },
      { sourceId, retrievedAt: deps.clock.now().toISOString() },
    );
    const result = parseDomain(SelectionSnapshotSchema, candidate);
    if (!result.success) {
      throw fail('invalid', 'source output failed domain validation', result.issues[0]?.path ?? null);
    }
    return result.data;
  }

  const source: IngestionSource = {
    descriptor,

    listCompetitions(): Promise<Listing<SourceCompetition>> {
      return Promise.resolve({
        items: [],
        availability: { available: true },
        retrievedAt: deps.clock.now().toISOString(),
        fromCache: false,
        stale: false,
        retryAfterSeconds: null,
      });
    },

    listSeasons(): Promise<Listing<SourceSeason>> {
      return Promise.reject(fail('no_data', 'local competitions are not offered in the catalogue'));
    },

    listStages(): Promise<Listing<SourceStage>> {
      return Promise.reject(fail('no_data', 'local competitions are not offered in the catalogue'));
    },

    fetchSelection(selection: SourceRef): Promise<SelectionSnapshot> {
      return Promise.resolve().then(() => {
        try {
          return snapshotOf(readRef(selection).i);
        } catch (error) {
          throw error instanceof SourceError ? error : fail('unavailable', 'local data cannot be read');
        }
      });
    },

    validateStartup(): void {
      if (!optionsSchema.safeParse(context.options).success) {
        throw new ConfigError(`${setting}.options`, 'must be an empty object: the local adapter takes no options');
      }
    },
  };
  return Object.freeze(source);
}

/** Registry entry of the local competitions adapter (MANUAL_DATA). */
export const localCompetitionsAdapter: AdapterRegistration = Object.freeze({
  kind: LOCAL_COMPETITIONS_ADAPTER_KIND,
  mode: 'MANUAL_DATA',
  create: createLocalCompetitionsSource,
});
