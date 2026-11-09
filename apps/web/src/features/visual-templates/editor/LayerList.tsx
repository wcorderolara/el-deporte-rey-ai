import type { VisualTemplateLayer } from '@edr/contracts';

import { Badge, Icon, IconButton } from '../../../ui';
import { editorCopy, layerTypeLabel } from '../copy';

export interface LayerListProps {
  layers: readonly VisualTemplateLayer[];
  selectedId: string | null;
  readOnly: boolean;
  backgroundLabel: string;
  onSelect: (layerId: string) => void;
  onMove: (layerId: string, direction: 'up' | 'down') => void;
  onToggle: (layerId: string) => void;
  onRemove: (layerId: string) => void;
}

/**
 * The layers in stacking order (the first one at the back, the last one on top), after the fixed background: select,
 * move up or down, show or hide, and delete from the draft.
 */
export function LayerList({
  layers,
  selectedId,
  readOnly,
  backgroundLabel,
  onSelect,
  onMove,
  onToggle,
  onRemove,
}: LayerListProps) {
  return (
    <div className="grid gap-2">
      <p className="m-0 text-caption text-text-subtle">{editorCopy.layersHint}</p>
      <ol aria-label={editorCopy.layers} className="m-0 grid list-none gap-2 p-0">
        <li className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-canvas px-3 py-2 text-body-sm text-text-secondary">
          <Badge tone="neutral">{editorCopy.background}</Badge>
          <span className="min-w-0 truncate">{backgroundLabel}</span>
        </li>
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${layer.id === selectedId ? 'border-brand-gold bg-surface-card' : 'border-border-subtle bg-surface-raised'}`}
          >
            <button
              type="button"
              aria-pressed={layer.id === selectedId}
              className="focus-studio grid min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
              onClick={() => onSelect(layer.id)}
            >
              <span className="truncate text-body-sm font-bold text-text-primary">{layer.name}</span>{' '}
              <span className="text-caption text-text-secondary">
                {layerTypeLabel[layer.type]}
                {layer.visible ? '' : ` · ${editorCopy.hidden}`}
              </span>
            </button>
            {readOnly ? null : (
              <span className="inline-flex gap-1">
                <IconButton
                  label={editorCopy.moveUp(layer.name)}
                  disabled={index === layers.length - 1}
                  onClick={() => onMove(layer.id, 'up')}
                >
                  <span aria-hidden="true">▲</span>
                </IconButton>
                <IconButton
                  label={editorCopy.moveDown(layer.name)}
                  disabled={index === 0}
                  onClick={() => onMove(layer.id, 'down')}
                >
                  <span aria-hidden="true">▼</span>
                </IconButton>
                <IconButton
                  label={layer.visible ? editorCopy.hide(layer.name) : editorCopy.show(layer.name)}
                  onClick={() => onToggle(layer.id)}
                >
                  {layer.visible ? <Icon name="eye" /> : <Icon name="x" />}
                </IconButton>
                <IconButton label={editorCopy.remove(layer.name)} tone="danger" onClick={() => onRemove(layer.id)}>
                  <Icon name="trash" />
                </IconButton>
              </span>
            )}
          </li>
        ))}
      </ol>
      {layers.length === 0 ? <p className="m-0 text-body-sm text-text-secondary">{editorCopy.noLayers}</p> : null}
    </div>
  );
}
