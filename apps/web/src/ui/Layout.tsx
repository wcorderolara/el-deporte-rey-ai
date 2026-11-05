import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';

import { appCopy } from './copy';
import { classNames } from './format';
import { Button } from './primitives';

export const MAIN_CONTENT_ID = 'main-content';

export interface LayoutProps {
  /** Main navigation (links); rendered inside a labelled `nav` landmark. */
  navigation: ReactNode;
  /** Reference to the `main` element, used to move focus after a route change. */
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
  title?: string;
  hideHeaderTitle?: boolean;
  hideHeaderDescription?: boolean;
  breadcrumbs?: ReactNode;
  primaryAction?: ReactNode;
  projectContext?: string;
  navigationKey?: string;
  contentVariant?: 'legacy' | 'studio';
}

/**
 * Page frame: skip link, header with the application name and the main navigation, main content and footer. The
 * application has no login, account or sign-in element (PD-05, R-235).
 */
export function Layout({
  navigation,
  mainRef,
  children,
  title = appCopy.name,
  hideHeaderTitle = false,
  hideHeaderDescription = false,
  primaryAction,
  projectContext,
  navigationKey,
  contentVariant = 'legacy',
}: LayoutProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [navigationKey]);
  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas font-sans text-text-primary lg:grid lg:grid-cols-[var(--spacing-shell-sidebar)_minmax(0,1fr)]">
      <a
        className="focus-studio absolute -top-32 left-4 z-50 rounded-control bg-button-primary-bg p-3 font-bold text-button-primary-text focus:top-4"
        href={`#${MAIN_CONTENT_ID}`}
      >
        {appCopy.skipToContent}
      </a>
      <aside className="border-b border-border-subtle bg-surface-subtle lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-5 lg:px-6 lg:py-8">
          <div>
            <p className="m-0 font-display text-heading-sm font-extrabold tracking-heading">EL DEPORTE REY</p>
            <p className="m-0 mt-1 text-caption font-bold tracking-label text-info uppercase">Estudio creativo AI</p>
          </div>
          <div className="lg:hidden">
            <Button
              ref={menuRef}
              variant="quiet"
              size="sm"
              aria-expanded={open}
              aria-controls="shell-navigation"
              onClick={() => setOpen(!open)}
            >
              Menú <span aria-hidden="true">{open ? '−' : '＋'}</span>
            </Button>
          </div>
        </div>
        <div className="px-5 pb-4 lg:px-6">{primaryAction}</div>
        <div
          id="shell-navigation"
          className={`${open ? 'block' : 'hidden'} px-4 pb-5 lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-6`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              menuRef.current?.focus();
            }
          }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) {
              setOpen(false);
              // Same-page links must not leave focus in the collapsed navigation.
              menuRef.current?.focus();
            }
          }}
        >
          <p className="mx-4 mt-2 mb-3 text-caption font-bold tracking-label text-text-subtle uppercase">Tu estudio</p>
          <nav aria-label={appCopy.mainNavigation}>{navigation}</nav>
        </div>
        <div className="hidden border-t border-border-subtle px-6 py-5 text-caption text-text-secondary lg:block">
          <span className="mb-1 block font-bold text-brand-gold">Estudio local</span>Información → creatividad →
          descarga
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border-subtle bg-surface-raised px-gutter-mobile py-4 sm:px-gutter-tablet lg:px-gutter-desktop">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-2">
            {hideHeaderTitle ? null : (
              <p className="m-0 min-w-0 break-normal text-pretty font-display text-heading-sm font-extrabold tracking-heading sm:text-heading-md">
                {title}
              </p>
            )}
            {/* {breadcrumbs ? <div className="ml-auto min-w-0">{breadcrumbs}</div> : null} */}
          </div>
          {hideHeaderDescription ? null : projectContext ? (
            <p className="m-0 mt-2 text-body-sm text-info">{projectContext}</p>
          ) : (
            <p className="m-0 mt-2 text-body-sm text-text-secondary">
              De la información deportiva a tu próxima creación.
            </p>
          )}
        </header>
        <div className="min-w-0 flex-1 p-gutter-mobile sm:p-gutter-tablet lg:p-gutter-desktop">
          <main
            id={MAIN_CONTENT_ID}
            className={classNames(
              'mx-auto w-full min-w-0 max-w-content outline-none',
              contentVariant === 'studio'
                ? 'font-sans text-text-primary'
                : 'overflow-x-auto rounded-panel bg-legacy-canvas p-4 font-legacy text-legacy-text shadow-card sm:p-6',
            )}
            ref={mainRef}
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
        <footer className="border-t border-border-subtle px-gutter-mobile py-4 text-caption text-text-secondary sm:px-gutter-tablet lg:px-gutter-desktop">
          <p className="m-0">{appCopy.localNotice}</p>
        </footer>
      </div>
    </div>
  );
}
