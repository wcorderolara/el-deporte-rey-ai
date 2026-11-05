/**
 * Content generation batches over locally managed sports data (PD-ARCH-01E-A; operations previewContentBatch,
 * createContentBatch, getContentBatch).
 *
 * - Selection: the round must belong to the season and competition, the stage (when given) must be the round's stage
 *   and every match must belong to that round; otherwise 404 `NOT_FOUND`. Nothing is guessed from names.
 * - Data: the current effective values of the sports tables (manual data, confirmed imports, protected overrides).
 *   No provider is queried and no import preview or provider snapshot is read.
 * - Plan (`planPieces`): `round_results` is one results carousel of every eligible selected match; `match_result` is
 *   one piece per selected match. A piece without an eligible match is skipped with its reason, before confirmation.
 *   Eligibility is `localResultIneligibility`, the same function the local adapter applies at research time.
 * - Freezing: on confirmation the effective values of every ready piece are recorded as one version of a form import
 *   of the local source (the existing import pipeline: validation, canonical original with SHA-256, versions). The
 *   MANUAL_DATA evidence of the generated facts therefore references the exact local snapshot it came from.
 * - Generation reuses the existing workflow unchanged: each ready piece is one project of the configured
 *   `local-competitions` source, whose selection reference names the piece, and one `full` run of the runner.
 * - Idempotency: the batch, its items, projects and runs are written in one `BEGIN IMMEDIATE` transaction keyed by the
 *   client `requestKey` (UNIQUE). A retry with the same key and the same selection returns the stored batch and
 *   creates nothing; the same key with another selection is `REQUEST_KEY_REUSED`. A selection without any ready
 *   piece is `CONTENT_BATCH_NOT_GENERATABLE`.
 * - State: each item's status is its project's latest run, so a batch is `in_progress` while any run is pending or
 *   running, and partial failures are reported per piece. Runs are not atomic with each other: a failed piece keeps
 *   its project and can be run again from the project page.
 */
import { createHash, randomUUID } from 'node:crypto';

import {
  type ContentBatch,
  type ContentBatchContext,
  type ContentBatchCreate,
  type ContentBatchItem,
  type ContentBatchMatch,
  type ContentBatchPreview,
  type ContentBatchSelection,
  type ContentPieceKind,
  type ContentPiecePlan,
  type ContentPieceSkipReason,
  type Language,
  MANUAL_IMPORT_FORMAT,
  type ProjectSportsContext,
  SlugSchema,
  StageNameSchema,
} from '@edr/contracts';

import type { AppContainer } from '../../../container.js';
import type { SourceConfig } from '../../../platform/config/index.js';
import { HttpProblem } from '../../../platform/http/index.js';
import {
  localFixtureIneligibility,
  localResultIneligibility,
  localSelectionRef,
} from '../../../providers/sports/index.js';
import type { WorkflowRunner } from '../../../workflow/index.js';
import { ImportService, LOCAL_COMPETITIONS_ADAPTER } from '../../imports/index.js';
import { TemplateRegistry, toContractTemplate } from '../../rendering/index.js';
import { ProjectRepository } from '../repository.js';

import {
  type BatchItemRecord,
  type BatchRecord,
  ContentBatchRepository,
  type LocalContextRecord,
  type LocalMatchRecord,
} from './repository.js';

/** Slide types of each content kind's carousels (the local source provides no standings). */
const SLIDE_TYPES_OF: Readonly<Record<ContentKind, ReadonlySet<string>>> = {
  results: new Set(['cover', 'match_result', 'closing']),
  calendar: new Set(['cover', 'round_overview', 'fixture', 'closing']),
  upcoming: new Set(['cover', 'fixture', 'closing']),
  preview: new Set(['cover', 'match_preview', 'closing']),
};

/** The content kind (carousel structure) of the project of each piece kind. */
export const CONTENT_KIND_OF: Readonly<Record<ContentPieceKind, ContentKind>> = {
  round_results: 'results',
  match_result: 'results',
  round_calendar: 'calendar',
  upcoming_matches: 'upcoming',
  match_preview: 'preview',
};

/** Content type of a carousel: the content kind of a ready piece. */
export type ContentKind = 'results' | 'calendar' | 'upcoming' | 'preview';

/** Declared source of the form import that freezes a batch's local values (shown in the import history). */
const FROZEN_SELECTION_SOURCE = 'Selección local confirmada';

/** Round pieces first (results, calendar, upcoming), then the per-match pieces (result, preview). */
const PIECE_ORDER: readonly ContentPieceKind[] = [
  'round_results',
  'round_calendar',
  'upcoming_matches',
  'match_result',
  'match_preview',
];

const TITLES: Readonly<Record<Language, Readonly<Record<ContentPieceKind, string>>>> = {
  es: {
    round_results: 'Resultados',
    round_calendar: 'Calendario',
    upcoming_matches: 'Próximos partidos',
    match_result: 'Resultado',
    match_preview: 'Previa',
  },
  en: {
    round_results: 'Results',
    round_calendar: 'Fixtures',
    upcoming_matches: 'Upcoming matches',
    match_result: 'Result',
    match_preview: 'Preview',
  },
};

/** The reason a match is not eligible for a piece kind, or null when it is (same rules as the frozen selection). */
function ineligibilityFor(kind: ContentPieceKind, match: ContentBatchMatch): ContentPieceSkipReason | null {
  switch (CONTENT_KIND_OF[kind]) {
    case 'results':
      return match.ineligibility;
    case 'calendar':
      return match.calendarIneligibility;
    default:
      return match.upcomingIneligibility;
  }
}

function notFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'The competition, season, stage, round or match is not in the selection.');
}

function batchNotFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'The content batch does not exist.');
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/** The stage label of the batch's projects: the round, prefixed by its stage; null when it breaks the stage-name rule. */
export function selectionLabelOf(context: Pick<LocalContextRecord, 'stageName' | 'roundName'>): string | null {
  const label = context.stageName === null ? context.roundName : `${context.stageName} - ${context.roundName}`;
  return StageNameSchema.safeParse(label).success ? label : null;
}

/** A selected match as the preview shows it. */
export function matchView(match: LocalMatchRecord): ContentBatchMatch {
  return {
    matchId: match.id,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    kickoffAt: match.kickoffAt,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    ineligibility: localResultIneligibility(match),
    calendarIneligibility: localFixtureIneligibility(match, 'calendar'),
    upcomingIneligibility: localFixtureIneligibility(match, 'upcoming'),
  };
}

/**
 * The pieces of a selection, in a stable order: the round carousel first, then one piece per match in calendar order.
 * Requested counts follow the real selection; nothing is invented to fill a piece.
 */
export function planPieces(
  kinds: readonly ContentPieceKind[],
  matches: readonly ContentBatchMatch[],
  options: { readonly roundName: string; readonly language: Language; readonly contextSupported: boolean },
): ContentPiecePlan[] {
  const pieces: Omit<ContentPiecePlan, 'position'>[] = [];
  const skipped = (reason: ContentPieceSkipReason | null): Pick<ContentPiecePlan, 'status' | 'skipReason'> =>
    reason === null ? { status: 'ready', skipReason: null } : { status: 'skipped', skipReason: reason };
  for (const kind of PIECE_ORDER.filter((candidate) => kinds.includes(candidate))) {
    const label = TITLES[options.language][kind];
    if (kind === 'round_results' || kind === 'round_calendar' || kind === 'upcoming_matches') {
      const eligible = matches.filter((match) => ineligibilityFor(kind, match) === null);
      pieces.push({
        kind,
        title: truncate(`${label} · ${options.roundName}`, 200),
        matchIds: (eligible.length > 0 ? eligible : matches).map((match) => match.matchId),
        ...skipped(
          !options.contextSupported ? 'context_not_supported' : eligible.length === 0 ? 'no_eligible_matches' : null,
        ),
      });
    } else {
      for (const match of matches) {
        const teams = `${match.homeTeamName} - ${match.awayTeamName}`;
        pieces.push({
          kind,
          // A per-match result keeps its 01E-A title; a preview names its kind.
          title: truncate(kind === 'match_preview' ? `${label} · ${teams}` : teams, 200),
          matchIds: [match.matchId],
          ...skipped(!options.contextSupported ? 'context_not_supported' : ineligibilityFor(kind, match)),
        });
      }
    }
  }
  return pieces.map((piece, index) => ({ position: index + 1, ...piece }));
}

/** SHA-256 of the normalized selection: the identity a request key is bound to. */
export function selectionHash(selection: ContentBatchSelection, language: Language): string {
  const normalized = {
    competitionId: selection.competitionId,
    seasonId: selection.seasonId,
    stageId: selection.stageId,
    roundId: selection.roundId,
    matchIds: [...selection.matchIds].sort(),
    kinds: [...selection.kinds].sort(),
    language,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

interface Resolved {
  readonly context: LocalContextRecord;
  readonly selectionLabel: string | null;
  readonly language: Language;
  readonly matches: ContentBatchMatch[];
  /** The selected matches with their team IDs, by match ID. */
  readonly records: ReadonlyMap<string, LocalMatchRecord>;
  readonly pieces: ContentPiecePlan[];
}

export interface ContentBatchServiceOptions {
  readonly container: AppContainer;
  readonly runner: WorkflowRunner;
  readonly newId?: () => string;
  readonly templates?: TemplateRegistry;
}

export class ContentBatchService {
  readonly #container: AppContainer;
  readonly #runner: WorkflowRunner;
  readonly #batches: ContentBatchRepository;
  readonly #projects: ProjectRepository;
  readonly #templates: TemplateRegistry;
  readonly #imports: ImportService;
  readonly #newId: () => string;

  constructor(options: ContentBatchServiceOptions) {
    this.#container = options.container;
    this.#runner = options.runner;
    this.#batches = new ContentBatchRepository(options.container.db);
    this.#projects = new ProjectRepository(options.container.db);
    this.#templates = options.templates ?? new TemplateRegistry();
    this.#newId = options.newId ?? randomUUID;
    const { container } = options;
    this.#imports = new ImportService({
      db: container.db,
      clock: container.clock,
      dataDir: container.paths.dataDir,
      logger: container.logger,
      sources: container.config.providers.sports.sources,
      catalogue: container.config.catalogue,
      newId: this.#newId,
    });
  }

  #language(requested: Language | undefined): Language {
    const { languages } = this.#container.config;
    const language = requested ?? languages.defaultLanguage;
    if (!languages.languages.some((entry) => entry.code === language)) {
      throw new HttpProblem(400, 'VALIDATION_FAILED', 'The request is invalid.', {
        errors: [{ path: '/language', message: 'is not an allowed value' }],
      });
    }
    return language;
  }

  /** The enabled local competitions source, or null when none is configured. */
  #localSource(): SourceConfig | null {
    return (
      this.#container.config.providers.sports.sources.find(
        (source) =>
          source.enabled &&
          source.adapter === LOCAL_COMPETITIONS_ADAPTER &&
          this.#container.sources.get(source.id) !== undefined,
      ) ?? null
    );
  }

  #resolve(selection: ContentBatchSelection): Resolved {
    const language = this.#language(selection.language);
    const context = this.#batches.context(selection.competitionId, selection.seasonId, selection.roundId);
    if (context === null || context.stageId !== selection.stageId) {
      throw notFound();
    }
    const roundMatches = new Map(
      this.#batches
        .seasonMatches(context.seasonId)
        .filter((match) => match.roundId === context.roundId)
        .map((match) => [match.id, match] as const),
    );
    if (selection.matchIds.some((matchId) => !roundMatches.has(matchId))) {
      throw notFound();
    }
    const selected = new Set(selection.matchIds);
    const records = [...roundMatches.values()].filter((match) => selected.has(match.id));
    const matches = records.map(matchView);
    const selectionLabel = selectionLabelOf(context);
    const contextSupported = selectionLabel !== null && this.#localSource() !== null;
    const pieces = planPieces(selection.kinds, matches, { roundName: context.roundName, language, contextSupported });
    return {
      context,
      selectionLabel,
      language,
      matches,
      records: new Map(records.map((record) => [record.id, record] as const)),
      pieces,
    };
  }

  /**
   * Freezes the effective local values of every ready piece as one form import of the local source: one selection
   * (and so one import version) per piece, whose stage is the piece. Returns the version ID of each piece position.
   * The import pipeline validates the document, stores its canonical original with its SHA-256 and versions it.
   */
  #freeze(batchId: string, source: SourceConfig, resolved: Resolved, ready: readonly ContentPiecePlan[]) {
    const selectionLabel = resolved.selectionLabel ?? resolved.context.roundName;
    const document = {
      format: MANUAL_IMPORT_FORMAT,
      competition: { id: `lb-${batchId}`, name: resolved.context.competitionName, areaName: null },
      season: { id: resolved.context.seasonId, label: resolved.context.seasonLabel },
      selections: ready.map((piece) => {
        const results = CONTENT_KIND_OF[piece.kind] === 'results';
        const matches = piece.matchIds.map((matchId) => {
          const record = resolved.records.get(matchId);
          if (record === undefined || record.kickoffAt === null) {
            throw new Error('a ready piece has a match without a kickoff');
          }
          if (results && (record.status !== 'finished' || record.homeScore === null || record.awayScore === null)) {
            throw new Error('a ready results piece has a match that is not a result');
          }
          if (!results && record.status === 'finished') {
            throw new Error('a ready piece of matches not played yet has a finished match');
          }
          return {
            ...record,
            kickoffAt: record.kickoffAt,
            // Only a finished match has a score; a recorded score of a pending match is never shown.
            score:
              results && record.homeScore !== null && record.awayScore !== null
                ? { home: record.homeScore, away: record.awayScore }
                : null,
          };
        });
        const teams = new Map<string, string>();
        for (const match of matches) {
          teams.set(match.homeTeamId, match.homeTeamName);
          teams.set(match.awayTeamId, match.awayTeamName);
        }
        return {
          stage: { id: `piece-${String(piece.position)}`, name: selectionLabel, order: piece.position },
          matchday: null,
          teams: [...teams].map(([key, name]) => ({ key, name })),
          matches: matches.map((match) => ({
            home: match.homeTeamId,
            away: match.awayTeamId,
            kickoff: match.kickoffAt,
            status: match.status === 'in_progress' ? 'in_play' : match.status,
            score: match.score,
          })),
          standings: null,
        };
      }),
    };
    const outcome = this.#imports.createImport(
      { channel: 'form', declaredSource: FROZEN_SELECTION_SOURCE, document },
      { sourceId: source.id },
    );
    if (!outcome.ok) {
      this.#container.logger.warn({ batchId, errors: outcome.total }, 'content batch selection could not be frozen');
      throw new HttpProblem(
        409,
        'CONTENT_BATCH_NOT_GENERATABLE',
        'The local values of the selection could not be recorded as a selection snapshot.',
      );
    }
    const versions = new Map(
      outcome.summary.selections.map((selection) => [selection.stageId, selection.versionId] as const),
    );
    return {
      importId: outcome.summary.id,
      versionOf: (position: number): string => {
        const versionId = versions.get(`piece-${String(position)}`);
        if (versionId === undefined) {
          throw new Error('a frozen piece has no selection version');
        }
        return versionId;
      },
    };
  }

  /** The current templates of every slide type the selected kinds use. */
  #compatibleTemplates(kinds: readonly ContentPieceKind[]) {
    const slideTypes = new Set(kinds.flatMap((kind) => [...SLIDE_TYPES_OF[CONTENT_KIND_OF[kind]]]));
    return this.#templates
      .list()
      .filter((template) => slideTypes.has(template.slideType))
      .map(toContractTemplate);
  }

  preview(selection: ContentBatchSelection): ContentBatchPreview {
    const resolved = this.#resolve(selection);
    const ready = resolved.pieces.filter((piece) => piece.status === 'ready').length;
    return {
      context: contextView(resolved.context),
      selectionLabel: resolved.selectionLabel,
      language: resolved.language,
      matches: resolved.matches,
      templates: this.#compatibleTemplates(selection.kinds),
      pieces: resolved.pieces,
      totals: { requested: resolved.pieces.length, ready, skipped: resolved.pieces.length - ready },
    };
  }

  create(request: ContentBatchCreate): ContentBatch {
    const language = this.#language(request.selection.language);
    const hash = selectionHash(request.selection, language);
    const batchId = this.#container.db.transaction(() => {
      const existing = this.#batches.batchByKey(request.requestKey);
      if (existing !== null) {
        if (existing.requestHash !== hash) {
          throw new HttpProblem(409, 'REQUEST_KEY_REUSED', 'The request key was already used for another selection.');
        }
        return existing.id;
      }
      const resolved = this.#resolve(request.selection);
      const source = this.#localSource();
      const ready = resolved.pieces.filter((piece) => piece.status === 'ready');
      if (source === null || resolved.selectionLabel === null || ready.length === 0) {
        throw new HttpProblem(
          409,
          'CONTENT_BATCH_NOT_GENERATABLE',
          source === null
            ? 'No local sports data source is configured.'
            : 'No selected piece can be generated from the local data.',
        );
      }
      // A catalogue link that binds only the local competition (for example one configured with no accepted public
      // source, AD-38) gives the project its link ID; a link that also binds another source is not used, because
      // verification would then consult that source during generation. Otherwise the project stays unlinked.
      const link = this.#container.config.catalogue.linkOfBinding(source.id, resolved.context.competitionId);
      const competitionId =
        link !== undefined && link.bindings.every((binding) => binding.sourceId === source.id)
          ? link.id
          : `${source.id}-${resolved.context.competitionId}`;
      if (!SlugSchema.safeParse(competitionId).success) {
        throw new Error('the local source ID does not fit a catalogue competition ID');
      }
      const id = this.#newId();
      const at = this.#container.clock.now().toISOString();
      const frozen = this.#freeze(id, source, resolved, ready);
      this.#batches.insertBatch({
        ...resolved.context,
        id,
        importId: frozen.importId,
        requestKey: request.requestKey,
        requestHash: hash,
        selectionLabel: resolved.selectionLabel,
        language,
        createdAt: at,
      });
      this.#projects.upsertSource(source, at);
      for (const piece of resolved.pieces) {
        const itemId = this.#newId();
        if (piece.status === 'skipped') {
          this.#batches.insertItem(id, {
            id: itemId,
            position: piece.position,
            kind: piece.kind,
            title: piece.title,
            projectId: null,
            initialRunId: null,
            selectionVersionId: null,
            skipReason: piece.skipReason,
            matchIds: piece.matchIds,
          });
          continue;
        }
        const projectId = this.#newId();
        this.#projects.insert({
          id: projectId,
          competitionId,
          competitionName: resolved.context.competitionName,
          sourceId: source.id,
          dataMode: source.mode,
          seasonId: resolved.context.seasonId,
          seasonLabel: resolved.context.seasonLabel,
          stageId: resolved.context.roundId,
          stageLabel: resolved.selectionLabel,
          matchday: null,
          selectionRef: localSelectionRef(itemId),
          standingsExpected: 'not_expected',
          language,
          createdAt: at,
          contentKind: CONTENT_KIND_OF[piece.kind],
        });
        const run = this.#runner.start(projectId, 'full');
        this.#batches.insertItem(id, {
          id: itemId,
          position: piece.position,
          kind: piece.kind,
          title: piece.title,
          projectId,
          initialRunId: run.id,
          selectionVersionId: frozen.versionOf(piece.position),
          skipReason: null,
          matchIds: piece.matchIds,
        });
      }
      return id;
    });
    return this.get(batchId);
  }

  get(batchId: string): ContentBatch {
    const batch = this.#batches.batch(batchId);
    if (batch === null) {
      throw batchNotFound();
    }
    const items = this.#batches.items(batchId).map((item) => this.#itemView(item));
    const count = (status: ContentBatchItem['status']) => items.filter((item) => item.status === status).length;
    const totals = {
      requested: items.length,
      generated: count('completed'),
      failed: count('failed'),
      skipped: count('skipped'),
      pending: count('pending') + count('running'),
      deleted: count('deleted'),
    };
    return {
      id: batch.id,
      requestKey: batch.requestKey,
      createdAt: batch.createdAt,
      context: contextView(batch),
      language: batch.language,
      state:
        totals.pending > 0
          ? 'in_progress'
          : totals.failed === 0
            ? 'completed'
            : totals.generated > 0
              ? 'partial'
              : 'failed',
      totals,
      items,
    };
  }

  #itemView(item: BatchItemRecord): ContentBatchItem {
    const deleted = item.projectId !== null && this.#projects.deletedAt(item.projectId) !== null;
    const run = item.projectId === null || deleted ? null : this.#runner.runs.latestView(item.projectId);
    return {
      id: item.id,
      position: item.position,
      kind: item.kind,
      title: item.title,
      matchIds: [...item.matchIds],
      status: item.projectId === null ? 'skipped' : deleted ? 'deleted' : (run?.status ?? 'pending'),
      skipReason: item.skipReason,
      failure: run?.failure ?? null,
      projectId: item.projectId,
      runId: run?.id ?? item.initialRunId,
    };
  }
}

/** The local sports context of a project, or null when it was not generated by a batch. */
export function projectSportsContext(
  batches: ContentBatchRepository,
  projectId: string,
): { readonly context: ProjectSportsContext; readonly title: string } | null {
  const item = batches.itemOfProject(projectId);
  const batch = item === null ? null : batches.batch(item.batchId);
  if (item === null || batch === null) {
    return null;
  }
  return {
    context: {
      batchId: batch.id,
      itemId: item.id,
      kind: item.kind,
      ...contextView(batch),
      matchIds: [...item.matchIds],
    },
    title: item.title,
  };
}

function contextView(context: LocalContextRecord | BatchRecord): ContentBatchContext {
  return {
    competitionId: context.competitionId,
    competitionName: context.competitionName,
    seasonId: context.seasonId,
    seasonLabel: context.seasonLabel,
    stageId: context.stageId,
    stageName: context.stageName,
    roundId: context.roundId,
    roundName: context.roundName,
  };
}
