/**
 * Egress allow-list (contracts/provider-ports.md section 4; architecture.md section 5.1; T10-F07, T10-F08).
 *
 * The allow-list is the set of origins of the `options.baseUrl` values of the enabled sports-data sources and of the
 * configured AI adapter, and nothing else (the image generation client has its own list, `buildImageEgressAllowList`): with the fixture, manual and stub adapters it is empty. Origins are
 * compared exactly (scheme, host, port) after WHATWG URL parsing, which lowercases and IDNA-processes hosts. Only
 * `https:` is allowed, with one exception: `http:` to the exact origin of the configured AI base URL when its host is
 * a loopback address (a local model server).
 */
import { ConfigError, type AppConfig, httpsOrigin, optionBaseUrl } from '../config/index.js';

import { EgressDenied } from './errors.js';

/** Longest URL accepted by the egress client. */
export const MAX_URL_LENGTH = 8192;

/** True for a loopback host as WHATWG URL parsing renders it: 127.0.0.0/8, [::1] or localhost. */
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Origin of an allowed loopback `http:` URL without user information, or null. */
function loopbackHttpOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) {
    return null;
  }
  const url = parse(value);
  if (url === null || url.protocol !== 'http:' || url.username !== '' || url.password !== '') {
    return null;
  }
  return isLoopbackHostname(url.hostname) ? url.origin : null;
}

/** The set of origins the egress client may reach, and the URL check applied before every request. */
export class EgressAllowList {
  readonly #origins: ReadonlySet<string>;

  /** Each entry must be a normalized `https:` origin, or a normalized `http:` origin of a loopback host. */
  constructor(origins: Iterable<string>) {
    const set = new Set<string>();
    for (const origin of origins) {
      const url = parse(origin);
      const valid =
        url !== null &&
        url.origin === origin &&
        (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHostname(url.hostname)));
      if (!valid) {
        throw new TypeError('egress allow-list entries must be https: origins or loopback http: origins');
      }
      set.add(origin);
    }
    this.#origins = set;
    Object.freeze(this);
  }

  /** The allowed origins, sorted. */
  get origins(): readonly string[] {
    return [...this.#origins].sort();
  }

  /** True when no origin is allowed. */
  get isEmpty(): boolean {
    return this.#origins.size === 0;
  }

  /**
   * Checks a request URL and returns it parsed; throws `EgressDenied` (before any connection) for an invalid URL, a
   * URL with user information, a scheme other than `https:` (or loopback `http:` to an allowed origin), or an origin
   * outside the allow-list.
   */
  check(url: string): URL {
    if (typeof url !== 'string' || url.length > MAX_URL_LENGTH) {
      throw new EgressDenied('egress refused: invalid URL');
    }
    const parsed = parse(url);
    if (parsed === null) {
      throw new EgressDenied('egress refused: invalid URL');
    }
    if (parsed.username !== '' || parsed.password !== '') {
      throw new EgressDenied('egress refused: URL with user information');
    }
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname))) {
      throw new EgressDenied('egress refused: only https: is allowed');
    }
    if (!this.#origins.has(parsed.origin)) {
      throw new EgressDenied('egress refused: origin not in the allow-list');
    }
    return parsed;
  }
}

/**
 * Builds the allow-list from the configuration: the `https:` base URL origins of the enabled sources and the base
 * URL origin of the AI adapter (`https:`, or `http:` on a loopback host). An unusable base URL stops startup with a
 * `ConfigError` naming the setting.
 */
export function buildEgressAllowList(config: AppConfig): EgressAllowList {
  const origins: string[] = [];
  config.providers.sports.sources.forEach((source, index) => {
    const baseUrl = optionBaseUrl(source.options);
    if (!source.enabled || baseUrl === undefined) {
      return;
    }
    const origin = httpsOrigin(baseUrl);
    if (origin === null) {
      throw new ConfigError(
        `providers.sports.sources[${String(index)}].options.baseUrl`,
        `of the source '${source.id}' must be an https: URL without user information`,
      );
    }
    origins.push(origin);
  });

  const aiBaseUrl = optionBaseUrl(config.providers.ai.options);
  if (aiBaseUrl !== undefined) {
    const origin = httpsOrigin(aiBaseUrl) ?? loopbackHttpOrigin(aiBaseUrl);
    if (origin === null) {
      throw new ConfigError(
        'providers.ai.options.baseUrl',
        'must be an https: URL, or an http: URL on a loopback host, without user information',
      );
    }
    origins.push(origin);
  }
  return new EgressAllowList(origins);
}

/**
 * Builds the allow-list of the image generation client (PD-ARCH-01G-B): only the `https:` origin of the configured
 * image adapter's base URL, and nothing when the adapter is `disabled`. The default client never reaches it, and
 * this client reaches nothing else. An unusable base URL stops startup with a `ConfigError` naming the setting.
 */
export function buildImageEgressAllowList(config: AppConfig): EgressAllowList {
  const images = config.providers.images;
  const baseUrl = images.adapter === 'disabled' ? undefined : optionBaseUrl(images.options);
  if (baseUrl === undefined) {
    return new EgressAllowList([]);
  }
  const origin = httpsOrigin(baseUrl);
  if (origin === null) {
    throw new ConfigError('providers.images.options.baseUrl', 'must be an https: URL without user information');
  }
  return new EgressAllowList([origin]);
}
