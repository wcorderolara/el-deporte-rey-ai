/**
 * TEAM-DISPLAY-01 (PD-37): the optional presentation name of a team, through the real server, the real workflow stages
 * (research, verification, content with the stub AI, rendering, visual QA), approval and export, on the SQLite database
 * of a temporary app. Every competition, team and match is synthetic; nothing reaches a provider or an AI service.
 *
 * Covered: the team-name elements of every engine slide (result, fixture, preview and the calendar rows) drawn with
 * the presentation name of the project's snapshot (version 4), or with the official name for a team without one, and so
 * are the team placeholders of the AI text drawn on a slide; the stored text, the caption, the editorial copy and the
 * exported files keep the official names; `team_names` and `data_match` pass with the snapshot names (their refusals
 * are covered by the visual QA unit tests); a later change of the presentation name reaches only new projects, and a
 * project created before TEAM-DISPLAY-01 (snapshot version 3) keeps drawing the official names.
 */
import { type Draft, type Element, ElementSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import type { TestApp } from '../../support/index.js';
import { cleanups } from '../ingestion/support.js';

import { currentCopies, fieldTexts, generateCopy } from './editorial-copy-support.js';

import {
  type LocalCompetition,
  finished,
  generate,
  kickoff,
  localApp,
  localCompetition,
  ok,
  requestKeys,
} from './extreme-support.js';
import {
  WORKFLOW_TEST_TIMEOUT,
  type RenderElementView,
  type StoredText,
  approveDraft,
  draftOf,
  elementPath,
  exportFile,
  exportFileNames,
  exported,
  renderModelOf,
  storedVersion,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const requestKey = requestKeys('d');

const ALFA = 'Club Sintético Alfa de la Ciudad Ficticia';
const BETA = 'Club Sintético Beta';
const GAMMA = 'Club Sintético Gamma';
const ALFA_SHORT = 'Alfa CF';
const GAMMA_SHORT = 'Los Gammas';
/** The presentation name drawn for each official name of a team that has one. */
const SHORT_OF: Readonly<Record<string, string>> = { [ALFA]: ALFA_SHORT, [GAMMA]: GAMMA_SHORT };

interface Seed {
  readonly comp: LocalCompetition;
  readonly roundId: string;
  /** ALFA 2-1 BETA, finished. */
  readonly result: string;
  /** GAMMA - ALFA, scheduled. */
  readonly fixture: string;
}

async function setDisplayName(t: TestApp, teamId: string, name: string, displayName: string | null): Promise<void> {
  await ok(t.send('PATCH', `/teams/${teamId}`, { name, region: null, displayName }));
}

async function seed(t: TestApp): Promise<Seed> {
  const comp = await localCompetition(t, {
    name: 'Liga Sintética de Alias',
    season: '2026/27',
    teams: [ALFA, BETA, GAMMA],
  });
  await setDisplayName(t, comp.team(ALFA), ALFA, ALFA_SHORT);
  await setDisplayName(t, comp.team(GAMMA), GAMMA, GAMMA_SHORT);
  const roundId = await comp.round('Jornada 4');
  const result = await comp.match(ALFA, BETA, roundId, kickoff(1), finished(2, 1));
  const fixture = await comp.match(GAMMA, ALFA, roundId, kickoff(20));
  return { comp, roundId, result, fixture };
}

function snapshotOf(t: TestApp, projectId: string): unknown {
  const row = t.container.db
    .prepare<{ badge_snapshot_json: string | null }>('SELECT badge_snapshot_json FROM projects WHERE id = ?')
    .get([projectId]);
  return row?.badge_snapshot_json === null || row === undefined ? null : JSON.parse(row.badge_snapshot_json);
}

function slides(draft: Draft): Element[] {
  return draft.carousels.flatMap((carousel) => carousel.elements.filter((element) => element.kind === 'slide'));
}

function captions(draft: Draft): Element[] {
  return draft.carousels.flatMap((carousel) => carousel.elements.filter((element) => element.kind === 'caption'));
}

function textOf(t: TestApp, element: Element): StoredText {
  return JSON.parse(storedVersion(t, element.currentVersion.id).text) as StoredText;
}

function drawn(t: TestApp, versionId: string): RenderElementView[] {
  return renderModelOf(storedVersion(t, versionId)).elements;
}

/** The texts the image draws in its team-name elements. */
function drawnTeamNames(t: TestApp, versionId: string): string[] {
  return drawn(t, versionId)
    .filter((element) => element.kind === 'text' && element.semantic === 'team_name')
    .map((element) => element.text ?? '');
}

/** Every text of a stored version (all fields, all segments). */
function storedTexts(text: StoredText): string {
  return text.fields.flatMap((field) => field.segments.map((segment) => segment.text)).join('|');
}

function qaOutcome(element: Pick<Element, 'currentVersion'>, check: string): string | undefined {
  return element.currentVersion.qa.find((result) => result.check === check)?.outcome;
}

function onlySlide(draft: Draft, slideType: string): Element {
  const slide = slides(draft).find((element) => element.slideType === slideType);
  if (slide === undefined) {
    throw new Error(`no ${slideType} slide`);
  }
  return slide;
}

async function regenerate(t: TestApp, element: Element): Promise<Element> {
  const response = await t.send('POST', `${elementPath(element)}/regenerate`);
  expect(response.statusCode, response.body).toBe(201);
  return ElementSchema.parse(response.json());
}

describe('team presentation names in the images (TEAM-DISPLAY-01)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('draws the snapshot presentation names in the team-name elements of every engine slide, and the official names everywhere else', async () => {
    const t = await localApp(cleanup);
    const s = await seed(t);
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: s.comp.selection(
        s.roundId,
        [s.result, s.fixture],
        ['match_result', 'round_calendar', 'upcoming_matches', 'match_preview'],
      ),
    });
    const projects = batch.items.filter((item) => item.projectId !== null);
    expect(projects.map((item) => [item.kind, item.status])).toEqual([
      ['round_calendar', 'completed'],
      ['upcoming_matches', 'completed'],
      ['match_result', 'completed'],
      ['match_preview', 'completed'],
    ]);
    const resultProject = projects.find((item) => item.kind === 'match_result')?.projectId ?? '';

    const drawnByType = new Map<string, string[]>();
    const aiDrawn: string[] = [];
    for (const item of projects) {
      const projectId = item.projectId ?? '';
      // The snapshot records the presentation name of each team of the piece that has one, by local team ID.
      const snapshot = snapshotOf(t, projectId) as { version: number; teams: Record<string, unknown>; names: unknown };
      expect(snapshot.version).toBe(4);
      const expectedNames = Object.fromEntries(
        [
          [s.comp.team(ALFA), ALFA_SHORT],
          [s.comp.team(GAMMA), GAMMA_SHORT],
        ].filter(([teamId]) => Object.hasOwn(snapshot.teams, teamId ?? '')),
      );
      expect(snapshot.names).toEqual(expectedNames);

      const draft = await draftOf(t, projectId);
      for (const slide of slides(draft)) {
        const text = textOf(t, slide);
        // The stored text, and so the review fields and the AI text, keep the official names only.
        expect(storedTexts(text)).not.toContain(ALFA_SHORT);
        expect(storedTexts(text)).not.toContain(GAMMA_SHORT);
        const names = drawnTeamNames(t, slide.currentVersion.id);
        const key = `${item.kind}/${slide.slideType ?? ''}`;
        drawnByType.set(key, [...(drawnByType.get(key) ?? []), ...names]);
        // The image draws the presentation name of a team that has one, the official name of a team that has not.
        for (const name of names) {
          expect([ALFA_SHORT, GAMMA_SHORT, BETA]).toContain(name);
        }
        // The AI text drawn on the slide is its stored text with each team placeholder (a fact segment of that team's
        // name) drawn with the presentation name; commentary and every other value are drawn as stored.
        for (const element of drawn(t, slide.currentVersion.id)) {
          if (element.field === 'headline' || element.field === 'description') {
            const segments = text.fields.find((field) => field.field === element.field)?.segments ?? [];
            const expected = segments
              .map((segment) =>
                segment.provenance === 'fact' ? (SHORT_OF[segment.text] ?? segment.text) : segment.text,
              )
              .join('');
            expect(element.text, `${slide.slideType ?? ''} ${element.field}`).toBe(expected);
            aiDrawn.push(element.text ?? '');
          }
        }
        expect(qaOutcome(slide, 'team_names'), JSON.stringify(slide.currentVersion.qa)).toBe('pass');
        expect(qaOutcome(slide, 'data_match')).toBe('pass');
      }
      for (const caption of captions(draft)) {
        expect(storedTexts(textOf(t, caption))).not.toContain(ALFA_SHORT);
        expect(storedTexts(textOf(t, caption))).not.toContain(GAMMA_SHORT);
      }
    }
    expect(Object.fromEntries(drawnByType)).toEqual({
      'match_result/cover': [],
      'match_result/match_result': [ALFA_SHORT, BETA],
      'match_result/closing': [],
      // The calendar row of the round's match not played yet, then its fixture slide.
      'round_calendar/cover': [],
      'round_calendar/round_overview': [GAMMA_SHORT, ALFA_SHORT],
      'round_calendar/fixture': [GAMMA_SHORT, ALFA_SHORT],
      'round_calendar/closing': [],
      'upcoming_matches/cover': [],
      'upcoming_matches/fixture': [GAMMA_SHORT, ALFA_SHORT],
      'upcoming_matches/closing': [],
      'match_preview/cover': [],
      'match_preview/match_preview': [GAMMA_SHORT, ALFA_SHORT],
      'match_preview/closing': [],
    });
    // The stub writes the team placeholders into the AI text: the images draw them with the presentation names.
    expect(aiDrawn.some((value) => value.includes(ALFA_SHORT))).toBe(true);
    expect(aiDrawn.some((value) => value.includes(GAMMA_SHORT))).toBe(true);
    expect(aiDrawn.some((value) => value.includes(ALFA))).toBe(false);
    const result = onlySlide(await draftOf(t, resultProject), 'match_result');
    expect(textOf(t, result).fields.find((field) => field.field === 'team_home')?.segments[0]?.text).toBe(ALFA);

    // The editorial copy (free stub writer) is written from the facts: official names only.
    const copies = Object.values(currentCopies(await generateCopy(t, resultProject, requestKey())));
    const copyText = copies.map((version) => Object.values(fieldTexts(version)).join('|')).join('|');
    expect(copyText).toContain(ALFA);
    expect(copyText).not.toContain(ALFA_SHORT);
    expect(copyText).not.toContain(GAMMA_SHORT);

    // Approval and export: the exported files keep the official names (the images carry the presentation name).
    const approved = await approveDraft(t, resultProject);
    const carousel = approved.carousels[0];
    expect(carousel).toBeDefined();
    const written = await exported(t, carousel?.id ?? '');
    for (const name of exportFileNames(t, written).filter((file) => !file.endsWith('.png'))) {
      const content = exportFile(t, written, name).toString('utf8');
      expect(content, name).not.toContain(ALFA_SHORT);
      expect(content, name).not.toContain(GAMMA_SHORT);
    }
    // An export already written never changes: after the presentation names change, every file is the same.
    const files = Object.fromEntries(
      exportFileNames(t, written).map((name) => [name, exportFile(t, written, name).toString('base64')]),
    );
    await setDisplayName(t, s.comp.team(ALFA), ALFA, 'Alfa Otra');
    await setDisplayName(t, s.comp.team(GAMMA), GAMMA, null);
    expect(
      Object.fromEntries(
        exportFileNames(t, written).map((name) => [name, exportFile(t, written, name).toString('base64')]),
      ),
    ).toEqual(files);
  });

  it('keeps the names of each project: a later change reaches only new projects, and earlier projects keep the official names', async () => {
    const t = await localApp(cleanup);
    const s = await seed(t);
    const select = () => ({
      requestKey: requestKey(),
      selection: s.comp.selection(s.roundId, [s.result], ['match_result']),
    });
    const first = (await generate(t, select())).items[0]?.projectId ?? '';
    const slide = onlySlide(await draftOf(t, first), 'match_result');
    expect(drawnTeamNames(t, slide.currentVersion.id)).toEqual([ALFA_SHORT, BETA]);

    // The operator changes the presentation name, then removes it: the project keeps the name it was created with.
    const recorded = JSON.stringify(snapshotOf(t, first));
    await setDisplayName(t, s.comp.team(ALFA), ALFA, 'Alfa Nueva');
    // The project's snapshot is not rewritten.
    expect(JSON.stringify(snapshotOf(t, first))).toBe(recorded);
    const again = await regenerate(t, slide);
    expect(drawnTeamNames(t, again.currentVersion.id)).toEqual([ALFA_SHORT, BETA]);
    expect(qaOutcome(again, 'team_names')).toBe('pass');

    // A new project uses the name as it is now.
    const second = (await generate(t, select())).items[0]?.projectId ?? '';
    const newSlide = onlySlide(await draftOf(t, second), 'match_result');
    expect(drawnTeamNames(t, newSlide.currentVersion.id)).toEqual(['Alfa Nueva', BETA]);

    await setDisplayName(t, s.comp.team(ALFA), ALFA, null);
    const kept = await regenerate(t, again);
    expect(drawnTeamNames(t, kept.currentVersion.id)).toEqual([ALFA_SHORT, BETA]);
    const third = (await generate(t, select())).items[0]?.projectId ?? '';
    expect(snapshotOf(t, third)).toMatchObject({ version: 4, names: {} });
    expect(drawnTeamNames(t, onlySlide(await draftOf(t, third), 'match_result').currentVersion.id)).toEqual([
      ALFA,
      BETA,
    ]);

    // A project created before TEAM-DISPLAY-01 recorded snapshot version 3: it keeps the official names, whatever the
    // teams' presentation names are now.
    await setDisplayName(t, s.comp.team(ALFA), ALFA, ALFA_SHORT);
    const legacy = snapshotOf(t, second) as { teams: Record<string, string | null> };
    t.container.db
      .prepare('UPDATE projects SET badge_snapshot_json = ? WHERE id = ?')
      .run([JSON.stringify({ version: 3, teams: legacy.teams }), second]);
    const legacySlide = await regenerate(t, onlySlide(await draftOf(t, second), 'match_result'));
    expect(drawnTeamNames(t, legacySlide.currentVersion.id)).toEqual([ALFA, BETA]);
    expect(qaOutcome(legacySlide, 'team_names')).toBe('pass');
    expect(qaOutcome(legacySlide, 'data_match')).toBe('pass');
    // Its AI text is drawn as stored too: the official names.
    for (const element of drawn(t, legacySlide.currentVersion.id)) {
      if (element.field === 'headline' || element.field === 'description') {
        expect(element.text ?? '').not.toContain(ALFA_SHORT);
      }
    }
  });
});
