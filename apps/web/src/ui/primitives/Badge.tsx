import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '../format';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'attested' | 'demo';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  symbol?: ReactNode;
  tone?: BadgeVariant;
}

const tones: Record<BadgeVariant, string> = {
  neutral: 'border-border-default bg-surface-card text-text-secondary',
  info: 'border-info bg-info-surface text-info',
  success: 'border-success bg-success-surface text-success',
  warning: 'border-warning bg-warning-surface text-warning',
  danger: 'border-danger bg-danger-surface text-danger',
  attested: 'border-attested bg-attested-surface text-attested border-dashed',
  demo: 'border-demo bg-demo-surface text-demo border-dashed',
};

/** Compact text status. Meaning must always be present in its visible label, never color alone. */
export function Badge({ children, className, symbol, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={classNames(
        'inline-flex min-h-6 items-center gap-1 rounded-control border-hairline px-2 py-0.5 font-sans text-caption font-bold',
        tones[tone],
        className,
      )}
    >
      {symbol === undefined ? null : <span aria-hidden="true">{symbol}</span>}
      <span>{children}</span>
    </span>
  );
}
