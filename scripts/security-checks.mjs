#!/usr/bin/env node
/**
 * Security checks used as evidence controls (task-plan T41; security design reviews T10-F01, T10-A1-02, T10-A1-03,
 * T11H-F02; R-260 to R-265). No dependency beyond Node.js and git (and npm for `audit-report`).
 *
 * Usage: node scripts/security-checks.mjs <subcommand> [options]
 *
 *   secret-scan                       tracked files (git ls-files) of the repository at the current directory
 *   bundle-secrets [dir]              built web assets (default apps/web/dist)
 *   lockfile                          package-lock.json and .npmrc
 *   audit-report [--from-file <f>]    npm audit --json (or a saved report) with every advisory listed
 *   hygiene                           tracked and ignored local files, .env.example
 *   marker-scan [--require-token] <paths...>
 *
 * Every subcommand runs from the repository root (the current directory), prints what it checked, one line per
 * finding (rule, file and line, never the matched value) and a last line `RESULT: PASS` or `RESULT: FAIL`. It exits 0
 * when the control holds and 1 otherwise, including when the control could not be checked (missing input, git or npm
 * failure, usage error). No secret value is ever printed: findings name the rule and the place only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------------------------------------------
// Synthetic values (vitest.setup.ts, fixtures/football-data). Built from parts so that this file holds none of them
// literally and does not match its own scans.
// ---------------------------------------------------------------------------------------------------------------

const DUMMY_API_KEY = ['edr', 'test', 'dummy', 'key', '0000'].join('-');
const MARKER_TOKEN = ['edr', 'test', 'marker', 'token', '0000'].join('-');
const MARKER_CLIENT = ['edr', 'test', 'client', 'marker', '0000'].join('-');

/** Name of the provider token variable. */
export const TOKEN_VARIABLE = 'FOOTBALL_DATA_API_TOKEN';

/** The provider host, which must never appear in the browser bundle (R-262). */
const PROVIDER_HOST_PATTERN = /football-data\.org/i;

/** Packages whose advisories fail `audit-report` whatever the severity (T10-F02, T10-F18). */
export const WATCHED_PACKAGES = Object.freeze([
  'fastify',
  '@fastify/static',
  'zod',
  'satori',
  '@resvg/resvg-js',
  'vite',
  'react',
  'react-dom',
]);

const REGISTRY = 'https://registry.npmjs.org/';

/** Largest file read by the scans; larger files are reported and fail the scan (they cannot be checked). */
const MAX_SCANNED_BYTES = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------------------------

class Report {
  /** @param {string} name */
  constructor(name) {
    this.name = name;
    /** @type {string[]} */
    this.findings = [];
  }

  /** @param {string} text */
  info(text) {
    process.stdout.write(`${this.name}: ${text}\n`);
  }

  /** @param {string} text */
  line(text) {
    process.stdout.write(`${text}\n`);
  }

  /** @param {string} text A rule and a place; never a matched value. */
  finding(text) {
    this.findings.push(text);
    process.stdout.write(`${this.name}: FINDING ${text}\n`);
  }

  /** Prints the result and returns the exit code. */
  finish() {
    const passed = this.findings.length === 0;
    process.stdout.write(`${this.name}: findings: ${String(this.findings.length)}\n`);
    process.stdout.write(`RESULT: ${passed ? 'PASS' : 'FAIL'}\n`);
    return passed ? 0 : 1;
  }
}

/** A printable, single-line form of a path (control characters replaced). */
function printablePath(path) {
  return [...path]
    .map((character) => (character.charCodeAt(0) < 0x20 || character === '\u007f' ? '?' : character))
    .join('');
}

// ---------------------------------------------------------------------------------------------------------------
// git and file helpers
// ---------------------------------------------------------------------------------------------------------------

/**
 * Runs git with only the repository's own configuration (no global or system file), so that a developer's global
 * excludes cannot make a control pass.
 */
function git(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

/** The tracked files of the repository at the current directory, or null when git fails. */
function trackedFiles() {
  const result = git(['ls-files', '-z', '--cached', '--full-name']);
  if (result.error !== undefined || result.status !== 0) {
    return null;
  }
  return result.stdout.split('\0').filter((entry) => entry !== '');
}

function isBinary(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

/** Line number (1-based) of a character offset. */
function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

/**
 * Reads a regular file for scanning. Returns `{ buffer }`, `{ skip: reason }` for symbolic links and other non-files,
 * or `{ error: reason }` when it cannot be checked.
 */
function readForScan(path) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch {
    return { error: 'cannot be read' };
  }
  if (stats.isSymbolicLink()) {
    return { skip: 'symbolic link' };
  }
  if (!stats.isFile()) {
    return { skip: 'not a regular file' };
  }
  if (stats.size > MAX_SCANNED_BYTES) {
    return { error: 'too large to scan' };
  }
  try {
    return { buffer: readFileSync(path) };
  } catch {
    return { error: 'cannot be read' };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// secret-scan (R-260, R-261)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Non-empty credential assignments: `EDR_<...>_API_KEY` or `FOOTBALL_DATA_API_TOKEN`, `=`, then at least 8
 * credential-like characters, directly or in quotes (also after spaces: `NAME = "value"`). Empty values, variable
 * references (`$NAME`), placeholders (`<...>`), pattern text (`..*`) and prose (`NAME= is required`) do not match.
 */
const ASSIGNMENT_PATTERN =
  /\b(EDR_[A-Z0-9_]*API_KEY|FOOTBALL_DATA_API_TOKEN)[ \t]*=(?:["']?[A-Za-z0-9_\-./+=:]{8,}|[ \t]+["'][A-Za-z0-9_\-./+=:]{8,})/g;

/** Common provider credential shapes and private-key headers. */
export const KEY_PATTERNS = Object.freeze([
  { rule: 'private key header', pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----/g },
  { rule: 'OpenAI-style secret key', pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g },
  { rule: 'AWS access key ID', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { rule: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g },
  { rule: 'GitLab token', pattern: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { rule: 'Slack token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { rule: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { rule: 'Stripe live key', pattern: /\b[rs]k_live_[A-Za-z0-9]{16,}/g },
  { rule: 'npm token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { rule: 'Hugging Face token', pattern: /\bhf_[A-Za-z0-9]{30,}\b/g },
]);

/** The synthetic values and the rule name reported for each. */
const SYNTHETIC_VALUES = Object.freeze([
  { rule: 'shared dummy test key', value: DUMMY_API_KEY },
  { rule: 'synthetic marker token', value: MARKER_TOKEN },
  { rule: 'marker client value', value: MARKER_CLIENT },
]);

/**
 * Where the synthetic values may appear: test files, test directories, fixtures, the shared test setup, the
 * end-to-end harness and the work-item records under docs/ (which document the values).
 */
export function isSyntheticValueAllowed(path) {
  const normalized = path.split(sep).join('/');
  return (
    /(^|\/)[^/]+\.test\.[cm]?[jt]sx?$/.test(normalized) ||
    /(^|\/)test\//.test(normalized) ||
    normalized.startsWith('fixtures/') ||
    normalized.startsWith('e2e/') ||
    normalized.startsWith('docs/') ||
    normalized === 'vitest.setup.ts'
  );
}

/** Tracked environment files other than `.env.example` (any directory). */
function isTrackedEnvironmentFile(path) {
  const name = basename(path);
  return name.startsWith('.env') && name !== '.env.example';
}

function secretScan() {
  const report = new Report('secret-scan');
  report.info('scope: tracked files (git ls-files) of the repository at the current directory');
  report.info(
    'rules: non-empty assignments of EDR_*API_KEY and FOOTBALL_DATA_API_TOKEN; provider key shapes; private-key headers; ' +
      'tracked .env* other than .env.example; synthetic test values outside test, fixture, e2e and docs paths',
  );
  const files = trackedFiles();
  if (files === null) {
    report.finding('git ls-files failed (not a git repository or git unavailable)');
    return report.finish();
  }
  let scanned = 0;
  let skipped = 0;
  for (const file of files) {
    const shown = printablePath(file);
    if (isTrackedEnvironmentFile(file)) {
      report.finding(`tracked environment file at ${shown}`);
    }
    const read = readForScan(file);
    if (read.skip !== undefined) {
      skipped += 1;
      continue;
    }
    if (read.error !== undefined) {
      if (existsSync(file) || read.error !== 'cannot be read') {
        report.finding(`file ${read.error} at ${shown}`);
      } else {
        // Deleted from the working tree but still in the index: nothing on disk to leak; reported for clarity.
        skipped += 1;
      }
      continue;
    }
    if (isBinary(read.buffer)) {
      for (const { rule, value } of SYNTHETIC_VALUES) {
        if (!isSyntheticValueAllowed(file) && read.buffer.includes(value)) {
          report.finding(`${rule} in binary file ${shown}`);
        }
      }
      scanned += 1;
      continue;
    }
    scanned += 1;
    const text = read.buffer.toString('utf8');
    for (const match of text.matchAll(ASSIGNMENT_PATTERN)) {
      report.finding(`non-empty ${match[1]} assignment at ${shown}:${String(lineOf(text, match.index))}`);
    }
    for (const { rule, pattern } of KEY_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        report.finding(`${rule} at ${shown}:${String(lineOf(text, match.index))}`);
      }
    }
    if (!isSyntheticValueAllowed(file)) {
      for (const { rule, value } of SYNTHETIC_VALUES) {
        const index = text.indexOf(value);
        if (index >= 0) {
          report.finding(`${rule} outside test and fixture files at ${shown}:${String(lineOf(text, index))}`);
        }
      }
    }
  }
  report.info(
    `tracked files: ${String(files.length)}; scanned: ${String(scanned)}; skipped (links, removed): ${String(skipped)}`,
  );
  return report.finish();
}

// ---------------------------------------------------------------------------------------------------------------
// bundle-secrets (R-262)
// ---------------------------------------------------------------------------------------------------------------

function* walk(path) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch {
    yield { path, missing: true };
    return;
  }
  if (stats.isDirectory()) {
    let entries;
    try {
      entries = readdirSync(path).sort();
    } catch {
      yield { path, unreadable: true };
      return;
    }
    for (const entry of entries) {
      yield* walk(join(path, entry));
    }
    return;
  }
  yield { path };
}

const BUNDLE_RULES = Object.freeze([
  { rule: 'shared dummy test key', test: (text) => text.includes(DUMMY_API_KEY) },
  { rule: 'synthetic marker token', test: (text) => text.includes(MARKER_TOKEN) },
  { rule: 'marker client value', test: (text) => text.includes(MARKER_CLIENT) },
  { rule: 'EDR_ variable assignment', test: (text) => /\bEDR_[A-Z0-9_]+["'`]?\s*[:=]/.test(text) },
  { rule: 'FOOTBALL_DATA variable name', test: (text) => /FOOTBALL_DATA/.test(text) },
  { rule: 'provider host', test: (text) => PROVIDER_HOST_PATTERN.test(text) },
]);

function bundleSecrets(args) {
  const report = new Report('bundle-secrets');
  const dir = args[0] ?? join('apps', 'web', 'dist');
  report.info(`scope: every file under ${printablePath(dir)}`);
  report.info(
    'rules: dummy test key, synthetic marker token, marker client value, EDR_ assignments, FOOTBALL_DATA names, provider host',
  );
  let stats;
  try {
    stats = lstatSync(dir);
  } catch {
    stats = null;
  }
  if (stats === null || !stats.isDirectory()) {
    report.finding('the build output directory does not exist (run the build first)');
    return report.finish();
  }
  let scanned = 0;
  for (const entry of walk(dir)) {
    const shown = printablePath(relative(process.cwd(), entry.path) || entry.path);
    if (entry.missing === true || entry.unreadable === true) {
      report.finding(`cannot be read: ${shown}`);
      continue;
    }
    const read = readForScan(entry.path);
    if (read.skip !== undefined) {
      continue;
    }
    if (read.error !== undefined) {
      report.finding(`file ${read.error}: ${shown}`);
      continue;
    }
    scanned += 1;
    const text = read.buffer.toString('latin1');
    for (const { rule, test } of BUNDLE_RULES) {
      if (test(text)) {
        report.finding(`${rule} in ${shown}`);
      }
    }
  }
  report.info(`files scanned: ${String(scanned)}`);
  if (scanned === 0) {
    report.finding('no file found in the build output directory');
  }
  return report.finish();
}

// ---------------------------------------------------------------------------------------------------------------
// lockfile (T10-F18)
// ---------------------------------------------------------------------------------------------------------------

/** `.npmrc` lines that hold credentials or point to another registry. */
function npmrcProblems(text) {
  const problems = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      return;
    }
    const at = `.npmrc:${String(index + 1)}`;
    const key = line.split('=', 1)[0]?.trim().toLowerCase() ?? '';
    const value = line.includes('=') ? line.slice(line.indexOf('=') + 1).trim() : '';
    if (/(_authtoken|_auth|_password|username|password|certfile|keyfile|email)$/.test(key) || key.startsWith('//')) {
      problems.push(`credential or per-registry setting at ${at}`);
    } else if (key === 'registry' && value !== REGISTRY) {
      problems.push(`alternate registry at ${at}`);
    } else if (key.endsWith(':registry')) {
      problems.push(`scoped registry at ${at}`);
    } else if (key === 'strict-ssl' && value === 'false') {
      problems.push(`TLS verification disabled at ${at}`);
    }
  });
  return problems;
}

function lockfile() {
  const report = new Report('lockfile');
  report.info(`scope: package-lock.json (every resolved URL under ${REGISTRY}, every entry with integrity) and .npmrc`);
  let lock;
  try {
    lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  } catch {
    report.finding('package-lock.json is missing or not valid JSON');
    return report.finish();
  }
  const packages = lock !== null && typeof lock === 'object' ? lock.packages : undefined;
  if (packages === null || typeof packages !== 'object') {
    report.finding('package-lock.json has no packages section (lockfileVersion 2 or 3 required)');
    return report.finish();
  }
  let checked = 0;
  let local = 0;
  for (const [name, entry] of Object.entries(packages)) {
    if (name === '' || entry === null || typeof entry !== 'object') {
      continue;
    }
    const shown = printablePath(name);
    if (entry.link === true || !name.includes('node_modules/')) {
      // Workspace packages and their links: local sources, no registry download.
      if (
        typeof entry.resolved === 'string' &&
        /^[a-z]+:/i.test(entry.resolved) &&
        !entry.resolved.startsWith('file:')
      ) {
        report.finding(`local entry with a remote resolved URL: ${shown}`);
      }
      local += 1;
      continue;
    }
    checked += 1;
    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith(REGISTRY)) {
      report.finding(`resolved URL not on ${REGISTRY}: ${shown}`);
    }
    if (typeof entry.integrity !== 'string' || !/^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(entry.integrity)) {
      report.finding(`missing or malformed integrity: ${shown}`);
    }
  }
  report.info(`registry entries checked: ${String(checked)}; local workspace entries: ${String(local)}`);
  if (checked === 0) {
    report.finding('no registry entry found in package-lock.json');
  }
  if (existsSync('.npmrc')) {
    const problems = npmrcProblems(readFileSync('.npmrc', 'utf8'));
    for (const problem of problems) {
      report.finding(problem);
    }
    report.info(`.npmrc checked: ${problems.length === 0 ? 'no auth token, no alternate registry' : 'problems found'}`);
  } else {
    report.info('.npmrc: absent (the default registry applies)');
  }
  return report.finish();
}

// ---------------------------------------------------------------------------------------------------------------
// audit-report (T10-F01, T10-F02, T10-F18)
// ---------------------------------------------------------------------------------------------------------------

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/** Advisories of an `npm audit --json` report (auditReportVersion 2), one per package and advisory. */
export function advisoriesOf(audit) {
  const advisories = [];
  const vulnerabilities = audit !== null && typeof audit === 'object' ? audit.vulnerabilities : undefined;
  if (vulnerabilities === null || typeof vulnerabilities !== 'object') {
    return null;
  }
  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
    const direct = via.filter((item) => item !== null && typeof item === 'object');
    const through = via.filter((item) => typeof item === 'string');
    if (direct.length === 0) {
      advisories.push({
        packageName: name,
        severity: String(vulnerability?.severity ?? 'unknown'),
        title: `via ${through.join(', ') || 'unknown'}`,
        url: '',
        range: String(vulnerability?.range ?? ''),
      });
    }
    for (const item of direct) {
      advisories.push({
        packageName: typeof item.name === 'string' ? item.name : name,
        severity: String(item.severity ?? vulnerability?.severity ?? 'unknown'),
        title: String(item.title ?? ''),
        url: String(item.url ?? ''),
        range: String(item.range ?? ''),
      });
    }
  }
  return advisories;
}

/** True when an advisory fails the report: high or critical, or naming a watched package. */
export function isBlockingAdvisory(advisory) {
  return BLOCKING_SEVERITIES.has(advisory.severity) || WATCHED_PACKAGES.includes(advisory.packageName);
}

function auditReport(args) {
  const report = new Report('audit-report');
  const fromFile = args[0] === '--from-file' ? args[1] : undefined;
  if (args.length > 0 && (fromFile === undefined || args.length !== 2)) {
    report.finding('usage: audit-report [--from-file <npm audit --json output>]');
    return report.finish();
  }
  report.info(
    `source: ${fromFile === undefined ? 'npm audit --json (live)' : `saved report ${printablePath(fromFile)}`}; ` +
      `fails on high or critical, or on any advisory naming ${WATCHED_PACKAGES.join(', ')}`,
  );
  let text;
  if (fromFile === undefined) {
    const result = spawnSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    });
    if (result.error !== undefined) {
      report.finding('npm audit could not be started');
      return report.finish();
    }
    text = result.stdout;
  } else {
    try {
      text = readFileSync(fromFile, 'utf8');
    } catch {
      report.finding('the saved audit report cannot be read');
      return report.finish();
    }
  }
  let audit;
  try {
    audit = JSON.parse(text);
  } catch {
    report.finding('npm audit did not return a JSON report (registry unreachable?)');
    return report.finish();
  }
  if (audit !== null && typeof audit === 'object' && audit.error !== undefined) {
    report.finding('npm audit reported an error instead of a report');
    return report.finish();
  }
  const advisories = advisoriesOf(audit);
  if (advisories === null) {
    report.finding('the audit report has no vulnerabilities section (auditReportVersion 2 required)');
    return report.finish();
  }
  const counts = audit.metadata?.vulnerabilities;
  if (counts !== null && typeof counts === 'object') {
    const summary = ['info', 'low', 'moderate', 'high', 'critical', 'total']
      .map((level) => `${level} ${String(counts[level] ?? 0)}`)
      .join(', ');
    report.info(`npm summary: ${summary}`);
  }
  for (const advisory of advisories) {
    const blocking = isBlockingAdvisory(advisory);
    const line =
      `advisory: package ${advisory.packageName}; severity ${advisory.severity}; ${advisory.title}` +
      `${advisory.range === '' ? '' : `; range ${advisory.range}`}${advisory.url === '' ? '' : `; ${advisory.url}`}`;
    if (blocking) {
      report.finding(line);
    } else {
      report.info(line);
    }
  }
  report.info(`advisories listed: ${String(advisories.length)}`);
  return report.finish();
}

// ---------------------------------------------------------------------------------------------------------------
// hygiene (T10-A1-02, R-261, R-264, R-265)
// ---------------------------------------------------------------------------------------------------------------

/** Paths that must be ignored by a tracked `.gitignore` rule. */
export const MUST_BE_IGNORED = Object.freeze(['.env.local', 'data/', '.cache/']);

/**
 * True when `path` is ignored by a `.gitignore` file rule (not a negation, not `.git/info/exclude`, not a global
 * excludes file). Checked one path at a time with `--no-index`, so that a tracked file is still checked against
 * the rules; returns null when git fails.
 */
function ignoredByGitignore(path) {
  const result = git(['check-ignore', '-v', '--no-index', '--', path]);
  if (result.error !== undefined || (result.status !== 0 && result.status !== 1)) {
    return null;
  }
  if (result.status === 1) {
    return false;
  }
  const line = result.stdout.split('\n').find((entry) => entry.trim() !== '') ?? '';
  const tab = line.indexOf('\t');
  const head = tab >= 0 ? line.slice(0, tab) : line;
  const match = /^(.*):(\d+):(.*)$/.exec(head);
  if (match === null) {
    return null;
  }
  const [, source, , pattern] = match;
  return basename(source ?? '') === '.gitignore' && !(pattern ?? '').startsWith('!');
}

function hygiene() {
  const report = new Report('hygiene');
  report.info(
    'checks: no tracked .env* other than .env.example, nothing tracked under data/ or .cache/; .env.local, data/ and ' +
      '.cache/ ignored by a .gitignore rule; .env.example tracked and naming FOOTBALL_DATA_API_TOKEN with an empty value',
  );
  const files = trackedFiles();
  if (files === null) {
    report.finding('git ls-files failed (not a git repository or git unavailable)');
    return report.finish();
  }
  let trackedLocal = 0;
  for (const file of files) {
    const shown = printablePath(file);
    if (isTrackedEnvironmentFile(file)) {
      report.finding(`tracked environment file: ${shown}`);
      trackedLocal += 1;
    } else if (file.startsWith('data/') || file.startsWith('.cache/')) {
      report.finding(`tracked file under a local data or cache directory: ${shown}`);
      trackedLocal += 1;
    }
  }
  report.info(`tracked files: ${String(files.length)}; tracked local files: ${String(trackedLocal)}`);

  for (const path of MUST_BE_IGNORED) {
    const ignored = ignoredByGitignore(path);
    if (ignored === null) {
      report.finding(`git check-ignore failed for ${path}`);
    } else if (!ignored) {
      report.finding(`not ignored by a .gitignore rule: ${path}`);
    } else {
      report.info(`ignored by a .gitignore rule: ${path}`);
    }
  }

  if (!files.includes('.env.example')) {
    report.finding('.env.example is not tracked');
  }
  let example = null;
  try {
    example = readFileSync('.env.example', 'utf8');
  } catch {
    report.finding('.env.example cannot be read');
  }
  if (example !== null) {
    const lines = example.split(/\r?\n/).filter((line) => /^\s*(export\s+)?FOOTBALL_DATA_API_TOKEN\s*=/.test(line));
    if (lines.length === 0) {
      report.finding('.env.example does not list FOOTBALL_DATA_API_TOKEN');
    } else if (!lines.every((line) => /^\s*(export\s+)?FOOTBALL_DATA_API_TOKEN\s*=\s*(""|'')?\s*$/.test(line))) {
      report.finding('.env.example gives FOOTBALL_DATA_API_TOKEN a non-empty value');
    } else {
      report.info('.env.example lists FOOTBALL_DATA_API_TOKEN with an empty value');
    }
  }
  return report.finish();
}

// ---------------------------------------------------------------------------------------------------------------
// marker-scan (R-263, T11H-F02, T11H-F04)
// ---------------------------------------------------------------------------------------------------------------

function markerScan(args) {
  const report = new Report('marker-scan');
  const requireToken = args.includes('--require-token');
  const paths = args.filter((arg) => arg !== '--require-token');
  const token = process.env[TOKEN_VARIABLE];
  const tokenSet = typeof token === 'string' && token !== '';
  report.info(
    `looks for: the synthetic marker token, the marker client value${tokenSet ? ` and the value of ${TOKEN_VARIABLE}` : ''}`,
  );
  if (requireToken && !tokenSet) {
    report.info(`${TOKEN_VARIABLE} is absent or empty and --require-token was given; nothing scanned`);
    report.line('files scanned: 0');
    report.line('real token checked: no');
    report.finding(`--require-token: ${TOKEN_VARIABLE} is absent or empty`);
    return report.finish();
  }
  if (paths.length === 0 || paths.some((path) => path.startsWith('--'))) {
    report.line('files scanned: 0');
    report.line(`real token checked: ${tokenSet ? 'yes' : 'no'}`);
    report.finding('usage: marker-scan [--require-token] <paths...>');
    return report.finish();
  }
  const needles = [
    { label: 'synthetic marker token', value: Buffer.from(MARKER_TOKEN, 'utf8') },
    { label: 'marker client value', value: Buffer.from(MARKER_CLIENT, 'utf8') },
  ];
  if (tokenSet) {
    needles.push({ label: `${TOKEN_VARIABLE} value`, value: Buffer.from(token, 'utf8') });
  }
  let scanned = 0;
  for (const root of paths) {
    for (const entry of walk(resolve(root))) {
      const shown = printablePath(relative(process.cwd(), entry.path) || entry.path);
      if (entry.missing === true) {
        report.finding(`path does not exist: ${printablePath(root)}`);
        continue;
      }
      if (entry.unreadable === true) {
        report.finding(`directory cannot be read: ${shown}`);
        continue;
      }
      const read = readForScan(entry.path);
      if (read.skip !== undefined) {
        report.info(`skipped (${read.skip}): ${shown}`);
        continue;
      }
      if (read.error !== undefined) {
        report.finding(`file ${read.error}: ${shown}`);
        continue;
      }
      scanned += 1;
      for (const { label, value } of needles) {
        if (read.buffer.includes(value)) {
          report.finding(`${label} found in ${shown}`);
        }
      }
    }
  }
  report.line(`files scanned: ${String(scanned)}`);
  report.line(`real token checked: ${tokenSet ? 'yes' : 'no'}`);
  return report.finish();
}

// ---------------------------------------------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------------------------------------------

const SUBCOMMANDS = Object.freeze({
  'secret-scan': () => secretScan(),
  'bundle-secrets': (args) => bundleSecrets(args),
  lockfile: () => lockfile(),
  'audit-report': (args) => auditReport(args),
  hygiene: () => hygiene(),
  'marker-scan': (args) => markerScan(args),
});

export function run(argv) {
  const [name, ...args] = argv;
  const subcommand = name === undefined ? undefined : SUBCOMMANDS[name];
  if (subcommand === undefined || !Object.hasOwn(SUBCOMMANDS, name)) {
    process.stdout.write(`usage: node scripts/security-checks.mjs <${Object.keys(SUBCOMMANDS).join('|')}> [options]\n`);
    process.stdout.write('RESULT: FAIL\n');
    return 1;
  }
  try {
    return subcommand(args);
  } catch (error) {
    // Never print the error message or stack: it could quote file content.
    const type = error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'Error';
    process.stdout.write(`${name}: FINDING the check stopped with an unexpected ${type}\n`);
    process.stdout.write('RESULT: FAIL\n');
    return 1;
  }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exitCode = run(process.argv.slice(2));
}
