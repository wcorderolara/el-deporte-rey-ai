import type { ReactNode, Ref } from 'react';

export type HeadingLevel = 3 | 4 | 5 | 6;

export interface HeadingProps {
  level: HeadingLevel;
  id?: string;
  className?: string;
  /** Set to -1 when focus is moved to the heading programmatically. */
  tabIndex?: number;
  ref?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}

/** Heading whose level follows its position in the page outline, so that no level is skipped. */
export function Heading({ level, children, ...props }: HeadingProps) {
  switch (level) {
    case 3:
      return <h3 {...props}>{children}</h3>;
    case 4:
      return <h4 {...props}>{children}</h4>;
    case 5:
      return <h5 {...props}>{children}</h5>;
    case 6:
      return <h6 {...props}>{children}</h6>;
  }
}

/** The next heading level, capped at 6. */
export function nextLevel(level: HeadingLevel): HeadingLevel {
  return level === 6 ? 6 : ((level + 1) as HeadingLevel);
}
