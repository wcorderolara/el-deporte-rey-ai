import type { ExportFile } from '@edr/contracts';

import { exportFileKindLabel, filesCopy } from './copy';
import styles from './History.module.css';

export interface ExportFilesProps {
  /** Export folder, relative to the data directory. */
  directory: string;
  files: readonly ExportFile[];
}

/** Order of the file list: slide images by position, then caption.txt, then manifest.json (AD-17). */
const kindOrder: Record<ExportFile['kind'], number> = { slide_image: 0, caption_text: 1, manifest: 2 };

function sortFiles(files: readonly ExportFile[]): ExportFile[] {
  return [...files].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.position - b.position);
}

/**
 * Folder path and file list of an export (R-218): `01.png` to `NN.png`, `caption.txt` and `manifest.json`, with
 * their SHA-256 and element version. Everything is shown as text; nothing is a link.
 */
export function ExportFiles({ directory, files }: ExportFilesProps) {
  return (
    <>
      <p className={styles.directory}>
        <strong>{filesCopy.directory}:</strong>{' '}
        <code className={styles.path} dir="ltr" translate="no" data-testid="export-directory">
          {directory}
        </code>
      </p>
      <div className={styles.tableWrapper} role="region" aria-label={filesCopy.scrollRegion} tabIndex={0}>
        <table className={styles.table}>
          <caption>{filesCopy.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{filesCopy.fileName}</th>
              <th scope="col">{filesCopy.kind}</th>
              <th scope="col">{filesCopy.position}</th>
              <th scope="col">{filesCopy.sha256}</th>
              <th scope="col">{filesCopy.elementVersion}</th>
            </tr>
          </thead>
          <tbody>
            {sortFiles(files).map((file) => (
              <tr key={file.fileName} data-testid="export-file">
                <th scope="row">
                  <code translate="no">{file.fileName}</code>
                </th>
                <td>{exportFileKindLabel[file.kind]}</td>
                <td>{file.position}</td>
                <td>
                  <code className={styles.hash} translate="no">
                    {file.sha256}
                  </code>
                </td>
                <td>
                  {file.elementVersionId === null ? (
                    filesCopy.noElementVersion
                  ) : (
                    <code className={styles.hash} translate="no">
                      {file.elementVersionId}
                    </code>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
