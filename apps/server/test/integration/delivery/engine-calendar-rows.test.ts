/**
 * PD-ARCH-01G-E.2: round calendars drawn by the engine template as rows with the team badges, through the real server,
 * the real workflow stages (research, verification, content with the stub AI, rendering, visual QA) and the real
 * SQLite database of a temporary app. Every competition, team, badge and match is synthetic; no real project is
 * touched and nothing reaches a provider.
 *
 * Covered: seven matches split into calendar pages of six and one (decision DE-E5), drawn with the round calendar
 * template 2.0.0; each row's badges found by the teams' local identity (two teams with almost the same name, and the
 * same teams with home and away swapped); a half transparent badge; teams without a badge (empty slots, names kept,
 * the non-blocking `team_badges` warning naming each row, acknowledged before approval, then approval and export);
 * the date, the time and the status of a postponed match on its row; a calendar page regenerated after a badge is
 * replaced or retired keeps the project's badges, byte for byte; projects created before 01G-E.2 (no snapshot, the
 * version 1 snapshot of 01G-D or the version 2 snapshot of 01G-E.1, with a draft planned under it) keep their pages of
 * eight and version 1.0.0, and a regenerated page is the same image each time.
 */
import { renderAsync } from '@resvg/resvg-js';
import { type ContentBatch, ContentBatchSchema, type Draft, type Element, ElementSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { png } from '../../../src/modules/brand/test/images.js';
import { type BadgeSlotElement, type RenderModel, pngSize } from '../../../src/modules/rendering/index.js';
import type { Json, TestApp } from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  WORKFLOW_TEST_TIMEOUT,
  approve,
  approveDraft,
  draftOf,
  elementPath,
  exported,
  fieldText,
  runWorkflow,
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
  return `00000000-0000-4000-8000-0000000e2${String(key).padStart(3, '0')}`;
}

const RED = [200, 30, 40] as const;
const BLUE = [20, 40, 160] as const;
const GREEN = [0, 200, 0] as const;
const ORANGE = [230, 140, 20] as const;
/** The row band of the round calendar 2.0.0 (`primary` of the committed palette). */
const BAND = [0x5b, 0x2a, 0x86];

const EJEMPLO = 'Club Deportivo Ejemplo';
const EJEMPLO_B = 'Club Deportivo Ejemplo B';
const UNION = 'Unión Muestra';
const SIN_ESCUDO = 'Atlético Sin Escudo';
const OTHERS = ['Real Sintético', 'Deportivo Prueba', 'Racing Modelo', 'Sporting Ficticio', 'Peñas Norte', 'Brisamar'];

interface Seed {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  readonly teams: Readonly<Record<string, string>>;
  readonly badges: Readonly<Record<string, string>>;
  readonly matchIds: readonly string[];
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

/**
 * Seven matches of one round, in kickoff order: Ejemplo vs Ejemplo B; Unión Muestra (half transparent badge) vs a team
 * without a badge, postponed; three matches of teams with orange badges; Ejemplo B vs Ejemplo (swapped); and, on the
 * second page, a match whose home team has no badge.
 */
async function seed(t: TestApp): Promise<Seed> {
  const competitionId = (await ok<{ id: string }>(t.send('POST', '/competitions', { name: 'Liga de Calendarios' }))).id;
  const seasonId = (
    await ok<{ id: string }>(t.send('POST', `/competitions/${competitionId}/seasons`, { label: '2026/27' }))
  ).id;
  const base = `/competitions/${competitionId}/seasons/${seasonId}`;
  const teams: Record<string, string> = {};
  for (const name of [EJEMPLO, EJEMPLO_B, UNION, SIN_ESCUDO, ...OTHERS]) {
    const team = await ok<{ id: string }>(t.send('POST', '/teams', { name }));
    await ok(t.send('POST', `/competitions/${competitionId}/teams`, { teamId: team.id }));
    teams[name] = team.id;
  }
  await ok(t.send('POST', `${base}/participants/batch`, { teamIds: Object.values(teams) }));
  const roundId = (await ok<{ id: string }>(t.send('POST', `${base}/rounds`, { name: 'Jornada 9' }))).id;
  const match = async (home: string, away: string, day: number, postponed = false) => {
    const created = await ok<{ id: string }>(
      t.send('POST', `${base}/matches`, {
        homeTeamId: teams[home],
        awayTeamId: teams[away],
        kickoffAt: `2026-12-${String(day).padStart(2, '0')}T18:00:00.000Z`,
        stageId: null,
        roundId,
      }),
    );
    if (postponed) {
      await ok(
        t.send('POST', `${base}/matches/${created.id}/result`, {
          status: 'postponed',
          homeScore: null,
          awayScore: null,
        }),
      );
    }
    return created.id;
  };
  const matchIds = [
    await match(EJEMPLO, EJEMPLO_B, 10),
    await match(UNION, SIN_ESCUDO, 11, true),
    await match(OTHERS[0] ?? '', OTHERS[1] ?? '', 12),
    await match(OTHERS[2] ?? '', OTHERS[3] ?? '', 13),
    await match(OTHERS[4] ?? '', OTHERS[5] ?? '', 14),
    await match(EJEMPLO_B, EJEMPLO, 15),
    await match(SIN_ESCUDO, UNION, 16),
  ];
  const badges: Record<string, string> = {
    [EJEMPLO]: await uploadBadge(t, teams[EJEMPLO] ?? '', png({ width: 64, height: 64, rgba: [...RED, 255] })),
    [EJEMPLO_B]: await uploadBadge(t, teams[EJEMPLO_B] ?? '', png({ width: 64, height: 64, rgba: [...BLUE, 255] })),
    [UNION]: await uploadBadge(t, teams[UNION] ?? '', png({ width: 64, height: 64, rgba: [255, 255, 255, 128] })),
  };
  for (const name of OTHERS) {
    badges[name] = await uploadBadge(t, teams[name] ?? '', png({ width: 64, height: 64, rgba: [...ORANGE, 255] }));
  }
  return { competitionId, seasonId, roundId, teams, badges, matchIds };
}

async function generateCalendar(t: TestApp, s: Seed): Promise<string> {
  const response = await t.send('POST', '/content-batches', {
    requestKey: requestKey(),
    selection: {
      competitionId: s.competitionId,
      seasonId: s.seasonId,
      stageId: null,
      roundId: s.roundId,
      matchIds: s.matchIds,
      kinds: ['round_calendar'],
    },
  });
  expect(response.statusCode, response.body).toBe(202);
  const batch: ContentBatch = ContentBatchSchema.parse(response.json());
  const item = batch.items[0];
  if (item === undefined || item.projectId === null || item.runId === null) {
    throw new Error('the calendar was not created');
  }
  await waitForRun(t, item.projectId, item.runId);
  return item.projectId;
}

function stored(t: TestApp, versionId: string): { model: RenderModel; templateVersion: string } {
  const row = t.container.db
    .prepare<{ render_model: string; template_version: string }>(
      'SELECT render_model, template_version FROM element_versions WHERE id = ?',
    )
    .get([versionId]);
  return { model: JSON.parse(row?.render_model ?? '{}') as RenderModel, templateVersion: row?.template_version ?? '' };
}

function rowSlots(model: RenderModel): BadgeSlotElement[] {
  return model.elements.filter(
    (element): element is BadgeSlotElement => element.kind === 'badge_slot' && element.row !== undefined,
  );
}

async function imageOf(t: TestApp, versionId: string): Promise<Buffer> {
  const response = await t.get(`/element-versions/${versionId}/image`);
  expect(response.statusCode, response.body).toBe(200);
  return response.rawPayload;
}

/** The RGB at the centre of each row's badge slots, by row: [home, away]. */
async function rowColours(t: TestApp, versionId: string): Promise<number[][][]> {
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
  const slots = rowSlots(stored(t, versionId).model);
  const rows = Math.max(0, ...slots.map((slot) => slot.row ?? 0));
  return Array.from({ length: rows }, (_, index) =>
    (['team-badge-home', 'team-badge-away'] as const).map((side) => {
      const slot = slots.find((candidate) => candidate.row === index + 1 && candidate.slot === side);
      return slot === undefined ? [] : at(slot);
    }),
  );
}

function overviews(draft: Draft): Element[] {
  return draft.carousels.flatMap((carousel) => slidesOfType(carousel, 'round_overview'));
}

function teamBadgesResult(element: Element) {
  return element.currentVersion.qa.find((result) => result.check === 'team_badges');
}

describe('round calendars as rows with badges (PD-ARCH-01G-E.2)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('splits the calendar into pages of six, draws each row with its badges by the team identity, warns about the teams without a badge and is approved and exported', async () => {
    const t = await localApp();
    const s = await seed(t);
    const projectId = await generateCalendar(t, s);
    const draft = await draftOf(t, projectId);
    const pages = overviews(draft);
    expect(pages.map((page) => fieldText(page, 'fixtures').split('\n').length)).toEqual([6, 1]);
    const [first, second] = pages as [Element, Element];
    for (const page of pages) {
      expect(stored(t, page.currentVersion.id).templateVersion).toBe('2.0.0');
    }

    // Page 1, row by row: names in kickoff order, badges by the teams, never by the names.
    const lines = fieldText(first, 'fixtures').split('\n');
    expect(lines.map((line) => line.split(' · ')[0])).toEqual([
      `${EJEMPLO} vs ${EJEMPLO_B}`,
      `${UNION} vs ${SIN_ESCUDO}`,
      `${OTHERS[0] ?? ''} vs ${OTHERS[1] ?? ''}`,
      `${OTHERS[2] ?? ''} vs ${OTHERS[3] ?? ''}`,
      `${OTHERS[4] ?? ''} vs ${OTHERS[5] ?? ''}`,
      `${EJEMPLO_B} vs ${EJEMPLO}`,
    ]);
    // The postponed match shows its date, its time and its status; a scheduled match shows no status.
    expect(lines[1]).toMatch(
      /^Unión Muestra vs Atlético Sin Escudo · \d{1,2} \p{L}{3} \d{4} · \d{2}:\d{2} · Aplazado$/u,
    );
    expect(lines[0]?.split(' · ')).toHaveLength(3);
    const model = stored(t, first.currentVersion.id).model;
    const slot = (row: number, side: 'team-badge-home' | 'team-badge-away') =>
      rowSlots(model).find((candidate) => candidate.row === row && candidate.slot === side);
    expect(slot(1, 'team-badge-home')?.team).toMatchObject({
      teamId: s.teams[EJEMPLO],
      badge: { assetId: s.badges[EJEMPLO] },
    });
    expect(slot(1, 'team-badge-away')?.team).toMatchObject({
      teamId: s.teams[EJEMPLO_B],
      badge: { assetId: s.badges[EJEMPLO_B] },
    });
    expect(slot(6, 'team-badge-home')?.team).toMatchObject({ teamId: s.teams[EJEMPLO_B] });
    expect(slot(2, 'team-badge-away')).toMatchObject({
      empty: true,
      team: { teamId: s.teams[SIN_ESCUDO], badge: null },
    });

    const colours = await rowColours(t, first.currentVersion.id);
    expect(colours[0]).toEqual([[...RED], [...BLUE]]);
    expect(colours[5]).toEqual([[...BLUE], [...RED]]);
    for (const row of [2, 3, 4]) {
      expect(colours[row]).toEqual([[...ORANGE], [...ORANGE]]);
    }
    // A half transparent badge blends with the row band; the team without a badge leaves its slot empty.
    for (const [index, channel] of (colours[1]?.[0] ?? []).entries()) {
      expect(channel).toBeGreaterThan(BAND[index] ?? 0);
      expect(channel).toBeLessThan(255);
    }
    expect(colours[1]?.[1]).toEqual(BAND);

    // One warning per page, naming each empty slot with its row; never a blocking failure.
    expect(teamBadgesResult(first)).toEqual({
      check: 'team_badges',
      outcome: 'fail',
      severity: 'warning',
      details: { emptyBadgeSlots: [], emptyRowBadgeSlots: [{ row: 2, slot: 'team-badge-away' }] },
      acknowledgedAt: null,
    });
    expect(teamBadgesResult(second)?.details).toEqual({
      emptyBadgeSlots: [],
      emptyRowBadgeSlots: [{ row: 1, slot: 'team-badge-home' }],
    });
    // Page 2: the team without a badge at home, the half transparent badge away (the same blend as on page 1).
    expect(await rowColours(t, second.currentVersion.id)).toEqual([[BAND, colours[1]?.[0]]]);
    for (const carousel of draft.carousels) {
      for (const element of carousel.elements) {
        expect(
          element.currentVersion.qa.filter((item) => item.severity === 'blocking' && item.outcome === 'fail'),
          element.slideType ?? 'caption',
        ).toEqual([]);
      }
    }

    // Like every QA warning (OD-09), it is acknowledged before the page is approved; then the calendar is exported.
    const refused = await approve(t, first);
    expect(refused.statusCode, refused.body).toBe(409);
    expect((refused.json() as { code: string }).code).toBe('QA_ACK_REQUIRED');
    const approved = await approveDraft(t, projectId);
    const exportedPages: string[] = [];
    for (const carousel of approved.carousels) {
      const written = await exported(t, carousel.id);
      // Every slide of the carousel is exported, in carousel order, the calendar pages included.
      const slides = carousel.elements.filter((element) => element.kind === 'slide');
      const images = written.files.filter((file) => file.kind === 'slide_image');
      expect(images.map((file) => file.elementVersionId)).toEqual(slides.map((slide) => slide.currentVersion.id));
      expect([...images.map((file) => file.position)].sort((a, b) => a - b)).toEqual(
        images.map((file) => file.position),
      );
      exportedPages.push(
        ...slides.filter((slide) => slide.slideType === 'round_overview').map((slide) => slide.currentVersion.id),
      );
    }
    expect(exportedPages).toEqual(overviews(approved).map((page) => page.currentVersion.id));
    expect(exportedPages).toHaveLength(2);
    expect(t.egress.requests).toHaveLength(0);
  });

  it('keeps the badges of the project when a calendar page is regenerated after a badge is replaced or retired', async () => {
    const t = await localApp();
    const s = await seed(t);
    const projectId = await generateCalendar(t, s);
    const page = overviews(await draftOf(t, projectId))[0] as Element;
    const before = await imageOf(t, page.currentVersion.id);

    await uploadBadge(t, s.teams[EJEMPLO] ?? '', png({ width: 64, height: 64, rgba: [...GREEN, 255] }));
    const retired = await t.send('DELETE', `/teams/${s.teams[EJEMPLO_B] ?? ''}/badge`);
    expect([200, 204], retired.body).toContain(retired.statusCode);

    const response = await t.send('POST', `${elementPath(page)}/regenerate`);
    expect(response.statusCode, response.body).toBe(201);
    const regenerated = ElementSchema.parse(response.json());
    expect(fieldText(regenerated, 'fixtures').split('\n')).toHaveLength(6);
    expect((await imageOf(t, regenerated.currentVersion.id)).equals(before)).toBe(true);
  });

  it('keeps pages of eight and version 1.0.0 for projects created before 01G-E.2', async () => {
    const t = await localApp();
    const s = await seed(t);
    const projectId = await generateCalendar(t, s);
    const legacySnapshots: (string | null)[] = [
      // An engine project before 01G-E.1 had no snapshot.
      null,
      // A 01G-D project with a visual template recorded the version 1 format.
      JSON.stringify({ [s.teams[EJEMPLO] ?? '']: s.badges[EJEMPLO] }),
      // A 01G-E.1 project recorded version 2: badges for the match slides, calendars as lines of text.
      JSON.stringify({ version: 2, teams: { [s.teams[EJEMPLO] ?? '']: s.badges[EJEMPLO] } }),
    ];
    for (const snapshot of legacySnapshots) {
      // The project as it was created then: its snapshot, and a draft planned with it (a redraft reads the snapshot).
      t.container.db.prepare('UPDATE projects SET badge_snapshot_json = ? WHERE id = ?').run([snapshot, projectId]);
      await runWorkflow(t, projectId, 'redraft');
      const pages = overviews(await draftOf(t, projectId));
      expect(pages.map((page) => fieldText(page, 'fixtures').split('\n').length)).toEqual([7]);
      expect(stored(t, pages[0]?.currentVersion.id ?? '').templateVersion).toBe('1.0.0');
      const images: Buffer[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const page = overviews(await draftOf(t, projectId))[0] as Element;
        const response = await t.send('POST', `${elementPath(page)}/regenerate`);
        expect(response.statusCode, response.body).toBe(201);
        const regenerated = ElementSchema.parse(response.json());
        // The page is rebuilt as those projects planned it: up to eight matches, one line each, no time, no row.
        const lines = fieldText(regenerated, 'fixtures').split('\n');
        expect(lines, String(snapshot)).toHaveLength(7);
        expect(lines.every((line) => line.split(' · ').length === 2)).toBe(true);
        const { model, templateVersion } = stored(t, regenerated.currentVersion.id);
        expect(templateVersion).toBe('1.0.0');
        expect(model.elements.some((element) => element.kind === 'badge_slot')).toBe(false);
        expect(teamBadgesResult(regenerated)?.outcome).toBe('pass');
        images.push(await imageOf(t, regenerated.currentVersion.id));
      }
      expect(images[1]?.equals(images[0] ?? Buffer.alloc(0))).toBe(true);
    }
  });
});
