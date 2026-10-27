# WI-1 Architecture Delta

- Author: architect (task WI-1-T09). Date: 2026-10-27. Mode: full (greenfield repository with no code; the work item adds the whole system, new trust boundaries to external sports-data and AI providers and a new persistence model).
- Inputs: requirements `docs/work-items/WI-1/requirements.md`; records `docs/work-items/WI-1/requirements.json` (140 records, acceptance criteria R-200 to R-242); intake record `docs/work-items/WI-1/intake/intake-record.json` (S-000, S-001, both precedence level 1, no technical specification); source of truth `.orchestrate/source-of-truth.md` sections 3 to 5 (PD-01 to PD-09, BR-01 to BR-11, SC-01 to SC-04); tracker Decisions OD-01 to OD-12; configuration `.orchestrate/config.json` (no contracts, framework-mandatory gates only, concurrency 5, risk level standard, personal data none). Delegated decisions: R-103 (stack), R-400 (sports-data provider), R-401 (AI provider), R-402 (rendering), R-403 (storage), R-421 (export formats).
- Full-mode documents in this directory: `architecture.md` (components, stack, workflow, verification pipeline, rendering, state machine, export, traceability, local environment), `data-model.md` (persistence), `contracts/http-api.openapi.yaml` (proposed HTTP contract), `contracts/provider-ports.md` (internal provider and stage interfaces, fixture formats), `provider-research-plan.md` (PD-01 research deliverable plan), `task-plan.md`. Decisions are recorded once, in section 5 below; traceability uses the tracker's acceptance-criteria lines and the coverage table of `task-plan.md`.

## 1. Affected components

Every component is new. Code paths are those the task plan creates.

| Component | Code paths | Source-of-truth section | Requirements |
|-----------|------------|-------------------------|--------------|
| Workspace and tooling | `package.json`, `.npmrc`, `.nvmrc`, `tsconfig*.json`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `docs/local-setup.md` | 1 (stack), 7 (gates) | R-103, R-107, R-108, R-109, R-222, R-225 |
| Configuration and catalog | `apps/server/src/platform/config/**`, `config/*.json` | 1, 2 | R-021, R-101, R-102, R-106, R-226, R-236, R-238, R-239, R-425 |
| Display formatting | `apps/server/src/platform/format/**` | 8 | R-035, R-036, R-052, R-310, R-426 |
| Egress client | `apps/server/src/platform/net/**` | 5 | R-222, RK-07, RK-08 |
| HTTP platform and composition root | `apps/server/src/main.ts`, `app.ts`, `container.ts`, `apps/server/src/platform/http/**` | 5, 6 | R-113, R-114, R-234, R-235, RK-13 |
| Persistence | `apps/server/src/platform/db/**`, `apps/server/migrations/**` | 1, 2 | R-024, R-043, R-044, R-112, R-113, R-233, R-403 |
| HTTP contract and shared schemas | `contracts/http-api.openapi.yaml`, `packages/contracts/src/**` | 6 | R-020, R-105, R-219 |
| Sports-data provider port | `apps/server/src/providers/sports/**`, `fixtures/sports/**` | 3 (PD-01), 4 (BR-03), 5 (SC-03, SC-04) | R-022, R-046, R-105, R-110, R-112, R-224, R-232, R-241, R-400 |
| AI provider port | `apps/server/src/providers/ai/**`, `fixtures/ai/**` | 5 | R-029, R-106, R-111, R-223, R-401 |
| Workflow runner and projects | `apps/server/src/workflow/**`, `apps/server/src/modules/projects/**` | 2 | R-001, R-020, R-021, R-023, R-051, R-104, R-200, R-201, R-203, R-236, R-239 |
| Research stage | `apps/server/src/modules/research/**` | 4 (BR-03, BR-04) | R-002, R-022, R-024, R-202, R-204, R-305, R-308 |
| Verification stage | `apps/server/src/modules/verification/**`, `config/team-identities/**` | 3 (PD-02), 4 (BR-01, BR-02, BR-05) | R-003, R-025, R-045 to R-048, R-205, R-227, R-229, R-230, R-311, R-409, R-412, R-423, R-424, R-426 |
| Content stage | `apps/server/src/modules/content/**` | 4 (BR-05, BR-07) | R-004, R-026 to R-029, R-051, R-052, R-207 to R-209, R-236, R-237, R-404, R-407, R-422 |
| Brand registry | `apps/server/src/modules/brand/**` | 3 (PD-03), 4 (BR-06) | R-010, R-033, R-034, R-049, R-228, R-231, R-301, R-309 |
| Rendering stage and templates | `apps/server/src/modules/rendering/**`, `assets/fonts/**` | 4 (BR-06, BR-08) | R-005, R-030 to R-036, R-050, R-210 to R-213, R-231, R-238, R-402, R-408, R-418 |
| Visual QA stage | `apps/server/src/modules/visual-qa/**` | 4 (BR-05, BR-08) | R-006, R-037, R-214, R-237, R-238, R-420 |
| Review and approval | `apps/server/src/modules/review/**` | 4 (BR-09) | R-007, R-026, R-038 to R-040, R-206, R-207, R-216, R-217, R-240, R-405, R-406 |
| Export, history, traceability | `apps/server/src/modules/export/**` | 4 (BR-11) | R-008, R-009, R-041 to R-044, R-216, R-218 to R-221, R-304, R-419, R-421 |
| Web UI | `apps/web/**` | 3 (PD-08) | R-020, R-038, R-200, R-201, R-203, R-204, R-206, R-208, R-215, R-218, R-220, R-221, R-228, R-235 |
| Test suites | `apps/server/test/**`, `e2e/**`, module `*.test.ts` and `*.int.test.ts` | 7 | R-107, R-225, every acceptance criterion |

## 2. Contract delta

The configuration declares no contract (`contracts: []`), so no declared contract changes and no frozen snapshot exists. This work item proposes one new contract to declare.

### 2.1 Interface conventions (proposed for source-of-truth section 6)

- HTTP: base path `/api/v1`; JSON with camelCase fields; ISO-8601 UTC times; server IDs are lowercase UUIDs and catalog and template IDs are slugs, each with a `pattern` and every request string with a `maxLength` (T10-F03); errors as `application/problem+json` with a stable `code` from a closed list and a `detail` built from fixed text and sanitized parameters only (T10-F10); closed objects in requests and responses (`additionalProperties: false` or `unevaluatedProperties: false`; per-kind fact values and per-check QA details, T10-F17).
- Local request protection is part of the contract: 421 on every operation for a Host outside the configured allow-list; header `X-EDR-Client: web` on every method other than GET and HEAD; a present `Origin` must be in the configured origin allow-list (`null` refused); JSON content type for bodies; 403 and 415 declared on every mutating operation and 413 where a body exists (T10-F17); GET and HEAD have no persistent side effects (T10-F04).
- Versioning and compatibility: within `v1` only additive changes (new optional request fields, new response fields, new operations, new problem codes). Removing or changing the meaning of an operation, field or code is a breaking change; it would need a new major path and a Product Owner decision (HIGH-06). Every change to the declared contract follows `planning.md` section 3 with a Contract Safety assessment.
- Source of truth for shapes: the OpenAPI document is authoritative; `packages/contracts` Zod schemas mirror it and contract tests (`PRJ-CONTRACT`) check the parity and the server's conformance.
- See section 8, item U-04: whether establishing this first contract-evolution policy needs the Product Owner (HIGH-06) is escalated.

### 2.2 http-api (http-api, proposed path `contracts/http-api.openapi.yaml`)

- Status: new, proposed. Proposed file: `docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml` (OpenAPI 3.1, `info.version` `1.0.0-proposed`). No approved file or snapshot exists, none is modified.
- Diff summary: initial contract. Operations: health, settings, catalog; projects (list, create, get, update language); runs (list, start full or redraft, get); facts of a run; active draft; excluded matches; slide image; regenerate element; approve and withdraw element approval; acknowledge QA warnings; final approval; export; project exports; export detail; slide trace; brand assets (list, register, activate or deactivate, file); templates (list, preview). Problem codes: `VALIDATION_FAILED`, `NOT_FOUND`, `FORBIDDEN_ORIGIN`, `MISDIRECTED_HOST`, `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `RUN_IN_PROGRESS`, `NO_VERIFIED_RUN`, `VERSION_CONFLICT`, `APPROVAL_BLOCKED`, `CONTENT_FLAGGED`, `QA_FAILED`, `QA_ACK_REQUIRED`, `FINAL_APPROVAL_REFUSED`, `FINAL_APPROVAL_REQUIRED`, `DUPLICATE_ASSET`, `PROVIDER_FAILED`, `INTERNAL`. No authentication operation, no publication operation, no operation that sets a fact status.
- Correction after the security design review T10 (attempt 2, before acceptance): T10-F03 (UUID patterns on every server ID path parameter and body ID; slug patterns on catalog and template IDs and on `MatchKey`; `maxLength` on every request string; `label` excludes `\p{Cc}` and `\p{Cf}`), T10-F17 (closed `Fact` per kind through `FactKindValue`, closed `FactSubject`, `FactValue`, `Evidence.value`, `Dispute` values, per-check closed `QaResult.details`; 421 on every operation; 403 and 415 on every mutating operation; 413 where a body exists), T10-F10 (`Run.failure` and `StageStatus.failure` use the closed `Failure` schema instead of free-text reasons; `detail` and `errors[].message` length-capped). The Contract Safety assessment below holds unchanged for the corrected proposal (the T10 review confirmed CS-1 to CS-5).
- Contract Safety assessment:

| Condition | Holds? | Evidence |
|-----------|--------|----------|
| CS-1 backward compatible | yes | No previous version and no consumer exists; the contract is new. Later changes are bound to the additive policy of section 2.1 |
| CS-2 within approved scope | yes | Every operation maps to an approved requirement (operation descriptions cite R-IDs); no operation outside requirements sections 5 to 7; no publication (R-042, BR-11) and no login (R-113) |
| CS-3 preserves authorization boundaries | yes | PD-05 sets a single local operator without login; the contract adds no identity and keeps every operation behind the loopback binding, the Host allow-list and the origin and custom-header guard (RK-13) |
| CS-4 does not weaken any security control | yes | Adds controls (problem codes `FORBIDDEN_ORIGIN`, `MISDIRECTED_HOST`, upload limits, closed objects); exposes no secret (settings return adapter IDs only) and no file-system path outside the data directory |
| CS-5 does not change business-rule semantics | yes | Approval guards implement BR-01, BR-02, BR-09 and R-026, R-027, R-406, R-412 as written; no operation can mark a fact verified, override a block or publish |

- Classification: MEDIUM (every condition holds; `MED-01` additive change to an empty contract set). The Orchestrator accepts or rejects it after the security design review T10, before T20 promotes it. Promotion: T20 copies it to `contracts/http-api.openapi.yaml` (`info.version` `1.0.0`); T25 declares it in the configuration (`id` `http-api`, `kind` `http-api`, `status` `current`, its SHA-256); T26 records the hash in source-of-truth section 6.

### 2.3 Internal interfaces not proposed for declaration

`contracts/provider-ports.md` (sports-data port, AI port, module and stage kit, egress client, display formatting, fixture formats) is an architecture-level interface (precedence level 3). Recommendation: do not declare it in `contracts` now; it is internal to one process, covered by unit tests, and replaceable without affecting the UI. Declare it later if a provider adapter is developed outside this repository.

## 3. Data delta

New persistence model, specified in `data-model.md`: one SQLite database (`node:sqlite`, STRICT tables, foreign keys, WAL) and a local data directory for rendered slides, exports and brand assets; migration `0001_initial.sql` with tables `schema_migrations`, `projects`, `workflow_runs`, `stage_runs`, `sources`, `teams`, `team_aliases`, `observations`, `facts`, `fact_evidence`, `disputes`, `content_drafts`, `carousels`, `elements`, `element_versions`, `element_fact_refs`, `qa_results`, `approvals`, `final_approvals`, `exports`, `export_files`, `brand_assets`, with the check constraints and indexes listed there. Data-handling rules: mandatory source attribution on observations; verified facts must carry a value; append-only approvals; no deletion (OD-08); no player-level, user-account or secret data (R-112, R-113, R-233), enforced by allow-list provider schemas and a schema test; file paths built from generated IDs and confined to the data directory.

## 4. Security delta

- Changed surface (all new):

| ID | Trust boundary | Threats | Controls (design) |
|----|----------------|---------|-------------------|
| TB-1 | Browser UI to local server over loopback HTTP, no login (PD-05); in development also the Vite dev server and its `/api` proxy | other local processes and OS accounts; cross-site requests from web pages in the operator's browser to localhost, including simple GET and HEAD (RK-13); DNS rebinding; requests to `0.0.0.0`; clickjacking; dev-server file reads | listen on `127.0.0.1` only (configuration schema rejects other hosts; Vite dev and preview servers too); Host allow-list as an explicit configured set of exact `host:port` values applied to every request (API, static, SPA fallback, 404, OPTIONS), never derived from headers, never `0.0.0.0` or a wildcard (421); `trustProxy` false, `X-Forwarded-*` ignored; guards run in `onRequest`, before body parsing; every method other than GET and HEAD (deny by default) needs `X-EDR-Client: web`, an `Origin` (when present) in the explicit origin allow-list with `Origin: null` refused, and a JSON content type, which forces a CORS preflight that the server never grants (no `Access-Control-*` header on any response, OPTIONS included); Fetch-Metadata policy: `/api/**` requests with `Sec-Fetch-Site` `cross-site` or `same-site` refused (403), `same-origin`, `none` and absent allowed (T10-F04); GET and HEAD handlers have no persistent side effects; template previews cached by template version, active asset hashes and language (T10-F04); no cookies or sessions exist; headers: CSP `default-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin` (T10-F04); body limits (global JSON 64 KiB, upload route 5 MiB); problem responses without stack traces. **Development mode (T10-F02, `architecture.md` section 12.1):** development adds only the exact Hosts and Origins of `127.0.0.1:5173` and `localhost:5173` to the configured allow-lists (verification and demo configurations list their own ports); Vite proxy `changeOrigin: false`; Vite `allowedHosts` never `true`, `cors` default, `fs.strict` true, `fs.deny` keeps the default list (`.env`, `.env.*`) and adds `data/**`, same settings for `preview`; the pinned Vite version has no known advisory of any severity, checked explicitly (the high-level audit gate lets moderate advisories through). Residual (T10-F19): any local process of any OS account on the host, and containers or VMs sharing the host network namespace, can call the API; within PD-05 and RK-13 for a single-user workstation; re-raised to the PO (HIGH-03) before shared or multi-user hosts, paid keys or real credentials, or real non-public data |
| TB-2 | Server to sports-data sources (untrusted data) | malformed or hostile payloads; oversized, decompression-bomb or slow bodies; prompt-injection text; player-level data; source spoofing by redirects | allow-list Zod schemas (unknown fields dropped, structure checked, enumerated context, team-name character and length rules without control or format characters); egress client: exact origin match after URL parsing (lowercase, IDNA, userinfo rejected), HTTPS only, `redirect: 'error'`, total deadline covering the body, streaming cap on decoded bytes (512 KiB default, 2 MiB maximum), TLS never disabled (T10-F07); egress enforced beyond convention by ESLint bans on `fetch`, `http`, `https`, `net`, `tls` and `undici` outside `platform/net` and a socket-level test guard (T10-F08); fixture adapter confined to `fixtures/sports/`; MVP has fixture adapters only; no HTML parsing in the MVP. Residual (T10-F06): plain-language instruction text within the allowed team-name characters passes the schema; it only matters with real sources (pinned official names before then) |
| TB-3 | Server to AI provider; AI output back (untrusted output) | prompt injection through data (RK-08); invented numbers or names (RK-03); Unicode bypasses of the checks; output used as code or markup; leakage of secrets or data in prompts | prompt contains only verified structured facts and fixed instructions, framed as data; no provider free text, no player data, no secrets, no paths; the instruction forbids person names, venues and outcomes not in the data, and the result relation is a deterministic phrase (T10-F06); no tool calling; JSON output validated by schema and length limits (256 KiB response cap); numbers and team names only through placeholders substituted deterministically; content checks reject control and format characters, NFKC-normalize, flag any `\p{N}` character, cardinal words to at least 100, ordinals and multiplier words (es, en), name variants and mixed-script tokens, URLs, mentions and markup (T10-F05), and flagged items cannot be approved; output never executed or rendered as HTML (React text nodes, `dangerouslySetInnerHTML` banned by lint; slide text as Satori text nodes); AI never decides fact status. Residual (T10-F06): person names and misstated relations with a real model, controlled by human approval with provenance labels; production-blocking until the follow-up measures |
| TB-4 | Operator-supplied brand files | malicious or polyglot images, SVG scripts, oversized files and decompression bombs, content-type confusion, decoder bugs | PNG and JPEG only, verified by file signature, declared `Content-Type` must match the signature (415); SVG refused; 5 MiB route limit (global limit small) and 4096 x 4096 caps, dimensions read from the header (PNG `IHDR`, JPEG SOF with bounded marker scanning) before any decode; one decode at registration to reject corrupt or unsupported files; generated file names created exclusively; served with the stored MIME type, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and CORP `same-origin`; `label` printable only (T10-F12); decoded only by resvg when embedded as a `data:` URI in a slide (T10-F09). EXIF and text metadata of originals is kept locally; renders and exports do not carry it. In-process decoding is the U-03 decision (HIGH-03) |
| TB-5 | File-system outputs (renders, exports) and static serving | path traversal through route parameters; writes outside the data directory; symlink escape; overwriting; static exposure of the data directory or dotfiles | contract ID patterns (T10-F03) and the same UUID check before any path building, also for IDs read from the database; containment against `fs.realpath(dataDir)` with `path.relative` neither absolute nor starting with `..`; exclusive create (`wx`); data directory mode 0700; `@fastify/static` rooted only at the built `apps/web/dist` with `dotfiles: 'deny'`, no listing, SPA fallback never matching `/api/**`; renders, exports and brand files served only by API handlers after a database lookup (T10-F13); export module has no network client (lint ban, R-219) |
| TB-6 | Secrets (RK-12) | API keys committed, logged, stored, echoed by providers into stored reasons, sent to the browser bundle, exposed by the dev server, captured in evidence | keys only from environment variables (`.env.local` git-ignored, owner-only mode 0600, `.env.example` empty); configuration schema rejects secret-like keys; explicit logger redaction paths (`req.headers.authorization`, `headers.authorization`, `*.apiKey`, `*.key`, `*.token`, `*.secret`, `*.password`) with unit tests (T10-F11); keys sent only in the `Authorization` header to the configured AI origin; failure reasons and problem details from closed codes and sanitized parameters only, tested with an AI stub server that echoes the key (T10-F10); settings endpoint returns adapter IDs only; `config_snapshot` built from the parsed configuration, never from `process.env`; Vite `envPrefix` `VITE_` with no secret using it, `envDir` `apps/web`, `fs.deny` covers `.env*` (T10-F02, T10-F11); the e2e runner does not forward `EDR_*_API_KEY` to the browser process; tests use a recognizable dummy key value; T46 evidence: secret-pattern scan of tracked files, built-bundle check, git hygiene |
| TB-7 | Supply chain | compromised or vulnerable packages; install scripts; prebuilt native binaries; moderate advisories hidden by the high threshold | exact pins, committed lock file, `npm ci`, `ignore-scripts=true`, `npm audit --audit-level=high` gate (`PRJ-AUDIT`), each dependency a recorded MED-02 decision; full advisory list reviewed (moderate included) and package versions recorded by T46 and T47; `npm audit signatures` where supported; lock-file check that every `resolved` URL is on `https://registry.npmjs.org/` and every entry has `integrity`; committed `.npmrc` without auth token or alternate registry (T10-F18); accepted residual: resvg and esbuild prebuilt binaries trusted through the npm publisher and lock-file integrity hashes; browsers downloaded project-locally by the test runner only |

- Privacy: no personal data (riskProfile personalData none; PD-04, PD-05); nothing is logged beyond request method, route, status and duration; facts are team- and competition-level.
- Questions for the Security Reviewer (T10 design review, then T47 validation):
  1. Are the TB-1 controls (loopback binding, Host allow-list, custom header plus origin check, no CORS, CSP) sufficient against cross-site requests and DNS rebinding for a login-less local service, or is a per-launch secret token (for example generated at startup and injected into the served UI) needed? It would add a control, not weaken one.
  2. Is in-process parsing of provider JSON and of operator-supplied PNG or JPEG files, with schema validation, size caps and signature checks but without process isolation, acceptable for the MVP, or does it fall under HIGH-03 "isolation of untrusted-input processing" and need the Product Owner (see U-03)?
  3. Is the placeholder-only rule plus the content checks an adequate mitigation of RK-08 and RK-03, given that the AI never sees provider free text?
  4. Is the egress allow-list (origins from configured base URLs, HTTPS, no redirects, loopback HTTP only for local AI servers) adequate, and should real-provider responses be size-capped lower than 2 MiB?
  5. Is accepting the residual risk "any local process of the same user can call the API" consistent with PD-05, or should it be put to the Product Owner?
  6. Are the secret-handling controls of TB-6 sufficient, including the use of `node --env-file-if-exists=.env.local`?
- Answers from the security design review T10 (`docs/work-items/WI-1/security/design-review.md` section 5), applied above: Q1 no per-launch token needed, given the explicit allow-lists, `Origin: null` refusal and the T10-F04 controls; Q2 HIGH-03 decision class, risk LOW, recommendation Option A (U-03); Q3 adequate for numbers and team names with the T10-F05 hardening, with the T10-F06 residuals; Q4 adequate with the T10-F07 and T10-F08 details, caps 512 KiB and 256 KiB; Q5 within PD-05, wording corrected (T10-F19), re-raise triggers in `architecture.md` section 12.2; Q6 sufficient with T10-F10 and T10-F11.
- Validation: T47 validates the controls V-01 to V-30 of `docs/work-items/WI-1/security/design-review.md` section 9, on the T46 evidence pack extended by T10-F01.

## 5. Decisions

Classification: the decisions below are delegated to the architect by the brief (R-103 stack and R-400 to R-403, R-421 as AUTONOMOUS_DECISION items for the architect) and become approved architecture decisions when the architecture is verified (T11). Items that are not the architect's to decide are listed in section 8 as escalations. Each decision names its reversal cost.

### AD-01 Language and runtime: TypeScript on Node.js LTS
- Context: R-103 leaves the stack to the architect; R-105 needs strong runtime validation; R-108 local development; the framework CLI already needs Node.js on the host.
- Alternatives: Python (FastAPI) back end with a TypeScript front end (two toolchains, two test stacks, no shared schemas); a full-stack meta-framework (server components and routing conventions the MVP does not need); Go back end (no shared schemas with the UI).
- Choice: TypeScript (strict) end to end on a Node.js LTS line, version 24 or later, exact version pinned (`architecture.md` section 2.2).
- Tradeoffs: one ecosystem and shared runtime schemas versus fewer data-science libraries (not needed).
- Consequences: no new host installation; npm is the package manager.
- Requirements affected: R-103, R-105, R-107, R-108, R-109. Reversal cost: high (rewrite).

### AD-02 Package management and exact-version pinning policy
- Context: reproducible builds, supply-chain risk (TB-7), MED-02.
- Alternatives: pnpm or Yarn (need Corepack or a host installation); version ranges (non-reproducible).
- Choice: npm workspaces, exact versions only, committed lock file, `npm ci`, `save-exact`, `engine-strict`, `ignore-scripts`; Node.js pinned in `.nvmrc` and `engines`; dependency set added once by T15 and T16; each dependency a MED-02 decision with a clean audit.
- Tradeoffs: manual upgrades versus reproducibility.
- Consequences: a later dependency need is an escalation and a re-plan.
- Requirements affected: R-108, R-109. Reversal cost: low.

### AD-03 HTTP server: Fastify
- Context: JSON API plus static UI, hooks for the local-origin guard, low overhead.
- Alternatives: Express (weaker typing and hook model), Hono (lighter, fewer maintained plugins for static serving).
- Choice: Fastify with `@fastify/static` only.
- Tradeoffs: framework coupling of route modules.
- Consequences: route modules are Fastify plugins registered under `/api/v1`.
- Requirements affected: R-020, R-114. Reversal cost: medium.

### AD-04 Runtime validation and the API contract
- Context: R-105 (validate provider and inter-stage data), contract between UI and server.
- Alternatives: JSON-Schema-first with generated types; OpenAPI code generation.
- Choice: OpenAPI 3.1 as the declared contract; Zod schemas in `packages/contracts` mirroring it, used by server and UI; Zod for provider payloads and stage I/O; contract tests check parity and conformance.
- Tradeoffs: two representations kept in sync by tests versus a generator dependency.
- Consequences: `PRJ-CONTRACT` gate; contract changes follow `planning.md` section 3.
- Requirements affected: R-104, R-105, R-224. Reversal cost: medium.

### AD-05 Persistence: SQLite through `node:sqlite`, local files, hand-written migrations (R-403)
- Context: R-100 local-first, R-109 no infrastructure, R-043 history, R-044 traceability; one operator.
- Alternatives: `better-sqlite3` (native addon whose prebuilt download runs an install script, conflicting with `ignore-scripts`); JSON files (no constraints or transactions for the approval rules); PostgreSQL in a container (hosted infrastructure, R-109); an ORM (extra layer the schema does not need).
- Choice: `node:sqlite` (`DatabaseSync`) behind a `Db` port, STRICT tables, check constraints, numbered SQL migrations, repositories inside each module.
- Tradeoffs: `node:sqlite` is still marked as under active development in Node.js documentation; mitigated by the exact Node.js pin and the thin port (switching to `better-sqlite3` changes only `platform/db`).
- Consequences: no native dependency; single-process writes.
- Requirements affected: R-043, R-044, R-100, R-109, R-233, R-403. Reversal cost: low to medium.

### AD-06 Web UI: React with Vite and React Router
- Context: PD-08 requires a frontend; review UI with previews, states and polling.
- Alternatives: Vue or Svelte (equivalent capability); server-rendered pages (weaker interactive review); a full-stack meta-framework (unneeded server rendering).
- Choice: React, Vite, React Router, CSS modules, typed fetch client, no global state library.
- Tradeoffs: client-side app served by the same process.
- Consequences: Vite dev server bound to `127.0.0.1`; production build served by Fastify.
- Requirements affected: R-020, R-038, R-215, R-235. Reversal cost: medium to high.

### AD-07 Deterministic slide rendering: Satori and resvg with measured text layout (R-402)
- Context: R-035, R-036, R-213 require exact and deterministic fact-bearing text; R-238 exact dimensions; RK-04.
- Alternatives: headless Chromium screenshots of HTML templates (large runtime dependency, pixel output depends on system fonts); imperative canvas drawing (templates harder to maintain); generative imagery (rejected: non-deterministic, RK-04).
- Choice: versioned templates producing a render model with explicit lines measured from bundled fonts; Satori to SVG; resvg to PNG; fact-bearing text placed only from verified facts.
- Tradeoffs: Satori supports a CSS subset (flexbox), enough for the four slide types; Satori is pre-1.0, pinned exactly.
- Consequences: byte-identical PNGs for identical inputs; text fit is measurable for visual QA; no browser at run time.
- Requirements affected: R-030 to R-036, R-210 to R-213, R-238, R-402. Reversal cost: medium.

### AD-08 AI integration: one port, stub and OpenAI-compatible adapters, content stage only (R-401)
- Context: R-029 content drafting; R-106 replaceable providers; R-111 and SC-03 no purchase; RK-08.
- Alternatives: vendor SDK per provider (dependencies, lock-in); an agent framework (premature complexity); AI in research, verification or QA (rejected: non-deterministic facts).
- Choice: `AiTextProvider` with a stub (all tests and the default configuration) and an adapter for the OpenAI-compatible chat-completions protocol, usable with a hosted provider after PO authorization of any paid account or with a local model server without subscription; model identifier and endpoint are configuration.
- Tradeoffs: one protocol adapter may not cover every provider; a new adapter is a small task.
- Consequences: no network access in development or tests; no model name fixed by the design.
- Requirements affected: R-029, R-106, R-111, R-223, R-401. Reversal cost: low.

### AD-09 Sports-data integration: source registry with roles, acceptance and independence groups; fixture adapters now (R-400)
- Context: PD-01 and PD-02; providers not yet selected; SC-03, SC-04.
- Alternatives: hard-wire one provider now (premature, unauthorized); scrape public pages (terms and robustness risk).
- Choice: `SportsDataSource` port; sources configured with role, acceptance and independence group, one flagged as official publication; fixture adapter only in this plan; real adapters after the research (T13, T14) and the PO's selection and authorization.
- Tradeoffs: the MVP produced by this plan runs end to end on synthetic data only.
- Consequences: real data needs a follow-up task set (section 8, U-01).
- Requirements affected: R-022, R-046, R-047, R-106, R-110, R-111, R-241, R-400. Reversal cost: low.

### AD-10 Workflow execution: in-process sequential runner with persisted stage status
- Context: R-023 progress, R-104 testable stages, R-109.
- Alternatives: job queue with a broker (infrastructure); worker threads (not needed for one operator).
- Choice: in-process runner, one active run per project, run kinds `full` and `redraft`, interrupted runs failed at startup.
- Tradeoffs: a run stops if the process stops (restart is a new run).
- Consequences: UI polls run status.
- Requirements affected: R-023, R-104, R-203. Reversal cost: low.

### AD-11 Fact placeholders and deterministic substitution in generated text
- Context: R-027 (no invented values), R-036 (numbers never from a non-deterministic step), R-052 (exact official names), OD-01.
- Alternatives: let the AI write numbers and names and check them afterwards (numbers would come from the AI, against R-036); no AI text on slides (fails R-029).
- Choice: the AI writes numbers and team names only as placeholders; substitution from verified facts is deterministic; any remaining numeral, number word or name variant is flagged and blocks approval.
- Tradeoffs: stricter than OD-01 ("commentary states no unverified numbers"); some AI outputs will be flagged and regenerated.
- Consequences: provenance segments are exact; blocking (R-026) uses the referenced facts.
- Requirements affected: R-026 to R-028, R-035, R-036, R-052, R-207, R-208, R-237. Reversal cost: medium.

### AD-12 Visual QA as deterministic checks on the render model and the PNG
- Context: R-037, R-214, OD-09, AC-04.
- Alternatives: OCR on PNGs (heavy, error-prone); AI vision (non-deterministic, cost).
- Choice: five named checks; facts and names re-read from the database; text fit re-measured; dimensions read from the PNG header.
- Tradeoffs: checks the rendering inputs rather than reading pixels; sound because rendering is deterministic (AD-07).
- Consequences: seeded-defect tests are straightforward.
- Requirements affected: R-037, R-214, R-237, R-238, R-420. Reversal cost: low.

### AD-13 Approval bound to element versions; final approval bound to the version set
- Context: BR-09, R-405, R-406, R-240, OD-02.
- Alternatives: mutable approval flags on slides (loses history and version binding).
- Choice: immutable element versions; append-only approvals per version; final approval records the version set and its hash and becomes invalid on any change; all guards server-side.
- Tradeoffs: more rows; simple, auditable state.
- Consequences: regeneration affects one element only; export requires a valid final approval.
- Requirements affected: R-039, R-040, R-206, R-216, R-217, R-240, R-405, R-406. Reversal cost: medium.

### AD-14 Local-origin protection for a login-less loopback service
- Context: PD-05, SC-01, SC-02, R-114, RK-13, AC-11.
- Alternatives: rely on loopback binding alone (open to cross-site requests and DNS rebinding); add authentication (contradicts PD-05).
- Choice: controls of section 4 TB-1, including the development-mode rules (T10-F02, `architecture.md` section 12.1): explicit configured Host and Origin allow-lists of exact values that include the dev (5173), verification (4310) and demo (4320) ports only in the configurations that use them and are never derived from request headers; `trustProxy` false; Vite proxy `changeOrigin: false`; Vite `allowedHosts` not widened, `cors` default, `fs.strict` on, `fs.deny` keeping `.env*` and adding `data/**`; a Vite version without known advisories, checked explicitly. Also the T10-F04 additions: Fetch-Metadata refusal of cross-site and same-site `/api` requests, CORP and COOP `same-origin`, CSP `base-uri`, `form-action`, `object-src`, deny-by-default for every method other than GET and HEAD, `Origin: null` foreign. Owners: T16 (Vite settings and their unit test), T17 (configuration schema for the allow-lists), T19 (API guards and headers), T41 (integration tests of the development origin set).
- Tradeoffs: the UI must send the custom header; curl users must add it.
- Consequences: integration tests for each control (T19, T41).
- Requirements affected: R-113, R-114, R-234, R-235. Reversal cost: low (adding controls); removing any is HIGH-03.

### AD-15 Configuration and secrets
- Context: R-106, R-223 (provider swap by configuration), RK-12, AC-08.
- Alternatives: a configuration UI (not needed); secrets in a local JSON file (risk of commit).
- Choice: committed, schema-validated JSON configuration without secrets; secrets only from environment variables loaded from a git-ignored `.env.local`.
- Tradeoffs: provider changes need a restart.
- Consequences: tests generate their own configuration files in temporary directories.
- Requirements affected: R-102, R-106, R-223, R-226, R-401. Reversal cost: low.

### AD-16 Test and quality tooling
- Context: R-107, R-225, R-241; e2e and accessibility gates for the UI.
- Alternatives: Jest (slower ESM and TypeScript setup); Cypress (heavier, separate runner).
- Choice: Vitest projects `unit`, `integration`, `contract`; Playwright with axe for e2e and accessibility; ESLint, typescript-eslint and Prettier; `npm audit`. A shared Vitest setup fails any non-loopback network request; Chromium is downloaded into `.cache/ms-playwright` under the worktree.
- Tradeoffs: the first e2e run downloads a browser (network).
- Consequences: gates of section 7.2.
- Requirements affected: R-107, R-225, R-241. Reversal cost: low.

### AD-17 Export format and layout (R-421)
- Context: R-041, R-218, R-304; Instagram-accepted formats.
- Alternatives: JPEG (lossy, artefacts on text); a ZIP archive (an extra step for manual upload).
- Choice: PNG (lossless) per slide named `01.png` to `NN.png` in carousel order at the configured size; `caption.txt` UTF-8 with caption and hashtags; `manifest.json` with versions, hashes and fact IDs; one folder per export under the data directory.
- Tradeoffs: larger files than JPEG; acceptability of PNG for Instagram upload is confirmed against Instagram's published specification at implementation (R-303).
- Consequences: traceability travels with the export.
- Requirements affected: R-041, R-218, R-221, R-421. Reversal cost: low.

### AD-18 Team identity and official names
- Context: OD-12, R-426, RK-14.
- Alternatives: fuzzy matching (risk of wrong merges); operator matching at run time (comes close to manual verification, R-412).
- Choice: identity map per competition and season plus exact normalized-name equality; unmatched teams are not verified; official name from the official-publication source; all source name forms kept as aliases for variant detection.
- Tradeoffs: a new season needs a map file (configuration change by a task).
- Consequences: R-237 checks rely on the alias table.
- Requirements affected: R-035, R-052, R-237, R-424, R-426. Reversal cost: low.

### AD-19 Data directory and retention
- Context: OD-08, R-043, R-100.
- Alternatives: storing images as database BLOBs (large database, harder export).
- Choice: `data/` (or `EDR_DATA_DIR`) with database, renders, exports and brand assets; nothing deleted; hashes in the database.
- Tradeoffs: disk use grows without expiry (accepted by OD-08).
- Consequences: backups are a copy of one directory.
- Requirements affected: R-043, R-100, R-419. Reversal cost: low.

### AD-20 Contract declaration scope
- Context: no contract is declared; the UI and server meet at the HTTP API.
- Alternatives: declare also the provider ports (overhead for an internal seam); declare nothing (no contract gate).
- Choice: declare `http-api` only (section 2.2); keep `provider-ports.md` as an architecture interface.
- Tradeoffs: provider ports can change by task without the contract procedure.
- Consequences: `PRJ-CONTRACT` and `PRJ-CONTRACT-ID` gates.
- Requirements affected: R-104, R-106. Reversal cost: low.

## 6. Task plan

`docs/work-items/WI-1/architecture/task-plan.md`: 37 tasks, T12 to T48 (34 IMPL, 3 VERIFY). By agent: backend-developer 16, frontend-developer 6, qa-engineer 8 (6 IMPL, 2 VERIFY), architect 4, Orchestrator 2 (both IMPL), security-reviewer 1 (VERIFY). Phases as dependency waves: MVP-P1 T12 to T28, MVP-P2 T29 to T31, MVP-P3 T32 to T36, MVP-P4 T37 to T40, verification T41 to T48. Eleven parallel waves (task-plan "Parallelism"). Critical path (14 tasks after T11): T15, T17, T19, T27, T33, T34, T35, T37, T38, T42, T45, T46, T47, T48. The plan includes the security-reviewer VERIFY task T47 on the evidence pack of the qa-engineer VERIFY task T46, and the final gate-run VERIFY task T48 (qa-engineer), which depends on every other task and is the last VERIFY task. The only protected path in the plan, `.orchestrate/config.json`, is owned by name by the Orchestrator task T25.

## 7. Test-strategy delta

### 7.1 Test conventions and root scripts (created by T15)

- Unit tests: `*.test.ts` and `*.test.tsx` next to the code in every workspace (web tests run in jsdom). Integration tests: `*.int.test.ts` next to server code and every file under `apps/server/test/integration/`. Contract tests: `apps/server/test/contract/`. End-to-end and accessibility: `e2e/tests/` (accessibility tests tagged `@a11y`). Integration tests use temporary data directories and generated configuration files, removed after the run.
- The Vitest setup installs a network guard at socket level (`net.Socket.prototype.connect`, `net.connect` and undici's global dispatcher, not only `globalThis.fetch`): any connection to a non-loopback address fails the test (R-241, R-225, T10-F08). Tests that need a key use a recognizable dummy value, so that the T46 secret scan and bundle check can look for it (T10-F11).
- Root scripts (exact commands in `package.json` are chosen by T15 with these semantics):

| Script | Semantics |
|--------|-----------|
| `typecheck` | type-check every workspace without writing into the source tree; non-zero exit on any type error |
| `lint` | ESLint over all workspaces, `e2e`, `fixtures` and configuration files, then Prettier check. Security rules (no new dependency): `no-restricted-globals` (`fetch`) and `no-restricted-imports` (`node:http`, `node:https`, `node:net`, `node:tls`, `undici`, `http`, `https`, `net`, `tls`) for server code except `apps/server/src/platform/net/**`, with no exception in `apps/server/src/modules/export/**` (T10-F08); `no-restricted-syntax` banning `dangerouslySetInnerHTML` in the web app (T10-F16) and template literals containing `${` passed to `prepare` or `exec` (T10-F14) |
| `test:unit` | Vitest project `unit` (all workspaces) |
| `test:integration` | Vitest project `integration` |
| `test:contract` | Vitest project `contract` |
| `build` | build `packages/contracts`, `apps/server` and `apps/web` |
| `test:e2e` | build, then `node e2e/run.mjs` excluding `@a11y` |
| `test:a11y` | build, then `node e2e/run.mjs` with `@a11y` only |
| `dev` | API in watch mode on `127.0.0.1:4300` and Vite on `127.0.0.1:5173` |
| `start` | built server on `127.0.0.1:4300` |

### 7.2 Project gates to add (T25, in `.orchestrate/config.json`, after the framework-mandatory gates, in this order)

All: `kind` `command`, `builtin` null, `procedure` null, `required` true, `status` `configured`, `decision` null, `decisionLevel` null, `countsPattern` null, `origin` `{ "kind": "architecture", "evidence": ["docs/work-items/WI-1/architecture/architecture-delta.md", "package.json"] }` (contract identity: `kind` `builtin`, `builtin` `contract-identity`, `command` null).

| ID | Category | Command | When | Paths | Timeout (s) | Reason |
|----|----------|---------|------|-------|-------------|--------|
| PRJ-INSTALL | other | `npm ci` | affected, final | (none: always selected; runs first so later gates have `node_modules`) | 600 | clean install from the lock file |
| PRJ-TYPECHECK | typecheck | `npm run typecheck` | affected, final | `apps/**`, `packages/**`, `e2e/**`, `fixtures/**`, `package.json`, `tsconfig.base.json`, `tsconfig.json` | 300 | type safety |
| PRJ-LINT | lint | `npm run lint` | affected, final | `apps/**`, `packages/**`, `e2e/**`, `fixtures/**`, `config/**`, `eslint.config.mjs`, `.prettierrc.json` | 300 | static analysis and format |
| PRJ-UNIT | unit | `npm run test:unit` | affected, final | `apps/**`, `packages/**`, `fixtures/**`, `config/**`, `assets/**`, `vitest.config.ts`, `vitest.setup.ts` | 600 | unit tests and business rules (R-107) |
| PRJ-INTEGRATION | integration | `npm run test:integration` | affected, final | `apps/server/**`, `packages/**`, `fixtures/**`, `config/**`, `assets/**`, `vitest.config.ts`, `vitest.setup.ts` | 900 | workflow, data and API on fixtures (R-225) |
| PRJ-CONTRACT | contract | `npm run test:contract` | affected, final | `contracts/**`, `packages/contracts/**`, `apps/server/src/**`, `apps/server/test/contract/**` | 300 | contract parity and conformance |
| PRJ-CONTRACT-ID | contract | builtin `contract-identity` | affected, final | `contracts/**` | 120 | declared contract hash matches |
| PRJ-BUILD | build | `npm run build` | affected, final | `apps/**`, `packages/**`, `package.json` | 600 | production build |
| PRJ-E2E | e2e | `npm run test:e2e` | affected, final | `apps/web/**`, `apps/server/src/**`, `e2e/**`, `config/**` | 1200 | browser journeys on the built app |
| PRJ-A11Y | accessibility | `npm run test:a11y` | affected, final | `apps/web/**`, `e2e/**` | 900 | axe checks on every page |
| PRJ-AUDIT | security-audit | `npm audit --audit-level=high` | affected, final | `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` | 300 | known vulnerabilities in dependencies |

Notes: `PRJ-INSTALL`, `PRJ-AUDIT` and the first `PRJ-E2E` or `PRJ-A11Y` run need network access to the npm registry and the browser download host; this is tooling access, not product access (R-222). Gate runs bind the app to `127.0.0.1:4310` (verification port). A task whose owned paths match no gate path (documentation tasks) selects every required affected gate, as `quality-gates.md` defines.

### 7.3 Suites and gates

| Suite or gate (configured ID) | Change | Runs as |
|-------------------------------|--------|---------|
| FW-TRACKER, FW-CONFIG | none (framework) | affected, final |
| FW-SECURITY | verdict from T47 | final |
| FW-AC | coverage of R-200 to R-242 by DONE tasks | final |
| PRJ-INSTALL | new | affected, final |
| PRJ-TYPECHECK | new | affected, final |
| PRJ-LINT | new | affected, final |
| PRJ-UNIT | new: module unit tests (T15 to T40), fixture validation (T23) | affected, final |
| PRJ-INTEGRATION | new: module `*.int.test.ts`, platform, verification and delivery suites (T41, T42) | affected, final |
| PRJ-CONTRACT | new: parity (T20), conformance (T43) | affected, final |
| PRJ-CONTRACT-ID | new | affected, final |
| PRJ-BUILD | new | affected, final |
| PRJ-E2E | new: smoke (T24), journeys (T44) | affected, final |
| PRJ-A11Y | new: axe checks (T24, T44) | affected, final |
| PRJ-AUDIT | new | affected, final |

## 8. Unresolved issues

| Issue | Impact | Classification | Recommendation |
|-------|--------|----------------|----------------|
| U-01 Real provider adapters are not in this plan; providers are selected only after the research (T13, T14) and any paid service needs authorization (R-111). Selecting sources whose terms may restrict redistribution touches HIGH-05 and HIGH-07 | The MVP delivered by T12 to T48 runs end to end on synthetic fixtures and the stub AI only; real matchday content needs a follow-up | HIGH (Product Owner) after T14; planning the adapters afterwards is MEDIUM (MED-05) or a new work item | Accept the fixture-complete MVP for this work item; after T14, batch the provider selection and cost authorization to the PO, then add one adapter task per selected source and AI provider |
| U-02 Adoption of the dependency set (`architecture.md` section 2.1), the project-local Chromium download and the OFL fonts | Needed before T15, T16, T24, T34 can complete | MEDIUM (MED-02 per dependency with exact pin and clean audit; MED-03 tooling without host installation) | Record one Orchestrator decision per dependency when T15 and T16 report exact versions; record the browser cache location and the fonts with their licence |
| U-03 Untrusted-input processing (provider JSON, operator images) runs in process with validation and caps but without isolation (T10-F20) | Until decided, T33 (images) waits; T21 processes only committed synthetic fixtures; per the reviewer the Orchestrator may judge that only T33 truly waits | **HIGH-03, pending Product Owner decision in the stage-2 batch** (confirmed by the T10 review, section 6). Not decided here | Reviewer and architect recommend Option A (accept in-process processing for WI-1's scope with the compensating controls T10-F07, F08, F09, F12; any real sports adapter, hosted AI provider or new input type needs a new security review and PO decision on isolation); alternatives B (worker thread) and C (child process) in design-review.md section 5 Q2. T47 checks the recorded decision (V-30) |
| U-04 First contract-evolution policy (section 2.1: additive-only within v1, breaking changes need a new major path and a PO decision) | Governs every later change of `http-api` | **HIGH-06, pending Product Owner decision in the stage-2 batch** (conservative reading of "any change to the contract-evolution policy"; the T10 review has no security objection). Not decided here | Recommend the policy as written |
| U-05 Acceptance of the `http-api` contract proposal as corrected by T10-F03 and T10-F17 (this correction) | T20 promotes it; T25 declares it | MEDIUM (MED-01; every Contract Safety condition holds, confirmed by T10 section 7) | Orchestrator accepts after this correction is integrated and records an OD decision |
| U-06 Template management: templates are versioned code with a registry, list and preview in the UI; editing templates in the UI is not provided | Interpretation of US-10 "manage ... carousel templates" (R-010) | MEDIUM (MED-04, reversible default within scope) | Orchestrator records the default; template editing in the UI can be added later |
| U-07 The verification source and the official publication may be the same source; then a dispute can only be resolved by a later retrieval showing agreement (R-423 "same source") | Possibly frequent blocked content (RK-02) | Informational; the PD-02 rule is applied as decided | The research (T14) states whether an independent official publication channel exists; the PO decides at provider selection |
| U-08 No official source may permit automated access | PD-01's verification source or PD-02's consultation could not be automated | HIGH-07 if it occurs | Reported by T14; no workaround against terms |
| U-09 Research needs web access that the architect role does not have | T14 depends on T13 (Orchestrator) capturing public pages | Environment | If the Orchestrator cannot fetch pages, T13 is BLOCKED (environment); only T14 and T45 wait |
| U-10 Host Node.js version: the design needs an LTS line 24 or later with `node:sqlite` | T15 cannot pin otherwise | Environment | T15 records the host version; if absent, escalate; nothing is installed on the host |
| U-11 `maxSlidesPerCarousel` default and PNG acceptability depend on Instagram's current published specification | Carousel split and export format | LOW within T17 and T38 (configuration value with source noted) | Check the published specification at implementation and record the source in the configuration comment or task report |
| U-12 Brand values and assets (official colours, fonts, logo, KETSI images) are not provided (R-301, R-418) | Templates use provisional values (OD-07); slides render without logo and mascot | Product Owner input, not a decision | Request with the stage report; register assets through the brand page when supplied |

## 9. Risks

| ID | Risk | Mitigation in this design |
|----|------|---------------------------|
| RK-01, RK-07 | Provider terms or costs | research before selection (T13, T14), no purchase (SC-03), provider abstraction (AD-08, AD-09) |
| RK-02 | Two-source rule blocks content often | clear reasons and dispute records; re-run; U-07 |
| RK-03, RK-08 | Invented numbers or names; prompt injection | placeholders and content checks (AD-11), structured data only to the AI, schema-validated output (TB-3) |
| RK-04 | Distorted scores in images | deterministic rendering (AD-07), visual QA (AD-12) |
| RK-05 | Badges and marks | no badge or mark asset kind; empty slots (PD-03) |
| RK-06 | Instagram format changes | dimensions and slide limit in configuration (U-11) |
| RK-09 | Unfinished matches | only verified finished matches get result slides (OD-05) |
| RK-10 | Premature complexity | single process, SQLite, no queue, configuration-only extension points (`architecture.md` section 13) |
| RK-12 | Credential leakage | TB-6 controls, T46 hygiene evidence |
| RK-13 | Local cross-origin requests | TB-1 controls (AD-14) |
| RK-14 | Team identity mismatches | identity map, exact normalized match, unmatched not verified (AD-18) |
| AR-01 | `node:sqlite` API changes between Node.js versions | exact Node.js pin; `Db` port isolates it (AD-05) |
| AR-02 | Satori CSS subset or pre-1.0 changes | exact pin; render model decoupled from Satori; templates tested by hash |
| AR-03 | Text measurement differences between `opentype.js` and Satori's own layout | each line rendered as a separate non-wrapping node; text-fit check uses the same fonts; PNG-hash and overflow tests (T34, T35) |
| AR-04 | Network needed by `npm ci`, `npm audit` and the first browser download during gate runs | recorded in `localEnvironment.notes` (T25); failures handled as environment issues |
| T10 residuals R1 to R8 | Local processes of any OS account (R1); in-process image decoding (R2, U-03); person names and misstated relations with a real model (R3); instruction text in an official team name (R4); cross-site timing probes (R5); prebuilt native binaries (R6); moderate advisories under the gate threshold (R7); metadata in stored brand originals (R8) | documented in `docs/work-items/WI-1/security/design-review.md` section 10; R1 re-raise triggers in `architecture.md` section 12.2; R2 is the pending PO decision U-03; R3 and R4 are production-blocking until the follow-up measures of `architecture.md` section 8.3 and `contracts/provider-ports.md` section 1; R7 reviewed by T47 from [audit-full] |

## 10. Correction for the security design review T10 (attempt 2)

Verdict of T10: FAIL, correctable (`docs/work-items/WI-1/security/design-review.md`). Where each finding is applied:

| Finding | Disposition | Applied in |
|---------|-------------|------------|
| T10-F01 | must-fix | `task-plan.md` T46 (18 commands incl. platform unit tests, brand, rendering, export and review module tests, module integration tests, web security tests, lint, tracked-file secret scan, built-bundle secret check, lock-file check, package versions, full advisory list, registry signatures; Verification line checks every PASS-checked file) and T47 (validates V-01 to V-30 of design-review.md section 9 and NV-1 to NV-6); `task-plan.md` T41 adds `scripts/security-checks.mjs` used by T46; this delta section 4 (validation note) |
| T10-F02 | must-fix | this delta section 4 TB-1 (development mode) and AD-14; `architecture.md` sections 5.1 and 12.1; `task-plan.md` T15 (full advisory report), T16 (Vite settings, proxy `changeOrigin: false`, `fs.strict`, `fs.deny` with `data/**`, `allowedHosts`, `cors`, `envPrefix`, `envDir`, advisory-free Vite with `npm ls vite` in Verification), T17 (allow-list schema), T19 (configured allow-lists, `trustProxy` false), T41 (development origin tests) |
| T10-F03 | must-fix | `contracts/http-api.openapi.yaml` (schemas `Uuid`, `Slug`, `SourceId`, `MatchKey`, `Label`; every ID path parameter and body ID; `maxLength` on every request string; `label` excludes `\p{Cc}` and `\p{Cf}`); this delta sections 2.1 and 2.2; `task-plan.md` T20, T43 |
| T10-F04 | recommended | this delta section 4 TB-1 and AD-14; contract description and preview caching note; `task-plan.md` T19, T27, T34, T41 |
| T10-F05 | should-fix | `architecture.md` section 8.3; this delta TB-3; `task-plan.md` T23, T32 |
| T10-F06 | should-fix (fixture correction now, residual documented) | `contracts/provider-ports.md` sections 1 and 2; `architecture.md` section 8.3; this delta TB-2, TB-3 and section 9; `task-plan.md` T21, T22, T23, T32 |
| T10-F07 | should-fix (512 KiB sports, 256 KiB AI, 2 MiB maximum) | `contracts/provider-ports.md` sections 1, 2 and 4; `architecture.md` section 4 (platform/net); this delta TB-2; `task-plan.md` T17, T22 |
| T10-F08 | should-fix | `contracts/provider-ports.md` section 4; this delta TB-2 and section 7.1 (lint rules, socket-level guard); `task-plan.md` T15, T17, T38 |
| T10-F09 | recommended | `architecture.md` section 9; this delta TB-4; `task-plan.md` T34 |
| T10-F10 | should-fix | contract schema `Failure` and `Problem` limits; `data-model.md` sections 2 and 3.1; `architecture.md` section 6; `contracts/provider-ports.md` sections 1 and 2; this delta TB-6; `task-plan.md` T18, T19, T21, T22, T27, T41 |
| T10-F11 | should-fix | `architecture.md` sections 12.1 and 12.2; this delta TB-6 and section 7.1; `task-plan.md` T15, T16, T19, T24, T27 |
| T10-F12 | should-fix | this delta TB-4; contract `registerBrandAsset` and `getBrandAssetFile` descriptions; `task-plan.md` T19, T33 |
| T10-F13 | should-fix | `data-model.md` section 2; `architecture.md` sections 9 and 11.2; this delta TB-5; `task-plan.md` T19, T33, T34, T38 |
| T10-F14 | should-fix | `data-model.md` section 2; this delta section 7.1 (lint rule); `task-plan.md` T15, T18 |
| T10-F15 | should-fix | `data-model.md` section 2; `architecture.md` sections 11.1 and 11.2; `task-plan.md` T18, T37, T38 |
| T10-F16 | should-fix | `contracts/provider-ports.md` section 1; contract `Evidence.sourceRef`; this delta section 7.1 (lint rule); `task-plan.md` T15, T16 (`SafeReference`), T31, T40 |
| T10-F17 | recommended | `contracts/http-api.openapi.yaml` (`FactKindValue`, `FactValue`, `FactSubject`, closed `Evidence` and `Dispute` values, per-check `QaResult`; 421 on every operation; 403 and 415 on every mutating operation; 413 where a body exists); `task-plan.md` T43 |
| T10-F18 | should-fix | this delta TB-7; `task-plan.md` T15, T41 (`lockfile`, `audit-report`), T46 |
| T10-F19 | recommended | this delta TB-1 residual and section 9; `architecture.md` section 12.2; `task-plan.md` T15 (`docs/local-setup.md`) |
| T10-F20 | PO decision | section 8, U-03 (pending, not decided here) |
| T10-F21 | recommended | `data-model.md` sections 2 and 5 (T18 owns migration `0001_initial.sql` and the R-233 schema test) |

No task was renumbered or added, and no dependency changed; T41 gains one owned file (`scripts/security-checks.mjs`), which no other task owns.
