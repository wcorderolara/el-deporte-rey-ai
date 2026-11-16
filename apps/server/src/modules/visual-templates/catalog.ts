/**
 * The sports-data catalogue of visual templates (PD-ARCH-01G-C; contract `VisualTemplateBinding`): what text element
 * each binding becomes in the render model, a synthetic stress value to check that a layer can hold a long value, and
 * the resolution of every binding from the local Competiciones data.
 *
 * - Values are the current effective values of the sports tables (manual data, confirmed imports and protected
 *   overrides), read like the content generation of PD-ARCH-01E reads them (`ContentBatchRepository`), and shown in
 *   the same display forms (`platform/format`): nothing is derived from a name, guessed or invented.
 * - A binding without a value (no stage, no kickoff, no final score) resolves to null.
 * - Scores are values only of a finished match, as the results of PD-ARCH-01E.
 * - Team names (TEAM-DISPLAY-01, PD-37): a team with a presentation name is previewed with it, by its local ID, as a
 *   project created now would draw it (its snapshot records the current names); a team without one keeps its
 *   official name. The synthetic stress values stay examples.
 */
import {
  type Language,
  type TextFieldName,
  VISUAL_TEMPLATE_BINDINGS,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplatePreviewSelection,
} from '@edr/contracts';

import type { Db } from '../../platform/db/index.js';
import { HttpProblem } from '../../platform/http/index.js';
import { formatDate, formatInt, formatScore, formatTime, templateText } from '../../platform/format/index.js';
import { ContentBatchRepository, type LocalMatchRecord } from '../projects/content-batches/repository.js';
import type { TextSemantic } from '../rendering/index.js';

/** The text element of each binding: the slide field and the semantic the render model records. */
export const BINDING_ELEMENT: Readonly<
  Record<VisualTemplateBinding, { readonly field: TextFieldName; readonly semantic: TextSemantic }>
> = Object.freeze({
  'competition.name': { field: 'footer', semantic: 'competition_name' },
  'season.label': { field: 'footer', semantic: 'season_label' },
  'stage.name': { field: 'title', semantic: 'stage_display' },
  'round.name': { field: 'title', semantic: 'stage_display' },
  'match.homeTeam.name': { field: 'team_home', semantic: 'team_name' },
  'match.awayTeam.name': { field: 'team_away', semantic: 'team_name' },
  'match.kickoffDate': { field: 'kickoff', semantic: 'kickoff' },
  'match.kickoffTime': { field: 'kickoff_time', semantic: 'kickoff_time' },
  'match.status': { field: 'match_status', semantic: 'match_status' },
  'match.score': { field: 'score', semantic: 'score' },
  'match.homeScore': { field: 'score_home', semantic: 'score_home' },
  'match.awayScore': { field: 'score_away', semantic: 'score_away' },
  'round.fixtures': { field: 'fixtures', semantic: 'fixture_line' },
});

const STRESS_FIXTURE = 'Real Sociedad Ejemplo vs Atlético Muestra · 28 sep 2026';

/**
 * Long synthetic values (no real club or competition) used to warn that a layer may not hold a long value. They are
 * never shown as data.
 */
export const STRESS_VALUES: Readonly<Record<VisualTemplateBinding, string>> = Object.freeze({
  'competition.name': 'Campeonato Nacional de Primera División',
  'season.label': '2026/27',
  'stage.name': 'Fase de clasificación',
  'round.name': 'Jornada 38',
  'match.homeTeam.name': 'Real Sociedad Deportiva Ejemplo',
  'match.awayTeam.name': 'Real Sociedad Deportiva Ejemplo',
  'match.kickoffDate': '28 sep 2026',
  'match.kickoffTime': '20:45',
  'match.status': 'Suspendido',
  'match.score': '10-10',
  'match.homeScore': '10',
  'match.awayScore': '10',
  'round.fixtures': Array.from({ length: 10 }, () => STRESS_FIXTURE).join('\n'),
});

/** True when the binding exists for the content type (contract `VISUAL_TEMPLATE_BINDINGS`). */
export function bindingAllowed(binding: VisualTemplateBinding, contentType: VisualTemplateContentType): boolean {
  return VISUAL_TEMPLATE_BINDINGS[binding].contentTypes.includes(contentType);
}

/** The local data of a selection. */
export interface LocalSelectionData {
  readonly competitionName: string;
  readonly seasonLabel: string;
  readonly stageName: string | null;
  readonly roundName: string | null;
  readonly match: LocalMatchRecord | null;
  /** The matches of the selected round, in calendar order (empty without a round). */
  readonly roundMatches: readonly LocalMatchRecord[];
  /** TEAM-DISPLAY-01: the current presentation name of each team of `match` and `roundMatches` that has one. */
  readonly displayNames: Readonly<Record<string, string>>;
}

/** The name a preview draws for a team (TEAM-DISPLAY-01): its presentation name, else its official name. */
export function previewTeamName(data: Pick<LocalSelectionData, 'displayNames'>, teamId: string, name: string): string {
  return data.displayNames[teamId] ?? name;
}

const SQL = {
  season:
    'SELECT c.name AS competition_name, s.label AS season_label FROM competition_seasons s ' +
    'JOIN competitions c ON c.id = s.competition_id WHERE c.id = ? AND s.id = ?',
  round:
    'SELECT r.name AS round_name, st.name AS stage_name FROM competition_rounds r ' +
    'LEFT JOIN competition_stages st ON st.id = r.stage_id WHERE r.id = ? AND r.season_id = ?',
} as const;

const MATCH_TYPES: ReadonlySet<VisualTemplateContentType> = new Set(['match_preview', 'fixture', 'match_result']);

function notFound(): HttpProblem {
  return new HttpProblem(404, 'NOT_FOUND', 'Los datos deportivos elegidos no existen en Competiciones.');
}

/**
 * Reads the local data of a selection: the competition and season, the round (given, or the match's own round) with
 * its stage, the match, and the matches of the round. A match content type needs a match and a round calendar needs
 * a round (400 otherwise); an unknown or inconsistent selection is 404.
 */
export function readSelection(
  db: Db,
  contentType: VisualTemplateContentType,
  selection: VisualTemplatePreviewSelection,
): LocalSelectionData {
  const matchId = selection.matchId ?? null;
  const selectedRoundId = selection.roundId ?? null;
  if (MATCH_TYPES.has(contentType) && matchId === null) {
    throw new HttpProblem(400, 'VALIDATION_FAILED', 'Elige un partido para previsualizar esta plantilla.');
  }
  if (contentType === 'round_overview' && selectedRoundId === null) {
    throw new HttpProblem(400, 'VALIDATION_FAILED', 'Elige una jornada para previsualizar esta plantilla.');
  }
  const season = db
    .prepare<{ competition_name: string; season_label: string }>(SQL.season)
    .get([selection.competitionId, selection.seasonId]);
  if (season === undefined) {
    throw notFound();
  }
  const repository = new ContentBatchRepository(db);
  const matches = repository.seasonMatches(selection.seasonId);
  const match = matchId === null ? null : (matches.find((candidate) => candidate.id === matchId) ?? null);
  if (matchId !== null && match === null) {
    throw notFound();
  }
  if (match !== null && selectedRoundId !== null && match.roundId !== selectedRoundId) {
    throw notFound();
  }
  const roundId = selectedRoundId ?? match?.roundId ?? null;
  let round: { round_name: string; stage_name: string | null } | undefined;
  if (roundId !== null) {
    round = db.prepare<{ round_name: string; stage_name: string | null }>(SQL.round).get([roundId, selection.seasonId]);
    if (round === undefined) {
      throw notFound();
    }
  }
  const roundMatches = roundId === null ? [] : matches.filter((candidate) => candidate.roundId === roundId);
  const teamIds = new Set(
    [...(match === null ? [] : [match]), ...roundMatches].flatMap((record) => [record.homeTeamId, record.awayTeamId]),
  );
  return {
    competitionName: season.competition_name,
    seasonLabel: season.season_label,
    stageName: round?.stage_name ?? null,
    roundName: round?.round_name ?? null,
    match,
    roundMatches,
    displayNames: repository.teamDisplayNames(teamIds),
  };
}

function finalScore(match: LocalMatchRecord): { home: number; away: number } | null {
  return match.status === 'finished' && match.homeScore !== null && match.awayScore !== null
    ? { home: match.homeScore, away: match.awayScore }
    : null;
}

/** The value of a binding for the selected data, in its display form; null when the data has none. */
export function resolveBinding(
  binding: VisualTemplateBinding,
  data: LocalSelectionData,
  language: Language,
  utcOffsetMinutes: number,
): string | null {
  const { match } = data;
  const text = templateText(language);
  switch (binding) {
    case 'competition.name':
      return data.competitionName;
    case 'season.label':
      return data.seasonLabel;
    case 'stage.name':
      return data.stageName;
    case 'round.name':
      return data.roundName;
    case 'match.homeTeam.name':
      return match === null ? null : previewTeamName(data, match.homeTeamId, match.homeTeamName);
    case 'match.awayTeam.name':
      return match === null ? null : previewTeamName(data, match.awayTeamId, match.awayTeamName);
    case 'match.kickoffDate':
      return match === null || match.kickoffAt === null
        ? null
        : formatDate(match.kickoffAt, language, utcOffsetMinutes);
    case 'match.kickoffTime':
      return match === null || match.kickoffAt === null ? null : formatTime(match.kickoffAt, utcOffsetMinutes);
    case 'match.status':
      return match === null ? null : text.matchStatus[match.status === 'in_progress' ? 'in_play' : match.status];
    case 'match.score': {
      const score = match === null ? null : finalScore(match);
      return score === null ? null : formatScore(score);
    }
    case 'match.homeScore':
    case 'match.awayScore': {
      const score = match === null ? null : finalScore(match);
      return score === null ? null : formatInt(binding === 'match.homeScore' ? score.home : score.away);
    }
    case 'round.fixtures':
      return data.roundMatches.length === 0
        ? null
        : data.roundMatches
            .map(
              (fixture) =>
                `${previewTeamName(data, fixture.homeTeamId, fixture.homeTeamName)} ${text.versus} ` +
                previewTeamName(data, fixture.awayTeamId, fixture.awayTeamName) +
                (fixture.kickoffAt === null ? '' : ` · ${formatDate(fixture.kickoffAt, language, utcOffsetMinutes)}`),
            )
            .join('\n');
  }
}
