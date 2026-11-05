import type { ApprovalState, ProjectSummary } from '@edr/contracts';

/** Synthetic HTTP list responses for isolated visual states; never written to operator storage. */
export const dashboardProjects: ProjectSummary[] = (
  ['no_draft', 'in_review', 'final_approved', 'exported'] as const
).map((approvalState: ApprovalState, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  title: [
    'Liga Demo · Jornada decisiva',
    'Copa Demo · Resumen de la fecha',
    'Liga Manual · Análisis de resultados',
    'Copa Demo · Archivo de la jornada',
  ][index]!,
  competitionName: index === 2 ? 'Liga Manual Sintética' : 'Competición de demostración',
  seasonLabel: '2026/27',
  stageLabel: 'Temporada regular',
  matchday: index + 1,
  sourceName: 'Fuente sintética de prueba',
  dataMode: index === 2 ? 'MANUAL_DATA' : 'DEMO_DATA',
  demonstration: index !== 2,
  language: index === 3 ? 'en' : 'es',
  createdAt: `2026-10-${28 - index}T10:00:00Z`,
  approvalState,
  lastExportAt: index === 3 ? '2026-10-25T18:30:00Z' : null,
  latestRunStatus: 'completed',
  sportsContext: null,
}));
