/**
 * AC-05 of the Product Owner (WI-2 UI-06.3; PD-36 point 6): the deterministic generation and rendering of final slides
 * never use the generative image AI. Generating template proposals (the design module) and rendering final carousel
 * images (`modules/rendering`, satori and resvg) are separate operations.
 *
 * The image provider is configured and ready (the `openai` image adapter pointed at a synthetic origin, with the test
 * dummy key); its egress is the scripted image client, which records every request and never opens a connection, and
 * the provider's own entry points are spied on. A full generation from local sports data (every content kind, team
 * badges, a regenerated slide), visual QA, review, every approval, the editorial copy of the free stub writer, the
 * export, its ZIP download and the trace of an exported slide make no image-provider call and no request at all; the
 * slide text writer is the stub AI and the editorial writer the stub (no cost). A design generation afterwards makes
 * exactly one image request, so the recorder is the provider's real egress (a positive control). The second test does
 * the same for a project drawn with a published visual template: after the one request of the template's design
 * proposal, nothing reaches the image provider again. Every name and image is synthetic.
 *
 * Existing coverage this completes: `visual-template-projects.test.ts` («reuses one template version for three
 * matches: … no image request») checks generation and rendering with a template, without review or export.
 */
import {
  type Carousel,
  ContentBatchSchema,
  DesignCapabilitiesSchema,
  DesignGenerationStartSchema,
  type EditorialGenerationResult,
  ElementSchema,
  VisualTemplateDetailSchema,
  type VisualTemplateLayer,
  type VisualTemplateVersion,
  VisualTemplateVersionSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import { designServiceOf } from '../../../src/modules/design/index.js';
import {
  type Json,
  type ScriptedImageEgress,
  type TestApp,
  expectNoNetworkViolations,
  scriptedImageEgress,
  testImageProviderConfig,
} from '../../support/index.js';
import { cleanups } from '../ingestion/support.js';

import {
  finished,
  generate,
  kickoff,
  localApp,
  localCompetition,
  ok,
  requestKeys,
  uploadBadge,
  zipEntries,
} from './extreme-support.js';
import {
  WORKFLOW_TEST_TIMEOUT,
  approveDraft,
  draftOf,
  elementPath,
  exported,
  fieldText,
  manifestOf,
  sha256,
  slidesOfType,
  traceOf,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanup.run();
});

const requestKey = requestKeys('c');

interface ImageApp {
  readonly t: TestApp;
  readonly images: ScriptedImageEgress;
  /** Calls of the image provider's entry points that can reach the provider. */
  readonly calls: () => { generate: number; checkModelAccess: number };
}

/** A local-data app whose image provider is configured, keyed and ready, behind the scripted image egress. */
async function imageApp(): Promise<ImageApp> {
  const images = scriptedImageEgress();
  const t = await localApp(cleanup, {
    mutate: (document: Json) => {
      (document['providers'] as Json)['images'] = testImageProviderConfig() as Json;
    },
    imageEgress: images,
    env: { EDR_IMAGE_API_KEY: TEST_DUMMY_API_KEY },
  });
  const provider = t.container.imageProvider;
  const generateSpy = vi.spyOn(provider, 'generate');
  const checkSpy = vi.spyOn(provider, 'checkModelAccess');
  return {
    t,
    images,
    calls: () => ({ generate: generateSpy.mock.calls.length, checkModelAccess: checkSpy.mock.calls.length }),
  };
}

async function expectProviderReady(t: TestApp): Promise<void> {
  const capabilities = DesignCapabilitiesSchema.parse(await ok(t.get('/design/capabilities')));
  expect(capabilities).toMatchObject({ adapter: 'openai', status: 'ready', defaultModel: 'test-image-flex' });
  expect(t.container.imageProvider.capabilities().status).toBe('ready');
}

/** One design generation of one proposal (the image AI's own operation); returns the proposal ID. */
async function designProposal(t: TestApp, contentType = 'match_result'): Promise<string> {
  const started = await t.send('POST', '/design/generations', {
    contentType,
    format: '4:5',
    quality: 'low',
    count: 1,
    references: [],
    requestKey: requestKey(),
    confirmCost: true,
  });
  expect(started.statusCode, started.body).toBe(202);
  const { generation } = DesignGenerationStartSchema.parse(started.json());
  await designServiceOf(t.container).settled(generation.id);
  const done = await ok<{ status: string; proposalIds: string[] }>(t.get(`/design/generations/${generation.id}`));
  expect(done.status).toBe('completed');
  return done.proposalIds[0] ?? '';
}

function designGenerationCount(t: TestApp): number {
  return t.container.db.prepare<{ n: number }>('SELECT COUNT(*) AS n FROM design_generations').get()?.n ?? 0;
}

/** Regenerates the first slide of a type of a project's draft (a new rendered version). */
async function regenerateFirst(t: TestApp, projectId: string, slideType: 'match_result' | 'round_overview') {
  const slide = (await draftOf(t, projectId)).carousels.flatMap((carousel) => slidesOfType(carousel, slideType))[0];
  if (slide === undefined) {
    throw new Error(`no ${slideType} slide`);
  }
  const response = await t.send('POST', `${elementPath(slide)}/regenerate`);
  expect(response.statusCode, response.body).toBe(201);
  return ElementSchema.parse(response.json());
}

/** Approves, finally approves and exports every carousel of a project; downloads and traces each export. */
async function approveAndExport(t: TestApp, projectId: string): Promise<void> {
  const draft = await approveDraft(t, projectId);
  for (const carousel of draft.carousels) {
    await exportAndDownload(t, carousel);
  }
}

async function exportAndDownload(t: TestApp, carousel: Carousel): Promise<void> {
  const written = await exported(t, carousel.id);
  const zip = await t.get(`/exports/${written.id}/download`);
  expect(zip.statusCode, zip.body).toBe(200);
  expect(zipEntries(zip.rawPayload).map((entry) => sha256(entry.bytes))).toEqual(
    written.files.map((file) => file.sha256),
  );
  const trace = await traceOf(t, written.id, 1);
  expect(trace.dataMode).toBe('MANUAL_DATA');
}

describe('final slides never use the image AI (AC-05, PD-36 point 6)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('a full generation, rendering, review, approval, editorial copy and export with the engine templates makes no image-provider request while the provider is ready', async () => {
    const { t, images, calls } = await imageApp();
    await expectProviderReady(t);
    // The slide text writer is the stub AI and the editorial writer is the free stub: no AI cost anywhere.
    expect(t.container.aiProvider.id).toBe('stub');
    expect(t.container.editorialWriter.describe()).toMatchObject({ adapter: 'stub', kind: 'test', billed: false });

    const names = ['Club Sintético Alba', 'Club Sintético Brisa', 'Club Sintético Cumbre', 'Club Sintético Duna'];
    const c = await localCompetition(t, { name: 'Liga Sintética AC Cinco', season: '2026/27', teams: names });
    // Badges for two teams: the slides draw them and leave the others' slots empty, never asking for an image.
    await uploadBadge(t, c.team(names[0] ?? ''), [200, 30, 40]);
    await uploadBadge(t, c.team(names[1] ?? ''), [20, 40, 160]);
    const roundId = await c.round('Jornada 5');
    const matchIds = [
      await c.match(names[0] ?? '', names[1] ?? '', roundId, kickoff(1), finished(2, 1)),
      await c.match(names[2] ?? '', names[3] ?? '', roundId, kickoff(2), finished(10, 11)),
      await c.match(names[1] ?? '', names[2] ?? '', roundId, kickoff(20)),
      await c.match(names[3] ?? '', names[0] ?? '', roundId, kickoff(21)),
    ];
    const batch = await generate(t, {
      requestKey: requestKey(),
      selection: c.selection(roundId, matchIds, [
        'round_results',
        'match_result',
        'round_calendar',
        'upcoming_matches',
        'match_preview',
      ]),
    });
    const completed = batch.items.filter((item) => item.status === 'completed');
    expect(new Set(completed.map((item) => item.kind))).toEqual(
      new Set(['round_results', 'match_result', 'round_calendar', 'upcoming_matches', 'match_preview']),
    );
    expect(batch.totals.failed).toBe(0);
    // Every slide text came from the stub AI request of each project.
    expect(t.aiRequests.length).toBe(completed.length);

    const results = completed.find((item) => item.kind === 'round_results')?.projectId ?? '';
    const calendar = completed.find((item) => item.kind === 'round_calendar')?.projectId ?? '';
    await regenerateFirst(t, results, 'match_result');
    await regenerateFirst(t, calendar, 'round_overview');

    for (const item of completed) {
      await approveAndExport(t, item.projectId ?? '');
    }

    // The editorial copy of the free stub writer, approved and carried by a new export of the results carousel.
    const copy = await t.send('POST', `/projects/${results}/editorial/generations`, { requestKey: requestKey() });
    expect(copy.statusCode, copy.body).toBe(201);
    const pkg = (copy.json() as EditorialGenerationResult).package;
    expect(pkg.writer).toMatchObject({ kind: 'test', requiresCostConfirmation: false });
    const main = pkg.deliverables.find((entry) => entry.deliverable === 'facebook_instagram')?.current;
    await ok(
      t.send('PUT', `/projects/${results}/editorial/deliverables/facebook_instagram/approval`, {
        versionId: main?.id,
      }),
    );
    const carousel = (await draftOf(t, results)).carousels[0] as Carousel;
    const withCopy = await exported(t, carousel.id);
    expect(withCopy.files.map((file) => file.kind)).toContain('editorial_text');
    expect(manifestOf(t, withCopy).editorial?.deliverables.map((entry) => entry.deliverable)).toEqual([
      'facebook_instagram',
    ]);

    // Nothing of the above reached the image provider, nor anything else.
    expect(images.requests).toEqual([]);
    expect(calls()).toEqual({ generate: 0, checkModelAccess: 0 });
    expect(designGenerationCount(t)).toBe(0);
    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
    expect(DesignCapabilitiesSchema.parse(await ok(t.get('/design/capabilities'))).limits.imagesUsedToday).toBe(0);

    // Positive control: a design proposal is the image AI's operation, and the recorder sees its one request.
    await designProposal(t);
    expect(images.requests.filter((entry) => entry.url.includes('/images/'))).toHaveLength(1);
    expect(calls().generate).toBe(1);
  });

  it('a project drawn with a published visual template adds no image request after the proposal of its template, through regeneration, approval and export', async () => {
    const { t, images, calls } = await imageApp();
    await expectProviderReady(t);
    const names = ['Club Sintético Ébano', 'Club Sintético Ñandú', 'Club Sintético Güira'];
    const c = await localCompetition(t, { name: 'Liga Sintética de Plantillas', season: '2026/27', teams: names });
    await uploadBadge(t, c.team(names[0] ?? ''), [230, 140, 20]);
    const roundId = await c.round('Jornada 6');
    const matchIds = [
      await c.match(names[0] ?? '', names[1] ?? '', roundId, kickoff(3), finished(12, 11)),
      await c.match(names[2] ?? '', names[0] ?? '', roundId, kickoff(4), finished(0, 0)),
    ];

    // The template comes from one approved design proposal: the only image request of the test.
    const version = await publishedTemplate(t, await designProposal(t));
    expect(images.requests.filter((entry) => entry.url.includes('/images/'))).toHaveLength(1);
    const before = { requests: images.requests.length, ...calls() };

    const selection = { ...c.selection(roundId, matchIds, ['match_result']), visualTemplateVersionIds: [version.id] };
    const batch = await generate(t, { requestKey: requestKey(), selection });
    expect(ContentBatchSchema.parse(batch).items.map((item) => item.status)).toEqual(['completed', 'completed']);
    const scores = [
      ['12', '11'],
      ['0', '0'],
    ];
    for (const [index, item] of batch.items.entries()) {
      const projectId = item.projectId ?? '';
      const slide = (await draftOf(t, projectId)).carousels.flatMap((entry) => slidesOfType(entry, 'match_result'))[0];
      if (slide === undefined) {
        throw new Error('no match result slide');
      }
      const row = t.container.db
        .prepare<{ template_id: string }>('SELECT template_id FROM element_versions WHERE id = ?')
        .get([slide.currentVersion.id]);
      // Drawn by the rendering engine with the published template, from the sports data.
      expect(row?.template_id).toMatch(/^vt-/u);
      expect([fieldText(slide, 'score_home'), fieldText(slide, 'score_away')]).toEqual(scores[index]);
      await regenerateFirst(t, projectId, 'match_result');
      await approveAndExport(t, projectId);
    }

    expect(images.requests.length).toBe(before.requests);
    expect(calls()).toEqual({ generate: before.generate, checkModelAccess: before.checkModelAccess });
    expect(designGenerationCount(t)).toBe(1);
    expect(t.egress.requests).toEqual([]);
    expectNoNetworkViolations();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A published visual template of the match result (the reference layers of PD-ARCH-01G-D)
// ---------------------------------------------------------------------------------------------------------------

const TEXT_STYLE = {
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

const SCORE_STYLE = {
  ...TEXT_STYLE,
  fontRole: 'numeric',
  maxFontSize: 110,
  minFontSize: 60,
  maxLines: 1,
  effect: 'scoreboard_gold',
} as const;

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
      style: TEXT_STYLE,
      ...box(0.03, 0.42, 0.44, 0.1),
    },
    {
      id: 'away-team',
      name: 'Equipo visitante',
      type: 'sports_data',
      binding: 'match.awayTeam.name',
      required: true,
      style: TEXT_STYLE,
      ...box(0.53, 0.42, 0.44, 0.1),
    },
    {
      id: 'home-score',
      name: 'Goles local',
      type: 'sports_data',
      binding: 'match.homeScore',
      required: true,
      style: { ...SCORE_STYLE, align: 'right' },
      ...box(0.2, 0.55, 0.25, 0.12),
    },
    { id: 'separator', name: 'Separador', type: 'text', text: '-', style: SCORE_STYLE, ...box(0.45, 0.55, 0.1, 0.12) },
    {
      id: 'away-score',
      name: 'Goles visitante',
      type: 'sports_data',
      binding: 'match.awayScore',
      required: true,
      style: { ...SCORE_STYLE, align: 'left' },
      ...box(0.55, 0.55, 0.25, 0.12),
    },
  ] as VisualTemplateLayer[];
}

/** Approves the proposal, makes it a template with the reference layers and publishes its first version. */
async function publishedTemplate(t: TestApp, proposalId: string): Promise<VisualTemplateVersion> {
  await ok(t.send('POST', `/design/proposals/${proposalId}/decisions`, { decision: 'approved' }));
  const detail = VisualTemplateDetailSchema.parse(
    await ok(t.send('POST', '/visual-templates', { sourceProposalId: proposalId, name: 'Resultado sintético' })),
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
        layers: resultLayers(),
      }),
    ),
  );
  expect(saved.validation.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  return VisualTemplateVersionSchema.parse(
    await ok(
      t.send('POST', `/visual-templates/${templateId}/versions/${draftId}/release`, { revision: saved.revision }),
    ),
  );
}
