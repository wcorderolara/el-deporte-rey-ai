/**
 * UI-06.3 edge cases of carousel size, approval and export, through the real server, the real workflow stages
 * (research, verification, content with the stub AI, rendering, visual QA), review, approval and export of a temporary
 * app with the operator-validated local sports source. Every competition, team, badge and match is synthetic and
 * created through the API; nothing reaches a provider.
 *
 * The limits under test: `format.maxSlidesPerCarousel` is 20 (Instagram's maximum, the configuration's upper bound;
 * `INSTAGRAM_MAX_CAROUSEL_ITEMS`), so a carousel holds a cover, at most 18 content slides and a closing slide, and
 * more content is split into numbered carousels of the same project (OD-03); the smallest carousel is a cover, one
 * content slide and a closing slide (`MIN_SLIDES_PER_CAROUSEL` = 3: no content type has a single-slide carousel); a
 * content batch selects at most 32 matches (`CONTENT_BATCH_MAX_MATCHES`); a round calendar with rows lists six
 * matches per page (PD-32 DE-E5).
 *
 * Covered: the smallest carousels (one result, one preview); exactly 20 slides in one carousel, with team badges
 * missing for some teams (empty slots and the non-blocking `team_badges` warning, PD-28 point 4, PD-32 DE-E4), a
 * bulk approval that approves only what is eligible, then individual approvals, the final approval and an export whose
 * files 01.png … 20.png follow the carousel order with hashes equal to the manifest, the stored images and the ZIP;
 * 19 matches split into two numbered carousels of one round, approved in one concurrent burst without losing an
 * approval, and exported each on its own; the largest selection (32 matches) as results and as a paginated round
 * calendar over three carousels, and a selection of 33 refused before anything is stored.
 */
import { type Carousel, type Draft, type Element, type Export, ElementSchema } from '@edr/contracts';
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
  requestKeys,
  syntheticTeams,
  uploadBadge,
  zipEntries,
} from './extreme-support.js';
import {
  WORKFLOW_TEST_TIMEOUT,
  acknowledgeWarnings,
  approve,
  approveDraft,
  approveOne,
  captionOf,
  draftOf,
  expectProblem,
  exportCarousel,
  exportFile,
  exportFileNames,
  exported,
  fieldText,
  finalApprove,
  manifestOf,
  pngDimensions,
  renderModelOf,
  sha256,
  slidesOfType,
  storedPng,
  storedVersion,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const requestKey = requestKeys('a');

/** The limit of the configuration and of Instagram (U-11). */
const MAX_SLIDES = 20;

function slidesOf(carousel: Carousel): Element[] {
  return carousel.elements.filter((element) => element.kind === 'slide');
}

function slideTypes(carousel: Carousel): string[] {
  return slidesOf(carousel).map((slide) => String(slide.slideType));
}

/** `home|away|score` of every match result slide of a carousel. */
function resultLines(carousel: Carousel): string[] {
  return slidesOfType(carousel, 'match_result').map((slide) =>
    ['team_home', 'team_away', 'score'].map((field) => fieldText(slide, field)).join('|'),
  );
}

/** The text of the carousel number drawn on a carousel's cover (`n/N`), or null when it has none. */
function coverNumber(t: TestApp, carousel: Carousel): string | null {
  const cover = slidesOfType(carousel, 'cover')[0];
  if (cover === undefined) {
    throw new Error('the carousel has no cover');
  }
  const numbers = renderModelOf(storedVersion(t, cover.currentVersion.id)).elements.filter(
    (element) => element.semantic === 'carousel_number',
  );
  return numbers.length === 0 ? null : numbers.map((element) => element.text).join('|');
}

function blockingFailures(element: Element): string[] {
  return element.currentVersion.qa
    .filter((result) => result.severity === 'blocking' && result.outcome === 'fail')
    .map((result) => result.check);
}

function teamBadges(element: Element) {
  return element.currentVersion.qa.find((result) => result.check === 'team_badges');
}

/**
 * Checks an export of a carousel: one PNG per slide named 01.png … NN.png in carousel order at 1080 x 1350, equal to
 * the stored image of the exported version; the export record, the manifest and the ZIP download list the same files
 * in the same order with the same SHA-256; the manifest names the carousel's number.
 */
async function expectOrderedExport(
  t: TestApp,
  carousel: Carousel,
  written: Export,
  numbering: { readonly sequence: number; readonly total: number },
): Promise<void> {
  const slides = slidesOf(carousel);
  const names = slides.map((_slide, index) => `${String(index + 1).padStart(2, '0')}.png`);
  const caption = carousel.elements.find((element) => element.kind === 'caption');
  const withCaption = caption?.currentVersion.state === 'approved';
  expect(exportFileNames(t, written)).toEqual(
    [...names, ...(withCaption ? ['caption.txt'] : []), 'manifest.json'].sort(),
  );
  const images = written.files.filter((file) => file.kind === 'slide_image');
  expect(images.map((file) => [file.position, file.fileName, file.elementVersionId])).toEqual(
    slides.map((slide, index) => [index + 1, names[index], slide.currentVersion.id]),
  );
  for (const [index, slide] of slides.entries()) {
    const bytes = exportFile(t, written, names[index] ?? '');
    expect(pngDimensions(bytes)).toEqual({ width: 1080, height: 1350 });
    expect(sha256(bytes), names[index]).toBe(images[index]?.sha256);
    expect(bytes.equals(storedPng(t, storedVersion(t, slide.currentVersion.id))), names[index]).toBe(true);
  }
  const manifest = manifestOf(t, written);
  expect(manifest.carousel).toEqual({ id: carousel.id, ...numbering });
  expect(
    manifest.files
      .filter((file) => file.kind === 'slide_image')
      .map((file) => [file.position, file.fileName, file.elementVersionId, file.slideType, file.sha256]),
  ).toEqual(
    images.map((file, index) => [
      file.position,
      file.fileName,
      file.elementVersionId,
      slides[index]?.slideType,
      file.sha256,
    ]),
  );
  expect(written.files.find((file) => file.kind === 'manifest')?.sha256).toBe(
    sha256(exportFile(t, written, 'manifest.json')),
  );
  // The ZIP download holds the same files, in the order of the export record, byte for byte.
  const zip = await t.get(`/exports/${written.id}/download`);
  expect(zip.statusCode, zip.body).toBe(200);
  const entries = zipEntries(zip.rawPayload);
  expect(entries.map((entry) => entry.name)).toEqual(written.files.map((file) => file.fileName));
  expect(entries.map((entry) => sha256(entry.bytes))).toEqual(written.files.map((file) => file.sha256));
}

/** A competition with `teams` synthetic teams and one round; `pairs` matches team 2i-1 against team 2i. */
async function competitionWithRound(
  t: TestApp,
  name: string,
  teams: number,
): Promise<{ c: LocalCompetition; roundId: string; names: string[] }> {
  const names = syntheticTeams(teams);
  const c = await localCompetition(t, { name, season: '2026/27', teams: names });
  return { c, roundId: await c.round('Jornada 1'), names };
}

/** The kickoff `index` hours after `base`: one match after another. */
function hourly(base: string, index: number): string {
  return new Date(Date.parse(base) + index * 3_600_000).toISOString();
}

function pairName(names: readonly string[], index: number, side: 0 | 1): string {
  const name = names[2 * index + side];
  if (name === undefined) {
    throw new Error('not enough teams');
  }
  return name;
}

describe('the smallest carousel (MIN_SLIDES_PER_CAROUSEL)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('a single result and a single preview are a cover, one content slide and a closing, exported as 01.png to 03.png', async () => {
    const t = await localApp(cleanup);
    const { c, roundId, names } = await competitionWithRound(t, 'Liga Sintética Mínima', 4);
    const played = await c.match(names[0] ?? '', names[1] ?? '', roundId, kickoff(1), finished(1, 0));
    const pending = await c.match(names[2] ?? '', names[3] ?? '', roundId, kickoff(20));
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, [played, pending], ['match_result', 'match_preview']),
    });
    expect(batch.items.map((item) => [item.kind, item.status])).toEqual([
      ['match_result', 'completed'],
      ['match_result', 'skipped'],
      ['match_preview', 'skipped'],
      ['match_preview', 'completed'],
    ]);
    const expected = [
      ['cover', 'match_result', 'closing'],
      ['cover', 'match_preview', 'closing'],
    ];
    for (const [index, item] of batch.items.filter((entry) => entry.status === 'completed').entries()) {
      const draft = await approveDraft(t, item.projectId ?? '');
      expect(draft.carousels).toHaveLength(1);
      const carousel = draft.carousels[0] as Carousel;
      expect(carousel).toMatchObject({ sequence: 1, total: 1 });
      expect(slideTypes(carousel)).toEqual(expected[index]);
      // A carousel of its own has no number on its cover.
      expect(coverNumber(t, carousel)).toBeNull();
      await expectOrderedExport(t, carousel, await exported(t, carousel.id), { sequence: 1, total: 1 });
    }
    expect(t.egress.requests).toHaveLength(0);
  });
});

describe('exactly at the slide limit', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('eighteen results make one carousel of twenty slides; missing badges warn, bulk approval takes only the eligible slides, and the export keeps the carousel order', async () => {
    const t = await localApp(cleanup);
    const { c, roundId, names } = await competitionWithRound(t, 'Liga Sintética del Límite', 36);
    // Created in reverse kickoff order; the last two share a kickoff (ordered by the home team's name).
    const matchIds: string[] = [];
    for (let index = 17; index >= 0; index -= 1) {
      const day = index >= 16 ? 17 : index + 1;
      matchIds.push(
        await c.match(
          pairName(names, index, 0),
          pairName(names, index, 1),
          roundId,
          kickoff(day),
          finished(index % 10, (index + 3) % 10),
        ),
      );
    }
    // Badges for the teams of the first twelve matches only.
    for (const name of names.slice(0, 24)) {
      await uploadBadge(t, c.team(name), [20, 40, 160]);
    }

    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, matchIds, ['round_results']),
    });
    expect(batch.state).toBe('completed');
    const projectId = batch.items[0]?.projectId ?? '';
    const draft = await draftOf(t, projectId);
    expect(draft.carousels).toHaveLength(1);
    const carousel = draft.carousels[0] as Carousel;
    expect(carousel).toMatchObject({ sequence: 1, total: 1 });
    expect(slidesOf(carousel)).toHaveLength(MAX_SLIDES);
    expect(slideTypes(carousel)).toEqual(['cover', ...Array<string>(18).fill('match_result'), 'closing']);
    // Kickoff order, whatever the creation order.
    expect(resultLines(carousel)).toEqual(
      Array.from(
        { length: 18 },
        (_, index) =>
          `${pairName(names, index, 0)}|${pairName(names, index, 1)}|${String(index % 10)}-${String((index + 3) % 10)}`,
      ),
    );
    expect(draft.leftOutMatches).toEqual([]);

    // Teams without a badge: both slots empty, a warning naming them, never a blocking failure.
    const matches = slidesOfType(carousel, 'match_result');
    for (const [index, slide] of matches.entries()) {
      expect(blockingFailures(slide), String(index)).toEqual([]);
      expect(teamBadges(slide), String(index)).toMatchObject(
        index < 12
          ? { outcome: 'pass' }
          : {
              outcome: 'fail',
              severity: 'warning',
              details: { emptyBadgeSlots: ['team-badge-home', 'team-badge-away'] },
            },
      );
    }

    // Bulk approval (UI-04B): every slide in turn, never acknowledging a warning. Only the eligible slides are
    // approved; the others are refused one by one and stay as they were.
    const outcomes: [string, number][] = [];
    for (const slide of slidesOf(carousel)) {
      const response = await approve(t, slide);
      outcomes.push([slide.id, response.statusCode]);
      if (response.statusCode !== 200) {
        expectProblem(response, 409, 'QA_ACK_REQUIRED');
      }
    }
    const warned = new Set(matches.slice(12).map((slide) => slide.id));
    expect(outcomes).toEqual(slidesOf(carousel).map((slide) => [slide.id, warned.has(slide.id) ? 409 : 200]));
    const partial = (await draftOf(t, projectId)).carousels[0] as Carousel;
    expect(
      slidesOf(partial)
        .filter((slide) => slide.currentVersion.state === 'approved')
        .map((slide) => slide.id),
    ).toEqual(
      slidesOf(carousel)
        .filter((slide) => !warned.has(slide.id))
        .map((slide) => slide.id),
    );
    expect(partial.readyForFinalApproval).toBe(false);
    const refused = expectProblem(await finalApprove(t, carousel.id), 409, 'FINAL_APPROVAL_REFUSED');
    // The refusal names each slide left, with both reasons: not approved, and a warning not acknowledged.
    expect(refused.items).toEqual(
      [...warned].flatMap((elementId) => [
        { elementId, reason: 'not_approved' },
        { elementId, reason: 'qa_ack_required' },
      ]),
    );
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');

    // Individual approval of the rest, each warning acknowledged first; the caption is approved too.
    for (const slide of slidesOf(partial).filter((entry) => warned.has(entry.id))) {
      expect(await acknowledgeWarnings(t, slide)).toBe(1);
      await approveOne(
        t,
        (await draftOf(t, projectId)).carousels[0]?.elements.find((e) => e.id === slide.id) as Element,
      );
    }
    await approveOne(t, captionOf(partial));
    const approved = (await draftOf(t, projectId)).carousels[0] as Carousel;
    expect(approved.elements.every((element) => element.currentVersion.state === 'approved')).toBe(true);
    // The approvals given in bulk were kept through the individual ones.
    expect(slidesOf(approved).map((slide) => slide.currentVersion.id)).toEqual(
      slidesOf(carousel).map((slide) => slide.currentVersion.id),
    );
    expect(approved.readyForFinalApproval).toBe(true);
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);

    const written = await exported(t, carousel.id);
    expect(written.files.filter((file) => file.kind === 'slide_image')).toHaveLength(MAX_SLIDES);
    await expectOrderedExport(t, approved, written, { sequence: 1, total: 1 });
    expect(written.files.at(-1)).toMatchObject({ fileName: 'manifest.json', position: MAX_SLIDES + 2 });
    expect(t.egress.requests).toHaveLength(0);
  });
});

describe('above the slide limit', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('nineteen results of one round are split into two numbered carousels (20 + 3 slides), approved in one burst without losing an approval and exported each on its own', async () => {
    const t = await localApp(cleanup);
    const { c, roundId, names } = await competitionWithRound(t, 'Liga Sintética Partida', 38);
    const matchIds: string[] = [];
    for (let index = 0; index < 19; index += 1) {
      matchIds.push(
        await c.match(
          pairName(names, index, 0),
          pairName(names, index, 1),
          roundId,
          kickoff(index + 1),
          finished(1, 1),
        ),
      );
    }
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, matchIds, ['round_results']),
    });
    // One piece, one project: the split is inside the project's draft.
    expect(batch.items).toHaveLength(1);
    const projectId = batch.items[0]?.projectId ?? '';
    const draft: Draft = await draftOf(t, projectId);
    expect(draft.carousels.map((carousel) => [carousel.sequence, carousel.total, slidesOf(carousel).length])).toEqual([
      [1, 2, 20],
      [2, 2, 3],
    ]);
    const [first, second] = draft.carousels as [Carousel, Carousel];
    expect(slideTypes(second)).toEqual(['cover', 'match_result', 'closing']);
    expect([coverNumber(t, first), coverNumber(t, second)]).toEqual(['1/2', '2/2']);
    // One slide per match, in kickoff order across both carousels.
    expect([...resultLines(first), ...resultLines(second)].map((line) => line.split('|')[0])).toEqual(
      Array.from({ length: 19 }, (_, index) => pairName(names, index, 0)),
    );
    // Each carousel has its own caption.
    expect(captionOf(first).id).not.toBe(captionOf(second).id);

    // Bulk approval of the first carousel in one concurrent burst (warnings acknowledged first): no approval is lost.
    for (const element of first.elements) {
      await acknowledgeWarnings(t, element);
    }
    const acknowledged = (await draftOf(t, projectId)).carousels[0] as Carousel;
    const burst = await Promise.all(acknowledged.elements.map((element) => approve(t, element)));
    expect(burst.map((response) => response.statusCode)).toEqual(acknowledged.elements.map(() => 200));
    expect(burst.map((response) => ElementSchema.parse(response.json()).currentVersion.state)).toEqual(
      acknowledged.elements.map(() => 'approved'),
    );
    const afterBurst = await draftOf(t, projectId);
    expect(afterBurst.carousels[0]?.elements.map((element) => element.currentVersion.state)).toEqual(
      acknowledged.elements.map(() => 'approved'),
    );
    // Approving one carousel never approves the other.
    expect(afterBurst.carousels[1]?.elements.map((element) => element.currentVersion.state)).toEqual(
      second.elements.map(() => 'ready'),
    );
    expect((await finalApprove(t, first.id)).statusCode).toBe(200);
    expectProblem(await exportCarousel(t, second.id), 409, 'FINAL_APPROVAL_REQUIRED');
    const firstExport = await exported(t, first.id);
    await expectOrderedExport(t, afterBurst.carousels[0] as Carousel, firstExport, { sequence: 1, total: 2 });

    // The second carousel, approved one by one, is exported from 01.png again.
    for (const element of second.elements) {
      await approveOne(t, element);
    }
    expect((await finalApprove(t, second.id)).statusCode).toBe(200);
    const done = await draftOf(t, projectId);
    const secondExport = await exported(t, second.id);
    await expectOrderedExport(t, done.carousels[1] as Carousel, secondExport, { sequence: 2, total: 2 });
    // The first carousel's final approval and export are unaffected by the second's.
    expect(done.carousels[0]?.finalApproval?.valid).toBe(true);
    expect(secondExport.finalApprovalId).not.toBe(firstExport.finalApprovalId);
  });

  it('the largest selection (32 matches) splits results into 20 + 16 slides and a paginated calendar into three carousels; 33 matches are refused', async () => {
    const t = await localApp(cleanup);
    const { c, roundId, names } = await competitionWithRound(t, 'Liga Sintética Máxima', 64);
    const resultIds: string[] = [];
    for (let index = 0; index < 32; index += 1) {
      resultIds.push(
        await c.match(
          pairName(names, index, 0),
          pairName(names, index, 1),
          roundId,
          hourly('2026-12-01T10:00:00.000Z', index),
          finished(index, 31 - index),
        ),
      );
    }
    const calendarRound = await c.round('Jornada 2');
    const pendingIds: string[] = [];
    for (let index = 0; index < 33; index += 1) {
      // The 33rd match repeats teams of the first one, on another day.
      const pair = index % 32;
      pendingIds.push(
        await c.match(
          pairName(names, pair, 1),
          pairName(names, pair, 0),
          calendarRound,
          hourly('2027-01-01T10:00:00.000Z', index),
        ),
      );
    }

    // 33 matches are more than one batch selects: refused by the preview and the confirmation, nothing stored.
    for (const path of ['/content-batches/previews', '/content-batches']) {
      const body = c.selection(calendarRound, pendingIds, ['round_calendar']);
      const response = await t.send(
        'POST',
        path,
        path.endsWith('previews') ? body : { requestKey: requestKey(), selection: body },
      );
      expectProblem(response, 400, 'VALIDATION_FAILED');
    }
    expect(t.container.db.prepare<{ n: number }>('SELECT COUNT(*) AS n FROM content_generation_batches').get()?.n).toBe(
      0,
    );

    // 32 results: 18 + 14 match slides.
    const results = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, resultIds, ['round_results']),
    });
    expect(results.state).toBe('completed');
    const resultsDraft = await draftOf(t, results.items[0]?.projectId ?? '');
    expect(resultsDraft.carousels.map((carousel) => slidesOf(carousel).length)).toEqual([20, 16]);
    expect(resultsDraft.carousels.flatMap((carousel) => resultLines(carousel))).toEqual(
      Array.from(
        { length: 32 },
        (_, index) =>
          `${pairName(names, index, 0)}|${pairName(names, index, 1)}|${String(index)}-${String(31 - index)}`,
      ),
    );

    // 32 pending matches as a round calendar: six pages of rows (6 x 5 + 2) and one fixture per match, 38 content
    // slides over three carousels of one project.
    const calendar = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(calendarRound, pendingIds.slice(0, 32), ['round_calendar']),
    });
    expect(calendar.state).toBe('completed');
    const calendarProject = calendar.items[0]?.projectId ?? '';
    const calendarDraft = await draftOf(t, calendarProject);
    expect(
      calendarDraft.carousels.map((carousel) => [carousel.sequence, carousel.total, slidesOf(carousel).length]),
    ).toEqual([
      [1, 3, 20],
      [2, 3, 20],
      [3, 3, 4],
    ]);
    const pages = calendarDraft.carousels.flatMap((carousel) => slidesOfType(carousel, 'round_overview'));
    expect(pages.map((page) => fieldText(page, 'fixtures').split('\n').length)).toEqual([6, 6, 6, 6, 6, 2]);
    // Every page lists its rows in kickoff order and the pages follow each other.
    expect(
      pages.flatMap((page) =>
        fieldText(page, 'fixtures')
          .split('\n')
          .map((line) => line.split(' · ')[0]),
      ),
    ).toEqual(Array.from({ length: 32 }, (_, index) => `${pairName(names, index, 1)} vs ${pairName(names, index, 0)}`));
    const fixtures = calendarDraft.carousels.flatMap((carousel) => slidesOfType(carousel, 'fixture'));
    expect(fixtures.map((slide) => fieldText(slide, 'team_home'))).toEqual(
      Array.from({ length: 32 }, (_, index) => pairName(names, index, 1)),
    );
    expect(calendarDraft.carousels.map((carousel) => coverNumber(t, carousel))).toEqual(['1/3', '2/3', '3/3']);
    // No badge for any team: every page names the empty slots of its rows; nothing blocks.
    for (const page of pages) {
      expect(teamBadges(page)).toMatchObject({ outcome: 'fail', severity: 'warning' });
      expect(blockingFailures(page)).toEqual([]);
    }

    // Each carousel is approved and exported on its own, from 01.png.
    const approved = await approveDraft(t, calendarProject);
    for (const carousel of approved.carousels) {
      const written = await exported(t, carousel.id);
      await expectOrderedExport(t, carousel, written, { sequence: carousel.sequence, total: carousel.total });
    }
    expect(t.egress.requests).toHaveLength(0);
  });
});
