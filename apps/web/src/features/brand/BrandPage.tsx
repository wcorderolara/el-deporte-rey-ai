import { useCallback, useState } from 'react';

import { featureCopy } from '../../ui';
import type { BrandApi } from './brandApi';
import { BrandAssetsSection } from './BrandAssetsSection';
import styles from './Brand.module.css';
import { brandCopy } from './copy';
import { TemplatesSection } from './TemplatesSection';

export interface BrandPageProps {
  api: BrandApi;
}

/**
 * Brand and templates page: registration and management of authorized brand assets, and the versioned templates
 * with their previews. There is no badge or competition-mark upload (PD-03, OD-27) and no template editing (OD-13).
 * Completed actions are announced in one polite status region.
 */
export function BrandPage({ api }: BrandPageProps) {
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => setAnnouncement(message), []);

  return (
    <section aria-labelledby="brand-title">
      <h1 id="brand-title">{featureCopy.brand}</h1>
      <p>{brandCopy.intro}</p>
      <p className={styles.notice}>{brandCopy.authorizedOnly}</p>
      <p className={styles.notice}>{brandCopy.provisional}</p>
      <p className={styles.status} role="status" aria-live="polite" aria-label={brandCopy.statusRegion}>
        {announcement}
      </p>
      <BrandAssetsSection api={api} announce={announce} />
      <TemplatesSection api={api} />
    </section>
  );
}
