import type { ElementVersion } from '@edr/contracts';
import { useEffect, useRef, useState } from 'react';

import { Badge, Button, Icon, IconButton } from '../../ui';
import { elementCopy, workspaceCopy } from './copy';

/** Zoom levels relative to the image fitted in the available space (1 = fitted). */
const ZOOM_STEPS = [1, 1.25, 1.5, 2, 3] as const;

export interface SlidePagerProps {
  position: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export interface SlidePreviewProps {
  name: string;
  typeLabel: string | null;
  version: ElementVersion;
  imageSource: string | null;
  pager?: SlidePagerProps;
  /** Alternative text of the image; by default the slide name and version. */
  imageAlt?: string;
  /** Text shown when the version has no image; by default the review's message. */
  noImageText?: string;
}

function fullscreenAvailable(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

/**
 * The selected slide as the protagonist of the review (UX-REVIEW-01): the image fitted in the available space with
 * its aspect ratio preserved, the previous/next controls and the position, zoom relative to the fitted size (the
 * stage scrolls when the image is larger than the space), and fullscreen where the browser supports it. Nothing here
 * changes the slide: the zoom and fullscreen only change how it is shown.
 */
export function SlidePreview({
  name,
  typeLabel,
  version,
  imageSource,
  pager,
  imageAlt,
  noImageText,
}: SlidePreviewProps) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen] = useState(fullscreenAvailable);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;

  useEffect(() => {
    if (!canFullscreen) return;
    const update = () =>
      setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [canFullscreen]);

  // A zoomed image starts centred in the stage.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller === null) return;
    scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
    scroller.scrollTop = Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2);
  }, [zoomIndex]);

  function toggleFullscreen() {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void stageRef.current?.requestFullscreen().catch(() => undefined);
    }
  }

  return (
    <section
      aria-label={workspaceCopy.previewLabel(name)}
      className="flex min-h-0 min-w-0 flex-col gap-3 rounded-panel border border-border-subtle bg-surface-raised p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span className="font-display text-heading-sm font-extrabold tracking-heading text-text-primary uppercase">
            {pager === undefined ? name : workspaceCopy.previewPosition(pager.position, pager.total)}
          </span>
          {typeLabel === null ? null : <Badge tone="warning">{typeLabel}</Badge>}
        </p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={workspaceCopy.previewTools}>
          {pager === undefined ? null : (
            <>
              <IconButton
                label={workspaceCopy.previous}
                title={workspaceCopy.previous}
                disabled={pager.onPrevious === undefined}
                onClick={pager.onPrevious}
              >
                <Icon name="chevron-left" size={18} />
              </IconButton>
              <IconButton
                label={workspaceCopy.next}
                title={workspaceCopy.next}
                disabled={pager.onNext === undefined}
                onClick={pager.onNext}
              >
                <Icon name="chevron-right" size={18} />
              </IconButton>
            </>
          )}
          {imageSource === null ? null : (
            <>
              <IconButton
                label={workspaceCopy.zoomOut}
                title={workspaceCopy.zoomOut}
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
              >
                <Icon name="minus" size={18} />
              </IconButton>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`${workspaceCopy.zoomFit} (${zoomIndex === 0 ? workspaceCopy.zoomFitted : workspaceCopy.zoomLevel(Math.round(zoom * 100))})`}
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex(0)}
              >
                {zoomIndex === 0 ? workspaceCopy.zoomFitted : workspaceCopy.zoomLevel(Math.round(zoom * 100))}
              </Button>
              <IconButton
                label={workspaceCopy.zoomIn}
                title={workspaceCopy.zoomIn}
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                onClick={() => setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))}
              >
                <Icon name="plus" size={18} />
              </IconButton>
              {canFullscreen ? (
                <IconButton
                  label={fullscreen ? workspaceCopy.exitFullscreen : workspaceCopy.fullscreen}
                  title={fullscreen ? workspaceCopy.exitFullscreen : workspaceCopy.fullscreen}
                  aria-pressed={fullscreen}
                  onClick={toggleFullscreen}
                >
                  <Icon name="fit" size={18} />
                </IconButton>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div
        ref={stageRef}
        className="relative h-[min(72vh,52rem)] min-h-80 overflow-hidden rounded-card border border-border-subtle bg-surface-canvas lg:h-auto lg:flex-1"
      >
        {imageSource === null ? (
          <div className="absolute inset-0 grid place-items-center p-4 text-text-secondary" role="status">
            {noImageText ?? elementCopy.noImage}
          </div>
        ) : (
          <div ref={scrollRef} className="absolute inset-0 overflow-auto">
            <div
              className="absolute top-0 left-0 p-3 sm:p-5"
              style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
            >
              <img
                className="block h-full w-full object-contain"
                src={imageSource}
                alt={imageAlt ?? elementCopy.imageAlt(name, version.versionNumber)}
                width={version.width ?? undefined}
                height={version.height ?? undefined}
                loading="eager"
              />
            </div>
          </div>
        )}
      </div>
      <p className="m-0 flex flex-wrap justify-between gap-2 text-caption text-text-secondary">
        <span>
          {version.width === null || version.height === null
            ? elementCopy.versionLine(version.versionNumber)
            : `${workspaceCopy.format(version.width, version.height)} · ${elementCopy.versionLine(version.versionNumber)}`}
        </span>
        {zoomIndex === 0 ? null : <span>{workspaceCopy.zoomLevel(Math.round(zoom * 100))}</span>}
      </p>
    </section>
  );
}
