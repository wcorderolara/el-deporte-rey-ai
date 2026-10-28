/**
 * Registration form (registerBrandAsset; PD-03, R-049, R-231, T10-F12): only the brand kinds, a PNG or JPEG picker,
 * client-side checks with linked errors and focus, and server refusals shown with their reason.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrandApi } from './brandApi';
import { checkRegistration, RegisterAssetForm } from './RegisterAssetForm';
import { ASSET_LOGO, fakeFetch, imageFile, jsonResponse, problemResponse, type Handler } from './testSupport';

afterEach(cleanup);

function renderForm(post: Handler | Handler[]) {
  const fake = fakeFetch({ 'POST /brand/assets': post });
  const onRegistered = vi.fn();
  render(<RegisterAssetForm api={createBrandApi({ fetch: fake.fetch })} onRegistered={onRegistered} />);
  return { ...fake, onRegistered };
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('Archivo de imagen');
}

describe('checkRegistration', () => {
  const png = imageFile('l.png', 'image/png');

  it('accepts a kind, a printable label (trimmed) and a PNG or JPEG file', () => {
    const check = checkRegistration({ kind: 'mascot', label: '  Mascota  ', file: png });
    expect(check).toEqual({ ok: true, input: { kind: 'mascot', label: 'Mascota', file: png } });
    expect(checkRegistration({ kind: 'decoration', label: 'D', file: imageFile('d.jpg', 'image/jpeg') }).ok).toBe(true);
  });

  it('reports every missing value', () => {
    expect(checkRegistration({ kind: null, label: ' ', file: null })).toEqual({
      ok: false,
      errors: {
        kind: 'Elija el tipo de recurso.',
        label: 'Escriba una etiqueta.',
        file: 'Seleccione un archivo PNG o JPEG.',
      },
    });
  });

  it('refuses labels that are too long or contain control or format characters', () => {
    const tooLong = checkRegistration({ kind: 'mascot', label: 'x'.repeat(81), file: png });
    expect(tooLong.ok === false && tooLong.errors.label).toBe('La etiqueta admite como máximo 80 caracteres.');
    for (const label of ['Logo\u0007', 'Logo‮evil', 'a\nb']) {
      const check = checkRegistration({ kind: 'mascot', label, file: png });
      expect(check.ok === false && check.errors.label).toMatch(/caracteres no permitidos/);
    }
  });

  it('refuses files other than PNG or JPEG, empty files and files over 5 MiB', () => {
    for (const type of ['image/svg+xml', 'image/gif', 'text/html', '']) {
      const check = checkRegistration({ kind: 'mascot', label: 'M', file: imageFile('x', type) });
      expect(check.ok === false && check.errors.file).toBe('Solo se aceptan archivos PNG o JPEG.');
    }
    const empty = checkRegistration({ kind: 'mascot', label: 'M', file: imageFile('e.png', 'image/png', 0) });
    expect(empty.ok === false && empty.errors.file).toBe('El archivo está vacío.');
    const large = checkRegistration({
      kind: 'mascot',
      label: 'M',
      file: imageFile('big.png', 'image/png', 5 * 1024 * 1024 + 1),
    });
    expect(large.ok === false && large.errors.file).toBe('El archivo supera el tamaño máximo de 5 MiB.');
  });
});

describe('RegisterAssetForm', () => {
  it('offers only brand logo, mascot and decoration, with no badge or competition-mark option', () => {
    renderForm(() => jsonResponse(ASSET_LOGO, 201));

    const group = screen.getByRole('group', { name: 'Tipo de recurso' });
    const radios = [...group.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual(['brand_logo', 'mascot', 'decoration']);
    expect(screen.getByRole('radio', { name: /Logotipo de la marca/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Mascota/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Decoración/ })).toBeTruthy();
    expect(group.textContent).not.toMatch(/escudo|badge|competici|competition|club/i);
  });

  it('restricts the file picker to PNG and JPEG', () => {
    renderForm(() => jsonResponse(ASSET_LOGO, 201));
    expect(fileInput().getAttribute('accept')).toBe('image/png,image/jpeg,.png,.jpg,.jpeg');
    expect(fileInput().type).toBe('file');
  });

  it('shows linked errors, moves focus to the first invalid field and sends nothing', async () => {
    const user = userEvent.setup();
    const { fetch } = renderForm(() => jsonResponse(ASSET_LOGO, 201));

    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /Logotipo de la marca/ }));
    const group = screen.getByRole('group', { name: 'Tipo de recurso' });
    expect(group.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(group.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Error: Elija el tipo de recurso.',
    );
    const label = screen.getByRole('textbox', { name: 'Etiqueta' });
    expect(label.getAttribute('aria-invalid')).toBe('true');
    expect(label.getAttribute('aria-describedby')).toMatch(/label-error/);
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Error: Seleccione un archivo PNG o JPEG.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: /Mascota/ }));
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));
    expect(document.activeElement).toBe(label);
  });

  it('refuses a non-image file chosen by bypassing the picker filter', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { fetch } = renderForm(() => jsonResponse(ASSET_LOGO, 201));

    await user.click(screen.getByRole('radio', { name: /Decoración/ }));
    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'Adorno');
    await user.upload(fileInput(), imageFile('vector.svg', 'image/svg+xml'));
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    expect(screen.getByText('Error: Solo se aceptan archivos PNG o JPEG.')).toBeTruthy();
    expect(document.activeElement).toBe(fileInput());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('registers the asset, resets the form and reports the registered asset', async () => {
    const user = userEvent.setup();
    const { requests, onRegistered } = renderForm(() => jsonResponse(ASSET_LOGO, 201));

    await user.click(screen.getByRole('radio', { name: /Logotipo de la marca/ }));
    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'Logotipo sintético');
    await user.upload(fileInput(), imageFile('logo.png', 'image/png'));
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    await vi.waitFor(() => expect(onRegistered).toHaveBeenCalledWith(ASSET_LOGO));
    const url = new URL(requests[0]?.url ?? '', 'http://127.0.0.1');
    expect(url.searchParams.get('kind')).toBe('brand_logo');
    expect(url.searchParams.get('label')).toBe('Logotipo sintético');
    expect(requests[0]?.headers['Content-Type']).toBe('image/png');
    expect((screen.getByRole('textbox', { name: 'Etiqueta' }) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('radio', { name: /Logotipo de la marca/ }) as HTMLInputElement).checked).toBe(false);
    expect(fileInput().files?.length ?? 0).toBe(0);
  });

  it.each([
    [409, 'DUPLICATE_ASSET', 'Este archivo ya está registrado.'],
    [415, 'UNSUPPORTED_MEDIA_TYPE', 'El tipo de contenido enviado no es compatible.'],
    [413, 'PAYLOAD_TOO_LARGE', 'El contenido enviado es demasiado grande.'],
  ])('announces a %i %s refusal with its reason', async (status, code, message) => {
    const user = userEvent.setup();
    const { onRegistered } = renderForm(() => problemResponse(status, code));

    await user.click(screen.getByRole('radio', { name: /Mascota/ }));
    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'Mascota');
    await user.upload(fileInput(), imageFile('m.jpg', 'image/jpeg'));
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo registrar el recurso');
    expect(alert.textContent).toContain(message);
    expect(onRegistered).not.toHaveBeenCalled();
    expect((screen.getByRole('textbox', { name: 'Etiqueta' }) as HTMLInputElement).value).toBe('Mascota');
  });

  it('lists the validation issues of a VALIDATION_FAILED refusal', async () => {
    const user = userEvent.setup();
    renderForm(() =>
      problemResponse(400, 'VALIDATION_FAILED', { errors: [{ path: 'dimensions', message: 'exceeds 4096' }] }),
    );

    await user.click(screen.getByRole('radio', { name: /Mascota/ }));
    await user.type(screen.getByRole('textbox', { name: 'Etiqueta' }), 'Mascota');
    await user.upload(fileInput(), imageFile('m.png', 'image/png'));
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Los datos enviados no son válidos.');
    expect(alert.textContent).toContain('exceeds 4096');
  });

  it('disables the form while sending and offers a retry after a network failure', async () => {
    const user = userEvent.setup();
    const { fetch, onRegistered } = renderForm([
      () => {
        throw new TypeError('connection refused');
      },
      () => jsonResponse(ASSET_LOGO, 201),
    ]);

    await user.click(screen.getByRole('radio', { name: /Logotipo de la marca/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiqueta' }), { target: { value: 'Logo' } });
    await user.upload(fileInput(), imageFile('logo.png', 'image/png'));
    await user.click(screen.getByRole('button', { name: 'Registrar recurso' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await vi.waitFor(() => expect(onRegistered).toHaveBeenCalledWith(ASSET_LOGO));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
