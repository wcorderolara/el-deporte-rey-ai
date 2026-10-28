/**
 * Catalogue service (contracts/provider-ports.md section 1.2, architecture.md section 15.2; AD-23, AD-24, OD-16,
 * PD-14): the provider-neutral view of every enabled source's competitions, seasons and stages.
 *
 * - The catalogue is merged per request from `listCompetitions` of every enabled source (R-073, R-282). A competition
 *   bound by a configured link appears once under the link's ID and name with every bound source; any other
 *   competition appears as `<sourceId>-<localKey>`. Sources are never merged by name. A link binds a source's
 *   competition by its adapter-supplied `localKey`.
 * - Availability and listing provenance are propagated per source (R-141, R-286, R-291); a source failure never hides
 *   the other sources.
 * - IDs from requests are resolved only against the current listings (T11H-F06): `competitionId` and `sourceId`
 *   against the competitions listing, `seasonId` against the source's seasons listing, `stageId` and the matchday
 *   against its stages listing. An unknown or no-longer-listed ID is answered as not found without any adapter call
 *   for that ID.
 * - `restrictToLinks` and a link's `selectableStages` restrict the catalogue and the stages (unused in the committed
 *   configurations, PD-19, PD-20).
 * - Every lookup keyed by adapter, link or derived values uses `Map` (T11H-F07). Source references are passed back to
 *   the issuing source unchanged and never parsed, compared or logged.
 * - A counterpart source that fails one of its listings keeps its closed failure (the `SourceError` code and HTTP
 *   status, or the availability reason of a listing that answered unavailable; architecture.md 7.3, OD-56): it is
 *   never swallowed into a different code and carries no provider text, header, URL or token (T10-F10).
 */
import type { SourceUnavailableReason } from '@edr/contracts';

import type { CatalogueConfig, CatalogueLink } from '../../../platform/config/index.js';

import { type SourceError, type SourceErrorCode, availabilityReasonOf, toSourceError } from './errors.js';
import type { SourceRegistry } from './registry.js';
import type {
  Availability,
  DataMode,
  IngestionContext,
  IngestionSource,
  Listing,
  SourceCompetition,
  SourceDescriptor,
  SourceRef,
  SourceSeason,
  SourceStage,
} from './types.js';

/** Contract cap of the catalogue's competition list. */
export const MAX_CATALOGUE_COMPETITIONS = 1000;
const MAX_SLUG_LENGTH = 64;

const AVAILABLE: Availability = Object.freeze({ available: true });

/** Provenance of a listing (contract `ListingMeta`). */
export interface ListingMeta {
  readonly retrievedAt: string | null;
  readonly fromCache: boolean;
  readonly stale: boolean;
  readonly retryAfterSeconds: number | null;
}

/** One enabled source's competitions listing state (contract `SourceListing`). */
export interface CatalogueSourceListing {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly mode: DataMode;
  readonly availability: Availability;
  readonly listing: ListingMeta;
}

/** A source of a catalogue competition (contract `CompetitionSource`). */
export interface CatalogueCompetitionSource {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly mode: DataMode;
  readonly role: SourceDescriptor['role'];
  /** Enabled primary-role source offering the competition: the operator can choose it (R-431). */
  readonly selectable: boolean;
  readonly availability: Availability;
}

/** A merged catalogue competition (contract `CatalogueCompetition`). */
export interface CatalogueCompetition {
  readonly id: string;
  readonly name: string;
  readonly areaName: string | null;
  /** Marked by configuration as an initial reference scenario; listed first. */
  readonly reference: boolean;
  /** The configured link ID, or null for a competition of a single source. */
  readonly linkId: string | null;
  readonly sources: readonly CatalogueCompetitionSource[];
}

export interface Catalogue {
  readonly competitions: readonly CatalogueCompetition[];
  readonly sources: readonly CatalogueSourceListing[];
}

export type SeasonsLookup =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly competitionId: string;
      readonly sourceId: string;
      readonly listing: Listing<SourceSeason>;
    };

export type StagesLookup =
  | { readonly found: false }
  | {
      readonly found: true;
      readonly competitionId: string;
      readonly sourceId: string;
      readonly seasonId: string;
      readonly listing: Listing<SourceStage>;
    };

/** A selection request: a stage plus a matchday number, or the whole stage (matchday null; AD-24). */
export interface SelectionRequest {
  readonly competitionId: string;
  readonly sourceId: string;
  readonly seasonId: string;
  readonly stageId: string;
  readonly matchday: number | null;
}

/** Contract `refusalReason` values of `SELECTION_UNAVAILABLE`. */
export type SelectionRefusalReason =
  'competition_unavailable' | 'season_unavailable' | 'stage_unavailable' | 'source_not_selectable';

/** A resolved selection: the opaque reference to store and the labels to snapshot (AD-21, AD-24). */
export interface ResolvedSelection {
  readonly competitionId: string;
  readonly sourceId: string;
  readonly mode: DataMode;
  readonly seasonId: string;
  readonly stageId: string;
  readonly matchday: number | null;
  readonly selectionRef: SourceRef;
  readonly competitionName: string;
  readonly seasonLabel: string;
  readonly stageName: string;
  readonly standingsExpected: SourceStage['standings'];
}

export type SelectionResolution =
  | { readonly ok: true; readonly selection: ResolvedSelection }
  | {
      readonly ok: false;
      readonly reason: SelectionRefusalReason;
      /** The availability that caused the refusal (for example a subscription restriction, R-286). */
      readonly availability: Availability;
      readonly retryAfterSeconds: number | null;
    };

/** Closed reasons why a counterpart could not be resolved; the source then contributes no observation. */
export type CounterpartFailureReason =
  | 'not_linked'
  | 'source_not_bound'
  | 'source_unavailable'
  | 'selection_not_listed'
  | 'competition_not_listed'
  | 'season_not_matched'
  | 'stage_not_matched'
  | 'matchday_not_matched';

/**
 * The closed failure of a counterpart source that did not answer one of its listings (architecture.md 7.3, OD-56;
 * T10-F10): `source_error` when the adapter failed with a `SourceError` (its closed code and sanitized HTTP status),
 * `listing_unavailable` when the listing answered unavailable (its availability reason). It never holds the error
 * message, a provider body, a header, a URL or a token.
 */
export type CounterpartSourceFailure =
  | { readonly kind: 'source_error'; readonly code: SourceErrorCode; readonly httpStatus: number | null }
  | { readonly kind: 'listing_unavailable'; readonly reason: SourceUnavailableReason };

export type CounterpartResolution =
  | {
      readonly resolved: true;
      readonly sourceId: string;
      readonly seasonId: string;
      readonly stageId: string;
      readonly matchday: number | null;
      readonly selectionRef: SourceRef;
    }
  | {
      readonly resolved: false;
      readonly sourceId: string;
      readonly reason: Exclude<CounterpartFailureReason, 'source_unavailable'>;
    }
  | {
      readonly resolved: false;
      readonly sourceId: string;
      readonly reason: 'source_unavailable';
      /** Why the source did not answer: kept as the source reported it (never a different code). */
      readonly failure: CounterpartSourceFailure;
    };

/**
 * The closed source failure code of a counterpart failure: the `SourceError` code itself, or, for a listing that
 * answered unavailable, the code of its availability reason (the inverse of `availabilityReasonOf`: a subscription
 * restriction or a missing item is `not_available`, `access_refused` and `rate_limited` stay themselves,
 * `not_provided` is `no_data`, `source_unavailable` is `unavailable`).
 */
export function counterpartFailureCode(failure: CounterpartSourceFailure): SourceErrorCode {
  if (failure.kind === 'source_error') {
    return failure.code;
  }
  switch (failure.reason) {
    case 'subscription_restricted':
    case 'not_found':
      return 'not_available';
    case 'access_refused':
      return 'access_refused';
    case 'rate_limited':
      return 'rate_limited';
    case 'not_provided':
      return 'no_data';
    case 'source_unavailable':
      return 'unavailable';
  }
}

export interface CatalogueService {
  /** Merges the competitions of every enabled source (discovery). */
  listCatalogue(ctx: IngestionContext): Promise<Catalogue>;
  /** Seasons of a catalogue competition from one bound source; not found for an unknown or unlisted ID. */
  listSeasons(competitionId: string, sourceId: string, ctx: IngestionContext): Promise<SeasonsLookup>;
  /** Stages of a season; not found for an unknown or unlisted competition, source or season ID. */
  listStages(competitionId: string, sourceId: string, seasonId: string, ctx: IngestionContext): Promise<StagesLookup>;
  /** Resolves a selection to its opaque reference and label snapshots, or refuses it with a reason. */
  resolveSelection(request: SelectionRequest, ctx: IngestionContext): Promise<SelectionResolution>;
  /** Finds the same selection in another source bound to the same link (verification, OD-16). */
  resolveCounterpart(
    selection: SelectionRequest,
    sourceId: string,
    ctx: IngestionContext,
  ): Promise<CounterpartResolution>;
  /** Descriptors of the enabled sources bound to a linked competition, in binding order (empty when unlinked). */
  linkedSources(competitionId: string): readonly SourceDescriptor[];
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

type Fetched<T> =
  | { readonly ok: true; readonly listing: Listing<T> }
  | {
      readonly ok: false;
      readonly availability: Availability;
      readonly meta: ListingMeta;
      /** The closed failure behind the unavailability (OD-56): the source error, or the listing's own reason. */
      readonly failure: CounterpartSourceFailure;
    };

const NO_META: ListingMeta = Object.freeze({
  retrievedAt: null,
  fromCache: false,
  stale: false,
  retryAfterSeconds: null,
});

function metaOf(listing: Listing<unknown>): ListingMeta {
  return {
    retrievedAt: listing.retrievedAt,
    fromCache: listing.fromCache,
    stale: listing.stale,
    retryAfterSeconds: listing.retryAfterSeconds,
  };
}

/**
 * Calls a listing method; a failure or an unavailable listing becomes an availability with its reason, and keeps its
 * closed failure (the `SourceError` code and HTTP status, never the message; T10-F10).
 */
async function fetchListing<T>(sourceId: string, action: () => Promise<Listing<T>>): Promise<Fetched<T>> {
  try {
    const listing = await action();
    if (!listing.availability.available) {
      return {
        ok: false,
        availability: listing.availability,
        meta: metaOf(listing),
        failure: { kind: 'listing_unavailable', reason: listing.availability.reason },
      };
    }
    return { ok: true, listing };
  } catch (error) {
    const failure: SourceError = toSourceError(error, sourceId);
    return {
      ok: false,
      availability: { available: false, reason: availabilityReasonOf(failure) },
      meta: { ...NO_META, retryAfterSeconds: failure.retryAfterSeconds },
      failure: { kind: 'source_error', code: failure.code, httpStatus: failure.httpStatus },
    };
  }
}

function unavailableListing<T>(availability: Availability, meta: ListingMeta): Listing<T> {
  return { items: [], availability, ...meta };
}

const NOT_FOUND: Availability = Object.freeze({ available: false, reason: 'not_found' });

/** Stage name normalization for counterpart matching: NFKC, lowercase, `_`, `-` and spaces collapsed. */
export function normalizeStageName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_-]+/gu, ' ')
    .trim();
}

function byKey<T>(items: readonly T[], key: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(key(item))) {
      map.set(key(item), item);
    }
  }
  return map;
}

/** The single item matching `predicate`, or undefined when none or several match. */
function single<T>(items: readonly T[], predicate: (item: T) => boolean): T | undefined {
  const matches = items.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}

type CompetitionResolution =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unavailable'; readonly availability: Availability; readonly meta: ListingMeta }
  | {
      readonly kind: 'found';
      readonly source: IngestionSource;
      readonly link: CatalogueLink | null;
      readonly competition: SourceCompetition;
      readonly name: string;
    };

type SeasonResolution =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unavailable'; readonly availability: Availability; readonly meta: ListingMeta }
  | { readonly kind: 'found'; readonly season: SourceSeason };

// ---------------------------------------------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------------------------------------------

/** Creates the catalogue service over the registry's enabled sources and the configured links. */
export function createCatalogueService(registry: SourceRegistry, links: CatalogueConfig): CatalogueService {
  /** The local key that a competition ID denotes for a source, or null when the ID is not in the catalogue. */
  function localKeyOf(
    competitionId: string,
    sourceId: string,
  ): { localKey: string; link: CatalogueLink | null } | null {
    const link = links.getLink(competitionId);
    if (link !== undefined) {
      const binding = link.bindings.find((candidate) => candidate.sourceId === sourceId);
      return binding === undefined ? null : { localKey: binding.competitionRef, link };
    }
    const prefix = `${sourceId}-`;
    if (links.restrictToLinks || !competitionId.startsWith(prefix)) {
      return null;
    }
    const localKey = competitionId.slice(prefix.length);
    // A competition bound by a link is offered only under the link's ID.
    return links.linkOfBinding(sourceId, localKey) === undefined ? { localKey, link: null } : null;
  }

  async function resolveCompetition(
    competitionId: string,
    sourceId: string,
    ctx: IngestionContext,
  ): Promise<CompetitionResolution> {
    const source = registry.get(sourceId);
    const key = source === undefined ? null : localKeyOf(competitionId, sourceId);
    if (source === undefined || key === null) {
      return { kind: 'not_found' };
    }
    const fetched = await fetchListing(sourceId, () => source.listCompetitions(ctx));
    if (!fetched.ok) {
      return { kind: 'unavailable', availability: fetched.availability, meta: fetched.meta };
    }
    const competition = byKey(fetched.listing.items, (item) => item.localKey).get(key.localKey);
    if (competition === undefined) {
      return { kind: 'not_found' };
    }
    return { kind: 'found', source, link: key.link, competition, name: key.link?.name ?? competition.name };
  }

  async function resolveSeason(
    source: IngestionSource,
    competition: SourceCompetition,
    seasonId: string,
    ctx: IngestionContext,
  ): Promise<SeasonResolution> {
    const fetched = await fetchListing(source.descriptor.id, () => source.listSeasons(competition.ref, ctx));
    if (!fetched.ok) {
      return { kind: 'unavailable', availability: fetched.availability, meta: fetched.meta };
    }
    const season = byKey(fetched.listing.items, (item) => item.id).get(seasonId);
    return season === undefined ? { kind: 'not_found' } : { kind: 'found', season };
  }

  /** Applies a link's `selectableStages` restriction (by canonical stage ID). */
  function selectableStages(
    link: CatalogueLink | null,
    sourceId: string,
    stages: readonly SourceStage[],
  ): SourceStage[] {
    const allowed = link?.selectableStages ?? null;
    if (link === null || allowed === null) {
      return [...stages];
    }
    const allowedSet = new Set(allowed);
    return stages.filter((stage) => allowedSet.has(links.stageAlias(link.id, sourceId, stage.id) ?? stage.id));
  }

  async function listCatalogue(ctx: IngestionContext): Promise<Catalogue> {
    const states = await Promise.all(
      registry.list().map(async (source) => ({
        descriptor: source.descriptor,
        fetched: await fetchListing(source.descriptor.id, () => source.listCompetitions(ctx)),
      })),
    );
    const stateById = new Map(states.map((state) => [state.descriptor.id, state]));
    const listedById = new Map(
      states.map((state) => [
        state.descriptor.id,
        state.fetched.ok ? byKey(state.fetched.listing.items, (item) => item.localKey) : null,
      ]),
    );

    const sourceListings: CatalogueSourceListing[] = states.map(({ descriptor, fetched }) => ({
      sourceId: descriptor.id,
      sourceName: descriptor.name,
      mode: descriptor.mode,
      availability: fetched.ok ? AVAILABLE : fetched.availability,
      listing: fetched.ok ? metaOf(fetched.listing) : fetched.meta,
    }));

    const entrySource = (descriptor: SourceDescriptor, availability: Availability): CatalogueCompetitionSource => ({
      sourceId: descriptor.id,
      sourceName: descriptor.name,
      mode: descriptor.mode,
      role: descriptor.role,
      selectable: descriptor.role === 'primary' && availability.available,
      availability,
    });

    const competitions: CatalogueCompetition[] = [];
    const usedIds = new Set<string>(links.links.map((link) => link.id));

    for (const link of links.links) {
      const sources: CatalogueCompetitionSource[] = [];
      let listed: SourceCompetition | undefined;
      let unknown = false;
      for (const binding of link.bindings) {
        const state = stateById.get(binding.sourceId);
        if (state === undefined) {
          continue; // a disabled source is not offered
        }
        const listing = listedById.get(binding.sourceId) ?? null;
        if (listing === null) {
          unknown = true;
          sources.push(entrySource(state.descriptor, state.fetched.ok ? NOT_FOUND : state.fetched.availability));
          continue;
        }
        const competition = listing.get(binding.competitionRef);
        if (competition === undefined) {
          sources.push(entrySource(state.descriptor, NOT_FOUND));
        } else {
          listed ??= competition;
          sources.push(entrySource(state.descriptor, AVAILABLE));
        }
      }
      // A link appears while one bound source lists the competition, or while a bound source cannot be asked.
      if (sources.length > 0 && (listed !== undefined || unknown)) {
        competitions.push({
          id: link.id,
          name: link.name,
          areaName: listed?.areaName ?? null,
          reference: link.reference,
          linkId: link.id,
          sources,
        });
      }
    }

    if (!links.restrictToLinks) {
      for (const state of states) {
        if (!state.fetched.ok) {
          continue;
        }
        for (const competition of state.fetched.listing.items) {
          if (links.linkOfBinding(state.descriptor.id, competition.localKey) !== undefined) {
            continue;
          }
          const id = `${state.descriptor.id}-${competition.localKey}`;
          if (id.length > MAX_SLUG_LENGTH || usedIds.has(id)) {
            continue; // never merged by name; a colliding or over-long ID is left out
          }
          usedIds.add(id);
          competitions.push({
            id,
            name: competition.name,
            areaName: competition.areaName,
            reference: false,
            linkId: null,
            sources: [entrySource(state.descriptor, AVAILABLE)],
          });
        }
      }
    }

    const ordered = [
      ...competitions.filter((competition) => competition.reference),
      ...competitions.filter((competition) => !competition.reference),
    ].slice(0, MAX_CATALOGUE_COMPETITIONS);

    return { competitions: ordered, sources: sourceListings };
  }

  async function listSeasons(competitionId: string, sourceId: string, ctx: IngestionContext): Promise<SeasonsLookup> {
    const resolved = await resolveCompetition(competitionId, sourceId, ctx);
    if (resolved.kind === 'not_found') {
      return { found: false };
    }
    if (resolved.kind === 'unavailable') {
      return {
        found: true,
        competitionId,
        sourceId,
        listing: unavailableListing(resolved.availability, resolved.meta),
      };
    }
    const fetched = await fetchListing(sourceId, () => resolved.source.listSeasons(resolved.competition.ref, ctx));
    return {
      found: true,
      competitionId,
      sourceId,
      listing: fetched.ok ? fetched.listing : unavailableListing(fetched.availability, fetched.meta),
    };
  }

  async function listStages(
    competitionId: string,
    sourceId: string,
    seasonId: string,
    ctx: IngestionContext,
  ): Promise<StagesLookup> {
    const resolved = await resolveCompetition(competitionId, sourceId, ctx);
    if (resolved.kind === 'not_found') {
      return { found: false };
    }
    const found = (listing: Listing<SourceStage>): StagesLookup => ({
      found: true,
      competitionId,
      sourceId,
      seasonId,
      listing,
    });
    if (resolved.kind === 'unavailable') {
      return found(unavailableListing(resolved.availability, resolved.meta));
    }
    const season = await resolveSeason(resolved.source, resolved.competition, seasonId, ctx);
    if (season.kind === 'not_found') {
      return { found: false };
    }
    if (season.kind === 'unavailable') {
      return found(unavailableListing(season.availability, season.meta));
    }
    const fetched = await fetchListing(sourceId, () =>
      resolved.source.listStages(resolved.competition.ref, season.season.ref, ctx),
    );
    if (!fetched.ok) {
      return found(unavailableListing(fetched.availability, fetched.meta));
    }
    return found({ ...fetched.listing, items: selectableStages(resolved.link, sourceId, fetched.listing.items) });
  }

  async function resolveSelection(request: SelectionRequest, ctx: IngestionContext): Promise<SelectionResolution> {
    const refuse = (
      reason: SelectionRefusalReason,
      availability: Availability,
      meta: ListingMeta = NO_META,
    ): SelectionResolution => ({ ok: false, reason, availability, retryAfterSeconds: meta.retryAfterSeconds });

    const source = registry.get(request.sourceId);
    if (source !== undefined && source.descriptor.role !== 'primary') {
      return refuse('source_not_selectable', NOT_FOUND);
    }
    const competition = await resolveCompetition(request.competitionId, request.sourceId, ctx);
    if (competition.kind === 'not_found') {
      return refuse('competition_unavailable', NOT_FOUND);
    }
    if (competition.kind === 'unavailable') {
      return refuse('competition_unavailable', competition.availability, competition.meta);
    }
    const season = await resolveSeason(competition.source, competition.competition, request.seasonId, ctx);
    if (season.kind === 'not_found') {
      return refuse('season_unavailable', NOT_FOUND);
    }
    if (season.kind === 'unavailable') {
      return refuse('season_unavailable', season.availability, season.meta);
    }
    const stages = await fetchListing(request.sourceId, () =>
      competition.source.listStages(competition.competition.ref, season.season.ref, ctx),
    );
    if (!stages.ok) {
      return refuse('stage_unavailable', stages.availability, stages.meta);
    }
    const stage = byKey(
      selectableStages(competition.link, request.sourceId, stages.listing.items),
      (item) => item.id,
    ).get(request.stageId);
    if (stage === undefined) {
      return refuse('stage_unavailable', NOT_FOUND);
    }
    let selectionRef: SourceRef | null;
    if (request.matchday === null) {
      selectionRef = stage.wholeStageRef;
    } else {
      const matchday = request.matchday;
      selectionRef = stage.matchdays.find((candidate) => candidate.number === matchday)?.ref ?? null;
    }
    if (selectionRef === null) {
      return refuse('stage_unavailable', NOT_FOUND);
    }
    return {
      ok: true,
      selection: {
        competitionId: request.competitionId,
        sourceId: request.sourceId,
        mode: competition.source.descriptor.mode,
        seasonId: season.season.id,
        stageId: stage.id,
        matchday: request.matchday,
        selectionRef,
        competitionName: competition.name,
        seasonLabel: season.season.label,
        stageName: stage.name,
        standingsExpected: stage.standings,
      },
    };
  }

  async function resolveCounterpart(
    selection: SelectionRequest,
    sourceId: string,
    ctx: IngestionContext,
  ): Promise<CounterpartResolution> {
    const fail = (reason: Exclude<CounterpartFailureReason, 'source_unavailable'>): CounterpartResolution => ({
      resolved: false,
      sourceId,
      reason,
    });
    const unavailable = (failure: CounterpartSourceFailure): CounterpartResolution => ({
      resolved: false,
      sourceId,
      reason: 'source_unavailable',
      failure,
    });

    const link = links.getLink(selection.competitionId);
    if (link === undefined) {
      return fail('not_linked');
    }
    const bindingOf = (id: string): string | undefined =>
      link.bindings.find((binding) => binding.sourceId === id)?.competitionRef;
    const ownKey = bindingOf(selection.sourceId);
    const targetKey = bindingOf(sourceId);
    const own = registry.get(selection.sourceId);
    const target = registry.get(sourceId);
    if (
      sourceId === selection.sourceId ||
      ownKey === undefined ||
      targetKey === undefined ||
      own === undefined ||
      target === undefined
    ) {
      return fail('source_not_bound');
    }

    // The selection as its own source lists it (season start year and label, stage name).
    const ownCompetitions = await fetchListing(own.descriptor.id, () => own.listCompetitions(ctx));
    const ownCompetition = ownCompetitions.ok
      ? byKey(ownCompetitions.listing.items, (item) => item.localKey).get(ownKey)
      : undefined;
    if (ownCompetition === undefined) {
      return fail('selection_not_listed');
    }
    const ownSeason = await resolveSeason(own, ownCompetition, selection.seasonId, ctx);
    if (ownSeason.kind !== 'found') {
      return fail('selection_not_listed');
    }
    const ownStages = await fetchListing(own.descriptor.id, () =>
      own.listStages(ownCompetition.ref, ownSeason.season.ref, ctx),
    );
    const ownStage = ownStages.ok
      ? byKey(ownStages.listing.items, (item) => item.id).get(selection.stageId)
      : undefined;
    if (ownStage === undefined) {
      return fail('selection_not_listed');
    }

    // The same selection in the counterpart source.
    const targetCompetitions = await fetchListing(sourceId, () => target.listCompetitions(ctx));
    if (!targetCompetitions.ok) {
      return unavailable(targetCompetitions.failure);
    }
    const targetCompetition = byKey(targetCompetitions.listing.items, (item) => item.localKey).get(targetKey);
    if (targetCompetition === undefined) {
      return fail('competition_not_listed');
    }
    const targetSeasons = await fetchListing(sourceId, () => target.listSeasons(targetCompetition.ref, ctx));
    if (!targetSeasons.ok) {
      return unavailable(targetSeasons.failure);
    }
    const { startYear, label } = ownSeason.season;
    const targetSeason = single(targetSeasons.listing.items, (season) =>
      startYear !== null && season.startYear !== null ? season.startYear === startYear : season.label === label,
    );
    if (targetSeason === undefined) {
      return fail('season_not_matched');
    }
    const targetStages = await fetchListing(sourceId, () =>
      target.listStages(targetCompetition.ref, targetSeason.ref, ctx),
    );
    if (!targetStages.ok) {
      return unavailable(targetStages.failure);
    }
    const aliasesInUse = link.stageAliases.has(selection.sourceId) || link.stageAliases.has(sourceId);
    let targetStage: SourceStage | undefined;
    if (aliasesInUse) {
      const canonical = links.stageAlias(link.id, selection.sourceId, ownStage.id) ?? ownStage.id;
      targetStage = single(
        targetStages.listing.items,
        (stage) => (links.stageAlias(link.id, sourceId, stage.id) ?? stage.id) === canonical,
      );
    } else {
      const name = normalizeStageName(ownStage.name);
      targetStage = single(targetStages.listing.items, (stage) => normalizeStageName(stage.name) === name);
    }
    if (targetStage === undefined) {
      return fail('stage_not_matched');
    }
    const matchday = selection.matchday;
    const selectionRef =
      matchday === null
        ? targetStage.wholeStageRef
        : (targetStage.matchdays.find((candidate) => candidate.number === matchday)?.ref ?? null);
    if (selectionRef === null) {
      return fail('matchday_not_matched');
    }
    return { resolved: true, sourceId, seasonId: targetSeason.id, stageId: targetStage.id, matchday, selectionRef };
  }

  function linkedSources(competitionId: string): readonly SourceDescriptor[] {
    const link = links.getLink(competitionId);
    if (link === undefined) {
      return [];
    }
    return link.bindings.flatMap((binding) => {
      const source = registry.get(binding.sourceId);
      return source === undefined ? [] : [source.descriptor];
    });
  }

  return Object.freeze({
    listCatalogue,
    listSeasons,
    listStages,
    resolveSelection,
    resolveCounterpart,
    linkedSources,
  });
}
