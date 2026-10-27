// @vitest-environment node
/**
 * Development-mode controls of the Vite dev and preview servers (T10-F02, T10-F11, `architecture.md` section 12.1)
 * and loopback binding (R-234).
 */
import { readdirSync } from 'node:fs';

import { isFileLoadingAllowed, resolveConfig, type ProxyOptions, type UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import config, {
  ALLOWED_HOSTS,
  API_PORT,
  DATA_DIR_DENY,
  DEV_PORT,
  LOOPBACK_HOST,
  REPO_ROOT,
  VITE_DEFAULT_FS_DENY,
  WEB_DIR,
} from './vite.config';

const userConfig = config as UserConfig;
const server = userConfig.server ?? {};
const preview = userConfig.preview ?? {};

/** Copies the mutable option arrays, because Vite mutates them while resolving (it appends allowed hosts). */
function copyOf(inline: UserConfig): UserConfig {
  const copyServer = inline.server && {
    ...inline.server,
    allowedHosts: Array.isArray(inline.server.allowedHosts)
      ? [...inline.server.allowedHosts]
      : inline.server.allowedHosts,
    fs: inline.server.fs && { ...inline.server.fs, deny: inline.server.fs.deny && [...inline.server.fs.deny] },
  };
  const copyPreview = inline.preview && {
    ...inline.preview,
    allowedHosts: Array.isArray(inline.preview.allowedHosts)
      ? [...inline.preview.allowedHosts]
      : inline.preview.allowedHosts,
  };
  return { ...inline, server: copyServer, preview: copyPreview };
}

async function resolveServe(inline: UserConfig) {
  return resolveConfig({ ...copyOf(inline), configFile: false, logLevel: 'silent' }, 'serve');
}

function apiProxy(proxy: Record<string, string | ProxyOptions> | undefined): ProxyOptions {
  const entry = proxy?.['/api'];
  if (entry === undefined || typeof entry === 'string') {
    throw new Error('missing /api proxy options');
  }
  return entry;
}

describe('vite.config.ts: loopback binding (R-234)', () => {
  it('binds the dev server to 127.0.0.1 on port 5173 with strictPort', () => {
    expect(server.host).toBe('127.0.0.1');
    expect(server.port).toBe(DEV_PORT);
    expect(DEV_PORT).toBe(5173);
    expect(server.strictPort).toBe(true);
  });

  it('binds the preview server to 127.0.0.1 with strictPort', () => {
    expect(preview.host).toBe('127.0.0.1');
    expect(preview.strictPort).toBe(true);
  });

  it('keeps loopback binding after Vite resolves the configuration', async () => {
    const resolved = await resolveServe(userConfig);
    expect(resolved.server.host).toBe(LOOPBACK_HOST);
    expect(resolved.server.strictPort).toBe(true);
    expect(resolved.preview.host).toBe(LOOPBACK_HOST);
    expect(resolved.preview.strictPort).toBe(true);
  });
});

describe('vite.config.ts: development-mode controls (T10-F02)', () => {
  it('never sets allowedHosts to true; only the two loopback names are allowed', () => {
    for (const options of [server, preview]) {
      expect(options.allowedHosts).not.toBe(true);
      expect(Array.isArray(options.allowedHosts)).toBe(true);
      expect([...(options.allowedHosts as string[])].sort()).toEqual(['127.0.0.1', 'localhost']);
    }
    expect(ALLOWED_HOSTS).toEqual(['127.0.0.1', 'localhost']);
  });

  it('does not widen CORS (disabled on server and preview)', () => {
    expect(server.cors).toBe(false);
    expect(preview.cors).toBe(false);
  });

  it('keeps fs.strict and Vite default fs.deny list, plus the data directory', async () => {
    expect(server.fs?.strict).toBe(true);
    const deny = server.fs?.deny ?? [];

    const defaults = (await resolveServe({ root: WEB_DIR })).server.fs.deny;
    expect(defaults).toEqual(VITE_DEFAULT_FS_DENY);
    expect(defaults).toEqual(expect.arrayContaining(['.env', '.env.*']));
    for (const pattern of defaults) {
      expect(deny).toContain(pattern);
    }
    expect(deny).toContain(DATA_DIR_DENY);
    expect(DATA_DIR_DENY.endsWith('/data/**')).toBe(true);
  });

  it('refuses to serve environment files and the data directory, and serves the app sources', async () => {
    const resolved = await resolveServe(userConfig);
    expect(resolved.server.fs.strict).toBe(true);

    const denied = [
      `${REPO_ROOT}/.env.local`,
      `${REPO_ROOT}/.env`,
      `${REPO_ROOT}/.env.example`,
      `${WEB_DIR}/.env.local`,
      `${REPO_ROOT}/.npmrc`,
      `${REPO_ROOT}/data/edr.sqlite`,
      `${REPO_ROOT}/data/exports/00000000-0000-4000-8000-000000000000/manifest.json`,
      `${REPO_ROOT}/DATA/edr.sqlite`,
    ];
    for (const file of denied) {
      expect(isFileLoadingAllowed(resolved, file), file).toBe(false);
    }

    const allowed = [`${WEB_DIR}/src/main.tsx`, `${REPO_ROOT}/packages/contracts/src/index.ts`];
    for (const file of allowed) {
      expect(isFileLoadingAllowed(resolved, file), file).toBe(true);
    }
  });

  it('proxies /api to the local API on 127.0.0.1:4300 with changeOrigin false', () => {
    for (const options of [server, preview]) {
      const proxy = apiProxy(options.proxy);
      expect(proxy.target).toBe(`http://127.0.0.1:${API_PORT}`);
      expect(API_PORT).toBe(4300);
      expect(proxy.changeOrigin).toBe(false);
    }
  });
});

describe('vite.config.ts: environment exposure (T10-F11)', () => {
  it('keeps envPrefix VITE_ and envDir apps/web', async () => {
    expect(userConfig.envPrefix).toBe('VITE_');
    expect(userConfig.envDir).toBe(WEB_DIR);
    expect(WEB_DIR.endsWith('/apps/web')).toBe(true);
    const resolved = await resolveServe(userConfig);
    expect(resolved.envPrefix).toBe('VITE_');
    expect(resolved.envDir).toBe(WEB_DIR);
  });

  it('has no environment file in apps/web', () => {
    expect(readdirSync(WEB_DIR).filter((name) => name.startsWith('.env'))).toEqual([]);
  });
});
