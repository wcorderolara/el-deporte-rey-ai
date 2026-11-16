import {
  ManagedSeasonListResponseSchema,
  ManagedSeasonSchema,
  ManagedTeamListResponseSchema,
  ManagedTeamSchema,
  CompetitionTeamListResponseSchema,
  CompetitionTeamSchema,
  ProblemSchema,
  SeasonParticipantListResponseSchema,
  SeasonParticipantSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { READ_HEADERS, WRITE_HEADERS, projectsTestApp, type ProjectsTestApp } from '../projects/test/support.js';

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

async function createCompetition(name: string) {
  const response = await h!.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string; name: string };
}

async function createSeason(competitionId: string, label: string) {
  return h!.inject({
    method: 'POST',
    url: `/api/v1/competitions/${competitionId}/seasons`,
    headers: WRITE_HEADERS,
    payload: { label },
  });
}

async function createTeam(name: string, region: string | null = null) {
  return h!.inject({ method: 'POST', url: '/api/v1/teams', headers: WRITE_HEADERS, payload: { name, region } });
}

describe('competition seasons, local teams and participants', () => {
  it('updates a global team without changing competition associations and rejects duplicates', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga de equipos editables');
    const firstTeam = ManagedTeamSchema.parse((await createTeam('Equipo Original', 'Ciudad A')).json());
    const duplicateTeam = ManagedTeamSchema.parse((await createTeam('Equipo Existente', 'Ciudad B')).json());
    const membership = `/api/v1/competitions/${competition.id}/teams`;
    await h.inject({ method: 'POST', url: membership, headers: WRITE_HEADERS, payload: { teamId: firstTeam.id } });

    const updated = await h.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${firstTeam.id}`,
      headers: WRITE_HEADERS,
      payload: { name: 'Equipo Renombrado', region: 'Ciudad C' },
    });
    expect(ManagedTeamSchema.parse(updated.json())).toMatchObject({
      id: firstTeam.id,
      name: 'Equipo Renombrado',
      region: 'Ciudad C',
    });
    expect(
      CompetitionTeamListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: membership, headers: READ_HEADERS })).json(),
      ).teams.map((item) => item.team.id),
    ).toEqual([firstTeam.id]);

    const duplicate = await h.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${firstTeam.id}`,
      headers: WRITE_HEADERS,
      payload: { name: duplicateTeam.name, region: duplicateTeam.region },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicate.json()).code).toBe('DUPLICATE_TEAM');
    expect(
      ManagedTeamSchema.parse(
        (await h.inject({ method: 'GET', url: `/api/v1/teams/${firstTeam.id}`, headers: READ_HEADERS })).json(),
      ).name,
    ).toBe('Equipo Renombrado');
  });

  it('stores an optional presentation name: omitted keeps it, null removes it, a value is normalized and blank or long values are refused (TEAM-DISPLAY-01)', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const patch = (teamId: string, payload: Record<string, unknown>) =>
      h!.inject({ method: 'PATCH', url: `/api/v1/teams/${teamId}`, headers: WRITE_HEADERS, payload });
    const get = async (teamId: string) =>
      ManagedTeamSchema.parse(
        (await h!.inject({ method: 'GET', url: `/api/v1/teams/${teamId}`, headers: READ_HEADERS })).json(),
      );

    // A team created without one has none; one created with one keeps the official name as its identity.
    const plain = ManagedTeamSchema.parse((await createTeam('Club Sintético Sin Alias')).json());
    expect(plain.displayName).toBeNull();
    const created = await h.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: WRITE_HEADERS,
      payload: { name: 'Club Sintético de la Ciudad Ficticia', region: null, displayName: '  Ficticia   CF ' },
    });
    expect(created.statusCode, created.body).toBe(201);
    const team = ManagedTeamSchema.parse(created.json());
    expect(team).toMatchObject({ name: 'Club Sintético de la Ciudad Ficticia', displayName: 'Ficticia CF' });

    // Omitted: kept (an import never sends it). Name and region change as before.
    const renamed = await patch(team.id, { name: 'Club Sintético Ficticio', region: 'Ciudad Ficticia' });
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(ManagedTeamSchema.parse(renamed.json())).toMatchObject({
      name: 'Club Sintético Ficticio',
      region: 'Ciudad Ficticia',
      displayName: 'Ficticia CF',
    });
    // A value replaces it; null removes it.
    expect(
      ManagedTeamSchema.parse(
        (
          await patch(team.id, { name: 'Club Sintético Ficticio', region: 'Ciudad Ficticia', displayName: 'Ficticio' })
        ).json(),
      ).displayName,
    ).toBe('Ficticio');
    expect(
      ManagedTeamSchema.parse(
        (
          await patch(team.id, { name: 'Club Sintético Ficticio', region: 'Ciudad Ficticia', displayName: null })
        ).json(),
      ).displayName,
    ).toBeNull();

    // Blank, too long, outside the name characters or an unknown field: refused, nothing changes.
    await patch(team.id, { name: 'Club Sintético Ficticio', region: 'Ciudad Ficticia', displayName: 'Ficticio' });
    for (const displayName of ['   ', '', 'x'.repeat(33), 'Ficticio 🏆', 'Ficticio<script>']) {
      const refused = await patch(team.id, { name: 'Club Sintético Ficticio', region: 'Ciudad Ficticia', displayName });
      expect(refused.statusCode, JSON.stringify(displayName)).toBe(400);
      expect(ProblemSchema.parse(refused.json()).code).toBe('VALIDATION_FAILED');
    }
    const blank = await patch(team.id, {
      name: 'Club Sintético Ficticio',
      region: 'Ciudad Ficticia',
      displayName: '  ',
    });
    expect(ProblemSchema.parse(blank.json()).errors).toEqual([
      { path: '/displayName', message: 'El nombre para mostrar debe contener texto o quitarse.' },
    ]);
    expect(await get(team.id)).toMatchObject({ name: 'Club Sintético Ficticio', displayName: 'Ficticio' });

    // It takes no part in the identity: two teams may share one, and the duplicate rule is still by name and region.
    const other = await h.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: WRITE_HEADERS,
      payload: { name: 'Club Sintético Otro', displayName: 'Ficticio' },
    });
    expect(other.statusCode, other.body).toBe(201);
    const duplicate = await h.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: WRITE_HEADERS,
      payload: { name: 'Club Sintético Ficticio', region: 'Ciudad Ficticia', displayName: 'Distinto' },
    });
    expect(duplicate.statusCode).toBe(409);

    // The quick creation from a competition keeps its earlier body: no presentation name there.
    const competition = await createCompetition('Liga Sintética de Alias');
    const quick = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competition.id}/teams`,
      headers: WRITE_HEADERS,
      payload: { name: 'Club Sintético Rápido', displayName: 'Rápido' },
    });
    expect(quick.statusCode).toBe(400);
    const listed = ManagedTeamListResponseSchema.parse(
      (await h.inject({ method: 'GET', url: '/api/v1/teams', headers: READ_HEADERS })).json(),
    ).teams;
    expect(listed.find((item) => item.id === plain.id)?.displayName).toBeNull();
    expect(listed.find((item) => item.id === team.id)?.displayName).toBe('Ficticio');
  });

  it('removes only an unused competition team association and blocks teams with season participation', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga para desvincular');
    const team = ManagedTeamSchema.parse((await createTeam('Equipo Desvinculable')).json());
    const associationPath = `/api/v1/competitions/${competition.id}/teams/${team.id}`;
    await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competition.id}/teams`,
      headers: WRITE_HEADERS,
      payload: { teamId: team.id },
    });
    const removed = await h.inject({
      method: 'DELETE',
      url: associationPath,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(removed.statusCode).toBe(204);
    expect(
      CompetitionTeamListResponseSchema.parse(
        (
          await h.inject({ method: 'GET', url: `/api/v1/competitions/${competition.id}/teams`, headers: READ_HEADERS })
        ).json(),
      ).teams,
    ).toEqual([]);
    expect(
      ManagedTeamSchema.parse(
        (await h.inject({ method: 'GET', url: `/api/v1/teams/${team.id}`, headers: READ_HEADERS })).json(),
      ).id,
    ).toBe(team.id);

    const participantTeam = ManagedTeamSchema.parse((await createTeam('Equipo Participante')).json());
    const season = ManagedSeasonSchema.parse((await createSeason(competition.id, '2026')).json());
    const participantPath = `/api/v1/competitions/${competition.id}/seasons/${season.id}/participants`;
    await h.inject({
      method: 'POST',
      url: participantPath,
      headers: WRITE_HEADERS,
      payload: { teamId: participantTeam.id },
    });
    const blocked = await h.inject({
      method: 'DELETE',
      url: `/api/v1/competitions/${competition.id}/teams/${participantTeam.id}`,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(blocked.statusCode).toBe(409);
    expect(ProblemSchema.parse(blocked.json()).code).toBe('COMPETITION_TEAM_IN_USE');
    expect(
      CompetitionTeamListResponseSchema.parse(
        (
          await h.inject({ method: 'GET', url: `/api/v1/competitions/${competition.id}/teams`, headers: READ_HEADERS })
        ).json(),
      ).teams.map((item) => item.team.id),
    ).toContain(participantTeam.id);
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('associates reusable catalogue teams with competitions and creates new teams atomically', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga de equipos');
    const otherCompetition = await createCompetition('Copa de equipos');
    const existing = ManagedTeamSchema.parse((await createTeam('Club Reutilizable', 'Ciudad')).json());
    const path = `/api/v1/competitions/${competition.id}/teams`;
    const linked = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { teamId: existing.id },
    });
    expect(linked.statusCode).toBe(201);
    expect(CompetitionTeamSchema.parse(linked.json()).team.id).toBe(existing.id);
    expect(
      (await h.inject({ method: 'POST', url: path, headers: WRITE_HEADERS, payload: { teamId: existing.id } }))
        .statusCode,
    ).toBe(409);

    const created = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { name: 'Nuevo Club', region: null },
    });
    expect(created.statusCode).toBe(201);
    const newTeam = CompetitionTeamSchema.parse(created.json()).team;
    expect(newTeam.name).toBe('Nuevo Club');
    const anotherLink = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${otherCompetition.id}/teams`,
      headers: WRITE_HEADERS,
      payload: { teamId: existing.id },
    });
    expect(anotherLink.statusCode).toBe(201);
    const listed = CompetitionTeamListResponseSchema.parse(
      (await h.inject({ method: 'GET', url: path, headers: READ_HEADERS })).json(),
    ).teams.map((item) => item.team.id);
    expect(listed).toHaveLength(2);
    expect(listed).toEqual(expect.arrayContaining([newTeam.id, existing.id]));
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('adds multiple competition teams to a season transactionally and rejects the whole batch on invalid membership', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga por lotes');
    const season = ManagedSeasonSchema.parse((await createSeason(competition.id, '2026')).json());
    const first = ManagedTeamSchema.parse((await createTeam('Club Lote Uno')).json());
    const second = ManagedTeamSchema.parse((await createTeam('Club Lote Dos')).json());
    const unassociated = ManagedTeamSchema.parse((await createTeam('Club No Asociado')).json());
    await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competition.id}/teams`,
      headers: WRITE_HEADERS,
      payload: { teamId: first.id },
    });
    await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${competition.id}/teams`,
      headers: WRITE_HEADERS,
      payload: { teamId: second.id },
    });
    const base = `/api/v1/competitions/${competition.id}/seasons/${season.id}/participants`;
    const added = await h.inject({
      method: 'POST',
      url: `${base}/batch`,
      headers: WRITE_HEADERS,
      payload: { teamIds: [first.id, second.id] },
    });
    expect(added.statusCode).toBe(201);
    expect(SeasonParticipantListResponseSchema.parse(added.json()).participants).toHaveLength(2);
    const rejected = await h.inject({
      method: 'POST',
      url: `${base}/batch`,
      headers: WRITE_HEADERS,
      payload: { teamIds: [unassociated.id, first.id] },
    });
    expect(rejected.statusCode).toBe(400);
    expect(
      h.db
        .prepare<{ count: number }>('SELECT COUNT(*) AS count FROM season_participants WHERE season_id = ?')
        .get([season.id])?.count,
    ).toBe(2);
  });

  it('keeps multiple season labels, rejects normalized duplicates only within their competition, and retrieves seasons', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga Local');
    const otherCompetition = await createCompetition('Copa Local');

    const first = ManagedSeasonSchema.parse((await createSeason(competition.id, '2026/27')).json());
    const second = ManagedSeasonSchema.parse((await createSeason(competition.id, '2027')).json());
    expect(first.label).toBe('2026/27');
    expect(second.label).toBe('2027');
    const duplicate = await createSeason(competition.id, ' 2026/27 ');
    expect(duplicate.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicate.json()).code).toBe('DUPLICATE_SEASON');
    const blank = await createSeason(competition.id, '   ');
    expect(blank.statusCode).toBe(400);
    expect(ProblemSchema.parse(blank.json()).code).toBe('VALIDATION_FAILED');

    const sameLabelElsewhere = ManagedSeasonSchema.parse((await createSeason(otherCompetition.id, '2026/27')).json());
    expect(sameLabelElsewhere.competitionId).toBe(otherCompetition.id);
    const list = ManagedSeasonListResponseSchema.parse(
      (
        await h.inject({
          method: 'GET',
          url: `/api/v1/competitions/${competition.id}/seasons`,
          headers: READ_HEADERS,
        })
      ).json(),
    );
    expect(list.seasons.map((season) => season.label).sort()).toEqual(['2026/27', '2027']);
    expect(
      ManagedSeasonSchema.parse(
        (
          await h.inject({
            method: 'GET',
            url: `/api/v1/competitions/${competition.id}/seasons/${first.id}`,
            headers: READ_HEADERS,
          })
        ).json(),
      ),
    ).toEqual(first);
    expect(h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competition_seasons').get()?.count).toBe(3);
    expect(h.stub.count('demo-a', 'listCompetitions')).toBe(0);
    expect(h.stub.targetedCalls()).toBe(0);
  });

  it('renames a season without changing its identity and rejects duplicate labels', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga para editar');
    const first = ManagedSeasonSchema.parse((await createSeason(competition.id, '2026/27')).json());
    const second = ManagedSeasonSchema.parse((await createSeason(competition.id, '2027')).json());
    const path = `/api/v1/competitions/${competition.id}/seasons/${first.id}`;
    const updated = await h.inject({
      method: 'PATCH',
      url: path,
      headers: WRITE_HEADERS,
      payload: { label: 'Apertura 2026' },
    });
    expect(ManagedSeasonSchema.parse(updated.json())).toMatchObject({
      id: first.id,
      competitionId: competition.id,
      label: 'Apertura 2026',
    });
    const duplicate = await h.inject({
      method: 'PATCH',
      url: path,
      headers: WRITE_HEADERS,
      payload: { label: second.label },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicate.json()).code).toBe('DUPLICATE_SEASON');
  });

  it('stores reusable local teams, blocks exact normalized duplicates, and leaves similar identities distinct', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const first = ManagedTeamSchema.parse((await createTeam('Club Local', 'Zona Centro')).json());
    const duplicate = await createTeam(' club   local ', ' zona centro ');
    expect(duplicate.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicate.json()).code).toBe('DUPLICATE_TEAM');
    const blankName = await createTeam('   ');
    expect(blankName.statusCode).toBe(400);
    expect(ProblemSchema.parse(blankName.json()).code).toBe('VALIDATION_FAILED');

    const similar = ManagedTeamSchema.parse((await createTeam('Club Local FC', 'Zona Centro')).json());
    const sameNameDifferentRegion = ManagedTeamSchema.parse((await createTeam('Club Local', 'Zona Sur')).json());
    expect(similar.id).not.toBe(first.id);
    expect(sameNameDifferentRegion.id).not.toBe(first.id);
    expect(
      ManagedTeamSchema.parse(
        (
          await h.inject({
            method: 'GET',
            url: `/api/v1/teams/${first.id}`,
            headers: READ_HEADERS,
          })
        ).json(),
      ),
    ).toEqual(first);
    expect(
      ManagedTeamListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: '/api/v1/teams', headers: READ_HEADERS })).json(),
      ).teams,
    ).toHaveLength(3);
    expect(h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM teams').get()?.count).toBe(0);
  });

  it('prevents duplicate membership, reuses teams across seasons and removes only the association', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const competition = await createCompetition('Liga de prueba');
    const anotherCompetition = await createCompetition('Copa de prueba');
    const season = ManagedSeasonSchema.parse((await createSeason(competition.id, '2026/27')).json());
    const anotherSeason = ManagedSeasonSchema.parse((await createSeason(anotherCompetition.id, '2027')).json());
    const team = ManagedTeamSchema.parse((await createTeam('Equipo Reutilizable', 'Ciudad')).json());
    const membershipPath = `/api/v1/competitions/${competition.id}/seasons/${season.id}/participants`;

    const joined = await h.inject({
      method: 'POST',
      url: membershipPath,
      headers: WRITE_HEADERS,
      payload: { teamId: team.id },
    });
    expect(joined.statusCode).toBe(201);
    expect(SeasonParticipantSchema.parse(joined.json()).team.id).toBe(team.id);
    const repeated = await h.inject({
      method: 'POST',
      url: membershipPath,
      headers: WRITE_HEADERS,
      payload: { teamId: team.id },
    });
    expect(repeated.statusCode).toBe(409);
    expect(ProblemSchema.parse(repeated.json()).code).toBe('DUPLICATE_PARTICIPANT');

    const reused = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${anotherCompetition.id}/seasons/${anotherSeason.id}/participants`,
      headers: WRITE_HEADERS,
      payload: { teamId: team.id },
    });
    expect(reused.statusCode).toBe(201);
    const participants = SeasonParticipantListResponseSchema.parse(
      (await h.inject({ method: 'GET', url: membershipPath, headers: READ_HEADERS })).json(),
    );
    expect(participants.participants.map((item) => item.team.id)).toEqual([team.id]);

    const removed = await h.inject({
      method: 'DELETE',
      url: `${membershipPath}/${team.id}`,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(removed.statusCode).toBe(204);
    expect(
      SeasonParticipantListResponseSchema.parse(
        (await h.inject({ method: 'GET', url: membershipPath, headers: READ_HEADERS })).json(),
      ).participants,
    ).toEqual([]);
    expect(
      ManagedTeamSchema.parse(
        (await h.inject({ method: 'GET', url: `/api/v1/teams/${team.id}`, headers: READ_HEADERS })).json(),
      ).id,
    ).toBe(team.id);
    expect(h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM season_participants').get()?.count).toBe(1);
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('returns not found for missing parents and teams rather than creating dangling links', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const response = await h.inject({
      method: 'POST',
      url: '/api/v1/competitions/11111111-1111-4111-8111-111111111111/seasons/22222222-2222-4222-8222-222222222222/participants',
      headers: WRITE_HEADERS,
      payload: { teamId: '33333333-3333-4333-8333-333333333333' },
    });
    expect(response.statusCode).toBe(404);
    expect(ProblemSchema.parse(response.json()).code).toBe('NOT_FOUND');
    expect(h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM season_participants').get()?.count).toBe(0);
  });
});
