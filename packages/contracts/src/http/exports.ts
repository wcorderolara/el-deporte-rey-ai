/**
 * Contract schemas of exports and traces (operations exportCarousel, listProjectExports, getExport,
 * traceExportedSlide): ExportFields, Export, ExportDetail, SlideTrace.
 */
import { z } from 'zod';

import { FactSchema } from './facts.js';
import { ContractPatterns, DataModeSchema, DateTimeSchema, Sha256Schema, UuidSchema } from './primitives.js';
import { ElementKindSchema, ElementVersionSchema } from './review.js';

export const ExportFileKindSchema = z.enum(['slide_image', 'caption_text', 'manifest']);

export const ExportFileSchema = z.strictObject({
  position: z.int(),
  fileName: z.string().regex(new RegExp(ContractPatterns.ExportFileName, 'u')),
  kind: ExportFileKindSchema,
  sha256: Sha256Schema,
  elementVersionId: UuidSchema.nullable(),
});

/** Shape of the open base object ExportFields. */
const exportShape = {
  id: UuidSchema,
  projectId: UuidSchema,
  carouselId: UuidSchema,
  finalApprovalId: UuidSchema,
  exportedAt: DateTimeSchema,
  /** Path relative to the data directory. */
  directory: z.string().max(200),
  dataMode: DataModeSchema,
  /** True for DEMO_DATA content; also stated in manifest.json and on the slides (OD-21). */
  demonstration: z.boolean(),
  files: z.array(ExportFileSchema),
};

/** Open base object of Export and ExportDetail. */
export const ExportFieldsSchema = z.looseObject(exportShape);

export const ExportSchema = z.strictObject(exportShape);

export const ExportDetailSchema = z.strictObject({
  ...exportShape,
  /** The exact element versions that were exported, in carousel order. */
  elements: z.array(z.strictObject({ position: z.int(), kind: ElementKindSchema, version: ElementVersionSchema })),
});

export const SlideTraceSchema = z.strictObject({
  exportId: UuidSchema,
  position: z.int(),
  elementVersionId: UuidSchema,
  dataMode: DataModeSchema,
  facts: z.array(FactSchema),
});

export type ExportFileKind = z.infer<typeof ExportFileKindSchema>;
export type ExportFile = z.infer<typeof ExportFileSchema>;
export type ExportFields = z.infer<typeof ExportFieldsSchema>;
export type Export = z.infer<typeof ExportSchema>;
export type ExportDetail = z.infer<typeof ExportDetailSchema>;
export type SlideTrace = z.infer<typeof SlideTraceSchema>;
