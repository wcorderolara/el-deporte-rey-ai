/**
 * Run configuration snapshot (`workflow_runs.config_snapshot`; data-model.md section 3.1; T10-F11, AD-30).
 *
 * The snapshot records the configuration in force for a run: every configured source descriptor (mode, role,
 * acceptance, independence group, official-publication flag, publication permission, adapter kind, enabled), the
 * verification policy, the AI adapter kind, the format and the run parameters. It is built only from the parsed
 * configuration object, never from `process.env`, and it copies named fields one by one: adapter options (which may
 * hold base URLs) and decision references are not copied, so no secret, URL or token can reach it.
 */
import { DataModeSchema, MatchKeySchema, SourceIdSchema, uniquePrimitives } from '@edr/contracts';
import { z } from 'zod';

import type { AppConfig } from '../platform/config/index.js';

/** Version of the snapshot layout. */
export const CONFIG_SNAPSHOT_VERSION = 1;

const SnapshotSourceSchema = z.strictObject({
  id: SourceIdSchema,
  name: z.string().max(80),
  mode: DataModeSchema,
  adapter: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
  role: z.enum(['primary', 'verification']),
  accepted: z.boolean(),
  independenceGroup: z.string().max(64),
  officialPublication: z.boolean(),
  publicationPermission: z.enum(['confirmed', 'unconfirmed', 'not_applicable']),
  enabled: z.boolean(),
});

/**
 * Parameters of one run. `excludedMatchKeys` is the operator's exclusion list of a redraft started by
 * `setExcludedMatches` (OD-03); null when the run does not change the exclusions.
 */
export const RunParametersSchema = z.strictObject({
  excludedMatchKeys: uniquePrimitives(z.array(MatchKeySchema).max(64)).nullable(),
});

export const ConfigSnapshotSchema = z.strictObject({
  version: z.literal(CONFIG_SNAPSHOT_VERSION),
  sources: z.array(SnapshotSourceSchema).max(100),
  verificationPolicy: z.strictObject({
    manuallyApprovedPublication: z.enum(['allowed_without_accepted_source', 'blocked']),
    livePublicationPermissionRule: z.enum(['every_supporting_source']),
  }),
  ai: z.strictObject({ adapter: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/) }),
  format: z.strictObject({ width: z.int(), height: z.int(), maxSlidesPerCarousel: z.int() }),
  standingsRowsPerSlide: z.int(),
  parameters: RunParametersSchema,
});

export type RunParameters = z.infer<typeof RunParametersSchema>;
export type ConfigSnapshot = z.infer<typeof ConfigSnapshotSchema>;

export const NO_RUN_PARAMETERS: RunParameters = Object.freeze({ excludedMatchKeys: null });

/** Builds the snapshot of a run from the parsed configuration (never from the environment). */
export function buildConfigSnapshot(config: AppConfig, parameters: RunParameters = NO_RUN_PARAMETERS): ConfigSnapshot {
  const snapshot: ConfigSnapshot = {
    version: CONFIG_SNAPSHOT_VERSION,
    sources: config.providers.sports.sources.map((source) => ({
      id: source.id,
      name: source.name,
      mode: source.mode,
      adapter: source.adapter,
      role: source.role,
      accepted: source.accepted,
      independenceGroup: source.independenceGroup,
      officialPublication: source.officialPublication,
      publicationPermission: source.publicationPermission,
      enabled: source.enabled,
    })),
    verificationPolicy: {
      manuallyApprovedPublication: config.verificationPolicy.manuallyApprovedPublication,
      livePublicationPermissionRule: config.verificationPolicy.livePublicationPermissionRule,
    },
    ai: { adapter: config.providers.ai.adapter },
    format: {
      width: config.format.width,
      height: config.format.height,
      maxSlidesPerCarousel: config.format.maxSlidesPerCarousel,
    },
    standingsRowsPerSlide: config.standingsRowsPerSlide,
    parameters: { excludedMatchKeys: parameters.excludedMatchKeys === null ? null : [...parameters.excludedMatchKeys] },
  };
  return ConfigSnapshotSchema.parse(snapshot);
}
