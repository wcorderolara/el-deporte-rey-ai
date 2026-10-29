import { axeScan, expect, test } from '../support/test.js';

for (const width of [1440, 768, 390]) {
  test(`shell navigation at ${width}px @a11y`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Proyectos', exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    const menu = page.getByRole('button', { name: 'Menú' });
    if (width < 1200) {
      await expect(nav).toBeHidden();
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(nav).toBeVisible();
      await nav.getByRole('link', { name: 'Datos', exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(nav).toBeHidden();
      await expect(menu).toBeFocused();
      await page.keyboard.press('Enter');
      await nav.getByRole('link', { name: 'Inicio', exact: true }).click();
      await expect(nav).toBeHidden();
      await expect(menu).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await expect(menu).toBeHidden();
    }
    await expect(nav.getByRole('link', { name: /Configuración/ })).toHaveCount(0);
    expect(await axeScan(page)).toEqual([]);
    await nav.getByRole('link', { name: 'Datos', exact: true }).click();
    await expect(page).toHaveURL(/\/imports$/);
    await expect(page.getByRole('main')).toBeFocused();
    if (width < 1200) await expect(nav).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await axeScan(page)).toEqual([]);
  });
}

test('shell links to existing brand sections and restores heading focus', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  for (const [name, hash] of [
    ['Plantillas', 'brand-templates-title'],
    ['Mi marca', 'brand-assets-title'],
  ]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/brand#${hash}$`));
    await expect(page.locator(`#${hash}`)).toBeFocused();
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
});
