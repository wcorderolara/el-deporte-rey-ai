/**
 * PD-ARCH-01G-E.1: team badges in the badge slots of the engine match templates (Previa de partido, Partido
 * programado, Resultado de partido; PD-28, decisions DE-E3 and DE-E4). Synthetic badges and teams only.
 *
 * Covered: the home and away badge in their own slots, drawn from their files; badges chosen by the teams' local
 * identity, never by a name; a team without a badge (its slot empty, its name kept); both teams without a badge (the
 * same image as the version without badges); a half transparent PNG; badges of other aspect ratios and a JPEG, scaled
 * to fit without distortion or cropping; slots inside the canvas without overlapping any text; byte-identical output
 * for the same input; the slides of projects without engine badges rendered exactly as before 01G-E.1 (hashes taken
 * from commit 7a4c9f1); stored render models of that time still read, and inconsistent badge slots refused; a badge
 * whose file is missing or altered is never drawn.
 */
import { createHash } from 'node:crypto';

import { renderAsync } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';

import { jpeg, png } from '../brand/test/images.js';
import { engineSlideBadges } from '../visual-templates/project.js';

import { type RenderDeps, buildRenderModel, renderContent } from './core.js';
import { type BadgeSlotElement, type RenderModel, RenderModelSchema } from './render-model.js';
import { type EmbeddedAsset, RenderError, pngSize, renderSlide } from './renderer.js';
import type { SlideContent, SlideTeamBadge } from './slide-content.js';
import { fixtureTemplateV1 } from './templates/fixture.js';
import { matchPreviewTemplateV1 } from './templates/match-preview.js';
import { matchResultTemplate, matchResultTemplateV1 } from './templates/match-result.js';
import { TemplateRegistry } from './templates/registry.js';
import { MATCH_A, PALETTE, content, fixtureText, matchText, testFonts, testSettings, uuid } from './test/support.js';

const fonts = testFonts();

function deps(badgeFiles: readonly EmbeddedAsset[] = []): RenderDeps {
  return { registry: new TemplateRegistry(), fonts, settings: testSettings(), assets: [], badgeFiles };
}

const RED = [200, 30, 40] as const;
const BLUE = [20, 40, 160] as const;

function rgb(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}
const BACKGROUND = rgb(PALETTE.primaryDark);

/** A badge file (bytes with their hash), as the snapshot loader gives it. */
function badgeFile(n: number, image: Buffer, mime: 'image/png' | 'image/jpeg' = 'image/png'): EmbeddedAsset {
  return { id: uuid(n), sha256: createHash('sha256').update(image).digest('hex'), mime, content: image };
}

function side(teamId: string | null, file: EmbeddedAsset | null): SlideTeamBadge {
  return { teamId, badge: file === null ? null : { id: file.id, sha256: file.sha256, mime: file.mime } };
}

function withBadges(slide: SlideContent, home: SlideTeamBadge, away: SlideTeamBadge): SlideContent {
  return { ...slide, badges: { home, away } };
}

function slots(model: RenderModel): BadgeSlotElement[] {
  return model.elements.filter((element): element is BadgeSlotElement => element.kind === 'badge_slot');
}

function slotOf(model: RenderModel, id: 'team-badge-home' | 'team-badge-away'): BadgeSlotElement {
  const slot = slots(model).find((element) => element.id === id);
  if (slot === undefined) {
    throw new Error(`no badge slot ${id}`);
  }
  return slot;
}

function centre(slot: BadgeSlotElement): [number, number] {
  return [Math.round(slot.box.x + slot.box.width / 2), Math.round(slot.box.y + slot.box.height / 2)];
}

/** The RGB of each pixel of a PNG, decoded by resvg. */
async function pixelsOf(image: Buffer): Promise<(x: number, y: number) => number[]> {
  const size = pngSize(image) ?? { width: 1, height: 1 };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(size.width)}" ` +
    `height="${String(size.height)}"><image width="${String(size.width)}" height="${String(size.height)}" ` +
    `xlink:href="data:image/png;base64,${image.toString('base64')}"/></svg>`;
  const pixels = (await renderAsync(svg, { font: { loadSystemFonts: false } })).pixels;
  return (x, y) => [...pixels.subarray((y * size.width + x) * 4, (y * size.width + x) * 4 + 3)];
}

/** The three engine match templates with a sample slide each. */
const MATCH_SLIDES: readonly SlideContent[] = [
  content('match_result', matchText(MATCH_A)),
  content('fixture', fixtureText(MATCH_A, 'fixture')),
  content('match_preview', fixtureText(MATCH_A, 'match_preview')),
];

const HOME_TEAM = uuid(501);
const AWAY_TEAM = uuid(502);
const red = badgeFile(901, png({ width: 64, height: 64, rgba: [...RED, 255] }));
const blue = badgeFile(902, png({ width: 64, height: 64, rgba: [...BLUE, 255] }));

describe('badges in the engine match templates (PD-ARCH-01G-E.1)', () => {
  it('draws the home and the away badge in their own slots, from their files, in the three templates', async () => {
    for (const slide of MATCH_SLIDES) {
      const render = await renderContent(
        withBadges(slide, side(HOME_TEAM, red), side(AWAY_TEAM, blue)),
        deps([red, blue]),
        '/t',
      );
      expect(render.templateVersion, slide.slideType).toBe('1.1.0');
      const home = slotOf(render.renderModel, 'team-badge-home');
      const away = slotOf(render.renderModel, 'team-badge-away');
      expect(home).toMatchObject({
        empty: false,
        team: { teamId: HOME_TEAM, badge: { assetId: red.id, sha256: red.sha256, mime: 'image/png' } },
      });
      expect(away).toMatchObject({
        empty: false,
        team: { teamId: AWAY_TEAM, badge: { assetId: blue.id, sha256: blue.sha256, mime: 'image/png' } },
      });
      const pixel = await pixelsOf(render.png);
      expect(pixel(...centre(home)), slide.slideType).toEqual([...RED]);
      expect(pixel(...centre(away)), slide.slideType).toEqual([...BLUE]);
    }
  });

  it('chooses each badge by the team identity, never by the name: teams with almost the same name keep their own', async () => {
    const similar = content(
      'match_result',
      matchText({ ...MATCH_A, home: 'Club Atlético Ñandú', away: 'Club Atletico Ñandu' }),
    );
    const projectBadges = {
      engineSlots: true,
      teams: new Map([
        [HOME_TEAM, { id: red.id, sha256: red.sha256, mime: red.mime }],
        [AWAY_TEAM, { id: blue.id, sha256: blue.sha256, mime: blue.mime }],
      ]),
      files: [red, blue],
    };
    // The slide's teams decide, whatever the names: here the away team is the one with the red badge.
    const swapped = engineSlideBadges(projectBadges, { home: AWAY_TEAM, away: HOME_TEAM });
    expect(swapped).toEqual({ home: side(AWAY_TEAM, blue), away: side(HOME_TEAM, red) });
    const render = await renderContent(
      { ...similar, ...(swapped === undefined ? {} : { badges: swapped }) },
      deps([red, blue]),
      '/t',
    );
    const pixel = await pixelsOf(render.png);
    expect(pixel(...centre(slotOf(render.renderModel, 'team-badge-home')))).toEqual([...BLUE]);
    expect(pixel(...centre(slotOf(render.renderModel, 'team-badge-away')))).toEqual([...RED]);
    // An unidentified team or a team outside the snapshot has no badge; a project without engine badges has none.
    expect(engineSlideBadges(projectBadges, { home: null, away: uuid(777) })).toEqual({
      home: side(null, null),
      away: side(uuid(777), null),
    });
    expect(engineSlideBadges({ ...projectBadges, engineSlots: false }, { home: HOME_TEAM, away: AWAY_TEAM })).toBe(
      undefined,
    );
  });

  it('leaves the slot of a team without a badge empty, with nothing substituted, and keeps its name', async () => {
    for (const slide of MATCH_SLIDES) {
      const render = await renderContent(
        withBadges(slide, side(HOME_TEAM, red), side(AWAY_TEAM, null)),
        deps([red]),
        '/t',
      );
      const away = slotOf(render.renderModel, 'team-badge-away');
      expect(away).toEqual({ ...away, empty: true, team: { teamId: AWAY_TEAM, badge: null } });
      const name = render.renderModel.elements.find((element) => element.id === 'team-away');
      expect(name?.kind === 'text' ? name.text : null).toBe(MATCH_A.away);
      const pixel = await pixelsOf(render.png);
      expect(pixel(...centre(slotOf(render.renderModel, 'team-badge-home')))).toEqual([...RED]);
      expect(pixel(...centre(away)), slide.slideType).toEqual(BACKGROUND);
    }
  });

  it('with no badge for either team draws the same image as the version without badges', async () => {
    for (const slide of MATCH_SLIDES) {
      const none = await renderContent(withBadges(slide, side(HOME_TEAM, null), side(null, null)), deps(), '/t');
      expect(none.templateVersion).toBe('1.1.0');
      expect(slots(none.renderModel).map((slot) => [slot.id, slot.empty, slot.team])).toEqual([
        ['team-badge-home', true, { teamId: HOME_TEAM, badge: null }],
        ['team-badge-away', true, { teamId: null, badge: null }],
      ]);
      const before = await renderContent(slide, deps(), '/t');
      expect(before.templateVersion).toBe('1.0.0');
      // The layout of 1.1.0 is the one of 1.0.0: only a badge changes the image.
      expect(none.sha256, slide.slideType).toBe(before.sha256);
    }
  });

  it('keeps the transparency of a PNG badge', async () => {
    const half = badgeFile(903, png({ width: 64, height: 64, rgba: [255, 255, 255, 128] }));
    const render = await renderContent(
      withBadges(MATCH_SLIDES[0] as SlideContent, side(HOME_TEAM, half), side(AWAY_TEAM, null)),
      deps([half]),
      '/t',
    );
    const value = (await pixelsOf(render.png))(...centre(slotOf(render.renderModel, 'team-badge-home')));
    // Half white over the background: lighter than the background, darker than white.
    for (const [index, channel] of value.entries()) {
      expect(channel).toBeGreaterThan(BACKGROUND[index] ?? 0);
      expect(channel).toBeLessThan(255);
    }
  });

  it('scales badges of other aspect ratios, and a JPEG, to fit their slot without distortion or cropping', async () => {
    const wide = badgeFile(904, png({ width: 200, height: 50, rgba: [...RED, 255] }));
    const tall = badgeFile(905, png({ width: 50, height: 200, rgba: [...BLUE, 255] }));
    const render = await renderContent(
      withBadges(MATCH_SLIDES[0] as SlideContent, side(HOME_TEAM, wide), side(AWAY_TEAM, tall)),
      deps([wide, tall]),
      '/t',
    );
    const pixel = await pixelsOf(render.png);
    const home = slotOf(render.renderModel, 'team-badge-home');
    const away = slotOf(render.renderModel, 'team-badge-away');
    const [hx, hy] = centre(home);
    const [ax, ay] = centre(away);
    // A 4:1 badge fills the slot's width and a quarter of its height, centred; nothing outside the slot.
    expect(pixel(hx, hy)).toEqual([...RED]);
    expect(pixel(home.box.x + 3, hy)).toEqual([...RED]);
    expect(pixel(home.box.x + home.box.width - 3, hy)).toEqual([...RED]);
    expect(pixel(hx, home.box.y + 10)).toEqual(BACKGROUND);
    expect(pixel(hx, home.box.y + home.box.height - 10)).toEqual(BACKGROUND);
    expect(pixel(home.box.x - 3, hy)).toEqual(BACKGROUND);
    // A 1:4 badge fills the slot's height and a quarter of its width.
    expect(pixel(ax, ay)).toEqual([...BLUE]);
    expect(pixel(ax, away.box.y + 3)).toEqual([...BLUE]);
    expect(pixel(ax, away.box.y + away.box.height - 3)).toEqual([...BLUE]);
    expect(pixel(away.box.x + 10, ay)).toEqual(BACKGROUND);
    expect(pixel(away.box.x + away.box.width - 10, ay)).toEqual(BACKGROUND);
    expect(pixel(ax, away.box.y - 3)).toEqual(BACKGROUND);

    const grey = badgeFile(906, jpeg({ width: 32, height: 32 }), 'image/jpeg');
    const withJpeg = await renderContent(
      withBadges(MATCH_SLIDES[1] as SlideContent, side(HOME_TEAM, grey), side(AWAY_TEAM, null)),
      deps([grey]),
      '/t',
    );
    expect(slotOf(withJpeg.renderModel, 'team-badge-home').team?.badge?.mime).toBe('image/jpeg');
    const greyPixel = (await pixelsOf(withJpeg.png))(...centre(slotOf(withJpeg.renderModel, 'team-badge-home')));
    expect(greyPixel).not.toEqual(BACKGROUND);
    expect(Math.max(...greyPixel) - Math.min(...greyPixel)).toBeLessThanOrEqual(2);
  });

  it('keeps every badge slot inside the canvas, clear of the margins, and never over a text', () => {
    for (const slide of MATCH_SLIDES) {
      const model = buildRenderModel(withBadges(slide, side(HOME_TEAM, red), side(AWAY_TEAM, blue)), deps([red, blue]));
      const texts = model.elements.filter((element) => element.kind === 'text');
      for (const slot of slots(model)) {
        const { x, y, width, height } = slot.box;
        expect(x).toBeGreaterThanOrEqual(40);
        expect(x + width).toBeLessThanOrEqual(model.canvas.width - 40);
        expect(y).toBeGreaterThanOrEqual(200);
        expect(y + height).toBeLessThanOrEqual(model.canvas.height - 40);
        for (const text of texts) {
          const apart =
            x + width <= text.box.x ||
            text.box.x + text.box.width <= x ||
            y + height <= text.box.y ||
            text.box.y + text.box.height <= y;
          expect(apart, `${slide.slideType} ${slot.id} / ${text.id}`).toBe(true);
        }
      }
    }
  });

  it('gives a byte-identical PNG for the same badges (R-213)', async () => {
    const slide = withBadges(MATCH_SLIDES[2] as SlideContent, side(HOME_TEAM, red), side(AWAY_TEAM, blue));
    const first = await renderContent(slide, deps([red, blue]), '/t');
    const second = await renderContent(slide, deps([red, blue]), '/t');
    expect(second.sha256).toBe(first.sha256);
    expect(second.renderModel).toEqual(first.renderModel);
  });

  it('never draws a badge whose file is missing or does not match its hash, and substitutes nothing', async () => {
    const model = buildRenderModel(
      withBadges(MATCH_SLIDES[0] as SlideContent, side(HOME_TEAM, red), side(AWAY_TEAM, null)),
      deps([red]),
    );
    await expect(renderSlide(model, { fonts, assets: new Map() })).rejects.toThrow(RenderError);
    const altered = { ...red, content: png({ width: 64, height: 64, rgba: [0, 200, 0, 255] }) };
    await expect(renderSlide(model, { fonts, assets: new Map([[red.id, altered]]) })).rejects.toThrow(
      'an image slot has no matching asset',
    );
  });
});

describe('projects without engine badges render as before PD-ARCH-01G-E.1 (decision DE-E3)', () => {
  // PNG and render-model hashes of these slides rendered by commit 7a4c9f1 (before 01G-E.1), with the same fonts.
  const BEFORE: readonly [SlideContent, string, string][] = [
    [
      content('match_result', matchText(MATCH_A)),
      'cdff3d8e8aab40839a565e279ac66db3a88a8c04c4c895e04d614a547e72e463',
      'da51154b6739c130400b8feec4db1a930fe0632e243dda613e7926c11d3e996a',
    ],
    [
      content('fixture', fixtureText(MATCH_A, 'fixture', 'postponed')),
      '07a85c41a73fc06d8777bf5976d82d6b72ac1ca821425415a89d941612efa811',
      'ff6717d49d72e4755dd6aa64b40b6c38274e7aee7e540c32d75754d486170de8',
    ],
    [
      content('match_preview', fixtureText(MATCH_A, 'match_preview')),
      '77d1cc17e8883659b330a149a11892d3d9da82526f2f59b65725e781bbc9212a',
      '438d883c946fbb44bfae9ceae971e007dc309dc544100129c8def469ebf35199',
    ],
    [
      content('fixture', fixtureText(MATCH_A, 'fixture')),
      'fe78a18611799a2ce0387f0509b9b2134535dfc8172430eadbe5b8a8e387ac23',
      'd4a9d2fe61091091eeee9c91853a8b4a0383308935101c87aa55ea6efa666ebf',
    ],
  ];

  it('uses version 1.0.0 and gives the same render model and the same PNG, byte for byte', async () => {
    for (const [slide, pngHash, modelHash] of BEFORE) {
      const render = await renderContent(slide, deps(), '/t');
      expect(render.templateVersion, slide.slideType).toBe('1.0.0');
      expect(render.sha256, slide.slideType).toBe(pngHash);
      expect(createHash('sha256').update(JSON.stringify(render.renderModel)).digest('hex'), slide.slideType).toBe(
        modelHash,
      );
      expect(slots(render.renderModel).every((slot) => slot.empty && slot.team === undefined)).toBe(true);
    }
  });

  it('version 1.0.0 leaves its slots empty even when given badges', () => {
    for (const template of [matchResultTemplateV1, fixtureTemplateV1, matchPreviewTemplateV1]) {
      const slide = MATCH_SLIDES.find((candidate) => candidate.slideType === template.slideType) as SlideContent;
      const model = new TemplateRegistry([template])
        .current(template.slideType)
        .build(withBadges(slide, side(HOME_TEAM, red), side(AWAY_TEAM, blue)), {
          canvas: testSettings().canvas,
          palette: { ...PALETTE },
          fonts,
          assets: {},
          utcOffsetMinutes: -360,
        });
      expect(slots(model).map((slot) => [slot.empty, slot.team])).toEqual([
        [true, undefined],
        [true, undefined],
      ]);
    }
  });

  it('reads the render models stored before 01G-E.1 and refuses inconsistent badge slots', () => {
    const stored = JSON.parse(JSON.stringify(buildRenderModel(MATCH_SLIDES[0] as SlideContent, deps()))) as RenderModel;
    expect(stored.templateVersion).toBe('1.0.0');
    expect(RenderModelSchema.parse(stored)).toEqual(stored);
    const current = buildRenderModel(
      withBadges(MATCH_SLIDES[0] as SlideContent, side(HOME_TEAM, red), side(AWAY_TEAM, null)),
      deps([red]),
    );
    expect(current.templateVersion).toBe(matchResultTemplate.version);
    expect(RenderModelSchema.parse(JSON.parse(JSON.stringify(current)))).toEqual(current);
    const badge = { assetId: red.id, sha256: red.sha256, mime: 'image/png' };
    const variants = [
      { empty: false },
      { empty: true, team: { teamId: HOME_TEAM, badge } },
      { empty: false, team: { teamId: HOME_TEAM, badge: null } },
      { empty: false, team: { teamId: null, badge } },
      { empty: false, team: { teamId: HOME_TEAM, badge: { ...badge, mime: 'image/svg+xml' } } },
    ];
    for (const variant of variants) {
      const elements = current.elements.map((element) =>
        element.kind === 'badge_slot' && element.id === 'team-badge-home'
          ? { kind: element.kind, id: element.id, slot: element.slot, box: element.box, ...variant }
          : element,
      );
      expect(RenderModelSchema.safeParse({ ...current, elements }).success, JSON.stringify(variant)).toBe(false);
    }
  });
});
