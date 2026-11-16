/**
 * PD-ARCH-01G-E.1: team badges in the badge slots of the engine match templates (Resultado de partido, Partido
 * programado, Previa de partido), through the real server, the real workflow stages (research, verification, content
 * with the stub AI, rendering, visual QA) and the real SQLite database of a temporary app. Every competition, team,
 * badge and match is synthetic; no real project is touched and nothing reaches a provider.
 *
 * Covered: the home and the away badge of each match found by the teams' local identity (two teams with almost the
 * same name, and the same teams with home and away swapped); a half transparent badge; a team without a badge and a
 * match where neither team has one (empty slots, names kept, the non-blocking `team_badges` warning, acknowledged
 * before approval like every QA warning, then approval and export); the badge snapshot of a project kept after a badge
 * is replaced or retired (a regenerated slide is byte-identical) while a new project uses the badges as they are now;
 * projects created before 01G-E.1 (no snapshot, or the 01G-D snapshot of visual templates) regenerated with version
 * 1.0.0, without badges or warnings; a badge file altered on disk is never drawn.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderAsync } from '@resvg/resvg-js';
import { type ContentBatch, ContentBatchSchema, type Draft, type Element, ElementSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { png } from '../../../src/modules/brand/test/images.js';
import { type BadgeSlotElement, type RenderModel, pngSize } from '../../../src/modules/rendering/index.js';
import type { Json, TestApp } from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  WORKFLOW_TEST_TIMEOUT,
  acknowledgeWarnings,
  approve,
  approveDraft,
  draftOf,
  elementPath,
  exported,
  fieldText,
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

async function ok<T>(response: Promise<{ statusCode: number; body: string; json(): unknown }>): Promise<T> {
  const answer = await response;
  expect([200, 201, 202], answer.body).toContain(answer.statusCode);
  return answer.json() as T;
}

let key = 0;
function requestKey(): string {
  key += 1;
  return `00000000-0000-4000-8000-0000000e1${String(key).padStart(3, '0')}`;
}

const RED = [200, 30, 40] as const;
const BLUE = [20, 40, 160] as const;
const GREEN = [0, 200, 0] as const;
/** The background of the engine templates (`primaryDark` of the committed palette). */
const BACKGROUND = [0x2e, 0x11, 0x45];

const EJEMPLO = 'Club Deportivo Ejemplo';
const EJEMPLO_B = 'Club Deportivo Ejemplo B';
const UNION = 'Unión Muestra';
const SIN_ESCUDO = 'Atlético Sin Escudo';
const RACING = 'Racing Sin Escudo';

interface Seed {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  readonly teams: Readonly<Record<string, string>>;
  readonly badges: Readonly<Record<string, string>>;
  /**
   * finished: Ejemplo 2-1 Ejemplo B; withOne: Unión Muestra (half transparent badge) vs a team without a badge;
   * withNone: two teams without a badge; swapped: Ejemplo B at home against Ejemplo.
   */
  readonly matches: {
    readonly finished: string;
    readonly withOne: string;
    readonly withNone: string;
    readonly swapped: string;
  };
}

async function uploadBadge(t: TestApp, teamId: string, image: Buffer): Promise<string> {
  const response = await t.inject({
    method: 'PUT',
    url: `/api/v1/teams/${teamId}/badge`,
    query: { source: 'Archivo sintético de prueba', authorized: 'true' },
    headers: { host: t.host, origin: t.origin, 'x-edr-client': 'web', 'content-type': 'image/png' },
    payload: image,
  });
  expect(response.statusCode, response.body).toBe(200);
  return (response.json() as { badge: { id: string } }).badge.id;
}

async function seed(t: TestApp): Promise<Seed> {
  const competitionId = (await ok<{ id: string }>(t.send('POST', '/competitions', { name: 'Liga de Escudos' }))).id;
  const seasonId = (
    await ok<{ id: string }>(t.send('POST', `/competitions/${competitionId}/seasons`, { label: '2026/27' }))
  ).id;
  const base = `/competitions/${competitionId}/seasons/${seasonId}`;
  const teams: Record<string, string> = {};
  for (const name of [EJEMPLO, EJEMPLO_B, UNION, SIN_ESCUDO, RACING]) {
    const team = await ok<{ id: string }>(t.send('POST', '/teams', { name }));
    await ok(t.send('POST', `/competitions/${competitionId}/teams`, { teamId: team.id }));
    teams[name] = team.id;
  }
  await ok(t.send('POST', `${base}/participants/batch`, { teamIds: Object.values(teams) }));
  const roundId = (await ok<{ id: string }>(t.send('POST', `${base}/rounds`, { name: 'Jornada 9' }))).id;
  const match = async (home: string, away: string, kickoffAt: string, score: [number, number] | null) => {
    const created = await ok<{ id: string }>(
      t.send('POST', `${base}/matches`, {
        homeTeamId: teams[home],
        awayTeamId: teams[away],
        kickoffAt,
        stageId: null,
        roundId,
      }),
    );
    if (score !== null) {
      await ok(
        t.send('POST', `${base}/matches/${created.id}/result`, {
          status: 'finished',
          homeScore: score[0],
          awayScore: score[1],
        }),
      );
    }
    return created.id;
  };
  const matches = {
    finished: await match(EJEMPLO, EJEMPLO_B, '2026-10-20T18:00:00.000Z', [2, 1]),
    withOne: await match(UNION, SIN_ESCUDO, '2026-12-20T18:00:00.000Z', null),
    withNone: await match(SIN_ESCUDO, RACING, '2026-12-21T18:00:00.000Z', null),
    swapped: await match(EJEMPLO_B, EJEMPLO, '2026-12-22T18:00:00.000Z', null),
  };
  const badges = {
    [EJEMPLO]: await uploadBadge(t, teams[EJEMPLO] ?? '', png({ width: 64, height: 64, rgba: [...RED, 255] })),
    [EJEMPLO_B]: await uploadBadge(t, teams[EJEMPLO_B] ?? '', png({ width: 64, height: 64, rgba: [...BLUE, 255] })),
    [UNION]: await uploadBadge(t, teams[UNION] ?? '', png({ width: 64, height: 64, rgba: [255, 255, 255, 128] })),
  };
  return { competitionId, seasonId, roundId, teams, badges, matches };
}

function selection(s: Seed, matchIds: readonly string[], kinds: readonly string[]) {
  return { competitionId: s.competitionId, seasonId: s.seasonId, stageId: null, roundId: s.roundId, matchIds, kinds };
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

function stored(t: TestApp, versionId: string): { model: RenderModel; templateVersion: string } {
  const row = t.container.db
    .prepare<{ render_model: string; template_version: string }>(
      'SELECT render_model, template_version FROM element_versions WHERE id = ?',
    )
    .get([versionId]);
  return { model: JSON.parse(row?.render_model ?? '{}') as RenderModel, templateVersion: row?.template_version ?? '' };
}

function slotOf(model: RenderModel, id: 'team-badge-home' | 'team-badge-away'): BadgeSlotElement {
  const slot = model.elements.find(
    (element): element is BadgeSlotElement => element.kind === 'badge_slot' && element.id === id,
  );
  if (slot === undefined) {
    throw new Error(`no badge slot ${id}`);
  }
  return slot;
}

async function imageOf(t: TestApp, versionId: string): Promise<Buffer> {
  const response = await t.get(`/element-versions/${versionId}/image`);
  expect(response.statusCode, response.body).toBe(200);
  return response.rawPayload;
}

/** The RGB at the centre of each badge slot of a slide's image. */
async function slotColours(t: TestApp, versionId: string): Promise<{ home: number[]; away: number[] }> {
  const image = await imageOf(t, versionId);
  const size = pngSize(image) ?? { width: 1, height: 1 };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(size.width)}" ` +
    `height="${String(size.height)}"><image width="${String(size.width)}" height="${String(size.height)}" ` +
    `xlink:href="data:image/png;base64,${image.toString('base64')}"/></svg>`;
  const pixels = (await renderAsync(svg, { font: { loadSystemFonts: false } })).pixels;
  const at = (slot: BadgeSlotElement) => {
    const x = Math.round(slot.box.x + slot.box.width / 2);
    const y = Math.round(slot.box.y + slot.box.height / 2);
    return [...pixels.subarray((y * size.width + x) * 4, (y * size.width + x) * 4 + 3)];
  };
  const { model } = stored(t, versionId);
  return { home: at(slotOf(model, 'team-badge-home')), away: at(slotOf(model, 'team-badge-away')) };
}

function teamBadgesResult(element: Element) {
  return element.currentVersion.qa.find((result) => result.check === 'team_badges');
}

function onlySlide(draft: Draft, slideType: 'match_result' | 'fixture' | 'match_preview'): Element {
  const slide = draft.carousels.flatMap((carousel) => slidesOfType(carousel, slideType))[0];
  if (slide === undefined) {
    throw new Error(`no ${slideType} slide`);
  }
  return slide;
}

async function regenerate(t: TestApp, element: Element) {
  return t.send('POST', `${elementPath(element)}/regenerate`);
}

describe('team badges in the engine match templates (PD-ARCH-01G-E.1)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('draws each badge on its side by the team identity in results, fixtures and previews; a team without a badge leaves its slot empty with a warning that does not block', async () => {
    const t = await localApp();
    const s = await seed(t);
    const { finished, withOne, withNone, swapped } = s.matches;
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: selection(
        s,
        [finished, withOne, withNone, swapped],
        ['match_result', 'upcoming_matches', 'match_preview'],
      ),
    });
    const generated = batch.items.filter((item) => item.status === 'completed');
    // One result, one list of upcoming matches and three previews: generation is never stopped by a missing badge.
    expect(generated.map((item) => item.kind).sort()).toEqual([
      'match_preview',
      'match_preview',
      'match_preview',
      'match_result',
      'upcoming_matches',
    ]);
    expect(batch.totals.failed).toBe(0);
    const draftOfKind = async (kind: string, matchId?: string): Promise<Draft> => {
      const item = generated.find(
        (candidate) => candidate.kind === kind && (matchId === undefined || candidate.matchIds.includes(matchId)),
      );
      return draftOf(t, item?.projectId ?? '');
    };
    const result = await draftOfKind('match_result');
    const upcoming = await draftOfKind('upcoming_matches');
    const previewOne = await draftOfKind('match_preview', withOne);
    const previewNone = await draftOfKind('match_preview', withNone);
    const previewSwapped = await draftOfKind('match_preview', swapped);
    const upcomingProject = generated.find((item) => item.kind === 'upcoming_matches')?.projectId ?? '';

    // Result: Ejemplo (red) at home, Ejemplo B (blue) away; names that differ only by a final letter never swap badges.
    const resultSlide = onlySlide(result, 'match_result');
    expect([fieldText(resultSlide, 'team_home'), fieldText(resultSlide, 'team_away')]).toEqual([EJEMPLO, EJEMPLO_B]);
    const resultModel = stored(t, resultSlide.currentVersion.id);
    expect(resultModel.templateVersion).toBe('1.1.0');
    expect(slotOf(resultModel.model, 'team-badge-home').team).toMatchObject({
      teamId: s.teams[EJEMPLO],
      badge: { assetId: s.badges[EJEMPLO] },
    });
    expect(slotOf(resultModel.model, 'team-badge-away').team).toMatchObject({
      teamId: s.teams[EJEMPLO_B],
      badge: { assetId: s.badges[EJEMPLO_B] },
    });
    expect(await slotColours(t, resultSlide.currentVersion.id)).toEqual({ home: [...RED], away: [...BLUE] });
    expect(teamBadgesResult(resultSlide)).toMatchObject({ outcome: 'pass', details: { emptyBadgeSlots: [] } });

    // Swapped sides: the badges follow the teams, not the positions.
    const swappedSlide = onlySlide(previewSwapped, 'match_preview');
    expect([fieldText(swappedSlide, 'team_home'), fieldText(swappedSlide, 'team_away')]).toEqual([EJEMPLO_B, EJEMPLO]);
    expect(await slotColours(t, swappedSlide.currentVersion.id)).toEqual({ home: [...BLUE], away: [...RED] });

    // Upcoming matches: one fixture per match, in kickoff order.
    const fixtures = upcoming.carousels.flatMap((carousel) => slidesOfType(carousel, 'fixture'));
    expect(fixtures.map((slide) => fieldText(slide, 'team_home'))).toEqual([UNION, SIN_ESCUDO, EJEMPLO_B]);
    const [fixtureOne, fixtureNone, fixtureSwapped] = fixtures as [Element, Element, Element];
    for (const slide of fixtures) {
      expect(stored(t, slide.currentVersion.id).templateVersion).toBe('1.1.0');
    }
    // A half transparent badge blends with the background; the team without a badge leaves its slot empty.
    const one = await slotColours(t, fixtureOne.currentVersion.id);
    for (const [index, channel] of one.home.entries()) {
      expect(channel).toBeGreaterThan(BACKGROUND[index] ?? 0);
      expect(channel).toBeLessThan(255);
    }
    expect(one.away).toEqual(BACKGROUND);
    expect(fieldText(fixtureOne, 'team_away')).toBe(SIN_ESCUDO);
    expect(slotOf(stored(t, fixtureOne.currentVersion.id).model, 'team-badge-away')).toMatchObject({
      empty: true,
      team: { teamId: s.teams[SIN_ESCUDO], badge: null },
    });
    expect(teamBadgesResult(fixtureOne)).toEqual({
      check: 'team_badges',
      outcome: 'fail',
      severity: 'warning',
      details: { emptyBadgeSlots: ['team-badge-away'] },
      acknowledgedAt: null,
    });
    expect(fixtureOne.currentVersion.state).toBe('ready');
    // Neither team has a badge: both slots empty, both names drawn, one warning for both slots.
    expect(await slotColours(t, fixtureNone.currentVersion.id)).toEqual({ home: BACKGROUND, away: BACKGROUND });
    expect([fieldText(fixtureNone, 'team_home'), fieldText(fixtureNone, 'team_away')]).toEqual([SIN_ESCUDO, RACING]);
    expect(teamBadgesResult(fixtureNone)?.details).toEqual({ emptyBadgeSlots: ['team-badge-home', 'team-badge-away'] });
    expect(await slotColours(t, fixtureSwapped.currentVersion.id)).toEqual({ home: [...BLUE], away: [...RED] });
    expect(teamBadgesResult(fixtureSwapped)?.outcome).toBe('pass');
    // Previews draw the same badges and warnings.
    expect(teamBadgesResult(onlySlide(previewOne, 'match_preview'))?.details).toEqual({
      emptyBadgeSlots: ['team-badge-away'],
    });
    expect(teamBadgesResult(onlySlide(previewNone, 'match_preview'))?.details).toEqual({
      emptyBadgeSlots: ['team-badge-home', 'team-badge-away'],
    });
    // No slide has a blocking failure.
    for (const draft of [result, upcoming, previewOne, previewNone, previewSwapped]) {
      for (const carousel of draft.carousels) {
        for (const element of carousel.elements) {
          expect(
            element.currentVersion.qa.filter((item) => item.severity === 'blocking' && item.outcome === 'fail'),
          ).toEqual([]);
        }
      }
    }

    // Like every QA warning (OD-09), it is acknowledged before the slide is approved; it never blocks the content.
    const refused = await approve(t, fixtureNone);
    expect(refused.statusCode, refused.body).toBe(409);
    expect((refused.json() as { code: string }).code).toBe('QA_ACK_REQUIRED');
    expect(await acknowledgeWarnings(t, fixtureNone)).toBe(1);
    const approvedDraft = await approveDraft(t, upcomingProject);
    for (const carousel of approvedDraft.carousels) {
      const written = await exported(t, carousel.id);
      expect(written.files.filter((file) => file.kind === 'slide_image').length).toBeGreaterThan(0);
    }
    expect(t.egress.requests).toHaveLength(0);
  });

  it('keeps the badges of a project after a badge is replaced or retired, while a new project uses the badges as they are now', async () => {
    const t = await localApp();
    const s = await seed(t);
    const first = await generate(t, {
      requestKey: requestKey(),
      selection: selection(s, [s.matches.finished], ['match_result']),
    });
    const projectId = first.items[0]?.projectId ?? '';
    const slide = onlySlide(await draftOf(t, projectId), 'match_result');
    const before = await imageOf(t, slide.currentVersion.id);

    // Ejemplo gets a new badge; Ejemplo B's badge is retired.
    const green = await uploadBadge(t, s.teams[EJEMPLO] ?? '', png({ width: 64, height: 64, rgba: [...GREEN, 255] }));
    const retired = await t.send('DELETE', `/teams/${s.teams[EJEMPLO_B] ?? ''}/badge`);
    expect([200, 204], retired.body).toContain(retired.statusCode);

    // Regenerating the slide draws the badges recorded with the project: the same image, byte for byte.
    const response = await regenerate(t, slide);
    expect(response.statusCode, response.body).toBe(201);
    const regenerated = ElementSchema.parse(response.json());
    expect(regenerated.currentVersion.id).not.toBe(slide.currentVersion.id);
    expect((await imageOf(t, regenerated.currentVersion.id)).equals(before)).toBe(true);
    expect(slotOf(stored(t, regenerated.currentVersion.id).model, 'team-badge-home').team?.badge?.assetId).toBe(
      s.badges[EJEMPLO],
    );

    // A new project records the badges as they are now: the new one, and none for the team whose badge was retired.
    const second = await generate(t, {
      requestKey: requestKey(),
      selection: selection(s, [s.matches.finished], ['match_result']),
    });
    const newSlide = onlySlide(await draftOf(t, second.items[0]?.projectId ?? ''), 'match_result');
    expect(slotOf(stored(t, newSlide.currentVersion.id).model, 'team-badge-home').team?.badge?.assetId).toBe(green);
    expect(await slotColours(t, newSlide.currentVersion.id)).toEqual({ home: [...GREEN], away: BACKGROUND });
    expect(teamBadgesResult(newSlide)?.details).toEqual({ emptyBadgeSlots: ['team-badge-away'] });
  });

  it('renders projects created before 01G-E.1 as before: version 1.0.0, empty slots and no badge warning, the same image each time', async () => {
    const t = await localApp();
    const s = await seed(t);
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: selection(s, [s.matches.finished], ['match_result']),
    });
    const projectId = batch.items[0]?.projectId ?? '';
    const legacySnapshots: (string | null)[] = [
      // An engine project before 01G-E.1 had no snapshot.
      null,
      // A 01G-D project with a visual template recorded the version 1 format, drawn by its visual templates only.
      JSON.stringify({ [s.teams[EJEMPLO] ?? '']: s.badges[EJEMPLO], [s.teams[EJEMPLO_B] ?? '']: s.badges[EJEMPLO_B] }),
    ];
    for (const snapshot of legacySnapshots) {
      t.container.db.prepare('UPDATE projects SET badge_snapshot_json = ? WHERE id = ?').run([snapshot, projectId]);
      const images: Buffer[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const slide = onlySlide(await draftOf(t, projectId), 'match_result');
        const response = await regenerate(t, slide);
        expect(response.statusCode, response.body).toBe(201);
        const version = ElementSchema.parse(response.json()).currentVersion;
        const { model, templateVersion } = stored(t, version.id);
        expect(templateVersion).toBe('1.0.0');
        for (const id of ['team-badge-home', 'team-badge-away'] as const) {
          expect(slotOf(model, id)).toEqual({
            kind: 'badge_slot',
            id,
            slot: id,
            box: slotOf(model, id).box,
            empty: true,
          });
        }
        expect(version.qa.find((item) => item.check === 'team_badges')?.outcome).toBe('pass');
        expect(await slotColours(t, version.id)).toEqual({ home: BACKGROUND, away: BACKGROUND });
        images.push(await imageOf(t, version.id));
      }
      expect(images[1]?.equals(images[0] ?? Buffer.alloc(0))).toBe(true);
    }
  });

  it('never draws a badge whose stored file no longer matches its hash, and draws no substitute', async () => {
    const t = await localApp();
    const s = await seed(t);
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: selection(s, [s.matches.finished], ['match_result']),
    });
    const projectId = batch.items[0]?.projectId ?? '';
    const slide = onlySlide(await draftOf(t, projectId), 'match_result');
    const row = t.container.db
      .prepare<{ file_path: string }>('SELECT file_path FROM team_badges WHERE id = ?')
      .get([s.badges[EJEMPLO] ?? '']);
    writeFileSync(
      join(t.container.paths.dataDir, row?.file_path ?? ''),
      png({ width: 64, height: 64, rgba: [...GREEN, 255] }),
    );

    const response = await regenerate(t, slide);
    // The integrity failure is a server error, as for any stored file that no longer matches its hash (01G-D).
    expect(response.statusCode, response.body).toBe(500);
    expect((response.json() as { code: string }).code).toBe('INTERNAL');
    // The new version has no image and no QA result, so it can never be approved or exported; nothing was drawn.
    const after = onlySlide(await draftOf(t, projectId), 'match_result');
    expect(after.currentVersion.id).not.toBe(slide.currentVersion.id);
    expect(after.currentVersion.state).toBe('pending_qa');
    expect(after.currentVersion.qa).toEqual([]);
    expect((await t.get(`/element-versions/${after.currentVersion.id}/image`)).statusCode).toBe(404);
    // The earlier version keeps its image, drawn with the original file.
    expect(await slotColours(t, slide.currentVersion.id)).toEqual({ home: [...RED], away: [...BLUE] });
  });
});
