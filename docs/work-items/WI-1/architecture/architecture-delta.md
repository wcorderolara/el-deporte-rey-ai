# WI-1 Architecture Delta

- Author: architect (task WI-1-T09). Date: 2026-10-27. Mode: full (greenfield repository with no code; the work item adds the whole system, new trust boundaries to external sports-data and AI providers and a new persistence model).
- Inputs: requirements `docs/work-items/WI-1/requirements.md`; records `docs/work-items/WI-1/requirements.json` (140 records, acceptance criteria R-200 to R-242); intake record `docs/work-items/WI-1/intake/intake-record.json` (S-000, S-001, both precedence level 1, no technical specification); source of truth `.orchestrate/source-of-truth.md` sections 3 to 5 (PD-01 to PD-09, BR-01 to BR-11, SC-01 to SC-04); tracker Decisions OD-01 to OD-12; configuration `.orchestrate/config.json` (no contracts, framework-mandatory gates only, concurrency 5, risk level standard, personal data none). Delegated decisions: R-103 (stack), R-400 (sports-data provider), R-401 (AI provider), R-402 (rendering), R-403 (storage), R-421 (export formats).
- Full-mode documents in this directory: `architecture.md` (components, stack, workflow, verification pipeline, rendering, state machine, export, traceability, local environment), `data-model.md` (persistence), `contracts/http-api.openapi.yaml` (proposed HTTP contract), `contracts/provider-ports.md` (internal provider and stage interfaces, fixture formats), `provider-research-plan.md` (PD-01 research deliverable plan), `task-plan.md`. Decisions are recorded once, in section 5 below; traceability uses the tracker's acceptance-criteria lines and the coverage table of `task-plan.md`.
- Revision T11G (architect, 2026-10-27, delta mode on the approved T09 architecture): PD-12, PD-13 and PD-14 (sources S-003, S-004), tracker decisions OD-16 to OD-22, requirement records R-011 to R-014, R-053 to R-077, R-118 to R-141, R-243 to R-291, R-312 to R-319, R-429 to R-440 and the amended R-046, R-110, R-111, R-116, R-400. The change is recorded in section 11 (affected components, contract delta with Contract Safety, data delta, security delta with questions for T11H, decisions AD-21 to AD-34, plan summary, test-strategy delta, unresolved issues, risks, the football-data.org facts used). Sections 1 to 10 keep the T09 text; where T11G amends it, the amended passage says so and points to section 11. Every decision AD-01 to AD-20 and every T10 finding reference is preserved.

## 1. Affected components

Every component is new. Code paths are those the task plan creates. T11G changes and additions: section 11.1.

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
- T11G: the proposal accepted by OD-14 is revised for PD-12, PD-13 and PD-14 (`info.version` `1.0.0-proposed.2`); diff summary and Contract Safety assessment of the revision in section 11.2; the Orchestrator re-accepts it (MED-01) after the T11H review, before T20 promotes it.

### 2.3 Internal interfaces not proposed for declaration

`contracts/provider-ports.md` (sports-data port, AI port, module and stage kit, egress client, display formatting, fixture formats) is an architecture-level interface (precedence level 3). Recommendation: do not declare it in `contracts` now; it is internal to one process, covered by unit tests, and replaceable without affecting the UI. Declare it later if a provider adapter is developed outside this repository.

## 3. Data delta

T11G changes: section 11.3. New persistence model, specified in `data-model.md`: one SQLite database (`node:sqlite`, STRICT tables, foreign keys, WAL) and a local data directory for rendered slides, exports and brand assets; migration `0001_initial.sql` with tables `schema_migrations`, `projects`, `workflow_runs`, `stage_runs`, `sources`, `teams`, `team_aliases`, `observations`, `facts`, `fact_evidence`, `disputes`, `content_drafts`, `carousels`, `elements`, `element_versions`, `element_fact_refs`, `qa_results`, `approvals`, `final_approvals`, `exports`, `export_files`, `brand_assets`, with the check constraints and indexes listed there. Data-handling rules: mandatory source attribution on observations; verified facts must carry a value; append-only approvals; no deletion (OD-08); no player-level, user-account or secret data (R-112, R-113, R-233), enforced by allow-list provider schemas and a schema test; file paths built from generated IDs and confined to the data directory.

## 4. Security delta

- T11G changes to TB-2 and TB-6 and the new boundary TB-8 (manual imports): section 11.4.
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
- Amended by T11G: PD-12 selects the first real adapter (FootballDataProvider, T49) and PD-13 adds MANUAL_DATA (T50); the `SportsDataSource.fetchMatchday` port becomes the ingestion port of AD-22, roles, acceptance and independence groups are kept, and sources gain a data mode and a publication permission (AD-28). U-01 is resolved by PD-12 and PD-13.

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
- Amended by T11G (AD-30): the sports-data secret is `FOOTBALL_DATA_API_TOKEN` as PD-12 states (a Product Owner decision, precedence level 1, wins over the T09 naming `EDR_SOURCE_<ID>_API_KEY`); it is read only by the football-data adapter and never enters the configuration object.

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
- Amended by T11G: identity maps are optional; competitions discovered at run time use exact normalized-name matching, and canonical team IDs are slugs derived by the verification stage (T10-A1-06).

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

T11G update: 42 tasks, T12 to T53; summary in section 11.6 and the "Reconciliation (T11G)" section of `task-plan.md`. T09 text follows. `docs/work-items/WI-1/architecture/task-plan.md`: 37 tasks, T12 to T48 (34 IMPL, 3 VERIFY). By agent: backend-developer 16, frontend-developer 6, qa-engineer 8 (6 IMPL, 2 VERIFY), architect 4, Orchestrator 2 (both IMPL), security-reviewer 1 (VERIFY). Phases as dependency waves: MVP-P1 T12 to T28, MVP-P2 T29 to T31, MVP-P3 T32 to T36, MVP-P4 T37 to T40, verification T41 to T48. Eleven parallel waves (task-plan "Parallelism"). Critical path (14 tasks after T11): T15, T17, T19, T27, T33, T34, T35, T37, T38, T42, T45, T46, T47, T48. The plan includes the security-reviewer VERIFY task T47 on the evidence pack of the qa-engineer VERIFY task T46, and the final gate-run VERIFY task T48 (qa-engineer), which depends on every other task and is the last VERIFY task. The only protected path in the plan, `.orchestrate/config.json`, is owned by name by the Orchestrator task T25.

## 7. Test-strategy delta

### 7.1 Test conventions and root scripts (created by T15)

- Unit tests: `*.test.ts` and `*.test.tsx` next to the code in every workspace (web tests run in jsdom). Integration tests: `*.int.test.ts` next to server code and every file under `apps/server/test/integration/`. Contract tests: `apps/server/test/contract/`. End-to-end and accessibility: `e2e/tests/` (accessibility tests tagged `@a11y`). Integration tests use temporary data directories and generated configuration files, removed after the run.
- The Vitest setup installs a network guard at socket level (`net.Socket.prototype.connect`, `net.connect` and undici's global dispatcher, not only `globalThis.fetch`): any connection to a non-loopback address fails the test (R-241, R-225, T10-F08). Tests that need a key use a recognizable dummy value, so that the T46 secret scan and bundle check can look for it (T10-F11).
- Root scripts (exact commands in `package.json` are chosen by T15 with these semantics):

| Script | Semantics |
|--------|-----------|
| `typecheck` | type-check every workspace without writing into the source tree; non-zero exit on any type error |
| `lint` | ESLint over all workspaces, `e2e`, `fixtures`, `scripts` (T10-A1-03) and configuration files, then Prettier check. Security rules (no new dependency): `no-restricted-globals` (`fetch`) and `no-restricted-imports` (`node:http`, `node:https`, `node:net`, `node:tls`, `undici`, `http`, `https`, `net`, `tls`) for server code except `apps/server/src/platform/net/**`, with no exception in `apps/server/src/modules/export/**` and `apps/server/src/modules/imports/**` (T10-F08); `no-restricted-syntax` banning `dangerouslySetInnerHTML` in the web app (T10-F16) and template literals containing `${` passed to `prepare` or `exec` (T10-F14); T11G provider-identifier rule (AD-31, R-289): string and template literals equal to `CL` or containing `football-data`, `api.football-data.org` or `champions` (case-insensitive), and the numeric or string literal `2001`, are errors in `apps/**` and `packages/**` except `apps/server/src/providers/sports/adapters/**` and `apps/server/scripts/**`; imports of `**/adapters/football-data/**` and `**/adapters/manual/**` are errors outside `apps/server/src/providers/sports/adapters/**` |
| `test:unit` | Vitest project `unit` (all workspaces, plus `scripts/**/*.test.mjs` and `apps/server/test/static/**`) |
| `test:integration` | Vitest project `integration` |
| `test:contract` | Vitest project `contract` |
| `build` | build `packages/contracts`, `apps/server` and `apps/web` |
| `test:e2e` | build, then `node e2e/run.mjs` excluding `@a11y` |
| `test:a11y` | build, then `node e2e/run.mjs` with `@a11y` only |
| `dev` | API in watch mode on `127.0.0.1:4300` and Vite on `127.0.0.1:5173` |
| `start` | built server on `127.0.0.1:4300` |
| `test:live` (T11G) | Vitest project `live` (`**/*.live.test.ts`, excluded from `unit` and `integration`); every test skipped unless `EDR_LIVE_TESTS=1` and `FOOTBALL_DATA_API_TOKEN` are set; never in a gate (R-135, R-258) |
| `probe:football-data` (T11G) | build the server, then run the compiled capability probe with `node --env-file-if-exists=.env.local`; arguments `--out <file>`; never in a gate (R-259) |

### 7.2 Project gates to add (T25, in `.orchestrate/config.json`, after the framework-mandatory gates, in this order)

All: `kind` `command`, `builtin` null, `procedure` null, `required` true, `status` `configured`, `decision` null, `decisionLevel` null, `countsPattern` null, `origin` `{ "kind": "architecture", "evidence": ["docs/work-items/WI-1/architecture/architecture-delta.md", "package.json"] }` (contract identity: `kind` `builtin`, `builtin` `contract-identity`, `command` null).

| ID | Category | Command | When | Paths | Timeout (s) | Reason |
|----|----------|---------|------|-------|-------------|--------|
| PRJ-INSTALL | other | `npm ci` | affected, final | (none: always selected; runs first so later gates have `node_modules`) | 600 | clean install from the lock file |
| PRJ-TYPECHECK | typecheck | `npm run typecheck` | affected, final | `apps/**`, `packages/**`, `e2e/**`, `fixtures/**`, `package.json`, `tsconfig.base.json`, `tsconfig.json` | 300 | type safety |
| PRJ-LINT | lint | `npm run lint` | affected, final | `apps/**`, `packages/**`, `e2e/**`, `fixtures/**`, `config/**`, `scripts/**`, `eslint.config.mjs`, `.prettierrc.json` | 300 | static analysis, format and the provider-identifier rule (R-289) |
| PRJ-UNIT | unit | `npm run test:unit` | affected, final | `apps/**`, `packages/**`, `fixtures/**`, `config/**`, `assets/**`, `scripts/**`, `vitest.config.ts`, `vitest.setup.ts` | 600 | unit tests and business rules (R-107) |
| PRJ-INTEGRATION | integration | `npm run test:integration` | affected, final | `apps/server/**`, `packages/**`, `fixtures/**`, `config/**`, `assets/**`, `vitest.config.ts`, `vitest.setup.ts` | 900 | workflow, data and API on fixtures (R-225) |
| PRJ-CONTRACT | contract | `npm run test:contract` | affected, final | `contracts/**`, `packages/contracts/**`, `apps/server/src/**`, `apps/server/test/contract/**` | 300 | contract parity and conformance |
| PRJ-CONTRACT-ID | contract | builtin `contract-identity` | affected, final | `contracts/**` | 120 | declared contract hash matches |
| PRJ-BUILD | build | `npm run build` | affected, final | `apps/**`, `packages/**`, `package.json` | 600 | production build |
| PRJ-E2E | e2e | `npm run test:e2e` | affected, final | `apps/web/**`, `apps/server/src/**`, `e2e/**`, `config/**` | 1200 | browser journeys on the built app |
| PRJ-A11Y | accessibility | `npm run test:a11y` | affected, final | `apps/web/**`, `e2e/**` | 900 | axe checks on every page |
| PRJ-AUDIT | security-audit | `npm audit --audit-level=high` | affected, final | `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` | 300 | known vulnerabilities in dependencies |

T11G notes: `scripts/**` is added to PRJ-LINT and PRJ-UNIT (T10-A1-03); the new modules (`modules/imports`, `providers/sports/adapters/*`, `apps/server/scripts`) and the new fixture directories are already covered by `apps/**` and `fixtures/**`; no gate runs `test:live` or `probe:football-data`, and no gate needs `FOOTBALL_DATA_API_TOKEN` or network access to a sports-data provider (R-135, R-257, R-258).

Notes: `PRJ-INSTALL`, `PRJ-AUDIT` and the first `PRJ-E2E` or `PRJ-A11Y` run need network access to the npm registry and the browser download host; this is tooling access, not product access (R-222). Gate runs bind the app to `127.0.0.1:4310` (verification port). A task whose owned paths match no gate path (documentation tasks) selects every required affected gate, as `quality-gates.md` defines.

### 7.3 Suites and gates

| Suite or gate (configured ID) | Change | Runs as |
|-------------------------------|--------|---------|
| FW-TRACKER, FW-CONFIG | none (framework) | affected, final |
| FW-SECURITY | verdict from T47 | final |
| FW-AC | coverage of the active acceptance criteria R-200 to R-291 (R-201, R-210, R-239 superseded by R-243, R-285, R-284) by DONE tasks | final |
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

Status at T11G: U-01 resolved by PD-12 and PD-13 (FootballDataProvider T49, ManualDataProvider T50); U-03 decided by PD-10 (its condition SC-05 now applies within WI-1: U-17); U-04 decided by PD-11; U-05 decided by OD-14 (re-acceptance of the revised proposal: U-21); U-06 decided by OD-13. New issues U-13 to U-25: section 11.8.

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

## 11. Change T11G: PD-12, PD-13 and PD-14 (provider, data acquisition modes, multi-competition)

- Author: architect (task WI-1-T11G). Date: 2026-10-27. Mode: delta on the approved and imported T09 architecture and plan; no restart. Base: `d862cb9`.
- Inputs: S-003 (PD-12, PD-13) and S-004 (PD-14) as recorded in the tracker Decisions table; OD-16 to OD-22; open escalations E-09 (R-429), E-10 (R-430), E-11 (C-1), E-12 (C-3); requirement records listed in the header of this document; the security design review and its Addendum 1 (read only); the Orchestrator's football-data.org documentation review of 2026-10-27 (section 11.10). Delegated: R-437 (endpoints, timeouts, retries, cache periods, import layouts) as an AUTONOMOUS item for the architect; the design points of the T11G brief.
- Classification: AD-21 to AD-34 are architecture decisions of this architecture task; they become approved architecture decisions when the change is verified (T11J), as AD-01 to AD-20 did at T11. Nothing in them decides a Product Owner matter: R-429, R-430, C-1 and C-3 are designed as configuration switches with the conservative default (section 11.8), and the isolation decision for the new inputs stays with the Product Owner after T11H (SC-05).

### 11.1 Affected components

| Component | Code paths | Source-of-truth section | Change | Requirements |
|-----------|------------|-------------------------|--------|--------------|
| Shared domain schemas (new) | `packages/contracts/src/domain/**` | 3 (PD-14), 4 (BR-15) | nine provider-neutral concepts as Zod schemas; one schema for every adapter's output | R-059, R-140, R-267, R-288 |
| Ingestion layer (changed) | `apps/server/src/providers/sports/{index.ts,ingestion/**,adapters/index.ts}` | 3 (PD-12, PD-13, PD-14) | `SportsDataSource` becomes the `IngestionSource` port with discovery; source registry with modes; catalogue service and counterpart resolution; adapter registry | R-056, R-073 to R-076, R-118, R-268, R-282, R-283, R-286 |
| FixtureDataProvider (changed) | `apps/server/src/providers/sports/adapters/fixture/**`, `fixtures/sports/**` | 5 (SC-04) | multi-competition DEMO_DATA fixtures with stages, matchdays and selections without standings | R-058, R-241, R-257, R-283 |
| FootballDataProvider (new) | `apps/server/src/providers/sports/adapters/football-data/**`, `apps/server/src/providers/sports/support/**`, `apps/server/scripts/**`, `config/live.config.json`, `fixtures/football-data/**` | 3 (PD-12), 5 (SC-05, SC-06, SC-07) | endpoint mapping, allow-list schemas, error classification, retries, request budget, projection cache, safe logging, credential handling, live tests, capability probe | R-053, R-054, R-120 to R-136, R-141, R-244 to R-260, R-280, R-291 |
| Manual import and ManualDataProvider (new) | `apps/server/src/modules/imports/**`, `apps/server/src/providers/sports/adapters/manual/**`, `fixtures/manual/**` | 3 (PD-13), 4 (BR-14), 5 (SC-05, SC-07) | JSON, CSV and form import; validation; whole-import; versions; originals | R-057, R-060 to R-069, R-119, R-273 to R-280 |
| Configuration (changed) | `apps/server/src/platform/config/**`, `config/*.json` | 3 (PD-12 to PD-14) | sources with mode and publication permission; verification policy; catalogue links; data-mode startup validation; `config/competitions.json` replaced by `config/catalogue.json` | R-226, R-243, R-266, R-429, R-430, R-436 |
| Egress client (changed) | `apps/server/src/platform/net/**` | 5 | allow-list from enabled sources' base URLs; no other change | R-222, R-262 |
| HTTP platform (changed) | `apps/server/src/main.ts`, `container.ts`, `apps/server/src/platform/http/**` | 5 (SC-06) | `x-auth-token` redaction; import route body limit; startup fail-closed message; CSP `connect-src 'self'` | R-262, R-263, R-266 |
| Persistence (changed) | `apps/server/migrations/0001_initial.sql`, `apps/server/src/platform/db/**` | 4 | section 11.3 | R-070, R-076, R-277, R-278, R-287 |
| Projects and runner (changed) | `apps/server/src/modules/projects/**`, `apps/server/src/workflow/**` | 4 (BR-15, BR-16) | catalogue routes; selection with source and mode; demonstration flag | R-243, R-269, R-282 to R-287, R-291 |
| Research stage (changed) | `apps/server/src/modules/research/**` | 4 | ingestion port only; retrieval records; standings availability | R-254, R-268, R-287 |
| Verification stage (changed) | `apps/server/src/modules/verification/**` | 4 (BR-12, BR-13) | statuses and reasons; candidate values; manual approval; publishability | R-055, R-070, R-071, R-256, R-270 to R-272, R-278 |
| Content, rendering, visual QA (changed) | `apps/server/src/modules/{content,rendering,visual-qa}/**` | 4 (BR-12, BR-14) | standings optional; candidate values drafted and blocked; demonstration band; competition-independent templates | R-254, R-255, R-269, R-285 |
| Review and export (changed) | `apps/server/src/modules/{review,export}/**` | 4 (BR-12, BR-13) | publishability guard; manifest data mode and demonstration flag | R-269, R-271, R-272, R-287 |
| Web UI (changed) | `apps/web/src/{ui,app,features/projects,features/facts,features/review,features/history}/**`, new `apps/web/src/features/imports/**` | 3 (PD-08, PD-14) | catalogue selection without a single-format assumption; statuses; manual approval; demonstration labels; import pages | R-243, R-269, R-274, R-276, R-283, R-284, R-286, R-291 |
| Tooling (changed) | `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `package.json`, `.env.example`, `apps/server/test/static/**`, `scripts/security-checks.mjs` | 7 | provider-identifier rule; `live` project; token removed from the default test environment; marker scan and hygiene checks | R-257, R-258, R-261, R-264, R-265, R-289 |
| Provider research (changed) | `docs/work-items/WI-1/research/**`, `provider-research.md` | 3 (PD-01, PD-12) | refocused: football-data.org confirmation, probe findings, secondary-source candidates | R-242, R-259, R-281 |

### 11.2 Contract delta: http-api (proposed, not declared)

- Status: proposal revised. Proposed file: `docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml`, `info.version` `1.0.0-proposed.2`. No approved contract file, declaration or frozen snapshot exists (`contracts: []`); none is modified. Promotion (T20), declaration (T25) and hash recording (T26) are unchanged in procedure.
- Diff summary against the proposal accepted by OD-14 (29 operations, 24 paths) to 39 operations on 32 paths:
  - New operations (10): `listSeasons`, `listStages` (catalogue, lazy; R-074, R-141), `approveFactManually`, `revokeManualFactApproval` (PD-13, R-071, R-272), `listImports`, `createImport`, `getImport`, `getImportOriginal`, `listManualSelections`, `getManualVersion` (R-057, R-060 to R-068, R-277, R-278). Three of them are mutating (`approveFactManually`, `revokeManualFactApproval`, `createImport`) and declare `ClientHeader`, 403 and 415 (and 413 for `createImport`).
  - Changed operations: `listCompetitions` returns the `Catalogue` (competitions with sources and availability, per-source listing provenance) instead of competitions with nested seasons, phases and matchdays; `createProject` takes `competitionId`, `sourceId`, `seasonId`, `stageId`, `matchday` (nullable) instead of `matchdayId`, and may return 409 `SELECTION_UNAVAILABLE`, 502 and 503; `listFacts` adds `dataMode` and `standings` availability; descriptions of `approveElement`, `approveCarousel`, `exportCarousel`, `startRun` describe publishability, demonstration labels and manual versions. 403 is declared on every operation (T10-A1-01, applied before promotion as the reviewer recommended).
  - Schemas added: `DataMode`, `MatchStatus` (adds `suspended`, `cancelled`, `awarded`), `DisplayName`, `StageName`, `TeamName`, `FileName`, `Availability`, `ListingMeta`, `SourceListing`, `CompetitionSource`, `CatalogueCompetition`, `Catalogue`, `Season`, `SeasonList`, `Stage`, `StageList`, `UnverifiedReason`, `BlockReason`, `ManualApproval`, `StandingsAvailability`, `ImportCreate`, `ImportFileCreate`, `ImportFormCreate`, `ManualImportDocument`, `ManualSelection`, `ImportError`, `ImportSummary`, `ManualSelectionHistory`, `ManualVersion`.
  - Schemas changed: `Settings` (adds `dataModes`, `verificationPolicy`), `SourceInfo` (adds `mode`, `enabled`, `publicationPermission`), `ProjectCreate`, `ProjectSummaryFields` (`stageLabel`, `matchday`, `sourceName`, `dataMode`, `demonstration` replace `matchdayNumber`), `Project` (`sourceId`, `stageId` replace `matchdayId`), `FactStatus` (`verified`, `unverified`, `manually_approved`; "disputed" becomes the unverified reason `disputed`, OD-17), `FactRefFields` (adds `unverifiedReason`, optional `blockReason`), `FactKindValue` (adds `candidateValue`), `Fact` (adds `manualApproval`), `Evidence` (adds `dataMode`, `importVersionId`), `MatchdayInfoValue` (stage label, nullable numbers), `ContextItemValue` (`teams_in_table`, `matches_in_selection`; the competition-specific `qualification_zone` removed, R-140), `LeftOutMatch` and `MatchStatusValue` (use `MatchStatus`), `Draft` (adds `dataMode`, `demonstration`, `standingsIncluded`), `TextField` (`fact` provenance with `factStatus` replaces `verified_fact`, so that no unverified value is labelled verified; field `demo_label`), `ExportFields` (adds `dataMode`, `demonstration`), `SlideTrace` (adds `dataMode`), `Failure` codes (adds `access_refused`, `not_available`, `bad_request`), `Problem` (codes `PROVIDER_RATE_LIMITED`, `SELECTION_UNAVAILABLE`, `IMPORT_REJECTED`, `MANUAL_APPROVAL_REFUSED`; properties `importErrors`, `retryAfterSeconds`, `refusalReason`).
  - Removed: the `phases` level and its `league` constant (BR-10 encoding; PD-14, pending E-12), `matchdayId`, `matchdayNumber`, `qualification_zone`, `verified_fact`, status value `disputed`.
  - Provider neutrality (R-288): no schema, field, enum or example names football-data.org or carries a provider field name, code or identifier; provider references are opaque and server-side (AD-21). T43 tests this.
- Compatibility note: the revision includes non-additive edits relative to the text accepted by OD-14 (replaced request fields, renamed enum values, removed schemas). The contract has never been promoted or declared, no code exists, and no consumer or frozen snapshot exists; PD-11's policy ("additive-only within v1") governs the declared contract from its declaration by T25 onward (section 2.1: "every change to the declared contract"). The edits are therefore made now, before `1.0.0` is published, so that v1 is born provider-neutral. If the Orchestrator reads the OD-14 acceptance as having fixed v1, these edits would be breaking under PD-11 and the change would be HIGH-06 instead of MED-01; this classification point is raised in ESCALATIONS of the T11G report with the recommendation to treat it as a pre-release revision.
- Contract Safety assessment of the revised proposal (configuration conditions: CS-1 to CS-5 only):

| Condition | Holds? | Evidence |
|-----------|--------|----------|
| CS-1 backward compatible | yes | No declared or promoted version, no consumer and no frozen snapshot exists; the revision replaces a proposal before its first publication (compatibility note above). Every request input of the revision is constrained before `1.0.0` (patterns, enums, `maxLength`, `maxItems`, numeric bounds on every new string, array and number; T10-F03 condition), so no later narrowing is needed. After declaration, PD-11 applies unchanged |
| CS-2 within approved scope | yes | Every new or changed operation traces to an approved requirement: catalogue and selection to PD-14 (R-072 to R-077, R-141, R-243, R-282 to R-291); manual import and versions to PD-13 (R-057, R-060 to R-069, R-273 to R-280); manual approval to PD-13 (R-070, R-071, R-272) and OD-17; statuses to OD-17; demonstration labels to OD-21; policies to R-429 and R-430 with conservative defaults. No publication, login, account or provider-specific operation is added; no operation sets a fact to verified |
| CS-3 preserves authorization boundaries | yes | No identity is added (PD-05). All 15 mutating operations declare `ClientHeader`, 403 and 415 (`createImport` also 413); the global guards of TB-1 apply unchanged because the import channel sends files as text inside `application/json`, so no new content-type exception exists. The new GET operations are side-effect free (in-memory budget and cache only) and declare 403 for the Fetch-Metadata refusal. No credential, token or base URL appears in any schema (`Settings` and `SourceInfo` carry adapter kinds, modes and roles only) |
| CS-4 does not weaken any security control | yes | Controls are added: name patterns refusing control and format characters on every new name; closed `ImportError`, `Availability` and `ListingMeta`; bounded imports (content 512 KiB, 100 selections, 64 matches, 64 rows, 500 errors); `getImportOriginal` served as an attachment with `nosniff`, a sandbox CSP and CORP; closed failure codes extended without free text; `Evidence.sourceRef` still rendered only through `SafeReference`; 403 now declared on every GET (T10-A1-01). No existing control, limit or guard is removed |
| CS-5 does not change business-rule semantics | yes | BR-01, BR-02 and R-026 are implemented as before: only verified facts are publishable by default; `disputed` keeps its meaning as the unverified reason of OD-17. The new statuses and the manual approval implement PD-13 as decided (R-070, R-071): manual approval is a separate status, never verification, refused for LIVE_DATA and disputed facts (R-412), and not publishable until the Product Owner answers R-429 (default `blocked` = R-026). The R-430 permission rule only adds a refusal (R-136). Candidate values make content draftable and previewable but never approvable while unpublishable (R-027, R-271). No operation overrides a block, verifies a fact or publishes |

- Classification: MEDIUM (MED-01, every condition holds), subject to the compatibility reading above. The security design review T11H reviews this contract delta before the Orchestrator re-accepts it (`planning.md` section 3 item 3).

### 11.3 Data delta

All in migration `0001_initial.sql` (owned by T18; no code exists yet, so no second migration). Specified in `data-model.md`:
- Changed tables: `projects` (`competition_name`, `source_id`, `data_mode`, `season_label`, `stage_id`, `stage_label`, nullable `matchday`, opaque `selection_ref`, `standings_expected`; `phase_id` with its `league` check and `matchday_id`, `matchday_number` removed: BR-10 superseded by PD-14 pending E-12); `workflow_runs` (`standings_availability`; config snapshot with modes, permissions and policy); `sources` (`mode`, `publication_permission`); `observations` (`retrieval_id`, `data_mode`, `import_version_id`); `facts` (status `verified` or `unverified`, `unverified_reason`, `candidate_value`, `manual_eligible`, consistency checks); `content_drafts` (`standings_included`); `exports` (`data_mode`).
- New tables: `retrievals` (every source retrieval of a run, no payload; AD-34), `manual_approvals` (append-only audit; AD-28), `imports`, `manual_competitions`, `manual_seasons`, `manual_selection_versions` (AD-29).
- New files: `<dataDir>/imports/<importId>/original.*` (exclusive create, realpath containment, UUID-built paths).
- Not persisted: the provider projection cache (in memory, AD-27); raw provider payloads, response headers and URLs with query values; the token.
- Data-handling rules: person data never enters any table (allow-list mapping; manual person columns rejected; schema-test regex extended with `referee|coach|squad|token|secret`); only applied imports are stored; originals are byte-identical with their SHA-256; nothing is deleted (OD-08).

### 11.4 Security delta

Changed surface:

| ID | Trust boundary | Threats | Controls (design) |
|----|----------------|---------|-------------------|
| TB-2 (changed) | Server to a real sports-data provider: football-data.org API v4 over HTTPS (first real adapter, SC-05 trigger) | malformed, oversized or hostile JSON; person data in responses (referees possible, R-315); badge URLs (`crest`); prompt-injection text in competition, stage or team names; error bodies echoing request data; rate-limit exhaustion and 429 storms; retry amplification; redirects or origin spoofing; token leakage through URL, logs or errors | egress allow-list gains `https://api.football-data.org` only while an enabled LIVE_DATA source uses it; all T10-F07 and T10-F08 controls unchanged (512 KiB decoded-byte cap, total deadline, `redirect: 'error'`, exact origin, TLS, lint bans, socket guard); allow-list Zod schemas per resource, person and `crest` fields dropped before mapping, counts logged without values; shared domain schema validation; name rules refusing control and format characters; error bodies parsed only to be discarded; closed failure codes; retries only for idempotent GETs on 5xx and timeouts, at most 2, 30 s cap; 429 waits for `X-RequestCounter-Reset` within a bound; never retry 400, 401, 403, 404; per-source request budget (sliding 60-s window, default 10, plus the server's counters); cache of validated projections only |
| TB-6 (changed) | Secrets: `FOOTBALL_DATA_API_TOKEN` (a real provider credential, a T10-F19 re-raise trigger) | token committed, logged, cached, echoed in errors, placed in URLs, sent to the browser, written to test output, evidence or probe findings | environment only (`.env.local` git-ignored, mode 0600; `.env.example` with an empty value); read only by the football-data adapter, never placed in the configuration object, the config snapshot, the database or the cache; sent only as `X-Auth-Token` to the allowed origin; logger redaction of `x-auth-token` paths with tests; startup fail-closed naming the variable only; default test setup and e2e runner remove it from child environments; synthetic marker token in tests; `secret-scan` (non-empty `FOOTBALL_DATA_API_TOKEN=` assignments, marker outside tests), `bundle-secrets`, `hygiene` and `marker-scan` (evidence, research and bundle files contain neither the marker nor, when present in the environment, the real token value) in T46; browser never calls the provider (CSP `connect-src 'self'`) |
| TB-8 (new) | Operator-supplied MANUAL_DATA: JSON files, CSV files and web-form entry (new input types, SC-05 trigger) | parser denial of service (size, row count, nesting, pathological quoting), invalid UTF-8, control and bidi characters, CSV formula injection in a re-opened original, person data, duplicate or conflicting records, prompt-injection text in names, path traversal through file names, oversized error reports | JSON envelope only (no new content type, TB-1 guards unchanged); route body limit 1.5 MiB, content 512 KiB in bytes; strict UTF-8 decoding; CSV: own single-pass state machine without backtracking expressions, no multi-line fields, 5 000 rows, fixed column count, 200 characters per field; JSON: depth pre-scan (16) before `JSON.parse`, strict schema rejecting unknown keys; name and number rules; person-like columns and keys rejected naming the field; all errors collected (at most 500) with sanitized field names; whole import rejected on any error and nothing stored; file names used only as metadata (never as paths); originals stored under UUID paths with exclusive create and served only as `application/octet-stream` attachments with `nosniff`, sandbox CSP and CORP; the platform never produces CSV, so formula injection only matters if the operator opens a downloaded original in a spreadsheet (residual, documented) |
| TB-1 (note) | Local callers and provider budget | a local process or a cross-site request consuming the provider request budget through the catalogue GET routes | Fetch-Metadata refusal of cross-site and same-site requests (T10-F04) covers browsers; discovery requests are cached and budgeted, so the worst case is a temporarily exhausted free-plan budget (no cost, R-111); within PD-05 and the T10-F19 residual |

- Privacy: no personal data enters the platform from the new inputs (R-119): provider person fields are dropped at the adapter before cache, storage or logs; manual imports with a person-level field are rejected; preserved originals therefore hold no person data. riskProfile `personalData: none` stays correct.
- New controls to validate in T46 and T47 (names for the evidence pack): credential handling (header only, redaction, fail-closed startup, no token in configuration, cache, database, logs, test output, evidence, probe findings or bundle); rate limiting (budget never exceeded in any 60-second window; header-driven waits; bounded retries; no retry of 400, 401, 403, 404); cache contents (validated projections only; no raw payload, header, error, token or person field); CSV and JSON import limits (size, rows, columns, field length, depth, encoding, control characters, error cap); static provider-identifier check (lint rule and seeded test); person-field rejection (adapter dropping and manual rejection); originals served as attachments; demonstration labels.
- Isolation options for the new untrusted inputs (football-data.org JSON; manual JSON and CSV), for the Product Owner decision required by SC-05 after T11H:

| Option | Description | Cost | Effect |
|--------|-------------|------|--------|
| A (architect's recommendation, subject to T11H) | In-process parsing, as PD-10 option A, with the controls above: memory-safe JavaScript parsers (`JSON.parse`, the own CSV state machine), linear in the input, bounded by byte, row, column, depth and error caps, deadline on network input | none beyond the listed controls | denial of service of the local process is the realistic worst case; bounded by the caps |
| B | Parse and validate provider responses and manual imports in a `worker_threads` worker with `resourceLimits` and a deadline | one platform module and tests; serialization of results | contains memory and CPU exhaustion; no privilege separation |
| C | A child process under the Node permission model with no file-system or network permission, receiving bytes and returning validated JSON | higher; platform-specific behaviour | adds privilege separation |

- Questions for the Security Reviewer (T11H; numbering continues from Q1 to Q6 of section 4):
  7. Is Option A acceptable for football-data.org JSON and for manual JSON and CSV with the listed caps, or is B or C needed (recommendation to the Product Owner, SC-05)?
  8. A season-wide match list (`/competitions/{code}/matches?season=YYYY`, used once per season to list stages) may approach the 512 KiB cap for large leagues. Is a per-source `maxResponseBytes` up to the 2 MiB schema maximum acceptable when the probe shows the need, or should stage discovery use smaller requests?
  9. Is the 403 classification (authentication refusal versus subscription restriction by the presence of `X-Authenticated-Client`; both never retried, body discarded) acceptable, given that it only changes the displayed reason?
  10. With LIVE_DATA, competition, stage and team names from a real source reach the AI data block and the slides (T10-F06 residual R4 now applies). LIVE_DATA content is never publication-approvable in WI-1 (R-055). Is the residual acceptable for WI-1, or is a pinned allowed-name set needed before LIVE_DATA is enabled?
  11. Are the catalogue GET routes, which can spend the provider request budget without persistent side effects, acceptable under T10-F04 and V-06?
  12. Is serving import originals as `application/octet-stream` attachments with a sandbox CSP sufficient, including the CSV formula-injection residual?
  13. Are the credential controls (TB-6 above), the probe's output rules and the `marker-scan` evidence sufficient for credential rule 4 (no credentials in logs or test evidence), and should the real-credential trigger of T10-F19 be put to the Product Owner together with the isolation decision?
  14. Is the static identifier check as an ESLint rule with a seeded-violation test sufficient for R-289?
  15. Do the new mutating operations (`createImport`, `approveFactManually`, `revokeManualFactApproval`) and the revised contract preserve CS-3 and CS-4 (section 11.2)?
- T10 findings: every T10-F01 to T10-F21 control and every observation T10-A1-01 to T10-A1-06 stays in force. Applied now: T10-A1-01 (403 declared on every operation), T10-A1-03 (`scripts/**` in the lint scope and in PRJ-LINT and PRJ-UNIT paths), T10-A1-02 (`hygiene` subcommand in T41, evidence in T46), T10-A1-06 (canonical slug team IDs and placeholder IDs for unmatched keys, T30); T10-A1-04 and T10-A1-05 stay brief items (OD-15). V-30's T11B reading ("no real adapter, no hosted AI, no new input type in WI-1") no longer holds (R-116 amended); T47 validates instead that the SC-05 isolation decision for FootballDataProvider and the manual input types is recorded and its conditions hold.

### 11.5 Decisions

Each decision names its alternatives, tradeoffs, consequences, the requirements affected and its reversal cost.

#### AD-21 Provider-neutral domain model with opaque source references
- Context: PD-14 requires a domain that does not depend on football-data.org, with provider identifiers only in adapters or configuration (R-139, R-140, R-288); several sources per competition (R-076).
- Alternatives: domain types mirroring the football-data.org v4 shapes (couples every stage to one provider, fails R-140); a generic provider-extension map on domain objects (provider fields leak into shared contracts, against "without contaminating"); a persisted table mapping provider identifiers to internal IDs (schema and synchronization for data the source can list again).
- Choice: the nine concepts as shared Zod schemas in `packages/contracts/src/domain/`; anything provider-specific is an opaque `SourceRef` (JSON string, at most 512 characters) that only the issuing adapter interprets; catalogue IDs are slugs (`<sourceId>-<localKey>` or a configured link ID); a project stores its `selection_ref` and label snapshots (`data-model.md` section 0).
- Tradeoffs: core code cannot reason about provider identifiers (intended); labels are duplicated as snapshots for history.
- Consequences: the static check (AD-31) is enforceable; a new provider needs no domain or contract change.
- Requirements affected: R-059, R-118, R-139, R-140, R-267, R-288. Reversal cost: medium (shared schemas and contract shapes).

#### AD-22 One ingestion port with three adapters and an adapter registry
- Context: PD-12 and PD-13 name FootballDataProvider, ManualDataProvider and FixtureDataProvider behind a provider-independent interface; new providers must not change the Research Agent's logic (R-118, R-268). Amends AD-09.
- Alternatives: one port per mode (stages would branch on the mode, R-268); keep `fetchMatchday` and add a separate discovery port (two seams per provider to keep consistent); a dynamic plug-in loader (R-109).
- Choice: `IngestionSource` with `listCompetitions`, `listSeasons`, `listStages`, `fetchSelection` and `validateStartup`; adapters registered by kind in `adapters/index.ts`; research and verification use only the source registry and the catalogue service; T21 creates stubs for the football-data and manual adapters so that T49 and T50 replace them in parallel (`contracts/provider-ports.md` section 1).
- Tradeoffs: the manual adapter reads the database (an adapter with a `Db` dependency), acceptable because it is local data.
- Consequences: the R-267 equivalence test runs the same synthetic matchday through all three adapters.
- Requirements affected: R-056 to R-059, R-118, R-267, R-268. Reversal cost: medium.

#### AD-23 Dynamic catalogue with optional configured links
- Context: PD-14 dynamic discovery; OD-16 one or more sources per competition; R-141 budget; open confirmations C-1 (E-11) and C-3 (E-12).
- Alternatives: a static catalogue file (the T09 `config/competitions.json`; contradicts PD-14); automatic merging of competitions by name across sources (wrong merges, names differ across providers); a persisted catalogue refreshed by a background job (infrastructure, R-109).
- Choice: the catalogue is merged per request from cached listings of every enabled source; IDs `<sourceId>-<localKey>`; optional links in `config/catalogue.json` group bindings of several sources, mark reference scenarios and can restrict the catalogue (`restrictToLinks`) or the stages (`selectableStages`) should C-1 or C-3 be answered the other way; seasons and stages are listed lazily on selection (`architecture.md` section 15.2).
- Tradeoffs: one competition offered by two unlinked sources appears twice; linking it is configuration (provider codes in configuration are allowed, R-139).
- Consequences: catalogue service in T21; catalogue routes in the projects module (T27); no per-competition request to show the catalogue (R-141).
- Requirements affected: R-072 to R-076, R-141, R-243, R-282, R-286, R-291, R-431. Reversal cost: low.

#### AD-24 Selection model: a stage plus an optional matchday; standings optional
- Context: different tournament structures (PD-14, R-074, R-077, R-439), stages without standings (R-284, R-285), manual structure (OD-18); C-3 pending.
- Alternatives: keep the league phase plus matchday number (T09, superseded by PD-14 pending E-12); model formats explicitly (leagues, groups, knockout trees, aggregates; excluded by R-439); matchdays only (stages without numbered rounds could not be selected).
- Choice: a selection is a stage (name as given, order, standings expectation) plus a matchday number or the whole stage; standings availability is recorded per run with a reason; standings slides exist only when standings are available; nothing is derived (`architecture.md` sections 7.3, 8.1).
- Tradeoffs: knockout rounds get no format-specific visuals (intended, R-439).
- Consequences: carousels without standings pass QA and the same approval and export rules (R-285).
- Requirements affected: R-074, R-077, R-254, R-283, R-284, R-285, R-434, R-439. Reversal cost: low.

#### AD-25 FootballDataProvider integration (R-437 delegated)
- Context: PD-12; R-053, R-054, R-128 to R-133; the verified documentation of section 11.10.
- Alternatives: requesting `/competitions/{code}` per competition to build the catalogue (N requests per view, against R-141); the teams resource for team names (an extra request per selection and squad and coach person data, R-119); stages from the competition resource only (no stage names); a vendor client library (no official one is part of the verified facts; a dependency, MED-02).
- Choice: the endpoint mapping, status mapping, error classification, retry, timeout, response-handling and logging rules of `contracts/provider-ports.md` section 1.4; tests through a replay `EgressClient` with recorded-shape synthetic responses and a controllable clock; UNVERIFIED items confirmed by the probe before support is promised.
- Tradeoffs: one season-wide match list per season for stage discovery (size, question 8); the 403 classification heuristic is UNVERIFIED (question 9).
- Consequences: research costs at most two requests per selection; the adapter is replaceable without touching stages.
- Requirements affected: R-053, R-054, R-128 to R-133, R-244 to R-256, R-260, R-280, R-437. Reversal cost: low (adapter-local).

#### AD-26 Request budget driven by the rate-limit headers
- Context: free plan 10 requests per minute; R-131, R-141, R-249, R-291, R-312; "do not assume unlimited access".
- Alternatives: reacting only to 429 (exceeds the limit first); a local window only (ignores other uses of the same token, such as the probe); a token bucket with bursts (can exceed the budget in a 60-second window).
- Choice: one serialized queue per source; a request is admitted only when the sliding 60-second log is below the configured budget (default 10) and the provider's last `X-RequestsAvailable` was not 0 before its `X-RequestCounter-Reset` time; retries and waits consume the budget; discovery waits at most 5 s and then serves a stale listing or `PROVIDER_RATE_LIMITED`; research waits at most 65 s.
- Tradeoffs: requests are serialized (research needs at most two).
- Consequences: deterministic tests with an injected clock prove the 60-second property (R-249, R-291).
- Requirements affected: R-130, R-131, R-141, R-249, R-291, R-312. Reversal cost: low.

#### AD-27 In-memory projection cache
- Context: R-132, R-141, R-252, R-119; the budget.
- Alternatives: a SQLite cache table (persists provider data beyond the run's observations; schema change; retention questions); an HTTP response cache (would hold raw payloads with person data, against R-119); no cache (the budget is exhausted by browsing).
- Choice: an in-memory LRU (500 entries) of validated domain projections with `retrievedAt` and `expiresAt`, TTLs by resource and match status; stale entries only for discovery while the budget is exhausted; never raw payloads, headers, errors, tokens or person fields.
- Tradeoffs: the cache is lost on restart (one request to list the catalogue again).
- Consequences: R-252's cache-content test inspects the cache through a test accessor.
- Requirements affected: R-132, R-141, R-252, R-280, R-291. Reversal cost: low.

#### AD-28 Verification statuses, candidate values, manual approval and configurable publication policies
- Context: PD-13 statuses; OD-17; R-055, R-070, R-071, R-271, R-272, R-290; open R-429 (E-09) and R-430 (E-10); R-136.
- Alternatives: storing `manually_approved` in `facts.status` written by the API (facts become mutable; stage output and operator action mixed; weaker audit); drafting only verified values (LIVE_DATA and MANUAL_DATA projects would produce empty carousels, against R-271 and R-290, which expect drafting, preview and a refusal at approval); fixing R-429 option b in code (an answer a or c would need a code change); ignoring R-430 until answered (verified LIVE_DATA content could become approvable without permission once a secondary source exists, against R-136).
- Choice: `facts.status` is `verified` or `unverified` with a closed reason and an optional candidate value; `manually_approved` is the effective status from append-only `manual_approvals` on eligible facts, carried over only for unchanged facts; one publishability function (`architecture.md` section 7.4) governed by `verificationPolicy.manuallyApprovedPublication` (default `blocked`) and `livePublicationPermissionRule` (default `every_supporting_source`) and per-source `publicationPermission` (default `unconfirmed` for LIVE_DATA).
- Tradeoffs: two configuration switches exist for open Product Owner questions; their defaults are the conservative readings.
- Consequences: either answer to R-429 or R-430 is a configuration change with no schema, contract or stage change; the contract carries statuses, reasons and block reasons.
- Requirements affected: R-026, R-055, R-068, R-070, R-071, R-136, R-270 to R-272, R-278, R-290, R-429, R-430, R-433. Reversal cost: medium.

#### AD-29 Manual import pipeline
- Context: PD-13 manual import rules 1 to 10; OD-18, OD-19; R-119; SC-05 (new input types).
- Alternatives: a CSV library (MED-02 dependency and supply-chain surface for a small fixed format); multipart upload of raw `text/csv` (a new content-type exception in the TB-1 guard and a multipart parser dependency); partial application of valid records (OD-19 decided whole imports); relational tables for manual matches and standings (more schema than versions of validated documents need).
- Choice: one JSON envelope for every channel; one `ManualImportDocument` schema; an own linear CSV parser with two fixed layouts and strict limits; strict JSON parsing with a depth pre-scan; every error collected; whole-import application in one transaction; versions per selection stored as validated documents; originals stored as files with SHA-256 (`contracts/provider-ports.md` section 1.6).
- Tradeoffs: CSV is limited to two layouts and 512 KiB; matches and standings of a selection may come in separate files (two imports, two versions).
- Consequences: no new dependency; the parser is reviewed by T11H.
- Requirements affected: R-057, R-060 to R-069, R-119, R-273 to R-280, R-319, R-434, R-435. Reversal cost: low.

#### AD-30 Credentials and data-mode startup validation
- Context: PD-12 credential rules 1 to 7 (R-120 to R-127); OD-20; T10-F10, T10-F11. Amends AD-15.
- Alternatives: the token in a configuration file (rules 1 and 2); the T09 naming `EDR_SOURCE_<ID>_API_KEY` (contradicts PD-12's variable name); warn and continue when it is missing (OD-20 decided fail closed).
- Choice: `FOOTBALL_DATA_API_TOKEN` read from the injected environment only by the football-data adapter and kept in a closure; `X-Auth-Token` header only; `validateStartup` fails closed naming the variable; not required without an enabled LIVE_DATA source; `.env.example` with an empty value; redaction of `x-auth-token`; the default test setup and the e2e runner remove the variable; a synthetic marker token for tests; scans in T41 and evidence in T46 (section 11.4 TB-6).
- Tradeoffs: changing the variable name later is a Product Owner matter (it is PD-12 text).
- Consequences: R-260 to R-266 are each testable.
- Requirements affected: R-120 to R-127, R-260 to R-266. Reversal cost: low.

#### AD-31 Static provider-identifier check as a lint rule
- Context: R-139, R-289; S-004 asks to verify that no core service hardcodes Champions League or football-data.org identifiers.
- Alternatives: a text search script (matches comments and documentation, a separate gate); convention and review only (not automated, fails R-289); a custom ESLint plugin (code to maintain).
- Choice: ESLint core rules (`no-restricted-syntax` on string, template and numeric literals; `no-restricted-imports` for adapter paths) scoped to `apps/**` and `packages/**` except `apps/server/src/providers/sports/adapters/**` and `apps/server/scripts/**` (section 7.1); a unit test in `apps/server/test/static/` lints seeded violations with the project configuration and expects errors, and lints an exempt path and expects none. Tests take provider identifiers from files under `fixtures/` or `config/`.
- Tradeoffs: identifiers assembled from fragments would evade the rule (accepted; T45 reviews).
- Consequences: PRJ-LINT enforces it on every affected change; PRJ-UNIT runs the seeded test.
- Requirements affected: R-139, R-289. Reversal cost: low.

#### AD-32 Optional live tests and a capability probe outside every gate
- Context: R-135, R-136, R-258, R-259, R-281, OD-22; S-003 asks to validate capabilities before promising support; the token is never requested in a conversation.
- Alternatives: live tests in a gate (needs the token in gate runs, non-deterministic, against R-258); no probe (capabilities stay unverified, R-259 and R-281 unmet); saving real responses as fixtures (real data and possibly person data in the repository, against SC-04 and R-119).
- Choice: a Vitest `live` project skipped unless explicitly enabled; a probe script reusing the adapter (T49); an Orchestrator run task (T53) writing a findings file checked by `marker-scan`; without the token the run records "not run" and the build is unaffected (`provider-research-plan.md` section 7).
- Tradeoffs: field-level support is confirmed only when the Product Owner supplies the token.
- Consequences: deterministic tests use synthetic responses in the documented shape; the findings feed T14 and the choice of the second LIVE_DATA competition (OD-22).
- Requirements affected: R-135, R-136, R-258, R-259, R-281, R-290, R-440. Reversal cost: low.

#### AD-33 Demonstration labelling
- Context: OD-21, R-269, RK-17. OD-01 ("no visible label on exported content") concerns the provenance labels (verified fact or commentary); the demonstration label is a different label that OD-21 requires in the export, so the two decisions do not conflict.
- Alternatives: a label in the UI only (exported files could be published as real); in the manifest only (slides travel alone); an export folder name only.
- Choice: labels in the project list and review view, `demonstration: true` and the data mode in `manifest.json`, and a fixed template-text band on every DEMO_DATA slide (`architecture.md` section 9).
- Tradeoffs: demonstration slides differ visually from real ones (intended).
- Consequences: rendering, export and three UI features carry the flag.
- Requirements affected: R-058, R-269, R-438. Reversal cost: low.

#### AD-34 Retrieval records for source traceability
- Context: R-076 and R-287 ask that the project, every retrieval and every fact record the source used; R-024.
- Alternatives: observation-level attribution only (a retrieval that failed or returned nothing leaves no trace); logs only (logs are not traceability data and must stay minimal).
- Choice: a `retrievals` table (source, mode, stage, resource kind, time, cache use, outcome, closed failure, import version) without payloads; observations reference their retrieval (`data-model.md` section 3.2).
- Tradeoffs: one more row per retrieval.
- Consequences: traceability of an exported slide shows source, mode and retrieval.
- Requirements affected: R-024, R-076, R-204, R-287. Reversal cost: low.

### 11.6 Task plan

`docs/work-items/WI-1/architecture/task-plan.md`, reconciled: 42 tasks, T12 to T53 (39 IMPL, 3 VERIFY). IDs T12 to T48 are preserved with their purpose and titles; 34 of them are changed and T22, T33 and T36 are unchanged; five tasks are new: T49 (FootballDataProvider, budget, cache, live tests and probe script; backend-developer), T50 (manual import module and ManualDataProvider; backend-developer), T51 (manual import UI; frontend-developer), T52 (integration tests for data modes, catalogue, manual import and credentials; qa-engineer), T53 (capability probe run, Orchestrator). By agent: backend-developer 18, frontend-developer 7, qa-engineer 9 (7 IMPL, 2 VERIFY), architect 4, Orchestrator 3 (IMPL), security-reviewer 1 (VERIFY). T46 and T47 cover the new controls (section 11.4); T48 remains the final gate-run VERIFY task depending on every other task. Every task depends, directly or through T12, T13 or T15, on T11J, so no task starts before the change is verified. T49 and T50 also wait for the Product Owner's isolation decision after T11H (precondition in the plan header). Eleven parallel waves; critical path T11J, T15, T17, T19, T27, T33, T34, T35, T37, T38, T42, T45, T46, T47, T48 (unchanged length). The "Reconciliation (T11G)" section lists every changed and new task for the tracker update.

### 11.7 Test-strategy delta

| Suite or gate (configured ID) | Change | Runs as |
|-------------------------------|--------|---------|
| FW-TRACKER, FW-CONFIG | none | affected, final |
| FW-SECURITY | verdict from T47, now covering the T11H controls | final |
| FW-AC | active acceptance criteria R-200 to R-291 (89 records; R-201, R-210, R-239 superseded) | final |
| PRJ-INSTALL, PRJ-TYPECHECK, PRJ-BUILD, PRJ-AUDIT, PRJ-CONTRACT-ID | none (no new dependency: the CSV parser is own code) | affected, final |
| PRJ-LINT | new provider-identifier rule; `scripts/**` added to scope and paths (T10-A1-03); `modules/imports` added to the network-API ban | affected, final |
| PRJ-UNIT | new: domain schemas (T20), ingestion and fixture provider (T21), football-data adapter with replayed responses (T49), import parsers and ManualDataProvider (T50), status and publishability rules (T30, T37), content without standings and with candidate values (T32), demonstration band (T34), static identifier test (T15), script positive-control test (T41), UI features (T28, T31, T39, T40, T51) | affected, final |
| PRJ-INTEGRATION | new suite `apps/server/test/integration/ingestion` (T52): equivalence across the three adapters, catalogue and budget, manual import end to end, credentials, two-source with a LIVE-shaped primary, the four-competition workflow; changed delivery suite (T42) for carousels without standings and demonstration exports | affected, final |
| PRJ-CONTRACT | new operations and schemas; provider-neutrality test (T43) | affected, final |
| PRJ-E2E, PRJ-A11Y | new journeys: catalogue selection with stages and without standings, manual import with errors and versions, manual approval refusal and acceptance, demonstration labels (T44) | affected, final |
| `test:live`, `probe:football-data` | new, optional, never a gate (R-135, R-258) | manual (T49 check of skipping; T53 run) |

### 11.8 Unresolved issues

| Issue | Impact | Classification | Recommendation |
|-------|--------|----------------|----------------|
| U-13 R-429 (E-09): may content using MANUALLY_APPROVED facts be approved for publication? | MANUAL_DATA content (Liga Nacional de Guatemala) cannot be publication-approved until answered; drafting, preview and manual approval work | HIGH-07, pending with the Product Owner; not decided here | Designed as `verificationPolicy.manuallyApprovedPublication` (`blocked` default = R-026; `allowed_labelled` = option a; `allowed_without_accepted_source` = option c). Any answer is a configuration change |
| U-14 R-430 (E-10): how is republishing permission for football-data.org content confirmed? | Verified LIVE_DATA content would be refused at approval while the source's permission is `unconfirmed` | HIGH-05 and HIGH-07, pending; not decided here | Designed as per-source `publicationPermission` (default `unconfirmed`) and `livePublicationPermissionRule` (option a default; option c `any_supporting_source`); option b is recorded by setting `confirmed`. Not blocking: R-055 already refuses single-source content |
| U-15 C-1 confirmation (E-11): multi-competition supersedes single competition | If reversed, the catalogue must show only the reference competition | HIGH (level-1 conflict), pending | Applied provisionally as S-003 and S-004 state; reversal is configuration (`restrictToLinks` with one link) |
| U-16 C-3 confirmation (E-12): generic stages supersede league-phase-only (PD-09, BR-10) | If reversed, only league-phase matchdays of the reference competition are selectable | HIGH (level-1 conflict), pending | Applied provisionally; reversal is configuration (`selectableStages` on the link); source-of-truth BR-10 marked superseded pending E-12 |
| U-17 Isolation decision for FootballDataProvider and the manual input types (SC-05, R-116) after T11H; includes the T10-F19 real-credential trigger | T49 and T50 (and T43, T44, T45, T52, T53 through them) wait; DEMO_DATA work does not | HIGH-03, Product Owner after T11H | Option A recommended, subject to T11H (section 11.4) |
| U-18 Secondary independent verification source (R-432) | LIVE_DATA facts stay UNVERIFIED awaiting independent verification; LIVE_DATA content is not publishable in WI-1 | Future Product Owner action (approval), not an open question | T14 proposes candidates (`provider-research-plan.md`); a new adapter task and security review follow approval |
| U-19 The Product Owner's token may be absent when T53 runs | The LIVE_DATA demonstration (R-290 live part, R-440) and the confirmation parts of R-259 and R-281 wait; the build and every gate do not | Environment and Product Owner input | T53 records "probe not run" and the Orchestrator reports it; no token is ever requested in a conversation |
| U-20 UNVERIFIED football-data.org details: field names of competition and match objects, full-time score semantics, stage attribution of standings tables, matchday numbers on knockout stages, the 403 heuristic, response sizes, delay size | Adapter mapping could need a correction | Confirmed by T53; a correction of T49 is a re-plan (MED-05) | Adapter written defensively (unknown status rejects; missing optional fields stay absent, R-246); nothing promised before confirmation (R-136) |
| U-21 Re-acceptance of the revised http-api proposal | T20 cannot promote before it | MED-01 by the Orchestrator after T11H; HIGH-06 only if OD-14 is read as having fixed v1 (section 11.2) | Re-accept as a pre-release revision |
| U-22 Season-wide match list may exceed the 512 KiB cap | Stage discovery of large leagues could fail with `invalid` | T11H question 8; configuration within the T10-F07 maximum | Raise the per-source cap only on probe evidence and reviewer agreement |
| U-23 Second LIVE_DATA demonstration competition (OD-22) | Chosen at execution from the catalogue on T53 evidence | ORCHESTRATOR (OD-22) | T14 ranks the confirmed candidates; fewer than two confirmed is reported to the Product Owner, without upgrade |
| U-24 Free-plan delays (R-313) | Results may appear late; content may wait for FINISHED statuses | Informational | Retrieval times shown; no real-time claim |
| U-25 T10-F06 residual R4 now reachable with LIVE_DATA names | Instruction-like text inside a valid name could reach the AI data block and the slides | T11H question 10 | LIVE_DATA content is not publication-approvable in WI-1; operator review with provenance labels; pinned names if the reviewer asks |

### 11.9 Risks

| ID | Risk | Mitigation in this design |
|----|------|---------------------------|
| RK-07 | Provider rate limits, delays and outages, made worse by discovery | AD-26 budget, AD-27 cache, lazy seasons and stages, bounded retries, stale listings |
| RK-12 | Token leakage | AD-30 controls; T46 secret, bundle, hygiene and marker scans; T47 validation |
| RK-15 | MANUALLY_APPROVED read as verified | separate status and labels; `fact` segments show the real status; never counted toward agreement; default policy `blocked` |
| RK-16 | Operator entry errors in manual data | strict schema, semantic checks, clear errors, duplicates refused, versions, explicit manual approval |
| RK-17 | Demonstration content published as real | AD-33 band on every slide plus manifest and UI labels |
| RK-18 | Champions League or provider assumptions leak into core code | AD-21 opaque references, AD-31 lint rule and seeded test, T45 review |
| RK-19 | The token's plan covers fewer competitions or seasons | T53 probe, T14 findings, report to the Product Owner without upgrade |
| AR-05 | football-data.org response details differ from the documented shapes | defensive allow-list schemas; probe confirmation; adapter-local correction |
| AR-06 | Standings by matchday lack deducted points (verified) | two-source rule detects differences; recorded in findings |
| AR-07 | Season-wide match list near the response cap | U-22; configurable within the T10-F07 maximum |
| AR-08 | 403 ambiguity between authentication and subscription | both refused without retry; heuristic confirmed by T53 |
| AR-09 | Manual approvals lost after re-runs annoy the operator | carry-over of unchanged facts (section 7.4) |

### 11.10 football-data.org facts used (Orchestrator documentation review, 2026-10-27)

Verified, with the pages they come from:
- Base URL `https://api.football-data.org/v4`; authentication header `X-Auth-Token` (https://www.football-data.org/documentation/quickstart/, https://docs.football-data.org/general/v4/index.html).
- Resources `/competitions` (filter `areas`), `/competitions/{code}` (includes `seasons` and `currentSeason.currentMatchday`), `/competitions/{code}/matches` (filters `season`, `matchday`, `status`, `dateFrom`, `dateTo`, `stage`, `group`), `/competitions/{code}/standings` (filters `season`, `matchday`, `date`; standings by matchday lack deducted points; LEAGUE competitions return `TOTAL`, `HOME`, `AWAY` tables; rows `position`, `team`, `playedGames`, `form`, `won`, `draw`, `lost`, `points`, `goalsFor`, `goalsAgainst`, `goalDifference`), `/competitions/{code}/teams` (filter `season`); `season` is the four-digit starting year (https://docs.football-data.org/general/v4/competition.html, https://docs.football-data.org/general/v4/lookup_tables.html).
- Match status enum `SCHEDULED`, `TIMED`, `IN_PLAY`, `PAUSED`, `EXTRA_TIME`, `PENALTY_SHOOTOUT`, `FINISHED`, `SUSPENDED`, `POSTPONED`, `CANCELLED`, `AWARDED` (https://docs.football-data.org/general/v4/lookup_tables.html).
- Response headers `X-API-Version`, `X-Authenticated-Client`, `X-RequestCounter-Reset` (seconds until reset), `X-RequestsAvailable` (remaining requests) (https://docs.football-data.org/general/v4/lookup_tables.html#_response_headers).
- Errors 400 (bad filter), 403 (restricted: needs authentication, a paid subscription or another API version), 404, 429 (too many requests), 500; body `{"error": "<message>"}` (https://docs.football-data.org/general/v4/errors.html).
- Free plan: 10 requests per minute when registered; unauthenticated 100 per 24 hours for area and competition lists only (https://docs.football-data.org/general/v4/policies.html). The Champions League is in the 12-competition free tier (https://www.football-data.org/coverage). The free plan lists "Scores delayed", "Schedules delayed", fixtures and league tables; the delay size and the season history are not stated (https://www.football-data.org/pricing).
- Not published: terms of use, commercial use, redistribution or republishing, attribution (no terms page; `/terms` returns 404). Whether match objects carry person data (referees) is not confirmed; the design assumes it is possible.

UNVERIFIED and therefore not promised (confirmed or corrected by T53 and T14): the field names of competition and match objects (`id`, `code`, `name`, `area`, `stage`, `matchday`, `utcDate`, `homeTeam`, `awayTeam`, `score.fullTime`, `referees`, `crest`, `shortName`, `tla`); whether full-time scores include extra time; how standings tables are attributed to stages; whether knockout stages carry matchday numbers; whether `X-Authenticated-Client` distinguishes the 403 cases; response sizes; the delay size; the token's actual plan and competitions. Actual token capabilities can only be confirmed at execution with the Product Owner's token.

### 11.11 Conflicts found and their resolution

| Sources | Conflict | Resolution |
|---------|----------|------------|
| PD-12 (S-003, level 1) vs `architecture.md` section 5.1 and AD-15 (T09, level 3) | T09 named the sports-data secret `EDR_SOURCE_<ID>_API_KEY`; PD-12 names `FOOTBALL_DATA_API_TOKEN` | The Product Owner decision wins (`precedence.md`); amended by AD-30 |
| PD-14 (S-004) vs BR-10 and PD-09 league-phase-only (both level 1; conflict C-3) | the T09 data model and contract encoded the league phase | Applied provisionally as the tracker records (C-3, E-12 open); the encoding is removed and a configuration fallback exists (U-16); source-of-truth BR-10 marked superseded pending E-12 |
| SC-04 synthetic fixtures (from PD-01) vs "recorded football-data.org response fixtures" (T11G brief, R-244, R-290) | real recorded responses would put real results (and possibly person data) into the repository | Read "recorded" as committed responses replayed by a stub: the fixtures are synthetic data in the documented v4 response shape with status and headers (`fixtures/football-data/`), and nothing from real responses is committed; the probe records findings, never payloads |
| R-202 "at least one competition-context item" and the T09 context items vs PD-14 | `qualification_zone` with Champions League outcomes was competition-specific | Replaced by provider-neutral context items (`teams_in_table`, `matches_in_selection`) beside `matchday_of_total` (R-140) |
| V-30 (T10, T11B reading) vs R-116 amended in T11F | "no real adapter and no new input type in WI-1" no longer holds | T47 validates the recorded SC-05 isolation decision instead (section 11.4) |
| OD-01 "no visible label on exported content" vs OD-21 demonstration labels in the export | apparent only | OD-01 governs provenance labels; OD-21 (later, specific) governs the demonstration label; the slide band of AD-33 carries no provenance label (no conflict) |
