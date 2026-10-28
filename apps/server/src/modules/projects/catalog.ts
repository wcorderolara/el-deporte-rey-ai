/**
 * Settings and catalogue routes (contract operations getSettings, listCompetitions, listSeasons, listStages;
 * architecture.md section 15.2; R-141, R-243, R-282, R-284, R-286, R-291; T11H-F06; T10-F04).
 *
 * - Every handler is a GET without persistent side effects: the catalogue service may use the in-memory request
 *   budget and projection cache only.
 * - IDs are validated with the contract patterns, then resolved by the catalogue service against the current
 *   listings only: an unknown or no-longer-listed competition, source or season answers 404 without any provider
 *   request for that ID (T11H-F06). Fastify's automatic HEAD route runs the same handler.
 * - A listing the source refuses is answered with availability false and the reason (R-286); a stale cached
 *   listing is answered with its provenance (`stale`, `retrievedAt`); an exhausted budget with nothing cached
 *   answers 503 `PROVIDER_RATE_LIMITED` with `retryAfterSeconds` at once (R-291).
 */
import {
  type Catalogue,
  CatalogueSchema,
  type ListingMeta,
  SeasonListParamsSchema,
  type SeasonList,
  SeasonListSchema,
  type Settings,
  SettingsSchema,
  StageListParamsSchema,
  type StageList,
  StageListSchema,
} from '@edr/contracts';
import type { FastifyInstance } from 'fastify';

import type { AppContainer } from '../../container.js';
import { HttpProblem } from '../../platform/http/index.js';
import type { Availability, CatalogueService, IngestionContext, Listing } from '../../providers/sports/index.js';

import { contractResponse } from './respond.js';

/** Contract form of an availability: `reason` is null when available. */
export function availabilityOf(availability: Availability): {
  available: boolean;
  reason: Exclude<Availability, { available: true }>['reason'] | null;
} {
  return availability.available ? { available: true, reason: null } : { available: false, reason: availability.reason };
}

function metaOf(listing: Omit<Listing<unknown>, 'items' | 'availability'>): ListingMeta {
  return {
    retrievedAt: listing.retrievedAt,
    fromCache: listing.fromCache,
    stale: listing.stale,
    retryAfterSeconds: listing.retryAfterSeconds,
  };
}

/** A discovery context for one request. */
export function discoveryContext(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'discovery' };
}

/** The catalogue service of the container; its absence is a server defect (500). */
export function catalogueOf(container: AppContainer): CatalogueService {
  const catalogue = container.catalogue as CatalogueService | null;
  if (catalogue === null) {
    throw new Error('the catalogue service is not available');
  }
  return catalogue;
}

/** 503 when the request budget is exhausted and nothing is cached (R-291). */
function rateLimitedProblem(retryAfterSeconds: number | null): HttpProblem {
  return new HttpProblem(
    503,
    'PROVIDER_RATE_LIMITED',
    'The request budget of the data source is exhausted and no cached listing exists.',
    { retryAfterSeconds },
  );
}

function notFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'The competition, data source or season is not in the current catalogue.');
}

/** Refuses a listing that is unavailable only because the budget is exhausted. */
function checkRateLimited(listing: Listing<unknown>): void {
  if (!listing.availability.available && listing.availability.reason === 'rate_limited') {
    throw rateLimitedProblem(listing.retryAfterSeconds);
  }
}

/** The settings view (R-226): non-secret values only, never options, base URLs or credentials. */
export function settingsOf(container: AppContainer): Settings {
  const { config } = container;
  const sources = config.providers.sports.sources;
  const dataModes = [...new Set(sources.filter((source) => source.enabled).map((source) => source.mode))];
  return {
    languages: config.languages.languages.map((language) => ({ code: language.code, label: language.label })),
    defaultLanguage: config.languages.defaultLanguage,
    format: {
      width: config.format.width,
      height: config.format.height,
      maxSlidesPerCarousel: config.format.maxSlidesPerCarousel,
    },
    publicationMode: config.publicationMode,
    dataModes,
    verificationPolicy: {
      manuallyApprovedPublication: config.verificationPolicy.manuallyApprovedPublication,
      livePublicationPermissionRule: config.verificationPolicy.livePublicationPermissionRule,
    },
    providers: {
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        mode: source.mode,
        role: source.role,
        officialPublication: source.officialPublication,
        accepted: source.accepted,
        enabled: source.enabled,
        publicationPermission: source.publicationPermission,
      })),
      ai: config.providers.ai.adapter,
    },
  };
}

/** The contract catalogue (R-073, R-282): competitions with their sources and availability, per-source provenance. */
export async function catalogueView(container: AppContainer): Promise<Catalogue> {
  const catalogue = await catalogueOf(container).listCatalogue(discoveryContext());
  return {
    competitions: catalogue.competitions.map((competition) => ({
      id: competition.id,
      name: competition.name,
      areaName: competition.areaName,
      reference: competition.reference,
      sources: competition.sources.map((source) => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        mode: source.mode,
        selectable: source.selectable,
        availability: availabilityOf(source.availability),
      })),
    })),
    sources: catalogue.sources.map((source) => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      mode: source.mode,
      availability: availabilityOf(source.availability),
      listing: metaOf(source.listing),
    })),
  };
}

export async function seasonListView(
  container: AppContainer,
  competitionId: string,
  sourceId: string,
): Promise<SeasonList> {
  const lookup = await catalogueOf(container).listSeasons(competitionId, sourceId, discoveryContext());
  if (!lookup.found) {
    throw notFound();
  }
  const { listing } = lookup;
  checkRateLimited(listing);
  return {
    competitionId: lookup.competitionId,
    sourceId: lookup.sourceId,
    availability: availabilityOf(listing.availability),
    listing: metaOf(listing),
    seasons: listing.items.map((season) => ({
      id: season.id,
      label: season.label,
      current: season.current,
      startDate: season.startDate,
      endDate: season.endDate,
    })),
  };
}

export async function stageListView(
  container: AppContainer,
  competitionId: string,
  sourceId: string,
  seasonId: string,
): Promise<StageList> {
  const lookup = await catalogueOf(container).listStages(competitionId, sourceId, seasonId, discoveryContext());
  if (!lookup.found) {
    throw notFound();
  }
  const { listing } = lookup;
  checkRateLimited(listing);
  return {
    competitionId: lookup.competitionId,
    sourceId: lookup.sourceId,
    seasonId: lookup.seasonId,
    availability: availabilityOf(listing.availability),
    listing: metaOf(listing),
    // Every stage the source reports is listed, by its own name, in the source's order (R-077, R-283, R-284).
    stages: [...listing.items]
      .sort((a, b) => a.order - b.order)
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        order: stage.order,
        standings: stage.standings,
        selectableAsWhole: stage.wholeStageRef !== null,
        matchdays: stage.matchdays.map((matchday) => matchday.number),
        availability: { available: true, reason: null },
      })),
  };
}

/** Registers the settings and catalogue routes (under /api/v1). */
export function registerCatalogRoutes(app: FastifyInstance, container: AppContainer): void {
  app.get('/settings', async () => contractResponse(SettingsSchema, settingsOf(container)));

  app.get('/catalog/competitions', async () => contractResponse(CatalogueSchema, await catalogueView(container)));

  app.get('/catalog/competitions/:competitionId/sources/:sourceId/seasons', async (request) => {
    const params = SeasonListParamsSchema.parse(request.params);
    return contractResponse(SeasonListSchema, await seasonListView(container, params.competitionId, params.sourceId));
  });

  app.get('/catalog/competitions/:competitionId/sources/:sourceId/seasons/:seasonId/stages', async (request) => {
    const params = StageListParamsSchema.parse(request.params);
    return contractResponse(
      StageListSchema,
      await stageListView(container, params.competitionId, params.sourceId, params.seasonId),
    );
  });
}
