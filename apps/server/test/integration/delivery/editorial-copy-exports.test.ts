/**
 * UI-06.3 regression of successive exports of a carousel with editorial copy (REVIEW-APPROVAL-01; PD-33 Option A,
 * independent approvals; PD-34: every download writes a new export carrying only the editorial versions approved and
 * publishable at that moment; exports, ZIP files and manifests already written are never modified), through the
 * real server, workflow, review, editorial routes, export, history and ZIP download of a temporary app, with the free
 * stub writer. Synthetic DEMO_DATA only; no network request.
 *
 * The project is matchday 1 of the league phase of `copa-demo`, whose draft has two carousels: the match results and
 * the standings. The standings carousel is the one exported: its slides do not rest on the match facts of the copy,
 * so a match fact of the copy can stop being publishable while the carousel's graphic approval stays valid.
 *
 * One export after each change, every one checked file by file (`copy-editorial.txt` against the versions approved
 * then, its ZIP entry, the manifest's editorial section): a partial approval, more approvals, an approved text edited
 * (a new version the earlier approval does not cover), a withdrawn approval, and an approved text whose sports data
 * stopped being publishable. Then the history lists every export newest first, all of the same final approval, and
 * each earlier export downloads byte for byte as it was first downloaded.
 *
 * Not repeated here: the base flow and the "approved but not exportable" package (`export-editorial-copy.test.ts`),
 * the export refused when the copy changes while the files are written and two exports without changes
 * (`apps/server/src/modules/export/export.int.test.ts`), the same journey in the browser (E2E-F01 in
 * `e2e/tests/content-journey.spec.ts`).
 */
import type { Export } from '@edr/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { cleanups, start } from '../ingestion/support.js';

import {
  type ExpectedSection,
  approveCopy,
  approveCopyResponse,
  currentCopies,
  deliverableOf,
  downloadZip,
  editedCopy,
  editorialPackage,
  expectExportedCopy,
  expectNoCopy,
  expectZipOfExport,
  fieldTexts,
  generateCopy,
  readStoredZip,
  sectionOf,
  sectionTitles,
  withdrawCopy,
} from './editorial-copy-support.js';
import {
  COPA_DEMO_LEAGUE_MD1,
  WORKFLOW_TEST_TIMEOUT,
  approveDraft,
  draftOf,
  expectProblem,
  exportDetail,
  exportFile,
  exported,
  projectExports,
  projectWithDraft,
} from './support.js';

const cleanup = cleanups();

afterEach(async () => {
  await cleanup.run();
});

/** The operator's edit of an approved TikTok / Reels text (emojis, skin tone, line break). */
const EDITED_TIKTOK =
  '¡QUÉ TARDE! \u{1F525} La grada no paró de cantar \u{1F3B6} y la emoción duró hasta el silbatazo.\n' +
  '¿Tú qué opinas? \u{1F447}\u{1F3FC}';

interface Download {
  readonly written: Export;
  readonly zip: Buffer;
  readonly text: string | null;
}

describe(
  'successive exports of the editorial copy (UI-06.3; PD-33 Option A; PD-34)',
  { timeout: WORKFLOW_TEST_TIMEOUT },
  () => {
    it('every export carries the copy approved and publishable when it is written, and earlier exports never change', async () => {
      const t = await start(cleanup, { base: 'demo-only', scenario: 'default' });
      const { project } = await projectWithDraft(t, COPA_DEMO_LEAGUE_MD1);
      const draft = await approveDraft(t, project.id);
      const standings = draft.carousels[1];
      if (draft.carousels.length !== 2 || standings === undefined) {
        throw new Error('the copa-demo draft has a results carousel and a standings carousel');
      }
      expect(
        standings.elements.filter((element) => element.kind === 'slide').map((element) => element.slideType),
      ).toEqual(['cover', 'standings', 'standings', 'standings', 'closing']);
      const finalApprovalId = standings.finalApproval?.id;
      expect(finalApprovalId).toBeDefined();
      const stub = currentCopies(await generateCopy(t, project.id, 'dddddddd-dddd-4ddd-8ddd-000000000001'));

      const downloads: Download[] = [];
      /** A download now: a new export of the standings carousel, checked against the expected copy. */
      const download = async (sections: readonly ExpectedSection[]): Promise<Download> => {
        const written = await exported(t, standings.id);
        expect(written.finalApprovalId).toBe(finalApprovalId);
        const zip = await downloadZip(t, written.id);
        let text: string | null = null;
        if (sections.length === 0) {
          expectNoCopy(t, written, zip);
        } else {
          text = expectExportedCopy(t, written, zip, project, sections);
        }
        const result = { written, zip, text };
        downloads.push(result);
        return result;
      };

      // 1. Partial approval: two of five deliverables approved; only they are written, in the contract's order.
      const post = await approveCopy(t, project.id, stub.facebook_instagram);
      const youtube = await approveCopy(t, project.id, stub.youtube);
      await download([sectionOf(post), sectionOf(youtube)]);

      // 2. Two more approved after that export: the next one adds them, without a new final approval.
      const tiktok = await approveCopy(t, project.id, stub.tiktok_reels);
      const debate = await approveCopy(t, project.id, stub.debate_question);
      const all = await download([sectionOf(post), sectionOf(tiktok), sectionOf(youtube), sectionOf(debate)]);

      // 3. The approved TikTok / Reels text is edited: a new version, not approved; the earlier approval does not cover
      //    it (approving the earlier version is a conflict), and neither text is exported.
      const edited = await editedCopy(t, project.id, 'tiktok_reels', tiktok.id, { copy: EDITED_TIKTOK });
      expect(edited).toMatchObject({ versionNumber: 2, origin: 'edited', state: 'ready', approvedAt: null, flags: [] });
      expectProblem(await approveCopyResponse(t, project.id, 'tiktok_reels', tiktok.id), 409, 'VERSION_CONFLICT');
      expect(deliverableOf(await editorialPackage(t, project.id), 'tiktok_reels')).toMatchObject({
        exportable: false,
        versionCount: 2,
        current: { id: edited.id, state: 'ready' },
      });
      const afterEdit = await download([sectionOf(post), sectionOf(youtube), sectionOf(debate)]);
      expect(afterEdit.text).not.toContain(EDITED_TIKTOK);
      expect(afterEdit.text).not.toContain(fieldTexts(tiktok).copy ?? '');

      // 4. The YouTube approval is withdrawn: the next export leaves it out.
      expect(await withdrawCopy(t, project.id, 'youtube')).toMatchObject({
        id: youtube.id,
        state: 'ready',
        approvedAt: null,
      });
      const afterWithdrawal = await download([sectionOf(post), sectionOf(debate)]);
      expect(afterWithdrawal.text).not.toContain('Título:');

      // 5. A sports fact the post rests on (and neither the debate question nor the standings slides do) stops being
      //    publishable: the post stays approved but is not exportable, and the next export carries the question only.
      const factIdsOf = (versionId: string): string[] =>
        JSON.parse(
          t.container.db
            .prepare<{ fact_ids: string }>('SELECT fact_ids FROM editorial_versions WHERE id = ?')
            .get([versionId])?.fact_ids ?? '[]',
        ) as string[];
      const slideFacts = new Set(
        (
          t.container.db
            .prepare<{ fact_id: string }>(
              'SELECT r.fact_id FROM element_fact_refs r JOIN element_versions v ON v.id = r.element_version_id ' +
                'JOIN elements e ON e.id = v.element_id WHERE e.carousel_id = ?',
            )
            .all([standings.id]) as { fact_id: string }[]
        ).map((row) => row.fact_id),
      );
      const debateFacts = new Set(factIdsOf(debate.id));
      const [disputed] = factIdsOf(post.id)
        .filter((factId) => !debateFacts.has(factId) && !slideFacts.has(factId))
        .sort();
      if (disputed === undefined) {
        throw new Error('the post rests on no fact of its own');
      }
      t.container.db
        .prepare(
          "UPDATE facts SET status = 'unverified', unverified_reason = 'disputed', value = NULL, candidate_value = NULL " +
            'WHERE id = ?',
        )
        .run([disputed]);
      const changed = await editorialPackage(t, project.id);
      expect(deliverableOf(changed, 'facebook_instagram')).toMatchObject({
        exportable: false,
        current: { id: post.id, state: 'approved' },
      });
      expect(changed.deliverables.filter((entry) => entry.exportable).map((entry) => entry.deliverable)).toEqual([
        'debate_question',
      ]);
      const afterDataChange = await download([sectionOf(debate)]);
      expect(afterDataChange.text).not.toContain('Facebook / Instagram');
      expect(manifestFactIds(afterDataChange)).not.toContain(disputed);

      // The graphic final approval was never touched by an editorial change (PD-33 Option A).
      expect((await draftOf(t, project.id)).carousels[1]?.finalApproval).toMatchObject({
        id: finalApprovalId,
        valid: true,
      });

      // 6. One new export per download, each in its own folder, newest first in the history, all of the same final
      //    approval; every earlier export keeps its record and downloads byte for byte as it did when it was written.
      expect(downloads.map((entry) => (entry.text === null ? [] : sectionTitles(entry.text)))).toEqual([
        ['Facebook / Instagram', 'YouTube'],
        ['Facebook / Instagram', 'TikTok / Reels', 'YouTube', 'Pregunta para generar debate'],
        ['Facebook / Instagram', 'YouTube', 'Pregunta para generar debate'],
        ['Facebook / Instagram', 'Pregunta para generar debate'],
        ['Pregunta para generar debate'],
      ]);
      const listed = await projectExports(t, project.id);
      expect(listed.map((entry) => entry.id)).toEqual(downloads.map((entry) => entry.written.id).reverse());
      expect(new Set(listed.map((entry) => entry.finalApprovalId))).toEqual(new Set([finalApprovalId]));
      expect(new Set(downloads.map((entry) => entry.written.directory)).size).toBe(downloads.length);
      for (const entry of downloads) {
        const again = await downloadZip(t, entry.written.id);
        expect(again.equals(entry.zip), `export ${entry.written.id} downloads as it was written`).toBe(true);
        expectZipOfExport(t, entry.written, again);
        expect((await exportDetail(t, entry.written.id)).files).toEqual(entry.written.files);
        if (entry.text !== null) {
          expect(exportFile(t, entry.written, 'copy-editorial.txt').toString('utf8')).toBe(entry.text);
        }
      }
      // The earlier export with the four texts still holds the TikTok / Reels text approved then.
      expect(all.text).toContain(fieldTexts(tiktok).copy ?? '');
      // The slides are the same in every ZIP: one final approval, never repeated.
      const slides = (zip: Buffer) => readStoredZip(zip).filter((entry) => entry.name.endsWith('.png'));
      const [first, ...later] = downloads;
      for (const entry of later) {
        expect(slides(entry.zip)).toEqual(slides(first?.zip ?? Buffer.alloc(0)));
      }
      expect(t.egress.requests).toHaveLength(0);

      function manifestFactIds(entry: Download): string[] {
        const manifest = JSON.parse(exportFile(t, entry.written, 'manifest.json').toString('utf8')) as {
          facts: { factId: string }[];
        };
        return manifest.facts.map((fact) => fact.factId);
      }
    });
  },
);
