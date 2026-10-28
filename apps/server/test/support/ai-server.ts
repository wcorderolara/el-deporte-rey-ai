/**
 * A loopback fake of an OpenAI-compatible chat-completions endpoint for tests that configure the
 * `openai-compatible` AI adapter (R-223). It answers every `POST .../chat/completions` with a valid draft built from
 * the request's own JSON-schema response format: one entry per requested slide key, placeholder-free fixed texts
 * without digits, number words or names, and the caption and hashtags when the schema requires them. It listens on
 * 127.0.0.1 only, so its origin is an allowed loopback `http:` origin of the egress allow-list when it is the
 * configured AI base URL. It records the number of requests and whether an `Authorization` header was present,
 * never a header value.
 */
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeAiServer {
  readonly port: number;
  /** The base URL to configure (`http://127.0.0.1:<port>/v1`). */
  readonly baseUrl: string;
  /** One entry per request: the path and whether an `Authorization` header was sent. */
  readonly requests: readonly { readonly path: string; readonly authorization: boolean }[];
  close(): Promise<void>;
}

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
}

/** A valid draft for the response format of a chat-completions request body. */
export function draftForRequestBody(body: string): Json {
  const request = asRecord(JSON.parse(body) as unknown);
  const schema = asRecord(asRecord(asRecord(request['response_format'])['json_schema'])['schema']);
  const properties = asRecord(schema['properties']);
  const slideKey = asRecord(asRecord(asRecord(asRecord(properties['slides'])['items'])['properties'])['slideKey']);
  const keys = Array.isArray(slideKey['enum']) ? (slideKey['enum'] as unknown[]).map(String) : [];
  const draft: Json = {
    slides: keys.map((key) => ({ slideKey: key, headline: 'Resumen', description: 'Lo más destacado' })),
  };
  const required = Array.isArray(schema['required']) ? (schema['required'] as unknown[]) : [];
  if (required.includes('caption')) {
    draft['caption'] = 'Resumen de resultados';
  }
  if (required.includes('hashtags')) {
    draft['hashtags'] = ['#futbol'];
  }
  return draft;
}

/** Starts the fake endpoint on a free loopback port. */
export async function startFakeAiServer(): Promise<FakeAiServer> {
  const requests: { path: string; authorization: boolean }[] = [];
  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const path = request.url ?? '';
      requests.push({ path, authorization: request.headers.authorization !== undefined });
      response.setHeader('content-type', 'application/json');
      if (request.method !== 'POST' || !path.endsWith('/chat/completions')) {
        response.statusCode = 404;
        response.end('{"error":{"message":"not found"}}');
        return;
      }
      let content: string;
      try {
        content = JSON.stringify(draftForRequestBody(Buffer.concat(chunks).toString('utf8')));
      } catch {
        response.statusCode = 400;
        response.end('{"error":{"message":"bad request"}}');
        return;
      }
      response.statusCode = 200;
      response.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    baseUrl: `http://127.0.0.1:${String(port)}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
