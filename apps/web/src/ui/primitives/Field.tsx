import type { ReactNode } from 'react';

import { classNames } from '../format';

export const controlClassName = classNames(
  'focus-studio block min-h-touch w-full rounded-control border-hairline border-border-default bg-surface-raised px-3 py-2.5',
  'font-sans text-body-md text-text-primary shadow-control placeholder:text-text-subtle',
  'transition-[background-color,border-color,box-shadow] duration-fast ease-standard',
  'hover:border-border-strong focus-visible:border-focus disabled:cursor-not-allowed disabled:opacity-[var(--control-disabled-opacity)]',
  'aria-[invalid=true]:border-danger',
);

export interface FieldFrameProps {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  error?: ReactNode;
  id: string;
  label: ReactNode;
  required?: boolean;
}

export function descriptionIds(
  id: string,
  description: ReactNode,
  error: ReactNode,
  external?: string,
): string | undefined {
  const ids = [
    external,
    description === undefined || description === null ? undefined : `${id}-description`,
    error === undefined || error === null ? undefined : `${id}-error`,
  ].filter((value): value is string => value !== undefined && value !== '');
  return ids.length === 0 ? undefined : ids.join(' ');
}

/** Shared label, hint and error structure used by the native form-control primitives. */
export function FieldFrame({ children, className, description, error, id, label, required = false }: FieldFrameProps) {
  return (
    <div className={classNames('grid min-w-0 gap-1.5 font-sans', className)}>
      <label htmlFor={id} className="text-body-sm font-bold text-text-primary">
        {label}
        {required ? (
          <span className="text-warning" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {description === undefined || description === null ? null : (
        <p id={`${id}-description`} className="m-0 text-body-sm text-text-secondary">
          {description}
        </p>
      )}
      {children}
      {error === undefined || error === null ? null : (
        <p id={`${id}-error`} className="m-0 text-body-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
