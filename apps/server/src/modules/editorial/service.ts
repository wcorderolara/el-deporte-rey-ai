/**
 * Editorial copy service (PD-ARCH-01H): the package view of a project, generations and regenerations through the
 * editorial writer, operator edits, and the approval of each deliverable bound to its exact version.
 *
 * Generation (`generate`):
 * - The context is the project's active draft: its facts (the content stage's own read), the project's local round
 *   when it was generated from a local competition, and the deterministic events and evidence (`core.ts`). Without a
 *   draft or without any confirmed match nothing is sent (`EDITORIAL_NOT_GENERATABLE`).
 * - Idempotency: the client's `requestKey` (UNIQUE). The same key with the same request returns the stored
 *   generation; with another request it is `REQUEST_KEY_REUSED`.
 * - Cost controls (PD-30): a billed (hosted) writer needs `confirmCost: true`, a key, prices and a monthly limit;
 *   one generation at a time; a daily count and the monthly spend (computed cost, else the conservative estimate) are
 *   checked before the request; the writer never retries. A failure is recorded with its closed code and the usage
 *   the provider reported, and the operator decides whether to try again.
 * - Versions: each requested deliverable gets a new version (origin `generated`, or `regenerated` when it had one);
 *   the previous version is superseded, never deleted, and keeps its approval time as history. The other deliverables
 *   keep their versions and approvals. The operator's instruction is stored with the generation and its versions.
 *
 * Edits and approvals: an edit is a new version (origin `edited`) of the current one, checked like the writer's
 * text. Approval needs the current version, no flags and every referenced fact publishable (the same rule as the
 * slides, `blockingFactRefs`); withdrawal clears it.
 */
import { createHash, randomUUID } from 'node:crypto';

import {
  EDITORIAL_DELIVERABLES,
  EDITORIAL_DELIVERABLE_FIELDS,
  type EditorialDeliverable,
  type EditorialEditCreate,
  type EditorialFieldName,
  type EditorialGeneration,
  type EditorialGenerationCreate,
  type EditorialGenerationErrorCode,
  type EditorialGenerationResult,
  type EditorialPackage,
  type EditorialVersion,
  type EditorialWriter,
  LanguageSchema,
} from '@edr/contracts';
import { z } from 'zod';

import type { AppContainer } from '../../container.js';
import { HttpProblem } from '../../platform/http/index.js';
import {
  AiProviderError,
  EDITORIAL_PROMPT_VERSION,
  EditorialWriteError,
  type EditorialRequest,
  type EditorialWriterDescription,
  buildEditorialPrompt,
} from '../../providers/ai/index.js';
import {
  ContentInputSchema,
  ContentFactSchema,
  blockingFactRefs,
  buildContentInput,
  draftContextOf,
} from '../content/index.js';
import { ContentBatchRepository } from '../projects/content-batches/repository.js';
import { projectSportsContext } from '../projects/content-batches/service.js';

import { type ComposedVersion, composeDeliverable, rawDeliverables, rawOfEdit } from './compose.js';
import {
  type EditorialCore,
  type EditorialInput,
  type LocalRoundCounts,
  buildEditorialCore,
  buildEditorialRequest,
} from './core.js';
import { computedCost, estimateCost, utcDayStart, utcMonthStart } from './cost.js';
import { type GenerationRecord, EditorialRepository, type VersionRecord } from './repository.js';
import { type EditorialResearch, localContextResearch } from './research.js';

/** Safety deadline of one writer request, above the adapter's own (at most 120 s). */
const WRITE_DEADLINE_MS = 130_000;

const FAILURE_TEXT: Readonly<Record<EditorialGenerationErrorCode, string>> = {
  unavailable: 'El proveedor de IA no respondió. No se reintentó: puedes volver a intentarlo.',
  rate_limited: 'El proveedor de IA limitó las solicitudes. Espera un momento antes de volver a intentarlo.',
  timeout: 'El proveedor de IA no respondió a tiempo. No se reintentó: puedes volver a intentarlo.',
  ai_response_invalid: 'La respuesta del proveedor de IA no cumplió el contrato y se descartó. Puedes regenerar.',
  interrupted: 'La generación se interrumpió al reiniciar el servidor.',
};

const SOURCE_NAMES = {
  es: { local: 'Datos locales de la competición', project: 'Fuente deportiva del proyecto' },
  en: { local: 'Local competition data', project: 'Sports source of the project' },
} as const;

interface Loaded {
  readonly projectId: string;
  readonly draftId: string | null;
  readonly input: EditorialInput | null;
  readonly core: EditorialCore | null;
}

export interface EditorialServiceOptions {
  readonly newId?: () => string;
  /** The research port (PD-ARCH-01H: the local context only, DE-2). */
  readonly research?: EditorialResearch;
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function codeOf(error: unknown): EditorialGenerationErrorCode {
  if (error instanceof AiProviderError) {
    return error.code === 'invalid' ? 'unavailable' : error.code;
  }
  return 'unavailable';
}

export class EditorialService {
  readonly #container: Pick<AppContainer, 'db' | 'config' | 'clock' | 'logger' | 'editorialWriter'>;
  readonly #repository: EditorialRepository;
  readonly #newId: () => string;
  readonly #research: EditorialResearch;
  #running = false;

  constructor(
    container: Pick<AppContainer, 'db' | 'config' | 'clock' | 'logger' | 'editorialWriter'>,
    options: EditorialServiceOptions = {},
  ) {
    this.#container = container;
    this.#repository = new EditorialRepository(container.db);
    this.#newId = options.newId ?? randomUUID;
    this.#research = options.research ?? localContextResearch;
  }

  #now(): string {
    return this.#container.clock.now().toISOString();
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Context
  // -----------------------------------------------------------------------------------------------------------------

  #load(projectId: string): Loaded {
    const project = this.#repository.project(projectId);
    if (project === null) {
      throw new HttpProblem(404, 'NOT_FOUND', 'No se encontró el proyecto.');
    }
    const draft = this.#repository.activeDraft(projectId);
    if (draft === null) {
      return { projectId, draftId: null, input: null, core: null };
    }
    const { db, config } = this.#container;
    const content = ContentInputSchema.parse(
      buildContentInput(
        { db, config },
        {
          projectId,
          runId: draft.factsRunId,
          factsRunId: draft.factsRunId,
          language: LanguageSchema.parse(draft.language),
          excludedMatchKeys: draft.excludedMatchKeys,
          maxSlidesPerCarousel: 100,
          standingsRowsPerSlide: 100,
        },
      ),
    );
    const sports = projectSportsContext(new ContentBatchRepository(db), projectId)?.context ?? null;
    let localRound: LocalRoundCounts | null = null;
    if (sports !== null) {
      const counts = this.#repository.roundCounts(sports.roundId);
      const count = (status: string): number => counts.get(status) ?? 0;
      localRound = {
        total: [...counts.values()].reduce((sum, value) => sum + value, 0),
        finished: count('finished'),
        inProgress: count('in_progress'),
        scheduled: count('scheduled'),
        postponed: count('postponed'),
        cancelled: count('cancelled'),
      };
    }
    const language = content.language;
    const input: EditorialInput = {
      projectId,
      draft: { id: draft.id, createdAt: draft.createdAt, excludedMatchKeys: draft.excludedMatchKeys },
      language,
      contentKind: content.contentKind,
      draftContext: draftContextOf(content),
      facts: z.array(ContentFactSchema).parse(content.facts),
      teamAliases: content.teamAliases,
      standings: content.standings,
      local:
        sports === null
          ? null
          : {
              competitionId: sports.competitionId,
              seasonId: sports.seasonId,
              roundId: sports.roundId,
              roundName: sports.roundName,
            },
      localRound,
      sourceName: SOURCE_NAMES[language][sports === null ? 'project' : 'local'],
    };
    return { projectId, draftId: draft.id, input, core: buildEditorialCore(input) };
  }

  #request(
    loaded: Loaded,
    deliverables: readonly EditorialDeliverable[],
    instructions: string | null,
  ): EditorialRequest {
    if (loaded.core === null || loaded.input === null) {
      throw new HttpProblem(409, 'EDITORIAL_NOT_GENERATABLE', 'El proyecto todavía no tiene un borrador de contenido.');
    }
    if (loaded.core.confirmed.length === 0) {
      throw new HttpProblem(
        409,
        'EDITORIAL_NOT_GENERATABLE',
        'Ningún partido del borrador tiene datos confirmados: no se puede escribir copy sin hechos confirmados.',
      );
    }
    return buildEditorialRequest(loaded.core, loaded.input, deliverables, instructions);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Views
  // -----------------------------------------------------------------------------------------------------------------

  #writerView(writer: EditorialWriterDescription, request: EditorialRequest | null): EditorialWriter {
    const now = this.#container.clock.now();
    const spend = writer.billed ? this.#repository.spendSince(utcMonthStart(now)) : null;
    let estimate: EditorialWriter['estimate'] = { status: 'free', total: null };
    if (writer.billed) {
      const prompt = request === null ? null : buildEditorialPrompt(request);
      const total =
        prompt === null ? null : estimateCost(writer, Buffer.byteLength(prompt.system + prompt.user, 'utf8'));
      estimate = total === null ? { status: 'unavailable', total: null } : { status: 'estimated', total };
    }
    return {
      adapter: writer.adapter,
      kind: writer.kind,
      model: writer.model,
      status: writer.ready ? 'ready' : 'missing_api_key',
      requiresCostConfirmation: writer.billed,
      pricing: writer.pricing === null ? null : { ...writer.pricing },
      maxGenerationsPerDay: writer.limits.maxGenerationsPerDay,
      generationsToday: this.#repository.countSince(utcDayStart(now)),
      monthlySpendLimit: writer.limits.monthlySpendLimit,
      spentThisMonth: spend === null ? null : spend.total,
      estimate,
    };
  }

  #versionView(version: VersionRecord): EditorialVersion {
    return {
      id: version.id,
      deliverable: version.deliverable,
      versionNumber: version.versionNumber,
      origin: version.origin,
      state:
        version.supersededAt !== null
          ? 'superseded'
          : version.approvedAt !== null
            ? 'approved'
            : version.flags.length > 0
              ? 'flagged'
              : 'ready',
      fields: version.fields,
      flags: version.flags,
      generationId: version.generationId,
      instructions: version.instructions,
      eventIds: version.eventIds.slice(0, 40),
      evidenceIds: version.evidenceIds.slice(0, 400),
      createdAt: version.createdAt,
      approvedAt: version.approvedAt,
    };
  }

  #generationView(record: GenerationRecord): EditorialGeneration {
    return {
      id: record.id,
      status: record.status,
      deliverables: [...record.deliverables],
      instructions: record.instructions,
      adapter: record.adapter,
      writerKind: record.writerKind,
      model: record.model,
      promptVersion: record.promptVersion,
      researchMode: record.researchMode,
      errorCode: record.errorCode,
      errorMessage: record.errorCode === null ? null : FAILURE_TEXT[record.errorCode],
      estimatedCost: record.billed ? record.estimatedCost : null,
      computedCost: record.billed ? record.computedCost : null,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    };
  }

  #packageOf(loaded: Loaded): EditorialPackage {
    const { core } = loaded;
    const writer = this.#container.editorialWriter.describe();
    const request =
      core !== null && loaded.input !== null && core.confirmed.length > 0
        ? buildEditorialRequest(core, loaded.input, EDITORIAL_DELIVERABLES, null)
        : null;
    const current = new Map(
      (loaded.draftId === null ? [] : this.#repository.currentVersions(loaded.draftId)).map((version) => [
        version.deliverable,
        version,
      ]),
    );
    const counts =
      loaded.draftId === null
        ? new Map<EditorialDeliverable, number>()
        : this.#repository.versionCounts(loaded.draftId);
    const latest = this.#repository.latestGeneration(loaded.projectId);
    return {
      projectId: loaded.projectId,
      draftId: loaded.draftId,
      available: core !== null && core.confirmed.length > 0,
      unavailableReason: core === null ? 'no_draft' : core.confirmed.length === 0 ? 'no_confirmed_facts' : null,
      context: core?.context ?? null,
      research: {
        mode: this.#research.mode,
        retrievedAt: core?.retrievedAt ?? null,
        keyEvents: core === null ? [] : core.keyEvents.slice(0, 40),
        evidence: core === null ? [] : core.evidence.slice(0, 400),
        unverified: core === null ? [] : core.unverified.slice(0, 400),
        conflicts: core === null ? [] : core.conflicts.slice(0, 400),
      },
      writer: this.#writerView(writer, request),
      deliverables:
        loaded.draftId === null
          ? []
          : EDITORIAL_DELIVERABLES.map((deliverable) => {
              const version = current.get(deliverable);
              return {
                deliverable,
                current: version === undefined ? null : this.#versionView(version),
                versionCount: counts.get(deliverable) ?? 0,
              };
            }),
      lastGeneration: latest === null ? null : this.#generationView(latest),
    };
  }

  /** The editorial package of a project's active draft. */
  package(projectId: string): EditorialPackage {
    return this.#packageOf(this.#load(projectId));
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Generations
  // -----------------------------------------------------------------------------------------------------------------

  #checkLimits(writer: EditorialWriterDescription, estimate: number | null): void {
    if (this.#running || this.#repository.runningCount() >= writer.limits.maxConcurrentGenerations) {
      throw new HttpProblem(
        429,
        'GENERATION_LIMIT_REACHED',
        'Ya hay una generación de copy en curso. Espera a que termine.',
      );
    }
    const now = this.#container.clock.now();
    const today = this.#repository.countSince(utcDayStart(now));
    if (today >= writer.limits.maxGenerationsPerDay) {
      throw new HttpProblem(
        429,
        'GENERATION_LIMIT_REACHED',
        `Se alcanzó el límite diario de ${String(writer.limits.maxGenerationsPerDay)} generaciones de copy.`,
      );
    }
    if (!writer.billed) {
      return;
    }
    const limit = writer.limits.monthlySpendLimit;
    if (limit === null || writer.pricing === null || estimate === null) {
      // A billed writer without a limit, prices or an estimate could not be controlled (PD-30).
      throw new HttpProblem(
        429,
        'GENERATION_LIMIT_REACHED',
        'No se puede estimar el costo con los precios y el límite configurados: no se genera.',
      );
    }
    const spend = this.#repository.spendSince(utcMonthStart(now));
    if (spend.total >= limit || spend.total + estimate > limit) {
      throw new HttpProblem(
        429,
        'GENERATION_LIMIT_REACHED',
        'Se alcanzaría el límite de gasto mensual del copy editorial.',
      );
    }
  }

  /** Generates all five deliverables, or regenerates one, with the operator's optional instruction. */
  async generate(projectId: string, input: EditorialGenerationCreate): Promise<EditorialGenerationResult> {
    const deliverables: EditorialDeliverable[] =
      input.deliverable === undefined ? [...EDITORIAL_DELIVERABLES] : [input.deliverable];
    const instructions = input.instructions ?? null;
    const hash = requestHash({ projectId, deliverables, instructions });
    const existing = this.#repository.generationByKey(input.requestKey);
    if (existing !== null) {
      if (existing.requestHash !== hash) {
        throw new HttpProblem(409, 'REQUEST_KEY_REUSED', 'La clave de solicitud ya se usó para otra generación.');
      }
      return { generation: this.#generationView(existing), package: this.package(projectId) };
    }

    const loaded = this.#load(projectId);
    const request = this.#request(loaded, deliverables, instructions);
    const core = loaded.core as EditorialCore;
    const draftId = loaded.draftId as string;
    const writer = this.#container.editorialWriter;
    const description = writer.describe();
    if (!description.ready) {
      throw new HttpProblem(
        503,
        'AI_PROVIDER_UNAVAILABLE',
        'Falta la clave del proveedor de IA de texto (EDR_AI_API_KEY).',
      );
    }
    if (description.billed && input.confirmCost !== true) {
      throw new HttpProblem(
        409,
        'COST_CONFIRMATION_REQUIRED',
        'Esta generación tiene costo: confírmalo para continuar.',
      );
    }
    const prompt = buildEditorialPrompt(request);
    const estimate = estimateCost(description, Buffer.byteLength(prompt.system + prompt.user, 'utf8'));
    this.#checkLimits(description, estimate);

    const id = this.#newId();
    this.#running = true;
    try {
      this.#repository.insertGeneration({
        id,
        projectId,
        draftId,
        requestKey: input.requestKey,
        requestHash: hash,
        deliverables,
        instructions,
        adapter: description.adapter,
        writerKind: description.kind,
        model: description.model,
        promptVersion: EDITORIAL_PROMPT_VERSION,
        researchMode: this.#research.mode,
        billed: description.billed,
        estimatedCost: description.billed ? estimate : null,
        createdAt: this.#now(),
        context: {
          writer: { model: description.model, reasoningEffort: description.reasoningEffort },
          context: core.context,
          keyEvents: core.keyEvents,
          evidence: core.evidence,
          unverified: core.unverified,
          conflicts: core.conflicts,
          request,
        },
      });
      this.#container.logger.info(
        {
          generationId: id,
          adapter: description.adapter,
          model: description.model,
          reasoningEffort: description.reasoningEffort,
          deliverables,
          billed: description.billed,
          estimatedCost: estimate,
        },
        'editorial generation started',
      );

      let result;
      try {
        const signal = AbortSignal.timeout(WRITE_DEADLINE_MS);
        // PD-ARCH-01H has no external research (DE-2): evidence beyond the local data would need its own decision.
        const external = await this.#research.collect(core, signal);
        if (external.length > 0) {
          throw new Error('external research evidence is not supported by the editorial request of PD-ARCH-01H');
        }
        result = await writer.write(request, { signal });
      } catch (error) {
        const code = codeOf(error);
        const usage = error instanceof EditorialWriteError ? error.usage : null;
        this.#repository.failGeneration(
          id,
          code,
          {
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            computedCost: description.billed ? computedCost(description, usage) : null,
          },
          this.#now(),
        );
        this.#container.logger.warn({ generationId: id, code }, 'editorial generation failed');
        if (!(error instanceof AiProviderError)) {
          throw error;
        }
        throw new HttpProblem(502, 'PROVIDER_FAILED', FAILURE_TEXT[code]);
      }

      const raws = rawDeliverables(request, result.response);
      const composed: ComposedVersion[] = deliverables.map((deliverable) =>
        composeDeliverable(deliverable, raws.get(deliverable) ?? {}, core, {
          eventIds: result.response.keyEventIds,
          evidenceIds: result.response.evidenceIds,
        }),
      );
      const at = this.#now();
      const cost = description.billed ? computedCost(description, result.usage) : null;
      this.#repository.transaction(() => {
        for (const version of composed) {
          const current = this.#repository.currentVersion(draftId, version.deliverable);
          if (current !== null) {
            this.#repository.supersede(current.id, at);
          }
          const versionNumber = this.#repository.nextVersionNumber(draftId, version.deliverable);
          this.#repository.insertVersion({
            id: this.#newId(),
            projectId,
            draftId,
            deliverable: version.deliverable,
            versionNumber,
            origin: versionNumber === 1 ? 'generated' : 'regenerated',
            generationId: id,
            baseVersionId: current?.id ?? null,
            instructions,
            raw: { ...(version.raw as Record<string, string | string[]>) },
            fields: [...version.fields],
            flags: [...version.flags],
            factIds: [...version.factIds],
            eventIds: [...version.eventIds],
            evidenceIds: [...version.evidenceIds],
            createdAt: at,
          });
        }
        this.#repository.completeGeneration(
          id,
          {
            inputTokens: result.usage?.inputTokens ?? null,
            outputTokens: result.usage?.outputTokens ?? null,
            computedCost: cost,
          },
          at,
        );
      });
      this.#container.logger.info(
        {
          generationId: id,
          inputTokens: result.usage?.inputTokens ?? null,
          outputTokens: result.usage?.outputTokens ?? null,
          computedCost: cost,
          flagged: composed.filter((version) => version.flags.length > 0).map((version) => version.deliverable),
        },
        'editorial generation completed',
      );
    } finally {
      this.#running = false;
    }
    const record = this.#repository.generation(id);
    if (record === null) {
      throw new Error('the editorial generation was not stored');
    }
    return { generation: this.#generationView(record), package: this.package(projectId) };
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Edits and approvals
  // -----------------------------------------------------------------------------------------------------------------

  #current(projectId: string, deliverable: EditorialDeliverable): { loaded: Loaded; current: VersionRecord | null } {
    const loaded = this.#load(projectId);
    if (loaded.draftId === null) {
      throw new HttpProblem(409, 'EDITORIAL_NOT_GENERATABLE', 'El proyecto todavía no tiene un borrador de contenido.');
    }
    return { loaded, current: this.#repository.currentVersion(loaded.draftId, deliverable) };
  }

  /** Stores an operator edit of the current version as a new version. */
  edit(projectId: string, deliverable: EditorialDeliverable, input: EditorialEditCreate): EditorialVersion {
    const { loaded, current } = this.#current(projectId, deliverable);
    if (current === null || current.id !== input.baseVersionId) {
      throw new HttpProblem(409, 'VERSION_CONFLICT', 'La versión editada ya no es la actual. Recarga el copy.');
    }
    const allowed = new Set<EditorialFieldName>(EDITORIAL_DELIVERABLE_FIELDS[deliverable]);
    const edits = new Map<EditorialFieldName, string>();
    for (const field of input.fields) {
      if (!allowed.has(field.name) || edits.has(field.name)) {
        throw new HttpProblem(400, 'VALIDATION_FAILED', 'Un campo no pertenece a este entregable o está repetido.');
      }
      edits.set(field.name, field.text);
    }
    const core = loaded.core as EditorialCore;
    const raw = rawOfEdit(deliverable, edits, current.fields, core);
    const composed = composeDeliverable(deliverable, raw, core, {
      eventIds: current.eventIds,
      evidenceIds: current.evidenceIds,
    });
    const id = this.#newId();
    const at = this.#now();
    this.#repository.transaction(() => {
      if (!this.#repository.supersede(current.id, at)) {
        throw new HttpProblem(409, 'VERSION_CONFLICT', 'La versión editada ya no es la actual. Recarga el copy.');
      }
      this.#repository.insertVersion({
        id,
        projectId,
        draftId: current.draftId,
        deliverable,
        versionNumber: this.#repository.nextVersionNumber(current.draftId, deliverable),
        origin: 'edited',
        generationId: null,
        baseVersionId: current.id,
        instructions: null,
        raw: { ...(composed.raw as Record<string, string | string[]>) },
        fields: [...composed.fields],
        flags: [...composed.flags],
        factIds: [...composed.factIds],
        eventIds: [...composed.eventIds],
        evidenceIds: [...composed.evidenceIds],
        createdAt: at,
      });
    });
    const stored = this.#repository.version(id);
    if (stored === null) {
      throw new Error('the editorial version was not stored');
    }
    return this.#versionView(stored);
  }

  /** Approves the exact current version of a deliverable. */
  approve(projectId: string, deliverable: EditorialDeliverable, versionId: string): EditorialVersion {
    const { loaded, current } = this.#current(projectId, deliverable);
    if (current === null || current.id !== versionId) {
      throw new HttpProblem(409, 'VERSION_CONFLICT', 'La versión ya no es la actual. Recarga el copy.');
    }
    if (current.approvedAt !== null) {
      return this.#versionView(current);
    }
    if (current.flags.length > 0) {
      throw new HttpProblem(409, 'CONTENT_FLAGGED', 'El copy tiene avisos: corrígelo o regenéralo antes de aprobarlo.');
    }
    const language = loaded.input?.language ?? 'es';
    const blocking = blockingFactRefs(
      { db: this.#container.db, config: this.#container.config },
      projectId,
      language,
      current.factIds,
    );
    if (blocking.length > 0) {
      throw new HttpProblem(
        409,
        'APPROVAL_BLOCKED',
        'Algún dato en el que se apoya el copy no se puede publicar todavía.',
        { facts: blocking },
      );
    }
    this.#repository.transaction(() => {
      if (!this.#repository.approve(current.id, this.#now())) {
        throw new HttpProblem(409, 'VERSION_CONFLICT', 'La versión ya no es la actual. Recarga el copy.');
      }
    });
    const stored = this.#repository.version(current.id);
    if (stored === null) {
      throw new Error('the editorial version disappeared');
    }
    return this.#versionView(stored);
  }

  /** Withdraws the approval of the current version of a deliverable. */
  withdraw(projectId: string, deliverable: EditorialDeliverable): EditorialVersion {
    const { current } = this.#current(projectId, deliverable);
    if (current === null) {
      throw new HttpProblem(404, 'NOT_FOUND', 'Este entregable todavía no tiene copy.');
    }
    this.#repository.withdraw(current.id);
    const stored = this.#repository.version(current.id);
    if (stored === null) {
      throw new Error('the editorial version disappeared');
    }
    return this.#versionView(stored);
  }

  /** Marks the generations a restart interrupted as failed (startup). */
  interruptRunning(): number {
    return this.#repository.interruptRunning(this.#now());
  }
}
