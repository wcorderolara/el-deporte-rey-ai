/**
 * Contract schemas Failure, Settings and SourceInfo, and the health response (operations getHealth, getSettings).
 */
import { z } from 'zod';

import { DataModeSchema, LanguageSchema, SourceIdSchema, uniquePrimitives } from './primitives.js';

/** Response body of `GET /api/v1/health` (operation getHealth). */
export const HealthResponseSchema = z.strictObject({ status: z.literal('ok') });

/** Closed failure codes of stages and runs (T10-F10). */
export const FailureCodeSchema = z.enum([
  'unavailable',
  'rate_limited',
  'timeout',
  'no_data',
  'invalid',
  'access_refused',
  'not_available',
  'bad_request',
  'ai_response_invalid',
  'interrupted',
  'stage_not_available',
  'run_superseded',
  'internal',
]);

/** Stage or run failure built from a closed code and sanitized parameters only (T10-F10). */
export const FailureSchema = z.strictObject({
  code: FailureCodeSchema,
  sourceId: SourceIdSchema.nullable(),
  /** Validation path inside a payload, never a file path. */
  path: z.string().max(200).nullable(),
  httpStatus: z.int().nullable(),
});

export const SourceRoleSchema = z.enum(['primary', 'verification']);

export const PublicationPermissionSchema = z.enum(['confirmed', 'unconfirmed', 'not_applicable']);

export const SourceInfoSchema = z.strictObject({
  id: SourceIdSchema,
  name: z.string().max(80),
  mode: DataModeSchema,
  role: SourceRoleSchema,
  officialPublication: z.boolean(),
  accepted: z.boolean(),
  enabled: z.boolean(),
  publicationPermission: PublicationPermissionSchema,
});

/** Publication policies (PD-17, PD-18, AD-38); the configuration accepts only the decided values. */
export const VerificationPolicySchema = z.strictObject({
  manuallyApprovedPublication: z.enum(['blocked', 'allowed_labelled', 'allowed_without_accepted_source']),
  livePublicationPermissionRule: z.enum(['every_supporting_source', 'any_supporting_source']),
});

/** Non-secret settings the UI needs (R-226); never credentials, tokens or base URLs. */
export const SettingsSchema = z.strictObject({
  languages: z.array(z.strictObject({ code: LanguageSchema, label: z.string() })),
  defaultLanguage: LanguageSchema,
  format: z.strictObject({ width: z.int(), height: z.int(), maxSlidesPerCarousel: z.int() }),
  publicationMode: z.enum(['manual']),
  /** Data acquisition modes with at least one enabled source. */
  dataModes: uniquePrimitives(z.array(DataModeSchema)),
  verificationPolicy: VerificationPolicySchema,
  providers: z.strictObject({ sources: z.array(SourceInfoSchema), ai: z.string() }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type FailureCode = z.infer<typeof FailureCodeSchema>;
export type Failure = z.infer<typeof FailureSchema>;
export type SourceRole = z.infer<typeof SourceRoleSchema>;
export type PublicationPermission = z.infer<typeof PublicationPermissionSchema>;
export type SourceInfo = z.infer<typeof SourceInfoSchema>;
export type VerificationPolicy = z.infer<typeof VerificationPolicySchema>;
export type Settings = z.infer<typeof SettingsSchema>;
