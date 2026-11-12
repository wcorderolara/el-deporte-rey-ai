/**
 * Visual template service (PD-ARCH-01G-C): templates made from approved design proposals, their versions and layers,
 * validation, publication, and previews with local sports data drawn by the slide engine.
 *
 * - Conversion is local: the proposal's clean background is referenced by its hash (no copy, no AI call) and its
 *   original brand layers become layers of the first draft, with the sports-data layers the content type requires at
 *   neutral positions. The content type is the operator's choice (the proposal's by default; Product Owner decision
 *   01G-C-1) and never changes afterwards. A proposal that is not approved is refused; an own-prompt proposal needs the
 *   operator's acknowledgement of the warnings about its image.
 * - Lifecycle: one draft at a time; a save names the revision it starts from (`VERSION_CONFLICT` otherwise); a
 *   published version is never changed (`TEMPLATE_VERSION_PUBLISHED`) and a change starts a new draft version copied
 *   from it. An archived template is read only. A template with a published version is archived, never deleted.
 * - Assets: every brand asset a layer places is pinned by its hash when the draft is saved; brand files and proposal
 *   files are read from their confined stores with their hash checked. Protected assets are only drawn from their
 *   original file and only scaled proportionally; nothing is sent anywhere.
 * - Previews: the bindings are resolved from the local data (`catalog.ts`) and the version becomes a render model of
 *   the slide engine (`buildStructuredModel`), rendered by `renderSlide` as final slides are. PNGs are cached in memory
 *   by version, revision, selection and language (bounded), and concurrent requests for one key share one render.
 */
import { createHash, randomUUID } from 'node:crypto';

import {
  type BrandAsset,
  type Language,
  VISUAL_TEMPLATE_CANVAS,
  VISUAL_TEMPLATE_FIXTURE_LIST_ROWS,
  type VisualTemplate,
  type VisualTemplateAssetRef,
  type VisualTemplateBackgroundInput,
  type VisualTemplateBadgeBinding,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplateCreate,
  type VisualTemplateDetail,
  type VisualTemplateIssue,
  type VisualTemplateLayer,
  type VisualTemplatePreview,
  type VisualTemplatePreviewRequest,
  type VisualTemplatePreviewSelection,
  type VisualTemplateTextStyle,
  type VisualTemplateUpdate,
  type VisualTemplateVersion,
  type VisualTemplateVersionCreate,
  type VisualTemplateVersionSave,
  MAX_VISUAL_TEMPLATE_ASSET_LAYERS,
} from '@edr/contracts';

import type { Clock } from '../../container.js';
import type { Db } from '../../platform/db/index.js';
import { formatDate, formatTime, templateText } from '../../platform/format/index.js';
import { HttpProblem, type Logger } from '../../platform/http/index.js';
import type { BrandAssetService } from '../brand/index.js';
import type { TeamBadgeRecord, TeamBadgeService } from '../competitions/badges/index.js';
import type { DesignService, DesignTemplateSource } from '../design/index.js';
import {
  type AssetRef,
  type EmbeddedAsset,
  type FontSet,
  type Palette,
  type StructuredItem,
  buildStructuredModel,
  renderSlide,
} from '../rendering/index.js';

import { type LocalSelectionData, readSelection, resolveBinding } from './catalog.js';
import { type LuminanceSampler, backgroundSampler } from './contrast.js';
import type { VisualTemplateRepository } from './repository.js';
import { type StoredBackground, type TemplateRecord, type VersionRecord } from './repository.js';
import { type ComposeRow, composeItems } from './compose.js';
import { issueOf } from './issues.js';
import {
  type AssetState,
  type BackgroundState,
  usedBadgeBindings,
  usedBindings,
  validateVersion,
} from './validation.js';

/** Most preview PNGs and background samplers kept in memory. */
export const PREVIEW_CACHE_ENTRIES = 16;
const SAMPLER_CACHE_ENTRIES = 16;

export interface VisualTemplateServiceDeps {
  readonly repository: VisualTemplateRepository;
  readonly db: Db;
  readonly design: Pick<DesignService, 'templateSource' | 'readFile'>;
  readonly brandAssets: Pick<BrandAssetService, 'find' | 'readFile'>;
  /** Team badges (PD-ARCH-01G-D), resolved by the internal identity of a team. */
  readonly badges: Pick<TeamBadgeService, 'active' | 'read'>;
  readonly fonts: () => FontSet;
  readonly palette: Palette;
  readonly utcOffsetMinutes: number;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly newId?: () => string;
}

const problems = {
  notFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'No se encontró la plantilla visual.'),
  versionNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'No se encontró la versión de la plantilla.'),
  proposalNotFound: (): HttpProblem => new HttpProblem(404, 'NOT_FOUND', 'No se encontró la propuesta visual.'),
  source: (detail: string): HttpProblem => new HttpProblem(409, 'TEMPLATE_SOURCE_REFUSED', detail),
  archived: (): HttpProblem =>
    new HttpProblem(409, 'VERSION_CONFLICT', 'La plantilla está archivada: restáurala para modificarla.'),
  stale: (): HttpProblem =>
    new HttpProblem(409, 'VERSION_CONFLICT', 'La versión cambió desde que la abriste: recárgala antes de guardar.'),
  published: (): HttpProblem =>
    new HttpProblem(
      409,
      'TEMPLATE_VERSION_PUBLISHED',
      'Una versión publicada no se modifica: crea una nueva versión para cambiarla.',
    ),
};

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** A fraction rounded to 4 decimals (positions and sizes are stored this way). */
function fraction(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function normalized(layer: VisualTemplateLayer): VisualTemplateLayer {
  return {
    ...layer,
    x: fraction(layer.x),
    y: fraction(layer.y),
    width: fraction(layer.width),
    height: fraction(layer.height),
  };
}

const TEAM_STYLE: VisualTemplateTextStyle = {
  fontRole: 'heading',
  maxFontSize: 56,
  minFontSize: 28,
  maxLines: 2,
  colorRole: 'light',
  align: 'center',
  verticalAlign: 'middle',
  overflow: 'shrink',
  effect: 'soft_shadow',
};

/**
 * The layers a new template starts with, at neutral positions: the values its content type requires; a cover starts
 * with the competition and the round as optional values (nothing is required of a cover or a closing, 01G-D-3).
 */
function starterLayers(contentType: VisualTemplateContentType): VisualTemplateLayer[] {
  const data = (
    id: string,
    name: string,
    binding: VisualTemplateBinding,
    box: { x: number; y: number; width: number; height: number },
    style: VisualTemplateTextStyle,
    required = true,
  ): VisualTemplateLayer => ({ id, name, type: 'sports_data', binding, required, visible: true, ...box, style });
  if (contentType === 'cover') {
    return [
      data(
        'competition',
        'Competición',
        'competition.name',
        { x: 0.06, y: 0.2, width: 0.88, height: 0.2 },
        { ...TEAM_STYLE, maxFontSize: 84, minFontSize: 40, maxLines: 3 },
        false,
      ),
      data(
        'round',
        'Jornada',
        'round.name',
        { x: 0.06, y: 0.43, width: 0.88, height: 0.08 },
        { ...TEAM_STYLE, fontRole: 'numeric', maxFontSize: 48, minFontSize: 26, maxLines: 1, colorRole: 'accent' },
        false,
      ),
    ];
  }
  if (contentType === 'closing') {
    // A closing shows no sports value: a fixed text the operator writes (the brand logo comes from the proposal).
    return [
      {
        id: 'closing-text',
        name: 'Texto de cierre',
        type: 'text',
        text: 'Texto de cierre',
        visible: true,
        x: 0.08,
        y: 0.3,
        width: 0.84,
        height: 0.16,
        style: { ...TEAM_STYLE, maxFontSize: 64, minFontSize: 32, maxLines: 2 },
      },
    ];
  }
  if (contentType === 'round_overview') {
    return [
      data(
        'fixtures',
        'Partidos de la jornada',
        'round.fixtures',
        { x: 0.08, y: 0.25, width: 0.84, height: 0.5 },
        {
          ...TEAM_STYLE,
          fontRole: 'body',
          maxFontSize: 40,
          minFontSize: 20,
          maxLines: 10,
          align: 'left',
          verticalAlign: 'top',
        },
      ),
    ];
  }
  const layers = [
    data('home-team', 'Equipo local', 'match.homeTeam.name', { x: 0.05, y: 0.4, width: 0.42, height: 0.1 }, TEAM_STYLE),
    data(
      'away-team',
      'Equipo visitante',
      'match.awayTeam.name',
      { x: 0.53, y: 0.4, width: 0.42, height: 0.1 },
      TEAM_STYLE,
    ),
  ];
  if (contentType === 'match_result') {
    layers.push(
      data(
        'score',
        'Marcador',
        'match.score',
        { x: 0.3, y: 0.52, width: 0.4, height: 0.12 },
        {
          ...TEAM_STYLE,
          fontRole: 'numeric',
          maxFontSize: 120,
          minFontSize: 60,
          maxLines: 1,
          effect: 'scoreboard_gold',
        },
      ),
    );
  }
  return layers;
}

/** The layers of a proposal's original brand assets, at their boxes as fractions of the proposal. */
function proposalLayers(source: DesignTemplateSource): VisualTemplateLayer[] {
  const used = new Set<string>();
  return source.layers.map((layer) => {
    const base = layer.kind === 'brand_logo' ? 'logo' : layer.kind === 'mascot' ? 'mascot' : 'graphic';
    let id = base;
    for (let n = 2; used.has(id); n += 1) {
      id = `${base}-${String(n)}`;
    }
    used.add(id);
    const box = {
      x: fraction(layer.x / source.proposal.width),
      y: fraction(layer.y / source.proposal.height),
      width: fraction(Math.min(layer.width / source.proposal.width, 1 - layer.x / source.proposal.width)),
      height: fraction(Math.min(layer.height / source.proposal.height, 1 - layer.y / source.proposal.height)),
    };
    const name = layer.label.slice(0, 80);
    return layer.kind === 'brand_logo' || layer.kind === 'mascot'
      ? { id, name, type: 'brand_asset', assetId: layer.assetId, visible: true, ...box }
      : { id, name, type: 'image', assetId: layer.assetId, fit: 'contain', visible: true, ...box };
  });
}

/** A least-recently-used map of promises (failed entries are dropped). */
class PromiseCache<T> {
  readonly #entries = new Map<string, Promise<T>>();
  readonly #max: number;

  constructor(max: number) {
    this.#max = max;
  }

  get(key: string, make: () => Promise<T>): Promise<T> {
    const existing = this.#entries.get(key);
    if (existing !== undefined) {
      this.#entries.delete(key);
      this.#entries.set(key, existing);
      return existing;
    }
    const created = make();
    this.#entries.set(key, created);
    created.catch(() => this.#entries.delete(key));
    while (this.#entries.size > this.#max) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
    return created;
  }
}

interface PreviewModel {
  readonly items: StructuredItem[];
  readonly assets: Map<string, EmbeddedAsset>;
  readonly values: { binding: VisualTemplateBinding; value: string | null }[];
  readonly badges: { binding: VisualTemplateBadgeBinding; badgeId: string | null }[];
  readonly issues: VisualTemplateIssue[];
}

export class VisualTemplateService {
  readonly #repository: VisualTemplateRepository;
  readonly #db: Db;
  readonly #design: VisualTemplateServiceDeps['design'];
  readonly #brand: VisualTemplateServiceDeps['brandAssets'];
  readonly #badges: VisualTemplateServiceDeps['badges'];
  readonly #fonts: () => FontSet;
  readonly #palette: Palette;
  readonly #utcOffsetMinutes: number;
  readonly #clock: Clock;
  readonly #logger: Logger;
  readonly #newId: () => string;
  readonly #previews = new PromiseCache<Buffer>(PREVIEW_CACHE_ENTRIES);
  readonly #samplers = new PromiseCache<LuminanceSampler>(SAMPLER_CACHE_ENTRIES);
  #fontSet: FontSet | null = null;

  constructor(deps: VisualTemplateServiceDeps) {
    this.#repository = deps.repository;
    this.#db = deps.db;
    this.#design = deps.design;
    this.#brand = deps.brandAssets;
    this.#badges = deps.badges;
    this.#fonts = deps.fonts;
    this.#palette = deps.palette;
    this.#utcOffsetMinutes = deps.utcOffsetMinutes;
    this.#clock = deps.clock;
    this.#logger = deps.logger;
    this.#newId = deps.newId ?? randomUUID;
  }

  // -------------------------------------------------------------------------------------------------------------
  // Templates
  // -------------------------------------------------------------------------------------------------------------

  list(): VisualTemplate[] {
    return this.#repository.templates().map((record) => this.#view(record));
  }

  detail(id: string): VisualTemplateDetail {
    const record = this.#template(id);
    return {
      template: this.#view(record),
      versions: this.#repository.versions(id).map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status === 'published' ? 'published' : 'draft',
        layerCount: version.layers.length,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        publishedAt: version.publishedAt,
      })),
    };
  }

  /** Creates a template and its first draft from an approved design proposal (no AI call). */
  create(input: VisualTemplateCreate): VisualTemplateDetail {
    const source = this.#design.templateSource(input.sourceProposalId);
    if (source === null || source.deleted) {
      throw problems.proposalNotFound();
    }
    if (source.proposal.status !== 'approved') {
      throw problems.source('Solo una propuesta aprobada puede ser la base de una plantilla.');
    }
    if (source.proposal.mode === 'own_prompt' && input.acknowledgeWarnings !== true) {
      throw problems.source(
        'La propuesta es de prompt propio: confirma que revisaste que su imagen puede contener textos, personas, ' +
          'logos o una mascota generados por la IA.',
      );
    }
    // The proposal is only the background: the operator may choose another content type (decision 01G-C-1).
    const contentType = input.contentType ?? source.proposal.contentType;
    const canvas = VISUAL_TEMPLATE_CANVAS[source.proposal.format];
    const layers = [...proposalLayers(source), ...starterLayers(contentType)];
    const id = this.#newId();
    const versionId = this.#newId();
    const now = this.#now();
    this.#repository.transaction(() => {
      this.#repository.insertTemplate({
        id,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        contentType,
        format: source.proposal.format,
        sourceProposalId: source.proposal.id,
        acknowledgedWarnings: input.acknowledgeWarnings === true,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        deletedAt: null,
      });
      this.#repository.insertVersion({
        id: versionId,
        templateId: id,
        version: 1,
        revision: 1,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        background: { source: 'design_proposal', id: source.proposal.id, ...source.background },
        layers,
        assets: this.#pinAssets(layers),
        createdAt: now,
        updatedAt: now,
      });
    });
    this.#logger.info({ templateId: id, proposalId: source.proposal.id }, 'visual template created');
    return this.detail(id);
  }

  update(id: string, input: VisualTemplateUpdate): VisualTemplate {
    const record = this.#editable(id);
    this.#repository.updateTemplate(
      id,
      {
        name: input.name ?? record.name,
        description: input.description === undefined ? record.description : input.description,
        category: input.category === undefined ? record.category : input.category,
      },
      this.#now(),
    );
    return this.#view(this.#template(id));
  }

  /** Deletes a template that was never published (logical); a published one is archived instead. */
  /**
   * Deletes a template that was never published or is archived (Product Owner decision 01G-D-4). A published template
   * is archived first. Deletion is logical: the rows stay, so the projects that used a version keep rendering it.
   */
  delete(id: string): void {
    this.#repository.transaction(() => {
      const record = this.#template(id);
      if (
        record.archivedAt === null &&
        this.#repository.versions(id).some((version) => version.status === 'published')
      ) {
        throw new HttpProblem(409, 'TEMPLATE_IN_USE', 'La plantilla está publicada: archívala antes de eliminarla.');
      }
      this.#repository.markDeleted(id, this.#now());
    });
    this.#logger.info({ templateId: id }, 'visual template deleted');
  }

  archive(id: string, archived: boolean): VisualTemplate {
    const record = this.#template(id);
    if ((record.archivedAt !== null) !== archived) {
      const now = this.#now();
      this.#repository.setArchived(id, archived ? now : null, now);
    }
    return this.#view(this.#template(id));
  }

  // -------------------------------------------------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------------------------------------------------

  async version(templateId: string, versionId: string): Promise<VisualTemplateVersion> {
    const template = this.#template(templateId);
    return this.#versionView(template, this.#version(templateId, versionId));
  }

  /** Saves a draft (see the module notes); the result carries its validation. */
  async save(templateId: string, versionId: string, input: VisualTemplateVersionSave): Promise<VisualTemplateVersion> {
    const template = this.#editable(templateId);
    const current = this.#version(templateId, versionId);
    if (current.status === 'published') {
      throw problems.published();
    }
    if (current.revision !== input.revision) {
      throw problems.stale();
    }
    const ids = new Set<string>();
    for (const layer of input.layers) {
      if (ids.has(layer.id)) {
        throw new HttpProblem(400, 'VALIDATION_FAILED', 'Dos capas tienen el mismo identificador.');
      }
      ids.add(layer.id);
    }
    const assetLayers = input.layers.filter((layer) => layer.type === 'image' || layer.type === 'brand_asset');
    if (assetLayers.length > MAX_VISUAL_TEMPLATE_ASSET_LAYERS) {
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        `Una versión admite como máximo ${String(MAX_VISUAL_TEMPLATE_ASSET_LAYERS)} capas de imagen o recurso.`,
      );
    }
    const background = this.#background(input.background, current.background);
    const layers = input.layers.map(normalized);
    const saved = this.#repository.transaction(() => {
      const ok = this.#repository.saveDraft(
        versionId,
        input.revision,
        { background, layers, assets: this.#pinAssets(layers) },
        this.#now(),
      );
      if (ok) {
        this.#repository.touchTemplate(templateId, this.#now());
      }
      return ok;
    });
    if (!saved) {
      throw problems.stale();
    }
    this.#logger.info({ templateId, versionId, revision: input.revision + 1 }, 'visual template draft saved');
    return this.#versionView(template, this.#version(templateId, versionId));
  }

  /** Starts a new draft copied from a published version (the latest one by default). */
  async createVersion(templateId: string, input: VisualTemplateVersionCreate): Promise<VisualTemplateVersion> {
    const template = this.#editable(templateId);
    const versions = this.#repository.versions(templateId);
    if (versions.some((version) => version.status === 'draft')) {
      throw new HttpProblem(409, 'VERSION_CONFLICT', 'La plantilla ya tiene un borrador: edítalo o descártalo.');
    }
    const from =
      input.fromVersionId === undefined
        ? versions.filter((version) => version.status === 'published').at(-1)
        : versions.find((version) => version.id === input.fromVersionId);
    if (from === undefined) {
      throw problems.versionNotFound();
    }
    const id = this.#newId();
    const now = this.#now();
    this.#repository.transaction(() => {
      this.#repository.insertVersion({
        id,
        templateId,
        version: this.#repository.latestVersionNumber(templateId) + 1,
        revision: 1,
        canvasWidth: from.canvasWidth,
        canvasHeight: from.canvasHeight,
        background: from.background,
        layers: from.layers,
        assets: from.assets,
        createdAt: now,
        updatedAt: now,
      });
      this.#repository.touchTemplate(templateId, now);
    });
    this.#logger.info({ templateId, versionId: id, from: from.id }, 'visual template version created');
    return this.#versionView(template, this.#version(templateId, id));
  }

  /** Discards a draft when the template has a published version to fall back to. */
  discardVersion(templateId: string, versionId: string): void {
    this.#editable(templateId);
    const version = this.#version(templateId, versionId);
    if (version.status === 'published') {
      throw problems.published();
    }
    if (!this.#repository.versions(templateId).some((candidate) => candidate.status === 'published')) {
      throw new HttpProblem(
        409,
        'VERSION_CONFLICT',
        'Es la única versión de la plantilla: elimina la plantilla si ya no la necesitas.',
      );
    }
    this.#repository.transaction(() => {
      this.#repository.discard(versionId, this.#now());
      this.#repository.touchTemplate(templateId, this.#now());
    });
  }

  /** Publishes a draft without validation errors; the version is immutable afterwards. */
  async publish(templateId: string, versionId: string, revision: number): Promise<VisualTemplateVersion> {
    const template = this.#editable(templateId);
    const version = this.#version(templateId, versionId);
    if (version.status === 'published') {
      throw problems.published();
    }
    if (version.revision !== revision) {
      throw problems.stale();
    }
    const view = await this.#versionView(template, version);
    if (!view.validation.publishable) {
      const errors = view.validation.issues.filter((candidate) => candidate.severity === 'error').length;
      throw new HttpProblem(
        409,
        'TEMPLATE_NOT_PUBLISHABLE',
        `La versión tiene ${String(errors)} error(es) de validación: corrígelos antes de publicar.`,
      );
    }
    const now = this.#now();
    const published = this.#repository.transaction(() => {
      const ok = this.#repository.publish(versionId, revision, now);
      if (ok) {
        this.#repository.touchTemplate(templateId, now);
      }
      return ok;
    });
    if (!published) {
      throw problems.stale();
    }
    this.#logger.info({ templateId, versionId, version: version.version }, 'visual template version published');
    return this.#versionView(template, this.#version(templateId, versionId));
  }

  /** Checks that a version of a template exists (404 otherwise). */
  requireVersion(templateId: string, versionId: string): void {
    this.#template(templateId);
    this.#version(templateId, versionId);
  }

  /** The background bytes of a version (its pinned file). */
  async background(
    templateId: string,
    versionId: string,
  ): Promise<{ mime: 'image/png' | 'image/jpeg'; content: Buffer; versionId: string }> {
    this.#template(templateId);
    const version = this.#version(templateId, versionId);
    const content = await this.#readBackground(version.background);
    return { mime: version.background.mime, content, versionId };
  }

  // -------------------------------------------------------------------------------------------------------------
  // Previews
  // -------------------------------------------------------------------------------------------------------------

  /** Resolves the version's bindings for the selected local data and reports what the rendering would show. */
  async preview(
    templateId: string,
    versionId: string,
    request: VisualTemplatePreviewRequest,
  ): Promise<VisualTemplatePreview> {
    const template = this.#template(templateId);
    const version = this.#version(templateId, versionId);
    const language = request.language ?? 'es';
    const prepared = await this.#prepare(template, version, request.selection, language, false);
    const { overflowing } = buildStructuredModel(this.#document(template, version, prepared.items, language), {
      palette: this.#palette,
      fonts: this.#fontsOf(),
    });
    const params = new URLSearchParams({
      competitionId: request.selection.competitionId,
      seasonId: request.selection.seasonId,
    });
    const { roundId, matchId } = request.selection;
    if (roundId !== undefined && roundId !== null) params.set('roundId', roundId);
    if (matchId !== undefined && matchId !== null) params.set('matchId', matchId);
    params.set('language', language);
    params.set('revision', String(version.revision));
    return {
      values: prepared.values,
      badges: prepared.badges,
      issues: [...prepared.issues, ...overflowing.map((id) => issueOf('TEXT_OVERFLOW', 'error', id))],
      imageUrl: `/api/v1/visual-templates/${templateId}/versions/${versionId}/preview?${params.toString()}`,
      width: version.canvasWidth,
      height: version.canvasHeight,
    };
  }

  /** The PNG of a preview, drawn by the slide engine (cached; see the module notes). */
  async renderPreview(
    templateId: string,
    versionId: string,
    selection: VisualTemplatePreviewSelection,
    language: Language,
  ): Promise<Buffer> {
    const template = this.#template(templateId);
    const version = this.#version(templateId, versionId);
    // The selection is checked before the cache, so an unknown selection is never cached.
    const data = readSelection(this.#db, template.contentType, selection);
    const key = [
      version.id,
      String(version.revision),
      selection.competitionId,
      selection.seasonId,
      selection.roundId ?? '',
      selection.matchId ?? '',
      language,
    ].join('|');
    return this.#previews.get(key, async () => {
      const prepared = await this.#prepare(template, version, selection, language, true, data);
      const { model } = buildStructuredModel(this.#document(template, version, prepared.items, language), {
        palette: this.#palette,
        fonts: this.#fontsOf(),
      });
      const rendered = await renderSlide(model, { fonts: this.#fontsOf(), assets: prepared.assets });
      return rendered.png;
    });
  }

  // -------------------------------------------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------------------------------------------

  #now(): string {
    return this.#clock.now().toISOString();
  }

  #fontsOf(): FontSet {
    this.#fontSet ??= this.#fonts();
    return this.#fontSet;
  }

  #template(id: string): TemplateRecord {
    const record = this.#repository.template(id);
    if (record === null || record.deletedAt !== null) {
      throw problems.notFound();
    }
    return record;
  }

  #editable(id: string): TemplateRecord {
    const record = this.#template(id);
    if (record.archivedAt !== null) {
      throw problems.archived();
    }
    return record;
  }

  #version(templateId: string, versionId: string): VersionRecord {
    const version = this.#repository.version(templateId, versionId);
    if (version === null || version.status === 'discarded') {
      throw problems.versionNotFound();
    }
    return version;
  }

  #view(record: TemplateRecord): VisualTemplate {
    const versions = this.#repository.versions(record.id);
    const published = versions.filter((version) => version.status === 'published').at(-1);
    const draft = versions.find((version) => version.status === 'draft');
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      category: record.category,
      contentType: record.contentType,
      format: record.format,
      status: record.archivedAt !== null ? 'archived' : published === undefined ? 'draft' : 'published',
      sourceProposalId: record.sourceProposalId,
      publishedVersion:
        published === undefined || published.publishedAt === null
          ? null
          : { id: published.id, version: published.version, publishedAt: published.publishedAt },
      draftVersionId: draft?.id ?? null,
      versionCount: Math.max(1, versions.length),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      archivedAt: record.archivedAt,
    };
  }

  /** The brand assets the layers place, pinned by their current hash (missing or deleted ones are left out). */
  #pinAssets(layers: readonly VisualTemplateLayer[]): VisualTemplateAssetRef[] {
    const refs: VisualTemplateAssetRef[] = [];
    for (const layer of layers) {
      if (
        (layer.type !== 'image' && layer.type !== 'brand_asset') ||
        refs.some((ref) => ref.assetId === layer.assetId)
      ) {
        continue;
      }
      const found = this.#brand.find(layer.assetId);
      if (found !== null && !found.deleted) {
        refs.push({
          assetId: found.asset.id,
          label: found.asset.label,
          kind: found.asset.kind,
          usagePolicy: found.asset.usagePolicy,
          official: found.asset.official,
          sha256: found.asset.sha256,
        });
      }
    }
    return refs;
  }

  /** The stored background of a save: kept when unchanged, otherwise checked and pinned. */
  #background(input: VisualTemplateBackgroundInput, stored: StoredBackground): StoredBackground {
    if (input.source === stored.source && input.id === stored.id) {
      return stored;
    }
    if (input.source === 'design_proposal') {
      const source = this.#design.templateSource(input.id);
      if (source === null || source.deleted) {
        throw problems.proposalNotFound();
      }
      if (source.proposal.status !== 'approved') {
        throw problems.source('Solo una propuesta aprobada puede ser el fondo de una plantilla.');
      }
      return { source: 'design_proposal', id: input.id, ...source.background };
    }
    const found = this.#brand.find(input.id);
    if (found === null || found.deleted) {
      throw new HttpProblem(404, 'NOT_FOUND', 'El fondo no existe en Mi marca.');
    }
    const { asset } = found;
    if (
      asset.kind !== 'background' ||
      !asset.active ||
      asset.usagePolicy === 'reference_only' ||
      (asset.mime !== 'image/png' && asset.mime !== 'image/jpeg')
    ) {
      throw problems.source('El fondo debe ser un recurso activo de la categoría Fondos de Mi marca, en PNG o JPEG.');
    }
    if (asset.usagePolicy === 'protected') {
      // A background covers the canvas and may be cropped; a protected asset is only scaled proportionally.
      throw problems.source('Un fondo protegido no puede recortarse para cubrir el lienzo: usa un fondo reutilizable.');
    }
    return {
      source: 'brand_asset',
      id: asset.id,
      sha256: asset.sha256,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
    };
  }

  /** The background bytes, read from their store and checked against the pinned hash. */
  async #readBackground(background: StoredBackground): Promise<Buffer> {
    const content =
      background.source === 'design_proposal'
        ? (await this.#design.readFile(background.id, 'background')).content
        : (await this.#brand.readFile(background.id)).content;
    if (sha256(content) !== background.sha256) {
      throw new HttpProblem(409, 'TEMPLATE_SOURCE_REFUSED', 'El archivo del fondo ya no coincide con el guardado.');
    }
    return content;
  }

  #backgroundState(version: VersionRecord): { state: BackgroundState; label: string } {
    const { background } = version;
    if (background.source === 'design_proposal') {
      const source = this.#design.templateSource(background.id);
      return {
        state: {
          source: 'design_proposal',
          found: source !== null,
          deleted: source?.deleted ?? false,
          approved: source?.proposal.status === 'approved',
          mode: source?.proposal.mode ?? 'guided',
          sentBrandImage: source?.sentBrandImage ?? false,
        },
        label: source?.proposal.name ?? 'Propuesta visual',
      };
    }
    const found = this.#brand.find(background.id);
    return {
      state: { source: 'brand_asset', state: found },
      label: found?.asset.label ?? 'Fondo de Mi marca',
    };
  }

  async #versionView(template: TemplateRecord, version: VersionRecord): Promise<VisualTemplateVersion> {
    const canvas = { width: version.canvasWidth, height: version.canvasHeight };
    const assets = new Map<string, AssetState>();
    for (const layer of version.layers) {
      if ((layer.type === 'image' || layer.type === 'brand_asset') && !assets.has(layer.assetId)) {
        assets.set(layer.assetId, this.#brand.find(layer.assetId));
      }
    }
    const { state, label } = this.#backgroundState(version);
    let sampler: LuminanceSampler | null = null;
    let unreadable = false;
    try {
      sampler = await this.#samplers.get(
        `${version.background.sha256}|${String(canvas.width)}x${String(canvas.height)}`,
        async () =>
          backgroundSampler(
            { mime: version.background.mime, content: await this.#readBackground(version.background) },
            canvas,
          ),
      );
    } catch {
      unreadable = true;
    }
    const validation = validateVersion({
      contentType: template.contentType,
      canvas,
      background: { ...state, width: version.background.width, height: version.background.height },
      layers: version.layers,
      assets,
      fonts: this.#fontsOf(),
      palette: this.#palette,
      sampler,
    });
    if (unreadable) {
      validation.issues.unshift(issueOf('BACKGROUND_UNAVAILABLE', 'error', null, 'No se pudo leer su archivo.'));
    }
    return {
      id: version.id,
      templateId: version.templateId,
      version: version.version,
      status: version.status === 'published' ? 'published' : 'draft',
      revision: version.revision,
      canvasWidth: version.canvasWidth,
      canvasHeight: version.canvasHeight,
      background: { ...version.background, label: label.slice(0, 120) },
      layers: [...version.layers],
      bindings: usedBindings(version.layers),
      assets: [...version.assets],
      validation: { publishable: !unreadable && validation.publishable, issues: validation.issues.slice(0, 400) },
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      publishedAt: version.publishedAt,
    };
  }

  /**
   * The items of a preview in stacking order with the values and issues of the selection; with `withFiles`, the
   * verified bytes of the background, of every placed asset and of the team badges.
   */
  async #prepare(
    template: TemplateRecord,
    version: VersionRecord,
    selection: VisualTemplatePreviewSelection,
    language: Language,
    withFiles: boolean,
    known?: LocalSelectionData,
  ): Promise<PreviewModel> {
    const data = known ?? readSelection(this.#db, template.contentType, selection);
    const values = usedBindings(version.layers).map((binding) => ({
      binding,
      value: resolveBinding(binding, data, language, this.#utcOffsetMinutes),
    }));
    const valueOf = new Map(values.map((entry) => [entry.binding, entry.value]));
    // Team badges by the internal identity of the selected match's teams (PD-ARCH-01G-D).
    const badgeRecords = new Map<VisualTemplateBadgeBinding, TeamBadgeRecord | null>();
    for (const binding of usedBadgeBindings(version.layers)) {
      const teamId = binding === 'match.homeTeam.badge' ? data.match?.homeTeamId : data.match?.awayTeamId;
      badgeRecords.set(binding, teamId === undefined ? null : this.#badges.active(teamId));
    }
    // PD-ARCH-01G-E.2: a match list previews the first page of the selected round (the rows a slide holds), each
    // team's current badge by its internal identity.
    const rowBadgeRecords: TeamBadgeRecord[] = [];
    const rowBadge = (teamId: string): AssetRef | null => {
      const record = this.#badges.active(teamId);
      if (record === null) {
        return null;
      }
      rowBadgeRecords.push(record);
      return { id: record.id, sha256: record.sha256, mime: record.mime };
    };
    const previewRun = (text: string | null) =>
      text === null ? null : ({ text, factIds: [], provenance: 'fact' } as const);
    const words = templateText(language);
    const rows = (): ComposeRow[] =>
      version.layers.some((layer) => layer.type === 'fixture_list')
        ? data.roundMatches.slice(0, VISUAL_TEMPLATE_FIXTURE_LIST_ROWS).map((match) => ({
            homeName: previewRun(match.homeTeamName),
            awayName: previewRun(match.awayTeamName),
            kickoffDate: previewRun(
              match.kickoffAt === null ? null : formatDate(match.kickoffAt, language, this.#utcOffsetMinutes),
            ),
            kickoffTime: previewRun(
              match.kickoffAt === null ? null : formatTime(match.kickoffAt, this.#utcOffsetMinutes),
            ),
            status: previewRun(
              match.status === 'scheduled'
                ? null
                : words.matchStatus[match.status === 'in_progress' ? 'in_play' : match.status],
            ),
            homeBadge: rowBadge(match.homeTeamId),
            awayBadge: rowBadge(match.awayTeamId),
          }))
        : [];
    const { background } = version;
    const assets = new Map<string, EmbeddedAsset>();
    const composition = composeItems(
      { background: { id: background.id, sha256: background.sha256, mime: background.mime }, layers: version.layers },
      {
        text: (binding) => {
          const value = valueOf.get(binding) ?? null;
          return value === null ? null : { text: value, factIds: [], provenance: 'fact' };
        },
        badge: (binding) => {
          const record = badgeRecords.get(binding) ?? null;
          return record === null ? null : { id: record.id, sha256: record.sha256, mime: record.mime };
        },
        asset: (assetId) => {
          const pinned = version.assets.find((ref) => ref.assetId === assetId);
          const found = this.#brand.find(assetId);
          const asset: BrandAsset | null = found === null || found.deleted ? null : found.asset;
          if (
            pinned === undefined ||
            asset === null ||
            asset.sha256 !== pinned.sha256 ||
            asset.usagePolicy === 'reference_only' ||
            (asset.mime !== 'image/png' && asset.mime !== 'image/jpeg')
          ) {
            return null;
          }
          return {
            ref: { id: asset.id, sha256: asset.sha256, mime: asset.mime },
            protectedAsset: asset.usagePolicy === 'protected',
          };
        },
        rows,
      },
    );
    if (withFiles) {
      assets.set(background.id, {
        id: background.id,
        sha256: background.sha256,
        mime: background.mime,
        content: await this.#readBackground(background),
      });
      for (const item of composition.items) {
        if (item.kind !== 'image' || assets.has(item.asset.id)) {
          continue;
        }
        const badge =
          [...badgeRecords.values(), ...rowBadgeRecords].find((record) => record?.id === item.asset.id) ?? null;
        const content =
          badge === null ? (await this.#brand.readFile(item.asset.id)).content : await this.#badges.read(badge);
        assets.set(item.asset.id, { ...item.asset, content });
      }
    }
    return {
      items: composition.items,
      assets,
      values,
      badges: [...badgeRecords].map(([binding, record]) => ({ binding, badgeId: record?.id ?? null })),
      issues: composition.issues,
    };
  }

  #document(template: TemplateRecord, version: VersionRecord, items: StructuredItem[], language: Language) {
    const canvas = { width: version.canvasWidth, height: version.canvasHeight };
    return {
      templateId: `vt-${template.id}`,
      templateVersion: String(version.version),
      slideType: template.contentType,
      language,
      designCanvas: canvas,
      canvas,
      items,
    };
  }
}
