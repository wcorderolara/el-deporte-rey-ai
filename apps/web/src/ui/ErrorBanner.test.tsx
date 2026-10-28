import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, parseProblem } from '../api/client';
import type { Problem } from '../api/types';
import { ErrorBanner } from './ErrorBanner';

afterEach(cleanup);

function problemError(body: Record<string, unknown>): ApiError {
  const status = typeof body.status === 'number' ? body.status : 400;
  const problem = parseProblem({ type: 'about:blank', title: 'x', status, ...body }, status) as Problem;
  return new ApiError('problem', { status, problem });
}

describe('ErrorBanner', () => {
  it('announces the error with role alert and a Spanish message', () => {
    render(<ErrorBanner error={new ApiError('network')} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No se pudo conectar con el servidor local');
  });

  it('offers a retry for a retryable error and calls the handler', async () => {
    const onRetry = vi.fn();
    render(<ErrorBanner error={new ApiError('network')} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not offer a retry for a non-retryable error', () => {
    render(<ErrorBanner error={problemError({ code: 'NOT_FOUND', status: 404 })} onRetry={() => undefined} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('El elemento solicitado no existe.');
  });

  it('shows the wait of a rate-limited request', () => {
    render(<ErrorBanner error={problemError({ code: 'PROVIDER_RATE_LIMITED', status: 503, retryAfterSeconds: 12 })} />);
    expect(screen.getByRole('alert').textContent).toContain('Puede reintentar en 12 segundos.');
  });

  it('shows the refusal reason of a manual approval refusal', () => {
    render(
      <ErrorBanner error={problemError({ code: 'MANUAL_APPROVAL_REFUSED', status: 409, refusalReason: 'disputed' })} />,
    );
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('No se puede aprobar manualmente este dato.');
    expect(text).toContain('El dato está en disputa entre fuentes.');
  });

  it('shows only the rejection message for a rejected import, never a record table or the server message', () => {
    // The import page lists these errors in its own table from the closed codes (OD-63); no current caller passes a
    // rejection here, and the banner must not fall back to "Archivo n" labels or the English server text (OD-64).
    render(
      <ErrorBanner
        error={problemError({
          code: 'IMPORT_REJECTED',
          status: 422,
          importErrors: [
            {
              location: 'file',
              record: '3',
              field: 'referee',
              problem: 'person_field',
              message: 'Person field refused: referee',
            },
            {
              location: 'form',
              record: '/matches/1',
              field: null,
              problem: 'required_missing',
              message: 'Missing required value',
            },
          ],
        })}
      />,
    );
    const alert = screen.getByRole('alert');
    const text = alert.textContent ?? '';
    expect(text).toContain('La importación fue rechazada. No se guardó ningún dato.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(text).not.toContain('Archivo');
    expect(text).not.toContain('Formulario');
    expect(text).not.toContain('Person field refused');
    expect(text).not.toContain('Missing required value');
    expect(text).not.toContain('referee');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lists validation issues as text only', () => {
    render(
      <ErrorBanner
        error={problemError({
          code: 'VALIDATION_FAILED',
          status: 400,
          errors: [{ path: 'name', message: '<img src=x onerror=alert(1)>' }],
        })}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Campos con errores');
    expect(alert.querySelector('code')?.textContent).toBe('name');
    expect(alert.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(alert.querySelector('img')).toBeNull();
  });

  it('explains a local access refusal without suggesting a login', () => {
    render(<ErrorBanner error={problemError({ code: 'FORBIDDEN_ORIGIN', status: 403 })} />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).toContain('127.0.0.1');
    expect(text).toContain('no usa inicio de sesión');
  });

  it('never shows the message of an unknown error', () => {
    render(<ErrorBanner error={new Error('internal stack detail /secret/path')} />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).not.toContain('/secret/path');
    expect(text).toContain('Ocurrió un error inesperado');
  });
});
