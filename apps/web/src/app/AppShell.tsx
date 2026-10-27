import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigation } from 'react-router';

import { appCopy, Layout, navCopy } from '../ui';
import styles from './AppShell.module.css';

interface NavItem {
  to: string;
  label: string;
  isCurrent: (pathname: string) => boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/',
    label: navCopy.projects,
    isCurrent: (pathname) => pathname === '/' || pathname === '/projects' || pathname.startsWith('/projects/'),
  },
  { to: '/imports', label: navCopy.imports, isCurrent: (pathname) => pathname.startsWith('/imports') },
  { to: '/brand', label: navCopy.brand, isCurrent: (pathname) => pathname.startsWith('/brand') },
];

function MainNavigation({ pathname }: { pathname: string }) {
  return (
    <ul className={styles.navList}>
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <Link className={styles.navLink} to={item.to} aria-current={item.isCurrent(pathname) ? 'page' : undefined}>
            {item.label}
          </Link>
        </li>
      ))}
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

  useEffect(() => {
    if (lastPathname.current !== location.pathname) {
      lastPathname.current = location.pathname;
      mainRef.current?.focus();
    }
  }, [location.pathname]);

  return (
    <Layout mainRef={mainRef} navigation={<MainNavigation pathname={location.pathname} />}>
      <p className={styles.status} role="status">
        {navigation.state === 'loading' ? appCopy.loading : ''}
      </p>
      <Outlet />
    </Layout>
  );
}
