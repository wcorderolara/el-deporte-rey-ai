/**
 * Test support of the imports feature: a fake fetch that answers by method and path and records every request, and
 * synthetic contract values (no real competition, team or person names). No network is used.
 */
import type { ImportError, ImportSummary, ManualSelectionHistory, ManualVersion } from '@edr/contracts';
import { vi } from 'vitest';

import type { FetchFunction } from '../../api/client';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  /** The request body as sent (a JSON string for createImport). */
  body: unknown;
}

export type Handler = (request: RecordedRequest) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function problemResponse(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: code, status, code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/**
 * Fake fetch keyed by `METHOD path` (the path without the query string, after the `/api/v1` base). A route may hold
 * a list of handlers used in order; the last one is reused. An unknown route fails the test.
 */
export function fakeFetch(routes: Record<string, Handler | Handler[]>) {
  const requests: RecordedRequest[] = [];
  const used = new Map<string, number>();
  const fetch = vi.fn<FetchFunction>(async (input, init) => {
    const method = init.method ?? 'GET';
    const request: RecordedRequest = {
      method,
      url: input,
      headers: { ...(init.headers as Record<string, string>) },
      body: init.body,
    };
    requests.push(request);
    const path = input.replace(/^\/api\/v1/, '').split('?')[0] ?? '';
    const key = `${method} ${path}`;
    const route = routes[key];
    if (route === undefined) {
      throw new Error(`unexpected request ${key}`);
    }
    const list = Array.isArray(route) ? route : [route];
    const index = used.get(key) ?? 0;
    used.set(key, index + 1);
    const handler = list[Math.min(index, list.length - 1)];
    if (handler === undefined) {
      throw new Error(`no handler for ${key}`);
    }
    return handler(request);
  });
  return { fetch, requests };
}

/** Parsed JSON body of a recorded request. */
export function bodyOf(request: RecordedRequest | undefined): Record<string, unknown> {
  if (request === undefined || typeof request.body !== 'string') {
    throw new Error('request without a JSON body');
  }
  return JSON.parse(request.body) as Record<string, unknown>;
}

/** A promise with its resolver, to hold a response until the test releases it. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export const IMPORT_ID_1 = '00000000-0000-4000-8000-0000000000b1';
export const IMPORT_ID_2 = '00000000-0000-4000-8000-0000000000b2';
export const VERSION_ID_1 = '00000000-0000-4000-8000-0000000000c1';
export const VERSION_ID_2 = '00000000-0000-4000-8000-0000000000c2';

export const IMPORT_V1: ImportSummary = {
  id: IMPORT_ID_1,
  channel: 'csv_file',
  fileName: 'jornada-1.csv',
  declaredSource: 'Acta sintética de la liga',
  receivedAt: '2026-10-01T12:00:00Z',
  competitionId: 'liga-sintetica',
  competitionName: 'Liga Sintética',
  seasonId: 'temporada-2026',
  seasonLabel: 'Temporada 2026',
  originalSha256: '1'.repeat(64),
  selections: [{ stageId: 'apertura', stageName: 'Apertura', matchday: 1, versionId: VERSION_ID_1, versionNumber: 1 }],
};

export const IMPORT_V2: ImportSummary = {
  ...IMPORT_V1,
  id: IMPORT_ID_2,
  channel: 'json_file',
  fileName: 'jornada-1-corregida.json',
  declaredSource: null,
  receivedAt: '2026-10-02T12:00:00Z',
  originalSha256: '2'.repeat(64),
  selections: [{ stageId: 'apertura', stageName: 'Apertura', matchday: 1, versionId: VERSION_ID_2, versionNumber: 2 }],
};

export const FORM_IMPORT: ImportSummary = {
  ...IMPORT_V1,
  id: '00000000-0000-4000-8000-0000000000b3',
  channel: 'form',
  fileName: null,
  declaredSource: null,
};

export const HISTORY_V1: ManualSelectionHistory = {
  competitionId: 'liga-sintetica',
  seasonId: 'temporada-2026',
  selections: [
    {
      stageId: 'apertura',
      stageName: 'Apertura',
      matchday: 1,
      versions: [
        {
          versionId: VERSION_ID_1,
          versionNumber: 1,
          importId: IMPORT_ID_1,
          createdAt: '2026-10-01T12:00:00Z',
          current: true,
        },
      ],
    },
  ],
};

export const HISTORY_V2: ManualSelectionHistory = {
  ...HISTORY_V1,
  selections: [
    {
      stageId: 'apertura',
      stageName: 'Apertura',
      matchday: 1,
      versions: [
        {
          versionId: VERSION_ID_1,
          versionNumber: 1,
          importId: IMPORT_ID_1,
          createdAt: '2026-10-01T12:00:00Z',
          current: false,
        },
        {
          versionId: VERSION_ID_2,
          versionNumber: 2,
          importId: IMPORT_ID_2,
          createdAt: '2026-10-02T12:00:00Z',
          current: true,
        },
      ],
    },
  ],
};

export const VERSION_1: ManualVersion = {
  id: VERSION_ID_1,
  versionNumber: 1,
  importId: IMPORT_ID_1,
  createdAt: '2026-10-01T12:00:00Z',
  supersededAt: '2026-10-02T12:00:00Z',
  competitionId: 'liga-sintetica',
  seasonId: 'temporada-2026',
  selection: {
    stage: { id: 'apertura', name: 'Apertura', order: 1 },
    matchday: 1,
    teams: [
      { key: 'equipo-norte', name: 'Equipo Norte' },
      { key: 'equipo-sur', name: 'Equipo Sur' },
    ],
    matches: [
      {
        home: 'equipo-norte',
        away: 'equipo-sur',
        kickoff: '2026-09-30T18:00:00Z',
        status: 'finished',
        score: { home: 2, away: 1 },
      },
    ],
    standings: null,
  },
};

/** `count` synthetic import errors, as the server reports them (no imported values, T11H-F12). */
export function importErrors(count: number): ImportError[] {
  return Array.from({ length: count }, (_, index) => ({
    location: 'file' as const,
    record: `row ${index + 2}`,
    field: index % 2 === 0 ? 'home_score' : 'status',
    problem: index % 2 === 0 ? ('finished_without_score' as const) : ('type_invalid' as const),
    message: index % 2 === 0 ? 'A finished match needs a score' : 'Value has an invalid type',
  }));
}

/** A file whose bytes are exactly `bytes`. */
export function bytesFile(name: string, bytes: Uint8Array | number[], type = ''): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** Bytes of a standard base64 text, decoded independently of the code under test (DOM `atob`). */
export function decodeBase64(text: string): number[] {
  return Array.from(atob(text), (character) => character.charCodeAt(0));
}

/** Standard base64 of bytes, encoded independently of the code under test (DOM `btoa`). */
export function referenceBase64(bytes: Uint8Array | number[]): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}
