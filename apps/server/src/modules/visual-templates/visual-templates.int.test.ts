/**
 * Integration tests of the structured visual templates (PD-ARCH-01G-C) on a temporary app. Design proposals are made
 * with the `openai` image adapter over a scripted egress client (no connection, no credit used); every template
 * operation is then checked to send nothing to the image provider. Covered: conversion of an approved proposal,
 * drafts and validation, release and immutability (API and database), new versions, archive and deletion, recovery
 * after a restart, the dependencies on brand assets and proposals, the background, previews with local sports data
 * drawn by the slide engine, protected assets drawn from their original file, and the unchanged built-in templates.
 */
import { createHash } from 'node:crypto';

import { renderAsync } from '@resvg/resvg-js';
import {
  BrandAssetDetailSchema,
  BrandAssetSchema,
  DesignGenerationStartSchema,
  VisualTemplateDetailSchema,
  VisualTemplateListSchema,
  VisualTemplatePreviewSchema,
  VisualTemplateSchema,
  VisualTemplateVersionSchema,
  type BrandAsset,
  type VisualTemplateLayer,
  type VisualTemplateVersion,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import {
  type Json,
  type ScriptedImageEgress,
  type TestApp,
  scriptedImageEgress,
  startTestApp,
  testImageProviderConfig,
} from '../../../test/support/index.js';
import { png } from '../brand/test/images.js';
import { designServiceOf } from '../design/index.js';
import { pngSize } from '../rendering/index.js';

const apps: TestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

interface TemplateApp {
  readonly app: TestApp;
  readonly egress: ScriptedImageEgress;
}

async function start(options: { dataDir?: string } = {}): Promise<TemplateApp> {
  const egress = scriptedImageEgress();
  const app = await startTestApp({
    mutate: (document: Json) => {
      (document['providers'] as Json)['images'] = testImageProviderConfig() as Json;
    },
    imageEgress: egress,
    env: { EDR_IMAGE_API_KEY: TEST_DUMMY_API_KEY },
    ...(options.dataDir === undefined ? {} : { dataDir: options.dataDir }),
  });
  apps.push(app);
  return { app, egress };
}

function imageRequests(egress: ScriptedImageEgress): number {
  return egress.requests.length;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

let pixel = 0;

async function asset(
  app: TestApp,
  query: Record<string, string>,
  rgba: [number, number, number, number] = [(pixel += 1) % 255, 80, 120, 255],
  size = 64,
): Promise<BrandAsset> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/brand/assets',
    query,
    headers: { host: app.host, origin: app.origin, 'x-edr-client': 'web', 'content-type': 'image/png' },
    payload: png({ width: size, height: size, rgba }),
  });
  expect(response.statusCode, response.body).toBe(201);
  return BrandAssetSchema.parse(response.json());
}

let key = 0;

/** A completed proposal of a scripted generation, approved unless told otherwise. */
async function proposal(
  app: TestApp,
  body: Record<string, unknown> = {},
  decision: 'approved' | null = 'approved',
): Promise<string> {
  key += 1;
  const started = await app.send('POST', '/design/generations', {
    contentType: 'match_preview',
    format: '4:5',
    quality: 'low',
    count: 1,
    references: [],
    requestKey: `00000000-0000-4000-8000-${String(950_000 + key).padStart(12, '0')}`,
    confirmCost: true,
    ...body,
  });
  expect(started.statusCode, started.body).toBe(202);
  const { generation } = DesignGenerationStartSchema.parse(started.json());
  await designServiceOf(app.container).settled(generation.id);
  const done = (await app.get(`/design/generations/${generation.id}`)).json() as { proposalIds: string[] };
  const id = done.proposalIds[0] ?? '';
  if (decision !== null) {
    const decided = await app.send('POST', `/design/proposals/${id}/decisions`, { decision });
    expect(decided.statusCode, decided.body).toBe(200);
  }
  return id;
}

async function create(app: TestApp, body: Record<string, unknown>) {
  const response = await app.send('POST', '/visual-templates', { name: 'Previa nocturna', ...body });
  expect(response.statusCode, response.body).toBe(201);
  return VisualTemplateDetailSchema.parse(response.json());
}

async function version(app: TestApp, templateId: string, versionId: string): Promise<VisualTemplateVersion> {
  const response = await app.get(`/visual-templates/${templateId}/versions/${versionId}`);
  expect(response.statusCode, response.body).toBe(200);
  return VisualTemplateVersionSchema.parse(response.json());
}

async function save(
  app: TestApp,
  current: VisualTemplateVersion,
  layers: readonly VisualTemplateLayer[],
  background = { source: current.background.source, id: current.background.id },
) {
  return app.send('PUT', `/visual-templates/${current.templateId}/versions/${current.id}`, {
    revision: current.revision,
    background,
    layers,
  });
}

const STYLE = {
  fontRole: 'heading',
  maxFontSize: 56,
  minFontSize: 28,
  maxLines: 2,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
} as const;

function text(id: string, value: string, y = 0.05): VisualTemplateLayer {
  return { id, name: id, type: 'text', text: value, x: 0.1, y, width: 0.8, height: 0.08, visible: true, style: STYLE };
}

function data(id: string, binding: string, y: number, required = false): VisualTemplateLayer {
  return {
    id,
    name: id,
    type: 'sports_data',
    binding,
    required,
    x: 0.1,
    y,
    width: 0.8,
    height: 0.08,
    visible: true,
    style: STYLE,
  } as VisualTemplateLayer;
}

/** Local Competiciones data: a competition, a season, two teams, a round and a scheduled match. */
async function sportsData(app: TestApp) {
  const ok = async (method: 'POST', path: string, body: unknown) => {
    const response = await app.send(method, path, body);
    expect(response.statusCode, response.body).toBeLessThan(300);
    return response.json() as { id: string };
  };
  const competition = await ok('POST', '/competitions', { name: 'Liga de plantillas' });
  const season = await ok('POST', `/competitions/${competition.id}/seasons`, { label: '2026/27' });
  const base = `/competitions/${competition.id}/seasons/${season.id}`;
  const teams: string[] = [];
  for (const name of ['Club Plantilla Local', 'Club Plantilla Visitante']) {
    const team = await ok('POST', '/teams', { name });
    await ok('POST', `/competitions/${competition.id}/teams`, { teamId: team.id });
    await ok('POST', `${base}/participants`, { teamId: team.id });
    teams.push(team.id);
  }
  const round = await ok('POST', `${base}/rounds`, { name: 'Jornada 9' });
  const match = await ok('POST', `${base}/matches`, {
    homeTeamId: teams[0],
    awayTeamId: teams[1],
    roundId: round.id,
    kickoffAt: '2027-05-10T18:00:00Z',
  });
  return { competitionId: competition.id, seasonId: season.id, roundId: round.id, matchId: match.id, base };
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

describe('conversion of an approved proposal', () => {
  it('creates a draft locally: pinned background, the original brand layers and the required data layers', async () => {
    const { app, egress } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo oficial', official: 'true' });
    const mascot = await asset(app, { kind: 'mascot', label: 'Ketsi', official: 'true' });
    const proposalId = await proposal(app, {
      references: [
        { assetId: logo.id, role: 'reserved_placement' },
        { assetId: mascot.id, role: 'reserved_placement' },
      ],
    });
    const before = imageRequests(egress);
    const assetsBefore = (await app.get('/brand/assets')).body;

    const detail = await create(app, { sourceProposalId: proposalId, category: 'Previas' });
    expect(detail.template).toMatchObject({
      status: 'draft',
      contentType: 'match_preview',
      format: '4:5',
      sourceProposalId: proposalId,
      category: 'Previas',
      publishedVersion: null,
      versionCount: 1,
    });
    const draft = await version(app, detail.template.id, detail.template.draftVersionId ?? '');
    const background = (await app.get(`/design/proposals/${proposalId}/background`)).rawPayload;
    expect(draft).toMatchObject({ version: 1, status: 'draft', revision: 1, canvasWidth: 1080, canvasHeight: 1350 });
    expect(draft.background).toMatchObject({ source: 'design_proposal', id: proposalId, sha256: sha256(background) });
    expect(draft.layers.map((layer) => [layer.id, layer.type])).toEqual([
      ['logo', 'brand_asset'],
      ['mascot', 'brand_asset'],
      ['home-team', 'sports_data'],
      ['away-team', 'sports_data'],
    ]);
    const logoLayer = draft.layers[0];
    expect(logoLayer).toMatchObject({ assetId: logo.id });
    // The zone of the logo in the proposal (36 %, 3 %, 28 % x 12 %), within a pixel of the proposal.
    expect(logoLayer?.x).toBeCloseTo(0.36, 2);
    expect(logoLayer?.y).toBeCloseTo(0.03, 2);
    expect(logoLayer?.width).toBeCloseTo(0.28, 2);
    expect(logoLayer?.height).toBeCloseTo(0.12, 2);
    expect(draft.assets.map((ref) => [ref.assetId, ref.sha256, ref.usagePolicy])).toEqual([
      [logo.id, logo.sha256, 'protected'],
      [mascot.id, mascot.sha256, 'protected'],
    ]);
    expect(draft.bindings).toEqual(['match.homeTeam.name', 'match.awayTeam.name']);
    expect(draft.validation.publishable).toBe(true);
    expect(draft.validation.issues.map((issue) => issue.code)).toContain('BACKGROUND_REVIEW');
    const file = await app.get(`/visual-templates/${detail.template.id}/versions/${draft.id}/background`);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(sha256(file.rawPayload)).toBe(draft.background.sha256);
    expect(imageRequests(egress)).toBe(before);
    expect((await app.get('/brand/assets')).body).toBe(assetsBefore);
  });

  it('makes a template of another content type from the same background when the operator chooses it (01G-C-1)', async () => {
    const { app, egress } = await start();
    const proposalId = await proposal(app);
    const before = imageRequests(egress);
    const detail = await create(app, { sourceProposalId: proposalId, contentType: 'match_result', name: 'Resultado' });
    expect(detail.template).toMatchObject({ contentType: 'match_result', format: '4:5', sourceProposalId: proposalId });
    const draft = await version(app, detail.template.id, detail.template.draftVersionId ?? '');
    expect(draft.bindings).toEqual(['match.homeTeam.name', 'match.awayTeam.name', 'match.score']);
    expect(draft.validation.issues.map((issue) => issue.code)).not.toContain('BINDING_NOT_ALLOWED');
    expect(draft.validation.publishable).toBe(true);
    const preview = await create(app, { sourceProposalId: proposalId });
    expect(preview.template.contentType).toBe('match_preview');
    expect(imageRequests(egress)).toBe(before);
  });

  it('makes cover and closing templates for the engine slide types, with optional starter layers (01G-D-3)', async () => {
    const { app, egress } = await start();
    const proposalId = await proposal(app);
    const before = imageRequests(egress);
    const cover = await create(app, { sourceProposalId: proposalId, contentType: 'cover', name: 'Portada' });
    expect(cover.template.contentType).toBe('cover');
    const coverDraft = await version(app, cover.template.id, cover.template.draftVersionId ?? '');
    expect(coverDraft.bindings).toEqual(['competition.name', 'round.name']);
    expect(coverDraft.layers.map((layer) => layer.type === 'sports_data' && layer.required)).toContain(false);
    expect(coverDraft.layers.filter((layer) => layer.type === 'sports_data').every((layer) => !layer.required)).toBe(
      true,
    );
    expect(coverDraft.validation.publishable).toBe(true);

    const closing = await create(app, { sourceProposalId: proposalId, contentType: 'closing', name: 'Cierre' });
    const closingDraft = await version(app, closing.template.id, closing.template.draftVersionId ?? '');
    expect(closingDraft.bindings).toEqual([]);
    expect(closingDraft.layers.filter((layer) => layer.type === 'text').map((layer) => layer.name)).toEqual([
      'Texto de cierre',
    ]);
    expect(closingDraft.validation.publishable).toBe(true);

    // Nothing is required of a cover: a fixed text, or no layer at all (a warning only), can be released.
    const coverOnlyText = VisualTemplateVersionSchema.parse(
      (await save(app, coverDraft, [text('title', 'Jornada especial')])).json(),
    );
    expect(coverOnlyText.validation.issues.map((issue) => issue.code)).not.toContain('REQUIRED_BINDING_MISSING');
    expect(coverOnlyText.validation.publishable).toBe(true);
    const coverEmpty = VisualTemplateVersionSchema.parse((await save(app, coverOnlyText, [])).json());
    expect(coverEmpty.validation.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(coverEmpty.validation.issues).toContainEqual(
      expect.objectContaining({ code: 'NO_LAYERS', severity: 'warning' }),
    );
    expect(coverEmpty.validation.publishable).toBe(true);
    const closingEmpty = VisualTemplateVersionSchema.parse((await save(app, closingDraft, [])).json());
    expect(closingEmpty.validation.publishable).toBe(true);

    // Several variants of a cover live side by side, from the same background.
    const variant = await create(app, { sourceProposalId: proposalId, contentType: 'cover', name: 'Portada B' });
    const variantDraft = await version(app, variant.template.id, variant.template.draftVersionId ?? '');
    const released = await app.send(
      'POST',
      `/visual-templates/${variant.template.id}/versions/${variantDraft.id}/release`,
      { revision: variantDraft.revision },
    );
    expect(released.statusCode, released.body).toBe(200);
    const covers = (
      (await app.get('/visual-templates')).json() as { templates: { contentType: string; name: string }[] }
    ).templates
      .filter((template) => template.contentType === 'cover')
      .map((template) => template.name)
      .sort();
    expect(covers).toEqual(['Portada', 'Portada B']);

    // A team badge or a match value belongs to the match slides.
    const coverMatch = VisualTemplateVersionSchema.parse(
      (
        await save(app, coverEmpty, [
          data('round', 'round.name', 0.2, true),
          data('home', 'match.homeTeam.name', 0.4),
          {
            id: 'badge',
            name: 'Escudo',
            type: 'team_badge',
            binding: 'match.homeTeam.badge',
            x: 0.1,
            y: 0.6,
            width: 0.2,
            height: 0.15,
            visible: true,
          },
        ])
      ).json(),
    );
    expect(
      coverMatch.validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code),
    ).toEqual(['BINDING_NOT_ALLOWED', 'BINDING_NOT_ALLOWED']);
    expect(
      (
        await app.send('POST', '/visual-templates', {
          sourceProposalId: proposalId,
          name: 'Tabla',
          contentType: 'standings',
        })
      ).statusCode,
    ).toBe(400);
    expect(imageRequests(egress)).toBe(before);
  });

  it('previews a cover and a closing with the competition and season only; the round is optional', async () => {
    const { app } = await start();
    const proposalId = await proposal(app);
    const local = await sportsData(app);
    const previewOf = async (templateId: string, versionId: string, selection: Record<string, unknown>) =>
      app.send('POST', `/visual-templates/${templateId}/versions/${versionId}/previews`, { selection });
    const cover = await create(app, { sourceProposalId: proposalId, contentType: 'cover', name: 'Portada' });
    const withRound = await previewOf(cover.template.id, cover.template.draftVersionId ?? '', {
      competitionId: local.competitionId,
      seasonId: local.seasonId,
      roundId: local.roundId,
    });
    expect(withRound.statusCode, withRound.body).toBe(200);
    expect(VisualTemplatePreviewSchema.parse(withRound.json()).values).toEqual([
      { binding: 'competition.name', value: 'Liga de plantillas' },
      { binding: 'round.name', value: 'Jornada 9' },
    ]);
    // Without a round, the optional round value is left out and reported as a warning, never invented.
    const withoutRound = VisualTemplatePreviewSchema.parse(
      (
        await previewOf(cover.template.id, cover.template.draftVersionId ?? '', {
          competitionId: local.competitionId,
          seasonId: local.seasonId,
        })
      ).json(),
    );
    expect(withoutRound.values).toContainEqual({ binding: 'round.name', value: null });
    expect(withoutRound.issues.map((issue) => [issue.code, issue.severity])).toEqual([['VALUE_MISSING', 'warning']]);

    const closing = await create(app, { sourceProposalId: proposalId, contentType: 'closing', name: 'Cierre' });
    const closingPreview = await previewOf(closing.template.id, closing.template.draftVersionId ?? '', {
      competitionId: local.competitionId,
      seasonId: local.seasonId,
    });
    expect(closingPreview.statusCode, closingPreview.body).toBe(200);
    expect(VisualTemplatePreviewSchema.parse(closingPreview.json()).issues).toEqual([]);
  });

  it('refuses a proposal that is not approved or not found, and an own-prompt proposal without acknowledgement', async () => {
    const { app } = await start();
    const pending = await proposal(app, {}, null);
    const refused = await app.send('POST', '/visual-templates', { sourceProposalId: pending, name: 'X' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'TEMPLATE_SOURCE_REFUSED' });
    const unknown = await app.send('POST', '/visual-templates', {
      sourceProposalId: '00000000-0000-4000-8000-000000000999',
      name: 'X',
    });
    expect(unknown.statusCode).toBe(404);

    const own = await proposal(app, { mode: 'own_prompt', instructions: 'Un póster con el marcador.' });
    const unacknowledged = await app.send('POST', '/visual-templates', { sourceProposalId: own, name: 'X' });
    expect(unacknowledged.statusCode).toBe(409);
    expect(unacknowledged.json()).toMatchObject({ code: 'TEMPLATE_SOURCE_REFUSED' });
    const acknowledged = await create(app, { sourceProposalId: own, acknowledgeWarnings: true });
    const draft = await version(app, acknowledged.template.id, acknowledged.template.draftVersionId ?? '');
    expect(draft.validation.issues.map((issue) => issue.code)).toContain('BACKGROUND_OWN_PROMPT');
    expect(
      app.container.db
        .prepare<{ n: number }>('SELECT acknowledged_warnings AS n FROM visual_templates WHERE id = ?')
        .get([acknowledged.template.id])?.n,
    ).toBe(1);
  });
});

describe('drafts, release and versions', () => {
  it('saves by revision, keeps problems as validation issues and refuses duplicate IDs and stale revisions', async () => {
    const { app } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app) });
    const draft = await version(app, detail.template.id, detail.template.draftVersionId ?? '');
    const broken = [
      ...draft.layers,
      { ...text('out', 'FUERA'), x: 0.9 },
      data('unbound', 'competition.name', 0.6),
      { ...data('nobinding', 'competition.name', 0.7), binding: null } as VisualTemplateLayer,
    ];
    const saved = await save(app, draft, broken);
    expect(saved.statusCode, saved.body).toBe(200);
    const result = VisualTemplateVersionSchema.parse(saved.json());
    expect(result.revision).toBe(2);
    expect(result.validation.publishable).toBe(false);
    expect(
      result.validation.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => `${issue.layerId ?? ''}:${issue.code}`),
    ).toEqual(expect.arrayContaining(['out:OUT_OF_CANVAS', 'nobinding:BINDING_MISSING']));
    expect((await save(app, draft, draft.layers)).json()).toMatchObject({ code: 'VERSION_CONFLICT' });
    const duplicate = await save(app, result, [...draft.layers, text('dup', 'A'), text('dup', 'B', 0.2)]);
    expect(duplicate.statusCode).toBe(400);
    const tooMany = await save(
      app,
      result,
      Array.from({ length: 41 }, (_, index) => text(`t${String(index)}`, 'A')),
    );
    expect(tooMany.statusCode).toBe(400);
    const released = await app.send('POST', `/visual-templates/${detail.template.id}/versions/${draft.id}/release`, {
      revision: 2,
    });
    expect(released.statusCode).toBe(409);
    expect(released.json()).toMatchObject({ code: 'TEMPLATE_NOT_PUBLISHABLE' });
  });

  it('releases a valid draft as an immutable version (API and database) and copies it into a new draft', async () => {
    const { app, egress } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app) });
    const templateId = detail.template.id;
    const before = imageRequests(egress);
    const draft = await version(app, templateId, detail.template.draftVersionId ?? '');
    const saved = VisualTemplateVersionSchema.parse(
      (await save(app, draft, [...draft.layers, text('title', 'PREVIA')])).json(),
    );
    const stale = await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/release`, {
      revision: 1,
    });
    expect(stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
    const released = await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/release`, {
      revision: saved.revision,
    });
    expect(released.statusCode, released.body).toBe(200);
    const published = VisualTemplateVersionSchema.parse(released.json());
    expect(published).toMatchObject({ status: 'published', revision: saved.revision });
    expect(published.publishedAt).not.toBeNull();
    const template = VisualTemplateDetailSchema.parse(
      (await app.get(`/visual-templates/${templateId}`)).json(),
    ).template;
    expect(template).toMatchObject({
      status: 'published',
      draftVersionId: null,
      publishedVersion: { id: draft.id, version: 1 },
    });

    const edit = await save(app, published, [text('other', 'OTRA')]);
    expect(edit.statusCode).toBe(409);
    expect(edit.json()).toMatchObject({ code: 'TEMPLATE_VERSION_PUBLISHED' });
    expect(() =>
      app.container.db
        .prepare('UPDATE visual_template_versions SET layers_json = ? WHERE id = ?')
        .run(['[]', draft.id]),
    ).toThrow('immutable');
    expect(() => app.container.db.prepare('DELETE FROM visual_template_versions WHERE id = ?').run([draft.id])).toThrow(
      'immutable',
    );
    const discardPublished = await app.send('DELETE', `/visual-templates/${templateId}/versions/${draft.id}`);
    expect(discardPublished.json()).toMatchObject({ code: 'TEMPLATE_VERSION_PUBLISHED' });

    const next = await app.send('POST', `/visual-templates/${templateId}/versions`, {});
    expect(next.statusCode, next.body).toBe(201);
    const copy = VisualTemplateVersionSchema.parse(next.json());
    expect(copy).toMatchObject({ version: 2, status: 'draft', revision: 1, layers: published.layers });
    expect((await app.send('POST', `/visual-templates/${templateId}/versions`, {})).json()).toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    const changed = VisualTemplateVersionSchema.parse(
      (await save(app, copy, [...copy.layers, text('extra', 'NUEVA', 0.9)])).json(),
    );
    expect(changed.layers).toHaveLength(published.layers.length + 1);
    // The released version is unchanged by the new draft.
    const { validation: _validation, ...kept } = await version(app, templateId, draft.id);
    const { validation: _released, ...expected } = published;
    expect(kept).toEqual(expected);
    expect(imageRequests(egress)).toBe(before);
  });

  it('archives and restores, discards a draft, and deletes a template never released or archived (01G-D-4)', async () => {
    const { app } = await start();
    const proposalId = await proposal(app);
    const detail = await create(app, { sourceProposalId: proposalId });
    const templateId = detail.template.id;
    const draftId = detail.template.draftVersionId ?? '';
    const only = await app.send('DELETE', `/visual-templates/${templateId}/versions/${draftId}`);
    expect(only.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
    const draft = await version(app, templateId, draftId);
    await app.send('POST', `/visual-templates/${templateId}/versions/${draftId}/release`, { revision: draft.revision });
    const second = VisualTemplateVersionSchema.parse(
      (await app.send('POST', `/visual-templates/${templateId}/versions`, {})).json(),
    );
    expect((await app.send('DELETE', `/visual-templates/${templateId}/versions/${second.id}`)).statusCode).toBe(204);
    expect((await app.get(`/visual-templates/${templateId}/versions/${second.id}`)).statusCode).toBe(404);
    const third = VisualTemplateVersionSchema.parse(
      (await app.send('POST', `/visual-templates/${templateId}/versions`, {})).json(),
    );
    expect(third.version).toBe(3);

    const archived = VisualTemplateSchema.parse(
      (await app.send('POST', `/visual-templates/${templateId}/archive`)).json(),
    );
    expect(archived).toMatchObject({ status: 'archived' });
    expect((await app.send('PATCH', `/visual-templates/${templateId}`, { name: 'Otro' })).json()).toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    expect((await save(app, third, third.layers)).json()).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await app.get(`/visual-templates/${templateId}/versions/${draftId}`)).statusCode).toBe(200);
    const restored = VisualTemplateSchema.parse(
      (await app.send('POST', `/visual-templates/${templateId}/restore`)).json(),
    );
    expect(restored).toMatchObject({ status: 'published', archivedAt: null });
    const renamed = await app.send('PATCH', `/visual-templates/${templateId}`, {
      name: 'Previa de jornada',
      category: null,
    });
    expect(VisualTemplateSchema.parse(renamed.json())).toMatchObject({ name: 'Previa de jornada', category: null });
    expect((await app.send('DELETE', `/visual-templates/${templateId}`)).json()).toMatchObject({
      code: 'TEMPLATE_IN_USE',
    });

    const unreleased = await create(app, { sourceProposalId: proposalId, name: 'Borrador' });
    expect((await app.send('DELETE', `/visual-templates/${unreleased.template.id}`)).statusCode).toBe(204);
    const list = VisualTemplateListSchema.parse((await app.get('/visual-templates')).json());
    expect(list.templates.map((template) => template.id)).toEqual([templateId]);

    // Archived, the published template can be deleted; its rows and published versions stay.
    await app.send('POST', `/visual-templates/${templateId}/archive`);
    expect((await app.send('DELETE', `/visual-templates/${templateId}`)).statusCode).toBe(204);
    expect(VisualTemplateListSchema.parse((await app.get('/visual-templates')).json()).templates).toEqual([]);
    expect(
      app.container.db
        .prepare<{ n: number }>(
          "SELECT count(*) AS n FROM visual_template_versions WHERE template_id = ? AND status = 'published'",
        )
        .get([templateId])?.n,
    ).toBe(1);
  });

  it('keeps templates, versions and their layers after a restart', async () => {
    const { app } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app), description: 'Estadio\nde noche' });
    const draft = await version(app, detail.template.id, detail.template.draftVersionId ?? '');
    const saved = VisualTemplateVersionSchema.parse(
      (await save(app, draft, [...draft.layers, text('title', 'PREVIA')])).json(),
    );
    const restarted = await start({ dataDir: app.container.paths.dataDir });
    const reread = await version(restarted.app, detail.template.id, draft.id);
    expect(reread).toEqual(saved);
    const template = VisualTemplateDetailSchema.parse(
      (await restarted.app.get(`/visual-templates/${detail.template.id}`)).json(),
    );
    expect(template.template.description).toBe('Estadio\nde noche');
  });
});

describe('dependencies and background', () => {
  it('refuses to delete a brand asset or a proposal a template uses; a deactivated asset becomes an error', async () => {
    const { app } = await start();
    const logo = await asset(app, { kind: 'brand_logo', label: 'Logo oficial', official: 'true' });
    const proposalId = await proposal(app, { references: [{ assetId: logo.id, role: 'reserved_placement' }] });
    const detail = await create(app, { sourceProposalId: proposalId });
    const usage = BrandAssetDetailSchema.parse((await app.get(`/brand/assets/${logo.id}`)).json()).usage;
    expect(usage).toEqual({ renderedVersions: 0, projects: 0, exports: 0, templates: 1 });
    const removeAsset = await app.send('DELETE', `/brand/assets/${logo.id}`);
    expect(removeAsset.statusCode).toBe(409);
    expect(removeAsset.json()).toMatchObject({ code: 'ASSET_IN_USE' });
    const removeProposal = await app.send('DELETE', `/design/proposals/${proposalId}`);
    expect(removeProposal.statusCode).toBe(409);
    expect(removeProposal.json()).toMatchObject({ code: 'PROPOSAL_IN_USE' });

    expect((await app.send('PATCH', `/brand/assets/${logo.id}`, { active: false })).statusCode).toBe(200);
    const draft = await version(app, detail.template.id, detail.template.draftVersionId ?? '');
    expect(draft.validation.publishable).toBe(false);
    expect(draft.validation.issues).toContainEqual(
      expect.objectContaining({ code: 'ASSET_INACTIVE', layerId: 'logo' }),
    );

    // Once the only template is deleted (never released), both can be deleted again.
    expect((await app.send('DELETE', `/visual-templates/${detail.template.id}`)).statusCode).toBe(204);
    expect((await app.send('DELETE', `/brand/assets/${logo.id}`)).statusCode).toBe(204);
    expect((await app.send('DELETE', `/design/proposals/${proposalId}`)).statusCode).toBe(204);
  });

  it('changes the background to a background of Mi marca, pinned by its hash, and refuses other assets', async () => {
    const { app } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app) });
    const draft = await version(app, detail.template.id, detail.template.draftVersionId ?? '');
    const wide = await asset(app, { kind: 'background', label: 'Estadio' }, [20, 30, 40, 255], 80);
    const reference = await asset(app, { kind: 'style_reference', label: 'Referencia' });
    const refused = await save(app, draft, draft.layers, { source: 'brand_asset', id: reference.id });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'TEMPLATE_SOURCE_REFUSED' });
    const protectedBackground = await asset(app, {
      kind: 'background',
      label: 'Fondo oficial',
      usagePolicy: 'protected',
    });
    expect(
      (await save(app, draft, draft.layers, { source: 'brand_asset', id: protectedBackground.id })).json(),
    ).toMatchObject({
      code: 'TEMPLATE_SOURCE_REFUSED',
    });
    const changed = VisualTemplateVersionSchema.parse(
      (await save(app, draft, draft.layers, { source: 'brand_asset', id: wide.id })).json(),
    );
    expect(changed.background).toMatchObject({
      source: 'brand_asset',
      id: wide.id,
      sha256: wide.sha256,
      label: 'Estadio',
    });
    expect(changed.validation.issues.map((issue) => issue.code)).toContain('BACKGROUND_ASPECT');
    expect(BrandAssetDetailSchema.parse((await app.get(`/brand/assets/${wide.id}`)).json()).usage.templates).toBe(1);
  });
});

describe('previews with local sports data', () => {
  it('resolves the values, reports missing ones and draws the engine PNG deterministically, with no image request', async () => {
    const { app, egress } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app) });
    const templateId = detail.template.id;
    const draft = await version(app, templateId, detail.template.draftVersionId ?? '');
    const local = await sportsData(app);
    const layers = [
      ...draft.layers,
      data('date', 'match.kickoffDate', 0.6),
      data('time', 'match.kickoffTime', 0.7),
      data('stage', 'stage.name', 0.8),
      data('status', 'match.status', 0.9, true),
    ];
    const saved = VisualTemplateVersionSchema.parse((await save(app, draft, layers)).json());
    const before = imageRequests(egress);
    const selection = { competitionId: local.competitionId, seasonId: local.seasonId, matchId: local.matchId };
    const response = await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
      selection,
    });
    expect(response.statusCode, response.body).toBe(200);
    const preview = VisualTemplatePreviewSchema.parse(response.json());
    expect(preview.values).toEqual([
      { binding: 'match.homeTeam.name', value: 'Club Plantilla Local' },
      { binding: 'match.awayTeam.name', value: 'Club Plantilla Visitante' },
      { binding: 'match.kickoffDate', value: '10 may 2027' },
      { binding: 'match.kickoffTime', value: expect.stringMatching(/^\d{2}:\d{2}$/u) as unknown as string },
      { binding: 'stage.name', value: null },
      { binding: 'match.status', value: 'Programado' },
    ]);
    expect(preview.issues).toEqual([
      expect.objectContaining({ code: 'VALUE_MISSING', severity: 'warning', layerId: 'stage' }),
    ]);
    expect(preview).toMatchObject({ width: 1080, height: 1350 });
    expect(preview.imageUrl).toContain(`revision=${String(saved.revision)}`);

    const first = await app.get(preview.imageUrl.replace('/api/v1', ''));
    expect(first.statusCode, first.body).toBe(200);
    expect(first.headers['content-type']).toBe('image/png');
    expect(pngSize(first.rawPayload)).toEqual({ width: 1080, height: 1350 });
    const second = await app.get(preview.imageUrl.replace('/api/v1', ''));
    expect(sha256(second.rawPayload)).toBe(sha256(first.rawPayload));

    // The values are the current effective values: a changed schedule is shown, never a cached one.
    expect(
      (await app.send('POST', `${local.base}/matches/${local.matchId}/result`, { status: 'postponed' })).statusCode,
    ).toBeLessThan(300);
    const postponed = VisualTemplatePreviewSchema.parse(
      (
        await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
          selection,
          language: 'en',
        })
      ).json(),
    );
    expect(postponed.values.find((value) => value.binding === 'match.status')?.value).toBe('Postponed');
    expect(postponed.values.find((value) => value.binding === 'match.kickoffDate')?.value).toBe('10 May 2027');

    const noMatch = await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
      selection: { competitionId: local.competitionId, seasonId: local.seasonId },
    });
    expect(noMatch.statusCode).toBe(400);
    const unknown = await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
      selection: { ...selection, matchId: '00000000-0000-4000-8000-000000000998' },
    });
    expect(unknown.statusCode).toBe(404);
    expect(imageRequests(egress)).toBe(before);
  });

  it('reports a required value the data lacks and a text that overflows with the real value', async () => {
    const { app } = await start();
    const detail = await create(app, {
      sourceProposalId: await proposal(app, { contentType: 'match_result' }),
    });
    const templateId = detail.template.id;
    const draft = await version(app, templateId, detail.template.draftVersionId ?? '');
    const local = await sportsData(app);
    const narrow = {
      ...data('home-narrow', 'match.homeTeam.name', 0.8),
      width: 0.1,
      style: { ...STYLE, maxLines: 1, overflow: 'fixed' },
    } as VisualTemplateLayer;
    await save(app, draft, [...draft.layers, narrow]);
    const preview = VisualTemplatePreviewSchema.parse(
      (
        await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
          selection: { competitionId: local.competitionId, seasonId: local.seasonId, matchId: local.matchId },
        })
      ).json(),
    );
    expect(preview.values.find((value) => value.binding === 'match.score')?.value).toBeNull();
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'VALUE_MISSING', severity: 'error', layerId: 'score' }),
        expect.objectContaining({ code: 'TEXT_OVERFLOW', severity: 'error', layerId: 'layer-home-narrow' }),
      ]),
    );
    expect(
      (
        await app.send('POST', `${local.base}/matches/${local.matchId}/result`, {
          status: 'finished',
          homeScore: 3,
          awayScore: 1,
        })
      ).statusCode,
    ).toBeLessThan(300);
    const finished = VisualTemplatePreviewSchema.parse(
      (
        await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
          selection: { competitionId: local.competitionId, seasonId: local.seasonId, matchId: local.matchId },
        })
      ).json(),
    );
    expect(finished.values.find((value) => value.binding === 'match.score')?.value).toBe('3-1');
  });

  it('previews a round calendar with one line per match of the round', async () => {
    const { app } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app, { contentType: 'round_overview' }) });
    const local = await sportsData(app);
    const preview = VisualTemplatePreviewSchema.parse(
      (
        await app.send(
          'POST',
          `/visual-templates/${detail.template.id}/versions/${detail.template.draftVersionId ?? ''}/previews`,
          {
            selection: { competitionId: local.competitionId, seasonId: local.seasonId, roundId: local.roundId },
          },
        )
      ).json(),
    );
    expect(preview.values).toEqual([
      { binding: 'round.fixtures', value: 'Club Plantilla Local vs Club Plantilla Visitante · 10 may 2027' },
    ]);
  });

  it('draws a protected asset from its original file, only scaled proportionally, even in a stretched box', async () => {
    const { app } = await start();
    const detail = await create(app, { sourceProposalId: await proposal(app) });
    const templateId = detail.template.id;
    const draft = await version(app, templateId, detail.template.draftVersionId ?? '');
    const seal = await asset(app, { kind: 'decoration', label: 'Sello', usagePolicy: 'protected' }, [255, 0, 0, 255]);
    const wide: VisualTemplateLayer = {
      id: 'seal',
      name: 'Sello',
      type: 'image',
      assetId: seal.id,
      fit: 'fill',
      x: 0,
      y: 0.5,
      width: 1,
      height: 0.1,
      visible: true,
    };
    const saved = VisualTemplateVersionSchema.parse((await save(app, draft, [...draft.layers, wide])).json());
    expect(saved.validation.issues).toContainEqual(
      expect.objectContaining({ code: 'ASSET_NOT_ALLOWED', layerId: 'seal' }),
    );
    const local = await sportsData(app);
    const preview = VisualTemplatePreviewSchema.parse(
      (
        await app.send('POST', `/visual-templates/${templateId}/versions/${draft.id}/previews`, {
          selection: { competitionId: local.competitionId, seasonId: local.seasonId, matchId: local.matchId },
        })
      ).json(),
    );
    const image = (await app.get(preview.imageUrl.replace('/api/v1', ''))).rawPayload;
    const pixel = await pixelsOf(image);
    // The box is 1080 x 135 pixels: the square asset is 135 pixels wide in its centre; its edges show the background.
    expect(pixel(540, 742)).toEqual([255, 0, 0]);
    expect(pixel(20, 742)).not.toEqual([255, 0, 0]);
  });
});

describe('compatibility', () => {
  it('keeps the built-in templates listed and rendered beside the visual templates', async () => {
    const { app } = await start();
    await create(app, { sourceProposalId: await proposal(app) });
    const builtIn = (await app.get('/templates')).json() as { templates: { id: string }[] };
    expect(builtIn.templates.map((template) => template.id)).toContain('match-preview');
    const preview = await app.get('/templates/match-preview/preview');
    expect(preview.statusCode).toBe(200);
    expect(pngSize(preview.rawPayload)).toEqual({ width: 1080, height: 1350 });
  });
});
