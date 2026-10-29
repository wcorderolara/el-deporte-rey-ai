import type { ProjectSummary } from '@edr/contracts';
import { useId } from 'react';
import { Link } from 'react-router';
import { Badge, buttonClassName, Card, dataModeLabel, formatDateTime } from '../../ui';
import { approvalStateLabel, createCopy, languageLabel, listCopy } from './copy';
import { dashboardState } from './dashboardModel';
import { projectPath } from './paths';

export function ProjectCard({ project, recommended = false }: { project: ProjectSummary; recommended?: boolean }) {
  const id = useId();
  const state = dashboardState(project);
  const demo = project.demonstration || project.dataMode === 'DEMO_DATA';
  return (
    <Card as="article" aria-labelledby={id} className="flex h-full flex-col gap-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption font-bold tracking-label text-info uppercase">Carrusel · 4:5</span>
        {recommended ? <span className="text-caption font-bold text-brand-gold">Para continuar</span> : null}
      </div>
      <div className="min-w-0 border-l-4 border-brand-purple pl-3">
        <p className="m-0 mb-2 text-caption text-text-secondary">
          {project.competitionName} · {project.seasonLabel}
        </p>
        <h3 id={id} className="m-0 break-words font-display text-heading-sm font-extrabold tracking-heading">
          <Link
            className="focus-studio text-text-primary no-underline hover:text-brand-gold"
            to={projectPath(project.id)}
          >
            {project.title}
          </Link>
        </h3>
        <p className="m-0 mt-2 text-body-sm text-text-secondary">
          {stageDisplay(project.stageLabel, project.matchday)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={state.tone}>{state.label}</Badge>
        <Badge>{languageLabel[project.language]}</Badge>
        {demo ? (
          <Badge tone="demo" symbol="⚠">
            Demostración
          </Badge>
        ) : (
          <Badge>{dataModeLabel[project.dataMode]}</Badge>
        )}
      </div>
      {demo ? (
        <p className="m-0 text-caption text-demo">Datos sintéticos. No son datos reales ni deben publicarse.</p>
      ) : null}
      <p className="m-0 text-body-sm text-text-secondary">{state.hint}</p>
      <div className="mt-auto grid gap-4">
        <p className="m-0 text-caption text-text-secondary">
          {project.lastExportAt === null ? 'Creado: ' : 'Última exportación: '}
          <time dateTime={project.lastExportAt ?? project.createdAt}>
            {formatDateTime(project.lastExportAt ?? project.createdAt)}
          </time>
        </p>
        <Link
          className={buttonClassName('secondary', 'sm', 'w-full')}
          to={state.to}
          aria-label={`${state.action}: ${project.title}`}
        >
          {state.action}
          <span aria-hidden="true"> →</span>
        </Link>
        <details className="border-t border-border-subtle pt-2 text-body-sm text-text-secondary">
          <summary className="focus-studio min-h-touch cursor-pointer content-center py-2 text-text-link">
            Detalles del proyecto
          </summary>
          <dl className="m-0 grid gap-1 break-words pb-3">
            <dt className="font-bold">Fuente de datos</dt>
            <dd className="m-0">{project.sourceName}</dd>
            <dt className="font-bold">Modo de datos</dt>
            <dd className="m-0">{dataModeLabel[project.dataMode]}</dd>
            <dt className="font-bold">Estado de aprobación</dt>
            <dd className="m-0">{approvalStateLabel[project.approvalState]}</dd>
            <dt className="font-bold">Creado</dt>
            <dd className="m-0">
              <time dateTime={project.createdAt}>{formatDateTime(project.createdAt)}</time>
            </dd>
            <dt className="font-bold">Última exportación</dt>
            <dd className="m-0">
              {project.lastExportAt === null ? (
                listCopy.neverExported
              ) : (
                <time dateTime={project.lastExportAt}>{formatDateTime(project.lastExportAt)}</time>
              )}
            </dd>
          </dl>
          <Link
            className="focus-studio inline-flex min-h-touch items-center text-text-link"
            to={`${projectPath(project.id)}/exports`}
          >
            Ver historial
          </Link>
        </details>
      </div>
    </Card>
  );
}

export function stageDisplay(stageLabel: string, matchday: number | null): string {
  return `${stageLabel} · ${matchday === null ? createCopy.wholeStage : createCopy.matchday(matchday)}`;
}
