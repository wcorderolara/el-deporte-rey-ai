/**
 * Allow-list parsing of domain values (`contracts/provider-ports.md` section 1.3): validates an untrusted value with
 * a domain schema, strips unknown keys and reports how many keys were stripped (to be logged as a count, never with
 * their names or values), or reports the issues as validation paths with fixed messages.
 *
 * The raw input is never spread, assigned or merged into another object (T11H-F07): Zod builds fresh output objects
 * from the schema's own keys, so keys such as `__proto__` or `constructor` in the input are dropped and counted.
 */
import type { z } from 'zod';

/** One validation problem: a JSON-pointer-like path inside the payload and a fixed message (never an input value). */
export interface DomainIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type DomainParseResult<T> =
  | { readonly success: true; readonly data: T; readonly strippedKeys: number }
  | { readonly success: false; readonly issues: readonly DomainIssue[] };

/** Nesting limit of the stripped-key walk; domain values are far shallower. */
const MAX_DEPTH = 64;

/** Encodes a validation path as a JSON pointer (`/matches/0/score`), or `/` for the root. */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return '/';
  }
  return path.map((segment) => `/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Counts the keys of `input` that the schema dropped from `output`. The parsed output mirrors the input's structure
 * (objects and arrays), so the walk compares them position by position and only descends into kept keys.
 */
export function countStrippedKeys(input: unknown, output: unknown, depth = 0): number {
  if (depth > MAX_DEPTH) {
    return 0;
  }
  if (Array.isArray(input) && Array.isArray(output)) {
    let total = 0;
    const length = Math.min(input.length, output.length);
    for (let index = 0; index < length; index += 1) {
      total += countStrippedKeys(input[index], output[index], depth + 1);
    }
    return total;
  }
  if (isPlainRecord(input) && isPlainRecord(output)) {
    let total = 0;
    for (const key of Object.keys(input)) {
      if (Object.hasOwn(output, key)) {
        total += countStrippedKeys(input[key], output[key], depth + 1);
      } else {
        total += 1;
      }
    }
    return total;
  }
  return 0;
}

/** Validates `input` with a domain schema; on success returns the stripped value and the stripped-key count. */
export function parseDomain<S extends z.ZodType>(schema: S, input: unknown): DomainParseResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        path: formatIssuePath(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    };
  }
  return { success: true, data: result.data, strippedKeys: countStrippedKeys(input, result.data) };
}
