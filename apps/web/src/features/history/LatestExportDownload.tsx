import { buttonClassName } from '../../ui';
import { loadProjectExports, useHistoryApi } from './api';
import { DownloadExportButton } from './DownloadExportButton';
import { useLoad } from './useLoad';

/** Compact direct-download action for a saved export, without rerunning generation. */
export function LatestExportDownload({ projectId }: { projectId: string }) {
  const client = useHistoryApi();
  const request = useLoad(`latest-export\u0000${projectId}`, (signal) => loadProjectExports(client, projectId, signal));
  const latest = request.latest?.[0];
  if (!latest) return null;
  return (
    <DownloadExportButton
      exportId={latest.id}
      className={buttonClassName('primary', 'md')}
      label="Descargar carrusel"
    />
  );
}
