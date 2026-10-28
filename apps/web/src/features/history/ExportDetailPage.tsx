import type { ExportDetail, TextField } from '@edr/contracts';
import { useId } from 'react';
import { Link, useParams } from 'react-router';

import { appCopy, DataModeBadge, DemoBanner, ErrorBanner, formatDateTime, ProvenanceLabel } from '../../ui';
import { loadExport, slideImageSource, useHistoryApi } from './api';
import { exportUsesAttestedFacts } from './attested';
import { AttestedNote } from './AttestedNote';
import { detailCopy, historyCopy, textFieldLabel } from './copy';
import { ExportFiles } from './ExportFiles';
import styles from './History.module.css';
import { exportsPath, isUuid, projectPath, tracePath } from './paths';
import { useLoad } from './useLoad';

/**
 * Route component: one export reopened with the exact exported slides and caption (`.../exports/:exportId`, R-220),
 * its folder and files (R-218), the demonstration label (R-269), the operator-attested label (OD-28) and a trace
 * link per slide (R-221).
 */
export function ExportDetailPage() {
  const { projectId, exportId } = useParams();
  const valid = isUuid(projectId) && isUuid(exportId);
  return (
    <section aria-labelledby="export-title">
      <h1 id="export-title">{detailCopy.title}</h1>
      {valid ? (
        <ExportDetailView key={`${projectId}/${exportId}`} projectId={projectId} exportId={exportId} />
      ) : (
        <>
          <p>{detailCopy.invalidAddress}</p>
          {isUuid(projectId) ? <BackLinks projectId={projectId} /> : null}
        </>
      )}
    </section>
  );
}

function BackLinks({ projectId }: { projectId: string }) {
  return (
    <p className={styles.links}>
      <Link to={exportsPath(projectId)}>{historyCopy.backToExports}</Link>
      {' · '}
      <Link to={projectPath(projectId)}>{historyCopy.backToProject}</Link>
    </p>
  );
}

function ExportDetailView({ projectId, exportId }: { projectId: string; exportId: string }) {
  const client = useHistoryApi();
  const detail = useLoad(`export\u0000${exportId}`, (signal) => loadExport(client, exportId, signal));

  switch (detail.state.status) {
    case 'loading':
      return (
        <p role="status" aria-live="polite">
          {appCopy.loading}
        </p>
      );
    case 'error':
      return (
        <>
          <ErrorBanner error={detail.state.error} title={detailCopy.loadErrorTitle} onRetry={detail.reload} />
          <BackLinks projectId={projectId} />
        </>
      );
    case 'success':
      // The address and the export must agree on the project; another project's export is not shown here.
      if (detail.state.data.projectId !== projectId) {
        return (
          <>
            <p>{detailCopy.otherProject}</p>
            <BackLinks projectId={projectId} />
          </>
        );
      }
      return <ExportContent projectId={projectId} detail={detail.state.data} />;
  }
}

function ExportContent({ projectId, detail }: { projectId: string; detail: ExportDetail }) {
  const contentTitleId = useId();
  const filesTitleId = useId();
  return (
    <>
      <BackLinks projectId={projectId} />
      <dl className={styles.summary} data-testid="export-summary">
        <div>
          <dt>{detailCopy.exportedAt}</dt>
          <dd>
            <time dateTime={detail.exportedAt}>{formatDateTime(detail.exportedAt)}</time>
          </dd>
        </div>
        <div>
          <dt>{detailCopy.dataMode}</dt>
          <dd>
            <DataModeBadge mode={detail.dataMode} />
          </dd>
        </div>
        <div>
          <dt>{detailCopy.finalApproval}</dt>
          <dd>
            <code translate="no">{detail.finalApprovalId}</code>
          </dd>
        </div>
        <div>
          <dt>{detailCopy.carousel}</dt>
          <dd>
            <code translate="no">{detail.carouselId}</code>
          </dd>
        </div>
      </dl>
      {detail.demonstration || detail.dataMode === 'DEMO_DATA' ? <DemoBanner /> : null}
      {exportUsesAttestedFacts(detail) ? <AttestedNote /> : null}
      <p className={styles.note}>{historyCopy.noPublication}</p>
      <section className={styles.section} aria-labelledby={contentTitleId}>
        <h2 id={contentTitleId}>{detailCopy.contentTitle}</h2>
        <p className={styles.muted}>{detailCopy.contentIntro}</p>
        {detail.elements.length === 0 ? (
          <p>{detailCopy.noElements}</p>
        ) : (
          <ol className={styles.elements}>
            {detail.elements.map((element) => (
              <ExportedElement
                key={`${element.kind}-${element.position}`}
                element={element}
                projectId={projectId}
                exportId={detail.id}
              />
            ))}
          </ol>
        )}
      </section>
      <section className={styles.section} aria-labelledby={filesTitleId}>
        <h2 id={filesTitleId}>{detailCopy.filesTitle}</h2>
        <ExportFiles directory={detail.directory} files={detail.files} />
      </section>
    </>
  );
}

type Element = ExportDetail['elements'][number];

function ExportedElement({ element, projectId, exportId }: { element: Element; projectId: string; exportId: string }) {
  const titleId = useId();
  const { version } = element;
  const isSlide = element.kind === 'slide';
  const title = isSlide ? detailCopy.slide(element.position) : detailCopy.caption;
  return (
    <li className={styles.element} data-testid="exported-element" data-kind={element.kind}>
      <article aria-labelledby={titleId}>
        <h3 id={titleId}>
          {title} ({detailCopy.version(version.versionNumber)})
        </h3>
        {isSlide ? (
          <figure className={styles.figure}>
            {version.imageUrl === null ? (
              <p className={styles.muted}>{detailCopy.noImage}</p>
            ) : (
              <img
                className={styles.image}
                src={slideImageSource(version.id)}
                alt={detailCopy.imageAlt(element.position, version.versionNumber)}
                width={version.width ?? undefined}
                height={version.height ?? undefined}
                loading="lazy"
              />
            )}
          </figure>
        ) : null}
        <TextFields fields={version.fields} />
        {isSlide ? (
          <p>
            <Link to={tracePath(projectId, exportId, element.position)}>{detailCopy.trace(element.position)}</Link>
          </p>
        ) : null}
      </article>
    </li>
  );
}

/** Text of the exported version, field by field, with the provenance of each segment (OD-01, R-208). */
function TextFields({ fields }: { fields: readonly TextField[] }) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <dl className={styles.fields}>
      {fields.map((field, fieldIndex) => (
        <div key={`${field.field}-${fieldIndex}`} data-testid="exported-field" data-field={field.field}>
          <dt>{textFieldLabel[field.field]}</dt>
          <dd>
            {field.segments.map((segment, index) => (
              <span key={index} className={styles.segment}>
                <span data-testid="segment-text">{segment.text}</span>{' '}
                <ProvenanceLabel provenance={segment.provenance} factStatus={segment.factStatus} />
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
