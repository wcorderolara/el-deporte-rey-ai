/**
 * The channel-independent result of parsing and checking one import: competition and season metadata and one
 * candidate per selection, with the error locations (record and field) that later checks against the stored data use.
 * Every channel produces it: JSON files and forms from a validated `ManualImportDocument`, CSV files from their rows.
 */
import type { ManualSelection } from '@edr/contracts';

/** Where an error about a value is reported: the record and the field. */
export interface Locator {
  readonly record: string;
  readonly field: string | null;
}

export interface CandidateSelection {
  /** The selection as imported; `matches` is empty for a standings-only selection. */
  readonly selection: ManualSelection;
  /** A CSV standings file supplies standings only; the current matches are carried into the new version. */
  readonly standingsOnly: boolean;
  readonly stageAt: Locator;
  readonly matchdayAt: Locator;
  readonly matchesAt: Locator;
  readonly teamsAt: Locator;
}

export interface ImportCandidate {
  readonly competition: { readonly id: string; readonly name: string; readonly areaName: string | null };
  readonly season: { readonly id: string; readonly label: string };
  readonly selections: readonly CandidateSelection[];
  readonly competitionIdAt: Locator;
  readonly competitionNameAt: Locator;
  readonly seasonIdAt: Locator;
  readonly seasonLabelAt: Locator;
}
