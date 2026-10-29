import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from '../format';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section';
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  surface?: 'subtle' | 'raised' | 'overlay';
}

const paddings = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' } as const;
const surfaces = {
  subtle: 'bg-surface-subtle',
  raised: 'bg-surface-raised',
  overlay: 'bg-surface-overlay shadow-card',
} as const;

/** Neutral structural surface; domain components choose its semantic element and accessible label. */
export function Card({
  as: Element = 'div',
  children,
  className,
  padding = 'md',
  surface = 'raised',
  ...props
}: CardProps) {
  return (
    <Element
      {...props}
      className={classNames(
        'min-w-0 rounded-card border-hairline border-border-subtle font-sans text-text-primary',
        paddings[padding],
        surfaces[surface],
        className,
      )}
    >
      {children}
    </Element>
  );
}
