/**
 * UI-06.3 edge cases of the sports data shown on slides, through the real server, the real workflow stages (research,
 * verification, content with the stub AI, rendering, visual QA), review, approval and export of a temporary app with
 * the operator-validated local sports source. Every competition, team and match is synthetic (Liga Sintética …,
 * Club Sintético …) and created through the API; nothing reaches a provider.
 *
 * The rules under test: team names follow the contract `TeamName` rule (1 to 64 Unicode letters, marks, digits,
 * spaces and `.'&()-`; NFC display form, NFKC case-insensitive identity), competition and season names the
 * `DisplayName` rule (the same plus `/`, up to 80), and a project's stage label (the round, prefixed by its stage) the
 * `StageName` rule (up to 80, `selectionLabelOf`); official names are shown exactly (R-052, R-237) and long texts are
 * checked by the blocking `text_fit` check (requirements edge case «Long team names, accents or special characters»).
 *
 * Covered: long names with accents and special characters kept exactly from the API to the exported files, in Spanish
 * and English, with two-digit scores; names at every contract maximum (generated in full, never cut, the overflow
 * caught by `text_fit` and the field-length check, so those slides cannot be approved: a known limitation, see the
 * test); names outside the rules refused and equivalent spellings recognized as one team; a stage and round label
 * over 80 characters; every local status and incomplete data in one round; manual corrections after an export; and a
 * score above 99, which the local API accepts and keeps but this route cannot record: the preview and the batch
 * exclude it as `score_not_supported` and the compatible matches are generated (UI06.3-D06).
 */
import {
  type Carousel,
  ContentBatchPreviewSchema,
  type ContentBatchPreview,
  type Draft,
  type Element,
  ElementSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import type { TestApp } from '../../support/index.js';
import { cleanups } from '../ingestion/support.js';

import {
  type LocalCompetition,
  finished,
  generate,
  kickoff,
  localApp,
  localCompetition,
  ok,
  requestKeys,
  zipEntries,
} from './extreme-support.js';
import {
  WORKFLOW_TEST_TIMEOUT,
  allElements,
  approve,
  approveDraft,
  approveOne,
  draftOf,
  elementPath,
  expectProblem,
  exportDetail,
  exportFile,
  exported,
  fieldText,
  finalApprove,
  getProject,
  manifestOf,
  renderModelOf,
  sha256,
  slidesOfType,
  storedVersion,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const requestKey = requestKeys('b');

/** 80 characters: the `DisplayName` maximum, with accents and every special character the rule allows. */
const LONG_COMPETITION = "Liga Sintética Profesional de Fútbol Ñandú & Güira (Sur) - Edición l'Été 2026/27";
/** 80 characters each. */
const LONG_SEASON = 'Temporada Sintética 2026/27 - Fase Regular Apertura & Clausura (Edición Única) 1';
const LONG_ROUND = 'Jornada Sintética Número Veintinueve de la Fase Regular - Partidos Aplazados (B)';
/** 64 characters each: the `TeamName` maximum. */
const LONG_HOME = "Club Sintético Atlético Río Ébano & Peñas Ñandú (Sur) l'Été-Mar.";
const LONG_AWAY = 'Unión Deportiva Sintética Güira & Ceiba (Norte) C.D. Áncora-Mar.';
/** Accented names in the style of the `accented-names` fixture scenario, made synthetic. */
const EBANO = 'Atlético Sintético Río Ébano';
const NANDU = 'Peñas Sintéticas Ñandú (Sur)';
const GUIRA = 'Unión Sintética Güira & Ceiba';
const ANCORA = "C.D. Sintético Áncora-Mar l'Été";
/** Entered decomposed (NFD: a letter followed by a combining accent); stored and shown composed (NFC). */
const DECOMPOSED = 'Unión Sintética del Norte';
const COMPOSED = 'Unión Sintética del Norte';

function texts(draft: Draft): string {
  return JSON.stringify(
    allElements(draft).map((element) => element.currentVersion.fields.map((field) => fieldText(element, field.field))),
  );
}

/** `home|away|score` of every match result slide of a draft. */
function resultLines(draft: Draft): string[] {
  return draft.carousels.flatMap((carousel) =>
    slidesOfType(carousel, 'match_result').map((slide) =>
      ['team_home', 'team_away', 'score'].map((field) => fieldText(slide, field)).join('|'),
    ),
  );
}

function qaOf(element: Element, check: string) {
  return element.currentVersion.qa.find((result) => result.check === check);
}

function blockingFailures(element: Element): string[] {
  return element.currentVersion.qa
    .filter((result) => result.severity === 'blocking' && result.outcome === 'fail')
    .map((result) => result.check);
}

/** The drawn text elements of a slide's stored render model, by field. */
function drawn(t: TestApp, element: Element, field: string) {
  return renderModelOf(storedVersion(t, element.currentVersion.id)).elements.filter(
    (entry) => entry.kind === 'text' && entry.field === field,
  );
}

async function previewOf(t: TestApp, selection: unknown): Promise<ContentBatchPreview> {
  return ContentBatchPreviewSchema.parse(await ok(t.send('POST', '/content-batches/previews', selection)));
}

const COUNTS = {
  content_generation_batches: 'SELECT COUNT(*) AS n FROM content_generation_batches',
  projects: 'SELECT COUNT(*) AS n FROM projects',
} as const;

function count(t: TestApp, table: keyof typeof COUNTS): number {
  return t.container.db.prepare<{ n: number }>(COUNTS[table]).get()?.n ?? 0;
}

describe('long names, accents and special characters (R-052, R-237)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('keeps every name exactly from the API to the exported files, in Spanish and English, with two-digit scores', async () => {
    const t = await localApp(cleanup);
    const c = await localCompetition(t, {
      name: LONG_COMPETITION,
      season: '2026/27',
      teams: [LONG_HOME, LONG_AWAY, EBANO, NANDU, GUIRA, ANCORA, DECOMPOSED],
    });
    // The decomposed entry is stored composed.
    expect((await ok<{ name: string }>(t.get(`/teams/${c.team(DECOMPOSED)}`))).name).toBe(COMPOSED);

    const roundId = await c.round('Jornada 29');
    const matchIds = [
      await c.match(LONG_HOME, LONG_AWAY, roundId, kickoff(1), finished(12, 11)),
      await c.match(EBANO, NANDU, roundId, kickoff(2), finished(10, 0)),
      await c.match(GUIRA, ANCORA, roundId, kickoff(3), finished(99, 98)),
      await c.match(DECOMPOSED, EBANO, roundId, kickoff(4), finished(0, 0)),
    ];
    const selection = c.selection(roundId, matchIds, ['round_results', 'match_result']);
    const preview = await previewOf(t, selection);
    expect(preview.context.competitionName).toBe(LONG_COMPETITION);
    expect(preview.matches.map((match) => [match.homeTeamName, match.awayTeamName, match.ineligibility])).toEqual([
      [LONG_HOME, LONG_AWAY, null],
      [EBANO, NANDU, null],
      [GUIRA, ANCORA, null],
      [COMPOSED, EBANO, null],
    ]);

    const batch = await generate(t, { requestKey: requestKey(), selection });
    expect(batch.totals).toMatchObject({ requested: 5, generated: 5, failed: 0, skipped: 0 });
    const roundProject = batch.items[0]?.projectId ?? '';
    expect((await getProject(t, roundProject)).competitionName).toBe(LONG_COMPETITION);
    const draft = await draftOf(t, roundProject);
    const expectedLines = [
      `${LONG_HOME}|${LONG_AWAY}|12-11`,
      `${EBANO}|${NANDU}|10-0`,
      `${GUIRA}|${ANCORA}|99-98`,
      `${COMPOSED}|${EBANO}|0-0`,
    ];
    expect(resultLines(draft)).toEqual(expectedLines);
    // No decomposed form anywhere in the content.
    expect(texts(draft)).toBe(texts(draft).normalize('NFC'));
    expect(texts(draft)).not.toContain('́');

    for (const element of allElements(draft)) {
      const label = String(element.slideType ?? 'caption');
      expect(element.currentVersion.contentFlags, label).toEqual([]);
      expect(blockingFailures(element), label).toEqual([]);
    }
    const matchSlides = draft.carousels.flatMap((carousel) => slidesOfType(carousel, 'match_result'));
    for (const slide of matchSlides) {
      for (const check of ['data_match', 'team_names', 'text_fit']) {
        expect(qaOf(slide, check)?.outcome, check).toBe('pass');
      }
      // Each name and score is drawn whole, wrapped at spaces, never cut or replaced by an ellipsis.
      for (const field of ['team_home', 'team_away', 'score']) {
        const [element] = drawn(t, slide, field);
        expect(element?.text).toBe(fieldText(slide, field));
        expect(element?.lines?.join(' ')).toBe(fieldText(slide, field));
        expect(element?.overflow).toBe(false);
      }
    }
    // The 64-character name takes three lines.
    expect(drawn(t, matchSlides[0] as Element, 'team_home')[0]?.lines).toHaveLength(3);

    // Approved and exported: the manifest and the files carry the exact names.
    const approved = await approveDraft(t, roundProject);
    const written = await exported(t, (approved.carousels[0] as Carousel).id);
    expect(manifestOf(t, written).project).toMatchObject({
      competitionName: LONG_COMPETITION,
      seasonLabel: '2026/27',
      stageLabel: 'Jornada 29',
    });
    const caption = exportFile(t, written, 'caption.txt').toString('utf8');
    for (const name of [LONG_HOME, LONG_AWAY, EBANO, NANDU, GUIRA, ANCORA, COMPOSED]) {
      expect(caption).toContain(name);
    }
    const zip = await t.get(`/exports/${written.id}/download`);
    expect(zipEntries(zip.rawPayload).map((entry) => sha256(entry.bytes))).toEqual(
      written.files.map((file) => file.sha256),
    );

    // The same results in English: the official names are not translated.
    const english = await generate(t, {
      requestKey: requestKey(),
      selection: { ...c.selection(roundId, matchIds, ['round_results']), language: 'en' },
    });
    const englishDraft = await draftOf(t, english.items[0]?.projectId ?? '');
    expect(englishDraft.language).toBe('en');
    expect(resultLines(englishDraft)).toEqual(expectedLines);
    for (const element of allElements(englishDraft)) {
      expect(element.currentVersion.contentFlags).toEqual([]);
      expect(blockingFailures(element)).toEqual([]);
    }
    expect(t.egress.requests).toHaveLength(0);
  });

  it('generates names at every contract maximum in full; what does not fit is caught by text_fit or the field-length check and cannot be approved (known limitation)', async () => {
    // Limitation UI06.3-L1 (reported; it contradicts no decision): valid names at the contract maximums make the
    // built-in cover, the round calendar rows and the preview overflow, and the stub writer's fixture headline exceed
    // its 80-character field limit. The names are never cut (R-052); the checks block those slides (R-037), the
    // refusal says to regenerate, and a regeneration gives the same result. Only shorter names make them approvable.
    const t = await localApp(cleanup);
    const c = await localCompetition(t, { name: LONG_COMPETITION, season: LONG_SEASON, teams: [LONG_HOME, LONG_AWAY] });
    const roundId = await c.round(LONG_ROUND);
    const played = await c.match(LONG_HOME, LONG_AWAY, roundId, kickoff(1), finished(12, 11));
    const pending = await c.match(LONG_AWAY, LONG_HOME, roundId, kickoff(20));
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, [played, pending], ['match_result', 'round_calendar', 'match_preview']),
    });
    // Generation is never stopped by a long name.
    const completed = batch.items.filter((item) => item.status === 'completed');
    expect(completed.map((item) => item.kind)).toEqual(['round_calendar', 'match_result', 'match_preview']);
    expect(batch.totals.failed).toBe(0);
    const project = await getProject(t, completed[1]?.projectId ?? '');
    expect(project).toMatchObject({ competitionName: LONG_COMPETITION, seasonLabel: LONG_SEASON });
    expect(project.title.length).toBeLessThanOrEqual(200);

    const [calendar, result, preview] = await Promise.all(
      completed.map(async (item) => draftOf(t, item.projectId ?? '')),
    );
    const slide = (draft: Draft | undefined, type: Element['slideType']): Element => {
      const found = (draft?.carousels ?? []).flatMap((carousel) => slidesOfType(carousel, type))[0];
      if (found === undefined) {
        throw new Error(`no ${String(type)} slide`);
      }
      return found;
    };

    // The match result keeps both names whole and passes every blocking check.
    const resultSlide = slide(result, 'match_result');
    expect([fieldText(resultSlide, 'team_home'), fieldText(resultSlide, 'team_away')]).toEqual([LONG_HOME, LONG_AWAY]);
    expect(blockingFailures(resultSlide)).toEqual([]);

    // The cover (competition, round and season in its description) does not fit: blocking text_fit.
    const cover = slide(result, 'cover');
    expect(qaOf(cover, 'text_fit')).toMatchObject({ outcome: 'fail', severity: 'blocking' });
    expect(qaOf(cover, 'text_fit')?.details).toMatchObject({
      overflowingElements: expect.arrayContaining(['description']),
    });
    // The calendar page draws each long name whole in its row, marked as overflowing, never cut.
    const page = slide(calendar, 'round_overview');
    expect(qaOf(page, 'text_fit')?.details).toMatchObject({
      overflowingElements: expect.arrayContaining(['row-1-home', 'row-1-away']),
    });
    const rows = renderModelOf(storedVersion(t, page.currentVersion.id)).elements.filter((entry) =>
      ['row-1-home', 'row-1-away'].includes(entry.id),
    );
    expect(rows.map((entry) => [entry.id, entry.text, entry.overflow])).toEqual([
      ['row-1-home', LONG_AWAY, true],
      ['row-1-away', LONG_HOME, true],
    ]);
    // The preview's title (round) and footer (competition and season) do not fit either.
    expect(qaOf(slide(preview, 'match_preview'), 'text_fit')?.details).toMatchObject({
      overflowingElements: expect.arrayContaining(['title', 'footer']),
    });
    // The stub writer's fixture headline («Partido por jugarse: <home team>») is over its 80-character limit.
    const fixture = slide(calendar, 'fixture');
    expect(fixture.currentVersion.contentFlags).toEqual([
      { code: 'FORBIDDEN_CONTENT', field: 'headline', excerpt: 'text over the field limit of 80' },
    ]);

    // Such slides cannot be approved, and a regeneration gives the same result.
    expectProblem(await approve(t, cover), 409, 'QA_FAILED');
    expectProblem(await approve(t, fixture), 409, 'CONTENT_FLAGGED');
    const regenerated = await t.send('POST', `${elementPath(cover)}/regenerate`);
    expect(regenerated.statusCode, regenerated.body).toBe(201);
    expect(qaOf(ElementSchema.parse(regenerated.json()), 'text_fit')?.details).toEqual(
      qaOf(cover, 'text_fit')?.details,
    );
    const carousel = result?.carousels[0] as Carousel;
    for (const element of carousel.elements.filter((entry) => entry.slideType !== 'cover')) {
      await approveOne(t, element);
    }
    const refused = expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    expect(refused.items?.map((item) => item.elementId)).toContain(cover.id);
  });

  it('refuses names outside the rules before storing anything and recognizes equivalent spellings as one team', async () => {
    const t = await localApp(cleanup);
    const teamsBefore = (await ok<{ teams: unknown[] }>(t.get('/teams'))).teams.length;
    const refusedTeams = [
      'C'.repeat(65),
      'Club Sintético!',
      'Club Sintético #1',
      'Club Sintético/Norte',
      'Club_Sintético',
      'Club Sintético, Norte',
      'Club "Sintético"',
      'Club @Sintético',
      'Club Sintético \u{1F600}',
      'Club​Sintético',
      'Club\tSintético',
      '   ',
    ];
    for (const name of refusedTeams) {
      expectProblem(await t.send('POST', '/teams', { name }), 400, 'VALIDATION_FAILED');
    }
    for (const name of ['L'.repeat(81), 'Liga Sintética #1', 'Liga_Sintética', 'Liga Sintética\nNorte']) {
      expectProblem(await t.send('POST', '/competitions', { name }), 400, 'VALIDATION_FAILED');
    }
    expect((await ok<{ teams: unknown[] }>(t.get('/teams'))).teams).toHaveLength(teamsBefore);

    const c = await localCompetition(t, { name: 'Liga Sintética de Reglas', season: '2026/27', teams: [DECOMPOSED] });
    expectProblem(
      await t.send('POST', `/competitions/${c.competitionId}/seasons`, { label: 'T'.repeat(81) }),
      400,
      'VALIDATION_FAILED',
    );
    expectProblem(await t.send('POST', `${c.base}/rounds`, { name: 'R'.repeat(81) }), 400, 'VALIDATION_FAILED');
    expectProblem(await t.send('POST', `${c.base}/stages`, { name: 'Fase #1' }), 400, 'VALIDATION_FAILED');
    // The composed spelling, another letter case and extra spaces are the same team.
    for (const name of [COMPOSED, 'UNIÓN SINTÉTICA DEL NORTE', '  Unión   Sintética del Norte ']) {
      expectProblem(await t.send('POST', '/teams', { name }), 409, 'DUPLICATE_TEAM');
    }
    // The longest valid names are accepted as entered.
    expect((await ok<{ name: string }>(t.send('POST', '/teams', { name: LONG_HOME }))).name).toBe(LONG_HOME);
    expect((await ok<{ name: string }>(t.send('POST', '/competitions', { name: LONG_COMPETITION }))).name).toBe(
      LONG_COMPETITION,
    );
  });

  it('a stage and round whose label is longer than 80 characters cannot be generated, and the preview says so; at 80 it is', async () => {
    const t = await localApp(cleanup);
    const names = ['Club Sintético Uno', 'Club Sintético Dos'];
    const c = await localCompetition(t, { name: 'Liga Sintética por Fases', season: '2026/27', teams: names });
    const stage = 'Fase Sintética';
    const stageId = await c.stage(stage);
    // `Fase Sintética - <round>`: 17 characters before the round's name.
    const fits = await c.round('R'.repeat(63), stageId);
    const tooLong = await c.round('S'.repeat(64), stageId);
    const fitsMatch = await c.match(names[0] ?? '', names[1] ?? '', fits, kickoff(1), finished(1, 0));
    const longMatch = await c.match(names[1] ?? '', names[0] ?? '', tooLong, kickoff(2), finished(0, 1));

    const refused = await previewOf(t, c.selection(tooLong, [longMatch], ['round_results'], stageId));
    expect(refused.selectionLabel).toBeNull();
    expect(refused.pieces.map((piece) => [piece.status, piece.skipReason])).toEqual([
      ['skipped', 'context_not_supported'],
    ]);
    expectProblem(
      await t.send('POST', '/content-batches', {
        requestKey: requestKey(),
        selection: c.selection(tooLong, [longMatch], ['round_results'], stageId),
      }),
      409,
      'CONTENT_BATCH_NOT_GENERATABLE',
    );
    expect(count(t, 'content_generation_batches')).toBe(0);

    const accepted = await previewOf(t, c.selection(fits, [fitsMatch], ['round_results'], stageId));
    expect(accepted.selectionLabel).toBe(`${stage} - ${'R'.repeat(63)}`);
    expect(accepted.selectionLabel).toHaveLength(80);
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(fits, [fitsMatch], ['round_results'], stageId),
    });
    expect(batch.state).toBe('completed');
    expect((await getProject(t, batch.items[0]?.projectId ?? '')).stageLabel).toBe(accepted.selectionLabel);
  });
});

describe('match statuses and incomplete data', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('every local status in one round: only a finished match with a score and a kickoff is a result; the calendar shows the others with their status and never a score', async () => {
    const t = await localApp(cleanup);
    const names = Array.from({ length: 10 }, (_, index) => `Club Sintético Estado ${String(index + 1)}`);
    const c = await localCompetition(t, { name: 'Liga Sintética de Estados', season: '2026/27', teams: names });
    const roundId = await c.round('Jornada 3');
    const team = (index: number) => names[index] ?? '';
    const ids = {
      scheduled: await c.match(team(0), team(1), roundId, kickoff(10)),
      inProgress: await c.match(team(2), team(3), roundId, kickoff(11), {
        status: 'in_progress',
        homeScore: 1,
        awayScore: 0,
      }),
      finished: await c.match(team(4), team(5), roundId, kickoff(12), finished(2, 2)),
      postponed: await c.match(team(6), team(7), roundId, kickoff(13), {
        status: 'postponed',
        homeScore: null,
        awayScore: null,
      }),
      cancelled: await c.match(team(8), team(9), roundId, kickoff(14), {
        status: 'cancelled',
        homeScore: null,
        awayScore: null,
      }),
      noScore: await c.match(team(1), team(0), roundId, kickoff(15), {
        status: 'finished',
        homeScore: null,
        awayScore: null,
      }),
      noKickoff: await c.match(team(3), team(2), roundId, null, finished(3, 1)),
      pendingNoKickoff: await c.match(team(5), team(4), roundId, null),
    };
    // A score of one side only is refused: no result is half known.
    expectProblem(
      await t.send('POST', `${c.base}/matches/${ids.scheduled}/result`, {
        status: 'finished',
        homeScore: 1,
        awayScore: null,
      }),
      400,
      'VALIDATION_FAILED',
    );

    const all = Object.values(ids);
    const kinds = ['round_results', 'round_calendar', 'upcoming_matches'];
    const preview = await previewOf(t, c.selection(roundId, all, kinds));
    const byId = new Map(preview.matches.map((match) => [match.matchId, match]));
    const eligibility = (id: string) => {
      const match = byId.get(id);
      return [match?.ineligibility, match?.calendarIneligibility, match?.upcomingIneligibility];
    };
    expect(eligibility(ids.scheduled)).toEqual(['not_finished', null, null]);
    expect(eligibility(ids.inProgress)).toEqual(['not_finished', null, 'not_upcoming']);
    expect(eligibility(ids.finished)).toEqual([null, 'already_finished', 'already_finished']);
    expect(eligibility(ids.postponed)).toEqual(['not_finished', null, null]);
    expect(eligibility(ids.cancelled)).toEqual(['not_finished', null, 'not_upcoming']);
    expect(eligibility(ids.noScore)).toEqual(['score_missing', 'already_finished', 'already_finished']);
    expect(eligibility(ids.noKickoff)).toEqual(['kickoff_missing', 'already_finished', 'already_finished']);
    expect(eligibility(ids.pendingNoKickoff)).toEqual(['not_finished', 'kickoff_missing', 'kickoff_missing']);
    // An unknown score is never 0-0.
    expect(byId.get(ids.noScore)).toMatchObject({ status: 'finished', homeScore: null, awayScore: null });

    const batch = await generate(t, { requestKey: requestKey(), selection: c.selection(roundId, all, kinds) });
    expect(batch.items.map((item) => [item.kind, item.status, item.matchIds.length])).toEqual([
      ['round_results', 'completed', 1],
      ['round_calendar', 'completed', 4],
      ['upcoming_matches', 'completed', 2],
    ]);
    const [results, calendar, upcoming] = await Promise.all(
      batch.items.map(async (item) => draftOf(t, item.projectId ?? '')),
    );
    expect(resultLines(results as Draft)).toEqual([`${team(4)}|${team(5)}|2-2`]);
    const fixtureLines = (draft: Draft | undefined) =>
      (draft?.carousels ?? []).flatMap((carousel) =>
        slidesOfType(carousel, 'fixture').map(
          (slide) => `${fieldText(slide, 'team_home')}|${fieldText(slide, 'match_status')}`,
        ),
      );
    expect(fixtureLines(calendar)).toEqual([
      `${team(0)}|Programado`,
      `${team(2)}|En juego`,
      `${team(6)}|Aplazado`,
      `${team(8)}|Cancelado`,
    ]);
    const overview = slidesOfType(calendar?.carousels[0] as Carousel, 'round_overview')[0] as Element;
    expect(
      fieldText(overview, 'fixtures')
        .split('\n')
        .map((row) => row.split(' · ').at(-1)),
    ).toEqual([expect.stringMatching(/^\d{2}:\d{2}$/u), 'En juego', 'Aplazado', 'Cancelado']);
    expect(fixtureLines(upcoming)).toEqual([`${team(0)}|Programado`, `${team(6)}|Aplazado`]);
    // No score of a match not finished anywhere: neither the 1-0 in progress nor a score field.
    for (const draft of [calendar, upcoming] as Draft[]) {
      expect(texts(draft)).not.toMatch(/\b1-0\b/u);
      expect(
        allElements(draft).some((element) => element.currentVersion.fields.some((field) => field.field === 'score')),
      ).toBe(false);
    }
  });
});

describe('manual corrections of local data', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('a renamed team and a corrected score after an export change new content only; the export and the generated project keep the confirmed values', async () => {
    const t = await localApp(cleanup);
    const names = ['Club Sintético Original', 'Club Sintético Rival'];
    const c: LocalCompetition = await localCompetition(t, {
      name: 'Liga Sintética Corregida',
      season: '2026/27',
      teams: names,
    });
    const roundId = await c.round('Jornada 8');
    const matchId = await c.match(names[0] ?? '', names[1] ?? '', roundId, kickoff(5), finished(2, 1));
    const first = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, [matchId], ['match_result']),
    });
    const projectId = first.items[0]?.projectId ?? '';
    const approved = await approveDraft(t, projectId);
    const written = await exported(t, (approved.carousels[0] as Carousel).id);
    const before = await exportDetail(t, written.id);

    // The operator renames the team and corrects the score.
    const renamed = 'Club Sintético Renombrado';
    await ok(t.send('PATCH', `/teams/${c.team(names[0] ?? '')}`, { name: renamed, region: null }));
    await ok(t.send('POST', `${c.base}/matches/${matchId}/result`, finished(3, 1)));
    const history = await ok<{ history: { changeType: string }[] }>(
      t.get(`${c.base}/matches/${matchId}/result-history`),
    );
    expect(history.history.map((entry) => entry.changeType)).toContain('result_corrected');

    // The export is unchanged, byte for byte.
    expect(await exportDetail(t, written.id)).toEqual(before);
    const zip = await t.get(`/exports/${written.id}/download`);
    expect(zipEntries(zip.rawPayload).map((entry) => sha256(entry.bytes))).toEqual(
      written.files.map((file) => file.sha256),
    );
    // The generated project keeps the values confirmed with it, also when a slide is regenerated.
    const slide = slidesOfType((await draftOf(t, projectId)).carousels[0] as Carousel, 'match_result')[0] as Element;
    const regenerated = await t.send('POST', `${elementPath(slide)}/regenerate`);
    expect(regenerated.statusCode, regenerated.body).toBe(201);
    expect(resultLines(await draftOf(t, projectId))).toEqual([`${names[0] ?? ''}|${names[1] ?? ''}|2-1`]);

    // New content uses the corrected values.
    const second = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, [matchId], ['match_result']),
    });
    expect(resultLines(await draftOf(t, second.items[0]?.projectId ?? ''))).toEqual([
      `${renamed}|${names[1] ?? ''}|3-1`,
    ]);
  });
});

describe('scores', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('two-digit scores are drawn whole and checked; a score above 99 is reported as not supported by the preview (UI06.3-D06)', async () => {
    const t = await localApp(cleanup);
    const names = ['Club Sintético Goleador', 'Club Sintético Portero', 'Club Sintético Centena'];
    const c = await localCompetition(t, { name: 'Liga Sintética de Goles', season: '2026/27', teams: names });
    const roundId = await c.round('Jornada 1');
    const twoDigits = await c.match(names[0] ?? '', names[1] ?? '', roundId, kickoff(1), finished(99, 10));
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, [twoDigits], ['match_result']),
    });
    const draft = await draftOf(t, batch.items[0]?.projectId ?? '');
    const slide = slidesOfType(draft.carousels[0] as Carousel, 'match_result')[0] as Element;
    expect(fieldText(slide, 'score')).toBe('99-10');
    expect(drawn(t, slide, 'score').map((entry) => [entry.text, entry.overflow])).toEqual([['99-10', false]]);
    expect(qaOf(slide, 'data_match')?.outcome).toBe('pass');
    expect(blockingFailures(slide)).toEqual([]);

    // A three-digit score is accepted by the local API (no upper bound) and kept; this route cannot record it, so
    // the preview says so instead of reporting the piece ready.
    const hundred = await c.match(names[2] ?? '', names[0] ?? '', roundId, kickoff(2), finished(100, 0));
    const preview = await previewOf(t, c.selection(roundId, [hundred], ['match_result']));
    expect(preview.matches[0]).toMatchObject({ homeScore: 100, awayScore: 0, ineligibility: 'score_not_supported' });
    expect(preview.pieces.map((piece) => [piece.status, piece.skipReason])).toEqual([
      ['skipped', 'score_not_supported'],
    ]);
  });

  it(
    'UI06.3-D06: a score above 99 is excluded with its reason in the preview and in the batch, the compatible matches are generated, and the local result is kept',
    async () => {
      const t = await localApp(cleanup);
      const names = [
        'Club Sintético Centena',
        'Club Sintético Decena',
        'Club Sintético Unidad',
        'Club Sintético Millar',
      ];
      const c = await localCompetition(t, { name: 'Liga Sintética de Centenas', season: '2026/27', teams: names });
      const roundId = await c.round('Jornada 1');
      const atLimit = await c.match(names[0] ?? '', names[1] ?? '', roundId, kickoff(1), finished(99, 98));
      const hundred = await c.match(names[1] ?? '', names[2] ?? '', roundId, kickoff(2), finished(100, 0));
      const over = await c.match(names[2] ?? '', names[3] ?? '', roundId, kickoff(3), finished(3, 250));
      const valid = await c.match(names[3] ?? '', names[0] ?? '', roundId, kickoff(4), finished(12, 11));
      const storedScores = async () => {
        const body = (await ok(t.get(`${c.base}/matches`))) as {
          matches: { id: string; status: string; homeScore: number | null; awayScore: number | null }[];
        };
        return Object.fromEntries(
          body.matches.map((match) => [match.id, [match.status, match.homeScore, match.awayScore]]),
        );
      };
      const before = await storedScores();
      const kinds = ['round_results', 'match_result'];

      // Preview: 99 is compatible; 100 and 250 are «score_not_supported», never «score_missing».
      const selection = c.selection(roundId, [atLimit, hundred, over, valid], kinds);
      const preview = await previewOf(t, selection);
      expect(Object.fromEntries(preview.matches.map((match) => [match.matchId, match.ineligibility]))).toEqual({
        [atLimit]: null,
        [hundred]: 'score_not_supported',
        [over]: 'score_not_supported',
        [valid]: null,
      });
      expect(preview.pieces.map((piece) => [piece.kind, piece.matchIds, piece.status, piece.skipReason])).toEqual([
        ['round_results', [atLimit, valid], 'ready', null],
        ['match_result', [atLimit], 'ready', null],
        ['match_result', [hundred], 'skipped', 'score_not_supported'],
        ['match_result', [over], 'skipped', 'score_not_supported'],
        ['match_result', [valid], 'ready', null],
      ]);
      expect(preview.totals).toEqual({ requested: 5, ready: 3, skipped: 2 });

      // Confirmation: the compatible pieces are generated; the excluded ones are recorded as skipped with the reason.
      const batch = await generate(t, { requestKey: requestKey(), selection });
      expect(batch.totals).toMatchObject({ requested: 5, skipped: 2 });
      expect(batch.items.map((item) => [item.kind, item.matchIds, item.status, item.skipReason])).toEqual([
        ['round_results', [atLimit, valid], 'completed', null],
        ['match_result', [atLimit], 'completed', null],
        ['match_result', [hundred], 'skipped', 'score_not_supported'],
        ['match_result', [over], 'skipped', 'score_not_supported'],
        ['match_result', [valid], 'completed', null],
      ]);
      expect(batch.items.filter((item) => item.status === 'skipped').every((item) => item.projectId === null)).toBe(
        true,
      );
      expect(count(t, 'projects')).toBe(3);
      // The excluded matches are in no generated content: the round carousel shows the compatible results only.
      const round = await draftOf(t, batch.items[0]?.projectId ?? '');
      expect(resultLines(round).map((line) => line.split('|')[2])).toEqual(['99-98', '12-11']);
      for (const item of batch.items.filter((entry) => entry.projectId !== null)) {
        const text = texts(await draftOf(t, item.projectId ?? ''));
        expect(text).not.toContain('100-0');
        expect(text).not.toContain('3-250');
      }
      // The local results are kept exactly as recorded.
      expect(await storedScores()).toEqual(before);

      // Every match incompatible: nothing to generate, refused as before, nothing stored.
      const batches = count(t, 'content_generation_batches');
      const projects = count(t, 'projects');
      const none = c.selection(roundId, [hundred, over], kinds);
      const nonePreview = await previewOf(t, none);
      expect(nonePreview.pieces.map((piece) => [piece.status, piece.skipReason])).toEqual([
        ['skipped', 'no_eligible_matches'],
        ['skipped', 'score_not_supported'],
        ['skipped', 'score_not_supported'],
      ]);
      expect(nonePreview.totals).toEqual({ requested: 3, ready: 0, skipped: 3 });
      expectProblem(
        await t.send('POST', '/content-batches', { requestKey: requestKey(), selection: none }),
        409,
        'CONTENT_BATCH_NOT_GENERATABLE',
      );
      expect(count(t, 'content_generation_batches')).toBe(batches);
      expect(count(t, 'projects')).toBe(projects);

      // Recovery: once the operator records a supported score, the match is compatible again and generated; the
      // projects generated before keep their frozen values.
      const roundBefore = texts(round);
      const corrected = await t.send('POST', `${c.base}/matches/${hundred}/result`, finished(10, 0));
      expect(corrected.statusCode, corrected.body).toBe(200);
      const recovered = await previewOf(t, c.selection(roundId, [hundred], ['match_result']));
      expect(recovered.matches[0]?.ineligibility).toBeNull();
      const again = await generate(t, {
        requestKey: requestKey(),
        selection: c.selection(roundId, [hundred], ['match_result']),
      });
      expect(again.items.map((item) => [item.status, item.skipReason])).toEqual([['completed', null]]);
      expect(resultLines(await draftOf(t, again.items[0]?.projectId ?? '')).map((line) => line.split('|')[2])).toEqual([
        '10-0',
      ]);
      expect(texts(await draftOf(t, batch.items[0]?.projectId ?? ''))).toBe(roundBefore);
    },
    WORKFLOW_TEST_TIMEOUT,
  );
});
