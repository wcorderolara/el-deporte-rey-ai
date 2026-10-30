import { ManagedCompetitionListResponseSchema, ManagedCompetitionSchema, ProblemSchema } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { READ_HEADERS, WRITE_HEADERS, projectsTestApp, type ProjectsTestApp } from '../projects/test/support.js';

let h: ProjectsTestApp | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

describe('managed competitions API', () => {
  it('creates local records, lists them newest-first, and retrieves by UUID without querying a provider', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const created = await h.inject({
      method: 'POST',
      url: '/api/v1/competitions',
      headers: WRITE_HEADERS,
      payload: { name: '  Liga Local  ' },
    });
    expect(created.statusCode).toBe(201);
    const item = ManagedCompetitionSchema.parse(created.json());
    expect(item.name).toBe('Liga Local');
    expect(
      ManagedCompetitionSchema.parse(
        (await h.inject({ method: 'GET', url: `/api/v1/competitions/${item.id}`, headers: READ_HEADERS })).json(),
      ),
    ).toEqual(item);
    const list = ManagedCompetitionListResponseSchema.parse(
      (await h.inject({ method: 'GET', url: '/api/v1/competitions', headers: READ_HEADERS })).json(),
    );
    expect(list.competitions).toEqual([item]);
    expect(h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM projects').get()?.count).toBe(0);
  });

  it('validates create input and returns not found for an unknown UUID', async () => {
    h = await projectsTestApp({ includeCompetitions: true });
    const invalid = await h.inject({
      method: 'POST',
      url: '/api/v1/competitions',
      headers: WRITE_HEADERS,
      payload: { name: '   ' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(ProblemSchema.parse(invalid.json()).code).toBe('VALIDATION_FAILED');
    const missing = await h.inject({
      method: 'GET',
      url: '/api/v1/competitions/11111111-1111-4111-8111-111111111111',
      headers: READ_HEADERS,
    });
    expect(missing.statusCode).toBe(404);
    expect(ProblemSchema.parse(missing.json()).code).toBe('NOT_FOUND');
    expect(h.db.prepare<{ count: number }>('SELECT COUNT(*) AS count FROM competitions').get()?.count).toBe(0);
  });
});
