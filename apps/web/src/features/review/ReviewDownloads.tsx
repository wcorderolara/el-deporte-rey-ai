import type { Carousel, EditorialPackage, Element, Export } from '@edr/contracts';
import type { ReactNode } from 'react';

import { ActionMenu, buttonClassName, formatDateTime, type ActionMenuItem } from '../../ui';
import { CarouselDownload } from '../history/CarouselDownload';
import { downloadCopy, finalCopy, reviewCopy } from './copy';
import { copyText, editorialFileName, editorialText, saveTextFile, saveUrl } from './editorial/download';
import { currentEditorialVersions, hasValidFinalApproval } from './model';
import { useReviewDependencies } from './ReviewContext';

export interface ReviewDownloadsProps {
  carousel: Carousel;
  onExported: (written: Export) => void;
  /** The server reports the final approval as no longer valid. */
  onStale: () => void;
  /** The review menu, shown next to the download. */
  menu?: ReactNode;
}

/**
 * The download of an approved carousel without leaving the review (PD-ARCH-01F, UX-REVIEW-01): the existing carousel
 * download, which has the existing export operation write the export from the current state first (E2E-F01). Its
 * success is announced to assistive technology only; failures stay visible. Nothing is shown before a valid final
 * approval.
 */
export function ReviewDownloads({ carousel, onExported, onStale, menu }: ReviewDownloadsProps) {
  const approval = carousel.finalApproval;
  if (approval === null || !hasValidFinalApproval(carousel)) {
    return null;
  }
  return (
    <div className="grid justify-items-stretch gap-1 lg:justify-items-end">
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        <CarouselDownload
          carousel={carousel}
          onExported={onExported}
          onStale={onStale}
          className={buttonClassName('primary', 'lg')}
          quietSuccess
        />
        {menu}
      </div>
      <p className="m-0 text-caption text-text-secondary lg:text-right">
        <span className="font-bold text-success">
          <span aria-hidden="true">✓ </span>
          {finalCopy.approvedAt}
        </span>{' '}
        <time dateTime={approval.approvedAt}>{formatDateTime(approval.approvedAt)}</time>
      </p>
      <p className="m-0 text-caption text-text-secondary lg:text-right">{finalCopy.valid}</p>
    </div>
  );
}

export interface ReviewMenuMessage {
  text: string;
  /** Failures are shown; successes are only announced. */
  failed: boolean;
}

export interface ReviewMenuProps {
  /** Undefined for a draft without carousels: the menu then only refreshes the view. */
  carousel: Carousel | undefined;
  /** The slide selected in «Diseño visual» (for «Descargar diapositiva»). */
  selectedSlide: Element | undefined;
  editorial: EditorialPackage | null;
  refreshing: boolean;
  onRefresh: () => void;
  onMessage: (message: ReviewMenuMessage) => void;
}

/**
 * The review menu («⋮», UX-REVIEW-01): refreshing the view, and, once the carousel has a valid final approval, only
 * the downloads the system already supports: the selected slide's image (the getSlideImage operation), the editorial
 * copy as a .txt file made in the browser, and copying it.
 */
export function ReviewMenu({ carousel, selectedSlide, editorial, refreshing, onRefresh, onMessage }: ReviewMenuProps) {
  const { api } = useReviewDependencies();
  const hasEditorial = editorial !== null && currentEditorialVersions(editorial).length > 0;
  const slideImage = selectedSlide?.currentVersion.imageUrl ?? null;

  function editorialFile(): string | null {
    return editorial === null ? null : editorialText(editorial, new Date());
  }

  const items: ActionMenuItem[] = [{ label: reviewCopy.refresh, disabled: refreshing, onSelect: onRefresh }];
  if (carousel !== undefined && hasValidFinalApproval(carousel)) {
    items.push(
      {
        label: selectedSlide === undefined ? downloadCopy.slideUnavailable : downloadCopy.slide(selectedSlide.position),
        icon: 'image',
        disabled: selectedSlide === undefined || slideImage === null,
        ...(slideImage === null ? { hint: downloadCopy.slideUnavailable } : {}),
        onSelect: () => {
          if (selectedSlide === undefined || slideImage === null) return;
          saveUrl(
            api.slideImageUrl(selectedSlide.currentVersion.id),
            `diapositiva-${String(selectedSlide.position).padStart(2, '0')}.png`,
          );
          onMessage({ text: downloadCopy.slideStarted(selectedSlide.position), failed: false });
        },
      },
      {
        label: downloadCopy.editorialFile,
        icon: 'text',
        disabled: !hasEditorial,
        ...(hasEditorial ? {} : { hint: downloadCopy.editorialUnavailable }),
        onSelect: () => {
          const text = editorialFile();
          if (text === null || editorial === null) return;
          saveTextFile(text, editorialFileName(editorial));
          onMessage({ text: downloadCopy.editorialDownloaded, failed: false });
        },
      },
      {
        label: downloadCopy.editorialCopy,
        icon: 'text',
        disabled: !hasEditorial,
        ...(hasEditorial ? {} : { hint: downloadCopy.editorialUnavailable }),
        onSelect: () => {
          const text = editorialFile();
          if (text === null) return;
          void copyText(text).then((done) =>
            onMessage(
              done ? { text: downloadCopy.copied, failed: false } : { text: downloadCopy.copyFailed, failed: true },
            ),
          );
        },
      },
    );
  }
  return <ActionMenu label={downloadCopy.more} items={items} />;
}
