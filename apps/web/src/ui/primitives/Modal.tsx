import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export function ModalFooter({
  onCancel,
  cancelDisabled = false,
  children,
}: {
  onCancel: () => void;
  cancelDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
      <Button type="button" variant="secondary" disabled={cancelDisabled} onClick={onCancel}>
        Cancelar
      </Button>
      {children}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  closeDisabled = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeDisabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
    (
      dialog?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ??
      focusable()?.[0]
    )?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last!.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first!.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-modal-title"
        className="my-auto max-h-[min(90vh,48rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="studio-modal-title" className="m-0 font-display text-heading-md font-bold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            disabled={closeDisabled}
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg border border-border-subtle bg-transparent p-0 text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-card hover:text-text-primary focus-studio active:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-[var(--control-disabled-opacity)]"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: 'table' | 'cards';
  onChange: (value: 'table' | 'cards') => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-border-subtle bg-surface-raised p-1"
      role="group"
      aria-label="Formato de visualización"
    >
      {(['table', 'cards'] as const).map((mode) => {
        const label = mode === 'table' ? 'Vista de tabla' : 'Vista de tarjetas';
        const id = `view-mode-tip-${mode}`;
        return (
          <span key={mode} className="group relative inline-flex">
            <button
              type="button"
              aria-label={label}
              aria-describedby={id}
              aria-pressed={value === mode}
              title={label}
              className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg border border-transparent p-2 transition-colors focus-studio ${value === mode ? 'border-border-strong bg-surface-overlay text-brand-gold shadow-control' : 'bg-transparent text-text-secondary hover:border-border-subtle hover:bg-surface-card hover:text-text-primary'}`}
              onClick={() => onChange(mode)}
            >
              <Icon name={mode === 'table' ? 'table' : 'grid'} />
            </button>
            <span
              id={id}
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
            >
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
