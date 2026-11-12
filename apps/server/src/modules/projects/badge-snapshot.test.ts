/**
 * The badge snapshot formats of a project (PD-ARCH-01G-D version 1, PD-ARCH-01G-E.1 version 2): the engine templates
 * draw badges only from a version 2 snapshot (decision DE-E3).
 */
import { describe, expect, it } from 'vitest';

import { NO_BADGE_SNAPSHOT, badgeSnapshotJson, parseBadgeSnapshot } from './badge-snapshot.js';

const TEAM_A = '00000000-0000-4000-8000-000000000001';
const TEAM_B = '00000000-0000-4000-8000-000000000002';
const BADGE = '00000000-0000-4000-8000-0000000000b1';

describe('project badge snapshot', () => {
  it('reads no snapshot as no badge at all', () => {
    expect(parseBadgeSnapshot(null)).toBe(NO_BADGE_SNAPSHOT);
    expect(parseBadgeSnapshot(undefined)).toEqual({ teams: {}, engineSlots: false });
  });

  it('reads a version 1 snapshot (01G-D) for the visual templates only', () => {
    expect(parseBadgeSnapshot(JSON.stringify({ [TEAM_A]: BADGE, [TEAM_B]: null }))).toEqual({
      teams: { [TEAM_A]: BADGE, [TEAM_B]: null },
      engineSlots: false,
    });
  });

  it('writes and reads a version 2 snapshot, which the engine templates draw too', () => {
    const json = badgeSnapshotJson({ [TEAM_A]: BADGE, [TEAM_B]: null });
    expect(JSON.parse(json)).toEqual({ version: 2, teams: { [TEAM_A]: BADGE, [TEAM_B]: null } });
    expect(parseBadgeSnapshot(json)).toEqual({ teams: { [TEAM_A]: BADGE, [TEAM_B]: null }, engineSlots: true });
    expect(parseBadgeSnapshot(badgeSnapshotJson({}))).toEqual({ teams: {}, engineSlots: true });
  });

  it('refuses any other shape', () => {
    for (const value of [
      [],
      { [TEAM_A]: 7 },
      { version: 3, teams: {} },
      { version: 2 },
      { version: 2, teams: { [TEAM_A]: BADGE }, extra: true },
      { version: 2, teams: [] },
    ]) {
      expect(() => parseBadgeSnapshot(JSON.stringify(value)), JSON.stringify(value)).toThrow();
    }
    expect(() => parseBadgeSnapshot('not json')).toThrow();
  });
});
