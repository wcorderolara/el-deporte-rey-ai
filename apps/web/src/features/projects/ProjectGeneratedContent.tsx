import type { Carousel, Element, Project, TextFieldName } from '@edr/contracts';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { featurePaths } from '../../app/routes';
import { ApiError } from '../../api/client';
import { buttonClassName, ErrorBanner, LoadingState, StatusBadge } from '../../ui';
import { CarouselDownload } from '../history/CarouselDownload';
import { ProjectExportHistory } from '../history/ProjectExportHistory';
import { useReviewDependencies } from '../review/ReviewContext';
import { useDraft } from '../review/useDraft';
import { ReviewThumbnailRail, type ReviewThumbnail } from '../review/ReviewThumbnailRail';
import { SlidePanel, SlideWorkspace } from '../review/SlideWorkspace';
import { slideTypeLabel, textFieldLabel, versionStateLabel } from '../review/copy';
import { elementName, elementStatus } from '../review/model';

function fieldText(element: Element, field: string): string | null {
  const item = element.currentVersion.fields.find((entry) => entry.field === field);
  return (
    item?.segments
      .map((segment) => segment.text)
      .join(' ')
      .trim() || null
  );
}

/** The text fields of a slide shown in the side panel, in this order. */
const DETAIL_FIELDS = [
  'title',
  'headline',
  'match_status',
  'kickoff',
  'team_home',
  'score',
  'team_away',
  'fixtures',
] as const satisfies readonly TextFieldName[];

function carouselSlides(carousel: Carousel): Element[] {
  return carousel.elements.filter((element) => element.kind === 'slide').sort((a, b) => a.position - b.position);
}

/**
 * Actions of the selected carousel (PD-ARCH-01F): review it (or continue the review once something is approved)
 * and, once its final approval is valid, download it here without visiting another page.
 */
function ProjectPreviewActions({
  project,
  carousel,
  onExported,
  onStale,
}: {
  project: Project;
  carousel: Carousel;
  onExported: () => void;
  onStale: () => void;
}) {
  const approved = carousel.finalApproval?.valid === true;
  const started = carousel.elements.some((element) => element.currentVersion.state === 'approved');
  return (
    <div className="grid gap-2">
      {approved ? (
        <CarouselDownload
          projectId={project.id}
          carousel={carousel}
          onExported={onExported}
          onStale={onStale}
          className={buttonClassName('primary', 'md', 'w-full')}
        />
      ) : null}
      <Link
        className={buttonClassName(approved ? 'secondary' : 'primary', 'md', 'w-full')}
        to={featurePaths.review(project.id)}
      >
        {started && !approved ? 'Continuar revisión' : 'Revisar contenido'}
      </Link>
    </div>
  );
}

function ProjectEmptyContent({ project }: { project: Project }) {
  const failed = project.latestRun?.status === 'failed';
  return (
    <div className="grid min-w-0 gap-3 rounded-card border-hairline border-border-subtle bg-surface-raised p-4 sm:flex sm:flex-wrap sm:items-center">
      <p className="m-0 flex-1 text-body-sm text-text-secondary">
        {failed
          ? 'La última generación falló y no hay contenido para revisar.'
          : 'Todavía no hay contenido generado para este proyecto.'}
      </p>
      <Link className={buttonClassName('primary', 'md')} to="#project-generation">
        {failed ? 'Regenerar contenido' : 'Continuar creación'}
      </Link>
    </div>
  );
}

/**
 * The selected carousel in the slide workspace of the review (UX-REVIEW-01): the slide list with each slide's state,
 * the selected slide with its tools, and a side panel with the slide's content and the project actions.
 */
function ProjectCarouselPreview({
  project,
  carousel,
  onExported,
  onStale,
}: {
  project: Project;
  carousel: Carousel;
  onExported: () => void;
  onStale: () => void;
}) {
  const { api } = useReviewDependencies();
  const slides = carouselSlides(carousel);
  const [selectedId, setSelectedId] = useState<string | undefined>(slides[0]?.id);
  const selectedIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === selectedId),
  );
  const selectedSlide = slides[selectedIndex];
  const previousSlide = slides[selectedIndex - 1];
  const nextSlide = slides[selectedIndex + 1];
  const items: ReviewThumbnail[] = slides.map((slide) => {
    const status = elementStatus(slide);
    return {
      id: slide.id,
      position: slide.position,
      imageUrl: slide.currentVersion.imageUrl,
      imageSource: slide.currentVersion.imageUrl ? api.slideImageUrl(slide.currentVersion.id) : null,
      title: slide.slideType ? slideTypeLabel[slide.slideType] : 'Diapositiva',
      status: { label: status.label, tone: status.tone, symbol: status.symbol },
    };
  });

  if (!selectedSlide) {
    return <p className="m-0 text-body-sm text-text-secondary">El carrusel aún no contiene diapositivas.</p>;
  }

  const version = selectedSlide.currentVersion;
  const name = elementName(selectedSlide);
  const detailFields = DETAIL_FIELDS.map((field) => ({ field, value: fieldText(selectedSlide, field) })).filter(
    (item): item is { field: (typeof DETAIL_FIELDS)[number]; value: string } => item.value !== null,
  );

  return (
    <SlideWorkspace
      aria-labelledby="project-content-heading"
      navigation={
        <ReviewThumbnailRail
          label={`Miniaturas de ${project.title}`}
          heading={`${slides.length} diapositivas`}
          items={items}
          selectedId={selectedSlide.id}
          onSelect={setSelectedId}
          fill
        />
      }
      preview={{
        name,
        typeLabel: selectedSlide.slideType ? slideTypeLabel[selectedSlide.slideType] : null,
        version,
        imageSource: version.imageUrl ? api.slideImageUrl(version.id) : null,
        noImageText: 'La vista previa no está disponible.',
        pager: {
          position: selectedSlide.position,
          total: slides.length,
          ...(previousSlide ? { onPrevious: () => setSelectedId(previousSlide.id) } : {}),
          ...(nextSlide ? { onNext: () => setSelectedId(nextSlide.id) } : {}),
        },
      }}
      panel={
        <SlidePanel
          label="Contexto del contenido"
          eyebrow="Contenido del carrusel"
          badges={
            <StatusBadge
              label={versionStateLabel[version.state]}
              tone={version.state === 'approved' ? 'positive' : version.state === 'qa_failed' ? 'caution' : 'neutral'}
              symbol={version.state === 'approved' ? '✓' : version.state === 'qa_failed' ? '!' : '•'}
            />
          }
          title={name}
        >
          {detailFields.length ? (
            <dl className="m-0 grid gap-3">
              {detailFields.map(({ field, value }) => (
                <div key={field} className="min-w-0">
                  <dt className="text-caption font-bold text-text-secondary">{textFieldLabel[field]}</dt>
                  <dd className="m-0 whitespace-pre-line break-words text-body-md text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-body-sm text-text-secondary">Vista previa del contenido generado.</p>
          )}
          <ProjectPreviewActions project={project} carousel={carousel} onExported={onExported} onStale={onStale} />
        </SlidePanel>
      }
    />
  );
}

/**
 * Secondary, collapsible export history of the project (PD-ARCH-01F); the former exports page points here. The
 * history is requested only once the section is opened, or when the address names it.
 */
function ExportHistorySection({
  project,
  carousels,
  refreshKey,
}: {
  project: Project;
  carousels: readonly Carousel[];
  refreshKey: string;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(location.hash === '#project-exports');
  return (
    <details
      id="project-exports"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-card border-hairline border-border-subtle bg-surface-raised p-4"
    >
      <summary className="focus-studio min-h-touch cursor-pointer content-center font-bold text-text-link underline decoration-border-strong underline-offset-4">
        Historial de exportaciones
      </summary>
      {open ? (
        <div className="mt-3">
          <ProjectExportHistory projectId={project.id} carousels={carousels} refreshKey={refreshKey} />
        </div>
      ) : null}
    </details>
  );
}

function ActiveProjectContent({ project }: { project: Project }) {
  const { api } = useReviewDependencies();
  const draft = useDraft(api, project.id);
  const [exportsWritten, setExportsWritten] = useState(0);
  if (draft.state.status === 'loading') return <LoadingState layout="panel" label="Cargando contenido del proyecto…" />;
  if (draft.state.status === 'error') {
    const missingDraft =
      draft.state.error instanceof ApiError &&
      draft.state.error.kind === 'problem' &&
      draft.state.error.problem?.code === 'NOT_FOUND';
    if (missingDraft) {
      return (
        <>
          <ProjectEmptyContent project={project} />
          <ExportHistorySection project={project} carousels={[]} refreshKey="" />
        </>
      );
    }
    return <ErrorBanner title="No se pudo cargar el contenido" error={draft.state.error} onRetry={draft.reload} />;
  }
  const carousels = [...draft.state.draft.carousels].sort((a, b) => a.sequence - b.sequence);
  return (
    <>
      <DraftCarousels
        project={project}
        carousels={carousels}
        onExported={() => setExportsWritten((count) => count + 1)}
        onStale={() => void draft.refresh()}
      />
      <ExportHistorySection project={project} carousels={carousels} refreshKey={String(exportsWritten)} />
    </>
  );
}

function DraftCarousels({
  project,
  carousels,
  onExported,
  onStale,
}: {
  project: Project;
  carousels: Carousel[];
  onExported: () => void;
  onStale: () => void;
}) {
  const [selectedCarouselId, setSelectedCarouselId] = useState(carousels[0]?.id);
  const carousel = carousels.find((item) => item.id === selectedCarouselId) ?? carousels[0];
  if (!carousel)
    return <p className="m-0 text-body-sm text-text-secondary">El proyecto todavía no tiene carruseles.</p>;
  return (
    <div className="grid min-w-0 gap-3">
      {carousels.length > 1 ? (
        <nav className="flex min-w-0 flex-wrap gap-2" aria-label="Carruseles del proyecto">
          {carousels.map((item) => (
            <button
              key={item.id}
              type="button"
              className="focus-studio min-h-touch rounded-control border-hairline border-border-default bg-surface-raised px-3 text-body-sm text-text-link aria-[current=true]:border-brand-gold aria-[current=true]:text-text-primary"
              aria-current={item.id === carousel.id ? 'true' : undefined}
              onClick={() => setSelectedCarouselId(item.id)}
            >
              Carrusel {item.sequence} de {item.total}
            </button>
          ))}
        </nav>
      ) : null}
      <ProjectCarouselPreview
        key={carousel.id}
        project={project}
        carousel={carousel}
        onExported={onExported}
        onStale={onStale}
      />
    </div>
  );
}

export function ProjectGeneratedContent({ project }: { project: Project }) {
  return (
    <section aria-labelledby="project-content-heading" className="grid min-w-0 gap-3">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">Carrusel del proyecto</p>
          <h2 id="project-content-heading" className="m-0 font-display text-heading-md font-extrabold">
            Contenido generado
          </h2>
        </div>
        <p className="m-0 text-body-sm text-text-secondary">Carrusel de Instagram · 4:5</p>
      </header>
      {project.activeDraftId === null ? (
        <>
          <ProjectEmptyContent project={project} />
          <ExportHistorySection project={project} carousels={[]} refreshKey="" />
        </>
      ) : (
        <ActiveProjectContent project={project} />
      )}
    </section>
  );
}
