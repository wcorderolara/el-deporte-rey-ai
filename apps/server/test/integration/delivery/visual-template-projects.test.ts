/**
 * PD-ARCH-01G-D: content generation with a published visual template and team badges, through the real server, the
 * real workflow stages (research, verification, content with the stub AI, rendering, visual QA) and the real SQLite
 * database of a temporary app. Every competition, team, badge and match is synthetic.
 *
 * The design proposal behind the template comes from the scripted image egress (no connection, no credit); after it,
 * nothing reaches the image provider. Covered: the three reuse scenarios of the brief with one template version
 * (long names, two-digit scores drawn from independent values, badges found by the teams' internal identity, a
 * transparent badge, a team without a badge), visual QA on the template slides, the recorded version and badges of
 * each project, batch refusals, reproducibility after a new template version and a replaced badge, and projects
 * without a template rendering with the engine templates as before.
 */
import { renderAsync } from '@resvg/resvg-js';
import {
  type ContentBatch,
  ContentBatchSchema,
  DesignGenerationStartSchema,
  type Draft,
  type Element,
  ProjectSchema,
  type SlideType,
  VisualTemplateDetailSchema,
  type VisualTemplateLayer,
  type VisualTemplateVersion,
  VisualTemplateVersionSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import { png } from '../../../src/modules/brand/test/images.js';
import { designServiceOf } from '../../../src/modules/design/index.js';
import { pngSize } from '../../../src/modules/rendering/index.js';
import {
  type Json,
  type ScriptedImageEgress,
  type TestApp,
  scriptedImageEgress,
  testImageProviderConfig,
} from '../../support/index.js';
import { cleanups, start } from '../ingestion/support.js';

import { WORKFLOW_TEST_TIMEOUT, draftOf, fieldText, slidesOfType, waitForRun } from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const LOCAL_SOURCE: Json = {
  id: 'local',
  name: 'Datos deportivos locales',
  mode: 'MANUAL_DATA',
  enabled: true,
  role: 'primary',
  accepted: false,
  independenceGroup: 'local',
  officialPublication: false,
  publicationPermission: 'not_applicable',
  adapter: 'local-competitions',
  operatorValidated: true,
  options: {},
};

interface App {
  readonly t: TestApp;
  readonly egress: ScriptedImageEgress;
}

async function app(): Promise<App> {
  const egress = scriptedImageEgress();
  const t = await start(cleanup, {
    base: 'demo-manual',
    scenario: 'default',
    mutate: (document: Json) => {
      const providers = document['providers'] as Json;
      ((providers['sports'] as Json)['sources'] as Json[]).push(LOCAL_SOURCE);
      providers['images'] = testImageProviderConfig() as Json;
    },
    imageEgress: egress,
    env: { EDR_IMAGE_API_KEY: TEST_DUMMY_API_KEY },
  });
  return { t, egress };
}

async function ok<T>(response: Promise<{ statusCode: number; body: string; json(): unknown }>): Promise<T> {
  const answer = await response;
  expect([200, 201, 202], answer.body).toContain(answer.statusCode);
  return answer.json() as T;
}

let key = 0;
function requestKey(): string {
  key += 1;
  return `00000000-0000-4000-8000-${String(990_000 + key).padStart(12, '0')}`;
}

const RED = [200, 30, 40] as const;
const BLUE = [20, 40, 160] as const;
const ORANGE = [230, 140, 20] as const;

interface Seed {
  readonly competitionId: string;
  readonly seasonId: string;
  readonly roundId: string;
  readonly teams: Readonly<Record<string, string>>;
  /** A: Atlético Sintético Centro 1-2 FC Sintético Norte; B: Real Sintético 0-0 Atlético Sintético Centro; C: Wanderers 12-11 Mönchtal. */
  readonly matches: { readonly a: string; readonly b: string; readonly c: string };
}

async function uploadBadge(t: TestApp, teamId: string, image: Buffer): Promise<string> {
  const response = await t.inject({
    method: 'PUT',
    url: `/api/v1/teams/${teamId}/badge`,
    query: { source: 'Archivo sintético de prueba', authorized: 'true' },
    headers: { host: t.host, origin: t.origin, 'x-edr-client': 'web', 'content-type': 'image/png' },
    payload: image,
  });
  expect(response.statusCode, response.body).toBe(200);
  return (response.json() as { badge: { id: string } }).badge.id;
}

async function seed(t: TestApp): Promise<Seed> {
  const competition = await ok<{ id: string }>(t.send('POST', '/competitions', { name: 'Liga de Reutilización' }));
  const season = await ok<{ id: string }>(
    t.send('POST', `/competitions/${competition.id}/seasons`, { label: '2026/27' }),
  );
  const base = `/competitions/${competition.id}/seasons/${season.id}`;
  const teams: Record<string, string> = {};
  for (const name of [
    'Atlético Sintético Centro',
    'FC Sintético Norte',
    'Real Sintético',
    'Wanderers Sintético Oeste',
    'Borussia Sintética Mönchtal',
  ]) {
    const team = await ok<{ id: string }>(t.send('POST', '/teams', { name }));
    await ok(t.send('POST', `/competitions/${competition.id}/teams`, { teamId: team.id }));
    teams[name] = team.id;
  }
  await ok(t.send('POST', `${base}/participants/batch`, { teamIds: Object.values(teams) }));
  const round = await ok<{ id: string }>(t.send('POST', `${base}/rounds`, { name: 'Jornada 9' }));
  const match = async (home: string, away: string, kickoffAt: string, homeScore: number, awayScore: number) => {
    const created = await ok<{ id: string }>(
      t.send('POST', `${base}/matches`, {
        homeTeamId: teams[home],
        awayTeamId: teams[away],
        kickoffAt,
        stageId: null,
        roundId: round.id,
      }),
    );
    await ok(t.send('POST', `${base}/matches/${created.id}/result`, { status: 'finished', homeScore, awayScore }));
    return created.id;
  };
  const a = await match('Atlético Sintético Centro', 'FC Sintético Norte', '2026-10-20T18:00:00.000Z', 1, 2);
  const b = await match('Real Sintético', 'Atlético Sintético Centro', '2026-10-21T18:00:00.000Z', 0, 0);
  const c = await match('Wanderers Sintético Oeste', 'Borussia Sintética Mönchtal', '2026-10-22T18:00:00.000Z', 12, 11);
  // Badges by team: solid colours, one half transparent, Mönchtal without a badge.
  await uploadBadge(t, teams['Atlético Sintético Centro'] ?? '', png({ width: 64, height: 64, rgba: [...RED, 255] }));
  await uploadBadge(t, teams['FC Sintético Norte'] ?? '', png({ width: 64, height: 64, rgba: [...BLUE, 255] }));
  await uploadBadge(t, teams['Real Sintético'] ?? '', png({ width: 64, height: 64, rgba: [255, 255, 255, 128] }));
  await uploadBadge(
    t,
    teams['Wanderers Sintético Oeste'] ?? '',
    png({ width: 64, height: 64, rgba: [...ORANGE, 255] }),
  );
  return { competitionId: competition.id, seasonId: season.id, roundId: round.id, teams, matches: { a, b, c } };
}

/** An approved design proposal of a format (scripted image provider). */
async function approvedProposal(t: TestApp, format = '4:5'): Promise<string> {
  const started = await t.send('POST', '/design/generations', {
    contentType: 'match_result',
    format,
    quality: 'low',
    count: 1,
    references: [],
    requestKey: requestKey(),
    confirmCost: true,
  });
  expect(started.statusCode, started.body).toBe(202);
  const { generation } = DesignGenerationStartSchema.parse(started.json());
  await designServiceOf(t.container).settled(generation.id);
  const id = ((await t.get(`/design/generations/${generation.id}`)).json() as { proposalIds: string[] }).proposalIds[0];
  await ok(t.send('POST', `/design/proposals/${id ?? ''}/decisions`, { decision: 'approved' }));
  return id ?? '';
}

const STYLE = {
  fontRole: 'heading',
  maxFontSize: 56,
  minFontSize: 24,
  maxLines: 2,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
  effect: 'strong_shadow',
  uppercase: true,
} as const;

const SCORE = {
  ...STYLE,
  fontRole: 'numeric',
  maxFontSize: 110,
  minFontSize: 60,
  maxLines: 1,
  effect: 'scoreboard_gold',
};

/** The layers of the reference design: badges on their sides, names below, the score from independent values. */
function resultLayers(): VisualTemplateLayer[] {
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height, visible: true });
  return [
    {
      id: 'home-badge',
      name: 'Escudo local',
      type: 'team_badge',
      binding: 'match.homeTeam.badge',
      ...box(0.1, 0.2, 0.25, 0.2),
    },
    {
      id: 'away-badge',
      name: 'Escudo visitante',
      type: 'team_badge',
      binding: 'match.awayTeam.badge',
      ...box(0.65, 0.2, 0.25, 0.2),
    },
    {
      id: 'home-team',
      name: 'Equipo local',
      type: 'sports_data',
      binding: 'match.homeTeam.name',
      required: true,
      style: STYLE,
      ...box(0.03, 0.42, 0.44, 0.1),
    },
    {
      id: 'away-team',
      name: 'Equipo visitante',
      type: 'sports_data',
      binding: 'match.awayTeam.name',
      required: true,
      style: STYLE,
      ...box(0.53, 0.42, 0.44, 0.1),
    },
    {
      id: 'home-score',
      name: 'Goles local',
      type: 'sports_data',
      binding: 'match.homeScore',
      required: true,
      style: { ...SCORE, align: 'right' },
      ...box(0.2, 0.55, 0.25, 0.12),
    },
    { id: 'separator', name: 'Separador', type: 'text', text: '-', style: SCORE, ...box(0.45, 0.55, 0.1, 0.12) },
    {
      id: 'away-score',
      name: 'Goles visitante',
      type: 'sports_data',
      binding: 'match.awayScore',
      required: true,
      style: { ...SCORE, align: 'left' },
      ...box(0.55, 0.55, 0.25, 0.12),
    },
  ] as VisualTemplateLayer[];
}

/**
 * A published template (the result template with the reference layers by default); returns the template and its
 * published version.
 */
async function publishedTemplate(
  t: TestApp,
  format = '4:5',
  options: { contentType?: string; name?: string; layers?: VisualTemplateLayer[] } = {},
): Promise<{ templateId: string; version: VisualTemplateVersion }> {
  const detail = VisualTemplateDetailSchema.parse(
    await ok(
      t.send('POST', '/visual-templates', {
        sourceProposalId: await approvedProposal(t, format),
        name: options.name ?? 'Resultado de referencia',
        ...(options.contentType === undefined ? {} : { contentType: options.contentType }),
      }),
    ),
  );
  const templateId = detail.template.id;
  const draftId = detail.template.draftVersionId ?? '';
  const draft = VisualTemplateVersionSchema.parse(
    await ok(t.get(`/visual-templates/${templateId}/versions/${draftId}`)),
  );
  const saved = VisualTemplateVersionSchema.parse(
    await ok(
      t.send('PUT', `/visual-templates/${templateId}/versions/${draftId}`, {
        revision: draft.revision,
        background: { source: draft.background.source, id: draft.background.id },
        layers: options.layers ?? resultLayers(),
      }),
    ),
  );
  expect(saved.validation.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  const released = VisualTemplateVersionSchema.parse(
    await ok(
      t.send('POST', `/visual-templates/${templateId}/versions/${draftId}/release`, { revision: saved.revision }),
    ),
  );
  return { templateId, version: released };
}

async function settled(t: TestApp, batch: ContentBatch): Promise<ContentBatch> {
  for (const item of batch.items) {
    if (item.projectId !== null && item.runId !== null) {
      await waitForRun(t, item.projectId, item.runId);
    }
  }
  return ContentBatchSchema.parse(await ok(t.get(`/content-batches/${batch.id}`)));
}

function resultSlide(draft: Draft): Element {
  const slide = draft.carousels.flatMap((carousel) => slidesOfType(carousel, 'match_result'))[0];
  if (slide === undefined) {
    throw new Error('no match result slide');
  }
  return slide;
}

/** The RGB of a pixel of a PNG, decoded by resvg. */
async function pixelsOf(image: Buffer): Promise<(x: number, y: number) => number[]> {
  const size = pngSize(image) ?? { width: 1, height: 1 };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${String(size.width)}" ` +
    `height="${String(size.height)}"><image width="${String(size.width)}" height="${String(size.height)}" ` +
    `xlink:href="data:image/png;base64,${image.toString('base64')}"/></svg>`;
  const pixels = (await renderAsync(svg, { font: { loadSystemFonts: false } })).pixels;
  return (x, y) => [...pixels.subarray((y * size.width + x) * 4, (y * size.width + x) * 4 + 3)];
}

function renderRow(t: TestApp, versionId: string): { template_id: string; template_version: string } {
  return (
    t.container.db
      .prepare<{ template_id: string; template_version: string }>(
        'SELECT template_id, template_version FROM element_versions WHERE id = ?',
      )
      .get([versionId]) ?? { template_id: '', template_version: '' }
  );
}

const HOME_BADGE = [Math.round(0.225 * 1080), Math.round(0.3 * 1350)] as const;
const AWAY_BADGE = [Math.round(0.775 * 1080), Math.round(0.3 * 1350)] as const;

describe('generation with a published visual template (PD-ARCH-01G-D)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('reuses one template version for three matches: badges, long names and two-digit scores, QA passed, no image request', async () => {
    const { t, egress } = await app();
    const s = await seed(t);
    const { templateId, version } = await publishedTemplate(t);
    const imageRequests = egress.requests.length;

    const selection = {
      competitionId: s.competitionId,
      seasonId: s.seasonId,
      stageId: null,
      roundId: s.roundId,
      matchIds: [s.matches.a, s.matches.b, s.matches.c],
      kinds: ['match_result'],
      visualTemplateVersionIds: [version.id],
    };
    const preview = await ok<{ visualTemplates: unknown }>(t.send('POST', '/content-batches/previews', selection));
    expect(preview.visualTemplates).toEqual([
      {
        templateId,
        versionId: version.id,
        version: 1,
        name: 'Resultado de referencia',
        contentType: 'match_result',
      },
    ]);
    const batch = await settled(
      t,
      ContentBatchSchema.parse(await ok(t.send('POST', '/content-batches', { requestKey: requestKey(), selection }))),
    );
    expect(batch.items.map((item) => item.status)).toEqual(['completed', 'completed', 'completed']);

    const expected = [
      { home: 'Atlético Sintético Centro', away: 'FC Sintético Norte', scores: ['1', '2'], badges: [RED, BLUE] },
      { home: 'Real Sintético', away: 'Atlético Sintético Centro', scores: ['0', '0'], badges: ['half', RED] },
      {
        home: 'Wanderers Sintético Oeste',
        away: 'Borussia Sintética Mönchtal',
        scores: ['12', '11'],
        badges: [ORANGE, null],
      },
    ];
    for (const [index, item] of batch.items.entries()) {
      const projectId = item.projectId ?? '';
      const project = ProjectSchema.parse(await ok(t.get(`/projects/${projectId}`)));
      expect(project.visualTemplates).toMatchObject([{ templateId, versionId: version.id, version: 1 }]);
      const slide = resultSlide(await draftOf(t, projectId));
      const scene = expected[index];
      expect(fieldText(slide, 'team_home')).toBe(scene?.home);
      expect(fieldText(slide, 'team_away')).toBe(scene?.away);
      expect([fieldText(slide, 'score_home'), fieldText(slide, 'score_away')]).toEqual(scene?.scores);
      // Visual QA compares every drawn value with its fact; nothing blocks.
      const failures = slide.currentVersion.qa.filter(
        (result) => result.outcome === 'fail' && result.check !== 'capitalized_tokens',
      );
      expect(failures, JSON.stringify(failures)).toEqual([]);
      expect(renderRow(t, slide.currentVersion.id)).toEqual({ template_id: `vt-${templateId}`, template_version: '1' });

      const image = (await t.get(`/element-versions/${slide.currentVersion.id}/image`)).rawPayload;
      expect(pngSize(image)).toEqual({ width: 1080, height: 1350 });
      const pixel = await pixelsOf(image);
      const [homeBadge, awayBadge] = scene?.badges ?? [];
      const background = pixel(HOME_BADGE[0], HOME_BADGE[1] - 160);
      // A badge is drawn from its file by the team's identity; a half transparent badge blends with the background;
      // a team without a badge leaves its layer empty.
      if (homeBadge === 'half') {
        expect(pixel(...HOME_BADGE)).not.toEqual([255, 255, 255]);
        expect(pixel(...HOME_BADGE)).not.toEqual(pixel(HOME_BADGE[0] - 150, HOME_BADGE[1]));
      } else {
        expect(pixel(...HOME_BADGE)).toEqual([...(homeBadge ?? [])]);
      }
      expect(background).not.toEqual([...RED]);
      if (awayBadge !== null && awayBadge !== undefined && awayBadge !== 'half') {
        expect(pixel(...AWAY_BADGE)).toEqual([...awayBadge]);
      } else {
        expect(pixel(...AWAY_BADGE)).not.toEqual([...ORANGE]);
      }
    }
    expect(egress.requests.length).toBe(imageRequests);
  });

  it('keeps a project reproducible after a new template version and a replaced badge', async () => {
    const { t } = await app();
    const s = await seed(t);
    const { templateId, version } = await publishedTemplate(t);
    const selection = {
      competitionId: s.competitionId,
      seasonId: s.seasonId,
      stageId: null,
      roundId: s.roundId,
      matchIds: [s.matches.a],
      kinds: ['match_result'],
      visualTemplateVersionIds: [version.id],
    };
    const batch = await settled(
      t,
      ContentBatchSchema.parse(await ok(t.send('POST', '/content-batches', { requestKey: requestKey(), selection }))),
    );
    const projectId = batch.items[0]?.projectId ?? '';
    const draft = await draftOf(t, projectId);
    const slide = resultSlide(draft);
    const before = (await t.get(`/element-versions/${slide.currentVersion.id}/image`)).rawPayload;

    // A new published version (no badge layers) and a replaced Atlético badge.
    const next = VisualTemplateVersionSchema.parse(
      await ok(t.send('POST', `/visual-templates/${templateId}/versions`, {})),
    );
    const changed = VisualTemplateVersionSchema.parse(
      await ok(
        t.send('PUT', `/visual-templates/${templateId}/versions/${next.id}`, {
          revision: next.revision,
          background: { source: next.background.source, id: next.background.id },
          layers: resultLayers().filter((layer) => layer.type !== 'team_badge'),
        }),
      ),
    );
    await ok(
      t.send('POST', `/visual-templates/${templateId}/versions/${next.id}/release`, { revision: changed.revision }),
    );
    await uploadBadge(
      t,
      s.teams['Atlético Sintético Centro'] ?? '',
      png({ width: 64, height: 64, rgba: [0, 200, 0, 255] }),
    );
    // Archived and deleted afterwards (01G-D-4), the template still draws the projects that used it.
    await ok(t.send('POST', `/visual-templates/${templateId}/archive`));
    expect((await t.send('DELETE', `/visual-templates/${templateId}`)).statusCode).toBe(204);

    // Regenerating the slide draws it again with the recorded version and badges: the same image.
    const carouselId = draft.carousels[0]?.id ?? '';
    const regenerated = await t.send('POST', `/carousels/${carouselId}/elements/${slide.id}/regenerate`);
    expect(regenerated.statusCode, regenerated.body).toBe(201);
    const after = resultSlide(await draftOf(t, projectId));
    expect(after.currentVersion.id).not.toBe(slide.currentVersion.id);
    const image = (await t.get(`/element-versions/${after.currentVersion.id}/image`)).rawPayload;
    expect(image.equals(before)).toBe(true);
    expect(ProjectSchema.parse(await ok(t.get(`/projects/${projectId}`))).visualTemplates).toMatchObject([
      { version: 1 },
    ]);
  });

  it('refuses a version that is not published, of another content type or format, and keeps projects without a template unchanged', async () => {
    const { t } = await app();
    const s = await seed(t);
    const { templateId, version } = await publishedTemplate(t);
    const base = {
      competitionId: s.competitionId,
      seasonId: s.seasonId,
      stageId: null,
      roundId: s.roundId,
      matchIds: [s.matches.a],
      kinds: ['match_result'],
    };
    const draft = VisualTemplateVersionSchema.parse(
      await ok(t.send('POST', `/visual-templates/${templateId}/versions`, {})),
    );
    const refusals: [Record<string, unknown>, number][] = [
      [{ ...base, visualTemplateVersionIds: [draft.id] }, 409],
      [{ ...base, kinds: ['round_calendar'], visualTemplateVersionIds: [version.id] }, 409],
      [{ ...base, visualTemplateVersionIds: ['00000000-0000-4000-8000-000000000555'] }, 404],
    ];
    const square = await publishedTemplate(t, '1:1');
    refusals.push([{ ...base, visualTemplateVersionIds: [square.version.id] }, 409]);
    // One template per slide type (decision 01G-D-3).
    const another = await publishedTemplate(t, '4:5', { name: 'Otro resultado' });
    refusals.push([{ ...base, visualTemplateVersionIds: [version.id, another.version.id] }, 409]);
    for (const [selection, status] of refusals) {
      const response = await t.send('POST', '/content-batches/previews', selection);
      expect(response.statusCode, response.body).toBe(status);
    }

    // Without a template: the engine templates, no template fields, no recorded version.
    const batch = await settled(
      t,
      ContentBatchSchema.parse(
        await ok(t.send('POST', '/content-batches', { requestKey: requestKey(), selection: base })),
      ),
    );
    const projectId = batch.items[0]?.projectId ?? '';
    expect(ProjectSchema.parse(await ok(t.get(`/projects/${projectId}`))).visualTemplates).toEqual([]);
    const slide = resultSlide(await draftOf(t, projectId));
    expect(slide.currentVersion.fields.map((field) => field.field)).not.toContain('score_home');
    expect(renderRow(t, slide.currentVersion.id).template_id).toBe('match-result');
  });
  it('draws the cover, the match slides and the closing of a round carousel with one template each (decision 01G-D-3)', async () => {
    const { t, egress } = await app();
    const s = await seed(t);
    const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height, visible: true });
    const cover = await publishedTemplate(t, '4:5', {
      contentType: 'cover',
      name: 'Portada de referencia',
      layers: [
        {
          id: 'competition',
          name: 'Competición',
          type: 'sports_data',
          binding: 'competition.name',
          required: true,
          style: STYLE,
          ...box(0.06, 0.2, 0.88, 0.15),
        },
        {
          id: 'round',
          name: 'Jornada',
          type: 'sports_data',
          binding: 'round.name',
          required: true,
          style: STYLE,
          ...box(0.06, 0.4, 0.88, 0.1),
        },
      ] as VisualTemplateLayer[],
    });
    const result = await publishedTemplate(t);
    const closing = await publishedTemplate(t, '4:5', {
      contentType: 'closing',
      name: 'Cierre de referencia',
      layers: [
        {
          id: 'thanks',
          name: 'Texto de cierre',
          type: 'text',
          text: 'Gracias por seguirnos',
          style: STYLE,
          ...box(0.08, 0.3, 0.84, 0.15),
        },
      ] as VisualTemplateLayer[],
    });
    const imageRequests = egress.requests.length;
    const selection = {
      competitionId: s.competitionId,
      seasonId: s.seasonId,
      stageId: null,
      roundId: s.roundId,
      matchIds: [s.matches.a, s.matches.b],
      kinds: ['round_results'],
      visualTemplateVersionIds: [closing.version.id, result.version.id, cover.version.id],
    };
    const preview = await ok<{ visualTemplates: { contentType: string }[] }>(
      t.send('POST', '/content-batches/previews', selection),
    );
    expect(preview.visualTemplates.map((usage) => usage.contentType).sort()).toEqual([
      'closing',
      'cover',
      'match_result',
    ]);
    const batch = await settled(
      t,
      ContentBatchSchema.parse(await ok(t.send('POST', '/content-batches', { requestKey: requestKey(), selection }))),
    );
    expect(batch.items.map((item) => item.status)).toEqual(['completed']);
    const projectId = batch.items[0]?.projectId ?? '';
    // The project lists its versions cover first, the match slides, then the closing.
    expect(
      ProjectSchema.parse(await ok(t.get(`/projects/${projectId}`))).visualTemplates.map((usage) => [
        usage.contentType,
        usage.templateId,
      ]),
    ).toEqual([
      ['cover', cover.templateId],
      ['match_result', result.templateId],
      ['closing', closing.templateId],
    ]);
    const draft = await draftOf(t, projectId);
    const templateOf: [SlideType, string][] = [
      ['cover', cover.templateId],
      ['match_result', result.templateId],
      ['closing', closing.templateId],
    ];
    for (const [slideType, templateId] of templateOf) {
      const slides = draft.carousels.flatMap((carousel) => slidesOfType(carousel, slideType));
      expect(slides.length, slideType).toBeGreaterThan(0);
      for (const slide of slides) {
        expect(renderRow(t, slide.currentVersion.id)).toEqual({
          template_id: `vt-${templateId}`,
          template_version: '1',
        });
        const failures = slide.currentVersion.qa.filter(
          (check) => check.outcome === 'fail' && check.check !== 'capitalized_tokens',
        );
        expect(failures, `${slideType} ${JSON.stringify(failures)}`).toEqual([]);
        const image = (await t.get(`/element-versions/${slide.currentVersion.id}/image`)).rawPayload;
        expect(pngSize(image)).toEqual({ width: 1080, height: 1350 });
      }
    }
    expect(egress.requests.length).toBe(imageRequests);
  });
});

describe('round calendars with a match list (PD-ARCH-01G-E.2)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('draws one row per match with each badge by the team identity, compares every row with its facts and never draws the badge of a team without one', async () => {
    const { t, egress } = await app();
    const s = await seed(t);
    // Two matches not played yet in the same round: the finished ones are left out of the calendar.
    const base = `/competitions/${s.competitionId}/seasons/${s.seasonId}`;
    const fixture = async (home: string, away: string, kickoffAt: string) =>
      (
        await ok<{ id: string }>(
          t.send('POST', `${base}/matches`, {
            homeTeamId: s.teams[home],
            awayTeamId: s.teams[away],
            kickoffAt,
            stageId: null,
            roundId: s.roundId,
          }),
        )
      ).id;
    const first = await fixture('FC Sintético Norte', 'Atlético Sintético Centro', '2026-12-10T18:00:00.000Z');
    const second = await fixture(
      'Borussia Sintética Mönchtal',
      'Wanderers Sintético Oeste',
      '2026-12-11T18:00:00.000Z',
    );
    await ok(
      t.send('POST', `${base}/matches/${second}/result`, { status: 'postponed', homeScore: null, awayScore: null }),
    );
    const style = { ...STYLE, maxFontSize: 30, minFontSize: 18, effect: 'none', uppercase: false };
    const part = (x: number, y: number, width: number, height: number) => ({ x, y, width, height, visible: true });
    const calendar = await publishedTemplate(t, '4:5', {
      contentType: 'round_overview',
      name: 'Calendario de referencia',
      layers: [
        {
          id: 'partidos',
          name: 'Lista de partidos',
          type: 'fixture_list',
          ...part(0.0278, 0.2415, 0.9444, 0.077),
          rowGap: 0.0074,
          row: {
            homeBadge: part(0.0157, 0.1154, 0.0784, 0.7692),
            homeName: { ...part(0.1059, 0, 0.2941, 1), style: { ...style, align: 'right' } },
            kickoffDate: { ...part(0.4118, 0.06, 0.1765, 0.3), style: { ...style, fontRole: 'body', maxLines: 1 } },
            kickoffTime: { ...part(0.4118, 0.36, 0.1765, 0.33), style: { ...style, fontRole: 'numeric', maxLines: 1 } },
            status: { ...part(0.4118, 0.7, 0.1765, 0.26), style: { ...style, fontRole: 'body', maxLines: 1 } },
            awayName: { ...part(0.6, 0, 0.2941, 1), style: { ...style, align: 'left' } },
            awayBadge: part(0.9059, 0.1154, 0.0784, 0.7692),
          },
        },
      ] as VisualTemplateLayer[],
    });
    const imageRequests = egress.requests.length;
    const batch = await settled(
      t,
      ContentBatchSchema.parse(
        await ok(
          t.send('POST', '/content-batches', {
            requestKey: requestKey(),
            selection: {
              competitionId: s.competitionId,
              seasonId: s.seasonId,
              stageId: null,
              roundId: s.roundId,
              matchIds: [s.matches.a, s.matches.b, s.matches.c, first, second],
              kinds: ['round_calendar'],
              visualTemplateVersionIds: [calendar.version.id],
            },
          }),
        ),
      ),
    );
    expect(batch.items.map((item) => item.status)).toEqual(['completed']);
    const draft = await draftOf(t, batch.items[0]?.projectId ?? '');
    const page = draft.carousels.flatMap((carousel) => slidesOfType(carousel, 'round_overview'))[0] as Element;
    expect(renderRow(t, page.currentVersion.id)).toEqual({
      template_id: `vt-${calendar.templateId}`,
      template_version: '1',
    });
    expect(
      fieldText(page, 'fixtures')
        .split('\n')
        .map((line) => line.split(' · ')[0]),
    ).toEqual([
      'FC Sintético Norte vs Atlético Sintético Centro',
      'Borussia Sintética Mönchtal vs Wanderers Sintético Oeste',
    ]);
    // Every row is compared with its facts: names, date, time and the postponed status; nothing fails.
    const failures = page.currentVersion.qa.filter(
      (check) => check.outcome === 'fail' && check.check !== 'capitalized_tokens',
    );
    expect(failures).toEqual([]);
    const model = JSON.parse(
      t.container.db
        .prepare<{ render_model: string }>('SELECT render_model FROM element_versions WHERE id = ?')
        .get([page.currentVersion.id])?.render_model ?? '{}',
    ) as { elements: { id: string; kind: string; text?: string; semantic?: string }[] };
    const ids = model.elements.map((element) => element.id).filter((id) => id.startsWith('layer-partidos-'));
    // Row 2: Mönchtal has no badge, so its badge is not drawn; its name is.
    expect(ids).toEqual([
      'layer-partidos-r1-home-badge',
      'layer-partidos-r1-away-badge',
      'layer-partidos-r1-home',
      'layer-partidos-r1-date',
      'layer-partidos-r1-time',
      'layer-partidos-r1-away',
      'layer-partidos-r2-away-badge',
      'layer-partidos-r2-home',
      'layer-partidos-r2-date',
      'layer-partidos-r2-time',
      'layer-partidos-r2-status',
      'layer-partidos-r2-away',
    ]);
    expect(model.elements.find((element) => element.id === 'layer-partidos-r2-status')?.text).toBe('Aplazado');
    const pixel = await pixelsOf((await t.get(`/element-versions/${page.currentVersion.id}/image`)).rawPayload);
    const badgeCentre = (row: number, partX: number) =>
      [
        Math.round((0.0278 + (partX + 0.0392) * 0.9444) * 1080),
        Math.round((0.2415 + row * (0.077 + 0.0074) + 0.5 * 0.077) * 1350),
      ] as const;
    // Sintético Norte (blue) at home and Atlético Sintético (red) away in row 1; Wanderers (orange) away in row 2.
    expect(pixel(...badgeCentre(0, 0.0157))).toEqual([...BLUE]);
    expect(pixel(...badgeCentre(0, 0.9059))).toEqual([...RED]);
    expect(pixel(...badgeCentre(1, 0.9059))).toEqual([...ORANGE]);
    expect(egress.requests.length).toBe(imageRequests);
  });
});
