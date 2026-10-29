import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '../format';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'title'> {
  children: ReactNode;
  icon?: ReactNode;
  role?: 'alert' | 'note' | 'status';
  title?: ReactNode;
  tone?: AlertTone;
}

const tones: Record<AlertTone, string> = {
  info: 'border-info bg-info-surface text-info',
  success: 'border-success bg-success-surface text-success',
  warning: 'border-warning bg-warning-surface text-warning',
  danger: 'border-danger bg-danger-surface text-danger',
};

/** Semantic feedback surface. Callers choose alert/status only when the message is dynamically announced. */
export function Alert({ children, className, icon, role = 'note', title, tone = 'info', ...props }: AlertProps) {
  return (
    <div
      {...props}
      role={role}
      className={classNames(
        'grid grid-cols-[auto_1fr] gap-3 rounded-card border-alert p-4 font-sans text-body-sm',
        tones[tone],
        className,
      )}
    >
      {icon === undefined ? <span aria-hidden="true">●</span> : <span aria-hidden="true">{icon}</span>}
      <div className="min-w-0 text-text-primary">
        {title === undefined ? null : <p className="m-0 mb-1 font-bold text-current">{title}</p>}
        <div className="text-text-secondary">{children}</div>
      </div>
    </div>
  );
}
