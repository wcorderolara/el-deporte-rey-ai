/**
 * PD-ARCH-01E-B: round calendars, upcoming matches and match previews generated from locally managed data, through
 * the real server and the real stages (research, verification, content with the stub AI, rendering, visual QA) and
 * then reviewed, regenerated, approved and exported with the existing workflow. Every competition, team and match is
 * synthetic and created through the API of a temporary app.
 *
 * Covered: eligibility by local status (a past kickoff never makes a match played; finished matches are excluded;
 * in play and postponed matches follow their kind), matches without a kickoff, order, slide structures, no score on
 * any slide of a match not played yet, the status shown from the local status, the AI request (slide types, no score
 * placeholder), the result-claim check, regeneration, approval and export, several previews in one batch, and an
 * idempotent retry.
 */
import { ContentBatchPreviewSchema, ContentBatchSchema, type ContentBatch, type Draft } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import type { Json, TestApp } from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  WORKFLOW_TEST_TIMEOUT,
  allElements,
  approveDraft,
  draftOf,
  exported,
  fieldText,
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

function localApp(): Promise<TestApp> {
  return start(cleanup, {
    base: 'demo-manual',
    scenario: 'default',
    mutate: (document: Json) => {
      const sports = (document['providers'] as Json)['sports'] as Json;
      (sports['sources'] as Json[]).push(LOCAL_SOURCE);
    },
  });
}

let keyCounter = 0;
function requestKey(): string {
  keyCounter += 1;
  return `00000000-0000-4000-8000-0000000e${String(keyCounter).padStart(4, '0')}`;
}

async function ok<T>(response: Promise<{ statusCode: number; body: string; json(): unknown }>): Promise<T> {
  const answer = await response;
  expect([200, 201, 202], answer.body).toContain(answer.statusCode);
  return answer.json() as T;
}

interface Seed {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  /** Kickoff order: scheduled (past kickoff), postponed, in play (with a score), finished; and one without kickoff. */
  readonly matches: {
    readonly scheduled: string;
    readonly postponed: string;
    readonly inPlay: string;
    readonly finished: string;
    readonly noKickoff: string;
  };
}

async function seed(t: TestApp): Promise<Seed> {
  const competitionId = (await ok<{ id: string }>(t.send('POST', '/competitions', { name: 'Liga Local' }))).id;
  const seasonId = (
    await ok<{ id: string }>(t.send('POST', `/competitions/${competitionId}/seasons`, { label: '2026/27' }))
  ).id;
  const base = `/competitions/${competitionId}/seasons/${seasonId}`;
  const teams: string[] = [];
  for (const name of ['Club Alfa', 'Club Beta', 'Club Gamma', 'Club Delta', 'Club Epsilon', 'Club Zeta']) {
    const team = await ok<{ id: string }>(t.send('POST', '/teams', { name }));
    await ok(t.send('POST', `/competitions/${competitionId}/teams`, { teamId: team.id }));
    teams.push(team.id);
  }
  await ok(t.send('POST', `${base}/participants/batch`, { teamIds: teams }));
  const roundId = (await ok<{ id: string }>(t.send('POST', `${base}/rounds`, { name: 'Jornada 20' }))).id;
  const match = async (
    home: number,
    away: number,
    kickoffAt: string | null,
    result: { status: string; homeScore: number | null; awayScore: number | null } | null,
  ): Promise<string> => {
    const created = await ok<{ id: string }>(
      t.send('POST', `${base}/matches`, {
        homeTeamId: teams[home],
        awayTeamId: teams[away],
        kickoffAt,
        stageId: null,
        roundId,
      }),
    );
    if (result !== null) {
      await ok(t.send('POST', `${base}/matches/${created.id}/result`, result));
    }
    return created.id;
  };
  return {
    competitionId,
    seasonId,
    roundId,
    matches: {
      // A kickoff in the past: still scheduled, never treated as played.
      scheduled: await match(0, 1, '2026-01-10T18:00:00.000Z', null),
      postponed: await match(2, 3, '2026-01-11T18:00:00.000Z', {
        status: 'postponed',
        homeScore: null,
        awayScore: null,
      }),
      inPlay: await match(4, 5, '2026-01-12T18:00:00.000Z', { status: 'in_progress', homeScore: 1, awayScore: 0 }),
      finished: await match(0, 2, '2026-01-13T18:00:00.000Z', { status: 'finished', homeScore: 2, awayScore: 2 }),
      noKickoff: await match(1, 3, null, null),
    },
  };
}

function selection(s: Seed, matchIds: readonly string[], kinds: readonly string[]) {
  return { competitionId: s.competitionId, seasonId: s.seasonId, stageId: null, roundId: s.roundId, matchIds, kinds };
}

function allMatches(s: Seed): string[] {
  return Object.values(s.matches);
}

async function generate(t: TestApp, body: unknown): Promise<ContentBatch> {
  const response = await t.send('POST', '/content-batches', body);
  expect(response.statusCode, response.body).toBe(202);
  const batch = ContentBatchSchema.parse(response.json());
  for (const item of batch.items) {
    if (item.projectId !== null && item.runId !== null) {
      await waitForRun(t, item.projectId, item.runId);
    }
  }
  return ContentBatchSchema.parse((await t.get(`/content-batches/${batch.id}`)).json());
}

/** `home|away|status|kickoff-present` of every fixture or preview slide of a draft. */
function fixtureLines(draft: Draft, slideType: 'fixture' | 'match_preview'): string[] {
  return draft.carousels.flatMap((carousel) =>
    slidesOfType(carousel, slideType).map((slide) =>
      [fieldText(slide, 'team_home'), fieldText(slide, 'team_away'), fieldText(slide, 'match_status')].join('|'),
    ),
  );
}

function slideTypes(draft: Draft): string[] {
  return draft.carousels.flatMap((carousel) =>
    carousel.elements.filter((element) => element.kind === 'slide').map((element) => String(element.slideType)),
  );
}

function hasScoreField(draft: Draft): boolean {
  return allElements(draft).some((element) => element.currentVersion.fields.some((field) => field.field === 'score'));
}

describe('content about matches not played yet: planning (PD-ARCH-01E-B)', () => {
  it('plans each kind from the local status only and explains every excluded match', async () => {
    const t = await localApp();
    const s = await seed(t);
    const { scheduled, postponed, inPlay, finished, noKickoff } = s.matches;
    const preview = ContentBatchPreviewSchema.parse(
      (
        await t.send(
          'POST',
          '/content-batches/previews',
          selection(s, allMatches(s), ['round_calendar', 'upcoming_matches', 'match_preview']),
        )
      ).json(),
    );

    const byId = new Map(preview.matches.map((match) => [match.matchId, match]));
    expect(byId.get(scheduled)).toMatchObject({ calendarIneligibility: null, upcomingIneligibility: null });
    expect(byId.get(postponed)).toMatchObject({ calendarIneligibility: null, upcomingIneligibility: null });
    expect(byId.get(inPlay)).toMatchObject({ calendarIneligibility: null, upcomingIneligibility: 'not_upcoming' });
    expect(byId.get(finished)).toMatchObject({
      calendarIneligibility: 'already_finished',
      upcomingIneligibility: 'already_finished',
    });
    expect(byId.get(noKickoff)).toMatchObject({
      calendarIneligibility: 'kickoff_missing',
      upcomingIneligibility: 'kickoff_missing',
    });

    expect(preview.pieces.map((piece) => [piece.kind, piece.status, piece.skipReason, piece.matchIds])).toEqual([
      ['round_calendar', 'ready', null, [scheduled, postponed, inPlay]],
      ['upcoming_matches', 'ready', null, [scheduled, postponed]],
      ['match_preview', 'ready', null, [scheduled]],
      ['match_preview', 'ready', null, [postponed]],
      ['match_preview', 'skipped', 'not_upcoming', [inPlay]],
      ['match_preview', 'skipped', 'already_finished', [finished]],
      ['match_preview', 'skipped', 'kickoff_missing', [noKickoff]],
    ]);
    expect(preview.totals).toEqual({ requested: 7, ready: 4, skipped: 3 });
    expect(new Set(preview.templates.map((template) => template.slideType))).toEqual(
      new Set(['cover', 'round_overview', 'fixture', 'match_preview', 'closing']),
    );
  });

  it('skips a calendar of a round whose matches are all finished, without inventing content', async () => {
    const t = await localApp();
    const s = await seed(t);
    const preview = ContentBatchPreviewSchema.parse(
      (
        await t.send('POST', '/content-batches/previews', selection(s, [s.matches.finished], ['round_calendar']))
      ).json(),
    );
    expect(preview.pieces).toEqual([
      expect.objectContaining({ kind: 'round_calendar', status: 'skipped', skipReason: 'no_eligible_matches' }),
    ]);
    expect(
      (
        await t.send('POST', '/content-batches', {
          requestKey: requestKey(),
          selection: selection(s, [s.matches.finished], ['round_calendar']),
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe('content about matches not played yet: generation (PD-ARCH-01E-B)', () => {
  it(
    'generates a round calendar with an overview and one fixture per match, never with a score',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const batch = await generate(t, {
        requestKey: requestKey(),
        selection: selection(s, allMatches(s), ['round_calendar']),
      });
      expect(batch.state).toBe('completed');
      const item = batch.items[0];
      const draft = await draftOf(t, item?.projectId ?? '');

      expect(slideTypes(draft)).toEqual(['cover', 'round_overview', 'fixture', 'fixture', 'fixture', 'closing']);
      expect(fixtureLines(draft, 'fixture')).toEqual([
        'Club Alfa|Club Beta|Programado',
        'Club Gamma|Club Delta|Aplazado',
        'Club Epsilon|Club Zeta|En juego',
      ]);
      const overview = slidesOfType(draft.carousels[0] as Draft['carousels'][number], 'round_overview')[0];
      expect(fieldText(overview as never, 'title')).toBe('Calendario · Jornada 20');
      // PD-ARCH-01G-E.2: one row per match with the kickoff date and time, and the status of a match not scheduled.
      const lines = fieldText(overview as never, 'fixtures').split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^Club Alfa vs Club Beta · \d{1,2} \p{L}{3} \d{4} · \d{2}:\d{2}$/u);
      expect(lines[1]).toMatch(/^Club Gamma vs Club Delta · .+ · \d{2}:\d{2} · Aplazado$/u);
      expect(lines[2]).toMatch(/ · En juego$/u);
      // No score anywhere, not even the one recorded for the match in play.
      expect(hasScoreField(draft)).toBe(false);
      const texts = allElements(draft).flatMap((element) =>
        element.currentVersion.fields.flatMap((field) => field.segments.map((segment) => segment.text)),
      );
      expect(texts.some((text) => /\b1-0\b/u.test(text))).toBe(false);
      expect(draft.leftOutMatches.map((match) => match.reason)).toEqual([]);
      for (const element of allElements(draft)) {
        expect(element.currentVersion.contentFlags, element.slideType ?? 'caption').toEqual([]);
        // No other warning: the vocabulary of matches not played yet is ordinary language for capitalized_tokens.
        // These teams have no badge, so each fixture warns about its two empty badge slots (PD-ARCH-01G-E.1) and the
        // calendar about the two slots of each row (PD-ARCH-01G-E.2).
        const rows = [1, 2, 3].flatMap((row) => [
          { row, slot: 'team-badge-home' },
          { row, slot: 'team-badge-away' },
        ]);
        expect(
          element.currentVersion.qa
            .filter((result) => result.outcome === 'fail')
            .map((result) => [result.check, result.severity, result.details]),
          element.slideType ?? 'caption',
        ).toEqual(
          element.slideType === 'fixture'
            ? [['team_badges', 'warning', { emptyBadgeSlots: ['team-badge-home', 'team-badge-away'] }]]
            : element.slideType === 'round_overview'
              ? [['team_badges', 'warning', { emptyBadgeSlots: [], emptyRowBadgeSlots: rows }]]
              : [],
        );
      }
      const project = await getProject(t, item?.projectId ?? '');
      expect(project.sportsContext?.kind).toBe('round_calendar');
      // The AI request names the slide types and offers no score or result placeholder for these matches.
      const request = t.aiRequests.at(-1);
      expect(request?.slides.map((slide) => slide.slideType)).toEqual(slideTypes(draft));
      const placeholders = JSON.stringify(request);
      expect(placeholders).not.toMatch(/:score\}\}|:result\}\}/u);
      expect(placeholders).toContain(':status}}');
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'generates upcoming matches with the scheduled and postponed matches only',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const batch = await generate(t, {
        requestKey: requestKey(),
        selection: selection(s, allMatches(s), ['upcoming_matches']),
      });
      const draft = await draftOf(t, batch.items[0]?.projectId ?? '');
      expect(slideTypes(draft)).toEqual(['cover', 'fixture', 'fixture', 'closing']);
      expect(fixtureLines(draft, 'fixture')).toEqual([
        'Club Alfa|Club Beta|Programado',
        'Club Gamma|Club Delta|Aplazado',
      ]);
      expect(hasScoreField(draft)).toBe(false);
    },
    WORKFLOW_TEST_TIMEOUT,
  );

  it(
    'generates one preview per selected match, then reviews, regenerates, approves and exports one of them',
    async () => {
      const t = await localApp();
      const s = await seed(t);
      const body = {
        requestKey: requestKey(),
        selection: selection(s, [s.matches.scheduled, s.matches.postponed], ['match_preview']),
      };
      const batch = await generate(t, body);
      expect(batch.totals).toMatchObject({ requested: 2, generated: 2, failed: 0, skipped: 0 });
      // A retried confirmation returns the same batch and creates nothing.
      const retried = ContentBatchSchema.parse((await t.send('POST', '/content-batches', body)).json());
      expect(retried.id).toBe(batch.id);
      expect(retried.items.map((item) => item.projectId)).toEqual(batch.items.map((item) => item.projectId));

      const [first, second] = batch.items;
      const project = await getProject(t, first?.projectId ?? '');
      expect(project.title).toBe('Liga Local 2026/27 · Jornada 20 · Previa · Club Alfa - Club Beta');
      const draft = await draftOf(t, first?.projectId ?? '');
      expect(slideTypes(draft)).toEqual(['cover', 'match_preview', 'closing']);
      expect(fixtureLines(draft, 'match_preview')).toEqual(['Club Alfa|Club Beta|Programado']);
      const previewSlide = slidesOfType(draft.carousels[0] as Draft['carousels'][number], 'match_preview')[0];
      expect(fieldText(previewSlide as never, 'footer')).toBe('Liga Local · 2026/27');
      expect(fieldText(previewSlide as never, 'kickoff')).not.toBe('');
      expect(fixtureLines(await draftOf(t, second?.projectId ?? ''), 'match_preview')).toEqual([
        'Club Gamma|Club Delta|Aplazado',
      ]);

      // Regeneration keeps the structure of the preview slide.
      const regenerated = await t.send(
        'POST',
        `/carousels/${previewSlide?.carouselId ?? ''}/elements/${previewSlide?.id ?? ''}/regenerate`,
      );
      expect([200, 201], regenerated.body).toContain(regenerated.statusCode);
      const after = slidesOfType(
        (await draftOf(t, first?.projectId ?? '')).carousels[0] as Draft['carousels'][number],
        'match_preview',
      )[0];
      expect(after?.currentVersion.id).not.toBe(previewSlide?.currentVersion.id);
      expect(fieldText(after as never, 'match_status')).toBe('Programado');

      // The operator-validated local data is approved; the slides and the carousel are approved and exported.
      const approved = await approveDraft(t, first?.projectId ?? '');
      for (const carousel of approved.carousels) {
        expect(await exported(t, carousel.id)).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false });
      }
      expect(t.egress.requests).toHaveLength(0);
    },
    WORKFLOW_TEST_TIMEOUT,
  );
});
