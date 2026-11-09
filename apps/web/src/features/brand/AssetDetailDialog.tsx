import type { BrandAsset, BrandAssetDetail, BrandAssetUsagePolicy } from '@edr/contracts';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Alert, Badge, Button, ErrorBanner, formatDateTime, Input, LoadingState, Modal, Textarea } from '../../ui';
import type { BrandApi, UpdateAssetInput } from './brandApi';
import {
  assetKindLabel,
  detailCopy,
  libraryCopy,
  uploadCopy,
  usagePolicyDescription,
  usagePolicyLabel,
  usagePolicyTone,
} from './copy';
import { allowedPolicies, canBePrimary, checkMetadata, hasVariant, nullableText, type UploadErrors } from './library';
import { PreviewImage } from './PreviewImage';
import { useResource } from './useResource';

export interface AssetDetailDialogProps {
  api: BrandApi;
  asset: BrandAsset;
  onClose: () => void;
  /** Called with the asset returned by a successful edit. */
  onChanged: (asset: BrandAsset) => void;
  /** Called after a successful deletion. */
  onDeleted: (asset: BrandAsset) => void;
}

type Action = 'save' | 'toggle' | 'primary' | 'delete';

/**
 * Detail of a library asset (PD-ARCH-01G-A): preview, metadata, usage in generated content, editable properties
 * (the file never changes), activation, the primary mark of logos and mascot, and a deletion that is offered only for
 * an asset no generated slide uses; the server checks the dependencies again.
 */
export function AssetDetailDialog({ api, asset: initial, onClose, onChanged, onDeleted }: AssetDetailDialogProps) {
  const baseId = useId();
  const load = useCallback((signal: AbortSignal) => api.getAsset(initial.id, signal), [api, initial.id]);
  const { state, reload, update } = useResource<BrandAssetDetail>(load);
  const asset = state.status === 'ready' ? state.data.asset : initial;
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description ?? '');
  const [variant, setVariant] = useState(initial.variant ?? '');
  const [pose, setPose] = useState(initial.pose ?? '');
  const [expression, setExpression] = useState(initial.expression ?? '');
  const [policy, setPolicy] = useState<BrandAssetUsagePolicy>(initial.usagePolicy);
  const [official, setOfficial] = useState(initial.official);
  const [errors, setErrors] = useState<UploadErrors>({});
  const [action, setAction] = useState<Action | null>(null);
  const [failure, setFailure] = useState<{ action: Action; error: unknown } | null>(null);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function run(next: Action, work: (signal: AbortSignal) => Promise<BrandAsset | null>) {
    if (action !== null) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setAction(next);
    setFailure(null);
    setMessage('');
    try {
      const result = await work(current.signal);
      if (current.signal.aborted) return;
      setAction(null);
      if (result === null) {
        onDeleted(asset);
        return;
      }
      update((detail) => ({ ...detail, asset: result }));
      onChanged(result);
      setMessage(detailCopy.saved);
    } catch (error) {
      if (!current.signal.aborted) {
        setAction(null);
        setFailure({ action: next, error });
      }
    }
  }

  function save() {
    const found = checkMetadata({ kind: asset.kind, label, description, variant, pose, expression });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const patch: UpdateAssetInput = {
      label: label.trim(),
      description: nullableText(description),
      usagePolicy: policy,
      official,
      ...(hasVariant(asset.kind) ? { variant: nullableText(variant) } : {}),
      ...(asset.kind === 'mascot' ? { pose: nullableText(pose), expression: nullableText(expression) } : {}),
    };
    void run('save', (signal) => api.updateAsset(asset.id, patch, signal));
  }

  const usage = state.status === 'ready' ? state.data.usage : null;
  const inUse = usage !== null && (usage.renderedVersions > 0 || usage.templates > 0);
  const busy = action !== null;
  const fieldId = (name: string) => `${baseId}-${name}`;

  return (
    <Modal title={detailCopy.title(asset.label)} onClose={onClose} closeDisabled={busy}>
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <figure className="m-0 grid min-h-40 place-items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-canvas p-2">
            <PreviewImage
              key={asset.sha256}
              src={api.assetFileUrl(asset.id)}
              alt={libraryCopy.previewAlt(asset.label)}
              failedText={libraryCopy.previewFailed}
              className="h-48 w-full object-contain"
              width={asset.width}
              height={asset.height}
            />
          </figure>
          <div className="grid content-start gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone={usagePolicyTone[asset.usagePolicy]}>{usagePolicyLabel[asset.usagePolicy]}</Badge>
              <Badge tone={asset.active ? 'success' : 'neutral'}>
                {asset.active ? libraryCopy.active : libraryCopy.inactive}
              </Badge>
              {asset.official ? <Badge tone="attested">{libraryCopy.official}</Badge> : null}
              {asset.primary ? <Badge tone="info">{libraryCopy.primary}</Badge> : null}
            </div>
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm">
              <dt className="text-caption font-bold text-text-secondary">{detailCopy.category}</dt>
              <dd className="m-0 text-text-primary">{assetKindLabel[asset.kind]}</dd>
              <dt className="text-caption font-bold text-text-secondary">{detailCopy.format}</dt>
              <dd className="m-0 text-text-primary">{libraryCopy.mimeLabel[asset.mime]}</dd>
              <dt className="text-caption font-bold text-text-secondary">{detailCopy.dimensions}</dt>
              <dd className="m-0 text-text-primary">{libraryCopy.dimensions(asset.width, asset.height)}</dd>
              <dt className="text-caption font-bold text-text-secondary">{detailCopy.size}</dt>
              <dd className="m-0 text-text-primary">{libraryCopy.bytes(asset.byteSize)}</dd>
              <dt className="text-caption font-bold text-text-secondary">{detailCopy.registeredAt}</dt>
              <dd className="m-0 text-text-primary">
                <time dateTime={asset.registeredAt}>{formatDateTime(asset.registeredAt)}</time>
              </dd>
              <dt className="text-caption font-bold text-text-secondary">{detailCopy.updatedAt}</dt>
              <dd className="m-0 text-text-primary">
                <time dateTime={asset.updatedAt}>{formatDateTime(asset.updatedAt)}</time>
              </dd>
            </dl>
            <section aria-label={detailCopy.usage} className="text-body-sm">
              <p className="m-0 text-caption font-bold text-text-secondary">{detailCopy.usage}</p>
              {state.status === 'loading' ? <LoadingState label={detailCopy.loading} /> : null}
              {state.status === 'error' ? (
                <ErrorBanner error={state.error} title={detailCopy.loadFailedTitle} onRetry={reload} />
              ) : null}
              {usage === null ? null : (
                <>
                  <p className="m-0 text-text-primary">
                    {detailCopy.usageValue(usage.renderedVersions, usage.projects, usage.exports)}
                  </p>
                  <p className="m-0 text-text-primary">{detailCopy.templateUsage(usage.templates)}</p>
                </>
              )}
            </section>
          </div>
        </div>

        <form
          noValidate
          aria-labelledby={fieldId('edit')}
          className="grid gap-4 border-t border-border-subtle pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h3 id={fieldId('edit')} className="m-0 text-body-lg font-bold text-text-primary">
            {detailCopy.editHeading}
          </h3>
          <p className="m-0 text-caption text-text-secondary">{detailCopy.fileUnchanged}</p>
          <Input
            id={fieldId('label')}
            label={uploadCopy.name}
            value={label}
            maxLength={80}
            required
            disabled={busy}
            error={errors.label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Textarea
            id={fieldId('description')}
            label={uploadCopy.description}
            value={description}
            maxLength={500}
            rows={3}
            disabled={busy}
            error={errors.description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {hasVariant(asset.kind) ? (
            <Input
              id={fieldId('variant')}
              label={uploadCopy.variant}
              value={variant}
              maxLength={80}
              disabled={busy}
              error={errors.variant}
              onChange={(event) => setVariant(event.target.value)}
            />
          ) : null}
          {asset.kind === 'mascot' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id={fieldId('pose')}
                label={uploadCopy.pose}
                value={pose}
                maxLength={80}
                disabled={busy}
                error={errors.pose}
                onChange={(event) => setPose(event.target.value)}
              />
              <Input
                id={fieldId('expression')}
                label={uploadCopy.expression}
                value={expression}
                maxLength={80}
                disabled={busy}
                error={errors.expression}
                onChange={(event) => setExpression(event.target.value)}
              />
            </div>
          ) : null}
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1 text-body-sm font-bold text-text-primary">{uploadCopy.policy}</legend>
            {allowedPolicies(asset.kind).map((value) => (
              <label
                key={value}
                className={`flex min-h-touch items-start gap-3 rounded-xl border px-3 py-2 ${policy === value ? 'border-brand-gold bg-surface-card' : 'border-border-subtle'}`}
              >
                <input
                  type="radio"
                  name={fieldId('policy')}
                  value={value}
                  checked={policy === value}
                  disabled={busy}
                  onChange={() => setPolicy(value)}
                />
                <span>
                  <strong className="text-text-primary">{usagePolicyLabel[value]}</strong>
                  <small className="block text-text-secondary">{usagePolicyDescription[value]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-touch items-center gap-3 text-body-sm text-text-primary">
            <input
              type="checkbox"
              checked={official}
              disabled={busy}
              onChange={(event) => setOfficial(event.target.checked)}
            />
            {uploadCopy.official}
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={action === 'save'} loadingLabel={detailCopy.saving} disabled={busy}>
              {detailCopy.save}
            </Button>
          </div>
        </form>

        <section aria-label={detailCopy.state} className="grid gap-3 border-t border-border-subtle pt-4">
          <p className="m-0 text-caption text-text-secondary">{detailCopy.stateHint}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              isLoading={action === 'toggle'}
              loadingLabel={detailCopy.saving}
              disabled={busy}
              onClick={() =>
                void run('toggle', (signal) => api.updateAsset(asset.id, { active: !asset.active }, signal))
              }
            >
              {asset.active ? detailCopy.deactivate : detailCopy.activate}
            </Button>
            {hasVariant(asset.kind) && !asset.primary ? (
              <Button
                variant="secondary"
                isLoading={action === 'primary'}
                loadingLabel={detailCopy.saving}
                disabled={busy || !canBePrimary(asset)}
                onClick={() => void run('primary', (signal) => api.updateAsset(asset.id, { primary: true }, signal))}
              >
                {detailCopy.makePrimary}
              </Button>
            ) : null}
          </div>
          {hasVariant(asset.kind) ? (
            <p className="m-0 text-caption text-text-secondary">
              {asset.primary ? detailCopy.isPrimary : detailCopy.primaryHint(assetKindLabel[asset.kind].toLowerCase())}
            </p>
          ) : null}
        </section>

        <section aria-label={detailCopy.delete} className="grid gap-3 border-t border-border-subtle pt-4">
          {inUse ? (
            <Alert tone="warning" role="note">
              {usage !== null && usage.renderedVersions > 0
                ? detailCopy.deleteBlocked
                : detailCopy.deleteBlockedTemplates}
            </Alert>
          ) : null}
          {confirming && !inUse ? (
            <Alert tone="danger" role="alert" title={detailCopy.deleteConfirmTitle}>
              <p className="m-0">{detailCopy.deleteConfirm}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
                  {detailCopy.cancel}
                </Button>
                <Button
                  variant="danger"
                  isLoading={action === 'delete'}
                  loadingLabel={detailCopy.deleting}
                  disabled={busy}
                  onClick={() =>
                    void run('delete', async (signal) => {
                      await api.deleteAsset(asset.id, signal);
                      return null;
                    })
                  }
                >
                  {detailCopy.confirmDelete}
                </Button>
              </div>
            </Alert>
          ) : (
            <div>
              <Button variant="danger" disabled={busy || inUse || usage === null} onClick={() => setConfirming(true)}>
                {detailCopy.delete}
              </Button>
            </div>
          )}
        </section>

        {failure === null ? null : (
          <ErrorBanner
            error={failure.error}
            title={failure.action === 'delete' ? detailCopy.deleteFailedTitle : detailCopy.saveFailedTitle}
          />
        )}
        <p role="status" aria-live="polite" className="m-0 text-body-sm text-text-secondary">
          {message}
        </p>
      </div>
    </Modal>
  );
}
