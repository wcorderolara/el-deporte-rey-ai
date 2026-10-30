import type { ReactNode } from 'react';

import styles from './Review.module.css';

/** Shared three-region review layout used by review, project previews, and saved exports. */
export function ReviewWorkspace({
  navigation,
  children,
  labelledBy,
  state,
  blocked = false,
  caption = false,
}: {
  navigation: ReactNode;
  children: ReactNode;
  labelledBy?: string;
  state?: string;
  blocked?: boolean;
  caption?: boolean;
}) {
  return (
    <article
      className={`${styles.element} ${caption ? styles.captionElement : ''}`}
      data-blocked={blocked ? 'true' : 'false'}
      data-state={state}
      aria-labelledby={labelledBy}
    >
      {navigation === null || navigation === undefined ? null : <div className={styles.slideRail}>{navigation}</div>}
      {children}
    </article>
  );
}
