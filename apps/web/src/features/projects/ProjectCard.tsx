import type { ProjectSummary } from '@edr/contracts';
import { useId } from 'react';
import { Link } from 'react-router';
import { Badge, Button, buttonClassName, Card, formatDateTime, Icon, IconButton, iconButtonClassName } from '../../ui';
import { createCopy } from './copy';
import { contentTypeLabel, projectStatus, sportsContextSummary } from './dashboardModel';
import { projectPath } from './paths';

export interface ProjectActionsProps {
  project: ProjectSummary;
  onDelete: (project: ProjectSummary) => void;
  className?: string;
}

/** A tooltip for an icon-only action, shown on hover and keyboard focus (pattern of the season tables, 01D-D). */
function Tip({ id, children }: { id: string; children: string }) {
  return (
    <span
      id={id}
      role="tooltip"
      className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption font-semibold text-text-primary shadow-card group-hover:block group-focus-within:block"
    >
      {children}
    </span>
  );
}

/**
 * The two actions of a project in every state (PD-ARCH-01F): open its detail, always at `/projects/:projectId`, and
 * delete it after a confirmation. The table uses compact icon actions with tooltips; the cards use labelled buttons.
 * Both keep the same accessible names.
 */
export function ProjectActions({
  project,
  onDelete,
  compact = false,
  className,
}: ProjectActionsProps & { compact?: boolean }) {
  const viewTip = useId();
  const deleteTip = useId();
  if (compact) {
    return (
      <div className={className ?? 'flex items-center gap-2'}>
        <span className="group relative inline-flex">
          <Link
            className={iconButtonClassName('default')}
            to={projectPath(project.id)}
            aria-label={`Ver contenido: ${project.title}`}
            aria-describedby={viewTip}
          >
            <Icon name="eye" />
          </Link>
          <Tip id={viewTip}>Ver contenido</Tip>
        </span>
        <span className="group relative inline-flex">
          <IconButton
            label={`Eliminar: ${project.title}`}
            tone="danger"
            aria-describedby={deleteTip}
            onClick={() => onDelete(project)}
          >
            <Icon name="trash" />
          </IconButton>
          <Tip id={deleteTip}>Eliminar proyecto</Tip>
        </span>
      </div>
    );
  }
  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      <Link
        className={buttonClassName('primary', 'sm')}
        to={projectPath(project.id)}
        aria-label={`Ver contenido: ${project.title}`}
      >
        Ver contenido
      </Link>
      <Button variant="danger" size="sm" aria-label={`Eliminar: ${project.title}`} onClick={() => onDelete(project)}>
        Eliminar
      </Button>
    </div>
  );
}

export function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectSummary;
  onDelete: (project: ProjectSummary) => void;
}) {
  const id = useId();
  const state = projectStatus(project);
  return (
    <Card as="article" aria-labelledby={id} className="flex h-full min-w-0 flex-col gap-4 overflow-hidden">
      <p className="m-0 text-caption font-bold tracking-label text-info uppercase">{contentTypeLabel(project)}</p>
      <div className="grid min-w-0 gap-1">
        <h3
          id={id}
          className="m-0 break-normal text-pretty font-display text-heading-sm font-extrabold tracking-heading"
        >
          {project.title}
        </h3>
        <p className="m-0 text-body-sm text-text-secondary">{sportsContextSummary(project)}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge tone={state.tone}>{state.label}</Badge>
        <span className="text-caption text-text-subtle">
          Creado <time dateTime={project.createdAt}>{formatDateTime(project.createdAt)}</time>
        </span>
      </div>
      {/* The actions stay at the bottom of every card, whatever the length of the title. */}
      <ProjectActions project={project} onDelete={onDelete} className="mt-auto flex flex-wrap gap-2 pt-1" />
    </Card>
  );
}

export function stageDisplay(stageLabel: string, matchday: number | null): string {
  return `${stageLabel} · ${matchday === null ? createCopy.wholeStage : createCopy.matchday(matchday)}`;
}
