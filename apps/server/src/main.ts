import { buildApp } from './app.js';
import { createContainer } from './container.js';

/** The server listens on the loopback interface only (PD-05, SC-02). */
const HOST = '127.0.0.1';
const DEFAULT_PORT = 4300;

/** Reads `EDR_PORT`; errors name the variable, never its value. */
function readPort(env: NodeJS.ProcessEnv): number {
  const raw = env['EDR_PORT'];
  if (raw === undefined || raw === '') {
    return DEFAULT_PORT;
  }
  const port = /^[0-9]{1,5}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('EDR_PORT must be an integer from 1 to 65535');
  }
  return port;
}

/**
 * Process entry. Skeleton created by T15; T19 adds configuration loading, the data directory, the database and
 * migrations, the source registry startup validation and the module `onStartup` hooks before listening.
 */
async function main(): Promise<void> {
  const port = readPort(process.env);
  const app = await buildApp(createContainer());

  const shutdown = (): void => {
    void app.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await app.listen({ host: HOST, port });
  process.stdout.write(`El Deporte Rey server listening on http://${HOST}:${port}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`Startup failed: ${message}\n`);
  process.exitCode = 1;
});
