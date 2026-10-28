# WI-1 T47: Security delta validation

```
TASK: WI-1-T47  RESULT: PASS
HEAD: n/a  BASE: 6bd794eeac441da67b586e9d40aa43c540c4902f
FILES: docs/work-items/WI-1/security/T47-security-validation.md
COMMANDS: n/a
DECISIONS: LOW-1: new finding IDs T47-F01..T47-F07, with the severity and class scheme of design-review.md section 4 ; LOW-2: status vocabulary VALIDATED / VALIDATED WITH NOTE / NOT VALIDATED (with reason), as the brief asks ; LOW-3: the T46 pack (VALIDATED_HEAD 9eaa899) is taken as the evidence for BASE, because the tracker records only evidence and tracker commits between them; the code-currency confirmation is requested as NV-REQ-1 (non-blocking)
ESCALATIONS: none
```

- Date: 2026-10-28.
- Mode: delta validation (after implementation) of the implemented system against `architecture-delta.md` sections 4 and 11.4, `security/design-review.md` (T10, section 9 and Addendum 1), `security/design-review-change-1.md` (T11H, section 10 and Addendum 1) and `security/review-T60-probe-diagnostics.md`.
- How I worked: no shell. I read the code at BASE in the `WI-1-T47` worktree, the 27 T46 evidence files (all `RESULT: PASS`, `VALIDATED_HEAD 9eaa8991260bd96de4054f38765e5b844e657a00`), `T46-gates.txt` (merged state `c0ee884`, 13 PASS), the real-token evidence `T53-marker-scan-real.txt` and `T61-marker-scan-real.txt`, both research findings files, and the read-only tracker. I ran no test. Every test result below comes from the evidence pack.
- Notation: `E:<file>:<line>` is an evidence file under `docs/work-items/WI-1/evidence/`; code locations are paths from the repository root with line numbers at BASE; `tracker:<line>` is the integration tracker.

## 1. Changed trust boundaries and attack surface (as implemented)

| Boundary | Implemented surface |
|---|---|
| TB-1 local service | Fastify on `127.0.0.1` only; Host and Origin allow-lists from configuration; Fetch-Metadata; client header; JSON-only bodies with route exceptions (images 5 MiB, imports 1.5 MiB JSON); no CORS; no login |
| TB-2 sports data | DEMO_DATA fixtures, MANUAL_DATA adapter, and the real FootballDataProvider (LIVE_DATA only with `EDR_CONFIG=config/live.config.json`); egress client is the only network path |
| TB-3 AI | stub in every committed configuration; OpenAI-compatible adapter present but not configured |
| TB-4 / TB-5 files | brand PNG/JPEG upload; renders; exports; import originals (attachments) |
| TB-6 secrets | `FOOTBALL_DATA_API_TOKEN` (real token used twice, T53 and T61), `EDR_AI_API_KEY` (unused) |
| TB-7 supply chain | exact pins, lock file, `ignore-scripts`, registry signatures |
| TB-8 manual imports | JSON, CSV and form channels, base64 transfer, in-process parsers (PD-15 option A) |
| Integrity | manual approval, configuration-only publication policies (PD-17, PD-18, AD-38), source independence (OD-24), demonstration labels |

No trust boundary was added after the T11H review. The operator-attested publication path (PD-17) is the only changed surface that the T11H review asked T47 to re-review (section 6).

## 2. Controls V-01 to V-30 (T10 section 9)

| Control | Status | Evidence |
|---|---|---|
| V-01 loopback binding | VALIDATED | `apps/server/src/platform/config/schema.ts:45,165` (host must be `127.0.0.1`); `apps/server/src/main.ts:120-121,143` (re-check and `listen` on the loopback host); `apps/web/vite.config.ts:84,96` (`server.host`, `preview.host`); test `apps/server/test/integration/platform/listener.test.ts` in E:T46-platform-security.txt:6 (7 files, 51 tests) |
| V-02 Host allow-list on every request, 421, `trustProxy` false | VALIDATED | `apps/server/src/platform/http/guards.ts:43-55,83-96,134-142` (root `onRequest`, exact set, `*` and `0.0.0.0` refused); `apps/server/src/platform/http/server.ts:32,38` (`trustProxy: false`; framework errors also check the Host); E:T46-platform-security.txt:6 |
| V-03 client header, Origin allow-list (`null` refused), media type, refusals before body parsing | VALIDATED | `guards.ts:106-127`; `apps/server/src/platform/http/body.ts:62-94,148-162`; `apps/server/test/contract/request-protection.test.ts:115-178`; E:T46-contract.txt:6 (779 tests) |
| V-04 no `Access-Control-*`, no cookie | VALIDATED | `apps/server/src/platform/http/headers.ts:30-35`; E:T46-platform-security.txt:6 |
| V-05 security headers and Fetch-Metadata | VALIDATED | `headers.ts:11-27` (CSP with `connect-src 'self'`, `base-uri 'none'`, `form-action 'self'`, `object-src 'none'`, `frame-ancestors 'none'`; `nosniff`, `no-referrer`, CORP, COOP); `guards.ts:98-104` |
| V-06 GET and HEAD side-effect free; preview bounded | VALIDATED | `apps/server/src/modules/rendering/preview.ts:8-11,165-199` (LRU cache keyed by template version, language and active assets); catalogue GETs touch only the in-memory budget and cache (T11H Q11) |
| V-07 development mode | VALIDATED | `apps/web/vite.config.ts:35-45,59-67,83-102` (`allowedHosts` two loopback names, `cors: false`, `fs.strict`, Vite default `fs.deny` plus `data/**`, `changeOrigin: false`, `envPrefix` `VITE_`, `envDir` `apps/web`); `apps/web/vite.config.test.ts` in E:T46-web-security-unit.txt:6; Vite 8.3.4 with no advisory (E:T46-versions.txt:6, E:T46-audit-full.txt:10-15) |
| V-08 no login, account or session | VALIDATED | E:T46-platform-security.txt:6; `apps/server/test/contract/route-inventory.test.ts` in E:T46-contract.txt:6; R-235 |
| V-09 payload allow-lists, structural rejection, name and `ref` rules | VALIDATED | E:T46-content-safety.txt:6 (526 tests); `packages/contracts/src/http/primitives.ts:20,57` |
| V-10 fixture mode without network; socket-level guard | VALIDATED | `vitest.setup.ts:134-195` (`net.Socket.prototype.connect`, `net.connect`, `net.createConnection`, undici global dispatcher; violation fails the test in `afterEach`); `apps/server/test/integration/platform/fixture-mode.test.ts` in E:T46-platform-security.txt:6 |
| V-11 egress client | VALIDATED | `apps/server/src/platform/net/egress-client.ts:6-11,57-61,123-141` (`redirect: 'error'`, `AbortSignal.timeout` total deadline, decoded-byte streaming cap, no TLS option); `allow-list.ts:87-91` (userinfo refused, `https:` only, loopback `http:` only for the AI origin); `egress-client.test.ts:188-240` (gzip bomb, slow drip, redirect); E:T46-platform-unit.txt:6 (246 tests) |
| V-12 network APIs banned outside `platform/net`, none in `modules/export` | VALIDATED | `eslint.config.mjs:35-45,83-94,181-189` (globals, imports, dynamic imports and `require`; `modules/export/**` and `modules/imports/**` without test exception); E:T46-lint.txt:6 |
| V-13 / V-13a AI data block | VALIDATED | `apps/server/src/providers/ai/schemas.ts:5` (strict schema refuses `sourceRef`, `ref`, `declaredSource`, `fileName`, data mode); `prompt.ts:42`; `openai-compatible-adapter.ts:10,65` (no tools); tests `apps/server/src/modules/content/stage.test.ts:320-323` and `core.test.ts:271`; E:T46-content-safety.txt:6 |
| V-14 content checks (T10-F05 classes) | VALIDATED | `apps/server/src/modules/content/checks.ts:10-11,78,184` (closed LF and emoji-ZWJ exceptions, T10-A1-05); E:T46-content-safety.txt:6, E:T46-delivery-security.txt:6 |
| V-15 injection fixtures; instruction forbids person names | VALIDATED | E:T46-content-safety.txt:6 (injection fixtures in the content suite); TeamName pattern unchanged (`contracts/http-api.openapi.yaml:1103-1108`, PD-26) |
| V-16 no HTML rendering; references as text | VALIDATED | `eslint.config.mjs:76-81,176-179`; `apps/web/src/ui/SafeReference.tsx:19` (renders no anchor); E:T46-web-security-unit.txt:6 |
| V-17 brand upload | VALIDATED | `apps/server/src/modules/brand/service.ts:7,11,68-76` (signature, declared type match, 4096 px header cap, resvg decode); `image.ts:14,67`; `body.ts:36` (5 MiB route limit, 64 KiB global); E:T46-files-render-approval-unit.txt:6, E:T46-module-integration.txt:6 |
| V-18 rendering resources | VALIDATED | `apps/server/src/modules/rendering/renderer.ts:62-69` (data URIs from hash-checked bytes only), `206-213` (no `loadAdditionalAsset`), `220-234` (`loadSystemFonts: false`, bundled `fontFiles`); `renderer.test.ts:111,119` (no glyph fetch, no socket) |
| V-19 path confinement | VALIDATED | `apps/server/src/modules/brand/storage.ts:27,81-121` (realpath, mode 0700, `wx`); `apps/server/src/modules/imports/originals.ts:22,56-70`; `server.ts:83-102` (static root only at the web build, `dotfiles: 'deny'`, `list: false`, never `/api`) |
| V-20 export | VALIDATED | `apps/server/src/modules/export/service.ts:13,137-144` (plan and record in `BEGIN IMMEDIATE`, re-check of `invalidated_at`); `apps/server/test/integration/delivery/export-history.test.ts:115-126` (R-219, no egress request); lint V-12; E:T46-delivery-security.txt:6 |
| V-21 atomic guards | VALIDATED | `apps/server/src/platform/db/db.ts:15-16,70-78` (synchronous `BEGIN IMMEDIATE`, thenable work refused and rolled back); E:T46-module-integration.txt:6 (approval races, manual approval atomicity) |
| V-22 parameterized SQL | VALIDATED WITH NOTE | `eslint.config.mjs:68-74`; code read: every `prepare` takes a constant `SQL.*` text with bound parameters; the only interpolations are code constants (`apps/server/src/workflow/repository.ts:73-96`). Note: the lint selector catches only a template literal written directly in `prepare` or `exec`; it is a guard, the code read is the evidence (INFO) |
| V-23 no secret tracked | VALIDATED | E:T46-secret-scan.txt:6-11 (856 files, 0 findings); E:T46-hygiene.txt:9-14; E:T46-repo-hygiene.txt:6 (empty output); E:T46-ignore-rules.txt:8-10 (all three paths listed); `.env.example:6,9` (empty); `.npmrc:6-10` |
| V-24 configuration rejects unknown and secret-like keys | VALIDATED WITH NOTE | `apps/server/src/platform/config/keys.ts:48-59,110-124`; `container.ts:9-10` (configuration built without the environment); E:T46-platform-unit.txt:6. Note T47-F04 (refused key names are echoed) |
| V-25 logger redaction and request log fields | VALIDATED | `apps/server/src/platform/http/logger.ts:33-41` (including `x-auth-token`), `81-85` (serializers without message, URL, header or body), `106-118` (method, route, status, duration); E:T46-platform-unit.txt:6 |
| V-26 closed reason codes; echoing-key test | VALIDATED | `apps/server/test/integration/platform/ai-key-echo.test.ts` in E:T46-platform-security.txt:6; `main.ts:80-82` (fixed startup text) |
| V-27 bundle secrets; `envPrefix`, `envDir` | VALIDATED | E:T46-bundle-secrets.txt:6-11 (17 files, 0 findings); `vite.config.ts:71-72` |
| V-28 supply chain | VALIDATED WITH NOTE | `.npmrc:6-10` (registry, `save-exact`, `engine-strict`, `ignore-scripts`); E:T46-audit.txt:6 (0 high, 0 critical); E:T46-audit-full.txt:10-15 (section 5); E:T46-lockfile.txt:6-10 (330 entries); E:T46-registry-signatures.txt:6-12 (295 of 295 verified). Note T47-F03 (no tracker Verification line for the signatures file) |
| V-29 / V-55 contract | VALIDATED WITH NOTE | E:T46-gates.txt:178-197 (PRJ-CONTRACT 779 tests, PRJ-CONTRACT-ID MATCH); `request-protection.test.ts:115-178` (421, 403, 415, 413 per operation, static lists 169-178); `provider-neutrality.test.ts`. Note: the promoted file differs from the re-accepted proposal beyond `info.version` by the OD-26/OD-38 `capitalized_tokens` value and description-only edits (tracker:614-615, T20); both are recorded Orchestrator decisions under OD-23 and neither removes a constraint |
| V-30 decisions (as amended by T11G and T11H) | VALIDATED | PD-10 (tracker:1374); PD-15 and PD-16 recorded 2026-10-27T20:54:50Z (tracker:1618), before T50 started 2026-10-28T10:32:33Z (tracker:1692), T49 15:39:57Z (tracker:1718) and T53 16:27:51Z (tracker:1746); source of truth SC-05 and SC-08 (`.orchestrate/source-of-truth.md:158,161`); requirements R-142, R-143 (T11L). Conditions: every committed configuration uses the stub AI (`config/app.config.json:57`, `config/live.config.json:92`, `config/dev.config.json:62`); no new input format; caps within 2 MiB (V-41, V-54) |

## 3. Controls V-31 to V-55 (T11H section 10) and the T11G controls of section 11.4

| Control | Status | Evidence |
|---|---|---|
| V-31 token sourcing | VALIDATED | `apps/server/src/container.ts:33-64` (frozen null-prototype injected environment, non-enumerable, token deleted from `process.env`); `main.ts:116-119` (configuration loaded after the deletion); `apps/server/src/providers/sports/adapters/football-data/credentials.ts:6-16`; E:T46-ingestion-unit.txt:6 (569 tests), E:T46-ingestion-security.txt:6 (91 tests) |
| V-32 transmission and origin pinning | VALIDATED | `constants.ts:13,19`; `credentials.ts:47` (header only for the pinned origin); `options.ts:64,183` (startup refusal of another origin); E:T46-ingestion-unit.txt:6 |
| V-33 never in logs, errors or responses; no diagnostic flags | VALIDATED | `logger.ts:36-37`; `package.json:26-29` (no `--report-*` or heap-snapshot flags); `docs/local-setup.md:91-93`; `main.ts:116` (`disableDiagnosticReports()`); E:T46-platform-unit.txt:6, E:T46-ingestion-security.txt:6 |
| V-34 test and tooling hygiene | VALIDATED | `vitest.setup.ts:19-29`; `e2e/support/harness.mjs:41-44`; E:T46-live-skipped.txt:6; `scripts/security-checks.test.mjs:95-347` (positive controls of `secret-scan`, `hygiene`, `marker-scan`, `--require-token` exit 1 before scanning, single-file path, no planted value in the output) run in E:T46-security-scripts-unit.txt:6 (section 7, item 2) |
| V-35 browser | VALIDATED | `headers.ts:11-12` (`connect-src 'self'`); E:T46-bundle-secrets.txt:6; `SafeReference.tsx:19`; E:T46-web-security-unit.txt:6 |
| V-36 probe and real-token runs | VALIDATED WITH NOTE | E:T53-marker-scan-real.txt:5-11 and E:T61-marker-scan-real.txt:5-11 (`--require-token`, `real token checked: yes`, findings 0; 22 and 23 files including the console log); findings files: `X-Authenticated-Client` presence booleans only (`research/football-data-capabilities.md:218-219`, `-2.md:225-226`), dropped keys are documented v4 field names only (`-2.md:141,155,212`); probe test in E:T46-ingestion-unit.txt:6; T60 review. Notes T47-F01 (T61 file mode) and T47-F02 (T53 deviations) |
| V-37 response handling, person fields dropped, `Map` grouping | VALIDATED | E:T46-ingestion-unit.txt:6; T60 review section 5 Q1; SC-07 |
| V-38 errors and retries; boolean-only `X-Authenticated-Client` | VALIDATED | E:T46-ingestion-unit.txt:6; T60-F05 (residual, covered by code and tests) |
| V-39 budget, header bounds, priority, single-flight, waiters | VALIDATED | `apps/server/src/providers/sports/support/` (`single-flight.ts`, `request-budget.test.ts`, `budget.test.ts`) in E:T46-ingestion-unit.txt:6; E:T46-ingestion-security.txt:6 |
| V-40 cache | VALIDATED | `support/projection-cache.ts`; E:T46-ingestion-unit.txt:6 |
| V-41 egress for the provider; cap raise | VALIDATED | `config/live.config.json:75-76` (512 KiB default, `stageDiscovery` 1 MiB); bound 2 MiB in the option schema and the egress client (`egress-client.ts:60-61`); measured 384 639 bytes (T53) and 537 320 bytes (T61, tracker:1237), within 1 MiB (T60-F04 closed by T62) |
| V-42 catalogue routes: unknown IDs 404 without provider request | VALIDATED | E:T46-ingestion-security.txt:6; E:T46-contract.txt:6 |
| V-43 import route and encoding | VALIDATED | `apps/server/src/modules/imports/routes.ts:88` (1.5 MiB route limit); `encoding.ts:57-70` (canonical base64 re-encoding check, `TextDecoder` `fatal: true`); `body.ts:107-157` (depth scan before parse, NV-9); E:T46-ingestion-unit.txt:6, E:T46-module-integration.txt:6 |
| V-44 CSV parser, adversarial corpus, linear-time test | VALIDATED | `apps/server/src/modules/imports/adversarial.test.ts`, `timing.test.ts` (section 4) in E:T46-ingestion-unit.txt:6 (27 files: the count matches the unit test files of the four paths, `timing.test.ts` included); E:T46-gates.txt:146-160 (PRJ-UNIT 2140 tests at `c0ee884`) |
| V-45 JSON size, depth, duplicate keys, strict schema; form size | VALIDATED | `imports/service.ts:12,189` (canonical form size check before any write); E:T46-ingestion-unit.txt:6 |
| V-46 person data; value-free errors; no body logging (T11H-F12) | VALIDATED | `logger.ts:7-8,81-85`; E:T46-ingestion-unit.txt:6, E:T46-ingestion-security.txt:6 |
| V-47 semantic and key rules | VALIDATED | `team-key.test.ts` in E:T46-ingestion-unit.txt:6 |
| V-48 atomic application and hash | VALIDATED | `originals.ts:51-70` (`wx`, realpath, UUID path); E:T46-module-integration.txt:6, E:T46-ingestion-security.txt:6 |
| V-49 `getImportOriginal` | VALIDATED | `routes.ts:127-132` (`application/octet-stream`, `attachment; filename="original-<id>.<ext>"`, sandbox CSP; `nosniff` and CORP from the platform); web download link with `download` (`ImportHistory.tsx:89`, `ImportDetailPage.tsx:38`) |
| V-50 manual approval | VALIDATED | E:T46-ingestion-unit.txt:6, E:T46-module-integration.txt:6, E:T46-web-security-unit.txt:6, E:T46-delivery-security.txt:6; `apps/server/src/modules/export/manifest.ts:121-123,195-205` (`operatorAttested`) |
| V-51 configuration-only policies with PD-17 and PD-18 values | VALIDATED WITH NOTE | `config/*.config.json` `verificationPolicy`: `allowed_without_accepted_source` (PD-17) and `every_supporting_source`; `config/live.config.json:64` (`unconfirmed`, no decision field); no committed link marks `noAcceptedPublicSource`; `schema.ts:29,189,205-213` (refused `allowed_labelled` and `any_supporting_source`, decision pattern). Note T47-F06 (decision ID not cross-checked against the register) |
| V-52 source independence; no test seam in production | VALIDATED WITH NOTE | `container.ts:134-135,150` and `main.ts:90-91,128-134` (the provider factories are a test seam; the process entry never passes it); `apps/server/src/providers/sports/adapters/index.ts:4` (`test-live` never listed); no file under `config/` names `test-live`. Note: `fixtures/config/*.config.json` contain LIVE-shaped and `test-live` test configurations; they are test inputs used with the replay transport under the network guard, not runtime configurations |
| V-53 demonstration labelling | VALIDATED | `manifest.ts:204` (`demonstration`); E:T46-delivery-security.txt:6, E:T46-web-security-unit.txt:6 |
| V-54 SC-05 conditions | VALIDATED | `apps/server/package.json:10-22`, `apps/web/package.json:13-24`, `packages/contracts/package.json:16-18`, root `package.json:31-47`: no CSV, XML, spreadsheet or archive parser and no native decoder added; E:T46-versions.txt:8-34; no new input format; caps within limits; the linear-time test passes and was not weakened (section 4), so no option B re-plan was needed |
| V-55 | see V-29 | |
| T11G controls of section 11.4 (credential, rate limiting, cache, import limits, static identifier check, person fields, originals as attachments, demonstration labels) | VALIDATED | covered by V-31 to V-53 above; static identifier rule `eslint.config.mjs:47-66,174-195` with `noInlineConfig` (T11H-F15) and E:T46-static-identifiers.txt:6 (118 tests, seeded violations) |

### Acceptance-criterion items carried from T42 and T43

| Item | Status | Evidence |
|---|---|---|
| T42: R-219 and no network during export | VALIDATED | `export-history.test.ts:112-126`; lint ban without exception in `modules/export/**` (`eslint.config.mjs:186-187`); socket guard (V-10); E:T46-delivery-security.txt:6 |
| T43: request protection (421, 403, 413, 415, ID validation) and provider neutrality | VALIDATED | `request-protection.test.ts:5-10,115-178,332,378`; `provider-neutrality.test.ts`; E:T46-contract.txt:6 |

## 4. T67: the changed SC-05 linear-time test (OD-64)

**Result: VALIDATED. The test still enforces SC-05 condition 2 (V-44, NV-12); it is not weakened.**

What I checked in `apps/server/src/modules/imports/timing.test.ts` at BASE:

1. **The bound is unchanged.** `MAX_RATIO = 24` (52); the counted attempt must satisfy `ratio <= MAX_RATIO` (183). Linear growth gives about 8 and quadratic about 64.
2. **Every input shape is kept.** The test iterates every entry of `CSV_SHAPES` and `JSON_SHAPES` (225-239). T67 owned only this file, so the corpus (`test/corpus.ts`) and the parsers could not change in T67 (ownership check, tracker:1328).
3. **The minimum statistic cannot hide a super-linear parser.**
   - Load only adds time, so `min(512 KiB)` cannot fall below the parser's own cost.
   - A quadratic parser could pass only if every one of the 21 small samples were inflated by at least 2.7 times while at least one interleaved large sample, of similar duration, was not (110-118).
   - The comment's argument (31-38) is correct.
4. **The steadiness rule is asymmetric in the safe direction.**
   - A pass is conclusive only when the 64 KiB denominator is steady.
   - A fail is conclusive only when the 512 KiB numerator is steady (133).
   - So noise can trigger a retry, but it cannot turn a steady failure into a pass.
5. **Retries are bounded.**
   - There are at most 2 retries (`MAX_RETRIES`, 61, 143), each from fresh samples, with the same bound.
   - The last attempt counts whatever its steadiness. Nothing is averaged, raised or skipped (138-147).
   - Residual: three attempts slightly raise the chance that a borderline parser passes under adversarial load. Each attempt still needs the improbable all-small-samples inflation, so I accept it.
6. **The positive control is meaningful.**
   - A seeded quadratic scanner runs the same comparison and must exceed 24 (201-222, 247-273), on the CSV shape and on the JSON shape that failed under load in T50.
   - T67 reports 48 to 113 in every run (tracker:1327).
7. **The test runs in the evidence pack.**
   - E:T46-ingestion-unit.txt:6 covers 27 files, which matches the unit test files of the four paths with `timing.test.ts` among them.
   - PRJ-UNIT at the merged state passed 2140 tests (E:T46-gates.txt:157-158).

Pre-existing residual (not a T67 change): a bound of 24 tolerates growth up to about n^1.53 between 64 KiB and 512 KiB, as the T11H design accepted (RK-20, "generous multiple").

## 5. Supply chain: moderate advisories (audit-full) and OD-33

E:T46-audit-full.txt:10-15 lists 2 advisories, both moderate:
1. `fflate` 0.7.3: GHSA-px8p-9vwx-vf98 (`unzipSync` infinite loop on malformed ZIP64).
2. `satori` 0.51.0: "via fflate", range `>=0.33.0`.

Both are accepted only through GHSA-px8p-9vwx-vf98 by OD-33. The script accepts a dependency-chain entry only when every GHSA on the chain is accepted (T55 LOW-1, `security-checks.test.mjs:552-663`).

- **OD-33 covers the satori entry: yes.** OD-33 accepts this GHSA "pinned by satori 0.51.0" (tracker:1414). The satori entry is that same advisory reached through its dependent. No other advisory is present, high 0, critical 0.
- **Reachability re-check: still unreachable.**
  - The vulnerable function parses ZIP archives. No application code imports `fflate` (a search of `apps`, `packages` and `scripts` finds it only in test text).
  - Satori receives only two kinds of input:
    - the three bundled TrueType fonts, pinned by SHA-256 and checked at load (`apps/server/src/modules/rendering/fonts.ts:34-49,103`);
    - `data:` URIs of hash-checked PNG or JPEG assets (`renderer.ts:62-69`).
  - `fonts.test.ts:1-4` asserts that the fonts are plain TrueType, so no WOFF inflate path runs. No ZIP or attacker-chosen archive can reach satori or `@shuding/opentype.js` (which also depends on `fflate` `^0.7.3`, deduplicated to 0.7.3, `package-lock.json:1416-1424,2727-2731`).
  - An optional library-internal confirmation is listed as NV-REQ-3. It is not needed for this conclusion, because the inputs are fixed.
- **Vite:** no advisory of any severity for 8.3.4 at 2026-10-28 (NV-1).
- **SOT-4 stays open** (revisit when satori moves to `fflate` 0.7.5 or later).

## 6. U-25 / T11H-F17: re-review of the operator-attested path (AD-38 item 4, OD-26, OD-38)

**Question of `architecture-delta.md` 11.13.4: are the pinned team names and the disposition of U-28 sufficient for the T11H-F17 production condition on the operator-attested path?**

**Answer: yes, for WI-1 with the stub AI (or a local AI).** The path is reachable only after a tracked configuration change: a catalogue link marked `noAcceptedPublicSource: true` plus a team-identity map. No committed configuration marks a link.

The path:

```
MANUAL_DATA import (TB-8)
  -> MANUALLY_APPROVED facts, only for a marked link with pinned names
  -> AI data block (TB-3)
  -> content checks and visual QA
  -> human approvals
  -> export with operatorAttested
```

| Threat on the path | Control in the code | Assessment |
|---|---|---|
| Instruction text inside a valid team name (R4/R12) | TeamName pattern unchanged (PD-26). Pinned mode: only the identity map is used, the source key must be in it, and the received name must equal a pinned official name or alias after NFC; anything else is a placeholder and unmatched (`apps/server/src/modules/verification/identity.ts:12-14,236-276`). Unmatched facts are `team_identity_unmatched` and not eligible for manual approval (AD-38 item 4; T52 tests) | A hostile name reaches published content only if the operator pins it in a tracked file. That moves the decision from import time to a reviewed configuration change. Sufficient for WI-1 |
| Changed name on reimport | Unmatched until the map changes (pinned mode) | Sufficient |
| Model output with person, venue or extra proper names (R3, T10-F06) | `capitalized_tokens` visual-QA warning on every draft (OD-26, OD-38), stored since migration 0002 (`apps/server/migrations/0002_qa_capitalized_tokens.sql`; T56) and requiring the QA acknowledgement before approval; content checks (V-14); fixed instruction (V-15) | Sufficient with the stub or a local AI. It is a warning, so human approval remains the final control |
| AI steering by data-block text | Data block is framed and schema-validated (V-13a); numbers and names are placeholders substituted deterministically; the stub AI ignores input semantics | Sufficient for WI-1. A hosted AI is an SC-05 trigger that needs a new review and Product Owner decision |
| Mislabelled provenance | MANUALLY_APPROVED never shown, stored or exported as verified; `operatorAttested: true` in the manifest (`manifest.ts:195-205`); no slide label (OD-28) | Matches PD-17 as interpreted by OD-28 |

- **TB-8 for this path:** no change since the T11H review. The parsers, caps and person-field rejection hold (V-43 to V-49).
- **TB-3:** no change. The stub AI is configured everywhere.

**Production condition of T11H-F17:**
- **Operator-attested path: met** (pinned names implemented; U-28 disposed by OD-26 and OD-38 and implemented).
- **LIVE_DATA: open.** There is no secondary source (PD-21), and PD-18 permission is unconfirmed (SOT-2). Pinned names and a TB-2 and TB-3 re-review are required before LIVE_DATA content can become publication-approvable.
- **Re-review triggers that remain:** a hosted AI; any widening of `TeamName` (FU-9 to FU-15, under PD-26 in the next work item).

## 7. Items carried to this task

1. **T46 notes.**
   - (1) OD-33 coverage and reachability: confirmed, section 5.
   - (2) Step 25 ran 2 test files. The unit project's include list (`vitest.config.ts:39-46`) and the `scripts` filter select exactly these two:
     - `scripts/security-checks.test.mjs`, which holds the positive controls of V-34;
     - `apps/server/scripts/football-data-probe.test.ts`, which step 19 also runs.

     So the security-checks tests did run. The count of 109 tests is consistent with both files, including parametrized cases. VALIDATED WITH NOTE: the step label "security-scripts-unit" also contains the probe test.
   - (3) The tracker's T46 Verification list has no line for `T46-registry-signatures.txt`: finding T47-F03 and NV-REQ-2.
2. **T61.** The second real-token run met C1 to C8 according to its record. The `--require-token` scan ran before anything was read (E:T61-marker-scan-real.txt:8-11), and the dropped-key and diagnostic lines have the reviewed formats.

   The `.env.local` mode was 0644 at creation and set to 0600 during the run: finding T47-F01.

   T53's four deviations are judged in T47-F02. None invalidates T53's evidence.
3. **T59 and T60.** `--candidates` and the diagnostics were validated by T60, and the reviewed files were unchanged for T61 (C1, tracker:1237).

   Status of the T60 findings:
   - T60-F04 is closed by measurement (T62).
   - T60-F02 and T60-F05 need no action.
   - T60-F01, F03 and F06 are open, with hardening deferred to the next work item (OD-65). No further probe run happens in WI-1 (PD-26), so they have no exposure in WI-1. Condition C7 stays mandatory for any future run until F01 is hardened.
4. **T67 (OD-64):** section 4. VALIDATED.
5. **OD-48:** noted under PD-16 in T47-F05.
6. **T49 note** (refused key names echoed): T47-F04, INFO.
7. **PD-25:** no security objection.
   - Ownership checks, the main-tree check and merged-state gates remain.
   - The security-control suites ran independently in the verify worktree (T46) and at the merge (E:T46-gates.txt).
   - Agents without a shell (this one included) still have their verification lines run by the Orchestrator.
8. **PD-26:** consistent with T10-F06 (fail closed).
   - TeamName is unchanged in the contract and in the mirror (`contracts/http-api.openapi.yaml:1103-1108`, `primitives.ts:20,57`).
   - A refused selection is refused whole and never altered.
   - Widening needs the FU-12 review.
9. **U-25 residual:** section 6.

## 8. Should-fix findings and observations

### T10 (design-review.md)

| Finding | Status | Where (carrying tasks) |
|---|---|---|
| T10-F04 cross-site simple requests | VALIDATED | `guards.ts:98-104`, `headers.ts:11-27`, deny-by-default `guards.ts:106-112`, preview cache (V-06) (T19, T34, T41) |
| T10-F05 Unicode and number words | VALIDATED | V-14 (T23, T32) |
| T10-F06 semantic residuals | VALIDATED for WI-1; residual R3/R4 open | V-15, section 6 (T23, T32, T30, T35, T56) |
| T10-F07 egress details | VALIDATED | V-11 (T17, T22) |
| T10-F08 egress by convention | VALIDATED | V-12, V-10 (T15, T17) |
| T10-F09 rendering resources | VALIDATED | V-18; `brand/decode.ts:44-50` also disables system fonts (T34, T33) |
| T10-F10 free-text reasons | VALIDATED | V-26 (T19, T21, T22, T27) |
| T10-F11 secret refinements | VALIDATED | V-25, V-27; `docs/local-setup.md:53-58,72,77-78`; e2e harness (T15, T16, T19) |
| T10-F12 upload hardening | VALIDATED | V-17; guards in `onRequest` before body (T19, T33) |
| T10-F13 file-system confinement | VALIDATED | V-19 (T19, T33, T34, T38) |
| T10-F14 SQL | VALIDATED WITH NOTE | V-22 (T18) |
| T10-F15 atomic guards | VALIDATED | V-21, V-20; T58 research-run invalidation in the same transaction (T37, T38, T58) |
| T10-F16 provider strings in the UI | VALIDATED | V-16 (T15, T16, T31, T40) |
| T10-F17 closed responses, declared problems | VALIDATED | V-29 (T20, T43) |
| T10-F18 supply-chain evidence | VALIDATED WITH NOTE | V-28; T47-F03 (T15, T41, T46) |
| T10-A1-01 403 on every operation | VALIDATED | `request-protection.test.ts:169-178` (T20, T43) |
| T10-A1-02 hygiene subcommand | VALIDATED | E:T46-hygiene.txt:8-14; tests `security-checks.test.mjs:187-257` (T41, T46) |
| T10-A1-03 script positive controls, scripts in lint scope | VALIDATED | `security-checks.test.mjs`; `eslint.config.mjs:23,161` (all `**/*.{...,mjs}` files, `scripts/**` included) (T41, T25) |
| T10-A1-04 T19 brief wording | VALIDATED | the implemented guard reads the lists only from configuration (`guards.ts:7-9,134-136`) |
| T10-A1-05 allowed control characters | VALIDATED | `content/checks.ts:10-11,78,184` (T32) |
| T10-A1-06 source team keys and `Slug` | VALIDATED | `identity.ts:15-16,133` (placeholder slugs); contract conformance E:T46-contract.txt:6 (T30, T43) |

### T11H (design-review-change-1.md)

| Finding | Status | Where |
|---|---|---|
| T11H-F03 token containment | VALIDATED | V-32, V-33, `container.ts:33-64` |
| T11H-F04 `X-Authenticated-Client` | VALIDATED | V-38, V-36 (presence booleans only) |
| T11H-F05 header bounds | VALIDATED | V-39 |
| T11H-F06 catalogue routes and budget | VALIDATED | V-39, V-42 |
| T11H-F07 `Map` lookups | VALIDATED | V-37, `identity.ts:17` |
| T11H-F08 duplicate JSON keys | VALIDATED | V-45 |
| T11H-F09 team-key derivation | VALIDATED | V-47 |
| T11H-F10 form size | VALIDATED | V-45 |
| T11H-F11 original file name | VALIDATED | V-49 |
| T11H-F12 (verify-in-T47) no values in errors or logs | VALIDATED | V-46 |
| T11H-F13 source independence | VALIDATED WITH NOTE | V-52 |
| T11H-F14 provider-neutral `sourceRef` | VALIDATED | V-35; source of truth section 6 (`source:`, `fixture:`, `import:`, never URLs) |
| T11H-F15 inline disables | VALIDATED | `eslint.config.mjs:158,195`; E:T46-static-identifiers.txt:6 |
| T11H-F16 (verify-in-T47) candidate values in the data block | VALIDATED | V-13a |
| T11H-F17 residual R4 | met for the operator-attested path; open for LIVE_DATA | section 6 |
| T11H-F20 editorial and NFD names | VALIDATED | `primitives.ts:21` (`\p{M}` in `FileName`); T51 NFC test in E:T46-web-security-unit.txt:6 |
| T11H-A1-01 T53 failure branch | VALIDATED | T53 scope text; both real-token scans passed |
| T11H-A1-02 "never retry 404" | VALIDATED | T49 scope and tests in E:T46-ingestion-unit.txt:6 |

## 9. Design-time assumptions NV-1 to NV-12 against the pinned versions

| ID | Status | Evidence |
|---|---|---|
| NV-1 Vite fixes and `allowedHosts` | VALIDATED | Vite 8.3.4 (E:T46-versions.txt:6,30), a major line after the 2025 fixes (CVE-2025-24010 fixed in the 6.0 line; the `fs.deny` bypass series, CVE-2025-30208 and later, fixed in the 6.2 and 6.3 lines); no Vite advisory in E:T46-audit-full.txt:10-15; `allowedHosts` used and type-checked (`vite.config.ts:87,99`) |
| NV-2 resvg system fonts disabled | VALIDATED | `renderer.ts:226-227`; `decode.ts:48` |
| NV-3 satori never given a URL | VALIDATED | `renderer.ts:62-69,138`; `renderer.test.ts:119` (no socket) |
| NV-4 decoded-byte cap | VALIDATED | `egress-client.ts:9-10,86-113`; `egress-client.test.ts:188-190` (gzip bomb) |
| NV-5 Fastify defaults | VALIDATED | `server.ts:32-36` (`trustProxy: false`, `onProtoPoisoning` and `onConstructorPoisoning` `error`); no CORS plugin in `apps/server/package.json:10-18` |
| NV-6 `ignore-scripts` with native binaries | VALIDATED | `.npmrc:9`; E:T46-install.txt:6; render tests pass (E:T46-files-render-approval-unit.txt:6) |
| NV-7 response sizes | VALIDATED | T53 384 639 bytes; T61 537 320 bytes for a season-wide list, within the 1 MiB `stageDiscovery` cap; other resources within 512 KiB (T62) |
| NV-8 `X-Authenticated-Client` on 403 | VALIDATED WITH NOTE | present on 2xx; no 403 observed in either run (`football-data-capabilities.md:219`, `-2.md:226`), so 403 behaviour stays UNVERIFIED by observation. No security impact: 403 is never retried, and the value is used only as an in-memory boolean |
| NV-9 nested envelope and poisoning | VALIDATED | `body.ts:107-157`; `server.ts:34-35`; T50 test in E:T46-ingestion-unit.txt:6 |
| NV-10 counter per token | VALIDATED WITH NOTE | UNVERIFIED by observation (`football-data-capabilities.md:237`); fail-safe: the local window bounds this process, and a 429 is handled with a bounded wait (one 429 in T53, none in T61) |
| NV-11 browser `arrayBuffer` exact bytes | VALIDATED | T51 component test in E:T46-web-security-unit.txt:6 |
| NV-12 linear time on the pinned Node.js | VALIDATED | section 4 |

## 10. Findings of this validation

There is no CRITICAL, HIGH or MEDIUM finding, and none blocks. Classes: 1 = acceptable for synthetic local use; 2 = must be fixed before implementation or merge; 3 = blocks production use, not local use.

### T47-F01: the T61 token file was created with mode 0644 (LOW, class 1, non-blocking)

- **Component:** T61 run procedure; SC-08 / PD-16 condition "`.env.local` mode 0600".
- **Description:** The Product Owner's `.env.local` in the T61 worktree was created with mode 0644 (readable by every OS account). The Orchestrator changed it to 0600 during the run, and the file was deleted afterwards (tracker:1237,1239). A PD-16 condition did not hold for that window.
- **Evidence:** tracker T61 Decisions line; `research/football-data-capabilities-2.md:3`.
- **Exploitation scenario:** Another OS account on the host reads the token while the mode is 0644, then spends the free request budget or uses the token under the Product Owner's name. This needs a second local account and access to the worktree's parent directories. A single-user workstation (the PD-16 premise) has no such account, and the user's Documents folder is normally owner-only on macOS.
- **Mitigation:**
  - (a) The Product Owner confirms that the workstation had no other OS account during the run. Otherwise, rotate the token at the provider.
  - (b) For any future run, the prepared run script creates the file with owner-only permissions (for example `umask 077` before creating it) and refuses to start the probe unless a mode check prints `600`, without reading the file.
- **Blocking:** no. Accepting this residual is within PD-16 if (a) is confirmed.

### T47-F02: T53 procedure deviations (LOW, class 1, non-blocking)

- **Component:** T53 real-token run (tracker:1118).
- **Assessment of each deviation:**
  - **(a) Token metadata printed.** A script printed the token's length, quoting and character class (32, quoted, hexadecimal), never its value. This went beyond the "count only" rule. The disclosed facts match the provider's public token format, so the transcript gains no meaningful entropy. Acceptable; must not recur.
  - **(b) Findings written to `.cache/probe-findings.md`, then copied into the research file.** The research copy was scanned with the real token. The `.cache` copy itself was not scanned, and its deletion is not recorded. The content is recorded as identical, so there is no exposure. Its removal should be confirmed (NV-REQ-4).
  - **(c) Console log and findings read after a first passing `--require-token` scan.** This is contrary to the scope's "never read". Because the read followed a passing exact-match scan, only a transformed or partial token could have reached the transcript, and no code path produces one (T49 and T60 reviews). The later T60 conditions C3 and C7 formalize exactly this "scan, then read" order. Acceptable.
  - **(d) First scan output kept in git-ignored `.cache` and deleted; the scan of record re-run as specified.** The scan of record (E:T53-marker-scan-real.txt) ran with the token loaded and the console log present (22 files). Acceptable.
- **Conclusion:** No deviation invalidates `T53-marker-scan-real.txt`. Two independent real-token scans (T53, T61) found no token. T61 followed the procedure without these deviations.
- **Mitigation:** Any later run follows T60 C1 to C8 verbatim; confirm NV-REQ-4.

### T47-F03: the T46 Verification list omits `T46-registry-signatures.txt` (LOW, class 1, non-blocking)

- **Component:** tracker T46 Verification line (tracker:1031); V-28.
- **Description:**
  - The file exists, with `RESULT: PASS` and 295 of 295 signatures verified (E:T46-registry-signatures.txt:2,6-12).
  - The T46 agent reported `orch evidence check` on all 27 files.
  - Tracker re-verification (FW-TRACKER) does not cover this file, so a later change to it would not be reported by the tracker check.
- **Mitigation:** The Orchestrator adds the line `orch evidence check docs/work-items/WI-1/evidence/T46-registry-signatures.txt --work-item 'WI-1' --task 'T46' --at .` to the T46 Verification list, or records its output with this task's evidence (NV-REQ-2). The evidence-control gap is small, but it should be closed before the work item closes.

### T47-F04: the configuration loader echoes refused key names (INFO, class 1, non-blocking)

- **Component:** `apps/server/src/platform/config/keys.ts:57-59,119-124` (T49 note, OD-51).
- **Description:** A secret-like key name is printed in the startup error if it matches `^[A-Za-z0-9_$-]{1,64}$`; otherwise `<key>` is printed. Values are never printed.
- **Exploitation scenario:** It needs an operator to paste a secret into a key name that also contains a secret-like word. The output goes to the local terminal only.
- **Mitigation (optional):** print the parent path with `<secret-like key>` instead of the name.

### T47-F05: brand-image decode memory under parallel uploads (OD-48) (LOW, class 1, non-blocking; production note)

- **Component:** `apps/server/src/modules/brand/decode.ts:44-50`, `image.ts:14`.
- **Description:**
  - A 4096 x 4096 image peaks at about 200 MiB during the resvg decode check.
  - `renderAsync` runs on the libuv thread pool, so several uploads decode concurrently (four by default). Further uploads queue with their bodies, up to 5 MiB each.
  - Any local process can send them: the API has no login, and non-browser clients can set `X-EDR-Client`.
- **Exploitation scenario:** A local process posts many large valid images in parallel. The server's memory peaks near 1 GiB or more, and it may fail. Availability only.
- **Assessment:** Acceptable under PD-16 and SC-08 (single operator, single-user workstation; R1, R9).
- **Mitigation before any shared-host or production use:** serialize decode checks (one at a time) or lower the pixel cap, and bound queued uploads.

### T47-F06: `publicationPermissionDecision` is checked by pattern only (INFO, class 1 now; re-check before LIVE_DATA publication)

- **Component:** `apps/server/src/platform/config/schema.ts:29,189`; AD-38 item 6.
- **Description:** `confirmed` is accepted with any `PD-nnnn` value. The configuration cannot verify that the decision exists in the register.
- **Exploitation scenario:** A configuration edit with a fictitious decision ID marks the provider's permission confirmed. In WI-1, LIVE_DATA content stays unpublishable anyway (single source, BR-13, PD-21). This is residual R15 (trusted-operator misconfiguration).
- **Mitigation:** When PD-18's confirmation is recorded, add a conformance check (review or gate) that any committed `confirmed` names a decision present in the tracker or source-of-truth register.

### T47-F07: SQL lint rule scope (INFO, class 1, non-blocking)

- **Component:** `eslint.config.mjs:68-74`.
- **Description:** The rule catches only a template literal with substitutions written directly as the argument of `prepare` or `exec`. Concatenation, or a template held in a variable, passes the lint. The code read found no such case, since every SQL text is a constant (V-22).
- **Mitigation (optional):** keep the code-review check; a stricter rule could require `prepare` arguments to be members of the module's `SQL` constant objects.

## 11. Acceptance criteria

| Criterion | Result | Basis |
|---|---|---|
| R-234 (loopback binding; non-loopback connections refused) | PASS | V-01, V-02 |
| R-235 (no login; no account function) | PASS | V-08 |
| R-263 (no marker or token in logs, errors, problems, test reports or evidence; `X-Auth-Token` redacted) | PASS | V-25, V-31 to V-36; E:T46-marker-scan.txt:8-11; E:T53-marker-scan-real.txt:8-11; E:T61-marker-scan-real.txt:8-11 |
| R-280 (person data absent from representation, cache, storage and logs; person-level import field rejected naming it) | PASS | V-37, V-40, V-46; SC-07 |

## 12. Contract Safety and closed-state review

- **Contract Safety:** not applicable. This validation proposes no contract change. PD-26 keeps `TeamName` unchanged, and the declared contract matches its recorded hash (E:T46-gates.txt:194-197). FU-6 option (a), if planned later, is HIGH-06 and needs its own review (FU-12).
- **Closed-state review:** not applicable. No closures entry is added, removed or altered, and nothing in this work changes how trackers, evidence or closed work items are evaluated. T47-F03 concerns a missing verification line of an open work item. It weakens no evidence rule.

## 13. NOT VERIFIED items (evidence requested; none affects the verdict)

| ID | What | Exact evidence requested |
|---|---|---|
| NV-REQ-1 | Code currency of the T46 pack for BASE (the pack is at `9eaa899`, BASE is `6bd794e`; the tracker records only evidence and tracker commits between them) | `git diff --stat 9eaa8991260bd96de4054f38765e5b844e657a00 6bd794eeac441da67b586e9d40aa43c540c4902f -- apps packages scripts config fixtures e2e contracts package.json package-lock.json .npmrc eslint.config.mjs vitest.config.ts vitest.setup.ts` prints nothing |
| NV-REQ-2 | Integrity check of the signatures evidence (T47-F03) | `orch evidence check docs/work-items/WI-1/evidence/T46-registry-signatures.txt --work-item 'WI-1' --task 'T46' --at .` exits 0 with `RESULT: PASS` |
| NV-REQ-3 (optional) | Library-internal confirmation for OD-33 | `grep -rlE "unzipSync|unzip\(" node_modules/satori/dist node_modules/@shuding/opentype.js/dist` prints no file (the conclusion of section 5 does not depend on it) |
| NV-REQ-4 | Leftover copy of the T53 findings (T47-F02 b) | confirmation that `.cache/probe-findings.md` no longer exists in the T53 worktree, or that the worktree has been removed |

## 14. Residual risks for the Product Owner

Open, none accepted by the reviewer as HIGH:
- **R1 / R9 (T10-F19, T11H-F19):** any local process can drive the login-less API, including spending the free provider budget when LIVE_DATA is enabled. LOW; PD-05 and PD-16 apply, with their re-raise triggers.
- **R2 / R14:** in-process parsing of operator images (native resvg), provider JSON and imports. LOW; PD-10 and PD-15. Includes T47-F05 (decode memory under parallel uploads).
- **R3 / R4 / R12 (T10-F06, T11H-F17):** with a real model or real names, commentary and names are not fully machine-checkable. Met for the operator-attested path in WI-1 (section 6). Production-blocking (class 3) before LIVE_DATA publication or a hosted AI.
- **R5:** cross-site timing and existence probing through simple GETs. LOW.
- **R6:** trust in prebuilt native binaries (resvg, esbuild). LOW; pinned, integrity-checked, signatures verified.
- **R7:** moderate advisories pass PRJ-AUDIT. The fflate advisory is accepted (OD-33, SOT-4) and unreachable.
- **R8:** EXIF metadata in stored brand originals. LOW, local only.
- **R10:** a downloaded CSV original opened in a spreadsheet can evaluate `-`-prefixed name fields. LOW; the UI note says to open originals as text.
- **R11:** person names typed into name fields of a manual import are not detected. LOW; operator review. Pinned names limit what can be published.
- **R13:** LIVE_DATA rests on one provider until a secondary source exists. It stays unverified and unpublishable (PD-21).
- **R15:** trusted-operator misconfiguration (mixed links, base URL, decision IDs). Reduced, not eliminated (T47-F06).
- **T60 residuals:** T60-F01, F03 and F06 hardening deferred to the next work item (OD-65). Condition C7 stays mandatory for any future probe run.
- **Real-token handling:** please confirm T47-F01 (a). The workstation should have had no other OS account while the token file had mode 0644; otherwise, rotate the token.
- **NV-8 and NV-10** remain unobserved provider behaviours, with fail-safe handling.
- **Data handling:** this validation approves no real personal or sensitive data. The only real credential used in WI-1 was the Product Owner's own free-plan token, under PD-16 and PD-24.

## 15. Verdict

Every control was validated, some with a note:
- V-01 to V-30, V-13a, V-31 to V-55 and the T11G controls of section 11.4;
- NV-1 to NV-12;
- every T10 and T11H should-fix finding and observation in its carrying task;
- the T67 change to the SC-05 linear-time test, which still enforces the bound of 24 and fails a seeded quadratic parser.

No control is NOT VALIDATED. The four acceptance criteria R-234, R-235, R-263 and R-280 pass. The new findings T47-F01 to T47-F07 are LOW or INFO and none blocks. The NOT VERIFIED items are evidence confirmations that do not change the verdict.

Verdict: PASS
