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

  it('lists every import error in a table', () => {
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
              message: 'Person field refused',
            },
            { location: 'form', record: '/matches/1', field: null, problem: 'required_missing', message: 'Missing' },
          ],
        })}
      />,
    );
    const table = screen.getByRole('table', { name: '2 errores en la importación' });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Archivo 3');
    expect(rows[0]?.textContent).toContain('referee');
    expect(rows[0]?.textContent).toContain('Campo con datos de personas (no permitido)');
    expect(rows[1]?.textContent).toContain('Formulario /matches/1');
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
