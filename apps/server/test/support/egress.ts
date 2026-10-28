/**
 * Egress test doubles (contracts/provider-ports.md section 4): a recording wrapper around any `EgressClient` and a
 * replay transport that answers from the recorded provider responses under `fixtures/` (the directory whose manifest
 * lists `responses`, each file holding `request`, `status`, `headers` and `body` or `bodyText`). Neither opens a
 * connection; the replay transport never forwards a request. Recorded calls keep header names and whether a
 * credential header was present, never a header value.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { EgressClient, EgressRequestInit, EgressResponse } from '../../src/platform/net/index.js';

import { FIXTURES_DIR, type Json, readJson } from './environment.js';

/** One request seen by a recording or replay client. */
export interface RecordedEgressRequest {
  readonly method: string;
  readonly url: string;
  /** Lower-case header names (no values). */
  readonly headerNames: readonly string[];
  /** True when an `X-Auth-Token` or `Authorization` header was sent. */
  readonly credentialHeader: boolean;
  /** The URL query carries no credential-named parameter (R-260). */
  readonly credentialInUrl: boolean;
}

export interface RecordingEgress extends EgressClient {
  readonly requests: readonly RecordedEgressRequest[];
}

const CREDENTIAL_HEADERS = new Set(['x-auth-token', 'authorization']);
const CREDENTIAL_QUERY = /(token|key|auth|secret|password)/i;

function record(url: string, init: EgressRequestInit): RecordedEgressRequest {
  const headerNames = Object.keys(init.headers ?? {}).map((name) => name.toLowerCase());
  let credentialInUrl: boolean;
  try {
    const parsed = new URL(url);
    credentialInUrl =
      [...parsed.searchParams.keys()].some((key) => CREDENTIAL_QUERY.test(key)) || parsed.username !== '';
  } catch {
    credentialInUrl = false;
  }
  return {
    method: init.method,
    url,
    headerNames,
    credentialHeader: headerNames.some((name) => CREDENTIAL_HEADERS.has(name)),
    credentialInUrl,
  };
}

/** Wraps an egress client and records every request made through it. */
export function recordingEgress(inner: EgressClient): RecordingEgress {
  const requests: RecordedEgressRequest[] = [];
  return {
    requests,
    request: (url, init) => {
      requests.push(record(url, init));
      return inner.request(url, init);
    },
  };
}

/** An egress client that refuses every request (and records it): for configurations that must not use egress. */
export function refusingEgress(): RecordingEgress {
  const requests: RecordedEgressRequest[] = [];
  return {
    requests,
    request: (url, init) => {
      requests.push(record(url, init));
      return Promise.reject(new Error('test egress: no request is expected here'));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Replay transport
// ---------------------------------------------------------------------------------------------------------------

/** One recorded provider response file. */
export interface ReplayResponse {
  readonly file: string;
  readonly request: {
    readonly method: string;
    readonly path: string;
    readonly query: Readonly<Record<string, string>>;
  };
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly text: string;
  readonly expect: string;
}

/**
 * The fixture directory holding recorded provider responses: the only directory under `fixtures/` whose
 * `_manifest.json` lists `responses` (found by shape, so no provider name is written in test code).
 */
export function providerResponsesDirectory(): string {
  const matches = readdirSync(FIXTURES_DIR)
    .map((name) => join(FIXTURES_DIR, name))
    .filter((path) => {
      try {
        if (!statSync(path).isDirectory()) {
          return false;
        }
        const manifest = readJson<Json>(join(path, '_manifest.json'));
        return Array.isArray(manifest['responses']);
      } catch {
        return false;
      }
    });
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new Error('expected exactly one fixture directory of recorded provider responses');
  }
  return matches[0];
}

/** Reads every response listed in the manifest, in manifest order. */
export function readReplayResponses(directory = providerResponsesDirectory()): ReplayResponse[] {
  const manifest = readJson<Json>(join(directory, '_manifest.json'));
  return (manifest['responses'] as Json[]).map((entry) => {
    const file = String(entry['file']);
    const content = JSON.parse(readFileSync(join(directory, file), 'utf8')) as Json;
    const request = content['request'] as Json;
    const text = Object.hasOwn(content, 'bodyText') ? String(content['bodyText']) : JSON.stringify(content['body']);
    return {
      file,
      request: {
        method: String(request['method']),
        path: String(request['path']),
        query: Object.fromEntries(
          Object.entries((request['query'] as Json | undefined) ?? {}).map(([key, value]) => [key, String(value)]),
        ),
      },
      status: Number(content['status']),
      headers: Object.fromEntries(
        Object.entries((content['headers'] as Json | undefined) ?? {}).map(([key, value]) => [key, String(value)]),
      ),
      text,
      expect: String(entry['expect']),
    };
  });
}

/** Default replay set: the successful responses, without the reduced variants that share a request. */
function defaultResponses(all: readonly ReplayResponse[]): ReplayResponse[] {
  return all.filter(
    (response) =>
      response.expect === 'ok' && !/(missing-optional|no-total|requests-available-zero)/.test(response.file),
  );
}

export interface ReplayOptions {
  /** Response files to serve, in priority order; default the successful responses of the manifest. */
  readonly files?: readonly string[];
}

export interface ReplayTransport extends RecordingEgress {
  /** Requests that matched no response (answered 404). */
  readonly unmatched: readonly RecordedEgressRequest[];
}

function sameQuery(url: URL, query: Readonly<Record<string, string>>): boolean {
  const actual = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const expected = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * An `EgressClient` that answers each request from the recorded responses (method, URL path and query must match)
 * and 404 otherwise. It never opens a connection.
 */
export function replayTransport(options: ReplayOptions = {}): ReplayTransport {
  const all = readReplayResponses();
  const served =
    options.files === undefined
      ? defaultResponses(all)
      : options.files.map((file) => {
          const response = all.find((entry) => entry.file === file);
          if (response === undefined) {
            throw new Error(`no recorded response ${file}`);
          }
          return response;
        });
  const requests: RecordedEgressRequest[] = [];
  const unmatched: RecordedEgressRequest[] = [];
  return {
    requests,
    unmatched,
    request: async (url: string, init: EgressRequestInit): Promise<EgressResponse> => {
      const recorded = record(url, init);
      requests.push(recorded);
      await Promise.resolve();
      const parsed = new URL(url);
      const response = served.find(
        (entry) =>
          entry.request.method === init.method &&
          entry.request.path === parsed.pathname &&
          sameQuery(parsed, entry.request.query),
      );
      if (response === undefined) {
        unmatched.push(recorded);
        return {
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: '{"message":"not found"}',
        };
      }
      return {
        status: response.status,
        headers: new Headers({ 'content-type': 'application/json', ...response.headers }),
        text: response.text,
      };
    },
  };
}
