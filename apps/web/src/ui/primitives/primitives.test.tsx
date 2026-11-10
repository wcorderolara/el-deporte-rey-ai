import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';

import { ActionMenu } from './ActionMenu';
import { Alert } from './Alert';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { LoadingState } from './LoadingState';
import { Modal, ModalFooter } from './Modal';
import { Tabs } from './Tabs';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { ViewModeToggle } from './Modal';

afterEach(cleanup);

describe('design-system actions', () => {
  it('groups modal actions together at the right without spacing them apart', () => {
    render(
      <ModalFooter onCancel={vi.fn()}>
        <Button type="submit">Guardar cambios</Button>
      </ModalFooter>,
    );
    const footer = screen.getByRole('button', { name: 'Cancelar' }).parentElement;
    expect(footer?.className).toContain('justify-end');
    expect(footer?.className).toContain('gap-3');
    expect(footer?.className).not.toContain('justify-between');
    expect(footer?.textContent).toBe('CancelarGuardar cambios');
  });

  it('provides accessible tabs with arrow-key navigation', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs
        id="calendar-tabs"
        label="Organización"
        options={[
          { value: 'stages', label: 'Fases' },
          { value: 'direct', label: 'Jornadas directas' },
        ]}
        value="stages"
        onChange={onChange}
      />,
    );
    const tablist = screen.getByRole('tablist', { name: 'Organización' });
    const stages = screen.getByRole('tab', { name: 'Fases' });
    const direct = screen.getByRole('tab', { name: 'Jornadas directas' });
    expect(stages.getAttribute('aria-selected')).toBe('true');
    expect(stages.getAttribute('aria-controls')).toBe('calendar-tabs-panel-stages');
    expect(direct.getAttribute('tabindex')).toBe('-1');
    stages.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(direct);
    expect(onChange).toHaveBeenCalledWith('direct');
    expect(tablist.getAttribute('aria-label')).toBe('Organización');
  });

  it('closes a form dialog with Cancel or Escape without submitting it', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const user = userEvent.setup();
    const { rerender } = render(
      <Modal title="Crear fase" onClose={onClose}>
        <form onSubmit={onSubmit}>
          <Input id="modal-name" label="Nombre" />
          <ModalFooter onCancel={onClose}>
            <Button type="submit">Crear</Button>
          </ModalFooter>
        </form>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Nombre' }));
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    onClose.mockClear();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();
    rerender(
      <Modal title="Crear fase" onClose={onClose}>
        <form onSubmit={onSubmit}>
          <Input id="modal-name" label="Nombre" />
          <ModalFooter onCancel={onClose}>
            <Button type="submit">Crear</Button>
          </ModalFooter>
        </form>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exposes icon view controls with labels, tooltips and a selected state', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle value="table" onChange={onChange} />);
    const table = screen.getByRole('button', { name: 'Vista de tabla' });
    const cards = screen.getByRole('button', { name: 'Vista de tarjetas' });
    expect(table.getAttribute('aria-pressed')).toBe('true');
    expect(cards.getAttribute('aria-pressed')).toBe('false');
    expect(table.getAttribute('title')).toBe('Vista de tabla');
    expect(cards.getAttribute('title')).toBe('Vista de tarjetas');
    await user.click(cards);
    expect(onChange).toHaveBeenCalledWith('cards');
  });

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

  it('uses semantic solid variants and an explicit disabled treatment', () => {
    render(
      <>
        <Button variant="secondaryFilled">Revisar cambios</Button>
        <Button variant="secondary">Ver detalle</Button>
        <Button variant="danger" disabled>
          Cancelar consulta
        </Button>
      </>,
    );
    const filled = screen.getByRole('button', { name: 'Revisar cambios' });
    expect(filled.className).toContain('bg-button-secondary-bg');
    expect(filled.className).toContain('hover:bg-button-secondary-hover');
    expect(filled.className).toContain('focus-studio');
    expect(screen.getByRole('button', { name: 'Ver detalle' }).className).toContain('bg-button-secondary-bg');
    const cancel = screen.getByRole('button', { name: 'Cancelar consulta' });
    expect(cancel.className).toContain('bg-button-danger-bg');
    expect(cancel.className).toContain('disabled:bg-button-disabled-bg');
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
  });

  it('preserves native submit behavior while loading prevents duplicate submission', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Guardar cambios</Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSubmit).toHaveBeenCalledOnce();

    rerender(
      <form onSubmit={onSubmit}>
        <Button type="submit" isLoading loadingLabel="Guardando cambios">
          Guardar cambios
        </Button>
      </form>,
    );
    const loading = screen.getByRole('button', { name: 'Guardando cambios' });
    expect((loading as HTMLButtonElement).disabled).toBe(true);
    await user.click(loading);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('opens an action menu from its button, skips disabled actions and closes on an outside click', async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    const remove = vi.fn();
    render(
      <ActionMenu
        label="Más acciones de «Portada»"
        items={[
          { label: 'Archivar', onSelect: archive, disabled: true },
          { label: 'Eliminar', onSelect: remove, tone: 'danger' },
        ]}
      />,
    );
    const button = screen.getByRole('button', { name: 'Más acciones de «Portada»' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Más acciones de «Portada»' });
    expect(button.getAttribute('aria-controls')).toBe(menu.id);
    // The first enabled action takes the focus; a disabled one cannot be chosen.
    expect(document.activeElement?.textContent).toBe('Eliminar');
    await user.click(screen.getByRole('menuitem', { name: 'Archivar' }));
    expect(archive).not.toHaveBeenCalled();

    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
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
