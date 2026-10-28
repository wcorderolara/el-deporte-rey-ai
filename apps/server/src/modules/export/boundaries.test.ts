/**
 * Boundaries of the export module (R-219, BR-11, T10-F08): no source file of the module (tests included) imports a
 * network module, the egress client or a provider; the module offers no publication route; and its service
 * dependencies leave out every network-capable member of the container. Complements the ESLint rule of T10-F08.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { AppContainer } from '../../container.js';

import { exportDependencies } from './service.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith('.ts') && path !== SELF ? [path] : [];
  });
}

/** The module specifiers of every static and dynamic import or re-export of a source text. */
function specifiers(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    found.push(match[1] ?? '');
  }
  return found;
}

const NETWORK = /^(node:)?(http|https|http2|net|tls|dgram)$|^undici(\/|$)/;
const FORBIDDEN_PATHS = /platform\/net|providers\//;

describe('export module boundaries (R-219, T10-F08)', () => {
  const files = sourceFiles(MODULE_DIR);

  it('has source files to check', () => {
    expect(files.map((file) => relative(MODULE_DIR, file))).toEqual(
      expect.arrayContaining(['index.ts', 'service.ts', 'files.ts', 'manifest.ts', 'routes.ts', 'repository.ts']),
    );
  });

  it.each(sourceFiles(MODULE_DIR).map((file) => [relative(MODULE_DIR, file), file]))(
    '%s imports no network module, egress client or provider, and uses no network global',
    (_name, file) => {
      const text = readFileSync(file, 'utf8');
      for (const specifier of specifiers(text)) {
        expect(specifier).not.toMatch(NETWORK);
        expect(specifier).not.toMatch(FORBIDDEN_PATHS);
      }
      expect(text).not.toMatch(/\b(fetch|WebSocket|XMLHttpRequest)\s*\(/);
      expect(text).not.toMatch(/new\s+(WebSocket|XMLHttpRequest)\b/);
    },
  );

  it('registers only the export, history and trace routes: nothing publishes (BR-11)', () => {
    const routes = readFileSync(join(MODULE_DIR, 'routes.ts'), 'utf8');
    const registered = [...routes.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)].map(
      (match) => `${match[1] ?? ''} ${match[2] ?? ''}`,
    );
    expect(registered).toEqual([
      'post /carousels/:carouselId/exports',
      'get /projects/:projectId/exports',
      'get /exports/:exportId',
      'get /exports/:exportId/slides/:position/trace',
    ]);
  });

  it('builds the service dependencies without the egress client, the sources or the AI provider', () => {
    const touched: string[] = [];
    const container = new Proxy(
      { config: {}, db: {}, clock: {}, logger: {}, paths: {} },
      {
        get(target, property: string) {
          touched.push(property);
          return (target as Record<string, unknown>)[property];
        },
      },
    ) as unknown as AppContainer;
    const deps = exportDependencies(container);
    expect(Object.keys(deps).sort()).toEqual(['clock', 'config', 'db', 'logger', 'paths']);
    expect(touched.sort()).toEqual(['clock', 'config', 'db', 'logger', 'paths']);
  });
});
