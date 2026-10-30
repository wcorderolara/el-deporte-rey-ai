import type { KeyboardEvent } from 'react';

import styles from './Review.module.css';

export interface ReviewThumbnail {
  id: string;
  position: number;
  imageUrl: string | null;
  imageSource: string | null;
  title: string;
  subtitle?: string;
  ariaLabel?: string;
}

/** Accessible thumbnail rail shared by the review and saved-content previews. */
export function ReviewThumbnailRail({
  items,
  selectedId,
  label,
  heading,
  onSelect,
  onItemKeyDown,
  setButtonRef,
}: {
  items: readonly ReviewThumbnail[];
  selectedId: string | undefined;
  label: string;
  heading: string;
  onSelect: (id: string) => void;
  onItemKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  setButtonRef?: (node: HTMLButtonElement | null, index: number) => void;
}) {
  return (
    <nav aria-label={label} className={styles.slideNavigation}>
      <h3>{heading}</h3>
      <ol className={styles.thumbnailList}>
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              ref={(node) => setButtonRef?.(node, index)}
              type="button"
              aria-current={item.id === selectedId ? 'true' : undefined}
              aria-label={
                item.ariaLabel ?? `${item.position}. ${item.title}${item.subtitle ? `, ${item.subtitle}` : ''}`
              }
              className={styles.thumbnailButton}
              data-selected={item.id === selectedId}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => onItemKeyDown?.(event, index)}
            >
              {item.imageSource === null ? (
                <span className={styles.thumbnailPlaceholder}>{item.position}</span>
              ) : (
                <img src={item.imageSource} alt="" loading="lazy" />
              )}
              <span className={styles.thumbnailText}>
                <strong>
                  {String(item.position).padStart(2, '0')} · {item.title}
                </strong>
                {item.subtitle ? <span>{item.subtitle}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
