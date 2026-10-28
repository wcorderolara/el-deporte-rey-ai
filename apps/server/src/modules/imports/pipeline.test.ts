/**
 * Import pipeline (contracts/provider-ports.md section 1.6): every rejection class with the expected error, all
 * errors reported together with location, record, field and problem, nothing stored on rejection, the team-key rule,
 * `Map` lookups on untrusted keys and errors without values (R-273 to R-275, R-279, R-280; T11H-F07, F09, F12).
 * The import service runs on an in-memory migrated database and a temporary data directory.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';

import { CatalogueConfig } from '../../platform/config/index.js';
import { openMigratedDatabase } from '../../platform/db/index.js';

import { type ImportOutcome, type ImportRequest, ImportService, NoManualSourceError } from './service.js';
import {
  MATCHES_HEADER,
  type ServiceHarness,
  base64,
  matchRow,
  matchesCsv,
  sampleDocument,
  sampleSelection,
  serviceHarness,
  standingsCsv,
} from './test/support.js';

let harness: ServiceHarness | undefined;

/** Synthetic documents are edited member by member in the tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural edits of test documents
type Loose = any;

afterEach(() => {
  harness?.close();
  harness = undefined;
});

function setup(): ServiceHarness {
  const created = serviceHarness();
  harness = created;
  return created;
}

function csv(content: string | Uint8Array, fileName = 'resultados.csv'): ImportRequest {
  return { channel: 'csv_file', fileName, declaredSource: null, contentBase64: base64(content) };
}

function json(content: string | Uint8Array, fileName = 'resultados.json'): ImportRequest {
  return { channel: 'json_file', fileName, declaredSource: 'Acta ficticia', contentBase64: base64(content) };
}

function form(document: unknown): ImportRequest {
  return { channel: 'form', declaredSource: null, document };
}

function rejected(outcome: ImportOutcome) {
  expect(outcome.ok).toBe(false);
  return outcome.ok ? [] : outcome.errors;
}

function problems(outcome: ImportOutcome): string[] {
  return rejected(outcome).map((error) => error.problem);
}

function expectNothingStored(h: ServiceHarness): void {
  expect(h.counts()).toEqual({ imports: 0, manual_competitions: 0, manual_seasons: 0, manual_selection_versions: 0 });
  expect(h.storedFiles()).toEqual([]);
}

/** A document with one changed member at a path. */
function documentWith(change: (document: Record<string, Loose>) => void): Record<string, unknown> {
  const document = sampleDocument() as Record<string, Loose>;
  change(document);
  return document;
}

describe('valid imports', () => {
  it('applies a JSON file, a CSV matches file, a CSV standings file and a form', () => {
    const h = setup();
    const fromJson = h.service.createImport(json(JSON.stringify(sampleDocument())));
    expect(fromJson.ok).toBe(true);
    const fromCsv = h.service.createImport(csv(matchesCsv()));
    expect(fromCsv.ok).toBe(true);
    const fromStandings = h.service.createImport(csv(standingsCsv()));
    expect(fromStandings.ok).toBe(true);
    const fromForm = h.service.createImport(form(sampleDocument({ matchday: 2 })));
    expect(fromForm.ok).toBe(true);
    expect(h.counts()).toEqual({ imports: 4, manual_competitions: 1, manual_seasons: 1, manual_selection_versions: 4 });
    if (fromStandings.ok) {
      expect(fromStandings.summary.selections.map((selection) => selection.versionNumber)).toEqual([3]);
    }
  });

  it('carries the current matches into a standings-only version and refuses standings without matches', () => {
    const h = setup();
    expect(problems(h.service.createImport(csv(standingsCsv())))).toEqual(['required_missing']);
    expectNothingStored(h);
    expect(h.service.createImport(csv(matchesCsv())).ok).toBe(true);
    const outcome = h.service.createImport(csv(standingsCsv()));
    expect(outcome.ok).toBe(true);
    const versionId = outcome.ok ? (outcome.summary.selections[0]?.versionId ?? '') : '';
    const version = h.service.getVersion(versionId);
    expect(version?.selection.matches).toHaveLength(2);
    expect(version?.selection.standings?.rows.map((row) => row.team)).toEqual([
      'club-alfa',
      'atletico-gamma',
      'union-delta',
      'deportivo-beta',
    ]);
  });

  it('uses Map lookups: prototype-like team keys, names and stage IDs import correctly (T11H-F07)', () => {
    const h = setup();
    const selection = sampleSelection({ standings: false }) as Record<string, Loose>;
    selection['stage'] = { id: 'constructor', name: '__proto__', order: 1 };
    selection['teams'] = [
      { key: 'constructor', name: 'toString' },
      { key: 'prototype', name: 'constructor' },
      { key: 'tostring', name: 'prototype' },
      { key: 'hasownproperty', name: 'valueOf' },
    ];
    selection['matches'] = [
      {
        home: 'constructor',
        away: 'prototype',
        kickoff: '2026-10-20T18:00:00Z',
        status: 'finished',
        score: { home: 1, away: 0 },
      },
      { home: 'tostring', away: 'hasownproperty', kickoff: '2026-10-20T20:00:00Z', status: 'scheduled', score: null },
    ];
    const document = { ...sampleDocument(), selections: [selection] };
    expect(h.service.createImport(form(document)).ok).toBe(true);

    const csvOutcome = h.service.createImport(
      csv(
        matchesCsv([
          matchRow('constructor', 'prototype', 'finished', '1', '0', '2'),
          matchRow('toString', 'valueOf', 'scheduled', '', '', '2'),
        ]),
      ),
    );
    expect(csvOutcome.ok).toBe(true);
    const versionId = csvOutcome.ok ? (csvOutcome.summary.selections[0]?.versionId ?? '') : '';
    expect(h.service.getVersion(versionId)?.selection.teams).toEqual([
      { key: 'constructor', name: 'constructor' },
      { key: 'prototype', name: 'prototype' },
      { key: 'tostring', name: 'toString' },
      { key: 'valueof', name: 'valueOf' },
    ]);
  });

  it('refuses a match whose team is only an inherited object member (T11H-F07)', () => {
    const h = setup();
    const document = documentWith((d) => {
      d['selections'][0]['standings'] = null;
      d['selections'][0]['matches'][0]['home'] = 'constructor';
      d['selections'][0]['matches'][1]['away'] = 'tostring';
    });
    const errors = rejected(h.service.createImport(form(document)));
    expect(errors.map((error) => [error.record, error.field, error.problem])).toEqual([
      ['/selections/0/matches/0', 'home', 'unknown_team'],
      ['/selections/0/matches/1', 'away', 'unknown_team'],
    ]);
  });

  it('accepts a CSV file with a BOM and CRLF line ends', () => {
    const h = setup();
    const text = matchesCsv().replaceAll('\n', '\r\n');
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
    expect(h.service.createImport(csv(bytes)).ok).toBe(true);
  });
});

describe('rejections (R-273, R-275, R-279, R-280), nothing stored', () => {
  const cases: ReadonlyArray<[string, () => ImportRequest, Array<[string, string | null, string]>]> = [
    ['unparsable JSON', () => json('{"format": '), [['file', null, 'parse_error']]],
    [
      'a JSON file with a duplicate member',
      () => json('{"format":"edr-manual-import/1","format":"edr-manual-import/1"}'),
      [['/format', 'format', 'parse_error']],
    ],
    [
      'JSON nested deeper than 16',
      () => json(`{"selections":${'['.repeat(16)}${']'.repeat(16)}}`),
      [['/selections/0/0/0/0/0/0/0/0/0/0/0/0/0/0/0', null, 'parse_error']],
    ],
    [
      'a missing field',
      () => form(documentWith((d) => delete d['selections'][0]['matches'][0]['kickoff'])),
      [['/selections/0/matches/0', 'kickoff', 'required_missing']],
    ],
    [
      'a wrong type',
      () => form(documentWith((d) => (d['selections'][0]['matches'][0]['score']['home'] = '2'))),
      [['/selections/0/matches/0/score', 'home', 'type_invalid']],
    ],
    [
      'an impossible value',
      () => form(documentWith((d) => (d['selections'][0]['matches'][0]['score']['home'] = 120))),
      [['/selections/0/matches/0/score', 'home', 'value_out_of_range']],
    ],
    [
      'an unknown status',
      () => form(documentWith((d) => (d['selections'][0]['matches'][0]['status'] = 'paused'))),
      [['/selections/0/matches/0', 'status', 'value_out_of_range']],
    ],
    [
      'a person-level key',
      () => form(documentWith((d) => (d['selections'][0]['matches'][0]['scorers'] = ['x']))),
      [['/selections/0/matches/0', 'scorers', 'person_field']],
    ],
    [
      'an unknown key',
      () => form(documentWith((d) => (d['selections'][0]['venue'] = 'x'))),
      [['/selections/0', 'venue', 'column_unknown']],
    ],
    [
      'a finished match without score',
      () => form(documentWith((d) => (d['selections'][0]['matches'][0]['score'] = null))),
      [['/selections/0/matches/0', 'score', 'finished_without_score']],
    ],
    [
      'a score of an unfinished match',
      () => form(documentWith((d) => (d['selections'][0]['matches'][0]['status'] = 'postponed'))),
      [['/selections/0/matches/0', 'score', 'score_not_allowed']],
    ],
    [
      'missing competition metadata',
      () => form(documentWith((d) => delete d['competition'])),
      [['/', 'competition', 'metadata_missing']],
    ],
    [
      'missing stage metadata',
      () => form(documentWith((d) => (d['selections'][0]['stage']['name'] = ''))),
      [['/selections/0/stage', 'name', 'metadata_missing']],
    ],
    [
      'a duplicate match naming both records',
      () =>
        form(
          documentWith((d) => {
            d['selections'][0]['matches'][1] = { ...d['selections'][0]['matches'][0] };
            d['selections'][0]['standings'] = null;
          }),
        ),
      [['/selections/0/matches/1', null, 'duplicate_match']],
    ],
    [
      'home equal to away',
      () =>
        form(
          documentWith((d) => {
            d['selections'][0]['matches'][1]['away'] = d['selections'][0]['matches'][1]['home'];
          }),
        ),
      [['/selections/0/matches/1', 'away', 'value_inconsistent']],
    ],
    [
      'inconsistent standings',
      () => form(documentWith((d) => (d['selections'][0]['standings']['rows'][0]['played'] = 2))),
      [['/selections/0/standings/rows/0', 'played', 'value_inconsistent']],
    ],
    [
      'non-contiguous standings positions',
      () => form(documentWith((d) => (d['selections'][0]['standings']['rows'][3]['position'] = 5))),
      [['/selections/0/standings/rows/3', 'position', 'value_inconsistent']],
    ],
    ['invalid UTF-8', () => csv(Uint8Array.from([0x61, 0xff, 0x0a])), [['file', null, 'encoding_invalid']]],
    ['an overlong UTF-8 sequence', () => csv(Uint8Array.from([0xc0, 0xaf])), [['file', null, 'encoding_invalid']]],
    [
      'an encoded lone surrogate',
      () => json(Uint8Array.from([0x7b, 0xed, 0xa0, 0x80, 0x7d])),
      [['file', null, 'encoding_invalid']],
    ],
    ['invalid base64', () => ({ ...csv(''), contentBase64: 'QR==' }), [['file', null, 'encoding_invalid']]],
    ['an oversize file', () => csv(Buffer.alloc(524_289, 0x61)), [['file', null, 'too_large']]],
    ['too many rows', () => csv(MATCHES_HEADER + '\n' + 'x\n'.repeat(5001)), [['file', null, 'too_many_rows']]],
    ['wrong CSV columns', () => csv('competition_id,competition_name\nx,y\n'), [['1', null, 'header_invalid']]],
    ['an unknown CSV column', () => csv(`${MATCHES_HEADER},venue\n`), [['1', 'venue', 'column_unknown']]],
    [
      'a person-level CSV column',
      () => csv(`${MATCHES_HEADER},Goal_Scorer\n${matchRow('Club Alfa', 'Deportivo Beta')},x\n`),
      [['1', 'Goal_Scorer', 'person_field']],
    ],
    [
      'a wrong CSV column count',
      () => csv(matchesCsv([`${matchRow('Club Alfa', 'Deportivo Beta')},extra`])),
      [['2', null, 'parse_error']],
    ],
    [
      'a line break inside a CSV field',
      () => csv(matchesCsv([`liga-ficticia,"Liga\nFicticia",2026-27`])),
      // Row 2 breaks inside the field; the rest of the field is read as row 3, itself refused.
      [
        ['2', null, 'parse_error'],
        ['3', null, 'parse_error'],
      ],
    ],
    [
      'a control character in a CSV field',
      () => csv(matchesCsv([matchRow('Club\u0000Alfa', 'Deportivo Beta')])),
      [['2', 'home_team', 'type_invalid']],
    ],
    [
      'a format character in a CSV field',
      () => csv(matchesCsv([matchRow('Club​Alfa', 'Deportivo Beta')])),
      [['2', 'home_team', 'type_invalid']],
    ],
    [
      'a CSV finished match without score',
      () => csv(matchesCsv([matchRow('Club Alfa', 'Deportivo Beta', 'finished', '', '')])),
      [['2', 'home_score', 'finished_without_score']],
    ],
    [
      'a CSV duplicate match naming both rows',
      () => csv(matchesCsv([matchRow('Club Alfa', 'Deportivo Beta'), matchRow('Club Alfa', 'Deportivo Beta')])),
      [['3', null, 'duplicate_match']],
    ],
    [
      'CSV metadata missing',
      () =>
        csv(
          matchesCsv([
            `,Liga Ficticia,2026-27,2026/27,fase-regular,Fase Regular,1,1,Club Alfa,Deportivo Beta,2026-10-20T18:00:00Z,finished,1,0`,
          ]),
        ),
      [['2', 'competition_id', 'metadata_missing']],
    ],
    [
      'a 201-character CSV field',
      () => csv(matchesCsv([matchRow('x'.repeat(201), 'Deportivo Beta')])),
      [['2', 'home_team', 'value_out_of_range']],
    ],
  ];

  it.each(cases)('rejects %s', (_label, request, expected) => {
    const h = setup();
    const outcome = h.service.createImport(request());
    expect(rejected(outcome).map((error) => [error.record, error.field, error.problem])).toEqual(expected);
    expect(
      rejected(outcome).every((error) => error.location === (request().channel === 'form' ? 'form' : 'file')),
    ).toBe(true);
    expectNothingStored(h);
  });

  it('names both records of a duplicate match in the message', () => {
    const h = setup();
    const errors = rejected(
      h.service.createImport(
        csv(
          matchesCsv([
            matchRow('Club Alfa', 'Deportivo Beta'),
            matchRow('Atlético Gamma', 'Unión Delta'),
            matchRow('Club Alfa', 'Deportivo Beta'),
          ]),
        ),
      ),
    );
    expect(errors).toEqual([
      {
        location: 'file',
        record: '4',
        field: null,
        problem: 'duplicate_match',
        message: 'The match duplicates the match in row 2',
      },
    ]);
  });

  it('rejects a metadata conflict with an earlier import (competition name and season label)', () => {
    const h = setup();
    expect(h.service.createImport(form(sampleDocument())).ok).toBe(true);
    const errors = rejected(
      h.service.createImport(form(sampleDocument({ competitionName: 'Liga Ficticia B', seasonLabel: '2026-2027' }))),
    );
    expect(errors.map((error) => [error.record, error.field, error.problem])).toEqual([
      ['/competition', 'name', 'metadata_conflict'],
      ['/season', 'label', 'metadata_conflict'],
    ]);
    expect(h.counts()).toEqual({ imports: 1, manual_competitions: 1, manual_seasons: 1, manual_selection_versions: 1 });
  });

  it('rejects a competition ID too long for a catalogue ID of the source', () => {
    const h = setup();
    const errors = rejected(h.service.createImport(form(sampleDocument({ competitionId: 'x'.repeat(60) }))));
    expect(errors.map((error) => [error.record, error.field, error.problem])).toEqual([
      ['/competition', 'id', 'value_out_of_range'],
    ]);
  });
});

describe('all errors reported together (R-274)', () => {
  it('reports every row, field and problem of a CSV file at once', () => {
    const h = setup();
    const errors = rejected(
      h.service.createImport(
        csv(
          matchesCsv([
            matchRow('Club Alfa', 'Deportivo Beta', 'finished', '', ''),
            matchRow('Atlético Gamma', 'Unión Delta', 'scheduled', '1', '0'),
            matchRow('Club Alfa', 'Club Alfa'),
            matchRow('Club Alfa', 'Deportivo Beta', 'finished', '120', '0'),
            matchRow('Club Alfa', 'Unión Delta', 'later'),
          ]),
        ),
      ),
    );
    expect(errors.map((error) => [error.location, error.record, error.field, error.problem])).toEqual([
      ['file', '2', 'home_score', 'finished_without_score'],
      ['file', '3', 'home_score', 'score_not_allowed'],
      ['file', '3', 'away_score', 'score_not_allowed'],
      ['file', '4', 'away_team', 'value_inconsistent'],
      ['file', '5', 'home_score', 'value_out_of_range'],
      ['file', '6', 'status', 'value_out_of_range'],
    ]);
    expect(errors.every((error) => error.message.length > 0)).toBe(true);
  });

  it('reports several schema errors of one document at once', () => {
    const h = setup();
    const document = documentWith((d) => {
      d['format'] = 'other/2';
      d['season']['label'] = '';
      d['selections'][0]['matches'][0]['referee'] = 'x';
      d['selections'][0]['teams'][0]['key'] = 'Not A Slug';
    });
    const errors = rejected(h.service.createImport(form(document)));
    expect(errors.map((error) => [error.record, error.field, error.problem]).sort()).toEqual(
      [
        ['/', 'format', 'type_invalid'],
        ['/season', 'label', 'metadata_missing'],
        ['/selections/0/matches/0', 'referee', 'person_field'],
        ['/selections/0/teams/0', 'key', 'type_invalid'],
      ].sort(),
    );
  });

  it('caps the reported errors at 500', () => {
    const h = setup();
    const rows = Array.from({ length: 600 }, () => matchRow('Club Alfa', 'Deportivo Beta', 'finished', '', ''));
    const outcome = h.service.createImport(csv(matchesCsv(rows)));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors).toHaveLength(500);
      expect(outcome.total).toBeGreaterThanOrEqual(500);
    }
  });
});

describe('team keys of CSV imports (T11H-F09)', () => {
  it.each([
    ['names differing only in punctuation', 'Club A.B.', 'Club A B'],
    ['accented and unaccented forms of one name', 'Atlético Gamma', 'Atletico Gamma'],
    ['names differing in case', 'Club Alfa', 'CLUB ALFA'],
  ])('rejects %s naming every row involved', (_label, first, second) => {
    const h = setup();
    const errors = rejected(
      h.service.createImport(
        csv(
          matchesCsv([
            matchRow(first, 'Deportivo Beta', 'finished', '1', '0', '1'),
            matchRow('Unión Delta', second, 'finished', '1', '0', '1'),
            matchRow(first, 'Unión Delta', 'finished', '1', '0', '2'),
          ]),
        ),
      ),
    );
    expect(errors.map((error) => [error.record, error.field, error.problem])).toEqual([
      ['2', 'home_team', 'value_inconsistent'],
      ['4', 'home_team', 'value_inconsistent'],
      ['3', 'away_team', 'value_inconsistent'],
    ]);
    expectNothingStored(h);
  });

  it('rejects names in a non-Latin script only (empty key) naming every row', () => {
    const h = setup();
    const errors = rejected(
      h.service.createImport(
        csv(
          matchesCsv([
            matchRow('Клуб Альфа', 'Deportivo Beta'),
            matchRow('Клуб Альфа', 'Unión Delta', 'finished', '1', '0', '2'),
          ]),
        ),
      ),
    );
    expect(errors.map((error) => [error.record, error.field, error.problem])).toEqual([
      ['2', 'home_team', 'value_inconsistent'],
      ['3', 'home_team', 'value_inconsistent'],
    ]);
  });
});

describe('errors and logs never carry values (T11H-F12)', () => {
  it('reports row, column and problem only for a marker in a person-like column and in a team name', () => {
    const h = setup();
    const marker = TEST_MARKER_TOKEN;
    const markedTeam = `Club ${marker}`;
    const outcomes = [
      // CSV: the marker in a person-like column and in a (valid) team name; refused for the column.
      h.service.createImport(csv(`${MATCHES_HEADER},referee\n${matchRow(markedTeam, 'Deportivo Beta')},${marker}\n`)),
      // CSV: the marker in a team name with a character the name rule refuses.
      h.service.createImport(csv(matchesCsv([matchRow(`${markedTeam}!`, 'Deportivo Beta')]))),
      // Form: the marker in a team name and in a person-level member.
      h.service.createImport(
        form(
          documentWith((d) => {
            d['selections'][0]['teams'][0]['name'] = markedTeam;
            d['selections'][0]['matches'][0]['coach'] = marker;
          }),
        ),
      ),
      // JSON file: the same document as a file.
      h.service.createImport(
        json(
          JSON.stringify(
            documentWith((d) => {
              d['selections'][0]['teams'][0]['name'] = `${markedTeam}#`;
              d['selections'][0]['matches'][0]['scorer'] = marker;
            }),
          ),
        ),
      ),
    ];
    for (const outcome of outcomes) {
      expect(outcome.ok).toBe(false);
      expect(JSON.stringify(outcome)).not.toContain(marker);
      expect(JSON.stringify(outcome)).not.toContain('edr-test');
    }
    expect(rejected(outcomes[0] as ImportOutcome)).toEqual([
      {
        location: 'file',
        record: '1',
        field: 'referee',
        problem: 'person_field',
        message: 'Person-level columns are not accepted (team and competition data only)',
      },
    ]);
    expect(rejected(outcomes[1] as ImportOutcome).map((error) => [error.record, error.field, error.problem])).toEqual([
      ['2', 'home_team', 'type_invalid'],
    ]);
    expect(rejected(outcomes[2] as ImportOutcome).map((error) => [error.record, error.field, error.problem])).toEqual([
      ['/selections/0/matches/0', 'coach', 'person_field'],
    ]);
    expect(
      rejected(outcomes[3] as ImportOutcome)
        .map((error) => [error.record, error.field, error.problem])
        .sort(),
    ).toEqual(
      [
        ['/selections/0/matches/0', 'scorer', 'person_field'],
        ['/selections/0/teams/0', 'name', 'type_invalid'],
      ].sort(),
    );
    expect(JSON.stringify(h.logLines)).not.toContain(marker);
    expect(h.logLines.map((line) => line.message)).toEqual(Array(outcomes.length).fill('import rejected'));
    expectNothingStored(h);
  });
});

describe('form size (T11H-F10)', () => {
  it('checks the canonical serialization against 524288 bytes before anything is written', () => {
    const h = setup();
    const selections = Array.from({ length: 100 }, (_unused, index) => {
      const selection = sampleSelection({ matchday: index + 1 }) as Record<string, Loose>;
      selection['teams'] = Array.from({ length: 64 }, (_t, t) => ({
        key: `club-${String(t).padStart(2, '0')}-${'x'.repeat(50)}`,
        name: `Club ${String(t).padStart(2, '0')} ${'Nombre Largo Ficticio '.repeat(2)}`.slice(0, 64).trim(),
      }));
      const keys = selection['teams'].map((team: { key: string }) => team.key) as string[];
      selection['matches'] = Array.from({ length: 32 }, (_m, m) => ({
        home: keys[2 * m],
        away: keys[2 * m + 1],
        kickoff: '2026-10-20T18:00:00+00:00',
        status: 'scheduled',
        score: null,
      }));
      selection['standings'] = null;
      return selection;
    });
    const document = { ...sampleDocument(), selections };
    expect(Buffer.byteLength(JSON.stringify(document))).toBeGreaterThan(524_288);
    const errors = rejected(h.service.createImport(form(document)));
    expect(errors.map((error) => [error.location, error.record, error.problem])).toEqual([['form', '/', 'too_large']]);
    expectNothingStored(h);
  });
});

describe('import source', () => {
  it('refuses an import when no MANUAL_DATA source is enabled', () => {
    const { db } = openMigratedDatabase({ location: ':memory:' });
    try {
      const service = new ImportService({
        db,
        clock: { now: () => new Date() },
        dataDir: '/nonexistent-edr-test',
        logger: { info: () => undefined },
        sources: [],
        catalogue: CatalogueConfig.empty(),
      });
      expect(() => service.createImport(form(sampleDocument()))).toThrow(NoManualSourceError);
    } finally {
      db.close();
    }
  });
});
