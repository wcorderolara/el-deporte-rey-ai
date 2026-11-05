/**
 * Content through the HTTP API after the real research, verification, content, rendering and visual QA stages, on
 * the DEMO_DATA scenarios of both fixture competitions (`fixtures/sports`, stub AI over `fixtures/ai`):
 * - structure (R-209): an ordered carousel with a slide type per slide, a headline and description per slide, a
 *   caption and at least one hashtag; split into numbered carousels above the slide limit, one slide per match;
 * - standings (R-285, R-254): standings slides only when the selection has standings, covering every row; a knockout
 *   stage and a league whose source gives no standings get none, nothing is derived, other content is unaffected;
 * - incomplete matchdays (R-255): only finished matches get result slides; every other status is listed with it;
 * - provenance labels (R-208): every stored and served text segment is a fact, commentary or template text, and a
 *   fact segment carries its fact's current status;
 * - content checks (R-207, R-237): an invented score and translated or abbreviated team names are flagged and the
 *   element cannot be approved; accented official names are shown exactly in Spanish and English;
 * - language (R-236): Spanish by default, English drafts in English, each project keeps its own setting;
 * - person data (R-232): player-level fields leave no value in stored rows, drafting input, content or exports.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Draft, type Fact, ProjectListResponseSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import {
  type Json,
  PERSON_MARKER_PREFIX,
  SPORTS_FIXTURES_DIR,
  type TestApp,
  expectNoNetworkViolations,
  readJson,
} from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import {
  COPA_DEMO_KNOCKOUT,
  COPA_DEMO_LEAGUE_MD1,
  allElements,
  approve,
  approveDraft,
  approveOne,
  captionOf,
  draftOf,
  expectProblem,
  exportCarousel,
  exportFileNames,
  exportFile,
  exported,
  factsOf,
  failedChecks,
  fieldText,
  finalApprove,
  ligaDemo,
  problemOf,
  projectWithDraft,
  renderModelOf,
  slidesOfType,
  versionsOfRun,
  type StoredText,
  WORKFLOW_TEST_TIMEOUT,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

/** A DEMO_DATA app on `demo-only` with one sports scenario and, optionally, one stub AI scenario. */
function demoApp(scenario: string, aiScenario?: string): Promise<TestApp> {
  return start(cleanup, {
    base: 'demo-only',
    scenario,
    ...(aiScenario === undefined
      ? {}
      : {
          mutate: (document: Json) => {
            ((document['providers'] as Json)['ai'] as Json)['options'] = { scenario: aiScenario };
          },
        }),
  });
}

function matchKeyOf(fact: Pick<Fact, 'subject'>): string {
  return String(fact.subject.matchKey);
}

/** The match keys a slide's fact segments refer to (via the run's facts). */
function matchKeysOfSlide(draftElement: Draft['carousels'][number]['elements'][number], facts: readonly Fact[]) {
  const ids = new Set(
    draftElement.currentVersion.fields.flatMap((field) => field.segments.map((segment) => segment.factId)),
  );
  return new Set(facts.filter((fact) => ids.has(fact.factId) && fact.subject.matchKey !== undefined).map(matchKeyOf));
}

function expectCompleteSlides(draft: Draft): void {
  for (const carousel of draft.carousels) {
    // Ordered positions, the caption first, the cover next and the closing slide last.
    expect(carousel.elements.map((element) => element.position)).toEqual(carousel.elements.map((_e, index) => index));
    expect(carousel.elements[0]?.kind).toBe('caption');
    const slides = carousel.elements.filter((element) => element.kind === 'slide');
    expect(slides[0]?.slideType).toBe('cover');
    expect(slides.at(-1)?.slideType).toBe('closing');
    for (const slide of slides) {
      expect(slide.slideType, slide.id).not.toBeNull();
      expect(fieldText(slide, 'headline').length, `${String(slide.slideType)} headline`).toBeGreaterThan(0);
      expect(fieldText(slide, 'description').length, `${String(slide.slideType)} description`).toBeGreaterThan(0);
      expect(slide.currentVersion.imageUrl).toBe(`/api/v1/element-versions/${slide.currentVersion.id}/image`);
    }
    const caption = captionOf(carousel);
    expect(fieldText(caption, 'caption').length).toBeGreaterThan(0);
    const hashtags = caption.currentVersion.fields.find((field) => field.field === 'hashtags');
    expect(hashtags?.segments.length).toBeGreaterThan(0);
    for (const segment of hashtags?.segments ?? []) {
      for (const tag of segment.text.split(/\s+/).filter((part) => part !== '')) {
        expect(tag).toMatch(/^#[\p{L}\p{N}_]{1,60}$/u);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// R-209, R-285, R-254, R-255
// ---------------------------------------------------------------------------------------------------------------

describe('carousel structure on both fixture competitions (R-209, R-285)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('a league matchday: cover, one result slide per finished match in kickoff order, standings covering every row, closing', async () => {
    const t = await demoApp('default');
    const { project, run } = await projectWithDraft(t, ligaDemo(1));
    const draft = await draftOf(t, project.id);
    const facts = (await factsOf(t, project.id, run.id)).facts;
    expect(draft).toMatchObject({ language: 'es', dataMode: 'DEMO_DATA', standingsIncluded: true, leftOutMatches: [] });
    expect(draft.carousels).toHaveLength(1);
    expectCompleteSlides(draft);
    const carousel = draft.carousels[0] as Draft['carousels'][number];
    expect(carousel).toMatchObject({ sequence: 1, total: 1 });

    const finished = facts.filter(
      (fact) => fact.kind === 'match_status' && fact.value !== null && fact.value.matchStatus === 'finished',
    );
    const matchSlides = slidesOfType(carousel, 'match_result');
    expect(matchSlides).toHaveLength(finished.length);
    // One slide per match, in kickoff order.
    const kickoffs = new Map(
      facts
        .filter((fact) => fact.kind === 'match_kickoff' && fact.value !== null)
        .map((fact) => [matchKeyOf(fact), String((fact.value as { kickoff: string }).kickoff)]),
    );
    const slideMatches = matchSlides.map((slide) => [...matchKeysOfSlide(slide, facts)]);
    expect(slideMatches.every((keys) => keys.length === 1)).toBe(true);
    const order = slideMatches.map((keys) => kickoffs.get(String(keys[0])) ?? '');
    expect(order).toEqual([...order].sort());
    expect(new Set(slideMatches.flat()).size).toBe(finished.length);

    // Standings slides cover every standings row of the selection (12 rows per slide).
    const standingRows = facts.filter((fact) => fact.kind === 'standing_row');
    expect(standingRows.length).toBe(16);
    const standingSlides = slidesOfType(carousel, 'standings');
    expect(standingSlides).toHaveLength(Math.ceil(standingRows.length / 12));
    const referenced = new Set(
      standingSlides.flatMap((slide) =>
        slide.currentVersion.fields.flatMap((field) => field.segments.map((segment) => segment.factId)),
      ),
    );
    expect(standingRows.every((fact) => referenced.has(fact.factId))).toBe(true);
    expect(carousel.elements.filter((element) => element.kind === 'slide').map((element) => element.slideType)).toEqual(
      ['cover', ...matchSlides.map(() => 'match_result'), ...standingSlides.map(() => 'standings'), 'closing'],
    );
  });

  it('above the slide limit the selection is split into numbered carousels, one slide per match, standings last', async () => {
    const t = await demoApp('default');
    const { project, run } = await projectWithDraft(t, COPA_DEMO_LEAGUE_MD1);
    const draft = await draftOf(t, project.id);
    const facts = (await factsOf(t, project.id, run.id)).facts;
    const limit = t.container.config.format.maxSlidesPerCarousel;
    expect(limit).toBe(20);
    expect(draft.carousels.length).toBeGreaterThan(1);
    expectCompleteSlides(draft);
    draft.carousels.forEach((carousel, index) => {
      expect(carousel).toMatchObject({ sequence: index + 1, total: draft.carousels.length });
      const slides = carousel.elements.filter((element) => element.kind === 'slide');
      expect(slides.length).toBeLessThanOrEqual(limit);
      // Each carousel has its own cover with its number (for example 1/2).
      const cover = slidesOfType(carousel, 'cover')[0];
      const coverModel = renderModelOf(
        versionsOfRun(t, run.id).find((row) => row.id === cover?.currentVersion.id) ?? { render_model: null },
      );
      const numbers = coverModel.elements.filter((element) => element.semantic === 'carousel_number');
      expect(numbers.map((element) => element.text)).toEqual([
        `${String(index + 1)}/${String(draft.carousels.length)}`,
      ]);
    });
    const finished = facts.filter(
      (fact) => fact.kind === 'match_status' && fact.value !== null && fact.value.matchStatus === 'finished',
    );
    const matchSlides = draft.carousels.flatMap((carousel) => slidesOfType(carousel, 'match_result'));
    expect(matchSlides).toHaveLength(finished.length);
    expect(new Set(matchSlides.flatMap((slide) => [...matchKeysOfSlide(slide, facts)])).size).toBe(finished.length);
    // Standings go to the last carousel only, covering the 36 rows.
    const last = draft.carousels.at(-1) as Draft['carousels'][number];
    expect(draft.carousels.slice(0, -1).every((carousel) => slidesOfType(carousel, 'standings').length === 0)).toBe(
      true,
    );
    expect(slidesOfType(last, 'standings')).toHaveLength(Math.ceil(36 / 12));
  });

  it('a knockout stage without standings: no standings slide, every check passes, the same approval and export rules (R-285)', async () => {
    const t = await demoApp('stage-no-standings');
    const { project, run } = await projectWithDraft(t, COPA_DEMO_KNOCKOUT);
    const listing = await factsOf(t, project.id, run.id);
    expect(listing.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
    expect(listing.facts.filter((fact) => fact.kind === 'standing_row')).toEqual([]);
    const draft = await draftOf(t, project.id);
    expect(draft.standingsIncluded).toBe(false);
    expectCompleteSlides(draft);
    const carousel = draft.carousels[0] as Draft['carousels'][number];
    expect(slidesOfType(carousel, 'standings')).toEqual([]);
    expect(slidesOfType(carousel, 'match_result').length).toBeGreaterThan(0);
    // Visual QA ran on every slide and no blocking check failed.
    for (const element of allElements(draft)) {
      expect(element.currentVersion.state, String(element.slideType)).toBe('ready');
      expect(element.currentVersion.qa.length).toBeGreaterThan(0);
      expect(
        element.currentVersion.qa.filter((result) => result.severity === 'blocking' && result.outcome === 'fail'),
      ).toEqual([]);
    }
    // Export is refused before the final approval and succeeds after it, with one image per slide.
    expectProblem(await exportCarousel(t, carousel.id), 409, 'FINAL_APPROVAL_REQUIRED');
    await approveDraft(t, project.id);
    const written = await exported(t, carousel.id);
    const slideCount = carousel.elements.filter((element) => element.kind === 'slide').length;
    expect(written.files.filter((file) => file.kind === 'slide_image')).toHaveLength(slideCount);
    expect(exportFileNames(t, written)).toEqual([
      ...Array.from({ length: slideCount }, (_v, index) => `${String(index + 1).padStart(2, '0')}.png`),
      'caption.txt',
      'manifest.json',
    ]);
    expectNoNetworkViolations();
  });

  it('missing standings are recorded as unavailable, nothing is derived, no standings slide, other content unaffected (R-254)', async () => {
    const reference = await demoApp('default');
    const complete = await draftOf(reference, (await projectWithDraft(reference, ligaDemo(1))).project.id);

    const t = await demoApp('standings-missing');
    const { project, run } = await projectWithDraft(t, ligaDemo(1));
    const listing = await factsOf(t, project.id, run.id);
    expect(listing.standings).toEqual({ available: false, reason: 'not_provided_by_source' });
    expect(listing.facts.filter((fact) => fact.kind === 'standing_row')).toEqual([]);
    const draft = await draftOf(t, project.id);
    expect(draft.standingsIncluded).toBe(false);
    const carousel = draft.carousels[0] as Draft['carousels'][number];
    expect(slidesOfType(carousel, 'standings')).toEqual([]);
    // No standings value appears anywhere in the stored render models.
    for (const version of versionsOfRun(t, run.id).filter((row) => row.kind === 'slide')) {
      const semantics = renderModelOf(version).elements.map((element) => element.semantic);
      expect(semantics).not.toContain('standings_position');
      expect(semantics).not.toContain('standings_cell');
    }
    // The match slides are those of the complete scenario: same teams, scores and dates.
    const matchTexts = (d: Draft) =>
      slidesOfType(d.carousels[0] as Draft['carousels'][number], 'match_result').map((slide) =>
        ['team_home', 'team_away', 'score', 'kickoff'].map((field) => fieldText(slide, field)).join('|'),
      );
    expect(matchTexts(draft)).toEqual(matchTexts(complete));
    // Other content stays approvable.
    const match = slidesOfType(carousel, 'match_result')[0];
    if (match === undefined) {
      throw new Error('no match slide');
    }
    await approveOne(t, match);
  });

  it('an incomplete matchday: only the finished match gets a result slide; every other status is listed with it (R-255)', async () => {
    const t = await demoApp('unfinished-matches');
    const { project, run } = await projectWithDraft(t, ligaDemo(1));
    const listing = await factsOf(t, project.id, run.id);
    const draft = await draftOf(t, project.id);
    const expectedStatuses = ['scheduled', 'in_play', 'postponed', 'suspended', 'cancelled', 'abandoned', 'awarded'];
    for (const leftOut of [draft.leftOutMatches, listing.leftOutMatches]) {
      expect(leftOut.map((entry) => entry.status).sort()).toEqual([...expectedStatuses].sort());
      expect(leftOut.every((entry) => entry.reason === 'not_finished' && entry.label.includes(' - '))).toBe(true);
    }
    const carousel = draft.carousels[0] as Draft['carousels'][number];
    const matchSlides = slidesOfType(carousel, 'match_result');
    expect(matchSlides).toHaveLength(1);
    const finishedKeys = listing.facts
      .filter((fact) => fact.kind === 'match_status' && fact.value?.matchStatus === 'finished')
      .map(matchKeyOf);
    expect(finishedKeys).toHaveLength(1);
    expect([...matchKeysOfSlide(matchSlides[0] as never, listing.facts)]).toEqual(finishedKeys);
    // No left-out match is shown with a result anywhere in the draft.
    const leftOutKeys = new Set(draft.leftOutMatches.map((entry) => entry.matchKey));
    for (const element of allElements(draft)) {
      expect([...matchKeysOfSlide(element, listing.facts)].filter((key) => leftOutKeys.has(key))).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-208
// ---------------------------------------------------------------------------------------------------------------

describe(
  'provenance labels in the review view and in stored content (R-208)',
  { timeout: WORKFLOW_TEST_TIMEOUT },
  () => {
    it.each([
      ['default', 'verified facts'],
      ['single-source', 'one match awaiting independent verification'],
    ])(
      'every segment is fact, commentary or template text; fact segments show their current status: %s',
      async (scenario) => {
        const t = await demoApp(scenario);
        const { project, run } = await projectWithDraft(t, ligaDemo(1));
        const statusById = new Map(
          (await factsOf(t, project.id, run.id)).facts.map((fact) => [fact.factId, fact.status]),
        );
        const draft = await draftOf(t, project.id);
        const stored = new Map(versionsOfRun(t, run.id).map((row) => [row.id, JSON.parse(row.text) as StoredText]));
        const seen = new Set<string>();
        for (const element of allElements(draft)) {
          const storedText = stored.get(element.currentVersion.id);
          expect(storedText, element.id).toBeDefined();
          for (const field of element.currentVersion.fields) {
            const storedField = storedText?.fields.find((entry) => entry.field === field.field);
            expect(storedField?.segments.map((segment) => [segment.provenance, segment.text])).toEqual(
              field.segments.map((segment) => [segment.provenance, segment.text]),
            );
            for (const segment of field.segments) {
              seen.add(segment.provenance);
              if (segment.provenance === 'fact') {
                expect(segment.factId).not.toBeNull();
                expect(segment.factStatus).toBe(statusById.get(String(segment.factId)));
              } else {
                expect(segment.factId).toBeNull();
                expect(segment.factStatus).toBeNull();
              }
            }
          }
        }
        expect(seen).toEqual(new Set(['fact', 'commentary', 'template_text']));
        const labels = new Set(
          allElements(draft).flatMap((element) =>
            element.currentVersion.fields.flatMap((field) => field.segments.map((segment) => segment.factStatus)),
          ),
        );
        expect(labels).toEqual(
          scenario === 'default' ? new Set([null, 'verified']) : new Set([null, 'verified', 'unverified']),
        );
      },
    );
  },
);

// ---------------------------------------------------------------------------------------------------------------
// R-207, R-237
// ---------------------------------------------------------------------------------------------------------------

const OFFICIAL_NAMES = (
  readJson<{ scenarios: { id: string; officialNames?: string[] }[] }>(
    join(SPORTS_FIXTURES_DIR, '_manifest.json'),
  ).scenarios.find((scenario) => scenario.id === 'accented-names')?.officialNames ?? []
).slice();

describe('content checks at approval (R-207, R-237)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('a caption with an invented score is flagged and cannot be approved, nor exported; the slides can (R-207)', async () => {
    const t = await demoApp('default', 'invented-score');
    const { project } = await projectWithDraft(t, ligaDemo(1));
    const draft = await draftOf(t, project.id);
    const carousel = draft.carousels[0] as Draft['carousels'][number];
    const caption = captionOf(carousel);
    expect(caption.currentVersion.contentFlags).toContainEqual(
      expect.objectContaining({ code: 'UNVERIFIED_NUMBER', field: 'caption' }),
    );
    expect(fieldText(caption, 'caption')).toContain('4-0');
    expectProblem(await approve(t, caption), 409, 'CONTENT_FLAGGED');
    for (const element of carousel.elements.filter((entry) => entry.kind === 'slide')) {
      expect(element.currentVersion.contentFlags, String(element.slideType)).toEqual([]);
      await approveOne(t, element);
    }
    // The flagged caption stays unapproved; the carousel is approved and exported without it (PD-ARCH-01E-PD-02), so
    // the invented score never reaches an export.
    expect((await finalApprove(t, carousel.id)).statusCode).toBe(200);
    const written = await exported(t, carousel.id);
    expect(written.files.some((file) => file.kind === 'caption_text')).toBe(false);
    expect(written.files.some((file) => file.elementVersionId === caption.currentVersion.id)).toBe(false);
  });

  it.each([
    ['translated-team-name', 'Ebony River Athletic'],
    ['abbreviated-team-name', null],
  ])(
    '%s: the headline is flagged NON_OFFICIAL_TEAM_NAME, fails team_names and cannot be approved',
    async (aiScenario, form) => {
      const t = await demoApp('accented-names', aiScenario);
      const { project } = await projectWithDraft(t, ligaDemo(1));
      const draft = await draftOf(t, project.id);
      const flagged = allElements(draft).filter((element) =>
        element.currentVersion.contentFlags.some((flag) => flag.code === 'NON_OFFICIAL_TEAM_NAME'),
      );
      expect(flagged.length).toBeGreaterThan(0);
      for (const element of flagged) {
        expect(element.slideType).toBe('match_result');
        expect(element.currentVersion.contentFlags).toContainEqual(
          expect.objectContaining({ code: 'NON_OFFICIAL_TEAM_NAME', field: 'headline' }),
        );
        if (form !== null) {
          expect(fieldText(element, 'headline')).toContain(form);
        }
        expect(failedChecks(element)).toContain('team_names');
        expect(element.currentVersion.state).toBe('qa_failed');
        // Guard order (T37): the content flag is reported before the QA failure.
        const refused = problemOf(await approve(t, element));
        expect(refused.code).toBe('CONTENT_FLAGGED');
      }
    },
  );

  it.each(['es', 'en'] as const)(
    'accented official names are shown exactly in %s content and pass team_names',
    async (language) => {
      const t = await demoApp('accented-names');
      const { project, run } = await projectWithDraft(t, { ...ligaDemo(1), language });
      const draft = await draftOf(t, project.id);
      expect(draft.language).toBe(language);
      const shown = new Set(
        allElements(draft).flatMap((element) => [fieldText(element, 'team_home'), fieldText(element, 'team_away')]),
      );
      for (const name of OFFICIAL_NAMES) {
        expect(shown.has(name), name).toBe(true);
      }
      const official = new Set(
        (await factsOf(t, project.id, run.id)).facts
          .filter((fact) => fact.kind === 'team_official_name')
          .map((fact) => String(fact.display)),
      );
      for (const version of versionsOfRun(t, run.id).filter((row) => row.kind === 'slide')) {
        for (const element of renderModelOf(version).elements.filter((entry) => entry.semantic === 'team_name')) {
          expect(official.has(String(element.text)), element.text).toBe(true);
        }
      }
      for (const element of allElements(draft)) {
        expect(failedChecks(element)).not.toContain('team_names');
        expect(element.currentVersion.contentFlags).toEqual([]);
      }
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// R-236
// ---------------------------------------------------------------------------------------------------------------

describe('content language (R-236)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('Spanish by default, English on request, and each project keeps its own language', async () => {
    const t = await demoApp('default');
    const spanish = await projectWithDraft(t, ligaDemo(1));
    const requestsAfterSpanish = t.aiRequests.length;
    const english = await projectWithDraft(t, { ...ligaDemo(1), language: 'en' });
    expect(spanish.project.language).toBe('es');
    expect(english.project.language).toBe('en');
    expect(t.aiRequests.slice(0, requestsAfterSpanish).every((request) => request.language === 'es')).toBe(true);
    expect(t.aiRequests.slice(requestsAfterSpanish).every((request) => request.language === 'en')).toBe(true);

    const es = await draftOf(t, spanish.project.id);
    const en = await draftOf(t, english.project.id);
    expect([es.language, en.language]).toEqual(['es', 'en']);
    const firstMatch = (d: Draft) => slidesOfType(d.carousels[0] as Draft['carousels'][number], 'match_result')[0];
    expect(fieldText(firstMatch(es) as never, 'title')).toMatch(/^Resultado final · /);
    expect(fieldText(firstMatch(en) as never, 'title')).toMatch(/^Full time · /);
    expect(fieldText(firstMatch(es) as never, 'kickoff')).toMatch(/ ago /);
    expect(fieldText(firstMatch(en) as never, 'kickoff')).toMatch(/ Aug /);
    expect(fieldText(firstMatch(es) as never, 'headline')).toMatch(/^Partido/);
    expect(fieldText(firstMatch(en) as never, 'headline')).toMatch(/^Match/);
    // Team names and scores are the same verified values in both languages.
    for (const field of ['team_home', 'team_away', 'score']) {
      expect(fieldText(firstMatch(en) as never, field)).toBe(fieldText(firstMatch(es) as never, field));
    }

    // Changing one project's language changes only that project; its next draft uses it.
    const changed = await t.send('PATCH', `/projects/${english.project.id}`, { language: 'es' });
    expect(changed.statusCode, changed.body).toBe(200);
    const projects = ProjectListResponseSchema.parse((await t.get('/projects')).json()).projects;
    expect(projects.find((entry) => entry.id === spanish.project.id)?.language).toBe('es');
    expect(projects.find((entry) => entry.id === english.project.id)?.language).toBe('es');
    const redraft = await t.runWorkflow(english.project.id);
    expect(redraft.status).toBe('completed');
    expect((await draftOf(t, english.project.id)).language).toBe('es');
    expect((await draftOf(t, spanish.project.id)).language).toBe('es');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-232
// ---------------------------------------------------------------------------------------------------------------

describe('player-level fields never reach content (R-232)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('leaves no person value in stored rows, drafting input, content, exports or logs', async () => {
    const t = await demoApp('player-fields');
    const raw = readFileSync(join(SPORTS_FIXTURES_DIR, 'player-fields', 'demo-a.json'), 'utf8');
    expect(raw).toContain(PERSON_MARKER_PREFIX);
    const { project } = await projectWithDraft(t, ligaDemo(1));
    const draft = await approveDraft(t, project.id);
    const written = await exported(t, (draft.carousels[0] as Draft['carousels'][number]).id);
    expect(t.aiRequests.length).toBeGreaterThan(0);
    const texts: [string, string][] = [
      ['database', t.databaseText()],
      ['draft requests', JSON.stringify(t.aiRequests)],
      ['draft', JSON.stringify(draft)],
      ['logs', t.log.text()],
      ...exportFileNames(t, written).map((name): [string, string] => [
        name,
        exportFile(t, written, name).toString('latin1'),
      ]),
    ];
    for (const [where, text] of texts) {
      expect(text, where).not.toContain(PERSON_MARKER_PREFIX);
      expect(text, where).not.toMatch(/"(scorers|lineups?|referees?|coach|squad|players|topScorer)"/);
    }
  });
});
