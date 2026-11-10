/**
 * Every operation of `contracts/http-api.openapi.yaml`: method, path, path and query parameters, the client header,
 * the request body, the success response and the declared problem statuses, with the Zod schemas of the inline
 * request and response bodies. The contract tests check this registry against the OpenAPI document.
 *
 * There is no publication operation of any kind (BR-11, R-042, R-219).
 */
import { z } from 'zod';

import {
  BrandAssetDescriptionSchema,
  BrandAssetDetailSchema,
  BrandAssetKindSchema,
  BrandAssetSchema,
  BrandAssetUsagePolicySchema,
  BrandIdentitySchema,
  BrandUsageNoteSchema,
  TemplateSchema,
  noteSchema,
} from './brand.js';
import {
  DesignCapabilitiesSchema,
  DesignEstimateSchema,
  DesignGenerationCreateSchema,
  DesignGenerationInputSchema,
  DesignGenerationSchema,
  DesignGenerationStartSchema,
  DesignModelAccessCheckSchema,
  DesignModelAccessSchema,
  DesignProposalDecisionInputSchema,
  DesignProposalDetailSchema,
  DesignProposalListSchema,
  DesignProposalSchema,
} from './design.js';
import {
  VisualTemplateCreateSchema,
  VisualTemplateDetailSchema,
  VisualTemplateListSchema,
  VisualTemplatePreviewRequestSchema,
  VisualTemplatePreviewSchema,
  VisualTemplatePublishSchema,
  VisualTemplateSchema,
  VisualTemplateUpdateSchema,
  VisualTemplateVersionCreateSchema,
  VisualTemplateVersionSaveSchema,
  VisualTemplateVersionSchema,
} from './visual-templates.js';
import { CatalogueSchema, SeasonListSchema, StageListSchema } from './catalog.js';
import {
  ManagedCompetitionCreateSchema,
  ManagedCompetitionListResponseSchema,
  ManagedCompetitionParamsSchema,
  ManagedCompetitionSchema,
  SportsProviderListResponseSchema,
  SportsProviderParamsSchema,
  ExternalCompetitionListResponseSchema,
  CompetitionProviderBindingParamsSchema,
  CompetitionProviderBindingCreateSchema,
  CompetitionProviderBindingResponseSchema,
  ExternalSeasonListResponseSchema,
  ImportSeasonCapabilitiesParamsSchema,
  ImportCapabilitiesResponseSchema,
  ImportPreviewCreateSchema,
  ImportPreviewParamsSchema,
  ImportPreviewResponseSchema,
  ImportApplyPlanRequestSchema,
  ImportApplyPlanResponseSchema,
  ImportApplyStartSchema,
  ImportApplyOperationParamsSchema,
  ImportApplyOperationResponseSchema,
  ImportApplyOperationStartResponseSchema,
  ImportApplicationHistoryResponseSchema,
  ImportOperationParamsSchema,
  ImportOperationResponseSchema,
  ImportOperationStartResponseSchema,
  CompetitionStageCreateSchema,
  CompetitionCalendarNameUpdateSchema,
  CompetitionRoundUpdateSchema,
  CompetitionStageSchema,
  CompetitionStageListResponseSchema,
  CompetitionRoundCreateSchema,
  CompetitionRoundSchema,
  CompetitionRoundListResponseSchema,
  CompetitionMatchCreateSchema,
  CompetitionMatchSchema,
  CompetitionMatchListResponseSchema,
  CompetitionMatchScheduleUpdateSchema,
  CompetitionMatchResultUpdateSchema,
  MatchResultHistoryListResponseSchema,
  CompetitionStageParamsSchema,
  CompetitionRoundsParamsSchema,
  CompetitionRoundParamsSchema,
  CompetitionStageRoundsParamsSchema,
  CompetitionMatchParamsSchema,
  CompetitionMatchesParamsSchema,
  ManagedSeasonCreateSchema,
  ManagedSeasonUpdateSchema,
  ManagedSeasonListResponseSchema,
  ManagedSeasonParamsSchema,
  ManagedSeasonSchema,
  ManagedTeamCreateSchema,
  ManagedTeamUpdateSchema,
  ManagedTeamListResponseSchema,
  ManagedTeamParamsSchema,
  ManagedTeamSchema,
  CompetitionTeamAddSchema,
  CompetitionTeamListResponseSchema,
  CompetitionTeamSchema,
  CompetitionTeamsParamsSchema,
  CompetitionTeamParamsSchema,
  SeasonParticipantBatchCreateSchema,
  SeasonParticipantCreateSchema,
  SeasonParticipantListResponseSchema,
  SeasonParticipantParamsSchema,
  SeasonParticipantsParamsSchema,
  SeasonParticipantSchema,
  SportsFieldProvenanceParamsSchema,
  SportsFieldProvenanceResponseSchema,
  TeamBadgeUploadQuerySchema,
} from './competitions.js';
import {
  ContentBatchCreateSchema,
  ContentBatchParamsSchema,
  ContentBatchPreviewSchema,
  ContentBatchSchema,
  ContentBatchSelectionSchema,
} from './content-batches.js';
import { ExportDetailSchema, ExportSchema, SlideTraceSchema } from './exports.js';
import { FactSchema, LeftOutMatchSchema, StandingsAvailabilitySchema } from './facts.js';
import { ImportCreateSchema, ImportSummarySchema, ManualSelectionHistorySchema, ManualVersionSchema } from './imports.js';
import {
  DataModeSchema,
  LabelSchema,
  LanguageSchema,
  MatchKeySchema,
  SlugSchema,
  SourceIdSchema,
  UuidSchema,
  contractRegExp,
  uniquePrimitives,
} from './primitives.js';
import { ProjectCreateSchema, ProjectSchema, ProjectSummarySchema, ProjectUpdateSchema, RunSchema, RunStartSchema } from './projects.js';
import { DraftSchema, ElementSchema, FinalApprovalSchema, QaWarningCheckSchema, VersionRefSchema } from './review.js';
import { HealthResponseSchema, SettingsSchema } from './system.js';

/** Base path of every operation (`servers[0].url` without the origin). */
export const API_BASE_PATH = '/api/v1';

/** Header required on every method other than GET and HEAD (local cross-origin request protection). */
export const CLIENT_HEADER_NAME = 'X-EDR-Client';

/** The only accepted value of the client header. */
export const ClientHeaderSchema = z.literal('web');

export const JSON_MEDIA_TYPE = 'application/json';

// ---------------------------------------------------------------------------------------------------------------
// Inline request and response bodies
// ---------------------------------------------------------------------------------------------------------------

/** Response of listProjects: project list and history, newest first. */
export const ProjectListResponseSchema = z.strictObject({ projects: z.array(ProjectSummarySchema) });
/** Response of listRuns: runs of the project, newest first. */
export const RunListResponseSchema = z.strictObject({ runs: z.array(RunSchema) });

/** Response of listFacts. */
export const FactListResponseSchema = z.strictObject({
  dataMode: DataModeSchema,
  facts: z.array(FactSchema),
  leftOutMatches: z.array(LeftOutMatchSchema),
  standings: StandingsAvailabilitySchema,
});

/** Request of setExcludedMatches (OD-03). */
export const ExcludedMatchesUpdateSchema = z.strictObject({
  excludedMatchKeys: uniquePrimitives(z.array(MatchKeySchema).max(64)),
});

/** Request of acknowledgeQaWarnings (OD-09, OD-26): one warning check per request. */
export const QaAcknowledgementSchema = z.strictObject({
  versionId: UuidSchema,
  checks: uniquePrimitives(z.array(QaWarningCheckSchema).min(1).max(1)),
});

/** Response of listProjectExports: exports of the project, newest first (R-220). */
export const ExportListResponseSchema = z.strictObject({ exports: z.array(ExportSchema) });

/** Response of listImports: applied imports, newest first. */
export const ImportListResponseSchema = z.strictObject({ imports: z.array(ImportSummarySchema) });

/** Response of listBrandAssets. */
export const BrandAssetListResponseSchema = z.strictObject({ assets: z.array(BrandAssetSchema) });

/**
 * Request of updateBrandAsset (PD-ARCH-01G-A): the editable metadata, the AI usage policy, the official and primary
 * marks and the active state. Every field is optional; at least one must be present. The stored file never changes.
 */
export const BrandAssetUpdateSchema = z.strictObject({
  active: z.boolean().optional(),
  label: LabelSchema.optional(),
  description: BrandAssetDescriptionSchema.nullable().optional(),
  usagePolicy: BrandAssetUsagePolicySchema.optional(),
  official: z.boolean().optional(),
  primary: z.boolean().optional(),
  variant: LabelSchema.nullable().optional(),
  pose: LabelSchema.nullable().optional(),
  expression: LabelSchema.nullable().optional(),
}).refine((body) => Object.values(body).some((value) => value !== undefined), {
  message: 'Give at least one field to change.',
});

/** Usage notes per colour or font role; null clears a note. */
const usageNotes = <T extends string>(roles: readonly [T, ...T[]]) =>
  z.strictObject(Object.fromEntries(roles.map((role) => [role, BrandUsageNoteSchema.nullable().optional()])) as {
    [K in T]: z.ZodOptional<z.ZodNullable<typeof BrandUsageNoteSchema>>;
  });

/**
 * Request of updateBrandIdentity: the descriptive fields of the identity. The name, handle, palette and fonts are the
 * renderer's configuration and are not edited here.
 */
export const BrandIdentityUpdateSchema = z.strictObject({
  description: noteSchema(1000).nullable().optional(),
  graphicPreferences: noteSchema(2000).nullable().optional(),
  colorUsage: usageNotes(['primary', 'primaryDark', 'accent', 'secondary', 'light']).optional(),
  typographyUsage: usageNotes(['heading', 'body', 'numeric']).optional(),
});

/** Response of listTemplates. */
export const TemplateListResponseSchema = z.strictObject({ templates: z.array(TemplateSchema) });

// ---------------------------------------------------------------------------------------------------------------
// Path and query parameters (values as received in the URL)
// ---------------------------------------------------------------------------------------------------------------

/** Path parameter `position` of traceExportedSlide: an integer from 1 to 99 written in canonical decimal form. */
export const PositionParamSchema = z
  .string()
  .regex(/^[1-9][0-9]?$/)
  .transform(Number)
  .pipe(z.int().min(1).max(99));

export const ProjectParamsSchema = z.strictObject({ projectId: UuidSchema });
export const RunParamsSchema = z.strictObject({ projectId: UuidSchema, runId: UuidSchema });
export const FactParamsSchema = z.strictObject({ projectId: UuidSchema, runId: UuidSchema, factId: UuidSchema });
export const SeasonListParamsSchema = z.strictObject({ competitionId: SlugSchema, sourceId: SourceIdSchema });
export const StageListParamsSchema = z.strictObject({
  competitionId: SlugSchema,
  sourceId: SourceIdSchema,
  seasonId: SlugSchema,
});
export const VersionParamsSchema = z.strictObject({ versionId: UuidSchema });
export const CarouselParamsSchema = z.strictObject({ carouselId: UuidSchema });
export const ElementParamsSchema = z.strictObject({ carouselId: UuidSchema, elementId: UuidSchema });
export const ExportParamsSchema = z.strictObject({ exportId: UuidSchema });
export const SlideTraceParamsSchema = z.strictObject({ exportId: UuidSchema, position: PositionParamSchema });
export const ImportParamsSchema = z.strictObject({ importId: UuidSchema });
export const AssetParamsSchema = z.strictObject({ assetId: UuidSchema });
export const DesignGenerationParamsSchema = z.strictObject({ generationId: UuidSchema });
export const DesignProposalParamsSchema = z.strictObject({ proposalId: UuidSchema });
export const TemplateParamsSchema = z.strictObject({ templateId: SlugSchema });
export const VisualTemplateParamsSchema = z.strictObject({ templateId: UuidSchema });
export const VisualTemplateVersionParamsSchema = z.strictObject({ templateId: UuidSchema, versionId: UuidSchema });

/** Query of listManualSelections. Undeclared query parameters are ignored. */
export const ManualSelectionsQuerySchema = z.object({ competitionId: SlugSchema, seasonId: SlugSchema });

/** A boolean query value written `true` or `false`. */
const QueryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * Query of registerBrandAsset. Undeclared query parameters are ignored. Without `usagePolicy` the category's default
 * applies (logos and mascot `protected`, style references `reference_only`, others `reusable`); `transformable` is
 * never a default.
 */
export const BrandAssetRegisterQuerySchema = z.object({
  kind: BrandAssetKindSchema,
  label: LabelSchema,
  description: BrandAssetDescriptionSchema.optional(),
  usagePolicy: BrandAssetUsagePolicySchema.optional(),
  official: QueryBooleanSchema.optional(),
  variant: LabelSchema.optional(),
  pose: LabelSchema.optional(),
  expression: LabelSchema.optional(),
});

/** Query of previewTemplate. Undeclared query parameters are ignored. */
export const TemplatePreviewQuerySchema = z.object({ language: LanguageSchema.optional() });

/**
 * Query of renderVisualTemplatePreview: the local sports data (as in VisualTemplatePreviewSelection), the language
 * and the revision the image belongs to (a changed revision is a new address). Undeclared query parameters are
 * ignored.
 */
export const VisualTemplatePreviewQuerySchema = z.object({
  competitionId: UuidSchema,
  seasonId: UuidSchema,
  roundId: UuidSchema.optional(),
  matchId: UuidSchema.optional(),
  language: LanguageSchema.optional(),
  revision: z.string().regex(contractRegExp('RevisionParam')).optional(),
});

// ---------------------------------------------------------------------------------------------------------------
// Operation registry
// ---------------------------------------------------------------------------------------------------------------

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface OperationBody {
  /** Accepted request media types. */
  readonly mediaTypes: readonly string[];
  /** Zod schema of a JSON body; null for a raw binary body. */
  readonly schema: z.ZodType | null;
}

export interface OperationSuccess {
  readonly status: number;
  readonly mediaTypes: readonly string[];
  /** Zod schema of a JSON response; null for a binary response. */
  readonly schema: z.ZodType | null;
}

export interface OperationDefinition {
  readonly operationId: string;
  readonly method: HttpMethod;
  /** Contract path relative to API_BASE_PATH, with `{name}` path templates. */
  readonly path: string;
  readonly tag: string;
  readonly params: z.ZodType | null;
  readonly query: z.ZodType | null;
  /** True when the operation requires `X-EDR-Client: web` (every method other than GET and HEAD). */
  readonly clientHeader: boolean;
  readonly body: OperationBody | null;
  readonly success: OperationSuccess;
  /** Declared problem statuses (application/problem+json, schema Problem). */
  readonly problemStatuses: readonly number[];
}

const JSON_ONLY = [JSON_MEDIA_TYPE] as const;
const PNG = ['image/png'] as const;
const IMAGES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const PROPOSAL_IMAGES = ['image/png', 'image/jpeg'] as const;
const OCTET_STREAM = ['application/octet-stream'] as const;
const ZIP = ['application/zip'] as const;

const READ = [403, 421] as const;
const READ_BY_ID = [400, 403, 404, 421] as const;
const PROVIDER_READ = [400, 403, 404, 421, 502, 503] as const;
const WRITE_NO_BODY = [400, 403, 404, 409, 415, 421] as const;
const WRITE_BODY = [400, 403, 404, 409, 413, 415, 421] as const;

function json<S extends z.ZodType>(status: number, schema: S) {
  return { status, mediaTypes: JSON_ONLY, schema } as const;
}

function jsonBody<S extends z.ZodType>(schema: S) {
  return { mediaTypes: JSON_ONLY, schema } as const;
}

export const operations = {
  getHealth: {
    operationId: 'getHealth',
    method: 'get',
    path: '/health',
    tag: 'system',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, HealthResponseSchema),
    problemStatuses: READ,
  },
  getSettings: {
    operationId: 'getSettings',
    method: 'get',
    path: '/settings',
    tag: 'system',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, SettingsSchema),
    problemStatuses: READ,
  },
  listCompetitions: {
    operationId: 'listCompetitions',
    method: 'get',
    path: '/catalog/competitions',
    tag: 'catalog',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, CatalogueSchema),
    problemStatuses: READ,
  },
  listSeasons: {
    operationId: 'listSeasons',
    method: 'get',
    path: '/catalog/competitions/{competitionId}/sources/{sourceId}/seasons',
    tag: 'catalog',
    params: SeasonListParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, SeasonListSchema),
    problemStatuses: PROVIDER_READ,
  },
  listStages: {
    operationId: 'listStages',
    method: 'get',
    path: '/catalog/competitions/{competitionId}/sources/{sourceId}/seasons/{seasonId}/stages',
    tag: 'catalog',
    params: StageListParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, StageListSchema),
    problemStatuses: PROVIDER_READ,
  },
  listProjects: {
    operationId: 'listProjects',
    method: 'get',
    path: '/projects',
    tag: 'projects',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ProjectListResponseSchema),
    problemStatuses: READ,
  },
  listManagedCompetitions: {
    operationId: 'listManagedCompetitions', method: 'get', path: '/competitions', tag: 'competitions',
    params: null, query: null, clientHeader: false, body: null,
    success: json(200, ManagedCompetitionListResponseSchema), problemStatuses: READ,
  },
  createCompetition: {
    operationId: 'createCompetition', method: 'post', path: '/competitions', tag: 'competitions',
    params: null, query: null, clientHeader: true, body: jsonBody(ManagedCompetitionCreateSchema),
    success: json(201, ManagedCompetitionSchema), problemStatuses: WRITE_BODY,
  },
  getCompetition: {
    operationId: 'getCompetition', method: 'get', path: '/competitions/{competitionId}', tag: 'competitions',
    params: ManagedCompetitionParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ManagedCompetitionSchema), problemStatuses: READ_BY_ID,
  },
  getSportsFieldProvenance: {
    operationId: 'getSportsFieldProvenance', method: 'get', path: '/competitions/{competitionId}/provenance/{entityType}/{entityId}', tag: 'competitions',
    params: SportsFieldProvenanceParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, SportsFieldProvenanceResponseSchema), problemStatuses: READ_BY_ID,
  },
  listCompetitionImportApplications: {
    operationId: 'listCompetitionImportApplications', method: 'get', path: '/competitions/{competitionId}/import-applications', tag: 'competitions',
    params: ManagedCompetitionParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ImportApplicationHistoryResponseSchema), problemStatuses: READ_BY_ID,
  },
  listSportsProviders: {
    operationId: 'listSportsProviders', method: 'get', path: '/sports/providers', tag: 'competitions',
    params: null, query: null, clientHeader: false, body: null,
    success: json(200, SportsProviderListResponseSchema), problemStatuses: READ,
  },
  listExternalCompetitions: {
    operationId: 'listExternalCompetitions', method: 'get', path: '/sports/providers/{providerKey}/competitions', tag: 'competitions',
    params: SportsProviderParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ExternalCompetitionListResponseSchema), problemStatuses: [400, 403, 404, 421, 503],
  },
  getCompetitionProviderBinding: {
    operationId: 'getCompetitionProviderBinding', method: 'get', path: '/competitions/{competitionId}/provider-binding', tag: 'competitions',
    params: CompetitionProviderBindingParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionProviderBindingResponseSchema), problemStatuses: READ_BY_ID,
  },
  setCompetitionProviderBinding: {
    operationId: 'setCompetitionProviderBinding', method: 'post', path: '/competitions/{competitionId}/provider-binding', tag: 'competitions',
    params: CompetitionProviderBindingParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionProviderBindingCreateSchema),
    success: json(201, CompetitionProviderBindingResponseSchema), problemStatuses: [400, 403, 404, 409, 413, 415, 421, 503],
  },
  removeCompetitionProviderBinding: {
    operationId: 'removeCompetitionProviderBinding', method: 'delete', path: '/competitions/{competitionId}/provider-binding', tag: 'competitions',
    params: CompetitionProviderBindingParamsSchema, query: null, clientHeader: true, body: null,
    success: { status: 204, mediaTypes: [], schema: null }, problemStatuses: WRITE_NO_BODY,
  },
  listCompetitionExternalSeasons: {
    operationId: 'listCompetitionExternalSeasons', method: 'get', path: '/competitions/{competitionId}/provider-binding/seasons', tag: 'competitions',
    params: CompetitionProviderBindingParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ExternalSeasonListResponseSchema), problemStatuses: [400, 403, 404, 409, 421, 503],
  },
  getCompetitionImportCapabilities: {
    operationId: 'getCompetitionImportCapabilities', method: 'get', path: '/competitions/{competitionId}/provider-binding/seasons/{externalSeasonId}/capabilities', tag: 'competitions',
    params: ImportSeasonCapabilitiesParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ImportCapabilitiesResponseSchema), problemStatuses: [400, 403, 404, 409, 421, 503],
  },
  startCompetitionImportOperation: {
    operationId: 'startCompetitionImportOperation', method: 'post', path: '/competitions/{competitionId}/import-operations', tag: 'competitions',
    params: CompetitionProviderBindingParamsSchema, query: null, clientHeader: true, body: jsonBody(ImportPreviewCreateSchema),
    success: json(202, ImportOperationStartResponseSchema), problemStatuses: [400, 403, 404, 409, 413, 415, 421],
  },
  getCompetitionImportOperation: {
    operationId: 'getCompetitionImportOperation', method: 'get', path: '/competitions/{competitionId}/import-operations/{operationId}', tag: 'competitions',
    params: ImportOperationParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ImportOperationResponseSchema), problemStatuses: [400, 403, 404, 421],
  },
  cancelCompetitionImportOperation: {
    operationId: 'cancelCompetitionImportOperation', method: 'post', path: '/competitions/{competitionId}/import-operations/{operationId}/cancel', tag: 'competitions',
    params: ImportOperationParamsSchema, query: null, clientHeader: true, body: null,
    success: json(200, ImportOperationResponseSchema), problemStatuses: [400, 403, 404, 415, 421],
  },
  streamCompetitionImportOperation: {
    operationId: 'streamCompetitionImportOperation', method: 'get', path: '/competitions/{competitionId}/import-operations/{operationId}/events', tag: 'competitions',
    params: ImportOperationParamsSchema, query: null, clientHeader: false, body: null,
    success: { status: 200, mediaTypes: ['text/event-stream'], schema: null }, problemStatuses: [400, 403, 404, 421],
  },
  createCompetitionImportPreview: {
    operationId: 'createCompetitionImportPreview', method: 'post', path: '/competitions/{competitionId}/import-previews', tag: 'competitions',
    params: CompetitionProviderBindingParamsSchema, query: null, clientHeader: true, body: jsonBody(ImportPreviewCreateSchema),
    success: json(201, ImportPreviewResponseSchema), problemStatuses: [400, 403, 404, 409, 413, 415, 421, 503],
  },
  getCompetitionImportPreview: {
    operationId: 'getCompetitionImportPreview', method: 'get', path: '/competitions/{competitionId}/import-previews/{previewId}', tag: 'competitions',
    params: ImportPreviewParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ImportPreviewResponseSchema), problemStatuses: [400, 403, 404, 410, 421],
  },
  planCompetitionImportApplication: {
    operationId: 'planCompetitionImportApplication', method: 'post', path: '/competitions/{competitionId}/import-previews/{previewId}/application-plan', tag: 'competitions',
    params: ImportPreviewParamsSchema, query: null, clientHeader: true, body: jsonBody(ImportApplyPlanRequestSchema),
    success: json(200, ImportApplyPlanResponseSchema), problemStatuses: [400, 403, 404, 409, 410, 413, 415, 421],
  },
  startCompetitionImportApplication: {
    operationId: 'startCompetitionImportApplication', method: 'post', path: '/competitions/{competitionId}/import-previews/{previewId}/applications', tag: 'competitions',
    params: ImportPreviewParamsSchema, query: null, clientHeader: true, body: jsonBody(ImportApplyStartSchema),
    success: json(202, ImportApplyOperationStartResponseSchema), problemStatuses: [400, 403, 404, 409, 410, 413, 415, 421],
  },
  getCompetitionImportApplication: {
    operationId: 'getCompetitionImportApplication', method: 'get', path: '/competitions/{competitionId}/import-applications/{operationId}', tag: 'competitions',
    params: ImportApplyOperationParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ImportApplyOperationResponseSchema), problemStatuses: [400, 403, 404, 421],
  },
  cancelCompetitionImportApplication: {
    operationId: 'cancelCompetitionImportApplication', method: 'post', path: '/competitions/{competitionId}/import-applications/{operationId}/cancel', tag: 'competitions',
    params: ImportApplyOperationParamsSchema, query: null, clientHeader: true, body: null,
    success: json(200, ImportApplyOperationResponseSchema), problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  streamCompetitionImportApplication: {
    operationId: 'streamCompetitionImportApplication', method: 'get', path: '/competitions/{competitionId}/import-applications/{operationId}/events', tag: 'competitions',
    params: ImportApplyOperationParamsSchema, query: null, clientHeader: false, body: null,
    success: { status: 200, mediaTypes: ['text/event-stream'], schema: null }, problemStatuses: [400, 403, 404, 421],
  },
  createProject: {
    operationId: 'createProject',
    method: 'post',
    path: '/projects',
    tag: 'projects',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(ProjectCreateSchema),
    success: json(201, ProjectSchema),
    problemStatuses: [400, 403, 409, 413, 415, 421, 502, 503],
  },
  getProject: {
    operationId: 'getProject',
    method: 'get',
    path: '/projects/{projectId}',
    tag: 'projects',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ProjectSchema),
    problemStatuses: READ_BY_ID,
  },
  listManagedSeasons: {
    operationId: 'listManagedSeasons', method: 'get', path: '/competitions/{competitionId}/seasons', tag: 'competitions',
    params: z.strictObject({ competitionId: ManagedSeasonParamsSchema.shape.competitionId }), query: null, clientHeader: false,
    body: null, success: json(200, ManagedSeasonListResponseSchema), problemStatuses: READ_BY_ID,
  },
  createManagedSeason: {
    operationId: 'createManagedSeason', method: 'post', path: '/competitions/{competitionId}/seasons', tag: 'competitions',
    params: z.strictObject({ competitionId: ManagedSeasonParamsSchema.shape.competitionId }), query: null, clientHeader: true,
    body: jsonBody(ManagedSeasonCreateSchema), success: json(201, ManagedSeasonSchema), problemStatuses: WRITE_BODY,
  },
  getManagedSeason: {
    operationId: 'getManagedSeason', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}', tag: 'competitions',
    params: ManagedSeasonParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ManagedSeasonSchema), problemStatuses: READ_BY_ID,
  },
  updateManagedSeason: {
    operationId: 'updateManagedSeason', method: 'patch', path: '/competitions/{competitionId}/seasons/{seasonId}', tag: 'competitions',
    params: ManagedSeasonParamsSchema, query: null, clientHeader: true, body: jsonBody(ManagedSeasonUpdateSchema),
    success: json(200, ManagedSeasonSchema), problemStatuses: WRITE_BODY,
  },
  listManagedTeams: {
    operationId: 'listManagedTeams', method: 'get', path: '/teams', tag: 'teams', params: null, query: null,
    clientHeader: false, body: null, success: json(200, ManagedTeamListResponseSchema), problemStatuses: READ,
  },
  createManagedTeam: {
    operationId: 'createManagedTeam', method: 'post', path: '/teams', tag: 'teams', params: null, query: null,
    clientHeader: true, body: jsonBody(ManagedTeamCreateSchema), success: json(201, ManagedTeamSchema), problemStatuses: WRITE_BODY,
  },
  getManagedTeam: {
    operationId: 'getManagedTeam', method: 'get', path: '/teams/{teamId}', tag: 'teams',
    params: ManagedTeamParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, ManagedTeamSchema), problemStatuses: READ_BY_ID,
  },
  updateManagedTeam: {
    operationId: 'updateManagedTeam', method: 'patch', path: '/teams/{teamId}', tag: 'teams',
    params: ManagedTeamParamsSchema, query: null, clientHeader: true, body: jsonBody(ManagedTeamUpdateSchema),
    success: json(200, ManagedTeamSchema), problemStatuses: WRITE_BODY,
  },
  uploadTeamBadge: {
    operationId: 'uploadTeamBadge', method: 'put', path: '/teams/{teamId}/badge', tag: 'teams',
    params: ManagedTeamParamsSchema, query: TeamBadgeUploadQuerySchema, clientHeader: true,
    body: { mediaTypes: PROPOSAL_IMAGES, schema: null },
    success: json(200, ManagedTeamSchema), problemStatuses: [400, 403, 404, 413, 415, 421],
  },
  getTeamBadgeFile: {
    operationId: 'getTeamBadgeFile', method: 'get', path: '/teams/{teamId}/badge', tag: 'teams',
    params: ManagedTeamParamsSchema, query: null, clientHeader: false, body: null,
    success: { status: 200, mediaTypes: PROPOSAL_IMAGES, schema: null }, problemStatuses: READ_BY_ID,
  },
  deleteTeamBadge: {
    operationId: 'deleteTeamBadge', method: 'delete', path: '/teams/{teamId}/badge', tag: 'teams',
    params: ManagedTeamParamsSchema, query: null, clientHeader: true, body: null,
    success: json(200, ManagedTeamSchema), problemStatuses: WRITE_NO_BODY,
  },
  listSeasonParticipants: {
    operationId: 'listSeasonParticipants', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/participants',
    tag: 'competitions', params: SeasonParticipantsParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, SeasonParticipantListResponseSchema), problemStatuses: READ_BY_ID,
  },
  addSeasonParticipant: {
    operationId: 'addSeasonParticipant', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/participants',
    tag: 'competitions', params: SeasonParticipantsParamsSchema, query: null, clientHeader: true,
    body: jsonBody(SeasonParticipantCreateSchema), success: json(201, SeasonParticipantSchema), problemStatuses: WRITE_BODY,
  },
  listCompetitionTeams: {
    operationId: 'listCompetitionTeams', method: 'get', path: '/competitions/{competitionId}/teams', tag: 'competitions',
    params: CompetitionTeamsParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionTeamListResponseSchema), problemStatuses: READ_BY_ID,
  },
  addCompetitionTeam: {
    operationId: 'addCompetitionTeam', method: 'post', path: '/competitions/{competitionId}/teams', tag: 'competitions',
    params: CompetitionTeamsParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionTeamAddSchema),
    success: json(201, CompetitionTeamSchema), problemStatuses: WRITE_BODY,
  },
  removeCompetitionTeam: {
    operationId: 'removeCompetitionTeam', method: 'delete', path: '/competitions/{competitionId}/teams/{teamId}', tag: 'competitions',
    params: CompetitionTeamParamsSchema, query: null, clientHeader: true, body: null,
    success: { status: 204, mediaTypes: [], schema: null }, problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  addSeasonParticipantsBatch: {
    operationId: 'addSeasonParticipantsBatch', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/participants/batch', tag: 'competitions',
    params: SeasonParticipantsParamsSchema, query: null, clientHeader: true, body: jsonBody(SeasonParticipantBatchCreateSchema),
    success: json(201, SeasonParticipantListResponseSchema), problemStatuses: WRITE_BODY,
  },
  removeSeasonParticipant: {
    operationId: 'removeSeasonParticipant', method: 'delete',
    path: '/competitions/{competitionId}/seasons/{seasonId}/participants/{teamId}', tag: 'competitions',
    params: SeasonParticipantParamsSchema, query: null, clientHeader: true, body: null,
    success: { status: 204, mediaTypes: [], schema: null }, problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  listCompetitionStages: {
    operationId: 'listCompetitionStages', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/stages', tag: 'competitions',
    params: CompetitionRoundsParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionStageListResponseSchema), problemStatuses: READ_BY_ID,
  },
  createCompetitionStage: {
    operationId: 'createCompetitionStage', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/stages', tag: 'competitions',
    params: CompetitionRoundsParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionStageCreateSchema),
    success: json(201, CompetitionStageSchema), problemStatuses: WRITE_BODY,
  },
  getCompetitionStage: {
    operationId: 'getCompetitionStage', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/stages/{stageId}', tag: 'competitions',
    params: CompetitionStageParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionStageSchema), problemStatuses: READ_BY_ID,
  },
  updateCompetitionStage: {
    operationId: 'updateCompetitionStage', method: 'patch', path: '/competitions/{competitionId}/seasons/{seasonId}/stages/{stageId}', tag: 'competitions',
    params: CompetitionStageParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionCalendarNameUpdateSchema),
    success: json(200, CompetitionStageSchema), problemStatuses: WRITE_BODY,
  },
  listSeasonRounds: {
    operationId: 'listSeasonRounds', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/rounds', tag: 'competitions',
    params: CompetitionRoundsParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionRoundListResponseSchema), problemStatuses: READ_BY_ID,
  },
  createSeasonRound: {
    operationId: 'createSeasonRound', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/rounds', tag: 'competitions',
    params: CompetitionRoundsParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionRoundCreateSchema),
    success: json(201, CompetitionRoundSchema), problemStatuses: WRITE_BODY,
  },
  getSeasonRound: {
    operationId: 'getSeasonRound', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/rounds/{roundId}', tag: 'competitions',
    params: CompetitionRoundParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionRoundSchema), problemStatuses: READ_BY_ID,
  },
  updateCompetitionRound: {
    operationId: 'updateCompetitionRound', method: 'patch', path: '/competitions/{competitionId}/seasons/{seasonId}/rounds/{roundId}', tag: 'competitions',
    params: CompetitionRoundParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionRoundUpdateSchema),
    success: json(200, CompetitionRoundSchema), problemStatuses: WRITE_BODY,
  },
  deleteCompetitionRound: {
    operationId: 'deleteCompetitionRound', method: 'delete', path: '/competitions/{competitionId}/seasons/{seasonId}/rounds/{roundId}', tag: 'competitions',
    params: CompetitionRoundParamsSchema, query: null, clientHeader: true, body: null,
    success: { status: 204, mediaTypes: [], schema: null }, problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  listStageRounds: {
    operationId: 'listStageRounds', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/stages/{stageId}/rounds', tag: 'competitions',
    params: CompetitionStageRoundsParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionRoundListResponseSchema), problemStatuses: READ_BY_ID,
  },
  createStageRound: {
    operationId: 'createStageRound', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/stages/{stageId}/rounds', tag: 'competitions',
    params: CompetitionStageRoundsParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionRoundCreateSchema),
    success: json(201, CompetitionRoundSchema), problemStatuses: WRITE_BODY,
  },
  listCompetitionMatches: {
    operationId: 'listCompetitionMatches', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/matches', tag: 'competitions',
    params: CompetitionMatchesParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionMatchListResponseSchema), problemStatuses: READ_BY_ID,
  },
  createCompetitionMatch: {
    operationId: 'createCompetitionMatch', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/matches', tag: 'competitions',
    params: CompetitionMatchesParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionMatchCreateSchema),
    success: json(201, CompetitionMatchSchema), problemStatuses: WRITE_BODY,
  },
  getCompetitionMatch: {
    operationId: 'getCompetitionMatch', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/matches/{matchId}', tag: 'competitions',
    params: CompetitionMatchParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, CompetitionMatchSchema), problemStatuses: READ_BY_ID,
  },
  updateCompetitionMatchSchedule: {
    operationId: 'updateCompetitionMatchSchedule', method: 'patch', path: '/competitions/{competitionId}/seasons/{seasonId}/matches/{matchId}/schedule', tag: 'competitions',
    params: CompetitionMatchParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionMatchScheduleUpdateSchema),
    success: json(200, CompetitionMatchSchema), problemStatuses: WRITE_BODY,
  },
  updateCompetitionMatchResult: {
    operationId: 'updateCompetitionMatchResult', method: 'post', path: '/competitions/{competitionId}/seasons/{seasonId}/matches/{matchId}/result', tag: 'competitions',
    params: CompetitionMatchParamsSchema, query: null, clientHeader: true, body: jsonBody(CompetitionMatchResultUpdateSchema),
    success: json(200, CompetitionMatchSchema), problemStatuses: WRITE_BODY,
  },
  listCompetitionMatchResultHistory: {
    operationId: 'listCompetitionMatchResultHistory', method: 'get', path: '/competitions/{competitionId}/seasons/{seasonId}/matches/{matchId}/result-history', tag: 'competitions',
    params: CompetitionMatchParamsSchema, query: null, clientHeader: false, body: null,
    success: json(200, MatchResultHistoryListResponseSchema), problemStatuses: READ_BY_ID,
  },
  updateProject: {
    operationId: 'updateProject',
    method: 'patch',
    path: '/projects/{projectId}',
    tag: 'projects',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(ProjectUpdateSchema),
    success: json(200, ProjectSchema),
    problemStatuses: WRITE_BODY,
  },
  listRuns: {
    operationId: 'listRuns',
    method: 'get',
    path: '/projects/{projectId}/runs',
    tag: 'runs',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, RunListResponseSchema),
    problemStatuses: READ_BY_ID,
  },
  startRun: {
    operationId: 'startRun',
    method: 'post',
    path: '/projects/{projectId}/runs',
    tag: 'runs',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(RunStartSchema),
    success: json(202, RunSchema),
    problemStatuses: WRITE_BODY,
  },
  getRun: {
    operationId: 'getRun',
    method: 'get',
    path: '/projects/{projectId}/runs/{runId}',
    tag: 'runs',
    params: RunParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, RunSchema),
    problemStatuses: READ_BY_ID,
  },
  previewContentBatch: {
    operationId: 'previewContentBatch',
    method: 'post',
    path: '/content-batches/previews',
    tag: 'projects',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(ContentBatchSelectionSchema),
    success: json(200, ContentBatchPreviewSchema),
    problemStatuses: [400, 403, 404, 413, 415, 421],
  },
  createContentBatch: {
    operationId: 'createContentBatch',
    method: 'post',
    path: '/content-batches',
    tag: 'projects',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(ContentBatchCreateSchema),
    success: json(202, ContentBatchSchema),
    problemStatuses: WRITE_BODY,
  },
  getContentBatch: {
    operationId: 'getContentBatch',
    method: 'get',
    path: '/content-batches/{batchId}',
    tag: 'projects',
    params: ContentBatchParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ContentBatchSchema),
    problemStatuses: READ_BY_ID,
  },
  deleteProject: {
    operationId: 'deleteProject',
    method: 'delete',
    path: '/projects/{projectId}',
    tag: 'projects',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: { status: 204, mediaTypes: [], schema: null },
    problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  listFacts: {
    operationId: 'listFacts',
    method: 'get',
    path: '/projects/{projectId}/runs/{runId}/facts',
    tag: 'facts',
    params: RunParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, FactListResponseSchema),
    problemStatuses: READ_BY_ID,
  },
  approveFactManually: {
    operationId: 'approveFactManually',
    method: 'put',
    path: '/projects/{projectId}/runs/{runId}/facts/{factId}/manual-approval',
    tag: 'facts',
    params: FactParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(200, FactSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  revokeManualFactApproval: {
    operationId: 'revokeManualFactApproval',
    method: 'delete',
    path: '/projects/{projectId}/runs/{runId}/facts/{factId}/manual-approval',
    tag: 'facts',
    params: FactParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(200, FactSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  getActiveDraft: {
    operationId: 'getActiveDraft',
    method: 'get',
    path: '/projects/{projectId}/draft',
    tag: 'drafts',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, DraftSchema),
    problemStatuses: READ_BY_ID,
  },
  setExcludedMatches: {
    operationId: 'setExcludedMatches',
    method: 'put',
    path: '/projects/{projectId}/draft/exclusions',
    tag: 'drafts',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(ExcludedMatchesUpdateSchema),
    success: json(202, RunSchema),
    problemStatuses: WRITE_BODY,
  },
  getSlideImage: {
    operationId: 'getSlideImage',
    method: 'get',
    path: '/element-versions/{versionId}/image',
    tag: 'review',
    params: VersionParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: PNG, schema: null },
    problemStatuses: READ_BY_ID,
  },
  regenerateElement: {
    operationId: 'regenerateElement',
    method: 'post',
    path: '/carousels/{carouselId}/elements/{elementId}/regenerate',
    tag: 'review',
    params: ElementParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(201, ElementSchema),
    problemStatuses: [400, 403, 404, 409, 415, 421, 502],
  },
  approveElement: {
    operationId: 'approveElement',
    method: 'put',
    path: '/carousels/{carouselId}/elements/{elementId}/approval',
    tag: 'review',
    params: ElementParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(VersionRefSchema),
    success: json(200, ElementSchema),
    problemStatuses: WRITE_BODY,
  },
  withdrawElementApproval: {
    operationId: 'withdrawElementApproval',
    method: 'delete',
    path: '/carousels/{carouselId}/elements/{elementId}/approval',
    tag: 'review',
    params: ElementParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(200, ElementSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  acknowledgeQaWarnings: {
    operationId: 'acknowledgeQaWarnings',
    method: 'post',
    path: '/carousels/{carouselId}/elements/{elementId}/qa-acknowledgements',
    tag: 'review',
    params: ElementParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(QaAcknowledgementSchema),
    success: json(200, ElementSchema),
    problemStatuses: WRITE_BODY,
  },
  approveCarousel: {
    operationId: 'approveCarousel',
    method: 'put',
    path: '/carousels/{carouselId}/final-approval',
    tag: 'review',
    params: CarouselParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(200, FinalApprovalSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  exportCarousel: {
    operationId: 'exportCarousel',
    method: 'post',
    path: '/carousels/{carouselId}/exports',
    tag: 'exports',
    params: CarouselParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(201, ExportSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  listProjectExports: {
    operationId: 'listProjectExports',
    method: 'get',
    path: '/projects/{projectId}/exports',
    tag: 'exports',
    params: ProjectParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ExportListResponseSchema),
    problemStatuses: READ_BY_ID,
  },
  getExport: {
    operationId: 'getExport',
    method: 'get',
    path: '/exports/{exportId}',
    tag: 'exports',
    params: ExportParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ExportDetailSchema),
    problemStatuses: READ_BY_ID,
  },
  downloadExport: {
    operationId: 'downloadExport',
    method: 'get',
    path: '/exports/{exportId}/download',
    tag: 'exports',
    params: ExportParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: ZIP, schema: null },
    problemStatuses: [400, 403, 404, 409, 421],
  },
  traceExportedSlide: {
    operationId: 'traceExportedSlide',
    method: 'get',
    path: '/exports/{exportId}/slides/{position}/trace',
    tag: 'exports',
    params: SlideTraceParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, SlideTraceSchema),
    problemStatuses: READ_BY_ID,
  },
  listImports: {
    operationId: 'listImports',
    method: 'get',
    path: '/imports',
    tag: 'imports',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ImportListResponseSchema),
    problemStatuses: READ,
  },
  createImport: {
    operationId: 'createImport',
    method: 'post',
    path: '/imports',
    tag: 'imports',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(ImportCreateSchema),
    success: json(201, ImportSummarySchema),
    problemStatuses: [400, 403, 413, 415, 421],
  },
  getImport: {
    operationId: 'getImport',
    method: 'get',
    path: '/imports/{importId}',
    tag: 'imports',
    params: ImportParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ImportSummarySchema),
    problemStatuses: READ_BY_ID,
  },
  getImportOriginal: {
    operationId: 'getImportOriginal',
    method: 'get',
    path: '/imports/{importId}/original',
    tag: 'imports',
    params: ImportParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: OCTET_STREAM, schema: null },
    problemStatuses: READ_BY_ID,
  },
  listManualSelections: {
    operationId: 'listManualSelections',
    method: 'get',
    path: '/manual-data/selections',
    tag: 'imports',
    params: null,
    query: ManualSelectionsQuerySchema,
    clientHeader: false,
    body: null,
    success: json(200, ManualSelectionHistorySchema),
    problemStatuses: READ_BY_ID,
  },
  getManualVersion: {
    operationId: 'getManualVersion',
    method: 'get',
    path: '/manual-data/versions/{versionId}',
    tag: 'imports',
    params: VersionParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, ManualVersionSchema),
    problemStatuses: READ_BY_ID,
  },
  listBrandAssets: {
    operationId: 'listBrandAssets',
    method: 'get',
    path: '/brand/assets',
    tag: 'brand',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, BrandAssetListResponseSchema),
    problemStatuses: READ,
  },
  registerBrandAsset: {
    operationId: 'registerBrandAsset',
    method: 'post',
    path: '/brand/assets',
    tag: 'brand',
    params: null,
    query: BrandAssetRegisterQuerySchema,
    clientHeader: true,
    body: { mediaTypes: IMAGES, schema: null },
    success: json(201, BrandAssetSchema),
    problemStatuses: [400, 403, 409, 413, 415, 421],
  },
  getBrandAsset: {
    operationId: 'getBrandAsset',
    method: 'get',
    path: '/brand/assets/{assetId}',
    tag: 'brand',
    params: AssetParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, BrandAssetDetailSchema),
    problemStatuses: READ_BY_ID,
  },
  updateBrandAsset: {
    operationId: 'updateBrandAsset',
    method: 'patch',
    path: '/brand/assets/{assetId}',
    tag: 'brand',
    params: AssetParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(BrandAssetUpdateSchema),
    success: json(200, BrandAssetSchema),
    problemStatuses: [400, 403, 404, 409, 413, 415, 421],
  },
  deleteBrandAsset: {
    operationId: 'deleteBrandAsset',
    method: 'delete',
    path: '/brand/assets/{assetId}',
    tag: 'brand',
    params: AssetParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: { status: 204, mediaTypes: [], schema: null },
    problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  getBrandAssetFile: {
    operationId: 'getBrandAssetFile',
    method: 'get',
    path: '/brand/assets/{assetId}/file',
    tag: 'brand',
    params: AssetParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: IMAGES, schema: null },
    problemStatuses: READ_BY_ID,
  },
  getBrandIdentity: {
    operationId: 'getBrandIdentity',
    method: 'get',
    path: '/brand/identity',
    tag: 'brand',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, BrandIdentitySchema),
    problemStatuses: READ,
  },
  updateBrandIdentity: {
    operationId: 'updateBrandIdentity',
    method: 'patch',
    path: '/brand/identity',
    tag: 'brand',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(BrandIdentityUpdateSchema),
    success: json(200, BrandIdentitySchema),
    problemStatuses: [400, 403, 413, 415, 421],
  },
  listTemplates: {
    operationId: 'listTemplates',
    method: 'get',
    path: '/templates',
    tag: 'templates',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, TemplateListResponseSchema),
    problemStatuses: READ,
  },
  previewTemplate: {
    operationId: 'previewTemplate',
    method: 'get',
    path: '/templates/{templateId}/preview',
    tag: 'templates',
    params: TemplateParamsSchema,
    query: TemplatePreviewQuerySchema,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: PNG, schema: null },
    problemStatuses: READ_BY_ID,
  },
  getDesignCapabilities: {
    operationId: 'getDesignCapabilities',
    method: 'get',
    path: '/design/capabilities',
    tag: 'design',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, DesignCapabilitiesSchema),
    problemStatuses: READ,
  },
  checkDesignModelAccess: {
    operationId: 'checkDesignModelAccess',
    method: 'post',
    path: '/design/capabilities/check',
    tag: 'design',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(DesignModelAccessCheckSchema),
    success: json(200, DesignModelAccessSchema),
    problemStatuses: [400, 403, 413, 415, 421],
  },
  estimateDesignGeneration: {
    operationId: 'estimateDesignGeneration',
    method: 'post',
    path: '/design/estimates',
    tag: 'design',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(DesignGenerationInputSchema),
    success: json(200, DesignEstimateSchema),
    problemStatuses: [400, 403, 404, 409, 413, 415, 421, 503],
  },
  createDesignGeneration: {
    operationId: 'createDesignGeneration',
    method: 'post',
    path: '/design/generations',
    tag: 'design',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(DesignGenerationCreateSchema),
    success: json(202, DesignGenerationStartSchema),
    problemStatuses: [400, 403, 404, 409, 413, 415, 421, 429, 503],
  },
  getDesignGeneration: {
    operationId: 'getDesignGeneration',
    method: 'get',
    path: '/design/generations/{generationId}',
    tag: 'design',
    params: DesignGenerationParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, DesignGenerationSchema),
    problemStatuses: READ_BY_ID,
  },
  streamDesignGenerationEvents: {
    operationId: 'streamDesignGenerationEvents',
    method: 'get',
    path: '/design/generations/{generationId}/events',
    tag: 'design',
    params: DesignGenerationParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: ['text/event-stream'], schema: null },
    problemStatuses: [400, 403, 404, 421, 429],
  },
  listDesignProposals: {
    operationId: 'listDesignProposals',
    method: 'get',
    path: '/design/proposals',
    tag: 'design',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, DesignProposalListSchema),
    problemStatuses: READ,
  },
  getDesignProposal: {
    operationId: 'getDesignProposal',
    method: 'get',
    path: '/design/proposals/{proposalId}',
    tag: 'design',
    params: DesignProposalParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, DesignProposalDetailSchema),
    problemStatuses: READ_BY_ID,
  },
  getDesignProposalFile: {
    operationId: 'getDesignProposalFile',
    method: 'get',
    path: '/design/proposals/{proposalId}/file',
    tag: 'design',
    params: DesignProposalParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: PROPOSAL_IMAGES, schema: null },
    problemStatuses: READ_BY_ID,
  },
  getDesignProposalBackground: {
    operationId: 'getDesignProposalBackground',
    method: 'get',
    path: '/design/proposals/{proposalId}/background',
    tag: 'design',
    params: DesignProposalParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: PROPOSAL_IMAGES, schema: null },
    problemStatuses: READ_BY_ID,
  },
  deleteDesignProposal: {
    operationId: 'deleteDesignProposal',
    method: 'delete',
    path: '/design/proposals/{proposalId}',
    tag: 'design',
    params: DesignProposalParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: { status: 204, mediaTypes: [], schema: null },
    problemStatuses: [400, 403, 404, 409, 415, 421],
  },
  decideDesignProposal: {
    operationId: 'decideDesignProposal',
    method: 'post',
    path: '/design/proposals/{proposalId}/decisions',
    tag: 'design',
    params: DesignProposalParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(DesignProposalDecisionInputSchema),
    success: json(200, DesignProposalSchema),
    problemStatuses: [400, 403, 404, 413, 415, 421],
  },
  listVisualTemplates: {
    operationId: 'listVisualTemplates',
    method: 'get',
    path: '/visual-templates',
    tag: 'visual-templates',
    params: null,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, VisualTemplateListSchema),
    problemStatuses: READ,
  },
  createVisualTemplate: {
    operationId: 'createVisualTemplate',
    method: 'post',
    path: '/visual-templates',
    tag: 'visual-templates',
    params: null,
    query: null,
    clientHeader: true,
    body: jsonBody(VisualTemplateCreateSchema),
    success: json(201, VisualTemplateDetailSchema),
    problemStatuses: WRITE_BODY,
  },
  getVisualTemplate: {
    operationId: 'getVisualTemplate',
    method: 'get',
    path: '/visual-templates/{templateId}',
    tag: 'visual-templates',
    params: VisualTemplateParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, VisualTemplateDetailSchema),
    problemStatuses: READ_BY_ID,
  },
  updateVisualTemplate: {
    operationId: 'updateVisualTemplate',
    method: 'patch',
    path: '/visual-templates/{templateId}',
    tag: 'visual-templates',
    params: VisualTemplateParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(VisualTemplateUpdateSchema),
    success: json(200, VisualTemplateSchema),
    problemStatuses: WRITE_BODY,
  },
  deleteVisualTemplate: {
    operationId: 'deleteVisualTemplate',
    method: 'delete',
    path: '/visual-templates/{templateId}',
    tag: 'visual-templates',
    params: VisualTemplateParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: { status: 204, mediaTypes: [], schema: null },
    problemStatuses: WRITE_NO_BODY,
  },
  archiveVisualTemplate: {
    operationId: 'archiveVisualTemplate',
    method: 'post',
    path: '/visual-templates/{templateId}/archive',
    tag: 'visual-templates',
    params: VisualTemplateParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(200, VisualTemplateSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  restoreVisualTemplate: {
    operationId: 'restoreVisualTemplate',
    method: 'post',
    path: '/visual-templates/{templateId}/restore',
    tag: 'visual-templates',
    params: VisualTemplateParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: json(200, VisualTemplateSchema),
    problemStatuses: WRITE_NO_BODY,
  },
  createVisualTemplateVersion: {
    operationId: 'createVisualTemplateVersion',
    method: 'post',
    path: '/visual-templates/{templateId}/versions',
    tag: 'visual-templates',
    params: VisualTemplateParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(VisualTemplateVersionCreateSchema),
    success: json(201, VisualTemplateVersionSchema),
    problemStatuses: WRITE_BODY,
  },
  getVisualTemplateVersion: {
    operationId: 'getVisualTemplateVersion',
    method: 'get',
    path: '/visual-templates/{templateId}/versions/{versionId}',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: json(200, VisualTemplateVersionSchema),
    problemStatuses: READ_BY_ID,
  },
  saveVisualTemplateVersion: {
    operationId: 'saveVisualTemplateVersion',
    method: 'put',
    path: '/visual-templates/{templateId}/versions/{versionId}',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(VisualTemplateVersionSaveSchema),
    success: json(200, VisualTemplateVersionSchema),
    problemStatuses: WRITE_BODY,
  },
  deleteVisualTemplateVersion: {
    operationId: 'deleteVisualTemplateVersion',
    method: 'delete',
    path: '/visual-templates/{templateId}/versions/{versionId}',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: null,
    clientHeader: true,
    body: null,
    success: { status: 204, mediaTypes: [], schema: null },
    problemStatuses: WRITE_NO_BODY,
  },
  releaseVisualTemplateVersion: {
    operationId: 'releaseVisualTemplateVersion',
    method: 'post',
    path: '/visual-templates/{templateId}/versions/{versionId}/release',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(VisualTemplatePublishSchema),
    success: json(200, VisualTemplateVersionSchema),
    problemStatuses: WRITE_BODY,
  },
  getVisualTemplateBackground: {
    operationId: 'getVisualTemplateBackground',
    method: 'get',
    path: '/visual-templates/{templateId}/versions/{versionId}/background',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: null,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: PROPOSAL_IMAGES, schema: null },
    problemStatuses: READ_BY_ID,
  },
  previewVisualTemplate: {
    operationId: 'previewVisualTemplate',
    method: 'post',
    path: '/visual-templates/{templateId}/versions/{versionId}/previews',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: null,
    clientHeader: true,
    body: jsonBody(VisualTemplatePreviewRequestSchema),
    success: json(200, VisualTemplatePreviewSchema),
    problemStatuses: WRITE_BODY,
  },
  renderVisualTemplatePreview: {
    operationId: 'renderVisualTemplatePreview',
    method: 'get',
    path: '/visual-templates/{templateId}/versions/{versionId}/preview',
    tag: 'visual-templates',
    params: VisualTemplateVersionParamsSchema,
    query: VisualTemplatePreviewQuerySchema,
    clientHeader: false,
    body: null,
    success: { status: 200, mediaTypes: PNG, schema: null },
    problemStatuses: [400, 403, 404, 409, 421],
  },
} as const satisfies Record<string, OperationDefinition>;

export type OperationId = keyof typeof operations;

/** Every operation of the contract, in contract order. */
export const operationList: readonly OperationDefinition[] = Object.values(operations);

export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type RunListResponse = z.infer<typeof RunListResponseSchema>;
export type FactListResponse = z.infer<typeof FactListResponseSchema>;
export type ExcludedMatchesUpdate = z.infer<typeof ExcludedMatchesUpdateSchema>;
export type QaAcknowledgement = z.infer<typeof QaAcknowledgementSchema>;
export type ExportListResponse = z.infer<typeof ExportListResponseSchema>;
export type ImportListResponse = z.infer<typeof ImportListResponseSchema>;
export type BrandAssetListResponse = z.infer<typeof BrandAssetListResponseSchema>;
export type BrandAssetUpdate = z.infer<typeof BrandAssetUpdateSchema>;
export type BrandIdentityUpdate = z.infer<typeof BrandIdentityUpdateSchema>;
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;
export type ManualSelectionsQuery = z.infer<typeof ManualSelectionsQuerySchema>;
export type BrandAssetRegisterQuery = z.infer<typeof BrandAssetRegisterQuerySchema>;
export type TemplatePreviewQuery = z.infer<typeof TemplatePreviewQuerySchema>;
export type VisualTemplatePreviewQuery = z.infer<typeof VisualTemplatePreviewQuerySchema>;
export type VisualTemplateList = z.infer<typeof VisualTemplateListSchema>;

/** Request body type of an operation with a JSON body. */
export type OperationRequest<K extends OperationId> = (typeof operations)[K]['body'] extends {
  schema: infer S extends z.ZodType;
}
  ? z.infer<S>
  : never;

/** Success response body type of an operation with a JSON response. */
export type OperationResponse<K extends OperationId> = (typeof operations)[K]['success'] extends {
  schema: infer S extends z.ZodType;
}
  ? z.infer<S>
  : never;
