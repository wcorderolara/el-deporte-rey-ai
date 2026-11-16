// End-to-end and accessibility runner (architecture-delta.md section 7.1; architecture.md section 12).
//
// Used by `npm run test:e2e` (`--grep-invert @a11y`) and `npm run test:a11y` (`--grep @a11y`), after the build. It
// 1. installs Chromium (Chrome for Testing, run in new headless mode) on first use into `.cache/ms-playwright` under
//    the project (never host-wide; the first run needs network access to the browser download host, which is tooling
//    access). The headless shell is not used: axe's color-contrast rule never completes in it (Playwright 1.64);
// 2. writes a configuration with the DEMO_DATA fixture sources, the MANUAL_DATA import source, the locally managed
//    competitions source and the stub AI adapter (e2e/support/harness.mjs), bound to 127.0.0.1 on the verification
//    port (4310, or `E2E_PORT`), into a temporary directory outside the repository, with a temporary data directory;
// 3. starts the built server on that configuration and waits for its health route;
// 4. runs Playwright with the remaining arguments (e2e/playwright.config.ts);
// 5. stops the server and removes the temporary directory, whatever the outcome.
// No `EDR_*` variable other than the generated configuration variables, no `FOOTBALL_DATA_API_TOKEN`, no
// `EDR_LIVE_TESTS` and nothing that looks like a credential is forwarded to the server, Playwright or the browser; the
// server is started without `--env-file`, so `.env.local` is never read (T10-F11, AD-30, R-257, R-258).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BROWSERS_DIRECTORY,
  LOOPBACK_HOST,
  VERIFICATION_PORT,
  buildOutput,
  childEnvironment,
  prepareRunDirectory,
} from './support/harness.mjs';
import { SERVER_LOG_LINES, assertPortFree, startServer, stopServer, waitForHealth } from './support/server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYWRIGHT_CLI = resolve(ROOT, 'node_modules/@playwright/test/cli.js');

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
    log('Starting the built server entry (apps/server/dist/src/main.js).');
    server = startServer(ROOT, childEnvironment(process.env, runDir.serverVariables));
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
