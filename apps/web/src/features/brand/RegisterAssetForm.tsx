import { BrandAssetKindSchema, LabelSchema, type BrandAsset, type BrandAssetKind } from '@edr/contracts';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { ErrorBanner } from '../../ui';
import { ASSET_ACCEPT, isAssetMime, MAX_ASSET_BYTES, type BrandApi, type RegisterAssetInput } from './brandApi';
import styles from './Brand.module.css';
import { assetKindDescription, assetKindLabel, registerCopy } from './copy';

/** The registrable kinds, in contract order. There is no badge or competition-mark kind (PD-03, R-049). */
const ASSET_KINDS: readonly BrandAssetKind[] = BrandAssetKindSchema.options;

const LABEL_MAX_LENGTH = 80;

export interface RegistrationValues {
  kind: BrandAssetKind | null;
  label: string;
  file: File | null;
}

export interface RegistrationErrors {
  kind?: string;
  label?: string;
  file?: string;
}

export type RegistrationCheck = { ok: true; input: RegisterAssetInput } | { ok: false; errors: RegistrationErrors };

/**
 * Client-side checks before the upload: a kind, a printable label (contract `Label`) and a PNG or JPEG file of at
 * most 5 MiB. They only spare a round trip; the server stays authoritative (signature, dimensions, decoding).
 */
export function checkRegistration(values: RegistrationValues): RegistrationCheck {
  const errors: RegistrationErrors = {};
  const label = values.label.trim();
  if (values.kind === null) {
    errors.kind = registerCopy.kindRequired;
  }
  if (label === '') {
    errors.label = registerCopy.labelRequired;
  } else if (label.length > LABEL_MAX_LENGTH) {
    errors.label = registerCopy.labelTooLong;
  } else if (!LabelSchema.safeParse(label).success) {
    errors.label = registerCopy.labelInvalid;
  }
  const file = values.file;
  if (file === null) {
    errors.file = registerCopy.fileRequired;
  } else if (!isAssetMime(file.type)) {
    errors.file = registerCopy.fileType;
  } else if (file.size === 0) {
    errors.file = registerCopy.fileEmpty;
  } else if (file.size > MAX_ASSET_BYTES) {
    errors.file = registerCopy.fileTooLarge;
  }
  if (values.kind === null || file === null || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, input: { kind: values.kind, label, file } };
}

export interface RegisterAssetFormProps {
  api: BrandApi;
  onRegistered: (asset: BrandAsset) => void;
}

/**
 * Form of registerBrandAsset: kind among brand logo, mascot and decoration, a label and a PNG or JPEG file. Field
 * errors are linked to their field and focus moves to the first invalid field; a server refusal (for example a
 * duplicate file, a type that does not match the file signature or a file too large) is announced with its reason.
 */
export function RegisterAssetForm({ api, onRegistered }: RegisterAssetFormProps) {
  const id = useId();
  const [kind, setKind] = useState<BrandAssetKind | null>(null);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [lastInput, setLastInput] = useState<RegisterAssetInput | null>(null);

  const firstKindRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const ids = {
    kindError: `${id}-kind-error`,
    label: `${id}-label`,
    labelHint: `${id}-label-hint`,
    labelError: `${id}-label-error`,
    file: `${id}-file`,
    fileHint: `${id}-file-hint`,
    fileError: `${id}-file-error`,
  };

  function send(input: RegisterAssetInput) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmitting(true);
    setServerError(null);
    setLastInput(input);
    api.registerAsset(input, controller.signal).then(
      (asset) => {
        if (controller.signal.aborted) {
          return;
        }
        setSubmitting(false);
        setLastInput(null);
        setKind(null);
        setLabel('');
        setFile(null);
        setFileInputKey((value) => value + 1);
        onRegistered(asset);
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSubmitting(false);
        setServerError(error);
      },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const check = checkRegistration({ kind, label, file });
    if (!check.ok) {
      setErrors(check.errors);
      setServerError(null);
      if (check.errors.kind !== undefined) {
        firstKindRef.current?.focus();
      } else if (check.errors.label !== undefined) {
        labelRef.current?.focus();
      } else {
        fileRef.current?.focus();
      }
      return;
    }
    setErrors({});
    send(check.input);
  }

  function describedBy(...candidates: Array<string | false>): string {
    return candidates.filter((value): value is string => value !== false).join(' ');
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{registerCopy.heading}</h2>
      <form className={styles.form} onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-heading`}>
        <fieldset className={styles.fieldset} aria-describedby={errors.kind === undefined ? undefined : ids.kindError}>
          <legend className={styles.legend}>{registerCopy.kindLegend}</legend>
          {ASSET_KINDS.map((value, index) => (
            <label key={value} className={styles.option}>
              <input
                ref={index === 0 ? firstKindRef : undefined}
                type="radio"
                name={`${id}-kind`}
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                disabled={submitting}
              />
              <span>
                {assetKindLabel[value]}
                <span className={styles.optionDescription}>{assetKindDescription[value]}</span>
              </span>
            </label>
          ))}
          {errors.kind === undefined ? null : (
            <p id={ids.kindError} className={styles.fieldError}>
              {registerCopy.errorPrefix} {errors.kind}
            </p>
          )}
        </fieldset>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.label}>
            {registerCopy.labelField}
          </label>
          <p id={ids.labelHint} className={styles.hint}>
            {registerCopy.labelHint}
          </p>
          <input
            ref={labelRef}
            id={ids.label}
            className={styles.input}
            type="text"
            value={label}
            maxLength={LABEL_MAX_LENGTH}
            autoComplete="off"
            required
            aria-invalid={errors.label === undefined ? undefined : true}
            aria-describedby={describedBy(ids.labelHint, errors.label !== undefined && ids.labelError)}
            onChange={(event) => setLabel(event.target.value)}
            disabled={submitting}
          />
          {errors.label === undefined ? null : (
            <p id={ids.labelError} className={styles.fieldError}>
              {registerCopy.errorPrefix} {errors.label}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.file}>
            {registerCopy.fileField}
          </label>
          <p id={ids.fileHint} className={styles.hint}>
            {registerCopy.fileHint}
          </p>
          <input
            key={fileInputKey}
            ref={fileRef}
            id={ids.file}
            className={styles.input}
            type="file"
            accept={ASSET_ACCEPT}
            required
            aria-invalid={errors.file === undefined ? undefined : true}
            aria-describedby={describedBy(ids.fileHint, errors.file !== undefined && ids.fileError)}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={submitting}
          />
          {errors.file === undefined ? null : (
            <p id={ids.fileError} className={styles.fieldError}>
              {registerCopy.errorPrefix} {errors.file}
            </p>
          )}
        </div>

        <button className={styles.button} type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? registerCopy.submitting : registerCopy.submit}
        </button>

        {serverError === null ? null : (
          <ErrorBanner
            error={serverError}
            title={registerCopy.failedTitle}
            {...(lastInput === null ? {} : { onRetry: () => send(lastInput) })}
          />
        )}
      </form>
    </section>
  );
}
