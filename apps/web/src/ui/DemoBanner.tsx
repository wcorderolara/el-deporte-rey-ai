import { demoBannerCopy } from './copy';
import styles from './Notice.module.css';

/**
 * Demonstration label of DEMO_DATA content (OD-21, R-269, AD-33). Features render it for every project, draft or
 * export whose data mode is DEMO_DATA.
 */
export function DemoBanner() {
  return (
    <div className={styles.banner} role="note" aria-label={demoBannerCopy.title} data-testid="demo-banner">
      <p>
        <strong>
          <span aria-hidden="true">⚠ </span>
          {demoBannerCopy.title}
        </strong>
      </p>
      <p>{demoBannerCopy.body}</p>
    </div>
  );
}
