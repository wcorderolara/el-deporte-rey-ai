import { useCallback, useState, type ReactNode } from 'react';

import type { BrandApi } from './brandApi';
import { BrandIdentitySection } from './BrandIdentitySection';
import { BrandLibrarySection } from './BrandLibrarySection';
import { brandCopy } from './copy';

export interface BrandPageProps {
  api: BrandApi;
}

/** Completed actions of a view are announced in one polite status region. */
function AnnouncedView({ children }: { children: (announce: (message: string) => void) => ReactNode }) {
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => setAnnouncement(message), []);
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-label={brandCopy.statusRegion}>
        {announcement}
      </p>
      {children(announce)}
    </>
  );
}

/**
 * «Recursos» (`/brand/resources`; PD-ARCH-01G-A): the brand library with every category of asset and its AI usage
 * policy. There is no badge or competition-mark upload (PD-03, OD-27).
 */
export function BrandResourcesPage({ api }: BrandPageProps) {
  return <AnnouncedView>{(announce) => <BrandLibrarySection api={api} announce={announce} />}</AnnouncedView>;
}

/**
 * «Identidad visual» (`/brand/identity`; PD-ARCH-01G-A): palette and fonts of the renderer, with the descriptive notes
 * that give context to later AI work.
 */
export function BrandIdentityPage({ api }: BrandPageProps) {
  return <AnnouncedView>{(announce) => <BrandIdentitySection api={api} announce={announce} />}</AnnouncedView>;
}
