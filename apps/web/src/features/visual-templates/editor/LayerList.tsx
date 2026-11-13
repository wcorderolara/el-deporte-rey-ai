import type { VisualTemplateLayer, VisualTemplateLayerType } from '@edr/contracts';

import { ActionMenu, Icon, classNames, type StudioIconName } from '../../../ui';
import { bindingLabel, editorCopy, layerTypeLabel } from '../copy';

export const layerTypeIcon: Record<VisualTemplateLayerType, StudioIconName> = {
  text: 'text',
  sports_data: 'data',
  image: 'image',
  brand_asset: 'mark',
  team_badge: 'shield',
  fixture_list: 'table',
};

export interface LayerListProps {
  layers: readonly VisualTemplateLayer[];
  /** The selected layer; null selects the background (the properties of the canvas). */
  selectedId: string | null;
  /** Layers locked in this editing session (not saved in the template). */
  locked: ReadonlySet<string>;
  readOnly: boolean;
  backgroundLabel: string;
  onSelect: (layerId: string | null) => void;
  onMove: (layerId: string, direction: 'up' | 'down') => void;
  onToggle: (layerId: string) => void;
  onLock: (layerId: string) => void;
  onRemove: (layerId: string) => void;
}

const ROW_BUTTON = classNames(
  'focus-studio m-0 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control border-0',
  'bg-transparent p-0 transition-colors duration-fast ease-standard hover:bg-surface-overlay hover:text-text-primary',
);

function rowClassName(selected: boolean): string {
  return classNames(
    // Preflight is not loaded: `border-0` clears the default width of the other sides before the left edge.
    'flex min-w-0 items-center gap-1 rounded-control border-0 border-l-4 border-solid py-1 pr-1 pl-2 transition-colors duration-fast ease-standard',
    // In forced colours the background is lost: the selected layer keeps a Highlight edge, the others none (UI-06.3).
    selected
      ? 'border-brand-gold bg-surface-overlay forced-colors:border-[Highlight]'
      : 'border-transparent hover:bg-surface-card forced-colors:border-[Canvas]',
  );
}

/** What a layer shows, under its name: the bound field of a sports data layer, else its type. */
function layerDetail(layer: VisualTemplateLayer): string {
  if (layer.type === 'sports_data') {
    return layer.binding === null ? editorCopy.noBinding : editorCopy.boundTo(bindingLabel[layer.binding]);
  }
  return layerTypeLabel[layer.type];
}

/**
 * The layers as in a design tool: the front layer first and the background last (fixed). A row selects its layer;
 * its buttons show or hide it and lock it for this session, and its menu brings it forward, sends it backward or
 * deletes it. A published version shows the list without editing controls.
 */
export function LayerList({
  layers,
  selectedId,
  locked,
  readOnly,
  backgroundLabel,
  onSelect,
  onMove,
  onToggle,
  onLock,
  onRemove,
}: LayerListProps) {
  const front = [...layers].reverse();
  return (
    <div className="grid gap-2">
      <ol aria-label={editorCopy.layers} className="m-0 grid list-none gap-0.5 p-0">
        {front.map((layer) => {
          const index = layers.indexOf(layer);
          const selected = layer.id === selectedId;
          const isLocked = locked.has(layer.id);
          return (
            <li key={layer.id} className={rowClassName(selected)}>
              <button
                type="button"
                aria-pressed={selected}
                className="focus-studio m-0 flex min-h-touch min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent p-0 text-left font-sans"
                onClick={() => onSelect(layer.id)}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex shrink-0 ${selected ? 'text-brand-gold' : 'text-text-secondary'}`}
                >
                  <Icon name={layerTypeIcon[layer.type]} size={18} />
                </span>
                <span className="grid min-w-0">
                  <span
                    className={`truncate text-body-sm font-bold ${layer.visible ? 'text-text-primary' : 'text-text-subtle'}`}
                    title={layer.name}
                  >
                    {layer.name}
                  </span>
                  <span className="truncate text-caption text-text-secondary">
                    {layerDetail(layer)}
                    {layer.visible ? '' : ` · ${editorCopy.hidden}`}
                    {isLocked ? ` · ${editorCopy.locked}` : ''}
                  </span>
                </span>
              </button>
              {readOnly ? null : (
                <>
                  <button
                    type="button"
                    aria-label={layer.visible ? editorCopy.hide(layer.name) : editorCopy.show(layer.name)}
                    title={layer.visible ? editorCopy.hide(layer.name) : editorCopy.show(layer.name)}
                    className={classNames(ROW_BUTTON, layer.visible ? 'text-text-secondary' : 'text-warning')}
                    onClick={() => onToggle(layer.id)}
                  >
                    <Icon name={layer.visible ? 'eye' : 'eye-off'} size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={isLocked ? editorCopy.unlock(layer.name) : editorCopy.lock(layer.name)}
                    aria-pressed={isLocked}
                    title={isLocked ? editorCopy.unlock(layer.name) : editorCopy.lockHint}
                    className={classNames(ROW_BUTTON, isLocked ? 'text-brand-gold' : 'text-text-secondary')}
                    onClick={() => onLock(layer.id)}
                  >
                    <Icon name={isLocked ? 'lock' : 'unlock'} size={18} />
                  </button>
                  <ActionMenu
                    compact
                    label={editorCopy.layerActions(layer.name)}
                    items={[
                      {
                        label: editorCopy.moveUp,
                        icon: 'chevron-up',
                        disabled: index === layers.length - 1,
                        onSelect: () => onMove(layer.id, 'up'),
                      },
                      {
                        label: editorCopy.moveDown,
                        icon: 'chevron-down',
                        disabled: index === 0,
                        onSelect: () => onMove(layer.id, 'down'),
                      },
                      {
                        label: editorCopy.removeLayer,
                        icon: 'trash',
                        tone: 'danger',
                        onSelect: () => onRemove(layer.id),
                      },
                    ]}
                  />
                </>
              )}
            </li>
          );
        })}
        <li className={rowClassName(selectedId === null)}>
          <button
            type="button"
            aria-pressed={selectedId === null}
            className="focus-studio m-0 flex min-h-touch min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent p-0 text-left font-sans"
            onClick={() => onSelect(null)}
          >
            <span
              aria-hidden="true"
              className={`inline-flex shrink-0 ${selectedId === null ? 'text-brand-gold' : 'text-text-secondary'}`}
            >
              <Icon name="image" size={18} />
            </span>
            <span className="grid min-w-0">
              <span className="truncate text-body-sm font-bold text-text-primary">{editorCopy.background}</span>
              <span className="truncate text-caption text-text-secondary" title={backgroundLabel}>
                {backgroundLabel}
              </span>
            </span>
          </button>
        </li>
      </ol>
      {layers.length === 0 ? <p className="m-0 text-body-sm text-text-secondary">{editorCopy.noLayers}</p> : null}
      <p className="m-0 text-caption text-text-subtle">{editorCopy.layersHint}</p>
    </div>
  );
}
