/**
 * Systematic variants of a valid sample for the parity tests: at every node of the sample, values that probe types,
 * nullability, every string-length, numeric and array-size bound of the contract, patterns, required keys, closed
 * objects and unique items. The tests do not predict the outcome of a variant; they require that the Zod mirror and
 * the contract's JSON Schema give the same verdict.
 */
import { isObject, type JsonObject, type JsonValue } from './contract-document.js';

type Path = readonly (string | number)[];

export interface Variant {
  readonly label: string;
  readonly value: unknown;
}

/** Bounds of the contract that the variants straddle. */
export interface ContractBounds {
  readonly stringLengths: readonly number[];
  readonly numbers: readonly number[];
  readonly arraySizes: readonly number[];
}

/** Key added to probe closed objects (`additionalProperties: false`, `unevaluatedProperties: false`). */
export const EXTRA_KEY = 'unexpectedKey';

/** String bounds above this length (the base64 import content) are probed by the unit tests instead. */
const MAX_PROBED_STRING_LENGTH = 5000;

/** Collects every length, numeric and array-size bound of the contract, with the values just below and above. */
export function collectBounds(document: JsonObject): ContractBounds {
  const strings = new Set<number>();
  const numbers = new Set<number>();
  const arrays = new Set<number>();
  const straddle = (target: Set<number>, bound: number): void => {
    for (const value of [bound - 1, bound, bound + 1]) {
      target.add(value);
    }
  };
  const walk = (value: JsonValue): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (isObject(value)) {
      for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'number' && (key === 'minLength' || key === 'maxLength')) {
          if (entry <= MAX_PROBED_STRING_LENGTH) {
            straddle(strings, entry);
          }
        } else if (typeof entry === 'number' && (key === 'minimum' || key === 'maximum')) {
          straddle(numbers, entry);
        } else if (typeof entry === 'number' && (key === 'minItems' || key === 'maxItems')) {
          straddle(arrays, entry);
        } else {
          walk(entry);
        }
      }
    }
  };
  walk(document);
  const sorted = (set: Set<number>, min: number): number[] => [...set].filter((n) => n >= min).sort((a, b) => a - b);
  return { stringLengths: sorted(strings, 0), numbers: sorted(numbers, -Infinity), arraySizes: sorted(arrays, 1) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pads a string with `a` or truncates it to `length` characters. */
function resize(value: string, length: number): string {
  return value.length >= length ? value.slice(0, length) : value + 'a'.repeat(length - value.length);
}

/** Grows a non-empty array to `size` items: consecutive integers, suffixed strings or copies of the first item. */
function grow(items: readonly unknown[], size: number): unknown[] {
  const first = items[0];
  return Array.from({ length: size }, (_, index) => {
    if (typeof first === 'number') {
      return index + 1;
    }
    if (typeof first === 'string') {
      return index === 0 ? first : `${first}${index}`;
    }
    return first;
  });
}

function replacementsFor(value: unknown, bounds: ContractBounds): Variant[] {
  const common: Variant[] = [{ label: 'null', value: null }];
  if (typeof value === 'string') {
    return [
      ...common,
      { label: 'long string', value: 'A'.repeat(4096) },
      { label: 'control character', value: `${value}\u0000` },
      { label: 'format character', value: `${value}\u200B` },
      { label: 'uppercase', value: value.toUpperCase() },
      { label: 'number', value: 7 },
      ...bounds.stringLengths.map((length) => ({ label: `length ${length}`, value: resize(value, length) })),
    ];
  }
  if (typeof value === 'number') {
    return [
      ...common,
      { label: 'fraction', value: 1.5 },
      { label: 'numeric string', value: String(value) },
      ...bounds.numbers.map((number) => ({ label: `number ${number}`, value: number })),
    ];
  }
  if (typeof value === 'boolean') {
    return [...common, { label: 'string', value: String(value) }, { label: 'negated', value: !value }];
  }
  if (value === null) {
    return [
      { label: 'string', value: 'x' },
      { label: 'zero', value: 0 },
      { label: 'object', value: {} },
    ];
  }
  if (Array.isArray(value)) {
    const variants: Variant[] = [...common, { label: 'empty array', value: [] }, { label: 'object', value: {} }];
    if (value.length > 0) {
      variants.push({ label: 'duplicated first item', value: [value[0], ...value] });
      for (const size of bounds.arraySizes) {
        variants.push({ label: `${size} items`, value: grow(value, size) });
      }
    }
    return variants;
  }
  if (isRecord(value)) {
    const variants: Variant[] = [
      ...common,
      { label: 'array', value: [] },
      { label: 'extra key', value: { ...value, [EXTRA_KEY]: 'x' } },
    ];
    for (const key of Object.keys(value)) {
      const without = { ...value };
      delete without[key];
      variants.push({ label: `without ${key}`, value: without });
    }
    return variants;
  }
  return common;
}

/** Returns a copy of `root` with the node at `path` replaced; only the containers along the path are copied. */
function setAt(root: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) {
    return value;
  }
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setAt(root[head as number], rest, value);
    return copy;
  }
  const record = root as Record<string, unknown>;
  return { ...record, [head as string]: setAt(record[head as string], rest, value) };
}

function* nodes(value: unknown, path: Path = []): Generator<{ path: Path; value: unknown }> {
  yield { path, value };
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      yield* nodes(item, [...path, index]);
    }
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      yield* nodes(item, [...path, key]);
    }
  }
}

/** Every variant of a sample: each node replaced by each probe value. */
export function* variantsOf(sample: unknown, bounds: ContractBounds): Generator<Variant> {
  for (const node of nodes(sample)) {
    const where = node.path.length === 0 ? '(root)' : `/${node.path.join('/')}`;
    for (const replacement of replacementsFor(node.value, bounds)) {
      yield { label: `${where}: ${replacement.label}`, value: setAt(sample, node.path, replacement.value) };
    }
  }
}
