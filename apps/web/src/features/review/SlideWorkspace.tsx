import type { HTMLAttributes, ReactNode, Ref } from 'react';

import { classNames } from '../../ui';
import { SlidePreview, type SlidePreviewProps } from './SlidePreview';

export interface SlideWorkspaceProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The slide list (a `ReviewThumbnailRail` with `fill`), shown in its own panel as the first column. */
  navigation?: ReactNode;
  /** A collapsed slide list takes a narrow column. */
  navigationCollapsed?: boolean;
  /** The selected slide, the protagonist of the workspace. */
  preview: SlidePreviewProps;
  /** The side panel: the review inspector or a `SlidePanel`. */
  panel: ReactNode;
  /**
   * `parent`: the workspace fills the height its page gives it (the review). `viewport`: from the lg breakpoint it
   * takes the height of the window, within limits (the project detail and the exported carousel).
   */
  height?: 'parent' | 'viewport';
}

/**
 * The slide workspace shared by the content review, the project detail and the exported carousel (UX-REVIEW-01): the
 * slide list, the selected slide with its tools (previous/next, zoom and fullscreen) and a side panel, in three
 * columns from the md breakpoint and stacked below it.
 */
export function SlideWorkspace({
  navigation,
  navigationCollapsed = false,
  preview,
  panel,
  height = 'viewport',
  className,
  ...attributes
}: SlideWorkspaceProps) {
  return (
    <article
      {...attributes}
      className={classNames(
        'grid min-w-0 gap-3',
        height === 'parent' ? 'lg:h-full lg:min-h-0' : 'lg:h-[calc(100dvh-1.5rem)] lg:max-h-[56rem] lg:min-h-[36rem]',
        navigationCollapsed
          ? 'md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(16rem,18rem)] lg:grid-cols-[4.5rem_minmax(0,1fr)_minmax(18rem,22rem)]'
          : 'md:grid-cols-[minmax(11rem,13rem)_minmax(0,1fr)_minmax(16rem,18rem)] lg:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)_minmax(18rem,22rem)]',
        className,
      )}
    >
      {navigation === undefined ? null : (
        <div className="min-h-0 min-w-0 rounded-panel border border-border-subtle bg-surface-raised p-2 lg:overflow-hidden">
          {navigation}
        </div>
      )}
      <SlidePreview {...preview} />
      {panel}
    </article>
  );
}

export interface SlidePanelProps {
  /** Accessible name of the panel. */
  label: string;
  /** Short label above the title. */
  eyebrow: string;
  /** State badges beside the eyebrow. */
  badges?: ReactNode;
  title: string;
  titleId?: string;
  /** Given when focus is moved to the title (it is then focusable by script). */
  titleRef?: Ref<HTMLHeadingElement>;
  /** A line under the title. */
  meta?: ReactNode;
  children: ReactNode;
}

/** The side panel of a slide workspace, in the style of the review inspector: eyebrow, badges, title and content. */
export function SlidePanel({ label, eyebrow, badges, title, titleId, titleRef, meta, children }: SlidePanelProps) {
  return (
    <section
      className="flex min-h-0 min-w-0 flex-col gap-3 rounded-panel border border-border-subtle bg-surface-raised p-4 md:sticky md:top-3 md:max-h-[calc(100dvh-1.5rem)] md:self-start md:overflow-y-auto lg:static lg:max-h-none lg:self-stretch"
      aria-label={label}
    >
      <header className="grid gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="m-0 text-caption font-bold tracking-label text-text-secondary uppercase">{eyebrow}</p>
          {badges}
        </div>
        <h3
          id={titleId}
          ref={titleRef}
          tabIndex={titleRef === undefined ? undefined : -1}
          className="focus-studio m-0 font-display text-heading-sm font-extrabold tracking-heading text-text-primary"
        >
          {title}
        </h3>
        {meta}
      </header>
      {children}
    </section>
  );
}
