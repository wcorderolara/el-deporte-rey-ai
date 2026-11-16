/**
 * The local competitions source (PD-ARCH-01E-A) is a MANUAL_DATA source whose versions are only the frozen
 * selections of content batches: operator imports must never be assigned to it, whatever the configuration order.
 */
import { describe, expect, it } from 'vitest';

import type { SourceConfig } from '../../platform/config/index.js';
import { CatalogueConfig } from '../../platform/config/index.js';
import type { Db } from '../../platform/db/index.js';

import { ImportService, NoManualSourceError } from './service.js';

function source(id: string, adapter: string): SourceConfig {
  return {
    id,
    name: id,
    mode: 'MANUAL_DATA',
    enabled: true,
    role: 'primary',
    accepted: false,
    independenceGroup: id,
    officialPublication: false,
    publicationPermission: 'not_applicable',
    adapter,
    options: {},
  } as SourceConfig;
}

function service(sources: readonly SourceConfig[]): ImportService {
  return new ImportService({
    db: {} as Db,
    clock: { now: () => new Date('2026-11-05T00:00:00.000Z') },
    dataDir: '/nonexistent',
    logger: { info: () => undefined },
    sources,
    catalogue: CatalogueConfig.empty(),
  });
}

describe('manual source of operator imports', () => {
  it('skips the local competitions source even when it is configured first', () => {
    expect(service([source('local', 'local-competitions'), source('manual', 'manual')]).manualSource().id).toBe(
      'manual',
    );
  });

  it('refuses operator imports when only the local competitions source is configured', () => {
    expect(() => service([source('local', 'local-competitions')]).manualSource()).toThrow(NoManualSourceError);
  });
});
