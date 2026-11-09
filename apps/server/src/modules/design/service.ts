/**
 * AI design proposals (PD-ARCH-01G-B): capabilities, estimates, asynchronous generations and the review of their
 * proposals. The service depends on the image provider port, the brand library and the brand context only.
 *
 * - Plan (estimate and generation alike): the configured model, quality and count; the sizes of the format; each
 *   selected brand asset checked as active, present once and allowed in its role by its usage policy
 *   (`policies.ts`); the variant's previous proposal; the versioned prompt; the cost estimate.
 * - Cost controls: a generation needs `confirmCost: true` and a request key (a repeated key returns the same
 *   generation; another request under the same key is `REQUEST_KEY_REUSED`); the count, the daily images, the
 *   computed monthly spend and the concurrent generations have configured limits; the provider never retries.
 * - Run: one provider request per image, in order. The statuses are the ones the server records as it works:
 *   `preparing_references` (reading and verifying the files), `sending_request` (building the request),
 *   `generating` (the request is with the provider), `saving` (checking, adapting and storing the image), then
 *   `completed`, or `failed` with a closed code and a fixed message. Images saved before a failure stay as
 *   proposals. A generation interrupted by a restart is marked failed at startup.
 * - Proposals are files under `<dataDir>/design-proposals/` with their hash; they are reviewed by append-only
 *   decisions and never become templates or brand assets here.
 */
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { MAX_DESIGN_INSTRUCTIONS } from '@edr/contracts';
import type {
  BrandAssetUsagePolicy,
  DesignCapabilities,
  DesignContentType,
  DesignEstimate,
  DesignGeneration,
  DesignGenerationCreate,
  DesignGenerationErrorCode,
  DesignGenerationEvent,
  DesignGenerationInput,
  DesignMode,
  DesignModelAccess,
  DesignProposal,
  DesignProposalDecisionInput,
  DesignProposalDetail,
  DesignReference,
} from '@edr/contracts';

import type { Clock } from '../../container.js';
import { HttpProblem, type Logger } from '../../platform/http/index.js';
import { IMAGE_EGRESS_LIMITS } from '../../platform/net/index.js';
import {
  type ImageGenerationProvider,
  type ImageInput,
  type ImageModel,
  ImageProviderError,
  type ImageUsage,
} from '../../providers/images/index.js';
import {
  type BrandAssetService,
  type BrandContext,
  BrandFileError,
  BrandFileIntegrityError,
  type BrandFileStore,
} from '../brand/index.js';

import { addUsage, computedCost, estimateCost, roundAmount } from './cost.js';
import { GeneratedImageError, checkGeneratedImage, fitToSize } from './image.js';
import { ROLES_BY_POLICY, allowsRole, sendsImage } from './policies.js';
import { DESIGN_PROMPT_VERSION, OWN_PROMPT_VERSION, buildDesignPrompt, buildOwnPrompt } from './prompt.js';
import type { DesignRepository, GenerationRecord, ProposalRecord } from './repository.js';
import { type ProposalSize, proposalSize } from './sizes.js';
import { type LayerGroup, type LayerImage, composeLayers, layerGroup, zoneBox } from './layers.js';
import type { ProposalLayer } from './repository.js';

export const CONTENT_TYPES: readonly DesignContentType[] = [
  'match_preview',
  'round_overview',
  'fixture',
  'match_result',
];

const CONTENT_LABEL: Readonly<Record<DesignContentType, string>> = {
  match_preview: 'Previa individual',
  round_overview: 'Calendario',
  fixture: 'Próximos partidos',
  match_result: 'Resultados',
};

/** Room left in a request body for the prompt and the JSON around the images. */
const BODY_MARGIN_CHARACTERS = 256 * 1024;

const FAILURES: Readonly<Record<DesignGenerationErrorCode, string>> = {
  NOT_CONFIGURED: 'La generación de imágenes no está configurada en el servidor.',
  API_KEY_MISSING: 'Falta la clave de la API de imágenes en el servidor (EDR_IMAGE_API_KEY).',
  MODEL_UNAVAILABLE: 'El modelo configurado no está disponible para la cuenta del proveedor.',
  ACCOUNT_NOT_AUTHORIZED:
    'La cuenta del proveedor no está autorizada para este modelo. Revisa la clave y la verificación de la organización.',
  RATE_LIMITED: 'El proveedor limitó las solicitudes. Espera un momento antes de intentarlo de nuevo.',
  QUOTA_EXCEEDED: 'La cuenta del proveedor no tiene saldo disponible o alcanzó su límite de gasto.',
  PROVIDER_REJECTED:
    'El proveedor rechazó la solicitud por su política de contenido. Ajusta las instrucciones o las referencias.',
  INVALID_REQUEST: 'El proveedor no aceptó los parámetros de la solicitud (tamaño, calidad o imágenes).',
  TIMEOUT:
    'El proveedor no respondió a tiempo. La solicitud pudo haberse cobrado: revisa el uso de tu cuenta antes de repetirla.',
  RESPONSE_INVALID: 'La respuesta del proveedor no contenía una imagen válida.',
  PROVIDER_UNAVAILABLE: 'No se pudo conectar con el proveedor de imágenes.',
  PROVIDER_BUSY: 'Ya hay una solicitud en curso con el proveedor.',
  STORAGE_FAILED: 'No se pudo guardar la imagen generada.',
  REFERENCE_UNAVAILABLE: 'Uno de los recursos de marca seleccionados ya no está disponible.',
  INTERRUPTED: 'La generación se interrumpió al reiniciar el servidor.',
  INTERNAL: 'La generación falló por un error interno.',
};

const PROVIDER_FAILURE_CODES: Readonly<Record<ImageProviderError['code'], DesignGenerationErrorCode>> = {
  not_configured: 'NOT_CONFIGURED',
  missing_api_key: 'API_KEY_MISSING',
  model_unavailable: 'MODEL_UNAVAILABLE',
  not_authorized: 'ACCOUNT_NOT_AUTHORIZED',
  rate_limited: 'RATE_LIMITED',
  quota_exceeded: 'QUOTA_EXCEEDED',
  rejected: 'PROVIDER_REJECTED',
  invalid_request: 'INVALID_REQUEST',
  timeout: 'TIMEOUT',
  response_invalid: 'RESPONSE_INVALID',
  unavailable: 'PROVIDER_UNAVAILABLE',
  busy: 'PROVIDER_BUSY',
  aborted: 'INTERRUPTED',
};

/** A run failure with a closed code, raised inside the run. */
class RunFailure extends Error {
  constructor(
    readonly code: DesignGenerationErrorCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
  }
}

const POLICY_LABEL: Readonly<Record<BrandAssetUsagePolicy, string>> = {
  protected: 'Protegido',
  reference_only: 'Solo referencia',
  reusable: 'Reutilizable',
  transformable: 'Transformable',
};

const ROLE_LABEL: Readonly<Record<DesignReference['role'], string>> = {
  style_reference: 'referencia de estilo',
  transform_base: 'base de la transformación',
  reserved_placement: 'espacio reservado',
};

/** Longest prompt the Image API accepts. */
const MAX_PROVIDER_PROMPT = 32000;

interface Plan {
  readonly mode: DesignMode;
  readonly promptVersion: string;
  readonly model: ImageModel;
  readonly quality: string;
  readonly count: number;
  readonly size: ProposalSize;
  readonly references: readonly DesignReference[];
  readonly parent: ProposalRecord | null;
  readonly inheritedInstructions: string | null;
  readonly prompt: string;
  readonly estimate: DesignEstimate['cost'];
}

export interface DesignServiceDeps {
  readonly repository: DesignRepository;
  readonly files: BrandFileStore;
  readonly provider: ImageGenerationProvider;
  readonly brandAssets: BrandAssetService;
  readonly brandContext: () => BrandContext;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly newId?: () => string;
}

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/** The canonical hash of a request: what it asks for, without its key and confirmation. */
function requestHash(input: DesignGenerationInput): string {
  const canonical = {
    mode: input.mode ?? 'guided',
    contentType: input.contentType,
    format: input.format,
    model: input.model ?? null,
    quality: input.quality,
    count: input.count,
    style: input.style ?? null,
    instructions: input.instructions ?? null,
    references: input.references.map((reference) => [reference.assetId, reference.role]),
    parentProposalId: input.parentProposalId ?? null,
  };
  return sha256(Buffer.from(JSON.stringify(canonical)));
}

function startOfDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function joinInstructions(record: GenerationRecord): string | null {
  const parts = [record.inheritedInstructions, record.instructions].filter((part): part is string => part !== null);
  const text = parts.join('\n');
  return text === '' ? null : text.slice(0, MAX_DESIGN_INSTRUCTIONS);
}

/** A proposal as a visual template source (`templateSource`). */
export interface DesignTemplateSource {
  readonly proposal: DesignProposal;
  readonly deleted: boolean;
  readonly layers: readonly ProposalLayer[];
  readonly background: {
    readonly sha256: string;
    readonly mime: 'image/png' | 'image/jpeg';
    readonly width: number;
    readonly height: number;
  };
  readonly sentBrandImage: boolean;
}

export class DesignService {
  readonly #repository: DesignRepository;
  readonly #files: BrandFileStore;
  readonly #provider: ImageGenerationProvider;
  readonly #brandAssets: BrandAssetService;
  readonly #brandContext: () => BrandContext;
  readonly #clock: Clock;
  readonly #logger: Logger;
  readonly #newId: () => string;
  readonly #events = new EventEmitter();
  readonly #runs = new Map<string, Promise<void>>();

  constructor(deps: DesignServiceDeps) {
    this.#repository = deps.repository;
    this.#files = deps.files;
    this.#provider = deps.provider;
    this.#brandAssets = deps.brandAssets;
    this.#brandContext = deps.brandContext;
    this.#clock = deps.clock;
    this.#logger = deps.logger;
    this.#newId = deps.newId ?? randomUUID;
    this.#events.setMaxListeners(50);
  }

  #now(): string {
    return this.#clock.now().toISOString();
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Capabilities and limits
  // -----------------------------------------------------------------------------------------------------------------

  #usage(): { imagesUsedToday: number; spentThisMonth: number | null } {
    const now = this.#clock.now();
    const spend = this.#repository.spendSince(startOfMonth(now));
    return {
      imagesUsedToday: this.#repository.imagesSince(startOfDay(now)),
      spentThisMonth: spend.total === 0 && spend.unpriced > 0 ? null : roundAmount(spend.total),
    };
  }

  capabilities(): DesignCapabilities {
    const capabilities = this.#provider.capabilities();
    const usage = this.#usage();
    return {
      adapter: capabilities.adapter,
      status: capabilities.status,
      defaultModel: capabilities.defaultModel,
      models: capabilities.models.map((model) => ({
        id: model.id,
        label: model.label,
        flexibleSizes: model.flexibleSizes,
        qualities: [...model.qualities],
        pricing: model.pricing === null ? null : { ...model.pricing },
        estimable: model.pricing !== null && model.publishedImageCosts !== null,
      })),
      contentTypes: [...CONTENT_TYPES],
      formats: ['1:1', '4:5', '9:16'],
      policyRoles: (Object.keys(ROLES_BY_POLICY) as BrandAssetUsagePolicy[]).map((policy) => ({
        policy,
        roles: [...ROLES_BY_POLICY[policy]],
      })),
      limits: {
        maxImagesPerRequest: capabilities.limits.maxImagesPerRequest,
        maxReferences: capabilities.limits.maxReferences,
        maxImagesPerDay: capabilities.limits.maxImagesPerDay,
        imagesUsedToday: usage.imagesUsedToday,
        monthlySpendLimit: capabilities.limits.monthlySpendLimit,
        spentThisMonth: usage.spentThisMonth,
        maxConcurrentRequests: capabilities.limits.maxConcurrentRequests,
      },
      promptVersion: DESIGN_PROMPT_VERSION,
    };
  }

  /** Asks the provider whether the account can use a configured model (no image is generated, no cost). */
  async checkModelAccess(model: string): Promise<DesignModelAccess> {
    const capabilities = this.#provider.capabilities();
    if (capabilities.status === 'disabled') {
      return { model, access: 'disabled', errorCode: 'NOT_CONFIGURED' };
    }
    if (!capabilities.models.some((entry) => entry.id === model)) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'El modelo no está configurado en el servidor.');
    }
    if (capabilities.status === 'missing_api_key') {
      return { model, access: 'missing_api_key', errorCode: 'API_KEY_MISSING' };
    }
    try {
      const access = await this.#provider.checkModelAccess(model, AbortSignal.timeout(20_000));
      return {
        model,
        access,
        errorCode:
          access === 'available' ? null : access === 'unavailable' ? 'MODEL_UNAVAILABLE' : 'ACCOUNT_NOT_AUTHORIZED',
      };
    } catch (error) {
      const code = error instanceof ImageProviderError ? PROVIDER_FAILURE_CODES[error.code] : 'INTERNAL';
      return { model, access: 'error', errorCode: code };
    }
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Plan
  // -----------------------------------------------------------------------------------------------------------------

  #plan(input: DesignGenerationInput): Plan {
    const capabilities = this.#provider.capabilities();
    if (capabilities.status === 'disabled') {
      throw new HttpProblem(503, 'IMAGE_PROVIDER_UNAVAILABLE', FAILURES.NOT_CONFIGURED);
    }
    const modelId = input.model ?? capabilities.defaultModel;
    const model = capabilities.models.find((entry) => entry.id === modelId);
    if (model === undefined) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'El modelo no está configurado en el servidor.');
    }
    if (!model.qualities.includes(input.quality)) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'La calidad no está disponible para el modelo seleccionado.');
    }
    if (input.count > capabilities.limits.maxImagesPerRequest) {
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        `Puedes pedir como máximo ${String(capabilities.limits.maxImagesPerRequest)} propuestas por solicitud.`,
      );
    }
    if (input.references.length > capabilities.limits.maxReferences) {
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        `Puedes seleccionar como máximo ${String(capabilities.limits.maxReferences)} recursos de marca.`,
      );
    }

    const stored = input.parentProposalId === undefined ? null : this.#repository.proposal(input.parentProposalId);
    const parent = stored === null || stored.deletedAt !== null ? null : stored;
    if (input.parentProposalId !== undefined && parent === null) {
      throw new HttpProblem(404, 'NOT_FOUND', 'No se encontró la propuesta de origen.');
    }
    const parentGeneration = parent === null ? null : this.#repository.generation(parent.generationId);

    const library = new Map(this.#brandAssets.list().map((asset) => [asset.id, asset]));
    const seen = new Set<string>();
    const references: DesignReference[] = [];
    for (const selection of input.references) {
      if (seen.has(selection.assetId)) {
        throw new HttpProblem(400, 'VALIDATION_FAILED', 'Un recurso de marca está seleccionado más de una vez.');
      }
      seen.add(selection.assetId);
      const asset = library.get(selection.assetId);
      if (asset === undefined) {
        throw new HttpProblem(409, 'DESIGN_REFERENCE_REFUSED', 'Un recurso de marca seleccionado ya no existe.');
      }
      if (!asset.active) {
        throw new HttpProblem(
          409,
          'DESIGN_REFERENCE_REFUSED',
          `El recurso «${asset.label}» está desactivado; actívalo en Mi marca para usarlo.`,
        );
      }
      if (!allowsRole(asset.usagePolicy, selection.role)) {
        throw new HttpProblem(
          409,
          'DESIGN_REFERENCE_REFUSED',
          `La política «${POLICY_LABEL[asset.usagePolicy]}» de «${asset.label}» no permite usarlo como ${ROLE_LABEL[selection.role]}.`,
        );
      }
      references.push({
        assetId: asset.id,
        label: asset.label,
        kind: asset.kind,
        usagePolicy: asset.usagePolicy,
        role: selection.role,
        sent: sendsImage(selection.role),
      });
    }
    const groups = new Set<LayerGroup>();
    for (const reference of references.filter((entry) => entry.role === 'reserved_placement')) {
      const group = layerGroup(reference.kind);
      if (groups.has(group)) {
        throw new HttpProblem(
          400,
          'VALIDATION_FAILED',
          'Solo se puede colocar un original por zona: un logotipo, una mascota y un elemento gráfico.',
        );
      }
      groups.add(group);
    }
    const bases = references.filter((reference) => reference.role === 'transform_base');
    if (bases.length > 1 || (bases.length === 1 && parent !== null)) {
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'Solo una imagen puede ser la base: un recurso transformable o la propuesta de origen de una variante.',
      );
    }

    const mode: DesignMode = input.mode ?? 'guided';
    if (mode === 'own_prompt' && input.instructions === undefined) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'Escribe tu prompt: en el modo «Prompt propio» es obligatorio.');
    }
    if (mode === 'own_prompt' && input.style !== undefined) {
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'En el modo «Prompt propio» el estilo se escribe dentro de tu prompt.',
      );
    }
    const size = proposalSize(input.format, model.flexibleSizes);
    // A variant in the own prompt mode carries the whole prompt, already edited by the operator: nothing is inherited.
    const inheritedInstructions =
      parentGeneration === null || mode === 'own_prompt' ? null : joinInstructions(parentGeneration);
    const base = bases[0];
    const basePrompt =
      parent !== null
        ? ({ source: 'proposal' } as const)
        : base === undefined
          ? null
          : ({ source: 'asset', asset: base } as const);
    const placements = references.filter((reference) => reference.role === 'reserved_placement');
    const prompt =
      mode === 'own_prompt'
        ? buildOwnPrompt({
            prompt: input.instructions ?? '',
            base: basePrompt,
            images: references.filter((reference) => reference.role === 'style_reference'),
            placements,
          })
        : this.#guidedPrompt(input, size, basePrompt, references, placements, inheritedInstructions);
    if (prompt.length > MAX_PROVIDER_PROMPT) {
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'Las instrucciones son demasiado largas para el proveedor: acórtalas o usa una variante sin las instrucciones originales.',
      );
    }
    return {
      mode,
      promptVersion: mode === 'own_prompt' ? OWN_PROMPT_VERSION : DESIGN_PROMPT_VERSION,
      model,
      quality: input.quality,
      count: input.count,
      size,
      references,
      parent,
      inheritedInstructions,
      prompt,
      estimate: estimateCost(model, input.quality, size.requestWidth, size.requestHeight, input.count),
    };
  }

  #guidedPrompt(
    input: DesignGenerationInput,
    size: ProposalSize,
    base: Parameters<typeof buildDesignPrompt>[0]['base'],
    references: readonly DesignReference[],
    placements: readonly DesignReference[],
    inheritedInstructions: string | null,
  ): string {
    const context = this.#brandContext();
    return buildDesignPrompt({
      contentType: input.contentType,
      format: input.format,
      width: size.outputWidth,
      height: size.outputHeight,
      identity: context.identity,
      base,
      styleReferences: references.filter((reference) => reference.role === 'style_reference'),
      placements,
      style: input.style ?? null,
      instructions: input.instructions ?? null,
      inheritedInstructions,
    });
  }

  estimate(input: DesignGenerationInput): DesignEstimate {
    const plan = this.#plan(input);
    const limits = this.#provider.capabilities().limits;
    const usage = this.#usage();
    return {
      provider: 'openai',
      mode: plan.mode,
      model: plan.model.id,
      quality: plan.quality,
      count: plan.count,
      requestSize: plan.size.requestSize,
      outputWidth: plan.size.outputWidth,
      outputHeight: plan.size.outputHeight,
      adaptation: plan.size.adaptation,
      references: [...plan.references],
      prompt: plan.prompt,
      promptVersion: plan.promptVersion,
      cost: plan.estimate,
      imagesUsedToday: usage.imagesUsedToday,
      maxImagesPerDay: limits.maxImagesPerDay,
      spentThisMonth: usage.spentThisMonth,
      monthlySpendLimit: limits.monthlySpendLimit,
    };
  }

  #checkLimits(plan: Plan): void {
    const limits = this.#provider.capabilities().limits;
    if (this.#repository.runningCount() >= limits.maxConcurrentRequests) {
      throw new HttpProblem(
        429,
        'GENERATION_LIMIT_REACHED',
        'Ya hay una generación en curso. Espera a que termine antes de iniciar otra.',
      );
    }
    const usage = this.#usage();
    if (usage.imagesUsedToday + plan.count > limits.maxImagesPerDay) {
      throw new HttpProblem(
        429,
        'GENERATION_LIMIT_REACHED',
        `Se alcanzaría el límite diario de ${String(limits.maxImagesPerDay)} imágenes (llevas ${String(usage.imagesUsedToday)} hoy).`,
      );
    }
    if (limits.monthlySpendLimit !== null) {
      // Without prices the spend of the model is never computed, and the limit could not stop it.
      if (plan.model.pricing === null) {
        throw new HttpProblem(
          429,
          'GENERATION_LIMIT_REACHED',
          'Este modelo no tiene precios configurados: con un límite de gasto mensual no se puede usar.',
        );
      }
      // Spend that cannot be computed (generations without prices) is unknown, never zero.
      if (usage.spentThisMonth === null) {
        throw new HttpProblem(
          429,
          'GENERATION_LIMIT_REACHED',
          'No se puede calcular el gasto de este mes (hay generaciones sin precio): con un límite de gasto mensual no se puede generar.',
        );
      }
      const spent = usage.spentThisMonth;
      // The published estimate when there is one; otherwise the configured conservative reserve per image (PD-27). A
      // request whose cost can be neither estimated nor reserved is refused: the limit could not control it.
      const reserve = limits.spendReservePerImage?.[plan.quality];
      const expected = plan.estimate.total ?? (reserve === undefined ? null : reserve * plan.count);
      if (expected === null) {
        throw new HttpProblem(
          429,
          'GENERATION_LIMIT_REACHED',
          'No se puede estimar el costo de esta solicitud con suficiente confianza y no hay una reserva configurada para esta calidad: con un límite de gasto mensual no se puede generar.',
        );
      }
      if (spent >= limits.monthlySpendLimit || spent + expected > limits.monthlySpendLimit) {
        throw new HttpProblem(
          429,
          'GENERATION_LIMIT_REACHED',
          'Se alcanzaría el límite de gasto mensual configurado para la generación de imágenes.',
        );
      }
    }
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Generations
  // -----------------------------------------------------------------------------------------------------------------

  /** Starts a confirmed generation; a repeated request key returns the stored generation (`created: false`). */
  create(input: DesignGenerationCreate): { generation: DesignGeneration; created: boolean } {
    const { requestKey, confirmCost: _confirmed, ...request } = input;
    const hash = requestHash(request);
    const existing = this.#repository.generationByKey(requestKey);
    if (existing !== null) {
      if (existing.requestHash !== hash) {
        throw new HttpProblem(409, 'REQUEST_KEY_REUSED', 'La clave de solicitud ya se usó para otra generación.');
      }
      return { generation: this.#view(existing), created: false };
    }
    const capabilities = this.#provider.capabilities();
    if (capabilities.status === 'missing_api_key') {
      throw new HttpProblem(503, 'IMAGE_PROVIDER_UNAVAILABLE', FAILURES.API_KEY_MISSING);
    }
    const plan = this.#plan(request);
    this.#checkLimits(plan);
    const id = this.#newId();
    const now = this.#now();
    this.#repository.insertGeneration({
      id,
      requestKey,
      requestHash: hash,
      mode: plan.mode,
      parentProposalId: plan.parent?.id ?? null,
      contentType: request.contentType,
      format: request.format,
      style: request.style ?? null,
      instructions: request.instructions ?? null,
      inheritedInstructions: plan.inheritedInstructions,
      quality: plan.quality,
      requestedCount: plan.count,
      provider: capabilities.adapter,
      model: plan.model.id,
      requestSize: plan.size.requestSize,
      outputWidth: plan.size.outputWidth,
      outputHeight: plan.size.outputHeight,
      adaptation: plan.size.adaptation,
      promptVersion: plan.promptVersion,
      prompt: plan.prompt,
      references: plan.references,
      estimate: plan.estimate,
      createdAt: now,
    });
    this.#logger.info(
      {
        generationId: id,
        model: plan.model.id,
        quality: plan.quality,
        count: plan.count,
        references: plan.references.length,
      },
      'design generation queued',
    );
    const run = new Promise<void>((resolve) => {
      queueMicrotask(() => {
        void this.#run(id).finally(resolve);
      });
    });
    this.#runs.set(id, run);
    void run.finally(() => this.#runs.delete(id));
    return { generation: this.generation(id), created: true };
  }

  /** Resolves when a running generation has stopped (tests and shutdown). */
  async settled(id: string): Promise<void> {
    await this.#runs.get(id);
  }

  #record(id: string): GenerationRecord {
    const record = this.#repository.generation(id);
    if (record === null) {
      throw new HttpProblem(404, 'NOT_FOUND', 'No se encontró la generación.');
    }
    return record;
  }

  #view(record: GenerationRecord): DesignGeneration {
    return {
      id: record.id,
      mode: record.mode,
      status: record.status,
      contentType: record.contentType,
      format: record.format,
      model: record.model,
      quality: record.quality,
      requestedCount: record.requestedCount,
      completedCount: record.completedCount,
      currentIndex: record.currentIndex,
      parentProposalId: record.parentProposalId,
      proposalIds: this.#repository.proposalsOf(record.id).map((proposal) => proposal.id),
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      retryAfterSeconds: record.retryAfterSeconds,
      cost: record.cost,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt,
    };
  }

  generation(id: string): DesignGeneration {
    return this.#view(this.#record(id));
  }

  eventsSince(id: string, after: number): DesignGenerationEvent[] {
    this.#record(id);
    return this.#repository.eventsSince(id, after).map((event) => ({
      id: event.sequence,
      type: event.eventType,
      generationId: event.generationId,
      status: event.status,
      imageIndex: event.imageIndex,
      proposalId: event.proposalId,
      timestamp: event.createdAt,
    }));
  }

  subscribe(id: string, listener: () => void): () => void {
    if (this.#events.listenerCount(id) >= 5) {
      throw new HttpProblem(429, 'GENERATION_LIMIT_REACHED', 'Hay demasiadas conexiones de progreso abiertas.');
    }
    this.#events.on(id, listener);
    return () => this.#events.off(id, listener);
  }

  #progress(id: string, change: Parameters<DesignRepository['progress']>[1]): void {
    if (this.#repository.progress(id, change, this.#now())) {
      this.#logger.info(
        { generationId: id, status: change.status, imageIndex: change.currentIndex ?? null, event: change.eventType },
        'design generation transition',
      );
      this.#events.emit(id);
    }
  }

  /** Marks the generations left running by a previous process as failed (startup). */
  recoverInterrupted(): number {
    const unfinished = this.#repository.unfinishedGenerations();
    for (const record of unfinished) {
      this.#progress(record.id, {
        status: 'failed',
        eventType: 'generation.failed',
        errorCode: 'INTERRUPTED',
        errorMessage: FAILURES.INTERRUPTED,
      });
    }
    return unfinished.length;
  }

  async #inputs(record: GenerationRecord): Promise<ImageInput[]> {
    const inputs: ImageInput[] = [];
    if (record.parentProposalId !== null) {
      // The generated background, never the composed preview: the original layers are not sent to the provider.
      const { mime, content } = await this.readFile(record.parentProposalId, 'background').catch(() => {
        throw new RunFailure('REFERENCE_UNAVAILABLE');
      });
      inputs.push({ mime, content });
    }
    const ordered = [
      ...record.references.filter((reference) => reference.role === 'transform_base'),
      ...record.references.filter((reference) => reference.role === 'style_reference'),
    ];
    for (const reference of ordered) {
      let file;
      try {
        file = await this.#brandAssets.readFile(reference.assetId);
      } catch {
        throw new RunFailure('REFERENCE_UNAVAILABLE');
      }
      if (!file.asset.active || !allowsRole(file.asset.usagePolicy, reference.role)) {
        throw new RunFailure('REFERENCE_UNAVAILABLE');
      }
      inputs.push({ mime: file.asset.mime, content: file.content });
    }
    const characters = inputs.reduce((total, input) => total + Math.ceil(input.content.length / 3) * 4 + 64, 0);
    if (characters + record.prompt.length > IMAGE_EGRESS_LIMITS.maxRequestBodyCharacters - BODY_MARGIN_CHARACTERS) {
      throw new RunFailure('INVALID_REQUEST');
    }
    return inputs;
  }

  /** The original files of the reserved placements, checked again, with their zones. */
  async #layers(record: GenerationRecord): Promise<{ images: LayerImage[]; layers: ProposalLayer[] }> {
    const images: LayerImage[] = [];
    const layers: ProposalLayer[] = [];
    for (const reference of record.references.filter((entry) => entry.role === 'reserved_placement')) {
      let file;
      try {
        file = await this.#brandAssets.readFile(reference.assetId);
      } catch {
        throw new RunFailure('REFERENCE_UNAVAILABLE');
      }
      const { asset } = file;
      if (!asset.active || !allowsRole(asset.usagePolicy, 'reserved_placement') || asset.mime === 'image/webp') {
        throw new RunFailure('REFERENCE_UNAVAILABLE');
      }
      const box = zoneBox(layerGroup(asset.kind), record.outputWidth, record.outputHeight);
      images.push({ mime: asset.mime, content: file.content, box });
      layers.push({ assetId: asset.id, label: asset.label, kind: asset.kind, ...box });
    }
    return { images, layers };
  }

  async #run(id: string): Promise<void> {
    const started = performance.now();
    try {
      const record = this.#record(id);
      this.#progress(id, { status: 'preparing_references', currentIndex: 1, eventType: 'generation.started' });
      const images = await this.#inputs(record);
      const placed = await this.#layers(record);
      const model = this.#provider.capabilities().models.find((entry) => entry.id === record.model) ?? null;
      let usage: ImageUsage | null = null;
      let cost: number | null = null;
      let priced = true;
      for (let index = 1; index <= record.requestedCount; index += 1) {
        this.#progress(id, { status: 'sending_request', currentIndex: index, eventType: 'image.requested' });
        const request = {
          model: record.model,
          prompt: record.prompt,
          size: record.requestSize,
          quality: record.quality,
          images,
          signal: AbortSignal.timeout(IMAGE_EGRESS_LIMITS.maxTimeoutMs + 5_000),
        };
        this.#progress(id, { status: 'generating', currentIndex: index, eventType: 'image.generating' });
        const generated = await this.#provider.generate(request);
        this.#progress(id, { status: 'saving', currentIndex: index, eventType: 'image.received' });

        let fitted;
        let composed;
        try {
          fitted = await fitToSize(
            await checkGeneratedImage(generated.content),
            record.outputWidth,
            record.outputHeight,
          );
          composed = await composeLayers(fitted, placed.images);
        } catch (error) {
          throw error instanceof GeneratedImageError ? new RunFailure('RESPONSE_INVALID') : error;
        }
        const proposalId = this.#newId();
        const backgroundId = placed.images.length === 0 ? null : this.#newId();
        let filePath: string;
        let backgroundPath: string | null = null;
        try {
          if (backgroundId !== null) {
            backgroundPath = await this.#files.create(backgroundId, fitted.mime, fitted.content);
          }
          filePath = await this.#files.create(proposalId, composed.mime, composed.content);
        } catch {
          throw new RunFailure('STORAGE_FAILED');
        }
        const imageCost = model === null ? null : computedCost(model, generated.usage);
        usage = addUsage(usage, generated.usage);
        priced = priced && imageCost !== null;
        cost = priced && imageCost !== null ? roundAmount((cost ?? 0) + imageCost) : null;
        const now = this.#now();
        this.#repository.insertProposal(
          {
            id: proposalId,
            generationId: id,
            sequence: index,
            name: `${record.parentProposalId === null ? '' : 'Variante · '}${CONTENT_LABEL[record.contentType]} · ${record.format} · ${String(index)}/${String(record.requestedCount)}`,
            contentType: record.contentType,
            format: record.format,
            width: composed.width,
            height: composed.height,
            mime: composed.mime,
            filePath,
            sha256: sha256(composed.content),
            byteSize: composed.content.length,
            usage: generated.usage,
            cost: imageCost,
            status: 'pending_review',
            decisionNote: null,
            decidedAt: null,
            createdAt: now,
            backgroundFilePath: backgroundPath,
            backgroundSha256: backgroundPath === null ? null : sha256(fitted.content),
            layers: placed.layers,
            deletedAt: null,
          },
          usage,
          cost,
          now,
        );
        this.#progress(id, { status: 'saving', currentIndex: index, eventType: 'proposal.saved', proposalId });
      }
      this.#progress(id, { status: 'completed', eventType: 'generation.completed' });
      this.#logger.info(
        {
          generationId: id,
          durationMs: Math.round(performance.now() - started),
          cost,
          tokens: usage?.totalTokens ?? null,
        },
        'design generation completed',
      );
    } catch (error) {
      const failure =
        error instanceof RunFailure
          ? error
          : error instanceof ImageProviderError
            ? new RunFailure(PROVIDER_FAILURE_CODES[error.code], error.retryAfterSeconds)
            : error instanceof BrandFileError || error instanceof BrandFileIntegrityError
              ? new RunFailure('STORAGE_FAILED')
              : new RunFailure('INTERNAL');
      this.#logger.error(
        {
          generationId: id,
          code: failure.code,
          httpStatus: error instanceof ImageProviderError ? error.httpStatus : null,
          errorName: error instanceof Error ? error.name : 'Unknown',
          durationMs: Math.round(performance.now() - started),
        },
        'design generation failed',
      );
      try {
        this.#progress(id, {
          status: 'failed',
          eventType: 'generation.failed',
          errorCode: failure.code,
          errorMessage: FAILURES[failure.code],
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      } catch {
        // The database closed during the run (shutdown): the next startup marks the generation INTERRUPTED.
      }
    }
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Proposals
  // -----------------------------------------------------------------------------------------------------------------

  #proposal(id: string): ProposalRecord {
    const record = this.#repository.proposal(id);
    if (record === null || record.deletedAt !== null) {
      throw new HttpProblem(404, 'NOT_FOUND', 'No se encontró la propuesta.');
    }
    return record;
  }

  #proposalView(record: ProposalRecord, generation: GenerationRecord): DesignProposal {
    return {
      id: record.id,
      generationId: record.generationId,
      mode: generation.mode,
      name: record.name,
      contentType: record.contentType,
      format: record.format,
      width: record.width,
      height: record.height,
      mime: record.mime,
      status: record.status,
      model: generation.model,
      quality: generation.quality,
      parentProposalId: generation.parentProposalId,
      references: [...generation.references],
      decisionNote: record.decisionNote,
      decidedAt: record.decidedAt,
      createdAt: record.createdAt,
    };
  }

  proposals(): DesignProposal[] {
    const generations = new Map<string, GenerationRecord>();
    return this.#repository.proposals().map((record) => {
      let generation = generations.get(record.generationId);
      if (generation === undefined) {
        generation = this.#record(record.generationId);
        generations.set(generation.id, generation);
      }
      return this.#proposalView(record, generation);
    });
  }

  /**
   * What a visual template needs from a proposal (PD-ARCH-01G-C): its view, whether it was deleted, its original layers
   * with their pixel boxes, the hash, type and size of its clean background (the generated bitmap; the file itself when
   * no original layer was drawn), and whether a logo or the mascot was sent to the provider as an image. Null for an
   * unknown proposal. Nothing is changed.
   */
  templateSource(id: string): DesignTemplateSource | null {
    const record = this.#repository.proposal(id);
    if (record === null) {
      return null;
    }
    const generation = this.#record(record.generationId);
    const path = record.backgroundFilePath ?? record.filePath;
    return {
      proposal: this.#proposalView(record, generation),
      deleted: record.deletedAt !== null,
      layers: record.layers.map((layer) => ({ ...layer })),
      background: {
        sha256: record.backgroundSha256 ?? record.sha256,
        mime: path.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
        width: record.width,
        height: record.height,
      },
      sentBrandImage: generation.references.some(
        (reference) => reference.sent && (reference.kind === 'brand_logo' || reference.kind === 'mascot'),
      ),
    };
  }

  proposalDetail(id: string): DesignProposalDetail {
    const record = this.#proposal(id);
    const generation = this.#record(record.generationId);
    return {
      proposal: this.#proposalView(record, generation),
      generation: {
        id: generation.id,
        mode: generation.mode,
        style: generation.style,
        instructions: generation.instructions,
        inheritedInstructions: generation.inheritedInstructions,
        requestSize: generation.requestSize,
        adaptation: generation.adaptation,
        prompt: generation.prompt,
        promptVersion: generation.promptVersion,
        estimate: generation.estimate,
        requestedCount: generation.requestedCount,
        createdAt: generation.createdAt,
      },
      usage: record.usage,
      cost: record.cost,
      decisions: this.#repository
        .decisionsOf(id)
        .map((decision) => ({ decision: decision.decision, note: decision.note, decidedAt: decision.createdAt })),
      variantIds: this.#repository.variantsOf(id),
      layers: record.layers.map((layer) => ({ ...layer })),
      hasBackground: record.backgroundFilePath !== null,
    };
  }

  /**
   * Discards a proposal: it leaves the library and can no longer be reviewed or used for a variant. The row, its
   * decisions and its files are kept (logical deletion, OD-08). Refused while a variant of it is being generated or
   * while a visual template uses it (PD-ARCH-01G-C).
   */
  delete(id: string): void {
    const record = this.#proposal(id);
    if (this.#repository.runningVariantsOf(record.id) > 0) {
      throw new HttpProblem(409, 'RUN_IN_PROGRESS', 'Hay una variante de esta propuesta en generación.');
    }
    const templates = this.#repository.templatesUsing(record.id);
    if (templates > 0) {
      throw new HttpProblem(
        409,
        'PROPOSAL_IN_USE',
        `La propuesta es la base de ${String(templates)} plantilla(s) visual(es); no se puede eliminar.`,
      );
    }
    this.#repository.markDeleted(record.id, this.#now());
    this.#logger.info({ proposalId: id }, 'design proposal deleted');
  }

  /** Records a review decision; it changes nothing outside the proposal (no template, no brand asset). */
  decide(id: string, input: DesignProposalDecisionInput): DesignProposal {
    const record = this.#proposal(id);
    if (input.decision === 'changes_requested' && input.note === undefined) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'Indica qué cambios necesita la propuesta.');
    }
    this.#repository.decide(id, input.decision, input.note ?? null, this.#now());
    this.#logger.info({ proposalId: id, decision: input.decision }, 'design proposal reviewed');
    return this.#proposalView(this.#proposal(record.id), this.#record(record.generationId));
  }

  /**
   * The bytes of a proposal, read from their confined path and checked against the recorded hash: the composed preview
   * (`preview`), or the generated bitmap (`background`; the same file when no original layer was drawn).
   */
  async readFile(
    id: string,
    which: 'preview' | 'background' = 'preview',
  ): Promise<{ proposal: ProposalRecord; mime: ProposalRecord['mime']; content: Buffer }> {
    const proposal = this.#proposal(id);
    const background = which === 'background' && proposal.backgroundFilePath !== null;
    const path = background ? proposal.backgroundFilePath : proposal.filePath;
    const expected = background ? proposal.backgroundSha256 : proposal.sha256;
    const match = /^design-proposals\/([0-9a-f-]{36})\.(png|jpg)$/.exec(path ?? '');
    const fileId = match?.[1];
    const mime = match?.[2] === 'jpg' ? 'image/jpeg' : 'image/png';
    if (fileId === undefined || path !== this.#files.relativePath(fileId, mime)) {
      throw new BrandFileIntegrityError();
    }
    const content = await this.#files.read(fileId, mime);
    if (sha256(content) !== expected) {
      throw new BrandFileIntegrityError();
    }
    return { proposal, mime, content };
  }
}
