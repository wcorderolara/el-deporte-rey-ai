/**
 * Export, history and integrity through the HTTP platform after the real content, rendering and visual QA stages, on
 * a migrated database with a temporary data directory and the bundled fonts (architecture.md section 11.2; contract
 * operations exportCarousel, listProjectExports, getExport; R-216, R-218, R-220, R-240, R-269; T10-F13, T10-F15).
 * Synthetic facts and the stub AI over the committed fixtures only; the shared setup blocks every non-loopback
 * connection.
 */
import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ExportDetailSchema, ExportListResponseSchema, ExportSchema, type Export } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { readJsonColumn } from '../../platform/db/index.js';
import { ElementTextSchema } from '../content/index.js';
import { leagueFacts } from '../content/test/support.js';
import { pngSize } from '../rendering/index.js';

import { ExportFileStore, type ExportFolder } from './files.js';
import { ManifestSchema, captionText, sha256Of } from './manifest.js';
import { type ExportHarness, PROJECT_ID, elementPath, exportHarness, problem, rowCount } from './test/support.js';

let harness: ExportHarness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

async function start(options: Parameters<typeof exportHarness>[0] = {}): Promise<ExportHarness> {
  harness = await exportHarness(options);
  return harness;
}

const MISSING = '00000000-0000-4000-8000-00000000ffff';

async function exported(h: ExportHarness): Promise<Export> {
  const response = await h.exportCarousel();
  expect(response.statusCode, response.body).toBe(201);
  return ExportSchema.parse(response.json());
}

function folderOf(h: ExportHarness, written: Pick<Export, 'directory'>): string {
  return join(h.env.dataDir, written.directory);
}

describe('exportCarousel refusals (R-216, R-240)', () => {
  it('refuses without a final approval, writes nothing, and exports once the carousel is final-approved', async () => {
    const h = await start();
    const unapproved = await h.exportCarousel();
    expect(unapproved.statusCode).toBe(409);
    expect(problem(unapproved).code).toBe('FINAL_APPROVAL_REQUIRED');

    await h.approveAll();
    const notFinal = await h.exportCarousel();
    expect(notFinal.statusCode).toBe(409);
    expect(problem(notFinal).code).toBe('FINAL_APPROVAL_REQUIRED');
    expect(rowCount(h.container, 'exports')).toBe(0);
    expect(() => readdirSync(join(h.env.dataDir, 'exports'))).toThrow();

    await h.finalApprove();
    const written = await exported(h);
    expect(written.carouselId).toBe((await h.carousel()).id);
    expect(rowCount(h.container, 'exports')).toBe(1);
  });

  it('answers 404 for an unknown carousel and 400 for an invalid ID, before building any path', async () => {
    const h = await start();
    const unknown = await h.send('POST', `/carousels/${MISSING}/exports`);
    expect(unknown.statusCode).toBe(404);
    expect(problem(unknown).code).toBe('NOT_FOUND');
    const invalid = await h.send('POST', '/carousels/..%2F..%2Fetc/exports');
    expect(invalid.statusCode).toBe(400);
    expect(problem(invalid).code).toBe('VALIDATION_FAILED');
    expect((await h.get(`/projects/${MISSING}/exports`)).statusCode).toBe(404);
    expect((await h.get(`/exports/${MISSING}`)).statusCode).toBe(404);
    expect((await h.get('/exports/not-a-uuid')).statusCode).toBe(400);
  });

  it('refuses a request without the client header (local request protection, AD-14)', async () => {
    const h = await start();
    await h.approveAll();
    await h.finalApprove();
    const host = h.container.config.server.allowedHosts[0] ?? '127.0.0.1:4300';
    const response = await h.app.inject({
      method: 'POST',
      url: `/api/v1/carousels/${(await h.carousel()).id}/exports`,
      headers: { host },
    });
    expect(response.statusCode).toBe(403);
    expect(rowCount(h.container, 'exports')).toBe(0);
  });

  it('refuses an export after the final approval is invalidated by a withdrawal (T10-F15)', async () => {
    const h = await start();
    const draft = await h.approveAll();
    await h.finalApprove();
    const element = draft.carousels[0]?.elements[1];
    if (element === undefined) {
      throw new Error('no element');
    }
    expect((await h.send('DELETE', `${elementPath(element)}/approval`)).statusCode).toBe(200);
    const response = await h.exportCarousel();
    expect(response.statusCode).toBe(409);
    expect(problem(response).code).toBe('FINAL_APPROVAL_REQUIRED');
    expect(rowCount(h.container, 'exports')).toBe(0);
  });

  it('refuses a final approval whose stored version set no longer matches its SHA-256', async () => {
    const h = await start();
    await h.approveAll();
    await h.finalApprove();
    h.container.db.prepare('UPDATE final_approvals SET version_set_sha256 = ?').run(['0'.repeat(64)]);
    const response = await h.exportCarousel();
    expect(response.statusCode).toBe(409);
    expect(problem(response).code).toBe('FINAL_APPROVAL_REQUIRED');
  });
});

describe('export files (R-218, R-269, AD-17)', () => {
  it('writes 01.png to NN.png in carousel order at the configured size, caption.txt and manifest.json', async () => {
    const h = await start();
    const draft = await h.approveAll();
    const final = await h.finalApprove();
    const written = await exported(h);
    const carousel = draft.carousels[0];
    const slides = (carousel?.elements ?? [])
      .filter((element) => element.kind === 'slide')
      .sort((a, b) => a.position - b.position);
    const caption = carousel?.elements.find((element) => element.kind === 'caption');
    if (caption === undefined || slides.length === 0) {
      throw new Error('no caption or no slide');
    }

    expect(written).toMatchObject({
      projectId: PROJECT_ID,
      finalApprovalId: final.id,
      dataMode: 'DEMO_DATA',
      demonstration: true,
    });
    expect(written.directory).toBe(`exports/${PROJECT_ID}/${written.id}`);
    const names = slides.map((_slide, index) => `${String(index + 1).padStart(2, '0')}.png`);
    expect(written.files.map((file) => file.fileName)).toEqual([...names, 'caption.txt', 'manifest.json']);
    expect(written.files.map((file) => file.position)).toEqual(
      slides.map((_s, i) => i + 1).concat(slides.length + 1, slides.length + 2),
    );

    const folder = folderOf(h, written);
    expect(readdirSync(folder).sort()).toEqual([...names, 'caption.txt', 'manifest.json'].sort());
    expect(statSync(folder).mode & 0o777).toBe(0o700);
    const { width, height } = h.container.config.format;
    slides.forEach((slide, index) => {
      const name = names[index] as string;
      const bytes = readFileSync(join(folder, name));
      expect(lstatSync(join(folder, name)).mode & 0o777).toBe(0o600);
      const render = readFileSync(join(h.env.dataDir, 'renders', PROJECT_ID, `${slide.currentVersion.id}.png`));
      expect(Buffer.compare(bytes, render)).toBe(0);
      expect(pngSize(bytes)).toEqual({ width, height });
      const file = written.files[index];
      expect(file).toMatchObject({ kind: 'slide_image', elementVersionId: slide.currentVersion.id });
      expect(file?.sha256).toBe(sha256Of(bytes));
    });

    const captionBytes = readFileSync(join(folder, 'caption.txt'));
    const storedCaption = h.container.db
      .prepare<{ text: string }>('SELECT text FROM element_versions WHERE id = ?')
      .get([caption.currentVersion.id]);
    const text = readJsonColumn(ElementTextSchema, storedCaption?.text, 'text');
    expect(captionBytes.toString('utf8')).toBe(captionText(text));
    const captionField = caption.currentVersion.fields.find((field) => field.field === 'caption');
    const hashtags = caption.currentVersion.fields.find((field) => field.field === 'hashtags');
    expect(captionBytes.toString('utf8')).toBe(
      `${(captionField?.segments ?? [])
        .map((s) => s.text)
        .join('')
        .trim()}\n\n` + `${(hashtags?.segments ?? []).map((s) => s.text.trim()).join(' ')}\n`,
    );
    expect(written.files.find((file) => file.fileName === 'caption.txt')).toMatchObject({
      kind: 'caption_text',
      elementVersionId: caption.currentVersion.id,
      sha256: sha256Of(captionBytes),
    });

    const manifestBytes = readFileSync(join(folder, 'manifest.json'));
    const manifest = ManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
    expect(written.files.at(-1)).toMatchObject({ kind: 'manifest', elementVersionId: null });
    expect(written.files.at(-1)?.sha256).toBe(sha256Of(manifestBytes));
    expect(manifest).toMatchObject({
      exportId: written.id,
      exportedAt: written.exportedAt,
      dataMode: 'DEMO_DATA',
      demonstration: true,
      carousel: { id: carousel?.id },
      finalApproval: { id: final.id, versionSetSha256: final.versionSetSha256 },
      project: { id: PROJECT_ID },
      source: { id: 'demo-a', dataMode: 'DEMO_DATA' },
    });
    expect(manifest).not.toHaveProperty('operatorAttested');
    expect(manifest.sources.map((source) => source.id)).toContain('demo-a');
    expect(manifest.files.map((file) => [file.fileName, file.elementVersionId, file.sha256])).toEqual(
      written.files.slice(0, -1).map((file) => [file.fileName, file.elementVersionId, file.sha256]),
    );
    const refs = h.container.db
      .prepare<{ fact_id: string }>(
        'SELECT fact_id FROM element_fact_refs WHERE element_version_id = ? ORDER BY fact_id',
      )
      .all([slides[1]?.currentVersion.id ?? '']);
    expect(manifest.files[1]?.factIds).toEqual(refs.map((row) => row.fact_id));
    expect(manifest.facts.length).toBeGreaterThan(0);
    expect(manifest.facts.every((fact) => fact.status === 'verified')).toBe(true);

    const stored = h.container.db
      .prepare<{ directory: string; manifest_sha256: string; data_mode: string }>(
        'SELECT directory, manifest_sha256, data_mode FROM exports WHERE id = ?',
      )
      .get([written.id]);
    expect(stored).toEqual({
      directory: written.directory,
      manifest_sha256: sha256Of(manifestBytes),
      data_mode: 'DEMO_DATA',
    });
    expect(rowCount(h.container, 'export_files')).toBe(slides.length + 2);
  });

  it('writes the exact versions of the final-approval row; every export gets a fresh folder', async () => {
    const h = await start();
    await h.approveAll();
    await h.finalApprove();
    const first = await exported(h);
    const second = await exported(h);
    expect(second.id).not.toBe(first.id);
    expect(second.directory).not.toBe(first.directory);
    expect(second.files.map((file) => [file.fileName, file.elementVersionId])).toEqual(
      first.files.map((file) => [file.fileName, file.elementVersionId]),
    );
    expect(second.files.slice(0, -1).map((file) => file.sha256)).toEqual(
      first.files.slice(0, -1).map((file) => file.sha256),
    );
  });
});

describe('history (R-220)', () => {
  it('lists exports newest first and reopens one with the exact exported versions, also after a regeneration', async () => {
    const h = await start();
    const draft = await h.approveAll();
    await h.finalApprove();
    const first = await exported(h);
    const second = await exported(h);

    const listed = await h.get(`/projects/${PROJECT_ID}/exports`);
    expect(listed.statusCode).toBe(200);
    const list = ExportListResponseSchema.parse(listed.json());
    expect(list.exports.map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(list.exports[1]).toEqual(first);

    // A later regeneration supersedes one exported version; the export still shows what was exported.
    const match = draft.carousels[0]?.elements.find((element) => element.slideType === 'match_result');
    if (match === undefined) {
      throw new Error('no match slide');
    }
    const regenerated = await h.send('POST', `${elementPath(match)}/regenerate`);
    expect(regenerated.statusCode, regenerated.body).toBe(201);

    const reopened = await h.get(`/exports/${first.id}`);
    expect(reopened.statusCode).toBe(200);
    const detail = ExportDetailSchema.parse(reopened.json());
    const { elements, ...fields } = detail;
    expect(fields).toEqual(first);
    const exportedElements = draft.carousels[0]?.elements ?? [];
    expect(elements.map((element) => [element.position, element.kind, element.version.id])).toEqual(
      exportedElements.map((element) => [element.position, element.kind, element.currentVersion.id]),
    );
    for (const element of elements) {
      const original = exportedElements.find((candidate) => candidate.currentVersion.id === element.version.id);
      expect(element.version.fields).toEqual(original?.currentVersion.fields);
      expect(element.version.state).toBe(element.version.id === match.currentVersion.id ? 'superseded' : 'approved');
    }
    // The exported folder is unchanged by the regeneration.
    expect(readdirSync(folderOf(h, first)).length).toBe(first.files.length);
    // The carousel's final approval is invalid now, so a new export is refused.
    const refused = await h.exportCarousel();
    expect(refused.statusCode).toBe(409);
    expect(problem(refused).code).toBe('FINAL_APPROVAL_REQUIRED');
  });
});

describe('export integrity (T10-F15)', () => {
  it('a final approval invalidated while the files are written: no record, the folder stays unreferenced', async () => {
    let invalidate: (() => void) | null = null;
    class InvalidatingStore extends ExportFileStore {
      override async createFolder(projectId: string, exportId: string): Promise<ExportFolder> {
        const folder = await super.createFolder(projectId, exportId);
        return {
          relativeDirectory: folder.relativeDirectory,
          writeFile: async (name, bytes) => {
            await folder.writeFile(name, bytes);
            if (name === 'manifest.json') {
              invalidate?.();
              invalidate = null;
            }
          },
        };
      }
    }
    const h = await start({ files: (dataDir) => new InvalidatingStore(dataDir) });
    await h.approveAll();
    await h.finalApprove();
    invalidate = () => {
      h.container.db
        .prepare("UPDATE final_approvals SET invalidated_at = '2026-10-28T23:00:00.000Z' WHERE invalidated_at IS NULL")
        .run();
    };
    const refused = await h.exportCarousel();
    expect(refused.statusCode).toBe(409);
    expect(problem(refused).code).toBe('FINAL_APPROVAL_REQUIRED');
    expect(rowCount(h.container, 'exports')).toBe(0);
    expect(rowCount(h.container, 'export_files')).toBe(0);
    const orphans = readdirSync(join(h.env.dataDir, 'exports', PROJECT_ID));
    expect(orphans).toHaveLength(1);
    expect(readdirSync(join(h.env.dataDir, 'exports', PROJECT_ID, orphans[0] as string))).toContain('manifest.json');

    // A new final approval exports into another, fresh folder; the orphan stays unreferenced.
    await h.finalApprove();
    const written = await exported(h);
    expect(written.directory).not.toContain(orphans[0] as string);
    const directories = h.container.db.prepare<{ directory: string }>('SELECT directory FROM exports').all();
    expect(directories.map((row) => row.directory)).toEqual([written.directory]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// REVIEW-APPROVAL-01: the approved editorial copy in the export
// ---------------------------------------------------------------------------------------------------------------

describe('approved editorial copy in the export (REVIEW-APPROVAL-01; PD-33 option A, independent approvals)', () => {
  const FIELD: Readonly<Record<string, string>> = {
    facebook_instagram: 'headline',
    tiktok_reels: 'copy',
    viral_headlines: 'headline_1',
    youtube: 'title',
    debate_question: 'question',
  };

  function draftId(h: ExportHarness): string {
    return (
      h.container.db
        .prepare<{ id: string }>('SELECT id FROM content_drafts WHERE project_id = ? AND superseded_at IS NULL')
        .get([PROJECT_ID])?.id ?? ''
    );
  }

  /** A current editorial version of the draft (as the editorial module stores it), approved or not. */
  function copyVersion(
    h: ExportHarness,
    id: string,
    deliverable: string,
    text: string,
    factIds: string[],
    options: { readonly approved?: boolean; readonly versionNumber?: number } = {},
  ): void {
    h.container.db
      .prepare(
        'INSERT INTO editorial_versions (id, project_id, draft_id, deliverable, version_number, origin, generation_id, ' +
          'base_version_id, instructions, raw, fields, flags, fact_ids, event_ids, evidence_ids, created_at, ' +
          "approved_at, superseded_at) VALUES (?, ?, ?, ?, ?, 'edited', NULL, NULL, NULL, NULL, ?, '[]', ?, '[]', " +
          "'[]', '2026-10-28T20:00:00.000Z', ?, NULL)",
      )
      .run([
        id,
        PROJECT_ID,
        draftId(h),
        deliverable,
        options.versionNumber ?? 1,
        JSON.stringify([{ name: FIELD[deliverable] ?? 'question', text, words: 3, characters: text.length }]),
        JSON.stringify(factIds),
        options.approved === false ? null : '2026-10-28T20:05:00.000Z',
      ]);
  }

  function factOf(h: ExportHarness, factKey: string): string {
    const row = h.container.db.prepare<{ id: string }>('SELECT id FROM facts WHERE fact_key = ?').get([factKey]);
    if (row === undefined) {
      throw new Error(`no fact ${factKey}`);
    }
    return row.id;
  }

  /** A file store that runs `change` once, right after the manifest is written (before the export is recorded). */
  function changingStore(change: () => void): (dataDir: string) => ExportFileStore {
    let pending: (() => void) | null = change;
    class ChangingStore extends ExportFileStore {
      override async createFolder(projectId: string, exportId: string): Promise<ExportFolder> {
        const folder = await super.createFolder(projectId, exportId);
        return {
          relativeDirectory: folder.relativeDirectory,
          writeFile: async (name, bytes) => {
            await folder.writeFile(name, bytes);
            if (name === 'manifest.json') {
              pending?.();
              pending = null;
            }
          },
        };
      }
    }
    return (dataDir) => new ChangingStore(dataDir);
  }

  function copyText(h: ExportHarness, written: Pick<Export, 'directory'>): string {
    return readFileSync(join(folderOf(h, written), 'copy-editorial.txt'), 'utf8');
  }

  it('never exports a copy whose facts are no longer publishable', async () => {
    // A team the slides do not use, with an unconfirmed name: the copy that relies on it is blocked.
    const facts = leagueFacts('verified').team('equipo-sin-confirmar', 'Equipo Sin Confirmar', [], 'candidate');
    const h = await start({ facts });
    await h.approveAll();
    await h.finalApprove();
    copyVersion(h, '00000000-0000-4000-8000-00000000c001', 'debate_question', '¿Quién gana la jornada?', [
      factOf(h, 'team:atletico-rio-ebano:name'),
    ]);
    copyVersion(h, '00000000-0000-4000-8000-00000000c002', 'youtube', 'Resumen con un dato sin confirmar', [
      factOf(h, 'team:equipo-sin-confirmar:name'),
    ]);
    const written = await exported(h);
    const text = copyText(h, written);
    expect(text).toContain(
      `${'='.repeat(40)}\nPregunta para generar debate\n${'='.repeat(40)}\n\n¿Quién gana la jornada?`,
    );
    expect(text).not.toContain('YouTube');
    expect(text).not.toContain('sin confirmar');
    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(join(folderOf(h, written), 'manifest.json'), 'utf8')),
    );
    expect(manifest.editorial?.deliverables.map((entry) => entry.deliverable)).toEqual(['debate_question']);
    // The manifest lists the copy's facts with their status, like the slides' facts.
    expect(manifest.facts.map((fact) => fact.factId)).toContain(factOf(h, 'team:atletico-rio-ebano:name'));
    expect(manifest.facts.map((fact) => fact.factId)).not.toContain(factOf(h, 'team:equipo-sin-confirmar:name'));
  });

  it('writes one approved deliverable, then all five in the contract order, the same file on consecutive exports', async () => {
    const h = await start();
    await h.approveAll();
    await h.finalApprove();
    copyVersion(h, '00000000-0000-4000-8000-00000000c010', 'youtube', 'Título sintético', []);
    const one = await exported(h);
    expect(copyText(h, one)).toContain('YouTube');
    expect(copyText(h, one).match(/^={40}$/gmu)).toHaveLength(2);

    copyVersion(h, '00000000-0000-4000-8000-00000000c011', 'debate_question', '¿Pregunta sintética?', []);
    copyVersion(h, '00000000-0000-4000-8000-00000000c012', 'facebook_instagram', 'GANCHO SINTÉTICO', []);
    copyVersion(h, '00000000-0000-4000-8000-00000000c013', 'tiktok_reels', 'Corto sintético', []);
    copyVersion(h, '00000000-0000-4000-8000-00000000c014', 'viral_headlines', 'Titular uno', []);
    const first = await exported(h);
    const second = await exported(h);
    const lines = copyText(h, first).split('\n');
    const rule = '='.repeat(40);
    expect(lines.filter((_line, index) => lines[index - 1] === rule && lines[index + 1] === rule)).toEqual([
      'Facebook / Instagram',
      'TikTok / Reels',
      'Titulares virales',
      'YouTube',
      'Pregunta para generar debate',
    ]);
    // Scenario D: two consecutive exports write the same copy, bytes and hash, under two records.
    expect(second.id).not.toBe(first.id);
    expect(copyText(h, second)).toBe(copyText(h, first));
    const copyHash = (written: Export) => written.files.find((file) => file.kind === 'editorial_text')?.sha256;
    expect(copyHash(second)).toBe(copyHash(first));
    expect(first.finalApprovalId).toBe(second.finalApprovalId);
  });

  it('refuses the export when the copy approval is withdrawn while the files are written (scenario B)', async () => {
    const copyId = '00000000-0000-4000-8000-00000000c003';
    let h: ExportHarness | null = null;
    h = await start({
      files: changingStore(() => {
        h?.container.db.prepare('UPDATE editorial_versions SET approved_at = NULL WHERE id = ?').run([copyId]);
      }),
    });
    await h.approveAll();
    await h.finalApprove();
    copyVersion(h, copyId, 'debate_question', '¿Quién gana la jornada?', []);
    const refused = await h.exportCarousel();
    expect(refused.statusCode).toBe(409);
    expect(problem(refused).code).toBe('VERSION_CONFLICT');
    expect(rowCount(h.container, 'exports')).toBe(0);
    expect(rowCount(h.container, 'export_files')).toBe(0);
    // The next export carries the copy as it is now (none), with the same final approval.
    const written = await exported(h);
    expect(written.files.map((file) => file.kind)).not.toContain('editorial_text');
  });

  it('refuses the export when the copy is edited while the files are written (scenario A)', async () => {
    const copyId = '00000000-0000-4000-8000-00000000c004';
    let h: ExportHarness | null = null;
    h = await start({
      files: changingStore(() => {
        // The operator's edit: the approved version is superseded by a new version that is not approved.
        h?.container.db
          .prepare("UPDATE editorial_versions SET superseded_at = '2026-10-28T21:00:00.000Z' WHERE id = ?")
          .run([copyId]);
        if (h !== null) {
          copyVersion(h, '00000000-0000-4000-8000-00000000c005', 'debate_question', '¿Pregunta editada?', [], {
            approved: false,
            versionNumber: 2,
          });
        }
      }),
    });
    await h.approveAll();
    await h.finalApprove();
    copyVersion(h, copyId, 'debate_question', '¿Quién gana la jornada?', []);
    const refused = await h.exportCarousel();
    expect(refused.statusCode).toBe(409);
    expect(problem(refused).code).toBe('VERSION_CONFLICT');
    expect(rowCount(h.container, 'exports')).toBe(0);
    // The edited version is not approved: the next export has no copy.
    const written = await exported(h);
    expect(written.files.map((file) => file.kind)).not.toContain('editorial_text');
  });

  it('refuses the export when a fact of the copy stops being publishable while the files are written (scenario C)', async () => {
    // A confirmed team the slides do not use: only the copy rests on it.
    const facts = leagueFacts('verified').team('equipo-extra', 'Equipo Extra');
    let h: ExportHarness | null = null;
    h = await start({
      facts,
      files: changingStore(() => {
        h?.container.db
          .prepare(
            "UPDATE facts SET status = 'unverified', unverified_reason = 'disputed', value = NULL, " +
              'candidate_value = NULL WHERE fact_key = ?',
          )
          .run(['team:equipo-extra:name']);
      }),
    });
    await h.approveAll();
    await h.finalApprove();
    copyVersion(h, '00000000-0000-4000-8000-00000000c006', 'youtube', 'Equipo Extra en la jornada', [
      factOf(h, 'team:equipo-extra:name'),
    ]);
    const refused = await h.exportCarousel();
    expect(refused.statusCode).toBe(409);
    expect(problem(refused).code).toBe('VERSION_CONFLICT');
    expect(rowCount(h.container, 'exports')).toBe(0);
    // The graphic approval is untouched, and the next export leaves the copy out.
    const written = await exported(h);
    expect(written.files.map((file) => file.kind)).not.toContain('editorial_text');
  });
});
