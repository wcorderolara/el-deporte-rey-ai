import {
  CompetitionMatchListResponseSchema,
  CompetitionMatchSchema,
  CompetitionRoundSchema,
  CompetitionStageSchema,
  MatchResultHistoryListResponseSchema,
  ManagedSeasonSchema,
  ManagedTeamSchema,
  ProblemSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { READ_HEADERS, WRITE_HEADERS, projectsTestApp, type ProjectsTestApp } from '../../projects/test/support.js';

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

describe('optional local competition calendar and results', () => {
  it('supports direct season matches, direct rounds, stages and stage rounds without invented structure', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Liga Flexible' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const teams = await Promise.all(
      ['Club Norte', 'Club Sur', 'Club Este'].map(async (name) =>
        ManagedTeamSchema.parse(
          (await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name } })).json(),
        ),
      ),
    );
    const participants = `/api/v1/competitions/${competition.id}/seasons/${season.id}/participants`;
    for (const team of teams)
      await h.inject({ method: 'POST', url: participants, headers: WRITE_HEADERS, payload: { teamId: team.id } });
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;

    expect((await h.inject({ method: 'GET', url: `${base}/stages`, headers: READ_HEADERS })).json()).toEqual({
      stages: [],
    });
    expect(
      CompetitionMatchListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches`, headers: READ_HEADERS })).json(),
      ).matches,
    ).toEqual([]);
    const directRound = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada 4' },
        })
      ).json(),
    );
    const stage = CompetitionStageSchema.parse(
      (
        await h.inject({ method: 'POST', url: `${base}/stages`, headers: WRITE_HEADERS, payload: { name: 'Apertura' } })
      ).json(),
    );
    const stageRound = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/stages/${stage.id}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Semifinal de vuelta', displayOrder: 3 },
        })
      ).json(),
    );
    expect(stageRound.stageId).toBe(stage.id);
    expect(
      (await h.inject({ method: 'GET', url: `${base}/stages/${stage.id}/rounds`, headers: READ_HEADERS })).json(),
    ).toEqual({ rounds: [stageRound] });

    const createMatch = async (payload: object) =>
      h!.inject({ method: 'POST', url: `${base}/matches`, headers: WRITE_HEADERS, payload });
    const direct = CompetitionMatchSchema.parse(
      (await createMatch({ homeTeamId: teams[0]!.id, awayTeamId: teams[1]!.id })).json(),
    );
    expect(direct.stage).toBeNull();
    expect(direct.round).toBeNull();
    expect(direct.status).toBe('scheduled');
    expect(direct.homeScore).toBeNull();
    expect(direct.awayScore).toBeNull();
    expect(
      CompetitionMatchListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches`, headers: READ_HEADERS })).json(),
      ).matches.map((item: { id: string }) => item.id),
    ).toContain(direct.id);
    const inRound = CompetitionMatchSchema.parse(
      (await createMatch({ homeTeamId: teams[1]!.id, awayTeamId: teams[2]!.id, roundId: directRound.id })).json(),
    );
    expect(inRound.round?.name).toBe('Jornada 4');
    expect(inRound.stage).toBeNull();
    expect(
      CompetitionMatchListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches`, headers: READ_HEADERS })).json(),
      ).matches.map((item: { id: string }) => item.id),
    ).toContain(inRound.id);
    const inStage = CompetitionMatchSchema.parse(
      (await createMatch({ homeTeamId: teams[2]!.id, awayTeamId: teams[0]!.id, stageId: stage.id })).json(),
    );
    expect(inStage.stage?.name).toBe('Apertura');
    expect(inStage.round).toBeNull();
    expect(
      CompetitionMatchListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches`, headers: READ_HEADERS })).json(),
      ).matches.map((item: { id: string }) => item.id),
    ).toContain(inStage.id);
    const inStageRound = CompetitionMatchSchema.parse(
      (
        await createMatch({
          homeTeamId: teams[0]!.id,
          awayTeamId: teams[2]!.id,
          stageId: stage.id,
          roundId: stageRound.id,
        })
      ).json(),
    );
    expect(inStageRound.round?.name).toBe('Semifinal de vuelta');
    expect(
      CompetitionMatchListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches`, headers: READ_HEADERS })).json(),
      ).matches.map((item: { id: string }) => item.id),
    ).toEqual(expect.arrayContaining([direct.id, inRound.id, inStage.id, inStageRound.id]));

    const repeated = await h.inject({
      method: 'POST',
      url: `${base}/stages`,
      headers: WRITE_HEADERS,
      payload: { name: ' apertura ' },
    });
    expect(repeated.statusCode).toBe(409);
    expect(ProblemSchema.parse(repeated.json()).code).toBe('DUPLICATE_STAGE');
    const repeatedDirectRound = await h.inject({
      method: 'POST',
      url: `${base}/rounds`,
      headers: WRITE_HEADERS,
      payload: { name: ' jornada 4 ' },
    });
    expect(repeatedDirectRound.statusCode).toBe(409);
    expect(ProblemSchema.parse(repeatedDirectRound.json()).code).toBe('DUPLICATE_ROUND');
    const wrongRoundContext = await createMatch({
      homeTeamId: teams[0]!.id,
      awayTeamId: teams[1]!.id,
      stageId: stage.id,
      roundId: directRound.id,
    });
    expect(wrongRoundContext.statusCode).toBe(400);
    expect(ProblemSchema.parse(wrongRoundContext.json()).code).toBe('VALIDATION_FAILED');
  });

  it('validates teams and kickoff duplicates while retaining result history', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Copa Local' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2026/27' },
        })
      ).json(),
    );
    const teams = await Promise.all(
      ['Equipo Uno', 'Equipo Dos', 'Equipo No Inscrito'].map(async (name) =>
        ManagedTeamSchema.parse(
          (await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name } })).json(),
        ),
      ),
    );
    const participants = `/api/v1/competitions/${competition.id}/seasons/${season.id}/participants`;
    for (const team of teams.slice(0, 2))
      await h.inject({ method: 'POST', url: participants, headers: WRITE_HEADERS, payload: { teamId: team.id } });
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    const kickoffAt = '2027-05-10T18:00:00Z';
    const create = (homeTeamId: string, awayTeamId: string, date = kickoffAt) =>
      h!.inject({
        method: 'POST',
        url: `${base}/matches`,
        headers: WRITE_HEADERS,
        payload: { homeTeamId, awayTeamId, kickoffAt: date },
      });
    const created = await create(teams[0]!.id, teams[1]!.id);
    expect(created.statusCode).toBe(201);
    const match = CompetitionMatchSchema.parse(created.json());
    expect((await create(teams[0]!.id, teams[1]!.id)).statusCode).toBe(409);
    expect((await create(teams[0]!.id, teams[1]!.id, '2027-05-10T12:00:00-06:00')).statusCode).toBe(409);
    expect((await create(teams[0]!.id, teams[1]!.id, '2027-05-17T18:00:00Z')).statusCode).toBe(201);
    expect((await create(teams[1]!.id, teams[0]!.id)).statusCode).toBe(201);
    expect((await create(teams[0]!.id, teams[0]!.id)).statusCode).toBe(400);
    expect((await create(teams[0]!.id, teams[2]!.id)).statusCode).toBe(400);

    const resultPath = `${base}/matches/${match.id}/result`;
    const noScore = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'finished' },
    });
    expect(CompetitionMatchSchema.parse(noScore.json())).toMatchObject({
      status: 'finished',
      homeScore: null,
      awayScore: null,
    });
    const final = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'finished', homeScore: 2, awayScore: 1 },
    });
    expect(CompetitionMatchSchema.parse(final.json()).homeScore).toBe(2);
    const correction = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'finished', homeScore: 3, awayScore: 1 },
    });
    expect(CompetitionMatchSchema.parse(correction.json()).homeScore).toBe(3);
    const cancelled = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'cancelled' },
    });
    expect(CompetitionMatchSchema.parse(cancelled.json())).toMatchObject({
      status: 'cancelled',
      homeScore: 3,
      awayScore: 1,
    });
    const historyBeforeNoop = MatchResultHistoryListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
      ).json(),
    ).history;
    const noChange = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'cancelled' },
    });
    expect(CompetitionMatchSchema.parse(noChange.json())).toMatchObject({
      status: 'cancelled',
      homeScore: 3,
      awayScore: 1,
    });
    expect(
      MatchResultHistoryListResponseSchema.parse(
        (
          await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
        ).json(),
      ).history,
    ).toHaveLength(historyBeforeNoop.length);

    const history = MatchResultHistoryListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
      ).json(),
    );
    expect(history.history.map((item) => item.changeType)).toEqual([
      'created',
      'status_updated',
      'result_recorded',
      'result_corrected',
      'status_updated',
    ]);
    expect(history.history.map((item) => [item.status, item.homeScore, item.awayScore])).toEqual([
      ['scheduled', null, null],
      ['finished', null, null],
      ['finished', 2, 1],
      ['finished', 3, 1],
      ['cancelled', 3, 1],
    ]);
    const cannotUnlink = await h.inject({
      method: 'DELETE',
      url: `${participants}/${teams[0]!.id}`,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(cannotUnlink.statusCode).toBe(409);
    expect(ProblemSchema.parse(cannotUnlink.json()).code).toBe('TEAM_IN_USE');
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('allows every manual status transition and keeps status independent from scores', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Estados libres' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const teams = await Promise.all(
      ['Local estado', 'Visitante estado'].map(async (name) =>
        ManagedTeamSchema.parse(
          (await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name } })).json(),
        ),
      ),
    );
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    for (const team of teams)
      await h.inject({
        method: 'POST',
        url: `${base}/participants`,
        headers: WRITE_HEADERS,
        payload: { teamId: team.id },
      });
    const statuses = ['scheduled', 'in_progress', 'finished', 'postponed', 'cancelled'] as const;
    for (const initial of statuses) {
      for (const next of statuses) {
        const match = CompetitionMatchSchema.parse(
          (
            await h.inject({
              method: 'POST',
              url: `${base}/matches`,
              headers: WRITE_HEADERS,
              payload: { homeTeamId: teams[0]!.id, awayTeamId: teams[1]!.id },
            })
          ).json(),
        );
        const setInitial = await h.inject({
          method: 'POST',
          url: `${base}/matches/${match.id}/result`,
          headers: WRITE_HEADERS,
          payload: { status: initial, homeScore: 0, awayScore: 0 },
        });
        expect(setInitial.statusCode, `${initial} setup`).toBe(200);
        const updated = await h.inject({
          method: 'POST',
          url: `${base}/matches/${match.id}/result`,
          headers: WRITE_HEADERS,
          payload: { status: next, homeScore: 1, awayScore: 2 },
        });
        expect(updated.statusCode, `${initial} → ${next}`).toBe(200);
        expect(CompetitionMatchSchema.parse(updated.json())).toMatchObject({
          status: next,
          homeScore: 1,
          awayScore: 2,
        });
      }
    }

    const match = CompetitionMatchSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/matches`,
          headers: WRITE_HEADERS,
          payload: { homeTeamId: teams[0]!.id, awayTeamId: teams[1]!.id },
        })
      ).json(),
    );
    const resultPath = `${base}/matches/${match.id}/result`;
    const firstScore = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'cancelled', homeScore: 1, awayScore: 2 },
    });
    expect(CompetitionMatchSchema.parse(firstScore.json())).toMatchObject({
      status: 'cancelled',
      homeScore: 1,
      awayScore: 2,
    });
    const progress = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'in_progress', homeScore: 1, awayScore: 2 },
    });
    expect(CompetitionMatchSchema.parse(progress.json())).toMatchObject({
      status: 'in_progress',
      homeScore: 1,
      awayScore: 2,
    });
    const backToScheduled = await h.inject({
      method: 'POST',
      url: resultPath,
      headers: WRITE_HEADERS,
      payload: { status: 'scheduled' },
    });
    expect(CompetitionMatchSchema.parse(backToScheduled.json())).toMatchObject({
      status: 'scheduled',
      homeScore: 1,
      awayScore: 2,
    });
    const reload = CompetitionMatchSchema.parse(
      (await h.inject({ method: 'GET', url: `${base}/matches/${match.id}`, headers: READ_HEADERS })).json(),
    );
    expect(reload).toMatchObject({ status: 'scheduled', homeScore: 1, awayScore: 2 });

    const scoreHistory = MatchResultHistoryListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
      ).json(),
    ).history;
    expect(scoreHistory.map((item) => [item.status, item.homeScore, item.awayScore])).toEqual([
      ['scheduled', null, null],
      ['cancelled', 1, 2],
      ['in_progress', 1, 2],
      ['scheduled', 1, 2],
    ]);
  });

  it('distinguishes no result from 0–0 and rejects negative or fractional scores', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Marcadores válidos' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const teams = await Promise.all(
      ['Local 0-0', 'Visitante 0-0'].map(async (name) =>
        ManagedTeamSchema.parse(
          (await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name } })).json(),
        ),
      ),
    );
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    for (const team of teams)
      await h.inject({
        method: 'POST',
        url: `${base}/participants`,
        headers: WRITE_HEADERS,
        payload: { teamId: team.id },
      });
    const match = CompetitionMatchSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/matches`,
          headers: WRITE_HEADERS,
          payload: { homeTeamId: teams[0]!.id, awayTeamId: teams[1]!.id },
        })
      ).json(),
    );
    expect(match).toMatchObject({ homeScore: null, awayScore: null });
    const path = `${base}/matches/${match.id}/result`;
    const zero = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { status: 'scheduled', homeScore: 0, awayScore: 0 },
    });
    expect(CompetitionMatchSchema.parse(zero.json())).toMatchObject({
      status: 'scheduled',
      homeScore: 0,
      awayScore: 0,
    });
    const nonzero = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { status: 'cancelled', homeScore: 2, awayScore: 1 },
    });
    expect(CompetitionMatchSchema.parse(nonzero.json())).toMatchObject({
      status: 'cancelled',
      homeScore: 2,
      awayScore: 1,
    });
    const correctedToZero = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { status: 'cancelled', homeScore: 0, awayScore: 0 },
    });
    expect(CompetitionMatchSchema.parse(correctedToZero.json())).toMatchObject({
      status: 'cancelled',
      homeScore: 0,
      awayScore: 0,
    });
    expect(
      CompetitionMatchSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches/${match.id}`, headers: READ_HEADERS })).json(),
      ),
    ).toMatchObject({ homeScore: 0, awayScore: 0 });
    for (const scores of [
      { homeScore: -1, awayScore: 0 },
      { homeScore: 1.5, awayScore: 0 },
    ]) {
      const invalid = await h.inject({
        method: 'POST',
        url: path,
        headers: WRITE_HEADERS,
        payload: { status: 'scheduled', ...scores },
      });
      expect(invalid.statusCode).toBe(400);
      expect(ProblemSchema.parse(invalid.json()).code).toBe('VALIDATION_FAILED');
    }
    const history = MatchResultHistoryListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
      ).json(),
    ).history;
    expect(history.map((item) => [item.status, item.homeScore, item.awayScore])).toEqual([
      ['scheduled', null, null],
      ['scheduled', 0, 0],
      ['cancelled', 2, 1],
      ['cancelled', 0, 0],
    ]);
  });

  it('retains match identity and result history when a match is rescheduled', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Torneo Local' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const teams = await Promise.all(
      ['Local', 'Visitante'].map(async (name) => {
        const response = await h!.inject({
          method: 'POST',
          url: '/api/v1/teams',
          headers: WRITE_HEADERS,
          payload: { name },
        });
        return ManagedTeamSchema.parse(response.json());
      }),
    );
    for (const team of teams)
      await h.inject({
        method: 'POST',
        url: `/api/v1/competitions/${competition.id}/seasons/${season.id}/participants`,
        headers: WRITE_HEADERS,
        payload: { teamId: team.id },
      });
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    const match = CompetitionMatchSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/matches`,
          headers: WRITE_HEADERS,
          payload: { homeTeamId: teams[0]!.id, awayTeamId: teams[1]!.id },
        })
      ).json(),
    );
    const updated = CompetitionMatchSchema.parse(
      (
        await h.inject({
          method: 'PATCH',
          url: `${base}/matches/${match.id}/schedule`,
          headers: WRITE_HEADERS,
          payload: { kickoffAt: '2027-06-01T19:30:00Z' },
        })
      ).json(),
    );
    expect(updated.id).toBe(match.id);
    expect(updated.status).toBe('scheduled');
    expect(updated.homeScore).toBeNull();
    const history = MatchResultHistoryListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
      ).json(),
    );
    expect(history.history.map((item) => item.changeType)).toEqual(['created', 'schedule_updated']);
    expect(history.history[0]?.kickoffAt).toBeNull();
    expect(history.history[1]?.kickoffAt).toBe(updated.kickoffAt);
  });

  it('renames phases and rounds without changing identity or allowing duplicates', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Copa de prueba' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const otherSeason = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2028' },
        })
      ).json(),
    );
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    const otherBase = `/api/v1/competitions/${competition.id}/seasons/${otherSeason.id}`;
    const stage = CompetitionStageSchema.parse(
      (
        await h.inject({ method: 'POST', url: `${base}/stages`, headers: WRITE_HEADERS, payload: { name: 'Apertura' } })
      ).json(),
    );
    const duplicateStage = CompetitionStageSchema.parse(
      (
        await h.inject({ method: 'POST', url: `${base}/stages`, headers: WRITE_HEADERS, payload: { name: 'Clausura' } })
      ).json(),
    );
    const renamedStage = CompetitionStageSchema.parse(
      (
        await h.inject({
          method: 'PATCH',
          url: `${base}/stages/${duplicateStage.id}`,
          headers: WRITE_HEADERS,
          payload: { name: 'Fase principal' },
        })
      ).json(),
    );
    expect(renamedStage.id).toBe(duplicateStage.id);
    expect(renamedStage.name).toBe('Fase principal');
    const duplicateStageName = await h.inject({
      method: 'PATCH',
      url: `${base}/stages/${stage.id}`,
      headers: WRITE_HEADERS,
      payload: { name: ' fase principal ' },
    });
    expect(duplicateStageName.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicateStageName.json()).code).toBe('DUPLICATE_STAGE');
    expect(
      (
        await h.inject({
          method: 'PATCH',
          url: `${otherBase}/stages/${stage.id}`,
          headers: WRITE_HEADERS,
          payload: { name: 'Fase ajena' },
        })
      ).statusCode,
    ).toBe(404);

    const directRound = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada 1' },
        })
      ).json(),
    );
    const duplicateRound = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada 2' },
        })
      ).json(),
    );
    const renamedRound = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'PATCH',
          url: `${base}/rounds/${duplicateRound.id}`,
          headers: WRITE_HEADERS,
          payload: { name: 'Fecha inicial' },
        })
      ).json(),
    );
    expect(renamedRound.id).toBe(duplicateRound.id);
    expect(renamedRound.name).toBe('Fecha inicial');
    const duplicateRoundName = await h.inject({
      method: 'PATCH',
      url: `${base}/rounds/${directRound.id}`,
      headers: WRITE_HEADERS,
      payload: { name: ' fecha inicial ' },
    });
    expect(duplicateRoundName.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicateRoundName.json()).code).toBe('DUPLICATE_ROUND');
    expect(
      (
        await h.inject({
          method: 'PATCH',
          url: `${otherBase}/rounds/${directRound.id}`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada ajena' },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('moves an existing round between phases and directly under its season while preserving matches, results and history', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Torneo de traslado' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const otherSeason = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2028' },
        })
      ).json(),
    );
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    const otherBase = `/api/v1/competitions/${competition.id}/seasons/${otherSeason.id}`;
    const phases = await Promise.all(
      ['Fase A', 'Fase B'].map(async (name) =>
        CompetitionStageSchema.parse(
          (
            await h!.inject({ method: 'POST', url: `${base}/stages`, headers: WRITE_HEADERS, payload: { name } })
          ).json(),
        ),
      ),
    );
    const foreignPhase = CompetitionStageSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${otherBase}/stages`,
          headers: WRITE_HEADERS,
          payload: { name: 'Fase externa' },
        })
      ).json(),
    );
    const teams = await Promise.all(
      ['Local traslado', 'Visitante traslado'].map(async (name) =>
        ManagedTeamSchema.parse(
          (await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name } })).json(),
        ),
      ),
    );
    for (const team of teams)
      await h.inject({
        method: 'POST',
        url: `${base}/participants`,
        headers: WRITE_HEADERS,
        payload: { teamId: team.id },
      });
    const round = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada 18' },
        })
      ).json(),
    );
    const match = CompetitionMatchSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/matches`,
          headers: WRITE_HEADERS,
          payload: {
            homeTeamId: teams[0]!.id,
            awayTeamId: teams[1]!.id,
            roundId: round.id,
            kickoffAt: '2027-08-01T18:00:00Z',
          },
        })
      ).json(),
    );
    await h.inject({
      method: 'POST',
      url: `${base}/matches/${match.id}/result`,
      headers: WRITE_HEADERS,
      payload: { status: 'finished', homeScore: 2, awayScore: 1 },
    });

    const firstMove = await h.inject({
      method: 'PATCH',
      url: `${base}/rounds/${round.id}`,
      headers: WRITE_HEADERS,
      payload: { stageId: phases[0]!.id },
    });
    expect(firstMove.statusCode).toBe(200);
    expect(CompetitionRoundSchema.parse(firstMove.json())).toMatchObject({
      id: round.id,
      stageId: phases[0]!.id,
      name: 'Jornada 18',
    });
    const firstMatch = CompetitionMatchSchema.parse(
      (await h.inject({ method: 'GET', url: `${base}/matches/${match.id}`, headers: READ_HEADERS })).json(),
    );
    expect(firstMatch).toMatchObject({
      id: match.id,
      stage: { id: phases[0]!.id },
      round: { id: round.id },
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    });

    const collision = await h.inject({
      method: 'POST',
      url: `${base}/stages/${phases[1]!.id}/rounds`,
      headers: WRITE_HEADERS,
      payload: { name: 'Jornada 18' },
    });
    expect(collision.statusCode).toBe(201);
    const duplicateMove = await h.inject({
      method: 'PATCH',
      url: `${base}/rounds/${round.id}`,
      headers: WRITE_HEADERS,
      payload: { stageId: phases[1]!.id },
    });
    expect(duplicateMove.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicateMove.json()).code).toBe('DUPLICATE_ROUND');

    const secondMove = await h.inject({
      method: 'PATCH',
      url: `${base}/rounds/${round.id}`,
      headers: WRITE_HEADERS,
      payload: { stageId: phases[1]!.id, name: 'Jornada 18 Fase B' },
    });
    expect(secondMove.statusCode).toBe(200);
    const ungrouped = await h.inject({
      method: 'PATCH',
      url: `${base}/rounds/${round.id}`,
      headers: WRITE_HEADERS,
      payload: { stageId: null },
    });
    expect(CompetitionRoundSchema.parse(ungrouped.json())).toMatchObject({
      id: round.id,
      stageId: null,
      name: 'Jornada 18 Fase B',
    });
    const finalMatch = CompetitionMatchSchema.parse(
      (await h.inject({ method: 'GET', url: `${base}/matches/${match.id}`, headers: READ_HEADERS })).json(),
    );
    expect(finalMatch).toMatchObject({
      id: match.id,
      stage: null,
      round: { id: round.id },
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    });
    const history = MatchResultHistoryListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: `${base}/matches/${match.id}/result-history`, headers: READ_HEADERS })
      ).json(),
    );
    expect(history.history.map((entry) => entry.changeType)).toEqual([
      'created',
      'result_recorded',
      'schedule_updated',
      'schedule_updated',
      'schedule_updated',
    ]);
    expect(history.history.slice(-3).map((entry) => ({ stageId: entry.stageId, roundId: entry.roundId }))).toEqual([
      { stageId: phases[0]!.id, roundId: round.id },
      { stageId: phases[1]!.id, roundId: round.id },
      { stageId: null, roundId: round.id },
    ]);

    const crossSeason = await h.inject({
      method: 'PATCH',
      url: `${base}/rounds/${round.id}`,
      headers: WRITE_HEADERS,
      payload: { stageId: foreignPhase.id },
    });
    expect(crossSeason.statusCode).toBe(404);
    expect(ProblemSchema.parse(crossSeason.json()).code).toBe('NOT_FOUND');
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('deletes only empty rounds and preserves rounds referenced by matches or history', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = (
      await h.inject({
        method: 'POST',
        url: '/api/v1/competitions',
        headers: WRITE_HEADERS,
        payload: { name: 'Calendario sin cascadas' },
      })
    ).json() as { id: string };
    const season = ManagedSeasonSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: WRITE_HEADERS,
          payload: { label: '2027' },
        })
      ).json(),
    );
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}`;
    const headers = { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' };
    const empty = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada vacía' },
        })
      ).json(),
    );
    expect((await h.inject({ method: 'DELETE', url: `${base}/rounds/${empty.id}`, headers })).statusCode).toBe(204);
    const teams = await Promise.all(
      ['Local protegido', 'Visitante protegido'].map(async (name) =>
        ManagedTeamSchema.parse(
          (await h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name } })).json(),
        ),
      ),
    );
    for (const team of teams)
      await h.inject({
        method: 'POST',
        url: `${base}/participants`,
        headers: WRITE_HEADERS,
        payload: { teamId: team.id },
      });
    const inUse = CompetitionRoundSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/rounds`,
          headers: WRITE_HEADERS,
          payload: { name: 'Jornada con partido' },
        })
      ).json(),
    );
    const match = CompetitionMatchSchema.parse(
      (
        await h.inject({
          method: 'POST',
          url: `${base}/matches`,
          headers: WRITE_HEADERS,
          payload: { homeTeamId: teams[0]!.id, awayTeamId: teams[1]!.id, roundId: inUse.id },
        })
      ).json(),
    );
    const blocked = await h.inject({ method: 'DELETE', url: `${base}/rounds/${inUse.id}`, headers });
    expect(blocked.statusCode).toBe(409);
    expect(ProblemSchema.parse(blocked.json()).code).toBe('ROUND_HAS_MATCHES');
    expect(
      CompetitionMatchSchema.parse(
        (await h.inject({ method: 'GET', url: `${base}/matches/${match.id}`, headers: READ_HEADERS })).json(),
      ).round?.id,
    ).toBe(inUse.id);
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
