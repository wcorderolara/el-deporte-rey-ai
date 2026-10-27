# WI-1 Architecture: El Deporte Rey GT AI sports-content platform (MVP)

- Author: architect (task WI-1-T09). Date: 2026-10-27. Mode: full (greenfield system: new subsystems, new trust boundaries to sports-data and AI providers, new persistence model).
- Companion documents in this directory: `architecture-delta.md` (template structure: contract, data and security deltas, decisions AD-01 to AD-20, test strategy, unresolved issues), `data-model.md` (persistence), `contracts/http-api.openapi.yaml` (proposed HTTP contract), `contracts/provider-ports.md` (internal provider and stage interfaces, fixture formats), `provider-research-plan.md` (PD-01 research deliverable plan), `task-plan.md` (tasks T12 to T48).
- Inputs: `docs/work-items/WI-1/requirements.md` and `requirements.json` (records R-001 to R-426); `.orchestrate/source-of-truth.md` sections 3 to 5 (PD-01 to PD-09, BR-01 to BR-11, SC-01 to SC-04); tracker Decisions OD-01 to OD-12.
- Requirement IDs are cited as `R-nnn`; decision IDs as `PD-nn` (Product Owner), `OD-nn` (Orchestrator), `AD-nn` (architecture decisions of this work item, defined in `architecture-delta.md` section 5).

## 1. Overview

A single-operator, local-first web application (PD-05, R-100). One Node.js server process, bound to the loopback interface only, serves the web UI and a JSON HTTP API, runs the content workflow in process, keeps its data in one SQLite file plus a local data directory, and calls external providers only through configured adapters. In development and in every automated test the providers are synthetic fixtures and stubs (PD-01, SC-04, R-110, R-241).

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
|                                               |  providers/sports --(egress allow-list)--+--> sports-data sources
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
config/                     committed, non-secret configuration and catalog data (R-226)
  app.config.json           providers, ports, format, publication mode, display settings
  competitions.json         competitions, seasons, phases, matchdays (league phase flagged)
  brand.json                provisional palette, fonts, brand name and handle (OD-07)
  languages.json            selectable content languages, default es (OD-11)
  team-identities/          team identity maps per competition and season (AD-18)
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
  src/providers/sports/     SportsDataSource port, payload schemas, fixture adapter, source registry
  src/providers/ai/         AiTextProvider port, stub adapter, OpenAI-compatible adapter
  src/workflow/             WorkflowRunner, run and stage persistence
  src/modules/module-kit.ts ServerModule and Stage types (contracts/provider-ports.md section 3)
  src/modules/registry.ts   static list of module descriptors
  src/modules/projects/     projects, runs and drafts routes
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
  features/projects, features/facts, features/review, features/history, features/brand
fixtures/sports/<scenario>/ synthetic provider payloads per source (SC-04)
fixtures/ai/                synthetic AI stub responses
assets/fonts/               OFL fonts and licences
e2e/                        Playwright configuration, runner, journeys
data/                       runtime data (git-ignored): edr.sqlite, renders/, exports/, brand-assets/
```

Rules:
- Dependency direction: `modules/*` depend on `platform/*`, `providers/*` ports and `workflow`; `platform/*` depends on nothing in `modules`; `providers/*` depend only on `platform/net` and `platform/config`. A module never imports another module's internals; it uses the other module's exported functions from its `index.ts` or reads shared tables through its own repository.
- Each module directory is owned by one task; the module stubs and `module-kit.ts` created by T15 fix the seams so that module tasks run in parallel with disjoint files.
- No module other than `providers/*` performs network I/O. `modules/export` receives no egress client (R-219).

## 4. Components

| Component | Responsibility | Key requirements |
|-----------|----------------|------------------|
| platform/config | Load and validate `config/*.json` and environment variables at startup; refuse to start on an invalid configuration; expose catalog (competitions, seasons, league-phase matchdays), languages, format (1080 x 1350, maximum slides per carousel), publication mode (`manual` only), display settings, provider selection | R-021, R-101, R-102, R-106, R-226, R-236, R-238, R-239 |
| platform/format | Deterministic display formatting of facts (scores, integers, dates with code month tables, official names, hashtag-safe names) and per-language fixed template text; the single source of fact display text for content, rendering and visual QA | R-035, R-036, R-052, R-310, R-426 |
| platform/net | `EgressClient`: HTTPS (or loopback HTTP for local AI servers) to hosts derived from configured provider base URLs only; per-request timeout; response size cap; no redirects to other hosts | R-222, AC-07, RK-07 |
| platform/http | Loopback binding, Host allow-list, origin and custom-header guard on mutating requests, security headers, problem+json errors, static UI | R-114, R-234, R-235, RK-13 |
| platform/db | SQLite connection (foreign keys on, WAL), migration runner, transactions, repository helpers | R-043, R-044, R-403 |
| providers/sports | `SportsDataSource` port; strict allow-list payload schemas (player-level fields dropped, malformed data rejected); fixture adapter; source registry with role, acceptance and independence group | R-022, R-046, R-105, R-110, R-112, R-224, R-232, R-241 |
| providers/ai | `AiTextProvider` port; stub (deterministic, fixture-driven) and OpenAI-compatible adapter (base URL, model identifier and timeout from configuration; key from environment) | R-106, R-223, R-401 |
| workflow | In-process runner: one active run per project; stages in order; stage status persisted (pending, running, completed, failed, skipped) with reason; interrupted runs failed at startup; run kinds `full` and `redraft` | R-023, R-104, R-203 |
| modules/projects | Create, list, open projects; language; start runs; start redrafts; run status | R-020, R-021, R-051, R-200, R-201, R-236, R-239 |
| modules/research | Retrieve the matchday from the primary source; store attributed observations | R-022, R-024, R-202, R-204 |
| modules/verification | Two-source rule, disputes, official-publication consultation, team identity and official names; facts API | R-025, R-045 to R-048, R-205, R-227, R-229, R-230, R-423, R-424, R-426 |
| modules/content | Deterministic carousel structure (split, exclusions); AI drafting of headlines, descriptions, caption, hashtags through fact placeholders; deterministic substitution; content checks; provenance segments | R-004, R-026, R-027, R-028, R-029, R-051, R-052, R-207, R-208, R-209, R-236, R-237, R-407 |
| modules/brand | Brand asset registry (brand logo, mascot, decoration; PNG or JPEG only); badge kinds not registrable in the MVP | R-033, R-034, R-049, R-050, R-228, R-231 |
| modules/rendering | Versioned templates (cover, match result with empty badge slots, standings, closing); deterministic text layout; render model; PNG rendering; template registry and preview routes | R-030 to R-036, R-210 to R-213, R-231, R-238 |
| modules/visual-qa | Deterministic checks per slide: data match, team names, text fit, style consistency, dimensions | R-037, R-214, R-237, R-238, R-420 |
| modules/review | Element-version approval state machine; blocking by facts, flags and QA; regeneration; final approval | R-026, R-039, R-040, R-206, R-207, R-216, R-217, R-240, R-405, R-406 |
| modules/export | Export of approved carousels to local files; history; traceability | R-041 to R-044, R-216, R-218 to R-221, R-421 |
| apps/web | Operator UI: projects, run progress, facts, review and approval, export, history, traceability, brand and templates | R-020, R-038, R-200, R-215, R-235 |

## 5. Configuration and providers

### 5.1 Configuration files and environment

- `config/app.config.json` (committed, validated by a Zod schema that rejects unknown keys and any key whose name looks like a secret, for example `apiKey`, `token`, `secret`, `password`): server host (must be a loopback address; the schema accepts only `127.0.0.1`), port, data directory, display UTC offset (default -360 minutes, `America/Guatemala`, which has no daylight saving time), format (`width` 1080, `height` 1350, `maxSlidesPerCarousel`), `publicationMode` (enum with the single value `manual`), standings rows per slide, provider selection.
- Provider selection is configuration only (R-106, R-223):

```json
{
  "providers": {
    "sports": {
      "sources": [
        { "id": "fixture-primary", "name": "Synthetic licensed API", "role": "primary", "accepted": true,
          "independenceGroup": "fixture-a", "adapter": "fixture", "options": { "scenario": "default" } },
        { "id": "fixture-official", "name": "Synthetic official source", "role": "verification", "accepted": true,
          "independenceGroup": "fixture-b", "adapter": "fixture", "options": { "scenario": "default" },
          "officialPublication": true }
      ]
    },
    "ai": { "adapter": "stub", "options": { "scenario": "default" } }
  }
}
```

- Every source has exactly one role (`primary` or `verification`); one source is flagged `officialPublication` (the competition organiser's publication, R-311); it may be the verification source. A source with `accepted: false` may be configured (for example for comparison) but never counts toward agreement (R-227, R-229).
- Secrets come only from environment variables (`EDR_AI_API_KEY`, and per real sports source `EDR_SOURCE_<ID>_API_KEY`), loaded from the git-ignored `.env.local` by `node --env-file-if-exists=.env.local`. `.env.example` documents the names with empty values. Secrets are never written to the database, logs, evidence, API responses or exports (section 9).
- Other environment variables: `EDR_CONFIG` (alternative config path; tests and e2e use generated configs in temporary directories), `EDR_DATA_DIR`, `EDR_PORT`.

### 5.2 Sports-data sources (R-400, PD-01)

- Port and payload schema: `contracts/provider-ports.md` section 1.
- MVP adapters: `fixture` only. Real adapters are added after the provider research (T13, T14) and the Product Owner's selection and authorization (R-111); see `architecture-delta.md` section 8.
- The adapter returns a `SourceMatchdaySnapshot`; the module validates it with strict allow-list schemas. Unknown fields are dropped before anything is stored (player-level data never passes, R-112, R-232; the count of dropped fields, never their values, is logged). Structural violations (finished match without score, malformed date, unknown team key, duplicate position) reject the snapshot: the stage fails with a validation reason and nothing from that snapshot is stored (R-105, R-224).
- Competition context is structured and enumerated (`matchday_of_total`, `qualification_zone`, `teams_in_league`); no free text from a provider reaches storage, the AI or the slides (AC-07).

### 5.3 AI provider (R-401)

- Port: `contracts/provider-ports.md` section 2. Adapters: `stub` (returns fixture responses keyed by scenario and slide key, or a deterministic built-in draft that uses placeholders only) and `openai-compatible` (POST to `<baseUrl>/chat/completions` with a JSON-schema response format; base URL, model identifier, temperature and timeout from configuration; key from `EDR_AI_API_KEY` when the endpoint needs one). The adapter works with hosted providers after Product Owner authorization of any paid account (R-111) and with local model servers that expose the same protocol, which need no subscription.
- No model name is fixed by the design; the model identifier is a configuration value (R-106).

## 6. Workflow and stages

- Runner (`apps/server/src/workflow`): `startRun(projectId, kind)` creates a `workflow_runs` row and its `stage_runs` (pending), then executes stages sequentially in the same process. A `full` run executes research, verification, content, rendering, visual QA. A `redraft` run reuses the facts of the latest completed verification of the project and executes content, rendering, visual QA (used after a language change or a change of excluded matches). A second start while a run is active is refused (`RUN_IN_PROGRESS`).
- A stage failure stops the run: the stage is `failed` with a reason (provider unavailable, rate-limited, timeout, validation error with path), later stages are `skipped`, and the run is `failed`. The operator starts a new run (R-203). On startup, runs left `running` are marked `failed` with reason `interrupted`.
- Stage interface (`contracts/provider-ports.md` section 3): each stage has a Zod input schema, a Zod output schema and a pure core function that the tests call with fixture inputs in isolation (R-104, R-225); a thin wrapper loads inputs from and persists outputs to the database.

| Stage | Input | Output | Deterministic |
|-------|-------|--------|---------------|
| research | project query (competition, season, matchday, phase `league`) | validated snapshot of the primary source; observations | yes |
| verification | query; research observations | facts with status, evidence links, disputes | yes |
| content | verified facts view; language; exclusions; format; brand | draft: carousels, elements, element versions with text segments, fact references, flags | structure yes; text from AI, then checked |
| rendering | draft element versions; facts; templates; brand assets | render models and PNG files | yes |
| visual QA | render models; PNG metadata; facts; official names | QA results per slide and check | yes |

## 7. Verification pipeline (PD-02, BR-01 to BR-03, OD-10, OD-12)

### 7.1 Facts

Fact keys are stable within a run, for example `match:<matchKey>:teams`, `match:<matchKey>:kickoff`, `match:<matchKey>:status`, `match:<matchKey>:score`, `standings:row:<teamId>`, `context:<type>:<n>`. Every fact used in content is subject to the two-source rule (OD-10), not only scores, dates and standings.

| Fact kind | Value | Compared as |
|-----------|-------|-------------|
| `match_teams` | home and away canonical team IDs | identity equality after team matching |
| `match_kickoff` | kickoff date (UTC date and time) | equality of the UTC instant truncated to the minute |
| `match_status` | scheduled, in_play, finished, postponed, abandoned | equality |
| `match_score` | home and away goals | equality of both numbers |
| `standing_row` | position, team, played, won, drawn, lost, goals for, goals against, goal difference, points | equality of every field |
| `matchday_info` | matchday number, total matchdays | equality |
| `context_item` | enumerated type and numeric parameters | equality |
| `team_official_name` | official display name | taken from the official-publication source when the team identity is verified (OD-12) |

### 7.2 Team identity (AD-18, OD-12, R-426)

- A team identity map per competition and season (`config/team-identities/<competition>-<season>.json`) lists canonical team IDs and, per source, the source's team key. Matching uses the map first; a team without a map entry is matched only when the normalized names (Unicode NFC, case-folded, diacritics removed, punctuation and the tokens listed in the map's `ignoreTokens` removed) are equal in both sources; otherwise the team is unmatched.
- Facts that involve an unmatched team are `unverified` with reason `team identity unmatched` (RK-14). There is no operator action that matches teams at run time (R-412 spirit); the map is configuration changed by a task.
- The official name of a team is the name given by the source flagged `officialPublication`, stored as fact `team_official_name` and verified when the team's identity is verified by two independent accepted sources. Every name form seen in any source is recorded as an alias for name-variant detection (section 8.3).

### 7.3 Decision rule (per fact key)

```
values = observations of accepted sources for the key, one per independence group (a group with
         several sources counts once; inside a group, differing values make the group "inconsistent"
         and the fact disputed)
if no accepted value:                               status unverified, reason "no accepted source"
elif only one independence group has a value:       status unverified, reason "single source: <source>"
elif all groups agree:                              status verified, value, evidence = supporting observations
else (groups disagree):                             status disputed; consult official publication:
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

## 8. Content generation and deterministic text (R-027, R-028, R-035, R-036, R-052, AD-11)

### 8.1 Carousel structure (deterministic, OD-03, OD-05)

- Included matches: matches with verified `finished` status and verified score, minus operator exclusions. Slide order: cover; one match-result slide per included match in kickoff order (ties by verified home team official name); standings slides (`standingsRowsPerSlide` rows each, default 12, covering all 36 rows); closing slide.
- If the total exceeds `maxSlidesPerCarousel` (configuration, default set by T17 from Instagram's published specification at implementation time and recorded in the configuration), the slides are split into numbered carousels: each carousel gets its own cover ("1/2") and closing slide; match slides are distributed in order; standings slides go to the last carousel. One slide per match is kept (OD-03).

### 8.2 Fact placeholders

- The content stage gives the AI a data block with, per slide, the facts the slide shows and a placeholder token for each: `{{f:<factRef>}}` for a value (score, date, points, position, matchday number) and `{{t:<teamId>}}` for a team name. The block contains the display value next to each placeholder so that the AI can write meaningful commentary, and a fixed instruction: numbers and team names are written only as placeholders.
- The AI returns JSON (headline and description per slide key, caption, hashtags) validated against a Zod schema with length limits per field.
- Deterministic substitution replaces each placeholder with the deterministic display form of the verified fact (`platform/format`: score `2-1`, date with the project's language month names from code tables, not `Intl`, at the configured display offset; team names exactly as the verified official name). The resulting text is stored as segments: `commentary` segments (AI text) and `verified_fact` segments (substituted values, each with its fact ID). This is the provenance label of OD-01 and R-028.
- Hashtags: the deterministic hashtag-safe form of an official name (`#` + letters and digits of the official name with spaces and punctuation removed, diacritics kept) is allowed for team hashtags (R-426); other hashtags must match `^#[\p{L}\p{N}_]{1,60}$` and pass the checks below.

### 8.3 Content checks (deterministic, run on every element version)

| Flag | Rule | Blocks approval |
|------|------|-----------------|
| `UNKNOWN_FACT_REFERENCE` | a placeholder not in the slide's fact set | yes |
| `UNVERIFIED_NUMBER` | after removing placeholders, any digit, or any cardinal number word 0 to 20 of the project language or English (word lists in code) | yes |
| `NON_OFFICIAL_TEAM_NAME` | any known alias of a team (all source name forms, the map's aliases) that is not identical to the official name, or a token sequence whose normalized form equals a normalized official name but whose exact form differs (translation, accent loss, abbreviation listed in the map) | yes |
| `UNVERIFIED_FACT_IN_USE` | a referenced fact that is not verified (computed at read and approval time, R-026) | yes (shown as "blocked", naming the facts) |
| `FORBIDDEN_CONTENT` | URLs, e-mail addresses, `@` mentions other than the configured brand handle, HTML or Markdown control sequences, text over the field limit | yes |
| `LANGUAGE_MISMATCH` | none; language is enforced by the request and by template text, not detected | - |

- A flagged element version can be regenerated; it cannot be approved (R-207, R-237).
- Fixed template text (slide titles, labels, "as of") comes from per-language tables in `platform/format` (R-310); content language is a project attribute (R-051, R-236).

## 9. Deterministic rendering (R-035, R-036, R-213, R-238, AD-07)

- Templates are versioned TypeScript modules in `modules/rendering/templates/`: `cover`, `match-result`, `standings`, `closing`. Each declares `id`, `version`, `slideType`, text boxes (position, size, font, size, colour role, maximum lines), image slots (brand logo, mascot: rendered only when an active registered asset of that kind exists, R-034) and badge slots (`team-badge-home`, `team-badge-away` on match results: always empty in the MVP because the brand registry cannot register badge assets; the layout is complete without them, R-050, R-231).
- Colours: only palette roles from `config/brand.json` (provisional purple, gold, blue, white values, OD-07). Fonts: the bundled files.
- Text layout: `layoutText(text, font, size, boxWidth, maxLines)` measures glyph advances with `opentype.js` from the same font files and returns explicit lines and an `overflow` flag. Fact-bearing text (scores, team names, standings values, dates) is placed from verified facts directly; it never passes through AI text.
- Render model: a JSON document per slide version (template ID and version, canvas width and height, palette, fonts, and the list of elements with boxes, explicit lines, colours, fact IDs and image hashes). The renderer converts the render model to a Satori element tree (no React runtime on the server), Satori produces SVG, resvg produces PNG. Each text line is a separate non-wrapping node, so the layout measured is the layout rendered. Same render model + same template version + same fonts + same pinned library versions gives a byte-identical PNG; the tests assert identical numeric text (R-213) and identical PNG hashes.
- Output: `data/renders/<projectId>/<elementVersionId>.png`; the hash, width and height are stored on the element version.
- Template change: a new template version applies to carousels generated afterwards; existing element versions keep the template version they were rendered with (R-211).

## 10. Visual QA (R-037, R-214, OD-09)

Deterministic checks per slide version, each recorded as a QA result:

| Check | Input | Failure | Severity (OD-09) |
|-------|-------|---------|------------------|
| `data_match` | render model text elements with fact IDs; facts from the database | text differs from the deterministic display form of the verified value (score, standing, date) | blocking |
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

- `approve(elementId, versionId)` is accepted only when: the version is the element's current version (`VERSION_CONFLICT` otherwise); every referenced fact is verified (`APPROVAL_BLOCKED`, naming each fact with status and reason, R-206); no content flag (`CONTENT_FLAGGED`, R-207); no blocking QA failure (`QA_FAILED`); every warning acknowledged (`QA_ACK_REQUIRED`).
- "Blocked" is a derived overlay shown on any version whose referenced facts are not all verified; it is recomputed at read and at approval time.
- Approvals are append-only rows bound to the exact element version (R-406). Regenerating a slide creates a new version of that element only (new AI text for that slide key, new render, new QA); the other elements keep their versions and approvals (R-217).

### 11.2 Carousel final approval and export

- Final approval of a carousel is accepted only when every element of the carousel (all included slides and the caption) has its current version approved and none is blocked (`FINAL_APPROVAL_REFUSED`, listing the items). It records the version set and its SHA-256 (R-240).
- A final approval is valid while the carousel's current version set equals the recorded set; any regeneration, new draft or research run makes it invalid (stored `invalidated_at`).
- Export requires a valid final approval (`FINAL_APPROVAL_REQUIRED`, R-216, R-240). It writes to `data/exports/<projectId>/<exportId>/`: `01.png` ... `NN.png` in carousel order (PNG, lossless, at the configured dimensions; R-218, R-421), `caption.txt` (UTF-8: caption, a blank line, hashtags separated by spaces), and `manifest.json` (project, carousel, final approval, per file: position, element version ID, SHA-256, fact IDs). Directory paths are built from generated IDs only and checked to stay under the data directory.
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
| External access | none with the default (fixture and stub) configuration; with real providers only to their configured hosts |

Binding: the server listens on `127.0.0.1` only (the configuration schema rejects other hosts); Vite `server.host` and `preview.host` are `127.0.0.1`. Changing the binding or adding remote access is a security-sensitive change (HIGH-03, AC-11).

## 13. Extension points (R-102, R-226, R-109)

Competition, seasons, phases and matchdays are catalog data (`config/competitions.json`); the target format (dimensions, maximum slides) and publication mode are configuration; sources and the AI adapter are configuration. No stage contains a competition-specific, platform-specific or publication-specific branch. No extension is built beyond these configuration points (R-109): no plug-in system, no queue, no remote storage, no multi-user model.

## 14. Requirement to component traceability

The tracker's acceptance-criteria lines and the coverage table of `task-plan.md` map every acceptance criterion to tasks. Requirement records map to components through section 4 of this document; the end-to-end data trace (exported slide to source observation) is the chain `export_files -> element_versions -> element_fact_refs -> facts -> fact_evidence -> observations -> sources`, plus `disputes` (`data-model.md`).
