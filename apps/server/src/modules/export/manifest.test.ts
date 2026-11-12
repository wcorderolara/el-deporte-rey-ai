/**
 * The file set of an export (AD-17, AD-33, AD-38 item 5; R-218, R-269, R-272, R-287, R-421): slide file names and
 * order, the caption text, file positions and hashes, and the manifest with the data mode, the demonstration flag,
 * the sources, the per-file fact IDs, each used fact's status and `operatorAttested` only for MANUALLY_APPROVED facts.
 * Pure functions; synthetic data only.
 */
import { createHash } from 'node:crypto';

import { EDITORIAL_DELIVERABLES, type EditorialFieldName, editorialDeliverableText } from '@edr/contracts';
import { describe, expect, it } from 'vitest';

import type { ElementText } from '../content/index.js';

import {
  type ExportPlan,
  MANIFEST_FORMAT,
  type ManifestFact,
  ManifestSchema,
  type PlannedEditorialDeliverable,
  buildManifest,
  captionText,
  editorialCopyText,
  exportFiles,
  sha256Of,
  slideFileName,
} from './manifest.js';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function captionOf(caption: string, hashtags: readonly string[]): ElementText {
  return {
    version: 1,
    fields: [
      {
        field: 'caption',
        segments: [
          { provenance: 'commentary', text: caption, factId: null },
          { provenance: 'fact', text: ' 2-1', factId: uuid(501) },
        ],
      },
      {
        field: 'hashtags',
        segments: hashtags.map((text) => ({ provenance: 'commentary' as const, text, factId: null })),
      },
    ],
  };
}

function fact(n: number, status: ManifestFact['status']): ManifestFact {
  return {
    factId: uuid(n),
    factKey: `match:m-${String(n)}:score`,
    kind: 'match_score',
    status,
    evidence: [{ sourceId: 'demo-a', dataMode: 'DEMO_DATA', relation: 'supports', importVersionId: null }],
  };
}

function plan(overrides: Partial<ExportPlan> = {}, slideCount = 3): ExportPlan {
  return {
    exportId: uuid(1),
    exportedAt: '2026-10-28T12:00:00.000Z',
    project: {
      id: uuid(2),
      competitionId: 'liga-sintetica',
      competitionName: 'Liga Sintética',
      seasonId: '2026',
      seasonLabel: '2026/27',
      stageId: 'fase-regular',
      stageLabel: 'Fase regular',
      matchday: 3,
      language: 'es',
    },
    carousel: { id: uuid(3), sequence: 1, total: 1 },
    finalApproval: { id: uuid(4), approvedAt: '2026-10-28T11:00:00.000Z', versionSetSha256: 'a'.repeat(64) },
    dataMode: 'DEMO_DATA',
    source: { id: 'demo-a', name: 'Fuente sintética A', dataMode: 'DEMO_DATA' },
    sources: [
      { id: 'demo-a', name: 'Fuente sintética A', dataMode: 'DEMO_DATA' },
      { id: 'demo-b', name: 'Fuente sintética B', dataMode: 'DEMO_DATA' },
    ],
    slides: Array.from({ length: slideCount }, (_unused, index) => ({
      elementId: uuid(100 + index),
      elementVersionId: uuid(200 + index),
      versionNumber: 1,
      slideType: index === 0 ? 'cover' : 'match_result',
      png: Buffer.from([0x89, index]),
      width: 1080,
      height: 1350,
      factIds: index === 0 ? [] : [uuid(500 + index)],
    })),
    caption: {
      elementId: uuid(150),
      elementVersionId: uuid(250),
      versionNumber: 2,
      text: captionOf('Resumen sintético', ['#futbol', '#LigaSintetica']),
      factIds: [uuid(501)],
    },
    editorial: [],
    facts: [fact(501, 'verified'), fact(502, 'verified')],
    ...overrides,
  };
}

describe('slideFileName', () => {
  it('names slides 01.png to 99.png in carousel order', () => {
    expect([1, 2, 9, 10, 20, 99].map(slideFileName)).toEqual([
      '01.png',
      '02.png',
      '09.png',
      '10.png',
      '20.png',
      '99.png',
    ]);
    for (const bad of [0, 100, -1, 1.5]) {
      expect(() => slideFileName(bad)).toThrow(RangeError);
    }
  });
});

describe('captionText', () => {
  it('is the caption, a blank line and the hashtags separated by spaces, with a final line feed', () => {
    expect(captionText(captionOf('Resumen sintético', ['#futbol', ' #LigaSintetica ']))).toBe(
      'Resumen sintético 2-1\n\n#futbol #LigaSintetica\n',
    );
  });

  it('has no blank line when there is no hashtag', () => {
    expect(captionText(captionOf('Solo texto', []))).toBe('Solo texto 2-1\n');
  });
});

describe('exportFiles', () => {
  it('lists the slides in order, then caption.txt and manifest.json, with positions and SHA-256', () => {
    const files = exportFiles(plan());
    expect(files.map((file) => [file.position, file.fileName, file.kind, file.elementVersionId])).toEqual([
      [1, '01.png', 'slide_image', uuid(200)],
      [2, '02.png', 'slide_image', uuid(201)],
      [3, '03.png', 'slide_image', uuid(202)],
      [4, 'caption.txt', 'caption_text', uuid(250)],
      [5, 'manifest.json', 'manifest', null],
    ]);
    for (const file of files) {
      expect(file.sha256).toBe(sha(file.bytes));
    }
    expect(Buffer.from(files[0]?.bytes ?? []).equals(Buffer.from([0x89, 0]))).toBe(true);
    expect(Buffer.from(files[3]?.bytes ?? []).toString('utf8')).toBe(
      'Resumen sintético 2-1\n\n#futbol #LigaSintetica\n',
    );
  });

  it('writes a DEMO_DATA manifest with the demonstration flag, sources, files and fact statuses (R-269, R-287)', () => {
    const files = exportFiles(plan());
    const manifest = ManifestSchema.parse(JSON.parse(Buffer.from(files.at(-1)?.bytes ?? []).toString('utf8')));
    expect(manifest).toMatchObject({
      format: MANIFEST_FORMAT,
      exportId: uuid(1),
      dataMode: 'DEMO_DATA',
      demonstration: true,
      source: { id: 'demo-a', name: 'Fuente sintética A' },
      carousel: { id: uuid(3) },
      finalApproval: { id: uuid(4) },
    });
    expect(manifest).not.toHaveProperty('operatorAttested');
    expect(manifest.sources.map((source) => [source.id, source.name])).toEqual([
      ['demo-a', 'Fuente sintética A'],
      ['demo-b', 'Fuente sintética B'],
    ]);
    expect(manifest.files.map((file) => [file.position, file.fileName, file.elementVersionId, file.sha256])).toEqual(
      files.slice(0, -1).map((file) => [file.position, file.fileName, file.elementVersionId, file.sha256]),
    );
    expect(manifest.files.map((file) => file.factIds)).toEqual([[], [uuid(501)], [uuid(502)], [uuid(501)]]);
    expect(manifest.facts.map((entry) => [entry.factId, entry.status])).toEqual([
      [uuid(501), 'verified'],
      [uuid(502), 'verified'],
    ]);
  });

  it('marks a MANUAL_DATA export operator-attested and keeps MANUALLY_APPROVED facts as such (AD-38, R-272)', () => {
    const files = exportFiles(
      plan({
        dataMode: 'MANUAL_DATA',
        source: { id: 'manual', name: 'Importación sintética', dataMode: 'MANUAL_DATA' },
        sources: [{ id: 'manual', name: 'Importación sintética', dataMode: 'MANUAL_DATA' }],
        facts: [fact(501, 'manually_approved'), fact(502, 'manually_approved')],
      }),
    );
    const text = Buffer.from(files.at(-1)?.bytes ?? []).toString('utf8');
    const manifest = ManifestSchema.parse(JSON.parse(text));
    expect(manifest).toMatchObject({ dataMode: 'MANUAL_DATA', demonstration: false, operatorAttested: true });
    expect(manifest.facts.map((entry) => entry.status)).toEqual(['manually_approved', 'manually_approved']);
    expect(text).not.toMatch(/"verified"/);
  });

  it('marks operator-attested content when any one used fact is MANUALLY_APPROVED, and only then', () => {
    const mixed = exportFiles(plan({ facts: [fact(501, 'verified'), fact(502, 'manually_approved')] }));
    const manifest = ManifestSchema.parse(JSON.parse(Buffer.from(mixed.at(-1)?.bytes ?? []).toString('utf8')));
    expect(manifest.operatorAttested).toBe(true);
    expect(manifest.facts.map((entry) => entry.status)).toEqual(['verified', 'manually_approved']);

    const plain = exportFiles(plan({ dataMode: 'MANUAL_DATA', facts: [fact(501, 'verified')] }));
    const other = ManifestSchema.parse(JSON.parse(Buffer.from(plain.at(-1)?.bytes ?? []).toString('utf8')));
    expect(other).not.toHaveProperty('operatorAttested');
    expect(other.demonstration).toBe(false);
  });

  it('is deterministic for the same plan and refuses more than 99 slides', () => {
    expect(exportFiles(plan()).map((file) => file.sha256)).toEqual(exportFiles(plan()).map((file) => file.sha256));
    expect(() => exportFiles(plan({}, 100))).toThrow(RangeError);
  });
});

describe('approved editorial copy in the export (REVIEW-APPROVAL-01, amendment of PD-33)', () => {
  const field = (name: EditorialFieldName, text: string) => ({ name, text });
  const FACEBOOK: PlannedEditorialDeliverable = {
    deliverable: 'facebook_instagram',
    editorialVersionId: uuid(700),
    versionNumber: 2,
    approvedAt: '2026-10-28T10:00:00.000Z',
    fields: [
      field('headline', 'Gancho sintético'),
      field('body', 'Desarrollo sintético.'),
      field('question', '¿Pregunta sintética?'),
      field('hashtags', '#futbol #LigaSintetica'),
    ],
    factIds: [uuid(502)],
  };
  const HEADLINES: PlannedEditorialDeliverable = {
    deliverable: 'viral_headlines',
    editorialVersionId: uuid(701),
    versionNumber: 1,
    approvedAt: '2026-10-28T10:05:00.000Z',
    fields: [field('headline_1', 'Uno'), field('headline_2', 'Dos'), field('headline_3', 'Tres')],
    factIds: [],
  };

  it('writes no copy file and no editorial manifest entry without an approved deliverable', () => {
    const files = exportFiles(plan());
    expect(files.map((file) => file.fileName)).toEqual(['01.png', '02.png', '03.png', 'caption.txt', 'manifest.json']);
    const manifest = JSON.parse(Buffer.from(files.at(-1)?.bytes ?? []).toString('utf8')) as Record<string, unknown>;
    expect(manifest).not.toHaveProperty('editorial');
  });

  it('adds copy-editorial.txt after the caption with only the approved deliverables, and lists their versions', () => {
    const files = exportFiles(plan({ editorial: [FACEBOOK, HEADLINES] }));
    expect(files.map((file) => [file.position, file.fileName, file.kind, file.elementVersionId])).toEqual([
      [1, '01.png', 'slide_image', uuid(200)],
      [2, '02.png', 'slide_image', uuid(201)],
      [3, '03.png', 'slide_image', uuid(202)],
      [4, 'caption.txt', 'caption_text', uuid(250)],
      [5, 'copy-editorial.txt', 'editorial_text', null],
      [6, 'manifest.json', 'manifest', null],
    ]);
    const text = Buffer.from(files[4]?.bytes ?? []).toString('utf8');
    const rule = '='.repeat(40);
    expect(text).toBe(
      [
        'COPY EDITORIAL APROBADO\nLiga Sintética · Fase regular · 2026/27',
        `${rule}\nFacebook / Instagram\n${rule}\n\nGancho sintético\n\nDesarrollo sintético.\n\n¿Pregunta sintética?\n\n` +
          '#futbol #LigaSintetica',
        `${rule}\nTitulares virales\n${rule}\n\n1. Uno\n2. Dos\n3. Tres`,
      ].join('\n\n') + '\n',
    );
    // UTF-8, readable: no identifier, version, JSON or link.
    expect(Buffer.from(text, 'utf8').equals(Buffer.from(files[4]?.bytes ?? []))).toBe(true);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|Versi[oó]n|\{|https?:/u);
    expect(editorialCopyText(plan({ editorial: [FACEBOOK, HEADLINES] }))).toBe(text);
    const manifest = ManifestSchema.parse(JSON.parse(Buffer.from(files[5]?.bytes ?? []).toString('utf8')));
    expect(manifest.editorial).toEqual({
      position: 5,
      fileName: 'copy-editorial.txt',
      sha256: files[4]?.sha256,
      deliverables: [
        {
          deliverable: 'facebook_instagram',
          editorialVersionId: uuid(700),
          versionNumber: 2,
          approvedAt: '2026-10-28T10:00:00.000Z',
          textSha256: sha256Of(Buffer.from(editorialDeliverableText('facebook_instagram', FACEBOOK.fields), 'utf8')),
          factIds: [uuid(502)],
        },
        expect.objectContaining({ deliverable: 'viral_headlines', editorialVersionId: uuid(701), factIds: [] }),
      ],
    });
    // The element files of the manifest are unchanged: the copy is not an element of the carousel.
    expect(manifest.files.map((file) => file.fileName)).toEqual(['01.png', '02.png', '03.png', 'caption.txt']);
  });

  it('writes every exported deliverable in the contract order, whatever the order of the plan', () => {
    const one = (deliverable: PlannedEditorialDeliverable['deliverable'], name: EditorialFieldName, n: number) => ({
      ...HEADLINES,
      deliverable,
      editorialVersionId: uuid(710 + n),
      fields: [field(name, `Texto ${String(n)}`)],
    });
    const text = editorialCopyText(
      plan({
        editorial: [
          one('youtube', 'title', 4),
          one('debate_question', 'question', 5),
          FACEBOOK,
          one('tiktok_reels', 'copy', 2),
          HEADLINES,
        ].sort((a, b) => EDITORIAL_DELIVERABLES.indexOf(a.deliverable) - EDITORIAL_DELIVERABLES.indexOf(b.deliverable)),
      }),
    );
    const lines = text.split('\n');
    const rule = '='.repeat(40);
    const titles = lines.filter((_line, index) => lines[index - 1] === rule && lines[index + 1] === rule);
    expect(titles).toEqual([
      'Facebook / Instagram',
      'TikTok / Reels',
      'Titulares virales',
      'YouTube',
      'Pregunta para generar debate',
    ]);
    expect(text).toContain('YouTube\n' + '='.repeat(40) + '\n\nTítulo:\nTexto 4\n\nDescripción:\n');
    expect(text.endsWith('Texto 5\n')).toBe(true);
  });

  it('places the copy right after the slides when there is no caption, and refuses an inconsistent file set', () => {
    const files = exportFiles(plan({ caption: null, editorial: [HEADLINES] }));
    expect(files.map((file) => [file.position, file.fileName])).toEqual([
      [1, '01.png'],
      [2, '02.png'],
      [3, '03.png'],
      [4, 'copy-editorial.txt'],
      [5, 'manifest.json'],
    ]);
    const withoutFile = files.filter((file) => file.kind !== 'editorial_text' && file.kind !== 'manifest');
    expect(() => buildManifest(plan({ caption: null, editorial: [HEADLINES] }), withoutFile)).toThrow(
      'the manifest needs the editorial file exactly when the plan has approved editorial copy',
    );
  });
});
