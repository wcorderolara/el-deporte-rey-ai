import { useCallback, useState } from 'react';

import type { BrandApi } from './brandApi';
import { BrandIdentitySection } from './BrandIdentitySection';
import { BrandLibrarySection } from './BrandLibrarySection';
import { brandCopy } from './copy';

export interface BrandPageProps {
  api: BrandApi;
}

/**
 * Brand page, Mi marca (PD-ARCH-01G-A): the visual identity (palette and fonts of the renderer, descriptive notes) and
 * the brand library with every category of asset and its AI usage policy. The templates have their own page
 * (`TemplatesPage`, `/templates`). There is no badge or competition-mark upload (PD-03, OD-27). Completed actions are
 * announced in one polite status region.
 */
export function BrandPage({ api }: BrandPageProps) {
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => setAnnouncement(message), []);

  return (
    <section aria-labelledby="brand-title" className="grid min-w-0 gap-10">
      <div className="grid max-w-reading gap-3">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">{brandCopy.eyebrow}</p>
        <h1
          id="brand-title"
          className="m-0 font-display text-heading-md font-extrabold tracking-display text-text-primary"
        >
          {brandCopy.title}
        </h1>
        <p className="m-0 text-body-md text-text-secondary">{brandCopy.intro}</p>
        <p className="m-0 text-body-sm text-text-secondary">{brandCopy.authorizedOnly}</p>
        <p className="m-0 text-body-sm text-text-secondary">{brandCopy.provisional}</p>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-label={brandCopy.statusRegion}>
        {announcement}
      </p>
      <BrandIdentitySection api={api} announce={announce} />
      <BrandLibrarySection api={api} announce={announce} />
    </section>
  );
}
