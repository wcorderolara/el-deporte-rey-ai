/**
 * Positive-control tests of scripts/security-checks.mjs (T10-A1-02, T10-A1-03, T11H-F02, V-34): every check runs in
 * a temporary git repository or directory with a planted violation and must exit 1, and on a clean one must exit 0.
 * All planted values are synthetic and built at run time, so this file holds no credential-shaped literal.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./security-checks.mjs', import.meta.url));
const TOKEN_VARIABLE = 'FOOTBALL_DATA_' + 'API_TOKEN';

/** Synthetic values, assembled here so that the repository scan of this file finds nothing. */
const MARKER_TOKEN = ['edr', 'test', 'marker', 'token', '0000'].join('-');
const MARKER_CLIENT = ['edr', 'test', 'client', 'marker', '0000'].join('-');
const DUMMY_KEY = ['edr', 'test', 'dummy', 'key', '0000'].join('-');
/** A planted "real" token value (synthetic, 32 characters like a provider token). */
const PLANTED_TOKEN = ['f00d', 'cafe', 'beef', '0042'].join('').repeat(2);

/** Environment of child processes: no token, and git without global or system configuration. */
function baseEnv(extra = {}) {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...extra };
  if (!Object.hasOwn(extra, TOKEN_VARIABLE)) {
    delete env[TOKEN_VARIABLE];
  }
  return env;
}

const cleanups = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

function temporaryDirectory() {
  const path = mkdtempSync(join(tmpdir(), 'edr-security-checks-'));
  cleanups.push(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

function write(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

function gitIn(root, args) {
  const result = spawnSync('git', args, { cwd: root, env: baseEnv(), encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed in the test repository`);
  }
}

const CLEAN_GITIGNORE = 'node_modules/\n/data\n/.cache\n.env*\n!.env.example\n';
const CLEAN_ENV_EXAMPLE = `# example\n${TOKEN_VARIABLE}=\nEDR_AI_API_KEY=\n`;

/** A clean repository: ignore rules, an empty .env.example and a source file; every file tracked. */
function cleanRepository(files = {}) {
  const root = temporaryDirectory();
  gitIn(root, ['init', '-q', '.']);
  write(root, '.gitignore', CLEAN_GITIGNORE);
  write(root, '.env.example', CLEAN_ENV_EXAMPLE);
  write(root, 'src/app.js', 'export const answer = 42;\n');
  for (const [path, content] of Object.entries(files)) {
    write(root, path, content);
  }
  gitIn(root, ['add', '-A']);
  return root;
}

/** Tracks a file even when it is ignored. */
function forceTrack(root, relativePath, content) {
  write(root, relativePath, content);
  gitIn(root, ['add', '-f', '--', relativePath]);
}

function check(cwd, args, env = baseEnv()) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env, encoding: 'utf8', timeout: 60_000 });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function expectNoValue(output) {
  for (const value of [MARKER_TOKEN, MARKER_CLIENT, DUMMY_KEY, PLANTED_TOKEN]) {
    expect(output).not.toContain(value);
  }
}

describe('secret-scan (R-260, R-261)', () => {
  it('passes on a clean repository and says what it scanned', () => {
    const root = cleanRepository();
    const result = check(root, ['secret-scan']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('tracked files: 3');
    expect(result.output).toMatch(/RESULT: PASS\n$/);
  });

  it.each([
    [
      'the synthetic marker token in a source file',
      'src/config.js',
      `export const t = '${MARKER_TOKEN}';\n`,
      'synthetic marker token',
    ],
    [
      'the marker client value in a source file',
      'src/client.js',
      `const c = "${MARKER_CLIENT}";\n`,
      'marker client value',
    ],
    [
      'the shared dummy key in a configuration file',
      'config/app.json',
      `{"key":"${DUMMY_KEY}"}\n`,
      'shared dummy test key',
    ],
    [
      'a non-empty token assignment',
      'config/run.sh',
      `${TOKEN_VARIABLE}=${PLANTED_TOKEN} npm start\n`,
      `non-empty ${TOKEN_VARIABLE}`,
    ],
    [
      'a non-empty AI key assignment',
      'deploy/env.txt',
      `EDR_AI_API_KEY="${PLANTED_TOKEN}"\n`,
      'non-empty EDR_AI_API_KEY',
    ],
    [
      'a spaced, quoted key assignment',
      'deploy/app.toml',
      `EDR_AI_API_KEY = '${PLANTED_TOKEN}'\n`,
      'non-empty EDR_AI_API_KEY',
    ],
    [
      'a provider-shaped secret key',
      'src/ai.js',
      `const k = '${'sk-' + 'Q'.repeat(40)}';\n`,
      'OpenAI-style secret key',
    ],
    ['a private-key header', 'keys/server.pem', `-----BEGIN ${'RSA PRIVATE'} KEY-----\nAAAA\n`, 'private key header'],
  ])('fails on %s and never prints the value', (_name, path, content, rule) => {
    const root = cleanRepository({ [path]: content });
    const result = check(root, ['secret-scan']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(rule);
    expect(result.output).toContain(path);
    expect(result.output).toMatch(/RESULT: FAIL\n$/);
    expectNoValue(result.output);
    expect(result.output).not.toContain('Q'.repeat(40));
  });

  it('fails on a tracked .env.local', () => {
    const root = cleanRepository();
    forceTrack(root, '.env.local', `${TOKEN_VARIABLE}=\n`);
    const result = check(root, ['secret-scan']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('tracked environment file at .env.local');
  });

  it('allows the synthetic values in test, fixture and docs files, and empty assignments anywhere', () => {
    const root = cleanRepository({
      'src/app.test.ts': `const t = '${MARKER_TOKEN}';\n`,
      'apps/server/test/support/env.ts': `const k = '${DUMMY_KEY}';\n`,
      'fixtures/provider/response.json': `{"client":"${MARKER_CLIENT}"}\n`,
      'docs/setup.md': `Set ${TOKEN_VARIABLE}= in .env.local; grep -c '^${TOKEN_VARIABLE}=..*' .env.local; key ${DUMMY_KEY}\n`,
      'scripts/start.sh': `${TOKEN_VARIABLE}="$TOKEN" node main.js\n`,
      'README.txt': `${TOKEN_VARIABLE}= is required for live data; ${TOKEN_VARIABLE} = <your token>\n`,
    });
    const result = check(root, ['secret-scan']);
    expect(result.status, result.output).toBe(0);
  });

  it('fails outside a git repository (the control cannot be checked)', () => {
    const result = check(temporaryDirectory(), ['secret-scan']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('git ls-files failed');
  });
});

describe('hygiene (T10-A1-02, R-261, R-264, R-265)', () => {
  it('passes on a clean repository and reports each ignored path', () => {
    const root = cleanRepository();
    const result = check(root, ['hygiene']);
    expect(result.status, result.output).toBe(0);
    for (const path of ['.env.local', 'data/', '.cache/']) {
      expect(result.output).toContain(`ignored by a .gitignore rule: ${path}`);
    }
    expect(result.output).toContain('lists FOOTBALL_DATA_API_TOKEN with an empty value');
  });

  it('fails on a tracked .env.local', () => {
    const root = cleanRepository();
    forceTrack(root, '.env.local', `${TOKEN_VARIABLE}=\n`);
    const result = check(root, ['hygiene']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('tracked environment file: .env.local');
  });

  it.each([['data/app.db'], ['.cache/probe-output.log']])('fails on a tracked file %s', (path) => {
    const root = cleanRepository();
    forceTrack(root, path, 'synthetic\n');
    const result = check(root, ['hygiene']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(`tracked file under a local data or cache directory: ${path}`);
  });

  it('fails when data/ is not ignored, even though the other paths are (one check per path)', () => {
    const root = cleanRepository({ '.gitignore': '/.cache\n.env*\n!.env.example\n', 'data/app.db': 'x' });
    const result = check(root, ['hygiene']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('not ignored by a .gitignore rule: data/');
  });

  it('does not accept a negated rule or .git/info/exclude as the ignore control', () => {
    const negated = cleanRepository({ '.gitignore': '/data\n/.cache\n.env*\n!.env.example\n!.env.local\n' });
    const first = check(negated, ['hygiene']);
    expect(first.status, first.output).toBe(1);
    expect(first.output).toContain('not ignored by a .gitignore rule: .env.local');

    const localOnly = cleanRepository({ '.gitignore': '/data\n/.cache\n' });
    write(localOnly, '.git/info/exclude', '.env*\n!.env.example\n');
    const second = check(localOnly, ['hygiene']);
    expect(second.status, second.output).toBe(1);
    expect(second.output).toContain('not ignored by a .gitignore rule: .env.local');
  });

  it('fails when .env.example gives the token a value, omits it or is not tracked', () => {
    const withValue = cleanRepository({ '.env.example': `${TOKEN_VARIABLE}=${PLANTED_TOKEN}\n` });
    const first = check(withValue, ['hygiene']);
    expect(first.status, first.output).toBe(1);
    expect(first.output).toContain('non-empty value');
    expectNoValue(first.output);

    const without = cleanRepository({ '.env.example': 'EDR_AI_API_KEY=\n' });
    const second = check(without, ['hygiene']);
    expect(second.status).toBe(1);
    expect(second.output).toContain('does not list FOOTBALL_DATA_API_TOKEN');

    const untracked = cleanRepository();
    gitIn(untracked, ['rm', '-q', '--cached', '--', '.env.example']);
    const third = check(untracked, ['hygiene']);
    expect(third.status).toBe(1);
    expect(third.output).toContain('.env.example is not tracked');
  });

  it('fails outside a git repository', () => {
    const result = check(temporaryDirectory(), ['hygiene']);
    expect(result.status).toBe(1);
  });
});

describe('marker-scan (R-263, T11H-F02, T11H-F04)', () => {
  function scanDirectory(files) {
    const root = temporaryDirectory();
    for (const [path, content] of Object.entries(files)) {
      write(root, path, content);
    }
    return root;
  }

  it('passes on a clean directory without the variable and says the real token was not checked', () => {
    const root = scanDirectory({ 'a.txt': 'nothing here\n', 'nested/b.log': 'still nothing\n' });
    const result = check(root, ['marker-scan', '.']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('files scanned: 2');
    expect(result.output).toContain('real token checked: no\n');
    expect(result.output).toMatch(/RESULT: PASS\n$/);
  });

  it.each([
    ['the synthetic marker token', MARKER_TOKEN],
    ['the marker client value', MARKER_CLIENT],
  ])('fails on %s in a scanned directory', (label, value) => {
    const root = scanDirectory({ 'out/probe.log': `header x: ${value}\n` });
    const result = check(root, ['marker-scan', 'out']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(`${label.replace(/^the /, '')} found in out/probe.log`);
    expectNoValue(result.output);
  });

  it('fails on a planted real value in a scanned directory when the variable is set, without printing it', () => {
    const root = scanDirectory({
      'research/findings.md': `oops ${PLANTED_TOKEN} leaked\n`,
      'research/ok.md': 'fine\n',
    });
    const result = check(root, ['marker-scan', 'research'], baseEnv({ [TOKEN_VARIABLE]: PLANTED_TOKEN }));
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('real token checked: yes\n');
    expect(result.output).toContain(`${TOKEN_VARIABLE} value found in research/findings.md`);
    expectNoValue(result.output);
  });

  it('fails on a planted real value in a scanned single file path (with --require-token)', () => {
    const root = scanDirectory({ '.cache/probe-output.log': `Error: header ${PLANTED_TOKEN}\n` });
    const result = check(
      root,
      ['marker-scan', '--require-token', '.cache/probe-output.log'],
      baseEnv({ [TOKEN_VARIABLE]: PLANTED_TOKEN }),
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('files scanned: 1');
    expect(result.output).toContain('real token checked: yes\n');
    expectNoValue(result.output);
  });

  it('passes on a clean directory with the variable set and says the real token was checked', () => {
    const root = scanDirectory({ 'research/findings.md': 'no secret\n' });
    const result = check(
      root,
      ['marker-scan', '--require-token', 'research'],
      baseEnv({ [TOKEN_VARIABLE]: PLANTED_TOKEN }),
    );
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('real token checked: yes\n');
    expectNoValue(result.output);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
  ])('with --require-token exits 1 before scanning when the variable is %s', (_name, value) => {
    const root = scanDirectory({ 'research/findings.md': 'no secret\n' });
    const env = value === undefined ? baseEnv() : baseEnv({ [TOKEN_VARIABLE]: value });
    const result = check(root, ['marker-scan', '--require-token', 'research'], env);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('files scanned: 0');
    expect(result.output).toContain('real token checked: no\n');
    expect(result.output).toContain('nothing scanned');
  });

  it('fails on a missing path and without paths', () => {
    const root = scanDirectory({ 'a.txt': 'x' });
    const missing = check(root, ['marker-scan', 'does-not-exist']);
    expect(missing.status).toBe(1);
    expect(missing.output).toContain('path does not exist');
    const none = check(root, ['marker-scan']);
    expect(none.status).toBe(1);
    expect(none.output).toContain('usage');
  });
});

describe('bundle-secrets (R-262)', () => {
  it('passes on clean assets and fails on each planted value', () => {
    const clean = temporaryDirectory();
    write(clean, 'dist/index.html', '<!doctype html><script src="/assets/app.js"></script>');
    write(clean, 'dist/assets/app.js', 'fetch("/api/v1/health");const VITE_MODE="x";');
    const ok = check(clean, ['bundle-secrets', 'dist']);
    expect(ok.status, ok.output).toBe(0);
    expect(ok.output).toContain('files scanned: 2');

    const planted = [
      ['shared dummy test key', `const k="${DUMMY_KEY}"`],
      ['synthetic marker token', `const k="${MARKER_TOKEN}"`],
      ['EDR_ variable assignment', 'const e={EDR_AI_API_KEY:"x"}'],
      ['FOOTBALL_DATA variable name', `const n="${TOKEN_VARIABLE}"`],
      ['provider host', 'fetch("https://api.' + 'football-data' + '.org/v4/competitions")'],
    ];
    for (const [rule, content] of planted) {
      const root = temporaryDirectory();
      write(root, 'dist/assets/app.js', content);
      const result = check(root, ['bundle-secrets', 'dist']);
      expect(result.status, `${rule}: ${result.output}`).toBe(1);
      expect(result.output).toContain(rule);
      expectNoValue(result.output);
    }
  });

  it('fails when the build output does not exist', () => {
    const result = check(temporaryDirectory(), ['bundle-secrets', 'dist']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('does not exist');
  });
});

describe('lockfile (T10-F18)', () => {
  const GOOD = {
    name: 'demo',
    lockfileVersion: 3,
    packages: {
      '': { name: 'demo' },
      'apps/server': { name: '@demo/server' },
      'node_modules/@demo/server': { resolved: 'apps/server', link: true },
      'node_modules/left-pad': {
        version: '1.3.0',
        resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
        integrity: 'sha512-' + 'A'.repeat(86) + '==',
      },
    },
  };

  function lockRepository(lock, npmrc) {
    const root = temporaryDirectory();
    write(root, 'package-lock.json', JSON.stringify(lock));
    if (npmrc !== undefined) {
      write(root, '.npmrc', npmrc);
    }
    return root;
  }

  it('passes on registry URLs with integrity and a plain .npmrc', () => {
    const result = check(lockRepository(GOOD, 'registry=https://registry.npmjs.org/\nsave-exact=true\n'), ['lockfile']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('registry entries checked: 1');
  });

  it('fails on another registry, a missing integrity, an auth token or an alternate registry in .npmrc', () => {
    const otherRegistry = structuredClone(GOOD);
    otherRegistry.packages['node_modules/left-pad'].resolved = 'https://npm.example.invalid/left-pad-1.3.0.tgz';
    expect(check(lockRepository(otherRegistry), ['lockfile']).status).toBe(1);

    const noIntegrity = structuredClone(GOOD);
    delete noIntegrity.packages['node_modules/left-pad'].integrity;
    expect(check(lockRepository(noIntegrity), ['lockfile']).status).toBe(1);

    const authToken = check(lockRepository(GOOD, `//registry.npmjs.org/:_authToken=${PLANTED_TOKEN}\n`), ['lockfile']);
    expect(authToken.status).toBe(1);
    expectNoValue(authToken.output);

    expect(check(lockRepository(GOOD, 'registry=https://npm.example.invalid/\n'), ['lockfile']).status).toBe(1);
    expect(check(lockRepository(GOOD, '@demo:registry=https://npm.example.invalid/\n'), ['lockfile']).status).toBe(1);
    expect(check(temporaryDirectory(), ['lockfile']).status).toBe(1);
  });
});

describe('audit-report (T10-F01, T10-F02, T10-F18)', () => {
  function auditFile(vulnerabilities) {
    const root = temporaryDirectory();
    const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
    write(
      root,
      'audit.json',
      JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } }),
    );
    return root;
  }

  const advisory = (name, severity) => ({
    name,
    severity,
    via: [
      {
        name,
        severity,
        title: `Synthetic ${severity} advisory`,
        url: 'https://github.com/advisories/GHSA-0000-0000-0000',
        range: '<1.0.0',
      },
    ],
    range: '<1.0.0',
  });

  it('lists every advisory and passes on a moderate advisory of an unwatched package', () => {
    const root = auditFile({ 'left-pad': advisory('left-pad', 'moderate') });
    const result = check(root, ['audit-report', '--from-file', 'audit.json']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('advisory: package left-pad; severity moderate');
  });

  it('passes on an empty report', () => {
    const result = check(auditFile({}), ['audit-report', '--from-file', 'audit.json']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('advisories listed: 0');
  });

  it.each([
    ['a high advisory', { 'left-pad': advisory('left-pad', 'high') }],
    ['a critical advisory', { 'left-pad': advisory('left-pad', 'critical') }],
    ['a low advisory naming vite', { vite: advisory('vite', 'low') }],
    ['a moderate advisory naming fastify', { fastify: advisory('fastify', 'moderate') }],
    [
      'a watched package affected through a dependency',
      { satori: { name: 'satori', severity: 'moderate', via: ['fflate'], range: '>=0.1.0' } },
    ],
  ])('fails on %s', (_name, vulnerabilities) => {
    const result = check(auditFile(vulnerabilities), ['audit-report', '--from-file', 'audit.json']);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toMatch(/RESULT: FAIL\n$/);
  });

  it('fails on an unreadable or malformed report', () => {
    const root = temporaryDirectory();
    write(root, 'bad.json', '{ not json');
    expect(check(root, ['audit-report', '--from-file', 'bad.json']).status).toBe(1);
    expect(check(root, ['audit-report', '--from-file', 'missing.json']).status).toBe(1);
    expect(check(root, ['audit-report', '--from-file']).status).toBe(1);
  });
});

describe('audit-report --accept (OD-50, OD-33)', () => {
  /** The advisory accepted by OD-33, in the shape npm audit reports it (fflate direct, satori through fflate). */
  const OD33_ID = 'GHSA-px8p-9vwx-vf98';
  const OTHER_ID = 'GHSA-2222-3333-4444';
  const THIRD_ID = 'GHSA-5555-6666-7777';

  function auditFile(vulnerabilities) {
    const root = temporaryDirectory();
    write(
      root,
      'audit.json',
      JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities,
        metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
      }),
    );
    return root;
  }

  /** A package with its own advisory `id`. */
  const direct = (name, severity, id) => ({
    name,
    severity,
    via: [
      {
        source: 1,
        name,
        dependency: name,
        title: `Synthetic ${severity} advisory of ${name}`,
        url: `https://github.com/advisories/${id}`,
        severity,
        range: '<1.0.0',
      },
    ],
    range: '<1.0.0',
  });

  /** A package affected only through the named dependencies. */
  const through = (name, severity, via) => ({ name, severity, via, range: '>=0.1.0' });

  const od33Report = () => ({
    fflate: direct('fflate', 'moderate', OD33_ID),
    satori: through('satori', 'moderate', ['fflate']),
  });

  function audit(vulnerabilities, ...accepts) {
    return check(auditFile(vulnerabilities), [
      'audit-report',
      '--from-file',
      'audit.json',
      ...accepts.flatMap((value) => ['--accept', value]),
    ]);
  }

  describe('positive', () => {
    it('accepts the OD-33 advisory, including satori affected through fflate, and passes', () => {
      const result = audit(od33Report(), `${OD33_ID}=OD-33`);
      expect(result.status, result.output).toBe(0);
      expect(result.output).toContain(`audit-report: ACCEPTED ${OD33_ID} by OD-33\n`);
      expect(result.output).toContain(
        `audit-report: advisory: package satori; severity moderate; via fflate; range >=0.1.0; accepted: ${OD33_ID} by OD-33\n`,
      );
      expect(result.output).toContain('advisory: package fflate; severity moderate');
      expect(result.output).not.toContain('FINDING');
      expect(result.output).toContain('audit-report: advisories listed: 2\n');
      expect(result.output).toMatch(/audit-report: findings: 0\nRESULT: PASS\n$/);
    });

    it('accepts a low advisory of a watched package with a Product Owner decision ID', () => {
      const result = audit({ vite: direct('vite', 'low', OTHER_ID) }, `${OTHER_ID}=PD-10`);
      expect(result.status, result.output).toBe(0);
      expect(result.output).toContain(`audit-report: ACCEPTED ${OTHER_ID} by PD-10\n`);
    });

    it('takes --accept repeatedly, one ACCEPTED line per accepted advisory', () => {
      const result = audit(
        { ...od33Report(), fastify: direct('fastify', 'moderate', OTHER_ID) },
        `${OD33_ID}=OD-33`,
        `${OTHER_ID}=OD-7`,
      );
      expect(result.status, result.output).toBe(0);
      expect(result.output).toContain(`audit-report: ACCEPTED ${OD33_ID} by OD-33\n`);
      expect(result.output).toContain(`audit-report: ACCEPTED ${OTHER_ID} by OD-7\n`);
      expect(result.output.match(/ACCEPTED /g)).toHaveLength(2);
    });

    it('follows a dependency chain of several levels to the accepted advisory', () => {
      const result = audit(
        {
          satori: through('satori', 'moderate', ['middle']),
          middle: through('middle', 'moderate', ['fflate']),
          fflate: direct('fflate', 'moderate', OD33_ID),
        },
        `${OD33_ID}=OD-33`,
      );
      expect(result.status, result.output).toBe(0);
      expect(result.output).toContain(`ACCEPTED ${OD33_ID} by OD-33`);
    });
  });

  describe('negative', () => {
    it('accepts nothing by default: the OD-33 report fails and the output is unchanged', () => {
      const result = audit(od33Report());
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain('FINDING advisory: package satori; severity moderate; via fflate');
      expect(result.output).not.toMatch(/accept/i);
      expect(result.output).toMatch(/audit-report: findings: 1\nRESULT: FAIL\n$/);
    });

    it('still fails on an advisory that is not accepted next to one that is', () => {
      const result = audit({ ...od33Report(), fastify: direct('fastify', 'moderate', OTHER_ID) }, `${OD33_ID}=OD-33`);
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain(`ACCEPTED ${OD33_ID} by OD-33`);
      expect(result.output).toContain('FINDING advisory: package fastify; severity moderate');
      expect(result.output).toMatch(/audit-report: findings: 1\nRESULT: FAIL\n$/);
    });

    it.each([['high'], ['critical']])('refuses to accept a %s advisory even when it is listed', (severity) => {
      const watched = audit(
        { fflate: direct('fflate', severity, OD33_ID), satori: through('satori', severity, ['fflate']) },
        `${OD33_ID}=OD-33`,
      );
      expect(watched.status, watched.output).toBe(1);
      expect(watched.output).not.toContain('ACCEPTED');
      expect(watched.output).toContain(
        `FINDING acceptance refused: ${OD33_ID} (OD-33) has severity ${severity}; only moderate or low can be accepted`,
      );
      expect(watched.output).toContain(`FINDING advisory: package fflate; severity ${severity}`);
      expect(watched.output).toContain(`FINDING advisory: package satori; severity ${severity}`);
      expect(watched.output).toMatch(/RESULT: FAIL\n$/);

      const unwatched = audit({ 'left-pad': direct('left-pad', severity, OTHER_ID) }, `${OTHER_ID}=OD-1`);
      expect(unwatched.status, unwatched.output).toBe(1);
      expect(unwatched.output).not.toContain('ACCEPTED');
      expect(unwatched.output).toContain(`FINDING advisory: package left-pad; severity ${severity}`);
    });

    it('refuses an acceptance when one occurrence of the advisory is high, even if another is moderate', () => {
      const result = audit(
        {
          fflate: direct('fflate', 'moderate', OD33_ID),
          zlibish: direct('zlibish', 'high', OD33_ID),
          satori: through('satori', 'moderate', ['fflate']),
        },
        `${OD33_ID}=OD-33`,
      );
      expect(result.status, result.output).toBe(1);
      expect(result.output).not.toContain('ACCEPTED');
      expect(result.output).toContain('acceptance refused');
      expect(result.output).toContain('FINDING advisory: package satori');
    });

    it('fails when a watched package rests on an accepted and an unaccepted advisory', () => {
      const result = audit(
        {
          fflate: direct('fflate', 'moderate', OD33_ID),
          other: direct('other', 'low', THIRD_ID),
          satori: through('satori', 'moderate', ['fflate', 'other']),
        },
        `${OD33_ID}=OD-33`,
      );
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain(`ACCEPTED ${OD33_ID} by OD-33`);
      expect(result.output).toContain('FINDING advisory: package satori; severity moderate; via fflate, other');
    });

    it('fails when the dependency chain of a watched package cannot be resolved to advisory IDs', () => {
      const missingLink = audit(
        { fflate: direct('fflate', 'moderate', OD33_ID), satori: through('satori', 'moderate', ['fflate', 'ghost']) },
        `${OD33_ID}=OD-33`,
      );
      expect(missingLink.status, missingLink.output).toBe(1);
      expect(missingLink.output).toContain('FINDING advisory: package satori');

      const noGhsaUrl = direct('fflate', 'moderate', OD33_ID);
      noGhsaUrl.via.push({ ...noGhsaUrl.via[0], url: 'https://www.npmjs.com/advisories/1164783' });
      const unknownId = audit(
        { fflate: noGhsaUrl, satori: through('satori', 'moderate', ['fflate']) },
        `${OD33_ID}=OD-33`,
      );
      expect(unknownId.status, unknownId.output).toBe(1);
      expect(unknownId.output).toContain('FINDING advisory: package satori');
    });

    it('fails on a stale acceptance naming an advisory absent from the report', () => {
      const empty = audit({}, `${OD33_ID}=OD-33`);
      expect(empty.status, empty.output).toBe(1);
      expect(empty.output).toContain(`FINDING stale acceptance: ${OD33_ID} (OD-33) names no advisory in the report`);
      expect(empty.output).not.toContain('ACCEPTED');

      const extra = audit(od33Report(), `${OD33_ID}=OD-33`, `${OTHER_ID}=OD-2`);
      expect(extra.status, extra.output).toBe(1);
      expect(extra.output).toContain(`ACCEPTED ${OD33_ID} by OD-33`);
      expect(extra.output).toContain(`FINDING stale acceptance: ${OTHER_ID} (OD-2)`);
      expect(extra.output).toMatch(/audit-report: findings: 1\nRESULT: FAIL\n$/);
    });

    it.each([
      ['no decision ID', OD33_ID],
      ['an empty decision ID', `${OD33_ID}=`],
      ['no advisory ID', '=OD-33'],
      ['a decision ID without a number', `${OD33_ID}=OD-`],
      ['a decision ID of another kind', `${OD33_ID}=AD-02`],
      ['a lower-case decision ID', `${OD33_ID}=od-33`],
      ['a decision ID with trailing text', `${OD33_ID}=OD-33 `],
      ['two decision IDs', `${OD33_ID}=OD-33=OD-34`],
      ['a lower-case advisory prefix', 'ghsa-px8p-9vwx-vf98=OD-33'],
      ['a truncated advisory ID', 'GHSA-px8p-9vwx=OD-33'],
      ['a CVE instead of a GHSA ID', 'CVE-2026-0001=OD-33'],
      ['an empty value', ''],
    ])('fails on a malformed --accept value with %s, before reading the report', (_name, value) => {
      const result = audit(od33Report(), value);
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain('FINDING malformed --accept value');
      expect(result.output).not.toContain('ACCEPTED');
      expect(result.output).not.toContain('advisory: package');
      expect(result.output).toMatch(/RESULT: FAIL\n$/);
    });

    it('fails when a valid --accept is combined with a malformed one', () => {
      const result = audit(od33Report(), `${OD33_ID}=OD-33`, `${OTHER_ID}=`);
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain('FINDING malformed --accept value');
      expect(result.output).not.toContain('ACCEPTED');
    });

    it('fails when the same advisory is accepted twice', () => {
      const result = audit(od33Report(), `${OD33_ID}=OD-33`, `${OD33_ID}=OD-34`);
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain(`FINDING --accept given more than once for ${OD33_ID}`);
      expect(result.output).not.toContain('ACCEPTED');
    });

    it.each([
      ['--accept without a value', ['--accept']],
      ['the --accept=value form', [`--accept=${OD33_ID}=OD-33`]],
      ['an unknown option', ['--accept', `${OD33_ID}=OD-33`, '--force']],
      ['--from-file given twice', ['--from-file', 'audit.json']],
    ])('fails with the usage line on %s', (_name, extra) => {
      const root = auditFile(od33Report());
      const result = check(root, ['audit-report', '--from-file', 'audit.json', ...extra]);
      expect(result.status, result.output).toBe(1);
      expect(result.output).toContain('FINDING usage: audit-report');
      expect(result.output).not.toContain('ACCEPTED');
    });
  });
});

describe('command line', () => {
  it('fails on an unknown subcommand', () => {
    const result = check(temporaryDirectory(), ['unknown']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('usage');
  });
});

describe('this repository (R-260, R-261, R-264, R-265, T10-F18)', () => {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));

  it.each([['secret-scan'], ['hygiene'], ['lockfile']])('%s holds on the committed tree', (subcommand) => {
    const result = check(ROOT, [subcommand]);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toMatch(/RESULT: PASS\n$/);
  });
});
