import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { classNames } from '../format';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}

const tones = {
  default: 'border-border-default bg-surface-card text-text-secondary hover:border-brand-blue hover:text-text-primary',
  danger: 'border-danger bg-danger-surface text-danger hover:bg-danger hover:text-text-inverse',
} as const;

/** Icon-only action with a mandatory accessible name and a 44px minimum target. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, className, disabled, label, tone = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      className={classNames(
        'focus-studio inline-flex size-touch shrink-0 items-center justify-center rounded-control border-hairline font-sans shadow-control',
        'transition-[background-color,border-color,color,transform] duration-fast ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-[var(--control-disabled-opacity)] active:translate-y-press',
        tones[tone],
        className,
      )}
      disabled={disabled}
    >
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        {children}
      </span>
    </button>
  );
});
