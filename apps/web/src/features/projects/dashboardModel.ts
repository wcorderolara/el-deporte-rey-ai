import type { ApprovalState, ProjectSummary } from '@edr/contracts';
import type { BadgeVariant } from '../../ui';
import { projectPath } from './paths';

interface DashboardState {
  label: string;
  tone: BadgeVariant;
  action: string;
  suffix: string;
  hint: string;
}

/** Approval summary only: running/failed executions are not available in the list contract. */
const states: Record<ApprovalState, DashboardState> = {
  no_draft: {
    label: 'En preparación',
    tone: 'neutral',
    action: 'Continuar',
    suffix: '',
    hint: 'Abre el proyecto para consultar el progreso y continuar la creación.',
  },
  in_review: {
    label: 'Pendiente de revisión',
    tone: 'warning',
    action: 'Revisar contenido',
    suffix: '/review',
    hint: 'Revisa el borrador, los datos y las advertencias antes de aprobar.',
  },
  final_approved: {
    label: 'Listo para descargar',
    tone: 'success',
    action: 'Descargar contenido',
    suffix: '/exports',
    hint: 'La aprobación final está registrada. Comprueba la disponibilidad en descargas.',
  },
  exported: {
    label: 'Exportado',
    tone: 'info',
    action: 'Ver contenido',
    suffix: '/exports',
    hint: 'Consulta los archivos y el historial de descargas de este proyecto.',
  },
};
export function dashboardState(project: ProjectSummary) {
  const state = states[project.approvalState];
  return { ...state, to: `${projectPath(project.id)}${state.suffix}` };
}
