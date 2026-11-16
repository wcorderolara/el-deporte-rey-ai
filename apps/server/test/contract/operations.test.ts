/**
 * The operation registry of `packages/contracts` against the contract's operations: same operations, methods, paths,
 * parameters, client header, request bodies, success responses and problem statuses; inline request and response
 * bodies agree with the contract's JSON Schemas on samples and on their systematic variants.
 */
import { API_BASE_PATH, operationList, operations, type OperationDefinition, type OperationId } from '@edr/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  child,
  contractOperations,
  ContractSchemas,
  isObject,
  loadContract,
  type ContractOperation,
  type JsonObject,
} from './support/contract-document.js';
import { collectBounds, variantsOf, type ContractBounds } from './support/mutations.js';
import { requestSamples, responseSamples } from './support/samples.js';

let document: JsonObject;
let contract: Map<string, ContractOperation>;
let schemas: ContractSchemas;
let bounds: ContractBounds;

beforeAll(async () => {
  document = await loadContract();
  schemas = new ContractSchemas(document);
  bounds = collectBounds(document);
  contract = new Map(
    contractOperations(document).map((operation) => [String(operation.operation.operationId), operation]),
  );
});

const ids = Object.keys(operations) as OperationId[];

function contractOperation(id: string): ContractOperation {
  const operation = contract.get(id);
  if (operation === undefined) {
    throw new Error(`Contract has no operation ${id}`);
  }
  return operation;
}

describe('operation registry', () => {
  it('lists exactly the contract operations, keyed by operation ID', () => {
    expect([...ids].sort()).toEqual([...contract.keys()].sort());
    expect(operationList).toHaveLength(ids.length);
    for (const id of ids) {
      expect(operations[id].operationId).toBe(id);
    }
  });

  it('uses the contract base path', () => {
    const servers = document.servers as JsonObject[];
    expect(new URL(String(servers[0]?.url)).pathname).toBe(API_BASE_PATH);
  });
});

describe('acknowledgeQaWarnings request (OD-26)', () => {
  it('agrees with the contract: one warning check per request, either warning check', () => {
    const schema = child(
      contractOperation('acknowledgeQaWarnings').operation,
      'requestBody',
      'content',
      'application/json',
      'schema',
    );
    const validate = schemas.inline('request:acknowledgeQaWarnings', schema);
    const zod = operations.acknowledgeQaWarnings.body.schema;
    const versionId = '00000000-0000-4000-8000-000000000020';
    const cases: [unknown, boolean][] = [
      [{ versionId, checks: ['style_consistency'] }, true],
      [{ versionId, checks: ['capitalized_tokens'] }, true],
      [{ versionId, checks: ['style_consistency', 'capitalized_tokens'] }, false],
      [{ versionId, checks: ['text_fit'] }, false],
      [{ versionId, checks: [] }, false],
    ];
    for (const [body, expected] of cases) {
      expect(validate(body), JSON.stringify(body)).toBe(expected);
      expect(zod.safeParse(body).success, JSON.stringify(body)).toBe(expected);
    }
  });
});

describe.each(ids)('operation %s', (id) => {
  const definition: OperationDefinition = operations[id];

  it('has the contract method, path, tag, parameters and client header', () => {
    const operation = contractOperation(id);
    expect(definition.method).toBe(operation.method);
    expect(definition.path).toBe(operation.path);
    expect(operation.operation.tags).toEqual([definition.tag]);

    const pathNames = operation.parameters.filter((p) => p.in === 'path').map((p) => String(p.name));
    const paramShape =
      definition.params === null ? [] : Object.keys((definition.params as unknown as { shape: object }).shape);
    expect(paramShape.sort()).toEqual(pathNames.sort());

    const queryNames = operation.parameters.filter((p) => p.in === 'query').map((p) => String(p.name));
    const queryShape =
      definition.query === null ? [] : Object.keys((definition.query as unknown as { shape: object }).shape);
    expect(queryShape.sort()).toEqual(queryNames.sort());

    const header = operation.parameters.some((p) => p.in === 'header' && p.name === 'X-EDR-Client');
    expect(definition.clientHeader).toBe(header);
    expect(definition.clientHeader).toBe(definition.method !== 'get');
  });

  it('has the contract request body', () => {
    const operation = contractOperation(id);
    const body = operation.operation.requestBody;
    if (definition.body === null) {
      expect(body).toBeUndefined();
      return;
    }
    expect(isObject(body) && body.required).toBe(true);
    const content = child(body, 'content');
    expect([...definition.body.mediaTypes].sort()).toEqual(Object.keys(content).sort());
    expect(definition.body.schema === null).toBe(!Object.hasOwn(content, 'application/json'));
  });

  it('has the contract success response and problem statuses', () => {
    const operation = contractOperation(id);
    const responses = child(operation.operation, 'responses');
    const success = Object.keys(responses).filter((code) => Number(code) < 400);
    expect(success).toEqual([String(definition.success.status)]);
    const successResponse = child(responses, String(definition.success.status));
    const content = isObject(successResponse['content']) ? successResponse['content'] : {};
    expect([...definition.success.mediaTypes].sort()).toEqual(Object.keys(content).sort());
    expect(definition.success.schema === null).toBe(!Object.hasOwn(content, 'application/json'));
    const problems = Object.keys(responses)
      .filter((code) => Number(code) >= 400)
      .map(Number);
    expect([...definition.problemStatuses]).toEqual(problems);
  });

  it('validates path parameters with the contract parameter schemas', () => {
    const operation = contractOperation(id);
    for (const parameter of operation.parameters.filter((p) => p.in === 'path')) {
      const schema = child(parameter, 'schema');
      const validate = schemas.inline(`param:${id}:${String(parameter.name)}`, schema);
      const params = definition.params;
      expect(params).not.toBeNull();
      if (params === null) {
        continue;
      }
      const shape = (
        params as unknown as { shape: Record<string, { safeParse(value: unknown): { success: boolean } }> }
      ).shape;
      const zod = shape[String(parameter.name)];
      expect(zod).toBeDefined();
      // A URL parameter arrives as text; the contract validates the decoded value (a number for integers).
      const probes: { raw: string; decoded: unknown }[] =
        schema.type === 'integer'
          ? ['1', '99', '0', '100', '1.5', '-1'].map((raw) => ({ raw, decoded: Number(raw) }))
          : [
              '00000000-0000-4000-8000-000000000001',
              '00000000-0000-4000-8000-00000000000A',
              'demo-a',
              'liga-demo',
              'a',
              '../etc',
              'Demo',
              '',
              'x'.repeat(65),
            ].map((raw) => ({ raw, decoded: raw }));
      for (const { raw, decoded } of probes) {
        expect(zod?.safeParse(raw).success, `${String(parameter.name)}=${raw}`).toBe(validate(decoded));
      }
    }
  });

  const json = definition.body?.schema;
  if (json !== undefined && json !== null) {
    it('agrees with the contract request schema on a sample and its variants', () => {
      const schema = child(contractOperation(id).operation, 'requestBody', 'content', 'application/json', 'schema');
      const validate = schemas.inline(`request:${id}`, schema);
      const sample = requestSamples[id];
      expect(sample, 'request sample').toBeDefined();
      expect(validate(sample), JSON.stringify(validate.errors)).toBe(true);
      expect(json.safeParse(sample).success).toBe(true);
      const disagreements: string[] = [];
      for (const variant of variantsOf(sample, bounds)) {
        if (validate(variant.value) !== json.safeParse(variant.value).success) {
          disagreements.push(variant.label);
        }
      }
      expect(disagreements).toEqual([]);
    });
  }

  const response = definition.success.schema;
  if (response !== null) {
    it('agrees with the contract response schema on a sample and its variants', () => {
      const schema = child(
        contractOperation(id).operation,
        'responses',
        String(definition.success.status),
        'content',
        'application/json',
        'schema',
      );
      const validate = schemas.inline(`response:${id}`, schema);
      const sample = responseSamples[id];
      expect(sample, 'response sample').toBeDefined();
      expect(validate(sample), JSON.stringify(validate.errors)).toBe(true);
      expect(response.safeParse(sample).success).toBe(true);
      const disagreements: string[] = [];
      for (const variant of variantsOf(sample, bounds)) {
        if (validate(variant.value) !== response.safeParse(variant.value).success) {
          disagreements.push(variant.label);
        }
      }
      expect(disagreements).toEqual([]);
    });
  }
});
