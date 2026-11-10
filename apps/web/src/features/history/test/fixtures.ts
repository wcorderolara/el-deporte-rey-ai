/**
 * Synthetic contract data for the export, history and traceability tests. Every value is invented (SC-04); no
 * network is used (the fake fetch comes from the facts test support). The tests check these fixtures against the
 * `@edr/contracts` schemas, so they stay contract-shaped.
 */
import type {
  Carousel,
  DataMode,
  Draft,
  ElementVersion,
  Export,
  ExportDetail,
  ExportFile,
  Fact,
  Project,
  SlideTrace,
  TextField,
} from '@edr/contracts';

export {
  evidence,
  fakeServer,
  HOSTILE_REFERENCES,
  IMPORT_VERSION_ID,
  jsonResponse,
  manualEvidence,
  problemResponse,
  scoreFact,
  teamNameFact,
  teamsFact,
} from '../../facts/test/fixtures';

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_PROJECT_ID = '99999999-9999-4999-8999-999999999999';
export const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
export const RUN_ID = '33333333-3333-4333-8333-333333333333';
export const CAROUSEL_ID = '44444444-4444-4444-8444-444444444441';
export const CAROUSEL_2_ID = '44444444-4444-4444-8444-444444444442';
export const CAROUSEL_3_ID = '44444444-4444-4444-8444-444444444443';
export const FINAL_APPROVAL_ID = '55555555-5555-4555-8555-555555555555';
export const EXPORT_ID = '66666666-6666-4666-8666-666666666661';
export const OLDER_EXPORT_ID = '66666666-6666-4666-8666-666666666660';
export const NEW_EXPORT_ID = '66666666-6666-4666-8666-666666666662';

/** Version IDs: slide 1, slide 2, caption. */
export const VERSION_IDS = [
  '77777777-7777-4777-8777-777777777771',
  '77777777-7777-4777-8777-777777777772',
  '77777777-7777-4777-8777-777777777773',
] as const;

export const EXPORTED_AT = '2026-10-26T15:00:00Z';
export const OLDER_EXPORTED_AT = '2026-10-20T09:30:00Z';

const API = '/api/v1';
export const urls = {
  projectList: `${API}/projects`,
  project: `${API}/projects/${PROJECT_ID}`,
  exports: (projectId = PROJECT_ID): string => `${API}/projects/${projectId}/exports`,
  draft: `${API}/projects/${PROJECT_ID}/draft`,
  exportCarousel: (carouselId: string): string => `${API}/carousels/${carouselId}/exports`,
  export: (exportId: string): string => `${API}/exports/${exportId}`,
  download: (exportId: string): string => `${API}/exports/${exportId}/download`,
  trace: (exportId: string, position: number): string => `${API}/exports/${exportId}/slides/${position}/trace`,
  image: (versionId: string): string => `${API}/element-versions/${versionId}/image`,
} as const;

export function sha(n: number): string {
  return n.toString(16).padStart(64, '0');
}

export function project(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    title: 'Liga de demostración, jornada 3',
    competitionName: 'Liga de demostración',
    seasonLabel: '2026',
    stageLabel: 'Fase regular',
    matchday: 3,
    sourceName: 'Fuente de demostración A',
    dataMode: 'DEMO_DATA',
    demonstration: true,
    language: 'es',
    createdAt: '2026-10-25T17:00:00Z',
    approvalState: 'exported',
    lastExportAt: EXPORTED_AT,
    latestRunStatus: null,
    sportsContext: null,
    competitionId: 'demo-a-liga',
    sourceId: 'demo-a',
    seasonId: 'demo-a-2026',
    stageId: 'demo-a-regular',
    latestRun: null,
    activeDraftId: DRAFT_ID,
    visualTemplates: [],
    ...overrides,
  };
}

/** Files of an export with two slides, deliberately out of order: `01.png`, `02.png`, `caption.txt`, `manifest.json`. */
export function exportFiles(): ExportFile[] {
  return [
    { position: 0, fileName: 'manifest.json', kind: 'manifest', sha256: sha(4), elementVersionId: null },
    { position: 3, fileName: 'caption.txt', kind: 'caption_text', sha256: sha(3), elementVersionId: VERSION_IDS[2] },
    { position: 2, fileName: '02.png', kind: 'slide_image', sha256: sha(2), elementVersionId: VERSION_IDS[1] },
    { position: 1, fileName: '01.png', kind: 'slide_image', sha256: sha(1), elementVersionId: VERSION_IDS[0] },
  ];
}

export function exportRecord(overrides: Partial<Export> = {}): Export {
  const id = overrides.id ?? EXPORT_ID;
  return {
    id,
    projectId: PROJECT_ID,
    carouselId: CAROUSEL_ID,
    finalApprovalId: FINAL_APPROVAL_ID,
    exportedAt: EXPORTED_AT,
    directory: `exports/${PROJECT_ID}/${id}`,
    dataMode: 'DEMO_DATA',
    demonstration: true,
    files: exportFiles(),
    ...overrides,
  };
}

type Segment = TextField['segments'][number];

export function segment(text: string, overrides: Partial<Segment> = {}): Segment {
  return { provenance: 'commentary', text, factId: null, factStatus: null, ...overrides };
}

export function factSegment(text: string, factStatus: Segment['factStatus'] = 'verified'): Segment {
  return { provenance: 'fact', text, factId: '00000000-0000-4000-8000-000000000002', factStatus };
}

export function version(index: 0 | 1 | 2, overrides: Partial<ElementVersion> = {}): ElementVersion {
  const id = VERSION_IDS[index];
  return {
    id,
    versionNumber: index + 1,
    createdAt: '2026-10-26T14:00:00Z',
    state: 'approved',
    blocked: false,
    blockingFacts: [],
    contentFlags: [],
    qa: [],
    fields: [],
    imageUrl: index === 2 ? null : `/api/v1/element-versions/${id}/image`,
    width: index === 2 ? null : 1080,
    height: index === 2 ? null : 1350,
    ...overrides,
  };
}

/** The exact exported versions: two slides and the caption, in carousel order. */
export function exportedElements(options: { attested?: boolean } = {}): ExportDetail['elements'] {
  const scoreStatus = options.attested === true ? 'manually_approved' : 'verified';
  return [
    {
      position: 1,
      kind: 'slide',
      version: version(0, {
        fields: [
          { field: 'title', segments: [segment('Resultados de la jornada', { provenance: 'template_text' })] },
          { field: 'headline', segments: [segment('Una jornada intensa')] },
        ],
      }),
    },
    {
      position: 2,
      kind: 'slide',
      version: version(1, {
        fields: [
          { field: 'team_home', segments: [factSegment('Equipo A')] },
          { field: 'score', segments: [factSegment('2-1', scoreStatus)] },
          { field: 'team_away', segments: [factSegment('Equipo B')] },
        ],
      }),
    },
    {
      position: 3,
      kind: 'caption',
      version: version(2, {
        fields: [
          { field: 'caption', segments: [segment('Así terminó la jornada.'), factSegment('Equipo A')] },
          { field: 'hashtags', segments: [segment('#LigaDemo #Jornada3', { provenance: 'template_text' })] },
        ],
      }),
    },
  ];
}

export function exportDetail(
  overrides: Partial<ExportDetail> = {},
  options: { attested?: boolean } = {},
): ExportDetail {
  return { ...exportRecord(), elements: exportedElements(options), ...overrides };
}

export function carousel(overrides: Partial<Carousel> = {}): Carousel {
  return {
    id: CAROUSEL_ID,
    sequence: 1,
    total: 3,
    elements: [],
    readyForFinalApproval: true,
    finalApproval: {
      id: FINAL_APPROVAL_ID,
      carouselId: overrides.id ?? CAROUSEL_ID,
      approvedAt: '2026-10-26T14:30:00Z',
      versionSetSha256: sha(9),
      valid: true,
    },
    ...overrides,
  };
}

/** Carousel 1 final-approved, carousel 2 without final approval, carousel 3 with an invalidated final approval. */
export function defaultCarousels(): Carousel[] {
  return [
    carousel(),
    carousel({ id: CAROUSEL_2_ID, sequence: 2, readyForFinalApproval: false, finalApproval: null }),
    carousel({
      id: CAROUSEL_3_ID,
      sequence: 3,
      finalApproval: {
        id: '55555555-5555-4555-8555-555555555553',
        carouselId: CAROUSEL_3_ID,
        approvedAt: '2026-10-26T14:40:00Z',
        versionSetSha256: sha(8),
        valid: false,
      },
    }),
  ];
}

export function draft(carousels: Carousel[] = defaultCarousels(), dataMode: DataMode = 'DEMO_DATA'): Draft {
  return {
    id: DRAFT_ID,
    projectId: PROJECT_ID,
    runId: RUN_ID,
    factsRunId: RUN_ID,
    language: 'es',
    dataMode,
    demonstration: dataMode === 'DEMO_DATA',
    standingsIncluded: true,
    createdAt: '2026-10-26T13:00:00Z',
    excludedMatchKeys: [],
    leftOutMatches: [],
    carousels,
  };
}

export function trace(facts: Fact[], dataMode: DataMode = 'DEMO_DATA', position: 1 | 2 = 2): SlideTrace {
  return {
    exportId: EXPORT_ID,
    position,
    elementVersionId: position === 1 ? VERSION_IDS[0] : VERSION_IDS[1],
    dataMode,
    facts,
  };
}
