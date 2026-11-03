import {
  CompetitionProviderBindingResponseSchema,
  ExternalCompetitionListResponseSchema,
  SportsProviderListResponseSchema,
  ProblemSchema,
} from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import {
  READ_HEADERS,
  WRITE_HEADERS,
  demoFixture,
  projectsTestApp,
  testSources,
  type ProjectsTestApp,
} from '../projects/test/support.js';
import { createFixtureRoot } from '../../providers/sports/test/synthetic.js';
import { temporaryDirectory } from '../../../test/support/environment.js';
import { join } from 'node:path';

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

async function competition(name: string) {
  const response = await h!.inject({
    method: 'POST',
    url: '/api/v1/competitions',
    headers: WRITE_HEADERS,
    payload: { name },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string };
}

describe('competition provider binding foundation', () => {
  it('lists normalized providers and external competitions without exposing source configuration or credentials', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const providers = SportsProviderListResponseSchema.parse(
      (await h.inject({ method: 'GET', url: '/api/v1/sports/providers', headers: READ_HEADERS })).json(),
    );
    expect(providers.providers.find((item) => item.key === 'test-live')).toMatchObject({ availability: 'available' });
    const unconfigured = providers.providers.find((item) => item.availability === 'not_configured');
    expect(unconfigured?.availabilityMessage).toMatch(/configur.*servidor/i);
    expect(unconfigured).toBeTruthy();
    expect(JSON.stringify(providers)).not.toMatch(/TOKEN|sourceId|baseUrl/i);
    const external = ExternalCompetitionListResponseSchema.parse(
      (
        await h.inject({ method: 'GET', url: '/api/v1/sports/providers/test-live/competitions', headers: READ_HEADERS })
      ).json(),
    );
    expect(external.competitions.map((item) => item.externalCompetitionId)).toEqual(
      expect.arrayContaining(['liga-stub', 'copa-stub']),
    );
    expect(h.stub.count('stub-a', 'listCompetitions')).toBe(1);

    const unavailable = await h.inject({
      method: 'GET',
      url: `/api/v1/sports/providers/${unconfigured!.key}/competitions`,
      headers: READ_HEADERS,
    });
    expect(unavailable.statusCode).toBe(503);
    expect(ProblemSchema.parse(unavailable.json()).code).toBe('PROVIDER_UNAVAILABLE');

    const unknown = await h.inject({
      method: 'GET',
      url: '/api/v1/sports/providers/missing-provider/competitions',
      headers: READ_HEADERS,
    });
    expect(unknown.statusCode).toBe(404);
    expect(ProblemSchema.parse(unknown.json()).code).toBe('NOT_FOUND');
  });

  it('allows one configured provider to serve many competitions and keeps each competition to one active binding', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const first = await competition('Premier local');
    const second = await competition('Copa local');
    const path = `/api/v1/competitions/${first.id}/provider-binding`;
    const link = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'liga-stub', mode: 'provider' },
    });
    expect(link.statusCode).toBe(201);
    const binding = CompetitionProviderBindingResponseSchema.parse(link.json()).binding;
    expect(binding).toMatchObject({
      competitionId: first.id,
      providerKey: 'test-live',
      externalCompetitionId: 'liga-stub',
      mode: 'provider',
      status: 'active',
    });
    expect(binding).not.toHaveProperty('sourceId');

    const duplicate = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'hybrid' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(ProblemSchema.parse(duplicate.json()).code).toBe('PROVIDER_BINDING_EXISTS');

    const other = await h.inject({
      method: 'POST',
      url: `/api/v1/competitions/${second.id}/provider-binding`,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'hybrid' },
    });
    expect(other.statusCode).toBe(201);
    expect(
      h.db.prepare<{ n: number }>("SELECT COUNT(*) AS n FROM competition_provider_bindings WHERE status='active'").get()
        ?.n,
    ).toBe(2);
    const internal = h.db
      .prepare<{ source_id: string }>(
        'SELECT source_id FROM competition_provider_bindings WHERE competition_id = ? AND status = ?',
      )
      .get([first.id, 'active']);
    expect(internal?.source_id).toBe('stub-a');
  });

  it('requires explicit replacement and unlinks without deleting local competition data or binding history', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const local = await competition('Competición conservada');
    const path = `/api/v1/competitions/${local.id}/provider-binding`;
    await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'liga-stub', mode: 'provider' },
    });
    const replacement = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'copa-stub', mode: 'hybrid', replaceExisting: true },
    });
    expect(replacement.statusCode).toBe(201);
    expect(
      h.db
        .prepare<{ status: string }>(
          'SELECT status FROM competition_provider_bindings WHERE competition_id = ? ORDER BY rowid',
        )
        .all([local.id])
        .map((row) => row.status),
    ).toEqual(['replaced', 'active']);
    const removed = await h.inject({
      method: 'DELETE',
      url: path,
      headers: { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'x-edr-client': 'web' },
    });
    expect(removed.statusCode, removed.body).toBe(204);
    expect(
      CompetitionProviderBindingResponseSchema.parse(
        (await h.inject({ method: 'GET', url: path, headers: READ_HEADERS })).json(),
      ).binding,
    ).toBeNull();
    expect(
      h.db
        .prepare<{ status: string }>(
          'SELECT status FROM competition_provider_bindings WHERE competition_id = ? ORDER BY rowid',
        )
        .all([local.id])
        .map((row) => row.status),
    ).toEqual(['replaced', 'unlinked']);
    expect(h.db.prepare<{ n: number }>('SELECT COUNT(*) AS n FROM competitions WHERE id = ?').get([local.id])?.n).toBe(
      1,
    );
    expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('updates the mode of an existing provider binding without creating duplicate history', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    const local = await competition('Cambio de modo');
    const path = `/api/v1/competitions/${local.id}/provider-binding`;
    const created = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'liga-stub', mode: 'provider' },
    });
    const firstBinding = CompetitionProviderBindingResponseSchema.parse(created.json()).binding;
    const changed = await h.inject({
      method: 'POST',
      url: path,
      headers: WRITE_HEADERS,
      payload: { providerKey: 'test-live', externalCompetitionId: 'liga-stub', mode: 'hybrid' },
    });
    expect(CompetitionProviderBindingResponseSchema.parse(changed.json()).binding).toMatchObject({
      id: firstBinding?.id,
      mode: 'hybrid',
    });
    expect(
      h.db
        .prepare<{ n: number }>('SELECT COUNT(*) AS n FROM competition_provider_bindings WHERE competition_id = ?')
        .get([local.id])?.n,
    ).toBe(1);
  });

  it('returns a sanitized provider error without leaking adapter details', async () => {
    h = await projectsTestApp({ includeCompetitions: true, sources: testSources({ stubBEnabled: false }) });
    h.stub.overrides.set('stub-a/listCompetitions', new Error('secret-token-provider-body'));
    const response = await h.inject({
      method: 'GET',
      url: '/api/v1/sports/providers/test-live/competitions',
      headers: READ_HEADERS,
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('secret-token-provider-body');
    expect(ProblemSchema.parse(response.json()).code).toBe('PROVIDER_FAILED');
  });

  it('persists an active binding across a server restart while keeping unbound legacy competitions manual', async () => {
    const dir = temporaryDirectory('provider-binding-restart');
    const fixtures = createFixtureRoot();
    fixtures.write('default', 'demo-a', demoFixture());
    fixtures.write('default', 'demo-b', demoFixture());
    const dbLocation = join(dir.path, 'provider-bindings.sqlite');
    try {
      h = await projectsTestApp({
        includeCompetitions: true,
        sources: testSources({ stubBEnabled: false }),
        fixtures,
        dbLocation,
      });
      const linked = await competition('Vínculo persistente');
      const manual = await competition('Competición manual existente');
      expect(
        CompetitionProviderBindingResponseSchema.parse(
          (
            await h.inject({
              method: 'GET',
              url: `/api/v1/competitions/${manual.id}/provider-binding`,
              headers: READ_HEADERS,
            })
          ).json(),
        ).binding,
      ).toBeNull();
      await h.inject({
        method: 'POST',
        url: `/api/v1/competitions/${linked.id}/provider-binding`,
        headers: WRITE_HEADERS,
        payload: { providerKey: 'test-live', externalCompetitionId: 'liga-stub', mode: 'hybrid' },
      });
      await h.close();
      h = undefined;

      h = await projectsTestApp({
        includeCompetitions: true,
        sources: testSources({ stubBEnabled: false }),
        fixtures,
        dbLocation,
      });
      const restored = CompetitionProviderBindingResponseSchema.parse(
        (
          await h.inject({
            method: 'GET',
            url: `/api/v1/competitions/${linked.id}/provider-binding`,
            headers: READ_HEADERS,
          })
        ).json(),
      ).binding;
      expect(restored).toMatchObject({
        competitionId: linked.id,
        providerKey: 'test-live',
        externalCompetitionId: 'liga-stub',
        mode: 'hybrid',
        status: 'active',
      });
      expect(h.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      await h?.close();
      h = undefined;
      fixtures.remove();
      dir.remove();
    }
  });
});
