/**
 * Publishability (architecture.md section 7.4 as amended by architecture-delta.md AD-38; PD-17, PD-18, BR-17, BR-18;
 * R-026, R-055, R-078, R-136, R-271, R-272). The single function used by the facts view, the content blocking
 * overlay, element approval and final approval (exported from `index.ts`; T37).
 *
 * - `verified` without a LIVE_DATA supporting observation: publishable. With at least one, under
 *   `every_supporting_source` (the only accepted rule): publishable only when every supporting LIVE_DATA source has
 *   `publicationPermission` `confirmed` in the current configuration; otherwise `publication_permission_unconfirmed`.
 * - `manually_approved`: publishable only under `allowed_without_accepted_source`, for a project whose competition is
 *   a catalogue link marked `noAcceptedPublicSource` that binds the project's source; otherwise
 *   `manually_approved_not_publishable` (an unlinked or unmarked competition, whatever its name, and everything under
 *   `blocked`).
 * - `unverified`: never publishable (`not_verified`).
 */
import type { BlockReason, DataMode, FactStatus } from '@edr/contracts';

import type {
  CatalogueConfig,
  ManuallyApprovedPublicationPolicy,
  PublicationPermission,
  SourceConfig,
  VerificationPolicy,
} from '../../platform/config/index.js';

export interface PublishabilitySettings {
  readonly manuallyApprovedPublication: ManuallyApprovedPublicationPolicy;
  readonly livePublicationPermissionRule: VerificationPolicy['livePublicationPermissionRule'];
  /** The project's competition is a marked link (`noAcceptedPublicSource`) that binds the project's source. */
  readonly operatorAttestedCompetition: boolean;
  /** Current publication permission of a configured source; undefined for a source no longer configured. */
  publicationPermission(sourceId: string): PublicationPermission | undefined;
}

export interface PublishabilityFact {
  readonly status: FactStatus;
  /** Sources of the observations recorded as `supports` evidence, with their data mode. */
  readonly supportingSources: readonly { readonly sourceId: string; readonly dataMode: DataMode }[];
}

export type Publishability =
  | { readonly publishable: true; readonly blockReason: null }
  | { readonly publishable: false; readonly blockReason: BlockReason };

const PUBLISHABLE: Publishability = Object.freeze({ publishable: true, blockReason: null });

function blocked(blockReason: BlockReason): Publishability {
  return { publishable: false, blockReason };
}

/** Whether a fact may be used in content approved for publication, and why not (pure). */
export function publishability(fact: PublishabilityFact, settings: PublishabilitySettings): Publishability {
  switch (fact.status) {
    case 'unverified':
      return blocked('not_verified');
    case 'manually_approved':
      return settings.manuallyApprovedPublication === 'allowed_without_accepted_source' &&
        settings.operatorAttestedCompetition
        ? PUBLISHABLE
        : blocked('manually_approved_not_publishable');
    case 'verified': {
      const live = fact.supportingSources.filter((source) => source.dataMode === 'LIVE_DATA');
      // `every_supporting_source` is the only accepted rule (PD-18).
      const allConfirmed = live.every((source) => settings.publicationPermission(source.sourceId) === 'confirmed');
      return allConfirmed ? PUBLISHABLE : blocked('publication_permission_unconfirmed');
    }
  }
}

/** Whether the project's competition is configured as having no accepted public source for its source (AD-38). */
export function isOperatorAttestedCompetition(
  catalogue: CatalogueConfig,
  project: { readonly competitionId: string; readonly sourceId: string },
): boolean {
  const link = catalogue.getLink(project.competitionId);
  return (
    link !== undefined &&
    link.noAcceptedPublicSource &&
    link.bindings.some((binding) => binding.sourceId === project.sourceId)
  );
}

/**
 * Whether the source is an enabled MANUAL_DATA source whose values the operator validated before generation
 * (PD-ARCH-01E-PD-01): the local competitions data, managed and reviewed in the studio.
 */
export function isOperatorValidatedSource(sources: readonly SourceConfig[], sourceId: string): boolean {
  return sources.some(
    (source) => source.id === sourceId && source.enabled && source.mode === 'MANUAL_DATA' && source.operatorValidated,
  );
}

/** The publishability settings of a project under the current configuration. */
export function publishabilitySettings(
  config: {
    readonly verificationPolicy: VerificationPolicy;
    readonly catalogue: CatalogueConfig;
    readonly providers: { readonly sports: { readonly sources: readonly SourceConfig[] } };
  },
  project: { readonly competitionId: string; readonly sourceId: string },
): PublishabilitySettings {
  const permissions = new Map(
    config.providers.sports.sources.map((source) => [source.id, source.publicationPermission] as const),
  );
  return {
    manuallyApprovedPublication: config.verificationPolicy.manuallyApprovedPublication,
    livePublicationPermissionRule: config.verificationPolicy.livePublicationPermissionRule,
    // A competition attested in the catalogue (AD-38) or the data of an operator-validated source (PD-ARCH-01E-PD-01).
    operatorAttestedCompetition:
      isOperatorAttestedCompetition(config.catalogue, project) ||
      isOperatorValidatedSource(config.providers.sports.sources, project.sourceId),
    publicationPermission: (sourceId) => permissions.get(sourceId),
  };
}
