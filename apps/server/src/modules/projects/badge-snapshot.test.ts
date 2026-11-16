/**
 * The badge snapshot formats of a project (PD-ARCH-01G-D version 1, PD-ARCH-01G-E.1 version 2, PD-ARCH-01G-E.2
 * version 3, TEAM-DISPLAY-01 version 4): the engine match templates draw badges only from version 2, the calendars
 * are drawn as rows only from version 3 (decision DE-E3), and only version 4 records presentation names.
 */
import { describe, expect, it } from 'vitest';

import { BADGE_SNAPSHOT_VERSION, NO_BADGE_SNAPSHOT, badgeSnapshotJson, parseBadgeSnapshot } from './badge-snapshot.js';

const TEAM_A = '00000000-0000-4000-8000-000000000001';
const TEAM_B = '00000000-0000-4000-8000-000000000002';
const BADGE = '00000000-0000-4000-8000-0000000000b1';

describe('project badge snapshot', () => {
  it('reads no snapshot as no badge at all', () => {
    expect(parseBadgeSnapshot(null)).toBe(NO_BADGE_SNAPSHOT);
    expect(parseBadgeSnapshot(undefined)).toEqual({
      teams: {},
      engineSlots: false,
      calendarRows: false,
      displayNames: {},
    });
  });

  it('reads a version 1 snapshot (01G-D) for the visual templates only', () => {
    expect(parseBadgeSnapshot(JSON.stringify({ [TEAM_A]: BADGE, [TEAM_B]: null }))).toEqual({
      teams: { [TEAM_A]: BADGE, [TEAM_B]: null },
      engineSlots: false,
      calendarRows: false,
      displayNames: {},
    });
  });

  it('reads a version 2 snapshot (01G-E.1): the engine match templates draw it, the calendars keep their text', () => {
    const json = JSON.stringify({ version: 2, teams: { [TEAM_A]: BADGE, [TEAM_B]: null } });
    expect(parseBadgeSnapshot(json)).toEqual({
      teams: { [TEAM_A]: BADGE, [TEAM_B]: null },
      engineSlots: true,
      calendarRows: false,
      displayNames: {},
    });
  });

  it('reads a version 3 snapshot (01G-E.2), which the calendar rows draw too, with no presentation name', () => {
    const json = JSON.stringify({ version: 3, teams: { [TEAM_A]: BADGE, [TEAM_B]: null } });
    expect(parseBadgeSnapshot(json)).toEqual({
      teams: { [TEAM_A]: BADGE, [TEAM_B]: null },
      engineSlots: true,
      calendarRows: true,
      displayNames: {},
    });
  });

  it('writes and reads a version 4 snapshot (TEAM-DISPLAY-01) with the presentation names of the teams that have one', () => {
    expect(BADGE_SNAPSHOT_VERSION).toBe(4);
    const json = badgeSnapshotJson({ [TEAM_A]: BADGE, [TEAM_B]: null }, { [TEAM_A]: 'Alfa' });
    expect(JSON.parse(json)).toEqual({
      version: 4,
      teams: { [TEAM_A]: BADGE, [TEAM_B]: null },
      names: { [TEAM_A]: 'Alfa' },
    });
    expect(parseBadgeSnapshot(json)).toEqual({
      teams: { [TEAM_A]: BADGE, [TEAM_B]: null },
      engineSlots: true,
      calendarRows: true,
      displayNames: { [TEAM_A]: 'Alfa' },
    });
    expect(parseBadgeSnapshot(badgeSnapshotJson({}))).toEqual({
      teams: {},
      engineSlots: true,
      calendarRows: true,
      displayNames: {},
    });
  });

  it('refuses any other shape', () => {
    for (const value of [
      [],
      { [TEAM_A]: 7 },
      { version: 5, teams: {}, names: {} },
      { version: 4, teams: {} },
      { version: 4, teams: {}, names: { [TEAM_A]: '' } },
      { version: 4, teams: {}, names: { [TEAM_A]: 'x'.repeat(33) } },
      { version: 4, teams: {}, names: { [TEAM_A]: null } },
      { version: 3, teams: {}, names: { [TEAM_A]: 'Alfa' } },
      { version: 1, teams: {} },
      { version: 2 },
      { version: 3, teams: { [TEAM_A]: BADGE }, extra: true },
      { version: 2, teams: [] },
    ]) {
      expect(() => parseBadgeSnapshot(JSON.stringify(value)), JSON.stringify(value)).toThrow();
    }
    expect(() => parseBadgeSnapshot('not json')).toThrow();
  });
});
