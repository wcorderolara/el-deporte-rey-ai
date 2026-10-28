/**
 * The multi-competition demonstration with deterministic recorded responses (R-290; OD-22), and person data from the
 * provider (R-280):
 * - with the committed `config/live.config.json` (DEMO_DATA, MANUAL_DATA and the LIVE_DATA provider source; replayed
 *   responses and the synthetic marker token only), the same workflow code takes two distinct LIVE_DATA competitions
 *   (the reference-shaped one and the league), one imported MANUAL_DATA competition and one DEMO_DATA competition
 *   through selection, retrieval, provenance and status review, content generation and preview (rendered slides);
 *   publication eligibility follows the verification rules of each mode. Element approval and export are T37 and T38,
 *   not implemented at this base, and are reported BLOCKED; the live confirmation with a real token is T53's;
 * - person data in a recorded response (referees, coaches) is absent from the domain representation, the projection
 *   cache, the stored data, the API responses and the logs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CatalogueSchema, type Fact } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { ADAPTER_REGISTRATIONS } from '../../../src/providers/sports/adapters/index.js';
import type { AdapterRegistration, IngestionSource } from '../../../src/providers/sports/index.js';
import {
  type Json,
  PERSON_MARKER_PREFIX,
  type ProjectSelection,
  expectNoNetworkViolations,
  fixtureConfigDocument,
  testLiveAdapter,
} from '../../support/index.js';

import {
  LIVE_SOURCE_ID,
  REFERENCE,
  SECOND,
  SECOND_ID,
  cleanups,
  committedLiveDocument,
  importApplied,
  liveSource,
  recorded,
  sampleRequest,
  scriptedReplay,
  snapshotFor,
  startLive,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const STAGES = ['research', 'verification', 'content', 'rendering', 'visual_qa'];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('multi-competition demonstration with recorded responses (R-290)', () => {
  it('two LIVE_DATA, one MANUAL_DATA and one DEMO_DATA competition go through the same workflow', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress, { base: committedLiveDocument() });
    await importApplied(t, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));

    // Selection: every competition is offered by the one catalogue with its source and mode.
    const catalogue = CatalogueSchema.parse((await t.get('/catalog/competitions')).json());
    const referenceLink = catalogue.competitions.find(
      (entry) => entry.reference && entry.sources.some((source) => source.sourceId === LIVE_SOURCE_ID),
    );
    expect(referenceLink).toBeDefined();
    const selections: readonly (readonly [string, ProjectSelection])[] = [
      [
        'LIVE_DATA',
        {
          competitionId: String(referenceLink?.id),
          sourceId: LIVE_SOURCE_ID,
          seasonId: '2026',
          stageId: 'league-stage',
          matchday: 1,
        },
      ],
      [
        'LIVE_DATA',
        {
          competitionId: SECOND_ID,
          sourceId: LIVE_SOURCE_ID,
          seasonId: '2026',
          stageId: 'regular-season',
          matchday: 1,
        },
      ],
      [
        'MANUAL_DATA',
        {
          competitionId: 'manual-liga-manual',
          sourceId: 'manual',
          seasonId: '2026',
          stageId: 'torneo-apertura',
          matchday: 1,
        },
      ],
      [
        'DEMO_DATA',
        { competitionId: 'liga-demo', sourceId: 'demo-a', seasonId: '2026', stageId: 'temporada-regular', matchday: 1 },
      ],
    ];
    for (const [mode, selection] of selections) {
      const entry = catalogue.competitions.find((competition) => competition.id === selection.competitionId);
      expect(
        entry?.sources.find((source) => source.sourceId === selection.sourceId),
        selection.competitionId,
      ).toMatchObject({
        mode,
        selectable: true,
      });
    }
    expect(new Set(selections.filter(([mode]) => mode === 'LIVE_DATA').map(([, s]) => s.competitionId)).size).toBe(2);

    const stageLists: string[][] = [];
    for (const [mode, selection] of selections) {
      const label = `${mode} ${selection.competitionId}`;
      const project = await t.createProject(selection);
      expect(project, label).toMatchObject({
        dataMode: mode,
        demonstration: mode === 'DEMO_DATA',
        sourceId: selection.sourceId,
      });
      const run = await t.runWorkflow(project.id);
      expect(run.status, `${label} ${JSON.stringify(run.failure)}`).toBe('completed');
      stageLists.push(run.stages.map((stage) => `${stage.stage}:${stage.status}`));

      // Retrieval: research retrieved the selection from the chosen source, in its mode.
      const retrievals = t.container.db
        .prepare<{ source_id: string; data_mode: string; outcome: string }>(
          "SELECT source_id, data_mode, outcome FROM retrievals WHERE run_id = ? AND stage = 'research'",
        )
        .all([run.id]) as { source_id: string; data_mode: string; outcome: string }[];
      expect(retrievals.length, label).toBeGreaterThan(0);
      expect(
        retrievals.every(
          (row) => row.source_id === selection.sourceId && row.data_mode === mode && row.outcome === 'ok',
        ),
      ).toBe(true);

      // Provenance and status review.
      const facts = await t.listFacts(project.id, run.id);
      expect(facts.dataMode).toBe(mode);
      expect(facts.facts.filter((fact) => fact.kind === 'match_score').length, label).toBeGreaterThan(0);
      expect(
        facts.facts.every((fact) => fact.evidence.length > 0 && fact.evidence.every((e) => e.dataMode === mode)),
      ).toBe(true);
      const statuses = new Set(facts.facts.map((fact) => `${fact.status}/${String(fact.unverifiedReason)}`));
      const expected = {
        LIVE_DATA: 'unverified/awaiting_independent_verification',
        MANUAL_DATA: 'unverified/no_accepted_source',
        DEMO_DATA: 'verified/null',
      }[mode as 'LIVE_DATA' | 'MANUAL_DATA' | 'DEMO_DATA'];
      expect(statuses, label).toEqual(new Set([expected]));

      // Content generation and preview: a draft with slides rendered as PNG files.
      const versions = t.container.db
        .prepare<{ image_path: string | null; width: number | null; height: number | null }>(
          'SELECT v.image_path, v.width, v.height FROM element_versions v JOIN elements e ON e.id = v.element_id ' +
            'JOIN carousels c ON c.id = e.carousel_id JOIN content_drafts d ON d.id = c.draft_id WHERE d.run_id = ?',
        )
        .all([run.id]) as { image_path: string | null; width: number | null; height: number | null }[];
      const images = versions.filter((version) => version.image_path !== null);
      expect(images.length, label).toBeGreaterThan(0);
      for (const image of images) {
        expect([image.width, image.height]).toEqual([1080, 1350]);
        const bytes = readFileSync(join(t.config.dataDir, String(image.image_path)));
        expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), label).toBe(true);
      }

      // Approval as far as the verification rules allow (R-055, R-071, R-078): only DEMO_DATA facts are publishable;
      // the single LIVE_DATA source and the MANUAL_DATA facts (unmarked competition) stay blocked.
      if (mode === 'DEMO_DATA') {
        expect(
          facts.facts.filter((fact) => fact.blockReason !== undefined),
          label,
        ).toEqual([]);
      } else {
        expect(new Set(facts.facts.map((fact) => fact.blockReason)), label).toEqual(new Set(['not_verified']));
      }
      if (mode === 'MANUAL_DATA') {
        const score = facts.facts.find((fact) => fact.kind === 'match_score') as Fact;
        const approved = await t.send(
          'PUT',
          `/projects/${project.id}/runs/${run.id}/facts/${score.factId}/manual-approval`,
        );
        expect(approved.statusCode).toBe(200);
        expect(approved.json()).toMatchObject({
          status: 'manually_approved',
          blockReason: 'manually_approved_not_publishable',
        });
      }
    }
    // The same workflow code: the same stages, all completed, for every mode and competition.
    expect(stageLists).toEqual(selections.map(() => STAGES.map((stage) => `${stage}:completed`)));
    const projects = (await t.get('/projects')).json() as { projects: { dataMode: string }[] };
    expect(projects.projects.map((project) => project.dataMode).sort()).toEqual([
      'DEMO_DATA',
      'LIVE_DATA',
      'LIVE_DATA',
      'MANUAL_DATA',
    ]);
    // Only the LIVE_DATA source used the (replayed) network, for both LIVE_DATA competitions.
    expect(egress.unmatched).toEqual([]);
    const codes = new Set(egress.calls.map((call) => call.pathname.split('/')[3]).filter((code) => code !== undefined));
    expect(codes).toEqual(new Set([REFERENCE.code, SECOND.code]));
    expectNoNetworkViolations();
  });
});

describe('person data in a recorded provider response (R-280)', () => {
  it('is absent from the domain representation, the cache, the stored data, the responses and the logs', async () => {
    const response = recorded('cl-matches-2026-md1.json');
    expect(response.text).toContain(PERSON_MARKER_PREFIX);
    expect(response.text).toMatch(/"referees"/);

    // The production LIVE_DATA adapter, registered again under a test-only kind through the test seam so that the
    // test can read its projection cache (the source registry exposes only the validating wrapper).
    const kind = String(liveSource(fixtureConfigDocument('live'))['adapter']);
    const production = ADAPTER_REGISTRATIONS.find((registration) => registration.kind === kind);
    expect(production?.mode).toBe('LIVE_DATA');
    const instances: IngestionSource[] = [];
    const capturing: AdapterRegistration = {
      kind: 'capturing-live',
      mode: 'LIVE_DATA',
      create: (context) => {
        const instance = (production as AdapterRegistration).create(context);
        instances.push(instance);
        return instance;
      },
    };
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress, {
      extraAdapters: [testLiveAdapter, capturing],
      mutate: (document) => {
        liveSource(document)['adapter'] = capturing.kind;
      },
    });
    expect(instances).toHaveLength(1);
    const selection: ProjectSelection = {
      competitionId: 'copa-continental',
      sourceId: LIVE_SOURCE_ID,
      seasonId: '2026',
      stageId: 'league-stage',
      matchday: 1,
    };
    const snapshot = await snapshotFor(t, selection);
    expect(JSON.stringify(snapshot)).not.toContain(PERSON_MARKER_PREFIX);
    expect(JSON.stringify(snapshot)).not.toMatch(/referee|coach|scorer|squad|lineup/i);

    const project = await t.createProject(selection);
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await t.get(`/projects/${project.id}/runs/${run.id}/facts`);
    expect(egress.calls.some((call) => call.query['matchday'] === '1' && call.pathname.endsWith('/matches'))).toBe(
      true,
    );

    const source = instances[0] as unknown as { cacheEntries?: () => readonly Json[] };
    expect(typeof source.cacheEntries).toBe('function');
    const cache = JSON.stringify(source.cacheEntries?.() ?? null);
    expect(cache.length).toBeGreaterThan(1000);
    for (const [where, text] of [
      ['cache', cache],
      ['database', t.databaseText()],
      ['facts response', facts.body],
      ['logs', t.log.text()],
    ] as const) {
      expect(text, where).not.toContain(PERSON_MARKER_PREFIX);
    }
  });
});
