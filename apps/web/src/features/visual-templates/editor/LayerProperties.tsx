import {
  BrandColorRoleSchema,
  BrandFontRoleSchema,
  MAX_VISUAL_TEMPLATE_FONT_SIZE,
  MAX_VISUAL_TEMPLATE_LINES,
  MAX_VISUAL_TEMPLATE_TEXT,
  MIN_VISUAL_TEMPLATE_FONT_SIZE,
  VisualTemplateImageFitSchema,
  VisualTemplateTextEffectSchema,
  type BrandAsset,
  type BrandIdentity,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplateImageFit,
  type VisualTemplateLayer,
  type VisualTemplateTextEffect,
  type VisualTemplateTextStyle,
} from '@edr/contracts';
import { useId, type ReactNode } from 'react';

import { Input, Select, Textarea } from '../../../ui';
import { identityCopy, usagePolicyLabel } from '../../brand/copy';
import {
  alignLabel,
  bindingLabel,
  editorCopy,
  effectLabel,
  fitLabel,
  layerTypeLabel,
  overflowLabel,
  verticalAlignLabel,
} from '../copy';
import { bindingsFor, brandMarkAssets, clampBox, imageAssets, percent } from '../layers';

export interface LayerPropertiesProps {
  layer: VisualTemplateLayer;
  contentType: VisualTemplateContentType;
  readOnly: boolean;
  assets: readonly BrandAsset[];
  identity: BrandIdentity | null;
  onChange: (layer: VisualTemplateLayer) => void;
}

function intValue(text: string, fallback: number): number {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : fallback;
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 grid gap-3 rounded-xl border border-border-subtle p-3">
      <legend className="px-1 text-caption font-bold text-text-secondary">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * The properties of the selected layer (PD-ARCH-01G-C): name, visibility, position and size as percentages of the
 * canvas, and the properties of its type. Fonts and colours are the brand roles only; images come from Mi marca only.
 * A published version shows the same controls, disabled.
 */
export function LayerProperties({ layer, contentType, readOnly, assets, identity, onChange }: LayerPropertiesProps) {
  const baseId = useId();
  const field = (name: string) => `${baseId}-${name}`;

  function box(name: 'x' | 'y' | 'width' | 'height', text: string) {
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value)) return;
    onChange({ ...layer, ...clampBox({ ...layer, [name]: value / 100 }) });
  }

  function style(change: Partial<VisualTemplateTextStyle>) {
    if (layer.type === 'text' || layer.type === 'sports_data') {
      onChange({ ...layer, style: { ...layer.style, ...change } });
    }
  }

  const assetOptions =
    layer.type === 'image' ? imageAssets(assets) : layer.type === 'brand_asset' ? brandMarkAssets(assets) : [];
  const current =
    layer.type === 'image' || layer.type === 'brand_asset'
      ? assets.find((asset) => asset.id === layer.assetId)
      : undefined;
  const missingAsset =
    (layer.type === 'image' || layer.type === 'brand_asset') &&
    !assetOptions.some((asset) => asset.id === layer.assetId);

  return (
    <fieldset disabled={readOnly} className="m-0 grid min-w-0 gap-4 border-0 p-0">
      <legend className="sr-only">{editorCopy.properties}</legend>
      <p className="m-0 text-caption font-bold tracking-label text-info uppercase">{layerTypeLabel[layer.type]}</p>
      <Input
        id={field('name')}
        label={editorCopy.layerName}
        value={layer.name}
        maxLength={80}
        onChange={(event) => onChange({ ...layer, name: event.target.value })}
      />
      <label className="flex items-center gap-2 text-body-sm text-text-primary">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(event) => onChange({ ...layer, visible: event.target.checked })}
        />
        {editorCopy.visible}
      </label>
      <Group legend={editorCopy.position}>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['x', editorCopy.x],
              ['y', editorCopy.y],
              ['width', editorCopy.width],
              ['height', editorCopy.height],
            ] as const
          ).map(([name, label]) => (
            <Input
              key={name}
              id={field(name)}
              type="number"
              label={label}
              min={name === 'width' || name === 'height' ? 1 : 0}
              max={100}
              step={0.1}
              value={percent(layer[name])}
              onChange={(event) => box(name, event.target.value)}
            />
          ))}
        </div>
      </Group>

      {layer.type === 'text' ? (
        <Textarea
          id={field('text')}
          label={editorCopy.text}
          value={layer.text}
          rows={3}
          maxLength={MAX_VISUAL_TEMPLATE_TEXT}
          onChange={(event) => onChange({ ...layer, text: event.target.value })}
        />
      ) : null}

      {layer.type === 'sports_data' ? (
        <>
          <Select
            id={field('binding')}
            label={editorCopy.binding}
            value={layer.binding ?? ''}
            onChange={(event) =>
              onChange({
                ...layer,
                binding: event.target.value === '' ? null : (event.target.value as VisualTemplateBinding),
              })
            }
          >
            <option value="">{editorCopy.noBinding}</option>
            {bindingsFor(contentType).map((binding) => (
              <option key={binding} value={binding}>
                {bindingLabel[binding]}
              </option>
            ))}
          </Select>
          <label className="flex items-start gap-2 text-body-sm text-text-primary">
            <input
              type="checkbox"
              checked={layer.required}
              onChange={(event) => onChange({ ...layer, required: event.target.checked })}
            />
            {editorCopy.required}
          </label>
        </>
      ) : null}

      {layer.type === 'text' || layer.type === 'sports_data' ? (
        <Group legend={editorCopy.fontRole}>
          <Select
            id={field('font')}
            label={editorCopy.fontRole}
            value={layer.style.fontRole}
            onChange={(event) => style({ fontRole: event.target.value as VisualTemplateTextStyle['fontRole'] })}
          >
            {BrandFontRoleSchema.options.map((role) => {
              const face = identity?.typography.find((entry) => entry.role === role);
              return (
                <option key={role} value={role}>
                  {face === undefined
                    ? identityCopy.fontRole[role]
                    : editorCopy.fontRoleOption(identityCopy.fontRole[role], face.family, face.weight)}
                </option>
              );
            })}
          </Select>
          <div className="grid grid-cols-3 gap-3">
            <Input
              id={field('max-size')}
              type="number"
              label={editorCopy.maxFontSize}
              min={MIN_VISUAL_TEMPLATE_FONT_SIZE}
              max={MAX_VISUAL_TEMPLATE_FONT_SIZE}
              value={layer.style.maxFontSize}
              onChange={(event) => style({ maxFontSize: intValue(event.target.value, layer.style.maxFontSize) })}
            />
            <Input
              id={field('min-size')}
              type="number"
              label={editorCopy.minFontSize}
              min={MIN_VISUAL_TEMPLATE_FONT_SIZE}
              max={MAX_VISUAL_TEMPLATE_FONT_SIZE}
              value={layer.style.minFontSize}
              onChange={(event) => style({ minFontSize: intValue(event.target.value, layer.style.minFontSize) })}
            />
            <Input
              id={field('lines')}
              type="number"
              label={editorCopy.maxLines}
              min={1}
              max={MAX_VISUAL_TEMPLATE_LINES}
              value={layer.style.maxLines}
              onChange={(event) => style({ maxLines: intValue(event.target.value, layer.style.maxLines) })}
            />
          </div>
          <div className="flex items-end gap-3">
            <Select
              id={field('color')}
              label={editorCopy.color}
              value={layer.style.colorRole}
              wrapperClassName="flex-1"
              onChange={(event) => style({ colorRole: event.target.value as VisualTemplateTextStyle['colorRole'] })}
            >
              {BrandColorRoleSchema.options.map((role) => (
                <option key={role} value={role}>
                  {identityCopy.colorRole[role]}
                </option>
              ))}
            </Select>
            <span
              aria-hidden="true"
              className="mb-2 size-8 shrink-0 rounded-lg border border-border-strong"
              style={{
                backgroundColor: identity?.palette.find((entry) => entry.role === layer.style.colorRole)?.value,
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              id={field('align')}
              label={editorCopy.align}
              value={layer.style.align}
              onChange={(event) => style({ align: event.target.value as VisualTemplateTextStyle['align'] })}
            >
              {(['left', 'center', 'right'] as const).map((value) => (
                <option key={value} value={value}>
                  {alignLabel[value]}
                </option>
              ))}
            </Select>
            <Select
              id={field('valign')}
              label={editorCopy.verticalAlign}
              value={layer.style.verticalAlign}
              onChange={(event) =>
                style({ verticalAlign: event.target.value as VisualTemplateTextStyle['verticalAlign'] })
              }
            >
              {(['top', 'middle', 'bottom'] as const).map((value) => (
                <option key={value} value={value}>
                  {verticalAlignLabel[value]}
                </option>
              ))}
            </Select>
          </div>
          <Select
            id={field('overflow')}
            label={editorCopy.overflow}
            description={editorCopy.overflowNote}
            value={layer.style.overflow}
            onChange={(event) => style({ overflow: event.target.value as VisualTemplateTextStyle['overflow'] })}
          >
            {(['shrink', 'fixed'] as const).map((value) => (
              <option key={value} value={value}>
                {overflowLabel[value]}
              </option>
            ))}
          </Select>
          <Select
            id={field('effect')}
            label={editorCopy.effect}
            description={editorCopy.effectNote}
            value={layer.style.effect ?? 'none'}
            onChange={(event) => style({ effect: event.target.value as VisualTemplateTextEffect })}
          >
            {VisualTemplateTextEffectSchema.options.map((value) => (
              <option key={value} value={value}>
                {effectLabel[value]}
              </option>
            ))}
          </Select>
          <label className="flex items-start gap-2 text-body-sm text-text-primary">
            <input
              type="checkbox"
              checked={layer.style.uppercase === true}
              aria-describedby={field('uppercase-note')}
              onChange={(event) => style({ uppercase: event.target.checked })}
            />
            <span className="grid gap-0.5">
              <span>{editorCopy.uppercase}</span>
              <small id={field('uppercase-note')} className="text-caption text-text-secondary">
                {editorCopy.uppercaseNote}
              </small>
            </span>
          </label>
        </Group>
      ) : null}

      {layer.type === 'image' || layer.type === 'brand_asset' ? (
        <Select
          id={field('asset')}
          label={editorCopy.asset}
          value={layer.assetId}
          onChange={(event) => {
            const chosen = assets.find((asset) => asset.id === event.target.value);
            if (chosen === undefined) return;
            onChange(
              layer.type === 'image'
                ? {
                    ...layer,
                    assetId: chosen.id,
                    fit: chosen.usagePolicy === 'protected' ? 'contain' : layer.fit,
                  }
                : { ...layer, assetId: chosen.id },
            );
          }}
        >
          {missingAsset ? <option value={layer.assetId}>{current?.label ?? layer.assetId}</option> : null}
          {assetOptions.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label} · {usagePolicyLabel[asset.usagePolicy]}
            </option>
          ))}
        </Select>
      ) : null}

      {layer.type === 'image' ? (
        <Select
          id={field('fit')}
          label={editorCopy.fit}
          value={layer.fit}
          description={current?.usagePolicy === 'protected' ? editorCopy.protectedFitNote : undefined}
          onChange={(event) => onChange({ ...layer, fit: event.target.value as VisualTemplateImageFit })}
        >
          {VisualTemplateImageFitSchema.options.map((fit) => (
            <option key={fit} value={fit} disabled={current?.usagePolicy === 'protected' && fit !== 'contain'}>
              {fitLabel[fit]}
            </option>
          ))}
        </Select>
      ) : null}

      {layer.type === 'brand_asset' ? (
        <p className="m-0 text-body-sm text-text-secondary">{editorCopy.brandAssetNote}</p>
      ) : null}
    </fieldset>
  );
}
