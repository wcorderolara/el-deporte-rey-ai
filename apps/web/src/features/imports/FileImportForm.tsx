import type { ImportFileCreate } from '@edr/contracts';
import { useId, useRef, useState, type FormEvent } from 'react';

import { CSV_MATCHES_HEADER, CSV_STANDINGS_HEADER, fileCopy, importsCopy } from './copy';
import { IMPORT_FILE_ACCEPT, prepareFileImport, type FileImportErrors } from './fileImport';
import styles from './Imports.module.css';

export interface FileImportFormProps {
  /** True while an import is being sent (from either channel). */
  sending: boolean;
  /** Sends the import; resolves to true when it was applied. */
  onSend: (body: ImportFileCreate) => Promise<boolean>;
}

/**
 * File channel of createImport: a JSON or CSV file and an optional declared source. The file is checked (name, size)
 * before it is read, read as bytes and sent unchanged (`fileImport.ts`). Field errors are linked to their field and
 * focus moves to the first invalid field. After an applied import the file choice is cleared.
 */
export function FileImportForm({ sending, onSend }: FileImportFormProps) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [declaredSource, setDeclaredSource] = useState('');
  const [errors, setErrors] = useState<FileImportErrors>({});
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);

  const busy = sending || reading;
  const ids = {
    heading: `${id}-heading`,
    file: `${id}-file`,
    fileHint: `${id}-file-hint`,
    fileError: `${id}-file-error`,
    source: `${id}-source`,
    sourceHint: `${id}-source-hint`,
    sourceError: `${id}-source-error`,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setReading(true);
    const check = await prepareFileImport(file, declaredSource);
    setReading(false);
    if (!check.ok) {
      setErrors(check.errors);
      if (check.errors.file !== undefined) {
        fileRef.current?.focus();
      } else {
        sourceRef.current?.focus();
      }
      return;
    }
    setErrors({});
    const applied = await onSend(check.body);
    if (applied) {
      setFile(null);
      setFileInputKey((value) => value + 1);
    }
  }

  function describedBy(...candidates: Array<string | false>): string {
    return candidates.filter((value): value is string => value !== false).join(' ');
  }

  return (
    <section className={styles.section} aria-labelledby={ids.heading}>
      <h2 id={ids.heading}>{fileCopy.heading}</h2>
      <form className={styles.form} onSubmit={handleSubmit} noValidate aria-labelledby={ids.heading}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.file}>
            {fileCopy.fileField}
          </label>
          <p id={ids.fileHint} className={styles.hint}>
            {fileCopy.fileHint}
          </p>
          <input
            key={fileInputKey}
            ref={fileRef}
            id={ids.file}
            className={styles.input}
            type="file"
            accept={IMPORT_FILE_ACCEPT}
            required
            aria-invalid={errors.file === undefined ? undefined : true}
            aria-describedby={describedBy(ids.fileHint, errors.file !== undefined && ids.fileError)}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={sending}
          />
          {errors.file === undefined ? null : (
            <p id={ids.fileError} className={styles.fieldError}>
              {importsCopy.errorPrefix} {errors.file}
            </p>
          )}
        </div>

        <details>
          <summary>{fileCopy.layouts}</summary>
          <p>{fileCopy.jsonLayout}</p>
          <p>{fileCopy.csvMatchesLayout}</p>
          <code className={styles.layout} translate="no">
            {CSV_MATCHES_HEADER}
          </code>
          <p>{fileCopy.csvStandingsLayout}</p>
          <code className={styles.layout} translate="no">
            {CSV_STANDINGS_HEADER}
          </code>
        </details>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.source}>
            {fileCopy.sourceField}
          </label>
          <p id={ids.sourceHint} className={styles.hint}>
            {fileCopy.sourceHint}
          </p>
          <input
            ref={sourceRef}
            id={ids.source}
            className={styles.input}
            type="text"
            value={declaredSource}
            maxLength={80}
            autoComplete="off"
            aria-invalid={errors.declaredSource === undefined ? undefined : true}
            aria-describedby={describedBy(ids.sourceHint, errors.declaredSource !== undefined && ids.sourceError)}
            onChange={(event) => setDeclaredSource(event.target.value)}
            disabled={sending}
          />
          {errors.declaredSource === undefined ? null : (
            <p id={ids.sourceError} className={styles.fieldError}>
              {importsCopy.errorPrefix} {errors.declaredSource}
            </p>
          )}
        </div>

        <button className={styles.button} type="submit" disabled={busy} aria-busy={busy}>
          {busy ? fileCopy.submitting : fileCopy.submit}
        </button>
      </form>
    </section>
  );
}
