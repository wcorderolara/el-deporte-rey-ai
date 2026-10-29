import { createElement, type HTMLAttributes, type ReactNode } from 'react';

import { classNames } from '../format';
import { Card } from './Card';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  action?: ReactNode;
  description: ReactNode;
  headingLevel?: 2 | 3 | 4;
  icon?: ReactNode;
  title: ReactNode;
}

/** Helpful absence state with an explicit heading level and optional next action. */
export function EmptyState({
  action,
  className,
  description,
  headingLevel = 2,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <Card
      {...props}
      as="section"
      className={classNames('grid justify-items-center gap-3 px-6 py-10 text-center', className)}
    >
      {icon === undefined ? null : (
        <span aria-hidden="true" className="text-heading-md text-brand-gold">
          {icon}
        </span>
      )}
      {createElement(
        `h${String(headingLevel)}`,
        { className: 'm-0 font-display text-heading-sm font-extrabold tracking-heading text-text-primary' },
        title,
      )}
      <div className="max-w-reading font-sans text-body-md text-text-secondary">{description}</div>
      {action === undefined ? null : <div className="mt-2">{action}</div>}
    </Card>
  );
}
