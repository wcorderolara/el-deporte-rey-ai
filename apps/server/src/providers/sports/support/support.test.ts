/**
 * Generic support pieces (contracts/provider-ports.md section 1.4): strict counter parsing (T11H-F05), the projection
 * cache (AD-27, R-252), TTL rules, the retry policy (R-250, R-251), single-flight (T11H-F06) and the scheduler seams.
 * Nothing here names a provider.
 */
import { describe, expect, it } from 'vitest';

import { parseCounter, parseServerCounters } from './counters.js';
import { ProjectionCache, cacheKey } from './projection-cache.js';
import { backoffDelayMs, mayRetry } from './retry.js';
import { WaitAborted, schedulerFor, sleep } from './scheduler.js';
import { SingleFlight } from './single-flight.js';
import { fixedRandom, VirtualClock } from './test/virtual-clock.js';
import { DEFAULT_CACHE_TTL_SECONDS, isLiveSelection, selectionTtlMs, stagesTtlMs } from './ttl.js';

describe('parseCounter (T11H-F05)', () => {
  it('accepts 1 to 6 digits within the bound', () => {
    expect(parseCounter('0', 3600)).toBe(0);
    expect(parseCounter('42', 3600)).toBe(42);
    expect(parseCounter('3600', 3600)).toBe(3600);
    expect(parseCounter('000060', 3600)).toBe(60);
  });

  it.each([['-1'], ['1.5'], ['1e3'], ['+5'], [''], [' 5'], ['5 '], ['5, 5'], ['0x10'], ['1234567'], ['3601'], ['NaN']])(
    'ignores %j',
    (value) => {
      expect(parseCounter(value, 3600)).toBeNull();
    },
  );

  it('ignores missing values and applies both bounds', () => {
    expect(parseCounter(null, 10)).toBeNull();
    expect(parseCounter(undefined, 10)).toBeNull();
    expect(parseServerCounters('10001', '3601')).toEqual({ requestsAvailable: null, resetSeconds: null });
    expect(parseServerCounters('10000', '3600')).toEqual({ requestsAvailable: 10_000, resetSeconds: 3600 });
  });
});

describe('ProjectionCache (AD-27)', () => {
  it('returns a fresh entry with its retrieval time and flags it expired after its TTL', async () => {
    const clock = new VirtualClock();
    const cache = new ProjectionCache<{ value: number }>(schedulerFor(clock));
    cache.set('k', { value: 1 }, '2026-10-27T12:00:00.000Z', 1000);
    expect(cache.get('k')).toEqual({ value: { value: 1 }, retrievedAt: '2026-10-27T12:00:00.000Z', expired: false });
    await clock.advance(1000);
    expect(cache.get('k')?.expired).toBe(true);
  });

  it('stores frozen copies', () => {
    const clock = new VirtualClock();
    const cache = new ProjectionCache<{ items: number[] }>(schedulerFor(clock));
    const value = { items: [1] };
    cache.set('k', value, 'now', 1000);
    value.items.push(2);
    const stored = cache.get('k')?.value;
    expect(stored).toEqual({ items: [1] });
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored?.items)).toBe(true);
  });

  it('evicts the least recently used entry beyond its size', () => {
    const clock = new VirtualClock();
    const cache = new ProjectionCache<number>(schedulerFor(clock), 2);
    cache.set('a', 1, 'now', 1000);
    cache.set('b', 2, 'now', 1000);
    cache.get('a');
    cache.set('c', 3, 'now', 1000);
    expect(cache.entries().map((entry) => entry.key)).toEqual(['a', 'c']);
  });

  it('holds at most 500 entries by default', () => {
    const clock = new VirtualClock();
    const cache = new ProjectionCache<number>(schedulerFor(clock));
    for (let index = 0; index < 600; index += 1) {
      cache.set(String(index), index, 'now', 1000);
    }
    expect(cache.size).toBe(500);
    expect(() => new ProjectionCache<number>(schedulerFor(clock), 501)).toThrow(RangeError);
  });

  it('builds keys from the source, the resource kind and sorted parameters (map keys only)', () => {
    expect(cacheKey('s', 'stages', { y: 2026, c: 'X' })).toBe(cacheKey('s', 'stages', { c: 'X', y: 2026 }));
    expect(cacheKey('s', 'stages', { c: '__proto__' })).not.toBe(cacheKey('s', 'stages', { c: 'constructor' }));
  });
});

describe('TTL rules', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const match = (status: string, kickoff: string) => ({
    matchKey: 'm',
    homeTeamKey: 'a',
    awayTeamKey: 'b',
    kickoff,
    status: status as 'scheduled',
    score: null,
    ref: 'source:s/matches@x',
  });

  it('keeps a selection 60 s while a match is in play or scheduled within 3 hours', () => {
    expect(isLiveSelection([match('in_play', '2026-10-27T11:00:00Z')], now)).toBe(true);
    expect(isLiveSelection([match('scheduled', '2026-10-27T14:59:00Z')], now)).toBe(true);
    expect(isLiveSelection([match('scheduled', '2026-10-27T15:01:00Z')], now)).toBe(false);
    expect(isLiveSelection([match('postponed', '2026-10-27T12:30:00Z')], now)).toBe(false);
    const live = { matches: [match('in_play', '2026-10-27T11:00:00Z')] };
    expect(selectionTtlMs(DEFAULT_CACHE_TTL_SECONDS, live, true, now)).toBe(60_000);
  });

  it('uses 15 minutes for other current-season selections and 24 hours for past seasons', () => {
    const done = { matches: [match('finished', '2026-10-20T11:00:00Z')] };
    expect(selectionTtlMs(DEFAULT_CACHE_TTL_SECONDS, done, true, now)).toBe(900_000);
    expect(selectionTtlMs(DEFAULT_CACHE_TTL_SECONDS, done, false, now)).toBe(86_400_000);
    expect(stagesTtlMs(DEFAULT_CACHE_TTL_SECONDS, true)).toBe(3_600_000);
    expect(stagesTtlMs(DEFAULT_CACHE_TTL_SECONDS, false)).toBe(86_400_000);
  });
});

describe('retry policy', () => {
  it('doubles the backoff per retry with a jitter of plus or minus 20 % from the random source', () => {
    expect(backoffDelayMs(0, 1000, fixedRandom([0.5]))).toBe(1000);
    expect(backoffDelayMs(1, 1000, fixedRandom([0.5]))).toBe(2000);
    expect(backoffDelayMs(0, 1000, fixedRandom([0]))).toBe(800);
    expect(backoffDelayMs(0, 1000, fixedRandom([1]))).toBe(1200);
    expect(backoffDelayMs(2, 1000, fixedRandom([Number.NaN]))).toBe(4000);
  });

  it('allows at most maxRetries retries within 30 seconds in total', () => {
    expect(mayRetry(0, 2, 0, 1000)).toBe(true);
    expect(mayRetry(2, 2, 0, 1000)).toBe(false);
    expect(mayRetry(0, 3, 29_500, 1000)).toBe(false);
    expect(mayRetry(0, 3, 29_000, 1000)).toBe(true);
  });
});

describe('SingleFlight (T11H-F06)', () => {
  it('shares one running task per key and starts a new one after it settles', async () => {
    const flights = new SingleFlight<number>();
    let runs = 0;
    const task = async (): Promise<number> => {
      runs += 1;
      await Promise.resolve();
      return runs;
    };
    const signal = new AbortController().signal;
    const results = await Promise.all([flights.run('k', signal, task), flights.run('k', signal, task)]);
    expect(results).toEqual([1, 1]);
    expect(flights.size).toBe(0);
    expect(await flights.run('k', signal, task)).toBe(2);
  });

  it('aborts the shared task only when every participant aborted', async () => {
    const flights = new SingleFlight<string>();
    let taskSignal: AbortSignal | null = null;
    const task = (signal: AbortSignal): Promise<string> => {
      taskSignal = signal;
      return new Promise((resolve) => setTimeout(() => resolve('done'), 5));
    };
    const a = new AbortController();
    const b = new AbortController();
    const first = flights.run('k', a.signal, task).catch((error: unknown) => error);
    const second = flights.run('k', b.signal, task);
    await Promise.resolve();
    a.abort();
    expect(await first).toBeInstanceOf(WaitAborted);
    expect((taskSignal as AbortSignal | null)?.aborted).toBe(false);
    expect(await second).toBe('done');
  });
});

describe('scheduler seams', () => {
  it('sleeps on the virtual clock and stops on abort', async () => {
    const clock = new VirtualClock();
    const scheduler = schedulerFor(clock);
    const start = clock.nowMs();
    await clock.run(sleep(scheduler, 1500));
    expect(clock.nowMs() - start).toBe(1500);
    const controller = new AbortController();
    const pending = sleep(scheduler, 1000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(WaitAborted);
    expect(clock.pendingTimers).toBe(0);
  });

  it('uses real timers on the clock time when the clock has none', async () => {
    const scheduler = schedulerFor({ now: () => new Date(0) });
    expect(scheduler.nowMs()).toBe(0);
    await sleep(scheduler, 1);
  });
});
