/**
 * Manual import pipeline (contracts/provider-ports.md section 1.6; architecture.md section 15.3; AD-29, AD-35;
 * OD-19; R-060 to R-069, R-119, R-273 to R-280; SC-05 option A, PD-15).
 *
 * Processing order, in process, synchronous and linear in the input size:
 * 1. channel input: file channels decode `contentBase64` strictly, check 1 to 524 288 bytes and decode UTF-8
 *    strictly (`encoding.ts`); JSON files are pre-scanned (depth 16, duplicate member names) before `JSON.parse`;
 *    CSV files are parsed by the own state machine and converted; JSON files and forms are validated by the strict
 *    document schema and the semantic checks;
 * 2. checks against the stored imports: competition name and season label conflicts (`metadata_conflict`), the
 *    catalogue limits, and the current matches carried into a standings-only selection;
 * 3. the original: the received bytes (files) or the canonical serialization (form), checked against 524 288 bytes
 *    before anything is written (T11H-F10);
 * 4. application: the original written first with the exclusive flag, then one `BEGIN IMMEDIATE` transaction for the
 *    import record, the competition and season when new, and one new version per selection with the previous one
 *    superseded (OD-19). Any error before this point rejects the whole import and nothing is stored (R-066).
 *
 * The request content is never logged; logs carry IDs, counts and closed problem codes only (T11H-F12).
 */
import { randomUUID } from 'node:crypto';

import {
  type ImportSummary,
  type ManualSelection,
  ManualSelectionSchema,
  type ManualSelectionHistory,
  type ManualVersion,
} from '@edr/contracts';

import type { CatalogueConfig, SourceConfig } from '../../platform/config/index.js';
import type { Db } from '../../platform/db/index.js';
import type { ImportErrorItem } from '../../platform/http/index.js';

import type { CandidateSelection, ImportCandidate } from './candidate.js';
import { convertCsv } from './csv/convert.js';
import { detectLayout } from './csv/layouts.js';
import { parseCsv } from './csv/parser.js';
import { serializeCanonical, validateDocument } from './document.js';
import { MAX_CONTENT_BYTES, decodeFileContent, sha256Hex } from './encoding.js';
import { ImportErrorList, ImportRejection, WHOLE_FILE, rejectIfAny } from './errors.js';
import { prescanJson } from './json/prescan.js';
import { writeOriginal } from './originals.js';
import { type ImportChannel, type ImportRecord, ImportRepository, type VersionHeader } from './repository.js';
import { checkDocument } from './semantic.js';

/** Adapter kind of the local competitions source (a configuration value). */
export const LOCAL_COMPETITIONS_ADAPTER = 'local-competitions';

/** Catalogue limits of one source's listings (domain listing schemas) and of a catalogue ID. */
export const CATALOGUE_LIMITS = Object.freeze({ seasons: 200, stages: 64, matchdays: 99, catalogueId: 64 });

/** One import request after the envelope check. */
export type ImportRequest =
  | {
      readonly channel: 'json_file' | 'csv_file';
      readonly fileName: string;
      readonly declaredSource: string | null;
      readonly contentBase64: string;
    }
  | { readonly channel: 'form'; readonly declaredSource: string | null; readonly document: unknown };

export type ImportOutcome =
  | { readonly ok: true; readonly summary: ImportSummary }
  | { readonly ok: false; readonly errors: readonly ImportErrorItem[]; readonly total: number };

/** Minimal logger: fields are IDs, counts and closed codes only. */
export interface ImportLogger {
  info(fields: Readonly<Record<string, unknown>>, message: string): void;
}

export interface ImportServiceDeps {
  readonly db: Db;
  readonly clock: { now(): Date };
  readonly dataDir: string;
  readonly logger: ImportLogger;
  /** The configured sources; imports belong to the first enabled MANUAL_DATA source. */
  readonly sources: readonly SourceConfig[];
  readonly catalogue: CatalogueConfig;
  /** Generator of import and version IDs (default `crypto.randomUUID`). */
  readonly newId?: () => string;
}

/** No enabled MANUAL_DATA source is configured, so an import has no source to belong to. */
export class NoManualSourceError extends Error {
  override readonly name = 'NoManualSourceError';
  constructor() {
    super('no enabled MANUAL_DATA source');
  }
}

/** The stored competition season does not exist. */
export class ManualSeasonNotFoundError extends Error {
  override readonly name = 'ManualSeasonNotFoundError';
  constructor() {
    super('manual season not found');
  }
}

function problemCounts(errors: readonly ImportErrorItem[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const error of errors) {
    counts.set(error.problem, (counts.get(error.problem) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

function toSummary(record: ImportRecord, versions: readonly VersionHeader[]): ImportSummary {
  return {
    id: record.id,
    channel: record.channel,
    fileName: record.fileName,
    declaredSource: record.declaredSource,
    receivedAt: record.receivedAt,
    competitionId: record.competitionId,
    competitionName: record.competitionName,
    seasonId: record.seasonId,
    seasonLabel: record.seasonLabel,
    originalSha256: record.originalSha256,
    selections: versions.map((version) => ({
      stageId: version.stageId,
      stageName: version.stageName,
      matchday: version.matchdayKey === 0 ? null : version.matchdayKey,
      versionId: version.id,
      versionNumber: version.versionNumber,
    })),
  };
}

export class ImportService {
  readonly #deps: ImportServiceDeps;
  readonly #repository: ImportRepository;
  readonly #newId: () => string;

  constructor(deps: ImportServiceDeps) {
    this.#deps = deps;
    this.#repository = new ImportRepository(deps.db);
    this.#newId = deps.newId ?? randomUUID;
  }

  /**
   * The source operator imports belong to: the first enabled MANUAL_DATA source in configuration order, other than
   * the local competitions source, whose versions are only the frozen selections of content batches (PD-ARCH-01E-A).
   */
  manualSource(): SourceConfig {
    const source = this.#deps.sources.find(
      (candidate) =>
        candidate.enabled && candidate.mode === 'MANUAL_DATA' && candidate.adapter !== LOCAL_COMPETITIONS_ADAPTER,
    );
    if (source === undefined) {
      throw new NoManualSourceError();
    }
    return source;
  }

  /** An enabled MANUAL_DATA source by ID (the target of a content batch's frozen selection). */
  #sourceById(sourceId: string): SourceConfig {
    const source = this.#deps.sources.find(
      (candidate) => candidate.id === sourceId && candidate.enabled && candidate.mode === 'MANUAL_DATA',
    );
    if (source === undefined) {
      throw new NoManualSourceError();
    }
    return source;
  }

  /**
   * Runs the whole pipeline; returns the summary of the applied import or every error of the rejected one. Operator
   * imports use `manualSource()`; a content batch names its local source with `options.sourceId`.
   */
  createImport(request: ImportRequest, options: { readonly sourceId?: string } = {}): ImportOutcome {
    const source = options.sourceId === undefined ? this.manualSource() : this.#sourceById(options.sourceId);
    const errors = new ImportErrorList(request.channel === 'form' ? 'form' : 'file');
    try {
      const { candidate, original } = this.#parse(request, errors);
      const selections = this.#resolve(candidate, source, errors);
      rejectIfAny(errors);
      const summary = this.#apply(request, source, candidate, selections, original);
      this.#deps.logger.info(
        {
          importId: summary.id,
          channel: request.channel,
          selections: summary.selections.length,
          bytes: original.length,
        },
        'import applied',
      );
      return { ok: true, summary };
    } catch (error) {
      if (error instanceof ImportRejection) {
        this.#deps.logger.info(
          { channel: request.channel, errorCount: error.total, problems: problemCounts(error.errors) },
          'import rejected',
        );
        return { ok: false, errors: error.errors, total: error.total };
      }
      throw error;
    }
  }

  /** Step 1 and 3: the candidate and the original bytes of the request; throws `ImportRejection`. */
  #parse(request: ImportRequest, errors: ImportErrorList): { candidate: ImportCandidate; original: Buffer } {
    if (request.channel === 'form') {
      const document = validateDocument(request.document, errors);
      rejectIfAny(errors);
      const candidate = document === null ? null : checkDocument(document, errors);
      rejectIfAny(errors);
      if (document === null || candidate === null) {
        throw new ImportRejection(errors);
      }
      const original = serializeCanonical(document);
      if (original.length > MAX_CONTENT_BYTES) {
        errors.add('/', null, 'too_large', 'The document must be at most 524288 bytes as canonical JSON');
        throw new ImportRejection(errors);
      }
      return { candidate, original };
    }

    const decoded = decodeFileContent(request.contentBase64);
    if (!decoded.ok) {
      errors.add(WHOLE_FILE, null, decoded.problem, decoded.message);
      throw new ImportRejection(errors);
    }

    let candidate: ImportCandidate | null;
    if (request.channel === 'json_file') {
      if (prescanJson(decoded.text, errors) !== 'ok') {
        throw new ImportRejection(errors);
      }
      let raw: unknown;
      try {
        raw = JSON.parse(decoded.text) as unknown;
      } catch {
        // The parser's message may quote the input; it is never used.
        errors.add(WHOLE_FILE, null, 'parse_error', 'The file is not valid JSON');
        throw new ImportRejection(errors);
      }
      const document = validateDocument(raw, errors);
      rejectIfAny(errors);
      candidate = document === null ? null : checkDocument(document, errors);
    } else {
      const parsed = parseCsv(decoded.text, errors);
      if (parsed.tooManyRows || parsed.stoppedAtErrorCap) {
        throw new ImportRejection(errors);
      }
      const layout = detectLayout(parsed, errors);
      candidate = layout === null ? null : convertCsv(parsed, layout, errors);
    }
    rejectIfAny(errors);
    if (candidate === null) {
      throw new ImportRejection(errors);
    }
    return { candidate, original: decoded.bytes };
  }

  /** Step 2: checks against the stored imports and the final selections (standings-only ones merged). */
  #resolve(candidate: ImportCandidate, source: SourceConfig, errors: ImportErrorList): ManualSelection[] {
    const repository = this.#repository;
    const { competition, season } = candidate;

    const storedName = repository.competitionName(competition.id);
    if (storedName !== undefined && storedName !== competition.name) {
      const at = candidate.competitionNameAt;
      errors.add(
        at.record,
        at.field,
        'metadata_conflict',
        'The competition name differs from an earlier import of this competition ID',
      );
    }
    const storedLabel = repository.seasonLabel(competition.id, season.id);
    if (storedLabel !== undefined && storedLabel !== season.label) {
      const at = candidate.seasonLabelAt;
      errors.add(
        at.record,
        at.field,
        'metadata_conflict',
        'The season label differs from an earlier import of this season ID',
      );
    }

    if (
      this.#deps.catalogue.linkOfBinding(source.id, competition.id) === undefined &&
      source.id.length + 1 + competition.id.length > CATALOGUE_LIMITS.catalogueId
    ) {
      const at = candidate.competitionIdAt;
      errors.add(
        at.record,
        at.field,
        'value_out_of_range',
        `The competition ID must be at most ${String(CATALOGUE_LIMITS.catalogueId - source.id.length - 1)} characters for this source`,
      );
    }
    if (storedLabel === undefined && repository.seasonCount(competition.id) >= CATALOGUE_LIMITS.seasons) {
      const at = candidate.seasonIdAt;
      errors.add(at.record, at.field, 'value_out_of_range', 'The competition already has 200 seasons');
    }

    const stageIds = new Set(repository.currentStageIds(competition.id, season.id));
    const matchdaysByStage = new Map<string, Set<number>>();
    const result: ManualSelection[] = [];
    for (const item of candidate.selections) {
      const { stage, matchday } = item.selection;
      if (!stageIds.has(stage.id)) {
        stageIds.add(stage.id);
        if (stageIds.size > CATALOGUE_LIMITS.stages) {
          errors.add(
            item.stageAt.record,
            item.stageAt.field,
            'value_out_of_range',
            'The season would have more than 64 stages',
          );
        }
      }
      if (matchday !== null) {
        let matchdays = matchdaysByStage.get(stage.id);
        if (matchdays === undefined) {
          matchdays = new Set(repository.currentMatchdays(competition.id, season.id, stage.id));
          matchdaysByStage.set(stage.id, matchdays);
        }
        if (!matchdays.has(matchday)) {
          matchdays.add(matchday);
          if (matchdays.size > CATALOGUE_LIMITS.matchdays) {
            errors.add(
              item.matchdayAt.record,
              item.matchdayAt.field,
              'value_out_of_range',
              'The stage would have more than 99 matchdays',
            );
          }
        }
      }
      const selection = item.standingsOnly ? this.#mergeStandings(candidate, item, errors) : item.selection;
      if (selection !== null) {
        result.push(selection);
      }
    }
    return result;
  }

  /**
   * A standings-only selection carries the current matches and teams of the selection into the new version unchanged
   * (contracts/provider-ports.md section 1.6); without a current version it is refused (nothing is derived, R-069).
   */
  #mergeStandings(
    candidate: ImportCandidate,
    item: CandidateSelection,
    errors: ImportErrorList,
  ): ManualSelection | null {
    const { stage, matchday } = item.selection;
    const current = this.#repository.currentVersion(candidate.competition.id, candidate.season.id, stage.id, matchday);
    if (current === undefined) {
      errors.add(
        item.matchesAt.record,
        item.matchesAt.field,
        'required_missing',
        'Standings need an earlier import with the matches of the selection',
      );
      return null;
    }
    const teams = new Map<string, string>();
    for (const team of current.selection.teams) {
      teams.set(team.key, team.name);
    }
    let consistent = true;
    for (const team of item.selection.teams) {
      const name = teams.get(team.key);
      if (name === undefined) {
        teams.set(team.key, team.name);
      } else if (name !== team.name) {
        consistent = false;
        errors.add(
          item.teamsAt.record,
          item.teamsAt.field,
          'value_inconsistent',
          'A team name differs from the current version of the selection for the same team key',
        );
      }
    }
    if (teams.size > 64) {
      errors.add(item.teamsAt.record, item.teamsAt.field, 'value_out_of_range', 'A selection has more than 64 teams');
      return null;
    }
    if (!consistent) {
      return null;
    }
    return {
      stage: { id: stage.id, name: stage.name, order: stage.order },
      matchday,
      teams: [...teams].map(([key, name]) => ({ key, name })),
      matches: current.selection.matches,
      standings: item.selection.standings,
    };
  }

  /** Step 4: writes the original, then applies the import in one transaction; returns the summary. */
  #apply(
    request: ImportRequest,
    source: SourceConfig,
    candidate: ImportCandidate,
    selections: readonly ManualSelection[],
    original: Buffer,
  ): ImportSummary {
    const versions = selections.map((selection) => {
      const parsed = ManualSelectionSchema.safeParse(selection);
      if (!parsed.success) {
        // Unreachable after the checks above; never answered as a validation error of the request.
        throw new Error('a checked selection failed the selection schema');
      }
      return { id: this.#newId(), selection: parsed.data };
    });
    const importId = this.#newId();
    const channel: ImportChannel = request.channel;
    const receivedAt = this.#deps.clock.now().toISOString();
    const originalPath = writeOriginal(this.#deps.dataDir, importId, channel, original);
    this.#deps.db.transaction(() => {
      this.#repository.applyImport({
        source,
        importId,
        channel,
        fileName: request.channel === 'form' ? null : request.fileName,
        declaredSource: request.declaredSource,
        competition: candidate.competition,
        season: candidate.season,
        originalPath,
        originalSha256: sha256Hex(original),
        originalBytes: original.length,
        receivedAt,
        versions,
      });
    });
    const summary = this.getImport(importId);
    if (summary === undefined) {
      throw new Error('applied import not found');
    }
    return summary;
  }

  /** Applied imports, newest first (R-067, R-277). */
  listImports(): ImportSummary[] {
    return this.#repository
      .listImports()
      .map((record) => toSummary(record, this.#repository.versionsOfImport(record.id)));
  }

  /** One applied import, or undefined. */
  getImport(importId: string): ImportSummary | undefined {
    const record = this.#repository.findImport(importId);
    return record === undefined ? undefined : toSummary(record, this.#repository.versionsOfImport(record.id));
  }

  /** The stored record of an import, for serving its original. */
  importRecord(importId: string): ImportRecord | undefined {
    return this.#repository.findImport(importId);
  }

  /** Version history of every selection of a competition season (R-068, R-278). */
  listSelections(competitionId: string, seasonId: string): ManualSelectionHistory {
    if (this.#repository.seasonLabel(competitionId, seasonId) === undefined) {
      throw new ManualSeasonNotFoundError();
    }
    const groups = new Map<string, VersionHeader[]>();
    for (const version of this.#repository.versionsOfSeason(competitionId, seasonId)) {
      const key = `${version.stageId}\u0000${String(version.matchdayKey)}`;
      const list = groups.get(key);
      if (list === undefined) {
        groups.set(key, [version]);
      } else {
        list.push(version);
      }
    }
    return {
      competitionId,
      seasonId,
      selections: [...groups.values()].map((versions) => {
        const current = versions.find((version) => version.supersededAt === null) ?? versions[versions.length - 1];
        const first = versions[0];
        return {
          stageId: first?.stageId ?? '',
          stageName: current?.stageName ?? '',
          matchday: first === undefined || first.matchdayKey === 0 ? null : first.matchdayKey,
          versions: versions.map((version) => ({
            versionId: version.id,
            versionNumber: version.versionNumber,
            importId: version.importId,
            createdAt: version.createdAt,
            current: version.supersededAt === null,
          })),
        };
      }),
    };
  }

  /** One version of a selection, current or superseded, or undefined (R-068, R-278). */
  getVersion(versionId: string): ManualVersion | undefined {
    const version = this.#repository.findVersion(versionId);
    if (version === undefined) {
      return undefined;
    }
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      importId: version.importId,
      createdAt: version.createdAt,
      supersededAt: version.supersededAt,
      competitionId: version.competitionId,
      seasonId: version.seasonId,
      selection: version.selection,
    };
  }
}
