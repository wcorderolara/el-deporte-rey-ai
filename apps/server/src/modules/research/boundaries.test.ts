/**
 * Research module boundaries (R-118, R-268; contracts/provider-ports.md section 3): the production files reach sources
 * only through the ingestion entry point, import no adapter, and contain no branch on a data mode, an adapter kind or
 * a provider; the module registers the research stage under its name.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { serverModule } from './index.js';

const DIRECTORY = fileURLToPath(new URL('./', import.meta.url));

function productionFiles(): { name: string; text: string }[] {
  return readdirSync(DIRECTORY)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: readFileSync(join(DIRECTORY, name), 'utf8') }));
}

describe('research module boundaries (R-268)', () => {
  it('imports sports data only through the ingestion entry point, never an adapter', () => {
    const files = productionFiles();
    expect(files.map((file) => file.name).sort()).toEqual(['core.ts', 'index.ts', 'repository.ts', 'stage.ts']);
    for (const file of files) {
      const imports = [...file.text.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '');
      for (const path of imports) {
        expect(path, file.name).not.toMatch(/adapters|providers\/sports\/(?!index\.js$)/);
        expect(path, file.name).not.toMatch(/\/test\//);
      }
    }
  });

  it('has no branch on a data mode, an adapter kind or a provider', () => {
    for (const file of productionFiles()) {
      const code = file.text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code, file.name).not.toMatch(/'(LIVE_DATA|MANUAL_DATA|DEMO_DATA)'/);
      expect(code, file.name).not.toMatch(/'(fixture|manual|football-data|test-live)'/);
      expect(code, file.name).not.toMatch(/descriptor\.(adapter|role|accepted|officialPublication)/);
      expect(code, file.name).not.toMatch(/competition/i);
    }
  });

  it('registers the research stage in the module of the registry', () => {
    expect(serverModule.name).toBe('research');
    expect(serverModule.stages?.map((stage) => stage.name)).toEqual(['research']);
    expect(serverModule.routes).toBeUndefined();
  });
});
