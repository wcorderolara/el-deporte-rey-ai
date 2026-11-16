/**
 * Confirmation of a project deletion (PD-ARCH-01F). The deletion is explicit: the dialog names the project, states
 * the real scope of the deletion and sends `deleteProject` only on confirmation. An active generation is cancelled
 * first by the server; a cancellation it cannot confirm is reported and nothing changes.
 */
import type { ProjectSummary } from '@edr/contracts';
import { useState } from 'react';

import { Button, ErrorBanner, Modal, ModalFooter } from '../../ui';
import { useProjectsDependencies } from './ProjectsContext';

export interface DeleteProjectDialogProps {
  project: ProjectSummary;
  onCancel: () => void;
  onDeleted: (project: ProjectSummary) => void;
}

export function DeleteProjectDialog({ project, onCancel, onDeleted }: DeleteProjectDialogProps) {
  const { api } = useProjectsDependencies();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const generating = project.latestRunStatus === 'pending' || project.latestRunStatus === 'running';

  async function confirm() {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await api.deleteProject(project.id);
      onDeleted(project);
    } catch (caught) {
      setError(caught);
      setDeleting(false);
    }
  }

  return (
    <Modal title="Eliminar proyecto" onClose={() => (deleting ? undefined : onCancel())} closeDisabled={deleting}>
      <div className="grid gap-4 text-body-md text-text-secondary">
        <p className="m-0">
          Vas a eliminar <strong className="text-text-primary">{project.title}</strong>.
        </p>
        <ul className="m-0 grid gap-2 pl-5">
          <li>
            El proyecto dejará de aparecer en Mis proyectos y no podrás abrir su contenido, revisión ni descargas.
          </li>
          {generating ? <li>La generación en curso se cancelará antes de eliminarlo.</li> : null}
          <li>
            Las competiciones, temporadas, equipos, partidos, resultados, plantillas, tu marca y los demás proyectos no
            cambian.
          </li>
          <li>El historial del proyecto se conserva internamente para su trazabilidad; esta acción no se deshace.</li>
        </ul>
        {error === null ? null : <ErrorBanner title="No se pudo eliminar el proyecto" error={error} />}
      </div>
      <ModalFooter onCancel={onCancel} cancelDisabled={deleting}>
        <Button variant="danger" isLoading={deleting} loadingLabel="Eliminando proyecto" onClick={() => void confirm()}>
          Eliminar proyecto
        </Button>
      </ModalFooter>
    </Modal>
  );
}
