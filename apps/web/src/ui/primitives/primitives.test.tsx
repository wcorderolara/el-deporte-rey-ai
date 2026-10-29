import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Alert } from './Alert';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { LoadingState } from './LoadingState';
import { Select } from './Select';
import { Textarea } from './Textarea';

afterEach(cleanup);

describe('design-system actions', () => {
  it('keeps Button native, actionable and loading-safe', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={onClick}>Generar contenido</Button>);

    const button = screen.getByRole('button', { name: 'Generar contenido' });
    expect(button.getAttribute('type')).toBe('button');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button onClick={onClick} isLoading loadingLabel="Generando contenido">
        Generar contenido
      </Button>,
    );
    const loading = screen.getByRole('button', { name: 'Generando contenido' });
    expect((loading as HTMLButtonElement).disabled).toBe(true);
    expect(loading.getAttribute('aria-busy')).toBe('true');
  });

  it('requires IconButton callers to supply its accessible name', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <IconButton label="Cerrar panel" onClick={onClick}>
        ×
      </IconButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar panel' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('design-system form controls', () => {
  it('connects Input labels, guidance, required state and errors', () => {
    render(
      <Input
        id="headline"
        label="Titular"
        description="Máximo 80 caracteres."
        error="El titular es obligatorio."
        required
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Titular' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('headline-description headline-error');
    expect((input as HTMLInputElement).required).toBe(true);
  });

  it('keeps Select and Textarea as labelled native controls', () => {
    render(
      <>
        <Select id="format" label="Formato" defaultValue="carousel">
          <option value="carousel">Carrusel</option>
        </Select>
        <Textarea id="summary" label="Resumen" defaultValue="Crónica deportiva" />
      </>,
    );

    expect(screen.getByRole('combobox', { name: 'Formato' }).tagName).toBe('SELECT');
    expect(screen.getByRole('textbox', { name: 'Resumen' }).tagName).toBe('TEXTAREA');
  });
});

describe('design-system feedback and surfaces', () => {
  it('preserves the semantic element selected for Card', () => {
    render(
      <Card as="article" aria-label="Vista previa">
        Contenido
      </Card>,
    );
    expect(screen.getByRole('article', { name: 'Vista previa' })).toBeTruthy();
  });

  it('renders visible text for Badge status meaning', () => {
    render(
      <Badge tone="success" symbol="✓">
        Verificado
      </Badge>,
    );
    expect(screen.getByText('Verificado')).toBeTruthy();
  });

  it('lets callers choose the appropriate live-region role for Alert', () => {
    render(
      <Alert tone="danger" role="alert" title="No se pudo generar">
        Intenta nuevamente.
      </Alert>,
    );
    expect(screen.getByRole('alert').textContent).toContain('No se pudo generar');
    expect(screen.getByRole('alert').textContent).toContain('Intenta nuevamente.');
  });

  it('uses the requested heading level in EmptyState', () => {
    render(<EmptyState headingLevel={3} title="Sin proyectos" description="Crea tu primer contenido." />);
    expect(screen.getByRole('heading', { level: 3, name: 'Sin proyectos' })).toBeTruthy();
  });

  it('announces LoadingState politely', () => {
    render(<LoadingState label="Preparando vista previa" />);
    const loading = screen.getByRole('status');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    expect(loading.textContent).toContain('Preparando vista previa');
  });
});
