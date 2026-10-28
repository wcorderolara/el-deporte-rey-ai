/**
 * Capability probe (contracts/provider-ports.md section 1.4 "Capability probe" and "Probe console output and failure
 * paths"; R-259; T11H-F02, T11H-F04), run against the replay transport of `fixtures/football-data/` on a virtual
 * clock with the synthetic marker token: the findings hold no marker token, no client value, no raw body and no
 * person field and the run stays within 30 requests; on every failure path (a throwing and a rejecting transport,
 * 401, 403 with the marker-shaped client value, 429, 500, an internal error, uncaught exceptions and unhandled
 * rejections) stdout, stderr and the findings file hold neither the marker token nor the client value.
 */
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../vitest.setup.js';
import type { EgressClient } from '../src/platform/net/index.js';
import { VirtualClock } from '../src/providers/sports/support/test/virtual-clock.js';
import {
  type Reply,
  ReplayEgress,
  jsonReply,
  projectRootDir,
  recorded,
  replyOf,
} from '../src/providers/sports/adapters/football-data/test/replay.js';

import {
  PROBE_FAILURE_CODES,
  PROBE_MAX_REQUESTS,
  type ProbeState,
  installFailureHandlers,
  runProbe,
} from './football-data-probe.js';

const CLIENT_MARKER = 'edr-test-client-marker-0000';
const PERSON_MARKER = 'edr-person-marker-';
const FAILURE_LINE = new RegExp(`^probe failed: (${PROBE_FAILURE_CODES.join('|')}); requests: [0-9]+$`);
const PROGRESS_LINE = /^probe: [a-z ,;:0-9]+$/;

interface ProbeResult {
  readonly code: number;
  readonly stdout: string[];
  readonly stderr: string[];
  readonly findings: string | null;
  readonly state: ProbeState;
  /** Everything written to the real process streams and the console during the run. */
  readonly processOutput: string;
}

let workDir = '';
const spies: Array<{ mockRestore(): void }> = [];

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'edr-t49-probe-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  for (const spy of spies.splice(0)) {
    spy.mockRestore();
  }
});

/** Captures the process streams and the console while the probe runs. */
function captureProcessOutput(): () => string {
  const chunks: string[] = [];
  const record = (...args: unknown[]): void => {
    chunks.push(args.map((arg) => (typeof arg === 'string' ? arg : (JSON.stringify(arg) ?? String(arg)))).join(' '));
  };
  spies.push(
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      record(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      record(String(chunk));
      return true;
    }),
  );
  for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const) {
    spies.push(vi.spyOn(console, method).mockImplementation(record));
  }
  return () => chunks.join('\n');
}

async function probe(
  egress: EgressClient,
  clock: VirtualClock,
  options: {
    argv?: string[];
    env?: Record<string, string | undefined>;
    writeFile?: (p: string, c: string) => void;
  } = {},
): Promise<ProbeResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const state: ProbeState = { requests: 0, refused: 0 };
  const processOutput = captureProcessOutput();
  const code = await clock.run(
    runProbe({
      argv: options.argv ?? ['--out', 'findings.md'],
      env: options.env ?? { FOOTBALL_DATA_API_TOKEN: TEST_MARKER_TOKEN },
      rootDir: projectRootDir(),
      cwd: workDir,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
      egress,
      clock,
      state,
      ...(options.writeFile === undefined ? {} : { writeFile: options.writeFile }),
    }),
  );
  const path = join(workDir, 'findings.md');
  return {
    code,
    stdout,
    stderr,
    findings: existsSync(path) ? readFileSync(path, 'utf8') : null,
    state,
    processOutput: processOutput(),
  };
}

function expectNoMarkers(result: ProbeResult): void {
  const all = [result.stdout.join('\n'), result.stderr.join('\n'), result.findings ?? '', result.processOutput];
  for (const text of all) {
    expect(text.includes(TEST_MARKER_TOKEN)).toBe(false);
    expect(text.includes(CLIENT_MARKER)).toBe(false);
  }
}

/** The PLAYOFFS matches of the complete 2025 season, as a stage-filter reply. */
function playoffsReply(): Reply {
  const body = recorded('cl-matches-2025.json').body as { matches: Array<{ stage: string }> };
  return jsonReply(
    200,
    { ...body, matches: body.matches.filter((match) => match.stage === 'PLAYOFFS') },
    {
      'X-Authenticated-Client': CLIENT_MARKER,
      'X-RequestCounter-Reset': '60',
      'X-RequestsAvailable': '5',
    },
  );
}

function fullReplay(clock: VirtualClock, tl1Detail: Reply = replyOf('competition-tl1.json')): ReplayEgress {
  return new ReplayEgress(clock)
    .serve('competitions.json')
    .serve('competition-cl.json')
    .on('GET /v4/competitions/TL1', tl1Detail)
    .serve('cl-matches-2026.json')
    .serve('cl-matches-2026-md1.json')
    .serve('cl-standings-2026-md1.json')
    .serve('cl-matches-2025.json')
    .on('GET /v4/competitions/CL/matches?season=2025&stage=PLAYOFFS', playoffsReply())
    .serve('tl1-matches-2026.json')
    .serve('tl1-matches-2026-md1.json')
    .serve('tl1-standings-2026-md1.json');
}

describe('capability probe against the replay transport (R-259)', () => {
  it('records the findings within 30 requests with no marker, raw body or person field', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = fullReplay(clock);
    const result = await probe(egress, clock);

    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(egress.unmatched).toEqual([]);
    expect(result.state.requests).toBe(egress.calls.length);
    expect(result.state.requests).toBeLessThanOrEqual(PROBE_MAX_REQUESTS);
    expect(result.stdout.every((line) => PROGRESS_LINE.test(line))).toBe(true);
    expectNoMarkers(result);

    const findings = result.findings ?? '';
    // Person values and crests never appear; dropped key names (for example `matches[].referees`) do, by design.
    for (const forbidden of [PERSON_MARKER, 'crests.invalid', 'Synthetic error', 'X-Auth-Token', '{"', '"matches"']) {
      expect(findings.includes(forbidden)).toBe(false);
    }
    expect(findings).toContain('| CL | Copa Continental Sintética | Synthetic Continent | yes | yes | 2 |');
    expect(findings).toContain('| TL1 | Liga Sintética del Norte | Synthetic Republic | no | yes | 1 |');
    expect(findings).toContain('### CL (Copa Continental Sintética), reference');
    expect(findings).toContain('### TL1 (Liga Sintética del Norte), candidate');
    expect(findings).toContain('| LEAGUE_STAGE | 8 (1 to 8) | no | expected |');
    expect(findings).toContain('| LAST_16 | none | yes | unknown |');
    expect(findings).toContain('Filter stage LEAGUE_STAGE, matchday 1');
    expect(findings).toContain('matches 18; standings available (36 rows)');
    expect(findings).toContain('Filter stage PLAYOFFS as a whole');
    expect(findings).toContain('TOTAL tables seen: 2');
    expect(findings).toContain('Freshness: matches with kickoff more than 3 hours old: 18 (finished 18)');
    expect(findings).toContain('Dropped keys (names only):');
    expect(findings).toContain('`matches[].referees`');
    expect(findings).toContain('- X-API-Version values: v4');
    expect(findings).toContain('  - X-Authenticated-Client present on 2xx responses: yes');
    expect(findings).toContain('  - X-Authenticated-Client present on 403 responses: no 403 observed (UNVERIFIED)');
    expect(findings).toMatch(/\| GET \/competitions\/:code\/matches\?season \| 3 \| [0-9]+ \| no \|/);
  });

  it('records competitions the token cannot read (403 with the marker client value) as presence booleans only', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = fullReplay(clock, replyOf('error-403-authenticated.json'));
    const result = await probe(egress, clock);
    expect(result.code).toBe(0);
    expectNoMarkers(result);
    const findings = result.findings ?? '';
    expect(findings).toContain(
      '| TL1 | Liga Sintética del Norte | Synthetic Republic | no | no (not_available) | - | - |',
    );
    expect(findings).toContain('  - X-Authenticated-Client present on 403 responses: yes');
    expect(findings).toContain('  - Same value on every response that carried it: yes');
  });

  it('stops at 30 requests: further requests are refused before the transport', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const many = {
      competitions: Array.from({ length: 40 }, (_, index) => ({
        id: 9000 + index,
        code: `C${String(index).padStart(2, '0')}`,
        name: `Liga Sintética ${String(index)}`,
        area: { name: 'Synthetic Area' },
      })),
    };
    const egress = new ReplayEgress(clock)
      .on('GET /v4/competitions', jsonReply(200, many))
      .fallback(() => replyOf('error-500.json'));
    const result = await probe(egress, clock);
    expect(egress.calls.length).toBeLessThanOrEqual(PROBE_MAX_REQUESTS);
    expect(result.state.requests).toBeLessThanOrEqual(PROBE_MAX_REQUESTS);
    expectNoMarkers(result);
  });
});

describe('probe failure paths (T11H-F02)', () => {
  const failing: Array<[string, (clock: VirtualClock) => EgressClient, string]> = [
    [
      'a transport that throws',
      () => ({
        request(): never {
          throw new Error(`transport failure ${TEST_MARKER_TOKEN} ${CLIENT_MARKER}`);
        },
      }),
      'unavailable',
    ],
    [
      'a transport that rejects with the request options',
      () => ({
        request: (url, init) =>
          Promise.reject({ url, init, token: TEST_MARKER_TOKEN, client: CLIENT_MARKER } as unknown as Error),
      }),
      'unavailable',
    ],
    [
      'a 401',
      (clock) =>
        new ReplayEgress(clock).on('GET /v4/competitions', replyOf('error-403-anonymous.json', { status: 401 })),
      'access_refused',
    ],
    [
      'a 403 with the marker-shaped client value',
      (clock) => new ReplayEgress(clock).on('GET /v4/competitions', replyOf('error-403-authenticated.json')),
      'not_available',
    ],
    ['a 429', (clock) => new ReplayEgress(clock).on('GET /v4/competitions', replyOf('error-429.json')), 'rate_limited'],
    ['a 500', (clock) => new ReplayEgress(clock).on('GET /v4/competitions', replyOf('error-500.json')), 'unavailable'],
  ];

  it.each(failing)('%s prints only a closed failure code and counts', async (_label, transport, expected) => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const result = await probe(transport(clock), clock);
    expect(result.code).toBe(1);
    expect(result.stdout.every((line) => PROGRESS_LINE.test(line))).toBe(true);
    expect(result.stderr).toHaveLength(1);
    expect(result.stderr[0]).toMatch(FAILURE_LINE);
    expect(result.stderr[0]).toContain(`probe failed: ${expected};`);
    expectNoMarkers(result);
  });

  it('a failure after the competition list writes the findings with the failure, still without markers', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    let writes = 0;
    const result = await probe(fullReplay(clock), clock, {
      writeFile: () => {
        writes += 1;
        throw new Error(`disk failure ${TEST_MARKER_TOKEN}`);
      },
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual([`probe failed: internal; requests: ${String(result.state.requests)}`]);
    expect(writes).toBe(2);
    expectNoMarkers(result);
  });

  it('a configuration failure names only the closed code (missing --out, unknown argument, missing token)', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    for (const options of [
      { argv: [] },
      { argv: ['--out', 'findings.md', `--token=${TEST_MARKER_TOKEN}`] },
      { env: {} },
      { env: { FOOTBALL_DATA_API_TOKEN: `${TEST_MARKER_TOKEN}\n` } },
      { argv: ['--out', 'findings.md', '--config', 'config/app.config.json'] },
    ]) {
      const egress = new ReplayEgress(clock);
      const result = await probe(egress, clock, options);
      expect(result.code).toBe(1);
      expect(result.stderr).toEqual(['probe failed: config; requests: 0']);
      expect(egress.calls).toEqual([]);
      expect(result.findings).toBeNull();
      expectNoMarkers(result);
    }
  });

  it('deletes the token from the environment it read', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const env: Record<string, string | undefined> = { FOOTBALL_DATA_API_TOKEN: TEST_MARKER_TOKEN };
    await probe(fullReplay(clock), clock, { env });
    expect(Object.hasOwn(env, 'FOOTBALL_DATA_API_TOKEN')).toBe(false);
    expect(process.env['FOOTBALL_DATA_API_TOKEN']).toBeUndefined();
  });

  it('handles uncaught exceptions and unhandled rejections with the closed line only', () => {
    const events = new EventEmitter();
    const lines: string[] = [];
    const exits: number[] = [];
    const state: ProbeState = { requests: 3, refused: 0 };
    installFailureHandlers(
      events,
      state,
      (line) => lines.push(line),
      (code) => exits.push(code),
    );
    const error = new Error(`uncaught ${TEST_MARKER_TOKEN} ${CLIENT_MARKER}`);
    events.emit('uncaughtException', error);
    events.emit('unhandledRejection', { headers: { 'X-Auth-Token': TEST_MARKER_TOKEN } });
    expect(lines).toEqual(['probe failed: internal; requests: 3', 'probe failed: internal; requests: 3']);
    expect(exits).toEqual([1, 1]);
  });
});
