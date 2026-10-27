/**
 * One valid synthetic sample per component schema of the HTTP contract and per inline request and response body.
 * The contract declares no `example` values, so these samples are the accepted values of the parity tests. All data
 * is invented (SC-04): no real team, competition, person or provider value.
 */
import type { ComponentName, OperationId } from '@edr/contracts';

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SHA = 'ab'.repeat(32);
const T1 = '2026-10-27T16:32:21.123Z';
const T2 = '2026-10-25T18:00:00-06:00';

const failure = { code: 'rate_limited', sourceId: 'demo-a', path: '/matches/0', httpStatus: 429 };
const availability = { available: false, reason: 'subscription_restricted' };
const listingMeta = { retrievedAt: T1, fromCache: true, stale: false, retryAfterSeconds: null };
const sourceInfo = {
  id: 'demo-a',
  name: 'Demo A',
  mode: 'DEMO_DATA',
  role: 'primary',
  officialPublication: false,
  accepted: true,
  enabled: true,
  publicationPermission: 'not_applicable',
};
const sourceListing = {
  sourceId: 'demo-a',
  sourceName: 'Demo A',
  mode: 'DEMO_DATA',
  availability,
  listing: listingMeta,
};
const competitionSource = {
  sourceId: 'demo-a',
  sourceName: 'Demo A',
  mode: 'DEMO_DATA',
  selectable: true,
  availability: { available: true, reason: null },
};
const catalogueCompetition = {
  id: 'demo-a-liga-demo',
  name: 'Liga Demo',
  areaName: 'Región Ficticia',
  reference: true,
  sources: [competitionSource],
};
const season = { id: '2026-27', label: '2026/27', current: true, startDate: '2026-08-01', endDate: null };
const stage = {
  id: 'fase-liga',
  name: 'Fase de liga',
  order: 1,
  standings: 'expected',
  selectableAsWhole: false,
  matchdays: [1, 2, 3],
  availability: { available: true, reason: null },
};
const stageStatus = { stage: 'research', status: 'failed', startedAt: T1, finishedAt: T1, failure };
const run = {
  id: uuid(2),
  projectId: uuid(1),
  runNumber: 1,
  kind: 'full',
  status: 'failed',
  startedAt: T1,
  finishedAt: T1,
  failure,
  stages: [stageStatus],
};
const projectSummary = {
  id: uuid(1),
  title: 'Liga Demo - Jornada 3',
  competitionName: 'Liga Demo',
  seasonLabel: '2026/27',
  stageLabel: 'Fase de liga',
  matchday: 3,
  sourceName: 'Demo A',
  dataMode: 'DEMO_DATA',
  demonstration: true,
  language: 'es',
  createdAt: T1,
  approvalState: 'in_review',
  lastExportAt: null,
};
const project = {
  ...projectSummary,
  competitionId: 'demo-a-liga-demo',
  sourceId: 'demo-a',
  seasonId: '2026-27',
  stageId: 'fase-liga',
  latestRun: run,
  activeDraftId: uuid(3),
};
const matchScoreValue = { home: 2, away: 1 };
const factRef = {
  factId: uuid(10),
  factKey: 'match_score:liga-demo:m1',
  kind: 'match_score',
  status: 'unverified',
  unverifiedReason: 'disputed',
  reason: 'Sources disagree',
  display: '2-1',
  blockReason: 'not_verified',
};
const evidence = {
  sourceId: 'demo-a',
  sourceName: 'Demo A',
  dataMode: 'DEMO_DATA',
  role: 'primary',
  accepted: true,
  officialPublication: false,
  relation: 'supports',
  value: matchScoreValue,
  sourceRef: 'fixture:disputed-resolved/liga-demo.json',
  retrievedAt: T1,
  importVersionId: null,
};
const dispute = {
  sourceValues: [{ sourceId: 'demo-b', independenceGroup: 'demo-b', value: { home: 2, away: 2 } }],
  consultedSourceId: 'demo-official',
  consultedAt: T1,
  outcome: 'resolved',
  resolvedValue: matchScoreValue,
};
const fact = {
  ...factRef,
  value: null,
  candidateValue: matchScoreValue,
  subject: { matchKey: 'liga-demo:2026-27:m1' },
  evidence: [evidence],
  dispute,
  manualApproval: null,
};
const leftOutMatch = {
  matchKey: 'liga-demo:2026-27:m2',
  label: 'Club A - Club B',
  status: 'postponed',
  reason: 'not_finished',
};
const mismatch = { elementId: 'score-home', factId: uuid(10), expected: '2', actual: '3' };
const qaResults = [
  {
    check: 'data_match',
    outcome: 'pass',
    severity: 'blocking',
    details: { mismatches: [mismatch] },
    acknowledgedAt: null,
  },
  { check: 'team_names', outcome: 'pass', severity: 'blocking', details: { mismatches: [] }, acknowledgedAt: null },
  {
    check: 'text_fit',
    outcome: 'fail',
    severity: 'blocking',
    details: { overflowingElements: ['headline'] },
    acknowledgedAt: null,
  },
  {
    check: 'style_consistency',
    outcome: 'fail',
    severity: 'warning',
    details: { colorsOutsidePalette: ['#12ab34'], fontsOutsideSet: ['Fuente Ficticia'], templateVersions: ['1.0.0'] },
    acknowledgedAt: T1,
  },
  {
    check: 'dimensions',
    outcome: 'pass',
    severity: 'blocking',
    details: { expectedWidth: 1080, expectedHeight: 1350, actualWidth: 1080, actualHeight: 1350 },
    acknowledgedAt: null,
  },
  {
    check: 'capitalized_tokens',
    outcome: 'fail',
    severity: 'warning',
    details: { tokens: ['Ramírez'] },
    acknowledgedAt: null,
  },
];
const textField = {
  field: 'headline',
  segments: [
    { provenance: 'fact', text: '2-1', factId: uuid(10), factStatus: 'unverified' },
    { provenance: 'commentary', text: 'Gran partido', factId: null, factStatus: null },
  ],
};
const contentFlag = { code: 'UNVERIFIED_NUMBER', field: 'headline', excerpt: '3' };
const elementVersion = {
  id: uuid(20),
  versionNumber: 1,
  createdAt: T1,
  state: 'ready',
  blocked: true,
  blockingFacts: [factRef],
  contentFlags: [contentFlag],
  qa: qaResults,
  fields: [textField],
  imageUrl: `/api/v1/element-versions/${uuid(20)}/image`,
  width: 1080,
  height: 1350,
};
const element = {
  id: uuid(21),
  carouselId: uuid(22),
  kind: 'slide',
  position: 1,
  slideType: 'match_result',
  currentVersion: elementVersion,
};
const finalApproval = { id: uuid(23), carouselId: uuid(22), approvedAt: T1, versionSetSha256: SHA, valid: true };
const carousel = {
  id: uuid(22),
  sequence: 1,
  total: 1,
  elements: [element],
  readyForFinalApproval: true,
  finalApproval,
};
const draft = {
  id: uuid(3),
  projectId: uuid(1),
  runId: uuid(2),
  factsRunId: uuid(2),
  language: 'es',
  dataMode: 'DEMO_DATA',
  demonstration: true,
  standingsIncluded: true,
  createdAt: T1,
  excludedMatchKeys: ['liga-demo:2026-27:m2'],
  leftOutMatches: [leftOutMatch],
  carousels: [carousel],
};
const exportRecord = {
  id: uuid(30),
  projectId: uuid(1),
  carouselId: uuid(22),
  finalApprovalId: uuid(23),
  exportedAt: T1,
  directory: `exports/${uuid(1)}/${uuid(30)}`,
  dataMode: 'DEMO_DATA',
  demonstration: true,
  files: [
    { position: 1, fileName: '01.png', kind: 'slide_image', sha256: SHA, elementVersionId: uuid(20) },
    { position: 2, fileName: 'caption.txt', kind: 'caption_text', sha256: SHA, elementVersionId: uuid(24) },
    { position: 3, fileName: 'manifest.json', kind: 'manifest', sha256: SHA, elementVersionId: null },
  ],
};
const manualSelection = {
  stage: { id: 'fase-regular', name: 'Fase regular', order: 1 },
  matchday: 3,
  teams: [
    { key: 'club-a', name: 'Club Ficticio A' },
    { key: 'club-b', name: 'Club Ficticio B' },
  ],
  matches: [{ home: 'club-a', away: 'club-b', kickoff: T2, status: 'finished', score: { home: 1, away: 0 } }],
  standings: {
    asOf: T1,
    rows: [
      {
        position: 1,
        team: 'club-a',
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        goalsFor: 1,
        goalsAgainst: 0,
        goalDifference: 1,
        points: 3,
      },
    ],
  },
};
const manualDocument = {
  format: 'edr-manual-import/1',
  competition: { id: 'liga-nacional-demo', name: 'Liga Nacional Demo', areaName: null },
  season: { id: 'apertura-2026', label: 'Apertura 2026' },
  selections: [manualSelection],
};
const importFileCreate = {
  channel: 'csv_file',
  fileName: 'jornada-3.csv',
  declaredSource: 'Acta ficticia',
  contentBase64: 'bG9jYWwsdmlzaXRhbnRlDQo=',
};
const importError = {
  location: 'file',
  record: '4',
  field: 'arbitro',
  problem: 'person_field',
  message: 'Person-level column refused',
};
const importSummary = {
  id: uuid(40),
  channel: 'csv_file',
  fileName: 'jornada-3.csv',
  declaredSource: null,
  receivedAt: T1,
  competitionId: 'liga-nacional-demo',
  competitionName: 'Liga Nacional Demo',
  seasonId: 'apertura-2026',
  seasonLabel: 'Apertura 2026',
  originalSha256: SHA,
  selections: [
    { stageId: 'fase-regular', stageName: 'Fase regular', matchday: 3, versionId: uuid(41), versionNumber: 2 },
  ],
};
const brandAsset = {
  id: uuid(50),
  kind: 'brand_logo',
  label: 'Logo principal',
  mime: 'image/png',
  width: 512,
  height: 512,
  sha256: SHA,
  active: true,
  registeredAt: T1,
};

export const componentSamples: Record<ComponentName, unknown> = {
  Uuid: uuid(1),
  Slug: 'liga-demo',
  SourceId: 'demo-a',
  MatchKey: 'liga-demo:2026-27:m1',
  Label: 'Logo principal',
  DisplayName: 'Liga Demo 2026/27',
  StageName: 'Fase_de liga (A)',
  TeamName: "Club Atlético O'Demo & Co.",
  FileName: 'jornada-3.csv',
  DataMode: 'DEMO_DATA',
  MatchStatus: 'finished',
  Problem: {
    type: 'urn:edr:problem:APPROVAL_BLOCKED',
    title: 'Approval blocked',
    status: 409,
    code: 'APPROVAL_BLOCKED',
    detail: 'A referenced fact is not publishable',
    errors: [{ path: '/versionId', message: 'Invalid identifier' }],
    facts: [factRef],
    items: [{ elementId: uuid(21), reason: 'blocked' }],
    importErrors: [importError],
    retryAfterSeconds: 30,
    refusalReason: 'verified',
  },
  Failure: failure,
  Language: 'es',
  Settings: {
    languages: [
      { code: 'es', label: 'Español' },
      { code: 'en', label: 'English' },
    ],
    defaultLanguage: 'es',
    format: { width: 1080, height: 1350, maxSlidesPerCarousel: 10 },
    publicationMode: 'manual',
    dataModes: ['DEMO_DATA', 'MANUAL_DATA'],
    verificationPolicy: {
      manuallyApprovedPublication: 'allowed_without_accepted_source',
      livePublicationPermissionRule: 'every_supporting_source',
    },
    providers: { sources: [sourceInfo], ai: 'stub' },
  },
  SourceInfo: sourceInfo,
  Availability: availability,
  ListingMeta: listingMeta,
  SourceListing: sourceListing,
  CompetitionSource: competitionSource,
  CatalogueCompetition: catalogueCompetition,
  Catalogue: { competitions: [catalogueCompetition], sources: [sourceListing] },
  Season: season,
  SeasonList: {
    competitionId: 'demo-a-liga-demo',
    sourceId: 'demo-a',
    availability: { available: true, reason: null },
    listing: listingMeta,
    seasons: [season],
  },
  Stage: stage,
  StageList: {
    competitionId: 'demo-a-liga-demo',
    sourceId: 'demo-a',
    seasonId: '2026-27',
    availability: { available: true, reason: null },
    listing: listingMeta,
    stages: [stage],
  },
  ProjectCreate: {
    competitionId: 'demo-a-liga-demo',
    sourceId: 'demo-a',
    seasonId: '2026-27',
    stageId: 'fase-liga',
    matchday: 3,
    language: 'es',
  },
  ProjectUpdate: { language: 'en' },
  ProjectSummary: projectSummary,
  ProjectSummaryFields: projectSummary,
  Project: project,
  RunStart: { kind: 'redraft' },
  Run: run,
  RunStatus: 'running',
  StageStatus: stageStatus,
  FactStatus: 'manually_approved',
  UnverifiedReason: 'awaiting_independent_verification',
  BlockReason: 'publication_permission_unconfirmed',
  FactKind: 'standing_row',
  FactRef: factRef,
  FactRefFields: factRef,
  FactSubject: { matchKey: 'liga-demo:2026-27:m1', teamId: 'club-a', contextIndex: 0 },
  MatchTeamsValue: { homeTeamId: 'club-a', awayTeamId: 'club-b' },
  MatchKickoffValue: { kickoff: T2 },
  MatchStatusValue: { matchStatus: 'in_play' },
  MatchScoreValue: matchScoreValue,
  StandingRowValue: {
    position: 1,
    teamId: 'club-a',
    played: 3,
    won: 2,
    drawn: 1,
    lost: 0,
    goalsFor: 5,
    goalsAgainst: 2,
    goalDifference: 3,
    points: 7,
  },
  MatchdayInfoValue: { stageLabel: 'Fase de liga', matchdayNumber: 3, totalMatchdays: 8 },
  ContextItemValue: { type: 'matchday_of_total', matchday: 3, totalMatchdays: 8 },
  TeamOfficialNameValue: { teamId: 'club-a', officialName: 'Club Ficticio A' },
  FactValue: { type: 'teams_in_table', count: 36 },
  FactKindValue: { kind: 'match_score', value: null, candidateValue: matchScoreValue },
  ManualApproval: { approvedAt: T1, carriedOverFromFactId: uuid(11) },
  Fact: fact,
  Evidence: evidence,
  Dispute: dispute,
  StandingsAvailability: { available: false, reason: 'not_provided_for_stage' },
  LeftOutMatch: leftOutMatch,
  Draft: draft,
  Carousel: carousel,
  Element: element,
  ElementVersion: elementVersion,
  TextField: textField,
  ContentFlag: contentFlag,
  QaResult: qaResults[5],
  QaOutcome: 'fail',
  QaMismatch: mismatch,
  VersionRef: { versionId: uuid(20) },
  FinalApproval: finalApproval,
  Export: exportRecord,
  ExportFields: exportRecord,
  ExportDetail: { ...exportRecord, elements: [{ position: 1, kind: 'slide', version: elementVersion }] },
  SlideTrace: { exportId: uuid(30), position: 1, elementVersionId: uuid(20), dataMode: 'DEMO_DATA', facts: [fact] },
  ImportCreate: importFileCreate,
  ImportFileCreate: importFileCreate,
  ImportFormCreate: { channel: 'form', declaredSource: 'Acta ficticia', document: manualDocument },
  ManualImportDocument: manualDocument,
  ManualSelection: manualSelection,
  ImportError: importError,
  ImportSummary: importSummary,
  ManualSelectionHistory: {
    competitionId: 'liga-nacional-demo',
    seasonId: 'apertura-2026',
    selections: [
      {
        stageId: 'fase-regular',
        stageName: 'Fase regular',
        matchday: 3,
        versions: [{ versionId: uuid(41), versionNumber: 2, importId: uuid(40), createdAt: T1, current: true }],
      },
    ],
  },
  ManualVersion: {
    id: uuid(41),
    versionNumber: 2,
    importId: uuid(40),
    createdAt: T1,
    supersededAt: null,
    competitionId: 'liga-nacional-demo',
    seasonId: 'apertura-2026',
    selection: manualSelection,
  },
  BrandAssetKind: 'mascot',
  BrandAsset: brandAsset,
  Template: {
    id: 'match-result',
    version: '1.0.0',
    slideType: 'match_result',
    label: 'Resultado',
    badgeSlots: 0,
    imageSlots: ['brand_logo', 'decoration'],
  },
};

/** Samples of the JSON request bodies (inline or by reference) of the operations that have one. */
export const requestSamples: Partial<Record<OperationId, unknown>> = {
  createProject: componentSamples.ProjectCreate,
  updateProject: componentSamples.ProjectUpdate,
  startRun: componentSamples.RunStart,
  setExcludedMatches: { excludedMatchKeys: ['liga-demo:2026-27:m1', 'liga-demo:2026-27:m2'] },
  approveElement: componentSamples.VersionRef,
  acknowledgeQaWarnings: { versionId: uuid(20), checks: ['capitalized_tokens'] },
  createImport: componentSamples.ImportFormCreate,
  updateBrandAsset: { active: false },
};

/** Samples of the JSON success responses of every operation that returns JSON. */
export const responseSamples: Partial<Record<OperationId, unknown>> = {
  getHealth: { status: 'ok' },
  getSettings: componentSamples.Settings,
  listCompetitions: componentSamples.Catalogue,
  listSeasons: componentSamples.SeasonList,
  listStages: componentSamples.StageList,
  listProjects: { projects: [projectSummary] },
  createProject: project,
  getProject: { ...project, latestRun: null, activeDraftId: null },
  updateProject: project,
  listRuns: { runs: [run] },
  startRun: run,
  getRun: run,
  listFacts: {
    dataMode: 'DEMO_DATA',
    facts: [fact],
    leftOutMatches: [leftOutMatch],
    standings: { available: true, reason: null },
  },
  approveFactManually: {
    ...fact,
    status: 'manually_approved',
    unverifiedReason: null,
    manualApproval: { approvedAt: T1, carriedOverFromFactId: null },
  },
  revokeManualFactApproval: fact,
  getActiveDraft: draft,
  setExcludedMatches: run,
  regenerateElement: element,
  approveElement: element,
  withdrawElementApproval: element,
  acknowledgeQaWarnings: element,
  approveCarousel: finalApproval,
  exportCarousel: exportRecord,
  listProjectExports: { exports: [exportRecord] },
  getExport: componentSamples.ExportDetail,
  traceExportedSlide: componentSamples.SlideTrace,
  listImports: { imports: [importSummary] },
  createImport: importSummary,
  getImport: importSummary,
  listManualSelections: componentSamples.ManualSelectionHistory,
  getManualVersion: componentSamples.ManualVersion,
  listBrandAssets: { assets: [brandAsset] },
  registerBrandAsset: brandAsset,
  updateBrandAsset: brandAsset,
  listTemplates: { templates: [componentSamples.Template] },
};
