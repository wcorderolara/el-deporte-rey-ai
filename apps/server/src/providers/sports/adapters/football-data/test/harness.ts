/**
 * Test-only harness of the football-data adapter tests (T49): the adapter on a virtual clock, a replay transport,
 * a capturing logger, a deterministic random source and an optional observation log. No socket is opened.
 */
import type { EnvironmentSource } from '../../../../../platform/config/index.js';
import type {
  IngestionContext,
  Listing,
  SourceCompetition,
  SourceRef,
  SourceSeason,
  SourceStage,
} from '../../../ingestion/index.js';
import { VirtualClock, fixedRandom } from '../../../support/test/virtual-clock.js';
import { CapturingLogger } from '../../../test/synthetic.js';
import { TOKEN_VARIABLE } from '../constants.js';
import type { RequestObservation } from '../observation.js';
import { type FootballDataSource, createFootballDataSource } from '../provider.js';

import { BASE_OPTIONS, type Json, ReplayEgress, adapterContext } from './replay.js';

/** Start of the virtual time line: the fixtures' "now" (matchday 2 of the current season is in progress). */
export const HARNESS_START = '2026-10-27T12:00:00.000Z';

export interface Harness {
  readonly clock: VirtualClock;
  readonly egress: ReplayEgress;
  readonly logger: CapturingLogger;
  readonly source: FootballDataSource;
  readonly observations: RequestObservation[];
}

export interface HarnessOptions {
  /** Token placed in the injected environment; null for none. */
  readonly token: string | null;
  readonly options?: Json;
  readonly env?: EnvironmentSource;
  readonly random?: readonly number[];
  readonly observe?: boolean;
}

export function harness(settings: HarnessOptions): Harness {
  const clock = new VirtualClock(HARNESS_START);
  const egress = new ReplayEgress(clock);
  const logger = new CapturingLogger();
  const observations: RequestObservation[] = [];
  const env: EnvironmentSource = settings.env ?? (settings.token === null ? {} : { [TOKEN_VARIABLE]: settings.token });
  const source = createFootballDataSource(
    adapterContext({ egress, clock, logger, env, options: settings.options ?? BASE_OPTIONS }),
    {
      random: fixedRandom(settings.random ?? [0.5]),
      ...(settings.observe === true ? { observer: (o: RequestObservation) => observations.push(o) } : {}),
    },
  );
  return { clock, egress, logger, source, observations };
}

export function discoveryCtx(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'discovery' };
}

export function researchCtx(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'research' };
}

/** A reference that must exist, or a failing test. */
export function refOf(ref: SourceRef | null | undefined): SourceRef {
  if (ref === null || ref === undefined) {
    throw new Error('expected reference missing');
  }
  return ref;
}

/** The item with `predicate`, or a failing test. */
export function pick<T>(listing: Listing<T>, predicate: (item: T) => boolean): T {
  const item = listing.items.find(predicate);
  if (item === undefined) {
    throw new Error('expected item not listed');
  }
  return item;
}

export interface Walk {
  readonly competitions: Listing<SourceCompetition>;
  readonly seasons: Listing<SourceSeason>;
  readonly stages: Listing<SourceStage>;
}

/**
 * Lists competitions, the seasons of the reference competition and the stages of season `seasonId`, serving the
 * reference-shaped fixtures.
 */
export async function walkReference(h: Harness, seasonId = '2026'): Promise<Walk> {
  h.egress
    .serve('competitions.json')
    .serve('competition-cl.json')
    .serve('cl-matches-2026.json')
    .serve('cl-matches-2025.json');
  const competitions = await h.clock.run(h.source.listCompetitions(discoveryCtx()));
  const cl = pick(competitions, (item) => item.localKey === 'cl');
  const seasons = await h.clock.run(h.source.listSeasons(cl.ref, discoveryCtx()));
  const season = pick(seasons, (item) => item.id === seasonId);
  const stages = await h.clock.run(h.source.listStages(cl.ref, season.ref, discoveryCtx()));
  return { competitions, seasons, stages };
}
