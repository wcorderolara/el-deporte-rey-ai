/**
 * Contract conformance support for the running app (T43): a client that sends a contract operation to the real
 * server with Fastify `inject` and checks every answer against `contracts/http-api.openapi.yaml`:
 * - the status code is declared by the operation;
 * - the media type is one the declared response lists (`application/problem+json` for every problem);
 * - a JSON body validates against the declared schema with Ajv (draft 2020-12, closed objects, per-kind fact values
 *   and per-check QA details as the contract declares them);
 * - a problem body carries its own status and the `urn:edr:problem:<code>` type;
 * - a PNG body starts with the PNG signature.
 *
 * Every exchange is recorded (operation, status, violations, body text) for the coverage and provider-neutrality
 * checks. The client never decides whether a status is the expected one; the tests do.
 */
import type { InjectOptions, LightMyRequestResponse } from 'fastify';

import { API } from '../../support/index.js';

import {
  child,
  contractOperations,
  ContractSchemas,
  isObject,
  loadContract,
  type ContractOperation,
  type JsonObject,
} from './contract-document.js';

/** The injectable part of a test app. */
export interface Injectable {
  readonly host: string;
  readonly origin: string;
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
}

export interface CallOptions {
  /** Path parameters, percent-encoded into the path. */
  readonly params?: Readonly<Record<string, string | number>>;
  /** Path parameters inserted verbatim (already encoded probes such as `..%2F..`). */
  readonly rawParams?: Readonly<Record<string, string>>;
  /** Query parameters. */
  readonly query?: Readonly<Record<string, string>>;
  /** Query string inserted verbatim (without `?`). */
  readonly rawQuery?: string;
  /** A JSON request body (sent as `application/json` unless `contentType` says otherwise). */
  readonly json?: unknown;
  /** A raw request body. */
  readonly payload?: string | Buffer;
  /** Content type of the body. */
  readonly contentType?: string;
  /** Header overrides; `undefined` removes a default header. */
  readonly headers?: Readonly<Record<string, string | undefined>>;
}

/** One request and its answer, with the contract violations of the answer. */
export interface Exchange {
  readonly operationId: string;
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly mediaType: string | null;
  readonly headers: LightMyRequestResponse['headers'];
  readonly raw: Buffer;
  readonly text: string;
  /** Parsed JSON body (problem or success), `undefined` for binary bodies. */
  readonly body: unknown;
  readonly violations: readonly string[];
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JSON_MEDIA_TYPES = new Set(['application/json', 'application/problem+json']);
const SAFE_METHODS = new Set(['get', 'head']);

/** Lowercase media type of a Content-Type header, without parameters. */
export function mediaTypeOf(header: unknown): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const value = header.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return value === '' ? null : value;
}

/** The loaded contract: operations by ID and Ajv validators. */
export class ContractSpec {
  readonly operations: ReadonlyMap<string, ContractOperation>;
  readonly schemas: ContractSchemas;

  private constructor(readonly document: JsonObject) {
    this.schemas = new ContractSchemas(document);
    this.operations = new Map(
      contractOperations(document).map((entry) => [String(entry.operation.operationId), entry]),
    );
  }

  static async load(): Promise<ContractSpec> {
    return new ContractSpec(await loadContract());
  }

  operation(operationId: string): ContractOperation {
    const operation = this.operations.get(operationId);
    if (operation === undefined) {
      throw new Error(`Contract has no operation ${operationId}`);
    }
    return operation;
  }

  get operationIds(): string[] {
    return [...this.operations.keys()];
  }

  /** Declared response statuses of an operation, as numbers. */
  statuses(operationId: string): number[] {
    return Object.keys(child(this.operation(operationId).operation, 'responses')).map(Number);
  }

  /** The success status of an operation (the only declared status below 400). */
  successStatus(operationId: string): number {
    const success = this.statuses(operationId).filter((status) => status < 400);
    if (success.length !== 1) {
      throw new Error(`${operationId} has ${String(success.length)} success statuses`);
    }
    return success[0] as number;
  }

  isMutating(operationId: string): boolean {
    return !SAFE_METHODS.has(this.operation(operationId).method);
  }

  hasBody(operationId: string): boolean {
    return this.operation(operationId).operation.requestBody !== undefined;
  }

  /** Request body media types of an operation (empty without a body). */
  bodyMediaTypes(operationId: string): string[] {
    const body = this.operation(operationId).operation.requestBody;
    return isObject(body) ? Object.keys(child(body, 'content')) : [];
  }

  /** Path parameters of an operation, with their schema `$ref` name or type. */
  pathParameters(operationId: string): { name: string; schema: string }[] {
    return this.operation(operationId)
      .parameters.filter((parameter) => parameter.in === 'path')
      .map((parameter) => {
        const schema = child(parameter, 'schema');
        const ref = typeof schema.$ref === 'string' ? (schema.$ref.split('/').pop() ?? '') : String(schema.type);
        return { name: String(parameter.name), schema: ref };
      });
  }

  /** The request path of an operation under the API base path. */
  url(operationId: string, options: CallOptions = {}): string {
    const operation = this.operation(operationId);
    const path = operation.path.replace(/\{([A-Za-z]+)\}/g, (_match, name: string) => {
      const raw = options.rawParams?.[name];
      if (raw !== undefined) {
        return raw;
      }
      const value = options.params?.[name];
      if (value === undefined) {
        throw new Error(`${operationId}: no value for path parameter ${name}`);
      }
      return encodeURIComponent(String(value));
    });
    const query =
      options.rawQuery ?? (options.query === undefined ? '' : new URLSearchParams(options.query).toString());
    return `${API}${path}${query === '' ? '' : `?${query}`}`;
  }

  /** The declared response object of a status, `$ref` resolved; null when the status is not declared. */
  private response(operationId: string, status: number): JsonObject | null {
    const responses = child(this.operation(operationId).operation, 'responses');
    const declared = responses[String(status)];
    if (!isObject(declared)) {
      return null;
    }
    if (typeof declared.$ref === 'string') {
      return child(this.document, ...declared.$ref.replace('#/', '').split('/'));
    }
    return declared;
  }

  /** Contract violations of an answer to an operation. */
  check(
    operationId: string,
    status: number,
    contentType: unknown,
    raw: Buffer,
  ): { violations: string[]; body: unknown; mediaType: string | null } {
    const violations: string[] = [];
    const mediaType = mediaTypeOf(contentType);
    const response = this.response(operationId, status);
    if (response === null) {
      return { violations: [`status ${String(status)} is not declared`], body: undefined, mediaType };
    }
    const content = response.content;
    if (!isObject(content)) {
      if (raw.length > 0) {
        violations.push('body sent for a response without content');
      }
      return { violations, body: undefined, mediaType };
    }
    if (mediaType === null || !Object.hasOwn(content, mediaType)) {
      violations.push(`media type ${String(mediaType)} is not one of ${Object.keys(content).join(', ')}`);
      return { violations, body: undefined, mediaType };
    }
    if (!JSON_MEDIA_TYPES.has(mediaType)) {
      if (raw.length === 0) {
        violations.push('empty binary body');
      }
      if (mediaType === 'image/png' && !raw.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        violations.push('image/png body without the PNG signature');
      }
      return { violations, body: undefined, mediaType };
    }
    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      violations.push('body is not JSON');
      return { violations, body: undefined, mediaType };
    }
    const schema = child(content, mediaType, 'schema');
    const validate = this.schemas.inline(`response:${operationId}:${String(status)}:${mediaType}`, schema);
    if (!validate(body)) {
      for (const error of validate.errors ?? []) {
        violations.push(
          `${error.instancePath || '(root)'} ${error.message ?? 'invalid'} ${JSON.stringify(error.params)}`,
        );
      }
    }
    if (mediaType === 'application/problem+json' && isObject(body as JsonObject)) {
      const problem = body as { status?: unknown; type?: unknown; code?: unknown };
      if (problem.status !== status) {
        violations.push(`problem status ${String(problem.status)} differs from HTTP status ${String(status)}`);
      }
      if (problem.type !== `urn:edr:problem:${String(problem.code)}` && problem.type !== 'about:blank') {
        violations.push(`problem type ${String(problem.type)} is neither about:blank nor urn:edr:problem:<code>`);
      }
    }
    return { violations, body, mediaType };
  }
}

/** Sends contract operations to a test app and records every exchange. */
export class ContractClient {
  readonly exchanges: Exchange[] = [];

  constructor(
    private readonly app: Injectable,
    readonly spec: ContractSpec,
  ) {}

  /** Default headers: the configured Host, and on other methods than GET the origin and client header. */
  private headers(operationId: string, options: CallOptions): Record<string, string> {
    const headers: Record<string, string> = { host: this.app.host };
    if (this.spec.isMutating(operationId)) {
      headers['origin'] = this.app.origin;
      headers['x-edr-client'] = 'web';
    }
    if (options.json !== undefined || options.payload !== undefined) {
      headers['content-type'] = options.contentType ?? 'application/json';
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      if (value === undefined) {
        delete headers[name.toLowerCase()];
      } else {
        headers[name.toLowerCase()] = value;
      }
    }
    return headers;
  }

  async call(operationId: string, options: CallOptions = {}): Promise<Exchange> {
    const operation = this.spec.operation(operationId);
    const url = this.spec.url(operationId, options);
    const method = operation.method.toUpperCase() as InjectOptions['method'];
    const payload = options.json !== undefined ? JSON.stringify(options.json) : options.payload;
    const response = await this.app.inject({
      method,
      url,
      headers: this.headers(operationId, options),
      ...(payload === undefined ? {} : { payload }),
    });
    const raw = response.rawPayload;
    const { violations, body, mediaType } = this.spec.check(
      operationId,
      response.statusCode,
      response.headers['content-type'],
      raw,
    );
    const exchange: Exchange = {
      operationId,
      method: String(method),
      url,
      status: response.statusCode,
      mediaType,
      headers: response.headers,
      raw,
      text: raw.toString('utf8'),
      body,
      violations,
    };
    this.exchanges.push(exchange);
    return exchange;
  }

  /** Statuses observed per operation. */
  coverage(): Map<string, Set<number>> {
    const result = new Map<string, Set<number>>();
    for (const exchange of this.exchanges) {
      const statuses = result.get(exchange.operationId) ?? new Set<number>();
      statuses.add(exchange.status);
      result.set(exchange.operationId, statuses);
    }
    return result;
  }
}

/** A short label of an exchange for assertion messages. */
export function describeExchange(exchange: Exchange): string {
  return `${exchange.operationId} ${exchange.method} ${exchange.url} -> ${String(exchange.status)} ${exchange.text.slice(0, 400)}`;
}

/** The problem fields of a problem exchange. */
export interface ProblemBody {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly errors?: readonly { path: string; message: string }[];
  readonly importErrors?: readonly {
    location: string;
    record: string;
    field: string | null;
    problem: string;
    message: string;
  }[];
  readonly facts?: readonly unknown[];
  readonly items?: readonly unknown[];
  readonly retryAfterSeconds?: number | null;
  readonly refusalReason?: string | null;
}

/** Synthetic IDs of the right shape that name nothing in a fresh database. */
export const UNKNOWN_IDS: Readonly<Record<string, string>> = Object.freeze({
  Uuid: '00000000-0000-4000-8000-0000000000ff',
  Slug: 'sin-registro',
  SourceId: 'fuente-sin-registro',
  integer: '7',
});

/** Path parameter values of the right shape for every parameter of an operation. */
export function wellFormedParams(spec: ContractSpec, operationId: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const parameter of spec.pathParameters(operationId)) {
    const value = UNKNOWN_IDS[parameter.schema];
    if (value === undefined) {
      throw new Error(`${operationId}: no sample for ${parameter.schema}`);
    }
    params[parameter.name] = value;
  }
  return params;
}
