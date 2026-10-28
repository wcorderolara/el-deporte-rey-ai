/**
 * ManualDataProvider (contracts/provider-ports.md section 1.6; R-267, R-276, R-278): catalogue listings from the
 * import tables, `fetchSelection` from the current version with its import version and `import:<importId>/v<n>`
 * reference, `no_data` without a current version, no network use, and startup with the committed configuration's
 * manual source. Rows are inserted with SQL into an in-memory migrated database (synthetic data only).
 */
import { SelectionSnapshotSchema } from '@edr/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigError } from '../../../../platform/config/index.js';
import { type Db, openMigratedDatabase } from '../../../../platform/db/index.js';
import { type SourceRef, SourceError, asSourceRef, createSportsSources } from '../../index.js';
import { CapturingLogger, FIXED_NOW, RecordingEgress, config, discovery, research } from '../../test/synthetic.js';

const MANUAL = {
  id: 'manual',
  name: 'Operator import',
  mode: 'MANUAL_DATA',
  role: 'primary',
  adapter: 'manual',
  options: {},
};
const IMPORT_1 = '10000000-0000-4000-8000-000000000001';
const IMPORT_2 = '10000000-0000-4000-8000-000000000002';
const VERSION_1 = '20000000-0000-4000-8000-000000000001';
const VERSION_2 = '20000000-0000-4000-8000-000000000002';
const VERSION_3 = '20000000-0000-4000-8000-000000000003';

let db: Db;
let egress: RecordingEgress;

function selection(
  stageId: string,
  stageName: string,
  order: number,
  matchday: number | null,
  homeScore: number,
  standings: boolean,
) {
  return {
    stage: { id: stageId, name: stageName, order },
    matchday,
    teams: [
      { key: 'club-alfa', name: 'Club Alfa' },
      { key: 'deportivo-beta', name: 'Deportivo Beta' },
    ],
    matches: [
      {
        home: 'club-alfa',
        away: 'deportivo-beta',
        kickoff: '2026-10-20T18:00:00Z',
        status: 'finished',
        score: { home: homeScore, away: 1 },
      },
      { home: 'deportivo-beta', away: 'club-alfa', kickoff: '2026-10-27T18:00:00Z', status: 'scheduled', score: null },
    ],
    standings: standings
      ? {
          asOf: '2026-10-21T00:00:00Z',
          rows: [
            {
              position: 1,
              team: 'club-alfa',
              played: 1,
              won: 1,
              drawn: 0,
              lost: 0,
              goalsFor: homeScore,
              goalsAgainst: 1,
              goalDifference: homeScore - 1,
              points: 3,
            },
            {
              position: 2,
              team: 'deportivo-beta',
              played: 1,
              won: 0,
              drawn: 0,
              lost: 1,
              goalsFor: 1,
              goalsAgainst: homeScore,
              goalDifference: 1 - homeScore,
              points: 0,
            },
          ],
        }
      : null,
  };
}

function insertImport(id: string, at: string): void {
  db.prepare(
    `INSERT INTO imports (id, source_id, channel, file_name, declared_source, competition_id, season_id, original_path,
                          original_sha256, original_bytes, received_at)
     VALUES (?, 'manual', 'json_file', 'datos.json', NULL, 'liga-ficticia', '2026-27', ?, ?, 10, ?)`,
  ).run([id, `imports/${id}/original.json`, 'a'.repeat(64), at]);
}

function insertVersion(
  id: string,
  importId: string,
  data: ReturnType<typeof selection>,
  number: number,
  at: string,
  supersededAt: string | null,
): void {
  db.prepare(
    `INSERT INTO manual_selection_versions (id, import_id, competition_id, season_id, stage_id, stage_name, stage_order,
                                            matchday_key, version_number, data, created_at, superseded_at)
     VALUES (?, ?, 'liga-ficticia', '2026-27', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run([
    id,
    importId,
    data.stage.id,
    data.stage.name,
    data.stage.order,
    data.matchday ?? 0,
    number,
    JSON.stringify(data),
    at,
    supersededAt,
  ]);
}

function seed(): void {
  db.prepare(
    `INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, publication_permission,
                          adapter, first_seen_at, last_seen_at)
     VALUES ('manual', 'Operator import', 'MANUAL_DATA', 'primary', 0, 0, 'manual', 'not_applicable', 'manual', ?, ?)`,
  ).run([FIXED_NOW, FIXED_NOW]);
  insertImport(IMPORT_1, '2026-10-21T10:00:00.000Z');
  db.prepare(
    `INSERT INTO manual_competitions (competition_id, source_id, name, area_name, first_import_id)
     VALUES ('liga-ficticia', 'manual', 'Liga Ficticia', 'Pais Ficticio', ?)`,
  ).run([IMPORT_1]);
  db.prepare(
    "INSERT INTO manual_seasons (competition_id, season_id, label) VALUES ('liga-ficticia', '2026-27', '2026/27')",
  ).run();
  insertVersion(
    VERSION_1,
    IMPORT_1,
    selection('fase-regular', 'Fase Regular', 1, 1, 2, true),
    1,
    '2026-10-21T10:00:00.000Z',
    '2026-10-22T10:00:00.000Z',
  );
  insertImport(IMPORT_2, '2026-10-22T10:00:00.000Z');
  insertVersion(
    VERSION_2,
    IMPORT_2,
    selection('fase-regular', 'Fase Regular', 1, 1, 3, true),
    2,
    '2026-10-22T10:00:00.000Z',
    null,
  );
  insertVersion(
    VERSION_3,
    IMPORT_2,
    selection('final', 'Gran Final', 2, null, 1, false),
    1,
    '2026-10-22T10:00:00.000Z',
    null,
  );
}

function registry(sources: readonly Record<string, unknown>[] = [MANUAL]) {
  return createSportsSources(config(sources), {
    egress,
    env: {},
    clock: { now: () => new Date(FIXED_NOW) },
    db,
    paths: { rootDir: '/srv/edr-test-root', dataDir: '/srv/edr-test-root/data' },
    logger: new CapturingLogger(),
  });
}

function manualSource() {
  const source = registry().get('manual');
  if (source === undefined) {
    throw new Error('manual source missing');
  }
  return source;
}

async function failure(promise: Promise<unknown>): Promise<SourceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SourceError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a source error');
}

beforeEach(() => {
  db = openMigratedDatabase({ location: ':memory:' }).db;
  egress = new RecordingEgress();
});

afterEach(() => {
  expect(egress.calls).toEqual([]);
  db.close();
});

describe('ManualDataProvider startup', () => {
  it('starts with the manual source of the committed configuration (options {})', () => {
    expect(registry().sourceIds).toEqual(['manual']);
  });

  it('refuses adapter options naming the setting', () => {
    let error: unknown;
    try {
      registry([{ ...MANUAL, options: { scenario: 'x' } }]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).message).toContain('providers.sports.sources[0].options');
  });
});

describe('ManualDataProvider without imports', () => {
  it('lists no competitions and answers no_data for a selection', async () => {
    const source = manualSource();
    expect((await source.listCompetitions(discovery())).items).toEqual([]);
    const ref = asSourceRef(JSON.stringify({ c: 'liga-ficticia', s: '2026-27', st: 'fase-regular', md: 1 }));
    expect((await failure(source.fetchSelection(ref, research()))).code).toBe('no_data');
  });
});

describe('ManualDataProvider with imports', () => {
  beforeEach(seed);

  it('lists the imported competition, season, stages and matchdays', async () => {
    const source = manualSource();
    const competitions = await source.listCompetitions(discovery());
    expect(competitions.items.map((item) => [item.localKey, item.name, item.areaName])).toEqual([
      ['liga-ficticia', 'Liga Ficticia', 'Pais Ficticio'],
    ]);
    const competitionRef = competitions.items[0]?.ref as SourceRef;
    const seasons = await source.listSeasons(competitionRef, discovery());
    expect(seasons.items.map((item) => [item.id, item.label, item.current, item.startYear])).toEqual([
      ['2026-27', '2026/27', false, null],
    ]);
    const stages = await source.listStages(competitionRef, seasons.items[0]?.ref as SourceRef, discovery());
    expect(
      stages.items.map((stage) => [
        stage.id,
        stage.name,
        stage.order,
        stage.standings,
        stage.wholeStageRef !== null,
        stage.matchdays.map((matchday) => matchday.number),
      ]),
    ).toEqual([
      ['fase-regular', 'Fase Regular', 1, 'expected', false, [1]],
      ['final', 'Gran Final', 2, 'unknown', true, []],
    ]);
  });

  it('fetches the current version with its import version and reference, passing the domain schema (R-267, R-278)', async () => {
    const source = manualSource();
    const ref = asSourceRef(JSON.stringify({ c: 'liga-ficticia', s: '2026-27', st: 'fase-regular', md: 1 }));
    const snapshot = await source.fetchSelection(ref, research());
    expect(SelectionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot).toMatchObject({
      sourceId: 'manual',
      mode: 'MANUAL_DATA',
      retrievedAt: FIXED_NOW,
      fromCache: false,
      importVersionId: VERSION_2,
      sourceRef: `import:${IMPORT_2}/v2`,
      competition: { name: 'Liga Ficticia' },
      season: { label: '2026/27' },
      stage: { name: 'Fase Regular', matchday: 1, totalMatchdays: null },
    });
    expect(snapshot.matches.map((match) => [match.homeTeamKey, match.awayTeamKey, match.status, match.score])).toEqual([
      ['club-alfa', 'deportivo-beta', 'finished', { home: 3, away: 1 }],
      ['deportivo-beta', 'club-alfa', 'scheduled', null],
    ]);
    expect(snapshot.standings.available).toBe(true);
    expect(snapshot.context.map((item) => item.type)).toEqual(['matches_in_selection', 'teams_in_table']);
  });

  it('marks standings as not provided for a selection without standings (nothing derived, R-279)', async () => {
    const source = manualSource();
    const ref = asSourceRef(JSON.stringify({ c: 'liga-ficticia', s: '2026-27', st: 'final', md: null }));
    const snapshot = await source.fetchSelection(ref, research());
    expect(snapshot.standings).toEqual({ available: false, reason: 'not_provided_by_source' });
    expect(snapshot.importVersionId).toBe(VERSION_3);
    expect(snapshot.stage.matchday).toBeNull();
  });

  it('answers no_data for an unknown selection and bad_request for a malformed reference', async () => {
    const source = manualSource();
    const unknown = asSourceRef(JSON.stringify({ c: 'liga-ficticia', s: '2026-27', st: 'fase-regular', md: 2 }));
    expect((await failure(source.fetchSelection(unknown, research()))).code).toBe('no_data');
    const otherCompetition = asSourceRef(JSON.stringify({ c: 'constructor' }));
    expect((await failure(source.listSeasons(otherCompetition, discovery()))).code).toBe('no_data');
    for (const malformed of ['not json', '{"c":"__proto__"}', '{"c":"x","extra":1}', '[]']) {
      expect((await failure(source.listSeasons(asSourceRef(malformed), discovery()))).code).toBe('bad_request');
    }
  });

  it('does not list competitions of another manual source', async () => {
    const other = { ...MANUAL, id: 'manual-b', independenceGroup: 'manual-b' };
    const listing = await registry([MANUAL, other]).get('manual-b')?.listCompetitions(discovery());
    expect(listing?.items).toEqual([]);
  });

  it('reaches the selection through the catalogue service (R-276)', async () => {
    const catalogue = registry().catalogue;
    const listing = await catalogue.listCatalogue(discovery());
    expect(listing.competitions.map((competition) => competition.id)).toEqual(['manual-liga-ficticia']);
  });
});
