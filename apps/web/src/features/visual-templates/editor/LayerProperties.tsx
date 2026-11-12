import {
  MAX_VISUAL_TEMPLATE_TEXT,
  VISUAL_TEMPLATE_FIXTURE_ROW_PARTS,
  VisualTemplateBadgeBindingSchema,
  VisualTemplateImageFitSchema,
  type BrandAsset,
  type BrandIdentity,
  type VisualTemplateBinding,
  type VisualTemplateContentType,
  type VisualTemplateFixtureListLayer,
  type VisualTemplateImageFit,
  type VisualTemplateLayer,
  type VisualTemplatePreview,
  type VisualTemplateTextStyle,
} from '@edr/contracts';
import { useId } from 'react';

import { Button, Icon, Input, Select, Textarea } from '../../../ui';
import { usagePolicyLabel } from '../../brand/copy';
import { badgeBindingLabel, bindingLabel, editorCopy, fitLabel, fixtureRowPartLabel, layerTypeLabel } from '../copy';
import {
  bindingsFor,
  brandMarkAssets,
  changeFixturePart,
  clampBox,
  fraction,
  imageAssets,
  isFixtureNamePart,
  isFixtureTextPart,
  percent,
} from '../layers';
import { layerTypeIcon } from './LayerList';
import { Section } from './Section';
import { BehaviourControls, TypographyControls } from './TextStyleControls';

export interface LayerPropertiesProps {
  layer: VisualTemplateLayer;
  contentType: VisualTemplateContentType;
  readOnly: boolean;
  /** Locked in this editing session: the controls are disabled until it is unlocked. */
  locked: boolean;
  assets: readonly BrandAsset[];
  identity: BrandIdentity | null;
  canvasWidth: number;
  canvasHeight: number;
  /** The last preview with local data, for the value of a bound field; null before the first one. */
  preview: VisualTemplatePreview | null;
  onChange: (layer: VisualTemplateLayer) => void;
  onUnlock: () => void;
}

/** «Texto fijo» or «Dato vinculado»: what the layer draws. */
function SourceTag({ bound }: { bound: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-bold ${bound ? 'bg-info-surface text-info' : 'bg-surface-overlay text-text-secondary'}`}
    >
      <Icon name={bound ? 'data' : 'text'} size={14} />
      {bound ? editorCopy.boundTag : editorCopy.fixedTag}
    </span>
  );
}

/**
 * The bound field of a sports data layer: its catalogue path, the value of the last preview with local data, and
 * the state of the binding. The value is read only; the preview never changes the sports data.
 */
function BindingInfo({
  binding,
  preview,
}: {
  binding: VisualTemplateBinding | null;
  preview: VisualTemplatePreview | null;
}) {
  const entry = binding === null ? undefined : preview?.values.find((value) => value.binding === binding);
  const state =
    binding === null
      ? { text: editorCopy.bindingStateNone, tone: 'text-warning' }
      : preview === null
        ? { text: editorCopy.bindingStateNoPreview, tone: 'text-text-secondary' }
        : entry === undefined
          ? { text: editorCopy.bindingStateChanged, tone: 'text-text-secondary' }
          : entry.value === null
            ? { text: editorCopy.bindingStateMissing, tone: 'text-warning' }
            : { text: editorCopy.bindingStateResolved, tone: 'text-success' };
  return (
    <div className="grid gap-2 rounded-control bg-surface-canvas p-3">
      <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-sm">
        <dt className="text-text-secondary">{editorCopy.bindingField}</dt>
        <dd className="m-0 font-mono text-caption break-all text-text-primary">{binding ?? '—'}</dd>
        <dt className="text-text-secondary">{editorCopy.bindingValue}</dt>
        <dd className="m-0 break-words whitespace-pre-line text-text-primary">
          {entry?.value ?? <span className="text-text-subtle">—</span>}
        </dd>
        <dt className="text-text-secondary">{editorCopy.bindingState}</dt>
        <dd className={`m-0 font-bold ${state.tone}`}>{state.text}</dd>
      </dl>
      <p className="m-0 text-caption text-text-subtle">{editorCopy.bindingNote}</p>
    </div>
  );
}

/** The width-to-height ratio as «W:H» with small integers when possible (1080 × 1350 → 4:5). */
function ratioLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const w = Math.round(width);
  const h = Math.round(height);
  if (w <= 0 || h <= 0) return '—';
  const divisor = gcd(w, h);
  return w / divisor <= 32 && h / divisor <= 32
    ? `${String(w / divisor)}:${String(h / divisor)}`
    : (width / height).toFixed(2);
}

/**
 * The parts of the row of a match list (PD-ARCH-01G-E.2), one group each in drawing order: its box as percentages of
 * the row, whether it is drawn (not for the team names, which are always drawn), and the text style of a text part.
 */
function FixtureRowParts({
  layer,
  identity,
  id,
  onChange,
}: {
  layer: VisualTemplateFixtureListLayer;
  identity: BrandIdentity | null;
  id: (name: string) => string;
  onChange: (layer: VisualTemplateFixtureListLayer) => void;
}) {
  return VISUAL_TEMPLATE_FIXTURE_ROW_PARTS.map((part) => {
    const value = layer.row[part];
    const label = fixtureRowPartLabel[part];
    const partId = (name: string) => id(`${part}-${name}`);
    const box = (name: 'x' | 'y' | 'width' | 'height', text: string) => {
      const number = Number.parseFloat(text);
      if (!Number.isFinite(number)) return;
      onChange(changeFixturePart(layer, part, clampBox({ ...value, [name]: number / 100 })));
    };
    const style = (change: Partial<VisualTemplateTextStyle>) => {
      if (isFixtureTextPart(part)) {
        onChange(changeFixturePart(layer, part, { style: { ...layer.row[part].style, ...change } }));
      }
    };
    return (
      <Section key={part} title={label}>
        <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0">
          <legend className="sr-only">{label}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['x', editorCopy.partX],
                ['y', editorCopy.partY],
                ['width', editorCopy.partWidth],
                ['height', editorCopy.partHeight],
              ] as const
            ).map(([name, text]) => (
              <Input
                key={name}
                id={partId(name)}
                type="number"
                label={text}
                min={name === 'width' || name === 'height' ? 1 : 0}
                max={100}
                step={0.1}
                value={percent(value[name])}
                onChange={(event) => box(name, event.target.value)}
              />
            ))}
          </div>
          {isFixtureNamePart(part) ? null : (
            <label className="flex items-center gap-2 text-body-sm text-text-primary">
              <input
                type="checkbox"
                checked={value.visible}
                onChange={(event) => onChange(changeFixturePart(layer, part, { visible: event.target.checked }))}
              />
              {editorCopy.visible}
            </label>
          )}
          {isFixtureTextPart(part) ? (
            <>
              <TypographyControls style={layer.row[part].style} identity={identity} id={partId} onChange={style} />
              <BehaviourControls style={layer.row[part].style} id={partId} onChange={style} />
            </>
          ) : null}
        </fieldset>
      </Section>
    );
  });
}

/**
 * The properties of the selected layer (PD-ARCH-01G-C), in collapsible groups that depend on its type: content (the
 * fixed text, or the bound field with the value of the last preview), typography, resource and fit, team badge,
 * position and size as percentages of the canvas (with the row gap and the row parts of a match list), and behaviour
 * when the text does not fit. Fonts and colours are the brand roles only; images come from Mi marca only. A published
 * version or a locked layer shows the same controls, disabled.
 */
export function LayerProperties({
  layer,
  contentType,
  readOnly,
  locked,
  assets,
  identity,
  canvasWidth,
  canvasHeight,
  preview,
  onChange,
  onUnlock,
}: LayerPropertiesProps) {
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

  const text = layer.type === 'text' || layer.type === 'sports_data';
  const boxWidth = layer.width * canvasWidth;
  const boxHeight = layer.height * canvasHeight;

  /** Keeps the width and makes the height follow the proportion of the asset. */
  function matchAsset() {
    if (current === undefined || current.width <= 0) return;
    const height = (boxWidth * (current.height / current.width)) / canvasHeight;
    onChange({ ...layer, ...clampBox({ ...layer, height }) });
  }

  const typography = text ? (
    <Section title={editorCopy.typography}>
      <TypographyControls style={layer.style} identity={identity} id={field} onChange={style} />
    </Section>
  ) : null;

  const behaviour = text ? (
    <Section title={editorCopy.behaviour}>
      <BehaviourControls style={layer.style} id={field} onChange={style} />
    </Section>
  ) : null;

  const position = (
    <Section title={editorCopy.position}>
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
      <p className="m-0 text-caption text-text-subtle">
        {editorCopy.boxPixels(Math.round(boxWidth), Math.round(boxHeight))}
      </p>
      {layer.type === 'fixture_list' ? (
        <Input
          id={field('row-gap')}
          type="number"
          label={editorCopy.rowGap}
          min={0}
          max={100}
          step={0.1}
          value={percent(layer.rowGap)}
          onChange={(event) => {
            const value = Number.parseFloat(event.target.value);
            if (Number.isFinite(value)) onChange({ ...layer, rowGap: fraction(value / 100) });
          }}
        />
      ) : null}
    </Section>
  );

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 inline-flex items-center gap-2 text-caption font-bold tracking-label text-info uppercase">
          <Icon name={layerTypeIcon[layer.type]} size={16} />
          {layerTypeLabel[layer.type]}
        </p>
        {locked && !readOnly ? (
          <Button size="sm" variant="secondary" onClick={onUnlock}>
            <Icon name="unlock" size={16} />
            {editorCopy.unlockShort}
          </Button>
        ) : null}
      </div>
      {locked && !readOnly ? <p className="m-0 text-caption text-text-secondary">{editorCopy.lockedNote}</p> : null}
      <fieldset disabled={readOnly || locked} className="m-0 grid min-w-0 gap-3 border-0 p-0">
        <legend className="sr-only">{editorCopy.properties}</legend>
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

        {layer.type === 'text' ? (
          <Section title={editorCopy.content}>
            <SourceTag bound={false} />
            <Textarea
              id={field('text')}
              label={editorCopy.text}
              value={layer.text}
              rows={3}
              maxLength={MAX_VISUAL_TEMPLATE_TEXT}
              onChange={(event) => onChange({ ...layer, text: event.target.value })}
            />
          </Section>
        ) : null}

        {layer.type === 'sports_data' ? (
          <Section title={editorCopy.content}>
            <SourceTag bound />
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
            <BindingInfo binding={layer.binding} preview={preview} />
            <label className="flex items-start gap-2 text-body-sm text-text-primary">
              <input
                type="checkbox"
                checked={layer.required}
                onChange={(event) => onChange({ ...layer, required: event.target.checked })}
              />
              {editorCopy.required}
            </label>
          </Section>
        ) : null}

        {typography}

        {layer.type === 'image' || layer.type === 'brand_asset' ? (
          <Section title={editorCopy.resource}>
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
            {layer.type === 'brand_asset' ? (
              <p className="m-0 text-body-sm text-text-secondary">{editorCopy.brandAssetNote}</p>
            ) : null}
          </Section>
        ) : null}

        {layer.type === 'image' || layer.type === 'brand_asset' ? (
          <Section title={editorCopy.fitSection}>
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
            <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-sm">
              <dt className="text-text-secondary">{editorCopy.assetRatio}</dt>
              <dd className="m-0 text-text-primary">
                {current === undefined
                  ? '—'
                  : `${ratioLabel(current.width, current.height)} · ${String(current.width)} × ${String(current.height)} px`}
              </dd>
              <dt className="text-text-secondary">{editorCopy.boxRatio}</dt>
              <dd className="m-0 text-text-primary">{ratioLabel(boxWidth, boxHeight)}</dd>
            </dl>
            <Button size="sm" variant="secondary" disabled={current === undefined} onClick={matchAsset}>
              {editorCopy.matchAssetRatio}
            </Button>
          </Section>
        ) : null}

        {layer.type === 'team_badge' ? (
          <Section title={editorCopy.badgeSection}>
            <SourceTag bound />
            <Select
              id={field('badge')}
              label={editorCopy.badgeBinding}
              value={layer.binding}
              onChange={(event) =>
                onChange({ ...layer, binding: VisualTemplateBadgeBindingSchema.parse(event.target.value) })
              }
            >
              {VisualTemplateBadgeBindingSchema.options.map((value) => (
                <option key={value} value={value}>
                  {badgeBindingLabel[value]}
                </option>
              ))}
            </Select>
            {preview === null ? null : (
              <p className="m-0 text-body-sm text-text-secondary">
                {(preview.badges.find((entry) => entry.binding === layer.binding)?.badgeId ?? null) === null
                  ? editorCopy.badgeStateMissing
                  : editorCopy.badgeStateFound}
              </p>
            )}
            <p className="m-0 text-body-sm text-text-secondary">{editorCopy.teamBadgeNote}</p>
          </Section>
        ) : null}

        {position}
        {layer.type === 'fixture_list' ? (
          <FixtureRowParts layer={layer} identity={identity} id={field} onChange={onChange} />
        ) : null}
        {behaviour}
      </fieldset>
    </div>
  );
}
