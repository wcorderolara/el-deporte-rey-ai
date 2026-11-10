import type { BrandAsset, VisualTemplateBackgroundInput, VisualTemplateContentType } from '@edr/contracts';
import { useId } from 'react';

import { Button } from '../../../ui';
import { usagePolicyLabel } from '../../brand/copy';
import { PreviewImage } from '../../brand/PreviewImage';
import { editorCopy } from '../copy';
import { backgroundAssets, brandMarkAssets, hasTeamBadges, imageAssets } from '../layers';

export interface ResourcesPanelProps {
  assets: readonly BrandAsset[];
  contentType: VisualTemplateContentType;
  readOnly: boolean;
  background: VisualTemplateBackgroundInput;
  /** API URL of a brand asset file. */
  assetUrl: (assetId: string) => string;
  onAddImage: (asset: BrandAsset) => void;
  onAddMark: (asset: BrandAsset) => void;
  onUseBackground: (asset: BrandAsset) => void;
  /** Opens the background dialog (approved proposals and Mi marca backgrounds). */
  onMoreBackgrounds: () => void;
}

interface Group {
  readonly key: string;
  readonly heading: string;
  readonly empty: string;
  readonly assets: readonly BrandAsset[];
  readonly action: string;
  readonly onUse: (asset: BrandAsset) => void;
  readonly current?: (asset: BrandAsset) => boolean;
}

/**
 * The libraries of Mi marca the template can place (PD-ARCH-01G-A): the official logos and mascots (an official
 * resource layer), the graphic elements (an image layer) and the backgrounds (the template background). Only what
 * the library holds is listed; team badges are not a library here: a badge layer draws the badge of the match team.
 */
export function ResourcesPanel({
  assets,
  contentType,
  readOnly,
  background,
  assetUrl,
  onAddImage,
  onAddMark,
  onUseBackground,
  onMoreBackgrounds,
}: ResourcesPanelProps) {
  const baseId = useId();
  const groups: Group[] = [
    {
      key: 'logos',
      heading: editorCopy.resourceLogos,
      empty: editorCopy.noLogo,
      assets: brandMarkAssets(assets, 'brand_logo'),
      action: editorCopy.resourceAdd,
      onUse: onAddMark,
    },
    {
      key: 'mascots',
      heading: editorCopy.resourceMascots,
      empty: editorCopy.noMascot,
      assets: brandMarkAssets(assets, 'mascot'),
      action: editorCopy.resourceAdd,
      onUse: onAddMark,
    },
    {
      key: 'images',
      heading: editorCopy.resourceImages,
      empty: editorCopy.noImageAsset,
      assets: imageAssets(assets).filter((asset) => asset.kind === 'decoration'),
      action: editorCopy.resourceAdd,
      onUse: onAddImage,
    },
    {
      key: 'backgrounds',
      heading: editorCopy.resourceBackgrounds,
      empty: editorCopy.backgroundNone,
      assets: backgroundAssets(assets),
      action: editorCopy.resourceUseBackground,
      onUse: onUseBackground,
      current: (asset) => background.source === 'brand_asset' && background.id === asset.id,
    },
  ];

  return (
    <div className="grid gap-5">
      <p className="m-0 text-caption text-text-secondary">{editorCopy.resourcesIntro}</p>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`${baseId}-${group.key}`} className="grid gap-2">
          <h3
            id={`${baseId}-${group.key}`}
            className="m-0 text-caption font-bold tracking-label text-text-secondary uppercase"
          >
            {group.heading}
          </h3>
          {group.assets.length === 0 ? (
            <p className="m-0 text-caption text-text-subtle">{group.empty}</p>
          ) : (
            <ul aria-labelledby={`${baseId}-${group.key}`} className="m-0 grid list-none gap-1 p-0">
              {group.assets.map((asset) => {
                const current = group.current?.(asset) === true;
                return (
                  <li
                    key={asset.id}
                    className="flex min-w-0 items-center gap-2 rounded-control p-1 hover:bg-surface-card"
                  >
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border-subtle bg-surface-canvas">
                      <PreviewImage
                        src={assetUrl(asset.id)}
                        alt=""
                        failedText="—"
                        className="max-h-full max-w-full object-contain"
                      />
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-body-sm font-bold text-text-primary" title={asset.label}>
                        {asset.label}
                      </span>
                      <span className="truncate text-caption text-text-secondary">
                        {current ? editorCopy.resourceCurrentBackground : usagePolicyLabel[asset.usagePolicy]}
                      </span>
                    </span>
                    {readOnly || current ? null : (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`${group.action}: ${asset.label}`}
                        onClick={() => group.onUse(asset)}
                      >
                        {group.action}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {group.key === 'backgrounds' && !readOnly ? (
            <Button size="sm" variant="secondary" onClick={onMoreBackgrounds}>
              {editorCopy.changeBackground}
            </Button>
          ) : null}
        </section>
      ))}
      {hasTeamBadges(contentType) ? (
        <p className="m-0 text-caption text-text-subtle">{editorCopy.resourceBadgesNote}</p>
      ) : null}
    </div>
  );
}
