/**
 * Value rules of the provider-neutral domain (`contracts/provider-ports.md` section 1.3): name rules (T10-F06),
 * attribution references (T11H-F14), opaque source references (AD-21), source keys and times with an explicit offset.
 */
import { z } from 'zod';

import { DisplayNameSchema, StageNameSchema, TeamNameSchema } from '../http/primitives.js';

/**
 * Team names and aliases: 1 to 64 characters, Unicode letters, marks, digits, spaces and `.'&-()` only; no control or
 * format character can match (T10-F06). Same rule as the contract's TeamName.
 */
export const DomainTeamNameSchema = TeamNameSchema;

/** Competition, area and season names: the team-name rule plus `/`, 1 to 80 characters. */
export const DomainDisplayNameSchema = DisplayNameSchema;

/** Stage names as the source gives them: the display-name rule plus `_`, 1 to 80 characters. */
export const DomainStageNameSchema = StageNameSchema;

/** Prefixes of a provider-neutral attribution reference (T11H-F14, AD-36). */
export const ATTRIBUTION_REF_PREFIXES = ['source:', 'fixture:', 'import:'] as const;

/** Maximum length of an attribution reference and of an opaque source reference. */
export const REF_MAX_LENGTH = 512;

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;
const CONTROL = /\p{Cc}/u;

/**
 * Attribution reference (`ref` and `sourceRef` of a selection snapshot): 1 to 512 characters, no control or format
 * character, prefix `source:`, `fixture:` or `import:`, and never a URL (`://` refused; T11H-F14). Shown as text only.
 */
export const AttributionRefSchema = z
  .string()
  .min(1)
  .max(REF_MAX_LENGTH)
  .refine((value) => !CONTROL_OR_FORMAT.test(value), { message: 'Reference contains a control or format character' })
  .refine((value) => ATTRIBUTION_REF_PREFIXES.some((prefix) => value.startsWith(prefix)), {
    message: 'Reference must start with source:, fixture: or import:',
  })
  .refine((value) => !value.includes('://'), { message: 'Reference must not be a URL' });

/**
 * Opaque adapter-owned reference (`SourceRef`, AD-21): at most 512 characters, no control character. Core code stores
 * it and passes it back to the adapter of the same source unchanged; it never parses, compares or logs its content.
 */
export const OpaqueSourceRefSchema = z
  .string()
  .min(1)
  .max(REF_MAX_LENGTH)
  .refine((value) => !CONTROL.test(value), { message: 'Reference contains a control character' });

/**
 * Key that a source gives to a team or a match inside one snapshot: 1 to 128 characters, no control or format
 * character. Keys are compared only through `Set` and `Map` lookups (T11H-F07).
 */
export const SourceKeySchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => !CONTROL_OR_FORMAT.test(value), { message: 'Key contains a control or format character' });

/** Time that must parse as an ISO-8601 date-time with an explicit offset (`Z` or `+hh:mm`). */
export const OffsetDateTimeSchema = z.iso.datetime({ offset: true });

/** Non-negative safe integer. */
export const CountSchema = z.int().min(0);

export type AttributionRef = z.infer<typeof AttributionRefSchema>;
export type OpaqueSourceRef = z.infer<typeof OpaqueSourceRefSchema>;
export type SourceKey = z.infer<typeof SourceKeySchema>;
