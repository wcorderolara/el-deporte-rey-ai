/**
 * Contract schemas of MANUAL_DATA imports (operations listImports, createImport, getImport, listManualSelections,
 * getManualVersion): ImportCreate, ImportFileCreate, ImportFormCreate, ManualImportDocument, ManualSelection,
 * ImportError, ImportSummary, ManualSelectionHistory, ManualVersion.
 */
import { z } from 'zod';

import {
  ContractPatterns,
  DateTimeSchema,
  DisplayNameSchema,
  FileNameSchema,
  LabelSchema,
  MatchStatusSchema,
  Sha256Schema,
  SlugSchema,
  StageNameSchema,
  TeamNameSchema,
  UuidSchema,
} from './primitives.js';

/** Format marker of the one normalized import document. */
/**
 * The largest score of a team that a form import accepts (`score.home`, `score.away`). The frozen selection of a local
 * content batch is recorded through this import, so a local result above it is reported as `score_not_supported`
 * (UI06.3-D06) instead of making the confirmation fail.
 */
export const IMPORT_SCORE_MAX = 99;

export const MANUAL_IMPORT_FORMAT = 'edr-manual-import/1';

/** At most 512 KiB of decoded bytes, as standard padded base64 characters (T11H-F01). */
export const IMPORT_CONTENT_BASE64_MAX_LENGTH = 699052;

const boundedDateTime = DateTimeSchema.max(40);
const count = z.int().min(0).max(999);

export const ManualSelectionSchema = z.strictObject({
  stage: z.strictObject({ id: SlugSchema, name: StageNameSchema, order: z.int().min(1).max(99) }),
  matchday: z.int().min(1).max(999).nullable(),
  teams: z
    .array(z.strictObject({ key: SlugSchema, name: TeamNameSchema }))
    .min(2)
    .max(64),
  matches: z
    .array(
      z.strictObject({
        home: SlugSchema,
        away: SlugSchema,
        kickoff: boundedDateTime,
        status: MatchStatusSchema,
        score: z
          .strictObject({ home: z.int().min(0).max(IMPORT_SCORE_MAX), away: z.int().min(0).max(IMPORT_SCORE_MAX) })
          .nullable(),
      }),
    )
    .min(1)
    .max(64),
  standings: z
    .strictObject({
      asOf: boundedDateTime,
      rows: z
        .array(
          z.strictObject({
            position: z.int().min(1).max(64),
            team: SlugSchema,
            played: count,
            won: count,
            drawn: count,
            lost: count,
            goalsFor: count,
            goalsAgainst: count,
            goalDifference: z.int().min(-999).max(999),
            points: z.int().min(-999).max(999),
          }),
        )
        .min(1)
        .max(64),
    })
    .nullable(),
});

/** The one normalized import format of every MANUAL_DATA channel; person-level fields do not exist (R-119). */
export const ManualImportDocumentSchema = z.strictObject({
  format: z.literal(MANUAL_IMPORT_FORMAT),
  competition: z.strictObject({ id: SlugSchema, name: DisplayNameSchema, areaName: DisplayNameSchema.nullable() }),
  season: z.strictObject({ id: SlugSchema, label: DisplayNameSchema }),
  selections: z.array(ManualSelectionSchema).min(1).max(100),
});

export const ImportFileChannelSchema = z.enum(['json_file', 'csv_file']);

export const ImportChannelSchema = z.enum(['json_file', 'csv_file', 'form']);

/** File channels: the exact file bytes as standard base64 (RFC 4648 section 4, padded, no line breaks; T11H-F01). */
export const ImportFileCreateSchema = z.strictObject({
  channel: ImportFileChannelSchema,
  fileName: FileNameSchema,
  declaredSource: LabelSchema.nullable(),
  contentBase64: z
    .string()
    .min(4)
    .max(IMPORT_CONTENT_BASE64_MAX_LENGTH)
    .regex(new RegExp(ContractPatterns.Base64, 'u')),
});

/** Form channel: the document built by the web form (R-057, R-319). */
export const ImportFormCreateSchema = z.strictObject({
  channel: z.literal('form'),
  declaredSource: LabelSchema.nullable(),
  document: ManualImportDocumentSchema,
});

export const ImportCreateSchema = z.discriminatedUnion('channel', [ImportFileCreateSchema, ImportFormCreateSchema]);

export const ImportProblemSchema = z.enum([
  'parse_error',
  'encoding_invalid',
  'too_large',
  'too_many_rows',
  'header_invalid',
  'column_unknown',
  'person_field',
  'required_missing',
  'type_invalid',
  'value_out_of_range',
  'value_inconsistent',
  'duplicate_match',
  'unknown_team',
  'metadata_missing',
  'metadata_conflict',
  'finished_without_score',
  'score_not_allowed',
]);

export const ImportErrorSchema = z.strictObject({
  location: z.enum(['file', 'form']),
  /** Row number (CSV), JSON pointer (JSON, form) or "file". */
  record: z.string().max(120),
  /** Column or field name, sanitized; for a refused person-level column its header name. */
  field: z.string().max(80).nullable(),
  problem: ImportProblemSchema,
  /** Fixed text plus sanitized parameters only. */
  message: z.string().max(200),
});

export const ImportSummarySchema = z.strictObject({
  id: UuidSchema,
  channel: ImportChannelSchema,
  fileName: FileNameSchema.nullable(),
  declaredSource: LabelSchema.nullable(),
  receivedAt: DateTimeSchema,
  competitionId: SlugSchema,
  competitionName: DisplayNameSchema,
  seasonId: SlugSchema,
  seasonLabel: DisplayNameSchema,
  originalSha256: Sha256Schema,
  selections: z.array(
    z.strictObject({
      stageId: SlugSchema,
      stageName: StageNameSchema,
      matchday: z.int().nullable(),
      versionId: UuidSchema,
      versionNumber: z.int().min(1),
    }),
  ),
});

export const ManualSelectionHistorySchema = z.strictObject({
  competitionId: SlugSchema,
  seasonId: SlugSchema,
  selections: z.array(
    z.strictObject({
      stageId: SlugSchema,
      stageName: StageNameSchema,
      matchday: z.int().nullable(),
      versions: z.array(
        z.strictObject({
          versionId: UuidSchema,
          versionNumber: z.int().min(1),
          importId: UuidSchema,
          createdAt: DateTimeSchema,
          current: z.boolean(),
        }),
      ),
    }),
  ),
});

export const ManualVersionSchema = z.strictObject({
  id: UuidSchema,
  versionNumber: z.int().min(1),
  importId: UuidSchema,
  createdAt: DateTimeSchema,
  supersededAt: DateTimeSchema.nullable(),
  competitionId: SlugSchema,
  seasonId: SlugSchema,
  selection: ManualSelectionSchema,
});

export type ManualSelection = z.infer<typeof ManualSelectionSchema>;
export type ManualImportDocument = z.infer<typeof ManualImportDocumentSchema>;
export type ImportFileChannel = z.infer<typeof ImportFileChannelSchema>;
export type ImportChannel = z.infer<typeof ImportChannelSchema>;
export type ImportFileCreate = z.infer<typeof ImportFileCreateSchema>;
export type ImportFormCreate = z.infer<typeof ImportFormCreateSchema>;
export type ImportCreate = z.infer<typeof ImportCreateSchema>;
export type ImportProblem = z.infer<typeof ImportProblemSchema>;
export type ImportError = z.infer<typeof ImportErrorSchema>;
export type ImportSummary = z.infer<typeof ImportSummarySchema>;
export type ManualSelectionHistory = z.infer<typeof ManualSelectionHistorySchema>;
export type ManualVersion = z.infer<typeof ManualVersionSchema>;
