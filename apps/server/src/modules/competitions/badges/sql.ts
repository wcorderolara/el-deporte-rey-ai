/**
 * The active badge of a team in the sports queries (PD-ARCH-01G-D): a correlated JSON object of the team's active
 * `team_badges` row, or null. Every query that returns a team adds it, so team lists, participants and matches show
 * the same badge. The JSON is checked with the contract schema when it is read.
 */
import { type TeamBadge, TeamBadgeSchema } from '@edr/contracts';

/** The SQL expression of the active badge of the team aliased `alias` (a constant of the calling query). */
export function badgeJson(alias: string): string {
  if (!/^[a-z]$/.test(alias)) {
    throw new TypeError('the team alias must be one letter');
  }
  return (
    "(SELECT json_object('id', b.id, 'origin', b.origin, 'source', b.source_note, 'mime', b.mime, 'width', b.width, " +
    `'height', b.height, 'sha256', b.sha256, 'uploadedAt', b.created_at) FROM team_badges b WHERE b.team_id = ${alias}.id ` +
    "AND b.status = 'active')"
  );
}

/** The badge of a row's JSON column, or null. */
export function badgeOf(json: string | null | undefined): TeamBadge | null {
  return json === null || json === undefined ? null : TeamBadgeSchema.parse(JSON.parse(json));
}
