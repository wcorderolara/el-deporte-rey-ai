/**
 * Shared domain validation of every adapter output (contracts/provider-ports.md section 1.3; R-105, R-224, R-232,
 * R-267, R-288): listings and selection snapshots pass the one set of T20 domain schemas before they reach core code.
 *
 * - Objects are allow-lists: unknown keys (for example person fields) are stripped, and only their count is logged.
 * - Any violation rejects the whole output with `SourceError('invalid')` carrying the first validation path; the
 *   message is fixed text and never contains an input value.
 * - Beyond the schemas, the keys that core code looks up are unique within a listing (competition local keys,
 *   season IDs, stage IDs), and a snapshot names the source and mode that produced it.
 */
import {
  CompetitionListingSchema,
  type DomainIssue,
  SeasonListingSchema,
  type SelectionSnapshot,
  SelectionSnapshotSchema,
  StageListingSchema,
  parseDomain,
} from '@edr/contracts';
import type { z } from 'zod';

import { SourceError } from './errors.js';
import {
  type Listing,
  type SourceCompetition,
  type SourceDescriptor,
  type SourceSeason,
  type SourceStage,
  type SportsLogger,
} from './types.js';

export type ResourceKind = 'competitions' | 'seasons' | 'stages' | 'selection';

const INVALID_MESSAGE = 'source output failed domain validation';

function invalid(sourceId: string, path: string | null): SourceError {
  return new SourceError('invalid', INVALID_MESSAGE, sourceId, path);
}

function firstPath(issues: readonly DomainIssue[]): string | null {
  return issues[0]?.path ?? null;
}

function parseOrThrow<S extends z.ZodType>(
  schema: S,
  value: unknown,
  sourceId: string,
  resource: ResourceKind,
  logger: SportsLogger,
): z.output<S> {
  const result = parseDomain(schema, value);
  if (!result.success) {
    logger.debug(
      { sourceId, resource, issueCount: result.issues.length, path: firstPath(result.issues) },
      'source output rejected by domain validation',
    );
    throw invalid(sourceId, firstPath(result.issues));
  }
  if (result.strippedKeys > 0) {
    logger.debug({ sourceId, resource, strippedKeys: result.strippedKeys }, 'unknown keys stripped from source output');
  }
  return result.data;
}

/** Rejects a listing whose items repeat a lookup key. */
function requireUnique(keys: readonly string[], sourceId: string, field: string): void {
  const seen = new Set<string>();
  keys.forEach((key, index) => {
    if (seen.has(key)) {
      throw invalid(sourceId, `/items/${String(index)}/${field}`);
    }
    seen.add(key);
  });
}

/** Validates a competition listing of `sourceId`. */
export function validateCompetitionListing(
  value: unknown,
  sourceId: string,
  logger: SportsLogger,
): Listing<SourceCompetition> {
  const listing = parseOrThrow(CompetitionListingSchema, value, sourceId, 'competitions', logger);
  requireUnique(
    listing.items.map((item) => item.localKey),
    sourceId,
    'localKey',
  );
  // Validated by the shared schema: the references are opaque adapter references from here on.
  return listing as unknown as Listing<SourceCompetition>;
}

/** Validates a season listing of `sourceId`. */
export function validateSeasonListing(value: unknown, sourceId: string, logger: SportsLogger): Listing<SourceSeason> {
  const listing = parseOrThrow(SeasonListingSchema, value, sourceId, 'seasons', logger);
  requireUnique(
    listing.items.map((item) => item.id),
    sourceId,
    'id',
  );
  // Validated by the shared schema: the references are opaque adapter references from here on.
  return listing as unknown as Listing<SourceSeason>;
}

/** Validates a stage listing of `sourceId`. */
export function validateStageListing(value: unknown, sourceId: string, logger: SportsLogger): Listing<SourceStage> {
  const listing = parseOrThrow(StageListingSchema, value, sourceId, 'stages', logger);
  requireUnique(
    listing.items.map((item) => item.id),
    sourceId,
    'id',
  );
  // Validated by the shared schema: the references are opaque adapter references from here on.
  return listing as unknown as Listing<SourceStage>;
}

/** Validates a selection snapshot produced by the source `descriptor` (same source ID and mode). */
export function validateSelectionSnapshot(
  value: unknown,
  descriptor: Pick<SourceDescriptor, 'id' | 'mode'>,
  logger: SportsLogger,
): SelectionSnapshot {
  const snapshot = parseOrThrow(SelectionSnapshotSchema, value, descriptor.id, 'selection', logger);
  if (snapshot.sourceId !== descriptor.id) {
    throw invalid(descriptor.id, '/sourceId');
  }
  if (snapshot.mode !== descriptor.mode) {
    throw invalid(descriptor.id, '/mode');
  }
  return snapshot;
}
