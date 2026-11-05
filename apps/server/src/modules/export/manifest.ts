/**
 * The file set of an export (architecture.md section 11.2; AD-17, AD-33, AD-38 item 5; R-218, R-269, R-272, R-287,
 * R-320, R-421). Pure functions over an export plan read from the database: no I/O, no clock, no network.
 *
 * - `01.png` to `NN.png`: the stored renders of the exported slide versions, byte for byte, in carousel order.
 * - `caption.txt`: UTF-8 caption, a blank line, the hashtags separated by spaces, and a final line feed. Present only
 *   when the final approval covers the caption (an approved caption; PD-ARCH-01E-PD-02).
 * - `manifest.json`: project, carousel, final approval, data mode, `demonstration` flag, the project's source and
 *   every source of the used facts' evidence (IDs and names), and per file its position, element version ID, SHA-256
 *   and fact IDs; each used fact with its effective status. `operatorAttested: true` is present only when a used
 *   fact is MANUALLY_APPROVED; such a fact keeps the status `manually_approved` and is never stated as verified.
 *
 * File positions (`export_files.position`): slides 1 to N in carousel order (the position of the slide trace), the
 * caption N + 1 and the manifest N + 2 (N + 1 without a caption), so position order is the listing order of AD-17.
 */
import { createHash } from 'node:crypto';

import {
  DataModeSchema,
  DateTimeSchema,
  FactKindSchema,
  FactStatusSchema,
  LanguageSchema,
  Sha256Schema,
  SlideTypeSchema,
  SourceIdSchema,
  UuidSchema,
} from '@edr/contracts';
import { z } from 'zod';

import { type ElementText, fieldText } from '../content/index.js';

/** Identifier of the manifest format. */
export const MANIFEST_FORMAT = 'edr-export-manifest/1';
export const CAPTION_FILE_NAME = 'caption.txt';
export const MANIFEST_FILE_NAME = 'manifest.json';
/** Largest number of slides a file name `NN.png` can hold (contract `ExportFile.fileName`). */
export const MAX_EXPORTED_SLIDES = 99;

/** The name of the slide file at a 1-based position in carousel order. */
export function slideFileName(position: number): string {
  if (!Number.isInteger(position) || position < 1 || position > MAX_EXPORTED_SLIDES) {
    throw new RangeError('a slide position is outside 1 to 99');
  }
  return `${String(position).padStart(2, '0')}.png`;
}

/** SHA-256 (lowercase hex) of bytes. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The text of `caption.txt`: caption, a blank line, hashtags separated by spaces, final line feed. */
export function captionText(text: ElementText): string {
  const caption = fieldText(text.fields.find((field) => field.field === 'caption')?.segments ?? []).trim();
  const hashtags = (text.fields.find((field) => field.field === 'hashtags')?.segments ?? [])
    .map((segment) => segment.text.trim())
    .filter((tag) => tag.length > 0)
    .join(' ');
  return hashtags.length === 0 ? `${caption}\n` : `${caption}\n\n${hashtags}\n`;
}

// ---------------------------------------------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------------------------------------------

const SourceEntrySchema = z.strictObject({
  id: SourceIdSchema,
  name: z.string().min(1).max(80),
  dataMode: DataModeSchema,
});

const EvidenceEntrySchema = z.strictObject({
  sourceId: SourceIdSchema,
  dataMode: DataModeSchema,
  relation: z.enum(['supports', 'disagrees', 'consulted']),
  importVersionId: UuidSchema.nullable(),
});

const ManifestFactSchema = z.strictObject({
  factId: UuidSchema,
  factKey: z.string().min(1).max(200),
  kind: FactKindSchema,
  /** Effective status (OD-17): `manually_approved` is never written as verified (R-071, R-272). */
  status: FactStatusSchema,
  evidence: z.array(EvidenceEntrySchema),
});

const ManifestFileSchema = z.strictObject({
  position: z.int().min(1),
  fileName: z.string().regex(/^([0-9]{2}\.png|caption\.txt)$/),
  kind: z.enum(['slide_image', 'caption_text']),
  elementId: UuidSchema,
  elementVersionId: UuidSchema,
  versionNumber: z.int().min(1),
  slideType: SlideTypeSchema.nullable(),
  width: z.int().min(1).nullable(),
  height: z.int().min(1).nullable(),
  sha256: Sha256Schema,
  factIds: z.array(UuidSchema),
});

/** `manifest.json` of an export (format `edr-export-manifest/1`). */
export const ManifestSchema = z.strictObject({
  format: z.literal(MANIFEST_FORMAT),
  exportId: UuidSchema,
  exportedAt: DateTimeSchema,
  project: z.strictObject({
    id: UuidSchema,
    competitionId: z.string().min(1).max(64),
    competitionName: z.string().min(1).max(80),
    seasonId: z.string().min(1).max(64),
    seasonLabel: z.string().min(1).max(80),
    stageId: z.string().min(1).max(64),
    stageLabel: z.string().min(1).max(80),
    matchday: z.int().min(1).nullable(),
    language: LanguageSchema,
  }),
  carousel: z.strictObject({ id: UuidSchema, sequence: z.int().min(1), total: z.int().min(1) }),
  finalApproval: z.strictObject({ id: UuidSchema, approvedAt: DateTimeSchema, versionSetSha256: Sha256Schema }),
  dataMode: DataModeSchema,
  demonstration: z.boolean(),
  /** Present (and true) only when a used fact is MANUALLY_APPROVED (AD-38 item 5). */
  operatorAttested: z.literal(true).optional(),
  /** The source chosen for the project (R-287). */
  source: SourceEntrySchema,
  /** The project's source and every source of the used facts' evidence, by ID. */
  sources: z.array(SourceEntrySchema),
  files: z.array(ManifestFileSchema),
  facts: z.array(ManifestFactSchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestFact = z.infer<typeof ManifestFactSchema>;
export type ManifestSource = z.infer<typeof SourceEntrySchema>;

// ---------------------------------------------------------------------------------------------------------------
// Export plan and file set
// ---------------------------------------------------------------------------------------------------------------

/** One exported slide version with its render. */
export interface PlannedSlide {
  readonly elementId: string;
  readonly elementVersionId: string;
  readonly versionNumber: number;
  readonly slideType: z.infer<typeof SlideTypeSchema>;
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly factIds: readonly string[];
}

/** The exported caption version. */
export interface PlannedCaption {
  readonly elementId: string;
  readonly elementVersionId: string;
  readonly versionNumber: number;
  readonly text: ElementText;
  readonly factIds: readonly string[];
}

/** Everything an export writes, read from the final-approval row's version set. */
export interface ExportPlan {
  readonly exportId: string;
  readonly exportedAt: string;
  readonly project: Manifest['project'];
  readonly carousel: Manifest['carousel'];
  readonly finalApproval: Manifest['finalApproval'];
  readonly dataMode: Manifest['dataMode'];
  readonly source: ManifestSource;
  readonly sources: readonly ManifestSource[];
  /** In carousel order. */
  readonly slides: readonly PlannedSlide[];
  /** Null when the final approval does not cover the caption (not approved yet). */
  readonly caption: PlannedCaption | null;
  /** Every fact a version of the set references, by fact ID. */
  readonly facts: readonly ManifestFact[];
}

/** One file of an export. */
export interface ExportFileContent {
  readonly position: number;
  readonly fileName: string;
  readonly kind: 'slide_image' | 'caption_text' | 'manifest';
  readonly elementVersionId: string | null;
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

/** The manifest of a plan whose slide files and, when the plan has a caption, caption file are given. */
export function buildManifest(plan: ExportPlan, files: readonly ExportFileContent[]): Manifest {
  const slides = files.filter((file) => file.kind === 'slide_image');
  const caption = files.find((file) => file.kind === 'caption_text');
  if (slides.length !== plan.slides.length || (caption === undefined) !== (plan.caption === null)) {
    throw new Error('the manifest needs every slide file and the caption file of a planned caption');
  }
  const operatorAttested = plan.facts.some((fact) => fact.status === 'manually_approved');
  return ManifestSchema.parse({
    format: MANIFEST_FORMAT,
    exportId: plan.exportId,
    exportedAt: plan.exportedAt,
    project: plan.project,
    carousel: plan.carousel,
    finalApproval: plan.finalApproval,
    dataMode: plan.dataMode,
    demonstration: plan.dataMode === 'DEMO_DATA',
    ...(operatorAttested ? { operatorAttested: true } : {}),
    source: plan.source,
    sources: plan.sources,
    files: [
      ...plan.slides.map((slide, index) => {
        const file = slides[index] as ExportFileContent;
        return {
          position: file.position,
          fileName: file.fileName,
          kind: 'slide_image',
          elementId: slide.elementId,
          elementVersionId: slide.elementVersionId,
          versionNumber: slide.versionNumber,
          slideType: slide.slideType,
          width: slide.width,
          height: slide.height,
          sha256: file.sha256,
          factIds: [...slide.factIds],
        };
      }),
      ...(caption === undefined || plan.caption === null
        ? []
        : [
            {
              position: caption.position,
              fileName: caption.fileName,
              kind: 'caption_text',
              elementId: plan.caption.elementId,
              elementVersionId: plan.caption.elementVersionId,
              versionNumber: plan.caption.versionNumber,
              slideType: null,
              width: null,
              height: null,
              sha256: caption.sha256,
              factIds: [...plan.caption.factIds],
            },
          ]),
    ],
    facts: plan.facts,
  });
}

/**
 * The files of an export in writing order: the slides `01.png` to `NN.png` in carousel order, `caption.txt` (when
 * the plan has a caption), then
 * `manifest.json` (which lists the hashes of the others).
 */
export function exportFiles(plan: ExportPlan): ExportFileContent[] {
  if (plan.slides.length > MAX_EXPORTED_SLIDES) {
    throw new RangeError('an export holds at most 99 slides');
  }
  const files: ExportFileContent[] = plan.slides.map((slide, index) => ({
    position: index + 1,
    fileName: slideFileName(index + 1),
    kind: 'slide_image',
    elementVersionId: slide.elementVersionId,
    bytes: slide.png,
    sha256: sha256Of(slide.png),
  }));
  if (plan.caption !== null) {
    const captionBytes = Buffer.from(captionText(plan.caption.text), 'utf8');
    files.push({
      position: plan.slides.length + 1,
      fileName: CAPTION_FILE_NAME,
      kind: 'caption_text',
      elementVersionId: plan.caption.elementVersionId,
      bytes: captionBytes,
      sha256: sha256Of(captionBytes),
    });
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(buildManifest(plan, files), null, 2)}\n`, 'utf8');
  files.push({
    position: files.length + 1,
    fileName: MANIFEST_FILE_NAME,
    kind: 'manifest',
    elementVersionId: null,
    bytes: manifestBytes,
    sha256: sha256Of(manifestBytes),
  });
  return files;
}
