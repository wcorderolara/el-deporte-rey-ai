import type { HTMLAttributes } from 'react';

import { classNames } from '../format';

export interface LoadingStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string;
  layout?: 'inline' | 'panel';
}

/** Polite loading announcement with animation that obeys the global reduced-motion override. */
export function LoadingState({ className, label = 'Cargando', layout = 'inline', ...props }: LoadingStateProps) {
  return (
    <div
      {...props}
      role="status"
      aria-live="polite"
      className={classNames(
        'font-sans text-body-sm text-text-secondary',
        layout === 'panel'
          ? 'grid min-h-36 place-items-center rounded-card border-hairline border-border-subtle bg-surface-raised p-6'
          : 'inline-flex items-center gap-2',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-pill border-spinner border-brand-blue border-r-transparent"
      />
      <span>{label}</span>
    </div>
  );
}
