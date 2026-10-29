import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { classNames } from '../format';
import { controlClassName, descriptionIds, FieldFrame } from './Field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

/** Labelled multiline control with a useful default height and native resize behavior. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
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
      <textarea
        {...props}
        ref={ref}
        id={id}
        required={required}
        className={classNames(controlClassName, 'min-h-28 resize-y', className)}
        aria-invalid={error === undefined || error === null ? undefined : true}
        aria-describedby={descriptionIds(id, description, error, describedBy)}
      />
    </FieldFrame>
  );
});
