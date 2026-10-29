import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';

import { classNames } from '../format';
import { controlClassName, descriptionIds, FieldFrame } from './Field';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

/** Labelled native select; native keyboard and platform behavior are deliberately preserved. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    'aria-describedby': describedBy,
    children,
    className,
    description,
    error,
    id,
    label,
    required,
    wrapperClassName,
    ...props
  },
  ref,
) {
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <select
        {...props}
        ref={ref}
        id={id}
        required={required}
        className={classNames(controlClassName, className)}
        aria-invalid={error === undefined || error === null ? undefined : true}
        aria-describedby={descriptionIds(id, description, error, describedBy)}
      >
        {children}
      </select>
    </FieldFrame>
  );
});
