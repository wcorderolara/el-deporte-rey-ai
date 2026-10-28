/**
 * Semantic checks of a schema-valid import document (JSON file or form; contracts/provider-ports.md section 1.6;
 * R-061, R-063, R-069, R-274, R-275, R-279), all errors collected:
 *
 * - each selection (stage and matchday) once per document, and one name and order per stage ID;
 * - team keys unique within a selection;
 * - match identity (stage, matchday, home, away; competition and season are one per document) unique within the
 *   import, naming both records (`duplicate_match`);
 * - home differs from away; referenced teams declared in the selection (`unknown_team`);
 * - a finished match needs a score and every other status forbids one;
 * - standings: each team once and declared, unique positions contiguous from 1, `won + drawn + lost = played` and
 *   `goalsFor - goalsAgainst = goalDifference`.
 *
 * Every lookup keyed by imported values uses `Map` or `Set` (T11H-F07). Records are JSON pointers of schema names and
 * indexes; messages are fixed text plus pointers (T11H-F12).
 */
import type { ManualImportDocument } from '@edr/contracts';

import type { CandidateSelection, ImportCandidate } from './candidate.js';
import type { ImportErrorList } from './errors.js';

/** Checks a validated document and returns its candidate; null when any error was found. */
export function checkDocument(document: ManualImportDocument, errors: ImportErrorList): ImportCandidate | null {
  const selectionsSeen = new Map<string, number>();
  const stages = new Map<string, { name: string; order: number; index: number }>();
  const identities = new Map<string, string>();

  document.selections.forEach((selection, s) => {
    const at = `/selections/${String(s)}`;
    const selectionKey = `${selection.stage.id}\u0000${String(selection.matchday ?? 0)}`;
    const earlier = selectionsSeen.get(selectionKey);
    if (earlier === undefined) {
      selectionsSeen.set(selectionKey, s);
    } else {
      errors.add(
        at,
        'matchday',
        'value_inconsistent',
        `The stage and matchday repeat the selection at /selections/${String(earlier)}`,
      );
    }

    const stage = stages.get(selection.stage.id);
    if (stage === undefined) {
      stages.set(selection.stage.id, { name: selection.stage.name, order: selection.stage.order, index: s });
    } else {
      const other = `/selections/${String(stage.index)}/stage`;
      if (stage.name !== selection.stage.name) {
        errors.add(`${at}/stage`, 'name', 'value_inconsistent', `The stage name differs from ${other} for the stage`);
      }
      if (stage.order !== selection.stage.order) {
        errors.add(`${at}/stage`, 'order', 'value_inconsistent', `The stage order differs from ${other} for the stage`);
      }
    }

    const teams = new Set<string>();
    selection.teams.forEach((team, t) => {
      if (teams.has(team.key)) {
        errors.add(
          `${at}/teams/${String(t)}`,
          'key',
          'value_inconsistent',
          'The team key appears twice in the selection',
        );
      }
      teams.add(team.key);
    });

    selection.matches.forEach((match, m) => {
      const record = `${at}/matches/${String(m)}`;
      if (!teams.has(match.home)) {
        errors.add(record, 'home', 'unknown_team', 'The team is not declared in the teams of the selection');
      }
      if (!teams.has(match.away)) {
        errors.add(record, 'away', 'unknown_team', 'The team is not declared in the teams of the selection');
      }
      if (match.home === match.away) {
        errors.add(record, 'away', 'value_inconsistent', 'The home and away teams are the same team');
      }
      if (match.status === 'finished' && match.score === null) {
        errors.add(record, 'score', 'finished_without_score', 'A finished match needs a score');
      }
      if (match.status !== 'finished' && match.score !== null) {
        errors.add(record, 'score', 'score_not_allowed', 'Only a finished match has a score');
      }
      const identity = `${selectionKey}\u0000${match.home}\u0000${match.away}`;
      const first = identities.get(identity);
      if (first === undefined) {
        identities.set(identity, record);
      } else {
        errors.add(record, null, 'duplicate_match', `The match duplicates the match at ${first}`);
      }
    });

    if (selection.standings !== null) {
      const rows = selection.standings.rows;
      const rowTeams = new Set<string>();
      const positions = new Set<number>();
      rows.forEach((row, r) => {
        const record = `${at}/standings/rows/${String(r)}`;
        if (!teams.has(row.team)) {
          errors.add(record, 'team', 'unknown_team', 'The team is not declared in the teams of the selection');
        }
        if (rowTeams.has(row.team)) {
          errors.add(record, 'team', 'value_inconsistent', 'The team appears twice in the standings');
        }
        rowTeams.add(row.team);
        if (positions.has(row.position)) {
          errors.add(record, 'position', 'value_inconsistent', 'The position appears twice in the standings');
        }
        positions.add(row.position);
        if (row.position > rows.length) {
          errors.add(record, 'position', 'value_inconsistent', 'Standings positions must be contiguous from 1');
        }
        if (row.won + row.drawn + row.lost !== row.played) {
          errors.add(record, 'played', 'value_inconsistent', 'won + drawn + lost must equal played');
        }
        if (row.goalsFor - row.goalsAgainst !== row.goalDifference) {
          errors.add(
            record,
            'goalDifference',
            'value_inconsistent',
            'goalsFor - goalsAgainst must equal goalDifference',
          );
        }
      });
    }
  });

  if (!errors.empty) {
    return null;
  }
  return {
    competition: {
      id: document.competition.id,
      name: document.competition.name,
      areaName: document.competition.areaName,
    },
    season: { id: document.season.id, label: document.season.label },
    selections: document.selections.map((selection, s): CandidateSelection => ({
      selection,
      standingsOnly: false,
      stageAt: { record: `/selections/${String(s)}/stage`, field: 'id' },
      matchdayAt: { record: `/selections/${String(s)}`, field: 'matchday' },
      matchesAt: { record: `/selections/${String(s)}`, field: 'matches' },
      teamsAt: { record: `/selections/${String(s)}`, field: 'teams' },
    })),
    competitionIdAt: { record: '/competition', field: 'id' },
    competitionNameAt: { record: '/competition', field: 'name' },
    seasonIdAt: { record: '/season', field: 'id' },
    seasonLabelAt: { record: '/season', field: 'label' },
  };
}
