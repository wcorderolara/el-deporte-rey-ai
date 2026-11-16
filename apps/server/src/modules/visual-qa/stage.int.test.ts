/**
 * Visual QA stage on a migrated database with a temporary data directory, after the real content and rendering
 * stages (architecture.md sections 6 and 10; contracts/provider-ports.md section 3; OD-09, OD-26, OD-56; R-214,
 * R-225, R-237, R-238, R-285). The database is migrated with every committed migration, so `qa_results` accepts the
 * `capitalized_tokens` check (migration 0002). Synthetic facts and the stub AI only; the shared setup blocks every non-loopback connection.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { QA_CHECKS, QaResultSchema } from '@edr/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appliedMigrations } from '../../platform/db/index.js';
import { StageFailure } from '../../workflow/index.js';
import { type Facts, leagueFacts } from '../content/test/support.js';
import { serverModules } from '../registry.js';

import { QaVersionRefused, createVisualQaStage, qaElementVersion, serverModule } from './index.js';
import { FONTS, type WorkflowFixture, qaResultsAsOfMigration, storedQa, workflowFixture } from './test/support.js';

const AVAILABLE = { available: true, reason: null };
const NOT_AVAILABLE = { available: false, reason: 'not_provided_for_stage' };
/** Stored check names in `storedQa` order (by name): a slide has all six checks, the caption `capitalized_tokens`. */
const SLIDE_CHECKS = [
  'capitalized_tokens',
  'data_match',
  'dimensions',
  'style_consistency',
  'team_badges',
  'team_names',
  'text_fit',
];
const CAPTION_CHECKS = ['capitalized_tokens'];
/** The check names of the `qa_results` constraint of migration 0001. */
const QA_CHECK_NAMES_0001: readonly string[] = [
  'data_match',
  'team_names',
  'text_fit',
  'style_consistency',
  'dimensions',
];
const LOG_MESSAGE = 'visual QA check not stored: the qa_results check_name constraint does not accept it';

/** Replaces the first segment of an AI-written field of a stored version's text. */
function setCommentary(env: WorkflowFixture, versionId: string, field: string, commentary: string): void {
  const stored = env.fixture.db
    .prepare<{ text: string }>('SELECT text FROM element_versions WHERE id = ?')
    .get([versionId]);
  const text = JSON.parse(stored?.text ?? '{}') as { fields: { field: string; segments: { text: string }[] }[] };
  const segment = text.fields.find((item) => item.field === field)?.segments[0];
  if (segment === undefined) {
    throw new Error(`no ${field} segment`);
  }
  segment.text = commentary;
  env.fixture.db.prepare('UPDATE element_versions SET text = ? WHERE id = ?').run([JSON.stringify(text), versionId]);
}

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
    // Since migration 0035 every check is stored: slides get the seven checks, the caption capitalized_tokens.
    expect(versions[0]?.results.map((row) => row.check_name)).toEqual(CAPTION_CHECKS);
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
    // The translated name is also a run of capitalized tokens that no verified name accounts for (a warning).
    expect(match?.results.filter((row) => row.outcome === 'fail').map((row) => row.check_name)).toEqual([
      'capitalized_tokens',
      'team_names',
    ]);
    const tokens = match?.results.find((row) => row.check_name === 'capitalized_tokens');
    expect(tokens?.severity).toBe('warning');
    expect(JSON.parse(tokens?.details ?? '{}')).toEqual({ tokens: ['Ebony', 'River', 'Athletic'] });
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

  it('stores capitalized_tokens as an acknowledgeable warning on the migrated schema (OD-26, OD-38, OD-56)', async () => {
    expect(appliedMigrations(env.fixture.db).map((record) => record.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
      32, 33, 34, 35, 36, 37, 38,
    ]);
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draft(runId);
    // A person-like synthetic name in the AI-written description of the closing slide, stored before rendering.
    const closing = storedQa(env.fixture, runId).find((version) => version.slide_type === 'closing');
    setCommentary(env, closing?.id ?? '', 'description', 'Gracias a Ezequiel Barrantes');
    await env.render(runId);
    const container = env.container();
    const warn = vi.spyOn(container.logger, 'warn');
    await env.qa(runId, { fonts: () => FONTS }, container);

    const versions = storedQa(env.fixture, runId);
    for (const version of versions) {
      expect(version.results.map((row) => row.check_name)).toEqual(
        version.kind === 'caption' ? CAPTION_CHECKS : SLIDE_CHECKS,
      );
    }
    const checked = versions.find((version) => version.id === closing?.id);
    expect(checked?.qa_status).toBe('warnings');
    const row = checked?.results.find((item) => item.check_name === 'capitalized_tokens');
    expect(row).toMatchObject({ outcome: 'fail', severity: 'warning', acknowledged_at: null });
    expect(JSON.parse(row?.details ?? '{}')).toEqual({ tokens: ['Ezequiel', 'Barrantes'] });
    QaResultSchema.parse({
      check: row?.check_name,
      outcome: row?.outcome,
      severity: row?.severity,
      details: JSON.parse(row?.details ?? '{}'),
      acknowledgedAt: null,
    });
    expect(checked?.results.filter((item) => item.outcome === 'fail').map((item) => item.check_name)).toEqual([
      'capitalized_tokens',
    ]);
    expect(versions.filter((version) => version.id !== closing?.id).every((v) => v.qa_status === 'passed')).toBe(true);
    // Every contract check is stored, so nothing is logged as unstored.
    expect(warn).not.toHaveBeenCalledWith(expect.anything(), LOG_MESSAGE);
  });

  it('logs every contract check the schema does not accept and runs only the accepted ones', async () => {
    // A qa_results table with the check-name list of migration 0001 (before OD-56).
    qaResultsAsOfMigration(env.fixture, 1);
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draft(runId);
    const caption = storedQa(env.fixture, runId).find((version) => version.kind === 'caption');
    setCommentary(env, caption?.id ?? '', 'caption', 'Gracias a Ezequiel Barrantes');
    await env.render(runId);
    const container = env.container();
    const warn = vi.spyOn(container.logger, 'warn');
    await env.qa(runId, { fonts: () => FONTS }, container);
    expect(warn).toHaveBeenCalledWith({ runId, check: 'capitalized_tokens' }, LOG_MESSAGE);
    // One warning per contract check missing from the 0001 list: capitalized_tokens and team_badges.
    const unstored = QA_CHECKS.filter((check) => !QA_CHECK_NAMES_0001.includes(check));
    expect(warn.mock.calls.filter((call) => call[1] === LOG_MESSAGE)).toEqual(
      unstored.map((check) => [{ runId, check }, LOG_MESSAGE]),
    );
    const versions = storedQa(env.fixture, runId);
    expect(versions.find((version) => version.id === caption?.id)).toMatchObject({ qa_status: 'passed', results: [] });
    for (const version of versions.filter((item) => item.kind === 'slide')) {
      expect(version.results.map((row) => row.check_name)).toEqual(
        SLIDE_CHECKS.filter((check) => QA_CHECK_NAMES_0001.includes(check)),
      );
    }
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
      'capitalized_tokens',
      'team_badges',
    ]);
    const stored = storedQa(env.fixture, runId);
    expect(stored.find((version) => version.id === match?.id)?.qa_status).toBe('passed');
    expect(stored.filter((version) => version.id !== match?.id).every((v) => v.qa_status === 'pending')).toBe(true);
    await expect(qaElementVersion(env.container(), match?.id ?? '', { fonts: () => FONTS })).rejects.toMatchObject({
      reason: 'already_checked',
    });
  });

  it('stores a capitalized_tokens warning for a regenerated caption with an unlisted token (OD-26, OD-56)', async () => {
    const runId = env.run(leagueFacts(), NOT_AVAILABLE);
    await env.draft(runId);
    const caption = storedQa(env.fixture, runId).find((version) => version.kind === 'caption');
    setCommentary(env, caption?.id ?? '', 'caption', 'Jornada con Valentina Ochoa');
    const result = await qaElementVersion(env.container(), caption?.id ?? '', { fonts: () => FONTS });
    expect(result.qaStatus).toBe('warnings');
    expect(result.results).toEqual([
      {
        check: 'capitalized_tokens',
        outcome: 'fail',
        severity: 'warning',
        details: { tokens: ['Valentina', 'Ochoa'] },
        acknowledgedAt: null,
      },
    ]);
    const stored = storedQa(env.fixture, runId).find((version) => version.id === caption?.id);
    expect(stored?.qa_status).toBe('warnings');
    expect(stored?.results).toEqual([
      {
        element_version_id: caption?.id,
        check_name: 'capitalized_tokens',
        outcome: 'fail',
        severity: 'warning',
        details: JSON.stringify({ tokens: ['Valentina', 'Ochoa'] }),
        acknowledged_at: null,
      },
    ]);
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
