/**
 * Every operation of `contracts/http-api.openapi.yaml`: method, path, path and query parameters, the client header,
 * the request body, the success response and the declared problem statuses, with the Zod schemas of the inline
 * request and response bodies. The contract tests check this registry against the OpenAPI document.
 *
 * There is no publication operation of any kind (BR-11, R-042, R-219).
 */
import { z } from 'zod';

import { BrandAssetKindSchema, BrandAssetSchema, TemplateSchema } from './brand.js';
import { CatalogueSchema, SeasonListSchema, StageListSchema } from './catalog.js';
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

/** Request of updateBrandAsset (activate or deactivate; no deletion, OD-08). */
export const BrandAssetUpdateSchema = z.strictObject({ active: z.boolean() });

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
export const TemplateParamsSchema = z.strictObject({ templateId: SlugSchema });

/** Query of listManualSelections. Undeclared query parameters are ignored. */
export const ManualSelectionsQuerySchema = z.object({ competitionId: SlugSchema, seasonId: SlugSchema });

/** Query of registerBrandAsset. Undeclared query parameters are ignored. */
export const BrandAssetRegisterQuerySchema = z.object({ kind: BrandAssetKindSchema, label: LabelSchema });

/** Query of previewTemplate. Undeclared query parameters are ignored. */
export const TemplatePreviewQuerySchema = z.object({ language: LanguageSchema.optional() });

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
const IMAGES = ['image/png', 'image/jpeg'] as const;
const OCTET_STREAM = ['application/octet-stream'] as const;

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
    problemStatuses: [400, 403, 404, 413, 415, 421],
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
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;
export type ManualSelectionsQuery = z.infer<typeof ManualSelectionsQuerySchema>;
export type BrandAssetRegisterQuery = z.infer<typeof BrandAssetRegisterQuerySchema>;
export type TemplatePreviewQuery = z.infer<typeof TemplatePreviewQuerySchema>;

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
