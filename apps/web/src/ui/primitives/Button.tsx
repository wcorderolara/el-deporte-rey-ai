import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { classNames } from '../format';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const base =
  'focus-studio inline-flex min-h-touch items-center justify-center gap-2 rounded-control border-hairline font-sans font-bold ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-standard ' +
  'disabled:cursor-not-allowed disabled:opacity-[var(--control-disabled-opacity)] active:translate-y-press';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-brand-gold bg-brand-gold text-text-inverse shadow-gold-glow hover:brightness-110 active:brightness-95',
  secondary:
    'border-brand-blue bg-surface-card text-text-primary shadow-control hover:bg-brand-blue hover:text-brand-white',
  quiet:
    'border-border-default bg-transparent text-text-secondary hover:border-border-strong hover:bg-surface-card hover:text-text-primary',
  danger: 'border-danger bg-danger-surface text-danger hover:bg-danger hover:text-text-inverse active:brightness-95',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-body-sm',
  md: 'px-4 py-2.5 text-body-md',
  lg: 'px-5 py-3 text-body-lg',
};

/** Token-backed action button. Loading is announced and prevents duplicate activation. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled = false,
    isLoading = false,
    leadingIcon,
    loadingLabel = 'Cargando',
    size = 'md',
    trailingIcon,
    type = 'button',
    variant = 'primary',
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classNames(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 animate-spin rounded-pill border-spinner border-current border-r-transparent"
        />
      ) : (
        leadingIcon
      )}
      <span>{isLoading ? loadingLabel : children}</span>
      {isLoading ? null : trailingIcon}
    </button>
  );
});
