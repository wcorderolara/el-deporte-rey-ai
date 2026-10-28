import type { ImportError, Language } from '@edr/contracts';

import { errorCopy } from '../../ui';
import { importErrorDetail, importProblemText, importRecordText, UI_LANGUAGE } from './importErrorText';
import styles from './Imports.module.css';

export interface ImportErrorTableProps {
  errors: readonly ImportError[];
  /** Language of the texts built from the closed codes; the interface language by default (OD-63). */
  language?: Language;
}

/**
 * Every error of a rejected import by record, field, problem and detail (R-061, R-274). The record is labelled by its
 * kind (CSV row, JSON pointer, form entry, whole file or form; OD-63 F-1) and the problem and detail come from the
 * closed `problem` code with the field as the only parameter (F-2); the server's English `message` is not shown.
 * Field names and pointers are identifiers, shown as code and never translated. Text only.
 */
export function ImportErrorTable({ errors, language = UI_LANGUAGE }: ImportErrorTableProps) {
  return (
    <div className={styles.errorTableWrapper}>
      <table className={styles.errorTable}>
        <caption>{errorCopy.importErrorsTitle(errors.length)}</caption>
        <thead>
          <tr>
            <th scope="col">{errorCopy.importErrorRecord}</th>
            <th scope="col">{errorCopy.importErrorField}</th>
            <th scope="col">{errorCopy.importErrorProblem}</th>
            <th scope="col">{errorCopy.importErrorMessage}</th>
          </tr>
        </thead>
        <tbody lang={language}>
          {errors.map((importError, index) => {
            const record = importRecordText(importError, language);
            return (
              <tr key={`${importError.record}-${importError.field ?? ''}-${index}`} data-record-kind={record.kind}>
                <td>
                  {record.label}
                  {record.code === null ? null : (
                    <>
                      {' '}
                      <code translate="no">{record.code}</code>
                    </>
                  )}
                </td>
                <td>{importError.field === null ? '—' : <code translate="no">{importError.field}</code>}</td>
                <td>{importProblemText(importError.problem, language)}</td>
                <td>{importErrorDetail(importError, language)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
