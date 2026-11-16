import type { BrandAsset, VisualTemplateBackgroundInput } from '@edr/contracts';
import { useCallback, useState } from 'react';

import { Button, ErrorBanner, LoadingState, Modal, ModalFooter } from '../../../ui';
import type { BrandApi } from '../../brand/brandApi';
import { PreviewImage } from '../../brand/PreviewImage';
import { useResource } from '../../brand/useResource';
import type { DesignApi } from '../../design/designApi';
import { editorCopy } from '../copy';
import { backgroundAssets } from '../layers';

export interface BackgroundChoice {
  background: VisualTemplateBackgroundInput;
  label: string;
}

export interface BackgroundDialogProps {
  designApi: DesignApi;
  brandApi: BrandApi;
  assets: readonly BrandAsset[];
  current: VisualTemplateBackgroundInput;
  onChoose: (choice: BackgroundChoice) => void;
  onClose: () => void;
}

interface Option extends BackgroundChoice {
  url: string;
}

/** Another background for the draft: an approved design proposal or an active background of Mi marca. */
export function BackgroundDialog({ designApi, brandApi, assets, current, onChoose, onClose }: BackgroundDialogProps) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      (await designApi.listProposals(signal)).filter((proposal) => proposal.status === 'approved'),
    [designApi],
  );
  const { state, reload } = useResource(load);
  const [chosen, setChosen] = useState<string>(`${current.source}:${current.id}`);

  const proposals: Option[] =
    state.status === 'ready'
      ? state.data.map((proposal) => ({
          background: { source: 'design_proposal', id: proposal.id },
          label: proposal.name,
          url: designApi.proposalBackgroundUrl(proposal.id),
        }))
      : [];
  const brand: Option[] = backgroundAssets(assets).map((asset) => ({
    background: { source: 'brand_asset', id: asset.id },
    label: asset.label,
    url: brandApi.assetFileUrl(asset.id),
  }));
  const all = [...proposals, ...brand];
  const selected = all.find((option) => `${option.background.source}:${option.background.id}` === chosen);

  function group(title: string, options: Option[]) {
    if (options.length === 0) return null;
    return (
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-2 text-body-sm font-bold text-text-primary">{title}</legend>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
          {options.map((option) => {
            const key = `${option.background.source}:${option.background.id}`;
            return (
              <li key={key}>
                <label
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${chosen === key ? 'border-brand-gold bg-surface-card' : 'border-border-subtle bg-surface-raised'}`}
                >
                  <input
                    type="radio"
                    name="template-background"
                    checked={chosen === key}
                    onChange={() => setChosen(key)}
                  />
                  <span className="relative grid h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-canvas">
                    <PreviewImage
                      key={option.url}
                      src={option.url}
                      alt={option.label}
                      failedText={editorCopy.backgroundFailed}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </span>
                  <span className="min-w-0 break-words text-body-sm text-text-primary">{option.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  }

  return (
    <Modal title={editorCopy.backgroundTitle} onClose={onClose} size="lg">
      <div className="grid gap-5">
        {state.status === 'loading' ? <LoadingState layout="panel" label={editorCopy.loading} /> : null}
        {state.status === 'error' ? (
          <ErrorBanner error={state.error} title={editorCopy.loadFailedTitle} onRetry={reload} />
        ) : null}
        {group(editorCopy.backgroundProposals, proposals)}
        {group(editorCopy.backgroundAssets, brand)}
        {state.status === 'ready' && all.length === 0 ? (
          <p className="m-0 text-body-sm text-text-secondary">{editorCopy.backgroundNone}</p>
        ) : null}
        <ModalFooter onCancel={onClose}>
          <Button
            disabled={selected === undefined}
            onClick={() => {
              if (selected !== undefined) onChoose({ background: selected.background, label: selected.label });
            }}
          >
            {editorCopy.backgroundApply}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
