/**
 * Support of the editorial copy regression suites of UI-06.3 (PD-ARCH-01H; REVIEW-APPROVAL-01; PD-33 Option A,
 * independent approvals; PD-34, every download writes a new export with the editorial versions approved and
 * publishable at that moment, and exports already written are never modified). It builds on the delivery support
 * (read only, reused by import) and adds:
 * - editorial API helpers: the package, a generation, edits, approvals and withdrawals, through the contract routes;
 * - the expected text of `copy-editorial.txt`, written from the format the Product Owner accepted for
 *   REVIEW-APPROVAL-01 (heading, section titles between rules of 40 `=`, paste-ready text of each deliverable, UTF-8,
 *   line feeds, final line feed), not from the export module's code, so a test compares the file with an independent
 *   expectation built from the texts the test itself sent;
 * - a reader of the stored (method 0) ZIP that the download returns, independent of `export/zip.ts`: it checks the
 *   signatures, the UTF-8 name flag, the sizes and the CRC-32 of every entry against its central directory record;
 * - code-point and word counts with the editorial module's rules (`EditorialField.characters` and `words`), and a
 *   helper that pads a text to an exact number of code points (limit tests);
 * - `expectExportedCopy`: the integrity of the copy file of one export (the file on disk, its ZIP entry, the export
 *   record and the manifest's editorial section with each version ID and text hash).
 * All data is synthetic; nothing is sent to any provider.
 */
import {
  type EditorialDeliverable,
  type EditorialDeliverableState,
  type EditorialFieldName,
  type EditorialPackage,
  EditorialGenerationResultSchema,
  EditorialPackageSchema,
  type EditorialVersion,
  EditorialVersionSchema,
  type Export,
} from '@edr/contracts';
import type { LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

import { type Client, exportFile, manifestOf, sha256 } from './support.js';

// ---------------------------------------------------------------------------------------------------------------
// Editorial API
// ---------------------------------------------------------------------------------------------------------------

/** getEditorialPackage (must succeed). */
export async function editorialPackage(c: Client, projectId: string): Promise<EditorialPackage> {
  const response = await c.get(`/projects/${projectId}/editorial`);
  expect(response.statusCode, response.body).toBe(200);
  return EditorialPackageSchema.parse(response.json());
}

/** createEditorialGeneration of the five deliverables (must succeed); returns the package afterwards. */
export async function generateCopy(c: Client, projectId: string, requestKey: string): Promise<EditorialPackage> {
  const response = await c.send('POST', `/projects/${projectId}/editorial/generations`, { requestKey });
  expect(response.statusCode, response.body).toBe(201);
  return EditorialGenerationResultSchema.parse(response.json()).package;
}

/** The state of one deliverable of a package. */
export function deliverableOf(pkg: EditorialPackage, deliverable: EditorialDeliverable): EditorialDeliverableState {
  const state = pkg.deliverables.find((entry) => entry.deliverable === deliverable);
  if (state === undefined) {
    throw new Error(`the package has no ${deliverable} entry`);
  }
  return state;
}

/** The current version of a deliverable (throws when it has none). */
export function currentCopy(pkg: EditorialPackage, deliverable: EditorialDeliverable): EditorialVersion {
  const version = deliverableOf(pkg, deliverable).current;
  if (version === null) {
    throw new Error(`no current version of ${deliverable}`);
  }
  return version;
}

/** The current versions of every deliverable of a package, by deliverable. */
export function currentCopies(pkg: EditorialPackage): Record<EditorialDeliverable, EditorialVersion> {
  return Object.fromEntries(
    pkg.deliverables.map((entry) => [entry.deliverable, currentCopy(pkg, entry.deliverable)]),
  ) as Record<EditorialDeliverable, EditorialVersion>;
}

export type FieldTexts = Partial<Record<EditorialFieldName, string>>;

/** editEditorialDeliverable (the response is returned unchecked). */
export function editCopy(
  c: Client,
  projectId: string,
  deliverable: EditorialDeliverable,
  baseVersionId: string,
  fields: FieldTexts,
): Promise<LightMyRequestResponse> {
  return c.send('POST', `/projects/${projectId}/editorial/deliverables/${deliverable}/edits`, {
    baseVersionId,
    fields: Object.entries(fields).map(([name, text]) => ({ name, text })),
  });
}

/** editEditorialDeliverable that must store a new version; returns it. */
export async function editedCopy(
  c: Client,
  projectId: string,
  deliverable: EditorialDeliverable,
  baseVersionId: string,
  fields: FieldTexts,
): Promise<EditorialVersion> {
  const response = await editCopy(c, projectId, deliverable, baseVersionId, fields);
  expect(response.statusCode, response.body).toBe(201);
  return EditorialVersionSchema.parse(response.json());
}

/** approveEditorialDeliverable (the response is returned unchecked). */
export function approveCopyResponse(
  c: Client,
  projectId: string,
  deliverable: EditorialDeliverable,
  versionId: string,
): Promise<LightMyRequestResponse> {
  return c.send('PUT', `/projects/${projectId}/editorial/deliverables/${deliverable}/approval`, { versionId });
}

/** approveEditorialDeliverable of a version (must succeed); returns the approved version. */
export async function approveCopy(c: Client, projectId: string, version: EditorialVersion): Promise<EditorialVersion> {
  const response = await approveCopyResponse(c, projectId, version.deliverable, version.id);
  expect(response.statusCode, response.body).toBe(200);
  const approved = EditorialVersionSchema.parse(response.json());
  expect(approved).toMatchObject({ id: version.id, state: 'approved' });
  return approved;
}

/** withdrawEditorialApproval (must succeed); returns the version. */
export async function withdrawCopy(
  c: Client,
  projectId: string,
  deliverable: EditorialDeliverable,
): Promise<EditorialVersion> {
  const response = await c.send('DELETE', `/projects/${projectId}/editorial/deliverables/${deliverable}/approval`);
  expect(response.statusCode, response.body).toBe(200);
  return EditorialVersionSchema.parse(response.json());
}

/** The texts of a version's fields, by field name. */
export function fieldTexts(version: Pick<EditorialVersion, 'fields'>): FieldTexts {
  return Object.fromEntries(version.fields.map((field) => [field.name, field.text])) as FieldTexts;
}

// ---------------------------------------------------------------------------------------------------------------
// Expected `copy-editorial.txt` (format accepted for REVIEW-APPROVAL-01)
// ---------------------------------------------------------------------------------------------------------------

export const COPY_FILE_NAME = 'copy-editorial.txt';
export const COPY_HEADING = 'COPY EDITORIAL APROBADO';
export const SECTION_RULE = '='.repeat(40);

/** The section title of each deliverable (Product Owner, REVIEW-APPROVAL-01), in the contract's order. */
export const SECTION_TITLES: Readonly<Record<EditorialDeliverable, string>> = Object.freeze({
  facebook_instagram: 'Facebook / Instagram',
  tiktok_reels: 'TikTok / Reels',
  viral_headlines: 'Titulares virales',
  youtube: 'YouTube',
  debate_question: 'Pregunta para generar debate',
});

/** The contract's deliverable order. */
export const DELIVERABLE_ORDER = Object.keys(SECTION_TITLES) as EditorialDeliverable[];

/**
 * The paste-ready text of one deliverable: the post's fields separated by blank lines (hashtags last), the three
 * headlines numbered, the YouTube title and description under their labels, the other deliverables as written.
 */
export function deliverableText(deliverable: EditorialDeliverable, fields: FieldTexts): string {
  const text = (name: EditorialFieldName): string => fields[name] ?? '';
  switch (deliverable) {
    case 'facebook_instagram':
      return [text('headline'), text('body'), text('question'), text('hashtags')]
        .filter((value) => value !== '')
        .join('\n\n');
    case 'tiktok_reels':
      return text('copy');
    case 'viral_headlines':
      return `1. ${text('headline_1')}\n2. ${text('headline_2')}\n3. ${text('headline_3')}`;
    case 'youtube':
      return `Título:\n${text('title')}\n\nDescripción:\n${text('description')}`;
    case 'debate_question':
      return text('question');
  }
}

/** The selection of the heading: the project's competition, stage, matchday and season. */
export interface CopySelection {
  readonly competitionName: string;
  readonly stageLabel: string;
  readonly matchday: number | null;
  readonly seasonLabel: string;
}

/** One section of the expected file. */
export interface ExpectedSection {
  readonly deliverable: EditorialDeliverable;
  /** The exported version (its ID, number and approval time go into the manifest). */
  readonly version: EditorialVersion;
  /** The paste-ready text of the section. */
  readonly text: string;
}

/** A section built from an approved version's own fields. */
export function sectionOf(version: EditorialVersion): ExpectedSection {
  return { deliverable: version.deliverable, version, text: deliverableText(version.deliverable, fieldTexts(version)) };
}

/** The whole expected file: heading, then each section in the given order, sections separated by a blank line. */
export function expectedCopyFile(selection: CopySelection, sections: readonly ExpectedSection[]): string {
  // «competición · jornada o fase · temporada»: the matchday (with its stage) of a matchday project, else the stage.
  const round =
    selection.matchday === null
      ? selection.stageLabel
      : `${selection.stageLabel} · Jornada ${String(selection.matchday)}`;
  const heading = `${COPY_HEADING}\n${selection.competitionName} · ${round} · ${selection.seasonLabel}`;
  const parts = sections.map(
    (section) => `${SECTION_RULE}\n${SECTION_TITLES[section.deliverable]}\n${SECTION_RULE}\n\n${section.text}`,
  );
  return `${[heading, ...parts].join('\n\n')}\n`;
}

/** The section titles of a copy file: the lines between two rules, in file order. */
export function sectionTitles(text: string): string[] {
  const lines = text.split('\n');
  return lines.filter((_line, index) => lines[index - 1] === SECTION_RULE && lines[index + 1] === SECTION_RULE);
}

// ---------------------------------------------------------------------------------------------------------------
// Counts with the editorial module's rules
// ---------------------------------------------------------------------------------------------------------------

/** Code points of a text (`EditorialField.characters`; the character limits count code points). */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/** Words of a text: runs between white space that hold a letter or a digit (`EditorialField.words`). */
export function wordCount(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** The text padded with `filler` (one code point) to exactly `length` code points; throws when it is longer. */
export function toCodePoints(text: string, length: number, filler = '\u26BD'): string {
  if (codePoints(filler) !== 1) {
    throw new Error('the filler must be one code point');
  }
  const missing = length - codePoints(text);
  if (missing < 0) {
    throw new Error(`the text has ${String(codePoints(text))} code points, more than ${String(length)}`);
  }
  return text + filler.repeat(missing);
}

/** The words joined by spaces, followed by `extra` filler words until there are exactly `count` words. */
export function toWords(text: string, count: number, extra: readonly string[]): string {
  let result = text;
  let index = 0;
  while (wordCount(result) < count) {
    result += ` ${extra[index % extra.length] ?? 'fútbol'}`;
    index += 1;
  }
  if (wordCount(result) !== count) {
    throw new Error(`the text has ${String(wordCount(result))} words, more than ${String(count)}`);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Stored ZIP reader (independent of export/zip.ts)
// ---------------------------------------------------------------------------------------------------------------

export interface ZipEntry {
  readonly name: string;
  readonly bytes: Buffer;
}

const CRC_TABLE = Array.from({ length: 256 }, (_unused, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * The entries of a stored ZIP in central-directory order. Every entry must be stored (method 0), carry the UTF-8 name
 * flag (bit 11), and have the same CRC-32, sizes and name in its local header and its central record, matching its
 * data; the archive has no comment and nothing after the end record.
 */
export function readStoredZip(zip: Buffer): ZipEntry[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end), 'end of central directory signature').toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  const centralSize = zip.readUInt32LE(end + 12);
  let central = zip.readUInt32LE(end + 16);
  expect(central + centralSize, 'the central directory ends at the end record').toBe(end);
  expect(zip.readUInt16LE(end + 20), 'no archive comment').toBe(0);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    expect(zip.readUInt32LE(central), 'central record signature').toBe(0x02014b50);
    const flags = zip.readUInt16LE(central + 8);
    const method = zip.readUInt16LE(central + 10);
    const crc = zip.readUInt32LE(central + 16);
    const compressed = zip.readUInt32LE(central + 20);
    const size = zip.readUInt32LE(central + 24);
    const nameLength = zip.readUInt16LE(central + 28);
    const extraLength = zip.readUInt16LE(central + 30);
    const commentLength = zip.readUInt16LE(central + 32);
    const local = zip.readUInt32LE(central + 42);
    const name = zip.toString('utf8', central + 46, central + 46 + nameLength);
    expect(flags & 0x0800, `${name}: UTF-8 name flag`).toBe(0x0800);
    expect(method, `${name}: stored`).toBe(0);
    expect(compressed, `${name}: stored size`).toBe(size);
    expect(zip.readUInt32LE(local), `${name}: local header signature`).toBe(0x04034b50);
    expect(zip.readUInt32LE(local + 14), `${name}: local CRC-32`).toBe(crc);
    expect(zip.readUInt32LE(local + 22), `${name}: local size`).toBe(size);
    const localName = zip.readUInt16LE(local + 26);
    const localExtra = zip.readUInt16LE(local + 28);
    expect(zip.toString('utf8', local + 30, local + 30 + localName), `${name}: local name`).toBe(name);
    const start = local + 30 + localName + localExtra;
    const bytes = Buffer.from(zip.subarray(start, start + size));
    expect(bytes.length, `${name}: data inside the archive`).toBe(size);
    expect(crc32(bytes), `${name}: CRC-32 of the data`).toBe(crc);
    entries.push({ name, bytes });
    central += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** downloadExport (must succeed): the ZIP bytes. */
export async function downloadZip(c: Client, exportId: string): Promise<Buffer> {
  const response = await c.get(`/exports/${exportId}/download`);
  expect(response.statusCode, response.body).toBe(200);
  expect(response.headers['content-type']).toContain('application/zip');
  return response.rawPayload;
}

/** The bytes of one ZIP entry (throws when it is missing). */
export function zipEntry(entries: readonly ZipEntry[], name: string): Buffer {
  const entry = entries.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`the ZIP has no ${name}`);
  }
  return entry.bytes;
}

// ---------------------------------------------------------------------------------------------------------------
// Integrity of the copy of one export
// ---------------------------------------------------------------------------------------------------------------

const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * The ZIP of an export holds exactly the export's recorded files in position order, each byte for byte as written
 * in its folder and with its recorded SHA-256; returns the entries.
 */
export function expectZipOfExport(c: Client, written: Export, zip: Buffer): ZipEntry[] {
  const entries = readStoredZip(zip);
  const files = [...written.files].sort((a, b) => a.position - b.position);
  expect(entries.map((entry) => entry.name)).toEqual(files.map((file) => file.fileName));
  for (const file of files) {
    const bytes = zipEntry(entries, file.fileName);
    expect(bytes.equals(exportFile(c, written, file.fileName)), `${file.fileName} in the ZIP is the written file`).toBe(
      true,
    );
    expect(sha256(bytes), `${file.fileName}: recorded SHA-256`).toBe(file.sha256);
  }
  return entries;
}

/**
 * The copy of an export is exactly `expected` (the whole file, byte for byte, strict UTF-8 without BOM or carriage
 * return, final line feed), in its folder and in its ZIP entry, recorded as the `editorial_text` file right before
 * the manifest, and listed by the manifest with the file's hash and, per section, the version ID, number, approval
 * time and the SHA-256 of the section's text. Returns the file's text.
 */
export function expectExportedCopy(
  c: Client,
  written: Export,
  zip: Buffer,
  selection: CopySelection,
  sections: readonly ExpectedSection[],
): string {
  const expected = expectedCopyFile(selection, sections);
  const disk = exportFile(c, written, COPY_FILE_NAME);
  const text = STRICT_UTF8.decode(disk);
  expect(text).toBe(expected);
  expect(disk.equals(Buffer.from(expected, 'utf8'))).toBe(true);
  expect(disk.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), 'no byte order mark').toBe(false);
  expect(disk.includes(0x0d), 'no carriage return').toBe(false);
  expect(disk.at(-1), 'final line feed').toBe(0x0a);
  expect(sectionTitles(text)).toEqual(sections.map((section) => SECTION_TITLES[section.deliverable]));

  const entries = expectZipOfExport(c, written, zip);
  expect(zipEntry(entries, COPY_FILE_NAME).equals(disk)).toBe(true);
  const ordered = [...written.files].sort((a, b) => a.position - b.position);
  const record = ordered.find((file) => file.kind === 'editorial_text');
  expect(record).toMatchObject({ fileName: COPY_FILE_NAME, elementVersionId: null, sha256: sha256(disk) });
  expect(ordered.at(-2)).toEqual(record);
  expect(ordered.at(-1)?.kind).toBe('manifest');

  const manifest = manifestOf(c, written);
  expect(zipEntry(entries, 'manifest.json').equals(exportFile(c, written, 'manifest.json'))).toBe(true);
  expect(manifest.editorial).toMatchObject({
    position: record?.position,
    fileName: COPY_FILE_NAME,
    sha256: sha256(disk),
  });
  expect(
    manifest.editorial?.deliverables.map((entry) => ({
      deliverable: entry.deliverable,
      editorialVersionId: entry.editorialVersionId,
      versionNumber: entry.versionNumber,
      approvedAt: entry.approvedAt,
      textSha256: entry.textSha256,
    })),
  ).toEqual(
    sections.map((section) => ({
      deliverable: section.deliverable,
      editorialVersionId: section.version.id,
      versionNumber: section.version.versionNumber,
      approvedAt: section.version.approvedAt,
      textSha256: sha256(Buffer.from(section.text, 'utf8')),
    })),
  );
  return text;
}

/** An export without approved copy: no `editorial_text` file, no ZIP entry, no manifest section. */
export function expectNoCopy(c: Client, written: Export, zip: Buffer): void {
  expect(written.files.map((file) => file.kind)).not.toContain('editorial_text');
  const entries = expectZipOfExport(c, written, zip);
  expect(entries.map((entry) => entry.name)).not.toContain(COPY_FILE_NAME);
  expect(manifestOf(c, written)).not.toHaveProperty('editorial');
}
