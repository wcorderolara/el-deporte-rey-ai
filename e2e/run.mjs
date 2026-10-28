// End-to-end and accessibility runner (architecture-delta.md section 7.1; architecture.md section 12).
//
// Used by `npm run test:e2e` (`--grep-invert @a11y`) and `npm run test:a11y` (`--grep @a11y`), after the build. It
// 1. installs Chromium (Chrome for Testing, run in new headless mode) on first use into `.cache/ms-playwright` under
//    the project (never host-wide; the first run needs network access to the browser download host, which is tooling
//    access). The headless shell is not used: axe's color-contrast rule never completes in it (Playwright 1.64);
// 2. writes a configuration with the DEMO_DATA fixture sources and the stub AI adapter (MANUAL_DATA is added after
//    T50, see e2e/support/harness.mjs), bound to 127.0.0.1 on the verification port (4310, or `E2E_PORT`), into a
//    temporary directory outside the repository, with a temporary data directory;
// 3. starts the built server on that configuration and waits for its health route;
// 4. runs Playwright with the remaining arguments (e2e/playwright.config.ts);
// 5. stops the server and removes the temporary directory, whatever the outcome.
// No `EDR_*` variable other than the generated configuration variables, no `FOOTBALL_DATA_API_TOKEN`, no
// `EDR_LIVE_TESTS` and nothing that looks like a credential is forwarded to the server, Playwright or the browser; the
// server is started without `--env-file`, so `.env.local` is never read (T10-F11, AD-30, R-257, R-258).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BROWSERS_DIRECTORY,
  LOOPBACK_HOST,
  VERIFICATION_PORT,
  buildOutput,
  childEnvironment,
  prepareRunDirectory,
  sportsProviderIsStub,
} from './support/harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYWRIGHT_CLI = resolve(ROOT, 'node_modules/@playwright/test/cli.js');
const SEAM_SERVER = resolve(ROOT, 'e2e/support/seam-server.mjs');
const STARTUP_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;
const SERVER_LOG_LINES = 200;

function log(message) {
  process.stdout.write(`[e2e] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[e2e] ERROR: ${message}\n`);
}

function readPort() {
  const text = process.env.E2E_PORT;
  if (text === undefined || text === '') {
    return VERIFICATION_PORT;
  }
  const port = /^[0-9]{1,5}$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('E2E_PORT must be an integer from 1024 to 65535.');
  }
  return port;
}

/** Resolves when `port` can be bound on the loopback address; rejects naming the port otherwise. */
function assertPortFree(port) {
  return new Promise((done, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      reject(
        new Error(
          `Port ${String(port)} on ${LOOPBACK_HOST} is not available (${error.code ?? 'error'}). Identify the process ` +
            `(lsof -nP -iTCP:${String(port)} -sTCP:LISTEN); stop it only if it is this project's own server, or ` +
            'set E2E_PORT to a spare port.',
        ),
      );
    });
    probe.listen(port, LOOPBACK_HOST, () => probe.close(() => done()));
  });
}

function installChromium(env) {
  log(`Ensuring Chromium in ${BROWSERS_DIRECTORY} (downloaded on first use only).`);
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'install', '--no-shell', '--no-progress', 'chromium'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(
      'Chromium could not be installed into the project-local cache; the first run needs network access to the ' +
        'browser download host (tooling access).',
    );
  }
}

function startServer(env, useSeam) {
  const { serverEntry } = buildOutput(ROOT);
  const args = useSeam
    ? ['--disable-warning=ExperimentalWarning', SEAM_SERVER, ROOT]
    : ['--disable-warning=ExperimentalWarning', serverEntry];
  const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const lines = [];
  const keep = (chunk) => {
    for (const line of chunk.toString('utf8').split('\n')) {
      if (line.trim() !== '') {
        lines.push(line);
        if (lines.length > SERVER_LOG_LINES) {
          lines.shift();
        }
      }
    }
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const exited = new Promise((done) => child.once('exit', (code, signal) => done({ code, signal })));
  return { child, lines, exited };
}

async function waitForHealth(baseUrl, server) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let stopped = null;
  void server.exited.then((status) => {
    stopped = status;
  });
  while (Date.now() < deadline) {
    if (stopped !== null) {
      throw new Error(`The server exited during startup (exit code ${String(stopped.code)}).`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // not listening yet
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`The server did not answer its health route within ${String(STARTUP_TIMEOUT_MS / 1000)} s.`);
}

async function stopServer(server) {
  if (server.child.exitCode !== null || server.child.signalCode !== null) {
    return;
  }
  server.child.kill('SIGTERM');
  const timer = setTimeout(() => server.child.kill('SIGKILL'), STOP_TIMEOUT_MS);
  await server.exited;
  clearTimeout(timer);
}

function runPlaywright(env, args) {
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', '--config', resolve(ROOT, 'e2e/playwright.config.ts'), ...args],
      {
        cwd: ROOT,
        env,
        stdio: 'inherit',
      },
    );
    child.once('exit', (code, signal) => done(code ?? (signal === null ? 1 : 128)));
  });
}

async function run() {
  const { serverEntry, webIndex } = buildOutput(ROOT);
  if (!existsSync(serverEntry) || !existsSync(webIndex)) {
    throw new Error('The build output is missing; run `npm run build` first (the npm scripts do).');
  }
  const port = readPort();
  const baseUrl = `http://${LOOPBACK_HOST}:${String(port)}`;
  const browsersPath = resolve(ROOT, BROWSERS_DIRECTORY);
  const toolEnv = childEnvironment(process.env, { PLAYWRIGHT_BROWSERS_PATH: browsersPath });

  installChromium(toolEnv);
  await assertPortFree(port);

  const runDir = prepareRunDirectory(ROOT, port);
  let server = null;
  const cleanup = async () => {
    if (server !== null) {
      await stopServer(server);
      server = null;
    }
    runDir.remove();
  };
  const onSignal = (signal) => {
    void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    log(
      `Configuration generated from ${runDir.source} in a temporary directory: sources ` +
        `${runDir.sourceIds.join(', ')}, stub AI provider.`,
    );
    const useSeam = sportsProviderIsStub(ROOT);
    if (useSeam) {
      log(
        'NOTICE: the built sports-data provider is still the T15 stub (T21 pending), so the server entry cannot start. ' +
          'Starting the same built server through the T19 test seam (e2e/support/seam-server.mjs) with an empty ' +
          'sports-data source registry.',
      );
    } else {
      log('Starting the built server entry (apps/server/dist/src/main.js).');
    }
    server = startServer(childEnvironment(process.env, runDir.serverVariables), useSeam);
    try {
      await waitForHealth(baseUrl, server);
    } catch (error) {
      fail(error.message);
      for (const line of server.lines) {
        process.stderr.write(`[server] ${line}\n`);
      }
      return 1;
    }
    log(`Server listening on ${baseUrl}.`);

    const code = await runPlaywright(
      childEnvironment(process.env, {
        PLAYWRIGHT_BROWSERS_PATH: browsersPath,
        E2E_BASE_URL: baseUrl,
        E2E_SERVER_MODE: useSeam ? 'seam' : 'entry',
      }),
      process.argv.slice(2),
    );
    if (code !== 0) {
      log(`Last server log lines (at most ${String(SERVER_LOG_LINES)}):`);
      for (const line of server.lines) {
        process.stdout.write(`[server] ${line}\n`);
      }
    }
    return code;
  } finally {
    await cleanup();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    log('Server stopped and temporary directory removed.');
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
