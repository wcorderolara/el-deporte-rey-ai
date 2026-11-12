/**
 * PD-ARCH-01G-E.2: round calendars as rows with the team badges (round calendar template 2.0.0; PD-28, decisions
 * DE-E3 to DE-E6). Synthetic badges and teams only.
 *
 * Covered: one row per match with the home and away badge in their own slots, drawn from their files; badges chosen by
 * each row's team identity, never by a name; a team without a badge (its slot empty, its name kept); the date, the time
 * and the status of a match that is not scheduled; six rows with long names fit without overflow or overlap, above
 * the headline; a seventh row is flagged, never dropped; a half transparent PNG, a JPEG and badges of other aspect
 * ratios scaled to fit; byte-identical output; projects whose snapshot does not cover the calendar rows keep version
 * 1.0.0, byte for byte as commit 7a4c9f1 drew it; stored models read, inconsistent rows refused; a badge whose file is
 * missing or altered is never drawn.
 */
import { createHash } from 'node:crypto';

import { renderAsync } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';

import { jpeg, png } from '../brand/test/images.js';
import { engineRowBadges } from '../visual-templates/project.js';

import { type RenderDeps, buildRenderModel, renderContent } from './core.js';
import { type BadgeSlotElement, type RenderModel, RenderModelSchema, type TextElement } from './render-model.js';
import { type EmbeddedAsset, RenderError, pngSize, renderSlide } from './renderer.js';
import type { SlideContent, SlideTeamBadge } from './slide-content.js';
import { CALENDAR_ROWS, fixtureRowsOf } from './templates/round-overview.js';
import { TemplateRegistry } from './templates/registry.js';
import {
  MATCH_A,
  type MatchSample,
  PALETTE,
  calendarRowsText,
  content,
  overviewText,
  testFonts,
  testSettings,
  uuid,
} from './test/support.js';
import { segmentsOf } from './slide-content.js';
import { CALENDAR_ROWS_PER_SLIDE } from '../content/structure.js';

const fonts = testFonts();

function deps(badgeFiles: readonly EmbeddedAsset[] = []): RenderDeps {
  return { registry: new TemplateRegistry(), fonts, settings: testSettings(), assets: [], badgeFiles };
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}
const BAND = rgb(PALETTE.primary);
const RED = [200, 30, 40] as const;
const BLUE = [20, 40, 160] as const;

function badgeFile(n: number, image: Buffer, mime: 'image/png' | 'image/jpeg' = 'image/png'): EmbeddedAsset {
  return { id: uuid(n), sha256: createHash('sha256').update(image).digest('hex'), mime, content: image };
}

function side(teamId: string | null, file: EmbeddedAsset | null): SlideTeamBadge {
  return { teamId, badge: file === null ? null : { id: file.id, sha256: file.sha256, mime: file.mime } };
}

function slots(model: RenderModel): BadgeSlotElement[] {
  return model.elements.filter((element): element is BadgeSlotElement => element.kind === 'badge_slot');
}

function texts(model: RenderModel): TextElement[] {
  return model.elements.filter((element): element is TextElement => element.kind === 'text');
}

function element(model: RenderModel, id: string): BadgeSlotElement | TextElement {
  const found = model.elements.find((candidate) => candidate.id === id);
  if (found === undefined || (found.kind !== 'badge_slot' && found.kind !== 'text')) {
    throw new Error(`no element ${id}`);
  }
  return found;
}

function centre(box: { x: number; y: number; width: number; height: number }): [number, number] {
  return [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
}

async function pixelsOf(image: Buffer): Promise<(x: number, y: number) => number[]> {
  const size = pngSize(image) ?? { width: 1, height: 1 };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(size.width)}" ` +
    `height="${String(size.height)}"><image width="${String(size.width)}" height="${String(size.height)}" ` +
    `xlink:href="data:image/png;base64,${image.toString('base64')}"/></svg>`;
  const pixels = (await renderAsync(svg, { font: { loadSystemFonts: false } })).pixels;
  return (x, y) => [...pixels.subarray((y * size.width + x) * 4, (y * size.width + x) * 4 + 3)];
}

/** Six matches with long and almost equal names. */
const NAMES: readonly (readonly [string, string])[] = [
  ['Real Sociedad Deportiva Ejemplo', 'Club Atlético Ñandú'],
  ['Deportivo Árbol Sintético', 'Unión Deportiva Muestra del Norte'],
  ['CD Ejemplo', 'Peñas Sur'],
  ['Atlético Muestra', 'Real Brisamar'],
  ['Sporting Club Modelo de la Costa', 'Racing Ejemplo'],
  ['Club Deportivo Ejemplo B', 'Club Deportivo Ejemplo'],
];
const MATCHES: readonly MatchSample[] = NAMES.map(([home, away], index) => ({
  ...MATCH_A,
  home,
  away,
  factBase: 100 + index * 10,
  kickoff: `2026-10-2${String(4 + (index % 3))}T${String(14 + index)}:30:00Z`,
}));
const teamOf = (row: number, home: boolean) => uuid(500 + row * 2 + (home ? 0 : 1));

const red = badgeFile(901, png({ width: 64, height: 64, rgba: [...RED, 255] }));
const blue = badgeFile(902, png({ width: 64, height: 64, rgba: [...BLUE, 255] }));

/** Every row with the red badge at home and the blue badge away. */
function rowsWith(
  count: number,
  home: EmbeddedAsset | null = red,
  away: EmbeddedAsset | null = blue,
): SlideContent['rowBadges'] {
  return Array.from({ length: count }, (_, row) => ({
    home: side(teamOf(row, true), home),
    away: side(teamOf(row, false), away),
  }));
}

function calendar(
  count = CALENDAR_ROWS,
  rowBadges: SlideContent['rowBadges'] = rowsWith(count),
  statuses: Parameters<typeof calendarRowsText>[1] = {},
): SlideContent {
  const slide = content('round_overview', calendarRowsText(MATCHES.slice(0, count), statuses));
  return rowBadges === undefined ? slide : { ...slide, rowBadges };
}

describe('round calendar rows with badges (PD-ARCH-01G-E.2)', () => {
  it('holds as many rows as the content stage puts on a page (DE-E5: six)', () => {
    expect(CALENDAR_ROWS).toBe(6);
    expect(CALENDAR_ROWS_PER_SLIDE).toBe(CALENDAR_ROWS);
  });

  it('draws one row per match, with the home and away badge of each row in its own slot, from their files', async () => {
    const render = await renderContent(calendar(), deps([red, blue]), '/t');
    expect(render.templateVersion).toBe('2.0.0');
    const model = render.renderModel;
    expect(slots(model)).toHaveLength(2 * CALENDAR_ROWS);
    const pixel = await pixelsOf(render.png);
    for (let row = 1; row <= CALENDAR_ROWS; row += 1) {
      const home = element(model, `row-${String(row)}-badge-home`) as BadgeSlotElement;
      const away = element(model, `row-${String(row)}-badge-away`) as BadgeSlotElement;
      expect(home).toMatchObject({
        slot: 'team-badge-home',
        row,
        empty: false,
        team: { teamId: teamOf(row - 1, true), badge: { assetId: red.id, sha256: red.sha256, mime: 'image/png' } },
      });
      expect(away).toMatchObject({ slot: 'team-badge-away', row, team: { teamId: teamOf(row - 1, false) } });
      expect(pixel(...centre(home.box))).toEqual([...RED]);
      expect(pixel(...centre(away.box))).toEqual([...BLUE]);
      // The names are the official names of the row's facts, home on the left of the badge-free middle.
      const match = MATCHES[row - 1] as MatchSample;
      expect(element(model, `row-${String(row)}-home`)).toMatchObject({
        semantic: 'team_name',
        text: match.home,
        factIds: [uuid(match.factBase + 1)],
      });
      expect(element(model, `row-${String(row)}-away`)).toMatchObject({
        semantic: 'team_name',
        text: match.away,
        factIds: [uuid(match.factBase + 2)],
      });
    }
  });

  it('chooses each badge by the row team identity, never by the name: similar names keep their own badge', async () => {
    const badges = {
      engineSlots: true,
      calendarRows: true,
      teams: new Map([
        [teamOf(5, true), { id: red.id, sha256: red.sha256, mime: red.mime }],
        [teamOf(5, false), { id: blue.id, sha256: blue.sha256, mime: blue.mime }],
      ]),
      files: [red, blue],
    };
    // Row 6 is "Club Deportivo Ejemplo B" against "Club Deportivo Ejemplo"; the teams decide, here swapped.
    const rows = engineRowBadges(badges, {
      home: null,
      away: null,
      rows: [{ home: teamOf(5, false), away: teamOf(5, true) }],
    });
    expect(rows).toEqual([{ home: side(teamOf(5, false), blue), away: side(teamOf(5, true), red) }]);
    const slide = { ...content('round_overview', calendarRowsText([MATCHES[5] as MatchSample])), rowBadges: rows };
    const render = await renderContent(slide, deps([red, blue]), '/t');
    const pixel = await pixelsOf(render.png);
    expect(pixel(...centre(element(render.renderModel, 'row-1-badge-home').box))).toEqual([...BLUE]);
    expect(pixel(...centre(element(render.renderModel, 'row-1-badge-away').box))).toEqual([...RED]);
    // No rows without calendar rows in the snapshot (versions 1 and 2), nor without a fixtures field.
    expect(engineRowBadges({ ...badges, calendarRows: false }, { home: null, away: null, rows: [] })).toBeUndefined();
    expect(engineRowBadges(badges, { home: null, away: null })).toBeUndefined();
  });

  it('leaves the slot of a team without a badge empty, substitutes nothing and keeps the name', async () => {
    const rowBadges = rowsWith(CALENDAR_ROWS);
    const withGap = rowBadges?.map((row, index) => (index === 2 ? { ...row, home: side(teamOf(2, true), null) } : row));
    const render = await renderContent(calendar(CALENDAR_ROWS, withGap), deps([red, blue]), '/t');
    const empty = element(render.renderModel, 'row-3-badge-home') as BadgeSlotElement;
    expect(empty).toMatchObject({ empty: true, row: 3, team: { teamId: teamOf(2, true), badge: null } });
    expect((element(render.renderModel, 'row-3-home') as TextElement).text).toBe('CD Ejemplo');
    const pixel = await pixelsOf(render.png);
    expect(pixel(...centre(empty.box))).toEqual(BAND);
    expect(pixel(...centre(element(render.renderModel, 'row-3-badge-away').box))).toEqual([...BLUE]);
  });

  it('shows the date and time of every row, and the status only for a match that is not scheduled', () => {
    const model = buildRenderModel(calendar(CALENDAR_ROWS, rowsWith(CALENDAR_ROWS), { 1: 'postponed' }), deps());
    const match = MATCHES[1] as MatchSample;
    expect(element(model, 'row-2-date')).toMatchObject({ semantic: 'kickoff', factIds: [uuid(match.factBase + 4)] });
    expect(element(model, 'row-2-time')).toMatchObject({
      semantic: 'kickoff_time',
      text: '09:30',
      factIds: [uuid(match.factBase + 4)],
    });
    expect(element(model, 'row-2-status')).toMatchObject({
      semantic: 'match_status',
      text: 'Aplazado',
      factIds: [uuid(match.factBase + 5)],
    });
    expect(
      model.elements.filter((candidate) => candidate.id.endsWith('-status')).map((candidate) => candidate.id),
    ).toEqual(['row-2-status']);
  });

  it('fits six rows with long names: no overflow, inside the canvas, no overlap, above the headline', () => {
    const model = buildRenderModel(calendar(CALENDAR_ROWS, rowsWith(CALENDAR_ROWS), { 1: 'suspended' }), deps());
    const rowsOnly = model.elements.filter(
      (candidate) => candidate.id.startsWith('row-') && !candidate.id.endsWith('-band'),
    );
    expect(texts(model).filter((text) => text.overflow)).toEqual([]);
    const headline = element(model, 'headline');
    for (const [index, first] of rowsOnly.entries()) {
      const { x, y, width, height } = first.box;
      expect(x).toBeGreaterThanOrEqual(30);
      expect(x + width).toBeLessThanOrEqual(model.canvas.width - 30);
      expect(y + height).toBeLessThanOrEqual(headline.box.y);
      for (const second of rowsOnly.slice(index + 1)) {
        const apart =
          x + width <= second.box.x ||
          second.box.x + second.box.width <= x ||
          y + height <= second.box.y ||
          second.box.y + second.box.height <= y;
        expect(apart, `${first.id} / ${second.id}`).toBe(true);
      }
    }
  });

  it('flags a row beyond the six (text fit), never drops it', () => {
    const seventh: MatchSample = { ...MATCH_A, home: 'Equipo Siete', away: 'Equipo Ocho', factBase: 300 };
    const slide = {
      ...content('round_overview', calendarRowsText([...MATCHES, seventh])),
      rowBadges: rowsWith(CALENDAR_ROWS + 1),
    };
    const model = buildRenderModel(slide, deps());
    expect((element(model, 'row-7-home') as TextElement).overflow).toBe(true);
    expect(model.elements.some((candidate) => candidate.id === 'row-7-badge-home')).toBe(false);
  });

  it('keeps the transparency of a PNG badge and scales a JPEG and badges of other aspect ratios to fit', async () => {
    const half = badgeFile(903, png({ width: 64, height: 64, rgba: [255, 255, 255, 128] }));
    const wide = badgeFile(904, png({ width: 200, height: 50, rgba: [...RED, 255] }));
    const tall = badgeFile(905, png({ width: 50, height: 200, rgba: [...BLUE, 255] }));
    const grey = badgeFile(906, jpeg({ width: 32, height: 32 }), 'image/jpeg');
    const rowBadges = [
      { home: side(teamOf(0, true), half), away: side(teamOf(0, false), grey) },
      { home: side(teamOf(1, true), wide), away: side(teamOf(1, false), tall) },
    ];
    const render = await renderContent(calendar(2, rowBadges), deps([half, wide, tall, grey]), '/t');
    const pixel = await pixelsOf(render.png);
    const model = render.renderModel;
    const halfValue = pixel(...centre(element(model, 'row-1-badge-home').box));
    for (const [index, channel] of halfValue.entries()) {
      expect(channel).toBeGreaterThan(BAND[index] ?? 0);
      expect(channel).toBeLessThan(255);
    }
    const greyValue = pixel(...centre(element(model, 'row-1-badge-away').box));
    expect(greyValue).not.toEqual(BAND);
    expect(Math.max(...greyValue) - Math.min(...greyValue)).toBeLessThanOrEqual(2);
    // A 4:1 badge fills the slot's width and a quarter of its height; a 1:4 badge its height and a quarter of its width.
    const home = element(model, 'row-2-badge-home').box;
    const [hx, hy] = centre(home);
    expect(pixel(home.x + 3, hy)).toEqual([...RED]);
    expect(pixel(home.x + home.width - 3, hy)).toEqual([...RED]);
    expect(pixel(hx, home.y + 8)).toEqual(BAND);
    const away = element(model, 'row-2-badge-away').box;
    const [ax, ay] = centre(away);
    expect(pixel(ax, away.y + 3)).toEqual([...BLUE]);
    expect(pixel(away.x + 8, ay)).toEqual(BAND);
  });

  it('gives a byte-identical PNG for the same rows (R-213)', async () => {
    const first = await renderContent(calendar(), deps([red, blue]), '/t');
    const second = await renderContent(calendar(), deps([red, blue]), '/t');
    expect(second.sha256).toBe(first.sha256);
    expect(second.renderModel).toEqual(first.renderModel);
  });

  it('never draws a badge whose file is missing or does not match its hash', async () => {
    const model = buildRenderModel(calendar(1, rowsWith(1, red, null)), deps([red]));
    await expect(renderSlide(model, { fonts, assets: new Map() })).rejects.toThrow(RenderError);
    const altered = { ...red, content: png({ width: 64, height: 64, rgba: [0, 200, 0, 255] }) };
    await expect(renderSlide(model, { fonts, assets: new Map([[red.id, altered]]) })).rejects.toThrow(
      'an image slot has no matching asset',
    );
  });

  it('reads the row values in the order the content stage writes them', () => {
    const rows = fixtureRowsOf(segmentsOf(calendarRowsText(MATCHES.slice(0, 2), { 0: 'postponed' }), 'fixtures'));
    expect(rows.map((row) => [row.home?.text, row.away?.text, row.time?.text, row.status?.text ?? null])).toEqual([
      [MATCHES[0]?.home, MATCHES[0]?.away, '08:30', 'Aplazado'],
      [MATCHES[1]?.home, MATCHES[1]?.away, '09:30', null],
    ]);
  });
});

describe('calendars of projects whose snapshot does not cover the rows (decision DE-E3)', () => {
  // PNG and render-model hashes of these slides rendered by commit 7a4c9f1 (before 01G-E), with the same fonts.
  const BEFORE: readonly [string, SlideContent, string, string][] = [
    [
      'two matches',
      content(
        'round_overview',
        overviewText([MATCH_A, { ...MATCH_A, home: 'Real Brisamar', away: 'Peñas Sur', factBase: 20 }]),
      ),
      'e96d39aeb78106bd40c2069eb1ad5685425c13eae68247a481ce69a6d3db90d9',
      '61d1e36106fdcd8d371466dea881ab226d53e0ee5f8edeb54ece404706f32b32',
    ],
    [
      'eight matches',
      content(
        'round_overview',
        overviewText(
          Array.from({ length: 8 }, (_, index) => ({
            ...MATCH_A,
            home: `Equipo Local ${String(index + 1)}`,
            away: `Equipo Visitante ${String(index + 1)}`,
            factBase: 100 + index * 10,
          })),
        ),
      ),
      '00d644939a5c75f6a2bf0c5cef60fb3e20f6fdcdf42af92cd922d76b6bfd0e39',
      'f52f0f75cfa2650677bc5ef6f08fe769e53a8a26849e1b8da152064ed2197e4a',
    ],
  ];

  it('uses version 1.0.0 and gives the same render model and the same PNG, byte for byte', async () => {
    for (const [name, slide, pngHash, modelHash] of BEFORE) {
      // A version 2 snapshot gives the match slides badges but no calendar rows: the calendar stays as it was.
      const v2 = { ...slide, badges: { home: side(null, null), away: side(null, null) } };
      for (const candidate of [slide, v2]) {
        const render = await renderContent(candidate, deps(), '/t');
        expect(render.templateVersion, name).toBe('1.0.0');
        expect(render.sha256, name).toBe(pngHash);
        expect(createHash('sha256').update(JSON.stringify(render.renderModel)).digest('hex'), name).toBe(modelHash);
      }
    }
  });

  it('reads stored models of both versions and refuses an inconsistent row slot', async () => {
    const before = await renderContent(BEFORE[0]?.[1] as SlideContent, deps(), '/t');
    expect(RenderModelSchema.parse(JSON.parse(JSON.stringify(before.renderModel)))).toEqual(before.renderModel);
    const rows = buildRenderModel(calendar(2), deps([red, blue]));
    expect(RenderModelSchema.parse(JSON.parse(JSON.stringify(rows)))).toEqual(rows);
    const broken = {
      ...rows,
      elements: rows.elements.map((candidate) =>
        candidate.kind === 'badge_slot' && candidate.id === 'row-1-badge-home' ? { ...candidate, row: 0 } : candidate,
      ),
    };
    expect(RenderModelSchema.safeParse(broken).success).toBe(false);
  });
});
