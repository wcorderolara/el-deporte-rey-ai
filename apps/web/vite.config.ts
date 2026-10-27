/**
 * Vite configuration of the operator web interface (`architecture.md` sections 12 and 12.1; T10-F02, T10-F11).
 *
 * Development-mode controls, asserted by `vite.config.test.ts`:
 * - `server` and `preview` listen on `127.0.0.1` only, with `strictPort` (R-234, SC-02);
 * - `allowedHosts` is never `true`: only the two loopback names are accepted;
 * - CORS is disabled (`cors: false`), never widened;
 * - `fs.strict` is `true`, and `fs.deny` keeps Vite's default list (which covers `.env` and `.env.*`) and adds the
 *   repository's runtime data directory (`data/**`);
 * - the `/api` proxy forwards to the local API on `127.0.0.1:4300` with `changeOrigin: false`, so that the API sees
 *   and checks the browser's own Host and Origin;
 * - `envPrefix` stays `VITE_` and `envDir` is `apps/web`, where no `.env.local` exists, so no provider base URL or
 *   credential can reach the browser bundle.
 */
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath, type ProxyOptions } from 'vite';

/** Absolute directory of this workspace (`apps/web`). */
export const WEB_DIR = normalizePath(fileURLToPath(new URL('.', import.meta.url))).replace(/\/$/, '');

/** Absolute directory of the repository root. */
export const REPO_ROOT = normalizePath(fileURLToPath(new URL('../..', import.meta.url))).replace(/\/$/, '');

/** Loopback address every listener binds to (R-234). */
export const LOOPBACK_HOST = '127.0.0.1';

/** Ports of `architecture.md` section 12. */
export const DEV_PORT = 5173;
export const PREVIEW_PORT = 4173;
export const API_PORT = 4300;

/** Host names the dev and preview servers answer to; never `true` (T10-F02). */
export const ALLOWED_HOSTS: readonly string[] = Object.freeze(['127.0.0.1', 'localhost']);

/** Vite's default `server.fs.deny` list (Vite 8.3.4), kept in full (T10-F02). */
export const VITE_DEFAULT_FS_DENY = [
  '.env',
  '.env.*',
  '*.{crt,pem,key,p12,pfx,cer,der}',
  '.npmrc',
  '.yarnrc.yml',
  '**/.git/**',
];

/** Escapes glob syntax in an absolute path, so that it is matched literally. */
function escapeGlob(value: string): string {
  return value.replace(/[\\*?[\]{}()!+@]/g, (character) => `\\${character}`);
}

/**
 * Glob of the repository's runtime data directory (`data/**`). Vite matches deny patterns that contain a slash
 * against absolute file paths, so the pattern is anchored at the repository root.
 */
export const DATA_DIR_DENY = `${escapeGlob(REPO_ROOT)}/data/**`;

/** `/api` proxy of the dev and preview servers; a new object for each, because Vite mutates resolved options. */
function apiProxy(): Record<string, ProxyOptions> {
  return {
    '/api': {
      target: `http://${LOOPBACK_HOST}:${API_PORT}`,
      changeOrigin: false,
      ws: false,
    },
  };
}

export default defineConfig({
  root: WEB_DIR,
  envDir: WEB_DIR,
  envPrefix: 'VITE_',
  clearScreen: false,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@edr\/contracts$/,
        replacement: fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    host: LOOPBACK_HOST,
    port: DEV_PORT,
    strictPort: true,
    allowedHosts: [...ALLOWED_HOSTS],
    cors: false,
    proxy: apiProxy(),
    fs: {
      strict: true,
      deny: [...VITE_DEFAULT_FS_DENY, DATA_DIR_DENY],
    },
  },
  preview: {
    host: LOOPBACK_HOST,
    port: PREVIEW_PORT,
    strictPort: true,
    allowedHosts: [...ALLOWED_HOSTS],
    cors: false,
    proxy: apiProxy(),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
