import type { BrandColorRole, BrandFontRole, VisualTemplateLayer } from '@edr/contracts';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { PreviewImage } from '../../brand/PreviewImage';
import { bindingLabel, editorCopy } from '../copy';
import { clampBox, effectShadow } from '../layers';

type Box = { x: number; y: number; width: number; height: number };

export interface EditorCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  layers: readonly VisualTemplateLayer[];
  selectedId: string | null;
  readOnly: boolean;
  /** API URL of a brand asset file. */
  assetUrl: (assetId: string) => string;
  /** Palette colour of each role (brand identity), to draw the text roughly as the renderer will. */
  palette: Partial<Record<BrandColorRole, string>>;
  fonts: Partial<Record<BrandFontRole, { family: string; weight: number }>>;
  onSelect: (layerId: string) => void;
  onMove: (layerId: string, box: Box) => void;
}

interface Drag {
  readonly id: string;
  readonly mode: 'move' | 'resize';
  readonly startX: number;
  readonly startY: number;
  readonly box: Box;
  readonly width: number;
  readonly height: number;
}

/** Keyboard step, in canvas fractions (Shift: large step). */
const STEP = 0.005;
const LARGE_STEP = 0.05;

function layerText(layer: VisualTemplateLayer): string {
  if (layer.type === 'text') return layer.text;
  if (layer.type === 'sports_data')
    return layer.binding === null ? editorCopy.noBinding : `{${bindingLabel[layer.binding]}}`;
  return '';
}

/**
 * The editing canvas (PD-ARCH-01G-C): the background and the layers as positioned overlays in percentages of the
 * canvas, with the version's aspect ratio. A layer is selected by click or focus, moved by dragging or with the arrow
 * keys, and resized from its corner handle. It is a positioning aid in HTML; the reference image is the preview the
 * server draws with the slide engine.
 */
export function EditorCanvas({
  canvasWidth,
  canvasHeight,
  backgroundUrl,
  layers,
  selectedId,
  readOnly,
  assetUrl,
  palette,
  fonts,
  onSelect,
  onMove,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function start(event: PointerEvent<HTMLElement>, layer: VisualTemplateLayer, mode: Drag['mode']) {
    onSelect(layer.id);
    if (readOnly || event.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === undefined || rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      id: layer.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      box: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      width: rect.width,
      height: rect.height,
    };
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (current === null) return;
    const dx = (event.clientX - current.startX) / current.width;
    const dy = (event.clientY - current.startY) / current.height;
    const { box } = current;
    onMove(
      current.id,
      current.mode === 'move'
        ? clampBox({ ...box, x: box.x + dx, y: box.y + dy })
        : clampBox({
            ...box,
            width: Math.min(1 - box.x, box.width + dx),
            height: Math.min(1 - box.y, box.height + dy),
          }),
    );
  }

  function end() {
    drag.current = null;
  }

  function nudge(event: KeyboardEvent<HTMLElement>, layer: VisualTemplateLayer) {
    const step = event.shiftKey ? LARGE_STEP : STEP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const change = delta[event.key];
    if (change === undefined) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(layer.id);
      }
      return;
    }
    event.preventDefault();
    onSelect(layer.id);
    if (readOnly) return;
    onMove(layer.id, clampBox({ ...layer, x: layer.x + change[0], y: layer.y + change[1] }));
  }

  return (
    <div className="grid gap-2">
      <div
        ref={canvasRef}
        role="group"
        aria-label={editorCopy.canvas}
        className="relative w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-canvas select-none"
        style={{ aspectRatio: `${String(canvasWidth)} / ${String(canvasHeight)}`, containerType: 'inline-size' }}
      >
        <PreviewImage
          key={backgroundUrl}
          src={backgroundUrl}
          alt={editorCopy.backgroundAlt}
          failedText={editorCopy.backgroundFailed}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {layers.map((layer) => {
          const selected = layer.id === selectedId;
          const text = layerText(layer);
          const style =
            layer.type === 'text' || layer.type === 'sports_data'
              ? {
                  color: palette[layer.style.colorRole],
                  fontFamily: fonts[layer.style.fontRole]?.family,
                  fontWeight: fonts[layer.style.fontRole]?.weight,
                  fontSize: `${String((layer.style.maxFontSize / canvasWidth) * 100)}cqw`,
                  textAlign: layer.style.align,
                  textShadow: effectShadow(layer.style.effect, palette),
                  textTransform: layer.style.uppercase === true ? ('uppercase' as const) : undefined,
                  justifyContent:
                    layer.style.verticalAlign === 'top'
                      ? 'flex-start'
                      : layer.style.verticalAlign === 'bottom'
                        ? 'flex-end'
                        : 'center',
                }
              : {};
          return (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              aria-label={editorCopy.selectLayer(layer.name)}
              aria-pressed={selected}
              data-layer-id={layer.id}
              className={`absolute flex flex-col overflow-hidden leading-tight focus-studio ${readOnly ? 'cursor-pointer' : 'cursor-move'} ${selected ? 'outline-2 outline-brand-gold outline-solid' : 'outline-1 outline-border-strong outline-dashed'} ${layer.visible ? '' : 'opacity-40'}`}
              style={{
                left: `${String(layer.x * 100)}%`,
                top: `${String(layer.y * 100)}%`,
                width: `${String(layer.width * 100)}%`,
                height: `${String(layer.height * 100)}%`,
                touchAction: 'none',
                ...style,
              }}
              onPointerDown={(event) => start(event, layer, 'move')}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(event) => nudge(event, layer)}
            >
              {layer.type === 'image' || layer.type === 'brand_asset' ? (
                <img
                  src={assetUrl(layer.assetId)}
                  alt=""
                  draggable={false}
                  className={`pointer-events-none h-full w-full ${layer.type === 'brand_asset' || layer.fit === 'contain' ? 'object-contain' : layer.fit === 'cover' ? 'object-cover' : 'object-fill'}`}
                />
              ) : (
                <span className="pointer-events-none break-words whitespace-pre-line">{text}</span>
              )}
              {selected && !readOnly ? (
                <span
                  aria-hidden="true"
                  className="absolute right-0 bottom-0 size-3 cursor-se-resize border border-surface-canvas bg-brand-gold"
                  onPointerDown={(event) => start(event, layer, 'resize')}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="m-0 text-caption text-text-subtle">{editorCopy.canvasHint}</p>
    </div>
  );
}
