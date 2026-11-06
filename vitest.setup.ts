/**
 * Shared Vitest setup of the default projects (unit, unit-web, integration, contract). It is not used by the
 * optional `live` project.
 *
 * 1. Removes provider credentials and the live-test switch from the environment, so that the default suite never
 *    sees a real token and never enables live tests (R-257, AD-30).
 * 2. Installs a network guard at socket level (R-241, R-225, T10-F08): `net.Socket.prototype.connect`, `net.connect`,
 *    `net.createConnection` and the undici global dispatcher used by `fetch`. Any connection to a non-loopback
 *    address is refused and recorded, and the test that made it fails in `afterEach`, even when the calling code
 *    swallows the connection error.
 * 3. Exports the synthetic credential values that tests use (T10-F11, AD-30), so that secret scans can look for them.
 */
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

import { afterEach } from 'vitest';

/** Recognizable dummy API key for tests that need a key (for example the AI adapter). Never a real credential. */
export const TEST_DUMMY_API_KEY = 'edr-test-dummy-key-0000';

/** Synthetic marker token used in place of a provider token in tests; scans search outputs for it. */
export const TEST_MARKER_TOKEN = 'edr-test-marker-token-0000';

/** Variables removed from `process.env` before any test module is loaded. */
export const SCRUBBED_ENV_VARIABLES = [
  'FOOTBALL_DATA_API_TOKEN',
  'EDR_LIVE_TESTS',
  'EDR_AI_API_KEY',
  'EDR_IMAGE_API_KEY',
] as const;

for (const name of SCRUBBED_ENV_VARIABLES) {
  delete process.env[name];
}

/** Error code of a connection refused by the guard. */
export const NETWORK_GUARD_ERROR_CODE = 'ERR_EDR_NETWORK_GUARD';

interface GuardState {
  installed: boolean;
  violations: string[];
}

const STATE_KEY = Symbol.for('edr.test.networkGuard');
const UNDICI_DISPATCHER_KEY = Symbol.for('undici.globalDispatcher.1');

const globalSlots = globalThis as unknown as Record<symbol, unknown>;
const state: GuardState = (globalSlots[STATE_KEY] as GuardState | undefined) ?? { installed: false, violations: [] };
globalSlots[STATE_KEY] = state;

/** Returns and clears the recorded blocked connection attempts (for tests that trigger one on purpose). */
export function takeNetworkViolations(): string[] {
  return state.violations.splice(0);
}

const loopback = new net.BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

/** True when the host is a loopback address or `localhost`; an absent host means Node's default, `localhost`. */
export function isLoopbackHost(host: unknown): boolean {
  if (host === undefined || host === null || host === '') {
    return true;
  }
  if (typeof host !== 'string') {
    return false;
  }
  let name = host.trim().toLowerCase();
  if (name.startsWith('[') && name.endsWith(']')) {
    name = name.slice(1, -1);
  }
  if (name === 'localhost') {
    return true;
  }
  if (name.startsWith('::ffff:') && net.isIPv4(name.slice(7))) {
    name = name.slice(7);
  }
  if (net.isIPv4(name)) {
    return loopback.check(name, 'ipv4');
  }
  if (net.isIPv6(name)) {
    return loopback.check(name, 'ipv6');
  }
  return false;
}

interface Target {
  host: unknown;
  port: unknown;
}

function isPortLike(value: unknown): boolean {
  return typeof value === 'number' || (typeof value === 'string' && value !== '' && Number.isFinite(Number(value)));
}

/** Extracts the TCP target of a connect call, or null for a local IPC path (always allowed). */
function describeTarget(args: readonly unknown[]): Target | null {
  let first = args[0];
  if (Array.isArray(first)) {
    // Arguments already normalized by net.connect: [options, callback].
    first = (first as unknown[])[0];
  }
  if (isPortLike(first)) {
    return { host: typeof args[1] === 'string' ? args[1] : undefined, port: first };
  }
  if (typeof first === 'string') {
    return null;
  }
  if (typeof first === 'object' && first !== null) {
    const options = first as { path?: unknown; host?: unknown; port?: unknown };
    if (typeof options.path === 'string' && options.path !== '') {
      return null;
    }
    return { host: options.host, port: options.port };
  }
  return { host: undefined, port: undefined };
}

function label(target: Target): string {
  const host = typeof target.host === 'string' ? target.host : String(target.host);
  return `${host}:${String(target.port)}`;
}

function guardError(where: string): Error & { code: string } {
  const error = new Error(
    `Network guard: connection to ${where} refused; tests may only connect to loopback addresses`,
  ) as Error & { code: string };
  error.code = NETWORK_GUARD_ERROR_CODE;
  return error;
}

function refuse(socket: net.Socket, target: Target): net.Socket {
  const where = label(target);
  state.violations.push(where);
  process.nextTick(() => socket.destroy(guardError(where)));
  return socket;
}

function installNetworkGuard(): void {
  if (state.installed) {
    return;
  }
  state.installed = true;

  // The original method is re-applied below with its receiver.
  const originalSocketConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedSocketConnect(this: net.Socket, ...args: unknown[]): net.Socket {
    const target = describeTarget(args);
    if (target !== null && !isLoopbackHost(target.host)) {
      return refuse(this, target);
    }
    return Reflect.apply(originalSocketConnect, this, args) as net.Socket;
  } as typeof net.Socket.prototype.connect;

  const wrapFactory = (original: typeof net.connect): typeof net.connect =>
    function guardedConnect(...args: unknown[]): net.Socket {
      const target = describeTarget(args);
      if (target !== null && !isLoopbackHost(target.host)) {
        return refuse(new net.Socket(), target);
      }
      return Reflect.apply(original, net, args) as net.Socket;
    } as typeof net.connect;
  net.connect = wrapFactory(net.connect);
  net.createConnection = wrapFactory(net.createConnection);
  syncBuiltinESMExports();

  // Node's bundled undici (used by fetch) creates its global dispatcher when the module is first loaded.
  void globalThis.Headers;
  const originalDispatcher = globalSlots[UNDICI_DISPATCHER_KEY];
  if (typeof originalDispatcher === 'object' && originalDispatcher !== null) {
    const target = originalDispatcher as Record<PropertyKey, unknown> & {
      dispatch(options: { origin?: unknown }, handler: unknown): boolean;
    };
    globalSlots[UNDICI_DISPATCHER_KEY] = new Proxy(target, {
      get(dispatcher, property) {
        if (property === 'dispatch') {
          return (options: { origin?: unknown }, handler: unknown): boolean => {
            const origin = options.origin === undefined ? '' : String(options.origin as string | URL);
            let host: string;
            try {
              host = new URL(origin).hostname;
            } catch {
              host = origin;
            }
            if (!isLoopbackHost(host)) {
              const where = origin === '' ? '(unknown origin)' : origin;
              state.violations.push(where);
              throw guardError(where);
            }
            return dispatcher.dispatch(options, handler);
          };
        }
        const value = Reflect.get(dispatcher, property, dispatcher);
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(dispatcher) : value;
      },
    });
  }
}

installNetworkGuard();

afterEach(() => {
  const violations = takeNetworkViolations();
  if (violations.length > 0) {
    throw new Error(`Network guard: non-loopback connection attempted: ${violations.join(', ')}`);
  }
});
