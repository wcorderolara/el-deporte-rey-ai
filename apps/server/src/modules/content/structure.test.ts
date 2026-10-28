/**
 * Deterministic carousel structure (architecture.md section 8.1; OD-03, OD-05; R-209, R-254, R-255, R-285): included
 * and left-out matches for every match status, candidate values, exclusions, kickoff order, standings only when
 * available (any number of rows, split per slide, nothing derived), and the split into numbered carousels.
 */
import { describe, expect, it } from 'vitest';

import { FactIndex, type SlidePlan, planDraft } from './structure.js';
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
