/**
 * Test-only support of the review tests: a draft produced by the real content stage (stub AI over the committed
 * `fixtures/ai/` scenarios) on an in-memory migrated database with synthetic sources, a project and stored facts
 * (content module support), with optional LIVE_DATA supporting evidence and manual approvals, QA outcomes set per
 * version, and a review service over it. Every team, competition and value is synthetic; nothing opens a connection.
 * Not used by production code.
 */
import type { AppContainer } from '../../../container.js';
import type { AppConfig } from '../../../platform/config/index.js';
import { createContentStage } from '../../content/index.js';
import {
  type DbFixture,
  type Facts,
  PROJECT_ID,
  type ProjectOptions,
  aiProvider,
  dbFixture,
  nextId,
  testConfig,
} from '../../content/test/support.js';
import type { StageContext } from '../../module-kit.js';
import { ReviewService } from '../service.js';

export { PROJECT_ID, nextId, testConfig };

/** A stored element of the draft with its current version. */
export interface DraftElementRow {
  readonly carouselId: string;
  readonly elementId: string;
  readonly versionId: string;
  readonly kind: 'slide' | 'caption';
  readonly slideType: string | null;
  readonly position: number;
}

/** One QA result row to seed (the check name is stored as given). */
export interface SeededQa {
  readonly check: string;
  readonly outcome: 'pass' | 'fail';
  readonly severity: 'blocking' | 'warning';
  readonly details: unknown;
}

export interface ReviewFixture {
  readonly fixture: DbFixture;
  readonly runId: string;
  /** A container over the fixture database, with another configuration when given. */
  container(config?: AppConfig): AppContainer;
  /** A review service over the fixture database, with another configuration when given. */
  service(config?: AppConfig): ReviewService;
  /** The elements of the active draft, in carousel and position order (caption first). */
  elements(): DraftElementRow[];
  /** The element of a slide type (the first one), or the caption. */
  element(kind: 'caption' | 'cover' | 'match_result' | 'standings' | 'closing'): DraftElementRow;
  /** Sets the QA status of a version and stores the given results. */
  setQa(versionId: string, status: 'pending' | 'passed' | 'failed' | 'warnings', results?: readonly SeededQa[]): void;
  /** Sets every current version to `passed` without results. */
  passAll(): void;
  /** Appends a manual approval row of a fact (`approved` or `revoked`). */
  manualApproval(factId: string, action: 'approved' | 'revoked'): void;
  close(): void;
}

export interface ReviewFixtureOptions {
  readonly facts: Facts;
  readonly config?: AppConfig;
  readonly project?: ProjectOptions;
  /** Facts made manually eligible with an `approved` manual approval (default none). */
  readonly manuallyApproved?: readonly string[];
  /** Records every fact as supported by an observation of this source and mode (default none). */
  readonly support?: { readonly sourceId: string; readonly mode: 'LIVE_DATA' | 'DEMO_DATA' };
  /** Stub AI scenario (default `built-in`). */
  readonly scenario?: string;
}

const AT = '2026-10-28T09:30:00.000Z';

function insertSupport(fixture: DbFixture, runId: string, facts: Facts, sourceId: string, mode: string): void {
  const retrievalId = nextId();
  fixture.db
    .prepare(
      'INSERT INTO retrievals (id, run_id, source_id, data_mode, stage, resource, retrieved_at, from_cache, ' +
        "outcome, failure, import_version_id) VALUES (?, ?, ?, ?, 'research', 'selection', ?, 0, 'ok', NULL, NULL)",
    )
    .run([retrievalId, runId, sourceId, mode, AT]);
  for (const fact of facts.facts) {
    const observationId = nextId();
    fixture.db
      .prepare(
        'INSERT INTO observations (id, run_id, retrieval_id, source_id, data_mode, import_version_id, stage, ' +
          "fact_key, value, source_ref, retrieved_at) VALUES (?, ?, ?, ?, ?, NULL, 'research', ?, '{}', ?, ?)",
      )
      .run([observationId, runId, retrievalId, sourceId, mode, fact.factKey, `source:${sourceId}/selection@${AT}`, AT]);
    fixture.db
      .prepare("INSERT INTO fact_evidence (fact_id, observation_id, relation) VALUES (?, ?, 'supports')")
      .run([fact.id, observationId]);
  }
}

/** A draft of the facts produced by the real content stage; every version is still pending QA. */
export async function reviewFixture(options: ReviewFixtureOptions): Promise<ReviewFixture> {
  const config = options.config ?? testConfig();
  const fixture = dbFixture(config, options.project ?? {});
  const runId = fixture.insertRun('full');
  fixture.insertFacts(runId, options.facts, { manuallyApproved: options.manuallyApproved ?? [] });
  if (options.support !== undefined) {
    insertSupport(fixture, runId, options.facts, options.support.sourceId, options.support.mode);
  }
  const ai = aiProvider(options.scenario ?? 'built-in');
  const containerOf = (withConfig: AppConfig = config): AppContainer =>
    ({ ...fixture.container(ai), config: withConfig }) as AppContainer;

  const ctx: StageContext = {
    runId,
    projectId: PROJECT_ID,
    runKind: 'full',
    container: containerOf(),
    signal: new AbortController().signal,
  };
  const stage = createContentStage();
  const input = stage.input.parse(await stage.load(ctx));
  await stage.persist(stage.output.parse(await stage.run(input, ctx)), ctx);

  const elements = (): DraftElementRow[] =>
    fixture.db
      .prepare<{
        carousel_id: string;
        element_id: string;
        version_id: string;
        kind: 'slide' | 'caption';
        slide_type: string | null;
        position: number;
      }>(
        'SELECT c.id AS carousel_id, e.id AS element_id, e.current_version_id AS version_id, e.kind AS kind, ' +
          'e.slide_type AS slide_type, e.position AS position FROM content_drafts d ' +
          'JOIN carousels c ON c.draft_id = d.id JOIN elements e ON e.carousel_id = c.id ' +
          'WHERE d.superseded_at IS NULL ORDER BY c.sequence, e.position',
      )
      .all()
      .map((row) => ({
        carouselId: row.carousel_id,
        elementId: row.element_id,
        versionId: row.version_id,
        kind: row.kind,
        slideType: row.slide_type,
        position: row.position,
      }));

  return {
    fixture,
    runId,
    container: containerOf,
    service: (withConfig) => new ReviewService({ container: containerOf(withConfig), newId: nextId }),
    elements,
    element(kind) {
      const found = elements().find((row) => (kind === 'caption' ? row.kind === 'caption' : row.slideType === kind));
      if (found === undefined) {
        throw new Error(`no ${kind} element`);
      }
      return found;
    },
    setQa(versionId, status, results = []) {
      fixture.db.transaction(() => {
        fixture.db.prepare('UPDATE element_versions SET qa_status = ? WHERE id = ?').run([status, versionId]);
        for (const result of results) {
          fixture.db
            .prepare(
              'INSERT INTO qa_results (id, element_version_id, check_name, outcome, severity, details, ' +
                'acknowledged_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
            )
            .run([
              nextId(),
              versionId,
              result.check,
              result.outcome,
              result.severity,
              JSON.stringify(result.details),
              AT,
            ]);
        }
      });
    },
    passAll() {
      for (const row of elements()) {
        fixture.db.prepare("UPDATE element_versions SET qa_status = 'passed' WHERE id = ?").run([row.versionId]);
      }
    },
    manualApproval(factId, action) {
      fixture.db
        .prepare(
          'INSERT INTO manual_approvals (id, fact_id, action, carried_over_from_fact_id, at) VALUES (?, ?, ?, NULL, ?)',
        )
        .run([nextId(), factId, action, fixture.clock.now().toISOString()]);
    },
    close() {
      fixture.close();
    },
  };
}

/** A failed `style_consistency` warning (contract details). */
export const STYLE_WARNING: SeededQa = {
  check: 'style_consistency',
  outcome: 'fail',
  severity: 'warning',
  details: { colorsOutsidePalette: ['#123456'], fontsOutsideSet: [], templateVersions: [] },
};

/** A failed `capitalized_tokens` warning (OD-26, OD-38). */
export const CAPITALIZED_WARNING: SeededQa = {
  check: 'capitalized_tokens',
  outcome: 'fail',
  severity: 'warning',
  details: { tokens: ['Zorvak'] },
};

/** A failed blocking `text_fit` check. */
export const TEXT_FIT_FAILURE: SeededQa = {
  check: 'text_fit',
  outcome: 'fail',
  severity: 'blocking',
  details: { overflowingElements: ['headline'] },
};

/** A configuration whose catalogue marks `liga-manual` (bound to `manual-a`) as having no accepted public source. */
export function markedManualConfig(marked = true): AppConfig {
  return testConfig({
    catalogue: {
      links: [
        {
          id: 'liga-manual',
          name: 'Liga Manual',
          bindings: [{ sourceId: 'manual-a', competitionRef: 'liga-manual' }],
          ...(marked ? { noAcceptedPublicSource: true } : {}),
        },
      ],
    },
  });
}

/** The same configuration with another manual-approval publication policy (PD-17). */
export function withManualPolicy(config: AppConfig, policy: 'allowed_without_accepted_source' | 'blocked'): AppConfig {
  return { ...config, verificationPolicy: { ...config.verificationPolicy, manuallyApprovedPublication: policy } };
}
