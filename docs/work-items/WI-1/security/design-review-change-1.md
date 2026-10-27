# WI-1 Security Design Review, Change 1 (T11H): provider and data-mode change

```
TASK: WI-1-T11H  RESULT: PASS
HEAD: n/a  BASE: cdb4e813a526084f8de1e3e63a9a33da66e9a0cb
FILES: docs/work-items/WI-1/security/design-review-change-1.md
COMMANDS: n/a
DECISIONS: LOW-1: finding IDs T11H-F01..T11H-F20, controls V-31..V-55 and assumptions NV-7..NV-12 continue the T10 numbering with the T10 severity, disposition and class scheme ; LOW-2: the Orchestrator's session transcript and the console output of the probe are treated as "logs" under credential rule 4 (R-124) for this review
ESCALATIONS: SC-05 isolation decision for FootballDataProvider responses and for the JSON, CSV and form imports (HIGH-03, Product Owner; recommendation Option A for both, section 6) ; T10-F19 / Q5 re-raise for the real credential (HIGH-03 identity model, Product Owner, same batch; recommendation Option A, decide before T20 promotes 1.0.0, section 7) ; must-fix T11H-F01 and T11H-F02 go to the architect as a targeted correction of T11G before T11J ; http-api re-acceptance is MED-01 (pre-release revision, not HIGH-06) once T11H-F01 is resolved (section 9) ; T11H-F13 level to be classified by the Orchestrator (MEDIUM at most in my reading)
```

- Reviewer: security-reviewer (task WI-1-T11H). Date: 2026-10-27. Mode: **delta design review, before implementation**, of the T11G change (PD-12, PD-13, PD-14). No code exists.
- Triggers: SC-05 / PD-10 (first real sports-data adapter; new input types JSON files, CSV files and web-form entry); the security delta changes data-handling and credential controls (`planning.md` section 4); the never-declared `http-api` proposal was revised.
- Base: my T10 review `design-review.md` (findings T10-F01..F21, controls V-01..V-30, Addendum 1, verdict PASS) covers the base design. This review covers only the delta and anything the delta weakens.
- **Verdict (section 13): FAIL (correctable). No HIGH or CRITICAL finding.** Two must-fix corrections to the design and plan text (T11H-F01, T11H-F02). Contract Safety holds for CS-1..CS-5, and the revision is a pre-release revision (MED-01). Two Product Owner decisions are needed (SC-05 isolation; the T10-F19 real-credential re-raise); recommendations in sections 6 and 7. After the must-fix corrections are integrated, an addendum to this file confirms them and the verdict becomes PASS.

## 1. Scope and artefacts reviewed

Paths are relative to the task worktree `/Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-T11H`.

| Artefact | Path | Used for |
|----------|------|----------|
| Architecture delta | `docs/work-items/WI-1/architecture/architecture-delta.md` | section 11 in full (11.1 to 11.11: affected components, contract delta and Contract Safety, data delta, security delta TB-1 note, TB-2, TB-6, TB-8, isolation options, Q7..Q15, AD-21..AD-34, U-13..U-25, risks, football-data.org facts and UNVERIFIED list, conflicts); sections 2.1, 2.2, 4, 7.1, 7.2 (gate paths) for the amended pointers |
| Architecture | `docs/work-items/WI-1/architecture/architecture.md` | 5.1 (configuration, startup validation, secrets, egress), 5.2, 6, 7.1 to 7.4 (statuses, decision rule, manual approval, publishability), 8.1 to 8.3, 12 to 12.2 (host assumptions and the re-raise note), 13, 15 |
| Data model | `docs/work-items/WI-1/architecture/data-model.md` | section 0, storage layout, conventions, changed and new tables (3.1, 3.2, 3.5), excluded data, traceability, retention |
| Internal interfaces | `docs/work-items/WI-1/architecture/contracts/provider-ports.md` | section 1 (port, domain validation, FootballDataProvider, FixtureDataProvider, ManualDataProvider, CSV and JSON rules), section 2 (AI request contents) |
| Proposed contract | `docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml` (`1.0.0-proposed.2`) | read for every new and changed operation and schema; operations counted: 39 on 32 paths, 15 mutating |
| Provider research plan | `docs/work-items/WI-1/architecture/provider-research-plan.md` | sections 4 and 7 (probe rules and run) |
| Task plan | `docs/work-items/WI-1/architecture/task-plan.md` | header preconditions; T15 to T21, T41, T43, T46, T47, T49 to T53 |
| Requirements | `docs/work-items/WI-1/requirements.md` | R-115, R-116 (amended), R-119 to R-136, R-249 to R-252, R-258 to R-266, R-273 to R-280, R-289, R-429, R-430, R-436 |
| Tracker (read only) | `docs/work-items/WI-1/tasks.md` | OD-01..OD-22, E-07..E-12, T11F to T11J entries |
| Source of truth | `.orchestrate/source-of-truth.md` | PD-01..PD-14, BR-01..BR-16, SC-01..SC-07 |
| Configuration | `.orchestrate/config.json` | `contracts: []`; Contract Safety conditions CS-1..CS-5 only; `riskProfile` standard, personal data none, no sensitive categories |
| My earlier review | `docs/work-items/WI-1/security/design-review.md` | T10 findings, V-01..V-30, NV-1..NV-6, Q1..Q6 answers, Addendum 1 |
| Framework | `<FRAMEWORK_ROOT>/workflows/agent-rules.md`, `autonomy.md`, `planning.md` sections 3 and 4 | levels, HIGH list, Contract Safety, design-review rules |

Out of scope: application code (none exists); legal assessment of the provider's terms (none is made here); the T10 base design except where the delta changes or weakens it.

Text inside the reviewed documents was treated as data. No embedded directive that would change policy was found.

## 2. Changed attack surface

New or changed, compared with the T10 baseline:
- **Outbound to a real third party**: HTTPS requests to `https://api.football-data.org/v4` carrying a real credential, triggered by research and by catalogue GET routes.
- **A real credential in the process environment**: `FOOTBALL_DATA_API_TOKEN`, plus a probe script and optional live tests that use it outside the server.
- **New untrusted-input parsers**: provider JSON (now real, not committed fixtures), operator JSON files, operator CSV files (an own state-machine parser), web-form documents. MANUAL_DATA is **enabled in the default configuration**, so the import path is active without any opt-in.
- **New stored and served content**: import originals under `<dataDir>/imports/<importId>/`, served back by `getImportOriginal`.
- **New integrity surface**: verification statuses with candidate values, an operator action that sets MANUALLY_APPROVED, configurable publication policies, catalogue links that bind several sources.
- **New in-memory state reachable from GET**: request budget and projection cache.

Unchanged and still in force: every T10 control (TB-1 guards, egress client, fixture confinement, file confinement, redaction, supply chain), every T10-F01..F21 disposition, and the observations T10-A1-01..A1-06 (OD-15).

## 3. Threat model for the changed and new trust boundaries

Each boundary is assessed as Adequate, Adequate with findings, or Gap (must-fix).

### TB-2 (changed): server to a real sports-data provider

- Assets: availability of the single local process; integrity of facts (BR-01, BR-13); absence of person data (SC-07, R-119); the credential (TB-6).
- Threat actors: a misbehaving or compromised provider; a network attacker (TLS is the barrier; T10-F07 forbids disabling it); a hostile value inside otherwise valid data (names).
- Threats and design controls:
  - Oversized, decompression-bomb or slow bodies: decoded-byte streaming cap 512 KiB (schema maximum 2 MiB), total deadline 10 s, `redirect: 'error'`, exact-origin allow-list, socket-level guard and lint bans (T10-F07, T10-F08), unchanged.
  - Malformed or hostile JSON: `JSON.parse` (memory-safe), adapter allow-list Zod schemas, shared domain schema, unknown status rejects, structural checks; processing order fixed (cap, status, parse, allow-list, map, domain validation, cache). Good.
  - Person data (referees possible) and badge URLs (`crest`): dropped before mapping, counted, never logged. Good.
  - Error bodies echoing request data: parsed only to be discarded; closed failure codes. Good.
  - Retry amplification and 429 storms: no retry of 400, 401, 403, 404; at most 2 retries, 30 s cap; 429 waits within a purpose bound; budget shared by retries. Good, but the provider-supplied counter values are not bounded (T11H-F05).
  - Prototype-named keys in provider values used for grouping (stage values such as `__proto__` or `constructor`): not addressed (T11H-F07).
  - Instruction text inside a valid name now comes from a real source: T10-F06 residual R4 becomes reachable (T11H-F17, Q10).
  - Header value `X-Authenticated-Client` is read for classification; its value identifies the token owner (T11H-F04).
- Assessment: **Adequate with findings.** The parsing path is memory-safe and bounded; the isolation question is the Product Owner's (section 6).

### TB-6 (changed): `FOOTBALL_DATA_API_TOKEN`, a real provider credential

- Assets: the token (its request budget and the Product Owner's account standing with the provider).
- Leak paths considered: Git, configuration object and snapshot, database, cache, logs (server, test runner, e2e runner), error messages and problem details, URL and query, browser bundle and browser requests, evidence files, research findings, the probe's console output, the Orchestrator's session transcript, child processes, process diagnostics, a misconfigured `baseUrl`.
- Design controls: environment only, `.env.local` git-ignored and mode 0600, `.env.example` empty; read only by the adapter from the injected environment, kept in a closure, never in the configuration object, snapshot, database or cache; sent only as `X-Auth-Token` through the egress client; explicit pino redaction paths including `x-auth-token`, with marker tests; fail-closed startup naming the variable; default test setup and e2e runner remove it; synthetic marker token; `secret-scan`, `bundle-secrets`, `hygiene`, `marker-scan`; CSP `connect-src 'self'`; settings without base URLs.
- Gaps:
  - The only run with the real token (T53) can produce a `marker-scan` PASS that never compared the real value, and the probe's console output and the session transcript are unscanned sinks (T11H-F02, **must-fix**).
  - The token goes to whatever `options.baseUrl` the configuration names; process diagnostics are not excluded (T11H-F03).
- Assessment: **Gap (must-fix T11H-F02); otherwise adequate with findings.**

### TB-8 (new): operator-supplied MANUAL_DATA (JSON files, CSV files, web-form entry)

- Assets: availability; integrity of manual facts and of the preserved originals (BR-14); absence of person data (SC-07).
- Threat actors: the operator is trusted, but the **content** may originate from third parties (league websites, shared spreadsheets); any local process can also call `createImport` (TB-1 residual, section 7).
- Threats and design controls:
  - Parser denial of service: route body limit 1.5 MiB (global 64 KiB stays), content 512 KiB in bytes, 5 000 rows, fixed column count, 200 characters per field, no line break in a field, single-pass state machine without backtracking expressions, JSON depth pre-scan (16) before `JSON.parse`, error cap 500. Good. Linear-time behaviour must be proven by tests (section 6 conditions, V-42).
  - Encoding: the design states strict UTF-8 decoding with `TextDecoder(..., { fatal: true })` and byte-for-byte originals, but the contract carries the file content as already-decoded text inside JSON. As written, this cannot be implemented (T11H-F01, **must-fix**).
  - Duplicate JSON keys (last wins in `JSON.parse`) make the applied data differ from the preserved original (T11H-F08).
  - Person data: CSV header names and JSON keys rejected naming the field; strict schema. Good. Person names typed into a team field cannot be detected (residual R11).
  - Team-key derivation from names can collide or produce an empty key (T11H-F09).
  - Plain-object lookups with keys such as `constructor` (a valid `Slug`) (T11H-F07).
  - Form documents are not bound by the 512 KiB content check but the database `CHECK (original_bytes <= 524288)` is (T11H-F10).
  - Path traversal through file names: file names are metadata only; paths are built from UUIDs with exclusive create and realpath containment. Good.
  - Serving originals: `application/octet-stream` attachment, `nosniff`, sandbox CSP, CORP; the `Content-Disposition` file name is unspecified (T11H-F11).
  - Error reports: closed problem codes, sanitized field names; values must never be echoed (T11H-F12).
  - CSV formula injection when a downloaded original is opened in a spreadsheet: very small residual, because only fully validated imports are stored (Q12).
- Assessment: **Gap (must-fix T11H-F01); otherwise adequate with findings.**

### Cache contents (AD-27)

- In-memory LRU (500 entries) of validated domain projections with `retrievedAt` and `expiresAt`; never raw payloads, headers, URLs with query values, errors, credentials or person fields; keyed by source ID, resource kind and normalized parameters; stale entries only for discovery; lost on restart; never persisted.
- Threats: person data or the token cached; cache poisoning across sources; cache thrash driven by requests.
- Assessment: **Adequate.** Caching happens only after both schema validations, keys hold no credential, entries are per source. Thrash is bounded because only catalogue-known IDs should reach the provider (T11H-F06 makes this explicit).

### Rate-limit abuse (TB-1 note, AD-26)

- Any local process, and any browser page in a browser that does not send `Sec-Fetch-Site`, can call the catalogue GET routes and make the server spend the request budget (10 per rolling minute, shared with research and with the probe at the provider side).
- Controls: Fetch-Metadata refusal (T10-F04), serialized per-source queue, sliding 60-second window plus the provider counters, discovery waits at most 5 s, cached and stale listings.
- Gaps: discovery and research share one budget without reservation; concurrent identical cache misses are not coalesced; whether an unknown `competitionId` or `seasonId` reaches the provider is not stated (T11H-F06). Provider counter values are unbounded (T11H-F05).
- Assessment: **Adequate with findings.** Worst case: a temporarily exhausted free-plan budget (no money; no excess requests are possible through the API because the local window caps them). This is the trigger of section 7.

### Catalogue and provider identifiers (AD-21, AD-23, AD-31)

- Opaque `SourceRef` strings (at most 512 characters, `json_valid`) are created and interpreted only by the issuing adapter; the client never supplies one (the contract takes slugs and source IDs and the server resolves them through the catalogue). Good: no client-controlled provider URL path.
- Defence in depth for refs read back from the database: the adapter should validate the decoded code and season values and URL-encode path segments (part of V-36).
- The static identifier rule is a provider-neutrality control rather than a security control; Q14 answers its sufficiency (T11H-F15).
- Catalogue links can bind a DEMO_DATA source to a real competition, so synthetic observations could count toward a real fact (T11H-F13).
- Assessment: **Adequate with findings.**

### Integrity of statuses, manual approval and publication policies (AD-28)

- `facts.status` is written only by the verification stage; MANUALLY_APPROVED is derived from append-only `manual_approvals`; eligibility excludes LIVE_DATA, DEMO_DATA, disputed and unmatched facts; `approveFactManually` is atomic (`BEGIN IMMEDIATE`) and guarded by the TB-1 mutating-request controls; publication policies and per-source permission are **configuration only** (no operation writes them; `Settings` is GET only), with conservative defaults (`blocked`, `unconfirmed`, `every_supporting_source`).
- The AI data block now contains candidate (unverified) values (T11H-F16, restates V-13; not a weakening).
- Assessment: **Adequate.** R-429 and R-430 are not decided by the design; their defaults keep R-026 in force.

### Privacy

- `riskProfile.personalData: none` stays correct by design: provider person fields are dropped before cache, storage and logs; manual person-level fields are rejected; preserved originals therefore hold none.
- New items: the `X-Authenticated-Client` header value can identify the token owner (T11H-F04); person names typed by an operator into a team or competition field cannot be detected (residual R11).

## 4. Findings

Severity scale: CRITICAL, HIGH, MEDIUM, LOW. **No CRITICAL or HIGH finding.**

Disposition (as in T10):
- **must-fix**: a correction to the architecture or plan text, made by the architect as a targeted correction of T11G before T11J.
- **should-fix**: implemented in the named task within WI-1 and validated by T47; if absent at T47, reported there with this severity.
- **verify-in-T47**: no design change; T47 confirms the control was implemented.

Role class: 1 acceptable for synthetic local use; 2 must be fixed before implementation or merge; 3 blocks production use but not local use.

### Summary

| ID | Severity | Component / section | Disposition | Class | Blocks |
|----|----------|---------------------|-------------|-------|--------|
| T11H-F01 | LOW | TB-8 import content encoding and original fidelity; contract `ImportFileCreate.content`; provider-ports 1.6; data-model 1 | must-fix (before contract re-acceptance) | 2 | contract re-acceptance, T11J |
| T11H-F02 | MEDIUM | TB-6 real-token evidence: `marker-scan`, T53 sequence, probe console output, session transcript; T41, T49, T53 | must-fix | 2 | T11J (and any real-token run) |
| T11H-F03 | LOW | TB-6 token containment: origin pinning, process diagnostics, environment validation errors; T15, T19, T49 | should-fix | 2 | no |
| T11H-F04 | LOW | `X-Authenticated-Client` value is token-owner data; T49, T53 | should-fix | 2 | no |
| T11H-F05 | LOW | rate-limit header values unbounded; T49 | should-fix | 2 | no |
| T11H-F06 | LOW | catalogue GET routes and budget: unknown IDs, research reserve, coalescing; T21, T27, T49 | should-fix | 2 | no |
| T11H-F07 | LOW | untrusted keys in plain-object lookups; T21, T30, T49, T50 | should-fix | 2 | no |
| T11H-F08 | LOW | duplicate keys in imported JSON; T50 | should-fix | 2 | no |
| T11H-F09 | LOW | CSV team-key derivation collisions and empty keys; T50 | should-fix | 2 | no |
| T11H-F10 | LOW | form-channel original size against the database check; T50 | should-fix | 2 | no |
| T11H-F11 | LOW | `getImportOriginal` file name in `Content-Disposition`; T50, T51 | should-fix | 2 | no |
| T11H-F12 | LOW | import errors and logs must not echo values; T50, T19 | verify-in-T47 | 2 | no |
| T11H-F13 | LOW | source independence: DEMO_DATA counterparts and same-upstream sources; T17, T30, T52 | should-fix (level: Orchestrator) | 2 | no |
| T11H-F14 | LOW | LIVE `sourceRef` vs contract statement "no provider base URL in responses" and R-262, R-288; T16, T31, T40, T49 | should-fix (before T20 preferred) | 1 | no |
| T11H-F15 | LOW | static identifier rule bypass by inline disable directives; T15 | should-fix | 1 | no |
| T11H-F16 | LOW | AI data block now carries candidate values (V-13 restated); T22, T32 | verify-in-T47 | 1 | no |
| T11H-F17 | LOW | T10-F06 residual R4 reachable with LIVE and MANUAL names (Q10) | residual documented; production condition | 3 | no (production-blocking) |
| T11H-F18 | LOW (decision class HIGH-03) | SC-05 isolation of FootballDataProvider responses and of JSON, CSV and form imports | PO decision | 1 (3 beyond the conditions) | T49, T50 until decided (plan precondition 3) |
| T11H-F19 | LOW (decision class HIGH-03) | T10-F19 / Q5 re-raise: real credential behind a login-less API | PO decision | 1 | real-token configuration and T53's live run until decided |
| T11H-F20 | LOW (editorial) | provider-ports option row cites Q2 instead of Q8; `FileName` pattern refuses NFD names | should-fix (doc, T50, T51) | 1 | no |

### T11H-F01: import content encoding and original fidelity are not implementable as specified (LOW, must-fix before contract re-acceptance)

- **Component:** contract `ImportFileCreate.content` ("File content as text"); `contracts/provider-ports.md` section 1.6 (CSV: `TextDecoder('utf-8', { fatal: true })` (invalid UTF-8 rejected), BOM removed); `data-model.md` section 1 ("the original content ... byte for byte"); `ImportError.problem` `encoding_invalid`; T50; T51 ("read in the browser as text").
- **Description:** The file reaches the server as a JSON string that the browser has already decoded. The browser's text decoding replaces invalid UTF-8 with U+FFFD and strips a leading BOM; Fastify decodes the request body without a fatal flag; a JSON string can also carry lone surrogates (`\ud800`). So:
  - `encoding_invalid` can never trigger; invalid bytes arrive as U+FFFD (mostly rejected later by the name rules, with a misleading error);
  - the stored "original" is the UTF-8 encoding of the received string, not the operator's file; its SHA-256 does not match the file on disk whenever a BOM or invalid bytes were present, and a lone surrogate changes on re-encoding;
  - each implementer (T50, T51) will improvise a different reading.
- **Evidence:** contract lines for `ImportFileCreate`; provider-ports 1.6 CSV parser paragraph; data-model storage layout row "Import originals".
- **Exploitation scenario:** Not an exploit; an integrity and evidence defect. In a dispute about a manual result, the operator's file and the preserved original do not hash alike, so the preserved original no longer proves what was imported (BR-14 rule 7, R-277). Switching the field to bytes after `1.0.0` would be a breaking change under PD-11, so the choice must be made now.
- **Mitigation (choose one before re-acceptance; option a recommended):**
  - (a) Send the exact bytes: replace `content` by `contentBase64` (`contentEncoding: base64`, `maxLength` 699052 for 512 KiB); the server decodes base64, checks 512 KiB in bytes, decodes UTF-8 with `fatal: true`, removes a BOM for parsing only, and stores and hashes the received bytes. The UI reads the file with `arrayBuffer()`. The 1.5 MiB route limit already covers it.
  - (b) Keep text, and correct the design wording everywhere: the preserved original is the UTF-8 encoding of the received text; the server rejects content containing lone surrogates (`String.prototype.isWellFormed`) or U+FFFD as `encoding_invalid`; the UI decodes with `TextDecoder('utf-8', { fatal: true })` over `file.arrayBuffer()` and refuses invalid files before sending; R-277's "unchanged" is stated as "as received".
  - Either way, T50 tests: BOM, invalid UTF-8, lone surrogate, CRLF, and hash equality as defined.

### T11H-F02: the real-token evidence controls can pass without checking the real token, and two output sinks are unscanned (MEDIUM, must-fix)

- **Component:** `task-plan.md` T41 (`marker-scan`), T49 (probe), T53 (run and Verification line); `provider-research-plan.md` section 7; R-124, R-259, R-263.
- **Description:**
  1. `marker-scan` compares the real token only "when `FOOTBALL_DATA_API_TOKEN` is set in the environment" and prints only PASS or FAIL and a file count. T53 removes `.env.local` "after the run", and the Orchestrator re-runs Verification lines independently. A re-run after the removal passes on the marker alone, and neither the output nor the evidence shows whether the real value was ever compared.
  2. The probe's console output (stdout and stderr, including an uncaught exception printed with `util.inspect`, which can include a request options object with its headers) is shown to the Orchestrator and enters its session transcript. That is a log outside every scan.
  3. "The Orchestrator checks only that the variable is present" does not say how. A careless check (`cat`, `printenv`, `env`, a read tool on `.env.local`, `set -x`) writes the value into the transcript.
- **Exploitation scenario:** A probe failure path throws an error whose inspected form includes `headers: { 'X-Auth-Token': '<real token>' }`. It is printed to the console, captured in the transcript, and the later `marker-scan` of the research directory passes. Credential rule 4 is broken with a passing control.
- **Mitigation (plan text: T41, T49, T53):**
  - `marker-scan` prints `real token checked: yes|no`, and gains a `--require-token` option that exits 1 when `FOOTBALL_DATA_API_TOKEN` is absent or empty (positive-control test in `scripts/security-checks.test.mjs`).
  - T53 order: run the probe with stdout and stderr redirected to a git-ignored file in the task worktree (for example `.cache/probe-output.log`), never to the console; then, while `.env.local` is still present, run `node --env-file-if-exists=.env.local scripts/security-checks.mjs marker-scan --require-token docs/work-items/WI-1/research .cache/probe-output.log` and record its output as T53's evidence; then delete the log and `.env.local`. The Verification line names `--require-token` and the Orchestrator's verification relies on the recorded output of that run (a re-run after removal is expected to exit 1 and is not used).
  - The presence check prints no value, for example `grep -c '^FOOTBALL_DATA_API_TOKEN=..*' .env.local` (prints a count). No read tool, `cat`, `env`, `printenv` or shell tracing on the file or the variable.
  - T49: the probe's top-level handler catches every error and prints only a closed failure code and counts; a unit test runs the probe against a replay transport that throws, rejects and returns 401, 403, 429 and 500, and asserts that stdout, stderr and the findings file contain no marker token.

### T11H-F03: token containment details (LOW, should-fix in T49, T15 and T19)

- **Description and mitigation:**
  1. **Origin pinning.** The token is attached to requests to `options.baseUrl`, and the egress allow-list follows the same value. A wrong or malicious configuration (`EDR_CONFIG` can point to any file) would send the real token to another HTTPS host. The football-data adapter should attach `X-Auth-Token` only when the request origin equals the constant `https://api.football-data.org` (adapter code may hold provider identifiers, AD-31), and fail startup otherwise. Tests with the replay transport inject the transport, not a different origin.
  2. **Process diagnostics.** Node diagnostic reports (`--report-on-fatalerror`, `--report-uncaught-exception`, `--report-on-signal`) include the environment; heap snapshots include the closure. No npm script, `NODE_OPTIONS` default or documentation enables them (T15 `package.json` scripts and `docs/local-setup.md`).
  3. **Validation errors.** The adapter's format check (printable ASCII, 1 to 256 characters) must produce the fixed `ConfigError` text; a raw validation error object for the environment is never logged or thrown to the top level (some validators can include the input in issues).
  4. Optional hardening: the composition root may delete the variable from `process.env` after building the injected environment (T19), so later code and libraries cannot read it.

### T11H-F04: `X-Authenticated-Client` carries token-owner information (LOW, should-fix in T49 and T53)

- **Description:** The 403 classification reads `X-Authenticated-Client`. Its value identifies the registered client of the token (the Product Owner's account), which is personal data for a project whose risk profile says `personalData: none`. "A positive header" is not defined.
- **Mitigation:** Define the comparison as a boolean computed in memory (header present and its value is not the provider's anonymous marker, to be confirmed by T53). The value is never logged (including `SourceError.message` at debug level), stored, cached, returned or written into findings; the probe records presence booleans only, as section 1.4 already says for the findings. Tests assert the marker-shaped header value never appears in logs.

### T11H-F05: provider rate-limit header values are not bounded (LOW, should-fix in T49)

- **Description:** The budget blocks "until now + `X-RequestCounter-Reset`". A misbehaving or compromised provider (or a parsing slip, such as `Number('1e9')`) can block every request of the source until restart. "Invalid or missing values are ignored" does not define invalid.
- **Mitigation:** Parse both headers with `^[0-9]{1,6}$`; treat values above a bound (for example `X-RequestCounter-Reset` above 3 600 s, `X-RequestsAvailable` above 10 000) as invalid and ignore them; the local window still applies. Unit tests with negative, fractional, exponent and huge values.

### T11H-F06: catalogue GET routes and the request budget (LOW, should-fix in T21, T27 and T49)

- **Description:** Q11 asks whether catalogue GETs may spend budget. They may (section 5), but three details are missing: (a) whether an unknown or no-longer-listed `competitionId` or `seasonId` reaches the provider (it should not); (b) discovery and research share one budget, so a flood of discovery requests from a local process or a page without Fetch-Metadata can keep research waiting until its 65 s limit and failing `rate_limited`; (c) a burst of identical cache misses issues one provider request each.
- **Mitigation:** (a) `listSeasons` and `listStages` resolve IDs only against the cached catalogue and seasons listing and answer 404 without a provider request otherwise; (b) research and verification have priority in the queue and discovery may use at most `requestsPerMinute - 2` slots of a window (configurable); (c) single-flight per cache key; (d) a bound on queued discovery waiters, beyond which `PROVIDER_RATE_LIMITED` is returned at once. Unit tests with the injected clock (R-291 already covers the 60-second property).

### T11H-F07: untrusted keys in plain-object lookups (LOW, should-fix in T21, T30, T49 and T50)

- **Description:** Grouping matches by the provider's stage value, looking up teams by key, and building identity maps are natural to write with plain objects. `__proto__` passes the `StageName` pattern (underscores are allowed); `constructor`, `tostring` and `valueof` pass `Slug`. With a plain object, `teams['constructor']` returns a function, so "referenced team exists" can pass for an undeclared team, and grouping can throw or misbehave.
- **Mitigation:** Use `Map` (or `Object.create(null)`) for every lookup keyed by provider, import or derived values; never spread or `Object.assign` a raw parsed object before schema validation. Tests with `__proto__`, `constructor`, `prototype` and `toString` as stage values, team keys, team names and CSV team names.

### T11H-F08: duplicate keys in imported JSON (LOW, should-fix in T50)

- **Description:** `JSON.parse` keeps the last of duplicate keys. An imported file with two `score` members is applied with the second value while the preserved original shows both, so the audit copy and the applied data disagree and a reviewer reading the original can be misled.
- **Mitigation:** The linear pre-scan that already tracks nesting also rejects a duplicate member name within one object (`parse_error`, naming the JSON pointer). Test case in T50.

### T11H-F09: CSV team-key derivation can collide or produce an empty key (LOW, should-fix in T50)

- **Description:** Keys are derived from names (NFC, lowercase, diacritics removed, non-alphanumerics to `-`). Two different names ("Club A.B." and "Club A B") map to one key and merge silently; names written in a non-Latin script can map to dashes only and then to an empty or non-`Slug` key, so all such teams collide.
- **Mitigation:** Define the rule exactly (which characters count as alphanumeric, trimming and collapsing of `-`, the result must match `Slug`); reject an import where two different names derive the same key or a key is empty or invalid (`value_inconsistent`, naming both rows). Tests in T50.

### T11H-F10: the form channel can exceed the original size limit only at the database (LOW, should-fix in T50)

- **Description:** The 512 KiB content check applies to file content. A form document (bounded only by the 1.5 MiB route limit and the array limits) is stored as canonical JSON, and `imports.original_bytes` has `CHECK (... BETWEEN 1 AND 524288)`. A large form import passes validation, writes the original file, then fails the insert: a 500 `INTERNAL` and an orphan file.
- **Mitigation:** Serialize the form document canonically and check 512 KiB before writing anything (`too_large`). Test in T50.

### T11H-F11: `getImportOriginal` response file name (LOW, should-fix in T50 and T51)

- **Description:** The attachment's `Content-Disposition` file name is unspecified. Reflecting the stored `fileName` raw invites header-encoding defects (non-ASCII names; Node refuses some header characters and the request fails with 500).
- **Mitigation:** Use a server-generated ASCII name (`original-<importId>.json`, `.csv` or `.form.json`), or the stored name only through RFC 6266 `filename*` encoding after the `FileName` check. The UI link uses the `download` attribute. Test in T43 (headers) and T50.

### T11H-F12: import errors and logs must not echo values (LOW, verify-in-T47)

- **Description:** A rejected import may contain person names (the reason it is rejected) or other text. `ImportError.message` and `field` are specified as fixed text plus sanitized parameters; the rule must also exclude cell or member **values**, and the request body of `createImport` must never be logged (including at debug level or by an error handler that logs the request).
- **Mitigation:** T50 tests that errors for a rejected file carrying a marker-shaped value contain row, column and problem only, and that the captured log has no marker; T19's error handler never logs bodies.

### T11H-F13: source independence can be defeated by configuration (LOW, should-fix in T17, T30 and T52; level to be classified by the Orchestrator)

- **Description:** Two configuration paths let BR-01 count data that is not independent:
  1. A link in `config/catalogue.json` can bind a real competition to a DEMO_DATA source (`demo-b` is `accepted: true`, verification role, official publication). Counterpart resolution would then use synthetic observations to verify or dispute real facts, and the project's mode (LIVE_DATA or MANUAL_DATA) would not show a demonstration label.
  2. Two sources with the same adapter and the same `baseUrl` origin in different `independenceGroup` values count as two independent groups (self-verification by one upstream).
  In WI-1 the impact is contained by the R-430 default (`unconfirmed` blocks verified LIVE_DATA content), but it becomes real when the Product Owner confirms permission.
- **Mitigation:** Startup validation: sources sharing adapter kind and origin must share an independence group; the verification stage counts DEMO_DATA observations only for DEMO_DATA projects (others are recorded as `consulted` at most), or links binding DEMO_DATA with non-DEMO sources are refused. T52's R-256 test then uses a second replay-backed LIVE-shaped source instead of a fixture source. I read this as implementing BR-01 and SC-04 rather than changing them (MEDIUM at most); the Orchestrator classifies.

### T11H-F14: LIVE `sourceRef` conflicts with the contract's own "no provider base URL" statement (LOW, should-fix, before T20 preferred)

- **Description:** `info.description` states "No credential, provider base URL or provider token is ever part of a request or response", and CS-4 relies on it. Yet `Evidence.sourceRef` for LIVE_DATA is "an `https:` URL on the configured source origin". The UI's `SafeReference` is to link only URLs "whose origin equals the configured source origin", but the UI never receives a base URL. The URL also names the provider in an API response (R-288 neutrality; T43 runs on fixture data and would not see it) and, as a link, makes the browser call the provider host (R-262 wording).
- **Mitigation:** LIVE adapters give a provider-neutral attribution reference (for example `source:<sourceId>/<resource>@<retrievedAt>`), and the resource URL stays server-side (log template only). The UI shows LIVE references as text. Alternatively, amend the contract statement explicitly. Either is a text correction; `sourceRef` remains a string of at most 512 characters, so it is compatible.

### T11H-F15: the static identifier rule can be disabled inline (LOW, should-fix in T15)

- **Description:** An `// eslint-disable-next-line no-restricted-syntax` comment silently bypasses R-289 in core code. Fragment assembly is an accepted residual (AD-31), but disable comments are cheap and invisible in a diff review of large files.
- **Mitigation:** Set `linterOptions.noInlineConfig: true` (or `reportUnusedDisableDirectives: 'error'` plus a rule that forbids disable directives naming `no-restricted-syntax` or `no-restricted-imports`) for `apps/**` and `packages/**` outside tests; the seeded test of T15 includes a disabled violation and expects an error.

### T11H-F16: the AI data block now carries candidate (unverified) values (LOW, verify-in-T47; restates V-13)

- **Description:** T10 TB-3 stated "the prompt contains only verified structured facts". After T11G it contains verified values or candidate values that block approval (`provider-ports.md` section 2). The security properties that mattered (structured, schema-validated values; no provider free text beyond validated names; no person data, secrets, data modes or paths) are kept, and the integrity property moves to the publishability guard. This is not a weakening.
- **Mitigation and check:** V-13 is restated (section 10, V-13a). Additionally, operator free text of imports (`declaredSource`, `fileName`) and every `sourceRef` never enter the data block.

### T11H-F17: T10-F06 residual R4 is now reachable (LOW, class 3; answers Q10)

- See Q10. Residual accepted for WI-1 by the existing controls; production condition stated there.

### T11H-F18: SC-05 isolation decision (LOW risk; decision class HIGH-03)

- See section 6.

### T11H-F19: the real-credential re-raise of T10-F19 (LOW risk; decision class HIGH-03)

- See section 7.

### T11H-F20: editorial and conformance points (LOW, should-fix as documentation and in T50, T51)

- `provider-ports.md` section 1.4 option `maxResponseBytes` says "reviewed by T11H (question Q2 of section 11.4)"; it is Q8.
- `FileName` (`^[\p{L}\p{N} ._()-]{1,115}\.(json|csv)$`) has no `\p{M}`, so a decomposed (NFD) name such as some macOS file names with accents is refused. The UI normalizes to NFC before sending (T51), or the pattern is widened (widening a request input is additive).

## 5. Answers to the architect's questions (architecture-delta.md section 11.4)

### Q7: Is Option A acceptable for football-data.org JSON and for manual JSON and CSV, or is B or C needed?

**Option A is acceptable for both, with the conditions in section 6.** The parsers are memory-safe JavaScript (`JSON.parse`, own linear CSV state machine, Zod), inputs are bounded by bytes, rows, columns, depth and error count, and provider input also by a deadline. The realistic worst case is a denial of service of the local process, not code execution or privilege gain. Option C adds privilege separation that matters for memory-unsafe or native parsers, none of which is introduced. Option B would contain a defect that makes the synchronous CSV parser super-linear; I recommend it only as a fallback if T50's adversarial timing tests fail. The decision itself is the Product Owner's (HIGH-03, SC-05).

### Q8: May a source raise `maxResponseBytes` up to 2 MiB for the season-wide match list, or should stage discovery use smaller requests?

**A raise up to the 2 MiB schema maximum is acceptable, scoped to the stage-discovery request only and backed by T53's measured sizes.** A domestic league season (380 matches) is likely above 512 KiB in the v4 shape. Prefer a per-resource option (for example `maxResponseBytesByResource.stageDiscovery`, at most 2 MiB) to a source-wide raise: matches of one matchday and standings stay far below 512 KiB, and that cap keeps protecting them. The request is made once per season and cached (1 h current, 24 h past), so the extra parse cost (a few milliseconds and some megabytes of transient memory) is not an amplification vector. Smaller requests (for example per date window) would spend more of a 10-per-minute budget for no security gain. This stays within T10-F07 (configurable up to 2 MiB): a configuration choice, no new security decision. Anything above 2 MiB needs a new review.

### Q9: Is the 403 classification by `X-Authenticated-Client` acceptable?

**Yes.** Both outcomes refuse without retry and discard the body, so the classification changes only the displayed reason. Conditions (T11H-F04): the header value is never logged, stored, cached or written into findings; "positive" is a closed comparison confirmed by T53; the "subscription restricted" wording offers no purchase or upgrade path (SC-03, R-111).

### Q10: With LIVE_DATA names reaching the AI data block and the slides, is the R4 residual acceptable for WI-1, or is a pinned allowed-name set needed first?

**Acceptable for WI-1 without a pinned name set**, because:
- LIVE_DATA content is not publication-approvable in WI-1 (R-055, BR-13: single source; and R-430's default `unconfirmed` permission), so nothing with such a name can be finally approved or exported;
- names enter the AI only inside the framed data block, numbers and names are placeholders substituted deterministically, the result relation is a fixed phrase, and the default AI is the stub (a hosted AI is a separate SC-05 trigger);
- the name rule blocks structure-breaking characters, and the operator sees names verbatim with provenance labels.

The same residual applies to MANUAL_DATA names (operator-typed, possibly copied from third-party pages); R-429's default `blocked` contains it the same way.

**Production condition (class 3):** before LIVE_DATA or MANUALLY_APPROVED content can become publication-approvable (a secondary source approved under U-18, R-430 confirmed, or R-429 answered with an allowing option), the T10-F06 follow-ups become required: the capitalized-token warning flag (MED-04) and pinned expected names or an allowed-name set in the identity map, with a changed name treated as unverified; and TB-2 and TB-3 are re-reviewed with the chosen AI.

### Q11: Are catalogue GET routes that can spend the provider budget acceptable under T10-F04 and V-06?

**Yes.** V-06 requires no **persistent** side effects; the budget and the cache are in memory and the contract says so. The spend is bounded by the local window (no request beyond 10 per minute can leave the process), Fetch-Metadata refuses cross-site browser requests, and the worst case is a temporarily exhausted free budget (availability only, no cost). Conditions: T11H-F05 and T11H-F06 (catalogue-known IDs only, research priority or reserve, single-flight, bounded waiters). The residual "any local process can spend the budget" is the real-credential trigger of section 7. Fastify's automatic HEAD routes follow the same rules.

### Q12: Is serving import originals as `application/octet-stream` attachments with a sandbox CSP sufficient, including the CSV formula-injection residual?

**Yes, with T11H-F11.** The attachment disposition, `octet-stream`, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and CORP `same-origin`, a UUID lookup before serving, and the Fetch-Metadata refusal mean the browser neither renders nor sniffs the content, and other sites cannot embed or read it.

The formula-injection residual is smaller than the delta states: only fully validated imports are stored, and every stored CSV field has passed a name, slug, enum, date-time or integer rule. Those rules refuse `=`, `+`, `@`, `|`, `!`, quotes and commas inside names. What can survive is a name that starts with `-` and contains digits and letters only (for example `-1-1`), which a spreadsheet may evaluate as arithmetic: an annoyance, not code execution. Do not alter originals to neutralize formulas (that would break preservation). A one-line note in the import history ("open originals as text") is enough. The residual is accepted at LOW (R10).

### Q13: Are the credential controls, the probe's output rules and `marker-scan` sufficient for credential rule 4, and should the real-credential trigger of T10-F19 go to the Product Owner with the isolation decision?

**Sufficient after the must-fix T11H-F02 and the should-fix T11H-F03 and T11H-F04.** The design's controls cover the server, tests, bundle, database, cache and evidence well. The gaps are the real-token run itself (scan that can silently skip the real value, console output and session transcript unscanned, presence check method) and token origin pinning.

**Yes, put the trigger to the Product Owner in the same batch**, with the assessment and options of section 7. It is an existing re-raise condition (`architecture.md` section 12.2, from T10 Q5), and a decision that could change the contract (an added required header) is cheapest before T20 promotes `1.0.0`.

### Q14: Is the static identifier check as an ESLint rule with a seeded-violation test sufficient for R-289?

**Yes, as an automated regression guard**, with T11H-F15 (no inline disables in core code). It covers the R-289 examples (`CL`, `2001`, the host, the competition name), case-insensitive substrings, imports of adapter directories, and a seeded test proving the rule fires and that exemptions are limited. Identifiers assembled from fragments or read from configuration are accepted residuals, covered by T45's conformance review and by T20 and T43's neutrality tests of the contract and domain schemas. R-289 is a provider-neutrality requirement; no security control depends on it.

### Q15: Do the new mutating operations and the revised contract preserve CS-3 and CS-4?

**Yes** (section 9). All 15 mutating operations, including `createImport`, `approveFactManually` and `revokeManualFactApproval`, declare `ClientHeader`, 403 and 415 (and 413 where a body exists; the two manual-approval operations have no body). Imports keep `application/json`, so no new content-type exception exists. No operation writes a fact status, a publication policy or a source permission, and no schema exposes a credential or base URL, except the `sourceRef` statement conflict of T11H-F14, which does not touch authorization.

## 6. SC-05 isolation decision for the Product Owner (T11H-F18)

**Why this is HIGH:** HIGH-03 lists "isolation of untrusted-input processing (for example parsers)" as a security-sensitive architectural decision, and SC-05 (from PD-10, a Product Owner decision) requires a new review **and a new Product Owner decision on isolation** before the first real sports-data adapter or a new input type is introduced. No existing source decides it; the reviewer and the Orchestrator cannot. The risk itself is LOW. Plan precondition 3 already makes T49 and T50 wait for it; DEMO_DATA work does not.

### 6.1 Input 1: FootballDataProvider response processing

- Input: JSON from a third-party HTTPS API (untrusted content, trusted transport).
- Parsers: `JSON.parse` (V8, memory-safe), Zod allow-lists, domain validation; at most 512 KiB (2 MiB for stage discovery if Q8 is applied), 10 s total deadline, cached only after validation.
- Worst realistic case: a compromised or broken provider causes a short CPU or memory spike or a rejected listing. No code execution path is known for this pipeline.

| Option | Description | Cost | Effect |
|--------|-------------|------|--------|
| **A (recommended)** | In-process parsing with the listed controls and the conditions below | none beyond the controls | LOW residual: local availability only |
| B | Parse and validate in a `worker_threads` worker with `resourceLimits` and a deadline | one platform module, tests, result serialization | contains memory and CPU exhaustion; no privilege separation; little gain at 512 KiB to 2 MiB |
| C | Child process under the Node permission model, no file-system or network permission | higher; platform-specific | adds privilege separation, which a memory-safe parser hardly needs |

### 6.2 Input 2: MANUAL_DATA imports (JSON files, CSV files, web-form entry)

- Input: operator-supplied content that may originate from third parties; enabled in the default configuration; reachable by any local process (section 7).
- Parsers: Fastify JSON body parser for the envelope (1.5 MiB route limit), `JSON.parse` after a size check and a depth pre-scan for JSON files, an own single-pass CSV state machine (new code, the main risk is a logic defect), one strict schema.
- Worst realistic case: a crafted file triggers a parser defect that blocks the process (the parser is synchronous, so an in-process deadline cannot interrupt it), or wrong values (but every import passes the same schema and semantic checks before application).

| Option | Description | Cost | Effect |
|--------|-------------|------|--------|
| **A (recommended)** | In-process parsing with the listed controls, linear-time assurance by tests (conditions below) | none beyond the controls and tests | LOW residual: local availability only |
| B | Parse and validate in a `worker_threads` worker with `resourceLimits` and a deadline | one platform module and tests | interrupts a non-terminating or super-linear parse; no privilege separation |
| C | Child process under the Node permission model, bytes in and validated JSON out | higher; platform-specific | privilege separation; not needed for memory-safe code |

### 6.3 Recommendation and conditions

**Recommend Option A for both inputs**, with these conditions (T47 checks them as V-54):
1. The caps, deadline, processing order and schemas of `contracts/provider-ports.md` sections 1.4 and 1.6 as corrected by this review (T11H-F01, F05, F07, F08, F09, F10).
2. T50 adds an adversarial corpus for the CSV parser and the JSON pre-scan (512 KiB of `"`, alternating `""`, unterminated quote, only separators, CR-only line ends, NUL, BOM only, overlong UTF-8, lone surrogates, 5 001 rows, a 201-character field, depth 17, duplicate keys, `__proto__` keys) and a timing test proving roughly linear time at the cap (for example, parse time at 512 KiB within a fixed multiple of the time at 64 KiB). If that test cannot be met, Option B becomes the fallback for input 2 (a re-plan, MED-05, plus a decision note).
3. No new parser dependency (CSV library, XML, spreadsheet or archive reader) and no native decoder.
4. Re-review and a new Product Owner isolation decision before: a new input format (XLSX, ODS, XML, HTML or scraping, PDF, archives); raising any cap above 2 MiB or the import limits; a second real provider adapter (the secondary source of U-18, already planned for review); a hosted AI provider; running on a shared or multi-user host.

## 7. Q5 / T10-F19 re-raise assessment for the real credential (T11H-F19)

**Trigger met.** `architecture.md` section 12.2 (from T10 Q5) says the login-less residual "is re-raised to the Product Owner (HIGH-03, identity model) ... before ... real provider credentials are configured". PD-12 configures exactly that once LIVE_DATA is enabled.

**What a local process (of any OS account, or a host-network container) can do through the API with LIVE_DATA enabled:**
- make the server spend the token's request budget, up to the local cap of 10 per minute, shared with the operator's own use and with the probe. Effect: the operator's research waits or fails `rate_limited` (availability). No money: free plan only, and no purchase or upgrade is authorized (SC-03, R-111). The local cap keeps the use within the plan's published allowance, so the provider sees no excess traffic from the API;
- read LIVE_DATA listings and facts (public sports data, no confidentiality);
- as before (T10-F19): create projects and imports, manually approve eligible MANUAL_DATA facts, approve and export content.

**What it cannot do:** read the token (no route returns it; `.env.local` is mode 0600 against other OS accounts; the same OS user can already read the file directly).

**Risk:** LOW (availability of a free budget; account standing with an unpublished-terms provider is not endangered because traffic stays within the plan's rate).

**Is a Product Owner decision needed?** **Yes.** HIGH-03 covers the identity and authentication model. PD-05 chose no login before any credential existed; PD-12 set credential **handling** but not who may cause the credential to be used. The approved architecture (section 12.2) explicitly routes this trigger to the Product Owner, and the reviewer cannot convert an approved re-raise into a self-accepted residual. It is not "accepting a HIGH finding" (the finding is LOW); it is an identity-model confirmation.

| Option | Description | Cost | Effect |
|--------|-------------|------|--------|
| **A (recommended)** | Confirm PD-05 (no login) for LIVE_DATA on a single-user workstation, with a free-plan token only, `.env.local` mode 0600, LIVE configuration enabled only when needed, and the budget controls of T11H-F05 and T11H-F06 | none | LOW residual (budget exhaustion by local processes); re-raise again before a paid plan, a shared or multi-user host, or real non-public data |
| B | Add an out-of-band per-launch secret (printed at startup, entered by the operator) required on mutating and provider-spending routes | identity-model change; contract change (a new required header). Before T20 it is part of the proposal; after `1.0.0` it is not additive (HIGH-06) | stops other local processes; more friction; T10 Q1 analysis applies |
| C | Keep LIVE_DATA disabled with a real token until a login model exists | none in code | the LIVE_DATA demonstration (R-290 live part, R-440) and T53's live probe wait |

What waits on this decision: configuring the real token (T53's live run, any LIVE_DATA demonstration). T49 does not need to wait for it (it uses the synthetic marker only); it waits for the SC-05 decision. **Timing:** ask in the same batch as SC-05, before T20 promotes `1.0.0`, so that Option B, if chosen, does not become a breaking change.

## 8. HIGH-list classification

| Item | HIGH entry | Classification | Who | Recommendation |
|------|-----------|----------------|-----|----------------|
| SC-05 isolation, provider JSON (T11H-F18) | HIGH-03 (isolation of untrusted-input processing); SC-05 | **HIGH**, risk LOW | Product Owner | Option A with section 6.3 conditions |
| SC-05 isolation, JSON, CSV and form imports (T11H-F18) | HIGH-03; SC-05 | **HIGH**, risk LOW | Product Owner | Option A with section 6.3 conditions; B as fallback |
| T10-F19 re-raise for the real credential (T11H-F19) | HIGH-03 (identity model); `architecture.md` 12.2 | **HIGH**, risk LOW | Product Owner, same batch, before T20 | Option A |
| Re-acceptance of `http-api` `1.0.0-proposed.2` | MED-01 vs HIGH-06 | **MEDIUM** (pre-release revision, section 9) | Orchestrator, after T11H-F01 | accept; new OD superseding OD-14's text |
| T11H-F13 independence and mode integrity | MEDIUM at most (implements BR-01, SC-04); HIGH-07 only if read as a rule change | Orchestrator classifies | Orchestrator | add as should-fix |
| R-429, R-430, C-1, C-3 | HIGH-07 / HIGH-05 (open, E-09..E-12) | not decided here | Product Owner | none from this review; the design's defaults are the conservative readings and no security objection exists |
| Removing or relaxing any TB-6 or TB-8 control later | HIGH-03 (weakening a control) | HIGH | Product Owner if ever proposed | - |

No finding of HIGH or CRITICAL severity exists, so no risk acceptance is requested apart from the two decisions above.

## 9. Contract Safety review of `http-api` `1.0.0-proposed.2`

The configuration declares no additional conditions (`policy.contractSafetyConditions` = CS-1..CS-5). One finding per condition. I counted 39 operations on 32 paths; the 15 mutating operations are createProject, updateProject, startRun, approveFactManually, revokeManualFactApproval, setExcludedMatches, regenerateElement, approveElement, withdrawElementApproval, acknowledgeQaWarnings, approveCarousel, exportCarousel, createImport, registerBrandAsset and updateBrandAsset.

| Condition | Result | Finding |
|-----------|--------|---------|
| **CS-1** backward compatible | **Holds** | No version has been promoted, declared or snapshotted, and no consumer or code exists (`contracts: []`), so the non-additive edits against the OD-14 text break nobody. The T10-F03 condition is met for every new input: `Slug`, `SourceId`, `Uuid`, `Label`, `FileName`, `DisplayName`, `StageName`, `TeamName` patterns; `maxLength` on `content` and `kickoff`; `maxItems` and numeric bounds throughout `ManualImportDocument`; `matchday` 1 to 999; no unconstrained request string. **Condition:** T11H-F01 must be settled before re-acceptance, because changing `content` to bytes after `1.0.0` would be breaking. |
| **CS-2** within approved scope | **Holds** | New and changed operations trace to PD-12, PD-13 and PD-14 and their requirements (catalogue R-072..R-077, R-141, R-243, R-282..R-291; imports R-057, R-060..R-069, R-273..R-280; manual approval R-070, R-071, R-272, OD-17). No publication, login, account or provider-specific operation; no operation sets `verified`. The generic-stage shape is applied provisionally pending E-11 and E-12 (C-1, C-3); either answer is a configuration restriction (`restrictToLinks`, `selectableStages`) with no contract change, so the scope question does not make the contract wrong. The re-acceptance must not be read as resolving C-1 or C-3. |
| **CS-3** preserves authorization boundaries | **Holds** | No identity is added (PD-05). All 15 mutating operations declare `ClientHeader`, 403 and 415; `createImport` also 413; the global TB-1 guards apply unchanged because imports stay `application/json`. 403 is now declared on every operation (T10-A1-01 applied). No operation writes `verificationPolicy`, `publicationPermission` or a fact status; `Settings` is GET only. The new GET operations are side-effect free apart from in-memory budget and cache, and the contract says so. |
| **CS-4** does not weaken any security control | **Holds** | Controls are added: name patterns refusing control and format characters; closed `ImportError`, `Availability`, `ListingMeta`, `Failure` (extended, still closed), `refusalReason`; bounded import documents and an error cap; `getImportOriginal` with attachment, `nosniff`, sandbox CSP and CORP; `Evidence.sourceRef` still rendered only as safe text or link. No existing limit or guard is removed. Observation, not a weakening: the statement "no provider base URL ... in any response" conflicts with LIVE `sourceRef` (T11H-F14, should-fix). |
| **CS-5** does not change business-rule semantics | **Holds** | BR-01, BR-02, BR-09, BR-11 and R-026, R-027, R-412 are implemented as before. MANUALLY_APPROVED implements PD-13 (BR-12) as decided: never verification, refused for LIVE_DATA, DEMO_DATA and disputed facts, not publishable under the default while R-429 is open. Candidate values make content draftable but never approvable while unpublishable (R-271, R-290). `disputed` keeps its meaning as an unverified reason (OD-17). The removal of the league-phase constant follows PD-14 (pending E-12) and is reversible by configuration. |

**Classification question: is revising the never-declared proposal after OD-14 a pre-release revision (MED-01) or a HIGH-06 change?**

**A pre-release revision, MED-01. Not HIGH-06.** Reasons:
1. Contract Safety and HIGH-06's first clause apply to contracts the project **declares** in `contracts`; none is declared, and no snapshot exists.
2. PD-11 approved the evolution policy "as written": section 2.1 binds "within `v1`" and "every change to the **declared** contract". `v1` begins when T20 promotes `1.0.0` and T25 declares it; the proposal carries pre-release versions (`1.0.0-proposed`, `1.0.0-proposed.2`). An existing source therefore resolves the question (decision flow step 1), and I can classify it with confidence.
3. OD-14 is a MEDIUM, reversible Orchestrator acceptance of a proposal ("reversal cost: low (additive; not yet declared)"). Accepting a revised proposal replaces a MEDIUM decision with another MEDIUM decision.
4. HIGH-06's second clause ("any change to the contract-evolution policy") is not touched: the revision does not alter PD-11. To keep it that way, the re-acceptance record (a new OD superseding OD-14's accepted text) should state that PD-11 applies unchanged from T20's promotion onward, and that the re-acceptance does not decide C-1, C-3, R-429 or R-430.
5. From the security side, nothing removed by the revision was a security control (removed: `phases`, the `league` constant, `matchdayId`, `matchdayNumber`, `qualification_zone`, `verified_fact`, status value `disputed`).

**Result:** all five conditions hold. Re-acceptance is MEDIUM (MED-01) for the proposal **as corrected by T11H-F01**; T11H-F14 is recommended in the same correction (text only).

## 10. Controls that T47 must validate for the change

T47 validates V-01..V-29 as before, V-30 as amended, and V-31..V-55 below, from the code and the T46 evidence pack (as extended by T11G items 19 to 24 and by T11H-F02 for T53). A control without evidence is marked NOT VERIFIED with the command named here.

**Amended**
- V-13a (restates V-13; T11H-F16): the AI data block holds only schema-validated structured values (verified values or blocking candidate values), validated names, placeholders and fixed instructions; never provider free text, person data, secrets, data modes, file paths, `sourceRef` values or import `declaredSource` or `fileName`. Evidence: T46 [content-safety]; code of `providers/ai` and `modules/content`.
- V-30 (amended): PD-10 (U-03) is recorded and its conditions hold; the SC-05 isolation decision for FootballDataProvider and the manual input types is recorded with a PO decision ID before T49 and T50 started; the T10-F19 re-raise decision is recorded before any real token was configured. Evidence: requirements decision register, source of truth, tracker Decisions and Event log (start times of T49, T50, T53).

**TB-6: credential**
- V-31: Token sourcing: read only by the football-data adapter from the injected environment at construction; absent from the configuration object, `config_snapshot`, database, cache and `Settings`; `validateStartup` fails closed naming the variable only; format check printable ASCII 1 to 256; not read without an enabled LIVE_DATA source. Evidence: T46 [ingestion-unit], [ingestion-security]; code.
- V-32: Token transmission: only the `X-Auth-Token` header through the egress client; never in a URL or query; attached only for the pinned origin `https://api.football-data.org` (T11H-F03). Evidence: T46 [ingestion-unit]; code.
- V-33: Token never in logs, errors or responses: redaction paths including `req.headers["x-auth-token"]` and `headers["x-auth-token"]` with marker tests; `SourceError.message`, stored failures and problem details without the marker; environment validation errors fixed text; no Node diagnostic report flags in scripts or documentation (T11H-F03). Evidence: T46 [platform-unit], [ingestion-security]; `package.json`; `docs/local-setup.md`.
- V-34: Test and tooling hygiene: `vitest.setup.ts` deletes the token and `EDR_LIVE_TESTS` for default projects; the e2e runner forwards neither; live tests skipped without both variables; `.env.example` empty; `secret-scan`, `hygiene` and `marker-scan` have positive-control tests, including `--require-token` (T11H-F02). Evidence: T46 [secret-scan], [hygiene], [marker-scan], [live-skipped], [platform-unit]; `scripts/security-checks.test.mjs`.
- V-35: Browser: CSP `connect-src 'self'`; the bundle contains no marker, dummy key, assignment or provider host; LIVE references shown as text only and no provider URL in API responses (T11H-F14). Evidence: T46 [platform-security], [bundle-secrets], [web-security-unit].
- V-36: Probe and T53: findings contain no token, no header value other than the rate-limit counters and `X-API-Version`, no `X-Authenticated-Client` value, no raw body and no person data; at most 30 requests; probe console output redirected and scanned; the T53 marker scan ran with `--require-token` and printed `real token checked: yes` before `.env.local` was removed (or the findings say "probe not run"). Evidence: T53 recorded output; `docs/work-items/WI-1/research/football-data-capabilities.md`; T49 probe unit test in [ingestion-unit].

**TB-2: real provider**
- V-37: Response handling in the specified order; allow-list schemas per resource; `referees`, `crest` and every unknown field dropped and counted (count only logged); unknown status rejected; error bodies discarded; refs read back from the database validated and path segments URL-encoded; `Map`-based grouping (T11H-F07). Evidence: T46 [ingestion-unit]; code.
- V-38: Errors and retries: never retry 400, 401, 403, 404; at most `maxRetries`, 30 s total; 429 waits within the purpose bound; 403 classification uses a boolean only and the `X-Authenticated-Client` value is never logged or stored (T11H-F04). Evidence: T46 [ingestion-unit].
- V-39: Budget: no more than `requestsPerMinute` requests in any 60-second window (injected clock); provider counters parsed strictly and clamped (T11H-F05); research priority or reserve, single-flight and bounded discovery waiters (T11H-F06); discovery waits at most 5 s, research at most 65 s. Evidence: T46 [ingestion-unit], [ingestion-security].
- V-40: Cache: validated projections only (no raw payload, header, URL with query values, error, token or person field), at most 500 entries, TTLs as specified, stale entries only for discovery, never persisted. Evidence: T46 [ingestion-unit] (test accessor).
- V-41: Egress: the provider origin is allowed only while an enabled LIVE_DATA source uses it; default cap 512 KiB; any raise only for stage discovery, at most 2 MiB, and backed by T53's measured sizes (Q8). Evidence: T46 [platform-unit]; `config/live.config.json`; T53 findings.
- V-42: Catalogue routes: unknown or unlisted IDs answer 404 without a provider request; GET and HEAD have no persistent side effect; Fetch-Metadata applies. Evidence: T46 [ingestion-security], [platform-security].

**TB-8: manual imports**
- V-43: Import route: JSON only; 1.5 MiB route limit while the global limit stays 64 KiB; guards before body parsing; a deeply nested 1.5 MiB envelope is refused quickly with 400; content limit checked in bytes; the encoding rule chosen for T11H-F01 implemented and tested (BOM, invalid UTF-8, lone surrogate). Evidence: T46 [ingestion-unit], [module-integration]; code.
- V-44: CSV parser: single-pass state machine without backtracking expressions; limits (512 KiB, 5 000 rows, fixed columns, 200 characters, no line break in a field); adversarial corpus and linear-time test of section 6.3 pass. Evidence: T46 [ingestion-unit]; test code.
- V-45: JSON files: size check, depth pre-scan (16), duplicate keys rejected (T11H-F08), strict schema with unknown keys as errors; form documents size-checked after canonical serialization (T11H-F10). Evidence: T46 [ingestion-unit].
- V-46: Person data: person-like CSV columns and JSON keys rejected naming the field; nothing stored on rejection; errors carry no values and request bodies are never logged (T11H-F12). Evidence: T46 [ingestion-unit], [ingestion-security].
- V-47: Semantic and key rules: duplicate match identity, home differs from away, referenced teams exist (`Map` lookups), finished needs a score, standings consistency, metadata conflicts; team-key collisions and empty keys rejected (T11H-F09). Evidence: T46 [ingestion-unit].
- V-48: Application atomicity and storage: original written first with exclusive create under a realpath-checked UUID path; one `BEGIN IMMEDIATE` transaction; nothing stored on rejection; the original's SHA-256 equals the hash defined by T11H-F01. Evidence: T46 [module-integration], [ingestion-security].
- V-49: `getImportOriginal`: attachment with a server-generated or RFC 6266-encoded file name (T11H-F11), `application/octet-stream`, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, CORP `same-origin`; served only after a database lookup by UUID. Evidence: T43 contract tests; T46 [module-integration].

**Integrity**
- V-50: Manual approval: eligibility as `architecture.md` section 7.4; closed refusal reasons; append-only; atomic; revocation invalidates dependent final approvals; MANUALLY_APPROVED never shown, stored, traced or exported as verified (UI and manifest). Evidence: T46 [ingestion-unit], [module-integration], [web-security-unit], [delivery-security].
- V-51: Policies are configuration only (no operation writes `verificationPolicy`, `publicationPermission` or a fact status); defaults `blocked`, `unconfirmed`, `every_supporting_source` in every committed configuration unless a recorded Product Owner decision changed them; `config_snapshot` records them per run. Evidence: code; `config/*.json`; T43.
- V-52: Source independence (T11H-F13): sources sharing adapter kind and origin share an independence group; DEMO_DATA observations never count toward a non-DEMO project's facts (or mixed links are refused). Evidence: T46 [platform-unit], [ingestion-security].
- V-53: Demonstration labelling: band on every DEMO_DATA slide, `demonstration: true` and the data mode in `manifest.json`, labels in the project list and review view. Evidence: T46 [delivery-security], [web-security-unit].

**Contract, identifiers and decisions**
- V-54: The SC-05 conditions of section 6.3 hold in the delivered code (no new parser dependency, no native decoder, no new input format, caps within limits). Evidence: `package.json` and T46 [versions]; code.
- V-55: Contract and neutrality: the promoted contract equals the re-accepted `1.0.0-proposed.2` (with the T11H-F01 correction) except `info.version`; all 15 mutating operations declare `ClientHeader`, 403 and 415 (413 with a body) and are exercised; no provider identifier in the contract, domain schemas or responses; the provider-identifier lint rule is present with its seeded test and without inline disables (T11H-F15). Evidence: PRJ-CONTRACT, PRJ-CONTRACT-ID; T46 [lint], [static-identifiers].

## 11. NOT VERIFIED items and residual risks

### NOT VERIFIED (design-time assumptions to confirm)

| ID | Assumption | Evidence requested |
|----|-----------|--------------------|
| NV-7 | Season-wide match lists of the demonstrated competitions fit 2 MiB, and other resources fit 512 KiB | T53 findings: largest response size per resource kind |
| NV-8 | `X-Authenticated-Client` is present on authenticated 403 responses and its anonymous value is distinguishable without storing it | T53 findings (presence booleans only) |
| NV-9 | The pinned Fastify JSON parser and validation reject a deeply nested 1.5 MiB envelope on `createImport` quickly, without a stack overflow, and `onProtoPoisoning` and `onConstructorPoisoning` are `error` (extends NV-5) | T50 test; code read of `app.ts` |
| NV-10 | The provider's 10-per-minute counter is per token, so the probe and a running LIVE_DATA server share it, and `X-RequestsAvailable` reflects that | T53 findings (observed counter values) |
| NV-11 | Browser file reading behaves as assumed by the option chosen for T11H-F01 (`arrayBuffer()` gives exact bytes; `text()` strips a BOM and replaces invalid bytes) | T51 component test or e2e upload test with a BOM and an invalid byte |
| NV-12 | The CSV parser is linear in practice on the pinned Node.js version | T50 timing test (section 6.3, condition 2) in T46 [ingestion-unit] |

### Residual risks (documented; none accepted by the reviewer as HIGH)

- R9: Any local process can spend the token's free request budget and cause provider requests through the login-less API (section 7). LOW; Product Owner decision T11H-F19.
- R10: A downloaded CSV original opened in a spreadsheet can evaluate `-`-prefixed name fields as arithmetic (Q12). LOW, informational.
- R11: Person names typed into team or competition fields of a manual import cannot be detected; header and key rejection covers structural person fields only. LOW; operator review and BR-04 guidance in the import UI.
- R12: Instruction text within valid names from LIVE_DATA or MANUAL_DATA (T10-F06 R4 extended, T11H-F17). LOW for WI-1; production-blocking (class 3) before such content becomes publishable.
- R13: Until a secondary source exists, LIVE_DATA values rest on one provider's integrity; BR-13 keeps them unverified and unpublishable. LOW.
- R14: In-process parsing of provider and import input (T11H-F18). LOW; subject to the SC-05 decision.
- R15: Misconfiguration by the trusted operator (wrong `baseUrl`, mixed links) is reduced by T11H-F03 and T11H-F13, not eliminated. LOW.

## 12. Closed-state review

Not applicable. This change does not add, remove or alter a closures entry and does not change how trackers, evidence or closed work items are evaluated. (T11H-F02 strengthens an evidence step of T53, a task evidence procedure, not the closure rules.)

## 13. Verdict

**FAIL (correctable). No HIGH or CRITICAL finding.**

Must-fix corrections for the architect (targeted correction of T11G before T11J):
1. **T11H-F01:** choose and specify the import content encoding (bytes as base64, recommended; or text with the stated rules), consistently in the contract (`ImportFileCreate`), `provider-ports.md` section 1.6, `data-model.md` section 1, T50 and T51, before the Orchestrator re-accepts the contract.
2. **T11H-F02:** add `--require-token` and the `real token checked` line to `marker-scan` (T41), the probe's error and output rules and their test (T49), and the T53 sequence (probe output redirected and scanned with the real token present before `.env.local` is removed; presence check without printing the value; Verification line with `--require-token`).

Recommended in the same correction, not blocking:
- T11H-F14 (provider-neutral LIVE `sourceRef` or an explicit contract statement), T11H-F20 (editorial), and naming the should-fix items T11H-F03 to T11H-F13 and T11H-F15 in the scopes of T15, T17, T19, T21, T27, T30, T49, T50, T51 and T52 (or carrying them as brief constraints, as OD-15 did for T10-A1).

Decisions for the Product Owner (batched, before T49, T50 and T20): the SC-05 isolation decision (section 6, recommend Option A for both inputs with the section 6.3 conditions) and the real-credential re-raise (section 7, recommend Option A). Contract Safety holds; re-acceptance of `1.0.0-proposed.2` is MED-01 once T11H-F01 is resolved. T47 validates V-01..V-29, V-13a, V-30 as amended and V-31..V-55, NV-1..NV-12, and the should-fix findings of this review.

When the must-fix items are integrated, the reviewer confirms them by an addendum to this file and the verdict becomes PASS.
