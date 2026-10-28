/**
 * Test-only support of the export tests: a carousel drafted, rendered and checked by the real content, rendering and
 * visual QA stages (the visual QA workflow fixture: migrated database, temporary data directory, bundled fonts,
 * synthetic facts, stub AI over the committed `fixtures/ai/`), served by the review and export modules through the
 * HTTP platform with `inject` only. Synthetic data only; nothing opens a connection. Not used by production code.
 */
import {
  type Draft,
  DraftSchema,
  type Element,
  ElementSchema,
  type FinalApproval,
  FinalApprovalSchema,
  ProblemSchema,
  QA_WARNING_CHECKS,
} from '@edr/contracts';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';

import { buildApp } from '../../../app.js';
import type { AppContainer } from '../../../container.js';
import { type Facts, PROJECT_ID, aiProvider, leagueFacts } from '../../content/test/support.js';
import { createReviewModule } from '../../review/index.js';
import { FONTS, NO_ASSETS, type WorkflowFixture, workflowFixture } from '../../visual-qa/test/support.js';
import type { ExportFileStore } from '../files.js';
import { createExportModule } from '../index.js';

export { PROJECT_ID };

export const API = '/api/v1';
const NOT_AVAILABLE = { available: false, reason: 'not_provided_for_stage' };

export interface ExportHarness {
  readonly env: WorkflowFixture;
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  get(path: string): Promise<LightMyRequestResponse>;
  send(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<LightMyRequestResponse>;
  draft(): Promise<Draft>;
  /** The first carousel of the active draft. */
  carousel(): Promise<Draft['carousels'][number]>;
  /** Acknowledges every failed warning of and approves every element of the first carousel. */
  approveAll(): Promise<Draft>;
  /** Final approval of the first carousel (expects 200). */
  finalApprove(): Promise<FinalApproval>;
  /** exportCarousel of the first carousel. */
  exportCarousel(): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

export interface ExportHarnessOptions {
  readonly facts?: Facts;
  /** A file store replacing the default one (fault injection). */
  readonly files?: (dataDir: string) => ExportFileStore;
}

/** A drafted, rendered and checked carousel of synthetic league facts, and an app with the review and export modules. */
export async function exportHarness(options: ExportHarnessOptions = {}): Promise<ExportHarness> {
  const env = workflowFixture();
  try {
    const runId = env.run(options.facts ?? leagueFacts('verified'), NOT_AVAILABLE);
    await env.draftAndRender(runId, 'built-in');
    await env.qa(runId);
    const container = { ...env.container(), aiProvider: aiProvider('built-in') } as AppContainer;
    const app = await buildApp(container, {
      webRoot: null,
      modules: [
        createReviewModule({
          rendering: { fonts: () => FONTS, assets: () => NO_ASSETS },
          visualQa: { fonts: () => FONTS },
        }),
        createExportModule(options.files === undefined ? {} : { files: options.files(env.dataDir) }),
      ],
    });
    await app.ready();
    const host = container.config.server.allowedHosts[0] ?? '127.0.0.1:4300';
    const get = (path: string) => app.inject({ method: 'GET', url: `${API}${path}`, headers: { host } });
    const send = (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
      app.inject({
        method,
        url: `${API}${path}`,
        headers: {
          host,
          'x-edr-client': 'web',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
    const draft = async (): Promise<Draft> => {
      const response = await get(`/projects/${PROJECT_ID}/draft`);
      expect(response.statusCode, response.body).toBe(200);
      return DraftSchema.parse(response.json());
    };
    const carousel = async () => {
      const first = (await draft()).carousels[0];
      if (first === undefined) {
        throw new Error('the draft has no carousel');
      }
      return first;
    };
    return {
      env,
      app,
      container,
      get,
      send,
      draft,
      carousel,
      async approveAll() {
        for (const element of (await carousel()).elements) {
          await acknowledgeWarnings(send, element);
          const response = await send('PUT', `${elementPath(element)}/approval`, {
            versionId: element.currentVersion.id,
          });
          expect(response.statusCode, response.body).toBe(200);
          expect(ElementSchema.parse(response.json()).currentVersion.state).toBe('approved');
        }
        return draft();
      },
      async finalApprove() {
        const response = await send('PUT', `/carousels/${(await carousel()).id}/final-approval`);
        expect(response.statusCode, response.body).toBe(200);
        return FinalApprovalSchema.parse(response.json());
      },
      async exportCarousel() {
        return send('POST', `/carousels/${(await carousel()).id}/exports`);
      },
      async close() {
        try {
          await app.close();
        } finally {
          env.close();
        }
      },
    };
  } catch (error) {
    env.close();
    throw error;
  }
}

export function elementPath(element: Element): string {
  return `/carousels/${element.carouselId}/elements/${element.id}`;
}

/** Acknowledges every failed, unacknowledged warning of the element's current version (one check per request). */
export async function acknowledgeWarnings(send: ExportHarness['send'], element: Element): Promise<void> {
  for (const result of element.currentVersion.qa) {
    if (result.severity === 'warning' && result.outcome === 'fail' && result.acknowledgedAt === null) {
      const check = QA_WARNING_CHECKS.find((name) => name === result.check);
      const response = await send('POST', `${elementPath(element)}/qa-acknowledgements`, {
        versionId: element.currentVersion.id,
        checks: [check],
      });
      expect(response.statusCode, response.body).toBe(200);
    }
  }
}

/** The problem body of a response (problem+json). */
export function problem(response: LightMyRequestResponse) {
  expect(response.headers['content-type']).toContain('application/problem+json');
  return ProblemSchema.parse(response.json());
}

/** Number of rows of a table of the harness database. */
export function rowCount(container: AppContainer, table: 'exports' | 'export_files'): number {
  const sql = table === 'exports' ? 'SELECT COUNT(*) AS n FROM exports' : 'SELECT COUNT(*) AS n FROM export_files';
  return container.db.prepare<{ n: number }>(sql).get()?.n ?? -1;
}
