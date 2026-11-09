/** Client of the visual template operations (PD-ARCH-01G-C): paths, client header, bodies and response checks. */
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import { fakeFetch, jsonResponse, problemResponse } from '../brand/testSupport';
import { DRAFT_ID, TEMPLATE_ID, detail, template, uuid, version } from './testSupport';
import { createVisualTemplatesApi } from './visualTemplatesApi';

const BASE = `/visual-templates/${TEMPLATE_ID}`;

describe('visualTemplatesApi', () => {
  it('calls the contract paths with the client header on mutations only', async () => {
    const fake = fakeFetch({
      'GET /visual-templates': () => jsonResponse({ templates: [template()] }),
      'POST /visual-templates': () => jsonResponse(detail(), 201),
      [`PUT ${BASE}/versions/${DRAFT_ID}`]: () => jsonResponse(version({ revision: 4 })),
      [`POST ${BASE}/versions/${DRAFT_ID}/release`]: () => jsonResponse(version({ status: 'published' })),
      [`POST ${BASE}/archive`]: () => jsonResponse(template({ status: 'archived' })),
      [`DELETE ${BASE}`]: () => new Response(null, { status: 204 }),
    });
    const api = createVisualTemplatesApi({ fetch: fake.fetch });

    expect(await api.list()).toHaveLength(1);
    await api.create({ sourceProposalId: uuid(1), name: 'Previa' });
    const saved = await api.saveVersion(TEMPLATE_ID, DRAFT_ID, {
      revision: 3,
      background: { source: 'design_proposal', id: uuid(1) },
      layers: [],
    });
    expect(saved.revision).toBe(4);
    await api.publishVersion(TEMPLATE_ID, DRAFT_ID, 4);
    await api.archive(TEMPLATE_ID);
    await api.remove(TEMPLATE_ID);

    const [list, create, save, publish, archive, remove] = fake.requests;
    expect(list?.headers['X-EDR-Client']).toBeUndefined();
    for (const request of [create, save, publish, archive, remove]) {
      expect(request?.headers['X-EDR-Client']).toBe('web');
    }
    expect(JSON.parse(String(publish?.body))).toEqual({ revision: 4 });
    expect(archive?.body).toBeUndefined();
  });

  it('builds image URLs from IDs and refuses a response outside the contract', async () => {
    const fake = fakeFetch({ [`GET ${BASE}`]: () => jsonResponse({ template: { id: 'x' }, versions: [] }) });
    const api = createVisualTemplatesApi({ fetch: fake.fetch });

    expect(api.backgroundUrl(TEMPLATE_ID, DRAFT_ID)).toBe(`/api/v1${BASE}/versions/${DRAFT_ID}/background`);
    await expect(api.get(TEMPLATE_ID)).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('parses the new template problem codes', async () => {
    const fake = fakeFetch({ [`DELETE ${BASE}`]: () => problemResponse(409, 'TEMPLATE_IN_USE') });
    const api = createVisualTemplatesApi({ fetch: fake.fetch });

    const error = await api.remove(TEMPLATE_ID).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem?.code).toBe('TEMPLATE_IN_USE');
  });
});
