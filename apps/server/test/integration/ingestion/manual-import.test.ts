/**
 * Manual import end to end through the HTTP API, the real import pipeline (T50), ManualDataProvider, the catalogue,
 * research and verification (R-273 to R-280; OD-45):
 * - every T23 sample of `fixtures/manual/` is sent to `POST /imports` exactly as stored; each invalid sample is rejected
 *   with the problem, record and field its manifest entry names, and nothing of it is stored or offered (OD-45);
 * - the valid JSON, CSV and form samples give the same selections, compared by name because the keys differ by
 *   channel (OD-45, `fixtures/support.ts`);
 * - an applied import is selectable and researchable; its original is retrievable with the same SHA-256 and every fact
 *   traces to it; a reimport creates a new version used by later research, and a changed fact loses its manual
 *   approval; incomplete matches and missing standings are never filled; person-level fields are refused.
 *
 * Everything runs on temporary configurations and data directories with synthetic data; no request leaves the process.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Fact,
  type ImportError,
  type ManualImportDocument,
  ManualImportDocumentSchema,
  ManualSelectionHistorySchema,
  ManualVersionSchema,
  StageListSchema,
  SeasonListSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { comparableFromSnapshot } from '../../../../../fixtures/support.js';
import {
  type Json,
  PERSON_MARKER_PREFIX,
  type ProjectSelection,
  type TestApp,
  expectNoNetworkViolations,
} from '../../support/index.js';

import {
  type ManualSample,
  cleanups,
  importApplied,
  importCounts,
  importRejected,
  jsonImport,
  manualBytes,
  manualSamples,
  sampleRequest,
  snapshotFor,
  start,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

const MANUAL_SOURCE = 'manual';
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function manualApp(): Promise<TestApp> {
  return start(cleanup, { base: 'demo-manual', scenario: 'default' });
}

/** The liga-manual sample document (deep copy). */
function ligaManual(): ManualImportDocument {
  return ManualImportDocumentSchema.parse(JSON.parse(manualBytes('valid/liga-manual.json').toString('utf8')));
}

function selectionOf(document: ManualImportDocument, stageId: string, matchday: number | null): ProjectSelection {
  return {
    competitionId: `${MANUAL_SOURCE}-${document.competition.id}`,
    sourceId: MANUAL_SOURCE,
    seasonId: document.season.id,
    stageId,
    matchday,
  };
}

/** Directory entries of the originals directory of the data directory (empty when it does not exist). */
function storedOriginals(t: TestApp): string[] {
  const directory = join(t.config.dataDir, 'imports');
  return existsSync(directory) ? readdirSync(directory) : [];
}

async function catalogueIds(t: TestApp): Promise<string[]> {
  const response = await t.get('/catalog/competitions');
  expect(response.statusCode).toBe(200);
  return (response.json() as { competitions: { id: string }[] }).competitions.map((entry) => entry.id);
}

/** Expected (record, field) pairs of a manifest entry, in the pipeline's notation. */
function expectedLocations(sample: ManualSample): { record: string | null; field: string | null }[] {
  const record = sample.record ?? null;
  const field = sample.field ?? null;
  if (record !== null && /^rows? /.test(record)) {
    return record
      .replace(/^rows? /, '')
      .split(' and ')
      .map((row) => ({ record: row, field }));
  }
  if (field !== null && field.includes('.')) {
    // A dotted field (`competition.name`) is the member `name` of the record `/competition`.
    const parts = field.split('.');
    return [{ record: `/${parts.slice(0, -1).join('/')}`, field: parts.at(-1) ?? null }];
  }
  return [{ record, field }];
}

// ---------------------------------------------------------------------------------------------------------------
// OD-45: every sample of the T23 manifest through the real pipeline
// ---------------------------------------------------------------------------------------------------------------

describe('every invalid T23 sample is rejected by the real import pipeline (OD-45, R-273, R-274, R-280)', () => {
  const invalid = manualSamples().filter((sample) => !sample.valid);

  it('covers every invalid file of the manifest', () => {
    expect(invalid.length).toBe(20);
    expect(invalid.every((sample) => typeof sample.problem === 'string')).toBe(true);
  });

  it.each(invalid.map((sample) => [sample.file, sample] as const))(
    '%s: rejected with the expected problem, record and field; nothing stored',
    async (_file, sample) => {
      const t = await manualApp();
      if (sample.precondition !== undefined) {
        expect(sample.precondition).toContain('valid/liga-manual.json');
        await importApplied(t, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));
      }
      const before = importCounts(t);
      const originalsBefore = storedOriginals(t);
      const idsBefore = await catalogueIds(t);

      const problem = await importRejected(t, sampleRequest(sample));
      const errors: ImportError[] = problem.importErrors ?? [];
      expect(errors.length).toBeGreaterThan(0);
      expect(problem.detail).toContain(`${String(errors.length)} errors`);
      const location = sample.channel === 'form' ? 'form' : 'file';
      expect(errors.every((error) => error.location === location)).toBe(true);

      const expected = expectedLocations(sample);
      for (const { record, field } of expected) {
        const match = errors.find(
          (error) =>
            // control-character.csv: section 1.6 fixes no code; any rejection naming row 3 and home_team counts.
            (sample.file.endsWith('control-character.csv') || error.problem === sample.problem) &&
            (record === null || error.record === record) &&
            (field === null || error.field === field),
        );
        expect(match, `${sample.file}: ${JSON.stringify(errors)}`).toBeDefined();
      }
      if (sample.problem === 'duplicate_match') {
        // Both records are named (R-275): the duplicate and the record it duplicates.
        const duplicate = errors.find((error) => error.problem === 'duplicate_match');
        expect(duplicate?.message).toMatch(/\/selections\/0\/matches\/\d+/);
        expect(duplicate?.message).not.toContain(String(duplicate?.record));
      }

      // Nothing from a rejected import is stored or used (R-066, R-273, R-435).
      expect(importCounts(t)).toEqual(before);
      expect(storedOriginals(t)).toEqual(originalsBefore);
      expect(await catalogueIds(t)).toEqual(idsBefore);
      expect(t.databaseText()).not.toContain(PERSON_MARKER_PREFIX);
      expect(t.log.text()).not.toMatch(/scorer|edr-person-marker/i);
      expectNoNetworkViolations();
    },
  );
});

describe('valid T23 samples: JSON, CSV and form give the same selections by name (OD-45, R-267, R-276)', () => {
  it('applies every valid and equivalence sample, each with its channel, file name and declared source', async () => {
    for (const sample of manualSamples().filter((entry) => entry.valid)) {
      const t = await manualApp();
      if (sample.layout === 'standings') {
        // A standings file completes the matches already imported for its selections (section 1.6).
        const matches = sample.file.replace('-standings.csv', '-matches.csv');
        await importApplied(t, sampleRequest({ file: matches, channel: 'csv_file' }));
      }
      const summary = await importApplied(t, sampleRequest(sample, 'Synthetic bulletin'));
      expect(summary.channel).toBe(sample.channel);
      expect(summary.declaredSource).toBe('Synthetic bulletin');
      expect(summary.fileName).toBe(sample.channel === 'form' ? null : sample.file.split('/').pop());
      expect(summary.selections.length).toBeGreaterThan(0);
    }
  });

  it('liga-manual as JSON, as the CSV matches and standings files and as the form give equal snapshots', async () => {
    const document = ligaManual();
    const selections = document.selections.map((selection) =>
      selectionOf(document, selection.stage.id, selection.matchday),
    );

    const json = await manualApp();
    await importApplied(json, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));
    const csv = await manualApp();
    await importApplied(csv, sampleRequest({ file: 'valid/liga-manual-matches.csv', channel: 'csv_file' }));
    await importApplied(csv, sampleRequest({ file: 'valid/liga-manual-standings.csv', channel: 'csv_file' }));
    const form = await manualApp();
    await importApplied(form, sampleRequest({ file: 'valid/liga-manual.form.json', channel: 'form' }));

    expect(selections).toHaveLength(3);
    for (const selection of selections) {
      const fromJson = await snapshotFor(json, selection);
      const fromCsv = await snapshotFor(csv, selection);
      expect(fromJson.mode).toBe('MANUAL_DATA');
      expect(comparableFromSnapshot(fromCsv), JSON.stringify(selection)).toEqual(comparableFromSnapshot(fromJson));
    }
    // The form sample holds Torneo Apertura matchday 1 only.
    const first = selections[0] as ProjectSelection;
    expect(comparableFromSnapshot(await snapshotFor(form, first))).toEqual(
      comparableFromSnapshot(await snapshotFor(json, first)),
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-273, R-274
// ---------------------------------------------------------------------------------------------------------------

describe('schema rejection and complete error reports (R-273, R-274)', () => {
  it('reports every error of a JSON file together, each with its record, field and problem, and stores nothing', async () => {
    const t = await manualApp();
    const document = ligaManual() as unknown as Json;
    const selections = document['selections'] as Json[];
    const matches0 = (selections[0] as Json)['matches'] as Json[];
    const matches1 = (selections[1] as Json)['matches'] as Json[];
    delete (matches0[0] as Json)['kickoff'];
    ((matches0[1] as Json)['score'] as Json)['home'] = '3';
    ((matches1[2] as Json)['score'] as Json)['away'] = -1;

    const problem = await importRejected(t, jsonImport(document, 'jornada.json'));
    const errors = problem.importErrors ?? [];
    expect(errors.map((error) => [error.location, error.record, error.field, error.problem])).toEqual(
      expect.arrayContaining([
        ['file', '/selections/0/matches/0', 'kickoff', 'required_missing'],
        ['file', '/selections/0/matches/1/score', 'home', 'type_invalid'],
        ['file', '/selections/1/matches/2/score', 'away', 'value_out_of_range'],
      ]),
    );
    expect(problem.detail).toBe(`The import was rejected with ${String(errors.length)} errors; nothing was stored.`);
    // Messages are fixed texts with the expected form; no submitted value is echoed (T11H-F12).
    expect(errors.every((error) => error.message.length > 0 && !error.message.includes('-1'))).toBe(true);
    expect(importCounts(t)).toEqual({
      imports: 0,
      manual_selection_versions: 0,
      manual_competitions: 0,
      manual_seasons: 0,
    });
    expect(storedOriginals(t)).toEqual([]);
  });

  it('reports every row error of a CSV file together, naming the row number and the column', async () => {
    const t = await manualApp();
    const lines = manualBytes('valid/liga-manual-matches.csv').toString('utf8').split('\n');
    // Row 2: negative score; row 4: unknown status. Row numbers count the header as row 1.
    lines[1] = (lines[1] as string).replace(/,finished,0,4$/, ',finished,-1,4');
    lines[3] = (lines[3] as string).replace(',finished,', ',terminado,');
    const body = {
      channel: 'csv_file',
      fileName: 'jornada.csv',
      declaredSource: null,
      contentBase64: Buffer.from(lines.join('\n'), 'utf8').toString('base64'),
    };
    const problem = await importRejected(t, body);
    const errors = problem.importErrors ?? [];
    expect(errors.find((error) => error.record === '2')).toMatchObject({ location: 'file', field: 'home_score' });
    expect(errors.find((error) => error.record === '4')).toMatchObject({ location: 'file', field: 'status' });
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(importCounts(t)['imports']).toBe(0);
  });

  it('names the form as the location of every form error', async () => {
    const t = await manualApp();
    const document = ligaManual() as unknown as Json;
    ((((document['selections'] as Json[])[0] as Json)['matches'] as Json[])[0] as Json)['status'] = 'terminado';
    (document['season'] as Json)['label'] = '';
    const problem = await importRejected(t, { channel: 'form', declaredSource: null, document });
    const errors = problem.importErrors ?? [];
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.every((error) => error.location === 'form')).toBe(true);
    expect(errors.map((error) => error.record)).toEqual(expect.arrayContaining(['/selections/0/matches/0', '/season']));
    expect(importCounts(t)['imports']).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-275, R-276, R-277
// ---------------------------------------------------------------------------------------------------------------

/** The matches of a run's facts as "Home - Away h-a" (display texts), sorted. */
function matchLines(facts: readonly Fact[]): string[] {
  const byMatch = new Map<string, { teams?: string; score?: string }>();
  for (const fact of facts) {
    const key = fact.subject.matchKey;
    if (key === undefined) {
      continue;
    }
    const entry = byMatch.get(key) ?? {};
    if (fact.kind === 'match_teams') entry.teams = fact.display ?? '?';
    if (fact.kind === 'match_score') entry.score = fact.display ?? '?';
    byMatch.set(key, entry);
  }
  return [...byMatch.values()].map((entry) => `${entry.teams ?? '?'} ${entry.score ?? '-'}`).sort();
}

function documentMatchLines(document: ManualImportDocument, index: number): string[] {
  const selection = document.selections[index];
  if (selection === undefined) {
    throw new Error('selection missing');
  }
  const names = new Map(selection.teams.map((team) => [team.key, team.name]));
  return selection.matches
    .map(
      (match) =>
        `${String(names.get(match.home))} - ${String(names.get(match.away))} ` +
        (match.score === null ? '-' : `${String(match.score.home)}-${String(match.score.away)}`),
    )
    .sort();
}

describe('applied imports are selectable, researchable and traceable (R-275, R-276, R-277)', () => {
  it('offers the competition, its seasons and its stages, and research returns the imported data', async () => {
    const t = await manualApp();
    const document = ligaManual();
    await importApplied(t, sampleRequest({ file: 'valid/liga-manual.json', channel: 'json_file' }));
    const competitionId = `${MANUAL_SOURCE}-${document.competition.id}`;

    const catalogue = (await t.get('/catalog/competitions')).json() as {
      competitions: { id: string; name: string; sources: { sourceId: string; mode: string; selectable: boolean }[] }[];
    };
    const entry = catalogue.competitions.find((competition) => competition.id === competitionId);
    expect(entry).toMatchObject({ name: document.competition.name });
    expect(entry?.sources).toEqual([
      expect.objectContaining({ sourceId: MANUAL_SOURCE, mode: 'MANUAL_DATA', selectable: true }),
    ]);

    const seasons = SeasonListSchema.parse(
      (await t.get(`/catalog/competitions/${competitionId}/sources/${MANUAL_SOURCE}/seasons`)).json(),
    );
    expect(seasons.seasons.map((season) => [season.id, season.label])).toEqual([
      [document.season.id, document.season.label],
    ]);
    const stages = StageListSchema.parse(
      (
        await t.get(
          `/catalog/competitions/${competitionId}/sources/${MANUAL_SOURCE}/seasons/${document.season.id}/stages`,
        )
      ).json(),
    );
    expect(stages.stages.map((stage) => [stage.id, stage.name, stage.matchdays, stage.selectableAsWhole])).toEqual([
      ['torneo-apertura', 'Torneo Apertura', [1, 2], false],
      ['cuartos-de-final', 'Cuartos de Final', [], true],
    ]);

    const project = await t.createProject(selectionOf(document, 'torneo-apertura', 1));
    expect(project).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false, sourceId: MANUAL_SOURCE });
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await t.listFacts(project.id, run.id);
    expect(matchLines(facts.facts)).toEqual(documentMatchLines(document, 0));
    expect(facts.standings).toEqual({ available: true, reason: null });
    const rows = facts.facts.filter((fact) => fact.kind === 'standing_row');
    const imported = document.selections[0]?.standings?.rows ?? [];
    expect(rows).toHaveLength(imported.length);
    for (const row of imported) {
      const fact = rows.find(
        (candidate) => (candidate.candidateValue as { position: number } | null)?.position === row.position,
      );
      expect(fact?.candidateValue, String(row.position)).toMatchObject({
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      });
    }
  });

  it('keeps each original unchanged and linked to its import record; every fact traces to the import (R-277)', async () => {
    const t = await manualApp();
    const document = ligaManual();
    const uploads: { sample: Pick<ManualSample, 'file' | 'channel'>; exact: boolean }[] = [
      { sample: { file: 'valid/liga-manual.json', channel: 'json_file' }, exact: true },
      { sample: { file: 'valid/liga-manual-matches.csv', channel: 'csv_file' }, exact: true },
      { sample: { file: 'valid/liga-manual.form.json', channel: 'form' }, exact: false },
    ];
    const summaries = [];
    for (const { sample, exact } of uploads) {
      const summary = await importApplied(t, sampleRequest(sample, 'Synthetic league office bulletin'));
      summaries.push(summary);
      const record = await t.get(`/imports/${summary.id}`);
      expect(record.statusCode).toBe(200);
      expect(record.json()).toMatchObject({
        id: summary.id,
        channel: sample.channel,
        declaredSource: 'Synthetic league office bulletin',
        receivedAt: summary.receivedAt,
        originalSha256: summary.originalSha256,
      });
      const original = await t.get(`/imports/${summary.id}/original`);
      expect(original.statusCode).toBe(200);
      const bytes = original.rawPayload;
      expect(sha256(bytes)).toBe(summary.originalSha256);
      if (exact) {
        expect(Buffer.compare(bytes, manualBytes(sample.file))).toBe(0);
      } else {
        // The form is stored as its canonical serialization: the submitted document, unchanged.
        const body = JSON.parse(manualBytes(sample.file).toString('utf8')) as { document: unknown };
        expect(JSON.parse(bytes.toString('utf8'))).toEqual(body.document);
      }
    }

    const latest = summaries.at(-1);
    const project = await t.createProject(selectionOf(document, 'torneo-apertura', 1));
    const run = await t.runWorkflow(project.id);
    const facts = await t.listFacts(project.id, run.id);
    const version = latest?.selections.find((selection) => selection.matchday === 1);
    expect(version).toBeDefined();
    const evidence = facts.facts.flatMap((fact) => fact.evidence);
    expect(evidence.length).toBeGreaterThan(0);
    for (const item of evidence) {
      expect(item).toMatchObject({
        sourceId: MANUAL_SOURCE,
        dataMode: 'MANUAL_DATA',
        importVersionId: version?.versionId,
      });
      expect(item.sourceRef.startsWith(`import:${String(latest?.id)}/`)).toBe(true);
    }
    const retrievals = t.container.db
      .prepare<{ source_id: string; import_version_id: string | null }>(
        'SELECT source_id, import_version_id FROM retrievals WHERE run_id = ?',
      )
      .all([run.id]) as { source_id: string; import_version_id: string | null }[];
    expect(retrievals.length).toBeGreaterThan(0);
    expect(
      retrievals.every((row) => row.source_id === MANUAL_SOURCE && row.import_version_id === version?.versionId),
    ).toBe(true);
  });

  it('refuses a duplicated match and adds no second record when the same matches are imported again (R-275)', async () => {
    const t = await manualApp();
    const document = ligaManual();
    await importApplied(t, jsonImport(document, 'jornada.json'));
    const again = await importApplied(t, jsonImport(document, 'jornada-otra-vez.json'));
    expect(again.selections.find((selection) => selection.matchday === 1)?.versionNumber).toBe(2);

    const history = ManualSelectionHistorySchema.parse(
      (
        await t.get(`/manual-data/selections?competitionId=${document.competition.id}&seasonId=${document.season.id}`)
      ).json(),
    );
    const md1 = history.selections.find(
      (selection) => selection.stageId === 'torneo-apertura' && selection.matchday === 1,
    );
    expect(md1?.versions.filter((version) => version.current)).toHaveLength(1);
    const current = ManualVersionSchema.parse(
      (
        await t.get(`/manual-data/versions/${String(md1?.versions.find((version) => version.current)?.versionId)}`)
      ).json(),
    );
    expect(current.selection.matches).toHaveLength(document.selections[0]?.matches.length ?? -1);

    const project = await t.createProject(selectionOf(document, 'torneo-apertura', 1));
    const run = await t.runWorkflow(project.id);
    const facts = await t.listFacts(project.id, run.id);
    expect(facts.facts.filter((fact) => fact.kind === 'match_teams')).toHaveLength(4);
    expect(matchLines(facts.facts)).toEqual(documentMatchLines(document, 0));

    const duplicated = ligaManual();
    const first = duplicated.selections[0];
    if (first === undefined || first.matches[0] === undefined) {
      throw new Error('fixture shape');
    }
    first.matches.push({ ...first.matches[0] });
    const problem = await importRejected(t, jsonImport(duplicated, 'duplicada.json'));
    const error = (problem.importErrors ?? []).find((entry) => entry.problem === 'duplicate_match');
    expect(error?.record).toBe('/selections/0/matches/4');
    expect(error?.message).toContain('/selections/0/matches/0');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-278
// ---------------------------------------------------------------------------------------------------------------

describe('reimport creates a new version (R-278)', () => {
  it('later research uses the new version, the earlier one stays retrievable, a changed fact loses its approval', async () => {
    const t = await manualApp();
    const document = ligaManual();
    const v1 = await importApplied(t, jsonImport(document, 'jornada-v1.json'));
    const v1md1 = v1.selections.find(
      (selection) => selection.stageId === 'torneo-apertura' && selection.matchday === 1,
    );
    const project = await t.createProject(selectionOf(document, 'torneo-apertura', 1));
    const run1 = await t.runWorkflow(project.id);
    expect(run1.status).toBe('completed');
    const facts1 = await t.listFacts(project.id, run1.id);
    const scores1 = facts1.facts.filter((fact) => fact.kind === 'match_score');
    expect(scores1).toHaveLength(4);
    for (const fact of scores1) {
      expect(fact).toMatchObject({ status: 'unverified', unverifiedReason: 'no_accepted_source' });
      const approved = await t.send(
        'PUT',
        `/projects/${project.id}/runs/${run1.id}/facts/${fact.factId}/manual-approval`,
      );
      expect(approved.statusCode, approved.body).toBe(200);
    }

    // Correct the score of the first match of matchday 1 and import again.
    const corrected = ligaManual();
    const match = corrected.selections[0]?.matches[0];
    if (match?.score === null || match === undefined) {
      throw new Error('fixture shape');
    }
    const before = { ...match.score };
    match.score = { home: before.home + 1, away: before.away };
    const v2 = await importApplied(t, jsonImport(corrected, 'jornada-v2.json'));
    const v2md1 = v2.selections.find(
      (selection) => selection.stageId === 'torneo-apertura' && selection.matchday === 1,
    );
    expect(v2md1?.versionNumber).toBe(2);

    // The earlier version and its original remain retrievable.
    const old = ManualVersionSchema.parse((await t.get(`/manual-data/versions/${String(v1md1?.versionId)}`)).json());
    expect(old.supersededAt).not.toBeNull();
    expect(old.selection.matches[0]?.score).toEqual(before);
    const original = await t.get(`/imports/${v1.id}/original`);
    expect(sha256(original.rawPayload)).toBe(v1.originalSha256);
    expect(JSON.parse(original.rawPayload.toString('utf8'))).toEqual(JSON.parse(JSON.stringify(document)));

    const run2 = await t.runWorkflow(project.id);
    expect(run2.status).toBe('completed');
    const facts2 = await t.listFacts(project.id, run2.id);
    expect(
      facts2.facts.flatMap((fact) => fact.evidence).every((evidence) => evidence.importVersionId === v2md1?.versionId),
    ).toBe(true);
    const scores2 = facts2.facts.filter((fact) => fact.kind === 'match_score');
    const changed = scores2.filter((fact) => fact.status !== 'manually_approved');
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({
      status: 'unverified',
      candidateValue: { home: before.home + 1, away: before.away },
      manualApproval: null,
    });
    // Unchanged facts keep the approval of the previous run (R-068), traced to the earlier fact.
    const carried = scores2.filter((fact) => fact.status === 'manually_approved');
    expect(carried).toHaveLength(3);
    const run1Ids = new Set(scores1.map((fact) => fact.factId));
    expect(carried.every((fact) => run1Ids.has(String(fact.manualApproval?.carriedOverFromFactId)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R-279, R-280
// ---------------------------------------------------------------------------------------------------------------

describe('incomplete data is never filled (R-279)', () => {
  it('stores a match that is not finished without a score, gives it no result, and derives no standings', async () => {
    const t = await manualApp();
    const document = ligaManual();
    const md1 = document.selections[0];
    const pending = md1?.matches[3];
    if (md1 === undefined || pending === undefined) {
      throw new Error('fixture shape');
    }
    pending.status = 'scheduled';
    pending.score = null;
    const summary = await importApplied(t, jsonImport(document, 'jornada-pendiente.json'));
    const version = ManualVersionSchema.parse(
      (
        await t.get(
          `/manual-data/versions/${String(summary.selections.find((selection) => selection.matchday === 1)?.versionId)}`,
        )
      ).json(),
    );
    expect(version.selection.matches[3]).toMatchObject({ status: 'scheduled', score: null });

    const project = await t.createProject(selectionOf(document, 'torneo-apertura', 1));
    const run = await t.runWorkflow(project.id);
    expect(run.status, JSON.stringify(run.failure)).toBe('completed');
    const facts = await t.listFacts(project.id, run.id);
    const names = new Map(md1.teams.map((team) => [team.key, team.name]));
    const label = `${String(names.get(pending.home))} - ${String(names.get(pending.away))}`;
    const pendingKey = facts.facts.find((fact) => fact.kind === 'match_teams' && fact.display === label)?.subject
      .matchKey;
    expect(pendingKey).toBeDefined();
    expect(facts.facts.filter((fact) => fact.subject.matchKey === pendingKey && fact.kind === 'match_score')).toEqual(
      [],
    );
    expect(facts.leftOutMatches).toEqual([
      expect.objectContaining({ matchKey: pendingKey, status: 'scheduled', reason: 'not_finished' }),
    ]);
    expect(facts.facts.filter((fact) => fact.kind === 'match_score')).toHaveLength(3);
    // No content element references a fact of the pending match.
    const referenced = t.container.db
      .prepare<{ n: number }>(
        `SELECT count(*) AS n FROM element_fact_refs r JOIN facts f ON f.id = r.fact_id WHERE f.fact_key LIKE ?`,
      )
      .get([`match:${String(pendingKey)}:score`]) as { n: number };
    expect(referenced.n).toBe(0);

    // The whole stage without standings: none produced or derived.
    const stage = await t.createProject(selectionOf(document, 'cuartos-de-final', null));
    const stageRun = await t.runWorkflow(stage.id);
    expect(stageRun.status, JSON.stringify(stageRun.failure)).toBe('completed');
    const stageFacts = await t.listFacts(stage.id, stageRun.id);
    expect(stageFacts.standings.available).toBe(false);
    expect(stageFacts.facts.filter((fact) => fact.kind === 'standing_row')).toEqual([]);
    const observed = t.container.db
      .prepare<{ n: number }>(`SELECT count(*) AS n FROM observations WHERE run_id = ? AND fact_key LIKE 'standing%'`)
      .get([stageRun.id]) as { n: number };
    expect(observed.n).toBe(0);
  });

  it('rejects a finished match without a score as incomplete and stores nothing', async () => {
    const t = await manualApp();
    const sample = manualSamples().find((entry) => entry.problem === 'finished_without_score');
    expect(sample).toBeDefined();
    const problem = await importRejected(t, sampleRequest(sample as ManualSample));
    expect(problem.importErrors).toEqual([
      expect.objectContaining({ problem: 'finished_without_score', record: '/selections/1/matches/0' }),
    ]);
    expect(importCounts(t)['imports']).toBe(0);
  });
});

describe('person-level fields are refused, naming the field (R-280)', () => {
  it.each([
    ['invalid/person-key.json', 'json_file', 'scorers'],
    ['invalid/person-column.csv', 'csv_file', 'scorer'],
  ] as const)('%s is rejected naming %s, and nothing is stored', async (file, channel, field) => {
    const t = await manualApp();
    const problem = await importRejected(t, sampleRequest({ file, channel }));
    expect(problem.importErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ problem: 'person_field', field })]),
    );
    expect(importCounts(t)).toEqual({
      imports: 0,
      manual_selection_versions: 0,
      manual_competitions: 0,
      manual_seasons: 0,
    });
    expect(storedOriginals(t)).toEqual([]);
  });
});
