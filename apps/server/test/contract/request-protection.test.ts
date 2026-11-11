/**
 * Local request protection and input validation of every contract operation on the running server (T43; AD-14;
 * security design review T10-F03, T10-F17, T10-A1-01, V-29; R-224). Every answer is checked against the contract
 * (declared status, problem+json, Problem schema):
 * - 421 MISDIRECTED_HOST for a Host outside the allow-list, on every operation;
 * - 403 FORBIDDEN_ORIGIN for `Sec-Fetch-Site: cross-site` and `same-site` on every operation, GET included;
 * - 403 FORBIDDEN_ORIGIN on every mutating operation without the client header, with another client header value, with
 *   a foreign origin and with `Origin: null`;
 * - 415 UNSUPPORTED_MEDIA_TYPE on every mutating operation for a body in another media type;
 * - 413 PAYLOAD_TOO_LARGE on every operation with a body, one byte over the route limit;
 * - 400 VALIDATION_FAILED for every path parameter that is not a UUID, slug, source ID or position (traversal,
 *   absolute paths, over-long and malformed values), before any handler logic: nothing is written and no provider
 *   request is made, while a well-formed unknown ID reaches the handler (404);
 * - 400 VALIDATION_FAILED for invalid query parameters and request bodies, including `label`, names and file names
 *   with control or format characters.
 * Synthetic data only; one temporary app for the file.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestApp, type TestApp } from '../support/index.js';

import { operations } from '@edr/contracts';

import { OPERATION_IDS, oversizedRequest, syntheticPng, validRequest } from './support/requests.js';
import { requestSamples } from './support/samples.js';
import {
  ContractClient,
  ContractSpec,
  describeExchange,
  type CallOptions,
  type Exchange,
  type ProblemBody,
} from './support/served.js';

let t: TestApp;
let spec: ContractSpec;
let client: ContractClient;

beforeAll(async () => {
  spec = await ContractSpec.load();
  t = await startTestApp({ base: 'demo-manual', scenario: 'default' });
  client = new ContractClient(t, spec);
});

afterAll(async () => {
  await t.close();
});

/** Sends a request and requires a conforming problem with the given status and code. */
async function expectProblem(
  operationId: string,
  options: CallOptions,
  status: number,
  code: string,
): Promise<ProblemBody> {
  const exchange = await client.call(operationId, options);
  expect(exchange.status, describeExchange(exchange)).toBe(status);
  expect(exchange.violations, describeExchange(exchange)).toEqual([]);
  expect(exchange.mediaType).toBe('application/problem+json');
  const problem = exchange.body as ProblemBody;
  expect(problem.code, describeExchange(exchange)).toBe(code);
  return problem;
}

function withHeaders(options: CallOptions, headers: Record<string, string | undefined>): CallOptions {
  return { ...options, headers: { ...options.headers, ...headers } };
}

it('covers exactly the contract operations', () => {
  expect([...OPERATION_IDS].sort()).toEqual([...spec.operationIds].sort());
});

// ---------------------------------------------------------------------------------------------------------------
// Platform guards (AD-14, T10-F17, T10-A1-01)
// ---------------------------------------------------------------------------------------------------------------

/** Static operation lists, so that the tests can be declared before `beforeAll` loads the contract. */
function isMutating(operationId: string): boolean {
  return (MUTATING as readonly string[]).includes(operationId);
}

function hasBody(operationId: string): boolean {
  return (WITH_BODY as readonly string[]).includes(operationId);
}

const MUTATING = Object.values(operations)
  .filter((operation) => operation.method !== 'get')
  .map((operation) => operation.operationId);

const WITH_BODY = Object.values(operations)
  .filter((operation) => operation.body !== null)
  .map((operation) => operation.operationId);

describe.each(OPERATION_IDS)('request protection of %s', (operationId) => {
  it('answers 421 MISDIRECTED_HOST for a Host outside the allow-list', async () => {
    const request = validRequest(spec, operationId);
    for (const host of [
      'edr.invalid:4300',
      `127.0.0.1:${String(t.port + 1)}`,
      '127.0.0.1',
      `[::1]:${String(t.port)}`,
    ]) {
      await expectProblem(operationId, withHeaders(request, { host }), 421, 'MISDIRECTED_HOST');
    }
  });

  it('answers 403 FORBIDDEN_ORIGIN for cross-site and same-site Fetch Metadata', async () => {
    const request = validRequest(spec, operationId);
    for (const site of ['cross-site', 'same-site']) {
      await expectProblem(operationId, withHeaders(request, { 'sec-fetch-site': site }), 403, 'FORBIDDEN_ORIGIN');
    }
  });

  if (isMutating(operationId)) {
    it('answers 403 FORBIDDEN_ORIGIN without the client header or from a foreign or null origin', async () => {
      const request = validRequest(spec, operationId);
      const refusals: Record<string, string | undefined>[] = [
        { 'x-edr-client': undefined },
        { 'x-edr-client': 'app' },
        { origin: 'http://edr.invalid' },
        { origin: 'null' },
        { origin: `http://127.0.0.1:${String(t.port + 1)}` },
        { origin: `https://127.0.0.1:${String(t.port)}` },
      ];
      for (const headers of refusals) {
        await expectProblem(operationId, withHeaders(request, headers), 403, 'FORBIDDEN_ORIGIN');
      }
    });

    it('answers 415 UNSUPPORTED_MEDIA_TYPE for a body in another media type', async () => {
      const { json: _json, payload: _payload, ...request } = validRequest(spec, operationId);
      const accepted = spec.bodyMediaTypes(operationId);
      const refused = ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x'];
      refused.push(...(accepted.includes('application/json') || accepted.length === 0 ? ['image/png'] : []));
      refused.push(...(accepted.includes('image/png') ? ['application/json', 'image/gif', 'image/svg+xml'] : []));
      for (const contentType of refused) {
        await expectProblem(operationId, { ...request, payload: 'x=1', contentType }, 415, 'UNSUPPORTED_MEDIA_TYPE');
      }
    });
  }

  if (hasBody(operationId)) {
    it('answers 413 PAYLOAD_TOO_LARGE one byte over the route body limit', async () => {
      await expectProblem(operationId, oversizedRequest(spec, operationId), 413, 'PAYLOAD_TOO_LARGE');
    });
  }
});

describe('static operation lists', () => {
  it('match the contract: 15 mutating operations, 9 with a request body', () => {
    expect([...MUTATING].sort()).toEqual(spec.operationIds.filter((id) => spec.isMutating(id)).sort());
    expect([...WITH_BODY].sort()).toEqual(spec.operationIds.filter((id) => spec.hasBody(id)).sort());
    for (const id of spec.operationIds) {
      const statuses = spec.statuses(id);
      expect(statuses, id).toContain(403);
      expect(statuses, id).toContain(421);
      expect(statuses.includes(415), id).toBe(spec.isMutating(id));
      expect(statuses.includes(413), id).toBe(spec.hasBody(id));
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Path parameters (T10-F03, R-224)
// ---------------------------------------------------------------------------------------------------------------

/** Encoded probes refused by every ID schema (Uuid, Slug, SourceId). */
const ID_PROBES: readonly string[] = [
  '..%2F..',
  '..%2F..%2Fconfig',
  '%2Fetc%2Fpasswd',
  'C%3A%5Cdata',
  '%00',
  'a%20b',
  'x'.repeat(65),
  'a'.repeat(100),
  'NOT-A-SLUG',
  '-leading-dash',
  'caf%C3%A9',
];

/** Additional probes for Uuid parameters (well-formed slugs that are not UUIDs). */
const UUID_PROBES: readonly string[] = [
  'not-a-uuid',
  '00000000-0000-4000-8000-00000000000A',
  '00000000-0000-4000-8000-0000000000001',
  '00000000000040008000000000000001',
  '{00000000-0000-4000-8000-000000000001}',
];

/** Dot segments, raw and encoded; `inject` resolves them as URL dot segments, so they are sent over TCP. */
const DOT_SEGMENT_PROBES: readonly string[] = ['..', '%2E%2E', '%2e.', '.'];

const POSITION_PROBES: readonly string[] = ['0', '100', '-1', '1.5', 'abc', '1e1', '%2F1', '9'.repeat(40)];

/** Over-long probes beyond the router's parameter length (Fastify `maxParamLength`, 100). */
const OVERLONG_PROBES: readonly string[] = ['a'.repeat(101), 'a'.repeat(300), `..%2F${'a'.repeat(200)}`];

const WITH_PATH_PARAMS = OPERATION_IDS.filter((id) => operations[id as keyof typeof operations].params !== null);

describe.each(WITH_PATH_PARAMS)('path parameters of %s (T10-F03, R-224)', (operationId) => {
  it('reaches the handler with well-formed unknown IDs', async () => {
    const exchange = await client.call(operationId, validRequest(spec, operationId));
    expect(exchange.violations, describeExchange(exchange)).toEqual([]);
    expect([404, 409], describeExchange(exchange)).toContain(exchange.status);
  });

  it('refuses malformed values with 400 VALIDATION_FAILED before any handler logic', async () => {
    const request = validRequest(spec, operationId);
    const before = t.databaseText();
    const egress = t.egress.requests.length;
    for (const parameter of spec.pathParameters(operationId)) {
      const probes =
        parameter.schema === 'ExternalSeasonId'
          ? ['bad id', 'bad!id']
          : parameter.schema === 'integer'
            ? POSITION_PROBES
            : parameter.schema === 'Uuid'
              ? [...ID_PROBES, ...UUID_PROBES]
              : ID_PROBES;
      for (const probe of probes) {
        const problem = await expectProblem(
          operationId,
          { ...request, rawParams: { [parameter.name]: probe } },
          400,
          'VALIDATION_FAILED',
        );
        expect(problem.errors?.length ?? 0, `${parameter.name}=${probe}`).toBeGreaterThan(0);
      }
    }
    expect(t.databaseText()).toBe(before);
    expect(t.egress.requests.length).toBe(egress);
  });

  it('answers dot segments over TCP without reaching a handler (400 or the 404 of an unmatched route)', async () => {
    const before = t.databaseText();
    for (const parameter of spec.pathParameters(operationId)) {
      for (const probe of DOT_SEGMENT_PROBES) {
        const path = spec.url(operationId, {
          ...validRequest(spec, operationId),
          rawParams: { [parameter.name]: probe },
        });
        const operation = spec.operation(operationId);
        const mutating = spec.isMutating(operationId);
        const answer = await t.request({
          method: operation.method.toUpperCase(),
          path,
          headers: {
            host: t.host,
            ...(mutating ? { origin: t.origin, 'x-edr-client': 'web' } : {}),
          },
        });
        const label = `${parameter.name}=${probe} -> ${String(answer.status)} ${answer.body}`;
        expect([400, 404], label).toContain(answer.status);
        expect(answer.headers['content-type'], label).toContain('application/problem+json');
        const problem = JSON.parse(answer.body) as ProblemBody;
        expect(problem.code, label).toBe(answer.status === 400 ? 'VALIDATION_FAILED' : 'NOT_FOUND');
        expect(
          spec.check(operationId, answer.status, answer.headers['content-type'], Buffer.from(answer.body)).violations,
        ).toEqual([]);
      }
    }
    expect(t.databaseText()).toBe(before);
  });

  it('refuses over-long values before any handler logic', async () => {
    const request = validRequest(spec, operationId);
    const before = t.databaseText();
    for (const parameter of spec.pathParameters(operationId)) {
      const overlongProbes =
        parameter.schema === 'ExternalSeasonId' ? ['x'.repeat(121), 'x'.repeat(300)] : OVERLONG_PROBES;
      for (const probe of overlongProbes) {
        const exchange = await client.call(operationId, { ...request, rawParams: { [parameter.name]: probe } });
        expect(exchange.violations, describeExchange(exchange)).toEqual([]);
        expect(exchange.status, describeExchange(exchange)).toBe(400);
        expect((exchange.body as ProblemBody).code).toBe('VALIDATION_FAILED');
      }
    }
    expect(t.databaseText()).toBe(before);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Query parameters and bodies (T10-F03, R-224)
// ---------------------------------------------------------------------------------------------------------------

/** Control and format characters (\p{Cc}, \p{Cf}) refused in labels, names and file names. */
const CONTROL_AND_FORMAT = [
  '\u0000',
  '\u0007',
  '\u001b',
  '\u007f',
  '\u0085',
  '\u200b',
  '\u200e',
  '\u202e',
  '\u2066',
  '\ufeff',
];

describe('query parameters (R-224)', () => {
  it('refuses a brand label with control or format characters, an over-long label and an unknown kind', async () => {
    const base = validRequest(spec, 'registerBrandAsset');
    const before = t.databaseText();
    const labels = [...CONTROL_AND_FORMAT.map((character) => `Logo${character}EDR`), '', 'x'.repeat(81)];
    for (const label of labels) {
      await expectProblem(
        'registerBrandAsset',
        { ...base, query: { kind: 'brand_logo', label } },
        400,
        'VALIDATION_FAILED',
      );
    }
    for (const kind of ['club_badge', 'competition_mark', 'BRAND_LOGO', '']) {
      await expectProblem('registerBrandAsset', { ...base, query: { kind, label: 'Logo' } }, 400, 'VALIDATION_FAILED');
    }
    await expectProblem('registerBrandAsset', { ...base, query: { label: 'Logo' } }, 400, 'VALIDATION_FAILED');
    expect(t.databaseText()).toBe(before);
  });

  it('refuses invalid catalogue IDs of the manual selection history and missing parameters', async () => {
    const queries: Record<string, string>[] = [
      { competitionId: '../..', seasonId: '2026' },
      { competitionId: 'liga', seasonId: '/etc' },
      { competitionId: 'x'.repeat(65), seasonId: '2026' },
      { competitionId: 'Liga', seasonId: '2026' },
      { competitionId: 'liga' },
      {},
    ];
    for (const query of queries) {
      await expectProblem('listManualSelections', { query }, 400, 'VALIDATION_FAILED');
    }
  });

  it('refuses an unknown preview language', async () => {
    for (const language of ['fr', 'ES', '', 'es-GT']) {
      await expectProblem(
        'previewTemplate',
        { params: { templateId: 'sin-registro' }, query: { language } },
        400,
        'VALIDATION_FAILED',
      );
    }
  });
});

describe('request bodies (R-224)', () => {
  const invalidBodies: Record<string, readonly unknown[]> = {
    createProject: [
      {},
      [],
      null,
      'texto',
      { ...(requestSamples.createProject as object), unexpectedKey: 'x' },
      { ...(requestSamples.createProject as object), competitionId: '../liga' },
      { ...(requestSamples.createProject as object), sourceId: 'x' },
      { ...(requestSamples.createProject as object), seasonId: 'x'.repeat(65) },
      { ...(requestSamples.createProject as object), matchday: 0 },
      { ...(requestSamples.createProject as object), matchday: 1000 },
      { ...(requestSamples.createProject as object), matchday: '1' },
      { ...(requestSamples.createProject as object), language: 'fr' },
    ],
    updateProject: [{}, { language: 'fr' }, { language: 'es', title: 'x' }],
    startRun: [{}, { kind: 'publish' }, { kind: 'full', extra: true }],
    approveElement: [{}, { versionId: '00000000-0000-4000-8000-00000000000A' }, { versionId: '..%2F..' }],
    acknowledgeQaWarnings: [
      { versionId: '00000000-0000-4000-8000-000000000001', checks: [] },
      { versionId: '00000000-0000-4000-8000-000000000001', checks: ['text_fit'] },
      { versionId: '00000000-0000-4000-8000-000000000001', checks: ['style_consistency', 'capitalized_tokens'] },
    ],
    updateBrandAsset: [
      {},
      { active: 'yes' },
      { active: true, kind: 'mascot' },
      { usagePolicy: 'everything' },
      { description: '' },
    ],
    updateBrandIdentity: [{ palette: [] }, { description: '' }, { colorUsage: { gold: 'Dorado' } }, { name: 'Otra' }],
  };

  it.each(Object.keys(invalidBodies))(
    'refuses invalid bodies of %s with 400 VALIDATION_FAILED',
    async (operationId) => {
      const base = validRequest(spec, operationId);
      const before = t.databaseText();
      for (const body of invalidBodies[operationId] ?? []) {
        const problem = await expectProblem(operationId, { ...base, json: body }, 400, 'VALIDATION_FAILED');
        expect(problem.errors?.length ?? 0, JSON.stringify(body)).toBeGreaterThan(0);
      }
      await expectProblem(operationId, { ...base, json: undefined, payload: '{"a":' }, 400, 'VALIDATION_FAILED');
      expect(t.databaseText()).toBe(before);
    },
  );

  it('refuses import file names with paths, control or format characters, and labels with them (T10-F03)', async () => {
    const before = t.databaseText();
    const file = {
      channel: 'json_file',
      fileName: 'jornada.json',
      declaredSource: 'Registro sintético',
      contentBase64: Buffer.from('{}', 'utf8').toString('base64'),
    };
    const fileNames = [
      '../jornada.json',
      '/etc/jornada.json',
      'C:\\jornada.json',
      'carpeta/jornada.json',
      'jornada.exe',
      'jornada.json.exe',
      '.json',
      `${'a'.repeat(116)}.json`,
      ...CONTROL_AND_FORMAT.map((character) => `jor${character}nada.json`),
    ];
    for (const fileName of fileNames) {
      await expectProblem('createImport', { json: { ...file, fileName } }, 400, 'VALIDATION_FAILED');
    }
    for (const declaredSource of [...CONTROL_AND_FORMAT.map((character) => `Acta${character}`), '', 'x'.repeat(81)]) {
      await expectProblem('createImport', { json: { ...file, declaredSource } }, 400, 'VALIDATION_FAILED');
    }
    expect(t.databaseText()).toBe(before);
  });

  it('refuses the text `content` field with 400 VALIDATION_FAILED (closed ImportFileCreate, T11H-F01)', async () => {
    const before = t.databaseText();
    const csv = Buffer.from('competition_id\n', 'utf8');
    const file = { channel: 'csv_file', fileName: 'jornada.csv', declaredSource: null };
    for (const body of [
      { ...file, content: csv.toString('utf8') },
      { ...file, content: csv.toString('utf8'), contentBase64: csv.toString('base64') },
      { ...file, contentBase64: 7 },
      { ...file, channel: 'form', contentBase64: csv.toString('base64') },
    ]) {
      await expectProblem('createImport', { json: body }, 400, 'VALIDATION_FAILED');
    }
    expect(t.databaseText()).toBe(before);
  });

  /**
   * Malformed or over-long `contentBase64` is refused with 400 before anything is stored. The code follows the
   * createImport description and provider-ports.md section 1.6 (strict decoding: `encoding_invalid`; more than
   * 512 KiB of decoded bytes: `too_large`), so it is IMPORT_REJECTED with that import error, not VALIDATION_FAILED.
   */
  it('refuses malformed base64 (encoding_invalid) and base64 over 699052 characters (too_large) (T11H-F01)', async () => {
    const before = t.databaseText();
    const cases: [string, string][] = [
      ['Y29t$GV0aXRpb24=', 'encoding_invalid'],
      ['Y29tcGV0aXRpb24=\n', 'encoding_invalid'],
      ['Y29t cGV0aXRpb24=', 'encoding_invalid'],
      ['Y29tcGV0aXRpb24===', 'encoding_invalid'],
      ['Y29tcGV0aXRpb24', 'encoding_invalid'],
      ['YWJj=ZGVm', 'encoding_invalid'],
      ['YQ', 'encoding_invalid'],
      ['YR==', 'encoding_invalid'],
      ['/w==', 'encoding_invalid'],
      ['A'.repeat(699056), 'too_large'],
    ];
    const outcomes: string[] = [];
    for (const [contentBase64] of cases) {
      const exchange = await client.call('createImport', {
        json: { channel: 'csv_file', fileName: 'jornada.csv', declaredSource: null, contentBase64 },
      });
      expect(exchange.violations, describeExchange(exchange)).toEqual([]);
      const problem = exchange.body as ProblemBody;
      const errors = (problem.importErrors ?? []).map((error) => error.problem).join(',');
      outcomes.push(`${contentBase64.slice(0, 24)}: ${String(exchange.status)} ${problem.code} ${errors}`);
    }
    expect(outcomes).toEqual(
      cases.map(([contentBase64, error]) => `${contentBase64.slice(0, 24)}: 400 IMPORT_REJECTED ${error}`),
    );
    expect(t.databaseText()).toBe(before);
  });

  it('accepts a brand upload of the declared media type (the refusals above are not blanket refusals)', async () => {
    const exchange = await client.call('registerBrandAsset', {
      query: { kind: 'decoration', label: 'Adorno válido' },
      payload: syntheticPng(4, 4, 'valid-upload'),
      contentType: 'image/png',
    });
    expect(exchange.status, describeExchange(exchange)).toBe(201);
    expect(exchange.violations).toEqual([]);
  });
});

describe('every answer of this file conforms to the contract', () => {
  it('has no contract violation in any recorded exchange', () => {
    const violations = client.exchanges
      .filter((exchange: Exchange) => exchange.violations.length > 0)
      .map((exchange) => `${describeExchange(exchange)}: ${exchange.violations.join('; ')}`);
    expect(violations).toEqual([]);
    expect(client.exchanges.length).toBeGreaterThan(500);
  });
});
