/**
 * Unit tests of the import request schemas on inline synthetic values: `contentBase64` (T11H-F01), `FileName` with
 * decomposed names (T11H-F20), the form document and its limits (T10-F03), closed objects (T10-F17).
 */
import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { IMPORT_CONTENT_BASE64_MAX_LENGTH, ImportCreateSchema, ImportFileCreateSchema, ManualImportDocumentSchema } from './imports.js';
import { FileNameSchema } from './primitives.js';

function fileImport(contentBase64: string): Record<string, unknown> {
  return { channel: 'csv_file', fileName: 'jornada-3.csv', declaredSource: 'Acta oficial ficticia', contentBase64 };
}

function formDocument(): Record<string, unknown> {
  return {
    format: 'edr-manual-import/1',
    competition: { id: 'liga-nacional-demo', name: 'Liga Nacional Demo', areaName: 'País Ficticio' },
    season: { id: 'apertura-2026', label: 'Apertura 2026' },
    selections: [
      {
        stage: { id: 'fase-regular', name: 'Fase regular', order: 1 },
        matchday: 3,
        teams: [
          { key: 'club-a', name: 'Club Ficticio A' },
          { key: 'club-b', name: 'Club Ficticio B' },
        ],
        matches: [
          { home: 'club-a', away: 'club-b', kickoff: '2026-10-25T18:00:00-06:00', status: 'finished', score: { home: 1, away: 0 } },
        ],
        standings: null,
      },
    ],
  };
}

describe('ImportFileCreate.contentBase64 (T11H-F01)', () => {
  it('accepts padded standard base64 of the exact file bytes, including a BOM and CRLF line ends', () => {
    const bytes = Buffer.from('\uFEFFlocal,visitante\r\nClub A,Club B\r\n', 'utf8');
    const encoded = bytes.toString('base64');
    expect(encoded.endsWith('=')).toBe(true);
    expect(ImportFileCreateSchema.safeParse(fileImport(encoded)).success).toBe(true);
    expect(ImportFileCreateSchema.safeParse(fileImport('YQ==')).success).toBe(true);
    expect(ImportFileCreateSchema.safeParse(fileImport('YWI=')).success).toBe(true);
  });

  it.each([
    ['a line break', 'YWJj\nZGVm'],
    ['a CRLF line break', 'YWJj\r\nZGVm'],
    ['the URL-safe character -', 'YW-j'],
    ['the URL-safe character _', 'YW_j'],
    ['a space', 'YWJj ZGVm'],
    ['padding in the middle', 'YQ==YQ=='],
    ['three padding characters', 'YQ==='],
    ['a value shorter than 4 characters', 'YQ='],
  ])('refuses a value with %s', (_label, value) => {
    expect(ImportFileCreateSchema.safeParse(fileImport(value)).success).toBe(false);
  });

  it('accepts the maximum length and refuses an over-long value', () => {
    expect(IMPORT_CONTENT_BASE64_MAX_LENGTH).toBe(699052);
    const atLimit = 'A'.repeat(IMPORT_CONTENT_BASE64_MAX_LENGTH);
    expect(ImportFileCreateSchema.safeParse(fileImport(atLimit)).success).toBe(true);
    expect(ImportFileCreateSchema.safeParse(fileImport(`${atLimit}AAAA`)).success).toBe(false);
  });

  it('has no text content field and refuses unknown keys', () => {
    const withContent = { ...fileImport('YQ=='), content: 'local,visitante' };
    expect(ImportFileCreateSchema.safeParse(withContent).success).toBe(false);
    const withoutBase64 = { channel: 'json_file', fileName: 'datos.json', declaredSource: null, content: '{}' };
    expect(ImportFileCreateSchema.safeParse(withoutBase64).success).toBe(false);
  });
});

describe('FileName (T11H-F20)', () => {
  it('accepts NFC and NFD names with combining marks', () => {
    const nfc = 'Jornada Pequeña Ñandú.csv';
    const nfd = nfc.normalize('NFD');
    expect(nfd).not.toBe(nfc);
    expect(/\p{M}/u.test(nfd)).toBe(true);
    expect(FileNameSchema.safeParse(nfc).success).toBe(true);
    expect(FileNameSchema.safeParse(nfd).success).toBe(true);
    expect(FileNameSchema.safeParse('datos_(1).json').success).toBe(true);
  });

  it.each([
    ['a path separator', 'carpeta/datos.json'],
    ['a backslash', 'carpeta\\datos.json'],
    ['another extension', 'datos.xlsx'],
    ['a control character', 'datos\u0000.csv'],
    ['a bidi override', 'datos\u202Ecsv.json'],
    ['a name over 120 characters', `${'a'.repeat(116)}.json`],
    ['an extension only', '.json'],
  ])('refuses a file name with %s', (_label, name) => {
    expect(FileNameSchema.safeParse(name).success).toBe(false);
  });
});

describe('ImportCreate', () => {
  it('accepts the form channel with a valid document and the file channels', () => {
    expect(ImportCreateSchema.safeParse({ channel: 'form', declaredSource: null, document: formDocument() }).success).toBe(
      true,
    );
    expect(ImportCreateSchema.safeParse(fileImport('YQ==')).success).toBe(true);
    expect(ImportCreateSchema.safeParse({ ...fileImport('YQ=='), channel: 'json_file', fileName: 'a-b.json' }).success).toBe(
      true,
    );
  });

  it('refuses an unknown channel and a form request carrying file fields', () => {
    expect(ImportCreateSchema.safeParse({ ...fileImport('YQ=='), channel: 'xlsx_file' }).success).toBe(false);
    const mixed = { channel: 'form', declaredSource: null, document: formDocument(), contentBase64: 'YQ==' };
    expect(ImportCreateSchema.safeParse(mixed).success).toBe(false);
  });

  it('refuses person-level fields in the document (closed objects, R-119)', () => {
    const document = formDocument();
    const selection = (document.selections as Record<string, unknown>[])[0] as Record<string, unknown>;
    selection.scorers = [{ name: 'Persona Ficticia' }];
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('applies the document limits (selections, teams, scores, kickoff length)', () => {
    const document = formDocument();
    const selection = (document.selections as Record<string, unknown>[])[0] as Record<string, unknown>;
    const match = (selection.matches as Record<string, unknown>[])[0] as Record<string, unknown>;
    match.score = { home: 100, away: 0 };
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(false);
    match.score = { home: 1, away: 0 };
    match.kickoff = `2026-10-25T18:00:00.${'1'.repeat(30)}Z`;
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(false);
    match.kickoff = '2026-10-25T18:00:00Z';
    selection.teams = [{ key: 'club-a', name: 'Club Ficticio A' }];
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(false);
    selection.teams = Array.from({ length: 65 }, (_, index) => ({ key: `club-${index}`, name: `Club ${index}` }));
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(false);
    selection.teams = [
      { key: 'club-a', name: 'Club Ficticio A' },
      { key: 'club-b', name: 'Club Ficticio B' },
    ];
    document.selections = Array.from({ length: 100 }, () => selection);
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(true);
    document.selections = Array.from({ length: 101 }, () => selection);
    expect(ManualImportDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('refuses another format marker', () => {
    expect(ManualImportDocumentSchema.safeParse({ ...formDocument(), format: 'edr-manual-import/2' }).success).toBe(
      false,
    );
  });
});
