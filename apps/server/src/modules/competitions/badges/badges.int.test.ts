/**
 * Integration tests of team badges (PD-ARCH-01G-D; PD-28) on a temporary app: manual upload of PNG and JPEG files with
 * a declared source and a confirmed authorization, the upload checks (signature, declared type, header, dimensions,
 * size, decode), the confined files with their hash, replacement and retirement with the history kept, the badge in
 * every team listing (teams, competition teams, participants, matches), and persistence after a restart. No URL is
 * accepted and nothing is downloaded.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  CompetitionMatchListResponseSchema,
  CompetitionTeamListResponseSchema,
  ManagedTeamListResponseSchema,
  ManagedTeamSchema,
  SeasonParticipantListResponseSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { type TestApp, startTestApp } from '../../../../test/support/index.js';
import { jpeg, png } from '../../brand/test/images.js';

const apps: TestApp[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

async function start(dataDir?: string): Promise<TestApp> {
  const app = await startTestApp(dataDir === undefined ? {} : { dataDir });
  apps.push(app);
  return app;
}

function upload(
  app: TestApp,
  teamId: string,
  payload: Buffer,
  options: { contentType?: string; query?: Record<string, string> } = {},
) {
  return app.inject({
    method: 'PUT',
    url: `/api/v1/teams/${teamId}/badge`,
    query: options.query ?? { source: 'Sitio oficial del club', authorized: 'true' },
    headers: {
      host: app.host,
      origin: app.origin,
      'x-edr-client': 'web',
      'content-type': options.contentType ?? 'image/png',
    },
    payload,
  });
}

async function team(app: TestApp, name = 'Club Escudo'): Promise<string> {
  const response = await app.send('POST', '/teams', { name });
  expect(response.statusCode, response.body).toBe(201);
  return (response.json() as { id: string }).id;
}

function badgeFiles(app: TestApp): string[] {
  try {
    return readdirSync(join(app.container.paths.dataDir, 'team-badges')).sort();
  } catch {
    return [];
  }
}

describe('team badge upload (PD-28)', () => {
  it('stores a PNG or JPEG badge with its source, serves it with its hash and keeps the history on replacement', async () => {
    const app = await start();
    const teamId = await team(app);
    const first = png({ width: 120, height: 100, rgba: [200, 30, 40, 200] });
    const response = await upload(app, teamId, first);
    expect(response.statusCode, response.body).toBe(200);
    const withBadge = ManagedTeamSchema.parse(response.json());
    expect(withBadge.badge).toMatchObject({
      origin: 'manual',
      source: 'Sitio oficial del club',
      mime: 'image/png',
      width: 120,
      height: 100,
    });
    const file = await app.get(`/teams/${teamId}/badge`);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(file.rawPayload.equals(first)).toBe(true);

    const second = jpeg();
    const replaced = ManagedTeamSchema.parse(
      (
        await upload(app, teamId, second, {
          contentType: 'image/jpeg',
          query: { source: 'Federación', authorized: 'true' },
        })
      ).json(),
    );
    expect(replaced.badge?.id).not.toBe(withBadge.badge?.id);
    expect(replaced.badge).toMatchObject({ mime: 'image/jpeg', source: 'Federación' });
    expect((await app.get(`/teams/${teamId}/badge`)).rawPayload.equals(second)).toBe(true);
    // The previous badge is retired and kept (row and file) for the projects that used it.
    const rows = app.container.db
      .prepare<{ id: string; status: string }>(
        'SELECT id, status FROM team_badges WHERE team_id = ? ORDER BY created_at, id',
      )
      .all([teamId]);
    expect(rows.map((row) => row.status).sort()).toEqual(['active', 'retired']);
    expect(badgeFiles(app)).toHaveLength(2);

    const retired = await app.send('DELETE', `/teams/${teamId}/badge`);
    expect(ManagedTeamSchema.parse(retired.json()).badge).toBeNull();
    expect((await app.get(`/teams/${teamId}/badge`)).statusCode).toBe(404);
    expect((await app.send('DELETE', `/teams/${teamId}/badge`)).statusCode).toBe(404);
    expect(badgeFiles(app)).toHaveLength(2);
  });

  it('refuses SVG, WebP, a mismatched type, a broken or oversized image, a missing source or authorization, and an unknown team', async () => {
    const app = await start();
    const teamId = await team(app);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const cases: [Buffer, { contentType?: string; query?: Record<string, string> }, number][] = [
      [svg, { contentType: 'image/svg+xml' }, 415],
      [Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '), { contentType: 'image/webp' }, 415],
      [png(), { contentType: 'image/jpeg' }, 415],
      [Buffer.concat([png().subarray(0, 40)]), {}, 400],
      [png({ width: 4097, height: 2 }), {}, 400],
      [png(), { query: { authorized: 'true' } }, 400],
      [png(), { query: { source: 'Club' } }, 400],
      [png(), { query: { source: 'Club', authorized: 'false' } }, 400],
    ];
    for (const [payload, options, status] of cases) {
      const response = await upload(app, teamId, payload, options);
      expect(response.statusCode, `${String(status)} ${response.body}`).toBe(status);
    }
    expect(app.container.db.prepare<{ n: number }>('SELECT count(*) AS n FROM team_badges').get()?.n).toBe(0);
    expect(badgeFiles(app)).toEqual([]);
    const unknown = await upload(app, '00000000-0000-4000-8000-000000000777', png());
    expect(unknown.statusCode).toBe(404);
  });
});

describe('badges in the sports data', () => {
  it('shows the active badge in teams, competition teams, participants and matches, and keeps it after a restart', async () => {
    const app = await start();
    const competition = (await app.send('POST', '/competitions', { name: 'Liga Escudos' })).json() as { id: string };
    const season = (await app.send('POST', `/competitions/${competition.id}/seasons`, { label: '2026/27' })).json() as {
      id: string;
    };
    const base = `/competitions/${competition.id}/seasons/${season.id}`;
    const home = await team(app, 'Club Local Escudo');
    const away = await team(app, 'Club Visitante Escudo');
    for (const teamId of [home, away]) {
      await app.send('POST', `/competitions/${competition.id}/teams`, { teamId });
      await app.send('POST', `${base}/participants`, { teamId });
    }
    await app.send('POST', `${base}/matches`, { homeTeamId: home, awayTeamId: away });
    const badge = ManagedTeamSchema.parse((await upload(app, home, png({ rgba: [20, 40, 160, 255] }))).json()).badge;

    const teams = ManagedTeamListResponseSchema.parse((await app.get('/teams')).json()).teams;
    expect(teams.find((entry) => entry.id === home)?.badge).toEqual(badge);
    expect(teams.find((entry) => entry.id === away)?.badge).toBeNull();
    const competitionTeams = CompetitionTeamListResponseSchema.parse(
      (await app.get(`/competitions/${competition.id}/teams`)).json(),
    ).teams;
    expect(competitionTeams.find((entry) => entry.team.id === home)?.team.badge).toEqual(badge);
    const participants = SeasonParticipantListResponseSchema.parse((await app.get(`${base}/participants`)).json());
    expect(participants.participants.find((entry) => entry.team.id === home)?.team.badge).toEqual(badge);
    const matches = CompetitionMatchListResponseSchema.parse((await app.get(`${base}/matches`)).json()).matches;
    expect(matches[0]?.homeTeam.badge).toEqual(badge);
    expect(matches[0]?.awayTeam.badge).toBeNull();

    const restarted = await start(app.container.paths.dataDir);
    expect(ManagedTeamSchema.parse((await restarted.get(`/teams/${home}`)).json()).badge).toEqual(badge);
    expect((await restarted.get(`/teams/${home}/badge`)).statusCode).toBe(200);
  });
});
