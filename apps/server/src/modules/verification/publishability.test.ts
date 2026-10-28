/**
 * Unit tests of the publishability function under each accepted policy value (architecture.md section 7.4, AD-38;
 * PD-17, PD-18, R-271, R-272) and of the identity map loader (AD-18). Synthetic configuration only.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { config as buildConfig, demoSource, stubSource } from '../../providers/sports/test/synthetic.js';
import { StageFailure } from '../../workflow/index.js';

import { TEAM_IDENTITIES_DIRECTORY, loadIdentityMap } from './identity.js';
import {
  type PublishabilitySettings,
  isOperatorAttestedCompetition,
  publishability,
  publishabilitySettings,
} from './publishability.js';

function settings(overrides: Partial<PublishabilitySettings> = {}): PublishabilitySettings {
  return {
    manuallyApprovedPublication: 'allowed_without_accepted_source',
    livePublicationPermissionRule: 'every_supporting_source',
    operatorAttestedCompetition: true,
    publicationPermission: () => 'confirmed',
    ...overrides,
  };
}

const DEMO = [{ sourceId: 'demo-a', dataMode: 'DEMO_DATA' as const }];

describe('publishability (section 7.4, AD-38)', () => {
  it('unverified facts are never publishable', () => {
    expect(publishability({ status: 'unverified', supportingSources: DEMO }, settings())).toEqual({
      publishable: false,
      blockReason: 'not_verified',
    });
  });

  it('a verified fact without a LIVE_DATA supporting source is publishable', () => {
    expect(publishability({ status: 'verified', supportingSources: DEMO }, settings()).publishable).toBe(true);
  });

  it('a verified fact with an unconfirmed LIVE_DATA supporting source is blocked (PD-18, R-271)', () => {
    const fact = {
      status: 'verified' as const,
      supportingSources: [
        { sourceId: 'live-a', dataMode: 'LIVE_DATA' as const },
        { sourceId: 'live-b', dataMode: 'LIVE_DATA' as const },
      ],
    };
    const partly = settings({ publicationPermission: (id) => (id === 'live-a' ? 'confirmed' : 'unconfirmed') });
    expect(publishability(fact, partly)).toEqual({
      publishable: false,
      blockReason: 'publication_permission_unconfirmed',
    });
    expect(publishability(fact, settings({ publicationPermission: () => undefined })).publishable).toBe(false);
    expect(publishability(fact, settings()).publishable).toBe(true);
  });

  it('a manually approved fact of a marked competition is publishable under allowed_without_accepted_source', () => {
    expect(publishability({ status: 'manually_approved', supportingSources: [] }, settings()).publishable).toBe(true);
  });

  it('a manually approved fact of an unlinked or unmarked competition is blocked (PD-17)', () => {
    expect(
      publishability(
        { status: 'manually_approved', supportingSources: [] },
        settings({ operatorAttestedCompetition: false }),
      ),
    ).toEqual({ publishable: false, blockReason: 'manually_approved_not_publishable' });
  });

  it('nothing manually approved is publishable under blocked', () => {
    expect(
      publishability(
        { status: 'manually_approved', supportingSources: [] },
        settings({ manuallyApprovedPublication: 'blocked' }),
      ).blockReason,
    ).toBe('manually_approved_not_publishable');
  });

  it('settings follow the current configuration: marked link binding the project source, source permissions', () => {
    const config = buildConfig(
      [
        demoSource('demo-a'),
        stubSource('manual-a', 'test-manual', 'MANUAL_DATA'),
        stubSource('live-a', 'test-live', 'LIVE_DATA'),
      ],
      {
        links: [
          {
            id: 'liga-local',
            name: 'Liga Local',
            noAcceptedPublicSource: true,
            bindings: [{ sourceId: 'manual-a', competitionRef: 'liga-local' }],
          },
          { id: 'liga-otra', name: 'Liga Otra', bindings: [{ sourceId: 'manual-a', competitionRef: 'liga-otra' }] },
        ],
      },
    );
    expect(isOperatorAttestedCompetition(config.catalogue, { competitionId: 'liga-local', sourceId: 'manual-a' })).toBe(
      true,
    );
    expect(isOperatorAttestedCompetition(config.catalogue, { competitionId: 'liga-local', sourceId: 'demo-a' })).toBe(
      false,
    );
    expect(isOperatorAttestedCompetition(config.catalogue, { competitionId: 'liga-otra', sourceId: 'manual-a' })).toBe(
      false,
    );
    expect(
      isOperatorAttestedCompetition(config.catalogue, { competitionId: 'manual-a-liga-local', sourceId: 'manual-a' }),
    ).toBe(false);
    const result = publishabilitySettings(config, { competitionId: 'liga-local', sourceId: 'manual-a' });
    expect(result.operatorAttestedCompetition).toBe(true);
    expect(result.publicationPermission('live-a')).toBe('unconfirmed');
    expect(result.publicationPermission('unknown')).toBeUndefined();
  });
});

describe('identity map loader (AD-18)', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function root(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'edr-t30-'));
    roots.push(dir);
    mkdirSync(join(dir, TEAM_IDENTITIES_DIRECTORY), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, TEAM_IDENTITIES_DIRECTORY, name), content, 'utf8');
    }
    return dir;
  }

  const valid = {
    competitionId: 'liga-sint',
    seasonId: '2026',
    teams: [{ teamId: 'club-alfa', officialName: 'Club Alfa', sourceKeys: [{ sourceId: 'demo-a', teamKey: 'alfa' }] }],
  };

  it('reads the map of the exact competition and season, or none', () => {
    const dir = root({ 'liga-sint-2026.json': JSON.stringify(valid) });
    expect(loadIdentityMap(dir, 'liga-sint', '2026')?.teams[0]?.teamId).toBe('club-alfa');
    expect(loadIdentityMap(dir, 'liga-sint', '2027')).toBeNull();
    expect(loadIdentityMap(dir, '../etc', '2026')).toBeNull();
  });

  it('fails the stage with invalid and a field pointer for an invalid map', () => {
    const broken = { ...valid, teams: [{ ...valid.teams[0], teamId: 'Not A Slug' }] };
    const dir = root({
      'liga-sint-2026.json': JSON.stringify(broken),
      'liga-sint-2027.json': '{',
      'liga-sint-2028.json': JSON.stringify({ ...valid, seasonId: '2026' }),
    });
    const failure = (season: string): unknown => {
      try {
        loadIdentityMap(dir, 'liga-sint', season);
      } catch (error) {
        return error;
      }
      return null;
    };
    expect(failure('2026')).toBeInstanceOf(StageFailure);
    expect((failure('2026') as StageFailure).failure).toMatchObject({ code: 'invalid', path: '/teams/0/teamId' });
    expect((failure('2027') as StageFailure).failure.code).toBe('invalid');
    expect((failure('2028') as StageFailure).failure.path).toBe('/competitionId');
  });

  it('refuses a team key mapped twice', () => {
    const twice = {
      ...valid,
      teams: [valid.teams[0], { ...valid.teams[0], teamId: 'club-beta' }],
    };
    const dir = root({ 'liga-sint-2026.json': JSON.stringify(twice) });
    expect(() => loadIdentityMap(dir, 'liga-sint', '2026')).toThrow(StageFailure);
  });
});
