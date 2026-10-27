/**
 * Key checks applied to the raw JSON of every configuration document before schema validation
 * (architecture.md section 5.1; T11H-F07):
 * - a key whose name looks like a secret (`apiKey`, `token`, `secret`, `password`, ...) is refused anywhere, also
 *   inside the opaque adapter options: secrets come only from environment variables (AD-15, AD-30, SC-06);
 * - a `__proto__` key is refused anywhere, so that no configured object can carry a prototype-setting member;
 * - nesting deeper than a fixed limit is refused.
 */
import type { ConfigIssue } from './errors.js';

/** Deepest nesting accepted in a configuration document. */
export const MAX_CONFIG_DEPTH = 16;

/** Key fragments that mark a secret, matched on the lowercased key without separators. */
const SECRET_FRAGMENTS = [
  'apikey',
  'accesskey',
  'privatekey',
  'secretkey',
  'authkey',
  'clientsecret',
  'secret',
  'password',
  'passwd',
  'passphrase',
  'credential',
  'bearer',
  'authorization',
  'cookie',
];

/** Whole words that mark a secret (camelCase, snake_case and kebab-case words). */
const SECRET_WORDS = new Set(['token', 'auth', 'pwd']);

function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '');
}

/**
 * True when a key name looks like a secret: `apiKey`, `api_key`, `token`, `accessToken`, `X-Auth-Token`,
 * `clientSecret`, `password`, `credentials`, `key`. `localKey`, `keyboard` or `linksFile` are not secret-like.
 */
export function isSecretLikeKey(key: string): boolean {
  const compact = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact === 'key' || SECRET_FRAGMENTS.some((fragment) => compact.includes(fragment))) {
    return true;
  }
  return words(key).some((word) => SECRET_WORDS.has(word));
}

/** A key rendered for an error message: printable names as they are, anything else replaced. */
export function displayKey(key: string): string {
  return /^[A-Za-z0-9_$-]{1,64}$/.test(key) ? key : '<key>';
}

/** Renders a path as `providers.sports.sources[2].options.baseUrl`. */
export function formatPath(prefix: string, path: readonly PropertyKey[]): string {
  let text = prefix;
  for (const segment of path) {
    if (typeof segment === 'number') {
      text += `[${String(segment)}]`;
    } else {
      const name = typeof segment === 'string' ? displayKey(segment) : '<key>';
      text += text === '' ? name : `.${name}`;
    }
  }
  return text === '' ? 'configuration' : text;
}

/** True for a plain JSON object (not an array, not null). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

export interface KeyScanOptions {
  /** Prefix of reported settings, for example `catalogue`. */
  readonly prefix: string;
  /**
   * Paths whose member names are data (for example stage IDs of `stageAliases`) rather than setting names: they are
   * not checked for secret-like names, but `__proto__` is still refused.
   */
  readonly dataKeyPaths?: (path: readonly PropertyKey[]) => boolean;
}

/** Scans a parsed JSON document and returns the key problems; an empty list means the keys are acceptable. */
export function scanKeys(document: unknown, options: KeyScanOptions): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const visit = (value: unknown, path: PropertyKey[]): void => {
    if (path.length > MAX_CONFIG_DEPTH) {
      issues.push({ setting: formatPath(options.prefix, path), problem: 'is nested too deeply' });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    if (typeof value !== 'object' || value === null) {
      return;
    }
    const keysAreData = options.dataKeyPaths?.(path) === true;
    for (const key of Object.keys(value)) {
      const keyPath = [...path, key];
      if (key === '__proto__') {
        issues.push({
          setting: formatPath(options.prefix, path),
          problem: 'contains a __proto__ key, which is refused',
        });
        continue;
      }
      if (!keysAreData && isSecretLikeKey(key)) {
        issues.push({
          setting: formatPath(options.prefix, keyPath),
          problem: 'looks like a secret; secrets come only from environment variables, never from configuration files',
        });
        continue;
      }
      visit((value as Record<string, unknown>)[key], keyPath);
    }
  };
  visit(document, []);
  return issues;
}
