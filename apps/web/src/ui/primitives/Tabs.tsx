import { useRef, type KeyboardEvent } from 'react';

import { classNames } from '../format';

export type TabBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/**
 * `badge` is a short status shown after the label (for example «3 pendientes»); it is part of the tab's name. With
 * `badgeSymbol` the badge shows only that symbol (for example «✓») and keeps its text for assistive technology.
 */
export type TabOption<Value extends string> = {
  value: Value;
  label: string;
  badge?: string;
  badgeTone?: TabBadgeTone;
  badgeSymbol?: string;
};

export function tabPanelId(id: string, value: string): string {
  return `${id}-panel-${value}`;
}

export function tabId(id: string, value: string): string {
  return `${id}-tab-${value}`;
}

const badgeTones: Record<TabBadgeTone, string> = {
  neutral: 'border-border-default bg-surface-card text-text-secondary',
  info: 'border-info bg-info-surface text-info',
  success: 'border-success bg-success-surface text-success',
  warning: 'border-warning bg-warning-surface text-warning',
  danger: 'border-danger bg-danger-surface text-danger',
};

export function Tabs<Value extends string>({
  id,
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  id: string;
  label: string;
  options: TabOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** `lg` for the main modes of a page (larger, display font); `sm` for dense secondary tabs. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % options.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + options.length) % options.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = options[nextIndex];
    if (!next) return;
    tabRefs.current[nextIndex]?.focus();
    onChange(next.value);
  }

  return (
    <div
      id={id}
      role="tablist"
      aria-label={label}
      className={classNames(
        'flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-surface-raised p-1',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabId(id, option.value)}
            aria-selected={selected}
            aria-controls={tabPanelId(id, option.value)}
            tabIndex={selected ? 0 : -1}
            className={`inline-flex min-h-touch items-center gap-2 rounded-lg border py-2 font-bold transition-colors focus-studio ${size === 'lg' ? 'px-4 sm:px-5' : size === 'sm' ? 'px-3' : 'px-4'} ${selected ? 'border-border-strong bg-surface-overlay text-text-primary shadow-control forced-colors:border-[Highlight]' : 'border-transparent bg-transparent text-text-secondary hover:border-border-subtle hover:bg-surface-card hover:text-text-primary forced-colors:border-[Canvas]'}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {/* The unlayered global `button { font: inherit }` wins over font utilities on the button itself. */}
            <span
              className={
                size === 'lg'
                  ? 'font-display text-body-lg font-extrabold tracking-heading uppercase'
                  : size === 'sm'
                    ? 'text-body-sm'
                    : undefined
              }
            >
              {option.label}
            </span>
            {option.badge === undefined ? null : (
              <>
                {' '}
                <span
                  className={classNames(
                    'inline-flex min-h-6 items-center rounded-control border-hairline py-0.5 font-sans text-caption font-bold',
                    option.badgeSymbol === undefined ? 'px-2' : 'min-w-6 justify-center px-1',
                    badgeTones[option.badgeTone ?? 'neutral'],
                  )}
                >
                  {option.badgeSymbol === undefined ? (
                    option.badge
                  ) : (
                    <>
                      <span aria-hidden="true">{option.badgeSymbol}</span>
                      <span className="sr-only">{option.badge}</span>
                    </>
                  )}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
