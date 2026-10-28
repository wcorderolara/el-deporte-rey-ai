/**
 * Static provider-identifier check (AD-31, R-139, R-289) and inline-disable protection (T11H-F15, V-55).
 *
 * Lints seeded violations with the project ESLint configuration at core paths (errors expected), the same text at an
 * adapter path (no error expected), a violation behind an inline disable directive at a core path (error expected),
 * and the delivered tree (no problem expected). The seeded text is read from a data file, so that this test file
 * itself contains no provider identifier.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

interface SeededViolation {
  id: string;
  extension: 'ts' | 'tsx';
  code: string;
}

interface SeededData {
  /** An adapter directory, exempt from the rule. */
  exemptDirectory: string;
  violations: SeededViolation[];
  disabledViolation: string;
}

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const seeded = JSON.parse(readFileSync(new URL('./seeded-violations.json', import.meta.url), 'utf8')) as SeededData;
const eslint = new ESLint({ cwd: repoRoot });

const RULES = new Set(['no-restricted-syntax', 'no-restricted-imports']);

/** Core paths: domain modules, core services, workflow, platform, providers outside the adapters, UI, packages. */
const CORE_DIRECTORIES = [
  'apps/server/src/workflow',
  'apps/server/src/modules/research',
  'apps/server/src/providers/sports/ingestion',
  'apps/server/src/platform/config',
  'apps/web/src/features/projects',
  'packages/contracts/src/domain',
];

async function lint(code: string, filePath: string): Promise<ESLint.LintResult> {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}${filePath}` });
  if (result === undefined) {
    throw new Error(`no lint result for ${filePath}`);
  }
  return result;
}

function ruleErrors(result: ESLint.LintResult): string[] {
  return result.messages
    .filter((message) => message.severity === 2 && message.ruleId !== null && RULES.has(message.ruleId))
    .map((message) => `${message.ruleId}: ${message.message}`);
}

describe('provider-identifier lint rule', () => {
  it('has seeded violations to check and an adapter directory as the exempt path', () => {
    expect(seeded.violations.length).toBeGreaterThanOrEqual(6);
    expect(seeded.exemptDirectory.startsWith('apps/server/src/providers/sports/adapters/')).toBe(true);
  });

  for (const directory of CORE_DIRECTORIES) {
    for (const violation of seeded.violations) {
      it(`reports ${violation.id} in ${directory}`, async () => {
        const result = await lint(violation.code, `${directory}/seeded-${violation.id}.${violation.extension}`);
        expect(ruleErrors(result).length).toBeGreaterThanOrEqual(1);
      });
    }
  }

  for (const violation of seeded.violations) {
    it(`accepts ${violation.id} inside the provider adapters`, async () => {
      const result = await lint(
        violation.code,
        `${seeded.exemptDirectory}/seeded-${violation.id}.${violation.extension}`,
      );
      expect(result.errorCount).toBe(0);
      expect(ruleErrors(result)).toEqual([]);
    });
  }

  it('still reports a violation behind an inline disable directive in core code', async () => {
    const result = await lint(seeded.disabledViolation, 'apps/server/src/workflow/seeded-disabled.ts');
    expect(ruleErrors(result).length).toBeGreaterThanOrEqual(1);
  });

  it('finds no problem in the delivered tree', { timeout: 120_000 }, async () => {
    const results = await eslint.lintFiles(['.']);
    const problems = results
      .filter((result) => result.errorCount + result.warningCount > 0)
      .map((result) => result.filePath.slice(repoRoot.length));
    expect(problems).toEqual([]);
    expect(results.length).toBeGreaterThan(0);
  });
});
