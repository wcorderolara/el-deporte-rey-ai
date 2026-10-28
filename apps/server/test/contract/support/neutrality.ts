/**
 * Provider-neutrality checks (R-288, R-140, T11H-F14) shared by the contract-document and the served-response tests.
 *
 * Provider identifiers and field names are matched by the patterns below (the provider name, the credential header,
 * the reference competition's code and numeric ID, provider response fields and headers) and by values read from the
 * fixture files at run time: the codes, numeric IDs and markers of the recorded responses and the host of the
 * configured LIVE base URL. Nothing provider-specific beyond the long-standing patterns is written here (AD-31).
 */
import { join } from 'node:path';

import {
  type Json,
  fixtureConfigDocument,
  providerResponsesDirectory,
  readJson,
  sourcesOf,
  testLiveAdapter,
} from '../../support/index.js';

import { isObject, type JsonValue } from './contract-document.js';

/**
 * Provider identifiers and provider field names that must not appear (R-288 examples, R-289): the provider name and
 * host, the credential header, the reference competition's code, numeric ID and name, and provider response fields.
 */
export const FORBIDDEN: readonly RegExp[] = [
  /football/i,
  /x-auth/i,
  /\bCL\b/,
  /\b2001\b/,
  /champions/i,
  /\bcrest\b/i,
  /\btla\b/i,
  /playedGames/i,
  /utcDate/i,
  /X-Requests/i,
  /X-RequestCounter/i,
  /X-Authenticated-Client/i,
  /lastUpdated/i,
  /winner/i,
  /fullTime/i,
  /halfTime/i,
  /\breferees?\b/i,
];

/** Every key and every string value of a JSON tree, with its location. */
export function texts(value: JsonValue, where = '', found: { where: string; text: string }[] = []) {
  if (typeof value === 'string') {
    found.push({ where, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => texts(item, `${where}/${index}`, found));
  } else if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      found.push({ where: `${where}/${key} (key)`, text: key });
      texts(entry, `${where}/${key}`, found);
    }
  }
  return found;
}

/** Locations of the keys and string values of a JSON tree that match a forbidden pattern. */
export function violations(value: JsonValue, patterns: readonly RegExp[] = FORBIDDEN): string[] {
  const result: string[] = [];
  for (const { where, text } of texts(value)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        result.push(`${where}: ${pattern.source}`);
      }
    }
  }
  return result;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Provider values of the recorded-response fixtures and the configured LIVE source (read at run time). */
export interface ProviderValues {
  /** Host of the configured LIVE base URL. */
  readonly host: string;
  /** Codes, numeric IDs and the client marker of the recorded responses, as bounded patterns. */
  readonly patterns: readonly RegExp[];
  /** Values of the configured LIVE source that responses echo as configuration data: ID, name, group. */
  readonly configuredSource: readonly string[];
}

export function providerValues(): ProviderValues {
  const manifest = readJson<Json>(join(providerResponsesDirectory(), '_manifest.json'));
  const patterns: RegExp[] = [];
  for (const key of ['referenceCompetition', 'secondCompetition']) {
    const competition = manifest[key] as { code: string; id: number };
    patterns.push(new RegExp(`\\b${escape(competition.code)}\\b`), new RegExp(`\\b${String(competition.id)}\\b`));
  }
  const markers = manifest['markers'] as Record<string, unknown> | undefined;
  for (const marker of Object.values(markers ?? {})) {
    if (typeof marker === 'string' && marker !== '') {
      patterns.push(new RegExp(escape(marker)));
    }
  }
  const live = sourcesOf(fixtureConfigDocument('live')).find(
    (entry) => entry['mode'] === 'LIVE_DATA' && entry['adapter'] !== testLiveAdapter.kind,
  );
  if (live === undefined) {
    throw new Error('no LIVE_DATA source in the live fixture configuration');
  }
  const host = new URL(String((live['options'] as Json)['baseUrl'])).host;
  const configuredSource = [live['id'], live['name'], live['independenceGroup']].map(String);
  return { host, patterns, configuredSource };
}

/** UUIDs and SHA-256 values: server-generated, never provider identifiers, removed before the bounded-number check. */
const GENERATED = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[0-9a-f]{64}\b/gi;

/** True for a value that is a URL or a scheme-relative or host-like reference. */
export function isUrlLike(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('//') || /\bwww\./i.test(value);
}

/**
 * Provider-neutrality findings in a response body (R-288, T11H-F14):
 * - the configured provider host anywhere in the text;
 * - a `sourceRef` or `ref` value that is a URL or contains the host;
 * - a forbidden pattern or recorded provider value in any key or string value, once the configured LIVE source's own
 *   ID, name and independence group (configuration data, AD-31) and generated UUIDs and hashes are masked.
 */
export function responseFindings(body: JsonValue, values: ProviderValues): string[] {
  const findings: string[] = [];
  const raw = JSON.stringify(body);
  if (raw.toLowerCase().includes(values.host.toLowerCase())) {
    findings.push(`provider host ${values.host}`);
  }
  for (const { where, text } of texts(body)) {
    const key = where.split('/').pop() ?? '';
    if ((key === 'sourceRef' || key === 'ref') && (isUrlLike(text) || text.includes(values.host))) {
      findings.push(`${where}: URL-like reference`);
    }
  }
  const masked = values.configuredSource.reduce(
    (text, value) => text.split(value).join('configured-source'),
    raw.replace(GENERATED, 'generated'),
  );
  findings.push(...violations(JSON.parse(masked) as JsonValue, [...FORBIDDEN, ...values.patterns]));
  return findings;
}
