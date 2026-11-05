/**
 * Review routes through the HTTP platform after the real content, rendering and visual QA stages, on a migrated
 * database with a temporary data directory and the bundled fonts (architecture.md sections 11.1 and 11.2; contract
 * operations getActiveDraft, getSlideImage, regenerateElement, approveElement, withdrawElementApproval,
 * acknowledgeQaWarnings, approveCarousel; R-206, R-207, R-216, R-217, R-240, R-271; OD-42; T10-F15). Synthetic facts
 * and the stub AI over the committed fixtures only; the shared setup blocks every non-loopback connection.
 *
 * Stored visual QA warnings (for example `capitalized_tokens` once its migration is applied, OD-26) are acknowledged
 * generically from the draft view before an approval; no test assumes that a version passed QA without warnings.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Draft,
  DraftSchema,
  type Element,
  ElementSchema,
  FinalApprovalSchema,
  ProblemSchema,
  QA_WARNING_CHECKS,
} from '@edr/contracts';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import type { AppContainer } from '../../container.js';
import { SANDBOXED_FILE_CONTENT_SECURITY_POLICY } from '../../platform/http/index.js';
import type { AiTextProvider } from '../../providers/ai/index.js';
import { PROJECT_ID, aiProvider, leagueFacts } from '../content/test/support.js';
import {
  FONTS,
  NO_ASSETS,
  type WorkflowFixture,
  acceptCapitalizedTokens,
  workflowFixture,
} from '../visual-qa/test/support.js';

import { createReviewModule } from './index.js';

const NOT_AVAILABLE = { available: false, reason: 'not_provided_for_stage' };
const API = '/api/v1';

let env: WorkflowFixture | null = null;
let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
  env?.close();
  env = null;
});

interface Harness {
  readonly env: WorkflowFixture;
  readonly app: FastifyInstance;
  readonly container: AppContainer;
  get(path: string): Promise<LightMyRequestResponse>;
  send(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<LightMyRequestResponse>;
  draft(): Promise<Draft>;
}

/** A drafted, rendered and checked carousel of the facts, and the app with the review module. */
async function harness(
  options: {
    readonly candidate?: boolean;
    readonly scenario?: string;
    readonly ai?: AiTextProvider;
    /** Store every QA check, `capitalized_tokens` included (the qa_results schema after migration 0002, OD-56). */
    readonly allChecks?: boolean;
  } = {},
): Promise<Harness> {
  const fixture = workflowFixture();
  env = fixture;
  if (options.allChecks === true) {
    acceptCapitalizedTokens(fixture.fixture);
  }
  const runId = fixture.run(leagueFacts(options.candidate === true ? 'candidate' : 'verified'), NOT_AVAILABLE);
  await fixture.draftAndRender(runId, options.scenario ?? 'built-in');
  await fixture.qa(runId);

  const base = fixture.container();
  const container = { ...base, aiProvider: options.ai ?? aiProvider('built-in') } as AppContainer;
  const instance = await buildApp(container, {
    webRoot: null,
    modules: [
      createReviewModule({
        rendering: { fonts: () => FONTS, assets: () => NO_ASSETS },
        visualQa: { fonts: () => FONTS },
      }),
    ],
  });
  await instance.ready();
  app = instance;
  const host = container.config.server.allowedHosts[0] ?? '127.0.0.1:4300';
  const get = (path: string) => instance.inject({ method: 'GET', url: `${API}${path}`, headers: { host } });
  const send = (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    instance.inject({
      method,
      url: `${API}${path}`,
      headers: {
        host,
        'x-edr-client': 'web',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    });
  return {
    env: fixture,
    app: instance,
    container,
    get,
    send,
    async draft() {
      const response = await get(`/projects/${PROJECT_ID}/draft`);
      expect(response.statusCode).toBe(200);
      return DraftSchema.parse(response.json());
    },
  };
}

function problem(response: LightMyRequestResponse) {
  expect(response.headers['content-type']).toContain('application/problem+json');
  return ProblemSchema.parse(response.json());
}

function elementPath(element: Element): string {
  return `/carousels/${element.carouselId}/elements/${element.id}`;
}

/** Acknowledges every failed, unacknowledged warning of the element's current version (one check per request). */
async function acknowledgeWarnings(h: Harness, element: Element): Promise<void> {
  for (const result of element.currentVersion.qa) {
    if (result.severity === 'warning' && result.outcome === 'fail' && result.acknowledgedAt === null) {
      const check = QA_WARNING_CHECKS.find((name) => name === result.check);
      const response = await h.send('POST', `${elementPath(element)}/qa-acknowledgements`, {
        versionId: element.currentVersion.id,
        checks: [check],
      });
      expect(response.statusCode).toBe(200);
    }
  }
}

/** Acknowledges the warnings of and approves every element of the first carousel. */
async function approveAll(h: Harness): Promise<Draft> {
  for (const element of (await h.draft()).carousels[0]?.elements ?? []) {
    await acknowledgeWarnings(h, element);
    const response = await h.send('PUT', `${elementPath(element)}/approval`, { versionId: element.currentVersion.id });
    expect(response.statusCode, response.body).toBe(200);
    expect(ElementSchema.parse(response.json()).currentVersion.state).toBe('approved');
  }
  return h.draft();
}

function slide(draft: Draft, slideType: string): Element {
  const found = draft.carousels[0]?.elements.find((element) => element.slideType === slideType);
  if (found === undefined) {
    throw new Error(`no ${slideType} slide`);
  }
  return found;
}

function caption(draft: Draft): Element {
  const found = draft.carousels[0]?.elements.find((element) => element.kind === 'caption');
  if (found === undefined) {
    throw new Error('no caption');
  }
  return found;
}

describe('getActiveDraft and getSlideImage', () => {
  it('returns the active draft with states, provenance, QA results and image addresses (R-208, R-269, OD-42)', async () => {
    const h = await harness();
    const draft = await h.draft();
    expect(draft).toMatchObject({ projectId: PROJECT_ID, dataMode: 'DEMO_DATA', demonstration: true });
    const carousel = draft.carousels[0];
    expect(carousel?.readyForFinalApproval).toBe(false);
    expect(carousel?.finalApproval).toBeNull();
    expect(carousel?.elements.map((element) => element.slideType)).toEqual([
      null,
      'cover',
      'match_result',
      'match_result',
      'closing',
    ]);
    for (const element of carousel?.elements ?? []) {
      const version = element.currentVersion;
      expect(version.state).toBe('ready');
      expect(version.blocked).toBe(false);
      expect(version.imageUrl).toBe(element.kind === 'slide' ? `/api/v1/element-versions/${version.id}/image` : null);
      for (const segment of version.fields.flatMap((field) => field.segments)) {
        expect(segment.factStatus).toBe(segment.provenance === 'fact' ? 'verified' : null);
      }
    }
    expect(slide(draft, 'match_result').currentVersion.qa.map((result) => result.check)).toEqual(
      expect.arrayContaining(['data_match', 'dimensions', 'style_consistency', 'team_names', 'text_fit']),
    );
  });

  it('answers 404 for an unknown project or a project without a draft, 400 for an invalid ID', async () => {
    const h = await harness();
    expect(problem(await h.get(`/projects/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}/draft`)).code).toBe(
      'NOT_FOUND',
    );
    const invalid = await h.get('/projects/not-a-uuid/draft');
    expect(invalid.statusCode).toBe(400);
    expect(problem(invalid).code).toBe('VALIDATION_FAILED');
    h.env.fixture.db.prepare("UPDATE content_drafts SET superseded_at = '2026-10-28T13:00:00.000Z'").run();
    const none = await h.get(`/projects/${PROJECT_ID}/draft`);
    expect(none.statusCode).toBe(404);
    expect(problem(none).code).toBe('NOT_FOUND');
  });

  it('serves the stored PNG of a slide version with the sandboxed file headers', async () => {
    const h = await harness();
    const draft = await h.draft();
    const match = slide(draft, 'match_result');
    const response = await h.get(`/element-versions/${match.currentVersion.id}/image`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toBe(SANDBOXED_FILE_CONTENT_SECURITY_POLICY);
    const stored = readFileSync(join(h.env.dataDir, 'renders', PROJECT_ID, `${match.currentVersion.id}.png`));
    expect(Buffer.compare(response.rawPayload, stored)).toBe(0);

    expect((await h.get(`/element-versions/${caption(draft).currentVersion.id}/image`)).statusCode).toBe(404);
    expect((await h.get('/element-versions/..%2F..%2Fetc/image')).statusCode).toBe(400);
  });
});

const SCHEMAS = [
  ['five stored checks (migration 0001)', false],
  ['every check stored, capitalized_tokens included', true],
] as const;

describe('approval, withdrawal and final approval (R-216, R-240)', () => {
  it.each(SCHEMAS)(
    'refuses the final approval until every slide is explicitly approved, then records it: %s',
    async (_name, allChecks) => {
      const h = await harness({ allChecks });
      const before = await h.draft();
      const carouselId = before.carousels[0]?.id ?? '';
      const refused = await h.send('PUT', `/carousels/${carouselId}/final-approval`);
      expect(refused.statusCode).toBe(409);
      const body = problem(refused);
      expect(body.code).toBe('FINAL_APPROVAL_REFUSED');
      // Every slide is named; the caption is not required (PD-ARCH-01E-PD-02).
      expect(new Set(body.items?.map((item) => item.elementId))).toEqual(
        new Set(
          before.carousels[0]?.elements.filter((element) => element.kind === 'slide').map((element) => element.id),
        ),
      );
      expect(body.items?.some((item) => item.reason === 'not_approved')).toBe(true);

      const approved = await approveAll(h);
      expect(approved.carousels[0]?.readyForFinalApproval).toBe(true);
      const response = await h.send('PUT', `/carousels/${carouselId}/final-approval`);
      expect(response.statusCode).toBe(200);
      const final = FinalApprovalSchema.parse(response.json());
      expect(final).toMatchObject({ carouselId, valid: true });
      expect((await h.draft()).carousels[0]?.finalApproval).toEqual(final);
    },
  );

  it('withdrawing an approval makes the element ready and the final approval invalid', async () => {
    const h = await harness();
    const draft = await approveAll(h);
    const carouselId = draft.carousels[0]?.id ?? '';
    expect((await h.send('PUT', `/carousels/${carouselId}/final-approval`)).statusCode).toBe(200);
    const match = slide(draft, 'match_result');
    const response = await h.send('DELETE', `${elementPath(match)}/approval`);
    expect(response.statusCode).toBe(200);
    expect(ElementSchema.parse(response.json()).currentVersion.state).toBe('ready');
    const after = await h.draft();
    expect(after.carousels[0]?.finalApproval?.valid).toBe(false);
    expect(after.carousels[0]?.readyForFinalApproval).toBe(false);
  });

  it('refuses a stale version with VERSION_CONFLICT and a missing client header with FORBIDDEN_ORIGIN', async () => {
    const h = await harness();
    const draft = await h.draft();
    const match = slide(draft, 'match_result');
    const cover = slide(draft, 'cover');
    const stale = await h.send('PUT', `${elementPath(match)}/approval`, { versionId: cover.currentVersion.id });
    expect(stale.statusCode).toBe(409);
    expect(problem(stale).code).toBe('VERSION_CONFLICT');

    const host = h.container.config.server.allowedHosts[0] ?? '';
    const forbidden = await h.app.inject({
      method: 'PUT',
      url: `${API}${elementPath(match)}/approval`,
      headers: { host, 'content-type': 'application/json' },
      payload: JSON.stringify({ versionId: match.currentVersion.id }),
    });
    expect(forbidden.statusCode).toBe(403);

    const blocking = await h.send('POST', `${elementPath(match)}/qa-acknowledgements`, {
      versionId: match.currentVersion.id,
      checks: ['text_fit'],
    });
    expect(blocking.statusCode).toBe(400);
    expect(problem(blocking).code).toBe('VALIDATION_FAILED');
  });

  it('single-source content is drafted, checked and refused naming the facts (R-206, R-271)', async () => {
    const h = await harness({ candidate: true });
    const draft = await h.draft();
    const match = slide(draft, 'match_result');
    expect(match.currentVersion.blocked).toBe(true);
    await acknowledgeWarnings(h, match);
    const response = await h.send('PUT', `${elementPath(match)}/approval`, { versionId: match.currentVersion.id });
    expect(response.statusCode).toBe(409);
    const body = problem(response);
    expect(body.code).toBe('APPROVAL_BLOCKED');
    expect(body.facts?.length).toBeGreaterThan(0);
    expect(body.facts?.map((fact) => fact.factKey)).toContain('match:liga-demo-1-a:score');
    for (const fact of body.facts ?? []) {
      expect(fact).toMatchObject({ status: 'unverified', blockReason: 'not_verified' });
    }
  });
});

describe('regeneration of one element (R-217)', () => {
  it.each(SCHEMAS)(
    'creates a new version of that slide only, rendered and checked, which needs approval again: %s',
    async (_name, allChecks) => {
      const h = await harness({ allChecks });
      const before = await approveAll(h);
      const carouselId = before.carousels[0]?.id ?? '';
      expect((await h.send('PUT', `/carousels/${carouselId}/final-approval`)).statusCode).toBe(200);
      const match = slide(before, 'match_result');

      const response = await h.send('POST', `${elementPath(match)}/regenerate`);
      expect(response.statusCode, response.body).toBe(201);
      const regenerated = ElementSchema.parse(response.json());
      expect(regenerated.id).toBe(match.id);
      expect(regenerated.currentVersion.id).not.toBe(match.currentVersion.id);
      expect(regenerated.currentVersion.versionNumber).toBe(2);
      expect(regenerated.currentVersion.state).toBe('ready');
      expect(regenerated.currentVersion.imageUrl).toBe(
        `/api/v1/element-versions/${regenerated.currentVersion.id}/image`,
      );
      expect(regenerated.currentVersion.qa.length).toBeGreaterThan(0);

      const after = await h.draft();
      for (const element of after.carousels[0]?.elements ?? []) {
        const previous = before.carousels[0]?.elements.find((candidate) => candidate.id === element.id);
        if (element.id === match.id) {
          expect(element.currentVersion.state).toBe('ready');
        } else {
          expect(element.currentVersion.id).toBe(previous?.currentVersion.id);
          expect(element.currentVersion.state).toBe('approved');
        }
      }
      expect(after.carousels[0]?.finalApproval?.valid).toBe(false);
      const refused = problem(await h.send('PUT', `/carousels/${carouselId}/final-approval`));
      expect(refused.items).toContainEqual({ elementId: match.id, reason: 'not_approved' });
      // The superseded version keeps its image for history; its approval is not carried over.
      expect((await h.get(`/element-versions/${match.currentVersion.id}/image`)).statusCode).toBe(200);
      const stale = await h.send('PUT', `${elementPath(match)}/approval`, { versionId: match.currentVersion.id });
      expect(problem(stale).code).toBe('VERSION_CONFLICT');

      const element = (await h.draft()).carousels[0]?.elements.find((candidate) => candidate.id === match.id);
      if (element === undefined) {
        throw new Error('element missing');
      }
      await acknowledgeWarnings(h, element);
      expect(
        (await h.send('PUT', `${elementPath(element)}/approval`, { versionId: element.currentVersion.id })).statusCode,
      ).toBe(200);
      expect((await h.send('PUT', `/carousels/${carouselId}/final-approval`)).statusCode).toBe(200);
    },
  );

  it('regenerates the caption without a render and checks it', async () => {
    const h = await harness();
    const draft = await h.draft();
    const element = caption(draft);
    const response = await h.send('POST', `${elementPath(element)}/regenerate`);
    expect(response.statusCode, response.body).toBe(201);
    const regenerated = ElementSchema.parse(response.json());
    expect(regenerated.currentVersion).toMatchObject({ versionNumber: 2, imageUrl: null, state: 'ready' });
  });

  it('answers 404 for an element of another carousel and 409 for a superseded draft', async () => {
    const h = await harness();
    const draft = await h.draft();
    const match = slide(draft, 'match_result');
    const otherCarousel = `/carousels/${'1'.repeat(8)}-1111-4111-8111-${'1'.repeat(12)}/elements/${match.id}`;
    expect(problem(await h.send('POST', `${otherCarousel}/regenerate`)).code).toBe('NOT_FOUND');
    h.env.fixture.db.prepare("UPDATE content_drafts SET superseded_at = '2026-10-28T13:00:00.000Z'").run();
    const response = await h.send('POST', `${elementPath(match)}/regenerate`);
    expect(response.statusCode).toBe(409);
    expect(problem(response).code).toBe('VERSION_CONFLICT');
  });
});

describe('atomic guards against a racing regeneration (T10-F15)', () => {
  /** An AI provider that holds every draft request until released. */
  function gatedAi(inner: AiTextProvider) {
    let release: () => void = () => undefined;
    let called: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      called = resolve;
    });
    const provider: AiTextProvider = {
      id: inner.id,
      generateDraft: async (request, ctx) => {
        called();
        await gate;
        return inner.generateDraft(request, ctx);
      },
    };
    return { provider, release: () => release(), requested };
  }

  it('an approval racing a regeneration returns VERSION_CONFLICT once superseded; a final approval never keeps a stale set', async () => {
    const ai = gatedAi(aiProvider('built-in'));
    const h = await harness({ ai: ai.provider });
    const draft = await h.draft();
    const carouselId = draft.carousels[0]?.id ?? '';
    const match = slide(draft, 'match_result');
    const others = (draft.carousels[0]?.elements ?? []).filter((element) => element.id !== match.id);
    for (const element of others) {
      await acknowledgeWarnings(h, element);
      expect(
        (await h.send('PUT', `${elementPath(element)}/approval`, { versionId: element.currentVersion.id })).statusCode,
      ).toBe(200);
    }
    await acknowledgeWarnings(h, match);

    // The regeneration waits for the AI; the version is still current, so its approval and the final approval pass.
    const regeneration = h.send('POST', `${elementPath(match)}/regenerate`);
    await ai.requested;
    expect(
      (await h.send('PUT', `${elementPath(match)}/approval`, { versionId: match.currentVersion.id })).statusCode,
    ).toBe(200);
    const final = await h.send('PUT', `/carousels/${carouselId}/final-approval`);
    expect(final.statusCode).toBe(200);
    const finalId = FinalApprovalSchema.parse(final.json()).id;

    ai.release();
    expect((await regeneration).statusCode).toBe(201);

    // The supersession and the invalidation were one transaction: the final approval of the old set is invalid.
    const row = h.env.fixture.db
      .prepare<{ invalidated_at: string | null }>('SELECT invalidated_at FROM final_approvals WHERE id = ?')
      .get([finalId]);
    expect(row?.invalidated_at).not.toBeNull();
    const late = await h.send('PUT', `${elementPath(match)}/approval`, { versionId: match.currentVersion.id });
    expect(late.statusCode).toBe(409);
    expect(problem(late).code).toBe('VERSION_CONFLICT');
    const refused = await h.send('PUT', `/carousels/${carouselId}/final-approval`);
    expect(problem(refused).code).toBe('FINAL_APPROVAL_REFUSED');

    // No valid final approval references a superseded version.
    const stale = h.env.fixture.db
      .prepare<{ n: number }>(
        'SELECT COUNT(*) AS n FROM final_approvals f, json_each(f.version_set) j ' +
          'JOIN element_versions v ON v.id = j.value WHERE f.invalidated_at IS NULL AND v.superseded_at IS NOT NULL',
      )
      .get();
    expect(stale?.n).toBe(0);
  });

  it('two regenerations of the same element: the second one is refused with VERSION_CONFLICT', async () => {
    const ai = gatedAi(aiProvider('built-in'));
    const h = await harness({ ai: ai.provider });
    const match = slide(await h.draft(), 'match_result');
    const first = h.send('POST', `${elementPath(match)}/regenerate`);
    const second = h.send('POST', `${elementPath(match)}/regenerate`);
    await ai.requested;
    ai.release();
    const statuses = [(await first).statusCode, (await second).statusCode].sort();
    expect(statuses).toEqual([201, 409]);
    const versions = h.env.fixture.db
      .prepare<{ n: number }>('SELECT COUNT(*) AS n FROM element_versions WHERE element_id = ?')
      .get([match.id]);
    expect(versions?.n).toBe(2);
  });
});
