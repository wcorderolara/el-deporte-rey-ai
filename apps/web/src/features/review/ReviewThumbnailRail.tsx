import type { KeyboardEvent, ReactNode } from 'react';

import { Badge, classNames, type BadgeVariant } from '../../ui';
import styles from './Review.module.css';

export interface ReviewThumbnail {
  id: string;
  position: number;
  imageUrl: string | null;
  imageSource: string | null;
  title: string;
  subtitle?: string;
  /** A review status shown as a badge instead of the subtitle (text and symbol, never color alone). */
  status?: { label: string; tone: BadgeVariant; symbol: string };
  ariaLabel?: string;
}

/**
 * Accessible thumbnail rail shared by the review and saved-content previews. `fill` makes the list take the height of
 * its column and scroll on its own; `compact` keeps only the position and the status symbol (a collapsed rail).
 */
export function ReviewThumbnailRail({
  items,
  selectedId,
  label,
  heading,
  headerAction,
  intro,
  onSelect,
  onItemKeyDown,
  setButtonRef,
  fill = false,
  compact = false,
}: {
  items: readonly ReviewThumbnail[];
  selectedId: string | undefined;
  label: string;
  heading: string;
  /** A control next to the heading (for example, collapsing the rail). */
  headerAction?: ReactNode;
  /** Content between the heading and the list (for example, the bulk approval). */
  intro?: ReactNode;
  onSelect: (id: string) => void;
  onItemKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  setButtonRef?: (node: HTMLButtonElement | null, index: number) => void;
  fill?: boolean;
  compact?: boolean;
}) {
  return (
    <nav aria-label={label} className={classNames(styles.slideNavigation, fill ? styles.slideNavigationFill : '')}>
      {headerAction === undefined ? (
        <h3>{heading}</h3>
      ) : (
        <div className={styles.railHeader}>
          <h3 className={compact ? styles.visuallyHidden : undefined}>{heading}</h3>
          {headerAction}
        </div>
      )}
      {compact ? null : intro}
      <ol className={styles.thumbnailList}>
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              ref={(node) => setButtonRef?.(node, index)}
              type="button"
              aria-current={item.id === selectedId ? 'true' : undefined}
              aria-label={
                item.ariaLabel ??
                `${item.position}. ${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}${item.status ? `, ${item.status.label}` : ''}`
              }
              className={classNames(styles.thumbnailButton, compact ? styles.thumbnailButtonCompact : '')}
              data-selected={item.id === selectedId}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => onItemKeyDown?.(event, index)}
            >
              {compact ? (
                <span className="grid place-items-center gap-0.5 text-caption font-bold text-text-primary">
                  <span>{String(item.position).padStart(2, '0')}</span>
                  {item.status === undefined ? null : (
                    <span aria-hidden="true" className={statusText[item.status.tone]}>
                      {item.status.symbol}
                    </span>
                  )}
                </span>
              ) : (
                <>
                  {item.imageSource === null ? (
                    <span className={styles.thumbnailPlaceholder}>{item.position}</span>
                  ) : (
                    <img src={item.imageSource} alt="" loading="lazy" />
                  )}
                  <span className={styles.thumbnailText}>
                    <strong>
                      {String(item.position).padStart(2, '0')} · {item.title}
                    </strong>
                    {item.status === undefined ? (
                      item.subtitle ? (
                        <span>{item.subtitle}</span>
                      ) : null
                    ) : (
                      <Badge tone={item.status.tone} symbol={item.status.symbol} className="justify-self-start">
                        {item.status.label}
                      </Badge>
                    )}
                  </span>
                </>
              )}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const statusText: Record<BadgeVariant, string> = {
  neutral: 'text-text-secondary',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  attested: 'text-attested',
  demo: 'text-demo',
};
