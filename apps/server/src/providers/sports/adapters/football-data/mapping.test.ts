/**
 * `mapStages` standings expectation (FU-1, OD-60; `provider-research.md` section 2.4 item 4): standings are `expected`
 * only for the first stage in order that contains matchday 1 (the table stage), and `unknown` for every later stage,
 * whether it restarts its numbering at 1 (CL-like knockout legs) or continues the season's numbering (EC-like
 * tournament). Recorded-shape synthetic responses of `fixtures/football-data/`; no socket is opened.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../../../vitest.setup.js';

import { decodeSelectionRef, mapStages, type SeasonRef } from './mapping.js';
import { MatchesResponseSchema } from './schemas.js';
import { harness, pick, refOf, researchCtx } from './test/harness.js';
import { recorded, replyOf } from './test/replay.js';

function stagesOf(file: string, season: SeasonRef) {
  const response = MatchesResponseSchema.parse(recorded(file).body);
  return mapStages(response, season).items;
}

const CL_2025: SeasonRef = { c: 'CL', n: 'Copa Continental Sintética', y: 2025, l: '2025/26', cur: false };
const TC1_2024: SeasonRef = { c: 'TC1', n: 'Copa de Naciones Sintética', y: 2024, l: '2024', cur: false };

function summary(stages: ReturnType<typeof stagesOf>): Array<[string, string, number[], boolean]> {
  return stages.map((stage) => [
    stage.name,
    stage.standings,
    stage.matchdays.map((matchday) => matchday.number),
    stage.wholeStageRef !== null,
  ]);
}

describe('mapStages: standings expectation (FU-1)', () => {
  it('a CL-like season: only the league stage expects standings; knockout legs restarting at 1 do not', () => {
    const stages = stagesOf('cl-matches-2025-numbered-knockout.json', CL_2025);
    expect(summary(stages)).toEqual([
      ['LEAGUE_STAGE', 'expected', [1, 2, 3, 4, 5, 6, 7, 8], false],
      ['PLAYOFFS', 'unknown', [1, 2], false],
      ['LAST_16', 'unknown', [1, 2], false],
      ['QUARTER_FINALS', 'unknown', [1, 2], false],
      ['SEMI_FINALS', 'unknown', [1, 2], false],
      ['FINAL', 'unknown', [], true],
    ]);
    // The selection references carry the same expectation: no standings request for a knockout leg.
    for (const stage of stages) {
      for (const matchday of stage.matchdays) {
        expect(decodeSelectionRef(matchday.ref, 'football-data').sx).toBe(stage.name === 'LEAGUE_STAGE');
      }
    }
  });

  it('an EC-like tournament: only the group stage expects standings; stages continuing the numbering do not', () => {
    const stages = stagesOf('tc1-matches-2024.json', TC1_2024);
    expect(summary(stages)).toEqual([
      ['GROUP_STAGE', 'expected', [1, 2, 3], false],
      ['LAST_16', 'unknown', [4], false],
      ['QUARTER_FINALS', 'unknown', [5], false],
      ['SEMI_FINALS', 'unknown', [6], false],
      ['FINAL', 'unknown', [7], false],
    ]);
    for (const stage of stages.slice(1)) {
      expect(stage.matchdays.every((matchday) => !decodeSelectionRef(matchday.ref, 'football-data').sx)).toBe(true);
    }
  });

  it('marks the first stage in kickoff order, whatever order the matches are listed in', () => {
    const body = recorded('cl-matches-2025-numbered-knockout.json').body as { matches: unknown[] };
    const response = MatchesResponseSchema.parse({ ...body, matches: [...body.matches].reverse() });
    const stages = mapStages(response, CL_2025).items;
    expect(stages.filter((stage) => stage.standings === 'expected').map((stage) => stage.name)).toEqual([
      'LEAGUE_STAGE',
    ]);
  });

  it('keeps the earlier behaviour for a season with one numbered stage and whole stages', () => {
    const stages = stagesOf('cl-matches-2025.json', CL_2025);
    expect(stages.map((stage) => [stage.name, stage.standings])).toEqual([
      ['LEAGUE_STAGE', 'expected'],
      ['PLAYOFFS', 'unknown'],
      ['LAST_16', 'unknown'],
      ['QUARTER_FINALS', 'unknown'],
      ['SEMI_FINALS', 'unknown'],
      ['FINAL', 'unknown'],
    ]);
  });

  it('a knockout leg selection sends no standings request and reports standings not provided for the stage', async () => {
    const h = harness({ token: TEST_MARKER_TOKEN });
    h.egress
      .serve('competitions.json')
      .serve('competition-cl.json')
      .serve('cl-matches-2025-numbered-knockout.json')
      .on('GET /v4/competitions/CL/matches?matchday=1&season=2025', replyOf('cl-matches-2025-numbered-knockout.json'));
    const competitions = await h.clock.run(h.source.listCompetitions(researchCtx()));
    const cl = pick(competitions, (item) => item.localKey === 'cl');
    const seasons = await h.clock.run(h.source.listSeasons(cl.ref, researchCtx()));
    const season = pick(seasons, (item) => item.id === '2025');
    const stages = await h.clock.run(h.source.listStages(cl.ref, season.ref, researchCtx()));
    const playoffs = pick(stages, (item) => item.name === 'PLAYOFFS');
    expect(playoffs.standings).toBe('unknown');
    const snapshot = await h.clock.run(h.source.fetchSelection(refOf(playoffs.matchdays[0]?.ref), researchCtx()));
    expect(snapshot.standings).toEqual({ available: false, reason: 'not_provided_for_stage' });
    expect(snapshot.matches.length).toBeGreaterThan(0);
    expect(h.egress.callsTo('GET /v4/competitions/CL/standings')).toEqual([]);
  });
});
