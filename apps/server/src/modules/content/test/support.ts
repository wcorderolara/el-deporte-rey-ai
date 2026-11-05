/**
 * Test-only support of the content tests: synthetic facts and inputs, the stub AI provider over the committed T23
 * fixtures (`fixtures/ai/`, read through their manifest), and an in-memory migrated database with
 * synthetic sources, a project, a run and stored facts. Every team, competition and value is invented; nothing opens
 * a connection. Not used by production code.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { AppContainer, Clock } from '../../../container.js';
import type { AppConfig } from '../../../platform/config/index.js';
import { type SqliteDatabase, openMigratedDatabase } from '../../../platform/db/index.js';
import { createLogger } from '../../../platform/http/index.js';
import { type StubAiTextProvider, createStubAiProvider } from '../../../providers/ai/index.js';
import { config as syntheticConfig, demoSource, stubSource } from '../../../providers/sports/test/synthetic.js';
import { RunRepository, buildConfigSnapshot, type RunParameters } from '../../../workflow/index.js';
import type { ContentFact, ContentInput, TeamAlias } from '../schemas.js';

// ---------------------------------------------------------------------------------------------------------------
// Identifiers and clock
// ---------------------------------------------------------------------------------------------------------------

export const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
export const RUN_ID = '33333333-3333-4333-8333-333333333333';
export const BRAND = Object.freeze({ name: 'Synthetic Brand', handle: '@SyntheticBrand' });

let counter = 0;

/** A fresh synthetic UUID. */
export function nextId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
}

/** A clock that advances one second per reading, from a fixed synthetic time. */
export function steppingClock(start = '2026-10-28T12:00:00.000Z'): Clock {
  let time = Date.parse(start);
  return {
    now: () => {
      const value = new Date(time);
      time += 1000;
      return value;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Synthetic facts
// ---------------------------------------------------------------------------------------------------------------

/** verified (two sources agree), candidate (single accepted source), disputed (no value). */
export type FactMode = 'verified' | 'candidate' | 'disputed';

function makeFact(
  kind: ContentFact['kind'],
  factKey: string,
  subject: ContentFact['subject'],
  value: unknown,
  mode: FactMode,
): ContentFact {
  return {
    id: nextId(),
    factKey,
    kind,
    subject,
    status: mode === 'verified' ? 'verified' : 'unverified',
    unverifiedReason:
      mode === 'verified' ? null : mode === 'candidate' ? 'awaiting_independent_verification' : 'disputed',
    value: mode === 'verified' ? value : null,
    candidateValue: mode === 'candidate' ? value : null,
  } as ContentFact;
}

export interface MatchOptions {
  readonly home: string;
  readonly away: string;
  readonly status?: string;
  readonly score?: readonly [number, number] | null;
  readonly kickoff?: string | null;
  readonly mode?: FactMode;
  readonly scoreMode?: FactMode;
}

/** Builds a list of synthetic facts and team aliases. */
export class Facts {
  readonly facts: ContentFact[] = [];
  readonly aliases: TeamAlias[] = [];

  team(teamId: string, officialName: string, aliases: readonly string[] = [], mode: FactMode = 'verified'): this {
    this.facts.push(makeFact('team_official_name', `team:${teamId}:name`, { teamId }, { teamId, officialName }, mode));
    for (const alias of aliases) {
      this.aliases.push({ teamId, alias });
    }
    return this;
  }

  match(matchKey: string, options: MatchOptions): this {
    const mode = options.mode ?? 'verified';
    const subject = { matchKey };
    this.facts.push(
      makeFact(
        'match_teams',
        `match:${matchKey}:teams`,
        subject,
        { homeTeamId: options.home, awayTeamId: options.away },
        mode,
      ),
    );
    this.facts.push(
      makeFact(
        'match_status',
        `match:${matchKey}:status`,
        subject,
        { matchStatus: options.status ?? 'finished' },
        mode,
      ),
    );
    const kickoff = options.kickoff === undefined ? '2026-10-24T20:00:00Z' : options.kickoff;
    if (kickoff !== null) {
      this.facts.push(makeFact('match_kickoff', `match:${matchKey}:kickoff`, subject, { kickoff }, mode));
    }
    const score = options.score === undefined ? [2, 1] : options.score;
    if (score !== null) {
      this.facts.push(
        makeFact(
          'match_score',
          `match:${matchKey}:score`,
          subject,
          { home: score[0], away: score[1] },
          options.scoreMode ?? mode,
        ),
      );
    }
    return this;
  }

  standing(teamId: string, position: number, points: number, mode: FactMode = 'verified'): this {
    this.facts.push(
      makeFact(
        'standing_row',
        `standings:row:${teamId}`,
        { teamId },
        {
          position,
          teamId,
          played: 3,
          won: Math.floor(points / 3),
          drawn: points % 3,
          lost: 3 - Math.floor(points / 3) - (points % 3),
          goalsFor: 5,
          goalsAgainst: 4,
          goalDifference: 1,
          points,
        },
        mode,
      ),
    );
    return this;
  }
}

/** Four synthetic teams of a demonstration league and two finished matches. */
export function leagueFacts(mode: FactMode = 'verified'): Facts {
  return new Facts()
    .team(
      'atletico-rio-ebano',
      'Atlético Río Ébano',
      ['Atletico Rio Ebano', 'Ebony River Athletic', 'At. Río Ébano', 'ARÉ'],
      mode,
    )
    .team('real-brisamar', 'Real Brisamar', [], mode)
    .team('penas-nandu-sur', 'Peñas Ñandú (Sur)', ['Penas Nandu (Sur)', 'Rhea Rocks (South)'], mode)
    .team('union-guira-ceiba', 'Unión Güira & Ceiba', ['Union Guira & Ceiba'], mode)
    .match('liga-demo-1-a', { home: 'atletico-rio-ebano', away: 'real-brisamar', score: [2, 1], mode })
    .match('liga-demo-1-b', {
      home: 'penas-nandu-sur',
      away: 'union-guira-ceiba',
      score: [0, 0],
      kickoff: '2026-10-25T18:00:00Z',
      mode,
    });
}

/** A content input with synthetic labels; facts, standings and settings may be overridden. */
export function contentInput(facts: Facts, overrides: Partial<ContentInput> = {}): ContentInput {
  return {
    projectId: PROJECT_ID,
    runId: RUN_ID,
    factsRunId: RUN_ID,
    language: 'es',
    competitionName: 'Liga Demo',
    seasonLabel: '2026/27',
    contentKind: 'results',
    stageLabel: 'Temporada Regular',
    matchday: 1,
    brand: { ...BRAND },
    utcOffsetMinutes: -360,
    maxSlidesPerCarousel: 20,
    standingsRowsPerSlide: 12,
    standings: { available: false, reason: 'not_provided_for_stage' },
    excludedMatchKeys: [],
    facts: facts.facts,
    teamAliases: facts.aliases,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Stub AI fixtures: the committed T23 fixtures under fixtures/ai/ (read through their manifest)
// ---------------------------------------------------------------------------------------------------------------

/** The repository root, under which the stub adapter reads `fixtures/ai/<scenario>.json`. */
export const REPO_ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));

const AiManifestSchema = z.object({
  fixtures: z.array(
    z.object({
      file: z.string(),
      scenario: z.string(),
      expectFlag: z.enum(['UNVERIFIED_NUMBER', 'NON_OFFICIAL_TEAM_NAME', 'FORBIDDEN_CONTENT']).optional(),
      field: z.enum(['headline', 'description', 'caption']).optional(),
      bypassClass: z.boolean().optional(),
      expectFailure: z.string().optional(),
    }),
  ),
});

export interface AiFixtureCase {
  readonly scenario: string;
  readonly expectFlag: 'UNVERIFIED_NUMBER' | 'NON_OFFICIAL_TEAM_NAME' | 'FORBIDDEN_CONTENT';
  readonly field: 'headline' | 'description' | 'caption';
  /** True for the T10-F05 bypass classes. */
  readonly bypassClass: boolean;
}

/** Every content-check case of `fixtures/ai/_manifest.json`, with the flag and field the manifest states. */
export const AI_FIXTURE_CASES: readonly AiFixtureCase[] = AiManifestSchema.parse(
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'fixtures', 'ai', '_manifest.json'), 'utf8')),
).fixtures.flatMap((entry) =>
  entry.expectFlag === undefined || entry.field === undefined
    ? []
    : [
        {
          scenario: entry.scenario,
          expectFlag: entry.expectFlag,
          field: entry.field,
          bypassClass: entry.bypassClass === true,
        },
      ],
);

/**
 * The stub provider over the committed fixtures. A scenario without a fixture file (for example `built-in`) gives
 * the stub's deterministic placeholder-only draft.
 */
export function aiProvider(scenario: string): StubAiTextProvider {
  return createStubAiProvider({ scenario }, { paths: { rootDir: REPO_ROOT } });
}

// ---------------------------------------------------------------------------------------------------------------
// Database fixture
// ---------------------------------------------------------------------------------------------------------------

const AT = '2026-10-28T10:00:00.000Z';

/** Synthetic configuration: two DEMO_DATA sources, a LIVE-shaped source, a manual source and optional links. */
export function testConfig(
  options: { readonly liveConfirmed?: boolean; readonly catalogue?: unknown } = {},
): AppConfig {
  return syntheticConfig(
    [
      demoSource('demo-a'),
      demoSource('demo-b', { role: 'verification' }),
      stubSource(
        'live-a',
        'test-live',
        'LIVE_DATA',
        options.liveConfirmed === true
          ? { publicationPermission: 'confirmed', publicationPermissionDecision: 'PD-99' }
          : {},
      ),
      stubSource('manual-a', 'manual', 'MANUAL_DATA'),
    ],
    options.catalogue as never,
  );
}

export interface ProjectOptions {
  readonly sourceId?: string;
  readonly dataMode?: string;
  readonly language?: 'es' | 'en';
  readonly competitionId?: string;
  readonly selectionRef?: string;
}

export interface DbFixture {
  readonly db: SqliteDatabase;
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly runs: RunRepository;
  container(ai: StubAiTextProvider): AppContainer;
  /** Inserts a run (full or redraft) with its stage rows; returns its ID. */
  insertRun(
    kind: 'full' | 'redraft',
    options?: { readonly id?: string; readonly baseRunId?: string; readonly parameters?: RunParameters },
  ): string;
  /** Stores synthetic facts and aliases for a run; `manually_approved` facts get an approval row. */
  insertFacts(runId: string, facts: Facts, options?: { readonly manuallyApproved?: readonly string[] }): void;
  setStandings(runId: string, value: unknown): void;
  close(): void;
}

function insertSource(db: SqliteDatabase, id: string, mode: string, permission: string): void {
  db.prepare(
    'INSERT INTO sources (id, name, mode, role, official_publication, accepted, independence_group, ' +
      "publication_permission, adapter, first_seen_at, last_seen_at) VALUES (?, ?, ?, 'primary', 0, ?, ?, ?, ?, ?, ?)",
  ).run([id, `Synthetic ${id}`, mode, mode === 'MANUAL_DATA' ? 0 : 1, id, permission, 'synthetic', AT, AT]);
}

/** An in-memory migrated database with sources and one project. */
export function dbFixture(config: AppConfig = testConfig(), project: ProjectOptions = {}): DbFixture {
  const { db } = openMigratedDatabase({ location: ':memory:' });
  insertSource(db, 'demo-a', 'DEMO_DATA', 'not_applicable');
  insertSource(db, 'demo-b', 'DEMO_DATA', 'not_applicable');
  insertSource(db, 'live-a', 'LIVE_DATA', 'unconfirmed');
  insertSource(db, 'manual-a', 'MANUAL_DATA', 'not_applicable');
  db.prepare(
    'INSERT INTO projects (id, competition_id, competition_name, source_id, data_mode, season_id, season_label, ' +
      'stage_id, stage_label, matchday, selection_ref, standings_expected, language, created_at, updated_at) ' +
      "VALUES (?, ?, 'Liga Demo', ?, ?, '2026', '2026/27', 'temporada-regular', 'Temporada Regular', 1, ?, " +
      "'expected', ?, ?, ?)",
  ).run([
    PROJECT_ID,
    project.competitionId ?? 'liga-demo',
    project.sourceId ?? 'demo-a',
    project.dataMode ?? 'DEMO_DATA',
    project.selectionRef ?? '{"c":"liga-demo","s":"2026","st":"temporada-regular","md":1}',
    project.language ?? 'es',
    AT,
    AT,
  ]);
  const runs = new RunRepository(db);
  const clock = steppingClock();

  const fixture: DbFixture = {
    db,
    config,
    clock,
    runs,
    container(ai) {
      return {
        config,
        db,
        clock,
        logger: createLogger({ level: 'silent' }),
        aiProvider: ai,
      } as unknown as AppContainer;
    },
    insertRun(kind, options = {}) {
      const id = options.id ?? nextId();
      db.transaction(() => {
        runs.insertRun({
          id,
          projectId: PROJECT_ID,
          kind,
          baseRunId: options.baseRunId ?? null,
          snapshot: buildConfigSnapshot(config, options.parameters),
          stages: (kind === 'full'
            ? (['research', 'verification', 'content', 'rendering', 'visual_qa'] as const)
            : (['content', 'rendering', 'visual_qa'] as const)
          ).map((stage) => ({ id: nextId(), stage })),
        });
      });
      return id;
    },
    insertFacts(runId, facts, options = {}) {
      const manual = new Set(options.manuallyApproved ?? []);
      db.transaction(() => {
        for (const fact of facts.facts) {
          const eligible = manual.has(fact.id) ? 1 : 0;
          db.prepare(
            'INSERT INTO facts (id, run_id, fact_key, kind, subject, status, unverified_reason, value, ' +
              'candidate_value, manual_eligible, reason, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)',
          ).run([
            fact.id,
            runId,
            fact.factKey,
            fact.kind,
            // The verification stage stores the contract subject plus the evidence values (T30).
            JSON.stringify({ ...fact.subject, evidence: [] }),
            fact.status === 'verified' ? 'verified' : 'unverified',
            fact.unverifiedReason,
            fact.value === null ? null : JSON.stringify(fact.value),
            fact.candidateValue === null ? null : JSON.stringify(fact.candidateValue),
            eligible,
            AT,
          ]);
          if (eligible === 1) {
            db.prepare(
              "INSERT INTO manual_approvals (id, fact_id, action, carried_over_from_fact_id, at) VALUES (?, ?, 'approved', NULL, ?)",
            ).run([nextId(), fact.id, AT]);
          }
          if (fact.kind === 'team_official_name' && fact.subject.teamId !== undefined) {
            db.prepare(
              "INSERT OR IGNORE INTO teams (id, competition_id, season_id) VALUES (?, 'liga-demo', '2026')",
            ).run([fact.subject.teamId]);
          }
        }
        for (const alias of facts.aliases) {
          db.prepare(
            "INSERT OR IGNORE INTO team_aliases (team_id, source_id, alias, origin) VALUES (?, 'demo-a', ?, 'source')",
          ).run([alias.teamId, alias.alias]);
        }
      });
    },
    setStandings(runId, value) {
      db.prepare('UPDATE workflow_runs SET standings_availability = ? WHERE id = ?').run([
        JSON.stringify(value),
        runId,
      ]);
    },
    close() {
      db.close();
    },
  };
  return fixture;
}
