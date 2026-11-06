/**
 * Test app factory (T41): starts the real server (`startServer`: configuration loading, data directory, migrations,
 * container, module hooks, HTTP platform, loopback listener) on a generated configuration in a temporary directory,
 * with
 * - the environment of the generated configuration only (`EDR_CONFIG`, `EDR_DATA_DIR`, `EDR_PORT`, plus what the test
 *   adds): never `FOOTBALL_DATA_API_TOKEN`;
 * - the production provider factories, with the `createSportsSources` test seam registering `test-live`, an egress
 *   override (default: a recording wrapper of the configured egress client; for example a replay transport), and a
 *   recording wrapper of the AI provider;
 * - the static module registry, with the projects module's runner using the registered stages and placeholders for
 *   the stages no module registers yet (`stages.ts`);
 * - a captured redacting logger.
 *
 * HTTP helpers use `inject` with the configured Host (and Origin and `X-EDR-Client` on writes); `request` uses the
 * TCP listener. All data is synthetic; the temporary directory is removed by `close()`.
 */
import http from 'node:http';
import { join } from 'node:path';

import {
  type FactListResponse,
  FactListResponseSchema,
  type Project,
  ProjectSchema,
  type Run,
  RunSchema,
} from '@edr/contracts';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

import type { AppContainer, ProviderFactories } from '../../src/container.js';
import { type RunningServer, startServer } from '../../src/main.js';
import type { StageName } from '../../src/modules/module-kit.js';
import { type ProjectsModule, createProjectsModule } from '../../src/modules/projects/index.js';
import { serverModules } from '../../src/modules/registry.js';
import type { EgressClient } from '../../src/platform/net/index.js';
import { type AiTextProvider, type DraftRequest, createAiProvider } from '../../src/providers/ai/index.js';
import { createImageProvider } from '../../src/providers/images/index.js';
import { type AdapterRegistration, createSportsSources } from '../../src/providers/sports/index.js';
import type { AnyStage } from '../../src/workflow/index.js';

import { type RecordingEgress, recordingEgress } from './egress.js';
import {
  type Json,
  type LogCapture,
  REPO_ROOT,
  type TemporaryDirectory,
  type WrittenConfig,
  captureLog,
  freePort,
  generateConfigDocument,
  temporaryDirectory,
  writeConfig,
} from './environment.js';
import { workflowStages } from './stages.js';
import { testLiveAdapter } from './test-live-adapter.js';

export interface TestAppOptions {
  /** Base configuration under `fixtures/config/` (default `demo-only`) or a document. */
  readonly base?: string | Json;
  readonly scenario?: string;
  readonly scenarios?: Readonly<Record<string, string>>;
  readonly mutate?: (document: Json) => void;
  readonly extraHosts?: readonly string[];
  readonly extraOrigins?: readonly string[];
  /** Reuse a data directory (a restart on the same data); default a new one in the temporary directory. */
  readonly dataDir?: string;
  /** Egress client handed to the providers instead of the configured one (it is still recorded). */
  readonly egress?: EgressClient;
  /** Egress client handed to the image provider instead of the configured image client (PD-ARCH-01G-B). */
  readonly imageEgress?: EgressClient;
  /** Extra process environment entries (for example `EDR_AI_API_KEY` for the AI adapter). */
  readonly env?: Readonly<Record<string, string>>;
  /** Test-only adapter kinds; default `[testLiveAdapter]`. */
  readonly extraAdapters?: readonly AdapterRegistration[];
  /** Stages replacing the registered ones. */
  readonly stageOverrides?: Partial<Record<StageName, AnyStage>>;
}

export interface TestApp {
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  readonly server: RunningServer;
  readonly projects: ProjectsModule;
  readonly config: WrittenConfig;
  readonly port: number;
  readonly host: string;
  readonly origin: string;
  readonly readHeaders: Readonly<Record<string, string>>;
  readonly writeHeaders: Readonly<Record<string, string>>;
  /** Every egress request made by a provider. */
  readonly egress: RecordingEgress;
  /** Every draft request handed to the AI provider. */
  readonly aiRequests: readonly DraftRequest[];
  readonly log: LogCapture;
  /** Stages of the fixed order run by placeholders. */
  readonly placeholders: readonly StageName[];
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
  get(path: string, headers?: Readonly<Record<string, string>>): Promise<LightMyRequestResponse>;
  send(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<LightMyRequestResponse>;
  /** A raw request over TCP to the loopback listener. */
  request(options: RawRequestOptions): Promise<RawResponse>;
  createProject(selection: ProjectSelection): Promise<Project>;
  /** Starts a run and waits until it has stopped; returns the run as the API reports it. */
  runWorkflow(projectId: string, kind?: 'full' | 'redraft'): Promise<Run>;
  getRun(projectId: string, runId: string): Promise<Run>;
  listFacts(projectId: string, runId: string): Promise<FactListResponse>;
  /** Every row of every table, as text (for absence checks). */
  databaseText(): string;
  close(): Promise<void>;
}

export interface ProjectSelection {
  readonly competitionId: string;
  readonly sourceId: string;
  readonly seasonId: string;
  readonly stageId: string;
  readonly matchday: number | null;
}

export interface RawRequestOptions {
  readonly method?: string;
  readonly path?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface RawResponse {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  readonly body: string;
}

export const API = '/api/v1';

/** A raw HTTP request to `127.0.0.1:<port>` with full control of the headers. */
export function rawRequest(port: number, options: RawRequestOptions): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: options.method ?? 'GET',
        path: options.path ?? '/',
        headers: options.headers,
        setHost: options.headers?.['host'] === undefined && options.headers?.['Host'] === undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    req.end(options.body);
  });
}

function recordingAi(inner: AiTextProvider, requests: DraftRequest[]): AiTextProvider {
  return Object.freeze({
    id: inner.id,
    generateDraft: (request: DraftRequest, ctx: Parameters<AiTextProvider['generateDraft']>[1]) => {
      requests.push(structuredClone(request));
      return inner.generateDraft(request, ctx);
    },
  });
}

/** Text of every row of every table of the database (BLOBs as latin1 text). */
export function databaseText(container: AppContainer): string {
  const tables = container.db
    .prepare<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all();
  const parts: string[] = [];
  for (const { name } of tables) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      throw new Error('unexpected table name');
    }
    const rows = container.db.prepare('SELECT * FROM "' + name + '"').all();
    parts.push(
      `${name}: ${JSON.stringify(rows, (_key, value: unknown) =>
        value instanceof Uint8Array ? Buffer.from(value).toString('latin1') : value,
      )}`,
    );
  }
  return parts.join('\n');
}

/** Starts a test app; the caller closes it (`close()` also removes the temporary directory). */
export async function startTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const dir: TemporaryDirectory = temporaryDirectory('app');
  try {
    const port = await freePort();
    const document = generateConfigDocument({
      base: options.base ?? 'demo-only',
      ...(options.scenario === undefined ? {} : { scenario: options.scenario }),
      ...(options.scenarios === undefined ? {} : { scenarios: options.scenarios }),
      ...(options.mutate === undefined ? {} : { mutate: options.mutate }),
      server: {
        port,
        ...(options.extraHosts === undefined ? {} : { extraHosts: options.extraHosts }),
        ...(options.extraOrigins === undefined ? {} : { extraOrigins: options.extraOrigins }),
      },
    });
    const config = writeConfig(dir.path, document, options.dataDir ?? join(dir.path, 'data'));

    const log = captureLog('debug');
    const aiRequests: DraftRequest[] = [];
    let egress: RecordingEgress | null = null;
    const egressFor = (configured: EgressClient): RecordingEgress => {
      egress ??= recordingEgress(options.egress ?? configured);
      return egress;
    };
    const extraAdapters = options.extraAdapters ?? [testLiveAdapter];
    const providers: ProviderFactories = {
      createSportsSources: (appConfig, deps) =>
        createSportsSources(appConfig, { ...deps, egress: egressFor(deps.egress) }, { extraAdapters }),
      createAiProvider: (appConfig, deps) =>
        recordingAi(createAiProvider(appConfig, { ...deps, egress: egressFor(deps.egress) }), aiRequests),
      createImageProvider: (appConfig, deps) =>
        createImageProvider(appConfig, { ...deps, egress: options.imageEgress ?? deps.egress }),
    };

    const stages = workflowStages(serverModules, options.stageOverrides);
    const projects = createProjectsModule({ stages: stages.provider });
    const modules = serverModules.map((serverModule) => (serverModule.name === 'projects' ? projects : serverModule));

    const server = await startServer({
      rootDir: REPO_ROOT,
      env: { ...config.env, ...options.env },
      providers,
      modules,
      logger: log.logger,
      webRoot: null,
    });
    const recorded = egressFor(server.container.egress);
    const host = `127.0.0.1:${String(port)}`;
    const origin = `http://${host}`;
    const readHeaders = Object.freeze({ host });
    const writeHeaders = Object.freeze({ host, origin, 'x-edr-client': 'web', 'content-type': 'application/json' });
    const { app, container } = server;

    const get = (path: string, headers: Readonly<Record<string, string>> = readHeaders) =>
      app.inject({ method: 'GET', url: `${API}${path}`, headers });
    const send = (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
      app.inject({
        method,
        url: `${API}${path}`,
        headers: body === undefined ? { host, origin, 'x-edr-client': 'web' } : writeHeaders,
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
    const getRun = async (projectId: string, runId: string): Promise<Run> => {
      const response = await get(`/projects/${projectId}/runs/${runId}`);
      expect(response.statusCode, response.body).toBe(200);
      return RunSchema.parse(response.json());
    };

    return {
      app,
      container,
      server,
      projects,
      config,
      port,
      host,
      origin,
      readHeaders,
      writeHeaders,
      egress: recorded,
      aiRequests,
      log,
      placeholders: stages.placeholders,
      inject: (request) => app.inject(request),
      get,
      send,
      request: (request) => rawRequest(port, request),
      createProject: async (selection) => {
        const response = await send('POST', '/projects', selection);
        expect(response.statusCode, response.body).toBe(201);
        return ProjectSchema.parse(response.json());
      },
      runWorkflow: async (projectId, kind = 'full') => {
        const response = await send('POST', `/projects/${projectId}/runs`, { kind });
        expect(response.statusCode, response.body).toBe(202);
        const started = RunSchema.parse(response.json());
        await projects.runnerFor(container).settled(started.id);
        return getRun(projectId, started.id);
      },
      getRun,
      listFacts: async (projectId, runId) => {
        const response = await get(`/projects/${projectId}/runs/${runId}/facts`);
        expect(response.statusCode, response.body).toBe(200);
        return FactListResponseSchema.parse(response.json());
      },
      databaseText: () => databaseText(container),
      close: async () => {
        try {
          await server.close();
        } finally {
          dir.remove();
        }
      },
    };
  } catch (error) {
    dir.remove();
    throw error;
  }
}

/** The selection of matchday 1 of the league stage of `liga-demo` (the focus of most T23 scenarios). */
export const LIGA_DEMO_MD1: ProjectSelection = Object.freeze({
  competitionId: 'liga-demo',
  sourceId: 'demo-a',
  seasonId: '2026',
  stageId: 'temporada-regular',
  matchday: 1,
});
