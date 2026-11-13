import { Link, useRouteError } from 'react-router';

import { appCopy, ErrorBanner, featureCopy, pageCopy } from '../ui';

/** Shown for an address that matches no route. */
export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title">
      <h1 id="not-found-title">{pageCopy.notFoundTitle}</h1>
      <p>{pageCopy.notFoundBody}</p>
      <p>
        <Link to="/">{pageCopy.backToProjects}</Link>
      </p>
    </section>
  );
}

/** Error boundary of the feature routes, rendered inside the shell. The error's own message is never shown. */
export function RouteErrorPage() {
  const error = useRouteError();
  return (
    <section aria-labelledby="route-error-title">
      <h1 id="route-error-title">{pageCopy.routeErrorTitle}</h1>
      <ErrorBanner error={error} />
      <p>
        <Link to="/">{pageCopy.backToProjects}</Link>
      </p>
    </section>
  );
}

/** Last-resort error boundary when the shell itself cannot render. */
export function RootErrorPage() {
  return (
    <main>
      <h1>{pageCopy.routeErrorTitle}</h1>
      <p>{pageCopy.routeErrorBody}</p>
      <p>
        {/* Outside the shell, on the studio canvas of the document: the studio link colour. */}
        <a className="text-text-link" href="/">
          {pageCopy.backToProjects}
        </a>
      </p>
    </main>
  );
}

/** Shown while the first route module loads. */
export function RouteLoading() {
  return (
    <p role="status" aria-live="polite">
      {appCopy.loading}
    </p>
  );
}

/** Placeholder content of a feature stub; each feature task replaces its stub. */
export function FeaturePlaceholder({ title }: { title: string }) {
  return (
    <section aria-labelledby="feature-title">
      <h1 id="feature-title">{title}</h1>
      <p>{featureCopy.pending}</p>
    </section>
  );
}
