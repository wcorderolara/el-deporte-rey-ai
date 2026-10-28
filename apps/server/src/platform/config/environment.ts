/**
 * Environment variables read by the configuration (architecture.md section 5.1): `EDR_CONFIG`, `EDR_DATA_DIR` and
 * `EDR_PORT`, and nothing else. The configuration never reads a secret: adapters read their own credentials from the
 * injected environment (AD-30, SC-06). Errors name the variable, never its value (OD-20).
 */
import { ConfigError } from './errors.js';

/** The only environment variables this module reads. */
export const CONFIG_ENVIRONMENT_VARIABLES = ['EDR_CONFIG', 'EDR_DATA_DIR', 'EDR_PORT'] as const;

/** An environment as a read-only lookup (for example `process.env`). */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface ConfigEnvironment {
  /** `EDR_CONFIG`: the application configuration file, relative to the project root or absolute. */
  readonly configFile: string | null;
  /** `EDR_DATA_DIR`: the data directory, relative to the project root or absolute. */
  readonly dataDir: string | null;
  /** `EDR_PORT`: the listening port. */
  readonly port: number | null;
}

function read(env: EnvironmentSource, name: (typeof CONFIG_ENVIRONMENT_VARIABLES)[number]): string | null {
  const value = env[name];
  return value === undefined || value === '' ? null : value;
}

function checkPath(name: string, value: string | null): string | null {
  if (value !== null && (value.length > 1024 || /[\p{Cc}]/u.test(value))) {
    throw new ConfigError(name, 'must be a file system path of at most 1024 printable characters');
  }
  return value;
}

/** Reads `EDR_CONFIG`, `EDR_DATA_DIR` and `EDR_PORT`; empty values count as unset. */
export function readConfigEnvironment(env: EnvironmentSource): ConfigEnvironment {
  const portText = read(env, 'EDR_PORT');
  let port: number | null = null;
  if (portText !== null) {
    port = /^[0-9]{1,5}$/.test(portText) ? Number(portText) : Number.NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ConfigError('EDR_PORT', 'must be an integer from 1 to 65535');
    }
  }
  return Object.freeze({
    configFile: checkPath('EDR_CONFIG', read(env, 'EDR_CONFIG')),
    dataDir: checkPath('EDR_DATA_DIR', read(env, 'EDR_DATA_DIR')),
    port,
  });
}
