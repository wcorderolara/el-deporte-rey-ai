/**
 * Layout measurements of the responsive and reflow checks (UI-06.2, WCAG 1.4.10): the horizontal overflow of the page
 * and the elements that cause it, and the content that runs past the bottom of the application frame (R-03). An
 * element clipped by a scrolling or clipping ancestor that itself fits does not count: an inner panel may scroll.
 */
import type { Page } from '@playwright/test';

export interface LayoutOffender {
  /** Tag, id and first classes of the element. */
  readonly element: string;
  /** Its first visible text. */
  readonly text: string;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

export interface LayoutReport {
  readonly viewport: { readonly width: number; readonly height: number };
  /** Width of the page minus the width of the viewport: positive when the page scrolls sideways. */
  readonly horizontalOverflow: number;
  /** Elements past the left or right edge of the viewport that no fitting ancestor clips. */
  readonly offenders: readonly LayoutOffender[];
  /** Elements painted below the application frame (on the document background) that no ancestor clips. */
  readonly belowFrame: readonly LayoutOffender[];
}

/** Measures the layout of the current page. */
export async function measureLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const frame = document.querySelector('#root > div');
    const frameBottom = frame === null ? Number.POSITIVE_INFINITY : frame.getBoundingClientRect().bottom;

    function describe(element: Element): { element: string; text: string } {
      const id = element.id === '' ? '' : `#${element.id}`;
      const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 4);
      return {
        element: `${element.tagName.toLowerCase()}${id}${classes.length === 0 ? '' : `.${classes.join('.')}`}`,
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
      };
    }

    /**
     * True when an ancestor that fits clips the element on `axis` (a scrolling panel, a table wrapper). An ancestor
     * that clips but does not fit itself (an SVG icon inside a scrolled table) is looked past.
     */
    function clipped(element: Element, axis: 'x' | 'y'): boolean {
      for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
        if (ancestor === document.body || ancestor === root) return false;
        const style = getComputedStyle(ancestor);
        if (style.position === 'fixed') return true;
        const overflow = axis === 'x' ? style.overflowX : style.overflowY;
        if (overflow !== 'visible') {
          const box = ancestor.getBoundingClientRect();
          const fits = axis === 'x' ? box.left >= -0.5 && box.right <= width + 0.5 : box.bottom <= frameBottom + 0.5;
          if (fits) return true;
        }
      }
      return false;
    }

    function visible(element: Element): DOMRect | null {
      // The content of a closed disclosure is not rendered, whatever its box reports (nested ones included).
      for (
        let disclosure = element.closest('details:not([open])');
        disclosure !== null;
        disclosure = disclosure.parentElement?.closest('details:not([open])') ?? null
      ) {
        const summary = disclosure.querySelector(':scope > summary');
        if (summary === null || !summary.contains(element)) return null;
      }
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return null;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.position === 'fixed') return null;
      return box;
    }

    const sideways = new Set<Element>();
    const below = new Set<Element>();
    for (const element of document.querySelectorAll('body *')) {
      const box = visible(element);
      if (box === null) continue;
      if ((box.right > width + 0.5 || box.left < -0.5) && !clipped(element, 'x')) sideways.add(element);
      if (box.bottom > frameBottom + 0.5 && !clipped(element, 'y')) below.add(element);
    }
    // Only the outermost offenders: a child of an offender adds nothing.
    const outermost = (set: Set<Element>) =>
      [...set]
        .filter((element) => element.parentElement === null || !set.has(element.parentElement))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            ...describe(element),
            left: Math.round(box.left),
            right: Math.round(box.right),
            bottom: Math.round(box.bottom),
          };
        });

    return {
      viewport: { width, height: root.clientHeight },
      horizontalOverflow: root.scrollWidth - width,
      offenders: outermost(sideways),
      belowFrame: outermost(below),
    };
  });
}
