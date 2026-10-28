/**
 * What a template renders: the stored text of a slide version (`element_versions.text`, written by the content stage,
 * T32) plus the slide's type, the content language, the demonstration flag and the "as of" time of standings.
 *
 * Every value on a slide comes from the stored provenance segments; the renderer never re-derives a value from the
 * facts (AD-07, OD-49): fact segments are the deterministic display forms the content stage substituted from the
 * verified (or candidate) values, with their fact IDs. Only fixed template text (the demonstration label, column
 * headings, the "as of" prefix) is added here, from `platform/format`.
 *
 * `StoredElementTextSchema` mirrors the content module's `ElementTextSchema` (T32, `modules/content/schemas.ts`):
 * version 1, fields of the contract's `TextFieldName` with `fact` (with fact ID), `commentary` or `template_text`
 * segments. The rendering module reads the shared tables through its own repository (architecture.md section 3), so
 * it validates the column with this closed copy.
 */
import {
  type Language,
  SegmentProvenanceSchema,
  type SlideType,
  type TextFieldName,
  TextFieldNameSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

/** Longest segment text (contract `TextField.segments[].text`). */
export const MAX_SEGMENT_TEXT = 2200;

export const StoredSegmentSchema = z
  .strictObject({
    provenance: SegmentProvenanceSchema,
    text: z.string().max(MAX_SEGMENT_TEXT),
    factId: UuidSchema.nullable(),
  })
  .refine((segment) => (segment.provenance === 'fact') === (segment.factId !== null), {
    message: 'a fact segment has a fact ID and no other segment has one',
  });
export type StoredSegment = z.infer<typeof StoredSegmentSchema>;

export const StoredTextFieldSchema = z.strictObject({
  field: TextFieldNameSchema,
  segments: z.array(StoredSegmentSchema).max(2000),
});
export type StoredTextField = z.infer<typeof StoredTextFieldSchema>;

/** `element_versions.text` (content module `ElementTextSchema`, version 1). */
export const StoredElementTextSchema = z.strictObject({
  version: z.literal(1),
  fields: z.array(StoredTextFieldSchema).max(20),
});
export type StoredElementText = z.infer<typeof StoredElementTextSchema>;

/** The input of a template. */
export interface SlideContent {
  readonly slideType: SlideType;
  readonly language: Language;
  /** True for every slide of a DEMO_DATA project (OD-21, R-269, AD-33). */
  readonly demonstration: boolean;
  readonly text: StoredElementText;
  /** Latest research retrieval time of the facts run (ISO-8601), shown as "as of" on standings slides. */
  readonly standingsAsOf: string | null;
}

/** The segments of a field, or an empty list when the field is absent. */
export function segmentsOf(text: StoredElementText, field: TextFieldName): readonly StoredSegment[] {
  return text.fields.find((candidate) => candidate.field === field)?.segments ?? [];
}

/** A run of segments drawn as one text element. */
export interface SegmentRun {
  readonly text: string;
  readonly factIds: readonly string[];
  readonly provenance: 'fact' | 'commentary' | 'template_text' | 'mixed';
}

/** Joins segments into one text with their fact IDs (in order, once each) and their common provenance. */
export function runOf(segments: readonly StoredSegment[]): SegmentRun {
  const factIds: string[] = [];
  for (const segment of segments) {
    if (segment.factId !== null && !factIds.includes(segment.factId)) {
      factIds.push(segment.factId);
    }
  }
  const provenances = new Set(segments.map((segment) => segment.provenance));
  const [only] = provenances;
  return {
    text: segments.map((segment) => segment.text).join(''),
    factIds,
    provenance: provenances.size === 1 && only !== undefined ? only : 'mixed',
  };
}

/** One standings row of a `standings` field. */
export interface StandingsRowContent {
  /** The cells in the order position, played, won, drawn, lost, goals for, goals against, goal difference, points. */
  readonly cells: readonly string[];
  readonly cellsFactId: string | null;
  readonly team: string;
  readonly teamFactId: string | null;
}

/** Number of cells of a standings row (content module `standingRowCells`). */
export const STANDINGS_CELL_COUNT = 9;

/**
 * The rows of a `standings` field: rows are separated by `template_text` line feeds; each row is a fact segment with
 * the cells separated by spaces, then a fact segment with the team name (content module `composeSlide`). A row that
 * does not have that shape is refused (the slide would otherwise show values it cannot attribute).
 */
export function standingsRowsOf(segments: readonly StoredSegment[]): StandingsRowContent[] {
  const rows: StoredSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.provenance === 'template_text' && segment.text.trim() === '') {
      rows.push([]);
    } else {
      rows[rows.length - 1]?.push(segment);
    }
  }
  return rows
    .filter((row) => row.length > 0)
    .map((row) => {
      const [cellsSegment, teamSegment, ...rest] = row;
      const cells = cellsSegment?.text.trim().split(/\s+/u) ?? [];
      if (
        cellsSegment === undefined ||
        teamSegment === undefined ||
        rest.length > 0 ||
        cells.length !== STANDINGS_CELL_COUNT ||
        teamSegment.text.trim() === ''
      ) {
        throw new SlideContentError('a standings row does not have the stored row shape');
      }
      return { cells, cellsFactId: cellsSegment.factId, team: teamSegment.text, teamFactId: teamSegment.factId };
    });
}

/** Stored slide text that a template cannot draw; fixed message (T10-F10). */
export class SlideContentError extends Error {
  override readonly name = 'SlideContentError';
}
