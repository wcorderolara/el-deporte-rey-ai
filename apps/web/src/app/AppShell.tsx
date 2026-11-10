import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigation } from 'react-router';

import { appCopy, buttonClassName, classNames, Layout } from '../ui';
import { shellContext } from './shellContext';

interface NavItem {
  to: string;
  label: string;
  isCurrent: (pathname: string) => boolean;
  symbol: string;
  /** Sub-items shown under the item; the item is highlighted while one of them is the current page. */
  children?: readonly NavItem[];
}

/** The creation page: the sports wizard. */
const CREATE_PATHS = new Set(['/projects/generate', '/projects/generate/']);

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/',
    label: 'Inicio',
    symbol: '⌂',
    isCurrent: (pathname) => pathname === '/',
  },
  {
    // PD-ARCH-01F: content is created with the sports wizard; the retired /projects/new redirects to it.
    to: '/projects/generate',
    label: 'Crear contenido',
    symbol: '＋',
    isCurrent: (pathname) => CREATE_PATHS.has(pathname),
  },
  {
    to: '/projects',
    label: 'Mis proyectos',
    symbol: '▤',
    isCurrent: (pathname) => pathname.startsWith('/projects') && !CREATE_PATHS.has(pathname),
  },
  {
    to: '/competitions',
    label: 'Competiciones',
    symbol: '◉',
    isCurrent: (pathname) => pathname.startsWith('/competitions'),
  },
  {
    to: '/exports',
    label: 'Exportaciones',
    symbol: '⇩',
    isCurrent: (pathname) => pathname === '/exports' || pathname.startsWith('/exports/'),
  },
  {
    to: '/brand',
    label: 'Mi marca',
    symbol: '◇',
    isCurrent: (pathname) => pathname === '/brand' || pathname.startsWith('/brand/'),
    children: [
      {
        // The brand library: logos, mascot, graphic elements, backgrounds and style references.
        to: '/brand/resources',
        label: 'Recursos',
        symbol: '▣',
        isCurrent: (pathname) => pathname.startsWith('/brand/resources'),
      },
      {
        to: '/brand/identity',
        label: 'Identidad visual',
        symbol: '◐',
        isCurrent: (pathname) => pathname.startsWith('/brand/identity'),
      },
    ],
  },
  {
    to: '/templates',
    label: 'Plantillas',
    symbol: '▥',
    isCurrent: (pathname) => pathname === '/templates' || pathname.startsWith('/templates/'),
    children: [
      {
        // The visual templates, their editor and the AI design proposals.
        to: '/templates/create',
        label: 'Crear plantilla',
        symbol: '✦',
        isCurrent: (pathname) => pathname.startsWith('/templates/create') || pathname.startsWith('/templates/visual/'),
      },
      {
        to: '/templates/engine',
        label: 'Plantillas del motor',
        symbol: '▦',
        isCurrent: (pathname) => pathname.startsWith('/templates/engine'),
      },
    ],
  },
  { to: '/imports', label: 'Datos', symbol: '≡', isCurrent: (pathname) => pathname.startsWith('/imports') },
];

function MainNavigation({ pathname }: { pathname: string }) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {NAV_ITEMS.map((item) => {
        const current = item.isCurrent(pathname);
        const child = item.children?.find((entry) => entry.isCurrent(pathname));
        return (
          <li key={item.to}>
            <Link
              className={classNames(
                'focus-studio flex min-h-touch items-center gap-3 rounded-control border-l-4 px-3 py-2 font-sans text-body-sm no-underline transition-colors',
                current
                  ? 'border-brand-gold bg-surface-overlay font-bold text-brand-gold'
                  : 'border-transparent text-text-secondary hover:bg-surface-card hover:text-text-primary',
              )}
              to={item.to}
              // With a current sub-item, the sub-item is the page; the parent only stays highlighted.
              aria-current={current && child === undefined ? 'page' : undefined}
            >
              <span aria-hidden="true" className="inline-flex w-5 shrink-0 justify-center text-body-lg">
                {item.symbol}
              </span>
              <span>{item.label}</span>
            </Link>
            {item.children === undefined ? null : (
              <ul aria-label={item.label} className="m-0 mt-1 grid list-none gap-1 py-0 pr-0 pl-6">
                {item.children.map((entry) => (
                  <li key={entry.to}>
                    <Link
                      className={classNames(
                        'focus-studio flex min-h-touch items-center gap-3 rounded-control border-l-2 px-3 py-1.5 font-sans text-body-sm no-underline transition-colors',
                        entry.isCurrent(pathname)
                          ? 'border-brand-gold font-bold text-text-primary'
                          : 'border-border-subtle text-text-secondary hover:bg-surface-card hover:text-text-primary',
                      )}
                      to={entry.to}
                      aria-current={entry.isCurrent(pathname) ? 'page' : undefined}
                    >
                      <span aria-hidden="true" className="inline-flex w-5 shrink-0 justify-center text-body-sm">
                        {entry.symbol}
                      </span>
                      <span>{entry.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      <li className="flex min-h-touch items-center gap-3 px-4 py-2 text-body-sm text-text-subtle" aria-disabled="true">
        <span aria-hidden="true" className="w-5 text-center">
          ⚙
        </span>
        <span>
          Configuración <span className="block text-caption">No disponible</span>
        </span>
      </li>
    </ul>
  );
}

/** Routes on the studio surface; every other route keeps the legacy content panel. */
export function contentVariantOf(pathname: string): 'studio' | 'legacy' | 'workspace' {
  if (/^\/templates\/visual\/[^/]+\/?$/.test(pathname)) return 'workspace';
  return ['/', '/projects', '/projects/', '/exports', '/exports/'].includes(pathname) ||
    /^\/projects\/[^/]+\/review(?:\/.*)?$/.test(pathname) ||
    /^\/projects\/batches\/[^/]+\/?$/.test(pathname) ||
    /^\/competitions(?:\/.*)?$/.test(pathname) ||
    /^\/(?:brand|templates)(?:\/.*)?$/.test(pathname) ||
    /^\/projects\/[^/]+(?:\/exports(?:\/.*)?)?\/?$/.test(pathname)
    ? 'studio'
    : 'legacy';
}

/**
 * Application shell: opens directly on the project list (R-235) with no login, account or sign-in element
 * (PD-05). After each navigation, focus moves to the main content so that keyboard and screen-reader users start
 * on the new page.
 */
export function AppShell() {
  const location = useLocation();
  const navigation = useNavigation();
  const mainRef = useRef<HTMLElement>(null);
  const lastPathname = useRef(location.pathname);
  const context = shellContext(location.pathname);

  useEffect(() => {
    if (lastPathname.current !== location.pathname) {
      lastPathname.current = location.pathname;
      mainRef.current?.focus();
    }
  }, [location.pathname]);

  return (
    <Layout
      mainRef={mainRef}
      navigation={<MainNavigation pathname={location.pathname} />}
      title={context.title}
      hideHeaderTitle={context.hideHeaderTitle}
      hideHeaderDescription={context.hideHeaderTitle || context.projectPath !== undefined}
      navigationKey={location.pathname}
      contentVariant={contentVariantOf(location.pathname)}
      primaryAction={
        <Link to="/projects/generate" className={buttonClassName('primary', 'sm', 'flex w-full')}>
          <span aria-hidden="true">＋</span>Crear contenido
        </Link>
      }
      breadcrumbs={
        <nav aria-label="Ruta de navegación">
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-caption text-text-subtle">
            <li>
              <Link
                className="focus-studio text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-primary"
                to="/"
              >
                Inicio
              </Link>
            </li>
            {context.projectPath ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    className="focus-studio text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-primary"
                    to="/projects"
                  >
                    Mis proyectos
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  {context.title === 'Proyecto' ? (
                    <span aria-current="page">Proyecto</span>
                  ) : (
                    <Link
                      className="focus-studio text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-primary"
                      to={context.projectPath}
                    >
                      Proyecto
                    </Link>
                  )}
                </li>
              </>
            ) : context.parent ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    className="focus-studio text-text-link underline decoration-border-strong underline-offset-2 hover:text-text-primary"
                    to={context.parent.to}
                  >
                    {context.parent.label}
                  </Link>
                </li>
              </>
            ) : null}
            {context.title !== 'Inicio' && context.title !== 'Proyecto' ? (
              <>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{context.title}</li>
              </>
            ) : null}
          </ol>
        </nav>
      }
      projectContext={
        context.projectPath && context.projectSection ? `Proyecto actual · ${context.projectSection}` : undefined
      }
    >
      <p
        className={
          ['/', '/projects', '/projects/'].includes(location.pathname)
            ? 'm-0 mb-2 min-h-6 text-text-secondary'
            : 'm-0 mb-2 min-h-6 text-legacy-text-muted'
        }
        role="status"
      >
        {navigation.state === 'loading' ? appCopy.loading : ''}
      </p>
      <Outlet />
    </Layout>
  );
}
