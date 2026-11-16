/**
 * Client of the AI design proposals (PD-ARCH-01G-B): paths, the client header on mutations, contract validation of
 * every response, and same-origin file and event URLs. A fake fetch answers; no network is used.
 */
import { describe, expect, it } from 'vitest';

import { fakeFetch, jsonResponse } from '../brand/testSupport';
import { createDesignApi } from './designApi';

const ID = '00000000-0000-4000-8000-000000000070';

describe('designApi', () => {
  it('posts decisions with the client header and validates the response with the contract', async () => {
    const fake = fakeFetch({
      [`POST /design/proposals/${ID}/decisions`]: () => jsonResponse({ unexpected: true }),
    });
    const api = createDesignApi({ fetch: fake.fetch });
    await expect(api.decide(ID, { decision: 'approved' })).rejects.toMatchObject({ kind: 'invalid_response' });
    expect(fake.requests[0]).toMatchObject({ method: 'POST', url: `/api/v1/design/proposals/${ID}/decisions` });
    expect(fake.requests[0]?.headers['X-EDR-Client']).toBe('web');
    expect(JSON.parse(String(fake.requests[0]?.body))).toEqual({ decision: 'approved' });
  });

  it('builds same-origin file and event URLs and never sends anything for them', () => {
    const fake = fakeFetch({});
    const api = createDesignApi({ fetch: fake.fetch });
    expect(api.proposalFileUrl(ID)).toBe(`/api/v1/design/proposals/${ID}/file`);
    expect(api.eventsUrl(ID)).toBe(`/api/v1/design/generations/${ID}/events`);
    expect(fake.requests).toHaveLength(0);
  });

  it('checks the model access with one request', async () => {
    const fake = fakeFetch({
      'POST /design/capabilities/check': () =>
        jsonResponse({ model: 'gpt-image-2.5-flare', access: 'available', errorCode: null }),
    });
    const api = createDesignApi({ fetch: fake.fetch });
    expect(await api.checkModelAccess('gpt-image-2.5-flare')).toMatchObject({ access: 'available' });
    expect(JSON.parse(String(fake.requests[0]?.body))).toEqual({ model: 'gpt-image-2.5-flare' });
  });
});
