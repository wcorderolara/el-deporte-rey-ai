import { useState } from 'react';

import { ApiError } from '../../api/client';
import { downloadExport, saveExportZip, useHistoryApi } from './api';

export function DownloadExportButton({ exportId, className }: { exportId: string; className?: string }) {
  const client = useHistoryApi();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function download() {
    setBusy(true);
    setMessage('');
    try {
      saveExportZip(await downloadExport(client, exportId), exportId);
      setMessage('La descarga está lista.');
    } catch (error) {
      const code = error instanceof ApiError ? error.problem?.code : undefined;
      setMessage(
        code === 'EXPORT_FILES_MISSING'
          ? 'Los archivos de esta exportación ya no están disponibles.'
          : code === 'EXPORT_FILES_CORRUPT'
            ? 'No se pudo verificar esta exportación. Revisa los detalles o contacta soporte.'
            : 'No se pudo descargar el carrusel. Comprueba la conexión e inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      <button type="button" className={className} onClick={() => void download()} disabled={busy}>
        {busy ? 'Preparando descarga…' : 'Descargar carrusel'}
      </button>
      <span role="status" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
