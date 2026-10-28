// Type declarations of e2e/support/harness.mjs for the TypeScript journeys.
export declare const VERIFICATION_PORT: number;
export declare const LOOPBACK_HOST: string;
export declare const BASE_CONFIG_CANDIDATES: readonly string[];
export declare const INCLUDED_MODES: readonly string[];
export declare const AI_PROVIDER: Readonly<{ adapter: string; options: Readonly<{ scenario: string }> }>;
export declare const BROWSERS_DIRECTORY: string;
export declare const BLOCKED_VARIABLES: readonly string[];
export declare const BLOCKED_VARIABLE_PATTERNS: readonly RegExp[];
export declare const SCENARIO_PATTERN: RegExp;

/** Source ID to DEMO_DATA scenario name. */
export type ScenarioOverrides = Readonly<Record<string, string>>;

export interface RunDirectory {
  readonly dir: string;
  readonly source: string;
  readonly sourceIds: readonly string[];
  readonly configFile: string;
  readonly dataDir: string;
  readonly serverVariables: Readonly<Record<string, string>>;
  configure(scenarios?: ScenarioOverrides): unknown;
  remove(): void;
}

export declare function isBlockedVariable(name: string): boolean;
export declare function childEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  extra?: Readonly<Record<string, string>>,
): Record<string, string>;
export declare function baseConfigPath(rootDir: string): string;
export declare function enabledSources(document: unknown): unknown[];
export declare function withScenarios(sources: readonly unknown[], scenarios?: ScenarioOverrides): unknown[];
export declare function serverConfigDocument(base: unknown, port: number, scenarios?: ScenarioOverrides): unknown;
export declare function prepareRunDirectory(rootDir: string, port: number, scenarios?: ScenarioOverrides): RunDirectory;
export declare function buildOutput(rootDir: string): { serverEntry: string; webIndex: string };
