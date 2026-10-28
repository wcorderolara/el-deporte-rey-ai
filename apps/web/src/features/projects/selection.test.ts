/** Selection rules of the create form (R-243, OD-16, AD-24), as pure functions over contract shapes. */
import { describe, expect, it } from 'vitest';

import {
  EMPTY_SELECTION,
  firstAvailableSource,
  isCompetitionChoosable,
  missingItems,
  sortCompetitions,
  toProjectCreate,
  type SelectionState,
} from './selection';
import { catalogue, cupSeasons, cupStages } from './test/support';

function competition(id: string) {
  const found = catalogue.competitions.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`missing ${id}`);
  }
  return found;
}

const cup = competition('demo-copa-continental');
const cupSource = cup.sources[0] ?? null;
const resolved = { competition: cup, source: cupSource, seasonList: cupSeasons, stageList: cupStages };
const base: SelectionState = {
  ...EMPTY_SELECTION,
  competitionId: cup.id,
  sourceId: 'demo-cup',
  seasonId: '2025-26',
};

describe('selection rules', () => {
  it('puts reference competitions first and keeps the catalogue order otherwise', () => {
    expect(sortCompetitions(catalogue.competitions).map((entry) => entry.id)).toEqual([
      'demo-copa-continental',
      'demo-liga-uno',
      'live-liga-restringida',
      'manual-liga-nacional',
    ]);
  });

  it('preselects the first selectable and available source; a competition without one is not choosable', () => {
    expect(firstAvailableSource(competition('manual-liga-nacional'))?.sourceId).toBe('manual');
    expect(firstAvailableSource(competition('live-liga-restringida'))).toBeNull();
    expect(isCompetitionChoosable(competition('live-liga-restringida'))).toBe(false);
  });

  it('requires a matchday for a stage that is not selectable as a whole', () => {
    expect(missingItems({ ...base, stageId: 'fase-liga', matchday: null }, resolved)).toEqual(['matchday']);
    expect(missingItems({ ...base, stageId: 'fase-liga', matchday: 'whole' }, resolved)).toEqual(['matchday']);
    expect(missingItems({ ...base, stageId: 'fase-liga', matchday: 99 }, resolved)).toEqual(['matchday']);
    expect(toProjectCreate({ ...base, stageId: 'fase-liga', matchday: 4 }, resolved)).toEqual({
      competitionId: cup.id,
      sourceId: 'demo-cup',
      seasonId: '2025-26',
      stageId: 'fase-liga',
      matchday: 4,
      language: 'es',
    });
  });

  it('sends a null matchday for a whole stage, and refuses an unavailable stage', () => {
    expect(toProjectCreate({ ...base, stageId: 'playoff', matchday: 'whole' }, resolved)?.matchday).toBeNull();
    expect(missingItems({ ...base, stageId: 'final', matchday: 'whole' }, resolved)).toContain('stage');
    expect(toProjectCreate({ ...base, stageId: 'final', matchday: 'whole' }, resolved)).toBeNull();
  });

  it('lists everything missing for an empty selection', () => {
    expect(
      missingItems(EMPTY_SELECTION, { competition: null, source: null, seasonList: null, stageList: null }),
    ).toEqual(['competition', 'source', 'season', 'stage']);
  });
});
