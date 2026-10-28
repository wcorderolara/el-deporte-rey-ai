# WI-1 Architecture Conformance Review (T45)

- Author: architect (task WI-1-T45). Date: 2026-10-28. Base: `b872fd6` (integration branch `work/WI-1`; every implementation task of WI-1 is merged).
- Scope (tracker section "T45"): the integrated code and configuration against `architecture.md`, `architecture-delta.md`, `data-model.md`, `contracts/provider-ports.md`, `provider-research.md`, the declared contract `contracts/http-api.openapi.yaml` (`1.0.0`) and the requirement records. Acceptance criteria: R-226, R-233, R-242, R-268, R-281, R-288, R-289. Also reviewed: R-139 with T11H-F15 (no inline disable in core code), R-103, R-109 and R-137, and the items the Orchestrator asked to confirm (OD-61 O-1 and O-2, PD-26, the OD-64 and T66 notes, T38 LOW-8, the two LIVE_DATA findings records).
- Method: read-only review of the files with search and reading tools; nothing was executed in this task. Test-backed claims cite the test file and the latest gate evidence. The most recent run of every configured gate is `docs/work-items/WI-1/evidence/T62-gates.txt` at `c8a8498` (13 PASS, 0 FAIL: PRJ-LINT PASS; PRJ-UNIT 2140 tests passed; PRJ-INTEGRATION 511; PRJ-CONTRACT 779; PRJ-E2E and PRJ-A11Y PASS). The commits after `c8a8498` up to the base are tracker records only (tracker event log, 2026-10-28T21:57:37Z to 22:01:31Z: T62 record correction, E-16, PD-26, T45 start). T46 re-runs the lint, static-identifier and contract evidence after this review.
- No legal assessment is made. No statement here says that the work satisfies a regulation or an external standard.

## 1. Result

| Criterion | Result | Basis (details in section 3) |
|-----------|--------|------------------------------|
| R-226 competition, target format and publication mode are configuration or data | PASS | `config/*.json`, `platform/config/schema.ts`, catalogue service; finding CR-04 (LOW, UI preview frame) is presentation only |
| R-233 no player or person entity or attribute, no user-account entity | PASS | migrations `0001`, `0002`; R-233 schema test; contract and domain schemas |
| R-242 provider research: pricing, coverage, reliability, licensing; no purchase needed or made | PASS | `provider-research.md` sections 2 to 4, 9, 10; PD-22 |
| R-268 one ingestion interface; no provider-specific branch in research; downstream stages unchanged on every mode | PASS | `IngestionSource`, adapter registry, research boundaries test, data-modes integration test; observation CR-05 on wording |
| R-281 provider findings record, each item sourced and dated or UNVERIFIED; no subscription bought or upgraded | PASS | `provider-research.md` section 2.1 with the T62 update; findings records P and P2 |
| R-288 shared domain schemas and contract provider-neutral; all adapters validate against one schema | PASS | `packages/contracts/src/domain/**`, contract, neutrality tests, `registry.ts` |
| R-289 static provider-identifier check, seeded test, delivered tree passes | PASS | `eslint.config.mjs`, `apps/server/test/static/provider-identifier-rule.test.ts`, PRJ-LINT and PRJ-UNIT PASS |

No finding is HIGH or MEDIUM. No finding must be fixed before acceptance (section 5). No Product Owner decision is needed.

## 2. Evidence basis

| Evidence | What it shows |
|----------|---------------|
| `evidence/T62-gates.txt` (`c8a8498`) | PRJ-LINT PASS (the provider-identifier rule and the security rules over the whole tree, `--max-warnings 0`); PRJ-UNIT PASS, 2140 tests (includes `apps/server/test/static/**`); PRJ-INTEGRATION PASS, 511; PRJ-CONTRACT PASS, 779; PRJ-CONTRACT-ID PASS |
| `evidence/T67-gates.txt` (`02f4a42`), `evidence/T66-gates.txt` (`052a1fe`) | the same gates PASS at the last code merges (T67 test change, T66 web change) |
| `evidence/T53-marker-scan-real.txt`, `evidence/T61-marker-scan-real.txt` | the two live probe runs: `real token checked: yes`, 0 findings (cited by the findings records) |
| Tracker records of T38, T43, T44, T65, T66, OD-61, OD-64, PD-22, PD-26 | the decisions and notes this review was asked to confirm |

## 3. Per-criterion review

### 3.1 R-226: competition, target format and publication mode are configuration or data

- Target format: `config/app.config.json` line 10 and `config/live.config.json` line 10 set `format` (`width` 1080, `height` 1350, `maxSlidesPerCarousel` 20). The schema `apps/server/src/platform/config/schema.ts` lines 229 to 239 bounds them and only supplies defaults (`DEFAULT_FORMAT`, line 39). The content stage takes the slide limit from its input (`modules/content/core.ts` line 125, filled from configuration); `modules/projects/catalog.ts` lines 98 to 100 expose the configured values through `Settings`. Templates are laid out on a 1080 x 1350 reference canvas and scaled to the configured format (`modules/rendering/templates/common.ts` lines 5 to 6 and 35 to 36), as `architecture.md` section 9 designs; the template preview renders with the configured format (`modules/rendering/preview.ts` line 5). The review and export pages size slides from the server's `width` and `height` (`features/review/ElementReview.tsx` lines 127 to 128, `features/history/ExportDetailPage.tsx` lines 163 to 164). One UI frame assumes the reference ratio: finding CR-04.
- Publication mode: `publicationMode` is configuration (`config/app.config.json` line 12; schema line 239, only `manual` accepted, BR-11). No publication function exists (`modules/export/service.ts` line 17, `modules/export/index.ts` line 7; contract has no publication operation, T43 R-219).
- Competition: competitions, seasons, stages and matchdays come from the configured sources and the optional links of `config/catalogue.json` and `config/live.catalogue.json` (`architecture.md` section 13). No competition is a constant in a stage: the research boundaries test refuses the word "competition" and every mode, adapter and provider literal in research production code (`modules/research/boundaries.test.ts` lines 35 to 43); the provider-identifier rule refuses the reference competition's code, ID and name in `apps/**` and `packages/**` (section 3.7); the search for competition names (the reference competition, the national leagues) in `apps/**` and `packages/**` found them only in adapter tests and in generic word lists of the content and visual-QA modules. The operator-attested path (AD-38) is driven by the configured link flag `noAcceptedPublicSource`, not by a competition in code.
- Result: PASS.

### 3.2 R-233: no player or person entity or attribute, no user-account entity

- Schema: the tables of `apps/server/migrations/0001_initial.sql` (sources, projects, workflow and stage runs, imports and manual versions, retrievals, teams and aliases, observations, facts, manual approvals, evidence, disputes, drafts, carousels, elements and versions, fact references, QA results, approvals, final approvals, exports, brand assets) and `0002_qa_capitalized_tokens.sql` hold no person, player, user, account, session or credential table or column; line 7 of `0001` states the rule. The R-233 schema test (`apps/server/src/platform/db/schema.int.test.ts` lines 5 to 31 and 337 onward) scans every table, column and index name against `player|scorer|lineup|line_up|referee|coach|squad|user|account|password|session|email|login|token|secret|person|people|credential|api_?key`, with positive controls (a seeded `players` table is found); it ran in PRJ-INTEGRATION PASS.
- Contract and domain: no schema, property or operation of `contracts/http-api.openapi.yaml` names a person, player or account; the domain snapshot schemas reject person keys (`packages/contracts/src/domain/snapshot.test.ts` line 146, `referees` refused). No login or account route exists (`apps/server/test/integration/platform/request-protections.test.ts` line 165, R-235; route inventory `apps/server/test/contract/route-inventory.test.ts`).
- Inputs: the football-data allow-list schemas drop person fields (`adapters/football-data/schemas.ts` line 5); manual imports reject person-like fields naming them (`modules/imports/person.ts` lines 11 to 18). The other occurrences of person words in production code are deny lists, the prompt rule "do not name any person" (`providers/ai/prompt.ts` line 31) and URL user-information checks.
- Result: PASS.

### 3.3 R-268: one ingestion interface; no provider-specific branch in research; downstream stages unchanged

- One port: `IngestionSource` (`apps/server/src/providers/sports/ingestion/types.ts` lines 109 to 121) with `listCompetitions`, `listSeasons`, `listStages`, `fetchSelection` and `validateStartup`, as AD-22 and `contracts/provider-ports.md` section 1.2 define. The adapter registry lists exactly the three adapters (`adapters/index.ts` lines 13 to 17); `createSportsSources` is the only entry point (`providers/sports/index.ts`), the composition root calls it without the test seam (`container.ts` line 153), and every adapter's selection passes the one shared validation (`ingestion/registry.ts` line 139, `validateSelectionSnapshot`). No module outside `providers/sports` imports an adapter (search for `adapters/` in production code: only `providers/sports/index.ts` imports the registry).
- Research: no branch on a mode, adapter kind, provider or competition (`modules/research/boundaries.test.ts`, PRJ-UNIT PASS; search confirms no mode literal in research production code). The one mode comparison, `modules/research/stage.ts` line 56, is a consistency check (source mode equals project mode), not a branch by mode.
- Verification and later stages: no provider or adapter-kind branch anywhere in `modules/{verification,content,rendering,visual-qa,review,export}` or `workflow` (searched for provider names, adapter kinds and `test-live`). The data mode is read only by the business rules that the architecture specifies for it:
  - verification counting and manual eligibility (`modules/verification/decision.ts` lines 121 to 124, 167, 203, 255, 274; R-071, OD-24, `architecture.md` sections 7.3 and 7.4);
  - manual approval only in MANUAL_DATA projects (`modules/verification/service.ts` line 326; R-412, PD-13);
  - the LIVE_DATA publication-permission rule (`modules/verification/publishability.ts` line 61; PD-18, AD-38);
  - the demonstration flag (`modules/rendering/stage.ts` lines 188 and 275, `modules/review/service.ts` line 157, `modules/export/service.ts` line 454, `modules/export/manifest.ts` line 204; OD-21, AD-33).

  None of them selects a different stage implementation, adapter or path; the stages run the same code on every representation. Observation CR-05 records a wording point in `architecture.md` section 13.
- Behaviour: `apps/server/test/integration/ingestion/data-modes.test.ts` lines 272 to 325 (R-267: the equivalence matchday from fixtures, manual JSON, CSV and form, and replayed provider responses gives one representation) and lines 348 onward (R-268: verification, content, rendering and visual QA complete on DEMO_DATA, MANUAL_DATA and LIVE_DATA with the same registered stages); PRJ-INTEGRATION PASS (timeouts made load-robust by T64, OD-62).
- Result: PASS.

### 3.4 R-288: provider-neutral shared schemas and contract

- The nine concepts are shared Zod schemas in `packages/contracts/src/domain/`: Competition (`SourceCompetitionSchema`, `CatalogueEntrySchema`), Season (`SourceSeasonSchema`), Stage (`SourceStageSchema`), Matchday (`MatchdayNumberSchema`), Match (`SnapshotMatchSchema`), Team (`SnapshotTeamSchema`), Standing (`StandingRowSchema`, `SnapshotStandingsSchema`), Source (`SourceDescriptorSchema`), Verification status (`VerificationStatusSchema`). Provider references are opaque (`OpaqueSourceRefSchema`, `rules.ts` line 48); attribution references are provider-neutral and never URLs (`AttributionRefSchema`, AD-36).
- A search of `contracts/http-api.openapi.yaml` and `packages/**` for the provider name, host, credential header, reference code and ID, competition name and provider field names (`crest`, `tla`, `playedGames`, `utcDate`, `referees`) finds nothing outside one test that seeds a rejected `referees` key. `apps/server/test/contract/provider-neutrality.test.ts` checks the contract, the domain schemas and the Zod mirror, with a positive control; `served-operations.test.ts` lines 828 to 866 check every served response, including LIVE replay responses, for provider identifiers, the host and URL-like references. PRJ-CONTRACT PASS.
- Provider data stays in adapter-side types (`adapters/football-data/schemas.ts`, `mapping.ts`); all three adapters' outputs validate against `SelectionSnapshotSchema` (section 3.3) and the R-267 equivalence test shows one representation.
- Configured LIVE source values in responses: see section 4.2 (OD-61 O-2).
- Result: PASS.

### 3.5 R-242: provider research and no purchase

- Pricing, coverage, reliability, redistribution and licensing per candidate: `provider-research.md` section 2.1 (football-data.org), sections 3.1 to 3.7 (API-Football, Sportmonks, TheSportsDB, UEFA and Premier League publications, other organisers, enterprise providers) and the comparison matrix in section 4. Every gap is marked UNVERIFIED with its reason (captures refused with 403 or 404, or not attempted; section 1 "Gaps").
- Development and tests need no purchased service: the gates run on DEMO_DATA fixtures, MANUAL_DATA imports, the stub AI adapter and a replay egress client; `vitest.setup.ts` line 25 removes the token and the live switch; the `live` project is outside every gate (`vitest.config.ts` lines 11 and 80 to 88; `package.json` line 21); the project configuration states that no gate contacts a sports-data or AI provider (`localEnvironment.notes`).
- No purchase: `provider-research.md` section 10 and section 9 (PD-22: nothing authorized, the free plan stays); both findings records state "no purchase or upgrade" (`research/football-data-capabilities.md` line 3, `research/football-data-capabilities-2.md` line 3). The plan of the token is as stated by the Product Owner and was not verified independently (stated in section 10).
- Result: PASS.

### 3.6 R-281: provider findings record

- `provider-research.md` section 2.1 lists, for football-data.org: competition availability (published and with the token), coverage per competition, seasons, rate limits (published and observed), freshness, commercial use, republishing and attribution, plus reliability, caching, confidentiality and person data. Each row names its source tag (C1 to C19 dated 2026-10-27; P and P2 with run times 2026-10-28T18:14:53Z and 21:36:40Z) or is marked UNVERIFIED (for example the delay size, `X-RequestsAvailable`, per-token counting, WC and CLI matches).
- Section 2.1 "Update (T62)", 2.2.1, 2.4.1 and 7.1 extend the record with P2; section 10 states the R-281 confirmation, including the update.
- The two findings records are the probe's own output, with run conditions, token handling and the marker-scan evidence in their headers: `research/football-data-capabilities.md` (T53, 30 of 30 requests, `T53-marker-scan-real.txt`) and `research/football-data-capabilities-2.md` (T61, PD-24, 27 of at most 30 requests, `T61-marker-scan-real.txt`). Anything not observed is stated as UNVERIFIED and not promised (line 12 and line 13 respectively).
- Republishing remains not stated by the provider (C1), so it is not confirmed (R-316) and PD-18 stands; the attribution clause is recorded as found, without assessment.
- Result: PASS.

### 3.7 R-289 and R-139 with T11H-F15: static provider-identifier check

- Rule: `eslint.config.mjs` lines 47 to 66 (string, template and JSX text literals equal to the reference code or containing the provider name or the competition name, case-insensitive; the numeric and string competition ID; template literals exactly equal to the code or ID) and line 52 (imports of the football-data and manual adapter directories), applied to `apps/**` and `packages/**` (line 174 and the later scopes). This matches AD-31 and `architecture-delta.md` section 7.1.
- Exemptions: exactly `apps/server/src/providers/sports/adapters/**` and `apps/server/scripts/**` (line 29, applied at lines 189 to 193). `apps/server/scripts/` holds only the probe script and its test. `providers/sports/support/**` and `providers/sports/ingestion/**` are not exempt and hold no provider identifier.
- Seeded test: `apps/server/test/static/provider-identifier-rule.test.ts` lints the eleven seeded violations of `seeded-violations.json` (code, numeric and string ID, host, provider name, competition name, URL template, code template, both adapter imports, JSX competition name) at six core directories and expects errors; lints them at the adapter directory and expects none; lints a violation behind an inline disable directive at a core path and expects an error; lints the delivered tree and expects no problem. It runs in the `unit` project (`vitest.config.ts` line 42); PRJ-UNIT PASS and PRJ-LINT PASS (`T62-gates.txt`).
- No inline disable in core code: `linterOptions.noInlineConfig: true` for `apps/**` and `packages/**` outside test files (`eslint.config.mjs` line 195), `reportUnusedDisableDirectives: 'error'` (line 158) and `eslint --max-warnings 0` (`package.json` line 16). The only inline directives in the repository are in a test file (`apps/server/src/modules/imports/pipeline.test.ts` line 30, `@typescript-eslint/no-explicit-any`) and in end-to-end support outside the rule scope (`e2e/support/scenario-server.ts` line 70, `no-empty-pattern`; T44 LOW-8); neither touches the provider rule.
- Fragment assembly (the accepted AD-31 tradeoff, which asked T45 to review): searches for identifiers assembled from parts found only `apps/server/test/contract/provider-neutrality.test.ts` line 67 (the seeded positive control of the neutrality check) and `scripts/security-checks.test.mjs` line 363 (the seeded bundle-check control). No production code assembles a provider identifier.
- Result: PASS. Observation CR-08 records the rule's scope against the wording of R-289.

### 3.8 R-103, R-109, R-137: no provider-specific feature beyond the capability

- R-103: the stack was proposed by the architecture (AD-01 to AD-08) and implemented as decided (`package.json`, `apps/server/package.json`, `apps/web/package.json`).
- R-109: one local process, SQLite, in-memory projection cache, no queue, no remote storage, no plug-in loader and no provider client library (dependencies: Fastify, `@fastify/static`, Zod, Satori, resvg, opentype.js, React, React Router; `architecture.md` section 13).
- R-137: the football-data adapter requests only the five resources of `contracts/provider-ports.md` section 1.4 (`adapters/football-data/provider.ts` lines 121 to 125: competition list, competition detail, stage discovery, matches, standings); no team, person or scorer resource; no provider-specific operation in the contract.
- Result: conforms.

## 4. Items the Orchestrator asked to confirm

### 4.1 OD-61 O-1: invalid `contentBase64` answered 400 IMPORT_REJECTED

Confirmed as the intended design. The contract's `createImport` description (`contracts/http-api.openapi.yaml` lines 716 to 722) and `ImportFileCreate.contentBase64` (line 2056) state that invalid base64 is `encoding_invalid` and content over 512 KiB of decoded bytes is `too_large`, both import errors of an IMPORT_REJECTED problem; `contracts/provider-ports.md` section 1.6 "Content transfer and encoding" steps 1 and 2 say the same. The general rule (schema violations are VALIDATION_FAILED) and the operation's specific rule are both in the declared contract with the same 400 status; the specific rule governs its field. The implementation follows it: the route checks only the envelope as VALIDATION_FAILED (`modules/imports/routes.ts` lines 7, 40 and 56 to 61), and the import pipeline classifies the content (`modules/imports/encoding.ts` lines 5 to 10 and 77 to 81). T43 asserts it (`apps/server/test/contract/request-protection.test.ts` lines 471 to 486). No change is needed.

### 4.2 OD-61 O-2: configured LIVE source ID and name in responses

Confirmed. `football-data` and `football-data.org` are the configured `id` and `name` of the LIVE_DATA source (`config/live.config.json` lines 56 to 57). R-139 and AD-23 allow provider names and codes in configuration; the API returns configured source IDs and names as data (`Settings`, `sourceId`, `sourceName`, catalogue IDs `<sourceId>-<localKey>`, AD-21), and R-287 requires the source of every fact to be traceable. R-288 constrains the schemas and the contract, which stay neutral (section 3.4). The provider host, provider field names and URL-like references stay absent from responses, as T43 checks (`apps/server/test/contract/support/neutrality.ts` lines 121 to 145, masking only the configured source's ID, name and group).

Clarification for the OD-61 wording ("provider codes ... stay forbidden"): by design, the local part of the catalogue ID of an unlinked LIVE_DATA competition is the adapter-supplied slug of the provider's competition code (`contracts/provider-ports.md` section 1.4, `listCompetitions` row; `adapters/football-data/mapping.ts` lines 159 to 177), for example a lowercase two- or three-letter slug after the source ID. It is an opaque slug value of the catalogue, not a contract field and not the provider's identifier in its own form; the T43 check matches provider codes case-sensitively and so accepts it. Linked competitions take the configured link ID instead (`config/live.catalogue.json` line 34). This review reads OD-61 O-2 as covering these slugs (observation CR-07). Removing them would be a design change of AD-21 and AD-23 (MED-04), not a conformance defect.

### 4.3 PD-26: shared `TeamName` rule kept in WI-1 (accepted known limitation)

Recorded as an accepted, known limitation decided by the Product Owner, not a deviation:
- The rule: `DomainTeamNameSchema` is the contract's `TeamNameSchema` (`packages/contracts/src/domain/rules.ts` line 13; contract `components.schemas.TeamName`), applied to every adapter's snapshot through `validateSelectionSnapshot` (`ingestion/registry.ts` line 139). A selection whose official team name the rule refuses is refused whole with `invalid`, nothing is stored, and no name is altered, abbreviated or substituted (R-052, R-237; `provider-research.md` sections 2.2.1 and 13.1).
- Effect in WI-1: the CL league phase is not selectable in LIVE_DATA (P2 evidence: `research/football-data-capabilities-2.md`, path `/teams/29/name`). CL stays demonstrable through whole-stage selections (the 2025/26 final), and seven LIVE_DATA competitions are confirmed end to end (`provider-research.md` section 7.1). The same rule applies to MANUAL_DATA imports and form entry, so an operator also cannot enter such a name in WI-1.
- The requirements edge case for special characters in names (R-037, R-052, R-213, R-237) is met for every name within the rule and falls short for the refused names, as `provider-research.md` section 11 records; precedence gives the contract and the architecture the decision, and PD-26 confirms it.
- Planned for the next work item: option (a) of DR-6 (widening by the closed list of the solidus and the typographic apostrophe) with FU-9 to FU-15, including a third CL-only probe run; no third run in WI-1.
- The documents written before PD-26 still describe DR-6 as pending (finding CR-06).

### 4.4 OD-64 and T66 notes; T38 LOW-8

Recorded as maintenance findings CR-01 to CR-03 (section 5). None changes behaviour, an acceptance criterion, a security control or the contract; lint and every gate pass; none must be fixed before acceptance.

### 4.5 LIVE_DATA findings records and `provider-research.md` sections 2, 9 and 13

Reviewed for R-242 and R-281 (sections 3.5 and 3.6). Section 9 records the outcomes PD-21 to PD-24 and the open DR-3 (written republishing permission, PD-18 stands); section 13 holds the DR-6 request and the follow-ups that PD-26 defers. Both findings records keep the probe output unchanged, contain no payload, header value or token, and cite their marker-scan evidence.

## 5. Findings

Severity scale of this review: HIGH (blocks acceptance), MEDIUM (fix in WI-1), LOW (fix later; no acceptance impact), INFO (observation, no action required).

| ID | Severity | Finding | Evidence | Owner | Before acceptance? |
|----|----------|---------|----------|-------|--------------------|
| CR-01 | LOW (maintenance) | `errorCopy.importErrorLocation` is unused since T66 removed the import-error table from the shared banner; the other import-error labels are still used by `features/imports/ImportErrorTable.tsx` lines 23 to 29 | `apps/web/src/ui/copy.ts` line 223; no reference in `apps/web/src` (T66 note, OD-64) | frontend-developer; `apps/web/src/ui/copy.ts` is in T16's ownership (`apps/web/**`), no open task owns it | No. Remove in a later cleanup task |
| CR-02 | LOW (maintenance) | The `.tableWrapper` and `.table` rules (with `caption`, `th`, `td`) of the shared banner stylesheet are unused; `ErrorBanner.tsx` uses only `banner`, `title`, `list` and `retry` | `apps/web/src/ui/ErrorBanner.module.css` from line 24 (`.tableWrapper`, `.table` and its `caption`, `th`, `td` rules); `apps/web/src/ui/ErrorBanner.tsx` lines 23, 24, 35, 45 (T66 note) | frontend-developer; T16's ownership (`apps/web/**`) | No. Remove with CR-01 |
| CR-03 | LOW (maintenance) | The export module repeats T37's private version view: `#versionView` in both services builds the contract `ElementVersion` (state, blocked overlay, QA, per-segment fact status) from the same exported functions (`versionState`, the publishability and blocked-overlay helpers). Two copies can drift when the review view changes | `apps/server/src/modules/export/service.ts` lines 465 to 519; `apps/server/src/modules/review/service.ts` lines 447 to 474 (T38 LOW-8) | backend-developer; modules owned by T37 (`modules/review/**`) and T38 (`modules/export/**`) | No. Behaviour is covered by the T38 and T42 export-detail tests. Later: export one version-view function from the review module and use it in the export module |
| CR-04 | LOW | The template preview of the brand page declares a 1080 x 1350 image size and a fixed 4:5 frame instead of the configured format. The server renders previews with the configured format (`modules/rendering/preview.ts` line 5), so with another configured ratio the preview would be letterboxed (`object-fit: contain`); review and export pages already use the server's dimensions. No stage logic is affected (R-226 holds) | `apps/web/src/features/brand/TemplatesSection.tsx` lines 16 to 18 and 63 to 64; `apps/web/src/features/brand/Brand.module.css` line 193 | frontend-developer; T36 (`apps/web/src/features/brand/**`) | No. With the committed configuration there is no visible effect. Later: take the size from `Settings.format` |
| CR-05 | LOW (documentation) | `architecture.md` section 13 says that no stage contains a "mode-specific" branch, while sections 7.3, 7.4 and 9 specify mode-dependent rules (OD-24 counting, manual eligibility and approval, the LIVE_DATA permission rule, the demonstration band). The code follows the specific sections (section 3.3); the general sentence should read "no mode-specific processing path; mode-dependent business rules only as sections 7.3, 7.4 and 9 define" | `architecture.md` lines 430 and 238 to 307, 343 | architect (next architecture change) | No |
| CR-06 | LOW (documentation) | PD-26 is not yet reflected where DR-6 was raised: `provider-research.md` sections 13.1 and 13.5 still request the decision, `architecture-delta.md` section 11.14.6 lists U-31 and U-32 as open, and the source of truth records Product Owner decisions up to PD-20 only (PD-21 to PD-26 are in the tracker). This review records the PD-26 disposition (section 4.3) | `provider-research.md` lines 504 to 608; `architecture-delta.md` lines 900 to 906; `.orchestrate/source-of-truth.md` line 85 | architect (architecture documents, next work item); Orchestrator (source of truth, protected path) | No for the acceptance criteria. Recommended before WI-1 delivery: record PD-21 to PD-26 in the source of truth, because PD-26 plans the widening for the next work item |

Observations (INFO, no action required):

| ID | Observation |
|----|-------------|
| CR-07 | Catalogue IDs of unlinked LIVE_DATA competitions carry the slug of the provider's competition code after the configured source ID, by design (section 4.2). If the Product Owner ever wants catalogue IDs without provider-derived slugs, configured links already give neutral IDs. |
| CR-08 | The provider-identifier rule covers `apps/**` and `packages/**` (AD-31), while R-289 says "all code outside provider adapters and configuration". The root `scripts/` and `e2e/` trees are tooling outside the rule; the only provider text there is the bundle check's detection pattern for the provider host (`scripts/security-checks.mjs` line 40) and its seeded control (`scripts/security-checks.test.mjs` line 363), which must name the host to find it. R-139 limits the ban to domain logic, core services, workflow stages and UI, and AD-31 (approved architecture) sets the scope; no change is needed. |
| CR-09 | `noInlineConfig` excludes test files inside `apps/**` and `packages/**` (`eslint.config.mjs` line 195), so a test could disable the provider rule; none does (section 3.7). The delivered-tree lint in the seeded test and PRJ-LINT would still show any new directive to review. |

## 6. Conflicts between sources

| Sources | Conflict | Resolution |
|---------|----------|------------|
| Contract general rule "invalid input is VALIDATION_FAILED" vs `createImport` description `encoding_invalid` and `too_large` under IMPORT_REJECTED (both level 2), `contracts/provider-ports.md` 1.6 (level 3) | apparent: both declare 400 | the operation's specific rule governs its field; provider-ports agrees; confirmed by OD-61 O-1 (section 4.1) |
| `architecture.md` section 13 "no mode-specific branch" vs sections 7.3, 7.4 and 9 (all level 3) | wording | the specific sections govern; wording fix CR-05 |
| R-289 wording "all code outside adapters and configuration" (level 5) vs AD-31 scope `apps/**` and `packages/**` (level 3) | scope | the approved architecture governs; R-139 confirms the intent (CR-08) |
| R-037, R-052, R-213, R-237 edge case for special characters (level 5) vs contract `TeamName` (level 2) | a refused real name cannot be shown | decided by PD-26 (level 1): keep the rule in WI-1, widen in the next work item (section 4.3) |

## 7. LOW decisions taken in this review

1. Gate evidence: `T62-gates.txt` at `c8a8498` is used as the latest full gate run, because the later commits are tracker records only (tracker event log); T46 produces the final evidence pack after this review.
2. R-268 and the T45 scope phrase "no mode-specific branch" are read as "no separate processing path, adapter or provider branch"; the mode-dependent rules that the architecture and the Product Owner decisions define are conformant (section 3.3, CR-05).
3. OD-61 O-2 is read as covering the slug of the provider code in catalogue IDs, which `contracts/provider-ports.md` section 1.4 designs (section 4.2, CR-07).
4. Severity scale and finding IDs CR-01 to CR-09 are local to this document.
