import { useId, useState, type ReactNode } from 'react';

import { Icon } from '../../../ui';

/**
 * A collapsible group of the properties panel: a heading button (`aria-expanded`) and its content, open by default.
 * A collapsed group keeps its controls mounted and hidden, so nothing typed is lost.
 */
export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className="grid border-t border-border-subtle pt-3">
      {/* The type is set on the heading: the global `button { font: inherit }` (unlayered) wins over utilities. */}
      <h3 className="m-0 font-sans text-caption font-bold tracking-label uppercase">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          className="focus-studio m-0 flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border-0 bg-transparent px-0 py-1 text-left text-text-secondary uppercase hover:text-text-primary"
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      </h3>
      {/* No display utility on the hidden element: without Preflight it would override the `hidden` attribute. */}
      <div id={contentId} hidden={!open}>
        <div className="grid gap-3 pt-2 pb-1">{children}</div>
      </div>
    </section>
  );
}
