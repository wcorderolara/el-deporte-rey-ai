/**
 * Capability probe of football-data.org (contracts/provider-ports.md section 1.4 "Capability probe" and "Probe
 * console output and failure paths"; provider-research-plan.md section 7; AD-32; R-259; T11H-F02, T11H-F04).
 * Written by T49, run only by the Orchestrator in T53 under the PD-16 conditions; never part of a gate.
 *
 *   npm run probe:football-data -- --out <findings.md> [--config config/live.config.json] [--candidates <codes>]
 *
 * - Reuses FootballDataProvider with its request budget, cache, allow-list schemas and redaction, through the source
 *   registry (shared domain validation). The token is read from the environment only (`FOOTBALL_DATA_API_TOKEN`),
 *   copied into a frozen injected environment, and deleted from `process.env` at once (T19 rules, T11H-F03).
 * - At most 30 requests (a counting transport refuses more), paced by the budget; at most 12 competition details.
 * - `--candidates <codes>` (FU-2, OD-60): a comma-separated list of 1 to 12 competition codes, each of the configured
 *   code shape (`COMPETITION_CODE_PATTERN`), deduplicated in order. Details are then requested only for the configured
 *   reference competitions and the named codes the competition list holds, and coverage is probed for the first 5
 *   named non-reference competitions that are readable. A named code the list does not hold is reported as not listed
 *   and costs no request. The request cap and the budget do not change.
 * - Writes a Markdown findings file holding, with retrieval times and resources: the competitions listed and which
 *   the token can read, seasons, matchday and stage filter results, standings and TOTAL tables, stage values and
 *   matchday numbering, field presence (counts) and the names of dropped keys, the rate-limit counters, the largest
 *   response size per resource kind, the 403 evidence as presence booleans, and freshness observations. Anything not
 *   observed is UNVERIFIED. It never holds the token, a header value other than the two counters and the API version,
 *   the `X-Authenticated-Client` value, a raw body or person data.
 * - Failure diagnostics (FU-2, OD-60; T11H-F02): every `invalid` outcome names what rejected it: the egress refusal
 *   kind from a closed list (`too_large`, `redirect`, `other`) or the rejecting stage (body not JSON, allow-list schema,
 *   shared domain validation) with the failing validation path reduced to schema field names and numeric indices
 *   (any other segment `*`), and the resource kind (closed list). Every non-2xx status and transport failure is also
 *   counted per resource kind. No value of a body, a header, a URL or the token can reach a diagnostic.
 * - Console output: progress lines with counts and resource kinds only. Every error, rejection, uncaught exception and
 *   unhandled rejection ends in one line `probe failed: <code>; requests: <n>` with a closed code (`config`,
 *   `access_refused`, `not_available`, `rate_limited`, `unavailable`, `timeout`, `invalid`, `internal`), never an
 *   error object, a stack, inspected options or headers, and a non-zero exit code.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';

import { CatalogueConfig, ConfigError, type EnvironmentSource, loadConfig } from '../src/platform/config/index.js';
import { type EgressClient, EgressError, buildEgressAllowList, createEgressClient } from '../src/platform/net/index.js';
import {
  COMPETITION_CODE_PATTERN,
  DIAGNOSTIC_RESOURCES,
  type DiagnosticResource,
  EGRESS_REFUSAL_KINDS,
  type EgressRefusalKind,
  type FieldPresence,
  PINNED_ORIGIN,
  REJECTION_STAGES,
  type RejectionStage,
  type RequestKind,
  type RequestObservation,
  TOKEN_VARIABLE,
  competitionCodeOfRef,
  diagnosticPath,
  footballDataRegistration,
  parseFootballDataOptions,
} from '../src/providers/sports/adapters/football-data/index.js';
import {
  type Clock,
  type IngestionContext,
  type IngestionSource,
  type SelectionSnapshot,
  type SourceCompetition,
  type SourceRef,
  type SourceSeason,
  type SourceStage,
  SourceError,
  createSourceRegistry,
  silentSportsLogger,
} from '../src/providers/sports/ingestion/index.js';

/** Most requests of one run (R-259). */
export const PROBE_MAX_REQUESTS = 30;
/** Most competition detail requests (one per candidate). */
export const PROBE_MAX_DETAILS = 12;
/** Candidate leagues probed beside the reference competition. */
export const PROBE_MAX_CANDIDATES = 5;
/** Most codes of `--candidates` (after deduplication): one detail request each at most. */
export const PROBE_MAX_CANDIDATE_CODES = PROBE_MAX_DETAILS;
/** Longest `--candidates` value accepted (12 codes of at most 16 characters and their commas). */
const MAX_CANDIDATES_ARGUMENT_LENGTH = PROBE_MAX_CANDIDATE_CODES * 17;
/** Default configuration of the run. */
export const PROBE_DEFAULT_CONFIG = 'config/live.config.json';

/** Closed failure codes of the console output (T11H-F02). */
export const PROBE_FAILURE_CODES = [
  'config',
  'access_refused',
  'not_available',
  'rate_limited',
  'unavailable',
  'timeout',
  'invalid',
  'internal',
] as const;
export type ProbeFailureCode = (typeof PROBE_FAILURE_CODES)[number];

const FRESHNESS_AGE_MS = 3 * 60 * 60 * 1000;
const SIZE_CAP_BYTES = 512 * 1024;

/** Request counter shared with the top-level handlers. */
export interface ProbeState {
  requests: number;
  refused: number;
}

export interface ProbeIo {
  readonly argv: readonly string[];
  /** The process environment; the token is copied from it and deleted from it. */
  readonly env: Record<string, string | undefined>;
  readonly rootDir: string;
  readonly cwd: string;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
  readonly writeFile?: (path: string, content: string) => void;
  /** Test seams: a replay transport and a virtual clock. */
  readonly egress?: EgressClient;
  readonly clock?: Clock;
  readonly state?: ProbeState;
}

class ProbeFailure extends Error {
  readonly code: ProbeFailureCode;

  constructor(code: ProbeFailureCode) {
    super('probe failure');
    this.code = code;
  }
}

/** The closed failure code of anything thrown; never the error's message. */
export function failureCodeOf(error: unknown): ProbeFailureCode {
  if (error instanceof ProbeFailure) {
    return error.code;
  }
  if (error instanceof ConfigError) {
    return 'config';
  }
  if (error instanceof SourceError) {
    switch (error.code) {
      case 'access_refused':
      case 'not_available':
      case 'rate_limited':
      case 'unavailable':
      case 'timeout':
      case 'invalid':
        return error.code;
      case 'bad_request':
      case 'no_data':
        return 'invalid';
    }
  }
  return 'internal';
}

/** The one failure line (T11H-F02). */
export function failureLine(code: ProbeFailureCode, state: ProbeState): string {
  return `probe failed: ${code}; requests: ${String(state.requests)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Arguments and environment
// ---------------------------------------------------------------------------------------------------------------

interface ProbeArgs {
  readonly out: string;
  readonly config: string;
  /** Named candidate competition codes (deduplicated, in order), or null when `--candidates` is not given. */
  readonly candidates: readonly string[] | null;
}

/**
 * The codes of `--candidates`: comma-separated, each of the configured competition-code shape, at most
 * `PROBE_MAX_CANDIDATE_CODES` after deduplication; anything else is a `config` failure (the value is never printed).
 */
export function parseCandidateCodes(value: string): string[] {
  if (value.length === 0 || value.length > MAX_CANDIDATES_ARGUMENT_LENGTH) {
    throw new ProbeFailure('config');
  }
  const codes = value.split(',');
  if (!codes.every((code) => COMPETITION_CODE_PATTERN.test(code))) {
    throw new ProbeFailure('config');
  }
  const unique = [...new Set(codes)];
  if (unique.length > PROBE_MAX_CANDIDATE_CODES) {
    throw new ProbeFailure('config');
  }
  return unique;
}

function parseArgs(argv: readonly string[]): ProbeArgs {
  let out: string | null = null;
  let config = PROBE_DEFAULT_CONFIG;
  let candidates: string[] | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      (name === '--out' || name === '--config' || name === '--candidates') &&
      typeof value === 'string' &&
      value !== '' &&
      !value.startsWith('--')
    ) {
      if (name === '--out') {
        out = value;
      } else if (name === '--config') {
        config = value;
      } else if (candidates === null) {
        candidates = parseCandidateCodes(value);
      } else {
        throw new ProbeFailure('config');
      }
      index += 1;
    } else {
      throw new ProbeFailure('config');
    }
  }
  if (out === null) {
    throw new ProbeFailure('config');
  }
  return { out, config, candidates };
}

/**
 * The injected environment of the run (same rules as the composition root, T19): a frozen null-prototype object whose
 * only member, the token, is not enumerable; the variable is then deleted from the process environment.
 */
export function probeEnvironment(source: Record<string, string | undefined>): EnvironmentSource {
  const env = Object.create(null) as Record<string, string>;
  const value = source[TOKEN_VARIABLE];
  if (typeof value === 'string') {
    Object.defineProperty(env, TOKEN_VARIABLE, { value, enumerable: false, writable: false, configurable: false });
  }
  Object.freeze(env);
  delete source[TOKEN_VARIABLE];
  delete process.env[TOKEN_VARIABLE];
  return env;
}

/** Counts every request and refuses those beyond the cap before they reach the transport. */
function countingEgress(inner: EgressClient, state: ProbeState): EgressClient {
  return {
    request(url, init) {
      if (state.requests >= PROBE_MAX_REQUESTS) {
        state.refused += 1;
        return Promise.reject(new EgressError('invalid_request', 'probe request cap reached'));
      }
      state.requests += 1;
      return inner.request(url, init);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Findings model
// ---------------------------------------------------------------------------------------------------------------

/**
 * What rejected an `invalid` outcome (FU-2; T11H-F02): closed values and a diagnostic path only (schema field names and
 * numeric indices, any other segment `*`), never a value.
 */
export interface ProbeDiagnostic {
  readonly resource: DiagnosticResource;
  readonly stage: 'egress' | RejectionStage;
  /** The egress refusal kind (stage `egress` only). */
  readonly refusal: EgressRefusalKind | null;
  /** The diagnostic path (stages `allow_list` and `domain`), null when none was reported. */
  readonly path: string | null;
}

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ProbeFailureCode; readonly diagnostic: ProbeDiagnostic | null };

const RESOURCES: ReadonlySet<string> = new Set(DIAGNOSTIC_RESOURCES);
const REFUSALS: ReadonlySet<string> = new Set(EGRESS_REFUSAL_KINDS);
const STAGES: ReadonlySet<string> = new Set(REJECTION_STAGES);

function closedResource(value: unknown): DiagnosticResource | null {
  return typeof value === 'string' && RESOURCES.has(value) ? (value as DiagnosticResource) : null;
}

function closedRefusal(value: unknown): EgressRefusalKind {
  return typeof value === 'string' && REFUSALS.has(value) ? (value as EgressRefusalKind) : 'other';
}

function closedStage(value: unknown): RejectionStage | null {
  return typeof value === 'string' && STAGES.has(value) ? (value as RejectionStage) : null;
}

/**
 * The diagnostic text of the findings file (the exact format reviewed by T60):
 * - `egress refusal <too_large|redirect|other> on <resource>`
 * - `body not JSON on <resource>`
 * - `allow-list schema on <resource>, path <diagnostic path|not recorded>`
 * - `domain validation on <resource>, path <diagnostic path|not recorded>`
 * - `no diagnostic recorded`
 * where `<resource>` is one of `DIAGNOSTIC_RESOURCES`. The path is reduced again here (`diagnosticPath` is idempotent).
 */
export function diagnosticText(diagnostic: ProbeDiagnostic | null): string {
  const resource = closedResource(diagnostic?.resource);
  if (diagnostic === null || resource === null) {
    return 'no diagnostic recorded';
  }
  const path = diagnosticPath(diagnostic.path) ?? 'not recorded';
  switch (diagnostic.stage) {
    case 'egress':
      return `egress refusal ${closedRefusal(diagnostic.refusal)} on ${resource}`;
    case 'not_json':
      return `body not JSON on ${resource}`;
    case 'allow_list':
      return `allow-list schema on ${resource}, path ${path}`;
    case 'domain':
      return `domain validation on ${resource}, path ${path}`;
    default:
      return 'no diagnostic recorded';
  }
}

/** The failure text of an outcome: the closed code, and for `invalid` its diagnostic. */
function failedText(outcome: { readonly code: ProbeFailureCode; readonly diagnostic: ProbeDiagnostic | null }): string {
  return outcome.code === 'invalid' ? `invalid; ${diagnosticText(outcome.diagnostic)}` : outcome.code;
}

interface CompetitionFinding {
  /** The adapter's opaque reference (never rendered). */
  readonly ref: SourceCompetition['ref'];
  readonly code: string;
  readonly name: string;
  readonly area: string | null;
  readonly reference: boolean;
  detail: Outcome<{ seasons: SourceSeason[]; retrievedAt: string | null }> | null;
}

interface SelectionFinding {
  readonly filter: string;
  readonly outcome: Outcome<{
    matches: number;
    standings: string;
    retrievedAt: string;
    staleStatuses: ReadonlyMap<string, number>;
    staleMatches: number;
  }>;
}

interface CoverageFinding {
  readonly code: string;
  readonly name: string;
  readonly role: 'reference' | 'candidate';
  season: SourceSeason | null;
  stages: Outcome<{ items: SourceStage[]; retrievedAt: string | null; seasonLabel: string }> | null;
  extraStages: Outcome<{ items: SourceStage[]; retrievedAt: string | null; seasonLabel: string }> | null;
  readonly selections: SelectionFinding[];
  note: string | null;
}

interface KindStats {
  responses: number;
  largest: number;
  readonly fields: Map<string, { present: number; total: number }>;
  readonly dropped: Set<string>;
  totalTables: number;
}

interface HeaderStats {
  readonly available: number[];
  readonly reset: number[];
  readonly versions: Set<string>;
  clientOn200: boolean | null;
  clientOn403: boolean | null;
  sameAcross: boolean | null;
  status403: number;
  status429: number;
  readonly statuses: Map<string, number>;
}

class Recorder {
  readonly kinds = new Map<RequestKind, KindStats>();
  /** Non-2xx statuses and transport failures per resource kind, keyed by their (closed) text. */
  readonly failures = new Map<string, number>();
  /** Rejected bodies and outputs, keyed by their diagnostic text. */
  readonly rejections = new Map<string, number>();
  /** The diagnostic of the last refusal or rejection; reset before each probed action. */
  lastDiagnostic: ProbeDiagnostic | null = null;
  readonly headers: HeaderStats = {
    available: [],
    reset: [],
    versions: new Set(),
    clientOn200: null,
    clientOn403: null,
    sameAcross: null,
    status403: 0,
    status429: 0,
    statuses: new Map(),
  };

  #kind(kind: RequestKind): KindStats {
    let stats = this.kinds.get(kind);
    if (stats === undefined) {
      stats = { responses: 0, largest: 0, fields: new Map(), dropped: new Set(), totalTables: 0 };
      this.kinds.set(kind, stats);
    }
    return stats;
  }

  observe(observation: RequestObservation): void {
    if (observation.type === 'rejection') {
      const resource = closedResource(observation.resource);
      const stage = closedStage(observation.stage);
      if (resource === null || stage === null) {
        return;
      }
      const diagnostic: ProbeDiagnostic = { resource, stage, refusal: null, path: diagnosticPath(observation.path) };
      this.lastDiagnostic = diagnostic;
      const text = diagnosticText(diagnostic);
      this.rejections.set(text, (this.rejections.get(text) ?? 0) + 1);
      return;
    }
    const stats = this.#kind(observation.kind);
    if (observation.type === 'body') {
      this.#fields(stats, observation.fields);
      for (const key of observation.droppedKeys) {
        stats.dropped.add(key);
      }
      stats.totalTables += observation.totalTables ?? 0;
      return;
    }
    const status = observation.status === null ? (observation.failure ?? 'failure') : String(observation.status);
    this.headers.statuses.set(status, (this.headers.statuses.get(status) ?? 0) + 1);
    const resource = closedResource(observation.kind);
    const refusal =
      observation.status === null && observation.refusal !== null ? closedRefusal(observation.refusal) : null;
    if (resource !== null && (observation.status === null || observation.status < 200 || observation.status > 299)) {
      const text = `${status}${refusal === null ? '' : ` (egress refusal ${refusal})`} on ${resource}`;
      this.failures.set(text, (this.failures.get(text) ?? 0) + 1);
    }
    if (observation.status === null) {
      if (refusal !== null && resource !== null) {
        this.lastDiagnostic = { resource, stage: 'egress', refusal, path: null };
      }
      return;
    }
    stats.responses += 1;
    stats.largest = Math.max(stats.largest, observation.bytes ?? 0);
    if (observation.requestsAvailable !== null) {
      this.headers.available.push(observation.requestsAvailable);
    }
    if (observation.counterResetSeconds !== null) {
      this.headers.reset.push(observation.counterResetSeconds);
    }
    if (observation.apiVersion !== null) {
      this.headers.versions.add(observation.apiVersion);
    }
    const present = observation.authenticatedClientPresent;
    if (observation.status >= 200 && observation.status <= 299) {
      this.headers.clientOn200 = (this.headers.clientOn200 ?? false) || present;
    }
    if (observation.status === 403) {
      this.headers.status403 += 1;
      this.headers.clientOn403 = (this.headers.clientOn403 ?? false) || present;
    }
    if (observation.status === 429) {
      this.headers.status429 += 1;
    }
    if (observation.authenticatedClientSameAsFirst !== null) {
      this.headers.sameAcross = (this.headers.sameAcross ?? true) && observation.authenticatedClientSameAsFirst;
    }
  }

  #fields(stats: KindStats, fields: readonly FieldPresence[]): void {
    for (const field of fields) {
      const entry = stats.fields.get(field.field) ?? { present: 0, total: 0 };
      entry.present += field.present;
      entry.total += field.total;
      stats.fields.set(field.field, entry);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------------------------

/** Runs one probed action; an `invalid` failure carries the diagnostic of the refusal or rejection that caused it. */
async function attempt<T>(recorder: Recorder, action: () => Promise<T>): Promise<Outcome<T>> {
  recorder.lastDiagnostic = null;
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    const code = failureCodeOf(error);
    return { ok: false, code, diagnostic: code === 'invalid' ? recorder.lastDiagnostic : null };
  }
}

function research(): IngestionContext {
  return { signal: new AbortController().signal, purpose: 'research' };
}

function freshness(snapshot: SelectionSnapshot, nowMs: number): { statuses: Map<string, number>; count: number } {
  const statuses = new Map<string, number>();
  let count = 0;
  for (const match of snapshot.matches) {
    const kickoff = Date.parse(match.kickoff);
    if (Number.isFinite(kickoff) && kickoff < nowMs - FRESHNESS_AGE_MS) {
      count += 1;
      statuses.set(match.status, (statuses.get(match.status) ?? 0) + 1);
    }
  }
  return { statuses, count };
}

function standingsText(snapshot: SelectionSnapshot): string {
  return snapshot.standings.available
    ? `available (${String(snapshot.standings.rows.length)} rows)`
    : `not available (${snapshot.standings.reason})`;
}

interface RunContext {
  readonly source: IngestionSource;
  readonly recorder: Recorder;
  readonly state: ProbeState;
  readonly clock: Clock;
  readonly stdout: (line: string) => void;
}

function remaining(state: ProbeState): number {
  return PROBE_MAX_REQUESTS - state.requests;
}

async function selectionFinding(run: RunContext, filter: string, ref: SourceRef): Promise<SelectionFinding> {
  const outcome = await attempt(run.recorder, async () => {
    const snapshot = await run.source.fetchSelection(ref, research());
    const fresh = freshness(snapshot, run.clock.now().getTime());
    return {
      matches: snapshot.matches.length,
      standings: standingsText(snapshot),
      retrievedAt: snapshot.retrievedAt,
      staleStatuses: fresh.statuses,
      staleMatches: fresh.count,
    };
  });
  return { filter, outcome };
}

async function coverage(
  run: RunContext,
  finding: CompetitionFinding,
  role: CoverageFinding['role'],
): Promise<CoverageFinding> {
  const result: CoverageFinding = {
    code: finding.code,
    name: finding.name,
    role,
    season: null,
    stages: null,
    extraStages: null,
    selections: [],
    note: null,
  };
  const detail = finding.detail;
  if (detail === null || !detail.ok) {
    result.note = 'not readable with the token';
    return result;
  }
  const seasons = detail.value.seasons;
  const season = seasons.find((item) => item.current) ?? seasons[0] ?? null;
  result.season = season;
  if (season === null) {
    result.note = 'no season reported';
    return result;
  }
  if (remaining(run.state) < 1) {
    result.note = 'request cap reached';
    return result;
  }
  const competitionRef = finding.ref;
  result.stages = await attempt(run.recorder, async () => {
    const listing = await run.source.listStages(competitionRef, season.ref, research());
    return { items: [...listing.items], retrievedAt: listing.retrievedAt, seasonLabel: season.label };
  });
  run.stdout(`probe: stages of one competition done; requests: ${String(run.state.requests)}`);
  if (!result.stages.ok) {
    return result;
  }
  const stages = result.stages.value.items;
  const numbered = stages.find((stage) => stage.matchdays.length > 0);
  if (numbered !== undefined && remaining(run.state) >= 2) {
    const matchday = numbered.matchdays[0];
    if (matchday !== undefined) {
      result.selections.push(
        await selectionFinding(run, `stage ${numbered.name}, matchday ${String(matchday.number)}`, matchday.ref),
      );
      run.stdout(`probe: matchday selection done; requests: ${String(run.state.requests)}`);
    }
  }
  if (role !== 'reference') {
    return result;
  }
  let whole = stages.find((stage) => stage.wholeStageRef !== null);
  if (whole === undefined && remaining(run.state) >= 2) {
    const previous = seasons.find((item) => item.startYear !== null && item.startYear === (season.startYear ?? 0) - 1);
    if (previous !== undefined) {
      result.extraStages = await attempt(run.recorder, async () => {
        const listing = await run.source.listStages(competitionRef, previous.ref, research());
        return { items: [...listing.items], retrievedAt: listing.retrievedAt, seasonLabel: previous.label };
      });
      whole = result.extraStages.ok
        ? result.extraStages.value.items.find((stage) => stage.wholeStageRef !== null)
        : undefined;
    }
  }
  const wholeRef = whole?.wholeStageRef ?? null;
  if (whole !== undefined && wholeRef !== null && remaining(run.state) >= 1) {
    result.selections.push(await selectionFinding(run, `stage ${whole.name} as a whole`, wholeRef));
    run.stdout(`probe: stage selection done; requests: ${String(run.state.requests)}`);
  }
  return result;
}

interface Findings {
  readonly startedAt: string;
  readonly competitions: { retrievedAt: string | null; items: CompetitionFinding[] };
  readonly coverage: CoverageFinding[];
  readonly recorder: Recorder;
  readonly state: ProbeState;
  readonly referenceCodes: readonly string[];
  /** Codes named with `--candidates`, or null. */
  readonly candidateCodes: readonly string[] | null;
  /** Named codes the competition list does not hold (no request made for them). */
  readonly notListed: readonly string[];
}

/** Runs the probe and returns the exit code; it never throws and prints only counts, kinds and closed codes. */
export async function runProbe(io: ProbeIo): Promise<number> {
  const state = io.state ?? { requests: 0, refused: 0 };
  let out: string | null = null;
  let findings: Findings | null = null;
  const write = io.writeFile ?? writeFindingsFile;
  try {
    const args = parseArgs(io.argv);
    out = resolve(io.cwd, args.out);
    const env = probeEnvironment(io.env);
    const config = loadConfig({ rootDir: io.rootDir, env: { EDR_CONFIG: args.config } });
    const index = config.providers.sports.sources.findIndex(
      (source) => source.enabled && source.adapter === 'football-data' && source.mode === 'LIVE_DATA',
    );
    const configured = config.providers.sports.sources[index];
    if (configured === undefined) {
      throw new ProbeFailure('config');
    }
    const options = parseFootballDataOptions(configured.options, `providers.sports.sources[${String(index)}]`);
    if (!options.ok) {
      throw new ProbeFailure('config');
    }
    const clock: Clock = io.clock ?? { now: () => new Date() };
    const recorder = new Recorder();
    const transport = io.egress ?? createEgressClient(buildEgressAllowList(config));
    const registry = createSourceRegistry(
      { providers: { sports: { sources: [configured] } }, catalogue: CatalogueConfig.empty() },
      {
        egress: countingEgress(transport, state),
        env,
        clock,
        db: {} as never,
        paths: { rootDir: io.rootDir, dataDir: join(io.rootDir, 'data') },
        logger: silentSportsLogger,
      },
      [footballDataRegistration({ observer: (observation) => recorder.observe(observation) })],
    );
    registry.validateStartup();
    const source = registry.get(configured.id);
    if (source === undefined) {
      throw new ProbeFailure('config');
    }
    io.stdout('probe: started');

    const run: RunContext = { source, recorder, state, clock, stdout: io.stdout };
    const startedAt = clock.now().toISOString();
    const listing = await source.listCompetitions(research());
    io.stdout(`probe: competitions done; listed: ${String(listing.items.length)}; requests: ${String(state.requests)}`);
    const referenceCodes = options.options.referenceCompetitionRefs;
    const items: CompetitionFinding[] = listing.items.map((item: SourceCompetition) => {
      const code = competitionCodeOfRef(item.ref) ?? item.localKey;
      return {
        ref: item.ref,
        code,
        name: item.name,
        area: item.areaName,
        reference: referenceCodes.includes(code),
        detail: null,
      };
    });
    const named = args.candidates;
    const byCode = new Map(items.map((item): [string, CompetitionFinding] => [item.code, item]));
    const notListed = named === null ? [] : named.filter((code) => !byCode.has(code));
    findings = {
      startedAt,
      competitions: { retrievedAt: listing.retrievedAt, items },
      coverage: [],
      recorder,
      state,
      referenceCodes,
      candidateCodes: named,
      notListed,
    };

    const references = items.filter((item) => item.reference);
    const others =
      named === null
        ? items.filter((item) => !item.reference)
        : named.flatMap((code) => {
            const item = byCode.get(code);
            return item === undefined || item.reference ? [] : [item];
          });
    const candidates = [...references, ...others].slice(0, PROBE_MAX_DETAILS);
    for (const item of candidates) {
      if (remaining(state) < 1) {
        break;
      }
      item.detail = await attempt(recorder, async () => {
        const seasons = await source.listSeasons(item.ref, research());
        return { seasons: [...seasons.items], retrievedAt: seasons.retrievedAt };
      });
    }
    io.stdout(`probe: competition details done; requests: ${String(state.requests)}`);

    const readable = candidates.filter((item) => item.detail?.ok === true);
    const targets: Array<[CompetitionFinding, CoverageFinding['role']]> = [
      ...readable
        .filter((item) => item.reference)
        .map((item): [CompetitionFinding, 'reference'] => [item, 'reference']),
      ...readable
        .filter((item) => !item.reference)
        .slice(0, PROBE_MAX_CANDIDATES)
        .map((item): [CompetitionFinding, 'candidate'] => [item, 'candidate']),
    ];
    for (const item of references.filter((candidate) => candidate.detail?.ok !== true)) {
      targets.unshift([item, 'reference']);
    }
    for (const [item, role] of targets) {
      findings.coverage.push(await coverage(run, item, role));
    }

    write(out, renderFindings(findings, null));
    io.stdout(
      `probe: findings written; requests: ${String(state.requests)}; refused by the cap: ${String(state.refused)}`,
    );
    return 0;
  } catch (error) {
    const code = failureCodeOf(error);
    io.stderr(failureLine(code, state));
    if (out !== null && findings !== null) {
      try {
        write(out, renderFindings(findings, code, code === 'invalid' ? findings.recorder.lastDiagnostic : null));
      } catch {
        // The failure line is already printed; nothing else is reported.
      }
    }
    return 1;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Findings file (Markdown)
// ---------------------------------------------------------------------------------------------------------------

/** Table cell text: no pipe, no line break, no control character. */
function cell(value: string | number | null): string {
  if (value === null) {
    return '-';
  }
  return String(value)
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\|/g, '/')
    .slice(0, 120);
}

function yesNo(value: boolean | null): string {
  return value === null ? 'not observed (UNVERIFIED)' : value ? 'yes' : 'no';
}

function range(values: readonly number[]): string {
  if (values.length === 0) {
    return 'not observed (UNVERIFIED)';
  }
  return `${String(Math.min(...values))} to ${String(Math.max(...values))} (last ${String(values.at(-1))}, ${String(values.length)} responses)`;
}

function presenceWord(present: number, total: number): string {
  if (total === 0) {
    return 'not observed (UNVERIFIED)';
  }
  return present === total ? 'always' : present === 0 ? 'never' : 'sometimes';
}

const KIND_RESOURCES: ReadonlyMap<RequestKind, string> = new Map<RequestKind, string>([
  ['competitions', 'GET /competitions'],
  ['competition', 'GET /competitions/:code'],
  ['stageDiscovery', 'GET /competitions/:code/matches?season'],
  ['matches', 'GET /competitions/:code/matches?season&matchday or &stage'],
  ['standings', 'GET /competitions/:code/standings?season&matchday'],
]);

function renderStages(lines: string[], label: string, stages: CoverageFinding['stages']): void {
  if (stages === null) {
    return;
  }
  if (!stages.ok) {
    lines.push(`- Stage discovery (${label}): failed (${cell(failedText(stages))})`);
    return;
  }
  const value = stages.value;
  lines.push(
    `- Stage discovery, season ${cell(value.seasonLabel)} (GET /competitions/:code/matches?season, retrieved ` +
      `${cell(value.retrievedAt)}): ${String(value.items.length)} stages`,
  );
  lines.push('', '  | Stage value | Matchday numbers | Selectable as a whole | Standings |', '  |---|---|---|---|');
  for (const stage of value.items) {
    const numbers = stage.matchdays.map((matchday) => matchday.number);
    const numbering =
      numbers.length === 0 ? 'none' : `${String(numbers.length)} (${String(numbers[0])} to ${String(numbers.at(-1))})`;
    lines.push(
      `  | ${cell(stage.name)} | ${numbering} | ${stage.wholeStageRef === null ? 'no' : 'yes'} | ${stage.standings} |`,
    );
  }
  const knockoutNumbered = value.items.filter((stage) => stage.standings !== 'expected' && stage.matchdays.length > 0);
  lines.push(
    '',
    `  Stages other than the table stage carrying matchday numbers: ${
      value.items.length <= 1 ? 'not observed (UNVERIFIED)' : String(knockoutNumbered.length)
    }`,
  );
}

/** The findings Markdown: derived values only (no token, header values beyond the counters, bodies or persons). */
export function renderFindings(
  findings: Findings,
  failure: ProbeFailureCode | null,
  diagnostic: ProbeDiagnostic | null = null,
): string {
  const { recorder, state } = findings;
  const lines: string[] = [
    '# football-data.org capability findings (probe)',
    '',
    `- Probe run started: ${findings.startedAt} (UTC)`,
    `- Outcome: ${failure === null ? 'completed' : `failed (${cell(failedText({ code: failure, diagnostic }))})`}`,
    `- Requests sent: ${String(state.requests)} of at most ${String(PROBE_MAX_REQUESTS)}; refused by the request cap: ${String(state.refused)}`,
    `- Configured reference competition codes: ${findings.referenceCodes.map(cell).join(', ') || 'none'}`,
    `- Named candidate codes (--candidates): ${
      findings.candidateCodes === null
        ? 'none (candidates in listing order)'
        : findings.candidateCodes.map(cell).join(', ') || 'none'
    }`,
    `- Origin: ${PINNED_ORIGIN} (the only origin contacted)`,
    '- Anything not observed below is UNVERIFIED and not promised (R-259).',
    '',
    '## Competitions listed',
    '',
    `Resource GET /competitions, retrieved ${cell(findings.competitions.retrievedAt)}; one detail request per candidate, at most ${String(PROBE_MAX_DETAILS)} (GET /competitions/:code).`,
    '',
    '| Code | Name | Area | Reference | Readable with the token | Seasons reported | Detail retrieved |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const item of findings.competitions.items) {
    const detail = item.detail;
    const readable =
      detail === null ? 'not checked (UNVERIFIED)' : detail.ok ? 'yes' : `no (${cell(failedText(detail))})`;
    const seasons = detail?.ok === true ? String(detail.value.seasons.length) : '-';
    const retrieved = detail?.ok === true ? cell(detail.value.retrievedAt) : '-';
    lines.push(
      `| ${cell(item.code)} | ${cell(item.name)} | ${cell(item.area)} | ${item.reference ? 'yes' : 'no'} | ${readable} | ${seasons} | ${retrieved} |`,
    );
  }

  lines.push('', '## Coverage per competition', '');
  if (findings.coverage.length === 0 && findings.notListed.length === 0) {
    lines.push('No competition was probed for coverage (UNVERIFIED).');
  }
  for (const item of findings.coverage) {
    lines.push(`### ${cell(item.code)} (${cell(item.name)}), ${item.role}`, '');
    if (item.note !== null) {
      lines.push(`- ${item.note} (UNVERIFIED)`);
    }
    if (item.season !== null) {
      lines.push(
        `- Season probed: ${cell(item.season.label)} (current: ${item.season.current ? 'yes' : 'no'}; start year ${cell(item.season.startYear)})`,
      );
    }
    renderStages(lines, 'current season', item.stages);
    renderStages(lines, 'previous season', item.extraStages);
    if (item.stages?.ok === true && item.selections.length === 0) {
      lines.push('- Matchday and stage filters: not probed (UNVERIFIED)');
    }
    for (const selection of item.selections) {
      const outcome = selection.outcome;
      if (!outcome.ok) {
        lines.push(`- Filter ${cell(selection.filter)}: failed (${cell(failedText(outcome))})`);
        continue;
      }
      const value = outcome.value;
      lines.push(
        `- Filter ${cell(selection.filter)} (retrieved ${cell(value.retrievedAt)}): matches ${String(value.matches)}; standings ${value.standings}`,
      );
      const statuses = [...value.staleStatuses].map(([status, count]) => `${status} ${String(count)}`).join(', ');
      lines.push(
        `  - Freshness: matches with kickoff more than 3 hours old: ${String(value.staleMatches)}${statuses === '' ? '' : ` (${statuses})`}`,
      );
    }
    lines.push('');
  }
  for (const code of findings.notListed) {
    lines.push(
      `### ${cell(code)}, candidate`,
      '',
      '- not listed by GET /competitions; no request made (UNVERIFIED)',
      '',
    );
  }

  lines.push('## Field presence of the mapped fields', '');
  lines.push('Counts of items in which the field is present and not null, over every response of the kind.', '');
  for (const [kind, resource] of KIND_RESOURCES) {
    const stats = recorder.kinds.get(kind);
    lines.push(`### ${resource}`, '');
    if (stats === undefined || stats.fields.size === 0) {
      lines.push('Not observed (UNVERIFIED).', '');
      continue;
    }
    lines.push('| Field | Presence | Present | Of |', '|---|---|---|---|');
    for (const [field, entry] of stats.fields) {
      lines.push(
        `| ${cell(field)} | ${presenceWord(entry.present, entry.total)} | ${String(entry.present)} | ${String(entry.total)} |`,
      );
    }
    const dropped = [...stats.dropped].sort();
    lines.push(
      '',
      `Dropped keys (names only): ${dropped.length === 0 ? 'none' : dropped.map((key) => `\`${cell(key)}\``).join(', ')}`,
    );
    if (kind === 'standings') {
      lines.push('', `TOTAL tables seen: ${String(stats.totalTables)}`);
    }
    lines.push('');
  }

  const headers = recorder.headers;
  lines.push(
    '## Response headers and statuses',
    '',
    `- X-API-Version values: ${headers.versions.size === 0 ? 'not observed (UNVERIFIED)' : [...headers.versions].sort().join(', ')}`,
    `- X-RequestsAvailable observed: ${range(headers.available)}`,
    `- X-RequestCounter-Reset observed (seconds): ${range(headers.reset)}`,
    `- Statuses: ${[...headers.statuses].map(([status, count]) => `${status} x${String(count)}`).join(', ') || 'none'}`,
    `- Failures by resource kind: ${
      [...recorder.failures]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([text, count]) => `${cell(text)} x${String(count)}`)
        .join(', ') || 'none'
    }`,
    `- 429 responses: ${String(headers.status429)}`,
    '- 403 classification evidence (presence booleans only, never the value):',
    `  - X-Authenticated-Client present on 2xx responses: ${yesNo(headers.clientOn200)}`,
    `  - X-Authenticated-Client present on 403 responses: ${headers.status403 === 0 ? 'no 403 observed (UNVERIFIED)' : yesNo(headers.clientOn403)}`,
    `  - Same value on every response that carried it: ${yesNo(headers.sameAcross)}`,
    '',
    '## Rejected responses and outputs',
    '',
    'Stage that rejected a received body or the adapter output built from it, with the failing validation path as ' +
      'schema field names and numeric indices only (any other segment `*`, never a value).',
    '',
  );
  if (recorder.rejections.size === 0) {
    lines.push('None.');
  } else {
    lines.push('| Rejection | Count |', '|---|---|');
    for (const [text, count] of [...recorder.rejections].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      lines.push(`| ${cell(text)} | ${String(count)} |`);
    }
  }
  lines.push(
    '',
    '## Response sizes',
    '',
    '| Resource | Responses | Largest decoded body (bytes) | Above 512 KiB |',
    '|---|---|---|---|',
  );
  for (const [kind, resource] of KIND_RESOURCES) {
    const stats = recorder.kinds.get(kind);
    if (stats === undefined || stats.responses === 0) {
      lines.push(`| ${resource} | 0 | not observed (UNVERIFIED) | - |`);
    } else {
      lines.push(
        `| ${resource} | ${String(stats.responses)} | ${String(stats.largest)} | ${stats.largest > SIZE_CAP_BYTES ? 'yes' : 'no'} |`,
      );
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeFindingsFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding: 'utf8', mode: 0o644 });
}

// ---------------------------------------------------------------------------------------------------------------
// Process entry and top-level handlers
// ---------------------------------------------------------------------------------------------------------------

/** The project root from this script's location (`apps/server/scripts` or `apps/server/dist/scripts`). */
export function probeRootDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, '../../..'), resolve(here, '../../../..')]) {
    if (existsSync(join(candidate, 'apps', 'server', 'package.json')) && existsSync(join(candidate, 'config'))) {
      return candidate;
    }
  }
  throw new ProbeFailure('config');
}

/** Events the top-level handler listens to. */
export interface FailureEvents {
  on(event: 'uncaughtException' | 'unhandledRejection', listener: (reason: unknown) => void): unknown;
}

/**
 * Installs the handlers of uncaught exceptions and unhandled rejections: each prints only the closed failure line
 * (`internal`) and exits non-zero; the error itself is never printed (T11H-F02).
 */
export function installFailureHandlers(
  events: FailureEvents,
  state: ProbeState,
  stderr: (line: string) => void,
  exit: (code: number) => void,
): void {
  const fail = (): void => {
    stderr(failureLine('internal', state));
    exit(1);
  };
  events.on('uncaughtException', fail);
  events.on('unhandledRejection', fail);
}

function isEntryPoint(): boolean {
  const script = process.argv[1];
  if (typeof script !== 'string' || script === '') {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(script)).href;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const state: ProbeState = { requests: 0, refused: 0 };
  const stdout = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  const stderr = (line: string): void => {
    process.stderr.write(`${line}\n`);
  };
  installFailureHandlers(process, state, stderr, (code) => process.exit(code));
  let code = 1;
  try {
    code = await runProbe({
      argv: process.argv.slice(2),
      env: process.env,
      rootDir: probeRootDir(),
      cwd: process.cwd(),
      stdout,
      stderr,
      state,
    });
  } catch {
    stderr(failureLine('internal', state));
  }
  process.exitCode = code;
}

if (isEntryPoint()) {
  void main();
}
