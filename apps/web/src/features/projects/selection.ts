/**
 * Catalogue selection of the create form (R-243, R-283, R-284, R-286, OD-16; LOW-4 of T11G attempt 2: competition,
 * then source with the first available one preselected, then season, then stage and matchday). Pure functions over
 * the contract shapes; no competition format is assumed (R-077): a stage is chosen by the source's name, as a whole
 * when the source allows it, or by one of the matchday numbers the source reports.
 */
import type {
  CatalogueCompetition,
  CompetitionSource,
  Language,
  ProjectCreate,
  SeasonList,
  Stage,
  StageList,
} from '@edr/contracts';

/** A matchday number, the whole stage, or nothing chosen yet. */
export type MatchdayChoice = number | 'whole' | null;

export interface SelectionState {
  competitionId: string | null;
  sourceId: string | null;
  seasonId: string | null;
  stageId: string | null;
  matchday: MatchdayChoice;
  language: Language;
}

/** Content language default (PD-06, BR-07). */
export const DEFAULT_LANGUAGE: Language = 'es';

export const EMPTY_SELECTION: SelectionState = {
  competitionId: null,
  sourceId: null,
  seasonId: null,
  stageId: null,
  matchday: null,
  language: DEFAULT_LANGUAGE,
};

/** Reference competitions first; otherwise the catalogue's order (stable). */
export function sortCompetitions(competitions: readonly CatalogueCompetition[]): CatalogueCompetition[] {
  return [...competitions].sort((a, b) => Number(b.reference) - Number(a.reference));
}

/** Sources the operator may choose for a project (R-431): selectable, whether available or not. */
export function selectableSources(competition: CatalogueCompetition): CompetitionSource[] {
  return competition.sources.filter((source) => source.selectable);
}

/** True when the source can be chosen now. */
export function isSourceChoosable(source: CompetitionSource): boolean {
  return source.selectable && source.availability.available;
}

/** First selectable and available source, preselected when the competition is chosen (OD-16). */
export function firstAvailableSource(competition: CatalogueCompetition): CompetitionSource | null {
  return competition.sources.find(isSourceChoosable) ?? null;
}

/** A competition can be chosen when at least one of its sources can (R-286: otherwise shown with the reason). */
export function isCompetitionChoosable(competition: CatalogueCompetition): boolean {
  return firstAvailableSource(competition) !== null;
}

/** Matchday numbers in ascending order. */
export function sortedMatchdays(stage: Stage): number[] {
  return [...stage.matchdays].sort((a, b) => a - b);
}

/** A stage can be chosen when it is available and either selectable as a whole or numbered by matchdays. */
export function isStageChoosable(stage: Stage): boolean {
  return stage.availability.available && (stage.selectableAsWhole || stage.matchdays.length > 0);
}

/** Stages in the source's order. */
export function sortStages(stages: readonly Stage[]): Stage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

/** Matchday choice preset when a stage is chosen: the whole stage when allowed, otherwise none yet. */
export function initialMatchday(stage: Stage): MatchdayChoice {
  return stage.selectableAsWhole ? 'whole' : null;
}

export interface ResolvedSelection {
  competition: CatalogueCompetition | null;
  source: CompetitionSource | null;
  seasonList: SeasonList | null;
  stageList: StageList | null;
}

export type MissingItem = 'competition' | 'source' | 'season' | 'stage' | 'matchday';

/**
 * What is still missing before a project can be created (R-243): competition, source, season and stage, and a
 * matchday when the stage is not selectable as a whole. Only values that are present and available in the current
 * listings count as chosen.
 */
export function missingItems(selection: SelectionState, resolved: ResolvedSelection): MissingItem[] {
  const missing: MissingItem[] = [];
  const competition = resolved.competition;
  const source = competition === null ? null : resolved.source;
  if (competition === null || !isCompetitionChoosable(competition)) {
    missing.push('competition');
  }
  if (source === null || !isSourceChoosable(source)) {
    missing.push('source');
  }
  const seasonList = resolved.seasonList;
  const seasonChosen =
    seasonList !== null &&
    seasonList.availability.available &&
    seasonList.seasons.some((season) => season.id === selection.seasonId);
  if (!seasonChosen) {
    missing.push('season');
  }
  const stageList = resolved.stageList;
  const stage =
    seasonChosen && stageList !== null && stageList.availability.available
      ? (stageList.stages.find((candidate) => candidate.id === selection.stageId) ?? null)
      : null;
  if (stage === null || !isStageChoosable(stage)) {
    missing.push('stage');
    if (stage === null) {
      return missing;
    }
  }
  const matchday = selection.matchday;
  const matchdayValid =
    (matchday === 'whole' && stage.selectableAsWhole) ||
    (typeof matchday === 'number' && stage.matchdays.includes(matchday));
  if (!matchdayValid) {
    missing.push('matchday');
  }
  return missing;
}

/** Request body of createProject for a complete selection; null while anything is missing. */
export function toProjectCreate(selection: SelectionState, resolved: ResolvedSelection): ProjectCreate | null {
  if (missingItems(selection, resolved).length > 0) {
    return null;
  }
  const { competitionId, sourceId, seasonId, stageId, matchday, language } = selection;
  if (competitionId === null || sourceId === null || seasonId === null || stageId === null || matchday === null) {
    return null;
  }
  return {
    competitionId,
    sourceId,
    seasonId,
    stageId,
    matchday: matchday === 'whole' ? null : matchday,
    language,
  };
}
