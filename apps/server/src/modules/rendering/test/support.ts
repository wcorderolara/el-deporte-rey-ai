/**
 * Test-only support of the rendering tests: synthetic slide texts in the stored shape of the content stage (T32,
 * `ElementTextSchema` version 1), the committed brand font roles, render settings, and seeding helpers for a migrated
 * database in a temporary data directory. Synthetic data only (no real team, competition or person); not used by
 * production code.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DataMode, Language, SlideType } from '@edr/contracts';

import type { AppContainer, Clock } from '../../../container.js';
import type { AppConfig, BrandConfig } from '../../../platform/config/index.js';
import { type SqliteDatabase, DATABASE_FILE_NAME, openMigratedDatabase } from '../../../platform/db/index.js';
import { formatDate, formatScore, formatTime, stageDisplay, templateText } from '../../../platform/format/index.js';
import { createLogger } from '../../../platform/http/index.js';
import { config as buildConfig, demoSource } from '../../../providers/sports/test/synthetic.js';
import type { RenderSettings } from '../core.js';
import { type FontSet, fontSetFor, loadBundledFaces } from '../fonts.js';
import type { SlideContent, StoredElementText, StoredSegment, StoredTextField } from '../slide-content.js';

/** The font roles of the committed `config/brand.json` (OD-07). */
export const COMMITTED_FONT_ROLES: BrandConfig['fonts'] = Object.freeze({
  heading: { family: 'Montserrat', weight: 800 },
  body: { family: 'Inter', weight: 400 },
  numeric: { family: 'Inter', weight: 700 },
});

/** The provisional palette of the committed `config/brand.json` (OD-07). */
export const PALETTE = Object.freeze({
  primary: '#5B2A86',
  primaryDark: '#2E1145',
  accent: '#D4AF37',
  secondary: '#1F4FB8',
  light: '#FFFFFF',
});

export const UTC_OFFSET = -360;

export function testFonts(): FontSet {
  return fontSetFor(COMMITTED_FONT_ROLES, loadBundledFaces());
}

export function testSettings(width = 1080, height = 1350): RenderSettings {
  return { canvas: { width, height }, palette: { ...PALETTE }, utcOffsetMinutes: UTC_OFFSET };
}

/** A deterministic synthetic UUID. */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export function template(text: string): StoredSegment {
  return { provenance: 'template_text', text, factId: null };
}

export function fact(text: string, factId: string): StoredSegment {
  return { provenance: 'fact', text, factId };
}

export function commentary(text: string): StoredSegment {
  return { provenance: 'commentary', text, factId: null };
}

function text(fields: StoredTextField[]): StoredElementText {
  return { version: 1, fields };
}

function ai(headline: string, description: string): StoredTextField[] {
  return [
    { field: 'headline', segments: [commentary(headline)] },
    { field: 'description', segments: [commentary(description)] },
  ];
}

export interface Selection {
  readonly competition: string;
  readonly stage: string;
  readonly matchday: number | null;
  readonly season: string;
  readonly language: Language;
}

export const SELECTION_A: Selection = {
  competition: 'Liga Sintética Uno',
  stage: 'Fase regular',
  matchday: 7,
  season: '2026/27',
  language: 'es',
};

export const SELECTION_B: Selection = {
  competition: 'Copa Ficticia de Prueba',
  stage: 'Cuartos de final',
  matchday: null,
  season: '2027',
  language: 'es',
};

export function coverText(selection: Selection, footer: string | null = null): StoredElementText {
  return text([
    {
      field: 'title',
      segments: [
        template(selection.competition),
        template(stageDisplay(selection.stage, selection.matchday, selection.language)),
        template(selection.season),
      ],
    },
    ...(footer === null ? [] : [{ field: 'footer' as const, segments: [template(footer)] }]),
    ...ai('Arranca la jornada sintética', 'Repaso de los resultados de la selección.'),
  ]);
}

export interface MatchSample {
  readonly home: string;
  readonly away: string;
  readonly score: { home: number; away: number };
  readonly kickoff: string;
  readonly language: Language;
  readonly factBase: number;
}

export const MATCH_A: MatchSample = {
  home: 'Club Atlético Ñandú',
  away: 'Deportivo Árbol Sintético',
  score: { home: 2, away: 1 },
  kickoff: '2026-10-24T20:00:00Z',
  language: 'es',
  factBase: 10,
};

export function matchText(match: MatchSample, extra: Partial<Record<'headline' | 'description', string>> = {}) {
  const words = templateText(match.language);
  const relation =
    match.score.home > match.score.away
      ? words.resultRelation.homeWin
      : match.score.home === match.score.away
        ? words.resultRelation.draw
        : words.resultRelation.awayWin;
  return text([
    { field: 'title', segments: [template(`${words.resultTitle} · ${relation}`)] },
    { field: 'team_home', segments: [fact(match.home, uuid(match.factBase + 1))] },
    { field: 'team_away', segments: [fact(match.away, uuid(match.factBase + 2))] },
    { field: 'score', segments: [fact(formatScore(match.score), uuid(match.factBase + 3))] },
    {
      field: 'kickoff',
      segments: [fact(formatDate(match.kickoff, match.language, UTC_OFFSET), uuid(match.factBase + 4))],
    },
    {
      field: 'headline',
      segments: [fact(match.home, uuid(match.factBase + 1)), commentary(extra.headline ?? ' se impone en casa')],
    },
    { field: 'description', segments: [commentary(extra.description ?? 'Partido sintético de prueba.')] },
  ]);
}

/**
 * A match not played yet (PD-ARCH-01E-B) as the content stage stores it: the fixture or preview title, the local
 * status, the teams and the kickoff; never a score.
 */
export function fixtureText(
  match: MatchSample,
  slideType: 'fixture' | 'match_preview' = 'fixture',
  status: keyof ReturnType<typeof templateText>['matchStatus'] = 'scheduled',
): StoredElementText {
  const words = templateText(match.language);
  const fields: StoredTextField[] = [
    {
      field: 'title',
      segments: [template(slideType === 'fixture' ? words.fixtureTitle : `${words.previewTitle} · Jornada 20`)],
    },
    { field: 'match_status', segments: [fact(words.matchStatus[status], uuid(match.factBase + 5))] },
    { field: 'team_home', segments: [fact(match.home, uuid(match.factBase + 1))] },
    { field: 'team_away', segments: [fact(match.away, uuid(match.factBase + 2))] },
    {
      field: 'kickoff',
      segments: [fact(formatDate(match.kickoff, match.language, UTC_OFFSET), uuid(match.factBase + 4))],
    },
  ];
  if (slideType === 'match_preview') {
    fields.push({ field: 'footer', segments: [template('Liga Sintética · 2026/27')] });
  }
  fields.push(...ai('Partido de la jornada', 'Encuentro sintético programado.'));
  return text(fields);
}

/** The round overview of a calendar: one line per match, home versus away and kickoff. */
export function overviewText(matches: readonly MatchSample[]): StoredElementText {
  const words = templateText('es');
  const segments: StoredSegment[] = [];
  matches.forEach((match, index) => {
    if (index > 0) {
      segments.push(template('\n'));
    }
    segments.push(
      fact(match.home, uuid(match.factBase + 1)),
      template(` ${words.versus} `),
      fact(match.away, uuid(match.factBase + 2)),
      template(' · '),
      fact(formatDate(match.kickoff, match.language, UTC_OFFSET), uuid(match.factBase + 4)),
    );
  });
  return text([
    { field: 'title', segments: [template(`${words.calendarTitle} · Jornada 20`)] },
    { field: 'fixtures', segments },
    ...ai('Así se juega la jornada', 'Calendario sintético de prueba.'),
  ]);
}

/**
 * The round overview of a calendar with rows (PD-ARCH-01G-E.2): per match, the home and away names, the kickoff date
 * and time, and the status of a match that is not scheduled (`statuses`, by row index).
 */
export function calendarRowsText(
  matches: readonly MatchSample[],
  statuses: Readonly<Record<number, keyof ReturnType<typeof templateText>['matchStatus']>> = {},
): StoredElementText {
  const words = templateText('es');
  const segments: StoredSegment[] = [];
  matches.forEach((match, index) => {
    if (index > 0) {
      segments.push(template('\n'));
    }
    segments.push(
      fact(match.home, uuid(match.factBase + 1)),
      template(` ${words.versus} `),
      fact(match.away, uuid(match.factBase + 2)),
      template(' · '),
      fact(formatDate(match.kickoff, match.language, UTC_OFFSET), uuid(match.factBase + 4)),
      template(' · '),
      fact(formatTime(match.kickoff, UTC_OFFSET), uuid(match.factBase + 4)),
    );
    const status = statuses[index];
    if (status !== undefined) {
      segments.push(template(' · '), fact(words.matchStatus[status], uuid(match.factBase + 5)));
    }
  });
  return text([
    { field: 'title', segments: [template(`${words.calendarTitle} · Jornada 20`)] },
    { field: 'fixtures', segments },
    ...ai('Así se juega la jornada', 'Calendario sintético de prueba.'),
  ]);
}

/** A synthetic standings row: cells in the content stage's order, then the team name. */
export interface RowSample {
  readonly team: string;
  readonly cells: readonly number[];
}

export function standingsRows(count: number, first = 1): RowSample[] {
  return Array.from({ length: count }, (_, index) => {
    const position = first + index;
    const won = Math.max(0, 20 - position);
    const drawn = position % 4;
    const lost = Math.max(0, 30 - won - drawn);
    const goalsFor = 50 - position;
    const goalsAgainst = 10 + position;
    return {
      team: `Equipo Sintético ${String(position)}`,
      cells: [
        position,
        won + drawn + lost,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalsFor - goalsAgainst,
        won * 3 + drawn,
      ],
    };
  });
}

export function standingsText(
  rows: readonly RowSample[],
  language: Language = 'es',
  factBase = 500,
): StoredElementText {
  const segments: StoredSegment[] = [];
  rows.forEach((row, index) => {
    if (index > 0) {
      segments.push(template('\n'));
    }
    segments.push(fact(row.cells.map(String).join(' '), uuid(factBase + index * 2)));
    segments.push(fact(row.team, uuid(factBase + index * 2 + 1)));
  });
  return text([
    { field: 'title', segments: [template(templateText(language).standingsTitle)] },
    { field: 'standings', segments },
    ...ai('Así va la tabla', 'Clasificación tras la jornada.'),
  ]);
}

export function closingText(handle = '@ElDeporteReyGT', language: Language = 'es'): StoredElementText {
  return text([
    { field: 'title', segments: [template(`${templateText(language).closingFollow} ${handle}`)] },
    ...ai('Gracias por acompañarnos', 'Nos vemos en la próxima jornada.'),
  ]);
}

export function content(
  slideType: SlideType,
  stored: StoredElementText,
  options: { demonstration?: boolean; language?: Language; asOf?: string | null } = {},
): SlideContent {
  return {
    slideType,
    language: options.language ?? 'es',
    demonstration: options.demonstration ?? false,
    text: stored,
    standingsAsOf: options.asOf === undefined ? '2026-10-25T12:00:00Z' : options.asOf,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Database fixtures
// ---------------------------------------------------------------------------------------------------------------

export const FIXED_AT = '2026-10-27T12:00:00.000Z';

export interface RenderTestRoot {
  readonly rootDir: string;
  readonly dataDir: string;
  remove(): void;
}

export function createRenderTestRoot(): RenderTestRoot {
  const rootDir = mkdtempSync(join(tmpdir(), 'edr-t34-'));
  const dataDir = join(rootDir, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return { rootDir, dataDir, remove: () => rmSync(rootDir, { recursive: true, force: true }) };
}

/** A synthetic configuration over a temporary root, with the committed brand fonts and the given format. */
export function renderConfig(rootDir: string, format?: { width: number; height: number }): AppConfig {
  const base = buildConfig([demoSource('demo-a')], undefined, rootDir);
  return {
    ...base,
    format: { ...base.format, ...(format ?? {}) },
    brand: { ...base.brand, palette: { ...PALETTE }, fonts: COMMITTED_FONT_ROLES },
  };
}

export interface RenderDb {
  readonly db: SqliteDatabase;
  readonly root: RenderTestRoot;
  readonly container: AppContainer;
  close(): void;
}

const clock: Clock = { now: () => new Date(FIXED_AT) };

/** A migrated database file in a temporary data directory, with one source; the container has no providers. */
export function renderDb(format?: { width: number; height: number }): RenderDb {
  const root = createRenderTestRoot();
  const config = renderConfig(root.rootDir, format);
  const { db } = openMigratedDatabase({ location: join(root.dataDir, DATABASE_FILE_NAME) });
  db.prepare(
    'INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, ' +
      'publication_permission, adapter, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)',
  ).run([
    'demo-a',
    'Synthetic demo-a',
    'DEMO_DATA',
    'primary',
    'demo-a',
    'not_applicable',
    'fixture',
    FIXED_AT,
    FIXED_AT,
  ]);
  const container = {
    config,
    db,
    clock,
    logger: createLogger({ level: 'silent' }),
    paths: config.paths,
  } as unknown as AppContainer;
  return {
    db,
    root,
    container,
    close: () => {
      db.close();
      root.remove();
    },
  };
}

/** Inserts a project (with its data mode) and a completed full run; returns the run ID. */
export function seedProject(db: SqliteDatabase, projectId: string, dataMode: DataMode, runId: string): void {
  db.prepare(
    'INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, ' +
      'stage_id, stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run([
    projectId,
    'liga-sint',
    'Liga Sintética Uno',
    'demo-a',
    dataMode,
    '2026',
    '2026/27',
    'regular',
    'Fase regular',
    7,
    '{"c":"liga-sint"}',
    'expected',
    'es',
    FIXED_AT,
    FIXED_AT,
  ]);
  seedRun(db, projectId, runId, 1);
}

export function seedRun(db: SqliteDatabase, projectId: string, runId: string, runNumber: number): void {
  db.prepare(
    'INSERT INTO workflow_runs (id, project_id, run_number, kind, base_run_id, status, failure, config_snapshot, ' +
      'standings_availability, started_at, finished_at) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, NULL, ?, NULL)',
  ).run([runId, projectId, runNumber, 'full', 'running', '{}', FIXED_AT]);
}

/** Records a successful research retrieval of a run (the "as of" time of its standings). */
export function seedRetrieval(db: SqliteDatabase, runId: string, id: string, retrievedAt: string): void {
  db.prepare(
    'INSERT INTO retrievals (id, run_id, source_id, data_mode, stage, resource, retrieved_at, from_cache, outcome, ' +
      'failure, import_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)',
  ).run([id, runId, 'demo-a', 'DEMO_DATA', 'research', 'selection', retrievedAt, 'ok']);
}

export interface SeedSlide {
  readonly elementId: string;
  readonly versionId: string;
  readonly slideType: SlideType;
  readonly text: StoredElementText;
}

/** Inserts a draft with one carousel, its slides (current versions unrendered) and a caption, as T32 stores them. */
export function seedDraft(
  db: SqliteDatabase,
  options: {
    projectId: string;
    runId: string;
    draftId: string;
    carouselId: string;
    slides: readonly SeedSlide[];
    sequence?: number;
    total?: number;
    captionIds?: { elementId: string; versionId: string };
    insertDraft?: boolean;
  },
): void {
  if (options.insertDraft !== false) {
    db.prepare(
      'INSERT INTO content_drafts (id, project_id, run_id, facts_run_id, language, standings_included, ' +
        'excluded_match_keys, left_out_matches, created_at, superseded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    ).run([options.draftId, options.projectId, options.runId, options.runId, 'es', 1, '[]', '[]', FIXED_AT]);
  }
  db.prepare('INSERT INTO carousels (id, draft_id, sequence, total) VALUES (?, ?, ?, ?)').run([
    options.carouselId,
    options.draftId,
    options.sequence ?? 1,
    options.total ?? 1,
  ]);
  const insertElement = db.prepare(
    'INSERT INTO elements (id, carousel_id, kind, position, slide_type, slide_key, subject, current_version_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
  );
  const insertVersion = db.prepare(
    'INSERT INTO element_versions (id, element_id, version_number, origin, text, content_flags, ai_adapter, ' +
      'template_id, template_version, render_model, image_path, image_sha256, width, height, qa_status, created_at, ' +
      "superseded_at) VALUES (?, ?, 1, 'generated', ?, '[]', 'stub', NULL, NULL, NULL, NULL, NULL, NULL, NULL, " +
      "'pending', ?, NULL)",
  );
  const setCurrent = db.prepare('UPDATE elements SET current_version_id = ? WHERE id = ?');
  const subject = JSON.stringify({ matchKey: null, matchIndex: null, standingsPage: null, teamIds: [] });
  const elements = [...options.slides.map((slide, index) => ({ ...slide, position: index + 1, kind: 'slide' }))];
  if (options.captionIds !== undefined) {
    elements.push({
      elementId: options.captionIds.elementId,
      versionId: options.captionIds.versionId,
      slideType: null as unknown as SlideType,
      text: { version: 1, fields: [{ field: 'caption', segments: [commentary('Texto sintético')] }] },
      position: 0,
      kind: 'caption',
    });
  }
  for (const element of elements) {
    const slideKey = element.kind === 'caption' ? 'caption' : `${element.slideType}-${String(element.position)}`;
    insertElement.run([
      element.elementId,
      options.carouselId,
      element.kind,
      element.position,
      element.kind === 'caption' ? null : element.slideType,
      slideKey,
      subject,
    ]);
    insertVersion.run([element.versionId, element.elementId, JSON.stringify(element.text), FIXED_AT]);
    setCurrent.run([element.versionId, element.elementId]);
  }
}

/** The four slides of a complete carousel without standings (R-285). */
export function carouselWithoutStandings(base: number): SeedSlide[] {
  return [
    { elementId: uuid(base + 1), versionId: uuid(base + 2), slideType: 'cover', text: coverText(SELECTION_A) },
    { elementId: uuid(base + 3), versionId: uuid(base + 4), slideType: 'match_result', text: matchText(MATCH_A) },
    { elementId: uuid(base + 5), versionId: uuid(base + 6), slideType: 'closing', text: closingText() },
  ];
}
