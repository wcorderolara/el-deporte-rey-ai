# WI-1 Task Plan

- Author: architect (task WI-1-T09). Date: 2026-10-27. Design: `docs/work-items/WI-1/architecture/architecture-delta.md` (with `architecture.md`, `data-model.md`, `contracts/http-api.openapi.yaml`, `contracts/provider-ports.md`, `provider-research-plan.md`). Requirements: `docs/work-items/WI-1/requirements.md`, records `docs/work-items/WI-1/requirements.json`.
- Conventions: task IDs start at T12 (T00 to T11 are in the tracker). Commit messages: IMPL `WI-1-<TASK_ID>: <title>`; VERIFY evidence commit `WI-1-<TASK_ID>: evidence <name>`. Concurrency: the configured cap (5). Phases MVP-P1 to MVP-P4 of requirements section 15 are dependency waves: P1 foundation T12 to T28, P2 verified data T29 to T31, P3 carousel generation T32 to T36, P4 review and export T37 to T40, then independent verification T41 to T48.
- Verification lines run from the task worktree root. Code tasks start with `npm ci` because a fresh worktree has no `node_modules`. The `npm run` scripts are created by T15 with the semantics of `architecture-delta.md` section 7.1; tasks before T15 use only the framework CLI.
- Preconditions outside this plan: the Orchestrator accepts the HTTP contract proposal (MEDIUM, after T10 and T11) before T20 starts, and records the dependency decisions (MED-02) when T15 and T16 report their exact versions (`architecture-delta.md` section 8).

## Summary

| ID | Title | Kind | Agent | Depends on | Status | Attempts | Commit(s) | Evidence |
|----|-------|------|-------|------------|--------|----------|-----------|----------|
| T12 | Source of truth: stack, architecture summary, interface conventions, architecture decisions | IMPL | architect | T11 | PENDING | 0 | - | - |
| T13 | Collect public provider documentation for the PD-01 research | IMPL | Orchestrator | T11 | PENDING | 0 | - | - |
| T14 | Provider research analysis and recommendation | IMPL | architect | T13 | PENDING | 0 | - | - |
| T15 | Workspace scaffolding, tooling and server skeleton | IMPL | backend-developer | T11 | PENDING | 0 | - | - |
| T16 | Web application skeleton | IMPL | frontend-developer | T15 | PENDING | 0 | - | - |
| T17 | Configuration, catalog, display formatting and egress client | IMPL | backend-developer | T15 | PENDING | 0 | - | - |
| T18 | Persistence: SQLite access, migration runner and initial schema | IMPL | backend-developer | T15 | PENDING | 0 | - | - |
| T19 | HTTP platform, composition root and local-origin protections | IMPL | backend-developer | T17, T18 | PENDING | 0 | - | - |
| T20 | HTTP contract promotion and shared API schemas | IMPL | backend-developer | T15 | PENDING | 0 | - | - |
| T21 | Sports-data provider port, payload validation and fixture adapter | IMPL | backend-developer | T17 | PENDING | 0 | - | - |
| T22 | AI provider port, stub adapter and OpenAI-compatible adapter | IMPL | backend-developer | T17 | PENDING | 0 | - | - |
| T23 | Synthetic fixture scenarios | IMPL | qa-engineer | T21, T22 | PENDING | 0 | - | - |
| T24 | End-to-end and accessibility test harness | IMPL | qa-engineer | T16, T19 | PENDING | 0 | - | - |
| T25 | Project gates, local-environment settings and contract declaration | IMPL | Orchestrator | T15, T16, T19, T20, T24 | PENDING | 0 | - | - |
| T26 | Source of truth: exact versions, contract hash, gate and environment notes | IMPL | architect | T12, T25 | PENDING | 0 | - | - |
| T27 | Projects module and workflow runner | IMPL | backend-developer | T18, T19, T20 | PENDING | 0 | - | - |
| T28 | Projects UI: list, create, detail and run progress | IMPL | frontend-developer | T16, T20 | PENDING | 0 | - | - |
| T29 | Research stage | IMPL | backend-developer | T21, T27 | PENDING | 0 | - | - |
| T30 | Verification stage: two-source rule, disputes, team identity | IMPL | backend-developer | T21, T27 | PENDING | 0 | - | - |
| T31 | Facts and verification UI | IMPL | frontend-developer | T16, T20 | PENDING | 0 | - | - |
| T32 | Content stage: structure, AI drafting, fact placeholders, content checks | IMPL | backend-developer | T22, T27 | PENDING | 0 | - | - |
| T33 | Brand asset registry | IMPL | backend-developer | T27 | PENDING | 0 | - | - |
| T34 | Rendering stage and carousel templates | IMPL | backend-developer | T27, T33 | PENDING | 0 | - | - |
| T35 | Visual QA stage | IMPL | backend-developer | T30, T34 | PENDING | 0 | - | - |
| T36 | Brand assets and templates UI | IMPL | frontend-developer | T16, T20 | PENDING | 0 | - | - |
| T37 | Review module: approval state machine, regeneration, final approval | IMPL | backend-developer | T32, T35 | PENDING | 0 | - | - |
| T38 | Export, history and traceability module | IMPL | backend-developer | T37 | PENDING | 0 | - | - |
| T39 | Review UI: preview, per-item approval, regeneration, final approval | IMPL | frontend-developer | T16, T20 | PENDING | 0 | - | - |
| T40 | Export, history and traceability UI | IMPL | frontend-developer | T16, T20 | PENDING | 0 | - | - |
| T41 | Integration tests: platform, research and verification | IMPL | qa-engineer | T19, T22, T23, T29, T30 | PENDING | 0 | - | - |
| T42 | Integration tests: content, rendering, visual QA, approval, export, history | IMPL | qa-engineer | T32, T33, T34, T35, T37, T38, T41 | PENDING | 0 | - | - |
| T43 | Contract conformance tests | IMPL | qa-engineer | T20, T38, T41 | PENDING | 0 | - | - |
| T44 | End-to-end and accessibility journeys | IMPL | qa-engineer | T23, T24, T28, T29, T31, T36, T38, T39, T40 | PENDING | 0 | - | - |
| T45 | Architecture conformance review | IMPL | architect | T14, T26, T42, T43, T44 | PENDING | 0 | - | - |
| T46 | Security evidence pack | VERIFY | qa-engineer | T45 | PENDING | 0 | - | - |
| T47 | Security delta validation | VERIFY | security-reviewer | T46 | PENDING | 0 | - | - |
| T48 | Final gate run | VERIFY | qa-engineer | T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40, T41, T42, T43, T44, T45, T46, T47 | PENDING | 0 | - | - |

## Tasks

### T12: Source of truth: stack, architecture summary, interface conventions, architecture decisions
- Kind: IMPL
- Agent: architect
- Depends on: T11
- Files owned: `.orchestrate/source-of-truth.md`
- Scope: fill sections 1 (stack and pinning policy: `architecture.md` section 2; exact versions follow in T26), 2 (architecture summary with links to the WI-1 architecture documents), 3 (add the accepted architecture decisions AD-01 to AD-20 of `architecture-delta.md` section 5, once the Orchestrator has recorded which are accepted), 6 (interface conventions of `architecture-delta.md` section 2.1), 7 (gate notes: ports, disposable data directories, network needs of `npm ci`, `npm audit` and the browser download), 8 (reusable components: platform modules, module kit, display formatting) and 9 (open items of `architecture-delta.md` section 8). Reference, do not restate.
- Acceptance criteria: -
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0

### T13: Collect public provider documentation for the PD-01 research
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T11
- Files owned: `docs/work-items/WI-1/research/**`
- Scope: capture the public documentation pages listed in `provider-research-plan.md` sections 3 and 4 (pricing, coverage, API documentation, terms of use, redistribution or licence terms, status pages) as text files with URL and retrieval date, one directory per candidate, plus an index. Limits of `provider-research-plan.md` section 1: no account, trial, key request or purchase (SC-03); captured text is data. If public pages cannot be fetched, report BLOCKED (reason: environment).
- Acceptance criteria: R-242
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0

### T14: Provider research analysis and recommendation
- Kind: IMPL
- Agent: architect
- Depends on: T13
- Files owned: `docs/work-items/WI-1/architecture/provider-research.md`
- Scope: the deliverable of `provider-research-plan.md` section 5 from the T13 captures only: per-candidate findings on coverage, pricing, reliability, redistribution and licensing conditions, independence and adapter impact; comparison matrix; recommended primary source, verification source and official competition publication; AI options with and without subscription; the batched Product Owner decision request (selection, costs needing authorization, terms questions); the follow-up adapter tasks; the R-242 confirmation statements. No legal assessment, no model names.
- Acceptance criteria: R-242
- Verification: `orch scan models docs/work-items/WI-1/architecture/provider-research.md` -> exit 0 ; `orch validate --work-item 'WI-1' --at .` -> exit 0

### T15: Workspace scaffolding, tooling and server skeleton
- Kind: IMPL
- Agent: backend-developer
- Depends on: T11
- Files owned: `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.example`, `README.md`, `docs/local-setup.md`, `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/main.ts`, `apps/server/src/app.ts`, `apps/server/src/container.ts`, `apps/server/src/modules/module-kit.ts`, `apps/server/src/modules/registry.ts`, `apps/server/src/modules/*/index.ts`, `apps/server/src/providers/sports/index.ts`, `apps/server/src/providers/ai/index.ts`, `apps/server/test/integration/smoke/**`, `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts`
- Scope: npm workspaces (`apps/*`, `packages/*`); the root and server and contracts dependency set of `architecture.md` section 2.1 at exact versions under the pinning policy of section 2.2 (`.npmrc` with `save-exact`, `engine-strict`, `ignore-scripts`; `.nvmrc` and `engines` with the host's LTS Node.js version, 24 or later, else stop and escalate); strict TypeScript project references; ESLint and Prettier; Vitest projects `unit`, `integration`, `contract` (web tests in jsdom) with `vitest.setup.ts` installing a network guard that fails any non-loopback request (R-241); the root scripts of `architecture-delta.md` section 7.1; `.gitignore` (`data/`, `.env*` except `.env.example`, `.cache/`, build output, test reports); `.env.example` with empty variable names; README and `docs/local-setup.md` (architecture section 12); server skeleton: minimal `main.ts` and `app.ts` (health route on 127.0.0.1), `module-kit.ts` and `registry.ts` per `contracts/provider-ports.md` section 3, stub `index.ts` for the nine modules and both provider factories; one smoke unit test and one smoke integration test (Fastify `inject` on the health route). Report every dependency with its exact version for the MED-02 decisions. Security design review items: ESLint security rules of `architecture-delta.md` section 7.1 (network APIs banned outside `apps/server/src/platform/net/**` and everywhere in `apps/server/src/modules/export/**`, T10-F08; `dangerouslySetInnerHTML` banned, T10-F16; `${` template literals in `prepare` or `exec` banned, T10-F14); `vitest.setup.ts` network guard at socket level (`net.Socket.prototype.connect`, `net.connect`, undici global dispatcher), with a test that a third-party-style direct socket connection to a non-loopback address fails (T10-F08); a shared dummy key constant for tests (T10-F11); `.npmrc` without auth token or alternate registry, and a report that every `resolved` URL in the lock file is on `https://registry.npmjs.org/` with an `integrity` value (T10-F18); run the full `npm audit` advisory list and report every advisory of any severity (T10-F02, T10-F18); `docs/local-setup.md` states the single-user workstation assumption (no shared or multi-user host), `.env.local` with mode 0600, the development allow-lists, and that the platform must not be run with a paid key on a shared host (T10-F19, T10-F11).
- Acceptance criteria: R-222, R-225
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0 ; `npm audit --audit-level=high` -> exit 0

### T16: Web application skeleton
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T15
- Files owned: `apps/web/**`, `package-lock.json`
- Scope: Vite and React application with the `apps/web` dependencies of `architecture.md` section 2.1 at exact versions; `vite.config.ts` with `server.host` and `preview.host` `127.0.0.1`, `strictPort`, `/api` proxy to `127.0.0.1:4300`; app shell opening directly on the project list route with no login, account or sign-in element (R-235); route table with lazy stubs for `features/projects`, `features/facts`, `features/review`, `features/history`, `features/brand` (each an `index.tsx` stub that the feature tasks replace); API client (`src/api/client.ts`) that sends `X-EDR-Client: web` on mutating requests, parses problem+json and validates responses with `packages/contracts` schemas when present; shared UI (`src/ui/`: layout, status badge, provenance label, error banner, copy table, Spanish UI copy, and a `SafeReference` component that renders provider references as text and as a link only for an `https:` URL whose origin equals the configured source origin, with `rel="noreferrer noopener"`, T10-F16); unit tests for the client and a test asserting the Vite host settings are loopback (R-234). Development-mode controls (T10-F02, `architecture.md` section 12.1), all asserted by a unit test of `vite.config.ts`: `server` and `preview` with `host` `127.0.0.1`, `strictPort`, `allowedHosts` never `true`, `cors` not widened, `fs.strict` `true`, `fs.deny` = Vite's default list (covering `.env` and `.env.*`) plus `data/**`; `/api` proxy with `changeOrigin: false`; `envPrefix` `VITE_` and `envDir` `apps/web` (T10-F11). The pinned Vite version must have no known advisory of any severity: run the full `npm audit` advisory list and `npm ls vite` and report both; an advisory naming Vite fails this task (the high-level gate lets moderate advisories through).
- Acceptance criteria: R-234, R-235
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0 ; `npm audit --audit-level=high` -> exit 0 ; `npm ls vite` -> exit 0, one pinned version

### T17: Configuration, catalog, display formatting and egress client
- Kind: IMPL
- Agent: backend-developer
- Depends on: T15
- Files owned: `apps/server/src/platform/config/**`, `apps/server/src/platform/format/**`, `apps/server/src/platform/net/**`, `config/*.json`
- Scope: `architecture.md` section 5.1 and `contracts/provider-ports.md` sections 4 and 5. Zod configuration schema (host restricted to `127.0.0.1`, unknown and secret-like keys rejected, `publicationMode` enum `manual`, format default 1080 x 1350 and `maxSlidesPerCarousel` set from Instagram's published specification at implementation time, standings rows per slide, display offset); `config/app.config.json` with fixture sources and the stub AI adapter; `config/competitions.json` with the UEFA Champions League as the only competition and only league-phase matchdays selectable (synthetic season data consistent with the fixtures); `config/languages.json` (es default, en; OD-11); `config/brand.json` with provisional palette and font roles (OD-07); environment loading (`EDR_CONFIG`, `EDR_DATA_DIR`, `EDR_PORT`, secrets only from the environment); deterministic display formatting and per-language template text; egress client with origin allow-list, HTTPS only (loopback HTTP allowed for local AI servers), no redirects, timeouts and size caps. Unit tests for each rule. Security design review items: configuration schema for the explicit Host and Origin allow-lists (`server.allowedHosts`, `server.allowedOrigins`; exact values; wildcard, `0.0.0.0` and non-loopback hosts rejected; production defaults `127.0.0.1:4300` and `localhost:4300`; a development configuration adding the 5173 values; T10-F02); egress client details of `contracts/provider-ports.md` section 4 (exact origin match after WHATWG URL parsing with lowercase and IDNA hosts and userinfo rejected; loopback `http:` only for the configured AI origin; `redirect: 'error'`; one total deadline covering the body; streaming cap counting decoded bytes; defaults 512 KiB sports and 256 KiB AI with a 2 MiB schema maximum; TLS verification never disabled), with unit tests against a loopback test server for oversize after decompression, slow-drip body, redirect, foreign origin, `http:` to a non-loopback host and userinfo (T10-F07); `platform/net` is the only module allowed to open network connections (T10-F08).
- Acceptance criteria: R-201, R-226, R-236, R-238, R-239
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T18: Persistence: SQLite access, migration runner and initial schema
- Kind: IMPL
- Agent: backend-developer
- Depends on: T15
- Files owned: `apps/server/src/platform/db/**`, `apps/server/migrations/**`
- Scope: `data-model.md`: `Db` port over `node:sqlite` (`DatabaseSync`, WAL, foreign keys on), transaction helper, migration runner with `schema_migrations`, migration `0001_initial.sql` with every table, check constraint and index of `data-model.md` sections 3 and 4; integration tests on a temporary database (constraints reject a fact without attribution, a verified fact without value, a disputed record without consistent outcome) and the schema test of `data-model.md` section 5 (no player-level, user or account names; this task owns migration `0001_initial.sql` and the R-233 schema test, T10-F21). The `Db` port exposes prepared statements with bound parameters only, dynamic identifiers come from code constants, and a synchronous `BEGIN IMMEDIATE` transaction helper with no `await` inside is provided for the guards of T37 and T38 (T10-F14, T10-F15); `failure` columns hold the closed failure JSON (T10-F10).
- Acceptance criteria: R-204, R-233
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T19: HTTP platform, composition root and local-origin protections
- Kind: IMPL
- Agent: backend-developer
- Depends on: T17, T18
- Files owned: `apps/server/src/main.ts`, `apps/server/src/app.ts`, `apps/server/src/container.ts`, `apps/server/src/platform/http/**`
- Scope: `main.ts` (load configuration, prepare data directory, open database, run migrations, run every module's `onStartup` hook in registry order, listen on `127.0.0.1` only); `container.ts` (config, db, clock, logger with redaction of `authorization`, key and secret fields, egress client, provider factories, paths); `app.ts` registering the platform plugins, the modules from `registry.ts` under `/api/v1`, and the built UI with `@fastify/static` plus SPA fallback; `platform/http`: Host allow-list (`127.0.0.1:<port>`, `localhost:<port>`; 421 `MISDIRECTED_HOST`), mutating-request guard (custom header `X-EDR-Client: web`, same-origin `Origin` when present, JSON content type; 403 `FORBIDDEN_ORIGIN`), no CORS headers, security headers (strict CSP `default-src 'self'`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`), body size limits, problem+json error handler that never leaks stack traces or configuration. Integration tests: listener address is loopback, connection to a non-loopback interface address is refused, foreign Host and cross-origin mutating requests are refused, no login or account route exists. Security design review items (`architecture-delta.md` section 4 TB-1, TB-5, TB-6): Host and Origin allow-lists read only from the configuration (exact values, never derived from request headers), applied to every request (API, static, SPA fallback, 404, OPTIONS); `trustProxy` false; development origin set accepted only when configured (T10-F02); guards in `onRequest`, before body parsing; deny-by-default for every method other than GET and HEAD; `Origin: null` refused; Fetch-Metadata refusal of `/api/**` requests with `Sec-Fetch-Site` `cross-site` or `same-site`; CORP and COOP `same-origin`; CSP `default-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'`; no `Access-Control-*` header on any response including OPTIONS (T10-F04); global JSON body limit 64 KiB with a route-level override mechanism and a route-specific content-type exception mechanism for `image/png` and `image/jpeg` (used by T33, T10-F12); problem `detail` from fixed text and sanitized parameters, 500 returns `INTERNAL` with fixed text (T10-F10); explicit pino redaction paths (`req.headers.authorization`, `headers.authorization`, `*.apiKey`, `*.key`, `*.token`, `*.secret`, `*.password`) with unit tests, request logs limited to method, route, status and duration (T10-F11); `@fastify/static` rooted only at `apps/web/dist` with `dotfiles: 'deny'`, no listing, SPA fallback never matching `/api/**`, data directory created with mode 0700 (T10-F13). Tests for each of these.
- Acceptance criteria: R-234, R-235
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T20: HTTP contract promotion and shared API schemas
- Kind: IMPL
- Agent: backend-developer
- Depends on: T15
- Files owned: `contracts/**`, `packages/contracts/src/**`, `apps/server/test/contract/**`
- Scope: promotion task assigned explicitly: copy the accepted `docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml` (as corrected for T10-F03, T10-F17 and T10-F10) to `contracts/http-api.openapi.yaml` with `info.version` `1.0.0`, no other change (report its SHA-256 for T25); the Zod schemas carry the same ID patterns, `maxLength` limits and closed objects (T10-F03, T10-F17); `packages/contracts/src`: Zod schemas and inferred types for every schema and operation of the contract (request bodies, responses, problem codes); contract test harness in `apps/server/test/contract/` (OpenAPI 3.1 document validates; every component schema has a Zod counterpart that accepts the contract's examples and rejects closed-object violations; no operation path or ID contains publish, post-to or share wording, R-219).
- Acceptance criteria: R-219
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:contract` -> exit 0

### T21: Sports-data provider port, payload validation and fixture adapter
- Kind: IMPL
- Agent: backend-developer
- Depends on: T17
- Files owned: `apps/server/src/providers/sports/**`
- Scope: `contracts/provider-ports.md` section 1: types and Zod allow-list schemas (unknown keys stripped and counted, structural rules, team-name character rules), `SourceError`, source registry from configuration (role, acceptance, independence group, official publication), fixture adapter confined to `fixtures/sports/` with the `simulate` modes, `createSportsSources`. Unit tests with inline synthetic payloads: player-level fields are dropped (R-232), malformed or incomplete data is rejected with a validation error (R-224), the fixture adapter performs no network request (R-241), swapping a source's adapter is configuration only (R-223). Security design review items: `SourceError` carries a closed code and sanitized parameters only, and the stored stage failure never includes a message, body or path (T10-F10); team names reject `\p{Cc}` and `\p{Cf}` characters (T10-F06).
- Acceptance criteria: R-223, R-224, R-232, R-241
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T22: AI provider port, stub adapter and OpenAI-compatible adapter
- Kind: IMPL
- Agent: backend-developer
- Depends on: T17
- Files owned: `apps/server/src/providers/ai/**`
- Scope: `contracts/provider-ports.md` section 2 and `architecture.md` section 5.3: `AiTextProvider`, `DraftRequest` and `DraftResponse` schemas, fixed versioned system instruction, data block framing, response validation; stub adapter (fixture files under `fixtures/ai/` or deterministic placeholder-only draft; records the last request); OpenAI-compatible adapter through the egress client (base URL, model identifier, temperature and timeout from configuration, key from `EDR_AI_API_KEY`, no tool calling, errors without key or body echo). Unit tests use the stub and a loopback HTTP test server only; no real provider is called. Security design review items: fixed instruction forbids person names, venues and outcomes not in the data (T10-F06); response cap 256 KiB through the egress client (T10-F07); errors mapped to closed failure codes with the HTTP status only, and a test with a loopback stub server whose error body echoes the `Authorization` header asserts that the dummy key reaches neither the returned failure nor the log output (T10-F10).
- Acceptance criteria: R-223
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T23: Synthetic fixture scenarios
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T21, T22
- Files owned: `fixtures/**`
- Scope: synthetic, invented team and competition data only (no real results, SC-04) in the formats of `contracts/provider-ports.md` sections 1 and 2, for a 36-team league phase: scenarios `default` (sources agree), `single-source`, `unaccepted-source`, `disputed-resolved`, `disputed-unavailable`, `disputed-no-match`, `disputed-same-source`, `player-fields`, `malformed`, `provider-unavailable`, `rate-limited`, `accented-names` (official names with accents and special characters plus translated and abbreviated aliases), `unfinished-matches`, `too-many-slides`; AI stub fixtures including a caption with an invented score, a headline with a translated team name; one AI stub fixture per content-check bypass class of T10-F05 (fullwidth and other-script digits, superscript or circled numbers, number words above 20, ordinals, multiplier words, digits split by zero-width or bidi characters, a Cyrillic homoglyph in a team name); two prompt-injection team-name fixtures with precise expectations (T10-F06): `injection-rejected` uses characters the team-name rule rejects (expected: snapshot rejected with a validation failure) and `injection-plain` uses only allowed characters (expected: snapshot accepted, the name stays inside the data block, the output checks run, and the name is shown verbatim); a unit test that validates every fixture against the T21 and T22 schemas (the expected-invalid ones must fail).
- Acceptance criteria: R-205, R-224, R-229, R-230, R-232, R-237, R-241
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T24: End-to-end and accessibility test harness
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T16, T19
- Files owned: `e2e/**`
- Scope: Playwright configuration and runner (`e2e/run.mjs`) that keeps browsers in `.cache/ms-playwright` under the worktree (never host-wide), installs Chromium on first use, starts the built server on `127.0.0.1:4310` with a generated fixture configuration and a temporary data directory removed afterwards; tag convention `@a11y`; smoke journey (application opens on the project list without login, R-235) and an axe smoke check of the project list page. The smoke tests assert only the shell and the project-list page heading, so that they keep passing while later modules are integrated one by one. The runner does not forward any `EDR_*_API_KEY` variable to the server or browser processes (T10-F11).
- Acceptance criteria: R-235
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:e2e` -> exit 0 ; `npm run test:a11y` -> exit 0

### T25: Project gates, local-environment settings and contract declaration
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T15, T16, T19, T20, T24
- Files owned: `.orchestrate/config.json`
- Scope: add the project gates of `architecture-delta.md` section 7.2 with their exact commands, categories, `when`, `paths`, timeouts and reasons (after the scripts exist); set `localEnvironment.verificationPorts` (app 4310), `demoPorts` (app 4320) and `notes` (data directory recipe, project-local browser cache, network needs of `npm ci`, `npm audit` and the first browser download, sleep prevention for long e2e runs); declare the `http-api` contract (`id` `http-api`, `kind` `http-api`, `path` `contracts/http-api.openapi.yaml`, `status` `current`, `sha256` reported by T20, no frozen snapshots) as accepted by the Orchestrator decision. No other key changes. Show the gate commands to the Product Owner before their first run (`quality-gates.md`).
- Acceptance criteria: -
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0 ; `orch gates list --work-item 'WI-1' --set final --at .` -> exit 0 and every PRJ gate listed ; `orch contracts check --at .` -> exit 0

### T26: Source of truth: exact versions, contract hash, gate and environment notes
- Kind: IMPL
- Agent: architect
- Depends on: T12, T25
- Files owned: `.orchestrate/source-of-truth.md`
- Scope: section 1 exact Node.js and dependency versions from the integrated `package-lock.json`; section 6 the declared `http-api` contract and its SHA-256 (planning.md section 3 item 5); section 7 notes for the gates configured by T25; section 9 open items updated.
- Acceptance criteria: -
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0 ; `orch contracts check --at .` -> exit 0

### T27: Projects module and workflow runner
- Kind: IMPL
- Agent: backend-developer
- Depends on: T18, T19, T20
- Files owned: `apps/server/src/modules/projects/**`, `apps/server/src/workflow/**`
- Scope: `architecture.md` section 6: runner (stages from the registry in order; one active run per project; stage status, reason and skipping; interrupted runs failed at startup through the module's `onStartup` hook; run kinds `full` and `redraft`; config snapshot without secrets); projects routes of the contract (`/settings`, `/catalog/competitions`, `/projects` list, create, get, patch language, runs list, start, get; `/projects/{projectId}/draft/exclusions` delegates to a redraft run). Validation against the catalog: only the UEFA Champions League, league-phase matchdays of the selected season, all three selections required (R-201, R-239); language defaults to Spanish (R-236). Unit tests of the runner with fake stages (failure, retry by a new run, R-203) and integration tests of the routes. Security design review items: run and stage failures stored and returned only as the closed `Failure` object (code, source ID, validation path, HTTP status), never an exception message, provider body or file path, length-capped (T10-F10); `config_snapshot` built from the parsed configuration object, never from `process.env`, with a test that a dummy key in the environment does not appear in it (T10-F11); GET handlers have no persistent side effects (T10-F04).
- Acceptance criteria: R-200, R-201, R-203, R-225, R-236, R-239
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T28: Projects UI: list, create, detail and run progress
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/projects/**`
- Scope: project list as the home page (history columns: title, matchday, language, approval state, last export time); create form (competition selector with only the catalog competitions, season, league-phase matchday selector filtered by season, language selector defaulting to Spanish; submit disabled until competition, season and matchday are selected); project detail (competition, season, matchday, language change, start run, per-stage status with failure reason and restart, links to facts, review and exports) polling the run while active; accessible names, labels and keyboard use. Component tests with a mocked API client.
- Acceptance criteria: R-200, R-201, R-203, R-235, R-236, R-239
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T29: Research stage
- Kind: IMPL
- Agent: backend-developer
- Depends on: T21, T27
- Files owned: `apps/server/src/modules/research/**`
- Scope: research stage per `module-kit.ts`: fetch the matchday from the primary source(s), validate, record observations for every match, team, standings row and context item with source, reference and retrieval time (R-024); map provider failures to stage reasons; never store a stripped field. Unit tests of the pure core with inline fixture inputs in isolation (R-225).
- Acceptance criteria: R-202, R-204, R-224, R-225, R-232
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T30: Verification stage: two-source rule, disputes, team identity
- Kind: IMPL
- Agent: backend-developer
- Depends on: T21, T27
- Files owned: `apps/server/src/modules/verification/**`, `config/team-identities/**`
- Scope: `architecture.md` section 7: retrieval from the verification source(s), team identity matching with the identity map (synthetic map for the fixture season), official names from the official-publication source, the decision rule of section 7.3 for every fact kind (OD-10), dispute records and official-publication consultation, aliases, left-out matches (OD-05); facts route `/projects/{projectId}/runs/{runId}/facts`. No operation sets a fact status. Unit tests of the decision rule in isolation, one per row of section 7.3 (R-205, R-227, R-229, R-230).
- Acceptance criteria: R-205, R-225, R-227, R-229, R-230, R-237
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T31: Facts and verification UI
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/facts/**`
- Scope: facts view of a run: each fact with status (verified, unverified, disputed), reason, value display, evidence per source (source, role, accepted, reference, retrieval time) and dispute record (values per source, consultation, outcome); left-out matches with status; no control that changes a fact status (R-412). Provider `sourceRef` and `ref` values are rendered with the shared `SafeReference` component only: as text, linked only when the value is an `https:` URL on the configured source origin, never as `javascript:` or `data:` links (T10-F16). Component tests, including hostile reference values.
- Acceptance criteria: R-204, R-205, R-230
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T32: Content stage: structure, AI drafting, fact placeholders, content checks
- Kind: IMPL
- Agent: backend-developer
- Depends on: T22, T27
- Files owned: `apps/server/src/modules/content/**`
- Scope: `architecture.md` section 8: deterministic carousel structure (cover, one match slide per included verified finished match, standings slides, closing; split by `maxSlidesPerCarousel`; exclusions), draft request with placeholders and verified display values only (no player-level data, no provider text), deterministic substitution, provenance segments, hashtags, content checks and flags of section 8.3, fact references, persistence of drafts, carousels, elements and versions; regeneration entry point for one element (used by T37). Unit tests in isolation with the stub provider: invented score flagged, translated team name flagged, language passed to the provider (es default and en), structure completeness. Security design review items: content-check hardening of `architecture.md` section 8.3 (reject `\p{Cc}` and `\p{Cf}` before every check; NFKC-normalized copy; any `\p{N}` character; cardinal words to at least 100, ordinals and multiplier words in es and en; mixed-script tokens), with one test per T23 bypass fixture (T10-F05); fixed instruction against person names, venues and outcomes not in the data, and the result relation of each match given as a deterministic display phrase in the data block and stated by fixed template text (T10-F06); test of both T23 injection fixtures as specified there.
- Acceptance criteria: R-207, R-208, R-209, R-225, R-232, R-236, R-237
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T33: Brand asset registry
- Kind: IMPL
- Agent: backend-developer
- Depends on: T27
- Files owned: `apps/server/src/modules/brand/**`
- Scope: brand routes of the contract: register (PNG or JPEG by signature, size and dimension caps, generated file name under `<dataDir>/brand-assets/`, duplicate detection by SHA-256), list, activate or deactivate, serve file with fixed content type and `nosniff`; kinds `brand_logo`, `mascot`, `decoration` only (no badge or competition mark, PD-03); lookup function for the renderer (active assets by kind). Unit and integration tests, including rejection of SVG, oversize and renamed non-image files. Security design review items (T10-F12, T10-F13): 5 MiB body limit on the upload route only and the route-specific `image/png` and `image/jpeg` content-type exception (T19 mechanisms); declared `Content-Type` must match the detected signature (415); dimensions read from the header (PNG `IHDR`, JPEG SOF markers with bounded marker scanning) before any decode; one decode at registration to reject corrupt or unsupported files; `label` printable only (contract pattern); files created with the exclusive flag under a realpath-checked data directory from a validated UUID; served with the stored MIME type, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and `Cross-Origin-Resource-Policy: same-origin`. Tests for each, including a content-type and signature mismatch and an oversize dimension in the header.
- Acceptance criteria: R-228, R-231
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T34: Rendering stage and carousel templates
- Kind: IMPL
- Agent: backend-developer
- Depends on: T27, T33
- Files owned: `apps/server/src/modules/rendering/**`, `assets/fonts/**`
- Scope: `architecture.md` section 9: OFL fonts with licence files (provisional, OD-07); versioned templates cover, match-result (two empty badge slots), standings (rows per slide from configuration, "as of" text), closing; brand palette roles only; brand logo and mascot slots rendered only when an active asset exists; team and competition names as text; text layout with measurement and overflow flags; render model; Satori and resvg rendering to PNG at the configured size; template registry and preview routes. Unit tests: identical numeric text and identical PNG hash for two renders of the same input (R-213), exact official names, 1080 x 1350 output (R-238), complete slides with no assets and empty badge slots (R-212, R-231), shared layout and palette across two matchdays and a template version change applying to later carousels (R-211). Security design review items: render inputs as data only (T10-F09): image slots receive only `data:` URIs built from stored asset bytes, no `loadAdditionalAsset`, resvg with `font.loadSystemFonts: false`, `fontFiles` from `assets/fonts/` only and no resources directory; a test rendering text with `<`, `>`, `&`, `"`, `]]>` and `</text><image href=...>` asserts a valid PNG and a well-formed SVG with no added element; a test that rendering opens no socket (network guard); renders created with the exclusive flag under a realpath-checked data directory from validated UUIDs (T10-F13); template previews cached by template version, active brand-asset hashes and language (T10-F04).
- Acceptance criteria: R-210, R-211, R-212, R-213, R-225, R-231, R-238
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T35: Visual QA stage
- Kind: IMPL
- Agent: backend-developer
- Depends on: T30, T34
- Files owned: `apps/server/src/modules/visual-qa/**`
- Scope: `architecture.md` section 10: the five checks with severities of OD-09, results per slide version and check, `qa_status`; facts and official names re-read from the database, text fit re-measured, PNG size read from the file header. Unit tests: a slide seeded with each defect fails that check by name and a correct slide passes all (R-214); translated or abbreviated team name fails `team_names` (R-237); any size other than the configured one fails `dimensions` (R-238).
- Acceptance criteria: R-214, R-225, R-237, R-238
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T36: Brand assets and templates UI
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/brand/**`
- Scope: brand page: register an asset (kind among brand logo, mascot, decoration; label; PNG or JPEG file), list with preview, activate or deactivate; templates list with version, badge slots and preview image per language; no badge or competition-mark upload option. Component tests.
- Acceptance criteria: R-228, R-231
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T37: Review module: approval state machine, regeneration, final approval
- Kind: IMPL
- Agent: backend-developer
- Depends on: T32, T35
- Files owned: `apps/server/src/modules/review/**`
- Scope: `architecture.md` section 11.1 and 11.2 (final approval part): active draft route, slide image route, element approval and withdrawal bound to the exact version with every guard and problem code of the contract (blocked facts named, flags, QA failures, unacknowledged warnings, version conflict), QA acknowledgement, regeneration of one element through content, rendering and visual QA (other elements unchanged), final approval with version set hash and invalidation on any change. Unit tests of the state machine and integration tests of the routes. Security design review item (T10-F15): every guard check and its write (approval, withdrawal, acknowledgement, final approval, supersession on regeneration) run in one synchronous `BEGIN IMMEDIATE` transaction with no `await` inside; integration test: approving a version while a regeneration supersedes it returns `VERSION_CONFLICT`, and a final approval racing a regeneration never records a stale set.
- Acceptance criteria: R-206, R-207, R-216, R-217, R-240
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T38: Export, history and traceability module
- Kind: IMPL
- Agent: backend-developer
- Depends on: T37
- Files owned: `apps/server/src/modules/export/**`
- Scope: `architecture.md` section 11.2: export only with a valid final approval; files `01.png` to `NN.png` in order at the configured size, `caption.txt` (UTF-8 caption and hashtags), `manifest.json` with element versions, hashes and fact IDs; paths from IDs under the data directory only; no egress client and no publication function; export list and detail routes (exact exported versions); slide trace route (facts, statuses, evidence, disputes). Unit and integration tests: refusal without final approval, file set and order, reopened export equals exported content, trace content, no network call during export. Security design review items: the export reads the version set from the final-approval row, writes exactly those versions into a fresh directory, then in one `BEGIN IMMEDIATE` transaction re-checks `invalidated_at IS NULL` and records the export; a failed commit leaves an unreferenced orphan directory (T10-F15); integration test: export after invalidation returns `FINAL_APPROVAL_REQUIRED`; files created with the exclusive flag, realpath containment, UUID validation before path building (T10-F13); the module imports no network API (lint rule, T10-F08).
- Acceptance criteria: R-216, R-218, R-219, R-220, R-221, R-240
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T39: Review UI: preview, per-item approval, regeneration, final approval
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/review/**`
- Scope: review page of the active draft: carousel preview with all slides in order plus caption and hashtags (R-215); per text segment a provenance label (verified fact or commentary, OD-01, R-208); per element state, blocked facts with names and reasons, content flags, QA results, acknowledge warnings, approve, withdraw, regenerate; final approval control enabled only when the carousel is ready and refusal messages shown otherwise; left-out matches; exclusions editor starting a redraft. Component tests.
- Acceptance criteria: R-206, R-208, R-215, R-217, R-240
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T40: Export, history and traceability UI
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/history/**`
- Scope: export action for a final-approved carousel with the resulting file list and folder path; project exports list with export time; export detail showing the exact exported slides and caption; per exported slide a trace view (facts, status, evidence sources, dispute record). Evidence references are rendered with the shared `SafeReference` component only (text, or an `https:` link on the configured source origin, T10-F16). Component tests, including hostile reference values.
- Acceptance criteria: R-218, R-220, R-221
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T41: Integration tests: platform, research and verification
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T19, T22, T23, T29, T30
- Files owned: `apps/server/test/support/**`, `apps/server/test/integration/platform/**`, `apps/server/test/integration/verification/**`, `scripts/security-checks.mjs`
- Scope: shared test support (temporary data directory, generated fixture configuration per scenario, app factory, network guard assertion); platform tests: loopback-only listener and refused non-loopback connection (R-234), Host and origin protections, no login or account route (R-235), provider swap by configuration only with the full workflow running end to end (R-223), no request to a real provider in fixture mode (R-241, R-222); research and verification tests on the T23 scenarios through the HTTP API: fixture values reproduced (R-202), stage failure and restart (R-203), attribution (R-204), disputes and resolution outcomes (R-205, R-230), acceptance and agreement rules (R-227, R-229), malformed data rejected (R-224), player-level fields absent from stored results and from the draft request (R-232); each stage exercised in isolation through the stage kit (R-225). Security design review items: platform tests of the development origin set (5173 Host and Origin accepted only with the development configuration, refused with the production one) (T10-F02); Fetch-Metadata refusal of `cross-site` and `same-site` `/api` requests, `Origin: null` refused, deny-by-default for PUT, PATCH, DELETE and unknown methods without the custom header, no `Access-Control-*` header on any response including OPTIONS, CORP, COOP and the CSP directives present (T10-F04); a wrong-key run with the echoing AI stub server stores and returns no key (T10-F10). Security check script `scripts/security-checks.mjs` (no new dependency; each subcommand exits 0 when the control holds, 1 otherwise, and prints what it checked): `secret-scan` (tracked files, via `git ls-files`: non-empty `EDR_*_API_KEY=` assignments, common provider key prefixes, private-key headers, the shared dummy test key outside test files, tracked `.env*` other than `.env.example`), `bundle-secrets` (built `apps/web/dist` contains neither the dummy test key nor any `EDR_` key assignment), `lockfile` (every `resolved` URL on `https://registry.npmjs.org/`, every entry has `integrity`, `.npmrc` has no auth token or alternate registry), `audit-report` (runs `npm audit --json`, prints every advisory of any severity with package and severity for T47's review, exits 1 if any advisory is high or critical or names fastify, @fastify/static, zod, satori, @resvg/resvg-js, vite, react or react-dom) (T10-F01, T10-F18, T10-F02).
- Acceptance criteria: R-202, R-203, R-204, R-205, R-222, R-223, R-224, R-225, R-227, R-229, R-230, R-232, R-234, R-241
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:integration` -> exit 0 ; `node scripts/security-checks.mjs secret-scan` -> exit 0 ; `node scripts/security-checks.mjs lockfile` -> exit 0

### T42: Integration tests: content, rendering, visual QA, approval, export, history
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T32, T33, T34, T35, T37, T38, T41
- Files owned: `apps/server/test/integration/delivery/**`
- Scope: API-level tests on fixture scenarios for R-206 to R-221, R-228, R-231, R-232, R-236 to R-238 and R-240 as worded in `requirements.md` section 7, including: blocked approval naming the fact while unaffected content stays approvable; invented-number and non-official-name flags; provenance labels in stored content; structure and split; template consistency and template change; no-asset carousel; deterministic numeric text; each seeded QA defect; export refusal and success; regeneration scope; export files; no publication path and no network during export; history and reopen; traceability; brand asset reuse across projects; Spanish default and English project; 1080 x 1350; final approval refusal and success.
- Acceptance criteria: R-206, R-207, R-208, R-209, R-210, R-211, R-212, R-213, R-214, R-216, R-217, R-218, R-219, R-220, R-221, R-228, R-231, R-232, R-236, R-237, R-238, R-240
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:integration` -> exit 0

### T43: Contract conformance tests
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T20, T38, T41
- Files owned: `apps/server/test/contract/**`
- Scope: every operation of `contracts/http-api.openapi.yaml` exercised against the running app (Fastify `inject`) on fixture data; responses validated against the contract schemas (status codes, problem+json shape and codes, required and nullable fields, closed objects); every server route is in the contract and every contract operation is served; invalid inputs return `VALIDATION_FAILED` (R-224); no publication operation (R-219). Security design review items (T10-F03, T10-F17, V-29): every ID parameter rejects non-UUID or non-slug values (including `..%2F..`, absolute paths and over-long strings) before any handler logic; `label` with control or format characters is rejected; the 421, 403, 413 and 415 problem responses are exercised on the operations that declare them; response conformance relies on the closed per-kind fact values and per-check QA details; the promoted contract equals the accepted proposal except `info.version`.
- Acceptance criteria: R-219, R-224
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:contract` -> exit 0

### T44: End-to-end and accessibility journeys
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T23, T24, T28, T29, T31, T36, T38, T39, T40
- Files owned: `e2e/tests/**`
- Scope: browser journeys on the built app with fixture providers: create a project (only the UEFA Champions League, league-phase matchdays, Spanish default) and see it in the list; run research and follow stage progress including a simulated failure and restart; review facts; preview the carousel with caption and hashtags; see a blocked approval naming the fact; approve items, final approval, export and see the files listed; history and reopen; trace an exported slide; register a brand asset and see no badge option; axe checks (`@a11y`) on every page with no serious or critical violation.
- Acceptance criteria: R-200, R-201, R-203, R-206, R-215, R-216, R-218, R-220, R-221, R-231, R-235, R-236, R-239, R-240
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:e2e` -> exit 0 ; `npm run test:a11y` -> exit 0

### T45: Architecture conformance review
- Kind: IMPL
- Agent: architect
- Depends on: T14, T26, T42, T43, T44
- Files owned: `docs/work-items/WI-1/architecture/conformance-review.md`
- Scope: review of the integrated code and configuration against this architecture: competition, target format (dimensions, maximum slides) and publication mode are configuration or data, not stage logic (R-226); the schema and code hold no player entity or player-level attribute and no user-account entity (R-233); the provider research covers pricing, coverage, reliability and redistribution/licensing per candidate, development and tests need no purchased service, and nothing was purchased or subscribed to (R-242); R-103 and R-109; deviations listed as findings with the owning task.
- Acceptance criteria: R-226, R-233, R-242
- Verification: `orch scan models docs/work-items/WI-1/architecture/conformance-review.md` -> exit 0 ; `orch validate --work-item 'WI-1' --at .` -> exit 0

### T46: Security evidence pack
- Kind: VERIFY
- Agent: qa-engineer
- Depends on: T45
- Files owned: `docs/work-items/WI-1/evidence/T46-*.txt`
- Scope: at a committed, clean integration HEAD in the verify worktree, run exactly these commands, in this order, and record each output verbatim with `orch evidence write` (names in brackets; controls of `docs/work-items/WI-1/security/design-review.md` section 9 they evidence in parentheses; extended for T10-F01 and T10-F18):
  1. `npm ci` [install] (NV-6, V-28).
  2. `npm run test:integration -- apps/server/test/integration/platform` [platform-security: loopback binding, refused non-loopback connection, Host and origin allow-lists including the development set, Fetch-Metadata, headers, no CORS, no login, provider swap, no real provider request, echoing-key test] (V-01 to V-05, V-08, V-10, V-26).
  3. `npm run test:integration -- apps/server/test/integration/delivery` [delivery-security: export confinement, no publication, no network during export, content flags] (V-14, V-20).
  4. `npm run test:unit -- apps/server/src/modules/content apps/server/src/providers` [content-safety: prompt framing, placeholder enforcement, Unicode and number-word checks, response validation, payload allow-lists, team-name rules, injection fixtures, AI error mapping] (V-09, V-13 to V-15, V-26).
  5. `npm run test:unit -- apps/server/src/platform` [platform-unit: configuration schema (loopback-only host, explicit allow-lists, secret-like key rejection), egress client (exact origin, HTTPS only, redirect error, total deadline, decoded-byte cap, TLS), HTTP guards and headers, logger redaction] (V-02, V-03, V-05, V-11, V-24, V-25).
  6. `npm run test:unit -- apps/server/src/modules/brand apps/server/src/modules/rendering apps/server/src/modules/export apps/server/src/modules/review` [files-render-approval-unit: upload signature, type match, size and dimension caps, SVG refusal; rendering data-URI-only inputs, no system fonts, markup escaping, no socket; export and render confinement; approval guards] (V-17 to V-21).
  7. `npm run test:integration -- apps/server/src/modules apps/server/src/platform` [module-integration: module and platform `*.int.test.ts` including upload, approval races and export after invalidation] (V-17, V-19 to V-21).
  8. `npm run test:unit -- apps/web` [web-security-unit: Vite development-mode settings, safe reference rendering] (V-07, V-16, V-27).
  9. `npm run lint` [lint: network-API bans outside `platform/net` and in `modules/export`, `dangerouslySetInnerHTML` ban, SQL template-literal ban] (V-12, V-16, V-22).
  10. `node scripts/security-checks.mjs secret-scan` [secret-scan: tracked files; expected no match] (V-23).
  11. `npm run build` [build] then `node scripts/security-checks.mjs bundle-secrets` [bundle-secrets: built UI bundle contains no dummy test key and no key assignment] (V-27).
  12. `node scripts/security-checks.mjs lockfile` [lockfile: registry and integrity of every lock entry, `.npmrc` without token or alternate registry] (V-23, V-28).
  13. `npm ls fastify @fastify/static zod satori @resvg/resvg-js vite react react-dom` [versions] (V-07, V-28, NV-1).
  14. `npm audit --audit-level=high` [audit] (V-28).
  15. `node scripts/security-checks.mjs audit-report` [audit-full: every advisory of any severity listed for T47's review of moderate advisories; fails on high or critical, or on any advisory for the security-relevant packages, Vite included] (V-07, V-28, NV-1).
  16. `npm audit signatures` [registry-signatures] (V-28); evidence files take only PASS or FAIL, so when the registry does not support signatures no evidence file is written and the report states NOT RUN with the reason (never PASS).
  17. `git ls-files -- .env .env.local data .cache` [repo-hygiene: expected empty output] (V-23).
  18. `git check-ignore .env.local data/ .cache/` [ignore-rules] (V-23).
  A missing or failing command is recorded, never omitted.
- Acceptance criteria: R-219, R-234, R-235, R-241
- Verification: `orch evidence check docs/work-items/WI-1/evidence/T46-install.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-platform-security.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-delivery-security.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-content-safety.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-platform-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-files-render-approval-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-module-integration.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-web-security-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-lint.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-secret-scan.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-build.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-bundle-secrets.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-lockfile.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-versions.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-audit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-audit-full.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-repo-hygiene.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-ignore-rules.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS
### T47: Security delta validation
- Kind: VERIFY
- Agent: security-reviewer
- Depends on: T46
- Files owned: `docs/work-items/WI-1/evidence/T47-security-validation.txt`, `docs/work-items/WI-1/security/T47-security-validation.md`
- Scope: delta validation of the implemented system against the security delta of `architecture-delta.md` section 4 and the T10 design review, using the code and the T46 evidence pack: every control V-01 to V-30 of `docs/work-items/WI-1/security/design-review.md` section 9 (TB-1 local service including development mode, TB-2 and TB-3 providers and AI, TB-4 and TB-5 files, TB-6 secrets, TB-7 supply chain, the contract, and the recorded U-03 Product Owner decision and its conditions), the design-time assumptions NV-1 to NV-6 of section 10 against the pinned versions, the review of moderate advisories from [audit-full], and the status of every should-fix finding T10-F04 to T10-F18 in the tasks that carry it. Findings with severity and classification; missing evidence marked NOT VERIFIED with the exact command. Verdict PASS or FAIL in the evidence file (header of `templates/evidence-header.txt`, `VALIDATED_HEAD` from the brief).
- Acceptance criteria: R-234, R-235
- Verification: `orch evidence check docs/work-items/WI-1/evidence/T47-security-validation.txt --work-item 'WI-1' --task 'T47' --at .` -> exit 0, header RESULT: PASS

### T48: Final gate run
- Kind: VERIFY
- Agent: qa-engineer
- Depends on: T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40, T41, T42, T43, T44, T45, T46, T47
- Files owned: `docs/work-items/WI-1/evidence/T48-gates.txt`
- Scope: run every final gate (project gates of T25 and the four framework-mandatory gates) at a clean, committed integration HEAD in the verify worktree and report each gate PASS, FAIL or NOT RUN with command, exit code and counts. Last VERIFY task of the work item.
- Acceptance criteria: -
- Verification: `orch gates run --work-item 'WI-1' --task 'T48' --set final --cwd '<VERIFY_WORKTREE>'` -> exit 0, every required gate PASS

## Parallelism

Owned paths of tasks that no dependency orders are disjoint; tasks whose paths overlap are ordered (T15 before every task that replaces a T15 stub or root file; T16 before the feature UIs; T17 before T30's identity maps; T20 before T43; T24 before T44; T12 before T26).

| Wave | Tasks that can be IN_PROGRESS together (cap 5) | Why disjoint |
|------|-----------------------------------------------|--------------|
| 1 | T12, T13, T15 | source of truth; research captures; root and skeleton files |
| 2 | T14, T16, T17, T18, T20 | research report; `apps/web/**` and lock file; `platform/config`, `platform/format`, `platform/net`, `config/*.json`; `platform/db`, migrations; `contracts/**`, `packages/contracts/src/**`, `test/contract/**` |
| 3 | T19, T21, T22, T28, T31, T36, T39, T40 (five at a time) | `main.ts`, `app.ts`, `container.ts`, `platform/http`; `providers/sports`; `providers/ai`; one `apps/web/src/features/<name>/**` directory each |
| 4 | T23, T24, T27 | `fixtures/**`; `e2e/**`; `modules/projects`, `workflow` |
| 5 | T25, T29, T30, T32, T33 | protected configuration file; one module directory each (T30 also `config/team-identities/**`, ordered after T17 through T27) |
| 6 | T26, T34, T41 | source of truth; `modules/rendering`, `assets/fonts`; `test/support`, `test/integration/platform`, `test/integration/verification` |
| 7 | T35 | `modules/visual-qa` |
| 8 | T37 | `modules/review` |
| 9 | T38 | `modules/export` |
| 10 | T42, T43, T44 | `test/integration/delivery`; `test/contract`; `e2e/tests` |
| 11 | T45, then T46, T47, T48 in sequence | one document; evidence files with distinct task prefixes |

Totals: 37 tasks (34 IMPL, 3 VERIFY): backend-developer 16, frontend-developer 6, qa-engineer 8 (6 IMPL, 2 VERIFY), architect 4, Orchestrator 2, security-reviewer 1.

Critical path: T11 -> T15 -> T17 -> T19 -> T27 -> T33 -> T34 -> T35 -> T37 -> T38 -> T42 -> T45 -> T46 -> T47 -> T48.

## Acceptance-criteria coverage

| Acceptance criterion | Tasks | Verification |
|----------------------|-------|--------------|
| R-200 | T27, T28, T44 | `npm run test:integration`; `npm run test:unit`; `npm run test:e2e` |
| R-201 | T17, T27, T28, T44 | `npm run test:unit`; `npm run test:integration`; `npm run test:e2e` |
| R-202 | T29, T41 | `npm run test:unit`; `npm run test:integration` |
| R-203 | T27, T28, T41, T44 | `npm run test:unit`; `npm run test:integration`; `npm run test:e2e` |
| R-204 | T18, T29, T31, T41 | `npm run test:integration`; `npm run test:unit` |
| R-205 | T23, T30, T31, T41 | `npm run test:unit`; `npm run test:integration` |
| R-206 | T37, T39, T42, T44 | `npm run test:integration`; `npm run test:unit`; `npm run test:e2e` |
| R-207 | T32, T37, T42 | `npm run test:unit`; `npm run test:integration` |
| R-208 | T32, T39, T42 | `npm run test:unit`; `npm run test:integration` |
| R-209 | T32, T42 | `npm run test:unit`; `npm run test:integration` |
| R-210 | T34, T42 | `npm run test:unit`; `npm run test:integration` |
| R-211 | T34, T42 | `npm run test:unit`; `npm run test:integration` |
| R-212 | T34, T42 | `npm run test:unit`; `npm run test:integration` |
| R-213 | T34, T42 | `npm run test:unit`; `npm run test:integration` |
| R-214 | T35, T42 | `npm run test:unit`; `npm run test:integration` |
| R-215 | T39, T44 | `npm run test:unit`; `npm run test:e2e` |
| R-216 | T37, T38, T42, T44 | `npm run test:integration`; `npm run test:e2e` |
| R-217 | T37, T39, T42 | `npm run test:integration`; `npm run test:unit` |
| R-218 | T38, T40, T42, T44 | `npm run test:integration`; `npm run test:e2e` |
| R-219 | T20, T38, T42, T43, T46 | `npm run test:contract`; `npm run test:integration`; T46 evidence |
| R-220 | T38, T40, T42, T44 | `npm run test:integration`; `npm run test:e2e` |
| R-221 | T38, T40, T42, T44 | `npm run test:integration`; `npm run test:e2e` |
| R-222 | T15, T41 | `docs/local-setup.md`; `npm run test:integration` |
| R-223 | T21, T22, T41 | `npm run test:unit`; `npm run test:integration` |
| R-224 | T21, T23, T29, T41, T43 | `npm run test:unit`; `npm run test:integration`; `npm run test:contract` |
| R-225 | T15, T27, T29, T30, T32, T34, T35, T41 | `npm run test:unit`; `npm run test:integration` (network guard) |
| R-226 | T17, T45 | `npm run test:unit`; conformance review |
| R-227 | T30, T41 | `npm run test:unit`; `npm run test:integration` |
| R-228 | T33, T36, T42 | `npm run test:integration`; `npm run test:unit` |
| R-229 | T23, T30, T41 | `npm run test:unit`; `npm run test:integration` |
| R-230 | T23, T30, T31, T41 | `npm run test:unit`; `npm run test:integration` |
| R-231 | T33, T34, T36, T42, T44 | `npm run test:unit`; `npm run test:integration`; `npm run test:e2e` |
| R-232 | T21, T23, T29, T32, T41, T42 | `npm run test:unit`; `npm run test:integration` |
| R-233 | T18, T45 | schema test in `npm run test:integration`; conformance review |
| R-234 | T16, T19, T41, T46, T47 | `npm run test:unit`; `npm run test:integration`; T46 and T47 evidence |
| R-235 | T16, T19, T24, T28, T44, T46, T47 | `npm run test:integration`; `npm run test:e2e`; T46 and T47 evidence |
| R-236 | T17, T27, T28, T32, T42, T44 | `npm run test:unit`; `npm run test:integration`; `npm run test:e2e` |
| R-237 | T23, T30, T32, T35, T42 | `npm run test:unit`; `npm run test:integration` |
| R-238 | T17, T34, T35, T42 | `npm run test:unit`; `npm run test:integration` |
| R-239 | T17, T27, T28, T44 | `npm run test:unit`; `npm run test:integration`; `npm run test:e2e` |
| R-240 | T37, T38, T39, T42, T44 | `npm run test:integration`; `npm run test:e2e` |
| R-241 | T21, T23, T41, T46 | `npm run test:unit`; `npm run test:integration`; T46 evidence |
| R-242 | T13, T14, T45 | research captures; `provider-research.md`; conformance review |
