import type { ListingMeta } from '../api/types';
import { listingCopy } from './copy';
import { formatDateTime } from './format';
import styles from './Notice.module.css';

export interface ListingProvenanceProps {
  listing: ListingMeta;
}

/**
 * Provenance of a catalogue listing (R-141, R-291): retrieval time, cache use, staleness and the wait before a
 * new request. Retrieval times are shown as such; nothing claims real-time data (U-24).
 */
export function ListingProvenance({ listing }: ListingProvenanceProps) {
  return (
    <div className={styles.provenance}>
      <p>
        {listing.retrievedAt === null ? (
          listingCopy.neverRetrieved
        ) : (
          <>
            {listingCopy.retrievedAt}: <time dateTime={listing.retrievedAt}>{formatDateTime(listing.retrievedAt)}</time>
          </>
        )}{' '}
        ({listing.fromCache ? listingCopy.fromCache : listingCopy.fresh})
      </p>
      {listing.stale ? (
        <p className={styles.stale}>
          <span aria-hidden="true">⚠ </span>
          {listingCopy.stale}
        </p>
      ) : null}
      {listing.retryAfterSeconds === null ? null : <p>{listingCopy.retryAfter(listing.retryAfterSeconds)}</p>}
    </div>
  );
}
