/**
 * The badge snapshot of a project (`projects.badge_snapshot_json`, migration 0030; PD-28): the badge ID of each local
 * team of the project's matches when the project was created, or null for a team without a badge. Badge rows and
 * files are never deleted, so a project is drawn later with the same badges, even after a badge is replaced or
 * retired.
 *
 * Two formats exist, told apart by their shape:
 * - **Version 1** (PD-ARCH-01G-D): a flat object `{ "<teamId>": "<badgeId>" | null }`, written only for projects that
 *   use a visual template. Only the visual templates draw it; the badge slots of the engine templates stay empty, as
 *   when those projects were created (decision DE-E3 of PD-ARCH-01G-E).
 * - **Version 2** (PD-ARCH-01G-E.1): `{ "version": 2, "teams": { "<teamId>": "<badgeId>" | null } }`, written for
 *   every project created from the content wizard. The visual templates and the badge slots of the engine match
 *   templates draw it.
 *
 * A project without a snapshot (null) draws no badge at all. The column accepts any JSON object, so no migration is
 * needed for version 2.
 */
import { z } from 'zod';

const TeamIdSchema = z.string().min(1).max(64);
const BadgeIdSchema = z.string().min(1).max(64);

const TeamBadgesSchema = z.record(TeamIdSchema, BadgeIdSchema.nullable());

const SnapshotV2Schema = z.strictObject({ version: z.literal(2), teams: TeamBadgesSchema });

/** A project's badge snapshot as read. */
export interface BadgeSnapshot {
  /** The badge ID of each team (null without a badge). */
  readonly teams: Readonly<Record<string, string | null>>;
  /** True when the engine templates draw the badges too (version 2); false for version 1 and for no snapshot. */
  readonly engineSlots: boolean;
}

/** No snapshot: no badge anywhere. */
export const NO_BADGE_SNAPSHOT: BadgeSnapshot = Object.freeze({ teams: Object.freeze({}), engineSlots: false });

/** Parses the stored column (null, version 1 or version 2); throws on any other shape. */
export function parseBadgeSnapshot(json: string | null | undefined): BadgeSnapshot {
  if (json === null || json === undefined) {
    return NO_BADGE_SNAPSHOT;
  }
  const value: unknown = JSON.parse(json);
  if (typeof value === 'object' && value !== null && 'version' in value) {
    return { teams: SnapshotV2Schema.parse(value).teams, engineSlots: true };
  }
  return { teams: TeamBadgesSchema.parse(value), engineSlots: false };
}

/** The stored column of a new project's snapshot (version 2). */
export function badgeSnapshotJson(teams: Readonly<Record<string, string | null>>): string {
  return JSON.stringify(SnapshotV2Schema.parse({ version: 2, teams }));
}
