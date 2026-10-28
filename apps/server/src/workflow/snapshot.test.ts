/**
 * Run configuration snapshot (T10-F11, AD-30; data-model.md `workflow_runs.config_snapshot`): built from the parsed
 * configuration only, with source descriptors (mode, role, acceptance, publication permission), the verification
 * policy and the run parameters; no adapter options, base URL, credential or environment value.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { TEST_DUMMY_API_KEY, TEST_MARKER_TOKEN } from '../../../../vitest.setup.js';
import { config, demoSource, stubSource } from '../providers/sports/test/synthetic.js';

import { RunRepository } from './repository.js';
import { WorkflowRunner } from './runner.js';
import { ConfigSnapshotSchema, buildConfigSnapshot } from './snapshot.js';
import { PROJECT_ID, workflowFixture } from './test/support.js';

const VARIABLES = ['FOOTBALL_DATA_API_TOKEN', 'EDR_AI_API_KEY'] as const;

afterEach(() => {
  for (const name of VARIABLES) {
    delete process.env[name];
  }
});

function liveConfig() {
  return config([
    demoSource('demo-a'),
    stubSource('live-x', 'fixture', 'DEMO_DATA', { enabled: false, role: 'verification', accepted: false }),
    stubSource('manual-x', 'fixture', 'DEMO_DATA', { name: 'Synthetic import' }),
  ]);
}

describe('config snapshot', () => {
  it('records every configured source descriptor, the verification policy, the AI adapter and the format', () => {
    const snapshot = buildConfigSnapshot(liveConfig());
    expect(ConfigSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.sources.map((source) => [source.id, source.mode, source.role, source.enabled])).toEqual([
      ['demo-a', 'DEMO_DATA', 'primary', true],
      ['live-x', 'DEMO_DATA', 'verification', false],
      ['manual-x', 'DEMO_DATA', 'primary', true],
    ]);
    expect(snapshot.sources[0]).toEqual({
      id: 'demo-a',
      name: 'Synthetic demo-a',
      mode: 'DEMO_DATA',
      adapter: 'fixture',
      role: 'primary',
      accepted: true,
      independenceGroup: 'demo-a',
      officialPublication: false,
      publicationPermission: 'not_applicable',
      enabled: true,
    });
    expect(snapshot.verificationPolicy).toEqual({
      manuallyApprovedPublication: 'allowed_without_accepted_source',
      livePublicationPermissionRule: 'every_supporting_source',
    });
    expect(snapshot.ai).toEqual({ adapter: 'stub' });
    expect(snapshot.format).toEqual({ width: 1080, height: 1350, maxSlidesPerCarousel: 20 });
    expect(snapshot.parameters).toEqual({ excludedMatchKeys: null });
  });

  it('copies no adapter options or base URL', () => {
    const text = JSON.stringify(buildConfigSnapshot(liveConfig()));
    expect(text).not.toContain('options');
    expect(text).not.toContain('scenario');
    expect(text).not.toMatch(/https?:/);
  });

  it('contains neither the dummy key nor the marker token present in the environment (T10-F11)', () => {
    process.env['EDR_AI_API_KEY'] = TEST_DUMMY_API_KEY;
    process.env['FOOTBALL_DATA_API_TOKEN'] = TEST_MARKER_TOKEN;
    const text = JSON.stringify(buildConfigSnapshot(liveConfig(), { excludedMatchKeys: ['m-1'] }));
    expect(text).not.toContain(TEST_DUMMY_API_KEY);
    expect(text).not.toContain(TEST_MARKER_TOKEN);
  });

  it('stores no environment value in the run row either', async () => {
    process.env['EDR_AI_API_KEY'] = TEST_DUMMY_API_KEY;
    process.env['FOOTBALL_DATA_API_TOKEN'] = TEST_MARKER_TOKEN;
    const fixture = workflowFixture();
    try {
      const runner = new WorkflowRunner({ container: fixture.container, stages: () => [] });
      const run = runner.start(PROJECT_ID, 'full');
      await runner.settled(run.id);
      const rows = JSON.stringify(fixture.db.prepare('SELECT * FROM workflow_runs').all());
      expect(rows).not.toContain(TEST_DUMMY_API_KEY);
      expect(rows).not.toContain(TEST_MARKER_TOKEN);
      expect(new RunRepository(fixture.db).snapshot(run.id)?.sources.map((source) => source.id)).toEqual([
        'demo-a',
        'demo-b',
      ]);
    } finally {
      fixture.close();
    }
  });
});
