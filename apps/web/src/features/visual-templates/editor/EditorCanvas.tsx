import {
  VISUAL_TEMPLATE_FIXTURE_ROW_PARTS,
  type BrandColorRole,
  type BrandFontRole,
  type VisualTemplateLayer,
} from '@edr/contracts';
import { Fragment, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { PreviewImage } from '../../brand/PreviewImage';
import { badgeBindingLabel, bindingLabel, editorCopy } from '../copy';
import { clampBox, effectShadow, fixtureRowBoxes } from '../layers';

type Box = { x: number; y: number; width: number; height: number };

/** The CSS position of a box given in fractions of its container. */
function boxStyle(box: Box) {
  return {
    left: `${String(box.x * 100)}%`,
    top: `${String(box.y * 100)}%`,
    width: `${String(box.width * 100)}%`,
    height: `${String(box.height * 100)}%`,
  };
}

export interface EditorCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  backgroundUrl: string;
  layers: readonly VisualTemplateLayer[];
  selectedId: string | null;
  readOnly: boolean;
  /** Layers locked in this editing session: they can be selected, not moved. */
  locked?: ReadonlySet<string>;
  /** Width of the canvas on screen in pixels (the zoom); the full width of its container when absent. */
  width?: number | null;
  /** Shows the centre lines and the thirds of the canvas (a visual aid, not drawn in the piece). */
  guides?: boolean;
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
  if (layer.type === 'team_badge') return editorCopy.badgePlaceholder(badgeBindingLabel[layer.binding]);
  return '';
}

/**
 * The editing canvas (PD-ARCH-01G-C): the background and the layers as positioned overlays in percentages of the
 * canvas, with the version's aspect ratio. A layer is selected by click or focus, moved by dragging or with the arrow
 * keys, and resized from its corner handle; a locked layer is only selected. A match list is edited by its first row,
 * which shows the outlines of its visible parts; the outlines of the other rows follow it and cannot be selected. Its width on screen is the zoom: the
 * layers are placed in fractions and sized in container units, so the zoom never changes the stored coordinates. It
 * is a positioning aid in HTML; the reference image is the preview the server draws with the slide engine.
 */
export function EditorCanvas({
  canvasWidth,
  canvasHeight,
  backgroundUrl,
  layers,
  selectedId,
  readOnly,
  locked,
  width,
  guides = false,
  assetUrl,
  palette,
  fonts,
  onSelect,
  onMove,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const drag = useRef<Drag | null>(null);

  function start(event: PointerEvent<HTMLElement>, layer: VisualTemplateLayer, mode: Drag['mode']) {
    onSelect(layer.id);
    if (readOnly || locked?.has(layer.id) === true || event.button !== 0) return;
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
    if (readOnly || locked?.has(layer.id) === true) return;
    onMove(layer.id, clampBox({ ...layer, x: layer.x + change[0], y: layer.y + change[1] }));
  }

  return (
    <div
      ref={canvasRef}
      role="group"
      aria-label={editorCopy.canvas}
      aria-describedby={hintId}
      className={`relative shrink-0 overflow-hidden bg-surface-canvas shadow-overlay select-none ${width === null || width === undefined ? 'w-full' : ''}`}
      style={{
        aspectRatio: `${String(canvasWidth)} / ${String(canvasHeight)}`,
        containerType: 'inline-size',
        ...(width === null || width === undefined ? {} : { width }),
      }}
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
        const movable = !readOnly && locked?.has(layer.id) !== true;
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
          <Fragment key={layer.id}>
            <div
              role="button"
              tabIndex={0}
              aria-label={editorCopy.selectLayer(layer.name)}
              aria-pressed={selected}
              data-layer-id={layer.id}
              data-fixture-row={layer.type === 'fixture_list' ? 1 : undefined}
              className={`absolute flex flex-col overflow-hidden leading-tight focus-studio ${movable ? 'cursor-move' : 'cursor-pointer'} ${selected ? 'outline-2 outline-brand-gold outline-solid' : 'outline-1 outline-border-strong outline-dashed'} ${layer.visible ? '' : 'opacity-40'}`}
              style={{
                ...boxStyle(layer),
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
              ) : layer.type === 'team_badge' ? (
                <span className="pointer-events-none grid h-full w-full place-items-center rounded-md border-2 border-dashed border-brand-gold text-center text-caption text-text-primary">
                  {text}
                </span>
              ) : layer.type === 'fixture_list' ? (
                VISUAL_TEMPLATE_FIXTURE_ROW_PARTS.filter((part) => layer.row[part].visible).map((part) => (
                  <span
                    key={part}
                    aria-hidden="true"
                    data-fixture-part={part}
                    className={`pointer-events-none absolute ${part === 'homeBadge' || part === 'awayBadge' ? 'rounded-md border-2 border-dashed border-brand-gold' : 'outline-1 outline-border-strong outline-dashed'}`}
                    style={boxStyle(layer.row[part])}
                  />
                ))
              ) : (
                <span className="pointer-events-none break-words whitespace-pre-line">{text}</span>
              )}
              {selected && movable ? (
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
            {layer.type === 'fixture_list'
              ? fixtureRowBoxes(layer)
                  .slice(1)
                  .map((row, index) => (
                    <span
                      key={`row-${String(index + 2)}`}
                      aria-hidden="true"
                      data-fixture-row={index + 2}
                      className={`pointer-events-none absolute outline-1 outline-border-strong outline-dashed ${layer.visible ? '' : 'opacity-40'}`}
                      style={boxStyle(row)}
                    />
                  ))
              : null}
          </Fragment>
        );
      })}
      {guides ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {['33.333%', '50%', '66.667%'].map((at) => (
            <span key={`v-${at}`} className="absolute inset-y-0 w-px bg-info/60" style={{ left: at }} />
          ))}
          {['33.333%', '50%', '66.667%'].map((at) => (
            <span key={`h-${at}`} className="absolute inset-x-0 h-px bg-info/60" style={{ top: at }} />
          ))}
        </span>
      ) : null}
      <span id={hintId} className="sr-only">
        {editorCopy.canvasHint}
      </span>
    </div>
  );
}
