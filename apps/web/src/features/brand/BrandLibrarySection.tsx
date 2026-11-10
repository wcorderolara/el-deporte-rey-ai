import type { BrandAsset, BrandAssetKind } from '@edr/contracts';
import { useCallback, useId, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  IconButton,
  Input,
  LoadingState,
  Select,
  ViewModeToggle,
} from '../../ui';
import { AssetDetailDialog } from './AssetDetailDialog';
import type { BrandApi } from './brandApi';
import { BrandViewHeader } from './BrandViewHeader';
import {
  assetKindLabel,
  brandCopy,
  detailCopy,
  libraryCopy,
  uploadCopy,
  usagePolicyLabel,
  usagePolicyTone,
} from './copy';
import { ASSET_KINDS, filterAssets } from './library';
import { PreviewImage } from './PreviewImage';
import { UploadAssetDialog } from './UploadAssetDialog';
import { useResource } from './useResource';

export interface BrandLibrarySectionProps {
  api: BrandApi;
  /** Announces a completed action in the page's status region. */
  announce: (message: string) => void;
}

function StateBadges({ asset }: { asset: BrandAsset }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge tone={asset.active ? 'success' : 'neutral'}>
        {asset.active ? libraryCopy.active : libraryCopy.inactive}
      </Badge>
      {asset.official ? <Badge tone="attested">{libraryCopy.official}</Badge> : null}
      {asset.primary ? <Badge tone="info">{libraryCopy.primary}</Badge> : null}
    </span>
  );
}

function Thumbnail({ api, asset, size }: { api: BrandApi; asset: BrandAsset; size: 'sm' | 'lg' }) {
  return (
    // The image fills the frame absolutely: without Tailwind's preflight an image keeps the height of its `height`
    // attribute (the real pixel size), so a percentage `max-height` alone would show only its top strip.
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas ${size === 'sm' ? 'h-12 w-12' : 'aspect-[4/3] w-full'}`}
    >
      <PreviewImage
        key={asset.sha256}
        src={api.assetFileUrl(asset.id)}
        alt={libraryCopy.previewAlt(asset.label)}
        failedText={libraryCopy.previewFailed}
        className={`absolute inset-0 h-full w-full object-contain ${size === 'sm' ? 'p-1' : 'p-3'}`}
        width={asset.width}
        height={asset.height}
      />
    </span>
  );
}

function AssetTable({
  api,
  assets,
  onOpen,
}: {
  api: BrandApi;
  assets: readonly BrandAsset[];
  onOpen: (asset: BrandAsset) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{libraryCopy.tableCaption}</caption>
        <thead>
          <tr className="border-b border-border-subtle text-caption text-text-secondary">
            <th scope="col" className="px-4 py-3">
              {libraryCopy.preview}
            </th>
            <th scope="col" className="px-4 py-3">
              {libraryCopy.name}
            </th>
            <th scope="col" className="px-4 py-3">
              {libraryCopy.category}
            </th>
            <th scope="col" className="px-4 py-3">
              {libraryCopy.policy}
            </th>
            <th scope="col" className="px-4 py-3">
              {libraryCopy.state}
            </th>
            <th scope="col" className="px-4 py-3">
              {libraryCopy.format}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              {libraryCopy.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b border-border-subtle align-middle last:border-0">
              <td className="px-4 py-3">
                <Thumbnail api={api} asset={asset} size="sm" />
              </td>
              <th scope="row" className="px-4 py-3 text-body-md font-bold text-text-primary">
                {asset.label}
                {asset.variant === null ? null : (
                  <small className="block font-normal text-text-secondary">{asset.variant}</small>
                )}
              </th>
              <td className="px-4 py-3 text-body-sm text-text-secondary">{assetKindLabel[asset.kind]}</td>
              <td className="px-4 py-3">
                <Badge tone={usagePolicyTone[asset.usagePolicy]}>{usagePolicyLabel[asset.usagePolicy]}</Badge>
              </td>
              <td className="px-4 py-3">
                <StateBadges asset={asset} />
              </td>
              <td className="px-4 py-3 text-body-sm text-text-secondary">
                {libraryCopy.mimeLabel[asset.mime]} · {libraryCopy.dimensions(asset.width, asset.height)}
              </td>
              <td className="px-4 py-3 text-right">
                <IconButton label={libraryCopy.openDetail(asset.label)} onClick={() => onOpen(asset)}>
                  <Icon name="eye" />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetCards({
  api,
  assets,
  onOpen,
}: {
  api: BrandApi;
  assets: readonly BrandAsset[];
  onOpen: (asset: BrandAsset) => void;
}) {
  return (
    <ul aria-label={libraryCopy.tableCaption} className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => (
        <li key={asset.id} className="min-w-0">
          <Card as="article" aria-label={asset.label} className="flex h-full min-w-0 flex-col gap-3">
            <Thumbnail api={api} asset={asset} size="lg" />
            <div className="grid gap-1">
              <p className="m-0 text-caption font-bold tracking-label text-info uppercase">
                {assetKindLabel[asset.kind]}
              </p>
              <h3 className="m-0 font-display text-heading-sm font-extrabold text-text-primary">{asset.label}</h3>
              {asset.variant === null ? null : <p className="m-0 text-body-sm text-text-secondary">{asset.variant}</p>}
            </div>
            <span className="flex flex-wrap gap-1.5">
              <Badge tone={usagePolicyTone[asset.usagePolicy]}>{usagePolicyLabel[asset.usagePolicy]}</Badge>
            </span>
            <StateBadges asset={asset} />
            <div className="mt-auto pt-1">
              <Button
                size="sm"
                variant="secondary"
                aria-label={libraryCopy.openDetail(asset.label)}
                onClick={() => onOpen(asset)}
              >
                {libraryCopy.detail}
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/**
 * Brand library (PD-ARCH-01G-A; R-033, R-228): the assets of every category with search, a category filter, a table
 * (default) or a card view over the same list, the upload dialog and the detail of each asset.
 */
export function BrandLibrarySection({ api, announce }: BrandLibrarySectionProps) {
  const headingId = useId();
  const load = useCallback((signal: AbortSignal) => api.listAssets(signal), [api]);
  const { state, reload, update } = useResource(load);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<BrandAssetKind | ''>('');
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<BrandAsset | null>(null);

  const assets = state.status === 'ready' ? state.data : [];
  const shown = filterAssets(assets, search, kind);

  function saved(asset: BrandAsset) {
    setUploading(false);
    update((current) => [...current.filter((item) => item.id !== asset.id), asset]);
    announce(uploadCopy.saved(asset.label));
  }

  function changed(asset: BrandAsset) {
    // A new primary clears the mark of the previous primary of its kind, as the server does.
    if (asset.primary) {
      update((current) =>
        current.map((item) =>
          item.id === asset.id ? asset : item.kind === asset.kind && item.primary ? { ...item, primary: false } : item,
        ),
      );
    } else {
      update((current) => current.map((item) => (item.id === asset.id ? asset : item)));
    }
  }

  function deleted(asset: BrandAsset) {
    setOpen(null);
    update((current) => current.filter((item) => item.id !== asset.id));
    announce(detailCopy.deleted(asset.label));
  }

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-6">
      <BrandViewHeader
        headingId={headingId}
        heading={libraryCopy.heading}
        intro={libraryCopy.intro}
        notes={[brandCopy.authorizedOnly, brandCopy.provisional]}
        action={
          <Button onClick={() => setUploading(true)}>
            <span aria-hidden="true">＋</span>
            {libraryCopy.upload}
          </Button>
        }
      />

      {state.status === 'ready' && assets.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <Input
            id={`${headingId}-search`}
            label={libraryCopy.search}
            type="search"
            value={search}
            wrapperClassName="min-w-56 flex-1"
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            id={`${headingId}-kind`}
            label={libraryCopy.category}
            value={kind}
            wrapperClassName="min-w-48"
            onChange={(event) => setKind(event.target.value as BrandAssetKind | '')}
          >
            <option value="">{libraryCopy.allCategories}</option>
            {ASSET_KINDS.map((value) => (
              <option key={value} value={value}>
                {assetKindLabel[value]}
              </option>
            ))}
          </Select>
          <ViewModeToggle value={view} onChange={setView} />
        </div>
      ) : null}

      {state.status === 'loading' ? (
        <Card className="min-h-36">
          <LoadingState layout="panel" label={libraryCopy.loading} />
        </Card>
      ) : null}
      {state.status === 'error' ? (
        <ErrorBanner error={state.error} title={libraryCopy.loadFailedTitle} onRetry={reload} />
      ) : null}
      {state.status === 'ready' && assets.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={libraryCopy.empty}
          description={libraryCopy.emptyDescription}
          icon="◇"
          action={<Button onClick={() => setUploading(true)}>{libraryCopy.upload}</Button>}
        />
      ) : null}
      {state.status === 'ready' && assets.length > 0 ? (
        <>
          <p className="m-0 text-body-sm text-text-secondary" aria-live="polite">
            {libraryCopy.count(shown.length, assets.length)}
          </p>
          {shown.length === 0 ? (
            <p className="m-0 text-body-md text-text-secondary">{libraryCopy.noMatches}</p>
          ) : view === 'table' ? (
            <AssetTable api={api} assets={shown} onOpen={setOpen} />
          ) : (
            <AssetCards api={api} assets={shown} onOpen={setOpen} />
          )}
        </>
      ) : null}

      {uploading ? <UploadAssetDialog api={api} onClose={() => setUploading(false)} onSaved={saved} /> : null}
      {open === null ? null : (
        <AssetDetailDialog
          key={open.id}
          api={api}
          asset={open}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onDeleted={deleted}
        />
      )}
    </section>
  );
}
