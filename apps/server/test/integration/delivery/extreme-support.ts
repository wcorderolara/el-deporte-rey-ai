/**
 * Support of the UI-06.3 edge-case suites (`extreme-carousels.test.ts`, `extreme-sports-data.test.ts`): a temporary
 * app with the operator-validated local sports source (the same source entry the PD-ARCH-01E suites configure), a
 * builder of synthetic local competitions through the HTTP API (the calls the Competiciones pages make), content
 * batches waited until every run has stopped, synthetic badge uploads and a reader of the store-method ZIP of an
 * export download. Every name is synthetic (Club Sintético …, Liga Sintética …); every directory is temporary.
 */
import { type ContentBatch, ContentBatchSchema } from '@edr/contracts';
import { expect } from 'vitest';

import { png } from '../../../src/modules/brand/test/images.js';
import type { Json, TestApp, TestAppOptions } from '../../support/index.js';
import { type Cleanup, start } from '../ingestion/support.js';

import { waitForRun } from './support.js';

/** The local competitions source (MANUAL_DATA, operator-validated: PD-ARCH-01E-PD-01). */
export const LOCAL_SOURCE: Json = Object.freeze({
  id: 'local',
  name: 'Datos deportivos locales',
  mode: 'MANUAL_DATA',
  enabled: true,
  role: 'primary',
  accepted: false,
  independenceGroup: 'local',
  officialPublication: false,
  publicationPermission: 'not_applicable',
  adapter: 'local-competitions',
  operatorValidated: true,
  options: {},
}) as Json;

/** A `demo-manual` app with the local source added; `mutate` changes the document further. */
export function localApp(cleanup: Cleanup, options: Partial<TestAppOptions> = {}): Promise<TestApp> {
  const { mutate, ...rest } = options;
  return start(cleanup, {
    base: 'demo-manual',
    scenario: 'default',
    ...rest,
    mutate: (document: Json) => {
      const sports = (document['providers'] as Json)['sports'] as Json;
      (sports['sources'] as Json[]).push({ ...LOCAL_SOURCE });
      mutate?.(document);
    },
  });
}

type Answer = Promise<{ statusCode: number; body: string; json(): unknown }>;

/** A 200, 201 or 202 answer; returns its body. */
export async function ok<T>(response: Answer): Promise<T> {
  const answer = await response;
  expect([200, 201, 202], answer.body).toContain(answer.statusCode);
  return answer.json() as T;
}

/** Request keys unique to a suite: `prefix` is a hexadecimal digit per file. */
export function requestKeys(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `00000000-0000-4000-8000-${prefix}${String(counter).padStart(11, '0')}`;
  };
}

export interface MatchResult {
  readonly status: 'scheduled' | 'in_progress' | 'finished' | 'postponed' | 'cancelled';
  readonly homeScore: number | null;
  readonly awayScore: number | null;
}

/** A finished match with its score. */
export function finished(homeScore: number, awayScore: number): MatchResult {
  return { status: 'finished', homeScore, awayScore };
}

/** A local competition with one season, built through the API. */
export interface LocalCompetition {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly base: string;
  /** Team IDs by name (every team is a participant of the season). */
  readonly teams: Readonly<Record<string, string>>;
  team(name: string): string;
  /** Creates a round (optionally in a stage); returns its ID. */
  round(name: string, stageId?: string): Promise<string>;
  /** Creates a stage; returns its ID. */
  stage(name: string): Promise<string>;
  /** Creates a match of a round and records its result when given; returns the match ID. */
  match(home: string, away: string, roundId: string, kickoffAt: string | null, result?: MatchResult): Promise<string>;
  /** The batch selection of matches of a round. */
  selection(
    roundId: string,
    matchIds: readonly string[],
    kinds: readonly string[],
    stageId?: string | null,
  ): ContentSelection;
}

export interface ContentSelection {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly stageId: string | null;
  readonly roundId: string;
  readonly matchIds: readonly string[];
  readonly kinds: readonly string[];
}

type Client = Pick<TestApp, 'send' | 'get'>;

/** Creates a competition, a season and the named teams as participants. */
export async function localCompetition(
  t: Client,
  options: { readonly name: string; readonly season: string; readonly teams: readonly string[] },
): Promise<LocalCompetition> {
  const competitionId = (await ok<{ id: string }>(t.send('POST', '/competitions', { name: options.name }))).id;
  const seasonId = (
    await ok<{ id: string }>(t.send('POST', `/competitions/${competitionId}/seasons`, { label: options.season }))
  ).id;
  const base = `/competitions/${competitionId}/seasons/${seasonId}`;
  const teams: Record<string, string> = {};
  for (const name of options.teams) {
    const team = await ok<{ id: string }>(t.send('POST', '/teams', { name }));
    await ok(t.send('POST', `/competitions/${competitionId}/teams`, { teamId: team.id }));
    teams[name] = team.id;
  }
  await ok(t.send('POST', `${base}/participants/batch`, { teamIds: Object.values(teams) }));
  const team = (name: string): string => {
    const id = teams[name];
    if (id === undefined) {
      throw new Error(`unknown team ${name}`);
    }
    return id;
  };
  return {
    competitionId,
    seasonId,
    base,
    teams,
    team,
    stage: async (name) => (await ok<{ id: string }>(t.send('POST', `${base}/stages`, { name }))).id,
    round: async (name, stageId) =>
      (
        await ok<{ id: string }>(
          t.send('POST', stageId === undefined ? `${base}/rounds` : `${base}/stages/${stageId}/rounds`, { name }),
        )
      ).id,
    match: async (home, away, roundId, kickoffAt, result) => {
      const created = await ok<{ id: string }>(
        t.send('POST', `${base}/matches`, {
          homeTeamId: team(home),
          awayTeamId: team(away),
          kickoffAt,
          stageId: null,
          roundId,
        }),
      );
      if (result !== undefined) {
        await ok(t.send('POST', `${base}/matches/${created.id}/result`, result));
      }
      return created.id;
    },
    selection: (roundId, matchIds, kinds, stageId = null) => ({
      competitionId,
      seasonId,
      stageId,
      roundId,
      matchIds,
      kinds,
    }),
  };
}

/** `Club Sintético 01` … `Club Sintético <count>`. */
export function syntheticTeams(count: number, prefix = 'Club Sintético'): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`);
}

/** A kickoff instant on a day of December 2026 and an hour (UTC), so that the matches have a known order. */
export function kickoff(day: number, hour = 18): string {
  return `2026-12-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

/** Creates a batch (202) and waits until every run of it has stopped; returns the batch as the API then reports it. */
export async function generate(t: Client, body: unknown): Promise<ContentBatch> {
  const response = await t.send('POST', '/content-batches', body);
  expect(response.statusCode, response.body).toBe(202);
  const batch = ContentBatchSchema.parse(response.json());
  for (const item of batch.items) {
    if (item.projectId !== null && item.runId !== null) {
      await waitForRun(t as Parameters<typeof waitForRun>[0], item.projectId, item.runId);
    }
  }
  return ContentBatchSchema.parse(await ok(t.get(`/content-batches/${batch.id}`)));
}

/** Uploads a synthetic solid-colour PNG badge with the declared authorization (PD-28); returns the badge ID. */
export async function uploadBadge(
  t: Pick<TestApp, 'inject' | 'host' | 'origin'>,
  teamId: string,
  rgb: readonly [number, number, number],
): Promise<string> {
  const response = await t.inject({
    method: 'PUT',
    url: `/api/v1/teams/${teamId}/badge`,
    query: { source: 'Archivo sintético de prueba', authorized: 'true' },
    headers: { host: t.host, origin: t.origin, 'x-edr-client': 'web', 'content-type': 'image/png' },
    payload: png({ width: 64, height: 64, rgba: [...rgb, 255] }),
  });
  expect(response.statusCode, response.body).toBe(200);
  return (response.json() as { badge: { id: string } }).badge.id;
}

export interface ZipEntryView {
  readonly name: string;
  readonly bytes: Buffer;
}

/** The entries of a store-method ZIP (the export download), in archive order. */
export function zipEntries(zip: Buffer): ZipEntryView[] {
  const entries: ZipEntryView[] = [];
  let offset = 0;
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    if (method !== 0) {
      throw new Error('the archive entry is compressed');
    }
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    entries.push({
      name: zip.toString('utf8', nameStart, nameStart + nameLength),
      bytes: zip.subarray(dataStart, dataStart + size),
    });
    offset = dataStart + size;
  }
  return entries;
}
