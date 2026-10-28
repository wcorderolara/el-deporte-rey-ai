/**
 * A journey-owned server for steps that need another DEMO_DATA scenario than the suite server (R-203: a simulated
 * source failure and a restart after the source recovers; R-206: a source missing one match).
 *
 * The fixture prepares its own temporary run directory (configuration and data directory outside the repository,
 * removed afterwards) on a loopback port the operating system reports free, and starts the built server entry with a
 * filtered environment, exactly as e2e/run.mjs does. `restart(scenarios)` stops the server, rewrites the
 * configuration with other scenario overrides and starts it again on the same port and data directory, which is how
 * an operator's source recovers between two runs. The test's `baseURL` (and so the request guard) is this server's
 * address; the suite server is not used by such a test.
 */
import { resolve } from 'node:path';

import { childEnvironment, prepareRunDirectory, type RunDirectory, type ScenarioOverrides } from './harness.mjs';
import { freeLoopbackPort, startServer, stopServer, waitForHealth, type ServerProcess } from './server.mjs';
import { test as base } from './test.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');

export interface ScenarioServer {
  /** Address of the server (`http://127.0.0.1:<port>`). */
  readonly baseURL: string;
  /** Starts the server with `scenarios` (stopping a running one first, same port and data directory). */
  restart(scenarios: ScenarioOverrides): Promise<void>;
  /** Stops the server (it is also stopped when the test ends). */
  stop(): Promise<void>;
}

class JourneyServer implements ScenarioServer {
  readonly baseURL: string;
  readonly #runDir: RunDirectory;
  #process: ServerProcess | null = null;

  constructor(port: number, runDir: RunDirectory) {
    this.baseURL = `http://127.0.0.1:${String(port)}`;
    this.#runDir = runDir;
  }

  async restart(scenarios: ScenarioOverrides): Promise<void> {
    await this.stop();
    this.#runDir.configure(scenarios);
    const started = startServer(PROJECT_ROOT, childEnvironment(process.env, this.#runDir.serverVariables));
    this.#process = started;
    try {
      await waitForHealth(this.baseURL, started);
    } catch (error) {
      await this.stop();
      const log = started.lines.slice(-20).join('\n');
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nLast server log lines:\n${log}`, {
        cause: error,
      });
    }
  }

  async stop(): Promise<void> {
    if (this.#process !== null) {
      const running = this.#process;
      this.#process = null;
      await stopServer(running);
    }
  }

  remove(): void {
    this.#runDir.remove();
  }
}

export const test = base.extend<{ scenarioServer: ScenarioServer }>({
  // Playwright fixtures declare their dependencies by destructuring; this fixture has none.
  // eslint-disable-next-line no-empty-pattern
  scenarioServer: async ({}, use) => {
    const port = await freeLoopbackPort();
    const server = new JourneyServer(port, prepareRunDirectory(PROJECT_ROOT, port));
    try {
      await use(server);
    } finally {
      await server.stop();
      server.remove();
    }
  },
  baseURL: async ({ scenarioServer }, use) => {
    await use(scenarioServer.baseURL);
  },
});

export { expect } from './test.js';
