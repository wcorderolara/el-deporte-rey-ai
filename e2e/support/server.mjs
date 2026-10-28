// Process helpers of the end-to-end harness: start the built server entry, wait for its health route, stop it, and
// check or find a free loopback port. Used by e2e/run.mjs (the server of a whole suite) and by journeys that restart
// their own server on one data directory with other DEMO_DATA scenarios (e2e/support/scenario-server.ts).
//
// The server always runs as `node apps/server/dist/src/main.js` (the built process entry, no test seam), without
// `--env-file`, with an environment the caller has already filtered (childEnvironment in e2e/support/harness.mjs).
// No process other than the one started here is ever signalled.
import { spawn } from 'node:child_process';
import net from 'node:net';

import { LOOPBACK_HOST, buildOutput } from './harness.mjs';

/** Time allowed for the health route to answer after the process starts. */
export const STARTUP_TIMEOUT_MS = 30_000;
/** Time allowed after SIGTERM before SIGKILL. */
export const STOP_TIMEOUT_MS = 10_000;
/** Server log lines kept for a failure report. */
export const SERVER_LOG_LINES = 200;

/** Resolves when `port` can be bound on the loopback address; rejects naming the port otherwise. */
export function assertPortFree(port) {
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

/** A loopback port the operating system reports free at the time of the call. */
export function freeLoopbackPort() {
  return new Promise((done, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, LOOPBACK_HOST, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => (port > 0 ? done(port) : reject(new Error('No free loopback port was reported.'))));
    });
  });
}

/** Starts the built server entry of `rootDir` with `env`; keeps its last log lines. */
export function startServer(rootDir, env) {
  const { serverEntry } = buildOutput(rootDir);
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', serverEntry], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

/** Resolves when `${baseUrl}/api/v1/health` answers 200; rejects when the process exits or the time runs out. */
export async function waitForHealth(baseUrl, server) {
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

/** Stops a server started by `startServer` (SIGTERM, then SIGKILL after `STOP_TIMEOUT_MS`). */
export async function stopServer(server) {
  if (server.child.exitCode !== null || server.child.signalCode !== null) {
    return;
  }
  server.child.kill('SIGTERM');
  const timer = setTimeout(() => server.child.kill('SIGKILL'), STOP_TIMEOUT_MS);
  await server.exited;
  clearTimeout(timer);
}
