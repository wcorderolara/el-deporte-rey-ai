import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { classNames } from '../format';
import { buttonClassName } from './Button';
import { Icon, type StudioIconName } from './Icon';
import { iconButtonClassName } from './IconButton';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Shown as the item's tooltip (for example, why it is disabled). */
  hint?: string;
  icon?: StudioIconName;
}

/** A visible text button instead of the «⋮» icon (for example «＋ Agregar capa»); its text is its name. */
export interface ActionMenuTrigger {
  text: string;
  icon?: StudioIconName;
}

const MENU_WIDTH = 224;

const COMPACT_TRIGGER = classNames(
  'focus-studio m-0 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control border-0',
  'bg-transparent p-0 text-text-secondary transition-colors duration-fast ease-standard',
  'hover:bg-surface-overlay hover:text-text-primary aria-expanded:bg-surface-overlay aria-expanded:text-text-primary',
);
const GAP = 4;

/**
 * An icon button («⋮») that opens a menu of actions (WAI-ARIA menu button). Opening focuses the first action; the
 * arrows, Home and End move between actions; Escape closes and returns the focus to the button; Tab, a click outside,
 * a scroll or a resize close it. The menu is placed in a portal with a fixed position, so a scrolling table never
 * clips it, and opens upwards when there is no room below. It is aligned with the button's right edge, or its left
 * edge with `align="start"`.
 */
export function ActionMenu({
  label,
  items,
  trigger,
  align = 'end',
  compact = false,
}: {
  label: string;
  items: readonly ActionMenuItem[];
  trigger?: ActionMenuTrigger;
  align?: 'start' | 'end';
  /** A small, borderless «⋮» for dense rows (a list of layers). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function close(returnFocus: boolean) {
    setOpen(false);
    setPosition(null);
    if (returnFocus) buttonRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (button === undefined) return;
    const height = menu?.height ?? 0;
    const below = button.bottom + GAP + height <= window.innerHeight;
    setPosition({
      top: below ? button.bottom + GAP : Math.max(GAP, button.top - GAP - height),
      left: Math.max(
        GAP,
        Math.min(align === 'start' ? button.left : button.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GAP),
      ),
    });
  }, [open, align]);

  // The first action takes the focus once the menu is placed: a hidden menu (before its position) cannot be focused.
  useEffect(() => {
    if (open && position !== null) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    }
    function dismiss() {
      close(false);
    }
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    const nodes = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      nodes[(next + nodes.length) % nodes.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(nodes.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={trigger === undefined ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={
          trigger !== undefined
            ? buttonClassName('secondary', 'sm', 'w-full')
            : compact
              ? COMPACT_TRIGGER
              : iconButtonClassName()
        }
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        {trigger === undefined ? (
          <span aria-hidden="true" className="inline-flex items-center justify-center">
            <Icon name="more-vertical" size={compact ? 18 : 20} />
          </span>
        ) : (
          <>
            {trigger.icon === undefined ? null : <Icon name={trigger.icon} size={18} />}
            {trigger.text}
          </>
        )}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              onKeyDown={keydown}
              style={{
                position: 'fixed',
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                width: MENU_WIDTH,
                visibility: position === null ? 'hidden' : 'visible',
              }}
              className="z-50 grid gap-0.5 rounded-xl border border-border-subtle bg-surface-raised p-1 font-sans shadow-overlay"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.hint}
                  style={{ outline: 'none' }}
                  // Preflight is not loaded: the native border and background are cleared here. The option with the focus
                  // looks like the current page of the navigation (gold edge), the hovered one like a navigation hover;
                  // that edge is the focus indicator, so the global ring (unlayered CSS) is removed inline.
                  className={classNames(
                    'm-0 flex min-h-touch w-full cursor-pointer appearance-none items-center gap-2 rounded-control border-0',
                    'border-l-4 border-solid border-transparent bg-transparent px-3 py-2 text-left font-sans text-body-sm',
                    'transition-colors duration-fast ease-standard',
                    'disabled:cursor-not-allowed disabled:opacity-[var(--control-disabled-opacity)]',
                    item.tone === 'danger'
                      ? 'text-danger hover:bg-danger-surface focus:border-danger focus:bg-danger-surface'
                      : 'text-text-secondary hover:bg-surface-card hover:text-text-primary focus:border-brand-gold focus:bg-surface-overlay focus:font-bold focus:text-text-primary',
                  )}
                  onClick={() => {
                    close(true);
                    item.onSelect();
                  }}
                >
                  {item.icon === undefined ? null : <Icon name={item.icon} size={18} />}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
