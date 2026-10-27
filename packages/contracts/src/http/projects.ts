/**
 * Contract schemas of projects and runs (operations listProjects, createProject, getProject, updateProject, listRuns,
 * startRun, getRun): ProjectCreate, ProjectUpdate, ProjectSummaryFields, ProjectSummary, Project, RunStart, Run,
 * RunStatus, StageStatus.
 */
import { z } from 'zod';

import {
  DataModeSchema,
  DateTimeSchema,
  DisplayNameSchema,
  LanguageSchema,
  SlugSchema,
  SourceIdSchema,
  StageNameSchema,
  UuidSchema,
} from './primitives.js';
import { FailureSchema } from './system.js';

/** Create a project from a catalogue selection; matchday is null when the stage is selected as a whole. */
export const ProjectCreateSchema = z.strictObject({
  competitionId: SlugSchema,
  sourceId: SourceIdSchema,
  seasonId: SlugSchema,
  stageId: SlugSchema,
  matchday: z.int().min(1).max(999).nullable(),
  language: LanguageSchema.optional(),
});

export const ProjectUpdateSchema = z.strictObject({ language: LanguageSchema });

export const RunKindSchema = z.enum(['full', 'redraft']);

export const RunStartSchema = z.strictObject({ kind: RunKindSchema });

export const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export const WorkflowStageSchema = z.enum(['research', 'verification', 'content', 'rendering', 'visual_qa']);

export const StageRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'skipped']);

export const StageStatusSchema = z.strictObject({
  stage: WorkflowStageSchema,
  status: StageRunStatusSchema,
  startedAt: DateTimeSchema.nullable(),
  finishedAt: DateTimeSchema.nullable(),
  failure: FailureSchema.nullable(),
});

export const RunSchema = z.strictObject({
  id: UuidSchema,
  projectId: UuidSchema,
  runNumber: z.int(),
  kind: RunKindSchema,
  status: RunStatusSchema,
  startedAt: DateTimeSchema.nullable(),
  finishedAt: DateTimeSchema.nullable(),
  failure: FailureSchema.nullable(),
  stages: z.array(StageStatusSchema),
});

export const ApprovalStateSchema = z.enum(['no_draft', 'in_review', 'final_approved', 'exported']);

/** Shape of the open base object ProjectSummaryFields. */
const projectSummaryShape = {
  id: UuidSchema,
  title: z.string().max(200),
  competitionName: DisplayNameSchema,
  seasonLabel: DisplayNameSchema,
  stageLabel: StageNameSchema,
  matchday: z.int().nullable(),
  sourceName: z.string().max(80),
  dataMode: DataModeSchema,
  /** True for DEMO_DATA projects (OD-21, R-269). */
  demonstration: z.boolean(),
  language: LanguageSchema,
  createdAt: DateTimeSchema,
  approvalState: ApprovalStateSchema,
  lastExportAt: DateTimeSchema.nullable(),
};

/** Open base object of ProjectSummary and Project. */
export const ProjectSummaryFieldsSchema = z.looseObject(projectSummaryShape);

export const ProjectSummarySchema = z.strictObject(projectSummaryShape);

export const ProjectSchema = z.strictObject({
  ...projectSummaryShape,
  competitionId: SlugSchema,
  sourceId: SourceIdSchema,
  seasonId: SlugSchema,
  stageId: SlugSchema,
  latestRun: RunSchema.nullable(),
  activeDraftId: UuidSchema.nullable(),
});

export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
export type RunKind = z.infer<typeof RunKindSchema>;
export type RunStart = z.infer<typeof RunStartSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type StageRunStatus = z.infer<typeof StageRunStatusSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;
export type Run = z.infer<typeof RunSchema>;
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
export type ProjectSummaryFields = z.infer<typeof ProjectSummaryFieldsSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type Project = z.infer<typeof ProjectSchema>;
