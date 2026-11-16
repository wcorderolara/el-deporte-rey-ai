import type { ReactNode } from 'react';

import { brandCopy } from './copy';

export interface BrandViewHeaderProps {
  /** The id of the heading (level 1), which labels the view. */
  headingId: string;
  heading: string;
  /** What the view is for. */
  intro: string;
  /** Further rules shown under the intro, in smaller text. */
  notes?: readonly string[];
  /** The main action of the view, aligned to the end of the header. */
  action?: ReactNode;
}

/**
 * The header shared by the two views of Mi marca («Recursos», «Identidad visual»): the parent as eyebrow, the title of
 * the view, its purpose and an optional main action, with the same style as the template views.
 */
export function BrandViewHeader({ headingId, heading, intro, notes = [], action }: BrandViewHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid max-w-reading gap-3">
        <p className="m-0 text-caption font-bold tracking-label text-brand-gold uppercase">{brandCopy.eyebrow}</p>
        <h1
          id={headingId}
          className="m-0 font-display text-heading-md font-extrabold tracking-display text-text-primary"
        >
          {heading}
        </h1>
        <p className="m-0 text-body-md text-text-secondary">{intro}</p>
        {notes.map((note) => (
          <p key={note} className="m-0 text-body-sm text-text-secondary">
            {note}
          </p>
        ))}
      </div>
      {action}
    </div>
  );
}
