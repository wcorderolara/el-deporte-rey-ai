/**
 * Round overview template (PD-ARCH-01E-B): the calendar page of a round. The calendar title with the round (`title`),
 * the fixtures of the page (`fixtures`: one line per match, fact segments separated by template text), then the AI
 * headline and description and the brand logo.
 *
 * Versions (OD-13):
 * - 1.0.0 draws one line of text per fixture on alternating bands. Lines beyond the list area are flagged by the
 *   text-fit check, never dropped.
 * - 2.0.0 (PD-ARCH-01G-E.2, decisions DE-E5 and DE-E6) draws one row per match: the home badge and official name, the
 *   date and time in the middle with the match status when it is not "scheduled", and the away name and badge. A slide
 *   has room for `CALENDAR_ROWS` rows; the content stage puts at most that many matches on a page. A team without a
 *   badge leaves its slot empty and keeps its name. Each value is its own text element, so visual QA compares every row
 *   with its facts (data_match, team_names, text_fit). Only projects whose badge snapshot covers the calendar rows use
 *   it; every other project keeps 1.0.0 (decision DE-E3).
 */
import { type StoredSegment, runOf, segmentsOf } from '../slide-content.js';

import { ModelBuilder, type TemplateDefinition } from './common.js';
import { aiFields } from './shared.js';

/** Top and height of the list area in the reference layout. */
const LIST_TOP = 330;
const LIST_HEIGHT = 680;
const MAX_LINE_HEIGHT = 85;
const MIN_LINE_HEIGHT = 40;

/** The matches a calendar slide of version 2.0.0 shows (decision DE-E5: six per 1080 x 1350 slide). */
export const CALENDAR_ROWS = 6;

/** The lines of a `fixtures` field: lines are separated by template line feeds (content module `composeSlide`). */
export function fixtureLinesOf(segments: readonly StoredSegment[]): StoredSegment[][] {
  const lines: StoredSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.provenance === 'template_text' && segment.text === '\n') {
      lines.push([]);
    } else {
      lines[lines.length - 1]?.push(segment);
    }
  }
  return lines.filter((line) => line.length > 0);
}

/** The values of one calendar row, each a fact segment of the line (null when the line does not have it). */
export interface FixtureRow {
  readonly home: StoredSegment | null;
  readonly away: StoredSegment | null;
  readonly date: StoredSegment | null;
  readonly time: StoredSegment | null;
  readonly status: StoredSegment | null;
}

/**
 * The rows of a `fixtures` field. The content stage writes the fact segments of a line in a fixed order: the home
 * team name, the away team name, the kickoff date, then, in the calendars of PD-ARCH-01G-E.2, the kickoff time and the
 * status when the match is not scheduled. Template text between them is only separators.
 */
export function fixtureRowsOf(segments: readonly StoredSegment[]): FixtureRow[] {
  return fixtureLinesOf(segments).map((line) => {
    const facts = line.filter((segment) => segment.provenance === 'fact' && segment.factId !== null);
    return {
      home: facts[0] ?? null,
      away: facts[1] ?? null,
      date: facts[2] ?? null,
      time: facts[3] ?? null,
      status: facts[4] ?? null,
    };
  });
}

/** Version 1.0.0: one line of text per fixture. */
export const roundOverviewTemplateV1: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'round-overview',
  version: '1.0.0',
  slideType: 'round_overview',
  label: 'Calendario de jornada',
  imageSlots: Object.freeze(['brand_logo'] as const),
  badgeSlots: Object.freeze([]),
  build(content, ctx) {
    const model = new ModelBuilder(roundOverviewTemplateV1, content, ctx);
    model.chrome();
    title(model, content);
    const lines = fixtureLinesOf(segmentsOf(content.text, 'fixtures'));
    const lineHeight = Math.max(MIN_LINE_HEIGHT, Math.min(MAX_LINE_HEIGHT, LIST_HEIGHT / Math.max(1, lines.length)));
    lines.forEach((line, index) => {
      const y = LIST_TOP + index * lineHeight;
      if (index % 2 === 0) {
        model.rect(`line-${String(index + 1)}-band`, 30, y, 1020, lineHeight, 'primary');
      }
      model.text({
        id: `line-${String(index + 1)}`,
        field: 'fixtures',
        semantic: 'fixture_line',
        x: 50,
        y,
        width: 980,
        height: lineHeight,
        role: 'body',
        maxSize: Math.min(34, lineHeight * 0.45),
        minSize: Math.min(18, lineHeight * 0.3),
        maxLines: 2,
        colorRole: 'light',
        run: runOf(line),
      });
    });
    aiFields(model, content, {
      headline: { y: 1030, height: 110, maxSize: 40, minSize: 24, maxLines: 2 },
      description: { y: 1150, height: 90, maxSize: 28, minSize: 18, maxLines: 2 },
    });
    return model.build();
  },
});

function title(model: ModelBuilder, content: Parameters<TemplateDefinition['build']>[0]): void {
  model.text({
    id: 'title',
    field: 'title',
    semantic: 'title',
    x: 60,
    y: 218,
    width: 960,
    height: 90,
    role: 'heading',
    maxSize: 52,
    minSize: 28,
    maxLines: 1,
    colorRole: 'accent',
    run: runOf(segmentsOf(content.text, 'title')),
  });
}

/** Rows of version 2.0.0 in the reference layout. */
const ROWS_TOP = 326;
const ROW_HEIGHT = 104;
const ROW_GAP = 10;
const BADGE_SIZE = 80;

function runOfSegment(segment: StoredSegment | null): ReturnType<typeof runOf> {
  return runOf(segment === null ? [] : [segment]);
}

/** Version 2.0.0: one row per match with the two badges (PD-ARCH-01G-E.2). */
export const roundOverviewTemplate: TemplateDefinition = Object.freeze<TemplateDefinition>({
  id: 'round-overview',
  version: '2.0.0',
  slideType: 'round_overview',
  label: 'Calendario de jornada',
  imageSlots: Object.freeze(['brand_logo'] as const),
  badgeSlots: Object.freeze(['team-badge-home', 'team-badge-away'] as const),
  drawsBadges: true,
  rows: CALENDAR_ROWS,
  build(content, ctx) {
    const model = new ModelBuilder(roundOverviewTemplate, content, ctx);
    model.chrome();
    title(model, content);
    fixtureRowsOf(segmentsOf(content.text, 'fixtures')).forEach((row, index) => {
      const n = index + 1;
      const id = `row-${String(n)}`;
      // A row beyond the slide's rows is still drawn below the list and flagged by the text-fit check, never dropped.
      const beyond = n > CALENDAR_ROWS;
      const y = ROWS_TOP + index * (ROW_HEIGHT + ROW_GAP);
      const badgeY = y + (ROW_HEIGHT - BADGE_SIZE) / 2;
      model.rect(`${id}-band`, 30, y, 1020, ROW_HEIGHT, 'primary', 14);
      if (!beyond) {
        model.rowBadge(n, 'team-badge-home', 46, badgeY, BADGE_SIZE, BADGE_SIZE);
        model.rowBadge(n, 'team-badge-away', 954, badgeY, BADGE_SIZE, BADGE_SIZE);
      }
      const name = {
        y,
        height: ROW_HEIGHT,
        width: 300,
        role: 'heading',
        maxSize: 30,
        minSize: 18,
        maxLines: 2,
      } as const;
      model.text({
        ...name,
        id: `${id}-home`,
        field: 'fixtures',
        semantic: 'team_name',
        x: 138,
        colorRole: 'light',
        align: 'right',
        forceOverflow: beyond,
        run: runOfSegment(row.home),
      });
      model.text({
        ...name,
        id: `${id}-away`,
        field: 'fixtures',
        semantic: 'team_name',
        x: 642,
        colorRole: 'light',
        align: 'left',
        forceOverflow: beyond,
        run: runOfSegment(row.away),
      });
      // The middle column: the date, the time and, for a match that is not scheduled, its status.
      const withStatus = row.status !== null;
      const middle = { x: 450, width: 180, field: 'fixtures', maxLines: 1, forceOverflow: beyond } as const;
      model.text({
        ...middle,
        id: `${id}-date`,
        semantic: 'kickoff',
        y: y + (withStatus ? 6 : 14),
        height: withStatus ? 30 : 36,
        role: 'body',
        maxSize: 24,
        minSize: 16,
        colorRole: 'light',
        run: runOfSegment(row.date),
      });
      model.text({
        ...middle,
        id: `${id}-time`,
        semantic: 'kickoff_time',
        y: y + (withStatus ? 36 : 50),
        height: withStatus ? 34 : 40,
        role: 'numeric',
        maxSize: withStatus ? 28 : 32,
        minSize: 18,
        colorRole: 'accent',
        run: runOfSegment(row.time),
      });
      model.text({
        ...middle,
        id: `${id}-status`,
        semantic: 'match_status',
        y: y + 70,
        height: 28,
        role: 'body',
        maxSize: 20,
        minSize: 14,
        colorRole: 'accent',
        run: runOfSegment(row.status),
      });
    });
    aiFields(model, content, {
      headline: { y: 1030, height: 110, maxSize: 40, minSize: 24, maxLines: 2 },
      description: { y: 1150, height: 90, maxSize: 28, minSize: 18, maxLines: 2 },
    });
    return model.build();
  },
});
