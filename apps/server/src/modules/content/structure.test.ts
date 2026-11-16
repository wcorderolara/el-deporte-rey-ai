/**
 * Deterministic carousel structure (architecture.md section 8.1; OD-03, OD-05; R-209, R-254, R-255, R-285): included
 * and left-out matches for every match status, candidate values, exclusions, kickoff order, standings only when
 * available (any number of rows, split per slide, nothing derived), and the split into numbered carousels. Matches not
 * played yet (PD-ARCH-01E-B): round calendars, upcoming matches and previews chosen by the local status, never by the
 * date, without score or result.
 */
import { describe, expect, it } from 'vitest';

import {
  CALENDAR_ROWS_PER_SLIDE,
  FactIndex,
  OVERVIEW_ROWS_PER_SLIDE,
  type SlidePlan,
  fixturePlanFor,
  planDraft,
} from './structure.js';
import { Facts, leagueFacts } from './test/support.js';

const OPTIONS = {
  standings: { available: false, reason: 'not_provided_for_stage' },
  excludedMatchKeys: [],
  maxSlidesPerCarousel: 20,
  standingsRowsPerSlide: 12,
} as const;

function types(slides: readonly SlidePlan[]): string[] {
  return slides.map((slide) => slide.type);
}

function teams(count: number): Facts {
  const facts = new Facts();
  for (let index = 1; index <= count; index += 1) {
    facts.team(
      `equipo-${String(index)}`,
      `Equipo Sintético ${String.fromCharCode(64 + ((index - 1) % 26) + 1)}${String(index)}`,
    );
  }
  return facts;
}

describe('included and left-out matches (OD-05, R-255)', () => {
  it('includes only finished matches and lists every other status with its status', () => {
    const facts = teams(16);
    const statuses = [
      'finished',
      'scheduled',
      'in_play',
      'postponed',
      'suspended',
      'cancelled',
      'abandoned',
      'awarded',
    ];
    statuses.forEach((status, index) => {
      facts.match(`partido-${String(index)}`, {
        home: `equipo-${String(index * 2 + 1)}`,
        away: `equipo-${String(index * 2 + 2)}`,
        status,
        score: status === 'finished' || status === 'awarded' ? [1, 0] : null,
        kickoff: `2026-10-2${String(index)}T18:00:00Z`,
      });
    });
    const plan = planDraft(new FactIndex(facts.facts), OPTIONS);
    const slides = plan.carousels[0]?.slides ?? [];
    expect(types(slides)).toEqual(['cover', 'match_result', 'closing']);
    expect(plan.leftOutMatches.map((match) => [match.status, match.reason])).toEqual(
      statuses.slice(1).map((status) => [status, 'not_finished']),
    );
    expect(plan.leftOutMatches[0]?.label).toBe('Equipo Sintético C3 - Equipo Sintético D4');
  });

  it('drafts matches with candidate values and leaves out disputed or unnamed ones', () => {
    const facts = teams(6)
      .match('candidato', { home: 'equipo-1', away: 'equipo-2', mode: 'candidate' })
      .match('disputado', { home: 'equipo-3', away: 'equipo-4', scoreMode: 'disputed' })
      .match('sin-nombre', { home: 'equipo-5', away: 'equipo-sin-nombre' });
    const plan = planDraft(new FactIndex(facts.facts), OPTIONS);
    const matches = (plan.carousels[0]?.slides ?? []).flatMap((slide) =>
      slide.type === 'match_result' ? [slide.match.matchKey] : [],
    );
    expect(matches).toEqual(['candidato']);
    expect(plan.leftOutMatches.map((match) => [match.matchKey, match.reason, match.status])).toEqual([
      ['disputado', 'not_verified', 'finished'],
      ['sin-nombre', 'not_verified', 'finished'],
    ]);
  });

  it('leaves out excluded matches and orders the others by kickoff, then home team name', () => {
    const facts = teams(8)
      .match('tarde', { home: 'equipo-1', away: 'equipo-2', kickoff: '2026-10-25T20:00:00Z' })
      .match('temprano-b', { home: 'equipo-5', away: 'equipo-6', kickoff: '2026-10-25T18:00:00-02:00' })
      .match('temprano-a', { home: 'equipo-3', away: 'equipo-4', kickoff: '2026-10-25T20:00:00Z' })
      .match('excluido', { home: 'equipo-7', away: 'equipo-8' });
    const plan = planDraft(new FactIndex(facts.facts), { ...OPTIONS, excludedMatchKeys: ['excluido', 'desconocido'] });
    const order = (plan.carousels[0]?.slides ?? []).flatMap((slide) =>
      slide.type === 'match_result' ? [`${String(slide.match.index)}:${slide.match.matchKey}`] : [],
    );
    expect(order).toEqual(['1:tarde', '2:temprano-a', '3:temprano-b']);
    expect(plan.leftOutMatches).toEqual([
      {
        matchKey: 'excluido',
        label: 'Equipo Sintético G7 - Equipo Sintético H8',
        status: 'finished',
        reason: 'excluded_by_operator',
      },
    ]);
    expect(plan.excludedMatchKeys).toEqual(['excluido', 'desconocido']);
  });
});

describe('standings slides (R-254, R-285)', () => {
  function withRows(count: number, mode: 'verified' | 'candidate' = 'verified'): Facts {
    const facts = teams(count).match('partido', { home: 'equipo-1', away: 'equipo-2' });
    for (let index = 1; index <= count; index += 1) {
      facts.standing(`equipo-${String(index)}`, index, 3 * (count - index), mode);
    }
    return facts;
  }

  it('builds no standings slide and derives nothing when standings are unavailable', () => {
    const facts = withRows(4);
    for (const standings of [
      { available: false, reason: 'not_provided_for_stage' as const },
      { available: false, reason: 'not_available_with_subscription' as const },
      null,
    ]) {
      const plan = planDraft(new FactIndex(facts.facts), { ...OPTIONS, standings });
      expect(plan.standingsIncluded).toBe(false);
      expect(types(plan.carousels[0]?.slides ?? [])).toEqual(['cover', 'match_result', 'closing']);
    }
  });

  it('builds no standings slide when standings are available but no rows exist', () => {
    const facts = leagueFacts();
    const plan = planDraft(new FactIndex(facts.facts), { ...OPTIONS, standings: { available: true, reason: null } });
    expect(plan.standingsIncluded).toBe(false);
    expect(types(plan.carousels[0]?.slides ?? [])).not.toContain('standings');
  });

  it('splits any number of rows by standingsRowsPerSlide, in position order', () => {
    const facts = withRows(36, 'candidate');
    const plan = planDraft(new FactIndex([...facts.facts].reverse()), {
      ...OPTIONS,
      standings: { available: true, reason: null },
    });
    const pages = (plan.carousels[0]?.slides ?? []).flatMap((slide) => (slide.type === 'standings' ? [slide] : []));
    expect(plan.standingsIncluded).toBe(true);
    expect(pages.map((page) => [page.key, page.rows.length])).toEqual([
      ['standings-1', 12],
      ['standings-2', 12],
      ['standings-3', 12],
    ]);
    expect(pages.flatMap((page) => page.rows.map((row) => row.value.position))).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 1),
    );
  });

  it('builds no standings slide when a row has no value (nothing invented)', () => {
    const facts = withRows(4);
    facts.team('equipo-5', 'Equipo Sintético E5').standing('equipo-5', 5, 0, 'disputed');
    const plan = planDraft(new FactIndex(facts.facts), { ...OPTIONS, standings: { available: true, reason: null } });
    expect(plan.standingsIncluded).toBe(false);
  });
});

describe('numbered carousels (OD-03)', () => {
  it('splits by maxSlidesPerCarousel with a cover and a closing slide each, standings in the last', () => {
    const facts = teams(14);
    for (let index = 1; index <= 7; index += 1) {
      facts.match(`partido-${String(index)}`, {
        home: `equipo-${String(index * 2 - 1)}`,
        away: `equipo-${String(index * 2)}`,
        kickoff: `2026-10-2${String(index)}T18:00:00Z`,
      });
    }
    for (let index = 1; index <= 14; index += 1) {
      facts.standing(`equipo-${String(index)}`, index, 30 - index);
    }
    const plan = planDraft(new FactIndex(facts.facts), {
      ...OPTIONS,
      maxSlidesPerCarousel: 5,
      standingsRowsPerSlide: 7,
      standings: { available: true, reason: null },
    });
    expect(plan.carousels.map((carousel) => [carousel.sequence, carousel.total, types(carousel.slides)])).toEqual([
      [1, 3, ['cover', 'match_result', 'match_result', 'match_result', 'closing']],
      [2, 3, ['cover', 'match_result', 'match_result', 'match_result', 'closing']],
      [3, 3, ['cover', 'match_result', 'standings', 'standings', 'closing']],
    ]);
    for (const carousel of plan.carousels) {
      expect(carousel.slides.length).toBeLessThanOrEqual(5);
    }
  });

  it('keeps a complete carousel when nothing can be included', () => {
    const facts = teams(2).match('pendiente', { home: 'equipo-1', away: 'equipo-2', status: 'scheduled', score: null });
    const plan = planDraft(new FactIndex(facts.facts), OPTIONS);
    expect(plan.carousels.map((carousel) => types(carousel.slides))).toEqual([['cover', 'closing']]);
    expect(plan.leftOutMatches).toHaveLength(1);
  });
});

describe('matches not played yet (PD-ARCH-01E-B)', () => {
  /** One match per status, kicked off on consecutive days in reverse order of the list. */
  function round(): Facts {
    const facts = teams(12);
    const statuses = ['finished', 'scheduled', 'postponed', 'in_play', 'cancelled', 'scheduled'];
    statuses.forEach((status, index) => {
      facts.match(`partido-${String(index)}`, {
        home: `equipo-${String(index * 2 + 1)}`,
        away: `equipo-${String(index * 2 + 2)}`,
        status,
        score: status === 'finished' || status === 'in_play' ? [1, 0] : null,
        // The scheduled matches kick off in the past: the status decides, never the date.
        kickoff: index === 5 ? null : `2020-01-${String(20 - index).padStart(2, '0')}T18:00:00Z`,
      });
    });
    return facts;
  }

  function fixtureKeys(slides: readonly SlidePlan[]): string[] {
    return slides.flatMap((slide) =>
      slide.type === 'fixture' || slide.type === 'match_preview' ? [slide.fixture.matchKey] : [],
    );
  }

  it('plans a round calendar: cover, overview, every match not finished in kickoff order, closing', () => {
    const plan = planDraft(new FactIndex(round().facts), { ...OPTIONS, contentKind: 'calendar' });
    const slides = plan.carousels[0]?.slides ?? [];
    expect(types(slides)).toEqual(['cover', 'round_overview', 'fixture', 'fixture', 'fixture', 'fixture', 'closing']);
    expect(fixtureKeys(slides)).toEqual(['partido-4', 'partido-3', 'partido-2', 'partido-1']);
    const overview = slides[1];
    expect(overview?.type === 'round_overview' ? overview.fixtures.map((item) => item.status) : []).toEqual([
      'cancelled',
      'in_play',
      'postponed',
      'scheduled',
    ]);
    expect(plan.leftOutMatches.map((match) => [match.matchKey, match.reason])).toEqual([
      ['partido-0', 'already_finished'],
      ['partido-5', 'not_verified'],
    ]);
    expect(plan.standingsIncluded).toBe(false);
  });

  it('keeps no score or result in the fixture plan', () => {
    const plan = planDraft(new FactIndex(round().facts), { ...OPTIONS, contentKind: 'calendar' });
    for (const slide of plan.carousels[0]?.slides ?? []) {
      if (slide.type === 'fixture') {
        expect(Object.keys(slide.fixture).sort()).toEqual(
          [
            'away',
            'home',
            'index',
            'kickoff',
            'kickoffFactId',
            'matchKey',
            'status',
            'statusFactId',
            'teamsFactId',
          ].sort(),
        );
      }
    }
  });

  it('splits the round overview into pages and plans a calendar without matches as cover and closing', () => {
    const facts = teams(2 * (OVERVIEW_ROWS_PER_SLIDE + 1));
    for (let index = 0; index <= OVERVIEW_ROWS_PER_SLIDE; index += 1) {
      facts.match(`p-${String(index)}`, {
        home: `equipo-${String(index * 2 + 1)}`,
        away: `equipo-${String(index * 2 + 2)}`,
        status: 'scheduled',
        score: null,
      });
    }
    const plan = planDraft(new FactIndex(facts.facts), {
      ...OPTIONS,
      contentKind: 'calendar',
      maxSlidesPerCarousel: 40,
    });
    const overviews = (plan.carousels[0]?.slides ?? []).filter((slide) => slide.type === 'round_overview');
    expect(overviews.map((slide) => (slide.type === 'round_overview' ? slide.fixtures.length : 0))).toEqual([
      OVERVIEW_ROWS_PER_SLIDE,
      1,
    ]);

    // PD-ARCH-01G-E.2 (decision DE-E5): a calendar with rows holds six matches per page; the rest go to the next pages.
    const withRows = planDraft(new FactIndex(facts.facts), {
      ...OPTIONS,
      contentKind: 'calendar',
      maxSlidesPerCarousel: 40,
      calendarRows: true,
    });
    const pages = (withRows.carousels[0]?.slides ?? []).filter((slide) => slide.type === 'round_overview');
    expect(CALENDAR_ROWS_PER_SLIDE).toBe(6);
    expect(pages.map((slide) => (slide.type === 'round_overview' ? [slide.page, slide.fixtures.length] : []))).toEqual([
      [1, CALENDAR_ROWS_PER_SLIDE],
      [2, OVERVIEW_ROWS_PER_SLIDE + 1 - CALENDAR_ROWS_PER_SLIDE],
    ]);
    // The same matches, in the same order, as the calendar without rows.
    const fixtureKeysOf = (slides: readonly SlidePlan[]) =>
      slides.flatMap((slide) => (slide.type === 'round_overview' ? slide.fixtures.map((item) => item.matchKey) : []));
    expect(fixtureKeysOf(pages)).toEqual(fixtureKeysOf(overviews));

    const finished = teams(2).match('final', { home: 'equipo-1', away: 'equipo-2' });
    const empty = planDraft(new FactIndex(finished.facts), { ...OPTIONS, contentKind: 'calendar' });
    expect(types(empty.carousels[0]?.slides ?? [])).toEqual(['cover', 'closing']);
    expect(empty.leftOutMatches.map((match) => match.reason)).toEqual(['already_finished']);
  });

  it('spreads a long round over calendar pages of six and numbered carousels, in kickoff order (PD-ARCH-01G-E.2)', () => {
    // A league-phase round: 18 matches not played yet, with the configured 20 slides per carousel.
    const facts = teams(36);
    for (let index = 0; index < 18; index += 1) {
      facts.match(`fase-${String(index).padStart(2, '0')}`, {
        home: `equipo-${String(index * 2 + 1)}`,
        away: `equipo-${String(index * 2 + 2)}`,
        status: index === 4 ? 'postponed' : 'scheduled',
        score: null,
        kickoff: `2026-11-${String(10 + Math.floor(index / 6)).padStart(2, '0')}T${String(12 + (index % 6)).padStart(2, '0')}:00:00Z`,
      });
    }
    const plan = planDraft(new FactIndex(facts.facts), {
      ...OPTIONS,
      contentKind: 'calendar',
      maxSlidesPerCarousel: 20,
      calendarRows: true,
    });
    const all = plan.carousels.flatMap((carousel) => carousel.slides);
    const pages = all.filter((slide) => slide.type === 'round_overview');
    expect(pages.map((slide) => (slide.type === 'round_overview' ? [slide.page, slide.fixtures.length] : []))).toEqual([
      [1, 6],
      [2, 6],
      [3, 6],
    ]);
    // The pages list the matches in kickoff order, and the fixture slides follow in the same order.
    const order = Array.from({ length: 18 }, (_, index) => `fase-${String(index).padStart(2, '0')}`);
    expect(
      pages.flatMap((slide) => (slide.type === 'round_overview' ? slide.fixtures.map((item) => item.matchKey) : [])),
    ).toEqual(order);
    expect(all.flatMap((slide) => (slide.type === 'fixture' ? [slide.fixture.matchKey] : []))).toEqual(order);
    // 3 pages and 18 fixtures do not fit one carousel of 20: two numbered carousels, each with its cover and closing,
    // the pages first, and every slide key once.
    expect(plan.carousels.map((carousel) => [carousel.sequence, carousel.total])).toEqual([
      [1, 2],
      [2, 2],
    ]);
    for (const carousel of plan.carousels) {
      expect(carousel.slides[0]?.type).toBe('cover');
      expect(carousel.slides.at(-1)?.type).toBe('closing');
      expect(carousel.slides.length).toBeLessThanOrEqual(20);
    }
    expect(types(plan.carousels[0]?.slides ?? []).slice(0, 4)).toEqual([
      'cover',
      'round_overview',
      'round_overview',
      'round_overview',
    ]);
    const keys = all.filter((slide) => slide.type !== 'cover' && slide.type !== 'closing').map((slide) => slide.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('plans upcoming matches from scheduled and postponed matches only', () => {
    const plan = planDraft(new FactIndex(round().facts), { ...OPTIONS, contentKind: 'upcoming' });
    const slides = plan.carousels[0]?.slides ?? [];
    expect(types(slides)).toEqual(['cover', 'fixture', 'fixture', 'closing']);
    expect(fixtureKeys(slides)).toEqual(['partido-2', 'partido-1']);
    expect(plan.leftOutMatches.map((match) => [match.matchKey, match.reason])).toEqual([
      ['partido-4', 'not_upcoming'],
      ['partido-3', 'not_upcoming'],
      ['partido-0', 'already_finished'],
      ['partido-5', 'not_verified'],
    ]);
  });

  it('honours the exclusions of the operator', () => {
    const plan = planDraft(new FactIndex(round().facts), {
      ...OPTIONS,
      contentKind: 'upcoming',
      excludedMatchKeys: ['partido-2'],
    });
    expect(fixtureKeys(plan.carousels[0]?.slides ?? [])).toEqual(['partido-1']);
    expect(plan.leftOutMatches.find((match) => match.matchKey === 'partido-2')?.reason).toBe('excluded_by_operator');
  });

  it('plans a preview of one scheduled match: cover, match information, closing', () => {
    const facts = teams(2).match('previa', { home: 'equipo-1', away: 'equipo-2', status: 'scheduled', score: null });
    const plan = planDraft(new FactIndex(facts.facts), { ...OPTIONS, contentKind: 'preview' });
    const slides = plan.carousels[0]?.slides ?? [];
    expect(types(slides)).toEqual(['cover', 'match_preview', 'closing']);
    expect(slides[1]?.key).toBe('preview-1');
    expect(fixturePlanFor(new FactIndex(facts.facts), 'previa', 1, 'preview')?.status).toBe('scheduled');
  });

  it('plans no preview for a finished, in-play or incomplete match', () => {
    for (const [status, kickoff, reason] of [
      ['finished', undefined, 'already_finished'],
      ['in_play', undefined, 'not_upcoming'],
      ['scheduled', null, 'not_verified'],
    ] as const) {
      const facts = teams(2).match('previa', { home: 'equipo-1', away: 'equipo-2', status, kickoff, score: null });
      const plan = planDraft(new FactIndex(facts.facts), { ...OPTIONS, contentKind: 'preview' });
      expect(types(plan.carousels[0]?.slides ?? []), status).toEqual(['cover', 'closing']);
      expect(plan.leftOutMatches.map((match) => match.reason)).toEqual([reason]);
    }
    const unnamed = new Facts().match('previa', { home: 'sin-nombre', away: 'otro', status: 'scheduled', score: null });
    expect(fixturePlanFor(new FactIndex(unnamed.facts), 'previa', 1, 'preview')).toBeNull();
  });
});
