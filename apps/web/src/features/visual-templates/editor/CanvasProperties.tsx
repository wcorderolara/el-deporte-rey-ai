import type { VisualTemplateBackgroundInput, VisualTemplateContentType } from '@edr/contracts';

import { Button, Icon } from '../../../ui';
import { editorCopy, templateContentTypeLabel } from '../copy';
import { Section } from './Section';

export interface CanvasPropertiesProps {
  contentType: VisualTemplateContentType;
  formatLabel: string;
  canvasWidth: number;
  canvasHeight: number;
  background: VisualTemplateBackgroundInput;
  backgroundLabel: string;
  readOnly: boolean;
  onChangeBackground: () => void;
}

/**
 * The properties shown when no layer is selected: the background (its source and the dialog to change it) and the
 * canvas (content type, format and size in pixels), which a template cannot change.
 */
export function CanvasProperties({
  contentType,
  formatLabel,
  canvasWidth,
  canvasHeight,
  background,
  backgroundLabel,
  readOnly,
  onChangeBackground,
}: CanvasPropertiesProps) {
  return (
    <div className="grid min-w-0 gap-3">
      <p className="m-0 inline-flex items-center gap-2 text-caption font-bold tracking-label text-info uppercase">
        <Icon name="image" size={16} />
        {editorCopy.background}
      </p>
      <p className="m-0 text-body-sm text-text-secondary">{editorCopy.noSelection}</p>
      <Section title={editorCopy.background}>
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-sm">
          <dt className="text-text-secondary">{editorCopy.backgroundImage}</dt>
          <dd className="m-0 break-words text-text-primary">{backgroundLabel}</dd>
          <dt className="text-text-secondary">{editorCopy.backgroundOrigin}</dt>
          <dd className="m-0 text-text-primary">
            {background.source === 'design_proposal'
              ? editorCopy.backgroundFromProposal
              : editorCopy.backgroundFromBrand}
          </dd>
        </dl>
        <p className="m-0 text-caption text-text-subtle">{editorCopy.backgroundCover}</p>
        {readOnly ? null : (
          <Button size="sm" variant="secondary" onClick={onChangeBackground}>
            {editorCopy.changeBackground}
          </Button>
        )}
      </Section>
      <Section title={editorCopy.canvasSection}>
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-sm">
          <dt className="text-text-secondary">{editorCopy.contentType}</dt>
          <dd className="m-0 text-text-primary">{templateContentTypeLabel[contentType]}</dd>
          <dt className="text-text-secondary">{editorCopy.format}</dt>
          <dd className="m-0 text-text-primary">{formatLabel}</dd>
          <dt className="text-text-secondary">{editorCopy.dimensions}</dt>
          <dd className="m-0 text-text-primary">{editorCopy.pixels(canvasWidth, canvasHeight)}</dd>
        </dl>
        <p className="m-0 text-caption text-text-subtle">{editorCopy.canvasFixed}</p>
      </Section>
    </div>
  );
}
