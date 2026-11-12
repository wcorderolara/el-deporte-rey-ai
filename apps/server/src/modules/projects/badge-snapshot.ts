/**
 * The badge snapshot of a project (`projects.badge_snapshot_json`, migration 0030; PD-28): the badge ID of each local
 * team of the project's matches when the project was created, or null for a team without a badge. Badge rows and
 * files are never deleted, so a project is drawn later with the same badges, even after a badge is replaced or
 * retired.
 *
 * Three formats exist, told apart by their shape:
 * - **Version 1** (PD-ARCH-01G-D): a flat object `{ "<teamId>": "<badgeId>" | null }`, written only for projects that
 *   use a visual template. Only the visual templates draw it; the badge slots of the engine templates stay empty, as
 *   when those projects were created (decision DE-E3 of PD-ARCH-01G-E).
 * - **Version 2** (PD-ARCH-01G-E.1): `{ "version": 2, "teams": { "<teamId>": "<badgeId>" | null } }`, written for
 *   every project created from the content wizard until PD-ARCH-01G-E.2. The visual templates and the badge slots of
 *   the engine match templates draw it; its calendars keep one line of text per match.
 * - **Version 3** (PD-ARCH-01G-E.2): the same shape with `"version": 3`, written for every project created from the
 *   content wizard since. It also covers the calendar rows: six matches per calendar page, each row with both badges
 *   (round calendar template 2.0.0, and the match list of a visual template).
 *
 * The version records what the project was created with, so a project keeps its pages and images when it is drawn
 * again (decision DE-E3). A project without a snapshot (null) draws no badge at all. The column accepts any JSON
 * object, so no migration is needed for versions 2 and 3.
 */
import { z } from 'zod';

const TeamIdSchema = z.string().min(1).max(64);
const BadgeIdSchema = z.string().min(1).max(64);

const TeamBadgesSchema = z.record(TeamIdSchema, BadgeIdSchema.nullable());

const SnapshotSchema = z.strictObject({ version: z.union([z.literal(2), z.literal(3)]), teams: TeamBadgesSchema });

/** The version written for new projects. */
export const BADGE_SNAPSHOT_VERSION = 3;

/** A project's badge snapshot as read. */
export interface BadgeSnapshot {
  /** The badge ID of each team (null without a badge). */
  readonly teams: Readonly<Record<string, string | null>>;
  /** True when the engine match templates draw the badges too (versions 2 and 3); false for version 1 and none. */
  readonly engineSlots: boolean;
  /** True when the calendars are drawn as rows with badges (version 3); false otherwise. */
  readonly calendarRows: boolean;
}

/** No snapshot: no badge anywhere. */
export const NO_BADGE_SNAPSHOT: BadgeSnapshot = Object.freeze({
  teams: Object.freeze({}),
  engineSlots: false,
  calendarRows: false,
});

/** Parses the stored column (null, version 1, 2 or 3); throws on any other shape. */
export function parseBadgeSnapshot(json: string | null | undefined): BadgeSnapshot {
  if (json === null || json === undefined) {
    return NO_BADGE_SNAPSHOT;
  }
  const value: unknown = JSON.parse(json);
  if (typeof value === 'object' && value !== null && 'version' in value) {
    const snapshot = SnapshotSchema.parse(value);
    return { teams: snapshot.teams, engineSlots: true, calendarRows: snapshot.version === 3 };
  }
  return { teams: TeamBadgesSchema.parse(value), engineSlots: false, calendarRows: false };
}

/** The stored column of a new project's snapshot (`BADGE_SNAPSHOT_VERSION`). */
export function badgeSnapshotJson(teams: Readonly<Record<string, string | null>>): string {
  return JSON.stringify(SnapshotSchema.parse({ version: BADGE_SNAPSHOT_VERSION, teams }));
}
