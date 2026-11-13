import { axeScan, expect, test } from '../support/test.js';

for (const width of [1440, 768, 390]) {
  test(`shell navigation at ${width}px @a11y`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Tu próximo contenido empieza aquí', exact: true })).toBeVisible();
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

test('shell groups open the Mi marca and Plantillas pages, mark the current page and move focus to it', async ({
  page,
}) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  for (const [group, entries] of [
    [
      'Mi marca',
      [
        ['Recursos', '/brand/resources', 'Recursos'],
        ['Identidad visual', '/brand/identity', 'Identidad visual'],
      ],
    ],
    [
      'Plantillas',
      [
        ['Crear plantilla', '/templates/create', 'Crear plantilla'],
        ['Plantillas del motor', '/templates/engine', 'Plantillas del motor'],
      ],
    ],
  ] as const) {
    const toggle = nav.getByRole('button', { name: group, exact: true });
    const submenu = nav.getByRole('list', { name: group, exact: true });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const [name, path, heading] of entries) {
      await submenu.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('main')).toBeFocused();
      if (heading !== null) {
        await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      }
      // The group of the current page stays open and its entry is the current page.
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(submenu.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
    }
  }
});
