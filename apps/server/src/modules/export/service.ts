/**
 * Export, history and traceability service (architecture.md sections 11.2 and 14; data-model.md section 6; AD-17,
 * AD-33, AD-38; BR-11; R-041, R-043, R-044, R-216, R-218 to R-221, R-240, R-269, R-272, R-287; T10-F13, T10-F15).
 *
 * Export of a carousel (exportCarousel):
 * 1. A valid final approval is required (`FINAL_APPROVAL_REQUIRED` otherwise). Validity is the review module's (T37):
 *    the row is not invalidated (`invalidated_at IS NULL`), the carousel's draft is not superseded, the recorded
 *    version set equals the carousel's current versions, and no version of it is blocked (the content module's
 *    overlay over the verification module's single publishability function). The version set is read from the
 *    final-approval row (its stored text, checked against its SHA-256), never from the current versions.
 * 2. Exactly the versions of that set are written into a fresh directory `exports/<projectId>/<exportId>/`:
 *    `01.png` to `NN.png` (the stored renders, hash-checked), `caption.txt` and `manifest.json` (`manifest.ts`).
 * 3. One synchronous `BEGIN IMMEDIATE` transaction re-checks the final approval (`invalidated_at IS NULL` and the
 *    same validity) and records the export with its files. A refused or failed commit leaves an orphan directory that
 *    no export record references.
 *
 * The service has no egress client and no publication function (R-219, BR-11): its dependencies are the
 * configuration, the database, the clock, the logger and the paths. The helpers it reuses from other modules get a
 * container whose network-capable members throw when touched.
 *
 * History (listProjectExports, getExport) shows the exact exported versions; the trace (traceExportedSlide) shows
 * every fact an exported slide version references, with its status and reason, evidence (source, mode, reference,
 * retrieval time, import version), manual approval and dispute, from the verification module's facts view.
 */
import { createHash, randomUUID } from 'node:crypto';

import type { ElementVersion, Export, ExportDetail, FactStatus, SlideTrace, TextField } from '@edr/contracts';

import type { AppContainer, Clock, Paths } from '../../container.js';
import type { AppConfig } from '../../platform/config/index.js';
import { type Db, readJsonColumn } from '../../platform/db/index.js';
import { HttpProblem, type Logger, summarizeError } from '../../platform/http/index.js';
import { ElementTextSchema, blockedOverlay, verificationPublishability } from '../content/index.js';
import { pngSize, readSlideImage, slideImageUrl } from '../rendering/index.js';
import { ReviewRepository, VersionSetSchema, sameVersionSet, versionSetOf, versionState } from '../review/index.js';
import { VerificationService } from '../verification/index.js';

import { ExportFileStore, exportRelativeDirectory } from './files.js';
import { type ExportPlan, type ManifestFact, type ManifestSource, type PlannedSlide, exportFiles } from './manifest.js';
import { createZip } from './zip.js';
import {
  type ExportProject,
  ExportRepository,
  type ExportVersionRow,
  type FinalApprovalRow,
  type StoredExport,
  type StoredExportFile,
} from './repository.js';

/** What the export module may use: no egress client, no sources, no AI provider (R-219, BR-11). */
export interface ExportDependencies {
  readonly config: AppConfig;
  readonly db: Db;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly paths: Paths;
}

/** The export dependencies of a container (the network-capable members are left out). */
export function exportDependencies(container: AppContainer): ExportDependencies {
  const { config, db, clock, logger, paths } = container;
  return { config, db, clock, logger, paths };
}

/** Members of the container the export module never receives. */
const NETWORK_MEMBERS = ['egress', 'sources', 'catalogue', 'aiProvider'] as const;

/**
 * A container for the helpers of other modules that take one (slide image reads, the facts view): the export
 * dependencies only; reading a network-capable member throws instead of reaching the network (fail closed).
 */
function offlineContainer(deps: ExportDependencies): AppContainer {
  const container: Record<string, unknown> = { ...deps };
  for (const member of NETWORK_MEMBERS) {
    Object.defineProperty(container, member, {
      enumerable: false,
      get: (): never => {
        throw new Error('the export module has no network-capable dependency');
      },
    });
  }
  return Object.freeze(container) as unknown as AppContainer;
}

export interface ExportServiceOptions {
  readonly deps: ExportDependencies;
  /** ID generator of export records; default `crypto.randomUUID`. */
  readonly newId?: () => string;
  /** The file store of the export folders; default one over `paths.dataDir`. */
  readonly files?: ExportFileStore;
}

const PROBLEMS = {
  carouselNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The carousel does not exist.'),
  projectNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The project does not exist.'),
  exportNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The export does not exist.'),
  slideNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'The export has no slide at this position.'),
  finalApprovalRequired: (): HttpProblem =>
    new HttpProblem(
      409,
      'FINAL_APPROVAL_REQUIRED',
      'The carousel has no valid final approval; approve every element and the carousel again before exporting.',
    ),
} as const;

/** A final approval that holds, with the IDs of its recorded version set. */
interface ValidFinalApproval {
  readonly row: FinalApprovalRow;
  readonly versionIds: readonly string[];
}

/** The export, history and trace use cases. */
export class ExportService {
  readonly #deps: ExportDependencies;
  readonly #offline: AppContainer;
  readonly #repository: ExportRepository;
  readonly #review: ReviewRepository;
  readonly #files: ExportFileStore;
  readonly #newId: () => string;

  constructor(options: ExportServiceOptions) {
    this.#deps = options.deps;
    this.#offline = offlineContainer(options.deps);
    this.#repository = new ExportRepository(options.deps.db);
    this.#review = new ReviewRepository(options.deps.db);
    this.#files = options.files ?? new ExportFileStore(options.deps.paths.dataDir);
    this.#newId = options.newId ?? randomUUID;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------------------------------------------

  /** Exports the version set of the carousel's valid final approval (exportCarousel; R-041, R-216, R-218, R-240). */
  async exportCarousel(carouselId: string): Promise<Export> {
    const exportId = this.#newId();
    const exportedAt = this.#deps.clock.now().toISOString();
    const planned = this.#deps.db.transaction(() => this.#planned(carouselId, exportId, exportedAt));
    const plan = await this.#withImages(planned);
    const files = exportFiles(plan);
    const directory = await this.#write(plan, files);
    const persisted = await this.#files.readFiles(
      plan.project.id,
      exportId,
      files.map((file) => file.fileName),
    );
    if (
      persisted.length !== files.length ||
      persisted.some((file, index) => {
        const expected = files[index];
        return (
          expected === undefined ||
          file.name !== expected.fileName ||
          createHash('sha256').update(file.bytes).digest('hex') !== expected.sha256
        );
      })
    ) {
      throw new Error('persisted export artifacts failed integrity verification');
    }

    let record: StoredExport;
    try {
      record = this.#deps.db.transaction(() => {
        const still = this.#validFinalApproval(carouselId);
        if (
          still?.row.id !== plan.finalApproval.id ||
          !this.#repository.finalApprovalNotInvalidated(plan.finalApproval.id)
        ) {
          throw PROBLEMS.finalApprovalRequired();
        }
        const stored = {
          id: exportId,
          carouselId,
          finalApprovalId: plan.finalApproval.id,
          exportedAt,
          directory,
          manifestSha256: files.find((file) => file.kind === 'manifest')?.sha256 ?? '',
          dataMode: plan.dataMode,
          files: files.map((file) => ({
            position: file.position,
            kind: file.kind,
            elementVersionId: file.elementVersionId,
            fileName: file.fileName,
            sha256: file.sha256,
          })),
        };
        this.#repository.insertExport(stored);
        return { ...stored, projectId: plan.project.id };
      });
    } catch (error) {
      // T10-F15: the written folder stays as an orphan that no export record references (nothing is deleted).
      this.#deps.logger.warn(
        { exportId, carouselId, error: summarizeError(error) },
        'export not recorded; its folder is left unreferenced',
      );
      throw error;
    }
    this.#deps.logger.info({ exportId, carouselId, files: files.length }, 'carousel exported');
    return this.#exportView(record, this.#repository.exportFiles(exportId));
  }

  /**
   * The carousel's final approval when it holds (T37's validity): not invalidated, draft not superseded, the stored
   * set text intact (its SHA-256) and equal to the current versions, and no current version blocked. Null otherwise.
   * Throws 404 for an unknown carousel.
   */
  #validFinalApproval(carouselId: string): ValidFinalApproval | null {
    const carousel = this.#review.carousel(carouselId);
    if (carousel === null) {
      throw PROBLEMS.carouselNotFound();
    }
    if (carousel.draftSuperseded) {
      return null;
    }
    const elements = this.#review.carouselElements(carouselId);
    const current = elements.flatMap((element) =>
      element.currentVersionId === null ? [] : [element.currentVersionId],
    );
    if (elements.length === 0 || current.length !== elements.length) {
      return null;
    }
    for (const row of this.#repository.validFinalApprovals(carouselId)) {
      const versionIds = readJsonColumn(VersionSetSchema, row.versionSetText, 'version_set');
      const recorded = versionSetOf(versionIds);
      if (recorded.json !== row.versionSetText || recorded.sha256 !== row.versionSetSha256) {
        this.#deps.logger.warn({ finalApprovalId: row.id }, 'a final approval version set does not match its hash');
        continue;
      }
      if (!sameVersionSet(versionIds, current)) {
        continue;
      }
      const context = { db: this.#deps.db, config: this.#deps.config };
      if (current.some((versionId) => blockedOverlay(context, versionId)?.blocked !== false)) {
        return null;
      }
      return { row, versionIds };
    }
    return null;
  }

  /** Everything the export writes except the slide images, read in one transaction. */
  #planned(carouselId: string, exportId: string, exportedAt: string): PlanWithoutImages {
    const valid = this.#validFinalApproval(carouselId);
    if (valid === null) {
      throw PROBLEMS.finalApprovalRequired();
    }
    const carousel = this.#review.carousel(carouselId);
    const project = carousel === null ? null : this.#repository.project(carousel.projectId);
    if (carousel === null || project === null) {
      throw PROBLEMS.carouselNotFound();
    }
    const versions = valid.versionIds.map((versionId) => {
      const version = this.#repository.version(versionId);
      if (version?.carouselId !== carouselId) {
        throw new Error('a version of the final approval does not belong to its carousel');
      }
      return version;
    });
    const slides = versions.filter((version) => version.kind === 'slide').sort((a, b) => a.position - b.position);
    const captions = versions.filter((version) => version.kind === 'caption');
    const caption = captions[0];
    if (caption === undefined || captions.length !== 1 || slides.length === 0) {
      throw new Error('a final approval must hold the slides and exactly one caption');
    }
    const refs = new Map(versions.map((version) => [version.id, this.#repository.factRefs(version.id)]));
    const factIds = [...new Set([...refs.values()].flat())].sort();
    const { facts, sources } = this.#facts(project, factIds);
    return {
      exportId,
      exportedAt,
      project,
      carousel: { id: carousel.id, sequence: carousel.sequence, total: carousel.total },
      finalApproval: {
        id: valid.row.id,
        approvedAt: valid.row.approvedAt,
        versionSetSha256: valid.row.versionSetSha256,
      },
      slides: slides.map((slide) => ({ version: slide, factIds: refs.get(slide.id) ?? [] })),
      caption: {
        elementId: caption.elementId,
        elementVersionId: caption.id,
        versionNumber: caption.versionNumber,
        text: readJsonColumn(ElementTextSchema, caption.text, 'text'),
        factIds: refs.get(caption.id) ?? [],
      },
      facts,
      sources,
    };
  }

  /** The used facts with their effective status and evidence, and the sources named by the manifest. */
  #facts(project: ExportProject, factIds: readonly string[]): { facts: ManifestFact[]; sources: ManifestSource[] } {
    const verdicts = verificationPublishability({ db: this.#deps.db, config: this.#deps.config }, project.id, factIds);
    const sources = new Map<string, ManifestSource>([[project.source.id, project.source]]);
    const facts = factIds.map((factId): ManifestFact => {
      const fact = this.#repository.fact(factId);
      if (fact === null) {
        throw new Error('an exported version references a fact that does not exist');
      }
      const evidence = this.#repository.factEvidence(factId);
      for (const entry of evidence) {
        if (!sources.has(entry.sourceId)) {
          const source = this.#repository.source(entry.sourceId);
          if (source !== null) {
            sources.set(source.id, source);
          }
        }
      }
      // The effective status from the verification rules (OD-17): never `verified` for a manually approved fact.
      const status: FactStatus = verdicts.get(factId)?.status ?? 'unverified';
      return { factId, factKey: fact.factKey, kind: fact.kind, status, evidence };
    });
    return { facts, sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)) };
  }

  /** Reads each slide's stored render (hash-checked) and checks its PNG size against the version's size. */
  async #withImages(planned: PlanWithoutImages): Promise<ExportPlan> {
    const slides: PlannedSlide[] = [];
    for (const { version, factIds } of planned.slides) {
      const png = await readSlideImage(this.#offline, version.id);
      const size = png === null ? null : pngSize(png);
      if (
        png === null ||
        size === null ||
        version.slideType === null ||
        size.width !== version.width ||
        size.height !== version.height
      ) {
        throw new Error('an exported slide has no intact render of its recorded size');
      }
      slides.push({
        elementId: version.elementId,
        elementVersionId: version.id,
        versionNumber: version.versionNumber,
        slideType: version.slideType,
        png,
        width: size.width,
        height: size.height,
        factIds,
      });
    }
    const project = planned.project;
    return {
      exportId: planned.exportId,
      exportedAt: planned.exportedAt,
      project: {
        id: project.id,
        competitionId: project.competitionId,
        competitionName: project.competitionName,
        seasonId: project.seasonId,
        seasonLabel: project.seasonLabel,
        stageId: project.stageId,
        stageLabel: project.stageLabel,
        matchday: project.matchday,
        language: project.language,
      },
      carousel: planned.carousel,
      finalApproval: planned.finalApproval,
      dataMode: project.dataMode,
      source: project.source,
      sources: planned.sources,
      slides,
      caption: planned.caption,
      facts: planned.facts,
    };
  }

  /** Writes the files into a fresh export folder; returns the folder relative to the data directory. */
  async #write(plan: ExportPlan, files: ReturnType<typeof exportFiles>): Promise<string> {
    const folder = await this.#files.createFolder(plan.project.id, plan.exportId);
    try {
      for (const file of files) {
        await folder.writeFile(file.fileName, file.bytes);
      }
    } catch (error) {
      this.#deps.logger.warn(
        { exportId: plan.exportId, error: summarizeError(error) },
        'export files not written completely; the folder is left unreferenced',
      );
      throw error;
    }
    return folder.relativeDirectory;
  }

  // -------------------------------------------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------------------------------------------

  /** The exports of a project, newest first (listProjectExports; R-220). */
  listProjectExports(projectId: string): { exports: Export[] } {
    if (!this.#repository.projectExists(projectId)) {
      throw PROBLEMS.projectNotFound();
    }
    return {
      exports: this.#repository
        .exportsOfProject(projectId)
        .map((stored) => this.#exportView(stored, this.#repository.exportFiles(stored.id))),
    };
  }

  /** An export with the exact exported element versions in carousel order (getExport; R-043, R-220). */
  getExport(exportId: string): ExportDetail {
    const stored = this.#repository.export(exportId);
    if (stored === null) {
      throw PROBLEMS.exportNotFound();
    }
    const files = this.#repository.exportFiles(exportId);
    const elements = files
      .flatMap((file) => {
        const version = file.elementVersionId === null ? null : this.#repository.version(file.elementVersionId);
        return version === null ? [] : [version];
      })
      .sort((a, b) => a.position - b.position)
      .map((version) => ({
        position: version.position,
        kind: version.kind,
        version: this.#versionView(stored.projectId, version),
      }));
    return { ...this.#exportView(stored, files), elements };
  }

  /** Creates a ZIP from the exact persisted files of an export, without re-rendering or adding history. */
  async downloadExport(exportId: string): Promise<Buffer> {
    const stored = this.#repository.export(exportId);
    if (stored === null) throw PROBLEMS.exportNotFound();
    if (stored.directory !== exportRelativeDirectory(stored.projectId, stored.id)) {
      throw new HttpProblem(409, 'EXPORT_FILES_CORRUPT', 'Los archivos registrados no coinciden con esta exportación.');
    }
    const records = this.#repository.exportFiles(exportId);
    const slides = records.filter((file) => file.kind === 'slide_image');
    const caption = records.filter((file) => file.kind === 'caption_text');
    const manifest = records.filter((file) => file.kind === 'manifest');
    if (
      slides.length === 0 ||
      caption.length !== 1 ||
      manifest.length !== 1 ||
      slides.some((f, i) => f.position !== i + 1 || f.fileName !== `${String(i + 1).padStart(2, '0')}.png`)
    ) {
      throw new HttpProblem(
        409,
        'EXPORT_FILES_CORRUPT',
        'El registro de archivos de esta exportación está incompleto.',
      );
    }
    let files: readonly { name: string; bytes: Buffer }[];
    try {
      files = await this.#files.readFiles(
        stored.projectId,
        stored.id,
        [...slides, ...caption, ...manifest].map((f) => f.fileName),
      );
    } catch {
      throw new HttpProblem(404, 'EXPORT_FILES_MISSING', 'Los archivos de esta exportación ya no están disponibles.');
    }
    for (const [index, file] of files.entries()) {
      const expected = [...slides, ...caption, ...manifest][index];
      if (
        expected === undefined ||
        createHash('sha256').update(file.bytes).digest('hex') !== expected.sha256 ||
        (expected.kind === 'manifest' && expected.sha256 !== stored.manifestSha256)
      ) {
        throw new HttpProblem(
          409,
          'EXPORT_FILES_CORRUPT',
          'Un archivo de esta exportación no coincide con su registro.',
        );
      }
    }
    return createZip(files);
  }

  /**
   * The facts of the slide at a position of an export, with status and reason, evidence (source, mode, reference,
   * retrieval time, import version), manual approval and dispute (traceExportedSlide; R-044, R-221, R-287).
   */
  traceSlide(exportId: string, position: number): SlideTrace {
    const stored = this.#repository.export(exportId);
    if (stored === null) {
      throw PROBLEMS.exportNotFound();
    }
    const file = this.#repository
      .exportFiles(exportId)
      .find((candidate) => candidate.kind === 'slide_image' && candidate.position === position);
    if (file?.elementVersionId === null || file === undefined) {
      throw PROBLEMS.slideNotFound();
    }
    const factIds = new Set(this.#repository.factRefs(file.elementVersionId));
    const runIds = new Set<string>();
    for (const factId of factIds) {
      const fact = this.#repository.fact(factId);
      if (fact !== null) {
        runIds.add(fact.runId);
      }
    }
    const verification = new VerificationService({ container: this.#offline });
    const facts = [...runIds]
      .sort()
      .flatMap((runId) =>
        verification.listFacts(stored.projectId, runId).facts.filter((fact) => factIds.has(fact.factId)),
      );
    return {
      exportId: stored.id,
      position: file.position,
      elementVersionId: file.elementVersionId,
      dataMode: stored.dataMode,
      facts,
    };
  }

  // -------------------------------------------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------------------------------------------

  #exportView(stored: StoredExport, files: readonly StoredExportFile[]): Export {
    return {
      id: stored.id,
      projectId: stored.projectId,
      carouselId: stored.carouselId,
      finalApprovalId: stored.finalApprovalId,
      exportedAt: stored.exportedAt,
      directory: stored.directory,
      dataMode: stored.dataMode,
      demonstration: stored.dataMode === 'DEMO_DATA',
      files: files.map((file) => ({
        position: file.position,
        fileName: file.fileName,
        kind: file.kind,
        sha256: file.sha256,
        elementVersionId: file.elementVersionId,
      })),
    };
  }

  /**
   * The contract view of an exported version as the review view shows a version (T37): its state now (for example
   * `superseded` after a later regeneration), the blocked overlay, QA results, and its stored text with each fact
   * segment's current status (never `verified` for a manually approved fact).
   */
  #versionView(projectId: string, row: ExportVersionRow): ElementVersion {
    const version = this.#review.version(row.id);
    if (version === null) {
      throw new Error('an exported version does not exist');
    }
    const context = { db: this.#deps.db, config: this.#deps.config };
    const overlay = blockedOverlay(context, version.id) ?? { blocked: false, blockingFacts: [] };
    const qa = this.#review.qaResults(version.id);
    const segmentFacts = new Set<string>();
    for (const field of version.text.fields) {
      for (const segment of field.segments) {
        if (segment.factId !== null) {
          segmentFacts.add(segment.factId);
        }
      }
    }
    const verdicts = verificationPublishability(context, projectId, [...segmentFacts].sort());
    const fields: TextField[] = version.text.fields.map((field) => ({
      field: field.field,
      segments: field.segments.map((segment) => ({
        provenance: segment.provenance,
        text: segment.text,
        factId: segment.factId,
        factStatus: segment.factId === null ? null : (verdicts.get(segment.factId)?.status ?? 'unverified'),
      })),
    }));
    const state = versionState({
      superseded: version.superseded,
      qaStatus: version.qaStatus,
      approved: this.#review.isApproved(version.id),
      blocked: overlay.blocked,
      flagged: version.contentFlags.length > 0,
      qa: qa.map((result) => ({
        severity: result.severity,
        outcome: result.outcome,
        acknowledged: result.acknowledgedAt !== null,
      })),
    });
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      state,
      blocked: overlay.blocked,
      blockingFacts: overlay.blockingFacts,
      contentFlags: version.contentFlags,
      qa,
      fields,
      // OD-42: the relative path of getSlideImage.
      imageUrl: version.hasImage ? slideImageUrl(version.id) : null,
      width: version.width,
      height: version.height,
    };
  }
}

/** The export plan before the slide images are read. */
interface PlanWithoutImages {
  readonly exportId: string;
  readonly exportedAt: string;
  readonly project: ExportProject;
  readonly carousel: ExportPlan['carousel'];
  readonly finalApproval: ExportPlan['finalApproval'];
  readonly slides: readonly { readonly version: ExportVersionRow; readonly factIds: readonly string[] }[];
  readonly caption: ExportPlan['caption'];
  readonly facts: readonly ManifestFact[];
  readonly sources: readonly ManifestSource[];
}
