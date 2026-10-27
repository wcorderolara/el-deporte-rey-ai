/**
 * Parity of the Zod mirror in `packages/contracts` with the authoritative OpenAPI document (AD-04): every component
 * schema has a Zod counterpart; each counterpart accepts the contract's examples and the synthetic samples, rejects
 * closed-object violations (T10-F17), and agrees with the contract's JSON Schema on systematic variants of the
 * samples (types, nullability, bounds and `maxLength`, patterns, required keys, `maxItems` and unique items, T10-F03).
 */
import { componentSchemas, ContractPatterns, OPEN_BASE_COMPONENTS, type ComponentName } from '@edr/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  child,
  ContractSchemas,
  isObject,
  loadContract,
  type JsonObject,
  type JsonValue,
} from './support/contract-document.js';
import { collectBounds, EXTRA_KEY, variantsOf, type ContractBounds } from './support/mutations.js';
import { componentSamples } from './support/samples.js';

let document: JsonObject;
let schemas: ContractSchemas;
let bounds: ContractBounds;

beforeAll(async () => {
  document = await loadContract();
  schemas = new ContractSchemas(document);
  bounds = collectBounds(document);
});

const componentNames = Object.keys(componentSchemas) as ComponentName[];
const OPEN_BASES = new Set<string>(OPEN_BASE_COMPONENTS);

function zodAccepts(schema: z.ZodType, value: unknown): boolean {
  return schema.safeParse(value).success;
}

/** Every `example` and `examples` value found under a schema node of the document. */
function collectExamples(value: JsonValue, found: JsonValue[] = []): JsonValue[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectExamples(item, found));
  } else if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'example') {
        found.push(entry);
      } else if (key === 'examples' && Array.isArray(entry)) {
        found.push(...entry);
      } else {
        collectExamples(entry, found);
      }
    }
  }
  return found;
}

function collectPatterns(value: JsonValue, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPatterns(item, found));
  } else if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'pattern' && typeof entry === 'string') {
        found.add(entry);
      } else {
        collectPatterns(entry, found);
      }
    }
  }
  return found;
}

describe('component coverage', () => {
  it('has a Zod counterpart for every contract component schema and no other', () => {
    expect([...componentNames].sort()).toEqual(Object.keys(child(document, 'components', 'schemas')).sort());
  });

  it('uses exactly the contract patterns', () => {
    expect([...collectPatterns(document)].sort()).toEqual([...new Set(Object.values(ContractPatterns))].sort());
  });

  it('accepts every example of the contract with the Zod schema of its component', () => {
    const schemasNode = child(document, 'components', 'schemas');
    const failures: string[] = [];
    let count = 0;
    for (const name of componentNames) {
      for (const example of collectExamples(schemasNode[name] as JsonValue)) {
        count += 1;
        if (!zodAccepts(componentSchemas[name], example)) {
          failures.push(name);
        }
      }
    }
    expect(failures).toEqual([]);
    // The promoted 1.0.0 declares no examples; a later additive example is checked here automatically.
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe.each(componentNames)('component %s', (name) => {
  const zodSchema = componentSchemas[name];
  const sample = componentSamples[name];

  it('accepts the synthetic sample in the contract and in Zod', () => {
    const validate = schemas.component(name);
    expect(validate(sample), JSON.stringify(validate.errors)).toBe(true);
    expect(zodSchema.safeParse(sample).error?.issues ?? []).toEqual([]);
  });

  if (isObject(sample as JsonValue) && !OPEN_BASES.has(name)) {
    it('rejects an unknown key (closed object) in the contract and in Zod', () => {
      const extended = { ...(sample as JsonObject), [EXTRA_KEY]: 'x' };
      expect(schemas.component(name)(extended)).toBe(false);
      expect(zodAccepts(zodSchema, extended)).toBe(false);
    });
  }

  it('agrees with the contract on every variant of the sample', () => {
    const validate = schemas.component(name);
    const disagreements: string[] = [];
    let variants = 0;
    for (const variant of variantsOf(sample, bounds)) {
      variants += 1;
      const contract = validate(variant.value);
      const zod = zodAccepts(zodSchema, variant.value);
      if (contract !== zod) {
        disagreements.push(
          `${variant.label}: contract ${contract ? 'accepts' : 'rejects'}, zod ${zod ? 'accepts' : 'rejects'}`,
        );
      }
    }
    expect(disagreements).toEqual([]);
    expect(variants).toBeGreaterThan(0);
  });
});

/** Hand-picked edge values of the primitive schemas, beyond the generated variants. */
const PRIMITIVE_PROBES: Partial<Record<ComponentName, readonly unknown[]>> = {
  Uuid: [
    '00000000-0000-4000-8000-00000000000g',
    '00000000000040008000000000000001',
    ' 00000000-0000-4000-8000-000000000001',
  ],
  Slug: ['a', '-a', 'a-', 'a'.repeat(64), 'a'.repeat(65), 'liga_demo', 'liga demo', '\u00f1u'],
  SourceId: ['a', 'ab', 'a'.repeat(41), 'a'.repeat(42), '-ab'],
  MatchKey: ['a:b_c-d', ':a', 'a'.repeat(128), 'a'.repeat(129), 'A:b'],
  Label: ['x', 'x'.repeat(80), 'x'.repeat(81), 'a\u00adb', 'a\u2028b', 'a\tb', 'emoji \u{1F600}'],
  DisplayName: ['Liga Demo 2026/27', 'Liga_Demo', 'Liga: Demo', 'Pe\u0303a', 'x'.repeat(80), 'x'.repeat(81)],
  StageName: ['Fase_1', 'Fase/1', 'Fase #1', 'x'.repeat(80), 'x'.repeat(81)],
  TeamName: ["O'Demo & Co. (B)", 'Demo/B', 'Demo_B', 'x'.repeat(64), 'x'.repeat(65), 'Club\u00a0Demo'],
  FileName: [
    'a.csv',
    'ab.csv',
    'a.json',
    'x.CSV',
    'x.csv.json',
    'datos.txt',
    `${'a'.repeat(115)}.json`,
    `${'a'.repeat(116)}.csv`,
  ],
};

describe('primitive edge values', () => {
  it.each(Object.entries(PRIMITIVE_PROBES))('%s agrees with the contract on its edge values', (name, probes) => {
    const validate = schemas.component(name);
    const disagreements = (probes ?? [])
      .filter((value) => validate(value) !== zodAccepts(componentSchemas[name as ComponentName], value))
      .map((value) => JSON.stringify(value));
    expect(disagreements).toEqual([]);
  });
});

describe('closed objects at every level (T10-F17)', () => {
  it('rejects an unknown key in every nested object of every closed component sample', () => {
    const accepted: string[] = [];
    for (const name of componentNames) {
      for (const variant of variantsOf(componentSamples[name], bounds)) {
        if (!variant.label.endsWith(': extra key')) {
          continue;
        }
        const atOpenBaseRoot = OPEN_BASES.has(name) && variant.label.startsWith('(root)');
        // FactKindValue variants are open objects at the root only.
        if (!atOpenBaseRoot && zodAccepts(componentSchemas[name], variant.value)) {
          accepted.push(`${name} ${variant.label}`);
        }
      }
    }
    expect(accepted).toEqual([]);
  });
});
