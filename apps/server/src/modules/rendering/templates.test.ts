/**
 * Templates and rendering core, acceptance criteria of T34 (architecture.md section 9):
 * R-238 (configured size, 1080 x 1350), R-212 and R-231 (complete slides without assets, empty badge slots),
 * R-213 (identical numeric text and identical PNG hash for the same input), exact official names, R-211 (shared
 * layout and palette across selections; a template version change applies to later renders), R-285 (complete carousel
 * without standings; standings with any number of rows), R-269 (demonstration band on DEMO_DATA slides only).
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { png } from '../brand/test/images.js';
import { StageFailure } from '../../workflow/index.js';

import { type RenderDeps, type SlideRender, type SlotAsset, buildRenderModel, renderContent } from './core.js';
import type { RenderModel, TextElement } from './render-model.js';
import { RenderError, pngSize } from './renderer.js';
import type { SlideContent } from './slide-content.js';
import type { TemplateDefinition } from './templates/common.js';
import { matchResultTemplate } from './templates/match-result.js';
import { BUILT_IN_TEMPLATES, TemplateRegistry, toContractTemplate } from './templates/registry.js';
import {
  MATCH_A,
  SELECTION_A,
  SELECTION_B,
  closingText,
  content,
  coverText,
  matchText,
  standingsRows,
  standingsText,
  testFonts,
  testSettings,
  uuid,
} from './test/support.js';

const fonts = testFonts();

function deps(overrides: Partial<RenderDeps> = {}): RenderDeps {
  return { registry: new TemplateRegistry(), fonts, settings: testSettings(), assets: [], ...overrides };
}

function texts(model: RenderModel): TextElement[] {
  return model.elements.filter((element): element is TextElement => element.kind === 'text');
}

function textOf(model: RenderModel, id: string): TextElement {
  const element = texts(model).find((candidate) => candidate.id === id);
  if (element === undefined) {
    throw new Error(`no text element ${id}`);
  }
  return element;
}

function asset(slot: SlotAsset['slot'], n: number, rgba: [number, number, number, number]): SlotAsset {
  const content = png({ width: 40, height: 30, rgba });
  return { slot, id: uuid(n), sha256: createHash('sha256').update(content).digest('hex'), mime: 'image/png', content };
}

const ALL_SLIDES: readonly SlideContent[] = [
  content('cover', coverText(SELECTION_A, '1/2')),
  content('match_result', matchText(MATCH_A)),
  content('standings', standingsText(standingsRows(12))),
  content('closing', closingText()),
];

describe('template registry (OD-13, R-031, R-050)', () => {
  it('lists the four built-in templates with versions, badge slots and image slots', () => {
    const list = new TemplateRegistry().list().map(toContractTemplate);
    expect(list.map((template) => [template.id, template.slideType, template.version])).toEqual([
      ['cover', 'cover', '1.0.0'],
      ['match-result', 'match_result', '1.0.0'],
      ['standings', 'standings', '1.0.0'],
      ['closing', 'closing', '1.0.0'],
    ]);
    expect(list.find((template) => template.id === 'match-result')?.badgeSlots).toBe(2);
    expect(list.find((template) => template.id === 'cover')?.imageSlots).toEqual(['brand_logo', 'mascot']);
  });

  it('refuses a duplicate template version', () => {
    expect(() => new TemplateRegistry([...BUILT_IN_TEMPLATES, matchResultTemplate])).toThrow(TypeError);
  });
});

describe('R-238: output at the configured size', () => {
  it('renders every template at 1080 x 1350 by default', async () => {
    for (const slide of ALL_SLIDES) {
      const render = await renderContent(slide, deps(), '/test');
      expect(pngSize(render.png)).toEqual({ width: 1080, height: 1350 });
      expect([render.width, render.height]).toEqual([1080, 1350]);
      expect(render.renderModel.canvas).toEqual({ width: 1080, height: 1350 });
    }
  });

  it('follows a configured format (OD-04: configurable)', async () => {
    const render = await renderContent(
      ALL_SLIDES[1] as SlideContent,
      deps({ settings: testSettings(1080, 1080) }),
      '/t',
    );
    expect(pngSize(render.png)).toEqual({ width: 1080, height: 1080 });
  });
});

describe('R-212, R-231: complete slides with no brand assets and empty badge slots', () => {
  it('draws every stored field without any asset, with no image element and no overflow', async () => {
    for (const slide of ALL_SLIDES) {
      const render = await renderContent(slide, deps(), '/test');
      const model = render.renderModel;
      expect(model.elements.some((element) => element.kind === 'image')).toBe(false);
      expect(render.renderModel.elements.filter((element) => element.kind === 'text' && element.overflow)).toEqual([]);
      for (const field of slide.text.fields) {
        expect(texts(model).some((element) => element.field === field.field)).toBe(true);
      }
    }
  });

  it('reserves two badge slots on match results, always empty, and draws nothing in them', async () => {
    const render = await renderContent(ALL_SLIDES[1] as SlideContent, deps(), '/test');
    const badges = render.renderModel.elements.filter((element) => element.kind === 'badge_slot');
    expect(badges.map((badge) => badge.id)).toEqual(['team-badge-home', 'team-badge-away']);
    expect(badges.every((badge) => badge.kind === 'badge_slot' && badge.empty)).toBe(true);
    // Same image with or without the badge slots: nothing is drawn there.
    const withoutBadges = {
      ...render.renderModel,
      elements: render.renderModel.elements.filter((e) => e.kind !== 'badge_slot'),
    };
    const { renderSlide } = await import('./renderer.js');
    const other = await renderSlide(withoutBadges, { fonts, assets: new Map() });
    expect(other.sha256).toBe(render.sha256);
  });

  it('draws the brand logo and mascot only when active assets exist, as data URIs', async () => {
    const logo = asset('brand_logo', 900, [212, 175, 55, 255]);
    const mascot = asset('mascot', 901, [31, 79, 184, 255]);
    const cover = await renderContent(ALL_SLIDES[0] as SlideContent, deps({ assets: [logo, mascot] }), '/t');
    const images = cover.renderModel.elements.filter((element) => element.kind === 'image');
    expect(images.map((image) => image.kind === 'image' && [image.slot, image.assetId, image.sha256])).toEqual([
      ['brand_logo', logo.id, logo.sha256],
      ['mascot', mascot.id, mascot.sha256],
    ]);
    const match = await renderContent(ALL_SLIDES[1] as SlideContent, deps({ assets: [logo, mascot] }), '/t');
    // The match-result template declares only the logo slot.
    expect(match.renderModel.elements.filter((element) => element.kind === 'image')).toHaveLength(1);
    const without = await renderContent(ALL_SLIDES[0] as SlideContent, deps(), '/t');
    expect(without.sha256).not.toBe(cover.sha256);
  });

  it('refuses an image element whose asset bytes do not match the recorded hash', async () => {
    const logo = asset('brand_logo', 900, [212, 175, 55, 255]);
    const altered = { ...logo, content: png({ width: 40, height: 30, rgba: [1, 2, 3, 255] }) };
    await expect(renderContent(ALL_SLIDES[0] as SlideContent, deps({ assets: [altered] }), '/t')).rejects.toThrow(
      RenderError,
    );
  });
});

describe('R-213: deterministic rendering', () => {
  it('gives identical numeric text and an identical PNG hash for two renders of the same input', async () => {
    const renders: SlideRender[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      renders.push(await renderContent(content('match_result', matchText(MATCH_A)), deps(), '/test'));
    }
    const [first, second] = renders as [SlideRender, SlideRender];
    expect(textOf(first.renderModel, 'score').text).toBe('2-1');
    expect(textOf(second.renderModel, 'score').lines).toEqual(textOf(first.renderModel, 'score').lines);
    expect(textOf(second.renderModel, 'kickoff').text).toBe(textOf(first.renderModel, 'kickoff').text);
    expect(second.renderModel).toEqual(first.renderModel);
    expect(second.sha256).toBe(first.sha256);
    expect(createHash('sha256').update(second.png).digest('hex')).toBe(first.sha256);
  });

  it('draws standings numbers exactly as stored', async () => {
    const rows = standingsRows(3);
    const render = await renderContent(content('standings', standingsText(rows)), deps(), '/test');
    const model = render.renderModel;
    rows.forEach((row, index) => {
      const n = String(index + 1);
      expect(textOf(model, `row-${n}-position`).text).toBe(String(row.cells[0]));
      for (let column = 1; column < 9; column += 1) {
        expect(textOf(model, `row-${n}-c${String(column)}`).text).toBe(String(row.cells[column]));
      }
    });
  });
});

describe('exact official names', () => {
  it('draws team names exactly as the stored fact segments, with their fact IDs', async () => {
    const model = (await renderContent(content('match_result', matchText(MATCH_A)), deps(), '/t')).renderModel;
    const home = textOf(model, 'team-home');
    const away = textOf(model, 'team-away');
    expect(home.text).toBe('Club Atlético Ñandú');
    expect(away.text).toBe('Deportivo Árbol Sintético');
    expect(home.lines.join(' ')).toBe(home.text);
    expect(away.lines.join(' ')).toBe(away.text);
    expect([home.semantic, home.provenance, home.factIds]).toEqual(['team_name', 'fact', [uuid(11)]]);
    expect(away.factIds).toEqual([uuid(12)]);
  });

  it('draws standings team names exactly as stored', async () => {
    const rows = standingsRows(4);
    const model = (await renderContent(content('standings', standingsText(rows)), deps(), '/t')).renderModel;
    rows.forEach((row, index) => {
      const team = textOf(model, `row-${String(index + 1)}-team`);
      expect(team.text).toBe(row.team);
      expect(team.semantic).toBe('team_name');
    });
  });
});

describe('R-211: shared layout and palette; template version changes apply to later renders', () => {
  it('uses the same template, palette, fonts and boxes for two different selections', async () => {
    for (const [slideType, a, b] of [
      ['cover', coverText(SELECTION_A), coverText(SELECTION_B)],
      [
        'match_result',
        matchText(MATCH_A),
        matchText({
          ...MATCH_A,
          home: 'Unión Ficticia',
          away: 'Racing Modelo',
          score: { home: 0, away: 0 },
          factBase: 40,
        }),
      ],
    ] as const) {
      const first = buildRenderModel(content(slideType, a), deps());
      const second = buildRenderModel(content(slideType, b), deps());
      expect([second.templateId, second.templateVersion]).toEqual([first.templateId, first.templateVersion]);
      expect(second.palette).toEqual(first.palette);
      expect(second.fonts).toEqual(first.fonts);
      expect(second.background).toEqual(first.background);
      const boxes = (model: RenderModel) => model.elements.map((element) => [element.id, element.kind, element.box]);
      expect(boxes(second)).toEqual(boxes(first));
      const colours = (model: RenderModel) =>
        model.elements.map((element) => ('colorRole' in element ? [element.id, element.colorRole] : [element.id]));
      expect(colours(second)).toEqual(colours(first));
    }
  });

  it('uses only palette colours and bundled fonts', () => {
    for (const slide of ALL_SLIDES) {
      const model = buildRenderModel({ ...slide, demonstration: true }, deps());
      const palette = new Set(Object.values(model.palette));
      for (const element of model.elements) {
        if (element.kind === 'text' || element.kind === 'rect') {
          expect(palette.has(element.color)).toBe(true);
          expect(model.palette[element.colorRole]).toBe(element.color);
        }
        if (element.kind === 'text') {
          expect(
            fonts.faces.some((face) => face.family === element.fontFamily && face.weight === element.fontWeight),
          ).toBe(true);
        }
      }
    }
  });

  it('renders later slides with a new template version and keeps the earlier render model unchanged', async () => {
    const before = await renderContent(content('match_result', matchText(MATCH_A)), deps(), '/t');
    const version2: TemplateDefinition = {
      ...matchResultTemplate,
      version: '1.1.0',
      build: (slide, ctx) => {
        const model = matchResultTemplate.build(slide, ctx);
        return { ...model, templateVersion: '1.1.0', background: { colorRole: 'primary', color: ctx.palette.primary } };
      },
    };
    const registry = new TemplateRegistry([...BUILT_IN_TEMPLATES, version2]);
    expect(registry.current('match_result').version).toBe('1.1.0');
    expect(registry.get('match-result', '1.0.0')).toBe(matchResultTemplate);
    const after = await renderContent(content('match_result', matchText(MATCH_A)), deps({ registry }), '/t');
    expect([before.templateVersion, after.templateVersion]).toEqual(['1.0.0', '1.1.0']);
    expect(before.renderModel.templateVersion).toBe('1.0.0');
    expect(after.sha256).not.toBe(before.sha256);
  });
});

describe('R-285: carousels without standings and standings of any size', () => {
  it('renders a complete carousel of cover, match result and closing without any standings element', async () => {
    const carousel = [ALL_SLIDES[0], ALL_SLIDES[1], ALL_SLIDES[3]] as SlideContent[];
    for (const slide of carousel) {
      const render = await renderContent({ ...slide, standingsAsOf: null }, deps(), '/t');
      expect(pngSize(render.png)).toEqual({ width: 1080, height: 1350 });
      expect(texts(render.renderModel).some((element) => element.field === 'standings')).toBe(false);
      expect(texts(render.renderModel).some((element) => element.overflow)).toBe(false);
    }
  });

  it('lays out any number of rows given to it, flagging rows that cannot fit instead of dropping them', () => {
    for (const count of [1, 5, 12, 20, 40]) {
      const model = buildRenderModel(content('standings', standingsText(standingsRows(count))), deps());
      const teams = texts(model).filter((element) => element.semantic === 'team_name');
      expect(teams).toHaveLength(count);
      expect(texts(model).some((element) => element.overflow)).toBe(false);
    }
    const crowded = buildRenderModel(content('standings', standingsText(standingsRows(60))), deps());
    expect(texts(crowded).filter((element) => element.semantic === 'team_name')).toHaveLength(60);
    expect(textOf(crowded, 'row-60-team').overflow).toBe(true);
    expect(textOf(crowded, 'row-1-team').overflow).toBe(false);
  });

  it('shows the "as of" text from the stored retrieval time, and none when it is unknown', () => {
    const model = buildRenderModel(content('standings', standingsText(standingsRows(2))), deps());
    expect(textOf(model, 'as-of').text).toBe('Actualizada al 25 oct 2026');
    const none = buildRenderModel(content('standings', standingsText(standingsRows(2)), { asOf: null }), deps());
    expect(texts(none).some((element) => element.id === 'as-of')).toBe(false);
  });

  it('refuses stored standings that do not have the row shape', async () => {
    const broken = standingsText(standingsRows(2));
    const fields = broken.fields.map((field) =>
      field.field === 'standings' ? { ...field, segments: field.segments.slice(0, 1) } : field,
    );
    await expect(renderContent(content('standings', { ...broken, fields }), deps(), '/slides/2/text')).rejects.toThrow(
      StageFailure,
    );
  });
});

describe('R-269: demonstration band', () => {
  it('is present on every slide of a DEMO_DATA project, in the content language', () => {
    for (const slide of ALL_SLIDES) {
      const model = buildRenderModel({ ...slide, demonstration: true }, deps());
      expect(model.demoLabel).toBe('DEMOSTRACIÓN · datos sintéticos');
      const label = textOf(model, 'demo-label');
      expect([label.field, label.text, label.provenance, label.overflow]).toEqual([
        'demo_label',
        'DEMOSTRACIÓN · datos sintéticos',
        'template_text',
        false,
      ]);
      expect(model.elements.some((element) => element.id === 'demo-band')).toBe(true);
    }
    const english = buildRenderModel(
      { ...(ALL_SLIDES[3] as SlideContent), demonstration: true, language: 'en' },
      deps(),
    );
    expect(english.demoLabel).toBe('DEMO · synthetic data');
  });

  it('is absent from slides of other projects', async () => {
    for (const slide of ALL_SLIDES) {
      const model = buildRenderModel({ ...slide, demonstration: false }, deps());
      expect(model.demoLabel).toBeNull();
      expect(model.elements.some((element) => element.id === 'demo-band' || element.id === 'demo-label')).toBe(false);
    }
    const demo = await renderContent({ ...(ALL_SLIDES[3] as SlideContent), demonstration: true }, deps(), '/t');
    const plain = await renderContent({ ...(ALL_SLIDES[3] as SlideContent), demonstration: false }, deps(), '/t');
    expect(demo.sha256).not.toBe(plain.sha256);
  });
});
