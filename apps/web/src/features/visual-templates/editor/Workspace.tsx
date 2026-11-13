import { useRef, useState, type ReactNode } from 'react';

import { Icon, classNames } from '../../../ui';
import { editorCopy } from '../copy';
import { fitScale, MAX_ZOOM, MIN_ZOOM, stepZoom, useElementSize, type Zoom } from './layout';

/** Room around the canvas inside the workspace, in pixels. */
const PADDING = 48;

const BAR_BUTTON = classNames(
  'focus-studio m-0 inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control border-0',
  'bg-transparent px-2 font-sans text-caption font-bold text-text-secondary transition-colors duration-fast',
  'hover:bg-surface-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50',
  'aria-pressed:bg-surface-overlay aria-pressed:text-text-primary',
);

export interface WorkspaceProps {
  canvasWidth: number;
  canvasHeight: number;
  /** Format of the canvas, for example «Instagram 4:5». */
  formatLabel: string;
  /** Draws the canvas at the given width in pixels (null: the full width of the workspace, before measuring). */
  children: (width: number | null, guides: boolean) => ReactNode;
}

/**
 * The central workspace: a bar with the zoom (out, the current percentage, in), «Ajustar» (the whole canvas in the
 * available space, the default), «100 %», the guides and the canvas size; and the canvas, centred, scrolling when it
 * is larger than the workspace. The zoom changes only the size on screen.
 */
export function Workspace({ canvasWidth, canvasHeight, formatLabel, children }: WorkspaceProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const available = useElementSize(areaRef);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [guides, setGuides] = useState(false);
  const fit = fitScale(available, { width: canvasWidth, height: canvasHeight }, PADDING);
  const scale = zoom === 'fit' ? fit : zoom;
  const current = scale ?? 1;

  return (
    <section
      aria-label={editorCopy.workspace}
      // Stacked below the md breakpoint, the area gets its own height so that the canvas can be fitted in it.
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-subtle max-md:h-[min(80dvh,48rem)] max-md:min-h-80"
    >
      <div
        role="toolbar"
        aria-label={editorCopy.zoomToolbar}
        className="flex flex-wrap items-center justify-center gap-1 border-b border-border-subtle bg-surface-raised px-2 py-1 font-sans text-caption font-bold"
      >
        <button
          type="button"
          aria-label={editorCopy.zoomOut}
          title={editorCopy.zoomOut}
          className={BAR_BUTTON}
          disabled={scale !== null && scale <= MIN_ZOOM}
          onClick={() => setZoom(stepZoom(current, 'out'))}
        >
          <Icon name="minus" size={16} />
        </button>
        <output
          aria-live="polite"
          aria-label={editorCopy.zoomLevel}
          className="min-w-14 text-center text-caption font-bold text-text-primary"
        >
          {scale === null ? '—' : `${String(Math.round(scale * 100))} %`}
        </output>
        <button
          type="button"
          aria-label={editorCopy.zoomIn}
          title={editorCopy.zoomIn}
          className={BAR_BUTTON}
          disabled={scale !== null && scale >= MAX_ZOOM}
          onClick={() => setZoom(stepZoom(current, 'in'))}
        >
          <Icon name="plus" size={16} />
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-subtle" />
        <button type="button" aria-pressed={zoom === 'fit'} className={BAR_BUTTON} onClick={() => setZoom('fit')}>
          <Icon name="fit" size={16} />
          {editorCopy.zoomFit}
        </button>
        <button type="button" aria-pressed={zoom === 1} className={BAR_BUTTON} onClick={() => setZoom(1)}>
          {editorCopy.zoomActual}
        </button>
        <button type="button" aria-pressed={guides} className={BAR_BUTTON} onClick={() => setGuides((value) => !value)}>
          <Icon name="grid" size={16} />
          {editorCopy.guides}
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-subtle" />
        <span className="px-1 text-caption text-text-secondary">
          <span className="sr-only">{formatLabel} · </span>
          {editorCopy.pixels(canvasWidth, canvasHeight)}
        </span>
      </div>
      <div ref={areaRef} className="min-h-0 flex-1 overflow-auto">
        {/* `m-auto` centres the canvas and still lets the area scroll to every edge when the canvas is larger. */}
        <div className="flex min-h-full min-w-fit p-6">
          <div className="m-auto">{children(scale === null ? null : Math.round(canvasWidth * scale), guides)}</div>
        </div>
      </div>
      <p className="m-0 border-t border-border-subtle px-3 py-1.5 text-center text-caption text-text-subtle">
        {editorCopy.canvasHintShort}
      </p>
    </section>
  );
}
