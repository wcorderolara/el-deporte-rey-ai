/**
 * Smoke journey (R-235): the application opens directly on Inicio, with no login, account or sign-in element. It
 * asserts only the shell, its menu and the page heading, so that it keeps passing while features change.
 */
import { expect, test } from '../support/test.js';

/** Names of login, account or user-management controls (Spanish UI, plus English for safety). */
const ACCOUNT_CONTROL = /sesi[oó]n|cuenta|contraseña|registrarse|log ?in|log ?out|sign ?in|sign ?up|account|password/i;

test.describe('Application shell (R-235)', () => {
  test('opens on the project list without login', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle('El Deporte Rey GT');

    await expect(page.getByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeVisible();

    // The menu of the current shell (UI-01B as extended by PD-ARCH-01E to 01G): six links, and Mi marca and Plantillas
    // as collapsed groups whose sub-pages are links shown once the group is opened.
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('link')).toHaveCount(6);
    for (const name of ['Inicio', 'Crear contenido', 'Mis proyectos', 'Competiciones', 'Exportaciones', 'Datos']) {
      await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible();
    }
    for (const name of ['Mi marca', 'Plantillas']) {
      await expect(navigation.getByRole('button', { name, exact: true })).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(navigation.getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('shows no login, account or sign-in element', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu próximo contenido empieza aquí' })).toBeVisible();

    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[autocomplete~="username"], input[type="email"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: ACCOUNT_CONTROL })).toHaveCount(0);
    await expect(page.getByRole('button', { name: ACCOUNT_CONTROL })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: ACCOUNT_CONTROL })).toHaveCount(0);
  });
});
