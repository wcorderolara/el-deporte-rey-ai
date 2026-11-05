import type { ProjectSummary } from '@edr/contracts';

import type { BadgeVariant } from '../../ui';
import { pieceKindCopy } from './generationCopy';
import { createCopy } from './copy';

interface ProjectStatus {
  label: string;
  tone: BadgeVariant;
}

const approvalStatus: Record<ProjectSummary['approvalState'], ProjectStatus> = {
  no_draft: { label: 'En preparación', tone: 'neutral' },
  in_review: { label: 'Pendiente de revisión', tone: 'warning' },
  final_approved: { label: 'Listo para descargar', tone: 'success' },
  exported: { label: 'Exportado', tone: 'info' },
};

/**
 * The state shown for a project (PD-ARCH-01F): an active run is "en generación"; a failed run without content needs
 * attention; otherwise the approval summary of its content. Nothing else is inferred.
 */
export function projectStatus(project: ProjectSummary): ProjectStatus {
  if (project.latestRunStatus === 'pending' || project.latestRunStatus === 'running') {
    return { label: 'En generación', tone: 'info' };
  }
  if (project.latestRunStatus === 'failed' && project.approvalState === 'no_draft') {
    return { label: 'Generación fallida', tone: 'danger' };
  }
  return approvalStatus[project.approvalState];
}

/** The content type: the piece kind of a generated batch, else the results carousel of a catalogue selection. */
export function contentTypeLabel(project: ProjectSummary): string {
  return project.sportsContext === null ? 'Carrusel de resultados' : pieceKindCopy[project.sportsContext.kind].label;
}

/** A short sports context: competition, season and stage or round, from the stored labels only. */
export function sportsContextSummary(project: ProjectSummary): string {
  const context = project.sportsContext;
  if (context !== null) {
    const round = context.stageName === null ? context.roundName : `${context.stageName} · ${context.roundName}`;
    return `${context.competitionName} · ${context.seasonLabel} · ${round}`;
  }
  const stage =
    project.matchday === null ? project.stageLabel : `${project.stageLabel} · ${createCopy.matchday(project.matchday)}`;
  return `${project.competitionName} · ${project.seasonLabel} · ${stage}`;
}
