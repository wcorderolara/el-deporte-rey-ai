/**
 * Contract tests of the declared HTTP contract document `contracts/http-api.openapi.yaml`: it parses and validates as
 * OpenAPI 3.1 at version 1.0.0, declares the local request protection on every operation (AD-14, T10-F17,
 * T10-A1-01), has no publication operation (R-219), carries the OD-26 visual-QA warning check, equals the accepted
 * proposal except `info.version`, descriptions and that recorded addition (V-29), and closes every fact value and QA
 * detail schema (T10-F17).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  child,
  contractOperations,
  isObject,
  loadContract,
  loadDocument,
  PROPOSAL_PATH,
  validateContract,
  validateDocument,
  type ContractOperation,
  type JsonObject,
  type JsonValue,
} from './support/contract-document.js';

let document: JsonObject;
let operations: ContractOperation[];

beforeAll(async () => {
  document = await loadContract();
  operations = contractOperations(document);
});

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

function responseCodes(operation: ContractOperation): string[] {
  return Object.keys(child(operation.operation, 'responses'));
}

function label(operation: ContractOperation): string {
  return `${operation.method.toUpperCase()} ${operation.path} (${String(operation.operation.operationId)})`;
}

describe('contract document', () => {
  it('validates as OpenAPI 3.1 with the parser', async () => {
    const result = await validateContract();
    expect(result.messages).toEqual([]);
    expect(result.valid).toBe(true);
    expect(document.openapi).toBe('3.1.0');
  });

  it('is rejected by the validator when it is broken (the validation is effective)', async () => {
    const broken = structuredClone(document);
    child(broken, 'paths', '/health', 'get').responses = 'none';
    expect(await validateDocument(broken)).toBe(false);
    const duplicateId = structuredClone(document);
    child(duplicateId, 'paths', '/settings', 'get').operationId = 'getHealth';
    expect(await validateDocument(duplicateId)).toBe(false);
  });

  it('is the promoted version 1.0.0 with the v1 base path on the loopback server', () => {
    expect(child(document, 'info').version).toBe('1.0.0');
    const servers = document.servers;
    expect(Array.isArray(servers) && servers.length === 1 && isObject(servers[0]) ? servers[0].url : null).toBe(
      'http://127.0.0.1:4300/api/v1',
    );
  });

  it('has 39 operations on 32 paths, 15 of them mutating, with unique operation IDs', () => {
    expect(Object.keys(child(document, 'paths'))).toHaveLength(32);
    expect(operations).toHaveLength(39);
    expect(operations.filter((operation) => MUTATING.has(operation.method))).toHaveLength(15);
    const ids = operations.map((operation) => operation.operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 85 component schemas', () => {
    expect(Object.keys(child(document, 'components', 'schemas'))).toHaveLength(85);
  });
});

describe('local request protection declared on every operation (AD-14, T10-F17, T10-A1-01)', () => {
  it('declares 403 and 421 on every operation', () => {
    const missing = operations
      .filter((operation) => !responseCodes(operation).includes('403') || !responseCodes(operation).includes('421'))
      .map(label);
    expect(missing).toEqual([]);
  });

  it('declares the client header and 415 on every mutating operation', () => {
    const missing = operations
      .filter((operation) => MUTATING.has(operation.method))
      .filter(
        (operation) =>
          !responseCodes(operation).includes('415') ||
          !operation.parameters.some(
            (parameter) =>
              parameter.in === 'header' && parameter.name === 'X-EDR-Client' && parameter.required === true,
          ),
      )
      .map(label);
    expect(missing).toEqual([]);
  });

  it('declares 413 on every operation with a request body, and no body on GET', () => {
    const withBody = operations.filter((operation) => operation.operation.requestBody !== undefined);
    expect(withBody.filter((operation) => !responseCodes(operation).includes('413')).map(label)).toEqual([]);
    expect(withBody.filter((operation) => operation.method === 'get').map(label)).toEqual([]);
  });

  it('declares every error response as application/problem+json with the Problem schema', () => {
    const problem = child(document, 'components', 'responses', 'Problem');
    expect(child(problem, 'content', 'application/problem+json', 'schema').$ref).toBe('#/components/schemas/Problem');
    const wrong: string[] = [];
    for (const operation of operations) {
      for (const [code, response] of Object.entries(child(operation.operation, 'responses'))) {
        if (Number(code) >= 400 && !(isObject(response) && response.$ref === '#/components/responses/Problem')) {
          wrong.push(`${label(operation)} ${code}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('constrains every server-ID path parameter with the Uuid schema and every other with a pattern schema', () => {
    const unconstrained: string[] = [];
    for (const operation of operations) {
      for (const parameter of operation.parameters.filter((entry) => entry.in === 'path')) {
        const schema = child(parameter, 'schema');
        const ref = typeof schema.$ref === 'string' ? schema.$ref : '';
        const bounded = ref.endsWith('/Uuid') || ref.endsWith('/Slug') || ref.endsWith('/SourceId');
        if (!bounded && !(schema.type === 'integer' && schema.maximum !== undefined)) {
          unconstrained.push(`${label(operation)} ${String(parameter.name)}`);
        }
      }
    }
    expect(unconstrained).toEqual([]);
  });
});

describe('no publication operation (R-219, BR-11)', () => {
  const PUBLISH_WORDING = /publish|post[-_ ]?to|share/i;

  it('has no operation path or operation ID with publish, post-to or share wording', () => {
    const offending = operations
      .filter(
        (operation) =>
          PUBLISH_WORDING.test(operation.path) || PUBLISH_WORDING.test(String(operation.operation.operationId)),
      )
      .map(label);
    expect(offending).toEqual([]);
  });

  it('detects such wording (the check is effective)', () => {
    expect(PUBLISH_WORDING.test('/carousels/{carouselId}/publish')).toBe(true);
    expect(PUBLISH_WORDING.test('postToNetwork')).toBe(true);
    expect(PUBLISH_WORDING.test('shareCarousel')).toBe(true);
  });
});

describe('OD-26 visual-QA warning check', () => {
  it('adds capitalized_tokens as a warning QaResult variant with closed details', () => {
    const variants = child(document, 'components', 'schemas', 'QaResult').oneOf;
    expect(Array.isArray(variants)).toBe(true);
    const checks = (variants as JsonObject[]).map((variant) => child(variant, 'properties', 'check').const);
    expect(checks).toEqual([
      'data_match',
      'team_names',
      'text_fit',
      'style_consistency',
      'dimensions',
      'capitalized_tokens',
    ]);
    const added = (variants as JsonObject[])[5] as JsonObject;
    expect(child(added, 'properties', 'severity').const).toBe('warning');
    expect(child(added, 'properties', 'details').additionalProperties).toBe(false);
    expect(added.additionalProperties).toBe(false);
  });

  it('accepts capitalized_tokens in the existing QA acknowledgement', () => {
    const body = child(
      document,
      'paths',
      '/carousels/{carouselId}/elements/{elementId}/qa-acknowledgements',
      'post',
      'requestBody',
      'content',
      'application/json',
      'schema',
    );
    expect(child(body, 'properties', 'checks', 'items').enum).toEqual(['style_consistency', 'capitalized_tokens']);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// V-29: the promoted contract equals the accepted proposal except info.version (and the recorded OD-26 addition)
// ---------------------------------------------------------------------------------------------------------------

/** A copy without `description` members and without `info.version`. */
function normative(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(normative);
  }
  if (isObject(value)) {
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key !== 'description') {
        result[key] = normative(entry);
      }
    }
    return result;
  }
  return value;
}

/** JSON-pointer-like paths at which two documents differ, with the kind of difference. */
function differences(left: JsonValue | undefined, right: JsonValue | undefined, path = ''): string[] {
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return [];
  }
  if (left === undefined) {
    return [`${path}: added`];
  }
  if (right === undefined) {
    return [`${path}: removed`];
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const result: string[] = [];
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      result.push(...differences(left[index], right[index], `${path}/${String(index)}`));
    }
    return result;
  }
  if (isObject(left) && isObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    return keys.flatMap((key) =>
      differences(left[key], right[key], `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`),
    );
  }
  return [`${path}: changed`];
}

describe('promoted contract and accepted proposal (V-29, T10-F03, T10-F17)', () => {
  it('differs from the accepted proposal only in info.version, descriptions and the OD-26 warning check', async () => {
    const proposal = await loadDocument(PROPOSAL_PATH);
    expect(child(proposal, 'info').version).toBe('1.0.0-proposed.2');
    const promoted = structuredClone(document);
    const accepted = structuredClone(proposal);
    delete child(promoted, 'info').version;
    delete child(accepted, 'info').version;
    const ack = '/paths/~1carousels~1{carouselId}~1elements~1{elementId}~1qa-acknowledgements/post';
    expect(differences(normative(accepted), normative(promoted))).toEqual([
      `${ack}/requestBody/content/application~1json/schema/properties/checks/items/enum/1: added`,
      '/components/schemas/QaResult/oneOf/5: added',
    ]);
  });

  it('finds a change outside those (the comparison is effective)', async () => {
    const proposal = await loadDocument(PROPOSAL_PATH);
    const changed = structuredClone(proposal);
    child(changed, 'components', 'schemas', 'Uuid').maxLength = 37;
    expect(differences(normative(proposal), normative(changed))).toEqual([
      '/components/schemas/Uuid/maxLength: changed',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Closed per-kind fact values and per-check QA details (T10-F17)
// ---------------------------------------------------------------------------------------------------------------

describe('closed fact values and QA details (T10-F17)', () => {
  it('closes every fact value schema, every context item variant and every QA check variant with its details', () => {
    const schemas = child(document, 'components', 'schemas');
    const values = [
      'MatchTeamsValue',
      'MatchKickoffValue',
      'MatchStatusValue',
      'MatchScoreValue',
      'StandingRowValue',
      'MatchdayInfoValue',
      'TeamOfficialNameValue',
    ];
    for (const name of values) {
      expect(child(schemas, name).additionalProperties, name).toBe(false);
    }
    for (const variant of child(schemas, 'ContextItemValue').oneOf as JsonObject[]) {
      expect(variant.additionalProperties).toBe(false);
    }
    const kinds = (child(schemas, 'FactKindValue').oneOf as JsonObject[]).map(
      (variant) => child(variant, 'properties', 'kind').const,
    );
    expect(kinds).toEqual(child(schemas, 'FactKind').enum);
    expect(child(schemas, 'Fact').unevaluatedProperties).toBe(false);
    for (const variant of child(schemas, 'QaResult').oneOf as JsonObject[]) {
      const check = String(child(variant, 'properties', 'check').const);
      expect(variant.additionalProperties, check).toBe(false);
      expect(child(variant, 'properties', 'details').additionalProperties, check).toBe(false);
    }
  });
});
