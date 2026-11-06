import type { BrandAsset, BrandAssetKind, BrandAssetUsagePolicy } from '@edr/contracts';
import { useEffect, useId, useRef, useState } from 'react';

import { Button, ErrorBanner, Input, Modal, ModalFooter, Select, Textarea } from '../../ui';
import type { BrandApi } from './brandApi';
import {
  assetKindDescription,
  assetKindLabel,
  libraryCopy,
  uploadCopy,
  usagePolicyDescription,
  usagePolicyLabel,
} from './copy';
import {
  ASSET_KINDS,
  acceptFor,
  allowedPolicies,
  checkUpload,
  defaultPolicy,
  hasVariant,
  optionalText,
  type UploadErrors,
} from './library';

export interface UploadAssetDialogProps {
  api: BrandApi;
  onClose: () => void;
  onSaved: (asset: BrandAsset) => void;
}

/** The browser's object URL of a chosen file, revoked when it changes or the dialog closes. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/**
 * Upload of a brand asset (PD-ARCH-01G-A): file with preview, format, size and dimensions; name, category,
 * description, variants and the AI usage policy, visible before saving and proposed by category (never
 * `transformable`). The client checks mirror the server, which checks everything again.
 */
export function UploadAssetDialog({ api, onClose, onSaved }: UploadAssetDialogProps) {
  const baseId = useId();
  const [kind, setKind] = useState<BrandAssetKind>('brand_logo');
  const [policy, setPolicy] = useState<BrandAssetUsagePolicy>(defaultPolicy('brand_logo'));
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [official, setOfficial] = useState(false);
  const [variant, setVariant] = useState('');
  const [pose, setPose] = useState('');
  const [expression, setExpression] = useState('');
  const [errors, setErrors] = useState<UploadErrors>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const preview = useObjectUrl(file);

  useEffect(() => () => controller.current?.abort(), []);

  function chooseKind(next: BrandAssetKind) {
    setKind(next);
    setPolicy(defaultPolicy(next));
    setErrors({});
  }

  function chooseFile(next: File | null) {
    setFile(next);
    setDimensions(null);
    setErrors((current) => ({ ...current, file: undefined }));
    if (next !== null && label.trim() === '') {
      setLabel(next.name.replace(/\.[^.]+$/u, '').slice(0, 80));
    }
  }

  async function submit() {
    const found = checkUpload({ file, kind, label, description, variant, pose, expression, dimensions });
    setErrors(found);
    if (Object.keys(found).length > 0 || file === null) {
      const first = Object.keys(found)[0];
      document.getElementById(`${baseId}-${first ?? 'file'}`)?.focus();
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setSending(true);
    setFailure(null);
    try {
      const saved = await api.registerAsset(
        {
          kind,
          label: label.trim(),
          file,
          usagePolicy: policy,
          official,
          ...(optionalText(description) === undefined ? {} : { description: description.trim() }),
          ...(hasVariant(kind) && optionalText(variant) !== undefined ? { variant: variant.trim() } : {}),
          ...(kind === 'mascot' && optionalText(pose) !== undefined ? { pose: pose.trim() } : {}),
          ...(kind === 'mascot' && optionalText(expression) !== undefined ? { expression: expression.trim() } : {}),
        },
        current.signal,
      );
      if (!current.signal.aborted) {
        onSaved(saved);
      }
    } catch (error) {
      if (!current.signal.aborted) {
        setFailure(error);
        setSending(false);
      }
    }
  }

  const policies = allowedPolicies(kind);
  const fieldId = (name: string) => `${baseId}-${name}`;

  return (
    <Modal title={uploadCopy.title} onClose={onClose} closeDisabled={sending}>
      <form
        noValidate
        className="grid gap-5"
        aria-busy={sending}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Select
          id={fieldId('kind')}
          label={uploadCopy.category}
          description={assetKindDescription[kind]}
          value={kind}
          disabled={sending}
          onChange={(event) => chooseKind(event.target.value as BrandAssetKind)}
        >
          {ASSET_KINDS.map((value) => (
            <option key={value} value={value}>
              {assetKindLabel[value]}
            </option>
          ))}
        </Select>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Input
            ref={fileRef}
            id={fieldId('file')}
            type="file"
            label={uploadCopy.file}
            description={uploadCopy.fileHint}
            accept={acceptFor(kind)}
            required
            disabled={sending}
            error={errors.file}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <figure className="m-0 grid min-h-28 place-items-center overflow-hidden rounded-xl border border-border-subtle bg-surface-canvas">
            {preview === null ? (
              <figcaption className="p-3 text-center text-caption text-text-subtle">
                {uploadCopy.previewTitle}
              </figcaption>
            ) : (
              <img
                src={preview}
                alt={libraryCopy.previewAlt(label.trim() === '' ? (file?.name ?? '') : label.trim())}
                className="max-h-40 w-full object-contain"
                onLoad={(event) =>
                  setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
                }
              />
            )}
          </figure>
        </div>
        {file === null ? null : (
          <dl className="m-0 grid grid-cols-3 gap-3 rounded-xl border border-border-subtle bg-surface-card p-3 text-body-sm">
            <div>
              <dt className="text-caption font-bold text-text-secondary">{uploadCopy.format}</dt>
              <dd className="m-0 text-text-primary">
                {file.type === '' ? '—' : file.type.replace('image/', '').toUpperCase()}
              </dd>
            </div>
            <div>
              <dt className="text-caption font-bold text-text-secondary">{uploadCopy.size}</dt>
              <dd className="m-0 text-text-primary">{libraryCopy.bytes(file.size)}</dd>
            </div>
            <div>
              <dt className="text-caption font-bold text-text-secondary">{uploadCopy.dimensions}</dt>
              <dd className="m-0 text-text-primary">
                {dimensions === null ? '—' : libraryCopy.dimensions(dimensions.width, dimensions.height)}
              </dd>
            </div>
          </dl>
        )}

        <Input
          id={fieldId('label')}
          label={uploadCopy.name}
          description={uploadCopy.nameHint}
          value={label}
          maxLength={80}
          required
          disabled={sending}
          error={errors.label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Textarea
          id={fieldId('description')}
          label={uploadCopy.description}
          description={uploadCopy.descriptionHint}
          value={description}
          maxLength={500}
          rows={3}
          disabled={sending}
          error={errors.description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {hasVariant(kind) ? (
          <Input
            id={fieldId('variant')}
            label={uploadCopy.variant}
            description={uploadCopy.variantHint}
            value={variant}
            maxLength={80}
            disabled={sending}
            error={errors.variant}
            onChange={(event) => setVariant(event.target.value)}
          />
        ) : null}
        {kind === 'mascot' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id={fieldId('pose')}
              label={uploadCopy.pose}
              value={pose}
              maxLength={80}
              disabled={sending}
              error={errors.pose}
              onChange={(event) => setPose(event.target.value)}
            />
            <Input
              id={fieldId('expression')}
              label={uploadCopy.expression}
              value={expression}
              maxLength={80}
              disabled={sending}
              error={errors.expression}
              onChange={(event) => setExpression(event.target.value)}
            />
          </div>
        ) : null}

        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1 text-body-sm font-bold text-text-primary">{uploadCopy.policy}</legend>
          <p className="m-0 text-caption text-text-secondary">
            {kind === 'style_reference' ? uploadCopy.referenceFixed : uploadCopy.policyHint}
          </p>
          {policies.map((value) => (
            <label
              key={value}
              className={`flex min-h-touch items-start gap-3 rounded-xl border px-3 py-2 ${policy === value ? 'border-brand-gold bg-surface-card' : 'border-border-subtle'}`}
            >
              <input
                type="radio"
                name={fieldId('policy')}
                value={value}
                checked={policy === value}
                disabled={sending}
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
            disabled={sending}
            onChange={(event) => setOfficial(event.target.checked)}
          />
          {uploadCopy.official}
        </label>

        {failure === null ? null : (
          <ErrorBanner error={failure} title={uploadCopy.failedTitle} onRetry={() => void submit()} />
        )}

        <ModalFooter onCancel={onClose} cancelDisabled={sending}>
          <Button type="submit" isLoading={sending} loadingLabel={uploadCopy.submitting}>
            {uploadCopy.submit}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
