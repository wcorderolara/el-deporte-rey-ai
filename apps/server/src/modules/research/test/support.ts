/**
 * Test-only support of the research stage tests: an in-memory migrated database with synthetic sources (one per data
 * mode), a MANUAL_DATA import version, projects, a source registry of scripted sources and a workflow runner whose
 * later stages are fakes. Everything here is invented data; nothing opens a connection. Not used by production code.
 */
import type { AppContainer } from '../../../container.js';
import type { AppConfig } from '../../../platform/config/index.js';
import { type SqliteDatabase, openMigratedDatabase } from '../../../platform/db/index.js';
import { createLogger } from '../../../platform/http/index.js';
import type {
  DataMode,
  IngestionSource,
  Listing,
  SourceDescriptor,
  SourceRegistry,
} from '../../../providers/sports/index.js';
import { config as syntheticConfig, demoSource } from '../../../providers/sports/test/synthetic.js';
import { type AnyStage, STAGE_ORDER, WorkflowRunner } from '../../../workflow/index.js';
import { type StageCall, fakeStage, steppingClock } from '../../../workflow/test/support.js';
import { type ResearchStageOptions, createResearchStage } from '../stage.js';

export const IMPORT_ID = '0b0b0b0b-0000-4000-8000-00000000000b';
export const IMPORT_VERSION_ID = '0c0c0c0c-0000-4000-8000-00000000000c';
export const SELECTION_REF = '{"c":"liga-inventada","s":"2026","st":"regular","md":3}';

/** Synthetic source descriptors, one per data mode, plus a second DEMO_DATA source. */
export const SOURCES: Readonly<Record<'demoA' | 'demoB' | 'live' | 'manual', SourceDescriptor>> = Object.freeze({
  demoA: descriptor('demo-a', 'DEMO_DATA'),
  demoB: descriptor('demo-b', 'DEMO_DATA'),
  live: descriptor('live-a', 'LIVE_DATA'),
  manual: descriptor('manual-a', 'MANUAL_DATA'),
});

function descriptor(id: string, mode: DataMode): SourceDescriptor {
  return Object.freeze({
    id,
    name: `Synthetic ${id}`,
    mode,
    adapter: 'scripted',
    role: 'primary',
    officialPublication: false,
    accepted: mode !== 'MANUAL_DATA',
    independenceGroup: id,
    publicationPermission: mode === 'LIVE_DATA' ? 'unconfirmed' : 'not_applicable',
    enabled: true,
  });
}

/** What a scripted source answers to `fetchSelection`: a raw output, or an error to throw. */
export type Script = { readonly output: unknown } | { readonly error: unknown };

/** A source that answers `fetchSelection` from a script and records the calls; listings are never used here. */
export class ScriptedSource implements IngestionSource {
  readonly descriptor: SourceDescriptor;
  script: Script = { error: new Error('no script') };
  readonly calls: { readonly selection: string; readonly purpose: string }[] = [];

  constructor(sourceDescriptor: SourceDescriptor) {
    this.descriptor = sourceDescriptor;
  }

  listCompetitions(): Promise<Listing<never>> {
    return Promise.reject(new Error('not used by research'));
  }

  listSeasons(): Promise<Listing<never>> {
    return Promise.reject(new Error('not used by research'));
  }

  listStages(): Promise<Listing<never>> {
    return Promise.reject(new Error('not used by research'));
  }

  async fetchSelection(selection: string, ctx: { readonly purpose: string }): Promise<never> {
    this.calls.push({ selection, purpose: ctx.purpose });
    await Promise.resolve();
    if ('error' in this.script) {
      throw this.script.error;
    }
    return this.script.output as never;
  }
}

/** A registry over scripted sources (only `get` and `list` are used by the research stage). */
function registryOf(sources: readonly ScriptedSource[]): SourceRegistry {
  const byId = new Map(sources.map((source) => [source.descriptor.id, source]));
  return {
    descriptors: sources.map((source) => source.descriptor),
    sourceIds: sources.map((source) => source.descriptor.id),
    get: (id: string) => byId.get(id),
    list: () => sources,
    validateStartup: () => undefined,
    catalogue: undefined as never,
  };
}

const AT = '2026-10-27T11:00:00.000Z';

function insertSource(db: SqliteDatabase, source: SourceDescriptor): void {
  db.prepare(
    'INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, ' +
      'publication_permission, adapter, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)',
  ).run([
    source.id,
    source.name,
    source.mode,
    source.role,
    source.accepted ? 1 : 0,
    source.independenceGroup,
    source.publicationPermission,
    source.adapter,
    AT,
    AT,
  ]);
}

/** Inserts the synthetic MANUAL_DATA import and its selection version (the targets of `import_version_id`). */
export function insertImportVersion(
  db: Pick<SqliteDatabase, 'prepare'>,
  sourceId: string,
  versionId: string = IMPORT_VERSION_ID,
): void {
  db.prepare(
    'INSERT INTO imports (id, source_id, channel, file_name, declared_source, competition_id, season_id, ' +
      'original_path, original_sha256, original_bytes, received_at) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
  ).run([
    IMPORT_ID,
    sourceId,
    'form',
    'liga-manual',
    '2026',
    `imports/${IMPORT_ID}/original.form.json`,
    'a'.repeat(64),
    10,
    AT,
  ]);
  db.prepare(
    'INSERT INTO manual_competitions (competition_id, source_id, name, area_name, first_import_id) VALUES (?, ?, ?, NULL, ?)',
  ).run(['liga-manual', sourceId, 'Liga Manual Inventada', IMPORT_ID]);
  db.prepare('INSERT INTO manual_seasons (competition_id, season_id, label) VALUES (?, ?, ?)').run([
    'liga-manual',
    '2026',
    '2026',
  ]);
  db.prepare(
    'INSERT INTO manual_selection_versions (id, import_id, competition_id, season_id, stage_id, stage_name, ' +
      'stage_order, matchday_key, version_number, data, created_at, superseded_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
  ).run([versionId, IMPORT_ID, 'liga-manual', '2026', 'apertura', 'Apertura', 1, 5, 1, '{}', AT]);
}

/** Inserts a project on the given source with the synthetic selection reference. */
export function insertProject(db: SqliteDatabase, id: string, source: SourceDescriptor): void {
  db.prepare(
    'INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, ' +
      'stage_id, stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run([
    id,
    'liga-inventada',
    'Liga Inventada',
    source.id,
    source.mode,
    '2026',
    '2026/27',
    'regular',
    'Fase Regular',
    3,
    SELECTION_REF,
    'expected',
    'es',
    AT,
    AT,
  ]);
}

export interface ResearchFixture {
  readonly db: SqliteDatabase;
  readonly container: AppContainer;
  readonly sources: Readonly<Record<keyof typeof SOURCES, ScriptedSource>>;
  readonly calls: StageCall[];
  readonly runner: WorkflowRunner;
  close(): Promise<void>;
}

/**
 * An in-memory database with the four synthetic sources (and the MANUAL_DATA import version), a container whose
 * source registry holds scripted sources for `registered` (default: all four), and a runner with the real research
 * stage followed by fake stages.
 */
export function researchFixture(
  options: ResearchStageOptions & { readonly registered?: readonly (keyof typeof SOURCES)[] } = {},
): ResearchFixture {
  const { db } = openMigratedDatabase({ location: ':memory:' });
  for (const source of Object.values(SOURCES)) {
    insertSource(db, source);
  }
  insertImportVersion(db, SOURCES.manual.id);
  const scripted = {
    demoA: new ScriptedSource(SOURCES.demoA),
    demoB: new ScriptedSource(SOURCES.demoB),
    live: new ScriptedSource(SOURCES.live),
    manual: new ScriptedSource(SOURCES.manual),
  };
  const registered = options.registered ?? (Object.keys(scripted) as (keyof typeof SOURCES)[]);
  const config: AppConfig = syntheticConfig([demoSource('demo-a')]);
  const container = {
    config,
    db,
    clock: steppingClock(),
    logger: createLogger({ level: 'silent' }),
    sources: registryOf(registered.map((key) => scripted[key])),
  } as unknown as AppContainer;
  const calls: StageCall[] = [];
  const research = createResearchStage(options.newId === undefined ? {} : { newId: options.newId });
  const stages: AnyStage[] = [
    research as AnyStage,
    ...STAGE_ORDER.filter((name) => name !== 'research').map((name) => fakeStage(name, calls)),
  ];
  const runner = new WorkflowRunner({ container, stages: () => stages });
  return {
    db,
    container,
    sources: scripted,
    calls,
    runner,
    close: async () => {
      await runner.shutdown();
      db.close();
    },
  };
}
