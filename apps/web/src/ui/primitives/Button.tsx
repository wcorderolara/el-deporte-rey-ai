import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { classNames } from '../format';

/** `secondaryFilled` and `quiet` remain compatibility aliases; action buttons render with a solid hierarchy. */
export type ButtonVariant = 'primary' | 'secondary' | 'secondaryFilled' | 'quiet' | 'danger';
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
  'active:translate-y-press disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-button-disabled-bg ' +
  'disabled:bg-button-disabled-bg disabled:text-button-disabled-text disabled:shadow-none disabled:opacity-100';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-button-primary-bg bg-button-primary-bg text-button-primary-text shadow-gold-glow hover:border-button-primary-hover hover:bg-button-primary-hover active:border-button-primary-active active:bg-button-primary-active',
  secondary:
    'border-button-secondary-bg bg-button-secondary-bg text-button-secondary-text shadow-control hover:border-button-secondary-hover hover:bg-button-secondary-hover active:border-button-secondary-active active:bg-button-secondary-active',
  secondaryFilled:
    'border-button-secondary-bg bg-button-secondary-bg text-button-secondary-text shadow-control hover:border-button-secondary-hover hover:bg-button-secondary-hover active:border-button-secondary-active active:bg-button-secondary-active',
  quiet:
    'border-button-secondary-bg bg-button-secondary-bg text-button-secondary-text shadow-control hover:border-button-secondary-hover hover:bg-button-secondary-hover active:border-button-secondary-active active:bg-button-secondary-active',
  danger:
    'border-button-danger-bg bg-button-danger-bg text-button-danger-text shadow-control hover:border-button-danger-hover hover:bg-button-danger-hover active:border-button-danger-active active:bg-button-danger-active',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-body-sm',
  md: 'px-4 py-2.5 text-body-md',
  lg: 'px-5 py-3 text-body-lg',
};

/** Shared styling for router-composed links without coupling primitives to a router. */
export function buttonClassName(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return classNames(base, variants[variant], sizes[size], 'no-underline', className);
}

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
      className={buttonClassName(variant, size, className)}
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
