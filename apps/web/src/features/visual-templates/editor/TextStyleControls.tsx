import {
  BrandColorRoleSchema,
  BrandFontRoleSchema,
  MAX_VISUAL_TEMPLATE_FONT_SIZE,
  MAX_VISUAL_TEMPLATE_LINES,
  MIN_VISUAL_TEMPLATE_FONT_SIZE,
  VisualTemplateTextEffectSchema,
  type BrandIdentity,
  type VisualTemplateTextEffect,
  type VisualTemplateTextStyle,
} from '@edr/contracts';

import { Input, Select } from '../../../ui';
import { identityCopy } from '../../brand/copy';
import { alignLabel, editorCopy, effectLabel, overflowLabel, verticalAlignLabel } from '../copy';

interface TextStyleControlsProps {
  style: VisualTemplateTextStyle;
  /** The ID of a control, unique in the page. */
  id: (name: string) => string;
  onChange: (change: Partial<VisualTemplateTextStyle>) => void;
}

function intValue(text: string, fallback: number): number {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The typography of a text style (a text or sports data layer, or a text part of a match-list row): the font role
 * with its brand family, the largest and smallest size, the palette colour, the alignments, the effect and capital
 * letters. Fonts and colours are the brand roles only.
 */
export function TypographyControls({
  style,
  identity,
  id,
  onChange,
}: TextStyleControlsProps & { identity: BrandIdentity | null }) {
  return (
    <>
      <Select
        id={id('font')}
        label={editorCopy.fontRole}
        value={style.fontRole}
        onChange={(event) => onChange({ fontRole: event.target.value as VisualTemplateTextStyle['fontRole'] })}
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
      <div className="grid grid-cols-2 gap-3">
        <Input
          id={id('max-size')}
          type="number"
          label={editorCopy.maxFontSize}
          min={MIN_VISUAL_TEMPLATE_FONT_SIZE}
          max={MAX_VISUAL_TEMPLATE_FONT_SIZE}
          value={style.maxFontSize}
          onChange={(event) => onChange({ maxFontSize: intValue(event.target.value, style.maxFontSize) })}
        />
        <Input
          id={id('min-size')}
          type="number"
          label={editorCopy.minFontSize}
          min={MIN_VISUAL_TEMPLATE_FONT_SIZE}
          max={MAX_VISUAL_TEMPLATE_FONT_SIZE}
          value={style.minFontSize}
          onChange={(event) => onChange({ minFontSize: intValue(event.target.value, style.minFontSize) })}
        />
      </div>
      <div className="flex items-end gap-3">
        <Select
          id={id('color')}
          label={editorCopy.color}
          value={style.colorRole}
          wrapperClassName="flex-1"
          onChange={(event) => onChange({ colorRole: event.target.value as VisualTemplateTextStyle['colorRole'] })}
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
            backgroundColor: identity?.palette.find((entry) => entry.role === style.colorRole)?.value,
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          id={id('align')}
          label={editorCopy.align}
          value={style.align}
          onChange={(event) => onChange({ align: event.target.value as VisualTemplateTextStyle['align'] })}
        >
          {(['left', 'center', 'right'] as const).map((value) => (
            <option key={value} value={value}>
              {alignLabel[value]}
            </option>
          ))}
        </Select>
        <Select
          id={id('valign')}
          label={editorCopy.verticalAlign}
          value={style.verticalAlign}
          onChange={(event) =>
            onChange({ verticalAlign: event.target.value as VisualTemplateTextStyle['verticalAlign'] })
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
        id={id('effect')}
        label={editorCopy.effect}
        description={editorCopy.effectNote}
        value={style.effect ?? 'none'}
        onChange={(event) => onChange({ effect: event.target.value as VisualTemplateTextEffect })}
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
          checked={style.uppercase === true}
          aria-describedby={id('uppercase-note')}
          onChange={(event) => onChange({ uppercase: event.target.checked })}
        />
        <span className="grid gap-0.5">
          <span>{editorCopy.uppercase}</span>
          <small id={id('uppercase-note')} className="text-caption text-text-secondary">
            {editorCopy.uppercaseNote}
          </small>
        </span>
      </label>
    </>
  );
}

/** What a text style does when the text does not fit: shrink or keep the size, and the most lines. */
export function BehaviourControls({ style, id, onChange }: TextStyleControlsProps) {
  return (
    <>
      <Select
        id={id('overflow')}
        label={editorCopy.overflow}
        description={editorCopy.overflowNote}
        value={style.overflow}
        onChange={(event) => onChange({ overflow: event.target.value as VisualTemplateTextStyle['overflow'] })}
      >
        {(['shrink', 'fixed'] as const).map((value) => (
          <option key={value} value={value}>
            {overflowLabel[value]}
          </option>
        ))}
      </Select>
      <Input
        id={id('lines')}
        type="number"
        label={editorCopy.maxLines}
        min={1}
        max={MAX_VISUAL_TEMPLATE_LINES}
        value={style.maxLines}
        onChange={(event) => onChange({ maxLines: intValue(event.target.value, style.maxLines) })}
      />
    </>
  );
}
