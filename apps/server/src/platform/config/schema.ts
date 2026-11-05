/**
 * Zod schemas of the configuration documents (architecture.md sections 5.1, 12.1 and 15.2; AD-38).
 *
 * Every object is closed (unknown keys are errors). Every error is converted into a `ConfigIssue` that names the
 * setting with fixed problem text and never echoes a configured value (OD-20).
 */
import { z } from 'zod';

import { CONTENT_LANGUAGES, type Language } from '../format/text.js';
import { MAX_UTC_OFFSET_MINUTES, MIN_UTC_OFFSET_MINUTES } from '../format/format.js';

import type { ConfigIssue } from './errors.js';
import { displayKey, formatPath, isPlainObject } from './keys.js';
import {
  DATA_MODES,
  LIVE_PUBLICATION_PERMISSION_RULES,
  MANUALLY_APPROVED_PUBLICATION_POLICIES,
  PUBLICATION_PERMISSIONS,
  SOURCE_ROLES,
} from './types.js';

/** Configured source IDs (contracts/provider-ports.md section 1.2; contract `SourceId`). */
export const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;
/** Catalogue, season, stage and link IDs (contract `Slug`). */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Adapter kinds and AI adapter IDs. */
export const ADAPTER_KIND_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;
/** A recorded Product Owner decision (AD-38 item 6). */
export const DECISION_ID_PATTERN = /^PD-[0-9]{2,4}$/;

/**
 * Instagram's published maximum of photos and videos in one carousel post (Instagram Help Center: "up to 20 photos
 * and videos", raised from 10 in 2024). The default of `format.maxSlidesPerCarousel` and its upper bound (U-11).
 */
export const INSTAGRAM_MAX_CAROUSEL_ITEMS = 20;
/** Smallest useful carousel: a cover, one match and a closing slide. */
export const MIN_SLIDES_PER_CAROUSEL = 3;
/** Default portrait format (BR-08, OD-04, PD-09). */
export const DEFAULT_FORMAT = { width: 1080, height: 1350, maxSlidesPerCarousel: INSTAGRAM_MAX_CAROUSEL_ITEMS };
/** Default standings rows per slide (architecture.md section 8.1). */
export const DEFAULT_STANDINGS_ROWS_PER_SLIDE = 12;
/** Default display offset: `America/Guatemala`, UTC-06:00 without daylight saving time. */
export const DEFAULT_UTC_OFFSET_MINUTES = -360;
export const DEFAULT_PORT = 4300;
export const LOOPBACK_HOST = '127.0.0.1';
export const DEFAULT_CONFIG_FILE = 'config/app.config.json';
export const DEFAULT_LANGUAGES_FILE = 'config/languages.json';
export const DEFAULT_BRAND_FILE = 'config/brand.json';

const NO_CONTROL_CHARACTERS = /^[^\p{Cc}\p{Cf}]*$/u;

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

/** Fixed problem text by issue code; custom issues carry their own fixed text. */
function describeIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'custom':
      return issue.message;
    case 'invalid_type':
      return issue.input === undefined ? 'is required' : `must be ${describeExpected(issue.expected)}`;
    case 'unrecognized_keys':
      return `contains unknown keys: ${issue.keys.map(displayKey).join(', ')}`;
    case 'too_small':
    case 'too_big':
      return issue.origin === 'array' ? 'has the wrong number of entries' : 'is out of range';
    case 'invalid_format':
      return 'has an invalid format';
    case 'invalid_value':
      return 'is not an accepted value';
    default:
      return 'is invalid';
  }
}

function describeExpected(expected: string): string {
  return expected === 'object' ? 'an object' : expected === 'array' ? 'an array' : `a ${expected}`;
}

/** Parse parameters: inputs are reported only so that a missing key can be told apart; they are never echoed. */
export const PARSE_PARAMS = { reportInput: true } as const;

/** Converts Zod issues to configuration issues under a setting prefix. */
export function toConfigIssues(error: z.ZodError, prefix: string): ConfigIssue[] {
  return error.issues.map((issue) => ({ setting: formatPath(prefix, issue.path), problem: describeIssue(issue) }));
}

/** A string that must be one of `values`; `refused` gives specific fixed text for known but refused values. */
function oneOf<const T extends readonly string[]>(
  values: T,
  problem: string,
  refused: ReadonlyMap<string, string> = new Map(),
): z.ZodType<T[number], unknown> {
  const accepted = new Set<string>(values);
  return z.unknown().transform((value, ctx): T[number] => {
    if (typeof value === 'string' && accepted.has(value)) {
      return value as T[number];
    }
    const refusal = typeof value === 'string' ? refused.get(value) : undefined;
    ctx.addIssue({ code: 'custom', message: refusal ?? problem });
    return z.NEVER;
  });
}

/** A string matching `regex`, with specific fixed problem text. */
function matching(regex: RegExp, problem: string): z.ZodType<string, unknown> {
  return z.unknown().transform((value, ctx): string => {
    if (typeof value === 'string' && regex.test(value)) {
      return value;
    }
    ctx.addIssue({ code: 'custom', message: problem });
    return z.NEVER;
  });
}

/** Printable text without control or format characters. */
const text = (max: number): z.ZodString => z.string().min(1).max(max).regex(NO_CONTROL_CHARACTERS);
const pattern = (regex: RegExp, max: number): z.ZodString => z.string().min(1).max(max).regex(regex);
const integer = (min: number, max: number): z.ZodNumber => z.number().int().min(min).max(max);

/** A file path setting (relative to the project root, or absolute). */
const filePath = text(1024);

/** Opaque adapter options: a plain JSON object, validated later by the adapter (provider-ports section 1.2). */
const adapterOptions = z.custom<Record<string, unknown>>((value) => isPlainObject(value), {
  error: 'must be a JSON object',
});

// ---------------------------------------------------------------------------------------------------------------
// Server: loopback host and explicit Host and Origin allow-lists (architecture.md section 12.1; T10-F02)
// ---------------------------------------------------------------------------------------------------------------

const PORT_TEXT = '([1-9][0-9]{0,4})';
const ALLOWED_HOST = new RegExp(`^(127\\.0\\.0\\.1|localhost):${PORT_TEXT}$`);
const ALLOWED_ORIGIN = new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${PORT_TEXT}$`);
const ALLOW_LIST_PROBLEM =
  'must list exact loopback values only: wildcards, 0.0.0.0, other hosts and missing or invalid ports are refused';

function hasValidPort(match: RegExpExecArray | null): boolean {
  return match !== null && Number(match[2]) <= 65535;
}

const allowListEntry = (regex: RegExp, kind: string): z.ZodType<string, unknown> =>
  z.unknown().transform((value, ctx): string => {
    if (typeof value === 'string' && hasValidPort(regex.exec(value))) {
      return value;
    }
    ctx.addIssue({ code: 'custom', message: `${ALLOW_LIST_PROBLEM} (${kind})` });
    return z.NEVER;
  });

const uniqueList = <T extends z.ZodType<string, unknown>>(entry: T) =>
  z
    .array(entry)
    .min(1)
    .max(16)
    .superRefine((list, ctx) => {
      if (new Set(list).size !== list.length) {
        ctx.addIssue({ code: 'custom', message: 'must not contain duplicates' });
      }
    });

const serverSchema = z.strictObject({
  host: oneOf([LOOPBACK_HOST] as const, 'must be 127.0.0.1: the server listens on the loopback interface only').default(
    LOOPBACK_HOST,
  ),
  port: integer(1, 65535).default(DEFAULT_PORT),
  allowedHosts: uniqueList(allowListEntry(ALLOWED_HOST, 'expected 127.0.0.1:<port> or localhost:<port>')).optional(),
  allowedOrigins: uniqueList(
    allowListEntry(ALLOWED_ORIGIN, 'expected http://127.0.0.1:<port> or http://localhost:<port>'),
  ).optional(),
});

// ---------------------------------------------------------------------------------------------------------------
// Sources and verification policy (architecture.md section 5.1; AD-28, AD-38; OD-20, OD-24)
// ---------------------------------------------------------------------------------------------------------------

const sourceSchema = z.strictObject({
  id: pattern(SOURCE_ID_PATTERN, 41),
  name: text(80),
  mode: oneOf(DATA_MODES, 'is not a known data mode (expected LIVE_DATA, MANUAL_DATA or DEMO_DATA)'),
  enabled: z.boolean().default(true),
  role: oneOf(SOURCE_ROLES, 'must be primary or verification'),
  accepted: z.boolean().default(false),
  independenceGroup: pattern(SLUG_PATTERN, 64).optional(),
  officialPublication: z.boolean().default(false),
  publicationPermission: oneOf(PUBLICATION_PERMISSIONS, 'must be confirmed, unconfirmed or not_applicable').optional(),
  publicationPermissionDecision: matching(
    DECISION_ID_PATTERN,
    'must name a recorded Product Owner decision (PD-<number>)',
  ).optional(),
  adapter: pattern(ADAPTER_KIND_PATTERN, 41),
  options: adapterOptions.default({}),
  /** MANUAL_DATA whose values the operator validated before generation (PD-ARCH-01E-PD-01). */
  operatorValidated: z.boolean().default(false),
});

export type RawSource = z.output<typeof sourceSchema>;

const verificationPolicySchema = z.strictObject({
  manuallyApprovedPublication: oneOf(
    MANUALLY_APPROVED_PUBLICATION_POLICIES,
    'must be allowed_without_accepted_source or blocked',
    new Map([
      [
        'allowed_labelled',
        'must not be allowed_labelled: PD-17 chose allowed_without_accepted_source (default) or blocked',
      ],
    ]),
  ).default('allowed_without_accepted_source'),
  livePublicationPermissionRule: oneOf(
    LIVE_PUBLICATION_PERMISSION_RULES,
    'must be every_supporting_source',
    new Map([['any_supporting_source', 'must not be any_supporting_source: PD-18 requires every_supporting_source']]),
  ).default('every_supporting_source'),
});

// ---------------------------------------------------------------------------------------------------------------
// Application configuration document (config/app.config.json or EDR_CONFIG)
// ---------------------------------------------------------------------------------------------------------------

export const appDocumentSchema = z.strictObject({
  server: serverSchema.prefault({}),
  dataDir: filePath.default('data'),
  display: z
    .strictObject({
      utcOffsetMinutes: integer(MIN_UTC_OFFSET_MINUTES, MAX_UTC_OFFSET_MINUTES).default(DEFAULT_UTC_OFFSET_MINUTES),
    })
    .prefault({}),
  format: z
    .strictObject({
      width: integer(200, 4096).default(DEFAULT_FORMAT.width),
      height: integer(200, 4096).default(DEFAULT_FORMAT.height),
      maxSlidesPerCarousel: integer(MIN_SLIDES_PER_CAROUSEL, INSTAGRAM_MAX_CAROUSEL_ITEMS).default(
        DEFAULT_FORMAT.maxSlidesPerCarousel,
      ),
    })
    .prefault({}),
  standingsRowsPerSlide: integer(1, 40).default(DEFAULT_STANDINGS_ROWS_PER_SLIDE),
  publicationMode: oneOf(['manual'] as const, 'must be manual: there is no automatic publication (BR-11)').default(
    'manual',
  ),
  providers: z.strictObject({
    sports: z.strictObject({ sources: z.array(sourceSchema).max(32) }),
    ai: z.strictObject({ adapter: pattern(ADAPTER_KIND_PATTERN, 41), options: adapterOptions.default({}) }),
  }),
  verificationPolicy: verificationPolicySchema.prefault({}),
  catalogue: z.strictObject({ linksFile: filePath }).optional(),
  languagesFile: filePath.default(DEFAULT_LANGUAGES_FILE),
  brandFile: filePath.default(DEFAULT_BRAND_FILE),
});

export type AppDocument = z.output<typeof appDocumentSchema>;

// ---------------------------------------------------------------------------------------------------------------
// Catalogue links (config/catalogue.json; architecture.md section 15.2; AD-23, AD-38)
// ---------------------------------------------------------------------------------------------------------------

/**
 * `stageAliases`: `{ "<sourceId>": { "<stage id>": "<canonical stage id>" } }`, converted into `Map`s so that a key
 * such as `constructor` never reaches an inherited property (T11H-F07). Keys are checked by pattern before use.
 */
const stageAliasesSchema = z.unknown().transform((value, ctx): Map<string, Map<string, string>> => {
  const result = new Map<string, Map<string, string>>();
  if (!isPlainObject(value)) {
    ctx.addIssue({ code: 'custom', message: 'must be a JSON object keyed by source ID' });
    return z.NEVER;
  }
  const sourceIds = Object.keys(value);
  if (sourceIds.length > 16) {
    ctx.addIssue({ code: 'custom', message: 'has the wrong number of entries' });
    return z.NEVER;
  }
  for (const sourceId of sourceIds) {
    if (!SOURCE_ID_PATTERN.test(sourceId)) {
      ctx.addIssue({ code: 'custom', message: 'has a key that is not a source ID' });
      continue;
    }
    const aliases = value[sourceId];
    if (!isPlainObject(aliases) || Object.keys(aliases).length > 200) {
      ctx.addIssue({ code: 'custom', path: [sourceId], message: 'must be a JSON object of at most 200 stage aliases' });
      continue;
    }
    const map = new Map<string, string>();
    for (const stageId of Object.keys(aliases)) {
      const canonical = aliases[stageId];
      if (!SLUG_PATTERN.test(stageId) || typeof canonical !== 'string' || !SLUG_PATTERN.test(canonical)) {
        ctx.addIssue({
          code: 'custom',
          path: [sourceId],
          message: 'must map stage IDs to canonical stage IDs (slugs)',
        });
        continue;
      }
      map.set(stageId, canonical);
    }
    result.set(sourceId, map);
  }
  return result;
});

const bindingSchema = z.strictObject({
  sourceId: pattern(SOURCE_ID_PATTERN, 41),
  /** Opaque competition reference interpreted only by the source's adapter. */
  competitionRef: text(512),
});

const linkSchema = z.strictObject({
  id: pattern(SLUG_PATTERN, 64),
  name: text(80),
  reference: z.boolean().default(false),
  bindings: z.array(bindingSchema).max(16),
  stageAliases: stageAliasesSchema.optional(),
  selectableStages: z.array(pattern(SLUG_PATTERN, 64)).min(1).max(100).optional(),
  noAcceptedPublicSource: z.boolean().default(false),
});

export const catalogueDocumentSchema = z.strictObject({
  links: z.array(linkSchema).max(200).default([]),
  restrictToLinks: z.boolean().default(false),
});

export type CatalogueDocument = z.output<typeof catalogueDocumentSchema>;
export type RawLink = z.output<typeof linkSchema>;

/** Paths of `stageAliases` members whose keys are data (stage IDs), for the key scan. */
export function isStageAliasDataPath(path: readonly PropertyKey[]): boolean {
  return path.length >= 4 && path[0] === 'links' && path[2] === 'stageAliases';
}

// ---------------------------------------------------------------------------------------------------------------
// Languages (config/languages.json; OD-11, R-425) and brand (config/brand.json; OD-07, R-032, R-418)
// ---------------------------------------------------------------------------------------------------------------

const languageSchema = oneOf(CONTENT_LANGUAGES, 'must be es or en');

export const languagesDocumentSchema = z
  .strictObject({
    defaultLanguage: languageSchema,
    languages: z
      .array(z.strictObject({ code: languageSchema, label: text(40) }))
      .min(1)
      .max(CONTENT_LANGUAGES.length),
  })
  .superRefine((document, ctx) => {
    const codes = new Set<Language>(document.languages.map((language) => language.code));
    if (codes.size !== document.languages.length) {
      ctx.addIssue({ code: 'custom', path: ['languages'], message: 'must not list a language twice' });
    }
    if (!codes.has(document.defaultLanguage)) {
      ctx.addIssue({ code: 'custom', path: ['defaultLanguage'], message: 'must be one of the listed languages' });
    }
  });

const colour = matching(/^#[0-9A-Fa-f]{6}$/, 'must be a #RRGGBB colour');
const fontRole = z.strictObject({
  family: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9 -]+$/),
  weight: integer(100, 900).multipleOf(100),
});

export const brandDocumentSchema = z.strictObject({
  name: text(80),
  handle: matching(/^@[A-Za-z0-9._]{1,30}$/, 'must be an @handle of 1 to 30 letters, digits, dots or underscores'),
  mascotName: text(40).optional(),
  provisional: z.boolean(),
  palette: z.strictObject({ primary: colour, primaryDark: colour, accent: colour, secondary: colour, light: colour }),
  fonts: z.strictObject({ heading: fontRole, body: fontRole, numeric: fontRole }),
});
