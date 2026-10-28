/**
 * Accessibility smoke check (`@a11y`): axe on the project list page reports no serious or critical violation. The
 * page is checked once its data request has settled (list, empty state or error banner), whatever modules are
 * integrated. A positive control proves that the scan reports a seeded serious violation.
 */
import { axeScan, expect, test } from '../support/test.js';

test.describe('Accessibility @a11y', () => {
  test('project list page has no serious or critical axe violation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeVisible();
    await expect(page.getByText('Cargando proyectos…')).toHaveCount(0);

    expect(await axeScan(page)).toEqual([]);
  });

  test('positive control: the scan reports a seeded low-contrast text', async ({ page }) => {
    await page.setContent(
      '<!doctype html><html lang="es"><head><title>Control</title></head><body><main><h1>Control</h1>' +
        '<p style="color:#bbbbbb;background:#ffffff">Texto de contraste insuficiente</p></main></body></html>',
    );

    const findings = await axeScan(page);
    expect(findings.map((finding) => finding.id)).toContain('color-contrast');
  });
});
