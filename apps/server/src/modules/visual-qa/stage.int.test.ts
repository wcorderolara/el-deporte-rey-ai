/**
 * Visual QA stage on a migrated database with a temporary data directory, after the real content and rendering
 * stages (architecture.md sections 6 and 10; contracts/provider-ports.md section 3; OD-09, OD-26; R-214, R-225,
 * R-237, R-238, R-285). Synthetic facts and the stub AI only; the shared setup blocks every non-loopback connection.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { QaResultSchema } from '@edr/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StageFailure } from '../../workflow/index.js';
import { type Facts, leagueFacts } from '../content/test/support.js';
import { serverModules } from '../registry.js';

import { QaVersionRefused, createVisualQaStage, qaElementVersion, serverModule } from './index.js';
import { FONTS, type WorkflowFixture, acceptCapitalizedTokens, storedQa, workflowFixture } from './test/support.js';

const AVAILABLE = { available: true, reason: null };
const NOT_AVAILABLE = { available: false, reason: 'not_provided_for_stage' };
const SLIDE_CHECKS = ['data_match', 'dimensions', 'style_consistency', 'team_names', 'text_fit'];

function withStandings(facts: Facts): Facts {
  return facts
    .standing('atletico-rio-ebano', 1, 3)
    .standing('penas-nandu-sur', 2, 1)
    .standing('union-guira-ceiba', 3, 1)
    .standing('real-brisamar', 4, 0);
}

let env: WorkflowFixture;

beforeEach(() => {
  env = workflowFixture();
});

afterEach(() => {
  env.close();
});

describe('visual QA stage after the real content and rendering stages', () => {
  it('records one passing result per check on every slide and sets qa_status once (R-214, R-225)', async () => {
    const runId = env.run(withStandings(leagueFacts()), AVAILABLE);
    await env.draftAndRender(runId);
    await env.qa(runId);

    const versions = storedQa(env.fixture, runId);
    expect(versions.map((version) => version.slide_type)).toEqual([
      null,
      'cover',
      'match_result',
      'match_result',
      'standings',
      'closing',
    ]);
    for (const version of versions) {
      expect(version.qa_status, `${String(version.slide_type)}`).toBe('passed');
      expect(version.results.every((row) => row.outcome === 'pass' && row.acknowledged_at === null)).toBe(true);
      for (const row of version.results) {
        QaResultSchema.parse({
          check: row.check_name,
          outcome: row.outcome,
          severity: row.severity,
          details: JSON.parse(row.details),
          acknowledgedAt: null,
        });
      }
    }
    // The migrated schema of 0001 does not accept capitalized_tokens: slides get the five checks, the caption none.
    expect(versions[0]?.results).toEqual([]);
    for (const version of versions.slice(1)) {
      expect(version.results.map((row) => row.check_name)).toEqual(SLIDE_CHECKS);
    }
    const dimensions = versions[1]?.results.find((row) => row.check_name === 'dimensions');
    expect(JSON.parse(dimensions?.details ?? '{}')).toEqual({
      expectedWidth: 1080,
      expectedHeight: 1350,
      actualWidth: 1080,
      actualHeight: 1350,
    });

    // A second run of the stage on the same draft finds nothing pending and records nothing new.
    await env.qa(runId);
    expect(storedQa(env.fixture, runId)).toEqual(versions);
  });

  it('a selection without standings has no standings slide and passes every check (R-285)', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    await env.qa(runId);
    const versions = storedQa(env.fixture, runId);
    expect(versions.map((version) => version.slide_type)).toEqual([
      null,
      'cover',
      'match_result',
      'match_result',
      'closing',
    ]);
    expect(versions.every((version) => version.qa_status === 'passed')).toBe(true);
    expect(versions.flatMap((version) => version.results).every((row) => row.outcome === 'pass')).toBe(true);
  });

  it('unverified candidate values are checked against their candidate display forms (T11G)', async () => {
    const runId = env.run(withStandings(leagueFacts('candidate')), AVAILABLE);
    await env.draftAndRender(runId);
    await env.qa(runId);
    expect(storedQa(env.fixture, runId).every((version) => version.qa_status === 'passed')).toBe(true);
  });

  it('a translated team name in the AI text fails team_names and blocks the slide (R-237)', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId, 'translated-team-name');
    await env.qa(runId);
    const versions = storedQa(env.fixture, runId);
    const match = versions.find((version) => version.slide_type === 'match_result');
    expect(match?.qa_status).toBe('failed');
    const teamNames = match?.results.find((row) => row.check_name === 'team_names');
    expect(teamNames?.outcome).toBe('fail');
    expect(JSON.parse(teamNames?.details ?? '{}')).toEqual({
      mismatches: [
        {
          elementId: 'headline',
          factId: expect.any(String) as string,
          expected: 'Atlético Río Ébano',
          actual: 'Ebony River Athletic',
        },
      ],
    });
    expect(match?.results.filter((row) => row.outcome === 'fail').map((row) => row.check_name)).toEqual(['team_names']);
  });

  it('fails dimensions on every slide when the configured format differs from the PNG size (R-238)', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    const square = { ...env.config, format: { ...env.config.format, width: 1080, height: 1080 } };
    await env.qa(runId, { fonts: () => FONTS }, env.container('built-in', square));
    const slides = storedQa(env.fixture, runId).filter((version) => version.kind === 'slide');
    for (const slide of slides) {
      expect(slide.qa_status).toBe('failed');
      const row = slide.results.find((item) => item.check_name === 'dimensions');
      expect(row?.outcome).toBe('fail');
      expect(JSON.parse(row?.details ?? '{}')).toEqual({
        expectedWidth: 1080,
        expectedHeight: 1080,
        actualWidth: 1080,
        actualHeight: 1350,
      });
    }
  });

  it('reads the size from the stored PNG header, hash-checked: an altered file fails dimensions', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    const cover = storedQa(env.fixture, runId).find((version) => version.slide_type === 'cover');
    const path = env.fixture.db
      .prepare<{ image_path: string }>('SELECT image_path FROM element_versions WHERE id = ?')
      .get([cover?.id ?? '']);
    const file = join(env.dataDir, path?.image_path ?? '');
    const png = readFileSync(file);
    png.writeUInt32BE(1080, 20); // height 1080 in the IHDR chunk; the recorded hash no longer matches
    writeFileSync(file, png);
    await env.qa(runId);
    const checked = storedQa(env.fixture, runId).find((version) => version.id === cover?.id);
    expect(checked?.qa_status).toBe('failed');
    const row = checked?.results.find((item) => item.check_name === 'dimensions');
    expect(JSON.parse(row?.details ?? '{}')).toMatchObject({ actualWidth: 0, actualHeight: 0 });
  });

  it('stores capitalized_tokens as an acknowledgeable warning when the schema accepts the check (OD-26, OD-38)', async () => {
    acceptCapitalizedTokens(env.fixture);
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draft(runId);
    // A person-like synthetic name in the AI-written description of the closing slide, stored before rendering.
    const closing = storedQa(env.fixture, runId).find((version) => version.slide_type === 'closing');
    const stored = env.fixture.db
      .prepare<{ text: string }>('SELECT text FROM element_versions WHERE id = ?')
      .get([closing?.id ?? '']);
    const text = JSON.parse(stored?.text ?? '{}') as { fields: { field: string; segments: { text: string }[] }[] };
    const description = text.fields.find((field) => field.field === 'description');
    if (description?.segments[0] === undefined) {
      throw new Error('no description segment');
    }
    description.segments[0].text = 'Gracias a Ezequiel Barrantes';
    env.fixture.db
      .prepare('UPDATE element_versions SET text = ? WHERE id = ?')
      .run([JSON.stringify(text), closing?.id ?? '']);
    await env.render(runId);
    await env.qa(runId);

    const versions = storedQa(env.fixture, runId);
    for (const version of versions) {
      expect(version.results.map((row) => row.check_name)).toEqual(
        version.kind === 'caption' ? ['capitalized_tokens'] : ['capitalized_tokens', ...SLIDE_CHECKS],
      );
    }
    const checked = versions.find((version) => version.id === closing?.id);
    expect(checked?.qa_status).toBe('warnings');
    const row = checked?.results.find((item) => item.check_name === 'capitalized_tokens');
    expect(row).toMatchObject({ outcome: 'fail', severity: 'warning', acknowledged_at: null });
    expect(JSON.parse(row?.details ?? '{}')).toEqual({ tokens: ['Ezequiel', 'Barrantes'] });
    expect(checked?.results.filter((item) => item.outcome === 'fail').map((item) => item.check_name)).toEqual([
      'capitalized_tokens',
    ]);
    expect(versions.filter((version) => version.id !== closing?.id).every((v) => v.qa_status === 'passed')).toBe(true);
  });

  it('logs that capitalized_tokens is not stored when the schema does not accept it', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    const container = env.container();
    const warn = vi.spyOn(container.logger, 'warn');
    await env.qa(runId, { fonts: () => FONTS }, container);
    expect(warn).toHaveBeenCalledWith(
      { runId, check: 'capitalized_tokens' },
      'visual QA check not stored: the qa_results check_name constraint does not accept it',
    );
  });

  it('fails with no_data when the run has no draft', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    const stage = createVisualQaStage({ fonts: () => FONTS });
    await expect(stage.load(env.ctx(runId))).rejects.toMatchObject({
      failure: { code: 'no_data', sourceId: null, path: null, httpStatus: null },
    });
  });

  it('fails with run_superseded and records nothing when a version is superseded before persist', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    const ctx = env.ctx(runId);
    const stage = createVisualQaStage({ fonts: () => FONTS });
    const output = stage.output.parse(await stage.run(stage.input.parse(await stage.load(ctx)), ctx));
    const [first] = storedQa(env.fixture, runId);
    env.fixture.db
      .prepare('UPDATE element_versions SET superseded_at = ? WHERE id = ?')
      .run(['2026-10-28T13:00:00.000Z', first?.id ?? '']);
    const error = await stage.persist(output, ctx).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StageFailure);
    expect((error as StageFailure).failure.code).toBe('run_superseded');
    expect(env.fixture.db.prepare('SELECT COUNT(*) AS n FROM qa_results').get()).toEqual({ n: 0 });
    expect(storedQa(env.fixture, runId).every((version) => version.qa_status === 'pending')).toBe(true);
  });

  it('fails with interrupted when the run is cancelled', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    const controller = new AbortController();
    const ctx = { ...env.ctx(runId), signal: controller.signal };
    const stage = createVisualQaStage({ fonts: () => FONTS });
    const input = stage.input.parse(await stage.load(ctx));
    controller.abort();
    await expect(stage.run(input, ctx)).rejects.toMatchObject({ failure: { code: 'interrupted' } });
  });
});

describe('qaElementVersion (regeneration of one element, T37)', () => {
  it('checks one current pending version and records its results', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draftAndRender(runId);
    const match = storedQa(env.fixture, runId).find((version) => version.slide_type === 'match_result');
    const result = await qaElementVersion(env.container(), match?.id ?? '', { fonts: () => FONTS });
    expect(result.qaStatus).toBe('passed');
    expect(result.results.map((item) => item.check)).toEqual([
      'data_match',
      'team_names',
      'text_fit',
      'style_consistency',
      'dimensions',
    ]);
    const stored = storedQa(env.fixture, runId);
    expect(stored.find((version) => version.id === match?.id)?.qa_status).toBe('passed');
    expect(stored.filter((version) => version.id !== match?.id).every((v) => v.qa_status === 'pending')).toBe(true);
    await expect(qaElementVersion(env.container(), match?.id ?? '', { fonts: () => FONTS })).rejects.toMatchObject({
      reason: 'already_checked',
    });
  });

  it('refuses unknown, superseded and unrendered versions', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    const container = env.container();
    await expect(qaElementVersion(container, 'not-a-uuid')).rejects.toBeInstanceOf(QaVersionRefused);
    await expect(qaElementVersion(container, '00000000-0000-4000-8000-0000000fffff')).rejects.toMatchObject({
      reason: 'not_found',
    });
    // Draft only (no render yet): a slide cannot be checked.
    await env.draft(runId);
    const [caption, cover] = storedQa(env.fixture, runId);
    await expect(qaElementVersion(container, cover?.id ?? '', { fonts: () => FONTS })).rejects.toMatchObject({
      reason: 'not_rendered',
    });
    env.fixture.db
      .prepare('UPDATE element_versions SET superseded_at = ? WHERE id = ?')
      .run(['2026-10-28T13:00:00.000Z', caption?.id ?? '']);
    await expect(qaElementVersion(container, caption?.id ?? '', { fonts: () => FONTS })).rejects.toMatchObject({
      reason: 'not_current',
    });
  });
});

describe('module registration', () => {
  it('registers the visual_qa stage under the module name of the static registry', () => {
    expect(serverModule.name).toBe('visual-qa');
    expect(serverModule.stages?.map((stage) => stage.name)).toEqual(['visual_qa']);
    expect(serverModule.routes).toBeUndefined();
    expect(serverModules.find((module) => module.name === 'visual-qa')).toBe(serverModule);
  });
});
