/**
 * Shared Playwright test object of the end-to-end suites. Every test gets an automatic guard: the browser may reach
 * only the application under test (its loopback origin); any other request is aborted and fails the test (R-241,
 * R-262). `axeScan` runs axe on the current page and returns the serious and critical violations.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

/** WCAG tags checked by the accessibility tests. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Impacts that fail an accessibility test. */
export const FAILING_IMPACTS: readonly string[] = ['serious', 'critical'];

export interface AxeFinding {
  readonly id: string;
  readonly impact: string;
  readonly help: string;
  readonly targets: readonly string[];
}

/** Runs axe on `page` and returns the violations whose impact is serious or critical. */
export async function axeScan(page: Page): Promise<AxeFinding[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations
    .filter((violation) => FAILING_IMPACTS.includes(violation.impact ?? ''))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? '',
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

export const test = base.extend<{ externalRequestGuard: void }>({
  externalRequestGuard: [
    async ({ context, baseURL }, use) => {
      if (baseURL === undefined) {
        throw new Error('baseURL is not configured');
      }
      const allowedOrigin = new URL(baseURL).origin;
      const blocked: string[] = [];
      await context.route(
        (url) => url.origin !== allowedOrigin && url.protocol !== 'data:' && url.protocol !== 'blob:',
        async (route) => {
          blocked.push(route.request().url());
          await route.abort('blockedbyclient');
        },
      );
      await use();
      expect(blocked, 'requests to an origin other than the application under test').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
