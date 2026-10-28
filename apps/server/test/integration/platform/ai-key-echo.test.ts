/**
 * Wrong-key run against an echoing AI stub server (T10-F10, V-26): the OpenAI-compatible adapter is configured (by
 * configuration only) against a loopback server that echoes the `Authorization` header and the request body back in
 * its answer, as some providers do in their error messages. A workflow run whose drafting step calls the AI port
 * with a wrong key fails with a closed failure, and the key appears nowhere: not in the stored run, not in any API
 * response, not in the database and not in the log.
 *
 * The content stage is not delivered yet (T32), so the drafting call is made by a probe stage in the content
 * position that calls `container.aiProvider.generateDraft` exactly as a stage would; the failure is stored and
 * returned by the real workflow runner.
 */
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import { AiProviderError, type DraftRequest } from '../../../src/providers/ai/index.js';
import {
  LIGA_DEMO_MD1,
  type TestApp,
  expectNoNetworkViolations,
  probeStage,
  startTestApp,
} from '../../support/index.js';

/** The wrong key: the shared dummy key, never a real credential. */
const WRONG_KEY = TEST_DUMMY_API_KEY;

interface EchoServer {
  readonly server: Server;
  readonly port: number;
  readonly authorizations: string[];
}

type Mode = 'unauthorized' | 'echo-in-completion';

/** A loopback server that echoes the key and the request body back. */
async function echoServer(mode: Mode): Promise<EchoServer> {
  const authorizations: string[] = [];
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const authorization = String(request.headers.authorization ?? '');
      authorizations.push(authorization);
      const body = Buffer.concat(chunks).toString('utf8');
      response.setHeader('content-type', 'application/json');
      response.setHeader('x-echo-authorization', authorization);
      if (mode === 'unauthorized') {
        response.statusCode = 401;
        response.end(
          JSON.stringify({
            error: { message: `Incorrect API key provided: ${authorization}`, type: 'invalid_request_error' },
            echo: { headers: request.headers, body },
          }),
        );
        return;
      }
      response.statusCode = 200;
      response.end(
        JSON.stringify({
          choices: [
            { message: { content: `not json: ${authorization} ${body.slice(0, 200)}` }, finish_reason: 'stop' },
          ],
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: (server.address() as AddressInfo).port, authorizations };
}

function sampleRequest(): DraftRequest {
  return {
    language: 'es',
    brand: { name: 'Marca Sintética', handle: '@MarcaDemo' },
    limits: { headlineMaxChars: 80, descriptionMaxChars: 300, captionMaxChars: 600, maxHashtags: 3 },
    slides: [
      { slideKey: 'cover', slideType: 'cover', facts: [] },
      {
        slideKey: 'match:demo-1',
        slideType: 'match_result',
        facts: [
          { placeholder: '{{t:equipo-norte}}', kind: 'team', display: 'Equipo Norte' },
          { placeholder: '{{f:match-demo-1-score}}', kind: 'score', display: '2-1' },
        ],
      },
    ],
    captionFacts: [],
  };
}

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
});

async function setup(mode: Mode): Promise<{ t: TestApp; echo: EchoServer; caught: unknown[] }> {
  const echo = await echoServer(mode);
  cleanups.push(() => new Promise<void>((resolve) => echo.server.close(() => resolve())));
  const caught: unknown[] = [];
  const t = await startTestApp({
    base: 'demo-only',
    scenario: 'default',
    env: { EDR_AI_API_KEY: WRONG_KEY },
    mutate: (document) => {
      (document['providers'] as Record<string, unknown>)['ai'] = {
        adapter: 'openai-compatible',
        options: { baseUrl: `http://127.0.0.1:${String(echo.port)}/v1`, model: 'synthetic-model', timeoutMs: 5000 },
      };
    },
    stageOverrides: {
      content: probeStage('content', async (ctx) => {
        try {
          await ctx.container.aiProvider.generateDraft(sampleRequest(), { signal: ctx.signal });
        } catch (error) {
          caught.push(error);
          throw error;
        }
      }),
    },
  });
  cleanups.push(() => t.close());
  return { t, echo, caught };
}

describe('wrong-key run with an echoing AI server (T10-F10)', () => {
  it.each([
    ['401 with the key echoed in the error body', 'unauthorized', { code: 'unavailable', httpStatus: 401 }],
    [
      '200 whose completion text echoes the key',
      'echo-in-completion',
      { code: 'ai_response_invalid', httpStatus: 200 },
    ],
  ] as const)(
    '%s: the run fails with a closed failure and stores and returns no key',
    async (_name, mode, expected) => {
      const { t, echo, caught } = await setup(mode);
      expect(t.container.aiProvider.id).toBe('openai-compatible');
      const project = await t.createProject(LIGA_DEMO_MD1);
      const run = await t.runWorkflow(project.id);

      // The key was really sent and echoed back (the control is not vacuous).
      expect(echo.authorizations).toEqual([`Bearer ${WRONG_KEY}`]);
      expect(t.egress.requests).toHaveLength(1);
      expect(t.egress.requests[0]?.credentialHeader).toBe(true);
      expect(t.egress.requests[0]?.credentialInUrl).toBe(false);

      expect(run.status).toBe('failed');
      expect(run.failure).toEqual({ code: expected.code, sourceId: null, path: null, httpStatus: expected.httpStatus });
      expect(run.stages.map((stage) => [stage.stage, stage.status])).toEqual([
        ['research', 'completed'],
        ['verification', 'completed'],
        ['content', 'failed'],
        ['rendering', 'skipped'],
        ['visual_qa', 'skipped'],
      ]);

      // The thrown error carries a closed code and no key, in every form.
      expect(caught).toHaveLength(1);
      const error = caught[0];
      expect(error).toBeInstanceOf(AiProviderError);
      const forms = [String(error), JSON.stringify(error), (error as Error).message, (error as Error).stack ?? ''];
      for (const form of forms) {
        expect(form).not.toContain(WRONG_KEY);
      }

      const responses = [
        await t.get(`/projects/${project.id}/runs/${run.id}`),
        await t.get(`/projects/${project.id}/runs`),
        await t.get(`/projects/${project.id}`),
        await t.get('/projects'),
        await t.get('/settings'),
      ];
      for (const response of responses) {
        expect(response.statusCode).toBe(200);
        expect(response.body).not.toContain(WRONG_KEY);
        expect(response.body).not.toContain('Incorrect API key');
      }
      expect(t.databaseText()).not.toContain(WRONG_KEY);
      expect(t.log.text()).not.toContain(WRONG_KEY);
      expectNoNetworkViolations();
    },
  );
});
