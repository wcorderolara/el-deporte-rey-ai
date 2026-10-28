/**
 * Labelled inputs of the import form: each field has a visible label, an optional hint and its error messages, all
 * linked with `aria-describedby`; an invalid field is marked `aria-invalid`.
 */
import { importsCopy } from './copy';
import styles from './Imports.module.css';

function describedBy(id: string, hint: string | undefined, errors: readonly string[]): string | undefined {
  const parts = [hint === undefined ? null : `${id}-hint`, errors.length > 0 ? `${id}-error` : null].filter(
    (value): value is string => value !== null,
  );
  return parts.length === 0 ? undefined : parts.join(' ');
}

function FieldMessages({ id, hint, errors }: { id: string; hint: string | undefined; errors: readonly string[] }) {
  return (
    <>
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {errors.length === 0 ? null : (
        <p id={`${id}-error`} className={styles.fieldError}>
          {errors.map((message) => `${importsCopy.errorPrefix} ${message}`).join(' ')}
        </p>
      )}
    </>
  );
}

export interface InputFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors: readonly string[];
  hint?: string;
  type?: 'text' | 'number' | 'datetime-local';
  min?: number;
  max?: number;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
}

export function InputField({
  id,
  label,
  value,
  onChange,
  errors,
  hint,
  type = 'text',
  min,
  max,
  maxLength,
  disabled = false,
  required = true,
}: InputFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type={type}
        value={value}
        min={min}
        max={max}
        step={type === 'number' ? 1 : undefined}
        inputMode={type === 'number' ? 'numeric' : undefined}
        maxLength={maxLength}
        autoComplete="off"
        required={required}
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <FieldMessages id={id} hint={hint} errors={errors} />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder: string;
  errors: readonly string[];
  hint?: string;
  disabled?: boolean;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  errors,
  hint,
  disabled = false,
}: SelectFieldProps) {
  const known = value === '' || options.some((option) => option.value === value);
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.input}
        value={known ? value : ''}
        required
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={describedBy(id, hint, errors)}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages id={id} hint={hint} errors={errors} />
    </div>
  );
}
