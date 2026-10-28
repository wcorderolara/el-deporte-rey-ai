import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DATA_MODES, UNVERIFIED_REASONS } from '../api/types';
import { AvailabilityNote } from './AvailabilityNote';
import { DataModeBadge } from './DataModeBadge';
import { DemoBanner } from './DemoBanner';
import { FactStatusBadge } from './FactStatusBadge';
import { ListingProvenance } from './ListingProvenance';
import { ProvenanceLabel } from './ProvenanceLabel';

afterEach(cleanup);

function toneOf(container: HTMLElement): string | null {
  return container.querySelector('[data-tone]')?.getAttribute('data-tone') ?? null;
}

describe('DataModeBadge', () => {
  it.each([
    ['LIVE_DATA', 'Datos en vivo'],
    ['MANUAL_DATA', 'Datos manuales'],
    ['DEMO_DATA', 'Datos de demostración'],
  ] as const)('labels %s in Spanish', (mode, label) => {
    const { container } = render(<DataModeBadge mode={mode} />);
    expect(container.textContent).toBe(label);
  });

  it('gives every mode a distinct text label', () => {
    const labels = DATA_MODES.map((mode) => {
      const { container, unmount } = render(<DataModeBadge mode={mode} />);
      const text = container.textContent;
      unmount();
      return text;
    });
    expect(new Set(labels).size).toBe(DATA_MODES.length);
  });
});

describe('FactStatusBadge', () => {
  it('labels a verified fact as verified', () => {
    const { container } = render(<FactStatusBadge status="verified" />);
    expect(container.textContent).toContain('Verificado');
    expect(toneOf(container)).toBe('positive');
  });

  it.each(UNVERIFIED_REASONS)('labels an unverified fact with its reason (%s)', (reason) => {
    const { container } = render(<FactStatusBadge status="unverified" unverifiedReason={reason} />);
    expect(container.textContent).toMatch(/^!?Sin verificar\(.+\)$/);
    expect(toneOf(container)).toBe('caution');
  });

  it('labels an unverified fact awaiting independent verification', () => {
    render(<FactStatusBadge status="unverified" unverifiedReason="awaiting_independent_verification" />);
    expect(screen.getByText('(pendiente de verificación independiente)')).toBeTruthy();
  });

  it('labels MANUALLY_APPROVED as operator-attested and never as verified', () => {
    const { container } = render(<FactStatusBadge status="manually_approved" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Aprobado manualmente');
    expect(text).toContain('atestiguado por el operador');
    expect(text).not.toMatch(/verific/i);
    expect(toneOf(container)).toBe('attested');
    expect(toneOf(container)).not.toBe('positive');
  });

  it('marks the status with a symbol hidden from assistive technology, never by colour alone', () => {
    const { container } = render(<FactStatusBadge status="verified" />);
    const symbol = container.querySelector('[aria-hidden="true"]');
    expect(symbol?.textContent).toBe('✓');
  });
});

describe('ProvenanceLabel', () => {
  it('shows commentary and template text', () => {
    const commentary = render(<ProvenanceLabel provenance="commentary" />);
    expect(commentary.container.textContent).toBe('Comentario');
    commentary.unmount();
    const template = render(<ProvenanceLabel provenance="template_text" />);
    expect(template.container.textContent).toBe('Texto de plantilla');
  });

  it('shows a fact with its current status', () => {
    const { container } = render(<ProvenanceLabel provenance="fact" factStatus="verified" />);
    expect(container.textContent).toContain('Dato: verificado');
    expect(toneOf(container)).toBe('positive');
  });

  it('never labels a fact without a status as verified', () => {
    const { container } = render(<ProvenanceLabel provenance="fact" factStatus={null} />);
    expect(container.textContent).toContain('Dato: sin verificar');
    expect(toneOf(container)).toBe('caution');
  });

  it('labels a manually approved fact as operator-attested, not verified', () => {
    const { container } = render(<ProvenanceLabel provenance="fact" factStatus="manually_approved" />);
    const text = container.textContent ?? '';
    expect(text).toContain('aprobado manualmente');
    expect(text).toContain('atestiguado por el operador');
    expect(text).not.toMatch(/verific/i);
    expect(toneOf(container)).toBe('attested');
  });
});

describe('DemoBanner', () => {
  it('labels the content as a demonstration with synthetic data', () => {
    render(<DemoBanner />);
    const banner = screen.getByRole('note', { name: 'Contenido de demostración' });
    expect(banner.textContent).toContain('datos sintéticos de demostración');
    expect(banner.textContent).toContain('no deben publicarse');
  });
});

describe('AvailabilityNote', () => {
  it('renders nothing when available', () => {
    const { container } = render(<AvailabilityNote availability={{ available: true, reason: null }} />);
    expect(container.innerHTML).toBe('');
  });

  it('explains a subscription restriction', () => {
    const { container } = render(
      <AvailabilityNote availability={{ available: false, reason: 'subscription_restricted' }} />,
    );
    expect(container.textContent).toBe('No disponible: No disponible con la suscripción actual de la fuente.');
  });

  it('explains a competition that is not found', () => {
    const { container } = render(<AvailabilityNote availability={{ available: false, reason: 'not_found' }} />);
    expect(container.textContent).toContain('La fuente no lo encuentra.');
  });

  it('explains an unavailable item without a reason', () => {
    const { container } = render(<AvailabilityNote availability={{ available: false, reason: null }} />);
    expect(container.textContent).toContain('No disponible por un motivo no indicado.');
  });

  it('explains standings that are not available', () => {
    const { container } = render(
      <AvailabilityNote standings={{ available: false, reason: 'not_provided_for_stage' }} />,
    );
    expect(container.textContent).toBe('Clasificación no disponible: Esta fase no tiene clasificación.');
  });

  it('renders nothing when standings are available', () => {
    const { container } = render(<AvailabilityNote standings={{ available: true, reason: null }} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('ListingProvenance', () => {
  it('shows the retrieval time and a fresh listing', () => {
    const { container } = render(
      <ListingProvenance
        listing={{ retrievedAt: '2026-10-27T15:00:00Z', fromCache: false, stale: false, retryAfterSeconds: null }}
      />,
    );
    const time = container.querySelector('time');
    expect(time?.getAttribute('dateTime')).toBe('2026-10-27T15:00:00Z');
    expect(container.textContent).toContain('Obtenido:');
    expect(container.textContent).toContain('consulta directa a la fuente');
    expect(container.textContent).not.toContain('desactualizados');
  });

  it('shows a stale cached listing and the wait before a new request', () => {
    const { container } = render(
      <ListingProvenance
        listing={{ retrievedAt: '2026-10-27T15:00:00Z', fromCache: true, stale: true, retryAfterSeconds: 30 }}
      />,
    );
    expect(container.textContent).toContain('desde la caché');
    expect(container.textContent).toContain('posiblemente desactualizados');
    expect(container.textContent).toContain('Nueva consulta posible en 30 segundos.');
  });

  it('shows a listing that was never retrieved', () => {
    const { container } = render(
      <ListingProvenance listing={{ retrievedAt: null, fromCache: true, stale: false, retryAfterSeconds: 1 }} />,
    );
    expect(container.querySelector('time')).toBeNull();
    expect(container.textContent).toContain('Sin fecha de obtención');
    expect(container.textContent).toContain('Nueva consulta posible en 1 segundo.');
  });
});
