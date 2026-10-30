import type { ProjectSummary } from '@edr/contracts';
import { useId } from 'react';
import { Link } from 'react-router';
import { Badge, buttonClassName, Card } from '../../ui';
import { createCopy } from './copy';
import { dashboardState } from './dashboardModel';

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const id = useId();
  const state = dashboardState(project);
  return (
    <Card as="article" aria-labelledby={id} className="grid h-full min-w-0 content-start gap-4 overflow-hidden">
      <p className="m-0 text-caption font-bold tracking-label text-info uppercase">Carrusel de Instagram · 4:5</p>
      <div className="min-w-0">
        <h3
          id={id}
          className="m-0 break-normal text-pretty font-display text-heading-sm font-extrabold tracking-heading"
        >
          {project.title}
        </h3>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>
      <Link
        className={buttonClassName('secondary', 'sm', 'w-full')}
        to={state.to}
        aria-label={`${state.action}: ${project.title}`}
      >
        {state.action}
        <span aria-hidden="true"> →</span>
      </Link>
    </Card>
  );
}

export function stageDisplay(stageLabel: string, matchday: number | null): string {
  return `${stageLabel} · ${matchday === null ? createCopy.wholeStage : createCopy.matchday(matchday)}`;
}
