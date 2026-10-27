/**
 * Security lint rules of architecture-delta.md section 7.1: network APIs only in the egress client and never in the
 * export and import modules (T10-F08, R-219), no `dangerouslySetInnerHTML` in the web app (T10-F16), and no template
 * literal with substitutions passed to `prepare` or `exec` (T10-F14).
 */
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}${filePath}` });
  return (result?.messages ?? [])
    .filter((message) => message.severity === 2 && message.ruleId?.startsWith('no-restricted-') === true)
    .map((message) => message.ruleId ?? '');
}

const NETWORK_SNIPPETS: Record<string, string> = {
  'static import of node:http': "import http from 'node:http';\nexport const h = http;\n",
  'static import of net': "import { connect } from 'net';\nexport const c = connect;\n",
  'static import of node:tls': "import tls from 'node:tls';\nexport const t = tls;\n",
  'static import of node:https': "import https from 'node:https';\nexport const s = https;\n",
  'static import of undici': "import { request } from 'undici';\nexport const r = request;\n",
  'dynamic import of node:net': "export const load = () => import('node:net');\n",
  'fetch global': "export const call = () => fetch('http://127.0.0.1:1/');\n",
  'globalThis.fetch': "export const call = () => globalThis.fetch('http://127.0.0.1:1/');\n",
};

describe('network API bans (T10-F08)', () => {
  for (const [name, code] of Object.entries(NETWORK_SNIPPETS)) {
    it(`reports ${name} in server modules, providers and the workflow`, async () => {
      for (const path of [
        'apps/server/src/modules/research/x.ts',
        'apps/server/src/providers/ai/x.ts',
        'apps/server/src/providers/sports/adapters/fixture/x.ts',
        'apps/server/src/workflow/x.ts',
        'apps/server/scripts/x.ts',
      ]) {
        expect(await ruleIds(code, path), path).not.toEqual([]);
      }
    });

    it(`reports ${name} in the export and import modules, tests included`, async () => {
      for (const path of [
        'apps/server/src/modules/export/x.ts',
        'apps/server/src/modules/export/x.test.ts',
        'apps/server/src/modules/imports/x.ts',
        'apps/server/src/modules/imports/x.test.ts',
      ]) {
        expect(await ruleIds(code, path), path).not.toEqual([]);
      }
    });

    it(`accepts ${name} in the egress client`, async () => {
      expect(await ruleIds(code, 'apps/server/src/platform/net/x.ts')).toEqual([]);
    });
  }

  it('accepts a loopback test server in server tests outside export and imports', async () => {
    expect(await ruleIds(NETWORK_SNIPPETS['static import of node:http'] ?? '', 'apps/server/test/x.test.ts')).toEqual(
      [],
    );
  });
});

describe('dangerouslySetInnerHTML ban (T10-F16)', () => {
  it('reports it in the web app', async () => {
    const code = 'export const C = (p: { html: string }) => <div dangerouslySetInnerHTML={{ __html: p.html }} />;\n';
    expect(await ruleIds(code, 'apps/web/src/ui/x.tsx')).toContain('no-restricted-syntax');
  });
});

describe('parameterized SQL only (T10-F14)', () => {
  it('reports a template literal with a substitution passed to prepare or exec', async () => {
    const prepare =
      'declare const db: { prepare(s: string): unknown };\nconst id = 1;\nexport const q = db.prepare(`SELECT * FROM t WHERE id = ${id}`);\n';
    const exec =
      'declare const db: { exec(s: string): unknown };\nconst t = "x";\nexport const q = db.exec(`DELETE FROM ${t}`);\n';
    expect(await ruleIds(prepare, 'apps/server/src/platform/db/x.ts')).toContain('no-restricted-syntax');
    expect(await ruleIds(exec, 'apps/server/src/modules/review/x.ts')).toContain('no-restricted-syntax');
  });

  it('accepts bound parameters and constant SQL', async () => {
    const code =
      "declare const db: { prepare(s: string): unknown; exec(s: string): unknown };\nexport const q = db.prepare('SELECT * FROM t WHERE id = ?');\nexport const e = db.exec(`PRAGMA foreign_keys = ON`);\n";
    expect(await ruleIds(code, 'apps/server/src/platform/db/x.ts')).toEqual([]);
  });
});
