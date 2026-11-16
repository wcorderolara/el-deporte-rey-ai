/**
 * PD-ARCH-01E-A: content generation batches over locally managed sports data, through the real server, the real
 * workflow stages (research, verification, content with the stub AI, rendering, visual QA) and the real SQLite
 * database. Every competition, team and match is synthetic and created through the API of a temporary app.
 *
 * Covered: preview without writes, eligibility (unknown `null/null` scores, past kickoffs that are not finished),
 * correctly scoped drafts for different match subsets, idempotent retries and concurrent double submissions, the
 * project's local sports context, effective values after a protected manual override, partial failures, refusals,
 * and no egress at all during generation.
 */
import {
  type ContentBatch,
  ContentBatchPreviewSchema,
  ContentBatchSchema,
  type Draft,
  ProjectListResponseSchema,
} from '@edr/contracts';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { researchStage } from '../../../src/modules/research/index.js';
import type { AnyStage } from '../../../src/workflow/index.js';
import type { Json, TestApp, TestAppOptions } from '../../support/index.js';
import { cleanups, start, startRootedApp } from '../ingestion/support.js';

import {
  WORKFLOW_TEST_TIMEOUT,
  approveDraft,
  approveFactsManually,
  demoWithManualDocument,
  draftOf,
  expectProblem,
  factsOf,
  fieldText,
  exported,
  getProject,
  slidesOfType,
  waitForRun,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const LOCAL_SOURCE: Json = {
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
};

function localApp(options: Partial<TestAppOptions> = {}): Promise<TestApp> {
  return start(cleanup, {
    base: 'demo-manual',
    scenario: 'default',
    mutate: (document: Json) => {
      const sports = (document['providers'] as Json)['sports'] as Json;
      (sports['sources'] as Json[]).push(LOCAL_SOURCE);
    },
    ...options,
  });
}

let keyCounter = 0;
/** A fresh request key per confirmation. */
function requestKey(): string {
  keyCounter += 1;
  return `00000000-0000-4000-8000-${String(keyCounter).padStart(12, '0')}`;
}

async function created<T>(response: Promise<{ statusCode: number; body: string; json(): unknown }>): Promise<T> {
  const answer = await response;
  expect([200, 201], answer.body).toContain(answer.statusCode);
  return answer.json() as T;
}

interface Seed {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  readonly otherRoundId: string;
  /** A-B finished 2-1, C-D finished 0-0, E-F scheduled with a past kickoff, B-C finished with an unknown score. */
  readonly matches: { readonly ab: string; readonly cd: string; readonly ef: string; readonly bc: string };
  readonly otherRoundMatch: string;
}

type Client = Pick<TestApp, 'get' | 'send' | 'container'>;

/**
 * Creates a local competition (or uses one inserted with a known ID), a season, two rounds, six teams and five
 * matches through the API.
 */
async function seed(t: Client, fixedCompetitionId?: string): Promise<Seed & { readonly teamIds: readonly string[] }> {
  let competitionId: string;
  if (fixedCompetitionId === undefined) {
    competitionId = (await created<{ id: string }>(t.send('POST', '/competitions', { name: 'Liga Local' }))).id;
  } else {
    t.container.db
      .prepare('INSERT INTO competitions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run([fixedCompetitionId, 'Liga Local', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
    competitionId = fixedCompetitionId;
  }
  const season = await created<{ id: string }>(
    t.send('POST', `/competitions/${competitionId}/seasons`, { label: '2026/27' }),
  );
  const seasonId = season.id;
  const base = `/competitions/${competitionId}/seasons/${seasonId}`;
  const names = ['Club Alfa', 'Club Beta', 'Club Gamma', 'Club Delta', 'Club Epsilon', 'Club Zeta'];
  const teams: string[] = [];
  for (const name of names) {
    const team = await created<{ id: string }>(t.send('POST', '/teams', { name }));
    await created(t.send('POST', `/competitions/${competitionId}/teams`, { teamId: team.id }));
    teams.push(team.id);
  }
  await created(t.send('POST', `${base}/participants/batch`, { teamIds: teams }));
  const round = await created<{ id: string }>(t.send('POST', `${base}/rounds`, { name: 'Jornada 12' }));
  const otherRound = await created<{ id: string }>(t.send('POST', `${base}/rounds`, { name: 'Jornada 13' }));
  const match = async (
    home: number,
    away: number,
    roundId: string,
    kickoffAt: string,
    result: { status: string; homeScore: number | null; awayScore: number | null } | null,
  ): Promise<string> => {
    const created_ = await created<{ id: string }>(
      t.send('POST', `${base}/matches`, {
        homeTeamId: teams[home],
        awayTeamId: teams[away],
        kickoffAt,
        stageId: null,
        roundId,
      }),
    );
    if (result !== null) {
      await created(t.send('POST', `${base}/matches/${created_.id}/result`, result));
    }
    return created_.id;
  };
  const ab = await match(0, 1, round.id, '2026-10-20T18:00:00.000Z', {
    status: 'finished',
    homeScore: 2,
    awayScore: 1,
  });
  const cd = await match(2, 3, round.id, '2026-10-20T20:00:00.000Z', {
    status: 'finished',
    homeScore: 0,
    awayScore: 0,
  });
  // A kickoff in the past does not make a match finished.
  const ef = await match(4, 5, round.id, '2026-01-01T12:00:00.000Z', null);
  // Finished without a score: an unknown result, never 0-0.
  const bc = await match(1, 2, round.id, '2026-10-21T18:00:00.000Z', {
    status: 'finished',
    homeScore: null,
    awayScore: null,
  });
  const otherRoundMatch = await match(0, 2, otherRound.id, '2026-10-27T18:00:00.000Z', {
    status: 'finished',
    homeScore: 3,
    awayScore: 3,
  });
  return {
    competitionId,
    seasonId,
    roundId: round.id,
    otherRoundId: otherRound.id,
    matches: { ab, cd, ef, bc },
    otherRoundMatch,
    teamIds: teams,
  };
}

function selection(s: Seed, matchIds: readonly string[], kinds: readonly string[]) {
  return { competitionId: s.competitionId, seasonId: s.seasonId, stageId: null, roundId: s.roundId, matchIds, kinds };
}

async function createBatch(t: Client, body: unknown): Promise<ContentBatch> {
  const response = await t.send('POST', '/content-batches', body);
  expect(response.statusCode, response.body).toBe(202);
  return ContentBatchSchema.parse(response.json());
}

/** Waits until every run of the batch has stopped; returns the batch as the API then reports it. */
async function settledBatch(t: Client, batch: ContentBatch): Promise<ContentBatch> {
  for (const item of batch.items) {
    if (item.projectId !== null && item.runId !== null) {
      await waitForRun(t, item.projectId, item.runId);
    }
  }
  const response = await t.get(`/content-batches/${batch.id}`);
  expect(response.statusCode, response.body).toBe(200);
  return ContentBatchSchema.parse(response.json());
}

/** `home|away|score` of every match slide of a draft. */
function matchLines(draft: Draft): string[] {
  return draft.carousels.flatMap((carousel) =>
    slidesOfType(carousel, 'match_result').map((slide) =>
      ['team_home', 'team_away', 'score'].map((field) => fieldText(slide, field)).join('|'),
    ),
  );
}

const COUNTS = {
  content_generation_batches: 'SELECT COUNT(*) AS n FROM content_generation_batches',
  content_generation_items: 'SELECT COUNT(*) AS n FROM content_generation_items',
  workflow_runs: 'SELECT COUNT(*) AS n FROM workflow_runs',
} as const;

function count(t: TestApp, table: keyof typeof COUNTS): number {
  return t.container.db.prepare<{ n: number }>(COUNTS[table]).get()?.n ?? 0;
}

async function projectCount(t: TestApp): Promise<number> {
  const response = await t.get('/projects');
  return ProjectListResponseSchema.parse(response.json()).projects.length;
}

describe('content batch preview (PD-ARCH-01E-A)', () => {
  it('plans every piece from the effective local values and writes nothing', async () => {
    const t = await localApp();
    const s = await seed(t);
    const { ab, cd, ef, bc } = s.matches;
    const response = await t.send(
      'POST',
      '/content-batches/previews',
      selection(s, [ef, bc, cd, ab], ['match_result', 'round_results']),
    );
    expect(response.statusCode, response.body).toBe(200);
    const preview = ContentBatchPreviewSchema.parse(response.json());

    expect(preview.context).toMatchObject({
      competitionName: 'Liga Local',
      seasonLabel: '2026/27',
      roundName: 'Jornada 12',
    });
    expect(preview.selectionLabel).toBe('Jornada 12');
    // Calendar order, whatever the request order.
    expect(preview.matches.map((match) => [match.matchId, match.ineligibility])).toEqual([
      [ef, 'not_finished'],
      [ab, null],
      [cd, null],
      [bc, 'score_missing'],
    ]);
    const unknown = preview.matches.find((match) => match.matchId === bc);
    expect(unknown).toMatchObject({ status: 'finished', homeScore: null, awayScore: null });
    expect(preview.pieces.map((piece) => [piece.kind, piece.title, piece.status, piece.skipReason])).toEqual([
      ['round_results', 'Resultados · Jornada 12', 'ready', null],
      ['match_result', 'Club Epsilon - Club Zeta', 'skipped', 'not_finished'],
      ['match_result', 'Club Alfa - Club Beta', 'ready', null],
      ['match_result', 'Club Gamma - Club Delta', 'ready', null],
      ['match_result', 'Club Beta - Club Gamma', 'skipped', 'score_missing'],
    ]);
    expect(preview.pieces[0]?.matchIds).toEqual([ab, cd]);
    expect(preview.totals).toEqual({ requested: 5, ready: 3, skipped: 2 });
    expect(preview.templates.map((template) => template.slideType)).toEqual(['cover', 'match_result', 'closing']);

    expect(count(t, 'content_generation_batches')).toBe(0);
    expect(await projectCount(t)).toBe(0);
    expect(t.egress.requests).toHaveLength(0);
  });

  it('refuses a match of another round, a wrong stage and an unknown round with 404', async () => {
    const t = await localApp();
    const s = await seed(t);
    expectProblem(
      await t.send('POST', '/content-batches/previews', selection(s, [s.otherRoundMatch], ['round_results'])),
      404,
      'NOT_FOUND',
    );
    expectProblem(
      await t.send('POST', '/content-batches/previews', {
        ...selection(s, [s.matches.ab], ['round_results']),
        stageId: s.roundId,
      }),
      404,
      'NOT_FOUND',
    );
    expectProblem(
      await t.send('POST', '/content-batches/previews', {
        ...selection(s, [s.matches.ab], ['round_results']),
        roundId: s.otherRoundId,
      }),
      404,
      'NOT_FOUND',
    );
  });
});

describe('content batch generation through the existing workflow (PD-ARCH-01E-A)', () => {
  it(
    "generates correctly scoped drafts for different match subsets and keeps each piece's sports context",
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const { ab, cd, ef, bc } = s.matches;

      const full = await settledBatch(
        t,
        await createBatch(t, {
          requestKey: requestKey(),
          selection: selection(s, [ab, cd, ef, bc], ['round_results', 'match_result']),
        }),
      );
      expect(full.state, JSON.stringify(full.items)).toBe('completed');
      expect(full.totals).toEqual({ requested: 5, generated: 3, failed: 0, skipped: 2, pending: 0, deleted: 0 });
      const [roundPiece, ...matchPieces] = full.items;
      expect(roundPiece).toMatchObject({ kind: 'round_results', status: 'completed', matchIds: [ab, cd] });
      expect(matchLines(await draftOf(t, roundPiece?.projectId ?? ''))).toEqual([
        'Club Alfa|Club Beta|2-1',
        'Club Gamma|Club Delta|0-0',
      ]);
      const generated = matchPieces.filter((item) => item.status === 'completed');
      expect(generated.map((item) => item.matchIds)).toEqual([[ab], [cd]]);
      expect(matchLines(await draftOf(t, generated[0]?.projectId ?? ''))).toEqual(['Club Alfa|Club Beta|2-1']);
      expect(matchLines(await draftOf(t, generated[1]?.projectId ?? ''))).toEqual(['Club Gamma|Club Delta|0-0']);
      expect(
        matchPieces.filter((item) => item.status === 'skipped').map((item) => [item.skipReason, item.projectId]),
      ).toEqual([
        ['not_finished', null],
        ['score_missing', null],
      ]);

      // A different subset: only the 0-0 match.
      const subset = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [cd], ['round_results']) }),
      );
      expect(subset.totals).toMatchObject({ requested: 1, generated: 1 });
      expect(matchLines(await draftOf(t, subset.items[0]?.projectId ?? ''))).toEqual(['Club Gamma|Club Delta|0-0']);

      // Every generated project keeps its local sports context and is listed with the other projects.
      const project = await getProject(t, generated[0]?.projectId ?? '');
      expect(project.sportsContext).toEqual({
        batchId: full.id,
        itemId: generated[0]?.id,
        kind: 'match_result',
        competitionId: s.competitionId,
        competitionName: 'Liga Local',
        seasonId: s.seasonId,
        seasonLabel: '2026/27',
        stageId: null,
        stageName: null,
        roundId: s.roundId,
        roundName: 'Jornada 12',
        matchIds: [ab],
      });
      expect(project.title).toBe('Liga Local 2026/27 · Jornada 12 · Club Alfa - Club Beta');
      expect(project.dataMode).toBe('MANUAL_DATA');
      const roundProject = await getProject(t, roundPiece?.projectId ?? '');
      expect(roundProject.sportsContext).toMatchObject({ kind: 'round_results', matchIds: [ab, cd] });
      expect(await projectCount(t)).toBe(4);
      // No provider and no network during generation.
      expect(t.egress.requests).toHaveLength(0);

      // Each confirmed batch is frozen as one form import of the local source, one version per generated piece, and
      // every fact of a piece traces back to its version.
      const imports = (await t.get('/imports')).json() as {
        imports: { channel: string; declaredSource: string | null; selections: { versionId: string }[] }[];
      };
      const frozen = imports.imports.filter((entry) => entry.declaredSource === 'Selección local confirmada');
      expect(frozen.map((entry) => [entry.channel, entry.selections.length])).toEqual(
        expect.arrayContaining([
          ['form', 3],
          ['form', 1],
        ]),
      );
      const versionIds = new Set(frozen.flatMap((entry) => entry.selections.map((selection) => selection.versionId)));
      const facts = await factsOf(t, roundPiece?.projectId ?? '', roundPiece?.runId ?? '');
      const evidenceVersions = new Set(
        facts.facts.flatMap((fact) => fact.evidence.map((evidence) => evidence.importVersionId)),
      );
      expect(evidenceVersions.size).toBe(1);
      expect(versionIds.has([...evidenceVersions][0] ?? '')).toBe(true);

      // The local source is not a catalogue source and adds nothing to the manual catalogue.
      const catalogue = JSON.stringify((await t.get('/catalog/competitions')).json());
      expect(catalogue).not.toContain('lb-');
      expect(catalogue).not.toContain(s.competitionId);
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'freezes the values at confirmation: a later local edit does not change a re-run of the same piece',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const batch = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [s.matches.ab], ['round_results']) }),
      );
      const projectId = batch.items[0]?.projectId ?? '';
      await created(
        t.send('POST', `/competitions/${s.competitionId}/seasons/${s.seasonId}/matches/${s.matches.ab}/result`, {
          status: 'finished',
          homeScore: 4,
          awayScore: 1,
        }),
      );
      const rerun = await t.send('POST', `/projects/${projectId}/runs`, { kind: 'full' });
      expect(rerun.statusCode, rerun.body).toBe(202);
      await waitForRun(t, projectId, (rerun.json() as { id: string }).id);
      expect(matchLines(await draftOf(t, projectId))).toEqual(['Club Alfa|Club Beta|2-1']);
      // A new confirmation uses the corrected value.
      const next = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [s.matches.ab], ['round_results']) }),
      );
      expect(matchLines(await draftOf(t, next.items[0]?.projectId ?? ''))).toEqual(['Club Alfa|Club Beta|4-1']);
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'returns the same batch for a retried or doubled confirmation and refuses a reused key',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const key = requestKey();
      const body = { requestKey: key, selection: selection(s, [s.matches.ab, s.matches.cd], ['match_result']) };

      const [first, second] = await Promise.all([
        t.send('POST', '/content-batches', body),
        t.send('POST', '/content-batches', body),
      ]);
      expect([first.statusCode, second.statusCode]).toEqual([202, 202]);
      const batch = ContentBatchSchema.parse(first.json());
      expect(ContentBatchSchema.parse(second.json()).id).toBe(batch.id);
      await settledBatch(t, batch);

      const retried = await createBatch(t, body);
      expect(retried.id).toBe(batch.id);
      expect(retried.items.map((item) => item.projectId)).toEqual(batch.items.map((item) => item.projectId));
      expect(count(t, 'content_generation_batches')).toBe(1);
      expect(count(t, 'content_generation_items')).toBe(2);
      expect(count(t, 'workflow_runs')).toBe(2);
      expect(await projectCount(t)).toBe(2);

      expectProblem(
        await t.send('POST', '/content-batches', {
          requestKey: key,
          selection: selection(s, [s.matches.ab], ['match_result']),
        }),
        409,
        'REQUEST_KEY_REUSED',
      );
      expect(await projectCount(t)).toBe(2);
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'uses the effective value of a protected manual override, never the last provider value',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const { ab } = s.matches;
      // The result was imported with 1-1: a confirmed import leaves a mapping with its field baseline (01D-C/D) ...
      t.container.db
        .prepare(
          'INSERT INTO external_identity_mappings (id, provider_key, resource, scope_key, external_id, local_id, ' +
            "created_at, updated_at, competition_id, baseline_json) VALUES (?, 'demo-a', 'matches', ?, 'ext-ab', ?, " +
            '?, ?, ?, ?)',
        )
        .run([
          '00000000-0000-4000-8000-0000000009ab',
          s.competitionId,
          ab,
          '2026-10-20T22:00:00.000Z',
          '2026-10-20T22:00:00.000Z',
          s.competitionId,
          JSON.stringify({ homeScore: 1, awayScore: 1 }),
        ]);
      // ... and corrected by the operator, which protects it.
      await created(
        t.send('POST', `/competitions/${s.competitionId}/seasons/${s.seasonId}/matches/${ab}/result`, {
          status: 'finished',
          homeScore: 3,
          awayScore: 1,
        }),
      );
      const provenance = await t.get(`/competitions/${s.competitionId}/provenance/result/${ab}`);
      expect((provenance.json() as { fields: { field: string; protected: boolean }[] }).fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'homeScore', origin: 'manual_override', protected: true }),
        ]),
      );

      const batch = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [ab], ['round_results']) }),
      );
      expect(matchLines(await draftOf(t, batch.items[0]?.projectId ?? ''))).toEqual(['Club Alfa|Club Beta|3-1']);
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it('refuses a selection with nothing to generate and stores nothing', async () => {
    const t = await localApp();
    const s = await seed(t);
    expectProblem(
      await t.send('POST', '/content-batches', {
        requestKey: requestKey(),
        selection: selection(s, [s.matches.ef, s.matches.bc], ['round_results', 'match_result']),
      }),
      409,
      'CONTENT_BATCH_NOT_GENERATABLE',
    );
    expect(count(t, 'content_generation_batches')).toBe(0);
    expect(await projectCount(t)).toBe(0);
  });

  it(
    'reports a partial result when one piece fails and the others complete',
    async () => {
      // Research fails for the piece that shows Club Alfa; every other piece runs the real stage.
      const research: AnyStage = {
        ...(researchStage as AnyStage),
        run: async (input, ctx) => {
          const output = await (researchStage as AnyStage).run(input, ctx);
          if (JSON.stringify(output).includes('Club Alfa')) {
            throw new Error('synthetic research failure');
          }
          return output;
        },
      };
      const t = await localApp({ stageOverrides: { research } });
      const s = await seed(t);
      const batch = await createBatch(t, {
        requestKey: requestKey(),
        selection: selection(s, [s.matches.ab, s.matches.cd], ['match_result']),
      });
      const settled = await settledBatch(t, batch);
      expect(settled.state).toBe('partial');
      expect(settled.totals).toEqual({ requested: 2, generated: 1, failed: 1, skipped: 0, pending: 0, deleted: 0 });
      expect(settled.items[0]).toMatchObject({
        status: 'failed',
        failure: expect.objectContaining({ code: 'internal' }),
      });
      expect(settled.items[1]?.status).toBe('completed');
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it('reports no local source as not generatable', async () => {
    const t = await start(cleanup, { base: 'demo-manual', scenario: 'default' });
    const s = await seed(t);
    const preview = ContentBatchPreviewSchema.parse(
      (await t.send('POST', '/content-batches/previews', selection(s, [s.matches.ab], ['round_results']))).json(),
    );
    expect(preview.pieces[0]).toMatchObject({ status: 'skipped', skipReason: 'context_not_supported' });
    expectProblem(
      await t.send('POST', '/content-batches', {
        requestKey: requestKey(),
        selection: selection(s, [s.matches.ab], ['round_results']),
      }),
      409,
      'CONTENT_BATCH_NOT_GENERATABLE',
    );
  });
});

describe('publication of local content under the existing policy (AD-28, AD-38)', () => {
  it(
    'exports a manually approved piece of a local competition configured with no accepted public source',
    async () => {
      const competitionId = '00000000-0000-4000-8000-00000000a7e5';
      const document = demoWithManualDocument();
      ((document['providers'] as Json)['sports'] as Json)['sources'] = [
        ...(((document['providers'] as Json)['sports'] as Json)['sources'] as Json[]),
        // Without the operator validation of PD-ARCH-01E-PD-01: only the catalogue attestation applies.
        { ...LOCAL_SOURCE, operatorValidated: false },
      ];
      const t = await startRootedApp({
        document,
        catalogue: {
          links: [
            {
              id: 'liga-local-atestada',
              name: 'Liga Local',
              reference: false,
              noAcceptedPublicSource: true,
              bindings: [{ sourceId: 'local', competitionRef: competitionId }],
            },
          ],
          restrictToLinks: false,
        },
      });
      cleanup.add(() => t.close());
      const s = await seed(t, competitionId);
      // The operator pins the official team names of the attested competition (AD-38).
      const names = ['Club Alfa', 'Club Beta', 'Club Gamma', 'Club Delta', 'Club Epsilon', 'Club Zeta'];
      writeFileSync(
        join(t.root, 'config', 'team-identities', `liga-local-atestada-${s.seasonId}.json`),
        JSON.stringify({
          competitionId: 'liga-local-atestada',
          seasonId: s.seasonId,
          teams: s.teamIds.map((teamId, index) => ({
            teamId,
            officialName: names[index],
            aliases: [],
            sourceKeys: [{ sourceId: 'local', teamKey: teamId }],
          })),
        }),
        'utf8',
      );

      const batch = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [s.matches.ab], ['round_results']) }),
      );
      const item = batch.items[0];
      expect(item?.status, JSON.stringify(item?.failure)).toBe('completed');
      const project = await getProject(t, item?.projectId ?? '');
      expect(project.competitionId).toBe('liga-local-atestada');

      const facts = await factsOf(t, project.id, item?.runId ?? '');
      expect(await approveFactsManually(t, project.id, item?.runId ?? '', facts.facts)).toBeGreaterThan(0);
      const approved = await approveDraft(t, project.id);
      for (const carousel of approved.carousels) {
        const written = await exported(t, carousel.id);
        expect(written).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
      }
    },
    WORKFLOW_TEST_TIMEOUT,
  );
});

describe('deleting a generated piece (PD-ARCH-01F)', () => {
  it(
    'marks the piece deleted in its batch and keeps the competition, its matches and the other pieces',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const batch = await settledBatch(
        t,
        await createBatch(t, {
          requestKey: requestKey(),
          selection: selection(s, [s.matches.ab, s.matches.cd], ['match_result']),
        }),
      );
      const [first, second] = batch.items;
      expect((await t.send('DELETE', `/projects/${first?.projectId ?? ''}`)).statusCode).toBe(204);

      const after = ContentBatchSchema.parse((await t.get(`/content-batches/${batch.id}`)).json());
      expect(after.items.map((item) => item.status)).toEqual(['deleted', 'completed']);
      expect(after.totals).toMatchObject({ requested: 2, generated: 1, deleted: 1, pending: 0 });
      expect((await getProject(t, second?.projectId ?? '')).sportsContext?.matchIds).toEqual([s.matches.cd]);
      const matches = (
        (await t.get(`/competitions/${s.competitionId}/seasons/${s.seasonId}/matches`)).json() as { matches: unknown[] }
      ).matches;
      expect(matches).toHaveLength(5);
      expect((await t.get(`/competitions/${s.competitionId}`)).statusCode).toBe(200);
    },
    WORKFLOW_TEST_TIMEOUT,
  );
});

describe('operator-validated local data (PD-ARCH-01E-PD-01)', () => {
  it(
    'records every eligible fact as approved by the operator and exports without fact-by-fact approval',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const batch = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [s.matches.ab], ['round_results']) }),
      );
      const item = batch.items[0];
      const facts = (await factsOf(t, item?.projectId ?? '', item?.runId ?? '')).facts;
      expect(facts.length).toBeGreaterThan(0);
      // Approved by the operator, never verified.
      expect(new Set(facts.map((fact) => fact.status))).toEqual(new Set(['manually_approved']));
      const origins = t.container.db
        .prepare<{ origin: string; n: number }>(
          'SELECT m.origin AS origin, COUNT(*) AS n FROM manual_approvals m JOIN facts f ON f.id = m.fact_id ' +
            'WHERE f.run_id = ? GROUP BY m.origin',
        )
        .all([item?.runId ?? '']);
      expect(origins).toEqual([{ origin: 'operator_validated_source', n: facts.length }]);

      // The slides are still reviewed and approved one by one, then the carousel is approved and exported.
      const approved = await approveDraft(t, item?.projectId ?? '');
      for (const carousel of approved.carousels) {
        expect(await exported(t, carousel.id)).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
      }
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'keeps the current policy for a local source that is not operator-validated',
    async () => {
      const t = await start(cleanup, {
        base: 'demo-manual',
        scenario: 'default',
        mutate: (document: Json) => {
          const sports = (document['providers'] as Json)['sports'] as Json;
          (sports['sources'] as Json[]).push({ ...LOCAL_SOURCE, operatorValidated: false });
        },
      });
      const s = await seed(t);
      const batch = await settledBatch(
        t,
        await createBatch(t, { requestKey: requestKey(), selection: selection(s, [s.matches.ab], ['round_results']) }),
      );
      const item = batch.items[0];
      const facts = (await factsOf(t, item?.projectId ?? '', item?.runId ?? '')).facts;
      expect(new Set(facts.map((fact) => fact.status))).toEqual(new Set(['unverified']));
      const draft = await draftOf(t, item?.projectId ?? '');
      const match = slidesOfType(draft.carousels[0] as Draft['carousels'][number], 'match_result')[0];
      expect(match?.currentVersion.blockingFacts.length).toBeGreaterThan(0);
    },
    WORKFLOW_TEST_TIMEOUT,
  );
});
