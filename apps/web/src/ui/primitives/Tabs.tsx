import { useRef, type KeyboardEvent } from 'react';

export type TabOption<Value extends string> = { value: Value; label: string };

export function tabPanelId(id: string, value: string): string {
  return `${id}-panel-${value}`;
}

export function Tabs<Value extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: TabOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
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
      className="flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-surface-raised p-1"
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
            id={`${id}-tab-${option.value}`}
            aria-selected={selected}
            aria-controls={tabPanelId(id, option.value)}
            tabIndex={selected ? 0 : -1}
            className={`min-h-touch rounded-lg border px-4 py-2 font-bold transition-colors focus-studio ${selected ? 'border-border-strong bg-surface-overlay text-text-primary shadow-control' : 'border-transparent bg-transparent text-text-secondary hover:border-border-subtle hover:bg-surface-card hover:text-text-primary'}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
