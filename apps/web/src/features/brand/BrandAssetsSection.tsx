import type { BrandAsset } from '@edr/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorBanner, formatDateTime, StatusBadge } from '../../ui';
import type { BrandApi } from './brandApi';
import styles from './Brand.module.css';
import { assetKindLabel, assetsCopy, registerCopy } from './copy';
import { PreviewImage } from './PreviewImage';
import { RegisterAssetForm } from './RegisterAssetForm';
import { useResource } from './useResource';

export interface BrandAssetsSectionProps {
  api: BrandApi;
  /** Announces a completed action in the page's status region. */
  announce: (message: string) => void;
}

interface AssetCardProps {
  api: BrandApi;
  asset: BrandAsset;
  onChanged: (asset: BrandAsset) => void;
  announce: (message: string) => void;
}

/** One registered asset: image preview from the API, details, state and the activate or deactivate control. */
function AssetCard({ api, asset, onChanged, announce }: AssetCardProps) {
  const headingId = `brand-asset-${asset.id}`;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function toggle() {
    if (saving) {
      return;
    }
    const nextActive = !asset.active;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSaving(true);
    setError(null);
    api.setAssetActive(asset.id, nextActive, controller.signal).then(
      (updated) => {
        if (controller.signal.aborted) {
          return;
        }
        setSaving(false);
        onChanged(updated);
        announce(updated.active ? assetsCopy.activated(updated.label) : assetsCopy.deactivated(updated.label));
      },
      (failure: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSaving(false);
        setError(failure);
      },
    );
  }

  const action = asset.active ? assetsCopy.deactivate : assetsCopy.activate;

  return (
    <li className={styles.card}>
      <h3 id={headingId} className={styles.cardTitle}>
        {asset.label}
      </h3>
      <figure className={styles.figure}>
        <PreviewImage
          className={styles.assetPreview}
          src={api.assetFileUrl(asset.id)}
          alt={assetsCopy.previewAlt(asset.label)}
          failedText={assetsCopy.previewFailed}
          width={asset.width}
          height={asset.height}
        />
      </figure>
      <dl className={styles.details}>
        <dt>{assetsCopy.kind}</dt>
        <dd>{assetKindLabel[asset.kind]}</dd>
        <dt>{assetsCopy.format}</dt>
        <dd>{assetsCopy.mimeLabel[asset.mime]}</dd>
        <dt>{assetsCopy.dimensions}</dt>
        <dd>{assetsCopy.dimensionsValue(asset.width, asset.height)}</dd>
        <dt>{assetsCopy.registeredAt}</dt>
        <dd>
          <time dateTime={asset.registeredAt}>{formatDateTime(asset.registeredAt)}</time>
        </dd>
        <dt>{assetsCopy.state}</dt>
        <dd>
          {asset.active ? (
            <StatusBadge label={assetsCopy.active} tone="positive" symbol="●" />
          ) : (
            <StatusBadge label={assetsCopy.inactive} tone="neutral" symbol="○" />
          )}
        </dd>
      </dl>
      <button type="button" className={styles.secondaryButton} onClick={toggle} disabled={saving} aria-busy={saving}>
        {saving ? (
          assetsCopy.saving
        ) : (
          <>
            {action} <span className={styles.visuallyHidden}>{asset.label}</span>
          </>
        )}
      </button>
      {error === null ? null : <ErrorBanner error={error} title={assetsCopy.toggleFailedTitle} onRetry={toggle} />}
    </li>
  );
}

/**
 * Brand assets (R-033, R-228): the registration form and the registered assets with preview, state and activation.
 * Assets are never deleted (OD-08); a deactivated asset is left out of later renders.
 */
export function BrandAssetsSection({ api, announce }: BrandAssetsSectionProps) {
  const loadAssets = useCallback((signal: AbortSignal) => api.listAssets(signal), [api]);
  const { state, reload, update } = useResource(loadAssets);

  const replaceAsset = useCallback(
    (changed: BrandAsset) => update((assets) => assets.map((asset) => (asset.id === changed.id ? changed : asset))),
    [update],
  );

  const addAsset = useCallback(
    (registered: BrandAsset) => {
      update((assets) => (assets.some((asset) => asset.id === registered.id) ? assets : [...assets, registered]));
      announce(registerCopy.registered(registered.label));
    },
    [update, announce],
  );

  return (
    <>
      <RegisterAssetForm api={api} onRegistered={addAsset} />
      <section className={styles.section} aria-labelledby="brand-assets-title">
        <h2 id="brand-assets-title">{assetsCopy.heading}</h2>
        <p>{assetsCopy.reuse}</p>

        {state.status === 'loading' ? (
          <p role="status" aria-live="polite">
            {assetsCopy.loading}
          </p>
        ) : null}
        {state.status === 'error' ? (
          <ErrorBanner error={state.error} title={assetsCopy.loadFailedTitle} onRetry={reload} />
        ) : null}
        {state.status === 'ready' && state.data.length === 0 ? <p>{assetsCopy.empty}</p> : null}
        {state.status === 'ready' && state.data.length > 0 ? (
          <ul className={styles.cards} aria-labelledby="brand-assets-title">
            {state.data.map((asset) => (
              <AssetCard key={asset.id} api={api} asset={asset} onChanged={replaceAsset} announce={announce} />
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
