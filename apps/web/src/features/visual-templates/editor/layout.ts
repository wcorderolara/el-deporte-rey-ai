/**
 * Layout helpers of the template editor (PD-ARCH-01G-C UX refinement): the size of an element, followed while the
 * window or the panels change, and the zoom of the canvas. Without `ResizeObserver` (tests), the size is read once.
 */
import { useEffect, useState, type RefObject } from 'react';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The content size of an element, updated when it changes. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Smallest height of the editor: below it the page scrolls instead of squeezing the panels. */
const MIN_EDITOR_HEIGHT = 560;
const BOTTOM_GAP = 12;

/**
 * The height that takes the editor from its top to the bottom of the window, so that the page does not scroll and
 * each panel scrolls on its own; null until measured. `ready` is true once the element is rendered (the editor shows
 * a loading state first), so that it is measured then.
 */
export function useFillHeight(ref: RefObject<HTMLElement | null>, ready: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const element = ref.current;
      if (element === null) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(MIN_EDITOR_HEIGHT, Math.floor(window.innerHeight - top - BOTTOM_GAP)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref, ready]);
  return height;
}

/** True when the window is at least `minWidth` pixels wide; true without `matchMedia` (tests). */
export function wideEnough(minWidth: number): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia(`(min-width: ${String(minWidth)}px)`).matches;
}

/** The zoom steps of the canvas, as a scale of its size in pixels (1 = 100 %). */
export const ZOOM_STEPS: readonly number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

/** `fit` follows the available space; a number is a fixed scale. */
export type Zoom = 'fit' | number;

/** The scale that fits the whole canvas in the available space (never above 100 %), or null before measuring. */
export function fitScale(available: Size, canvas: Size, padding: number): number | null {
  if (available.width <= padding || available.height <= padding) return null;
  return Math.min(1, (available.width - padding) / canvas.width, (available.height - padding) / canvas.height);
}

/** The next zoom step up or down from a scale. */
export function stepZoom(scale: number, direction: 'in' | 'out'): number {
  if (direction === 'in') return ZOOM_STEPS.find((step) => step > scale + 0.001) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < scale - 0.001) ?? MIN_ZOOM;
}
