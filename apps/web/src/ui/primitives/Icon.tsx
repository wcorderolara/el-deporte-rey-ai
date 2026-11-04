import type { ReactNode } from 'react';

export type StudioIconName = 'table' | 'grid' | 'pencil' | 'trash' | 'arrow-left' | 'chevron-down' | 'eye' | 'x';

const paths: Record<StudioIconName, ReactNode> = {
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M3 14h6m0 0h12" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  pencil: (
    <>
      <path d="m4 20 4.3-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z" />
      <path d="m14.8 6.2 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19 12H5m7 7-7-7 7-7" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  eye: (
    <>
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  x: (
    <>
      <path d="m18 6-12 12M6 6l12 12" />
    </>
  ),
};

export function Icon({ name, size = 20 }: { name: StudioIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
