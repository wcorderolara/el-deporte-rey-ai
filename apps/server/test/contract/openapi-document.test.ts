/**
 * Contract tests of the declared HTTP contract document `contracts/http-api.openapi.yaml`: it parses and validates as
 * OpenAPI 3.1 at version 1.0.0, declares the local request protection on every operation (AD-14, T10-F17,
 * T10-A1-01), has no publication operation (R-219) and carries the OD-26 visual-QA warning check.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  child,
  contractOperations,
  isObject,
  loadContract,
  validateContract,
  validateDocument,
  type ContractOperation,
  type JsonObject,
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
