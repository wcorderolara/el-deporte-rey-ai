/**
 * The replay transport of the shared test support (an `EgressClient` over the recorded provider responses under
 * `fixtures/`), used to run a LIVE_DATA adapter without the network (R-241, R-222): every listed response is served
 * for its own request, unknown requests get 404, credential headers are recorded by name only, and nothing leaves
 * the process.
 */
import { describe, expect, it } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../../../vitest.setup.js';
import {
  type ReplayResponse,
  expectNoNetworkViolations,
  readReplayResponses,
  replayTransport,
} from '../../support/index.js';

const BASE = 'https://provider.invalid';

function urlOf(response: ReplayResponse): string {
  const query = new URLSearchParams(response.request.query).toString();
  return `${BASE}${response.request.path}${query === '' ? '' : `?${query}`}`;
}

const INIT = { method: 'GET', timeoutMs: 1000, maxResponseBytes: 2 * 1024 * 1024 } as const;

describe('replay transport', () => {
  it('serves every recorded response for its request when it is selected', async () => {
    const responses = readReplayResponses();
    expect(responses.length).toBeGreaterThan(20);
    for (const response of responses) {
      const transport = replayTransport({ files: [response.file] });
      const answer = await transport.request(urlOf(response), {
        ...INIT,
        method: response.request.method as 'GET',
        headers: { 'X-Auth-Token': TEST_MARKER_TOKEN },
      });
      expect(answer.status, response.file).toBe(response.status);
      expect(answer.text, response.file).toBe(response.text);
      expect(transport.unmatched).toEqual([]);
      expect(transport.requests).toHaveLength(1);
      expect(transport.requests[0]).toMatchObject({ credentialHeader: true, credentialInUrl: false });
      expect(JSON.stringify(transport.requests)).not.toContain(TEST_MARKER_TOKEN);
    }
    expectNoNetworkViolations();
  });

  it('serves the successful responses by default and answers 404 to an unknown request', async () => {
    const transport = replayTransport();
    const ok = readReplayResponses().find(
      (response) => response.expect === 'ok' && response.request.path.endsWith('/competitions'),
    );
    expect(ok).toBeDefined();
    const answer = await transport.request(urlOf(ok as ReplayResponse), INIT);
    expect(answer.status).toBe(200);
    const unknown = await transport.request(`${BASE}/v4/unknown?token=x`, INIT);
    expect(unknown.status).toBe(404);
    expect(transport.unmatched).toHaveLength(1);
    expect(transport.requests[1]?.credentialInUrl).toBe(true);
  });
});
