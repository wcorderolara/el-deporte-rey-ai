import type { ReactNode, Ref } from 'react';

import { appCopy } from './copy';
import styles from './Layout.module.css';

export const MAIN_CONTENT_ID = 'main-content';

export interface LayoutProps {
  /** Main navigation (links); rendered inside a labelled `nav` landmark. */
  navigation: ReactNode;
  /** Reference to the `main` element, used to move focus after a route change. */
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
}

/**
 * Page frame: skip link, header with the application name and the main navigation, main content and footer. The
 * application has no login, account or sign-in element (PD-05, R-235).
 */
export function Layout({ navigation, mainRef, children }: LayoutProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`}>
        {appCopy.skipToContent}
      </a>
      <header className={styles.header}>
        <p className={styles.brand}>
          {appCopy.name}
          <span className={styles.tagline}>{appCopy.tagline}</span>
        </p>
        <nav aria-label={appCopy.mainNavigation}>{navigation}</nav>
      </header>
      <main id={MAIN_CONTENT_ID} className={styles.main} ref={mainRef} tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>
        <p>{appCopy.localNotice}</p>
      </footer>
    </div>
  );
}
