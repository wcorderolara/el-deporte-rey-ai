import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigation } from 'react-router';

import { appCopy, classNames, Layout } from '../ui';
import { shellContext } from './shellContext';

interface NavItem {
  to: string;
  label: string;
  isCurrent: (pathname: string, hash: string) => boolean;
  symbol: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/',
    label: 'Inicio',
    symbol: '⌂',
    isCurrent: (pathname) => pathname === '/',
  },
  {
    to: '/projects/new',
    label: 'Crear contenido',
    symbol: '＋',
    isCurrent: (pathname) => pathname === '/projects/new',
  },
  {
    to: '/projects',
    label: 'Mis proyectos',
    symbol: '▤',
    isCurrent: (pathname) => pathname.startsWith('/projects') && pathname !== '/projects/new',
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
    to: '/brand#brand-templates-title',
    label: 'Plantillas',
    symbol: '▥',
    isCurrent: (path, hash) => /^\/brand\/?$/.test(path) && hash === '#brand-templates-title',
  },
  {
    to: '/brand#brand-assets-title',
    label: 'Mi marca',
    symbol: '◇',
    isCurrent: (path, hash) => /^\/brand\/?$/.test(path) && hash !== '#brand-templates-title',
  },
  { to: '/imports', label: 'Datos', symbol: '≡', isCurrent: (pathname) => pathname.startsWith('/imports') },
];

function MainNavigation({ pathname, hash }: { pathname: string; hash: string }) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <Link
            className={classNames(
              'focus-studio flex min-h-touch items-center gap-3 rounded-control border-l-4 px-3 py-2 font-sans text-body-sm no-underline transition-colors',
              item.isCurrent(pathname, hash)
                ? 'border-brand-gold bg-surface-overlay font-bold text-brand-gold'
                : 'border-transparent text-text-secondary hover:bg-surface-card hover:text-text-primary',
            )}
            to={item.to}
            aria-current={item.isCurrent(pathname, hash) ? 'page' : undefined}
          >
            <span aria-hidden="true" className="inline-flex w-5 shrink-0 justify-center text-body-lg">
              {item.symbol}
            </span>
            <span>{item.label}</span>
          </Link>
        </li>
      ))}
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

  useEffect(() => {
    // These existing section anchors are the only fragment destinations offered by the shell.
    if (navigation.state === 'idle' && ['#brand-assets-title', '#brand-templates-title'].includes(location.hash)) {
      const target = document.getElementById(location.hash.slice(1));
      target?.setAttribute('tabindex', '-1');
      target?.focus();
      target?.scrollIntoView?.({ block: 'start' });
    }
  }, [location.hash, location.pathname, navigation.state]);

  return (
    <Layout
      mainRef={mainRef}
      navigation={<MainNavigation pathname={location.pathname} hash={location.hash} />}
      title={context.title}
      hideHeaderTitle={context.hideHeaderTitle}
      hideHeaderDescription={context.hideHeaderTitle || context.projectPath !== undefined}
      navigationKey={`${location.pathname}${location.hash}`}
      contentVariant={
        ['/', '/projects', '/projects/', '/projects/new', '/projects/new/', '/exports', '/exports/'].includes(
          location.pathname,
        ) ||
        /^\/projects\/[^/]+\/review(?:\/.*)?$/.test(location.pathname) ||
        /^\/competitions(?:\/.*)?$/.test(location.pathname) ||
        /^\/projects\/[^/]+(?:\/exports(?:\/.*)?)?\/?$/.test(location.pathname)
          ? 'studio'
          : 'legacy'
      }
      primaryAction={
        <Link
          to="/projects/new"
          className="focus-studio flex min-h-touch items-center justify-center gap-2 rounded-control border-hairline border-brand-gold bg-brand-gold px-4 py-3 font-sans text-body-sm font-bold text-text-inverse no-underline shadow-gold-glow hover:brightness-110"
        >
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
