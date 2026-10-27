/**
 * Primitive schemas of the HTTP contract `contracts/http-api.openapi.yaml` (`components.schemas` Uuid, Slug, SourceId,
 * MatchKey, Label, DisplayName, StageName, TeamName, FileName and the shared enums), plus the inline string formats
 * that several schemas repeat (SHA-256, date-time, date).
 *
 * The OpenAPI document is authoritative (AD-04). Every pattern below is the exact pattern text of the contract,
 * evaluated with the Unicode flag as the contract states; the contract tests check that both sets of patterns agree.
 */
import { z } from 'zod';

/** Exact `pattern` strings of the contract, keyed by the schema or property that carries them. */
export const ContractPatterns = {
  Uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  Slug: '^[a-z0-9][a-z0-9-]{0,63}$',
  SourceId: '^[a-z0-9][a-z0-9-]{1,40}$',
  MatchKey: '^[a-z0-9][a-z0-9:_-]{0,127}$',
  Label: '^[^\\p{Cc}\\p{Cf}]{1,80}$',
  DisplayName: "^[\\p{L}\\p{M}\\p{N} .'&()/-]{1,80}$",
  StageName: "^[\\p{L}\\p{M}\\p{N} .'&()/_-]{1,80}$",
  TeamName: "^[\\p{L}\\p{M}\\p{N} .'&()-]{1,64}$",
  FileName: '^[\\p{L}\\p{M}\\p{N} ._()-]{1,115}\\.(json|csv)$',
  Sha256: '^[0-9a-f]{64}$',
  ColorHex: '^#[0-9a-f]{6}$',
  ExportFileName: '^([0-9]{2}\\.png|caption\\.txt|manifest\\.json)$',
  Base64: '^[A-Za-z0-9+/]*={0,2}$',
} as const;

export type ContractPatternName = keyof typeof ContractPatterns;

/** Compiles a contract pattern with the Unicode flag (ECMA-262 `u`), as the contract specifies. */
export function contractRegExp(name: ContractPatternName): RegExp {
  return new RegExp(ContractPatterns[name], 'u');
}

/** Server-generated identifier (crypto.randomUUID), lowercase. */
export const UuidSchema = z.string().min(36).max(36).regex(contractRegExp('Uuid'));

/** Catalogue, season, stage, team-key or template identifier. */
export const SlugSchema = z.string().min(1).max(64).regex(contractRegExp('Slug'));

/** Configured source identifier. */
export const SourceIdSchema = z.string().min(2).max(41).regex(contractRegExp('SourceId'));

/** Canonical match key assigned by the verification stage. */
export const MatchKeySchema = z.string().min(1).max(128).regex(contractRegExp('MatchKey'));

/** Printable text; control and format characters are refused. */
export const LabelSchema = z.string().min(1).max(80).regex(contractRegExp('Label'));

/** Competition, area or season name. */
export const DisplayNameSchema = z.string().min(1).max(80).regex(contractRegExp('DisplayName'));

/** Stage name as the source gives it. */
export const StageNameSchema = z.string().min(1).max(80).regex(contractRegExp('StageName'));

/** Team name (T10-F06 rule). */
export const TeamNameSchema = z.string().min(1).max(64).regex(contractRegExp('TeamName'));

/** Name of an imported file, without any path; NFD names with combining marks are accepted (T11H-F20). */
export const FileNameSchema = z.string().min(6).max(120).regex(contractRegExp('FileName'));

/** Lowercase hexadecimal SHA-256 digest. */
export const Sha256Schema = z.string().regex(contractRegExp('Sha256'));

/** Contract `format: date-time` (RFC 3339 date-time with `Z` or an explicit offset). */
export const DateTimeSchema = z.iso.datetime({ offset: true });

/** Contract `format: date` (RFC 3339 full-date). */
export const DateSchema = z.iso.date();

/** Data acquisition mode (PD-13). */
export const DataModeSchema = z.enum(['LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA']);

/** Provider-neutral match status. */
export const MatchStatusSchema = z.enum([
  'scheduled',
  'in_play',
  'finished',
  'postponed',
  'suspended',
  'cancelled',
  'abandoned',
  'awarded',
]);

/** Content language. */
export const LanguageSchema = z.enum(['es', 'en']);

/** JSON Schema `uniqueItems` for arrays of primitive values. */
export function uniquePrimitives<T extends z.ZodType<string | number | boolean | null>>(
  array: z.ZodArray<T>,
): z.ZodArray<T> {
  return array.refine((items) => new Set(items).size === items.length, { message: 'Items must be unique' });
}

export type Uuid = z.infer<typeof UuidSchema>;
export type Slug = z.infer<typeof SlugSchema>;
export type SourceId = z.infer<typeof SourceIdSchema>;
export type MatchKey = z.infer<typeof MatchKeySchema>;
export type Label = z.infer<typeof LabelSchema>;
export type DisplayName = z.infer<typeof DisplayNameSchema>;
export type StageName = z.infer<typeof StageNameSchema>;
export type TeamName = z.infer<typeof TeamNameSchema>;
export type FileName = z.infer<typeof FileNameSchema>;
export type DataMode = z.infer<typeof DataModeSchema>;
export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type Language = z.infer<typeof LanguageSchema>;
