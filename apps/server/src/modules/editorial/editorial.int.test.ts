/**
 * Editorial copy through the running server (PD-ARCH-01H): the package of a project's draft, generation of the five
 * deliverables, idempotency, regeneration of one deliverable with an operator instruction, edits checked like the
 * writer's text, approvals bound to the exact version, failures and timeouts recorded without retry, the startup
 * interruption, and the PD-30 controls of a billed writer (cost confirmation, key, daily and monthly limits) over a
 * fake egress client. No paid call is made; all data is synthetic.
 */
import type { EditorialGenerationResult, EditorialPackage, EditorialVersion } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY } from '../../../../../vitest.setup.js';
import { LIGA_DEMO_MD1, type TestApp, startTestApp } from '../../../test/support/index.js';
import type { EgressClient } from '../../platform/net/index.js';
import { EDITORIAL_DATA_HEADER, parseEditorialRequest, stubEditorialAnswer } from '../../providers/ai/index.js';

import { EditorialService } from './service.js';

let t: TestApp | null = null;

afterEach(async () => {
  await t?.close();
  t = null;
});

const KEYS = Array.from({ length: 20 }, (_, index) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`);

const HOSTED = {
  baseUrl: 'https://ai.example.test/v1',
  model: 'gpt-test-mini',
  timeoutMs: 60000,
  maxOutputTokens: 4000,
  pricing: {
    currency: 'USD',
    inputPerMillionTokens: 2,
    outputPerMillionTokens: 10,
    source: 'https://ai.example.test/pricing',
    checkedOn: '2026-11-10',
  },
  limits: { maxGenerationsPerDay: 30, monthlySpendLimit: 5 },
};

/** A fake chat-completions provider answering with the stub's text for the request it receives. */
function fakeProvider(): { egress: EgressClient; calls: number } {
  const state = { egress: null as unknown as EgressClient, calls: 0 };
  state.egress = {
    request(_url, init) {
      state.calls += 1;
      const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
      const user = body.messages[1]?.content ?? '';
      const request = parseEditorialRequest(JSON.parse(user.slice(EDITORIAL_DATA_HEADER.length + 1)));
      const text = JSON.stringify({
        choices: [{ message: { content: JSON.stringify(stubEditorialAnswer(request)) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3000, completion_tokens: 900 },
      });
      return Promise.resolve({ status: 200, text, headers: new Headers() });
    },
  };
  return state;
}

async function projectWithDraft(app: TestApp): Promise<string> {
  const project = await app.createProject(LIGA_DEMO_MD1);
  const run = await app.runWorkflow(project.id);
  expect(run.status).toBe('completed');
  return project.id;
}

async function editorial(app: TestApp, projectId: string): Promise<EditorialPackage> {
  const response = await app.get(`/projects/${projectId}/editorial`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<EditorialPackage>();
}

function current(pkg: EditorialPackage, deliverable: string): EditorialVersion {
  const version = pkg.deliverables.find((entry) => entry.deliverable === deliverable)?.current;
  if (version === null || version === undefined) {
    throw new Error(`no current version of ${deliverable}`);
  }
  return version;
}

describe('editorial copy with the stub writer (no AI)', () => {
  it('generates, regenerates with instructions, edits and approves each deliverable on its own', async () => {
    t = await startTestApp();
    const app = t;
    const project = await app.createProject(LIGA_DEMO_MD1);

    const empty = await editorial(app, project.id);
    expect(empty).toMatchObject({ available: false, unavailableReason: 'no_draft', deliverables: [], context: null });
    const refused = await app.send('POST', `/projects/${project.id}/editorial/generations`, { requestKey: KEYS[0] });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'EDITORIAL_NOT_GENERATABLE' });

    await app.runWorkflow(project.id);
    const before = await editorial(app, project.id);
    expect(before.available).toBe(true);
    expect(before.writer).toMatchObject({
      adapter: 'stub',
      kind: 'test',
      requiresCostConfirmation: false,
      estimate: { status: 'free' },
    });
    expect(before.research.mode).toBe('local_context');
    expect(before.deliverables.every((entry) => entry.current === null)).toBe(true);

    const created = await app.send('POST', `/projects/${project.id}/editorial/generations`, { requestKey: KEYS[1] });
    expect(created.statusCode).toBe(201);
    const result = created.json<EditorialGenerationResult>();
    expect(result.generation).toMatchObject({
      status: 'succeeded',
      writerKind: 'test',
      promptVersion: 'edr-editorial-v1',
      researchMode: 'local_context',
      deliverables: ['facebook_instagram', 'tiktok_reels', 'viral_headlines', 'youtube', 'debate_question'],
      estimatedCost: null,
    });
    for (const entry of result.package.deliverables) {
      expect(entry.current).toMatchObject({ versionNumber: 1, origin: 'generated', state: 'ready', flags: [] });
    }

    // The same key and request return the stored generation; another request under it is refused.
    const again = await app.send('POST', `/projects/${project.id}/editorial/generations`, { requestKey: KEYS[1] });
    expect(again.json<EditorialGenerationResult>().generation.id).toBe(result.generation.id);
    const reused = await app.send('POST', `/projects/${project.id}/editorial/generations`, {
      requestKey: KEYS[1],
      deliverable: 'youtube',
    });
    expect(reused.statusCode).toBe(409);
    expect(reused.json()).toMatchObject({ code: 'REQUEST_KEY_REUSED' });

    // Approve the main copy, then regenerate only TikTok with an instruction: the approval stays.
    const main = current(result.package, 'facebook_instagram');
    const approved = await app.send(
      'PUT',
      `/projects/${project.id}/editorial/deliverables/facebook_instagram/approval`,
      {
        versionId: main.id,
      },
    );
    expect(approved.statusCode).toBe(200);
    expect(approved.json<EditorialVersion>()).toMatchObject({ state: 'approved' });
    const regenerated = await app.send('POST', `/projects/${project.id}/editorial/generations`, {
      requestKey: KEYS[2],
      deliverable: 'tiktok_reels',
      instructions: 'Reduce el sarcasmo',
    });
    expect(regenerated.statusCode).toBe(201);
    const afterRegeneration = regenerated.json<EditorialGenerationResult>().package;
    expect(current(afterRegeneration, 'tiktok_reels')).toMatchObject({
      versionNumber: 2,
      origin: 'regenerated',
      instructions: 'Reduce el sarcasmo',
    });
    expect(current(afterRegeneration, 'facebook_instagram')).toMatchObject({ id: main.id, state: 'approved' });
    expect(current(afterRegeneration, 'youtube').versionNumber).toBe(1);

    // An approval names the exact current version.
    const stale = await app.send('PUT', `/projects/${project.id}/editorial/deliverables/tiktok_reels/approval`, {
      versionId: current(result.package, 'tiktok_reels').id,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });

    // An edit with an invented score is flagged and cannot be approved; a corrected edit can.
    const tiktok = current(afterRegeneration, 'tiktok_reels');
    const invented = await app.send('POST', `/projects/${project.id}/editorial/deliverables/tiktok_reels/edits`, {
      baseVersionId: tiktok.id,
      fields: [{ name: 'copy', text: 'Goleada histórica: 7-0 y a casa.' }],
    });
    expect(invented.statusCode).toBe(201);
    const flagged = invented.json<EditorialVersion>();
    expect(flagged).toMatchObject({ origin: 'edited', state: 'flagged', versionNumber: 3 });
    expect(flagged.flags.map((flag) => flag.code)).toContain('UNVERIFIED_NUMBER');
    const blocked = await app.send('PUT', `/projects/${project.id}/editorial/deliverables/tiktok_reels/approval`, {
      versionId: flagged.id,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ code: 'CONTENT_FLAGGED' });
    const fixed = await app.send('POST', `/projects/${project.id}/editorial/deliverables/tiktok_reels/edits`, {
      baseVersionId: flagged.id,
      fields: [{ name: 'copy', text: 'Jornada con tela que cortar. ¿Tú qué opinas?' }],
    });
    const ready = fixed.json<EditorialVersion>();
    expect(ready).toMatchObject({ state: 'ready', versionNumber: 4 });
    const wrongField = await app.send('POST', `/projects/${project.id}/editorial/deliverables/tiktok_reels/edits`, {
      baseVersionId: ready.id,
      fields: [{ name: 'title', text: 'No es de TikTok' }],
    });
    expect(wrongField.statusCode).toBe(400);
    await app.send('PUT', `/projects/${project.id}/editorial/deliverables/tiktok_reels/approval`, {
      versionId: ready.id,
    });
    const withdrawn = await app.send('DELETE', `/projects/${project.id}/editorial/deliverables/tiktok_reels/approval`);
    expect(withdrawn.json<EditorialVersion>()).toMatchObject({ id: ready.id, state: 'ready', approvedAt: null });

    const final = await editorial(app, project.id);
    expect(final.deliverables.find((entry) => entry.deliverable === 'tiktok_reels')?.versionCount).toBe(4);
  });

  it('records a failed generation without retrying and keeps the previous versions', async () => {
    t = await startTestApp({
      mutate: (document) => {
        (document['providers'] as Record<string, unknown>)['editorial'] = {
          adapter: 'stub',
          options: { scenario: 'timeout' },
        };
      },
    });
    const projectId = await projectWithDraft(t);
    const response = await t.send('POST', `/projects/${projectId}/editorial/generations`, { requestKey: KEYS[3] });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ code: 'PROVIDER_FAILED' });
    const pkg = await editorial(t, projectId);
    expect(pkg.lastGeneration).toMatchObject({ status: 'failed', errorCode: 'timeout' });
    expect(pkg.deliverables.every((entry) => entry.current === null)).toBe(true);
  });

  it('marks generations interrupted by a restart as failed', async () => {
    t = await startTestApp();
    const projectId = await projectWithDraft(t);
    await t.send('POST', `/projects/${projectId}/editorial/generations`, { requestKey: KEYS[4] });
    const service = new EditorialService(t.container);
    expect(service.interruptRunning()).toBe(0);
  });
});

describe('editorial copy with a billed writer (PD-30)', () => {
  function billedApp(
    provider: { egress: EgressClient },
    options: { env?: Record<string, string>; limits?: Record<string, unknown> } = {},
  ) {
    return startTestApp({
      egress: provider.egress,
      env: options.env ?? { EDR_AI_API_KEY: TEST_DUMMY_API_KEY },
      mutate: (document) => {
        (document['providers'] as Record<string, unknown>)['editorial'] = {
          adapter: 'openai-compatible',
          options: { ...HOSTED, limits: { ...HOSTED.limits, ...(options.limits ?? {}) } },
        };
      },
    });
  }

  it('needs an explicit cost confirmation, records usage and cost, and never stores the key', async () => {
    const provider = fakeProvider();
    t = await billedApp(provider);
    const projectId = await projectWithDraft(t);
    const pkg = await editorial(t, projectId);
    expect(pkg.writer).toMatchObject({
      adapter: 'openai-compatible',
      kind: 'hosted_ai',
      model: 'gpt-test-mini',
      status: 'ready',
      requiresCostConfirmation: true,
      monthlySpendLimit: 5,
      spentThisMonth: 0,
      estimate: { status: 'estimated' },
    });
    const unconfirmed = await t.send('POST', `/projects/${projectId}/editorial/generations`, { requestKey: KEYS[5] });
    expect(unconfirmed.statusCode).toBe(409);
    expect(unconfirmed.json()).toMatchObject({ code: 'COST_CONFIRMATION_REQUIRED' });
    expect(provider.calls).toBe(0);

    const confirmed = await t.send('POST', `/projects/${projectId}/editorial/generations`, {
      requestKey: KEYS[6],
      confirmCost: true,
    });
    expect(confirmed.statusCode).toBe(201);
    expect(provider.calls).toBe(1);
    const generation = confirmed.json<EditorialGenerationResult>().generation;
    // (3000 × 2 + 900 × 10) / 1e6, from the reported usage.
    expect(generation).toMatchObject({ writerKind: 'hosted_ai', model: 'gpt-test-mini', computedCost: 0.015 });
    expect(generation.estimatedCost).toBeGreaterThan(generation.computedCost ?? 0);
    expect((await editorial(t, projectId)).writer.spentThisMonth).toBe(0.015);
    expect(t.databaseText()).not.toContain(TEST_DUMMY_API_KEY);
    expect(t.log.text()).not.toContain(TEST_DUMMY_API_KEY);
    expect(t.log.text()).toContain('editorial generation completed');
  });

  it('refuses without a key, over the daily count and over the monthly spend, before any request', async () => {
    const noKey = fakeProvider();
    t = await billedApp(noKey, { env: {} });
    let projectId = await projectWithDraft(t);
    expect((await editorial(t, projectId)).writer.status).toBe('missing_api_key');
    const missing = await t.send('POST', `/projects/${projectId}/editorial/generations`, {
      requestKey: KEYS[7],
      confirmCost: true,
    });
    expect(missing.statusCode).toBe(503);
    expect(missing.json()).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE' });
    expect(noKey.calls).toBe(0);
    await t.close();

    const daily = fakeProvider();
    t = await billedApp(daily, { limits: { maxGenerationsPerDay: 1 } });
    projectId = await projectWithDraft(t);
    expect(
      (await t.send('POST', `/projects/${projectId}/editorial/generations`, { requestKey: KEYS[8], confirmCost: true }))
        .statusCode,
    ).toBe(201);
    const second = await t.send('POST', `/projects/${projectId}/editorial/generations`, {
      requestKey: KEYS[9],
      confirmCost: true,
    });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ code: 'GENERATION_LIMIT_REACHED' });
    expect(daily.calls).toBe(1);
    await t.close();

    const monthly = fakeProvider();
    t = await billedApp(monthly, { limits: { monthlySpendLimit: 0.001 } });
    projectId = await projectWithDraft(t);
    const over = await t.send('POST', `/projects/${projectId}/editorial/generations`, {
      requestKey: KEYS[10],
      confirmCost: true,
    });
    expect(over.statusCode).toBe(429);
    expect(monthly.calls).toBe(0);
  });
});
