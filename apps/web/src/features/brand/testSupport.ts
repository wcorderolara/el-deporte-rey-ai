/**
 * Test support of the brand feature: a fake fetch that answers by method and path and records every request, and
 * synthetic contract values. No network is used.
 */
import type { BrandAsset, Template } from '@edr/contracts';
import { vi } from 'vitest';

import type { FetchFunction } from '../../api/client';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
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
 * Fake fetch keyed by `METHOD path` (the path without the query string, after the `/api/v1` base). A route may
 * hold a list of handlers used in order; the last one is reused. An unknown route fails the test.
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

/** A promise with its resolver, to hold a response until the test releases it. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export const ASSET_LOGO: BrandAsset = {
  id: '00000000-0000-4000-8000-0000000000a1',
  kind: 'brand_logo',
  label: 'Logotipo sintético',
  mime: 'image/png',
  width: 512,
  height: 256,
  sha256: 'a'.repeat(64),
  active: true,
  registeredAt: '2026-10-01T12:00:00Z',
};

export const ASSET_MASCOT: BrandAsset = {
  id: '00000000-0000-4000-8000-0000000000a2',
  kind: 'mascot',
  label: 'Mascota sintética',
  mime: 'image/jpeg',
  width: 800,
  height: 800,
  sha256: 'b'.repeat(64),
  active: false,
  registeredAt: '2026-10-02T12:00:00Z',
};

export const TEMPLATE_COVER: Template = {
  id: 'cover',
  version: '1.0.0',
  slideType: 'cover',
  label: 'Portada estándar',
  badgeSlots: 0,
  imageSlots: ['brand_logo', 'mascot'],
};

export const TEMPLATE_MATCH: Template = {
  id: 'match-result',
  version: '1.2.0',
  slideType: 'match_result',
  label: 'Resultado de partido',
  badgeSlots: 2,
  imageSlots: [],
};

/** A small synthetic file with the given media type (content is irrelevant: the fake fetch never reads it). */
export function imageFile(name: string, type: string, size = 16): File {
  return new File([new Uint8Array(size)], name, { type });
}
