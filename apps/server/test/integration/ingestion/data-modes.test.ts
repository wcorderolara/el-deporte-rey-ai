/**
 * Data acquisition modes through the real server (R-257, R-266, R-267, R-268):
 * - the default configuration runs on DEMO_DATA without the provider token, makes no provider request and gives the
 *   same results on repeated runs;
 * - startup fails closed without the token for a LIVE-shaped configuration (naming the variable, never a value), stops
 *   on an unknown mode or another invalid setting, and needs no token when no LIVE_DATA source is enabled;
 * - the T23 equivalence matchday through FixtureDataProvider, ManualDataProvider (JSON file, CSV files, form) and
 *   FootballDataProvider (replayed responses) passes the one domain schema and is equal apart from mode, source
 *   metadata and timestamps (compared by name, OD-45);
 * - verification, content, rendering and visual QA run unchanged on the representation of every mode.
 *
 * LIVE-shaped runs use the scripted replay transport and the synthetic marker token only; no request leaves the
 * process, and the network guard of the shared setup fails any test that tries.
 */
import { join } from 'node:path';

import type { FactListResponse, Run, SelectionSnapshot } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import { comparableFromSnapshot } from '../../../../../fixtures/support.js';
import { buildEgressAllowList } from '../../../src/platform/net/index.js';
import {
  type Json,
  LIGA_DEMO_MD1,
  type ProjectSelection,
  REPO_ROOT,
  TOKEN_VARIABLE,
  type TestApp,
  expectNoNetworkViolations,
  expectNoProviderCredentials,
  readJson,
  refusingEgress,
  sourcesOf,
  temporaryDirectory,
  writeCatalogue,
} from '../../support/index.js';

import {
  LIVE_SOURCE_ID,
  REFERENCE,
  type ScriptedReplay,
  cleanups,
  committedLiveDocument,
  errorText,
  importApplied,
  liveSource,
  on,
  sampleRequest,
  scriptedReplay,
  snapshotFor,
  start,
  startLive,
  startupError,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

/** The committed default configuration `config/app.config.json`, as a document. */
function defaultDocument(): Json {
  return readJson<Json>(join(REPO_ROOT, 'config', 'app.config.json'));
}

/** The equivalence matchday of the reference-shaped competition, in each mode's catalogue. */
const EQUIVALENCE = Object.freeze({ seasonId: '2026', stageId: 'league-stage', matchday: 1 });
const LIVE_EQUIVALENCE: ProjectSelection = {
  competitionId: 'copa-continental',
  sourceId: LIVE_SOURCE_ID,
  ...EQUIVALENCE,
};
const MANUAL_EQUIVALENCE: ProjectSelection = {
  competitionId: 'manual-copa-continental',
  sourceId: 'manual',
  ...EQUIVALENCE,
};
const DEMO_EQUIVALENCE: ProjectSelection = { competitionId: 'copa-continental', sourceId: 'demo-a', ...EQUIVALENCE };

/** DEMO_DATA on the T23 equivalence scenario, demo-a and demo-b linked for the equivalence competition. */
async function startDemoEquivalence(): Promise<TestApp> {
  const dir = temporaryDirectory('t52-catalogue');
  cleanup.add(() => dir.remove());
  const linksFile = writeCatalogue(dir.path, {
    links: [
      {
        id: 'copa-continental',
        name: 'Copa Continental Sintética',
        reference: true,
        bindings: [
          { sourceId: 'demo-a', competitionRef: 'copa-continental' },
          { sourceId: 'demo-b', competitionRef: 'copa-continental' },
        ],
      },
    ],
    restrictToLinks: false,
  });
  return start(cleanup, {
    base: 'demo-only',
    scenario: 'equivalence',
    mutate: (document) => {
      document['catalogue'] = { linksFile };
    },
  });
}

async function startManualEquivalence(channel: 'json_file' | 'csv_file' | 'form'): Promise<TestApp> {
  const t = await start(cleanup, { base: 'demo-manual', scenario: 'default' });
  if (channel === 'json_file') {
    await importApplied(t, sampleRequest({ file: 'equivalence/equivalence.json', channel }));
  } else if (channel === 'csv_file') {
    await importApplied(t, sampleRequest({ file: 'equivalence/equivalence-matches.csv', channel }));
    await importApplied(t, sampleRequest({ file: 'equivalence/equivalence-standings.csv', channel }));
  } else {
    await importApplied(t, sampleRequest({ file: 'equivalence/equivalence.form.json', channel }));
  }
  return t;
}

/** Removes every member whose value differs by run (IDs and timestamps) and sorts lists, for repeat comparisons. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(stable)
      .map((entry) => JSON.stringify(entry))
      .sort();
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/(^id$|Id$|At$|^sourceRef$)/.test(key))
        .map(([key, entry]) => [key, stable(entry)]),
    );
  }
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value) ? '<time>' : value;
}

const STAGES = ['research', 'verification', 'content', 'rendering', 'visual_qa'];

/**
 * Timeout of a test that takes one or more projects through the whole workflow (research to visual QA, rendering every
 * slide); under the parallel load of `npm run test:integration` that can take longer than the default 5 seconds
 * (OD-62). The same value as WORKFLOW_TEST_TIMEOUT of the delivery support, defined here so that the ingestion suites
 * do not depend on the delivery support (which itself builds on the ingestion support).
 */
const WORKFLOW_TEST_TIMEOUT = 60_000;

// ---------------------------------------------------------------------------------------------------------------
// R-257
// ---------------------------------------------------------------------------------------------------------------

describe(
  'the default configuration runs on DEMO_DATA without the token (R-257)',
  { timeout: WORKFLOW_TEST_TIMEOUT },
  () => {
    it('selects DEMO_DATA, makes no provider request, and gives the same results on repeated runs', async () => {
      expectNoProviderCredentials();
      const results: unknown[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const egress = refusingEgress();
        const t = await start(cleanup, { base: defaultDocument(), egress });
        expect(t.container.config.providers.sports.sources.filter((source) => source.mode === 'LIVE_DATA')).toEqual([]);
        expect(buildEgressAllowList(t.container.config).isEmpty).toBe(true);
        const project = await t.createProject(LIGA_DEMO_MD1);
        expect(project).toMatchObject({ dataMode: 'DEMO_DATA', demonstration: true });
        const run = await t.runWorkflow(project.id);
        expect(run.status, JSON.stringify(run.failure)).toBe('completed');
        expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual(
          STAGES.map((name) => [name, 'completed']),
        );
        const facts = await t.listFacts(project.id, run.id);
        expect(facts.dataMode).toBe('DEMO_DATA');
        expect(facts.facts.length).toBeGreaterThan(0);
        const catalogue = (await t.get('/catalog/competitions')).json() as Json;
        results.push({ catalogue: stable(catalogue), facts: stable(facts), stages: stable(run.stages) });
        expect(egress.requests).toEqual([]);
        expect(t.egress.requests).toEqual([]);
        expectNoNetworkViolations();
      }
      expect(results[1]).toEqual(results[0]);
      expectNoProviderCredentials();
    });
  },
);

// ---------------------------------------------------------------------------------------------------------------
// R-266
// ---------------------------------------------------------------------------------------------------------------

describe('startup and the credential (R-266)', () => {
  it.each([
    [
      'fixtures/config/live.config.json',
      (): Json => readJson<Json>(join(REPO_ROOT, 'fixtures', 'config', 'live.config.json')),
    ],
    ['config/live.config.json', committedLiveDocument],
  ])('%s without the token fails, naming the variable and no value', async (_name, document) => {
    expectNoProviderCredentials();
    const environments: Readonly<Record<string, string>>[] = [
      {},
      { [TOKEN_VARIABLE]: '' },
      { [TOKEN_VARIABLE]: 'with space' },
    ];
    for (const env of environments) {
      const error = await startupError({ base: document(), env, egress: scriptedReplay() });
      expect(error, JSON.stringify(env)).not.toBeNull();
      const text = errorText(error);
      expect(text).toContain(TOKEN_VARIABLE);
      expect(text).not.toContain('with space');
      expect(text).not.toContain(TEST_MARKER_TOKEN);
    }
  });

  it('starts the same LIVE-shaped configuration with the synthetic marker token, without a request at startup', async () => {
    const egress = scriptedReplay();
    const t = await startLive(cleanup, egress);
    expect(t.container.sources.descriptors.map((source) => [source.id, source.mode])).toEqual([
      [LIVE_SOURCE_ID, 'LIVE_DATA'],
    ]);
    expect(egress.calls).toEqual([]);
    expect(process.env[TOKEN_VARIABLE]).toBeUndefined();
  });

  it('stops on an unknown data mode, naming the setting', async () => {
    const error = await startupError({
      base: 'demo-only',
      mutate: (document) => {
        (sourcesOf(document)[0] as Json)['mode'] = 'PRETEND_DATA';
      },
    });
    expect(errorText(error)).toContain('providers.sports.sources[0].mode');
    expect(errorText(error)).not.toContain('PRETEND_DATA');
  });

  it.each([
    ['requestsPerMinute', { requestsPerMinute: 0 }, 'options.requestsPerMinute'],
    ['a base URL on another origin', { baseUrl: 'https://provider.invalid/v4' }, 'options.baseUrl'],
  ])('stops on an invalid LIVE_DATA option (%s), naming it, with the token set', async (_name, options, setting) => {
    const error = await startupError({
      base: 'live',
      env: { [TOKEN_VARIABLE]: TEST_MARKER_TOKEN },
      egress: scriptedReplay(),
      mutate: (document) => {
        const source = liveSource(document);
        source['options'] = { ...(source['options'] as Json), ...options };
      },
    });
    expect(errorText(error)).toContain(setting);
    expect(errorText(error)).not.toContain(TEST_MARKER_TOKEN);
  });

  it('starts DEMO_DATA configurations and a LIVE configuration whose LIVE_DATA source is disabled without the token', async () => {
    expectNoProviderCredentials();
    for (const base of ['demo-only', 'demo-manual', defaultDocument()]) {
      const t = await start(cleanup, { base, egress: refusingEgress() });
      expect(t.container.sources.descriptors.every((source) => source.mode !== 'LIVE_DATA')).toBe(true);
    }
    const disabled = committedLiveDocument();
    liveSource(disabled)['enabled'] = false;
    const t = await start(cleanup, { base: disabled, egress: refusingEgress() });
    expect((await t.get('/catalog/competitions')).statusCode).toBe(200);
    expect(t.egress.requests).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-267
// ---------------------------------------------------------------------------------------------------------------

describe('one domain representation for every mode (R-267)', () => {
  it('the equivalence matchday from fixtures, manual JSON, CSV and form, and replayed provider responses is equal', async () => {
    const snapshots = new Map<string, SelectionSnapshot>();

    const demo = await startDemoEquivalence();
    snapshots.set('DEMO_DATA fixture', await snapshotFor(demo, DEMO_EQUIVALENCE));
    for (const channel of ['json_file', 'csv_file', 'form'] as const) {
      const manual = await startManualEquivalence(channel);
      snapshots.set(`MANUAL_DATA ${channel}`, await snapshotFor(manual, MANUAL_EQUIVALENCE));
    }
    const egress = scriptedReplay();
    const live = await startLive(cleanup, egress);
    snapshots.set('LIVE_DATA replay', await snapshotFor(live, LIVE_EQUIVALENCE));
    // The recorded variant without optional fields maps to the same representation.
    const reduced = scriptedReplay([
      on(
        `/competitions/${REFERENCE.code}/matches`,
        { season: '2026', matchday: '1' },
        'cl-matches-2026-md1-missing-optional.json',
      ),
      on(
        `/competitions/${REFERENCE.code}/standings`,
        { season: '2026', matchday: '1' },
        'cl-standings-2026-md1-missing-optional.json',
      ),
    ]);
    const liveReduced = await startLive(cleanup, reduced);
    snapshots.set('LIVE_DATA replay without optional fields', await snapshotFor(liveReduced, LIVE_EQUIVALENCE));

    const reference = comparableFromSnapshot(snapshots.get('LIVE_DATA replay') as SelectionSnapshot);
    expect(reference.matches).toHaveLength(18);
    expect(reference.standings).toHaveLength(36);
    for (const [name, snapshot] of snapshots) {
      expect(comparableFromSnapshot(snapshot), name).toEqual(reference);
      expect(
        snapshot.matches.every((match) => match.status === 'finished' && match.score !== null),
        name,
      ).toBe(true);
      expect(snapshot.standings.available, name).toBe(true);
    }
    // They differ only in mode, source metadata and timestamps.
    expect([...snapshots].map(([name, snapshot]) => [name, snapshot.mode])).toEqual([
      ['DEMO_DATA fixture', 'DEMO_DATA'],
      ['MANUAL_DATA json_file', 'MANUAL_DATA'],
      ['MANUAL_DATA csv_file', 'MANUAL_DATA'],
      ['MANUAL_DATA form', 'MANUAL_DATA'],
      ['LIVE_DATA replay', 'LIVE_DATA'],
      ['LIVE_DATA replay without optional fields', 'LIVE_DATA'],
    ]);
    expect(egress.unmatched).toEqual([]);
    expect(reduced.unmatched).toEqual([]);
    expectNoNetworkViolations();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-268
// ---------------------------------------------------------------------------------------------------------------

interface ModeRun {
  readonly t: TestApp;
  readonly projectId: string;
  readonly run: Run;
  readonly facts: FactListResponse;
}

async function runMode(t: TestApp, selection: ProjectSelection): Promise<ModeRun> {
  const project = await t.createProject(selection);
  const run = await t.runWorkflow(project.id);
  return { t, projectId: project.id, run, facts: await t.listFacts(project.id, run.id) };
}

function rowCount(t: TestApp, sql: string, runId: string): number {
  return (t.container.db.prepare<{ n: number }>(sql).get([runId]) as { n: number }).n;
}

describe('downstream stages run unchanged on every mode (R-268)', { timeout: WORKFLOW_TEST_TIMEOUT }, () => {
  it('verification, content, rendering and visual QA complete on the DEMO, MANUAL and LIVE representations', async () => {
    const egress: ScriptedReplay = scriptedReplay();
    const runs = new Map<string, ModeRun>([
      ['DEMO_DATA', await runMode(await startDemoEquivalence(), DEMO_EQUIVALENCE)],
      ['MANUAL_DATA', await runMode(await startManualEquivalence('json_file'), MANUAL_EQUIVALENCE)],
      ['LIVE_DATA', await runMode(await startLive(cleanup, egress), LIVE_EQUIVALENCE)],
    ]);
    const kinds = new Set<string>();
    for (const [mode, { t, run, facts }] of runs) {
      expect(run.status, `${mode} ${JSON.stringify(run.failure)}`).toBe('completed');
      expect(
        run.stages.map((stage) => [stage.stage, stage.status]),
        mode,
      ).toEqual(STAGES.map((name) => [name, 'completed']));
      // The same stage implementations in every app: the registered stages, with the same placeholders.
      expect(t.placeholders, mode).toEqual(runs.get('DEMO_DATA')?.t.placeholders);
      expect(facts.dataMode).toBe(mode);
      expect(
        facts.facts.filter((fact) => fact.kind === 'match_score'),
        mode,
      ).toHaveLength(18);
      expect(
        facts.facts.filter((fact) => fact.kind === 'standing_row'),
        mode,
      ).toHaveLength(36);
      const modeKinds = [...new Set(facts.facts.map((fact) => fact.kind))].sort();
      if (kinds.size === 0) {
        modeKinds.forEach((kind) => kinds.add(kind));
      }
      expect(modeKinds, mode).toEqual([...kinds].sort());
      expect(
        facts.facts.every((fact) => fact.evidence.every((evidence) => evidence.dataMode === mode)),
        mode,
      ).toBe(true);
      // Content and rendering produced their records for the run.
      expect(rowCount(t, 'SELECT count(*) AS n FROM content_drafts WHERE run_id = ?', run.id), mode).toBe(1);
      expect(
        rowCount(
          t,
          'SELECT count(*) AS n FROM element_versions v JOIN elements e ON e.id = v.element_id JOIN carousels c ON c.id = e.carousel_id JOIN content_drafts d ON d.id = c.draft_id WHERE d.run_id = ?',
          run.id,
        ),
        mode,
      ).toBeGreaterThan(0);
    }
    // Statuses follow the mode's sources, not a mode branch in the stages: two DEMO sources verify, the single
    // LIVE_DATA source awaits independent verification, and MANUAL_DATA has no accepted source.
    expect(new Set(runs.get('DEMO_DATA')?.facts.facts.map((fact) => fact.status))).toEqual(new Set(['verified']));
    expect(new Set(runs.get('LIVE_DATA')?.facts.facts.map((fact) => fact.unverifiedReason))).toEqual(
      new Set(['awaiting_independent_verification']),
    );
    expect(new Set(runs.get('MANUAL_DATA')?.facts.facts.map((fact) => fact.unverifiedReason))).toEqual(
      new Set(['no_accepted_source']),
    );
    expect(egress.unmatched).toEqual([]);
    expectNoNetworkViolations();
  });
});
