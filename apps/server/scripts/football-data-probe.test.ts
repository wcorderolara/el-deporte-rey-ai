/**
 * Capability probe (contracts/provider-ports.md section 1.4 "Capability probe" and "Probe console output and failure
 * paths"; R-259; T11H-F02, T11H-F04), run against the replay transport of `fixtures/football-data/` on a virtual
 * clock with the synthetic marker token: the findings hold no marker token, no client value, no raw body and no
 * person field and the run stays within 30 requests; on every failure path (a throwing and a rejecting transport,
 * 401, 403 with the marker-shaped client value, 429, 500, an internal error, uncaught exceptions and unhandled
 * rejections) stdout, stderr and the findings file hold neither the marker token nor the client value.
 *
 * Failure diagnostics and `--candidates` (FU-2, OD-60; T11H-F02, T11H-F04): recorded fixtures and replies with planted
 * values (team names with unusual characters, scores, the marker token, header values, URLs) end in diagnostics made of
 * closed values and field-name paths only; none of the planted values reaches the findings, stdout or stderr.
 */
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_MARKER_TOKEN } from '../../../vitest.setup.js';
import { EgressError, type EgressClient } from '../src/platform/net/index.js';
import { VirtualClock } from '../src/providers/sports/support/test/virtual-clock.js';
import {
  type Reply,
  ReplayEgress,
  jsonReply,
  projectRootDir,
  recorded,
  replyOf,
  throwReply,
} from '../src/providers/sports/adapters/football-data/test/replay.js';

import {
  PROBE_FAILURE_CODES,
  PROBE_MAX_CANDIDATE_CODES,
  PROBE_MAX_REQUESTS,
  type ProbeState,
  diagnosticText,
  installFailureHandlers,
  parseCandidateCodes,
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

// ---------------------------------------------------------------------------------------------------------------
// Failure diagnostics and --candidates (FU-2)
// ---------------------------------------------------------------------------------------------------------------

/** Values planted in the fixtures and replies below; none may appear in the findings, stdout or stderr. */
const PLANTED_TEXT = [
  'edr-planted',
  'planted.invalid',
  TEST_MARKER_TOKEN,
  CLIENT_MARKER,
  'Ñandú',
  '’',
  '“',
  'X-Planted-Header',
  'Location',
] as const;
const PLANTED_NUMBERS = [/\b917\b/, /\b853\b/] as const;

/** Header values planted on the replies of the planted fixtures (fixture files hold only documented headers). */
const PLANTED_HEADERS = {
  'X-Planted-Header': 'edr-planted-header-value-0000',
  Location: `https://planted.invalid/redirect?token=${TEST_MARKER_TOKEN}`,
  'X-Auth-Token': TEST_MARKER_TOKEN,
  'X-Authenticated-Client': CLIENT_MARKER,
} as const;

function planted(file: string): Reply {
  return replyOf(file, { headers: PLANTED_HEADERS });
}
const MD1 = 'GET /v4/competitions/CL/matches?matchday=1&season=2026';
const STANDINGS_MD1 = 'GET /v4/competitions/CL/standings?matchday=1&season=2026';
const CL_2025 = 'GET /v4/competitions/CL/matches?season=2025';
const TL1_2026 = 'GET /v4/competitions/TL1/matches?season=2026';
const TL1_MD1 = 'GET /v4/competitions/TL1/matches?matchday=1&season=2026';

function expectNothingPlanted(result: ProbeResult): void {
  expectNoMarkers(result);
  const all = [result.stdout.join('\n'), result.stderr.join('\n'), result.findings ?? '', result.processOutput];
  for (const text of all) {
    for (const value of PLANTED_TEXT) {
      expect(text.includes(value), value).toBe(false);
    }
    for (const pattern of PLANTED_NUMBERS) {
      expect(pattern.test(text), String(pattern)).toBe(false);
    }
  }
}

/** A stage-discovery reply above the 1 MiB stage-discovery cap of config/live.config.json, made of planted values. */
function oversizeReply(): Reply {
  const padding = `${TEST_MARKER_TOKEN} https://planted.invalid/x ${CLIENT_MARKER} Ñandú 917 `.repeat(16_000);
  return jsonReply(
    200,
    { filters: { season: '2026' }, padding, matches: [] },
    { 'X-Planted-Header': 'edr-planted-header-value-0000', 'X-Authenticated-Client': CLIENT_MARKER },
  );
}

function redirectReply(): Reply {
  return throwReply(
    new EgressError('redirect', `redirect to https://planted.invalid/x?token=${TEST_MARKER_TOKEN} ${CLIENT_MARKER}`),
  );
}

/** Lines of the findings that hold a diagnostic, or the failure counts per resource kind. */
function diagnosticLines(findings: string): string[] {
  return findings.split('\n').filter((line) => /invalid;|Failures by resource kind|^\| (domain|allow|body)/.test(line));
}

describe('probe failure diagnostics (FU-2; T11H-F02)', () => {
  it('names the egress refusal kind and the failing domain path, with no planted value', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = new ReplayEgress(clock)
      .serve('competitions.json')
      .serve('competition-cl.json')
      .serve('competition-tl1.json')
      .serve('cl-matches-2026.json')
      .on(MD1, planted('planted-cl-matches-2026-md1.json'))
      .serve('cl-standings-2026-md1.json')
      .on(CL_2025, redirectReply())
      .on(TL1_2026, oversizeReply());
    const result = await probe(egress, clock);

    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(egress.unmatched).toEqual([]);
    expect(result.stdout.every((line) => PROGRESS_LINE.test(line))).toBe(true);
    expectNothingPlanted(result);
    expect(diagnosticLines(result.findings ?? '')).toEqual([
      '- Stage discovery (previous season): failed (invalid; egress refusal redirect on stageDiscovery)',
      '- Filter stage LEAGUE_STAGE, matchday 1: failed (invalid; domain validation on selection, path /teams/2/name)',
      '- Stage discovery (current season): failed (invalid; egress refusal too_large on stageDiscovery)',
      '- Failures by resource kind: invalid (egress refusal redirect) on stageDiscovery x1, ' +
        'invalid (egress refusal too_large) on stageDiscovery x1',
      '| domain validation on selection, path /teams/2/name | 1 |',
    ]);
    // The TL1 stage-discovery request used the 1 MiB stage-discovery cap of config/live.config.json (FU-4).
    expect(egress.callsTo(TL1_2026)[0]?.maxResponseBytes).toBe(1_048_576);
    expect(egress.callsTo(MD1)[0]?.maxResponseBytes).toBe(524_288);
  });

  it('names the failing standings rule path and the allow-list path of a planted score', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = new ReplayEgress(clock)
      .serve('competitions.json')
      .serve('competition-cl.json')
      .serve('competition-tl1.json')
      .serve('cl-matches-2026.json')
      .serve('cl-matches-2026-md1.json')
      .on(STANDINGS_MD1, planted('planted-cl-standings-2026-md1.json'))
      .serve('cl-matches-2025.json')
      .on('GET /v4/competitions/CL/matches?season=2025&stage=PLAYOFFS', playoffsReply())
      .serve('tl1-matches-2026.json')
      .on(TL1_MD1, planted('planted-tl1-matches-2026-md1.json'));
    const result = await probe(egress, clock);

    expect(result.code).toBe(0);
    expect(egress.unmatched).toEqual([]);
    expectNothingPlanted(result);
    expect(diagnosticLines(result.findings ?? '')).toEqual([
      '- Filter stage LEAGUE_STAGE, matchday 1: failed (invalid; domain validation on selection, path ' +
        '/standings/rows/3/played)',
      '- Filter stage REGULAR_SEASON, matchday 1: failed (invalid; allow-list schema on matches, path ' +
        '/matches/0/score/fullTime/home)',
      '- Failures by resource kind: none',
      '| allow-list schema on matches, path /matches/0/score/fullTime/home | 1 |',
      '| domain validation on selection, path /standings/rows/3/played | 1 |',
    ]);
    expect(result.findings).toContain('- Filter stage PLAYOFFS as a whole');
  });

  it('names a body that is not JSON and counts non-2xx statuses per resource kind', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = new ReplayEgress(clock)
      .serve('competitions.json')
      .serve('competition-cl.json')
      .on('GET /v4/competitions/TL1', {
        kind: 'response',
        status: 200,
        headers: { 'X-Planted-Header': 'edr-planted-header-value-0000', Location: 'https://planted.invalid/' },
        text: `<html>${TEST_MARKER_TOKEN} https://planted.invalid/x Ñandú 917</html>`,
      })
      .serve('cl-matches-2026.json')
      .serve('cl-matches-2026-md1.json')
      .on(STANDINGS_MD1, replyOf('error-404.json'))
      .serve('cl-matches-2025.json')
      .on('GET /v4/competitions/CL/matches?season=2025&stage=PLAYOFFS', playoffsReply());
    const result = await probe(egress, clock);

    expect(result.code).toBe(0);
    expect(egress.unmatched).toEqual([]);
    expectNothingPlanted(result);
    const findings = result.findings ?? '';
    expect(findings).toContain(
      '| TL1 | Liga Sintética del Norte | Synthetic Republic | no | no (invalid; body not JSON on competition) | - | - |',
    );
    expect(findings).toContain('- Failures by resource kind: 404 on standings x1');
    expect(findings).toContain('| body not JSON on competition | 1 |');
    expect(findings).toContain('matches 18; standings not available (not_provided_by_source)');
  });

  it('renders only closed diagnostic texts, whatever a diagnostic object holds', () => {
    expect(diagnosticText(null)).toBe('no diagnostic recorded');
    expect(
      diagnosticText({
        resource: 'selection',
        stage: 'domain',
        refusal: null,
        path: `/teams/${TEST_MARKER_TOKEN}/name`,
      }),
    ).toBe('domain validation on selection, path /teams/*/name');
    expect(diagnosticText({ resource: 'matches', stage: 'allow_list', refusal: null, path: null })).toBe(
      'allow-list schema on matches, path not recorded',
    );
    const forged = {
      resource: `https://planted.invalid/${TEST_MARKER_TOKEN}`,
      stage: 'egress',
      refusal: CLIENT_MARKER,
      path: null,
    } as unknown as Parameters<typeof diagnosticText>[0];
    expect(diagnosticText(forged)).toBe('no diagnostic recorded');
    const forgedRefusal = {
      resource: 'stageDiscovery',
      stage: 'egress',
      refusal: CLIENT_MARKER,
      path: null,
    } as unknown as Parameters<typeof diagnosticText>[0];
    expect(diagnosticText(forgedRefusal)).toBe('egress refusal other on stageDiscovery');
    const forgedStage = {
      resource: 'matches',
      stage: TEST_MARKER_TOKEN,
      refusal: null,
      path: null,
    } as unknown as Parameters<typeof diagnosticText>[0];
    expect(diagnosticText(forgedStage)).toBe('no diagnostic recorded');
  });
});

describe('probe --candidates (FU-2)', () => {
  it('probes the named codes; a code the list does not hold is reported as not listed, without a request', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = fullReplay(clock);
    const result = await probe(egress, clock, { argv: ['--out', 'findings.md', '--candidates', 'TL1,ZZ9,TL1,CL'] });
    expect(result.code).toBe(0);
    expect(egress.unmatched).toEqual([]);
    expect(egress.calls.some((call) => call.key.includes('ZZ9'))).toBe(false);
    expectNoMarkers(result);
    const findings = result.findings ?? '';
    expect(findings).toContain('- Named candidate codes (--candidates): TL1, ZZ9, CL');
    expect(findings).toContain('### ZZ9, candidate\n\n- not listed by GET /competitions; no request made (UNVERIFIED)');
    expect(findings).toContain('### CL (Copa Continental Sintética), reference');
    expect(findings).toContain('### TL1 (Liga Sintética del Norte), candidate');
    expect(findings.match(/^### .*(reference|candidate)$/gm)).toHaveLength(3);
  });

  it('the T61 command shape: unknown codes cost nothing, the reference is probed once', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = fullReplay(clock);
    const result = await probe(egress, clock, {
      argv: ['--candidates', 'CL,ELC,PD,BL1,SA,FL1', '--out', 'findings.md'],
    });
    expect(result.code).toBe(0);
    expect(egress.callsTo('GET /v4/competitions/TL1')).toEqual([]);
    expect(egress.calls.map((call) => call.key.split('?')[0])).not.toContain('GET /v4/competitions/ELC');
    const findings = result.findings ?? '';
    for (const code of ['ELC', 'PD', 'BL1', 'SA', 'FL1']) {
      expect(findings).toContain(`### ${code}, candidate\n\n- not listed by GET /competitions; no request made`);
    }
    expect(findings).toContain(
      '| TL1 | Liga Sintética del Norte | Synthetic Republic | no | not checked (UNVERIFIED) | - | - |',
    );
    expect(findings).toContain('### CL (Copa Continental Sintética), reference');
    expect(result.state.requests).toBe(egress.calls.length);
  });

  it('requests details only for the reference codes and the named codes, in the named order', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = new ReplayEgress(clock)
      .on('GET /v4/competitions', jsonReply(200, manyCompetitions()))
      .fallback(() => replyOf('error-404.json'));
    const result = await probe(egress, clock, { argv: ['--out', 'findings.md', '--candidates', 'C30,C05,C99'] });
    expect(result.code).toBe(0);
    expect(egress.calls.map((call) => call.key)).toEqual([
      'GET /v4/competitions',
      'GET /v4/competitions/C30',
      'GET /v4/competitions/C05',
    ]);
    const findings = result.findings ?? '';
    expect(findings).toContain('| C30 | Liga Sintética 30 | Synthetic Area | no | no (not_available) | - | - |');
    expect(findings).toContain('| C01 | Liga Sintética 1 | Synthetic Area | no | not checked (UNVERIFIED) | - | - |');
    expect(findings).toContain('- Failures by resource kind: 404 on competition x2');
    expect(findings).toContain('### C99, candidate');
  });

  it('keeps the 30-request cap with the most named codes', async () => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = new ReplayEgress(clock)
      .on('GET /v4/competitions', jsonReply(200, manyCompetitions()))
      .fallback(() => replyOf('error-500.json'));
    const codes = Array.from({ length: PROBE_MAX_CANDIDATE_CODES }, (_, index) => `C${String(index).padStart(2, '0')}`);
    const result = await probe(egress, clock, { argv: ['--out', 'findings.md', '--candidates', codes.join(',')] });
    expect(egress.calls.length).toBeLessThanOrEqual(PROBE_MAX_REQUESTS);
    expect(result.state.requests).toBe(egress.calls.length);
    expect(result.state.requests).toBe(PROBE_MAX_REQUESTS);
    expect(result.findings).toContain(
      `Requests sent: 30 of at most 30; refused by the request cap: ${String(result.state.refused)}`,
    );
    expectNoMarkers(result);
  });

  it('accepts only codes of the competition-code shape, deduplicated, at most 12', () => {
    expect(parseCandidateCodes('CL,ELC,PD,BL1,SA,FL1')).toEqual(['CL', 'ELC', 'PD', 'BL1', 'SA', 'FL1']);
    expect(parseCandidateCodes('CL,TL1,CL,TL1')).toEqual(['CL', 'TL1']);
    const twelve = Array.from({ length: 12 }, (_, index) => `C${String(index)}`);
    expect(parseCandidateCodes([...twelve, ...twelve].join(','))).toEqual(twelve);
  });

  it.each([
    ['an empty code', ['--candidates', 'CL,,TL1']],
    ['a separator other than a comma', ['--candidates', 'CL;TL1']],
    ['a space', ['--candidates', 'CL, TL1']],
    ['a trailing comma', ['--candidates', 'CL,']],
    ['13 distinct codes', ['--candidates', Array.from({ length: 13 }, (_, index) => `C${String(index)}`).join(',')]],
    ['a token-shaped value', ['--candidates', TEST_MARKER_TOKEN]],
    ['a URL', ['--candidates', 'https://planted.invalid/x']],
    ['a code too long', ['--candidates', 'ABCDEFGHIJKLMNOPQ']],
    ['a repeated option', ['--candidates', 'CL', '--candidates', 'TL1']],
    ['a missing value', ['--candidates']],
    ['an option as the value', ['--candidates', '--config', 'config/live.config.json']],
    ['an option with an equals sign', [`--candidates=${TEST_MARKER_TOKEN}`]],
  ])('refuses %s with the closed config failure only, before any request', async (_label, extra) => {
    const clock = new VirtualClock('2026-10-27T12:00:00.000Z');
    const egress = new ReplayEgress(clock);
    const result = await probe(egress, clock, { argv: ['--out', 'findings.md', ...extra] });
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual(['probe failed: config; requests: 0']);
    expect(result.stdout).toEqual([]);
    expect(egress.calls).toEqual([]);
    expect(result.findings).toBeNull();
    expectNothingPlanted(result);
  });
});

/** A competition list of 40 synthetic leagues `C00` to `C39`. */
function manyCompetitions(): { competitions: unknown[] } {
  return {
    competitions: Array.from({ length: 40 }, (_, index) => ({
      id: 9000 + index,
      code: `C${String(index).padStart(2, '0')}`,
      name: `Liga Sintética ${String(index)}`,
      area: { name: 'Synthetic Area' },
    })),
  };
}
