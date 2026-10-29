import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { classNames } from '../format';
import { controlClassName, descriptionIds, FieldFrame } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'size'> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

/** Labelled native input with connected hint/error text and no hidden validation semantics. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { 'aria-describedby': describedBy, className, description, error, id, label, required, wrapperClassName, ...props },
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
      <input
        {...props}
        ref={ref}
        id={id}
        required={required}
        className={classNames(controlClassName, className)}
        aria-invalid={error === undefined || error === null ? undefined : true}
        aria-describedby={descriptionIds(id, description, error, describedBy)}
      />
    </FieldFrame>
  );
});
