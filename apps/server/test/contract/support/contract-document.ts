/**
 * Contract test support: loads and validates the declared HTTP contract `contracts/http-api.openapi.yaml` with the
 * OpenAPI parser (OD-32), and compiles its JSON Schemas with Ajv (draft 2020-12, the dialect of OpenAPI 3.1) so that
 * the Zod mirror in `packages/contracts` can be compared with the authoritative document (AD-04).
 */
import { fileURLToPath } from 'node:url';

import type * as OpenApiParser from '@readme/openapi-parser';
import type { ValidateFunction } from 'ajv';
import Ajv2020Module from 'ajv/dist/2020.js';

/** Absolute path of the declared contract. */
export const CONTRACT_PATH = fileURLToPath(new URL('../../../../../contracts/http-api.openapi.yaml', import.meta.url));

/** A parsed JSON value of the contract (the document is JSON-compatible YAML). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

async function parser(): Promise<typeof OpenApiParser> {
  return import('@readme/openapi-parser');
}

/** Absolute path of the accepted proposal (WI-1-T09 and WI-1-T11G, 1.0.0-proposed.2) that T20 promoted. */
export const PROPOSAL_PATH = fileURLToPath(
  new URL('../../../../../docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml', import.meta.url),
);

/** Parses an OpenAPI YAML document without resolving references. */
export async function loadDocument(path: string): Promise<JsonObject> {
  const { parse } = await parser();
  return (await parse(path)) as unknown as JsonObject;
}

/** Parses the YAML contract without resolving references. */
export async function loadContract(): Promise<JsonObject> {
  return loadDocument(CONTRACT_PATH);
}

/** Validates the contract file against the OpenAPI specification schema and the parser's semantic rules. */
export async function validateContract(): Promise<{ valid: boolean; messages: string[] }> {
  const { validate, compileErrors } = await parser();
  const result = await validate(CONTRACT_PATH);
  return { valid: result.valid, messages: result.valid ? [] : [compileErrors(result)] };
}

/** Validates an in-memory OpenAPI document (used to prove that the validator rejects a broken document). */
export async function validateDocument(document: JsonObject): Promise<boolean> {
  const { validate } = await parser();
  const result = await validate(structuredClone(document) as never);
  return result.valid;
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads `document[key1][key2]...` as an object; throws when a step is missing. */
export function child(value: JsonValue | undefined, ...keys: string[]): JsonObject {
  let current: JsonValue | undefined = value;
  for (const key of keys) {
    if (!isObject(current) || !Object.hasOwn(current, key)) {
      throw new Error(`Contract has no ${keys.join('.')}`);
    }
    current = current[key];
  }
  if (!isObject(current)) {
    throw new Error(`Contract ${keys.join('.')} is not an object`);
  }
  return current;
}

const SCHEMA_REF_PREFIX = '#/components/schemas/';
const BUNDLE_ID = 'urn:edr:contract:http-api';

/** Rewrites `#/components/schemas/X` references to `urn:edr:contract:http-api#/$defs/X`. */
function rewriteRefs(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(rewriteRefs);
  }
  if (isObject(value)) {
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === '$ref' && typeof entry === 'string' && entry.startsWith(SCHEMA_REF_PREFIX)) {
        result[key] = `${BUNDLE_ID}#/$defs/${entry.slice(SCHEMA_REF_PREFIX.length)}`;
      } else {
        result[key] = rewriteRefs(entry);
      }
    }
    return result;
  }
  return value;
}

// RFC 3339 formats used by the contract. Patterns in the contract are applied by Ajv with the Unicode flag.
const DATE = '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])';
const TIME = '([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d+)?';
const FORMATS: Record<string, RegExp> = {
  date: new RegExp(`^${DATE}$`),
  'date-time': new RegExp(`^${DATE}T${TIME}(Z|[+-]([01]\\d|2[0-3]):[0-5]\\d)$`),
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
};

// Ajv's CommonJS entry is imported as module.exports; the class is also its `default` property.
const Ajv2020 = Ajv2020Module.default;

/** Ajv validators for the contract's component schemas and for inline operation schemas. */
export class ContractSchemas {
  private readonly ajv: InstanceType<typeof Ajv2020>;
  private readonly cache = new Map<string, ValidateFunction>();

  constructor(document: JsonObject) {
    this.ajv = new Ajv2020({ strict: true, strictTypes: false, allowUnionTypes: true, allErrors: true });
    for (const [name, pattern] of Object.entries(FORMATS)) {
      this.ajv.addFormat(name, pattern);
    }
    const schemas = child(document, 'components', 'schemas');
    this.ajv.addSchema({ $id: BUNDLE_ID, $defs: rewriteRefs(schemas) });
  }

  /** Validator of `components.schemas.<name>`. */
  component(name: string): ValidateFunction {
    const key = `component:${name}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const validate = this.ajv.getSchema(`${BUNDLE_ID}#/$defs/${name}`);
    if (validate === undefined) {
      throw new Error(`No contract schema ${name}`);
    }
    this.cache.set(key, validate);
    return validate;
  }

  /** Validator of an inline schema of the document (request or response body of an operation). */
  inline(key: string, schema: JsonObject): ValidateFunction {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const validate = this.ajv.compile(rewriteRefs(schema) as JsonObject);
    this.cache.set(key, validate);
    return validate;
  }
}

export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

export interface ContractOperation {
  readonly method: string;
  readonly path: string;
  readonly operation: JsonObject;
  /** Parameters of the path item and of the operation, references resolved to `components.parameters`. */
  readonly parameters: JsonObject[];
}

/** Lists every operation of the document with its parameters. */
export function contractOperations(document: JsonObject): ContractOperation[] {
  const paths = child(document, 'paths');
  const components = child(document, 'components', 'parameters');
  const resolve = (parameter: JsonValue): JsonObject => {
    if (isObject(parameter) && typeof parameter.$ref === 'string') {
      return child(components, parameter.$ref.replace('#/components/parameters/', ''));
    }
    if (!isObject(parameter)) {
      throw new Error('Parameter is not an object');
    }
    return parameter;
  };
  const result: ContractOperation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    if (!isObject(item)) {
      continue;
    }
    const shared = Array.isArray(item.parameters) ? item.parameters.map(resolve) : [];
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (isObject(operation)) {
        const own = Array.isArray(operation.parameters) ? operation.parameters.map(resolve) : [];
        result.push({ method, path, operation, parameters: [...shared, ...own] });
      }
    }
  }
  return result;
}
