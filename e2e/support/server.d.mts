// Type declarations of e2e/support/server.mjs for the TypeScript journeys.
import type { ChildProcess } from 'node:child_process';

export declare const STARTUP_TIMEOUT_MS: number;
export declare const STOP_TIMEOUT_MS: number;
export declare const SERVER_LOG_LINES: number;

export interface ServerProcess {
  readonly child: ChildProcess;
  readonly lines: string[];
  readonly exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export declare function assertPortFree(port: number): Promise<void>;
export declare function freeLoopbackPort(): Promise<number>;
export declare function startServer(rootDir: string, env: Readonly<Record<string, string>>): ServerProcess;
export declare function waitForHealth(baseUrl: string, server: ServerProcess): Promise<void>;
export declare function stopServer(server: ServerProcess): Promise<void>;
