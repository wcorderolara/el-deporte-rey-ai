import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { classNames } from '../format';

/** The space kept between a tooltip and the edge of the window, as for the menus (`ActionMenu`). */
const GAP = 4;

export interface TooltipProps {
  /** The tooltip's id; the control names it in `aria-describedby`. */
  id: string;
  label: string;
  /**
   * Where the tooltip sits before it is moved inside the window: centred over the control (default), or aligned with
   * its start or end edge.
   */
  align?: 'center' | 'start' | 'end';
  /** A longer text, wrapped in a fixed width instead of one line. */
  wide?: boolean;
  /** The control. */
  children: ReactNode;
}

/**
 * A tooltip for a control (WCAG 1.4.13, UI-06.2): shown while the pointer is over the control or the tooltip, or while
 * the control has the keyboard focus; Escape hides it without moving the focus (only the tooltip closes: a dialog or a
 * panel around it keeps its own Escape), and it shows again once both the pointer and the focus have left. It is
 * placed above the control, then moved sideways just enough to stay inside the window, like the menus (R-02).
 */
export function Tooltip({ id, label, align = 'center', wide = false, children }: TooltipProps) {
  const tipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [shift, setShift] = useState(0);
  const visible = (hovered || focused) && !dismissed;

  useLayoutEffect(() => {
    if (!visible) {
      setShift(0);
      return;
    }
    const tip = tipRef.current?.getBoundingClientRect();
    if (tip === undefined) return;
    const width = document.documentElement.clientWidth;
    // Measured in its own place (shift 0): moved left past the right edge, or right past the left edge.
    const right = tip.right - (width - GAP);
    const left = GAP - tip.left;
    setShift(right > 0 ? -right : left > 0 ? left : 0);
  }, [visible]);

  return (
    <span
      className="relative inline-flex"
      // Pointer events also reach the wrapper of a disabled control, which gets no mouse events.
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        if (!focused) setDismissed(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!hovered) setDismissed(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && visible) {
          event.stopPropagation();
          setDismissed(true);
        }
      }}
    >
      {children}
      {/* The bottom padding bridges the gap to the control, so the pointer can move onto the tooltip. */}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        className={classNames(
          'absolute bottom-full z-20 pb-2',
          align === 'center' ? 'left-1/2' : align === 'start' ? 'left-0' : 'right-0',
          visible ? 'block' : 'hidden',
        )}
        style={{ transform: `translateX(calc(${align === 'center' ? '-50%' : '0px'} + ${shift}px))` }}
      >
        <span
          className={classNames(
            'block rounded-md border border-border-subtle bg-surface-overlay px-2 py-1 text-caption text-text-primary shadow-card',
            wide ? 'w-72' : 'whitespace-nowrap font-semibold',
          )}
        >
          {label}
        </span>
      </span>
    </span>
  );
}
