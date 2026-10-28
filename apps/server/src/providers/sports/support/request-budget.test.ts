/**
 * Generic request budget (contracts/provider-ports.md section 1.4 "Request budget"; AD-26; R-249, R-291; T11H-F05,
 * T11H-F06), on a virtual clock: the sliding 60-second window, the server block, priority over discovery, the
 * discovery share, bounded waiters, deadlines and cancellation.
 */
import { describe, expect, it } from 'vitest';

import { parseServerCounters } from './counters.js';
import { BudgetRefused, RequestBudget, type BudgetClass, type BudgetPermit } from './request-budget.js';
import { WaitAborted, schedulerFor } from './scheduler.js';
import { VirtualClock } from './test/virtual-clock.js';

function setup(requestsPerMinute = 10, researchReservedSlots = 2, maxDiscoveryWaiters = 20) {
  const clock = new VirtualClock();
  const budget = new RequestBudget(
    { requestsPerMinute, researchReservedSlots, maxDiscoveryWaiters },
    schedulerFor(clock),
  );
  const sent: Array<{ cls: BudgetClass; at: number }> = [];
  /** Acquires, records the send time, holds the permit for `holdMs`, then releases it. */
  async function send(cls: BudgetClass, maxWaitMs: number, holdMs = 0, signal?: AbortSignal): Promise<number> {
    const permit: BudgetPermit = await budget.acquire(cls, maxWaitMs, signal);
    const at = clock.nowMs();
    sent.push({ cls, at });
    if (holdMs > 0) {
      await new Promise<void>((resolve) => clock.setTimer(holdMs, resolve));
    }
    permit.release(null);
    return at;
  }
  return { clock, budget, sent, send };
}

function maxPerWindow(times: readonly number[]): number {
  return Math.max(0, ...times.map((at) => times.filter((t) => t > at - 60_000 && t <= at).length));
}

describe('RequestBudget', () => {
  it('never admits more than requestsPerMinute requests in any 60-second window', async () => {
    const { clock, sent, send } = setup();
    const all = Array.from({ length: 35 }, () => send('priority', 600_000, 250));
    await clock.run(Promise.all(all));
    expect(sent).toHaveLength(35);
    expect(maxPerWindow(sent.map((entry) => entry.at))).toBe(10);
    // The eleventh request waits exactly until the first leaves the window.
    expect((sent[10]?.at ?? 0) - (sent[0]?.at ?? 0)).toBe(60_000);
  });

  it('serializes requests: one in flight at a time', async () => {
    const { clock, sent, send } = setup();
    await clock.run(Promise.all([send('priority', 10_000, 1000), send('priority', 10_000, 1000)]));
    expect((sent[1]?.at ?? 0) - (sent[0]?.at ?? 0)).toBe(1000);
  });

  it('limits discovery to requestsPerMinute - researchReservedSlots and keeps the reserved slots for research', async () => {
    const { clock, sent, send } = setup();
    const discovery = Array.from({ length: 12 }, () => send('discovery', 5000).catch((error: unknown) => error));
    const outcomes = await clock.run(Promise.all(discovery));
    expect(sent).toHaveLength(8);
    expect(outcomes.filter((outcome) => outcome instanceof BudgetRefused)).toHaveLength(4);
    const research = [await clock.run(send('priority', 0)), await clock.run(send('priority', 0))];
    expect(research).toEqual([sent[0]?.at, sent[0]?.at]);
    await expect(clock.run(send('priority', 0))).rejects.toBeInstanceOf(BudgetRefused);
  });

  it('admits waiting priority requests before waiting discovery requests', async () => {
    const { clock, sent, send } = setup();
    const first = send('discovery', 5000, 500);
    const waiting = [send('discovery', 5000), send('discovery', 5000), send('priority', 5000), send('priority', 5000)];
    await clock.run(Promise.all([first, ...waiting]));
    expect(sent.map((entry) => entry.cls)).toEqual(['discovery', 'priority', 'priority', 'discovery', 'discovery']);
  });

  it('refuses at once, with the wait, a request whose admission lies beyond its longest wait', async () => {
    const { clock, budget, send } = setup(2, 0);
    await clock.run(send('discovery', 0));
    await clock.run(send('discovery', 0));
    await clock.advance(10_000);
    const error = await clock.run(budget.acquire('discovery', 5000)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BudgetRefused);
    expect(error).toMatchObject({ reason: 'wait_exceeded', retryAfterSeconds: 50 });
  });

  it('refuses a waiting discovery request at its deadline', async () => {
    const { clock, send } = setup();
    const start = clock.nowMs();
    const holder = send('priority', 0, 10_000);
    let refusedAt = 0;
    const waiter = send('discovery', 5000).catch((error: unknown) => {
      refusedAt = clock.nowMs();
      return error;
    });
    const [, outcome] = await clock.run(Promise.all([holder, waiter]));
    expect(outcome).toBeInstanceOf(BudgetRefused);
    expect(refusedAt - start).toBe(5000);
  });

  it('bounds the discovery waiters and answers a further request at once', async () => {
    const { clock, budget, send } = setup(10, 2, 2);
    const holder = send('priority', 0, 1000);
    const waiters = [send('discovery', 5000), send('discovery', 5000)];
    const error = await budget.acquire('discovery', 5000).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ reason: 'waiters_full' });
    expect(budget.waiting()).toEqual({ priority: 0, discovery: 2 });
    await clock.run(Promise.all([holder, ...waiters]));
  });

  it('blocks until the counter reset after a response reporting zero remaining requests', async () => {
    const { clock, budget, sent, send } = setup();
    const permit = await budget.acquire('priority', 0);
    permit.release(parseServerCounters('0', '23'));
    const start = clock.nowMs();
    await clock.run(send('priority', 30_000));
    expect((sent[0]?.at ?? 0) - start).toBe(23_000);
    expect(budget.lastCounters()).toEqual({ requestsAvailable: 0, resetSeconds: 23 });
  });

  it('ignores invalid counters: the local window still applies', async () => {
    const { clock, budget, sent, send } = setup();
    for (const [available, reset] of [
      ['0', '-1'],
      ['0', '1.5'],
      ['0', '1e3'],
      ['0', ''],
      ['0', '3601'],
      ['0', '99999999'],
      ['0', '5, 5'],
    ] as const) {
      const permit = await budget.acquire('priority', 0);
      permit.release(parseServerCounters(available, reset));
    }
    const start = clock.nowMs();
    await clock.run(send('priority', 0));
    expect(sent[0]?.at).toBe(start);
  });

  it('blocks every class for a 429 reset (blockFor)', async () => {
    const { clock, budget, sent, send } = setup();
    budget.blockFor(42);
    const start = clock.nowMs();
    await expect(clock.run(budget.acquire('discovery', 5000))).rejects.toMatchObject({ retryAfterSeconds: 42 });
    await clock.run(send('priority', 65_000));
    expect((sent[0]?.at ?? 0) - start).toBe(42_000);
  });

  it('stops waiting when the caller aborts', async () => {
    const { clock, send } = setup();
    const holder = send('priority', 0, 10_000);
    const controller = new AbortController();
    const waiter = send('priority', 60_000, 0, controller.signal).catch((error: unknown) => error);
    await clock.advance(1000);
    controller.abort();
    const [, outcome] = await clock.run(Promise.all([holder, waiter]));
    expect(outcome).toBeInstanceOf(WaitAborted);
  });

  it('releases a permit once only', async () => {
    const { budget } = setup(1, 0);
    const permit = await budget.acquire('priority', 0);
    permit.release(null);
    permit.release(null);
    expect(budget.remaining()).toBe(0);
  });

  it('refuses options outside their ranges', () => {
    const clock = new VirtualClock();
    for (const options of [
      { requestsPerMinute: 0, researchReservedSlots: 0, maxDiscoveryWaiters: 1 },
      { requestsPerMinute: 61, researchReservedSlots: 0, maxDiscoveryWaiters: 1 },
      { requestsPerMinute: 10, researchReservedSlots: 10, maxDiscoveryWaiters: 1 },
      { requestsPerMinute: 10, researchReservedSlots: 2, maxDiscoveryWaiters: 0 },
      { requestsPerMinute: 10, researchReservedSlots: 2, maxDiscoveryWaiters: 101 },
    ]) {
      expect(() => new RequestBudget(options, schedulerFor(clock))).toThrow(RangeError);
    }
  });
});
