/**
 * Test-only support of the visual QA tests: synthetic facts in the facts view of the content module, render models
 * built with the real templates from synthetic stored texts (the rendering tests' builders, T34), QA inputs and
 * settings, and a workflow fixture that runs the real content, rendering and visual QA stages on a migrated database
 * with a temporary data directory and the bundled font roles (OD-52, OD-54). Synthetic data only (no real team,
 * competition or person); nothing opens a connection. Not used by production code.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Language, QaCheck, QaResult, SlideType } from '@edr/contracts';
import { QA_CHECKS } from '@edr/contracts';

import type { AppContainer } from '../../../container.js';
import type { AppConfig } from '../../../platform/config/index.js';
import { formatDate, formatScore, templateText } from '../../../platform/format/index.js';
import type { ContentFact, ElementText } from '../../content/index.js';
import { createContentStage } from '../../content/index.js';
import { type DbFixture, type Facts, aiProvider, dbFixture, testConfig } from '../../content/test/support.js';
import type { StageContext } from '../../module-kit.js';
import type { BrandAssetLookup } from '../../brand/index.js';
import type { RenderModel } from '../../rendering/index.js';
import { TemplateRegistry, createRenderingStage } from '../../rendering/index.js';
import {
  type MatchSample,
  PALETTE,
  type RowSample,
  UTC_OFFSET,
  commentary,
  content,
  fact,
  template,
  testFonts,
  uuid,
} from '../../rendering/test/support.js';
import { checkVersion, qaContext } from '../core.js';
import type { QaSettings, VersionResult, VersionToCheck, VisualQaInput } from '../schemas.js';
import { type VisualQaOptions, createVisualQaStage } from '../stage.js';

export {
  MATCH_A,
  SELECTION_A,
  closingText,
  coverText,
  fixtureText,
  matchText,
  overviewText,
  standingsRows,
  standingsText,
  uuid,
} from '../../rendering/test/support.js';

export const FONTS = testFonts();
export const CAROUSEL = uuid(4000);
export const BRAND = Object.freeze({ name: 'Marca Sintética', handle: '@MarcaSintetica', mascotName: 'Mascotín' });

/** The configured settings of the unit tests: 1080 x 1350, the committed palette and font roles, a synthetic brand. */
export function settings(overrides: Partial<QaSettings> = {}): QaSettings {
  return {
    width: 1080,
    height: 1350,
    utcOffsetMinutes: UTC_OFFSET,
    palette: { ...PALETTE },
    fonts: {
      heading: { family: 'Montserrat', weight: 800 },
      body: { family: 'Inter', weight: 400 },
      numeric: { family: 'Inter', weight: 700 },
    },
    brand: { ...BRAND },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Facts (content module facts view)
// ---------------------------------------------------------------------------------------------------------------

/** verified: verified value; candidate: unverified with a candidate value; none: unverified without a value. */
export type ValueMode = 'verified' | 'candidate' | 'none';

function viewFact(
  id: string,
  kind: ContentFact['kind'],
  subject: object,
  value: unknown,
  mode: ValueMode,
): ContentFact {
  return {
    id,
    factKey: `${kind}:${id}`,
    kind,
    subject,
    status: mode === 'verified' ? 'verified' : 'unverified',
    unverifiedReason: mode === 'verified' ? null : 'awaiting_independent_verification',
    value: mode === 'verified' ? value : null,
    candidateValue: mode === 'candidate' ? value : null,
  } as ContentFact;
}

export function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function teamFact(id: string, officialName: string, mode: ValueMode = 'verified'): ContentFact {
  const teamId = slug(officialName);
  return viewFact(id, 'team_official_name', { teamId }, { teamId, officialName }, mode);
}

/** The facts a match-result slide of `matchText(match)` shows (IDs `factBase + 1` to `+ 4`). */
export function matchFacts(
  match: MatchSample,
  modes: Partial<Record<'teams' | 'score' | 'kickoff', ValueMode>> = {},
): ContentFact[] {
  const matchKey = `md-${String(match.factBase)}`;
  return [
    teamFact(uuid(match.factBase + 1), match.home, modes.teams),
    teamFact(uuid(match.factBase + 2), match.away, modes.teams),
    viewFact(uuid(match.factBase + 3), 'match_score', { matchKey }, { ...match.score }, modes.score ?? 'verified'),
    viewFact(
      uuid(match.factBase + 4),
      'match_kickoff',
      { matchKey },
      { kickoff: match.kickoff },
      modes.kickoff ?? 'verified',
    ),
  ];
}

/** The facts a fixture or preview slide of `fixtureText(match)` shows: teams, kickoff and status, no score (PD-ARCH-01E-B). */
export function fixtureFacts(match: MatchSample, status = 'scheduled'): ContentFact[] {
  const matchKey = `md-${String(match.factBase)}`;
  return [
    teamFact(uuid(match.factBase + 1), match.home),
    teamFact(uuid(match.factBase + 2), match.away),
    viewFact(uuid(match.factBase + 4), 'match_kickoff', { matchKey }, { kickoff: match.kickoff }, 'verified'),
    viewFact(uuid(match.factBase + 5), 'match_status', { matchKey }, { matchStatus: status }, 'verified'),
  ];
}

/** The facts a standings slide of `standingsText(rows, language, factBase)` shows. */
export function standingsFacts(rows: readonly RowSample[], factBase = 500): ContentFact[] {
  return rows.flatMap((row, index) => {
    const teamId = slug(row.team);
    const [position = 1, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, gd = 0, points = 0] =
      row.cells;
    return [
      viewFact(
        uuid(factBase + index * 2),
        'standing_row',
        { teamId },
        {
          position,
          teamId,
          played,
          won,
          drawn,
          lost,
          goalsFor,
          goalsAgainst,
          goalDifference: gd,
          points,
        },
        'verified',
      ),
      teamFact(uuid(factBase + index * 2 + 1), row.team),
    ];
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Render models and versions
// ---------------------------------------------------------------------------------------------------------------

const registry = new TemplateRegistry();

export interface ModelOptions {
  readonly demonstration?: boolean;
  readonly language?: Language;
  readonly width?: number;
  readonly height?: number;
}

/** The render model the current template builds for a stored text (as the rendering stage does). */
export function modelOf(slideType: SlideType, text: ElementText, options: ModelOptions = {}): RenderModel {
  return registry.current(slideType).build(
    content(slideType, text, {
      demonstration: options.demonstration ?? false,
      language: options.language ?? 'es',
    }),
    {
      canvas: { width: options.width ?? 1080, height: options.height ?? 1350 },
      palette: { ...PALETTE },
      fonts: FONTS,
      assets: {},
      utcOffsetMinutes: UTC_OFFSET,
    },
  );
}

/** A slide version with its render model and a PNG of the given size (default 1080 x 1350). */
export function slideVersion(
  n: number,
  slideType: SlideType,
  text: ElementText,
  options: ModelOptions & {
    readonly image?: { width: number; height: number } | null;
    readonly carouselId?: string;
  } = {},
): VersionToCheck {
  return {
    versionId: uuid(9000 + n),
    elementId: uuid(8000 + n),
    carouselId: options.carouselId ?? CAROUSEL,
    kind: 'slide',
    slideType,
    text,
    renderModel: modelOf(slideType, text, options),
    image: options.image === undefined ? { width: 1080, height: 1350 } : options.image,
  };
}

/** A caption version with the given caption and hashtag commentary. */
export function captionVersion(n: number, caption: string, hashtags: readonly string[] = ['#futbol']): VersionToCheck {
  return {
    versionId: uuid(9000 + n),
    elementId: uuid(8000 + n),
    carouselId: CAROUSEL,
    kind: 'caption',
    slideType: null,
    text: {
      version: 1,
      fields: [
        { field: 'caption', segments: [commentary(caption)] },
        { field: 'hashtags', segments: hashtags.map((tag) => commentary(tag)) },
      ],
    },
    renderModel: null,
    image: null,
  };
}

/** A copy of a version whose render model is changed by `change` (seeded defects). */
export function withModel(version: VersionToCheck, change: (model: RenderModel) => void): VersionToCheck {
  const model = structuredClone(version.renderModel) as RenderModel;
  change(model);
  return { ...version, renderModel: model };
}

/** The text element of a model with the given ID (throws when absent). */
export function textElement(model: RenderModel, id: string) {
  const element = model.elements.find((candidate) => candidate.id === id);
  if (element?.kind !== 'text') {
    throw new Error(`no text element ${id}`);
  }
  return element;
}

export interface InputOptions {
  readonly language?: Language;
  readonly settings?: QaSettings;
  readonly aliases?: readonly { teamId: string; alias: string }[];
  readonly checks?: readonly QaCheck[];
  readonly labels?: VisualQaInput['labels'];
}

/** A QA input over the versions and facts; the carousel templates are those of the versions' render models. */
export function qaInput(
  versions: readonly VersionToCheck[],
  facts: readonly ContentFact[],
  options: InputOptions = {},
): VisualQaInput {
  return {
    projectId: uuid(1),
    language: options.language ?? 'es',
    settings: options.settings ?? settings(),
    labels: options.labels ?? {
      competitionName: 'Liga Sintética Uno',
      seasonLabel: '2026/27',
      stageLabel: 'Fase regular',
    },
    facts: [...facts],
    teamAliases: [...(options.aliases ?? [])],
    checks: [...(options.checks ?? QA_CHECKS)],
    carouselTemplates: versions.flatMap((version) =>
      version.renderModel === null
        ? []
        : [
            {
              carouselId: version.carouselId,
              versionId: version.versionId,
              templateId: version.renderModel.templateId,
              templateVersion: version.renderModel.templateVersion,
            },
          ],
    ),
    versions: [...versions],
  };
}

/** Checks one version of an input. */
export function check(version: VersionToCheck, input: VisualQaInput): VersionResult {
  return checkVersion(version, qaContext(input, FONTS), new Set(input.checks));
}

/** The result of a check (throws when it was not run). */
export function resultOf(result: VersionResult, name: QaCheck): QaResult {
  const found = result.results.find((item) => item.check === name);
  if (found === undefined) {
    throw new Error(`check ${name} was not run`);
  }
  return found;
}

/** The checks of a result that failed. */
export function failedChecks(result: VersionResult): QaCheck[] {
  return result.results.filter((item) => item.outcome === 'fail').map((item) => item.check);
}

/** A match text whose stored segments are given explicitly (seeded defects of the stored text). */
export function matchTextWith(
  match: MatchSample,
  fields: Partial<
    Record<
      'title' | 'team_home' | 'team_away' | 'score' | 'kickoff' | 'headline' | 'description',
      ElementText['fields'][number]['segments']
    >
  >,
): ElementText {
  const words = templateText(match.language);
  const relation =
    match.score.home > match.score.away
      ? words.resultRelation.homeWin
      : match.score.home === match.score.away
        ? words.resultRelation.draw
        : words.resultRelation.awayWin;
  const defaults = {
    title: [template(`${words.resultTitle} · ${relation}`)],
    team_home: [fact(match.home, uuid(match.factBase + 1))],
    team_away: [fact(match.away, uuid(match.factBase + 2))],
    score: [fact(formatScore(match.score), uuid(match.factBase + 3))],
    kickoff: [fact(formatDate(match.kickoff, match.language, UTC_OFFSET), uuid(match.factBase + 4))],
    headline: [fact(match.home, uuid(match.factBase + 1)), commentary(' se impone en casa')],
    description: [commentary('Partido sintético de prueba.')],
  };
  const merged = { ...defaults, ...fields };
  return {
    version: 1,
    fields: (Object.keys(defaults) as (keyof typeof defaults)[]).map((field) => ({
      field,
      segments: merged[field],
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Workflow fixture: real content, rendering and visual QA stages
// ---------------------------------------------------------------------------------------------------------------

export const NO_ASSETS: BrandAssetLookup = {
  activeAssets: () => [],
  readFile: () => Promise.reject(new Error('no asset')),
};

export interface WorkflowFixture {
  readonly fixture: DbFixture;
  readonly config: AppConfig;
  readonly dataDir: string;
  container(scenario?: string, config?: AppConfig): AppContainer;
  ctx(runId: string, container?: AppContainer): StageContext;
  /** Inserts a full run with the facts and the standings availability. */
  run(facts: Facts, standings: { available: boolean; reason: string | null }): string;
  /** Runs the content stage of a run. */
  draft(runId: string, scenario?: string): Promise<void>;
  /** Runs the rendering stage of a run. */
  render(runId: string): Promise<void>;
  /** Runs the content and rendering stages of a run. */
  draftAndRender(runId: string, scenario?: string): Promise<void>;
  /** Runs the visual QA stage of a run (load, parse, run, parse, persist). */
  qa(runId: string, options?: VisualQaOptions, container?: AppContainer): Promise<void>;
  close(): void;
}

/** A content test database with a temporary data directory, for the real stages. */
export function workflowFixture(): WorkflowFixture {
  const rootDir = mkdtempSync(join(tmpdir(), 'edr-t35-'));
  const dataDir = join(rootDir, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  const config = testConfig();
  const fixture = dbFixture(config);
  const containerOf = (scenario = 'built-in', withConfig: AppConfig = config): AppContainer =>
    ({
      ...fixture.container(aiProvider(scenario)),
      config: withConfig,
      paths: { rootDir, dataDir },
    }) as AppContainer;
  const ctxOf = (runId: string, container: AppContainer = containerOf()): StageContext => ({
    runId,
    projectId: fixture.db.prepare<{ id: string }>('SELECT id FROM projects').get()?.id ?? '',
    runKind: 'full',
    container,
    signal: new AbortController().signal,
  });
  return {
    fixture,
    config,
    dataDir,
    container: containerOf,
    ctx: ctxOf,
    run(facts, standings) {
      const runId = fixture.insertRun('full');
      fixture.insertFacts(runId, facts);
      fixture.setStandings(runId, standings);
      return runId;
    },
    async draft(runId, scenario = 'built-in') {
      const context = ctxOf(runId, containerOf(scenario));
      const stage = createContentStage();
      const input = stage.input.parse(await stage.load(context));
      await stage.persist(stage.output.parse(await stage.run(input, context)), context);
    },
    async render(runId) {
      const context = ctxOf(runId);
      const stage = createRenderingStage({ fonts: () => FONTS, assets: () => NO_ASSETS });
      const input = stage.input.parse(await stage.load(context));
      await stage.persist(stage.output.parse(await stage.run(input, context)), context);
    },
    async draftAndRender(runId, scenario = 'built-in') {
      await this.draft(runId, scenario);
      await this.render(runId);
    },
    async qa(runId, options = { fonts: () => FONTS }, container = containerOf()) {
      const context = ctxOf(runId, container);
      const stage = createVisualQaStage(options);
      const input = stage.input.parse(await stage.load(context));
      const output = stage.output.parse(await stage.run(input, context));
      await stage.persist(output, context);
    },
    close() {
      fixture.close();
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

/** A stored QA result row. */
export interface QaRow {
  readonly element_version_id: string;
  readonly check_name: string;
  readonly outcome: string;
  readonly severity: string;
  readonly details: string;
  readonly acknowledged_at: string | null;
}

/** Every current element version of the run's draft with its kind, slide type, `qa_status` and stored results. */
export function storedQa(fixture: DbFixture, runId: string) {
  const versions = fixture.db
    .prepare<{ id: string; kind: string; slide_type: string | null; qa_status: string; position: number }>(
      'SELECT v.id AS id, e.kind AS kind, e.slide_type AS slide_type, v.qa_status AS qa_status, ' +
        'e.position AS position FROM content_drafts d JOIN carousels c ON c.draft_id = d.id ' +
        'JOIN elements e ON e.carousel_id = c.id JOIN element_versions v ON v.id = e.current_version_id ' +
        'WHERE d.run_id = ? ORDER BY c.sequence, e.position',
    )
    .all([runId]);
  const rows = fixture.db
    .prepare<QaRow>(
      'SELECT element_version_id, check_name, outcome, severity, details, acknowledged_at FROM qa_results ' +
        'ORDER BY element_version_id, check_name',
    )
    .all();
  return versions.map((version) => ({
    ...version,
    results: rows.filter((row) => row.element_version_id === version.id),
  }));
}

/** `check_name` lists of `qa_results`: migration 0001 (five names) and migration 0002 (adds `capitalized_tokens`). */
const QA_CHECK_NAME_LISTS = {
  1: "('data_match', 'team_names', 'text_fit', 'style_consistency', 'dimensions')",
  2: "('data_match', 'team_names', 'text_fit', 'style_consistency', 'dimensions', 'capitalized_tokens')",
} as const;

/**
 * Rebuilds an empty `qa_results` with the check-name list of migration 0001 or 0002, every other column and
 * constraint as migrated. Test databases only, before any result is stored (the rows are not copied).
 */
export function qaResultsAsOfMigration(fixture: DbFixture, version: 1 | 2): void {
  const statements = [
    'PRAGMA foreign_keys = OFF',
    'CREATE TABLE qa_results_next (id TEXT PRIMARY KEY, ' +
      'element_version_id TEXT NOT NULL REFERENCES element_versions, check_name TEXT NOT NULL CHECK (check_name IN ' +
      QA_CHECK_NAME_LISTS[version] +
      '), ' +
      "outcome TEXT NOT NULL CHECK (outcome IN ('pass', 'fail')), " +
      "severity TEXT NOT NULL CHECK (severity IN ('blocking', 'warning')), " +
      'details TEXT NOT NULL CHECK (json_valid(details)), acknowledged_at TEXT NULL, created_at TEXT NOT NULL, ' +
      'UNIQUE (element_version_id, check_name)) STRICT',
    'DROP TABLE qa_results',
    'ALTER TABLE qa_results_next RENAME TO qa_results',
    'PRAGMA foreign_keys = ON',
  ];
  for (const statement of statements) {
    fixture.db.prepare(statement).run();
  }
}

/**
 * Rebuilds `qa_results` with `capitalized_tokens` in its check-name constraint. Since migration 0002 (OD-56) the
 * migrated schema already accepts it, so this only empties the table; kept for tests written before 0002.
 */
export function acceptCapitalizedTokens(fixture: DbFixture): void {
  qaResultsAsOfMigration(fixture, 2);
}
