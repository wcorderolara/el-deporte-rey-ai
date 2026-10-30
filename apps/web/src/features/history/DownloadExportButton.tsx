import { useEffect, useState } from 'react';

import { ApiError } from '../../api/client';
import { downloadExport, saveExportZip, useHistoryApi } from './api';

export function DownloadExportButton({
  exportId,
  className,
  containerClassName,
  label = 'Descargar carrusel',
}: {
  exportId: string;
  className?: string;
  containerClassName?: string;
  label?: string;
}) {
  const client = useHistoryApi();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message !== 'La descarga está lista.') return;
    const timeout = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);
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
    <span className={containerClassName}>
      <button type="button" className={className} onClick={() => void download()} disabled={busy}>
        {busy ? 'Preparando descarga…' : label}
      </button>
      <span role="status" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
