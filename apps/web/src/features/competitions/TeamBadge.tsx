/**
 * The badge of a team (PD-ARCH-01G-D, PD-28): the image uploaded by the operator, in a fixed square box, scaled to fit
 * (`object-contain`, never stretched or cropped) over a transparent background. Without a badge, or when the image
 * cannot be loaded, a neutral outline takes its place: no badge is ever invented, and the team name stays next to it.
 *
 * The image is the API's getTeamBadgeFile. Its address carries the badge ID (`?v=`, ignored by the server): the team
 * address alone never changes, and browsers reuse an image already decoded for the same address in the page despite
 * `no-store`, so a replaced badge (for example a transparent PNG over a white JPEG) kept showing the previous one.
 */
import type { ManagedTeam } from '@edr/contracts';
import { useState } from 'react';

import { API_BASE_PATH } from '../../api/client';

/** Address of the active badge image of a team, distinct for every badge the team has had. */
export function teamBadgeUrl(teamId: string, badgeId: string): string {
  return `${API_BASE_PATH}/teams/${encodeURIComponent(teamId)}/badge?v=${encodeURIComponent(badgeId)}`;
}

const SIZES = {
  sm: 'h-7 w-7',
  md: 'h-11 w-11',
  lg: 'h-20 w-20',
} as const;

export interface TeamBadgeProps {
  team: Pick<ManagedTeam, 'id' | 'name' | 'badge'>;
  size?: keyof typeof SIZES;
  /** True when the team name is visible next to the badge (the image is then decorative). */
  decorative?: boolean;
  className?: string;
}

function Placeholder() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3/4 w-3/4 text-text-subtle" fill="none">
      <path
        d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

export function TeamBadge({ team, size = 'sm', decorative = true, className = '' }: TeamBadgeProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const badge = team.badge;
  const show = badge !== null && failed !== badge.id;
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-md ${SIZES[size]} ${className}`}
      data-testid="team-badge"
      data-badge={show ? 'image' : 'none'}
      {...(show && !decorative ? {} : { 'aria-hidden': true })}
    >
      {show ? (
        <img
          key={badge.id}
          src={teamBadgeUrl(team.id, badge.id)}
          alt={decorative ? '' : `Escudo de ${team.name}`}
          className="h-full w-full object-contain"
          width={badge.width}
          height={badge.height}
          onError={() => setFailed(badge.id)}
        />
      ) : (
        <Placeholder />
      )}
    </span>
  );
}
