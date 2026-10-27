# WI-1 Architecture: El Deporte Rey GT AI sports-content platform (MVP)

- Author: architect (task WI-1-T09). Date: 2026-10-27. Mode: full (greenfield system: new subsystems, new trust boundaries to sports-data and AI providers, new persistence model).
- Companion documents in this directory: `architecture-delta.md` (template structure: contract, data and security deltas, decisions AD-01 to AD-20, test strategy, unresolved issues), `data-model.md` (persistence), `contracts/http-api.openapi.yaml` (proposed HTTP contract), `contracts/provider-ports.md` (internal provider and stage interfaces, fixture formats), `provider-research-plan.md` (PD-01 and PD-12 research deliverable plan), `task-plan.md` (tasks T12 to T53).
- Inputs: `docs/work-items/WI-1/requirements.md` and `requirements.json` (records R-001 to R-426); `.orchestrate/source-of-truth.md` sections 3 to 5 (PD-01 to PD-09, BR-01 to BR-11, SC-01 to SC-04); tracker Decisions OD-01 to OD-12.
- Revision T11G (architect, 2026-10-27): PD-12 (football-data.org API v4 as preferred primary provider, credentials), PD-13 (data acquisition modes LIVE_DATA, MANUAL_DATA, DEMO_DATA; manual import; statuses VERIFIED, UNVERIFIED, MANUALLY_APPROVED) and PD-14 (dynamic multi-competition platform; provider-neutral domain) applied incrementally, with tracker decisions OD-16 to OD-22, requirement records R-011 to R-014, R-053 to R-077, R-118 to R-141, R-243 to R-291, R-312 to R-319, R-429 to R-440, and the open Product Owner items E-09 to E-12. Changed sections: 1, 3, 4, 5, 6, 7, 8.1, 8.2, 9, 10, 11.1, 12, 13; new section 15. Decisions AD-21 to AD-34 in `architecture-delta.md` section 11.5.
- Requirement IDs are cited as `R-nnn`; decision IDs as `PD-nn` (Product Owner), `OD-nn` (Orchestrator), `AD-nn` (architecture decisions of this work item, defined in `architecture-delta.md` sections 5 and 11.5).

## 1. Overview

A single-operator, local-first web application (PD-05, R-100). One Node.js server process, bound to the loopback interface only, serves the web UI and a JSON HTTP API, runs the content workflow in process, keeps its data in one SQLite file plus a local data directory, and calls external providers only through configured adapters. In development and in every test of the default suite the providers are synthetic fixtures and stubs (PD-01, SC-04, R-110, R-241, R-257).

Data acquisition modes (PD-13, T11G): every configured sports-data source has one mode. LIVE_DATA sources retrieve from an external provider (the first adapter is FootballDataProvider for football-data.org API v4, PD-12); MANUAL_DATA is operator-supplied data imported from JSON or CSV files or entered in a web form (ManualDataProvider); DEMO_DATA is deterministic synthetic fixtures (FixtureDataProvider), the default of the development and test configurations. All three adapters sit behind one ingestion port and produce the same validated, provider-neutral domain representation, so every downstream stage is independent of mode, provider and competition (R-059, R-118). The platform is multi-competition (PD-14): the catalogue of competitions, seasons, stages and matchdays is discovered from the enabled sources at run time; no competition is fixed in code (R-139).

```
+-------------------- operator machine (loopback only) ----------------------------------+
|                                                                                         |
|  Browser (React UI) --HTTP 127.0.0.1:4300--> Server process (Fastify)                   |
|                                               |  platform/http  (loopback, Host,        |
|                                               |                  Origin, CSP, problems)  |
|                                               |  modules/*      (routes + stages)        |
|                                               |  workflow       (in-process runner)      |
|                                               |  platform/db    (node:sqlite) --> data/edr.sqlite
|                                               |  files          --> data/renders, data/exports,
|                                               |                     data/brand-assets     |
|                                               |  providers/sports --(egress allow-list)--+--> LIVE_DATA provider (HTTPS,
|                                               |    ingestion port: fixture | manual |   |    only when enabled; first:
|                                               |    football-data adapters            |    api.football-data.org)
|                                               |  files          --> data/imports (originals)
|                                               |  providers/ai     --(egress allow-list)--+--> AI provider (optional)
+-----------------------------------------------------------------------------------------+
```

Workflow (the five "agents" of S-000 are product stages, R-302): research -> verification -> content -> rendering -> visual QA, then operator review, per-item approval, final approval and export. Only the content stage uses AI (AD-08); research, verification, rendering and visual QA are deterministic code (AC-04, R-036).

## 2. Technology stack

Decided in AD-01 to AD-07 and AD-16 (`architecture-delta.md` section 5). Versions follow the pinning policy in section 2.2.

| Concern | Choice | Notes |
|---------|--------|-------|
| Language | TypeScript (strict mode) for server, web, shared contracts, tests | One language end to end; shared runtime schemas (R-105) |
| Runtime | Node.js, an LTS line, version 24 or later | Already required on the host by the framework CLI; no new host installation. `node:sqlite` needs no flag on these lines |
| Package manager | npm workspaces (bundled with Node.js) | Workspaces `apps/server`, `apps/web`, `packages/contracts` |
| HTTP server | Fastify (current stable major) | Plugins used: static files only (`@fastify/static`). No session, cookie or CORS plugin |
| Runtime validation | Zod (current stable major) | API DTOs in `packages/contracts`; provider payloads and stage I/O in their modules |
| Persistence | SQLite through the Node.js built-in `node:sqlite` (`DatabaseSync`) | Hand-written SQL migrations; no ORM (AD-05) |
| Slide rendering | Satori (layout to SVG) and `@resvg/resvg-js` (SVG to PNG), text measurement with `opentype.js`, bundled OFL fonts | Deterministic, no browser at run time (AD-07) |
| Web UI | React (current stable major), React Router, Vite | Plain CSS modules; no global state library |
| AI access | Provider port with a stub adapter and an OpenAI-compatible chat-completions HTTP adapter | Uses the platform `fetch`; no vendor SDK (AD-08) |
| Unit, integration, contract tests | Vitest (projects `unit`, `integration`, `contract`) | Network guard in the shared setup (R-241) |
| End-to-end and accessibility tests | Playwright test runner with `@axe-core/playwright`, Chromium downloaded project-locally | `.cache/ms-playwright`, git-ignored (AD-16) |
| Lint and format | ESLint (flat config) with typescript-eslint; Prettier check | |
| Dependency audit | `npm audit --audit-level=high` | Needs registry access at gate time |
| OpenAPI tooling (contract tests) | One OpenAPI 3.1 parser/validator library chosen by T20 (for example `@readme/openapi-parser`) plus Ajv for response validation | Dependency choice is MED-02 at T15 |

### 2.1 Dependency set

The scaffolding tasks (T15, T16) add the full dependency set once, so that later tasks never change `package-lock.json` in parallel. A later need for a new dependency is an escalation (MED-02, re-plan MED-05).

| Workspace | Runtime dependencies | Development dependencies |
|-----------|----------------------|--------------------------|
| root (T15) | - | typescript, eslint, typescript-eslint, @eslint/js, prettier, vitest, jsdom, @testing-library/react, @testing-library/user-event, @playwright/test, @axe-core/playwright, @types/node |
| `packages/contracts` (T15) | zod | - |
| `apps/server` (T15) | fastify, @fastify/static, zod, satori, @resvg/resvg-js, opentype.js (pino comes with Fastify) | the OpenAPI parser, ajv |
| `apps/web` (T16) | react, react-dom, react-router | vite, @vitejs/plugin-react, @types/react, @types/react-dom |

### 2.2 Exact-version pinning policy

- Every dependency in every `package.json` is an exact version: no `^`, `~`, ranges, dist-tags, Git or URL specifiers. The root `.npmrc` sets `save-exact=true`, `engine-strict=true` and `ignore-scripts=true` (no install-time script runs; every chosen package works without one: esbuild, Rollup and resvg ship platform binaries as optional packages, and `node:sqlite` needs no native addon).
- `package-lock.json` is committed; installs use `npm ci` only.
- The Node.js version is pinned exactly in `.nvmrc` and in the root `engines.node` field. The scaffolding task records the LTS version installed on the host (24 or a later LTS line). If the host has no such version, the task stops and escalates (reason: environment); nothing is installed on the host (`local-environment.md`).
- For each dependency the scaffolding task selects the latest stable release of the major line current at scaffold time, then requires `npm audit --audit-level=high` to exit 0. Pre-1.0 packages (for example Satori) are pinned exactly and upgraded only by a task.
- Each dependency added is a MEDIUM decision `MED-02` recorded by the Orchestrator; T26 records the exact versions in the source of truth section 1.
- Fonts: OFL-licensed font files are committed under `assets/fonts/` with their licence text (T34). They are provisional until the Product Owner supplies brand fonts (OD-07, R-418).

## 3. Repository layout and module boundaries

```
package.json, package-lock.json, .npmrc, .nvmrc, tsconfig.base.json, tsconfig.json,
eslint.config.mjs, .prettierrc.json, .prettierignore, vitest.config.ts, vitest.setup.ts,
.gitignore, .env.example, README.md, docs/local-setup.md
config/                     committed, non-secret configuration (R-226); no competition list (PD-14)
  app.config.json           sources (mode, adapter, role, acceptance), ports, format, publication mode,
                            verification policy, display settings; DEMO_DATA and MANUAL_DATA by default
  live.config.json          example LIVE_DATA configuration (football-data adapter options, no secret; T49)
  catalogue.json            optional competition links across sources, reference markers, optional
                            restrictions (AD-23); replaces the T09 competitions.json
  brand.json                provisional palette, fonts, brand name and handle (OD-07)
  languages.json            selectable content languages, default es (OD-11)
  team-identities/          team identity maps per competition and season where configured (AD-18)
contracts/http-api.openapi.yaml   declared HTTP contract (promoted from this directory by T20)
packages/contracts/src/     Zod schemas and TypeScript types mirroring the OpenAPI contract
apps/server/
  migrations/               numbered SQL migrations
  src/main.ts               process entry: config, data dir, database, migrations, listen on 127.0.0.1
  src/app.ts                buildApp(container): Fastify instance, platform plugins, module routes, UI
  src/container.ts          composition root (dependency injection by explicit construction)
  src/platform/config/      config schema and loader, catalog, languages, brand settings
  src/platform/net/         egress HTTP client (allow-list, timeouts, size caps)
  src/platform/format/      deterministic display formatting and per-language fixed template text
  src/platform/http/        loopback and Host guard, origin guard, security headers, problem+json
  src/platform/db/          Db port, node:sqlite adapter, migration runner, transactions
  src/providers/sports/     ingestion port, source registry, catalogue service (ingestion/), generic request
                            budget and projection cache (support/), adapters/{fixture,football-data,manual}
                            (contracts/provider-ports.md section 1)
  src/providers/ai/         AiTextProvider port, stub adapter, OpenAI-compatible adapter
  scripts/                  football-data capability probe (credential-safe; T49, run in T53)
  src/workflow/             WorkflowRunner, run and stage persistence
  src/modules/module-kit.ts ServerModule and Stage types (contracts/provider-ports.md section 3)
  src/modules/registry.ts   static list of module descriptors
  src/modules/projects/     projects, runs and drafts routes; catalogue routes
  src/modules/imports/      MANUAL_DATA import pipeline (JSON, CSV, form), versions, originals, routes
  src/modules/research/     research stage
  src/modules/verification/ verification stage, team identity, facts routes
  src/modules/content/      content stage: structure, AI drafting, placeholders, checks
  src/modules/brand/        brand asset registry and routes
  src/modules/rendering/    templates, text layout, renderer, template routes
  src/modules/visual-qa/    visual QA stage
  src/modules/review/       approval state machine, regeneration, final approval routes
  src/modules/export/       export, history and traceability routes
  test/integration/         API-level tests on fixtures (smoke, platform, verification, delivery)
  test/contract/            contract conformance tests
  test/support/             test helpers (temporary data dir, app factory, fixture config)
apps/web/src/
  app/ (shell, routes), api/ (client), ui/ (shared components, copy)
  features/projects, features/facts, features/review, features/history, features/brand, features/imports
packages/contracts/src/domain/  shared provider-neutral domain schemas (R-140, R-288)
fixtures/sports/<scenario>/ synthetic DEMO_DATA catalogues and selections per source (SC-04)
fixtures/football-data/     synthetic responses in the football-data.org v4 shape, with status and headers
fixtures/manual/            synthetic manual import samples (valid and invalid JSON and CSV)
fixtures/config/            generated-test configurations (provider identifiers live here, not in test code)
fixtures/ai/                synthetic AI stub responses
assets/fonts/               OFL fonts and licences
e2e/                        Playwright configuration, runner, journeys
data/                       runtime data (git-ignored): edr.sqlite, renders/, exports/, brand-assets/, imports/
```

Rules:
- Dependency direction: `modules/*` depend on `platform/*`, `providers/*` ports and `workflow`; `platform/*` depends on nothing in `modules`; `providers/*` depend only on `platform/net` and `platform/config`. A module never imports another module's internals; it uses the other module's exported functions from its `index.ts` or reads shared tables through its own repository.
- Each module directory is owned by one task; the module stubs and `module-kit.ts` created by T15 fix the seams so that module tasks run in parallel with disjoint files.
- No module other than `providers/*` performs network I/O. `modules/export` and `modules/imports` receive no egress client (R-219).
- Provider identifiers (T11G, R-139, AD-31): competition codes and IDs, provider hostnames and provider names appear only in `apps/server/src/providers/sports/adapters/**`, `apps/server/scripts/**`, `config/**` and `fixtures/**`; a lint rule fails on them anywhere else in `apps/**` and `packages/**`.

## 4. Components

| Component | Responsibility | Key requirements |
|-----------|----------------|------------------|
| platform/config | Load and validate `config/*.json` and environment variables at startup; refuse to start on an invalid configuration, including invalid data-mode settings (OD-20); expose sources (mode, adapter kind, role, acceptance, independence group, official publication, publication permission, enabled, opaque adapter options), catalogue links (`config/catalogue.json`), verification policy, languages, format (1080 x 1350, maximum slides per carousel), publication mode (`manual` only), display settings. No competition list and no provider identifier (T11G) | R-106, R-138, R-139, R-226, R-236, R-238, R-243, R-266 |
| platform/format | Deterministic display formatting of facts (scores, integers, dates with code month tables, official names, hashtag-safe names) and per-language fixed template text; the single source of fact display text for content, rendering and visual QA | R-035, R-036, R-052, R-310, R-426 |
| platform/net | `EgressClient`: HTTPS (or loopback HTTP to the configured AI origin only) to exact origins of configured provider base URLs; total deadline including the body; streaming cap on decoded bytes (512 KiB sports, 256 KiB AI, at most 2 MiB); `redirect: 'error'`; TLS never disabled; the only module allowed to open network connections (ESLint rule; `contracts/provider-ports.md` section 4) | R-222, AC-07, RK-07 |
| platform/http | Loopback binding, Host allow-list, origin and custom-header guard on mutating requests, security headers, problem+json errors, static UI | R-114, R-234, R-235, RK-13 |
| platform/db | SQLite connection (foreign keys on, WAL), migration runner, transactions, repository helpers | R-043, R-044, R-403 |
| providers/sports (ingestion) | One ingestion port (`IngestionSource`: competitions, seasons, stages, selection) and the shared domain validation; source registry (mode, role, acceptance, independence group, official publication, publication permission); catalogue service (merge of all enabled sources, links, selection and counterpart resolution); adapter registry (T11G, `contracts/provider-ports.md` section 1) | R-022, R-046, R-059, R-073, R-076, R-105, R-118, R-140, R-224, R-232, R-268, R-282, R-288 |
| providers/sports adapters | FixtureDataProvider (DEMO_DATA, synthetic multi-competition fixtures, no network); FootballDataProvider (LIVE_DATA: endpoint mapping, allow-list schemas, person data dropped, error classification, bounded retries, request budget from the rate-limit headers, projection cache, safe logging, credential from `FOOTBALL_DATA_API_TOKEN`); ManualDataProvider (MANUAL_DATA, reads the current import versions) | R-053, R-054, R-058, R-110, R-119, R-120 to R-136, R-141, R-241, R-244 to R-260, R-280 |
| modules/imports (T11G) | MANUAL_DATA import pipeline: JSON, CSV and form channels converted to one document; strict validation with every error reported; whole-import application; versions per selection; preserved originals; routes for imports, originals and versions | R-057, R-060 to R-069, R-119, R-273 to R-280, R-434, R-435 |
| providers/ai | `AiTextProvider` port; stub (deterministic, fixture-driven) and OpenAI-compatible adapter (base URL, model identifier and timeout from configuration; key from environment) | R-106, R-223, R-401 |
| workflow | In-process runner: one active run per project; stages in order; stage status persisted (pending, running, completed, failed, skipped) with reason; interrupted runs failed at startup; run kinds `full` and `redraft` | R-023, R-104, R-203 |
| modules/projects | Catalogue routes (competitions, seasons, stages, sources with availability and listing provenance); create, list, open projects from a catalogue selection with the data source and mode recorded; language; start runs; start redrafts; run status | R-020, R-051, R-056, R-072, R-076, R-200, R-236, R-243, R-269, R-282 to R-287, R-291 |
| modules/research | Retrieve the selection from the project's chosen source through the ingestion port only; record every retrieval and the attributed observations with source, mode, import version and retrieval time; record standings availability | R-022, R-024, R-202, R-204, R-254, R-268, R-287 |
| modules/verification | Two-source rule, disputes, official-publication consultation (counterparts resolved through the catalogue), team identity and official names; statuses VERIFIED, UNVERIFIED with reason, MANUALLY_APPROVED (OD-17) and candidate values; manual approval of eligible MANUAL_DATA facts; publishability per the configured policies; facts API | R-025, R-045 to R-048, R-055, R-070, R-071, R-205, R-227, R-229, R-230, R-256, R-270 to R-272, R-423, R-424, R-426 |
| modules/content | Deterministic carousel structure (split, exclusions, standings slides only when the selection has standings, candidate values drafted and blocked); AI drafting of headlines, descriptions, caption, hashtags through fact placeholders; deterministic substitution; content checks; provenance segments with fact status | R-004, R-026, R-027, R-028, R-029, R-051, R-052, R-077, R-207, R-208, R-209, R-236, R-237, R-254, R-255, R-285, R-407 |
| modules/brand | Brand asset registry (brand logo, mascot, decoration; PNG or JPEG only); badge kinds not registrable in the MVP | R-033, R-034, R-049, R-050, R-228, R-231 |
| modules/rendering | Versioned templates (cover, match result with empty badge slots, standings, closing) without competition assumptions; carousels with or without standings; demonstration label band; deterministic text layout; render model; PNG rendering; template registry and preview routes | R-030 to R-036, R-211 to R-213, R-231, R-238, R-269, R-285 |
| modules/visual-qa | Deterministic checks per slide: data match, team names, text fit, style consistency, dimensions | R-037, R-214, R-237, R-238, R-420 |
| modules/review | Element-version approval state machine; blocking by facts, flags and QA; regeneration; final approval | R-026, R-039, R-040, R-206, R-207, R-216, R-217, R-240, R-405, R-406 |
| modules/export | Export of approved carousels to local files; history; traceability | R-041 to R-044, R-216, R-218 to R-221, R-421 |
| apps/web | Operator UI: catalogue selection (competition, data source, season, matchday or stage) without assuming one format, projects with data mode and demonstration label, run progress, facts with statuses and provenance, manual approval of eligible facts, manual import pages, review and approval, export, history, traceability, brand and templates | R-020, R-038, R-077, R-200, R-215, R-235, R-243, R-269, R-274, R-283, R-284 |

## 5. Configuration and providers

### 5.1 Configuration files and environment

- `config/app.config.json` (committed, validated by a Zod schema that rejects unknown keys and any key whose name looks like a secret, for example `apiKey`, `token`, `secret`, `password`): server host (must be a loopback address; the schema accepts only `127.0.0.1`), port, explicit Host and Origin allow-lists (section 12.1), data directory, display UTC offset (default -360 minutes, `America/Guatemala`, which has no daylight saving time), format (`width` 1080, `height` 1350, `maxSlidesPerCarousel`), `publicationMode` (enum with the single value `manual`), standings rows per slide, provider selection.
- Provider selection and data modes are configuration only (R-056, R-106, R-223). The default `config/app.config.json` (development) enables DEMO_DATA and MANUAL_DATA only (R-058, R-110):

```json
{
  "providers": {
    "sports": {
      "sources": [
        { "id": "demo-a", "name": "Synthetic source A", "mode": "DEMO_DATA", "enabled": true, "role": "primary",
          "accepted": true, "independenceGroup": "demo-a", "officialPublication": false,
          "publicationPermission": "not_applicable", "adapter": "fixture", "options": { "scenario": "default" } },
        { "id": "demo-b", "name": "Synthetic source B", "mode": "DEMO_DATA", "enabled": true, "role": "verification",
          "accepted": true, "independenceGroup": "demo-b", "officialPublication": true,
          "publicationPermission": "not_applicable", "adapter": "fixture", "options": { "scenario": "default" } },
        { "id": "manual", "name": "Operator import", "mode": "MANUAL_DATA", "enabled": true, "role": "primary",
          "accepted": false, "independenceGroup": "manual", "officialPublication": false,
          "publicationPermission": "not_applicable", "adapter": "manual", "options": {} }
      ]
    },
    "ai": { "adapter": "stub", "options": { "scenario": "default" } }
  },
  "verificationPolicy": { "manuallyApprovedPublication": "blocked",
                          "livePublicationPermissionRule": "every_supporting_source" },
  "catalogue": { "linksFile": "config/catalogue.json" }
}
```

- The LIVE_DATA example `config/live.config.json` (T49; selected with `EDR_CONFIG`) adds one source `{ "id": "football-data", "mode": "LIVE_DATA", "role": "primary", "accepted": true, "independenceGroup": "football-data", "publicationPermission": "unconfirmed", "adapter": "football-data", "options": { "baseUrl": "https://api.football-data.org/v4", "referenceCompetitionRefs": ["CL"], "requestsPerMinute": 10, ... } }` (options in `contracts/provider-ports.md` section 1.4). Provider identifiers live only in this file, in `config/catalogue.json` bindings and in the adapter (R-053, R-139).
- Every source has exactly one mode, one role (`primary` or `verification`) and one adapter kind whose declared mode must equal the source's mode. Sources flagged `officialPublication` represent the competition organiser's publication (R-311); one may be the verification source. A source with `accepted: false` may be configured but never counts toward agreement (R-227, R-229); a MANUAL_DATA source must have `accepted: false` (R-071). Operators choose a project's source among the enabled `primary` sources bound to the competition (OD-16, R-431); verification-role sources are used by the verification stage through counterpart resolution (`contracts/provider-ports.md` section 1.2).
- `publicationPermission` (AD-28, R-430 design): `confirmed`, `unconfirmed` (default for every LIVE_DATA source) or `not_applicable` (DEMO_DATA and MANUAL_DATA). `verificationPolicy.manuallyApprovedPublication` (R-429 design): `blocked` (default; R-026 applies until the Product Owner decides), `allowed_labelled` (option a) or `allowed_without_accepted_source` (option c). `verificationPolicy.livePublicationPermissionRule`: `every_supporting_source` (default, option a of R-430) or `any_supporting_source` (option c). Either Product Owner answer is a configuration change.
- Startup validation (OD-20, R-127, R-266): the configuration schema rejects unknown keys and secret-like key names; an unknown mode, a mode that does not match the adapter, duplicate source IDs, a LIVE_DATA source without an `https:` `baseUrl`, an accepted MANUAL_DATA source, or no enabled primary source stops startup with an error naming the setting. Each enabled adapter then validates its own options and environment (`validateStartup`); with an enabled LIVE_DATA source using the football-data adapter, a missing or empty `FOOTBALL_DATA_API_TOKEN` stops startup with an error naming the variable, never its value. Without an enabled LIVE_DATA source the token is neither required nor read.
- Source independence at startup (OD-24, T11H-F13): two enabled sources with the same adapter kind and the same `options.baseUrl` origin must share one `independenceGroup` (one upstream counts once), and a catalogue link may not bind a DEMO_DATA source together with a LIVE_DATA or MANUAL_DATA source; either violation stops startup naming the sources or the link. The football-data adapter additionally refuses any `baseUrl` whose origin is not `https://api.football-data.org` (origin pinning, T11H-F03; `contracts/provider-ports.md` section 1.4).
- After building the injected environment, the composition root deletes `FOOTBALL_DATA_API_TOKEN` from `process.env` (T11H-F03); no script or documented setting enables Node diagnostic reports or heap snapshots.
- Egress allow-list: built from the `options.baseUrl` origins of the enabled sources and the configured AI adapter only; `https://api.football-data.org` is allowed only while an enabled LIVE_DATA source points to it (T10-F07, T10-F08).
- Secrets come only from environment variables (`EDR_AI_API_KEY`, `FOOTBALL_DATA_API_TOKEN`; T11G replaces the T09 naming `EDR_SOURCE_<ID>_API_KEY` by the PD-12 variable, AD-30), loaded from the git-ignored `.env.local` by `node --env-file-if-exists=.env.local`. `.env.example` lists `FOOTBALL_DATA_API_TOKEN=` and `EDR_AI_API_KEY=` with empty values (R-125, R-264). Secrets are never read into the configuration object and never written to the database, logs, evidence, test output, API responses, the browser bundle or exports (R-121 to R-124; section 9). The browser never calls a provider: the CSP `connect-src` is `'self'` and the settings route returns no base URL (R-123, R-262).
- Other environment variables: `EDR_CONFIG` (alternative config path; tests and e2e use generated configs in temporary directories, built from files under `fixtures/config/`), `EDR_DATA_DIR`, `EDR_PORT`, `EDR_LIVE_TESTS` (enables the optional live tests, never set by a gate).

### 5.2 Sports-data sources (R-400, PD-01, PD-12, PD-13)

- Port, domain representation and adapters: `contracts/provider-ports.md` section 1 (rewritten in T11G).
- Adapters: `fixture` (FixtureDataProvider, DEMO_DATA, T21), `football-data` (FootballDataProvider, LIVE_DATA, the first concrete provider adapter selected by PD-12, T49) and `manual` (ManualDataProvider, MANUAL_DATA, T50). FootballDataProvider and the manual input types are introduced only after the security review T11H and the Product Owner's isolation decision (SC-05, R-116).
- Every adapter returns `SelectionSnapshot` and listing items in the shared domain schema; the registry validates them with strict allow-list schemas. Unknown fields are dropped before anything is cached or stored (player-level and other person data never pass, R-112, R-119, R-232; the count of dropped fields, never their values, is logged). Structural violations (finished match without score, malformed date, unknown team key, duplicate position) reject the snapshot: the stage fails with a validation reason and nothing from that snapshot is stored (R-105, R-224).
- Competition context is structured and enumerated (`matchday_of_total`, `teams_in_table`, `matches_in_selection`; the T09 `qualification_zone` with competition-specific outcomes is removed, R-140); no free text from a provider reaches storage, the AI or the slides apart from competition, season, stage and team names validated by the name rules (AC-07).
- Two-source policy (PD-12, R-055): FootballDataProvider fills the primary role, not the verification role. Until a secondary accepted source is approved and configured (R-432), LIVE_DATA facts are UNVERIFIED with reason `awaiting_independent_verification`, never VERIFIED and never publication-approvable.

### 5.3 AI provider (R-401)

- Port: `contracts/provider-ports.md` section 2. Adapters: `stub` (returns fixture responses keyed by scenario and slide key, or a deterministic built-in draft that uses placeholders only) and `openai-compatible` (POST to `<baseUrl>/chat/completions` with a JSON-schema response format; base URL, model identifier, temperature and timeout from configuration; key from `EDR_AI_API_KEY` when the endpoint needs one). The adapter works with hosted providers after Product Owner authorization of any paid account (R-111) and with local model servers that expose the same protocol, which need no subscription.
- No model name is fixed by the design; the model identifier is a configuration value (R-106).

## 6. Workflow and stages

- Runner (`apps/server/src/workflow`): `startRun(projectId, kind)` creates a `workflow_runs` row and its `stage_runs` (pending), then executes stages sequentially in the same process. A `full` run executes research, verification, content, rendering, visual QA. A `redraft` run reuses the facts of the latest completed verification of the project and executes content, rendering, visual QA (used after a language change or a change of excluded matches). A second start while a run is active is refused (`RUN_IN_PROGRESS`).
- A stage failure stops the run: the stage is `failed` with a failure built from a closed code and sanitized parameters only (`{ code, sourceId, path, httpStatus }`, codes `unavailable`, `rate_limited`, `timeout`, `no_data`, `invalid`, `access_refused`, `not_available`, `bad_request`, `ai_response_invalid`, `interrupted`, `stage_not_available`, `run_superseded`, `internal`; never a provider body, an exception message, a credential or a file path; T10-F10), later stages are `skipped`, and the run is `failed`. The operator starts a new run (R-203, R-250). On startup, runs left `running` are marked `failed` with reason `interrupted`.
- Stage interface (`contracts/provider-ports.md` section 3): each stage has a Zod input schema, a Zod output schema and a pure core function that the tests call with fixture inputs in isolation (R-104, R-225); a thin wrapper loads inputs from and persists outputs to the database.

| Stage | Input | Output | Deterministic |
|-------|-------|--------|---------------|
| research | project selection (source ID, opaque `selection_ref`, labels) | validated `SelectionSnapshot` of the chosen source; retrieval record; observations; standings availability | yes |
| verification | project selection; research observations; counterparts in verification and official-publication sources | facts with status, unverified reason, candidate value, manual eligibility, evidence links, disputes; carried-over manual approvals | yes |
| content | facts view (verified values, candidate values and publishability); standings availability; language; exclusions; format; brand; data mode | draft: carousels, elements, element versions with text segments, fact references, flags | structure yes; text from AI, then checked |
| rendering | draft element versions; facts; templates; brand assets | render models and PNG files | yes |
| visual QA | render models; PNG metadata; facts; official names | QA results per slide and check | yes |

## 7. Verification pipeline (PD-02, BR-01 to BR-03, OD-10, OD-12)

### 7.1 Facts

Fact keys are stable within a run, for example `match:<matchKey>:teams`, `match:<matchKey>:kickoff`, `match:<matchKey>:status`, `match:<matchKey>:score`, `standings:row:<teamId>`, `context:<type>:<n>`. Every fact used in content is subject to the two-source rule (OD-10), not only scores, dates and standings. Statuses (T11G, OD-17, R-070, R-433): `verified` (two independent accepted sources agree); `unverified` with exactly one reason, `awaiting_independent_verification` (one accepted independence group has a value), `disputed`, `no_accepted_source` (includes MANUAL_DATA-only facts) or `team_identity_unmatched`; `manually_approved` (effective status of an eligible MANUAL_DATA fact with a current manual approval, section 7.4). Exactly one status per fact (R-270). Match statuses are the provider-neutral `scheduled`, `in_play`, `finished`, `postponed`, `suspended`, `cancelled`, `abandoned`, `awarded`.

| Fact kind | Value | Compared as |
|-----------|-------|-------------|
| `match_teams` | home and away canonical team IDs | identity equality after team matching |
| `match_kickoff` | kickoff date (UTC date and time) | equality of the UTC instant truncated to the minute |
| `match_status` | provider-neutral match status (above) | equality |
| `match_score` | home and away goals | equality of both numbers |
| `standing_row` | position, team, played, won, drawn, lost, goals for, goals against, goal difference, points | equality of every field |
| `matchday_info` | stage label, matchday number or null, total matchdays or null | equality |
| `context_item` | enumerated type and numeric parameters | equality |
| `team_official_name` | official display name | taken from the official-publication source when the team identity is verified (OD-12) |

### 7.2 Team identity (AD-18, OD-12, R-426)

- A team identity map per competition and season (`config/team-identities/<competition>-<season>.json`) lists canonical team IDs and, per source, the source's team key. Matching uses the map first; a team without a map entry is matched only when the normalized names (Unicode NFC, case-folded, diacritics removed, punctuation and the tokens listed in the map's `ignoreTokens` removed) are equal in both sources; otherwise the team is unmatched. Maps are optional (T11G): competitions discovered at run time usually have none, so name matching applies; within one source, the source's own team key identifies the team; canonical team IDs are slugs derived deterministically by the verification stage, and observations of an unmatched source key carry a mapped placeholder slug (T10-A1-06).
- Facts that involve an unmatched team are `unverified` with reason `team identity unmatched` (RK-14). There is no operator action that matches teams at run time (R-412 spirit); the map is configuration changed by a task.
- The official name of a team is the name given by the source flagged `officialPublication`, stored as fact `team_official_name` and verified when the team's identity is verified by two independent accepted sources. Every name form seen in any source is recorded as an alias for name-variant detection (section 8.3).

### 7.3 Decision rule (per fact key)

```
values = observations of accepted sources for the key, one per independence group (a group with
         several sources counts once; inside a group, differing values make the group "inconsistent"
         and the fact disputed). MANUAL_DATA observations are never accepted (R-071) and never count.
         DEMO_DATA observations count only for facts of DEMO_DATA projects; for LIVE_DATA and MANUAL_DATA
         projects they are never accepted values and never count toward agreement or independence
         (OD-24, T11H-F13; recorded as "consulted" at most).
if no accepted value:                               status unverified, reason no_accepted_source;
                                                    candidate value = the MANUAL_DATA value when the project's
                                                    source is MANUAL_DATA, else none
elif only one independence group has a value:       status unverified, reason awaiting_independent_verification
                                                    ("single source: <source>", R-055, R-271);
                                                    candidate value = that value
elif all groups agree:                              status verified, value, evidence = supporting observations
else (groups disagree):                             status unverified, reason disputed (no candidate value);
                                                    consult official publication:
    official observation for the key obtained (from the research or verification retrieval of the
    officialPublication source, or a dedicated consultation call when that source is not yet observed)
    if unavailable / no value:                        stays disputed, outcome "unavailable"
    elif official group equals a disagreeing group:   its value counts once; resolved only if another
                                                      independent accepted group supports the same value
    elif official value equals exactly one disagreeing value:
                                                      verified with that value (two independent accepted
                                                      groups support it); dispute record kept with outcome
                                                      "resolved"
    else (third value or ties):                       stays disputed, outcome "no_match"
```

- The dispute record stores the per-source values, the consultation (source, time, value or unavailability) and the outcome (R-048, R-230, R-423). A disputed or unverified fact can only change through a new run (re-run verification is allowed; manual verification is not: R-412). No API operation sets a fact status.
- Facts of unfinished, postponed or abandoned matches: `match_status` is verified as such; no `match_score` fact is required; the content stage leaves such matches out of the carousel and lists them with their status in the review view (OD-05, R-409).
- Optional consistency check (AC-04): standings recomputed from verified results of the season are compared when the fixture provides the season's results; a difference is a warning on the run, never a substitute for the two-source rule.
- Counterparts (T11G): the verification and official-publication sources are asked for the same selection through `catalogue.resolveCounterpart` (`contracts/provider-ports.md` section 1.2). A source bound to no link of the competition, or whose selection cannot be resolved, contributes no observation. With LIVE_DATA from football-data.org alone this yields `awaiting_independent_verification` for every fact until a secondary source is approved and linked (R-055, R-432); the design already lets such a source be added by configuration and an adapter. R-256 ("football-data.org vs verification fixture") is tested with a replay-backed LIVE_DATA test double in that role: a test-only adapter kind `test-live` registered through the `createSportsSources` test seam, with its own independence group and synthetic recorded-shape data (T41, T23, T52); a DEMO_DATA fixture source cannot fill the role because DEMO_DATA never confirms LIVE_DATA facts (OD-24).
- Standings unavailability is not a fact: research records `{ available: false, reason }` on the run, nothing is invented or derived (R-069, R-254), and the content stage builds no standings slide (section 8.1).

### 7.4 Manual approval and publishability (T11G; OD-17, R-071, R-272; AD-28)

- Manual eligibility, decided by the verification stage and stored on the fact: the project's data mode is MANUAL_DATA; the fact is `unverified` with reason `no_accepted_source` or `awaiting_independent_verification`; it is not `disputed` and not `team_identity_unmatched`; it has a candidate value; and no accepted source has a different value for it. LIVE_DATA, DEMO_DATA and disputed facts are never eligible (R-412).
- `approveFactManually` (contract) appends an `approved` row to `manual_approvals` for an eligible fact of the project's latest completed full run, in one `BEGIN IMMEDIATE` transaction; `revokeManualFactApproval` appends `revoked` and invalidates the final approvals of carousels that use the fact. Refusals use `MANUAL_APPROVAL_REFUSED` with a closed `refusalReason`. A MANUALLY_APPROVED fact is shown, stored, traced and exported as such, never as verified, and never counts toward agreement (R-071, R-272).
- Carry-over (R-068, R-278): when a new full run creates a fact whose key and candidate value equal those of a manually approved fact of the project's previous completed full run, the verification stage writes an `approved` row with `carried_over_from_fact_id`; a changed fact loses the status. Content approvals never carry over (new draft, R-406).
- Publishability, the single function used by the content blocking overlay, element approval and final approval (`modules/verification` exports it; T37 uses it):
  - `verified` without any LIVE_DATA supporting observation: publishable. `verified` with at least one LIVE_DATA supporting observation: under `every_supporting_source` (default) publishable only when every supporting LIVE_DATA source has `publicationPermission` `confirmed`; under `any_supporting_source` publishable only when at least one supporting source is `confirmed` or `not_applicable`; otherwise block reason `publication_permission_unconfirmed` (R-430 design; conservative default per R-136: API access is not permission to republish).
  - `manually_approved`: publishable only when `verificationPolicy.manuallyApprovedPublication` is `allowed_labelled`, or `allowed_without_accepted_source` and the competition has no enabled accepted source (block reason `manually_approved_not_publishable`). Default `blocked`: R-026 applies until the Product Owner answers R-429.
  - `unverified`: never publishable (block reason `not_verified`).
- Either answer to R-429 and R-430 is a configuration change (`architecture.md` section 5.1), with no change to schema, contract or stage code. Options a and c of R-429 call the content "labelled operator-attested": the review view always shows the status; an export label for MANUALLY_APPROVED content, if the Product Owner asks for one, is fixed template text through the same mechanism as the demonstration label (section 9).

## 8. Content generation and deterministic text (R-027, R-028, R-035, R-036, R-052, AD-11)

### 8.1 Carousel structure (deterministic, OD-03, OD-05)

- Included matches (amended in T11G): matches whose `match_status` is `finished` and whose `match_teams` and `match_score` are either verified or have a candidate value (single accepted source, or MANUAL_DATA), minus operator exclusions. Matches with any other status (including `awarded`, `suspended`, `cancelled`), disputed facts or no value are left out and listed with their status (OD-05, R-255). Content that uses a candidate value is drafted, previewed and checked like any other, and is blocked for approval until its facts are publishable (section 7.4; R-026, R-271, R-272, R-290).
- Slide order: cover (competition name, stage display text from `platform/format.stageDisplay`, and the season label); one match-result slide per included match in kickoff order (ties by home team official name or candidate name); standings slides only when the run's standings are available and their facts verified or candidate values (`standingsRowsPerSlide` rows each, default 12, covering every row the source gives; no fixed table size); closing slide. A selection without standings gets no standings slide and its draft records `standingsIncluded: false` (R-077, R-285); nothing is derived from match results (R-069).
- If the total exceeds `maxSlidesPerCarousel` (configuration, default set by T17 from Instagram's published specification at implementation time and recorded in the configuration), the slides are split into numbered carousels: each carousel gets its own cover ("1/2") and closing slide; match slides are distributed in order; standings slides go to the last carousel. One slide per match is kept (OD-03).

### 8.2 Fact placeholders

- The content stage gives the AI a data block with, per slide, the facts the slide shows and a placeholder token for each: `{{f:<factRef>}}` for a value (score, date, points, position, matchday number) and `{{t:<teamId>}}` for a team name. The block contains the display value next to each placeholder so that the AI can write meaningful commentary, and a fixed instruction: numbers and team names are written only as placeholders.
- The AI returns JSON (headline and description per slide key, caption, hashtags) validated against a Zod schema with length limits per field.
- Deterministic substitution replaces each placeholder with the deterministic display form of the fact's verified value, or of its candidate value when it has no verified value (`platform/format`: score `2-1`, date with the project's language month names from code tables, not `Intl`, at the configured display offset; team names exactly as the official name, or the candidate name for an unverified team). The resulting text is stored as segments: `commentary` segments (AI text), `template_text` segments and `fact` segments (substituted values, each with its fact ID). The API returns each `fact` segment with the fact's current status, so a segment is labelled "verified fact" only when its fact is verified, and UNVERIFIED or MANUALLY_APPROVED otherwise (T11G; OD-01, R-028, R-071).
- Hashtags: the deterministic hashtag-safe form of an official name (`#` + letters and digits of the official name with spaces and punctuation removed, diacritics kept) is allowed for team hashtags (R-426); other hashtags must match `^#[\p{L}\p{N}_]{1,60}$` and pass the checks below.

### 8.3 Content checks (deterministic, run on every element version)

| Flag | Rule | Blocks approval |
|------|------|-----------------|
| `UNKNOWN_FACT_REFERENCE` | a placeholder not in the slide's fact set | yes |
| `FORBIDDEN_CONTENT` (pre-check, T10-F05) | any `\p{Cc}` or `\p{Cf}` character (control, bidi control, zero-width) in AI text; checked before every other rule | yes |
| `UNVERIFIED_NUMBER` | after removing placeholders, on an NFKC-normalized copy: any `\p{N}` character (not only ASCII digits: fullwidth, other-script decimal digits, superscripts, subscripts, circled numbers, Roman-numeral characters); any cardinal number word up to at least 100, any ordinal word, any multiplier or collective number word ("doble", "triplete", "media docena", "hat-trick", "double", "treble", "dozen") in Spanish and English (word lists in code, T10-F05) | yes |
| `NON_OFFICIAL_TEAM_NAME` | any known alias of a team (all source name forms, the map's aliases) that is not identical to the official name, or a token sequence whose normalized form equals a normalized official name but whose exact form differs (translation, accent loss, abbreviation listed in the map); any mixed-script token (a token mixing Latin with another script, for example a Cyrillic homoglyph, in a Latin-script content language, T10-F05) | yes |
| `UNVERIFIED_FACT_IN_USE` | a referenced fact that is not publishable (section 7.4: not verified, manually approved under a blocking policy, or verified from a LIVE_DATA source without confirmed publication permission; computed at read and approval time, R-026, R-271, R-272) | yes (shown as "blocked", naming the facts and their block reasons) |
| `FORBIDDEN_CONTENT` | URLs, e-mail addresses, `@` mentions other than the configured brand handle, HTML or Markdown control sequences, text over the field limit | yes |
| `LANGUAGE_MISMATCH` | none; language is enforced by the request and by template text, not detected | - |

- A flagged element version can be regenerated; it cannot be approved (R-207, R-237).
- Residuals not caught by these deterministic checks (T10-F06): person names, venue names and misstated relations between correct values. With the stub AI they cannot occur; with a real model the fixed instruction forbids them, the result relation is given as a deterministic phrase, and human approval with provenance labels (BR-09, OD-01) is the final control. Before a real model or real sources are used, a deterministic warning flag for capitalized tokens outside the language word list, the alias table and the brand terms is to be added (a new flag: Orchestrator decision, MED-04) and TB-2 and TB-3 re-reviewed (follow-up to U-01).
- Fixed template text (slide titles, labels, "as of") comes from per-language tables in `platform/format` (R-310); content language is a project attribute (R-051, R-236).

## 9. Deterministic rendering (R-035, R-036, R-213, R-238, AD-07)

- Templates are versioned TypeScript modules in `modules/rendering/templates/`: `cover`, `match-result`, `standings`, `closing`. Each declares `id`, `version`, `slideType`, text boxes (position, size, font, size, colour role, maximum lines), image slots (brand logo, mascot: rendered only when an active registered asset of that kind exists, R-034) and badge slots (`team-badge-home`, `team-badge-away` on match results: always empty in the MVP because the brand registry cannot register badge assets; the layout is complete without them, R-050, R-231).
- Competition independence (T11G, PD-14): templates take the competition name, stage display text and season label as text from the draft; the standings template lays out any number of rows given to it (the content stage splits rows per slide); no template assumes a competition, a table size, a stage name or the presence of standings; a carousel without standings slides is complete (R-285).
- Demonstration label (T11G, OD-21, R-269, AD-33): every slide of a DEMO_DATA project carries a fixed template-text band "DEMOSTRACIÓN · datos sintéticos" / "DEMO · synthetic data" from `platform/format`, rendered deterministically like any other template text and recorded in the render model as a `demo_label` field; it cannot be removed by the operator.
- Colours: only palette roles from `config/brand.json` (provisional purple, gold, blue, white values, OD-07). Fonts: the bundled files.
- Text layout: `layoutText(text, font, size, boxWidth, maxLines)` measures glyph advances with `opentype.js` from the same font files and returns explicit lines and an `overflow` flag. Fact-bearing text (scores, team names, standings values, dates) is placed from verified facts directly; it never passes through AI text.
- Render model: a JSON document per slide version (template ID and version, canvas width and height, palette, fonts, and the list of elements with boxes, explicit lines, colours, fact IDs and image hashes). The renderer converts the render model to a Satori element tree (no React runtime on the server), Satori produces SVG, resvg produces PNG. Each text line is a separate non-wrapping node, so the layout measured is the layout rendered. Same render model + same template version + same fonts + same pinned library versions gives a byte-identical PNG; the tests assert identical numeric text (R-213) and identical PNG hashes.
- No external or host resources (T10-F09): image slots receive only `data:` URIs built from stored, verified asset bytes, never a URL or a file path; no `loadAdditionalAsset` callback is given to Satori; resvg runs with `font.loadSystemFonts: false`, `fontFiles` from `assets/fonts/` only and no resources directory. Text from the AI reaches Satori only as text content, and the SVG produced is well-formed: a test renders text containing `<`, `>`, `&`, `"`, `]]>` and `</text><image href=...>` and asserts a valid PNG and SVG with no added element; the renderer opens no socket (network guard test).
- Output: `data/renders/<projectId>/<elementVersionId>.png` (created with the exclusive flag); the hash, width and height are stored on the element version.
- Template change: a new template version applies to carousels generated afterwards; existing element versions keep the template version they were rendered with (R-211).

## 10. Visual QA (R-037, R-214, OD-09)

Deterministic checks per slide version, each recorded as a QA result:

| Check | Input | Failure | Severity (OD-09) |
|-------|-------|---------|------------------|
| `data_match` | render model text elements with fact IDs; facts from the database | text differs from the deterministic display form of the fact's verified value, or of its candidate value when unverified (score, standing, date; T11G) | blocking |
| `team_names` | team name elements; headline and description text | team name element differs from the official name; non-official variant in text | blocking |
| `text_fit` | render model; fonts | any text element overflows its box or line limit (re-measured, not trusted from the render model) | blocking |
| `style_consistency` | render models of the carousel | colours outside the palette, fonts outside the configured set, template versions differing within one carousel | warning (must be acknowledged before approval) |
| `dimensions` | PNG header | width and height differ from the configured format (default 1080 x 1350) | blocking |

The caption element has no image; its QA is the content checks of section 8.3.

## 11. Review, approval and export (BR-09, BR-11, OD-02, R-405, R-406)

### 11.1 Element-version state machine

```
                 render+QA done, no blocking failure
  pending_qa -----------------------------------------> ready --approve--> approved
      |                                                  ^  |                 |
      | blocking QA failure                              |  | withdraw        |
      v                                                  |  +<----------------+
  qa_failed                                              |
  (any state) --regenerate / new draft--> superseded; the element gets a new version in pending_qa
```

- `approve(elementId, versionId)` is accepted only when: the version is the element's current version (`VERSION_CONFLICT` otherwise); every referenced fact is publishable (section 7.4; `APPROVAL_BLOCKED`, naming each fact with status, unverified reason and block reason, R-206, R-271, R-272); no content flag (`CONTENT_FLAGGED`, R-207); no blocking QA failure (`QA_FAILED`); every warning acknowledged (`QA_ACK_REQUIRED`).
- "Blocked" is a derived overlay shown on any version whose referenced facts are not all publishable; it is recomputed at read and at approval time, so a revoked manual approval or a stricter policy blocks content again and invalidates final approvals that include it.
- Approvals are append-only rows bound to the exact element version (R-406). Regenerating a slide creates a new version of that element only (new AI text for that slide key, new render, new QA); the other elements keep their versions and approvals (R-217).
- Atomicity (T10-F15): each guard check and the write it protects (approval, withdrawal, acknowledgement, final approval, export record, supersession by regeneration or redraft) run in one synchronous `BEGIN IMMEDIATE` transaction on `DatabaseSync`, with no `await` inside, so a concurrent supersession cannot slip between check and write.

### 11.2 Carousel final approval and export

- Final approval of a carousel is accepted only when every element of the carousel (all included slides and the caption) has its current version approved and none is blocked (`FINAL_APPROVAL_REFUSED`, listing the items). It records the version set and its SHA-256 (R-240).
- A final approval is valid while the carousel's current version set equals the recorded set; any regeneration, new draft or research run makes it invalid (stored `invalidated_at`).
- Export requires a valid final approval (`FINAL_APPROVAL_REQUIRED`, R-216, R-240). It writes to `data/exports/<projectId>/<exportId>/`: `01.png` ... `NN.png` in carousel order (PNG, lossless, at the configured dimensions; R-218, R-421), `caption.txt` (UTF-8: caption, a blank line, hashtags separated by spaces), and `manifest.json` (project, carousel, final approval, data mode, `demonstration` flag, source IDs and names, per file: position, element version ID, SHA-256, fact IDs; T11G, R-269, R-287). Directory paths are built from validated UUIDs only, checked against `fs.realpath` of the data directory, and files are created with the exclusive flag.
- Export integrity (T10-F15): the export reads the version set from the final-approval row (never from the current versions), writes exactly those versions into a fresh export directory, then in one `BEGIN IMMEDIATE` transaction re-checks `invalidated_at IS NULL` and records the export; a failed commit leaves an orphan directory that history never references.
- No publication function exists: no API operation, module or adapter sends content to a social platform; `publicationMode` accepts only `manual`; the export module receives no egress client (R-042, R-219, BR-11).
- History: projects list with approval summary and last export time; an export can be reopened and shows the exported versions (R-043, R-220). Nothing is deleted (OD-08).
- Traceability: for any exported slide, the API returns the element version, its fact references, each fact's status, evidence observations (source, reference, retrieval time) and dispute record (R-044, R-221).

## 12. Local environment (PD-05, SC-02, R-100, R-108, R-114)

| Item | Value |
|------|-------|
| Host prerequisite | Node.js at the exact version in `.nvmrc` (an LTS line, 24 or later); nothing else on the host |
| Install | `npm ci` (no install scripts) |
| Development | `npm run dev`: API on `127.0.0.1:4300` (watch mode) and Vite on `127.0.0.1:5173` with `/api` proxied to the API; `strictPort` |
| Local use | `npm run build` then `npm start`: one process on `127.0.0.1:4300` serving UI and API |
| Verification ports (gate runs in the verify worktree) | e2e and accessibility app on `127.0.0.1:4310` |
| Demo port (PO acceptance in the demo worktree) | `127.0.0.1:4320` |
| Data | `data/` (git-ignored) or `EDR_DATA_DIR`; tests use temporary directories removed after the run |
| Browsers for e2e | Chromium downloaded on first e2e run into `.cache/ms-playwright` (git-ignored), never host-wide |
| External access | none with the default (DEMO_DATA, MANUAL_DATA and stub) configuration; with LIVE_DATA enabled (`EDR_CONFIG=config/live.config.json` and `FOOTBALL_DATA_API_TOKEN` in `.env.local`) only `https://api.football-data.org`; with a hosted AI provider only its configured host |
| Optional live checks (T11G) | `npm run test:live` (only with `EDR_LIVE_TESTS=1` and the token; skipped otherwise; at most 5 requests) and `npm run probe:football-data` (capability probe, run by the Orchestrator in T53 only when the Product Owner has placed the token in `.env.local`); neither is a configured gate (R-135, R-258) |

Binding: the server listens on `127.0.0.1` only (the configuration schema rejects other hosts); Vite `server.host` and `preview.host` are `127.0.0.1`. Changing the binding or adding remote access is a security-sensitive change (HIGH-03, AC-11).

### 12.1 Development mode (T10-F02)

- The API's Host and Origin allow-lists are explicit configured sets of exact `host:port` values and exact origins (`server.allowedHosts`, `server.allowedOrigins` in `config/app.config.json`), never derived from request headers and never containing `0.0.0.0` or a wildcard. Production (`npm start`): Hosts `127.0.0.1:4300`, `localhost:4300`; Origins `http://127.0.0.1:4300`, `http://localhost:4300`. Development (`npm run dev`) adds Hosts `127.0.0.1:5173`, `localhost:5173` and the matching Origins. Verification (`4310`) and demo (`4320`) configurations list their own port in the same way. The schema rejects a wildcard, `0.0.0.0` or a non-loopback host in either list.
- Fastify `trustProxy` stays `false`; `X-Forwarded-*` headers are ignored.
- The Vite `/api` proxy keeps `changeOrigin: false`, so the API sees and checks the browser's Host (`127.0.0.1:5173`) and Origin.
- Vite `server` and `preview`: `host` `127.0.0.1`; `strictPort`; `allowedHosts` never `true` (default or the two loopback names only); `cors` not widened (default); `fs.strict` `true`; `fs.deny` keeps Vite's default list (which covers `.env` and `.env.*`) and adds `data/**`; `envPrefix` stays `VITE_` and no secret uses it; `envDir` is `apps/web`, where no `.env.local` exists (T10-F11).
- The pinned Vite version has no known advisory of any severity at pin time. Because the `--audit-level=high` gate lets moderate advisories through, T15 and T16 check this explicitly (full `npm audit` advisory list and `npm ls vite`) and report it; T46 records it ([versions], [audit-full]).
- T16's unit test asserts these Vite settings; T19 and T41 test the development origin set (requests with the 5173 Host and Origin are accepted when configured, refused otherwise).

### 12.2 Host assumptions (T10-F19, T10-F11)

- A loopback listener accepts connections from every process of every OS account on the host, and possibly from containers or VMs sharing the host network namespace. The platform assumes a single-user workstation; `docs/local-setup.md` says not to run it on shared or multi-user hosts and to create `.env.local` with owner-only permissions (mode 0600). The data directory is created with mode 0700.
- This residual is within PD-05 (and RK-13); it is re-raised to the Product Owner (HIGH-03, identity model) before the platform runs on a shared or multi-user host, before a paid AI key or real provider credentials are configured, or before real non-public data is introduced.
- T11G note: PD-12 configures a real provider credential (`FOOTBALL_DATA_API_TOKEN`) once LIVE_DATA is enabled, which is one of the triggers above. With the token, a local process can make the server spend the token's free-plan request budget (no money: no purchase or upgrade is authorized, R-111), but cannot read the token (no route returns it). The Orchestrator includes this trigger in the T11H review and the Product Owner isolation decision (`architecture-delta.md` section 11.4, U-17).
- After T11H: the re-raise is open as escalation E-14 (reviewer recommendation: option A, confirm PD-05 for LIVE_DATA on a single-user workstation with a free-plan token, `.env.local` mode 0600, LIVE_DATA enabled only when needed, and the budget controls of T11H-F05 and T11H-F06). Until E-14 is decided, no real token is configured, T53 does not run the live probe, and no LIVE_DATA demonstration takes place. Option B (a per-launch secret header) would add a required request header to the contract, so E-14 is decided before T20 promotes `1.0.0` (`architecture-delta.md` section 11.12).

## 13. Extension points (R-102, R-226, R-109)

Competitions, seasons, stages and matchdays are data discovered from the configured sources (T11G; the T09 `config/competitions.json` is replaced by optional links in `config/catalogue.json`); the target format (dimensions, maximum slides) and publication mode are configuration; sources, data modes, publication policies and the AI adapter are configuration. A new provider is one adapter directory plus one registry line plus configuration (R-118). No stage contains a competition-specific, provider-specific, mode-specific, platform-specific or publication-specific branch (R-139, R-268). No extension is built beyond these configuration points (R-109, R-137): no plug-in system, no queue, no remote storage, no multi-user model, no bracket, aggregate-score or qualification logic (R-439).

## 14. Requirement to component traceability

The tracker's acceptance-criteria lines and the coverage table of `task-plan.md` map every acceptance criterion to tasks. Requirement records map to components through section 4 of this document; the end-to-end data trace (exported slide to source observation) is the chain `export_files -> element_versions -> element_fact_refs -> facts -> fact_evidence -> observations -> retrievals -> sources`, plus `disputes`, `manual_approvals` and, for MANUAL_DATA, `manual_selection_versions -> imports` (`data-model.md` section 6).

## 15. Data acquisition modes, catalogue and manual import (T11G; PD-12, PD-13, PD-14)

### 15.1 Modes

| Mode | Adapter | Source of data | Accepted for verification | Default use |
|------|---------|----------------|---------------------------|-------------|
| LIVE_DATA | FootballDataProvider (first; others later as adapters) | external provider over HTTPS, token from `FOOTBALL_DATA_API_TOKEN` | yes when configured `accepted` (football-data.org: primary role, R-053) | off by default; `config/live.config.json` |
| MANUAL_DATA | ManualDataProvider | operator imports (JSON, CSV, form) | never (R-071) | on in the default configuration |
| DEMO_DATA | FixtureDataProvider | committed synthetic fixtures | yes, but only for facts of DEMO_DATA projects (to exercise the two-source rule); never for LIVE_DATA or MANUAL_DATA facts, and never linked with such sources (OD-24) | default of development, tests and demonstrations (R-058) |

Each project records its source and mode (R-056, R-076); DEMO_DATA projects are labelled in the project list, the review view, on every slide and in the export manifest (OD-21, R-269).

### 15.2 Catalogue and selection (OD-16, R-073 to R-076, R-141)

- `GET /catalog/competitions` merges `listCompetitions` of every enabled source: provider competitions (one cached request per LIVE_DATA source, no per-competition request), MANUAL_DATA competitions from the imports, DEMO_DATA fixture competitions. Each entry lists its sources with availability; nothing is fixed in code; a competition appears or disappears with the source's response (R-282).
- Links (`config/catalogue.json`, optional): `{ "links": [ { "id", "name", "reference", "bindings": [ { "sourceId", "competitionRef" } ], "stageAliases"?: { "<sourceId>": { "<stage id>": "<canonical stage id>" } }, "selectableStages"?: [ ... ] } ], "restrictToLinks": false }`. A link groups the same competition across sources (for example a LIVE_DATA provider and a verification source); `reference` marks the initial validation scenario (listed first). Without links every source's competitions appear separately.
- Pending Product Owner confirmations: if C-1 (E-11) were answered "single competition", `restrictToLinks: true` with one link restores it; if C-3 (E-12) were answered "league phase only", `selectableStages` on the link restricts the stages. Both are configuration only; the default is the S-003 and S-004 reading.
- Seasons and stages are listed on selection (`listSeasons`, `listStages`), cached, and counted against the source's request budget; when the budget is exhausted the cached listing is returned with its retrieval time and `stale: true`, or `503 PROVIDER_RATE_LIMITED` with `retryAfterSeconds` when nothing is cached (R-141, R-291). Competition, source and season IDs are resolved only against the current listings; an unknown or no-longer-listed ID answers 404 without a provider request (T11H-F06). Research and verification have priority over discovery in each source's request queue (`contracts/provider-ports.md` section 1.4).
- Creating a project resolves the selection (competition, source, season, stage, matchday or whole stage) to the adapter's opaque `selection_ref` and snapshots the labels (AD-21, AD-24). A selection that the source refuses (subscription restriction, not found) is refused with `SELECTION_UNAVAILABLE` and the reason (R-075, R-286).

### 15.3 Manual import (R-057, R-060 to R-069, R-119, R-434, R-435)

- Channels: JSON file, CSV file (the exact file bytes sent base64-encoded as `contentBase64` inside the JSON request body, so the request stays `application/json` and passes the TB-1 guards unchanged; T11H-F01, AD-35), web form. All are converted to one `ManualImportDocument` and validated by one schema (R-060, R-319).
- Encoding and originals (T11H-F01): the browser reads the file with `arrayBuffer()` and never decodes it; the server decodes base64 strictly, checks 512 KiB of bytes, decodes UTF-8 with invalid sequences refused (`encoding_invalid`), ignores a leading BOM for parsing only, and preserves exactly the received bytes. The original's SHA-256 therefore equals the hash of the operator's file (R-277). Form entries are preserved as their canonical UTF-8 JSON serialization, size-checked before any write (T11H-F10).
- Integrity of what is applied (T11H-F08, F09): duplicate JSON member names and CSV team names that derive the same team key reject the import, so the applied data always equals what a reader of the preserved original sees.
- Originals are downloaded under a server-generated ASCII file name (T11H-F11); import errors and logs never contain imported values (T11H-F12).
- Parsing, limits, person-field rejection, semantic checks, whole-import application, versioning and original preservation: `contracts/provider-ports.md` section 1.6; storage: `data-model.md` section 3.5.
- Errors: `IMPORT_REJECTED` with every error (location, record, field, problem, message), at most 500 (R-061, R-274). Rejected imports are not stored (R-066).
- Structure (OD-18): a season contains stages; a stage has matchdays or is selected as a whole; standings are optional per selection; stages without standings are valid.
- Reimport (OD-19): every selection in an applied import becomes a new version; later research uses the current version; earlier versions and originals stay retrievable; changed facts lose MANUALLY_APPROVED (section 7.4).

### 15.4 LIVE_DATA operation

- FootballDataProvider details (endpoints, mapping, errors, retries, budget, cache, logging, probe): `contracts/provider-ports.md` section 1.4, including the T11H corrections: origin pinning of the token, bounded rate-limit headers, research priority with a discovery share, single-flight and bounded discovery waiters, catalogue IDs resolved without provider requests, the `X-Authenticated-Client` value treated as personal data, and a stage-discovery size override up to 2 MiB only on T53's measurements (Q8).
- Attribution references of LIVE_DATA evidence are provider-neutral (`source:<sourceId>/<resourceKind>@<retrievedAt>`); no API response carries a provider URL and the UI shows references as text only (T11H-F14).
- Preconditions (T11H): the SC-05 isolation decision E-13 before T49 and T50 start; the identity re-raise E-14 before a real token is configured, before T53's live run and before any LIVE_DATA demonstration (section 12.2).
- Research of a selection costs at most two requests (matches; standings when expected) plus retries; listing a season's stages costs one request; verification makes no provider request while football-data.org is the only LIVE_DATA source.
- LIVE_DATA facts are UNVERIFIED awaiting independent verification until a secondary accepted source is approved and linked (R-055, R-432); their content is drafted and previewed with the blocked overlay, and approval is refused naming each single-source fact (R-271). Republishing permission (R-430) is a separate configured gate on verified LIVE_DATA facts (section 7.4).
- Scores and schedules on the free plan are delayed by an unpublished amount (R-313): the UI shows retrieval times and never claims real-time data.
