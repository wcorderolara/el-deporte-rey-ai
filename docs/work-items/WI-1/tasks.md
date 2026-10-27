# WI-1 Tasks

| Field | Value |
|-------|-------|
| Work item | WI-1: El Deporte Rey AI sports content platform MVP requirements |
| Work-item branch | `work/WI-1` (integration worktree `.claude/worktrees/WI-1-integration`) |
| Base | `main` @ `43292819f440` (2026-10-27) |
| Current head | see the work-item branch |
| Contracts | none declared |
| Authorization | Product Owner request of 2026-10-27 via orchestrate analyze: requirements analysis only, no implementation. No merge, push or deploy is authorized. |
| Config sha256 | `6614e48a55c0252c3962656d71eeec2dd29d537309bb39828a6df78b01824354` |
| Last gate run | none yet |
| Work-item status | EXECUTING |

Rules: /Users/waltercordero/Documents/Training/vetclaims-ai-agents/plugins/orchestrate/workflows/task-tracking.md. Only the Orchestrator edits this file.

## Summary

| ID | Title | Kind | Agent | Depends on | Status | Attempts | Commit(s) | Evidence |
|----|-------|------|-------|------------|--------|----------|-----------|----------|
| T00 | Intake of the Product Owner launch text | IMPL | Orchestrator | - | DONE | 1 | 1176f8c | T02 |
| T01 | Normalized requirements | IMPL | product-manager | T00 | DONE | 1 | dd9499e | T02 |
| T02 | Requirements verification | VERIFY | Orchestrator | T00, T01 | DONE | 1 | c68b058 | `docs/work-items/WI-1/evidence/T02-requirements-check.txt` |
| T03 | Intake of the Product Owner decisions | IMPL | Orchestrator | T02 | DONE | 1 | f4ccb0c | T08 |
| T04 | Apply Product Owner decisions to the requirements | IMPL | product-manager | T03 | DONE | 1 | 01a71a7 | T08 |
| T05 | Record Product Owner decisions in the source-of-truth decision register | IMPL | architect | T03 | DONE | 1 | d93cbb1 | T07 |
| T06 | Configuration update: frontend-developer role and personal-data profile | IMPL | Orchestrator | T03 | DONE | 1 | 32d60da | T07 |
| T07 | Configuration and source-of-truth verification | VERIFY | Orchestrator | T05, T06 | DONE | 1 | f648f85 | `docs/work-items/WI-1/evidence/T07-validate.txt` |
| T08 | Follow-up requirements verification | VERIFY | Orchestrator | T03, T04, T07 | DONE | 1 | 70befa9 | `docs/work-items/WI-1/evidence/T08-requirements-check.txt` |
| T09 | Architecture delta and task plan | IMPL | architect | T08 | DONE | 3 | f017460, 41af5ee | T11 |
| T10 | Security design review of the architecture | IMPL | security-reviewer | T09 | DONE | 2 | 3ac5b85, c1c0e2c | T11 |
| T11A | Intake of the stage-2 Product Owner decisions | IMPL | Orchestrator | T08 | DONE | 1 | 266b29d | T11D |
| T11B | Record PD-10 and PD-11 in the requirements | IMPL | product-manager | T11A | DONE | 1 | 380780f | T11D |
| T11C | Record PD-10 and PD-11 in the source-of-truth decision register | IMPL | architect | T11A | DONE | 1 | 16013be | T11D |
| T11D | Stage-2 decisions verification | VERIFY | Orchestrator | T11A, T11B, T11C | DONE | 1 | d98a135 | `docs/work-items/WI-1/evidence/T11D-validate.txt` |
| T11 | Architecture verification | VERIFY | Orchestrator | T09, T10, T11D | DONE | 1 | 53e02a7 | `docs/work-items/WI-1/evidence/T11-plan-check.txt` |
| T11E | Intake of the provider and data-mode change (S-003) | IMPL | Orchestrator | T11 | DONE | 1 | 4757d4e, 19bfba9 | T11I |
| T11F | Requirements update for PD-12, PD-13 and PD-14 | IMPL | product-manager | T11E | DONE | 1 | 1715e21 | T11I |
| T11G | Architecture delta and plan reconciliation for PD-12, PD-13 and PD-14 | IMPL | architect | T11F | DONE | 3 | bf7dd40, 58e906a, b468d07 | T11J |
| T11H | Security design review of the provider and data-mode change | IMPL | security-reviewer | T11G | DONE | 2 | 89c721d, 1f65fda | T11J |
| T11I | Change requirements verification | VERIFY | Orchestrator | T11E, T11F | DONE | 1 | 3a2f8c9 | `docs/work-items/WI-1/evidence/T11I-requirements-check.txt` |
| T11K | Intake of the change-batch Product Owner decisions (S-005) | IMPL | Orchestrator | T11I | DONE | 1 | 7bc11e2 | T11N |
| T11L | Record PD-15 to PD-20 in the requirements | IMPL | product-manager | T11K | DONE | 1 | 966a599 | T11N |
| T11N | Change-batch decisions verification | VERIFY | Orchestrator | T11K, T11L | DONE | 1 | 18491cd | `docs/work-items/WI-1/evidence/T11N-validate.txt` |
| T11J | Change architecture verification | VERIFY | Orchestrator | T11G, T11H, T11I, T11N | DONE | 1 | 91e93b4 | `docs/work-items/WI-1/evidence/T11J-plan-check.txt` |
| T12 | Source of truth: stack, architecture summary, interface conventions, architecture decisions | IMPL | architect | T11J | DONE | 1 | 6d8830e | `docs/work-items/WI-1/evidence/T12-gates.txt` |
| T13 | Collect public provider documentation for the PD-01 research | IMPL | Orchestrator | T11J | DONE | 1 | 70906b2 | `docs/work-items/WI-1/evidence/T13-gates.txt` |
| T14 | Provider research analysis and recommendation | IMPL | architect | T13, T53 | PENDING | 0 | - | - |
| T15 | Workspace scaffolding, tooling and server skeleton | IMPL | backend-developer | T11J | DONE | 1 | 93a4795 | `docs/work-items/WI-1/evidence/T15-gates.txt` |
| T16 | Web application skeleton | IMPL | frontend-developer | T15 | DONE | 1 | cf0716e | `docs/work-items/WI-1/evidence/T16-gates.txt` |
| T17 | Configuration, catalog, display formatting and egress client | IMPL | backend-developer | T15 | IN_PROGRESS | 1 | - | - |
| T18 | Persistence: SQLite access, migration runner and initial schema | IMPL | backend-developer | T15 | DONE | 1 | 20d92b2 | `docs/work-items/WI-1/evidence/T18-gates.txt` |
| T19 | HTTP platform, composition root and local-origin protections | IMPL | backend-developer | T17, T18 | PENDING | 0 | - | - |
| T20 | HTTP contract promotion and shared API schemas | IMPL | backend-developer | T15 | IN_PROGRESS | 1 | - | - |
| T21 | Sports-data provider port, payload validation and fixture adapter | IMPL | backend-developer | T17, T20 | PENDING | 0 | - | - |
| T22 | AI provider port, stub adapter and OpenAI-compatible adapter | IMPL | backend-developer | T17 | PENDING | 0 | - | - |
| T23 | Synthetic fixture scenarios | IMPL | qa-engineer | T21, T22 | PENDING | 0 | - | - |
| T24 | End-to-end and accessibility test harness | IMPL | qa-engineer | T16, T19 | PENDING | 0 | - | - |
| T25 | Project gates, local-environment settings and contract declaration | IMPL | Orchestrator | T15, T16, T19, T20, T24 | PENDING | 0 | - | - |
| T26 | Source of truth: exact versions, contract hash, gate and environment notes | IMPL | architect | T12, T25 | PENDING | 0 | - | - |
| T27 | Projects module and workflow runner | IMPL | backend-developer | T18, T19, T20, T21 | PENDING | 0 | - | - |
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
| T43 | Contract conformance tests | IMPL | qa-engineer | T20, T38, T41, T50 | PENDING | 0 | - | - |
| T44 | End-to-end and accessibility journeys | IMPL | qa-engineer | T23, T24, T28, T29, T31, T36, T38, T39, T40, T50, T51 | PENDING | 0 | - | - |
| T45 | Architecture conformance review | IMPL | architect | T14, T26, T42, T43, T44, T52 | PENDING | 0 | - | - |
| T46 | Security evidence pack | VERIFY | qa-engineer | T45 | PENDING | 0 | - | - |
| T47 | Security delta validation | VERIFY | security-reviewer | T46 | PENDING | 0 | - | - |
| T49 | FootballDataProvider adapter, request budget, projection cache, live tests and capability probe script | IMPL | backend-developer | T21, T23 | PENDING | 0 | - | - |
| T50 | Manual data import module and ManualDataProvider | IMPL | backend-developer | T18, T19, T20, T21 | PENDING | 0 | - | - |
| T51 | Manual import UI | IMPL | frontend-developer | T16, T20 | PENDING | 0 | - | - |
| T52 | Integration tests: data modes, catalogue, manual import and credentials | IMPL | qa-engineer | T23, T27, T29, T30, T41, T49, T50 | PENDING | 0 | - | - |
| T53 | Capability probe run and football-data.org findings | IMPL | Orchestrator | T13, T41, T49 | PENDING | 0 | - | - |
| T48 | Final gate run | VERIFY | qa-engineer | T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40, T41, T42, T43, T44, T45, T46, T47, T49, T50, T51, T52, T53 | PENDING | 0 | - | - |

## Tasks

### T00: Intake of the Product Owner launch text
- Kind: IMPL
- Agent: Orchestrator
- Depends on: -
- Files owned: `docs/work-items/WI-1/intake/**`
- Scope: record the inline launch text verbatim, run the intake scan, produce the inventory and the intake record (starting point SP-1, mode full, S-000 at precedence level 1).
- Acceptance criteria: intake record and inventory checked by requirements rules RQ-02, RQ-08, RQ-09, RQ-11 and RQ-13 in T02.
- Verification: independently verified by T02 (`orch requirements check --work-item 'WI-1'` at the integration HEAD).
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch intake scan` exit 0 (1 analyzed, 0 unsupported, 0 excluded, 0 candidates); `orch tracker check` exit 0 at 1176f8c, 2026-10-27.
- Integration commit(s): 1176f8c (committed directly on work/WI-1). Verifier: T02.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T01: Normalized requirements
- Kind: IMPL
- Agent: product-manager
- Depends on: T00
- Files owned: `docs/work-items/WI-1/requirements.md`, `docs/work-items/WI-1/requirements.json`
- Scope: normalize the launch text into traceable requirements, user stories, acceptance criteria, assumptions, questions, dependencies, risks and a proposed MVP decomposition into delivery phases.
- Acceptance criteria: requirement records valid against the requirements schema; every source hash copied from the sources table; content no source states recorded as an assumption or a question.
- Verification: `orch requirements check --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base 1176f8c.
- Orchestrator verification: task commit 78d1620 (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (2 changed, 0 outside); `orch contracts check` exit 0 (0 contracts); `orch requirements check --at .` exit 0 (15 rules, 0 failed); main working tree unchanged; at 78d1620, 2026-10-27.
- Integration commit(s): dd9499e (merge --no-ff of task/WI-1/T01). Affected gates at dd9499e: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T01-gates.txt). Verifier: T02.
- Decisions: LOW-1 user stories stored as functional records refined by requirements; LOW-2 repeated S-000 statements merged into single records citing every location; LOW-3 phase IDs MVP-P1 to MVP-P4; LOW-4 requirements.md adds sections 16 Out of scope, 17 Risks, 18 Architecture considerations. All inside owned files and reversible. OD-01 to OD-09 concern this task.
- Human interventions: 0 (6 REQUIRES_PRODUCT_OWNER questions raised as E-01 to E-06).
- Agent usage: launches 1; tokens 149846; duration 14 minutes.

### T02: Requirements verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T00, T01
- Files owned: `docs/work-items/WI-1/evidence/T02-requirements-check.txt`
- Scope: run the requirements check at the integration HEAD and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS` with `VALIDATED_HEAD` at the integration HEAD.
- Verification: `orch requirements check --work-item 'WI-1' --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- requirements check` exit 0 (15 rules, 0 failed) at 17f8786, 2026-10-27; `orch evidence check` exit 0 (6 checks).
- Evidence: docs/work-items/WI-1/evidence/T02-requirements-check.txt; evidence commit c68b058; VALIDATED_HEAD 17f87863c4c632c7e5b4e983813c6f4d60a5d120.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T03: Intake of the Product Owner decisions
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T02
- Files owned: `docs/work-items/WI-1/intake/**`
- Scope: record the Product Owner decision message of 2026-10-27 verbatim as source S-001 (decision record, precedence level 1, stated by the PO in the session) and rescan the intake.
- Acceptance criteria: S-001 analyzed at level 1; intake record and inventory checked by RQ-02, RQ-08, RQ-09, RQ-11 and RQ-13 in T08.
- Verification: independently verified by T08 (`orch requirements check --work-item 'WI-1'` at the integration HEAD).
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch intake scan --rescan` exit 0 (SP-4, 2 analyzed, 0 excluded, 1 instruction candidate resolved by T04); `orch tracker check` exit 0 at f4ccb0c, 2026-10-27.
- Integration commit(s): f4ccb0c (committed directly on work/WI-1). Verifier: T08.
- Decisions: PD-01 to PD-09 recorded (Product Owner).
- Human interventions: Product Owner decision message of 2026-10-27 (S-001).
- Agent usage: NOT RECORDED (Orchestrator task).

### T04: Apply Product Owner decisions to the requirements
- Kind: IMPL
- Agent: product-manager
- Depends on: T03
- Files owned: `docs/work-items/WI-1/requirements.md`, `docs/work-items/WI-1/requirements.json`
- Scope: resolve R-410, R-411, R-413, R-414, R-415 and R-416 with PO decisions PD-01 to PD-06; apply PD-07 to PD-09; add the requirements, business rules, constraints and acceptance criteria the decisions state; flag the S-001 instruction candidate.
- Acceptance criteria: no open REQUIRES_PRODUCT_OWNER question; every changed record traces to S-001 with the sources-table hash; `orch requirements check` passes.
- Verification: `orch requirements check --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base f4ccb0c.
- Orchestrator verification: task commit 77f771b (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (2 changed, 0 outside); `orch contracts check` exit 0; `orch requirements check --at .` exit 0 (15 rules, 0 failed); 140 records, 0 REQUIRES_PRODUCT_OWNER; main working tree unchanged; at 77f771b, 2026-10-27.
- Integration commit(s): 01a71a7 (merge --no-ff of task/WI-1/T04). Affected gates at 01a71a7: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T04-gates.txt); full `orch validate` exit 0. Verifier: T08.
- Decisions: LOW-1 decided questions reclassified RESOLVED_BY_EXISTING_SOURCE citing S-001; LOW-2 gaps recorded as assumptions R-309 to R-311 and questions R-423 to R-426; LOW-3 S-001 cited by line range; LOW-4 new IDs within existing ranges, none removed. OD-10 to OD-12 concern this task.
- Human interventions: PD-01 to PD-09 (S-001).
- Agent usage: launches 1; tokens 207089; duration 14 minutes.

### T05: Record Product Owner decisions in the source-of-truth decision register
- Kind: IMPL
- Agent: architect
- Depends on: T03
- Files owned: `.orchestrate/source-of-truth.md`
- Scope: add PD-01 to PD-09 to section 3 (decision register), and the business rules and security constraints the decisions establish to sections 4 and 5, each referencing S-001 and the requirement records.
- Acceptance criteria: nine HIGH rows in the decision register; no other section changed beyond sections 4 and 5.
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base f4ccb0c.
- Orchestrator verification: task commit 3f94846 (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (1 changed, 0 outside); diff limited to sections 3, 4 and 5; `orch validate --at .` all sections PASS except requirements (RQ-09, RQ-13 owned by T04); at 3f94846, 2026-10-27.
- Integration commit(s): d93cbb1 (merge --no-ff of task/WI-1/T05). Affected gates: evidence/T05-gates.txt. Verifier: T07.
- Decisions: LOW-1 PD-03 no-unauthorized-logos recorded as business rule BR-06; LOW-2 synthetic fixtures recorded as SC-04; LOW-3 PD-07 cites S-001 only. All inside the owned file and reversible.
- Human interventions: PD-01 to PD-09 (S-001).
- Agent usage: launches 1; tokens 30476; duration 1 minute.

### T06: Configuration update: frontend-developer role and personal-data profile
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T03
- Files owned: `.orchestrate/config.json`
- Scope: enable the frontend-developer roster entry (PD-08) and set riskProfile.personalData to none (PD-04); no other key changes.
- Acceptance criteria: `orch validate` passes with no policy-floor violation; `orch agents list` shows frontend-developer enabled.
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0 ; `orch agents list --at .` -> frontend-developer enabled=yes
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: task commit 8f2593a; `orch worktree verify-ownership` exit 0 (1 changed, 0 outside; config named explicitly); `orch validate --section config,policy,agents,models --at .` exit 0; `orch agents list --at .` frontend-developer enabled=yes; full `orch validate --at .` exit 1 only in the requirements section (RQ-09, RQ-13: S-001 not yet reflected, owned by T04); at 8f2593a, 2026-10-27.
- Integration commit(s): 32d60da (merge --no-ff of task/WI-1/T06). Affected gates at 32d60da: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T06-gates.txt). Verifier: T07.
- Decisions: none beyond PD-04 and PD-08.
- Human interventions: PD-04, PD-08 (Product Owner message of 2026-10-27, S-001).
- Agent usage: NOT RECORDED (Orchestrator task).

### T07: Configuration and source-of-truth verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T05, T06
- Files owned: `docs/work-items/WI-1/evidence/T07-validate.txt`
- Scope: run `orch validate` at the integration HEAD after T05 and T06 are integrated and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS` with `VALIDATED_HEAD` at the integration HEAD.
- Verification: `orch validate --work-item 'WI-1' --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- validate --work-item 'WI-1'` exit 0 (all sections PASS, 0 violations) at e1459cb, 2026-10-27.
- Evidence: docs/work-items/WI-1/evidence/T07-validate.txt; evidence commit f648f85; VALIDATED_HEAD e1459cb72dd597e170f345b3b1b293a2e47b37f4.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T08: Follow-up requirements verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T03, T04, T07
- Files owned: `docs/work-items/WI-1/evidence/T08-requirements-check.txt`
- Scope: run the requirements check at the integration HEAD and record the evidence; last VERIFY task of stage 1.
- Acceptance criteria: evidence `RESULT: PASS` with `VALIDATED_HEAD` at the integration HEAD.
- Verification: `orch requirements check --work-item 'WI-1' --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- requirements check` exit 0 (15 rules, 0 failed) at 5ec665d, 2026-10-27. Note: tracker commit 5ec665d recorded T05 and T06 DONE before T03; corrected in the following commit that marks T03 DONE.
- Evidence: docs/work-items/WI-1/evidence/T08-requirements-check.txt; evidence commit 70befa9; VALIDATED_HEAD 5ec665d78e68188c126ed66ff579f1f592db8837.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T09: Architecture delta and task plan
- Kind: IMPL
- Agent: architect
- Depends on: T08
- Files owned: `docs/work-items/WI-1/architecture/**`
- Scope: full-mode architecture (new system: subsystems, trust boundaries to external data and AI providers, persistence), technology stack proposal, provider research plan (PD-01), contract proposals, security delta, decisions and the task plan starting at T12.
- Acceptance criteria: plan check passes; every acceptance criterion of the requirement records is named by at least one plan task; plan contains a security-reviewer VERIFY task and a final gate-run VERIFY task.
- Verification: `orch plan check --plan '<worktree>/docs/work-items/WI-1/architecture/task-plan.md' --tracker '<worktree>/docs/work-items/WI-1/tasks.md' --requirements '<worktree>/docs/work-items/WI-1/requirements.json' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base 6498afe.
- Orchestrator verification: task commit 8991d4c (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (7 changed, 0 outside); `orch contracts check` exit 0 (0 declared); `orch plan check --at .` exit 0 (37 tasks, 0 violations, 0 warnings); main working tree unchanged; at 8991d4c, 2026-10-27.
- Correction attempts: attempt 2 (2520c7a) applied T10-F01 to T10-F21 dispositions; Orchestrator found the contract YAML invalid (line 636); attempt 3 (e7270b6) fixed it. Re-verification at e7270b6: YAML parses (OpenAPI 3.1.0, 24 paths, 57 schemas); `orch worktree verify-ownership` exit 0 (7 changed, 0 outside); `orch plan check --at .` exit 0 (37 tasks, 0 violations, 0 warnings); 2026-10-27.
- Integration commit(s): f017460 (attempt 1), 41af5ee (attempts 2 and 3); merges --no-ff of task/WI-1/T09. Affected gates at 41af5ee: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T09-gates-2.txt). Affected gates at f017460: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T09-gates.txt). Verifier: T11.
- Decisions: LOW-1 decisions recorded once in delta section 5; LOW-2 traceability through task acceptance-criteria lines and the plan coverage table; LOW-3 provider research split into T13 (Orchestrator page capture) and T14 (architect analysis); LOW-4 provider-ports.md kept internal. Architecture decisions AD-01 to AD-20 in the delta. Escalations U-01 to U-12 classified after T10.
- Human interventions: 0.
- Agent usage: launches 1; tokens 335169; duration 29 minutes.

### T10: Security design review of the architecture
- Kind: IMPL
- Agent: security-reviewer
- Depends on: T09
- Files owned: `docs/work-items/WI-1/security/**`
- Scope: design-review mode: threat model and review of the architecture and security delta of T09 (full mode trigger); findings classified, must-fix findings returned to T09 as targeted corrections.
- Acceptance criteria: review report under the security directory with a verdict and classified findings; no open must-fix finding.
- Verification: independently verified by T11.
- Agent result: PASS (report delivered; design verdict FAIL, correctable: must-fix T10-F01, T10-F02, T10-F03; no HIGH or CRITICAL finding), base 8dc35d5.
- Orchestrator verification: task commit eae1f6a (Orchestrator commit of agent file); `orch worktree verify-ownership` exit 0 (1 changed, 0 outside); main working tree unchanged; at eae1f6a, 2026-10-27.
- Attempt 2 (addendum): agent result PASS, updated design verdict PASS (T10-F01 to T10-F03 resolved; F04, F09, F17, F19, F21 applied; new LOW observations T10-A1-01 to T10-A1-06, non-blocking); task commit 7d52520; `orch worktree verify-ownership` exit 0 (1 changed, 0 outside); 2026-10-27. Agent usage attempt 2: tokens 290709 (cumulative); duration 3 minutes.
- Integration commit(s): 3ac5b85 (attempt 1), c1c0e2c (attempt 2 addendum); merges --no-ff of task/WI-1/T10. Affected gates at c1c0e2c: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T10-gates-2.txt). Affected gates at 3ac5b85: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T10-gates.txt). Verifier: T11. An addendum confirming the T09 correction follows (attempt 2).
- Decisions: LOW-1 findings T10-F01 to T10-F21 with disposition and role class; LOW-2 library behaviours recorded as NV-1 to NV-6 for T47. Escalations: U-03 HIGH-03 (E-07); U-04 HIGH-06 reading (E-08); Q5 residual within PD-05 (no decision needed).
- Human interventions: 0.
- Agent usage: launches 1; tokens 199373; duration 13 minutes.

### T11A: Intake of the stage-2 Product Owner decisions
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T08
- Files owned: `docs/work-items/WI-1/intake/**`
- Scope: record the Product Owner message of 2026-10-27 answering E-07 and E-08 verbatim as source S-002 (precedence level 1) and rescan the intake.
- Acceptance criteria: S-002 analyzed at level 1; checked by the requirements rules in T11D.
- Verification: independently verified by T11D.
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch intake scan --rescan` exit 0 (SP-4, 3 analyzed, mode incremental, S-002 level 1); `orch requirements check` exit 0 after rescan; at 266b29d, 2026-10-27.
- Integration commit(s): 266b29d (committed directly on work/WI-1). Verifier: T11D.
- Decisions: PD-10, PD-11 recorded.
- Human interventions: PO message of 2026-10-27 (S-002).
- Agent usage: NOT RECORDED (Orchestrator task).

### T11B: Record PD-10 and PD-11 in the requirements
- Kind: IMPL
- Agent: product-manager
- Depends on: T11A
- Files owned: `docs/work-items/WI-1/requirements.md`, `docs/work-items/WI-1/requirements.json`
- Scope: add PD-10 (U-03 option A with its conditions) and PD-11 (U-04 contract-evolution policy) to the requirements decisions, with the records they establish, citing S-002; update the intake summary to the current intake record.
- Acceptance criteria: both decision IDs present and traced to S-002; `orch requirements check` passes.
- Verification: `orch requirements check --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base 266b29d.
- Orchestrator verification: task commit 53d3956 (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (2 changed, 0 outside); `orch requirements check --at .` exit 0 (15 rules, 0 failed); record diff against base: 140 records unchanged, 5 added (R-115, R-116, R-117, R-427, R-428), none removed, no new acceptance criterion; main working tree unchanged; at 53d3956, 2026-10-27.
- Integration commit(s): 380780f (merge --no-ff of task/WI-1/T11B). Affected gates: evidence/T11B-gates.txt. Verifier: T11D.
- Decisions: LOW-5 decided escalations recorded as questions R-427, R-428; LOW-6 PD-10 as constraints R-115, R-116 and PD-11 as R-117, no new acceptance criterion; LOW-7 mode incremental from the intake record.
- Human interventions: PD-10, PD-11 (S-002).
- Agent usage: launches 1; tokens 220189; duration 11 minutes.

### T11C: Record PD-10 and PD-11 in the source-of-truth decision register
- Kind: IMPL
- Agent: architect
- Depends on: T11A
- Files owned: `.orchestrate/source-of-truth.md`
- Scope: add PD-10 and PD-11 to section 3 (decision register) and the security constraint PD-10 establishes to section 5.
- Acceptance criteria: two HIGH rows citing WI-1 S-002; only sections 3 and 5 changed.
- Verification: independently verified by T11D.
- Agent result: PASS (files only; agent has no shell), base 266b29d.
- Orchestrator verification: task commit 974139e (Orchestrator commit of agent file); `orch worktree verify-ownership` exit 0 (1 changed, 0 outside); diff limited to PD-10, PD-11 (section 3) and SC-05 (section 5); main working tree unchanged; at 974139e, 2026-10-27.
- Integration commit(s): 16013be (merge --no-ff of task/WI-1/T11C). Affected gates at 16013be: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T11C-gates.txt). Verifier: T11D.
- Decisions: LOW-1 PD-10 points to SC-05 for the condition; LOW-2 PD-11 names U-04 and HIGH-06.
- Human interventions: PD-10, PD-11 (S-002).
- Agent usage: launches 1; tokens 21369; duration 1 minute.

### T11D: Stage-2 decisions verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T11A, T11B, T11C
- Files owned: `docs/work-items/WI-1/evidence/T11D-validate.txt`
- Scope: run `orch validate` (configuration, trackers, requirements) at the integration HEAD and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS` with `VALIDATED_HEAD` at the integration HEAD.
- Verification: `orch validate --work-item 'WI-1' --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- validate --work-item 'WI-1'` exit 0 (all sections PASS) at 8373bcb, 2026-10-27.
- Evidence: docs/work-items/WI-1/evidence/T11D-validate.txt; evidence commit d98a135; VALIDATED_HEAD 8373bcba3d623cd22b981c232081369d74998a16.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T11: Architecture verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T09, T10, T11D
- Files owned: `docs/work-items/WI-1/evidence/T11-plan-check.txt`
- Scope: run the plan check at the integration HEAD and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS` with `VALIDATED_HEAD` at the integration HEAD.
- Verification: `orch plan check --plan ... --tracker ... --requirements ... --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- plan check` exit 0 (37 tasks, 0 violations, 0 warnings) at a05778d, 2026-10-27.
- Evidence: docs/work-items/WI-1/evidence/T11-plan-check.txt; evidence commit 53e02a7; VALIDATED_HEAD a05778d34c62d54948d339e9dbab6babdef04a81.
- Decisions: OD-14, OD-15.
- Human interventions: PD-10, PD-11 (S-002).
- Agent usage: NOT RECORDED (Orchestrator task).

### T11E: Intake of the provider and data-mode change (S-003)
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T11
- Files owned: `docs/work-items/WI-1/intake/**`
- Scope: record the Product Owner change message of 2026-10-27 (football-data.org provider selection; LIVE_DATA, MANUAL_DATA and DEMO_DATA modes) verbatim as source S-003, and the scope clarification (multi-competition platform) verbatim as source S-004, both at precedence level 1, and rescan the intake.
- Acceptance criteria: S-003 analyzed at level 1; candidates resolved by T11F; checked by T11I.
- Verification: independently verified by T11I.
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch intake scan --rescan` exit 0 for S-003 (4 analyzed) and S-004 (5 analyzed); candidates resolved in T11F; at 19bfba9, 2026-10-27.
- Integration commit(s): 4757d4e, 19bfba9 (committed directly on work/WI-1). Verifier: T11I.
- Decisions: PD-12, PD-13, PD-14 recorded.
- Human interventions: PO messages S-003, S-004.
- Agent usage: NOT RECORDED (Orchestrator task); documentation review of football-data.org pages by the Orchestrator.

### T11F: Requirements update for PD-12, PD-13 and PD-14
- Kind: IMPL
- Agent: product-manager
- Depends on: T11E
- Files owned: `docs/work-items/WI-1/requirements.md`, `docs/work-items/WI-1/requirements.json`
- Scope: incremental update for S-003 and S-004 (PD-12 provider selection and credentials; PD-13 data acquisition modes, manual import and verification statuses; PD-14 multi-competition scope and provider independence); resolve the new intake candidates; classify questions.
- Acceptance criteria: existing record IDs preserved (supersede, never delete); new records traced to S-003; `orch requirements check` passes.
- Verification: `orch requirements check --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell); base 4757d4e, moved to 414e484 when S-004 was merged into the task branch (MED-05).
- Orchestrator verification: task commit 9d642dd (Orchestrator commit of agent files); `orch worktree verify-ownership --base 414e484` exit 0 (2 changed, 0 outside); `orch requirements check --at .` exit 0 (15 rules, 0 failed); record diff: 145 before, 267 after, none removed; 7 superseded (R-021, R-101, R-102, R-201, R-210, R-239, R-417) with replacing records named in their basis; 9 amended (R-022, R-030, R-046, R-109, R-110, R-111, R-116, R-226, R-400); 2 open REQUIRES_PRODUCT_OWNER questions (R-429, R-430); main working tree unchanged; at 9d642dd, 2026-10-27.
- Integration commit(s): 1715e21 (merge --no-ff of task/WI-1/T11F). Affected gates at 1715e21: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T11F-gates.txt). Verifier: T11I.
- Decisions: LOW-8 to LOW-14 (supersede with pointers; R-400 reclassified; one record per credential and import rule; S-003 and S-004 cited by section and lines; R-119 rejects person fields; paragraph duplicate flagged; IDs in existing ranges). OD-16 to OD-22 concern this task. New acceptance criteria R-243 to R-291; superseded acceptance criteria R-201, R-210, R-239.
- Human interventions: PD-12, PD-13, PD-14 (S-003, S-004); open E-09 to E-12.
- Agent usage: launches 1 (one in-flight brief update); tokens 430518; duration 45 minutes.

### T11G: Architecture delta and plan reconciliation for PD-12, PD-13 and PD-14
- Kind: IMPL
- Agent: architect
- Depends on: T11F
- Files owned: `docs/work-items/WI-1/architecture/**`, `.orchestrate/source-of-truth.md`
- Scope: attempt 3 (re-plan MED-05, replacing the removed task T11M): add PD-15 to PD-20 to the source-of-truth decision register, confirm BR-10 superseded (PD-20), add the business rules and security constraints PD-15 to PD-18 establish, and mark E-13 and E-14 decided in delta section 11. Attempts 1 and 2: update the architecture delta, contracts and data model for the football-data.org adapter and the three data acquisition modes; reconcile task-plan.md (preserve T12 to T48 IDs, add tasks only where needed); add PD-12 and PD-13 to the source-of-truth decision register.
- Acceptance criteria: plan check exit 0 (existing-ID warnings expected); every active acceptance criterion named by a task.
- Verification: `orch plan check --plan '<worktree>/docs/work-items/WI-1/architecture/task-plan.md' --tracker '<worktree>/docs/work-items/WI-1/tasks.md' --requirements '<worktree>/docs/work-items/WI-1/requirements.json' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base d862cb9.
- Orchestrator verification: task commit 91cba66 (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (8 changed, 0 outside); contract YAML parses (OpenAPI 3.1.0, 1.0.0-proposed.2, 32 paths, 85 schemas); `orch contracts check` exit 0 (0 declared); `orch plan check --at .` exit 0 (42 tasks, 0 violations, 37 warnings: existing IDs T12 to T48); main working tree unchanged; at 91cba66, 2026-10-27.
- Attempt 2 (correction for T11H-F01 to T11H-F20): task commit 9680066; `orch worktree verify-ownership` exit 0 (8 changed, 0 outside); contract YAML parses (1.0.0-proposed.2, 32 paths, 85 schemas); `orch plan check --at .` exit 0 (42 tasks, 0 violations, 37 existing-ID warnings); 24 tasks changed in attempt 2, no task added; LOW-1 to LOW-8 (contentBase64; provider-neutral references; test-live test double; T53 after T41; T53 evidence via evidence write; defaults; token removed from process.env); 2026-10-27. Agent usage attempt 2: launches 1; tokens 295325; duration 16 minutes.
- Attempt 3 (PD-15 to PD-20; replaces removed T11M): task commit cfb7a69; `orch worktree verify-ownership` exit 0 (8 changed, 0 outside); source-of-truth diff limited to sections 3 to 5 (PD-15 to PD-20; BR-10, BR-12 amended; BR-17, BR-18 added; SC-05 amended; SC-08 added); contract YAML unchanged and parses; `orch plan check --at .` exit 0 (42 tasks, 0 violations); 14 task scopes and the plan header changed, no ID, dependency, owned file, acceptance criterion or verification line changed; AD-38 added; escalations U-28, U-29, U-30, AD-38 confirmation; 2026-10-27. Agent usage attempt 3: launches 1; tokens 248372; duration 13 minutes.
- Integration commit(s): bf7dd40 (attempt 1), 58e906a (attempt 2), b468d07 (attempt 3); merges --no-ff of task/WI-1/T11G. Affected gates at b468d07: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T11G-gates-3.txt). Affected gates at 58e906a: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T11G-gates-2.txt). Affected gates: evidence/T11G-gates.txt. Verifier: T11J.
- Decisions: LOW-1 to LOW-7 (new delta section 11 with amended pointers; T12 to T48 titles, kinds and agents kept; T49 to T53 new; T12, T13, T15 depend on T11J; UI selection order; synthetic fixtures in documented v4 shape; T10-A1-01 and T10-A1-03 applied; probe as Orchestrator task T53). Architecture decisions AD-21 to AD-34. Escalations: contract revision classification (MED-01 recommended); SC-05 isolation (HIGH-03) after T11H.
- Human interventions: PD-12, PD-13, PD-14.
- Agent usage: launches 1; tokens 570659; duration 44 minutes.

### T11H: Security design review of the provider and data-mode change
- Kind: IMPL
- Agent: security-reviewer
- Depends on: T11G
- Files owned: `docs/work-items/WI-1/security/**`
- Scope: delta design review required by SC-05 (first real sports-data adapter; new input types CSV, JSON and form entry) and by the credential handling of PD-12; isolation recommendation for the PO.
- Acceptance criteria: review addendum with verdict; no open must-fix finding.
- Verification: independently verified by T11J.
- Agent result: PASS (report delivered; design verdict FAIL, correctable: must-fix T11H-F01 (import encoding, before contract re-acceptance) and T11H-F02 (real-token evidence); no HIGH or CRITICAL finding), base cdb4e81.
- Orchestrator verification: task commit dcbfeea (Orchestrator commit of agent file); `orch worktree verify-ownership` exit 0 (1 changed, 0 outside); main working tree unchanged; at dcbfeea, 2026-10-27.
- Integration commit(s): 89c721d (merge --no-ff of task/WI-1/T11H). Affected gates: evidence/T11H-gates.txt. Verifier: T11J. An addendum confirming the T11G correction follows (attempt 2).
- Attempt 2 (addendum): agent result PASS; updated change verdict PASS (T11H-F01 and F02 resolved; F03 to F11, F13, F14, F15, F20 resolved; F12, F16 to be confirmed by T47; F17 residual; new LOW observations T11H-A1-01 and A1-02); OD-23 CS-1 condition met; task commit on task/WI-1/T11H; `orch worktree verify-ownership` exit 0; integration commit 1f65fda; affected gates evidence/T11H-gates-2.txt; 2026-10-27.
- Decisions: LOW-1 numbering T11H-F01 to F20, V-31 to V-55, NV-7 to NV-12; LOW-2 session transcript and probe console count as logs (R-124). Escalations: SC-05 isolation (E-13), real-credential identity re-raise (E-14); contract revision MED-01 (OD-23 after F01); F13 classified MEDIUM (OD-24).
- Human interventions: 0.
- Agent usage: launches 1; tokens 309292; duration 14 minutes.

### T11I: Change requirements verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T11E, T11F
- Files owned: `docs/work-items/WI-1/evidence/T11I-requirements-check.txt`
- Scope: run the requirements check at the integration HEAD and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS`.
- Verification: `orch requirements check --work-item 'WI-1' --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- requirements check` exit 0 (15 rules, 0 failed) at 234e29c, 2026-10-27.
- Evidence: docs/work-items/WI-1/evidence/T11I-requirements-check.txt; evidence commit 3a2f8c9; VALIDATED_HEAD 234e29cb3c7aa2d3dd699f427f8fb73d3354a0bb.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T11K: Intake of the change-batch Product Owner decisions (S-005)
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T11I
- Files owned: `docs/work-items/WI-1/intake/**`
- Scope: record the Product Owner answer of 2026-10-27 to escalations E-09 to E-14 verbatim as source S-005 (precedence level 1) and rescan the intake.
- Acceptance criteria: S-005 analyzed at level 1; checked by T11N.
- Verification: independently verified by T11N.
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch intake scan --rescan` exit 0 (6 analyzed, S-005 level 1); `orch requirements check` exit 0 after rescan; at 7bc11e2, 2026-10-27.
- Integration commit(s): 7bc11e2 (committed directly on work/WI-1). Verifier: T11N.
- Decisions: PD-15 to PD-20 recorded; re-plan removing T11M (MED-05).
- Human interventions: PO answer S-005.
- Agent usage: NOT RECORDED (Orchestrator task).

### T11L: Record PD-15 to PD-20 in the requirements
- Kind: IMPL
- Agent: product-manager
- Depends on: T11K
- Files owned: `docs/work-items/WI-1/requirements.md`, `docs/work-items/WI-1/requirements.json`
- Scope: resolve R-429 (PD-17) and R-430 (PD-18), record PD-15 (SC-05 isolation option A), PD-16 (credential identity option A), PD-19 (C-1 confirmed) and PD-20 (C-3 confirmed) with the records they establish, citing S-005; close conflicts C-1 to C-3.
- Acceptance criteria: no open REQUIRES_PRODUCT_OWNER question; decisions traced to S-005; `orch requirements check` passes.
- Verification: `orch requirements check --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base 7bc11e2.
- Orchestrator verification: task commit 417f02d (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (2 changed, 0 outside); `orch requirements check --at .` exit 0 (15 rules, 0 failed); record diff: 267 before, 271 after, none removed; added R-078, R-142, R-143, R-320; 21 records amended; no new acceptance criterion; 0 open questions; conflicts C-1 to C-3 resolved; main working tree unchanged; at 417f02d, 2026-10-27.
- Integration commit(s): 966a599 (merge --no-ff of task/WI-1/T11L). Affected gates: evidence/T11L-gates.txt. Verifier: T11N.
- Decisions: LOW-15 to LOW-20 (PD-17 into R-071 and R-026; PD-15, PD-16 as R-142, R-143; PD-18 as R-078; no new acceptance criterion, R-271 and R-272 extended; R-320 assumption on label placement consistent with OD-28; S-005 cited). OD-29 concerns this task.
- Human interventions: PD-15 to PD-20 (S-005).
- Agent usage: launches 1; tokens 378705; duration 22 minutes.

### T11N: Change-batch decisions verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T11K, T11L
- Files owned: `docs/work-items/WI-1/evidence/T11N-validate.txt`
- Scope: run `orch validate` at the integration HEAD and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS`.
- Verification: `orch validate --work-item 'WI-1' --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- validate --work-item 'WI-1'` exit 0 (all sections PASS) at ce746e4, 2026-10-27.
- Evidence: docs/work-items/WI-1/evidence/T11N-validate.txt; evidence commit 18491cd; VALIDATED_HEAD ce746e4776510b5c3846ed58f1ba5798a8f27446.
- Decisions: none.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T11J: Change architecture verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T11G, T11H, T11I, T11N
- Files owned: `docs/work-items/WI-1/evidence/T11J-plan-check.txt`
- Scope: run the plan check at the integration HEAD after the reconciled tracker is committed and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS`.
- Verification: `orch plan check --plan ... --tracker ... --requirements ... --at '<integration worktree>'` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: `orch evidence capture -- plan check` exit 0 (42 tasks, 0 violations; warnings: plan IDs already in the tracker after reconciliation) at 076fd8e, 2026-10-27.
- Evidence: docs/work-items/WI-1/evidence/T11J-plan-check.txt; evidence commit 91e93b4; VALIDATED_HEAD 076fd8ef01a70cb04c7b96be4482b733141f6263.
- Decisions: OD-23 to OD-29.
- Human interventions: PD-12 to PD-20 (S-003, S-004, S-005).
- Agent usage: NOT RECORDED (Orchestrator task).

### T12: Source of truth: stack, architecture summary, interface conventions, architecture decisions
- Kind: IMPL
- Agent: architect
- Depends on: T11J
- Files owned: `.orchestrate/source-of-truth.md`
- Scope: fill sections 1 (stack and pinning policy: `architecture.md` section 2; exact versions follow in T26), 2 (architecture summary with links to the WI-1 architecture documents, including the data acquisition modes and the ingestion layer of `architecture.md` section 15), 3 (add the accepted architecture decisions AD-01 to AD-20 of `architecture-delta.md` section 5 and AD-21 to AD-34 of section 11.5, and AD-35 to AD-38 of sections 11.12.2 and 11.13.2, once the Orchestrator has recorded which are accepted; PD-12 to PD-20 were recorded by T11G; update the PD-14 row's "pending ... E-12 ... E-11" note to cite their confirmation by PD-20 and PD-19), 6 (interface conventions of `architecture-delta.md` section 2.1, plus the provider-neutrality conventions of section 11.2 and `contracts/provider-ports.md` section 1: data modes, opaque source references, provider identifiers only in adapters and configuration), 7 (gate notes: ports, disposable data directories, network needs of `npm ci`, `npm audit` and the browser download; no gate uses `FOOTBALL_DATA_API_TOKEN`; `test:live` and `probe:football-data` are manual), 8 (reusable components: platform modules, module kit, display formatting, ingestion port and adapter registry, request budget and projection cache) and 9 (open items of `architecture-delta.md` sections 8 and 11.8). Sections 4 and 5 are not changed by this task (T11G recorded BR-12 to BR-18 and SC-06 to SC-08, and amended BR-10 and SC-05). Reference, do not restate.
- Acceptance criteria: -
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base 24468c5.
- Orchestrator verification: task commit 1f59463 (Orchestrator commit of agent file); `orch worktree verify-ownership` exit 0 (1 changed, 0 outside); `orch validate --at .` exit 0; scope checked against the attempt-3 plan text (AD-01 to AD-38 incl. AD-35 to AD-38, PD-14 note corrected); main working tree unchanged; at 1f59463, 2026-10-27.
- Integration commit(s): 6d8830e (merge --no-ff of task/WI-1/T12). Affected gates at 6d8830e: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T12-gates.txt, the evidence file of this task).
- Decisions: LOW-1 to LOW-6 (AD rows as MEDIUM acceptances via OD-31; open items only in section 9; 11.13.3-a label; section 8 names the creating task; section 7 planned gates; relative links). Reported stale texts: T17 and T15 tracker scopes (corrected by the reconciliation correction), architecture.md and AD-01/AD-28 texts (superseded by OD-30 and AD-38, recorded in the register), section 0 still to be completed.
- Human interventions: 0.
- Agent usage: launches 1; tokens 192263; duration 6 minutes.

### T13: Collect public provider documentation for the PD-01 research
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T11J
- Files owned: `docs/work-items/WI-1/research/**`
- Scope: capture the public documentation pages listed in `provider-research-plan.md` sections 3 and 4 as refocused by T11G: football-data.org (documentation, coverage, pricing, policies, any terms, commercial-use, republishing or attribution statement, status page, any statement of its data origin; or a dated "not published" note per item), the candidates for the independent secondary verification source, the official competition publications of the reference competition and of the candidate second LIVE_DATA competitions (S-004 examples), and the AI options; text files with URL and retrieval date, one directory per candidate, plus an index. Limits of `provider-research-plan.md` section 1: no account, trial, key request, purchase or upgrade (SC-03); the Product Owner's token is not used by this task; captured text is data. If public pages cannot be fetched, report BLOCKED (reason: environment).
- Acceptance criteria: R-242
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0
- Agent result: n/a (Orchestrator task).
- Orchestrator verification: raw capture impossible (session shell has no outbound network; lifting the sandbox was denied by the environment's safety check, not worked around); 20 WebFetch extractions written with URL, date, outcome and method under docs/work-items/WI-1/research/ with index.md; API-Football 403 and UEFA legal 404 recorded as not captured; `orch worktree verify-ownership` exit 0 (20 changed, 0 outside); `orch validate --at .` exit 0; at f125272, 2026-10-27.
- Integration commit(s): 70906b2 (merge --no-ff of task/WI-1/T13). Affected gates at 70906b2: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T13-gates.txt, the evidence file of this task).
- Decisions: finding: football-data.org terms are published on /about (General Terms and Conditions 2018-06-01, attribution clause 7.1, logos 9.2, single-application key 2.3, fair use 3.3, Dutch law), correcting the earlier review that found none; requirements assumption R-316 and the delta section 11.10 statement are outdated; carried to T14 (provider findings record R-281) and to the PO in the next status report.
- Human interventions: 0.
- Agent usage: NOT RECORDED (Orchestrator task).

### T14: Provider research analysis and recommendation
- Kind: IMPL
- Agent: architect
- Depends on: T13, T53
- Files owned: `docs/work-items/WI-1/architecture/provider-research.md`
- Scope: the deliverable of `provider-research-plan.md` section 6 from the T13 captures and the T53 findings file only: the provider findings record for football-data.org (competition availability, coverage, seasons, rate limits, freshness, commercial use, republishing, attribution; each sourced and dated or marked UNVERIFIED; R-136, R-281) and the confirmation or correction of every UNVERIFIED item of `contracts/provider-ports.md` section 1.4, naming the T49 correction if one is needed; per-candidate findings for the secondary verification source and the official publications (coverage, pricing, reliability, redistribution and licensing conditions, independence, adapter impact); comparison matrix; recommendation with the independence argument and cost class; the ranked list of second LIVE_DATA competitions whose coverage T53 confirmed (OD-22, R-440), or the statement that fewer than two are confirmed; AI options with and without subscription; the batched Product Owner decision request (approval of a secondary source R-432, costs needing authorization, and the facts the Product Owner needs to request football-data.org's written republishing permission under PD-18: the published contact route, the uses to be covered and any attribution requirement found); the follow-up adapter tasks; the R-242 and R-281 confirmation statements (nothing purchased, subscribed to or upgraded). T11H: the answers to NV-7 (largest response size per resource kind; when the season-wide match list exceeds 512 KiB, the follow-up correction of `config/live.config.json` setting `maxResponseBytesByResource.stageDiscovery` at most 2 MiB, Q8), NV-8 (the `X-Authenticated-Client` presence booleans and whether an anonymous marker exists, never a value; the follow-up adapter constant if needed, T11H-F04) and NV-10 (whether the counter is per token); the upstream data origin of each candidate expressed as the `independenceGroup` the configuration must use (OD-24). No legal assessment, no model names.
- Acceptance criteria: R-242, R-281
- Verification: `orch scan models docs/work-items/WI-1/architecture/provider-research.md` -> exit 0 ; `orch validate --work-item 'WI-1' --at .` -> exit 0

### T15: Workspace scaffolding, tooling and server skeleton
- Kind: IMPL
- Agent: backend-developer
- Depends on: T11J
- Files owned: `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.example`, `README.md`, `docs/local-setup.md`, `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/main.ts`, `apps/server/src/app.ts`, `apps/server/src/container.ts`, `apps/server/src/modules/module-kit.ts`, `apps/server/src/modules/registry.ts`, `apps/server/src/modules/*/index.ts`, `apps/server/src/providers/sports/index.ts`, `apps/server/src/providers/ai/index.ts`, `apps/server/test/integration/smoke/**`, `apps/server/test/static/**`, `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/index.ts`
- Scope: npm workspaces (`apps/*`, `packages/*`); the root and server and contracts dependency set of `architecture.md` section 2.1 at exact versions under the pinning policy of section 2.2 (`.npmrc` with `save-exact`, `engine-strict`, `ignore-scripts`; `.nvmrc` and `engines` with the host's LTS Node.js version, 24 or later, else stop and escalate); strict TypeScript project references; ESLint and Prettier; Vitest projects `unit`, `integration`, `contract` (web tests in jsdom) and, new in T11G, `live` (`**/*.live.test.ts`, excluded from every other project, `passWithNoTests`), with the `unit` project also including `scripts/**/*.test.mjs` and `apps/server/test/static/**`; `vitest.setup.ts` installing a network guard that fails any non-loopback request (R-241) and deleting `FOOTBALL_DATA_API_TOKEN` and `EDR_LIVE_TESTS` from `process.env` for the default projects (R-257); the root scripts of `architecture-delta.md` section 7.1 including `test:live` and `probe:football-data`; `.gitignore` (`data/`, `.env*` except `.env.example`, `.cache/`, build output, test reports; R-126, R-265); `.env.example` listing `FOOTBALL_DATA_API_TOKEN=` and `EDR_AI_API_KEY=` with empty values (R-125, R-264); README (data modes) and `docs/local-setup.md` (architecture section 12; LIVE_DATA setup with `EDR_CONFIG=config/live.config.json` and the token only in `.env.local` with mode 0600; live tests and the probe are optional and manual); server skeleton: minimal `main.ts` and `app.ts` (health route on 127.0.0.1), `module-kit.ts` and `registry.ts` per `contracts/provider-ports.md` section 3, stub `index.ts` for the ten modules (including `imports`) and both provider factories; one smoke unit test and one smoke integration test (Fastify `inject` on the health route). Report every dependency with its exact version for the MED-02 decisions. Security design review items: ESLint security rules of `architecture-delta.md` section 7.1 (network APIs banned outside `apps/server/src/platform/net/**` and everywhere in `apps/server/src/modules/export/**` and `apps/server/src/modules/imports/**`, T10-F08; `dangerouslySetInnerHTML` banned, T10-F16; `${` template literals in `prepare` or `exec` banned, T10-F14); `scripts/**` in the lint scope (T10-A1-03); the provider-identifier rule of section 7.1 (AD-31, R-289) with a unit test in `apps/server/test/static/` that lints seeded violations (`'CL'`, `2001`, `'api.football-data.org'`, `'football-data'`, a competition-name string, an import of `adapters/football-data`) at a core path with the project configuration and expects errors, lints the same text under `apps/server/src/providers/sports/adapters/` and expects none, and lints the delivered tree and expects none; `vitest.setup.ts` network guard at socket level (`net.Socket.prototype.connect`, `net.connect`, undici global dispatcher), with a test that a third-party-style direct socket connection to a non-loopback address fails (T10-F08); a shared dummy key constant and the synthetic marker token `edr-test-marker-token-0000` for tests (T10-F11, AD-30); `.npmrc` without auth token or alternate registry, and a report that every `resolved` URL in the lock file is on `https://registry.npmjs.org/` with an `integrity` value (T10-F18); run the full `npm audit` advisory list and report every advisory of any severity (T10-F02, T10-F18); `docs/local-setup.md` states the single-user workstation assumption (no shared or multi-user host), `.env.local` with mode 0600, the development allow-lists, and that the platform must not be run with a paid key or a real provider token on a shared host (T10-F19, T10-F11); and the PD-16 conditions (source-of-truth SC-08): a free-plan football-data.org token only, the LIVE configuration (`EDR_CONFIG=config/live.config.json`) enabled only when needed and the default configuration used otherwise, and a new Product Owner decision required before a paid plan, a shared or multi-user host, or real non-public data. T11H review items: no npm script, no `NODE_OPTIONS` default and no documentation enables Node diagnostic reports (`--report-on-fatalerror`, `--report-uncaught-exception`, `--report-on-signal`) or heap snapshots, and `docs/local-setup.md` says not to enable them while a token is configured (T11H-F03); `docs/local-setup.md` describes the token presence check without printing the value (`grep -c '^FOOTBALL_DATA_API_TOKEN=..*' .env.local`) and forbids `cat`, `printenv`, `env` or shell tracing on it (T11H-F02); `eslint.config.mjs` sets `linterOptions.noInlineConfig: true` for `apps/**` and `packages/**` outside test files, so no inline disable directive can bypass the provider-identifier rule or the network bans in core code, and the seeded test of `apps/server/test/static/` also lints a violation preceded by `// eslint-disable-next-line no-restricted-syntax` at a core path and expects an error (T11H-F15, V-55).
- Acceptance criteria: R-222, R-225, R-257, R-264, R-265, R-289
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0 ; `npm run test:live` -> exit 0 (no live test yet) ; `npm audit --audit-level=high` -> exit 0
- Agent result: PASS at d8b8e49 (npm ci 0; typecheck 0; lint 0; test:unit 0, 118 tests; test:integration 0, 3 tests; test:live 0, none; npm audit --audit-level=high 0: 0 critical, 0 high, 2 moderate; npm audit signatures 0; lock file 326 entries all on registry.npmjs.org with integrity).
- Orchestrator verification: `orch worktree verify-ownership` exit 0 (43 changed, 0 outside); re-run in the task worktree at d8b8e49 on Node 22.22.2: typecheck exit 0, lint exit 0, test:unit exit 0 (4 files, 118 tests), test:integration exit 0 (1 file, 3 tests), test:live exit 0; in the verify worktree at 93a4795: `npm ci --offline` exit 0 (293 packages from the local npm cache, lock-file integrity checked), test:unit 118 passed, typecheck exit 0; `npm audit` NOT RE-RUN by the Orchestrator (the Orchestrator shell has no registry access; agent-reported result recorded; PRJ-AUDIT re-runs it in the final gates); main working tree unchanged; 2026-10-27.
- Integration commit(s): 93a4795 (merge --no-ff of task/WI-1/T15). Affected gates at 93a4795: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T15-gates.txt, the evidence file of this task).
- Decisions: LOW-1 to LOW-11 (legacy-peer-deps with explicit peers; registry pinned; unit and unit-web projects; composite workspace tsconfigs; non-type-aware lint; extended network bans; EDR_AI_API_KEY removed in setup; seeded identifiers in a JSON fixture; Prettier scope; ignore rules; module stub export and test constants). OD-32, OD-33, OD-34 concern this task.
- Human interventions: 0.
- Agent usage: launches 1; tokens 273138; duration 22 minutes.

### T16: Web application skeleton
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T15
- Files owned: `apps/web/**`, `package-lock.json`
- Scope: Vite and React application with the `apps/web` dependencies of `architecture.md` section 2.1 at exact versions; `vite.config.ts` with `server.host` and `preview.host` `127.0.0.1`, `strictPort`, `/api` proxy to `127.0.0.1:4300`; app shell opening directly on the project list route with no login, account or sign-in element (R-235); route table with lazy stubs for `features/projects`, `features/facts`, `features/review`, `features/history`, `features/brand` and, new in T11G, `features/imports` (each an `index.tsx` stub that the feature tasks replace); API client (`src/api/client.ts`) that sends `X-EDR-Client: web` on mutating requests, parses problem+json (including `importErrors`, `retryAfterSeconds` and `refusalReason`) and validates responses with `packages/contracts` schemas when present; shared UI (`src/ui/`: layout, status badge, provenance label, error banner, copy table, Spanish UI copy, and a `SafeReference` component that renders every source reference as plain text only, never as a link, whatever its content (T10-F16; T11H-F14: references are provider-neutral and the browser never links to a provider host), with a unit test using `javascript:`, `data:` and `https:` values that asserts no anchor element is produced); T11G shared UI: `DataModeBadge` (LIVE_DATA, MANUAL_DATA, DEMO_DATA), `FactStatusBadge` (VERIFIED; UNVERIFIED with its reason; MANUALLY_APPROVED labelled operator-attested and never styled or worded as verified), `DemoBanner` (OD-21), `AvailabilityNote` (subscription restriction, not found, standings not available) and `ListingProvenance` (retrieved at, from cache, stale, retry after), with Spanish copy; unit tests for the client and a test asserting the Vite host settings are loopback (R-234). Development-mode controls (T10-F02, `architecture.md` section 12.1), all asserted by a unit test of `vite.config.ts`: `server` and `preview` with `host` `127.0.0.1`, `strictPort`, `allowedHosts` never `true`, `cors` not widened, `fs.strict` `true`, `fs.deny` = Vite's default list (covering `.env` and `.env.*`) plus `data/**`; `/api` proxy with `changeOrigin: false`; `envPrefix` `VITE_` and `envDir` `apps/web` (T10-F11; no provider base URL or credential reaches the bundle). The pinned Vite version must have no known advisory of any severity: run the full `npm audit` advisory list and `npm ls vite` and report both; an advisory naming Vite fails this task (the high-level gate lets moderate advisories through).
- Acceptance criteria: R-234, R-235
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0 ; `npm audit --audit-level=high` -> exit 0 ; `npm ls vite` -> exit 0, one pinned version
- Agent result: PASS at 9826bb4 (npm ci 0; typecheck 0; lint 0; test:unit 0, 214 tests, 96 new web; build 0; npm audit --audit-level=high 0, 2 moderate accepted by OD-33, none naming Vite; npm ls vite single 8.3.4; lock file 336 entries on registry.npmjs.org with integrity); acceptance criteria per the task section (incl. R-234, R-235).
- Orchestrator verification: `orch worktree verify-ownership` exit 0 (45 changed, 0 outside); re-run in the task worktree at 9826bb4: npm ci --offline 0, typecheck 0, lint 0, test:unit 0 (10 files, 214 tests), test:integration 0 (1 file, 3 tests), build 0 (Orchestrator build output removed afterwards); main working tree unchanged; 2026-10-27.
- Decisions: LOW-1 to LOW-9 (Spanish copy tables; temporary contract type copy in src/api/types.ts; problem parser sanitising; cors false; fs.deny anchored data/**; splat feature mounts; preview port 4173; SafeReference replaces control and format characters; client refuses absolute paths, redirect error, no-store). OD-35 (dependencies) and OD-36 (types swap owner) concern this task.
- Human interventions: 0.
- Agent usage: launches 1; tokens 230672; duration 15 minutes.
- Integration commit(s): cf0716e (merge --no-ff of task/WI-1/T16). Affected gates at cf0716e: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T16-gates.txt, the evidence file of this task).

### T17: Configuration, catalog, display formatting and egress client
- Kind: IMPL
- Agent: backend-developer
- Depends on: T15
- Files owned: `apps/server/src/platform/config/**`, `apps/server/src/platform/format/**`, `apps/server/src/platform/net/**`, `config/*.json`
- Scope: `architecture.md` sections 5.1 and 15.2 and `contracts/provider-ports.md` sections 4 and 5 (revised by T11G). Zod configuration schema (host restricted to `127.0.0.1`, unknown and secret-like keys rejected, `publicationMode` enum `manual`, format default 1080 x 1350 and `maxSlidesPerCarousel` set from Instagram's published specification at implementation time, standings rows per slide, display offset); sources (`id`, `name`, `mode`, `enabled`, `role`, `accepted`, `independenceGroup`, `officialPublication`, `publicationPermission`, adapter kind as a slug, opaque `options` validated later by the adapter) with the data-mode startup rules (unknown mode, duplicate IDs, accepted MANUAL_DATA source, LIVE_DATA source without an `https:` `options.baseUrl`, no enabled primary source: startup stops with an error naming the setting; OD-20, R-266); `verificationPolicy` as decided by PD-17 and PD-18 (`architecture-delta.md` section 11.13, AD-38): `manuallyApprovedPublication` accepts `blocked` and `allowed_without_accepted_source` (default) and refuses `allowed_labelled` at startup naming the setting; `livePublicationPermissionRule` accepts only `every_supporting_source` (default) and refuses `any_supporting_source` at startup naming the setting; per-source `publicationPermission` (`unconfirmed` default for LIVE_DATA, `not_applicable` for DEMO_DATA and MANUAL_DATA) and `publicationPermissionDecision` (pattern `^PD-[0-9]{2,4}$`), which is required when a LIVE_DATA source is `confirmed` and refused on DEMO_DATA and MANUAL_DATA sources and with `unconfirmed` (startup stops naming the source); the `config/catalogue.json` schema (links with bindings, `reference`, `stageAliases`, `selectableStages`, `noAcceptedPublicSource` (default `false`); `restrictToLinks`), with the startup rule that a link marked `noAcceptedPublicSource` binds at least one source and only MANUAL_DATA sources, never a LIVE_DATA, DEMO_DATA or `accepted` source (startup stops naming the link); the committed configurations set `restrictToLinks: false`, no `selectableStages` and no `noAcceptedPublicSource` link (PD-19, PD-20, AD-38); no competition list and no league-phase restriction (PD-14; the T09 `config/competitions.json` is not created); `config/app.config.json` with the DEMO_DATA sources `demo-a` (primary) and `demo-b` (verification, official publication), the MANUAL_DATA source `manual` and the stub AI adapter; `config/catalogue.json` linking the fixture competitions `liga-demo` and `copa-demo` of sources `demo-a` and `demo-b` (keys fixed here for T23), `copa-demo` marked as reference; `config/languages.json` (es default, en; OD-11); `config/brand.json` with provisional palette and font roles (OD-07); environment loading (`EDR_CONFIG`, `EDR_DATA_DIR`, `EDR_PORT`; platform/config never reads a secret, adapters read their own from the injected environment); deterministic display formatting, `stageDisplay`, and per-language template text including the demonstration label and "standings not available"; egress client with the allow-list built from the `options.baseUrl` origins of the enabled sources and the AI adapter only (empty for the default configuration), HTTPS only (loopback HTTP allowed for local AI servers), no redirects, timeouts and size caps. Source independence startup rules (OD-24, T11H-F13; `architecture.md` section 5.1, `contracts/provider-ports.md` section 1.2): two enabled sources with the same adapter kind and the same `options.baseUrl` origin but different `independenceGroup` values stop startup naming both sources; a `config/catalogue.json` link binding a DEMO_DATA source together with a LIVE_DATA or MANUAL_DATA source stops startup naming the link; the committed configurations satisfy both. Lookups keyed by configured or file-supplied values (link IDs, source IDs, stage aliases) use `Map` (T11H-F07). Unit tests for each rule, including each data-mode rule, both independence rules (with `__proto__` and `constructor` as link and alias keys), the PD-17 and PD-18 rules (refused policy values, a marked link binding a LIVE_DATA, DEMO_DATA or accepted source, `confirmed` without a decision ID, a decision ID on a MANUAL_DATA source) and a check that no provider identifier is needed by platform code. Security design review items: configuration schema for the explicit Host and Origin allow-lists (`server.allowedHosts`, `server.allowedOrigins`; exact values; wildcard, `0.0.0.0` and non-loopback hosts rejected; production defaults `127.0.0.1:4300` and `localhost:4300`; a development configuration adding the 5173 values; T10-F02); egress client details of `contracts/provider-ports.md` section 4 (exact origin match after WHATWG URL parsing with lowercase and IDNA hosts and userinfo rejected; loopback `http:` only for the configured AI origin; `redirect: 'error'`; one total deadline covering the body; streaming cap counting decoded bytes; defaults 512 KiB sports and 256 KiB AI with a 2 MiB schema maximum; TLS verification never disabled), with unit tests against a loopback test server for oversize after decompression, slow-drip body, redirect, foreign origin, `http:` to a non-loopback host and userinfo (T10-F07); `platform/net` is the only module allowed to open network connections (T10-F08).
- Acceptance criteria: R-226, R-236, R-238, R-243, R-266
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T18: Persistence: SQLite access, migration runner and initial schema
- Kind: IMPL
- Agent: backend-developer
- Depends on: T15
- Files owned: `apps/server/src/platform/db/**`, `apps/server/migrations/**`
- Scope: `data-model.md` (revised by T11G): `Db` port over `node:sqlite` (`DatabaseSync`, WAL, foreign keys on), transaction helper, migration runner with `schema_migrations`, migration `0001_initial.sql` with every table, check constraint and index of `data-model.md` sections 3 and 4, including the T11G changes (`projects` selection columns without the league-phase check, `retrievals`, `manual_approvals`, `imports`, `manual_competitions`, `manual_seasons`, `manual_selection_versions`, the new `facts`, `observations`, `sources`, `workflow_runs`, `content_drafts` and `exports` columns); integration tests on a temporary database (constraints reject a fact without attribution, a verified fact without value, a disputed record without consistent outcome, a MANUAL_DATA observation without import version, a disputed fact with a candidate value, manual eligibility on an ineligible status, an unknown data mode) and the schema test of `data-model.md` section 5 with the extended name pattern (no player-level, person, user, account or credential names; this task owns migration `0001_initial.sql` and the R-233 schema test, T10-F21). The `Db` port exposes prepared statements with bound parameters only, dynamic identifiers come from code constants, and a synchronous `BEGIN IMMEDIATE` transaction helper with no `await` inside is provided for the guards of T30, T37, T38 and T50 (T10-F14, T10-F15); `failure` columns hold the closed failure JSON (T10-F10).
- Acceptance criteria: R-204, R-233
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0
- Agent result: PASS at 2d05c0f (npm ci 0; typecheck 0; lint 0; test:unit 0, 148 tests; test:integration 0, 60 tests; npm audit --audit-level=high 0, 2 moderate as in base); acceptance criteria R-204, R-233.
- Orchestrator verification: `orch worktree verify-ownership` exit 0 (12 changed, 0 outside); re-run in the task worktree at 2d05c0f: npm ci --offline 0, typecheck 0, lint 0, test:unit 0 (6 files, 148 tests), test:integration 0 (4 files, 60 tests); main working tree unchanged; 2026-10-27.
- Decisions: LOW-1 to LOW-7 (config_snapshot json_valid check; schema_migrations IF NOT EXISTS; index names; R-233 pattern adds person, people, credential, api key; nested transactions as savepoints; busy timeout 5000 ms, statement cache 500, WAL check; repository helpers). No new dependency. Risks reported: async work after the first await escapes a transaction (type guard; T47 V-21); failure-code list enforced in code until repositories use the T20 Failure schema; T19 creates the data directory (0700) and opens the migrated database.
- Human interventions: 0.
- Agent usage: launches 1; tokens 187762; duration 12 minutes.
- Integration commit(s): 20d92b2 (merge --no-ff of task/WI-1/T18). Affected gates at 20d92b2: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T18-gates.txt, the evidence file of this task).

### T19: HTTP platform, composition root and local-origin protections
- Kind: IMPL
- Agent: backend-developer
- Depends on: T17, T18
- Files owned: `apps/server/src/main.ts`, `apps/server/src/app.ts`, `apps/server/src/container.ts`, `apps/server/src/platform/http/**`, `apps/server/test/integration/smoke/**`
- Scope: `main.ts` (load configuration, prepare data directory, open database, run migrations, build the source registry and run its startup validation, run every module's `onStartup` hook in registry order, listen on `127.0.0.1` only; a startup validation error exits non-zero with a message that names the setting or variable and never a value, OD-20, R-266, tested with a registry containing a test adapter whose `validateStartup` fails); `container.ts` (config, db, clock, logger with redaction of `authorization`, key, token and secret fields, egress client, the source registry from `createSportsSources` with the injected environment and the catalogue service, AI provider, paths; `FOOTBALL_DATA_API_TOKEN` never enters the configuration object or the config snapshot, AD-30); `app.ts` registering the platform plugins, the modules from `registry.ts` under `/api/v1`, and the built UI with `@fastify/static` plus SPA fallback; `platform/http`: Host allow-list (`architecture.md` section 12.1; 421 `MISDIRECTED_HOST`), mutating-request guard (custom header `X-EDR-Client: web`, configured `Origin` allow-list when present, JSON content type; 403 `FORBIDDEN_ORIGIN`), no CORS headers, security headers (strict CSP `default-src 'self'` with an explicit `connect-src 'self'`, so the browser can never call a provider, R-262; `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`), body size limits, problem+json error handler that never leaks stack traces, configuration or credentials and supports the T11G problem codes and properties (`PROVIDER_RATE_LIMITED` with `retryAfterSeconds`, `SELECTION_UNAVAILABLE` and `MANUAL_APPROVAL_REFUSED` with `refusalReason`, `IMPORT_REJECTED` with `importErrors`). Integration tests: listener address is loopback, connection to a non-loopback interface address is refused, foreign Host and cross-origin mutating requests are refused, no login or account route exists. Security design review items (`architecture-delta.md` section 4 TB-1, TB-5, TB-6): Host and Origin allow-lists read only from the configuration (exact values, never derived from request headers), applied to every request (API, static, SPA fallback, 404, OPTIONS); `trustProxy` false; development origin set accepted only when configured (T10-F02); guards in `onRequest`, before body parsing; deny-by-default for every method other than GET and HEAD; `Origin: null` refused; Fetch-Metadata refusal of `/api/**` requests with `Sec-Fetch-Site` `cross-site` or `same-site`; CORP and COOP `same-origin`; CSP `default-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'`; no `Access-Control-*` header on any response including OPTIONS (T10-F04); global JSON body limit 64 KiB with a route-level override mechanism (used for `POST /api/v1/imports` at 1.5 MiB, JSON only, no new content-type exception) and a route-specific content-type exception mechanism for `image/png` and `image/jpeg` (used by T33, T10-F12); problem `detail` from fixed text and sanitized parameters, 500 returns `INTERNAL` with fixed text (T10-F10); explicit pino redaction paths (`req.headers.authorization`, `headers.authorization`, `req.headers["x-auth-token"]`, `headers["x-auth-token"]`, `*.apiKey`, `*.key`, `*.token`, `*.authToken`, `*.secret`, `*.password`) with unit tests that the synthetic marker token placed in each path never appears in the log output (R-263), request logs limited to method, route, status and duration (T10-F11); `@fastify/static` rooted only at `apps/web/dist` with `dotfiles: 'deny'`, no listing, SPA fallback never matching `/api/**`, data directory created with mode 0700 (T10-F13). Tests for each of these. T11H review items: after building the injected environment, `container.ts` deletes `FOOTBALL_DATA_API_TOKEN` from `process.env`, with a test that a module reading `process.env` afterwards sees no token (T11H-F03); a startup `ConfigError` is printed as its fixed message only, never as an error object, issue list or stack containing input values (T11H-F03); the error handler and request logging never log a request body at any level, including for `createImport`, with a test that a rejected import carrying the marker token in a cell leaves no marker in the captured log (T11H-F12); Fastify `onProtoPoisoning: 'error'` and `onConstructorPoisoning: 'error'`, with a test that a deeply nested JSON body of about 1.5 MiB on the import route is refused with 400 quickly and without a stack overflow (NV-9).
- Acceptance criteria: R-234, R-235, R-262, R-263, R-266
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T20: HTTP contract promotion and shared API schemas
- Kind: IMPL
- Agent: backend-developer
- Depends on: T15
- Files owned: `contracts/**`, `packages/contracts/src/**`, `apps/server/test/contract/**`
- Scope: preconditions: the re-acceptance OD-23 is effective and the Orchestrator's disposition of U-28 is recorded (plan header precondition 6; if it adds a closed enum value, the Orchestrator re-accepts the proposal with that value before this task starts). The identity decision is PD-16, option A: no request header is added (E-14 closed). Promotion task assigned explicitly: copy the accepted `docs/work-items/WI-1/architecture/contracts/http-api.openapi.yaml` (as corrected for T10-F03, T10-F17 and T10-F10, revised by T11G and corrected for T11H-F01, F06, F11, F14 and F20, `1.0.0-proposed.2`, re-accepted by the Orchestrator as OD-23) to `contracts/http-api.openapi.yaml` with `info.version` `1.0.0`, no other change (report its SHA-256 for T25); the Zod schemas carry the same ID and name patterns, `maxLength` and `maxItems` limits and closed objects (T10-F03, T10-F17); `packages/contracts/src`: Zod schemas and inferred types for every schema and operation of the contract (request bodies, responses, problem codes); new in T11G, `packages/contracts/src/domain/`: the shared provider-neutral domain schemas of `contracts/provider-ports.md` section 1.3 and `data-model.md` section 0 (Competition, Season, Stage, Matchday, Match, Team, Standing, Source, Verification status, `SelectionSnapshot`, listing items) with the validation rules of section 1.3 (allow-list stripping with a stripped-key count, structural checks, name rules), exported for the server registry and adapters, with unit tests on inline synthetic values; contract test harness in `apps/server/test/contract/` (OpenAPI 3.1 document validates; every component schema has a Zod counterpart that accepts the contract's examples and rejects closed-object violations; no operation path or ID contains publish, post-to or share wording, R-219; no schema name, property, enum value or description of the contract or the domain schemas contains a provider identifier or provider field name such as `football`, `X-Auth`, `CL`, `2001`, `crest`, `tla`, `playedGames` or `utcDate`, R-288). T11H items: `ImportFileCreate.contentBase64` as in the contract (pattern, `maxLength` 699052, no `content` text field) with Zod tests accepting a padded base64 value and refusing a value with a line break, a URL-safe alphabet character or an over-long value (T11H-F01); `FileName` accepts an NFD name with combining marks (T11H-F20); the domain schemas' `ref` and `sourceRef` rule (prefix `source:`, `fixture:` or `import:`, no `://`) with tests refusing an `https:` URL (T11H-F14); domain schema parsing never spreads raw input objects, with tests using `__proto__` and `constructor` keys (T11H-F07).
- Acceptance criteria: R-219, R-288
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:contract` -> exit 0

### T21: Sports-data provider port, payload validation and fixture adapter
- Kind: IMPL
- Agent: backend-developer
- Depends on: T17, T20
- Files owned: `apps/server/src/providers/sports/**`
- Scope: `contracts/provider-ports.md` sections 1.1, 1.2, 1.3 and 1.5 (rewritten by T11G): the ingestion port (`IngestionSource`, `SourceRef`, `Listing`, `Availability`), `SourceError` with the closed codes including `access_refused`, `not_available` and `bad_request`, the source registry (mode, role, acceptance, independence group, official publication, publication permission; startup validation calling each enabled adapter's `validateStartup`; adapter mode must equal source mode), shared domain validation of every adapter output with the T20 schemas, the catalogue service (merge of all enabled sources, IDs `<sourceId>-<localKey>`, links, reference markers, `restrictToLinks` and `selectableStages`, availability propagation, listing provenance, `resolveSelection`, `resolveCounterpart`), the adapter registry `adapters/index.ts` registering `fixture`, `football-data` and `manual`, with stub directories `adapters/football-data/index.ts` and `adapters/manual/index.ts` that declare kind and mode and fail startup with "adapter not available" when enabled (replaced by T49 and T50), FixtureDataProvider (DEMO_DATA) with the multi-competition file format confined to `fixtures/sports/` and the `simulate` modes, and `createSportsSources`. Research and verification code never imports an adapter (R-118, R-268). Unit tests with inline synthetic payloads: player-level and person fields are dropped (R-232, R-280), malformed or incomplete data is rejected with a validation error (R-224), the fixture adapter performs no network request (R-241), swapping a source's adapter is configuration only (R-223), every adapter output passes one schema (R-267), the catalogue shows the competitions of two fixture sources and of a stub manual source together with their sources and a competition removed from a fixture file disappears without code change (R-243, R-282), a league stage with matchdays and a competition with named stages are listed by the source's names (R-283), every stage of the reference-shaped fixture competition is selectable including stages after the league-style stage (R-284), unavailable competitions and seasons carry their reason (R-286), links merge two sources and the restriction switches work. Security design review items: `SourceError` carries a closed code and sanitized parameters only, and the stored stage failure never includes a message, body, credential or path (T10-F10); team and stage names reject `\p{Cc}` and `\p{Cf}` characters (T10-F06). T11H review items (`contracts/provider-ports.md` section 1.2): the catalogue service resolves `competitionId` and `sourceId` only against the current catalogue listing and `seasonId` only against the source's seasons listing, and an unknown or no-longer-listed ID yields a not-found result without any adapter call for that ID, with a unit test using a counting stub adapter (T11H-F06); every lookup keyed by adapter, link or derived values (catalogue merge, links, counterpart resolution, stage aliases) uses `Map`, with tests using `__proto__`, `constructor`, `prototype` and `toString` as local keys, stage IDs and stage names (T11H-F07); the `createSportsSources` test seam `extraAdapters` (test-only adapter registrations, never passed by `container.ts`), with a unit test registering a stub kind (used by T41's `test-live` adapter for OD-24 and R-256).
- Acceptance criteria: R-223, R-224, R-232, R-241, R-243, R-267, R-268, R-280, R-282, R-283, R-284, R-286, R-288
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T22: AI provider port, stub adapter and OpenAI-compatible adapter
- Kind: IMPL
- Agent: backend-developer
- Depends on: T17
- Files owned: `apps/server/src/providers/ai/**`
- Scope: `contracts/provider-ports.md` section 2 and `architecture.md` section 5.3: `AiTextProvider`, `DraftRequest` and `DraftResponse` schemas, fixed versioned system instruction, data block framing, response validation; stub adapter (fixture files under `fixtures/ai/` or deterministic placeholder-only draft; records the last request); OpenAI-compatible adapter through the egress client (base URL, model identifier, temperature and timeout from configuration, key from `EDR_AI_API_KEY`, no tool calling, errors without key or body echo). Unit tests use the stub and a loopback HTTP test server only; no real provider is called. Security design review items: fixed instruction forbids person names, venues and outcomes not in the data (T10-F06); response cap 256 KiB through the egress client (T10-F07); errors mapped to closed failure codes with the HTTP status only, and a test with a loopback stub server whose error body echoes the `Authorization` header asserts that the dummy key reaches neither the returned failure nor the log output (T10-F10). T11H item (T11H-F16, V-13a): `DraftRequest` is validated with a strict schema (unknown keys rejected) before any adapter sends it, with a test that a request carrying an extra field such as `sourceRef` or `fileName` is refused.
- Acceptance criteria: R-223
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T23: Synthetic fixture scenarios
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T21, T22
- Files owned: `fixtures/**`
- Scope: synthetic, invented team and competition data only (no real results or real team names, SC-04) in the formats of `contracts/provider-ports.md` sections 1.4 to 1.6 and 2. DEMO_DATA (`fixtures/sports/`, multi-competition format of section 1.5) for sources `demo-a`, `demo-b` and, where a scenario needs a separate official source, `demo-official`, with at least two competitions using the keys fixed by T17: `liga-demo` (one stage with numbered matchdays and standings) and `copa-demo` (a 36-team league-style stage with matchdays and standings, knockout stages with names and no standings, one stage selectable as a whole); scenarios `default` (sources agree), `single-source`, `unaccepted-source`, `disputed-resolved`, `disputed-unavailable`, `disputed-no-match`, `disputed-same-source`, `player-fields`, `malformed`, `provider-unavailable`, `rate-limited`, `access-refused`, `not-available`, `accented-names` (official names with accents and special characters plus translated and abbreviated aliases), `unfinished-matches` (every provider-neutral status), `stage-no-standings`, `standings-missing`, `unmatched-team`, `too-many-slides`. Football-data-shaped responses (`fixtures/football-data/`): synthetic data in the documented v4 shape with status code, the four documented headers and body, for a reference-shaped competition configured with code `CL` and ID 2001 and a synthetic second league with an invented code `TL1`: competition list, competition detail with seasons, season match lists, matchday and stage match lists, standings with `TOTAL`, `HOME` and `AWAY` tables, responses with missing optional fields, invalid bodies (non-JSON, missing required field, wrong type, unknown status), 400, 403 with and without `X-Authenticated-Client` (when present, its value is the synthetic marker-shaped `edr-test-client-marker-0000`, T11H-F04), 404, 429 with a reset value, 500 and 503, `X-RequestsAvailable` 0, match lists containing `referees` and `crest` fields to be dropped, and an incomplete matchday with every status. Manual samples (`fixtures/manual/`): valid JSON, CSV (matches and standings layouts) and form documents for a synthetic domestic league with named stages, and one invalid sample per import error class of `contracts/provider-ports.md` section 1.6 (unparsable JSON, wrong CSV columns, missing field, wrong type, impossible value, duplicate match, finished match without score, person-level column and key, metadata conflict, oversize, too many rows, invalid UTF-8, control characters, deep nesting, line break inside a field). An equivalence set: one synthetic matchday expressed as a DEMO selection, a manual JSON, CSV and form document, and football-data-shaped responses (R-267). Test configurations (`fixtures/config/`): DEMO only; DEMO plus manual; LIVE-shaped with the football-data adapter, base URL and reference code `CL`; LIVE-shaped plus a second LIVE_DATA source of the test-only adapter kind `test-live` (T41) in the verification role, accepted, with its own independence group and linked to the reference-shaped competition (R-256; OD-24: a DEMO_DATA source never confirms LIVE_DATA facts, so no committed configuration links a DEMO_DATA source with a LIVE_DATA or MANUAL_DATA source); two invalid configurations for the OD-24 startup rules (two football-data sources with one origin in different independence groups; a link mixing a DEMO_DATA and a LIVE_DATA source); provider identifiers in tests come only from these files and `fixtures/football-data/`. Data of the `test-live` source (`fixtures/sports/live-secondary-agree/` and `fixtures/sports/live-secondary-disagree/`, in the multi-competition format of section 1.5, synthetic): the reference-shaped selection of the equivalence set with values that agree with, and that differ in one score from, the football-data-shaped responses. AI stub fixtures including a caption with an invented score, a headline with a translated team name; one AI stub fixture per content-check bypass class of T10-F05 (fullwidth and other-script digits, superscript or circled numbers, number words above 20, ordinals, multiplier words, digits split by zero-width or bidi characters, a Cyrillic homoglyph in a team name); two prompt-injection team-name fixtures with precise expectations (T10-F06): `injection-rejected` uses characters the team-name rule rejects (expected: snapshot rejected with a validation failure) and `injection-plain` uses only allowed characters (expected: snapshot accepted, the name stays inside the data block, the output checks run, and the name is shown verbatim); a unit test that validates every fixture against the T20 domain schemas, the `ManualImportDocument` schema and the T22 schemas, parses every football-data body that is meant to be JSON, and asserts that every expected-invalid sample fails.
- Acceptance criteria: R-205, R-224, R-229, R-230, R-232, R-237, R-241, R-267, R-283
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0

### T24: End-to-end and accessibility test harness
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T16, T19
- Files owned: `e2e/**`
- Scope: Playwright configuration and runner (`e2e/run.mjs`) that keeps browsers in `.cache/ms-playwright` under the worktree (never host-wide), installs Chromium on first use, starts the built server on `127.0.0.1:4310` with a generated DEMO_DATA plus MANUAL_DATA configuration from `fixtures/config/` and a temporary data directory removed afterwards; tag convention `@a11y`; smoke journey (application opens on the project list without login, R-235) and an axe smoke check of the project list page. The smoke tests assert only the shell and the project-list page heading, so that they keep passing while later modules are integrated one by one. The runner forwards neither any `EDR_*_API_KEY` variable nor `FOOTBALL_DATA_API_TOKEN` or `EDR_LIVE_TESTS` to the server or browser processes (T10-F11, AD-30).
- Acceptance criteria: R-235
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:e2e` -> exit 0 ; `npm run test:a11y` -> exit 0

### T25: Project gates, local-environment settings and contract declaration
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T15, T16, T19, T20, T24
- Files owned: `.orchestrate/config.json`
- Scope: add the project gates of `architecture-delta.md` section 7.2 with their exact commands, categories, `when`, `paths` (including `scripts/**` in PRJ-LINT and PRJ-UNIT, T11G notes of section 7.2, T10-A1-03), timeouts and reasons (after the scripts exist); no gate runs `test:live` or `probe:football-data`, and no gate environment contains `FOOTBALL_DATA_API_TOKEN` (R-135, R-258); set `localEnvironment.verificationPorts` (app 4310), `demoPorts` (app 4320) and `notes` (data directory recipe, project-local browser cache, network needs of `npm ci`, `npm audit` and the first browser download, sleep prevention for long e2e runs, LIVE_DATA optional with the token only in `.env.local` placed by the Product Owner); declare the `http-api` contract (`id` `http-api`, `kind` `http-api`, `path` `contracts/http-api.openapi.yaml`, `status` `current`, `sha256` reported by T20, no frozen snapshots) as accepted by the Orchestrator decision. No other key changes. Show the gate commands to the Product Owner before their first run (`quality-gates.md`).
- Acceptance criteria: -
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0 ; `orch gates list --work-item 'WI-1' --set final --at .` -> exit 0 and every PRJ gate listed ; `orch contracts check --at .` -> exit 0

### T26: Source of truth: exact versions, contract hash, gate and environment notes
- Kind: IMPL
- Agent: architect
- Depends on: T12, T25
- Files owned: `.orchestrate/source-of-truth.md`
- Scope: section 1 exact Node.js and dependency versions from the integrated `package-lock.json`; section 6 the declared `http-api` contract and its SHA-256 (planning.md section 3 item 5); section 7 notes for the gates configured by T25, including that live tests and the capability probe are manual and never gates; section 9 open items updated (including `architecture-delta.md` section 11.8).
- Acceptance criteria: -
- Verification: `orch validate --work-item 'WI-1' --at .` -> exit 0 ; `orch contracts check --at .` -> exit 0

### T27: Projects module and workflow runner
- Kind: IMPL
- Agent: backend-developer
- Depends on: T18, T19, T20, T21
- Files owned: `apps/server/src/modules/projects/**`, `apps/server/src/workflow/**`
- Scope: `architecture.md` sections 6 and 15.2: runner (stages from the registry in order; one active run per project; stage status, reason and skipping; interrupted runs failed at startup through the module's `onStartup` hook; run kinds `full` and `redraft`; config snapshot without secrets, including source descriptors with modes and publication permissions and the verification policy); routes of the contract: `/settings` (data modes, verification policy, sources), the catalogue routes `/catalog/competitions`, `.../sources/{sourceId}/seasons` and `.../seasons/{seasonId}/stages` through the catalogue service with availability, listing provenance, stale listings and `PROVIDER_RATE_LIMITED` with `retryAfterSeconds` (R-141, R-291), `/projects` list, create, get, patch language, runs list, start, get; `/projects/{projectId}/draft/exclusions` delegates to a redraft run. Creation resolves competition, source, season, stage and matchday (or whole stage) through the catalogue service; unknown or unavailable selections are refused with `SELECTION_UNAVAILABLE` and a `refusalReason` (R-243, R-286); every stage the source reports is selectable, including stages after a league stage, unless the configuration restricts it (R-284); the project records source, data mode, opaque selection reference and label snapshots (R-056, R-287) and reports `demonstration` for DEMO_DATA (R-269); language defaults to Spanish (R-236). Unit tests of the runner with fake stages (failure, retry by a new run, R-203) and integration tests of the routes with DEMO fixtures and a stub source (catalogue with two sources, a source added or removed, an exhausted budget). Security design review items: run and stage failures stored and returned only as the closed `Failure` object (code, source ID, validation path, HTTP status), never an exception message, provider body, credential or file path, length-capped (T10-F10); `config_snapshot` built from the parsed configuration object, never from `process.env`, with a test that a dummy key and the marker token in the environment do not appear in it (T10-F11, AD-30); GET handlers have no persistent side effects (T10-F04). T11H review item (T11H-F06, V-42): `listSeasons` and `listStages` answer 404 for a `competitionId`, `sourceId` or `seasonId` that is not in the current catalogue or seasons listing, without any provider request for that ID (integration test with a counting stub source: zero requests for an unknown ID, also through the automatic HEAD route); a discovery request beyond the source's waiting bound gets the stale listing or `PROVIDER_RATE_LIMITED` at once.
- Acceptance criteria: R-200, R-203, R-225, R-236, R-243, R-269, R-282, R-284, R-286, R-287, R-291
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T28: Projects UI: list, create, detail and run progress
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/projects/**`, `apps/web/src/api/types.ts`
- Scope: project list as the home page (history columns: title, competition, stage display and matchday, source with `DataModeBadge`, demonstration label, language, approval state, last export time); create form that assumes no single competition format (R-077): competition selector from the catalogue (reference competitions first, each entry with its sources and availability reasons), data source selector (selectable sources only, first available preselected, OD-16), season selector loaded on source choice, stage selector listing stages by the source's names with their matchday numbers or a whole-stage choice and a note when standings are not expected, listing provenance (retrieved at, cached, stale) and the rate-limit wait message (R-291), unavailable competitions and seasons shown with their reason (R-286), language selector defaulting to Spanish; submit disabled until competition, source, season and stage (and a matchday when the stage is not selectable as a whole) are chosen (R-243); project detail (competition, source and mode, season, stage and matchday, demonstration banner, language change, start run, per-stage status with failure reason and restart, links to facts, review, exports and, for MANUAL_DATA, the import page) polling the run while active; accessible names, labels and keyboard use. Component tests with a mocked API client, including a stage-based competition, a stage without standings, an unavailable competition and an exhausted budget.
- Acceptance criteria: R-200, R-203, R-235, R-236, R-243, R-269, R-283, R-284, R-286, R-291
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T29: Research stage
- Kind: IMPL
- Agent: backend-developer
- Depends on: T21, T27
- Files owned: `apps/server/src/modules/research/**`
- Scope: research stage per `module-kit.ts` through the source registry only (no adapter import and no branch on mode, provider or competition, R-268): `fetchSelection` of the project's source with its opaque selection reference; one `retrievals` row per resource with source, mode, time, cache use, outcome and closed failure (AD-34); observations for every match, team, standings row and context item with source, mode, import version, reference and retrieval time (R-024, R-287); standings unavailability recorded on the run with its reason, nothing derived (R-254); provider failures mapped to stage failures with the closed codes (`access_refused` shown as "provider access refused", `not_available`, `rate_limited`, `unavailable`, `timeout`, `invalid`, `no_data`, `bad_request`); never store a stripped field. Unit tests of the pure core with inline fixture inputs in isolation (R-225), including a selection without standings and a MANUAL_DATA selection with an import version.
- Acceptance criteria: R-202, R-204, R-224, R-225, R-232, R-254, R-268, R-287
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T30: Verification stage: two-source rule, disputes, team identity
- Kind: IMPL
- Agent: backend-developer
- Depends on: T21, T27
- Files owned: `apps/server/src/modules/verification/**`, `config/team-identities/**`
- Scope: `architecture.md` section 7 (revised by T11G): retrieval from the verification and official-publication sources through `catalogue.resolveCounterpart`; team identity matching with optional identity maps (synthetic maps for the fixture seasons), canonical slug team IDs and placeholder slugs for unmatched source keys (T10-A1-06); official names from the official-publication source; the decision rule of section 7.3 for every fact kind (OD-10) with statuses, unverified reasons and candidate values (OD-17); dispute records and official-publication consultation; aliases including source short names; left-out matches with every provider-neutral status (OD-05); manual eligibility, carry-over of manual approvals for unchanged facts only (section 7.4; R-068, R-278); the publishability function with the configured policies, exported from `index.ts` for content and review (section 7.4 as amended by `architecture-delta.md` AD-38: a `manually_approved` fact is publishable only under `allowed_without_accepted_source` for a project whose competition is a link marked `noAcceptedPublicSource` and whose source that link binds, PD-17; a verified fact with a LIVE_DATA supporting observation only when every supporting LIVE_DATA source is `confirmed`, PD-18); pinned team names for projects of a marked competition (AD-38 item 4, T11H-F17): team identity uses only the competition's identity map for the season, without the name-matching fallback, so an unpinned or changed name is `team_identity_unmatched` and not eligible for manual approval, and every team fact is unmatched when no map exists; facts route `/projects/{projectId}/runs/{runId}/facts` (statuses, reasons, candidate values, evidence with mode and import version, standings availability) and the manual approval routes (approve and revoke; `MANUAL_APPROVAL_REFUSED` with `refusalReason`; guard and write in one `BEGIN IMMEDIATE` transaction; audit rows). No operation sets a fact to verified (R-412). Unit tests of the decision rule in isolation, one per row of section 7.3 (R-205, R-227, R-229, R-230), plus: a single accepted source gives `awaiting_independent_verification` (R-055, R-271); a LIVE_DATA primary observation against a disagreeing LIVE_DATA verification observation of another independence group gives disputed, and an agreeing one gives verified citing both (R-256); MANUAL_DATA facts are unverified and then manually approved, exactly one status per fact (R-270); refusals for LIVE_DATA, DEMO_DATA, disputed and contradicted facts (R-272); carry-over only for unchanged facts (R-278); publishability under each accepted policy value: a MANUALLY_APPROVED fact of a marked competition publishable, of an unlinked or unmarked manual competition blocked with `manually_approved_not_publishable`, and blocked under `blocked`; a verified fact with an `unconfirmed` LIVE_DATA supporting source blocked with `publication_permission_unconfirmed` (PD-17, PD-18); pinned names: a pinned name matched, an unpinned name, a name changed by a reimport and a missing map each giving `team_identity_unmatched` and a refused manual approval (AD-38). T11H review items: source independence (OD-24, T11H-F13; `architecture.md` section 7.3): DEMO_DATA observations count only for facts of DEMO_DATA projects; for a LIVE_DATA or MANUAL_DATA project an agreeing DEMO_DATA observation leaves the fact `awaiting_independent_verification` (or `no_accepted_source`), a disagreeing one does not make it disputed, and neither appears as `supports` evidence (at most `consulted`); two sources of one independence group count once (unit tests for each); identity maps, team lookups and grouping use `Map`, with tests using `__proto__`, `constructor`, `prototype` and `toString` as team keys and team names (T11H-F07).
- Acceptance criteria: R-205, R-225, R-227, R-229, R-230, R-237, R-256, R-270, R-271, R-272, R-278
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T31: Facts and verification UI
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/facts/**`
- Scope: facts view of a run: each fact with its status (VERIFIED; UNVERIFIED with its reason: awaiting independent verification, disputed, no accepted source, team identity unmatched; MANUALLY_APPROVED, labelled operator-attested and never styled or worded as verified), value or candidate value (marked unverified), evidence per source (source name, data mode, role, accepted, reference, retrieval time, import version link) and dispute record (values per source, consultation, outcome); standings availability note; left-out matches with status; demonstration banner for DEMO_DATA (R-269); manual approval and revoke controls shown only for eligible facts, with refusal reasons (R-272); no control that sets a fact to verified (R-412). Provider `sourceRef` and `ref` values are rendered with the shared `SafeReference` component only: as plain text, never as a link (T10-F16, T11H-F14). Component tests, including hostile reference values (`javascript:`, `data:`, `https:`) rendered with no anchor, each status and reason, and eligible and ineligible facts.
- Acceptance criteria: R-204, R-205, R-230, R-269, R-270, R-272, R-287
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T32: Content stage: structure, AI drafting, fact placeholders, content checks
- Kind: IMPL
- Agent: backend-developer
- Depends on: T22, T27
- Files owned: `apps/server/src/modules/content/**`
- Scope: `architecture.md` section 8 (revised by T11G): deterministic carousel structure (cover with competition name, stage display and season label; one match slide per included finished match whose facts are verified or have a candidate value; standings slides only when the run's standings are available, any number of rows split by `standingsRowsPerSlide`; closing; split by `maxSlidesPerCarousel`; exclusions; `standingsIncluded` recorded; no competition-specific assumption such as a fixed table size or a league-phase wording), left-out matches with every non-finished status including `suspended`, `cancelled` and `awarded` (R-255), draft request with placeholders and validated display values only (no player-level or person data, no provider text beyond validated names), deterministic substitution, `fact`, `commentary` and `template_text` provenance segments, hashtags, content checks and flags of section 8.3, the blocked overlay from the verification module's publishability function, fact references, persistence of drafts, carousels, elements and versions; regeneration entry point for one element (used by T37). Unit tests in isolation with the stub provider: invented score flagged, translated team name flagged, language passed to the provider (es default and en), structure completeness, no standings slide for a selection without standings and nothing derived (R-254, R-285), single-source candidate content drafted and blocked (R-271). Security design review items: content-check hardening of `architecture.md` section 8.3 (reject `\p{Cc}` and `\p{Cf}` before every check; NFKC-normalized copy; any `\p{N}` character; cardinal words to at least 100, ordinals and multiplier words in es and en; mixed-script tokens), with one test per T23 bypass fixture (T10-F05); fixed instruction against person names, venues and outcomes not in the data, and the result relation of each match given as a deterministic display phrase in the data block and stated by fixed template text (T10-F06); test of both T23 injection fixtures as specified there. T11H review item (T11H-F16, V-13a): the draft request built for a MANUAL_DATA project and for a LIVE-shaped project contains no `sourceRef` or `ref` value, no import `declaredSource` or `fileName` and no data mode (unit test with marker values in those fields asserting their absence from the recorded stub request).
- Acceptance criteria: R-207, R-208, R-209, R-225, R-232, R-236, R-237, R-254, R-255, R-271, R-285
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
- Scope: `architecture.md` section 9 (revised by T11G): OFL fonts with licence files (provisional, OD-07); versioned templates cover, match-result (two empty badge slots), standings (any number of rows given to it, "as of" text), closing, none assuming a competition, a table size, a stage name or the presence of standings; brand palette roles only; brand logo and mascot slots rendered only when an active asset exists; team, competition and stage names as text; the demonstration band on every slide of a DEMO_DATA project (OD-21, AD-33); text layout with measurement and overflow flags; render model; Satori and resvg rendering to PNG at the configured size; template registry and preview routes. Unit tests: identical numeric text and identical PNG hash for two renders of the same input (R-213), exact official names, 1080 x 1350 output (R-238), complete slides with no assets and empty badge slots (R-212, R-231), shared layout and palette across two selections and a template version change applying to later carousels (R-211), a complete carousel without standings slides (R-285), the demonstration band present on DEMO_DATA slides and absent otherwise (R-269). Security design review items: render inputs as data only (T10-F09): image slots receive only `data:` URIs built from stored asset bytes, no `loadAdditionalAsset`, resvg with `font.loadSystemFonts: false`, `fontFiles` from `assets/fonts/` only and no resources directory; a test rendering text with `<`, `>`, `&`, `"`, `]]>` and `</text><image href=...>` asserts a valid PNG and a well-formed SVG with no added element; a test that rendering opens no socket (network guard); renders created with the exclusive flag under a realpath-checked data directory from validated UUIDs (T10-F13); template previews cached by template version, active brand-asset hashes and language (T10-F04).
- Acceptance criteria: R-211, R-212, R-213, R-225, R-231, R-238, R-269, R-285
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T35: Visual QA stage
- Kind: IMPL
- Agent: backend-developer
- Depends on: T30, T34
- Files owned: `apps/server/src/modules/visual-qa/**`
- Scope: `architecture.md` section 10 (revised by T11G): the five checks with severities of OD-09, results per slide version and check, `qa_status`; facts and official names re-read from the database, `data_match` against the display form of the verified value or of the candidate value when unverified, text fit re-measured, PNG size read from the file header; the demonstration band is template text and is excluded from the team-name check. Unit tests: a slide seeded with each defect fails that check by name and a correct slide passes all (R-214); translated or abbreviated team name fails `team_names` (R-237); any size other than the configured one fails `dimensions` (R-238); a carousel without standings slides passes every check (R-285).
- Acceptance criteria: R-214, R-225, R-237, R-238, R-285
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
- Scope: `architecture.md` section 11.1 and 11.2 (final approval part): active draft route, slide image route, element approval and withdrawal bound to the exact version with every guard and problem code of the contract (blocked facts named, flags, QA failures, unacknowledged warnings, version conflict), QA acknowledgement, regeneration of one element through content, rendering and visual QA (other elements unchanged), final approval with version set hash and invalidation on any change. T11G: every guard uses the verification module's publishability function (`architecture.md` section 7.4): `APPROVAL_BLOCKED` lists the facts with status, unverified reason and block reason; single-source LIVE_DATA facts are refused (R-271); MANUALLY_APPROVED facts are accepted only for a competition configured as having no accepted public source (a link marked `noAcceptedPublicSource` under the default policy `allowed_without_accepted_source`) and refused otherwise (PD-17, AD-38; R-272); verified LIVE_DATA facts whose source has `unconfirmed` publication permission are refused (PD-18; the committed football-data configuration stays `unconfirmed` until the Product Owner records the provider's written permission); a revoked manual approval, a stricter policy or a link no longer marked blocks the content again and invalidates affected final approvals. Unit tests of the state machine, including seeded facts for each block reason, each accepted policy value, a marked and an unmarked competition and a `confirmed` and an `unconfirmed` LIVE_DATA source, and integration tests of the routes. Security design review item (T10-F15): every guard check and its write (approval, withdrawal, acknowledgement, final approval, supersession on regeneration) run in one synchronous `BEGIN IMMEDIATE` transaction with no `await` inside; integration test: approving a version while a regeneration supersedes it returns `VERSION_CONFLICT`, and a final approval racing a regeneration never records a stale set.
- Acceptance criteria: R-206, R-207, R-216, R-217, R-240, R-271, R-272
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T38: Export, history and traceability module
- Kind: IMPL
- Agent: backend-developer
- Depends on: T37
- Files owned: `apps/server/src/modules/export/**`
- Scope: `architecture.md` section 11.2: export only with a valid final approval; files `01.png` to `NN.png` in order at the configured size, `caption.txt` (UTF-8 caption and hashtags), `manifest.json` with element versions, hashes, fact IDs and, new in T11G, the data mode, the `demonstration` flag and the source IDs and names (R-269, R-287), and (attempt 3, PD-17, AD-38 item 5) each used fact with its status and `operatorAttested: true` when any fact of the exported version set is MANUALLY_APPROVED, never stating such a fact as verified; the export record's data mode; paths from IDs under the data directory only; no egress client and no publication function; export list and detail routes (exact exported versions); slide trace route (facts, statuses and reasons, evidence with source, mode, retrieval and import version, manual approvals, disputes; R-221, R-287). Unit and integration tests: refusal without final approval, file set and order, reopened export equals exported content, trace content including source and mode, DEMO_DATA manifest flag, `operatorAttested` and per-fact statuses for an export of a marked manual competition with MANUALLY_APPROVED facts and their absence otherwise, no network call during export. Security design review items: the export reads the version set from the final-approval row, writes exactly those versions into a fresh directory, then in one `BEGIN IMMEDIATE` transaction re-checks `invalidated_at IS NULL` and records the export; a failed commit leaves an unreferenced orphan directory (T10-F15); integration test: export after invalidation returns `FINAL_APPROVAL_REQUIRED`; files created with the exclusive flag, realpath containment, UUID validation before path building (T10-F13); the module imports no network API (lint rule, T10-F08).
- Acceptance criteria: R-216, R-218, R-219, R-220, R-221, R-240, R-269, R-287
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T39: Review UI: preview, per-item approval, regeneration, final approval
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/review/**`
- Scope: review page of the active draft: carousel preview with all slides in order plus caption and hashtags (R-215); demonstration banner for DEMO_DATA (R-269); per text segment a provenance label showing the fact's current status (verified fact, UNVERIFIED, MANUALLY_APPROVED) or commentary or template text, never labelling an unverified or manually approved value as verified (OD-01, R-208, R-071); per element state, blocked facts with names and block reasons in clear text (awaiting independent verification, manual approval not publishable under the current policy, publication permission not confirmed; R-271, R-272), content flags, QA results, acknowledge warnings, approve, withdraw, regenerate; final approval control enabled only when the carousel is ready and refusal messages shown otherwise; left-out matches with status; a carousel without standings shown without a gap; exclusions editor starting a redraft. Component tests.
- Acceptance criteria: R-206, R-208, R-215, R-217, R-240, R-269, R-271, R-272
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T40: Export, history and traceability UI
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/history/**`
- Scope: export action for a final-approved carousel with the resulting file list and folder path; project exports list with export time and the demonstration label (R-269); export detail showing the exact exported slides and caption; per exported slide a trace view (facts, status and reason, evidence with source name, data mode, retrieval time and import version, manual approval, dispute record; R-287). Evidence references are rendered with the shared `SafeReference` component only (plain text, never a link; T10-F16, T11H-F14). Component tests, including hostile reference values rendered with no anchor.
- Acceptance criteria: R-218, R-220, R-221, R-269, R-287
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T41: Integration tests: platform, research and verification
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T19, T22, T23, T29, T30
- Files owned: `apps/server/test/support/**`, `apps/server/test/integration/platform/**`, `apps/server/test/integration/verification/**`, `scripts/security-checks.mjs`, `scripts/security-checks.test.mjs`
- Scope: shared test support (temporary data directory, generated configuration per scenario from `fixtures/config/`, app factory accepting an `EgressClient` override for a replay transport over `fixtures/football-data/`, environment without `FOOTBALL_DATA_API_TOKEN`, network guard assertion, captured logger); platform tests: loopback-only listener and refused non-loopback connection (R-234), Host and origin protections, no login or account route (R-235), provider swap by configuration only with the full workflow running end to end (R-223), no request to a real provider in fixture mode (R-241, R-222), `X-Auth-Token` redaction in request logs; research and verification tests on the T23 DEMO_DATA scenarios (league and stage-based competitions) through the HTTP API: fixture values reproduced (R-202), stage failure and restart (R-203), attribution (R-204), disputes and resolution outcomes (R-205, R-230), acceptance and agreement rules (R-227, R-229), malformed data rejected (R-224), player-level fields absent from stored results and from the draft request (R-232); each stage exercised in isolation through the stage kit (R-225). Security design review items: platform tests of the development origin set (5173 Host and Origin accepted only with the development configuration, refused with the production one) (T10-F02); Fetch-Metadata refusal of `cross-site` and `same-site` `/api` requests, `Origin: null` refused, deny-by-default for PUT, PATCH, DELETE and unknown methods without the custom header, no `Access-Control-*` header on any response including OPTIONS, CORP, COOP and the CSP directives including `connect-src 'self'` present (T10-F04, R-262); a wrong-key run with the echoing AI stub server stores and returns no key (T10-F10). Security check script `scripts/security-checks.mjs` (no new dependency; each subcommand exits 0 when the control holds, 1 otherwise, and prints what it checked, never a secret value): `secret-scan` (tracked files, via `git ls-files`: non-empty `EDR_*_API_KEY=` and `FOOTBALL_DATA_API_TOKEN=` assignments, common provider key prefixes, private-key headers, the shared dummy test key and the synthetic marker token outside test and fixture files, tracked `.env*` other than `.env.example`; R-260, R-261), `bundle-secrets` (built `apps/web/dist` contains neither the dummy test key nor the marker token nor any `EDR_` or `FOOTBALL_DATA` assignment nor the provider host; R-262), `lockfile` (every `resolved` URL on `https://registry.npmjs.org/`, every entry has `integrity`, `.npmrc` has no auth token or alternate registry), `audit-report` (runs `npm audit --json`, prints every advisory of any severity with package and severity for T47's review, exits 1 if any advisory is high or critical or names fastify, @fastify/static, zod, satori, @resvg/resvg-js, vite, react or react-dom) (T10-F01, T10-F18, T10-F02), new `hygiene` (exits 1 on any tracked file under `.env*` other than `.env.example`, `data/` or `.cache/`, if any of `.env.local`, `data/`, `.cache/` is not ignored, or if `.env.example` does not list `FOOTBALL_DATA_API_TOKEN` with an empty value; T10-A1-02, R-261, R-264, R-265), new `marker-scan [--require-token] <paths...>` (paths are files or directories; exits 1 if any scanned file contains the synthetic marker token or the marker-shaped client value `edr-test-client-marker-0000` or, when `FOOTBALL_DATA_API_TOKEN` is set and non-empty in the environment, its value; prints PASS or FAIL, the number of files scanned and the line `real token checked: yes` or `real token checked: no`, never a value; with `--require-token` it exits 1 when `FOOTBALL_DATA_API_TOKEN` is absent or empty, before scanning; R-263, T11H-F02). `scripts/security-checks.test.mjs`: positive-control tests (T10-A1-03) with temporary git repositories holding a planted marker, a non-empty token assignment, a tracked `.env.local` and an unignored `data/` file, each expecting exit 1, and a clean repository expecting exit 0; for `marker-scan` (T11H-F02, V-34): a planted synthetic "real" value in a scanned file and in a scanned single file path with that value in the child process environment expects exit 1 and `real token checked: yes`; a clean directory with the value set expects exit 0 and `real token checked: yes`; without the variable expects `real token checked: no`; `--require-token` without the variable or with an empty value expects exit 1; the printed output never contains the planted value. Test support also provides the test-only adapter kind `test-live` (declared mode LIVE_DATA; reads the multi-competition files of `fixtures/sports/<scenario>/<sourceId>.json` like the fixture adapter, no network) registered through the `createSportsSources` test seam `extraAdapters` and never by `container.ts`; it fills the secondary LIVE_DATA verification role for R-256 and the OD-24 tests (T52).
- Acceptance criteria: R-202, R-203, R-204, R-205, R-222, R-223, R-224, R-225, R-227, R-229, R-230, R-232, R-234, R-241, R-260, R-261, R-262, R-264, R-265
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:integration` -> exit 0 ; `npm run test:unit -- scripts` -> exit 0 ; `node scripts/security-checks.mjs secret-scan` -> exit 0 ; `node scripts/security-checks.mjs lockfile` -> exit 0 ; `node scripts/security-checks.mjs hygiene` -> exit 0 ; `node scripts/security-checks.mjs marker-scan docs/work-items/WI-1/evidence` -> exit 0, prints `real token checked: no` (no token in the task worktree) ; `node scripts/security-checks.mjs marker-scan --require-token docs/work-items/WI-1/evidence` -> exit 1 (expected: no token in the task worktree)

### T42: Integration tests: content, rendering, visual QA, approval, export, history
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T32, T33, T34, T35, T37, T38, T41
- Files owned: `apps/server/test/integration/delivery/**`
- Scope: API-level tests on DEMO_DATA fixture scenarios of both fixture competitions for the active acceptance criteria R-206 to R-221 (R-285 replacing R-210), R-228, R-231, R-232, R-236 to R-238, R-240, R-254, R-255, R-269 and R-271 as worded in `requirements.md` section 7, including: blocked approval naming the fact while unaffected content stays approvable; invented-number and non-official-name flags; provenance labels in stored content; structure and split; a carousel without standings for a knockout stage passing visual QA and the same approval and export rules (R-285); missing standings never derived (R-254); incomplete matchdays with every status left out of result slides (R-255); single-source content (verification source disabled) drafted and its approval refused naming the fact (R-271); template consistency and template change; no-asset carousel; deterministic numeric text; each seeded QA defect; export refusal and success; demonstration band and manifest flag (R-269); regeneration scope; export files; no publication path and no network during export; history and reopen; traceability; brand asset reuse across projects; Spanish default and English project; 1080 x 1350; final approval refusal and success.
- Acceptance criteria: R-206, R-207, R-208, R-209, R-211, R-212, R-213, R-214, R-216, R-217, R-218, R-219, R-220, R-221, R-228, R-231, R-232, R-236, R-237, R-238, R-240, R-254, R-255, R-269, R-271, R-285
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:integration` -> exit 0

### T43: Contract conformance tests
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T20, T38, T41, T50
- Files owned: `apps/server/test/contract/**`
- Scope: every operation of `contracts/http-api.openapi.yaml` exercised against the running app (Fastify `inject`) on fixture data, including the T11G operations (catalogue seasons and stages, manual approval and revocation, imports, originals and versions); responses validated against the contract schemas (status codes, problem+json shape and codes including `importErrors`, `retryAfterSeconds` and `refusalReason`, required and nullable fields, closed objects); every server route is in the contract and every contract operation is served; invalid inputs return `VALIDATION_FAILED` (R-224); no publication operation (R-219); no response, schema or contract text carries a provider identifier or provider field name (R-288). Security design review items (T10-F03, T10-F17, V-29, T10-A1-01): every ID parameter rejects non-UUID or non-slug values (including `..%2F..`, absolute paths and over-long strings) before any handler logic; `label`, names and file names with control or format characters are rejected; the 403 (including on GET operations through Fetch-Metadata), 421, 413 and 415 problem responses are exercised on the operations that declare them; response conformance relies on the closed per-kind fact values and per-check QA details; the promoted contract equals the accepted proposal except `info.version`. T11H review items: `createImport` with `contentBase64` (a valid CSV with a BOM and CRLF applied, and `getImport`'s `originalSha256` equals the SHA-256 of the sent bytes; malformed base64, a value over 699052 characters and a request with a text `content` field refused) (T11H-F01); `getImportOriginal` returns exactly the sent bytes with `Content-Disposition: attachment` and the server-generated ASCII file name `original-<importId>.csv` even when the stored file name is non-ASCII or NFD, plus `application/octet-stream`, `nosniff`, the sandbox CSP and CORP (T11H-F11, V-49); `listSeasons` and `listStages` answer 404 for unknown IDs (T11H-F06); no `sourceRef` or `ref` in any response is a URL or contains a provider host (T11H-F14, R-288).
- Acceptance criteria: R-219, R-224, R-288
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:contract` -> exit 0

### T44: End-to-end and accessibility journeys
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T23, T24, T28, T29, T31, T36, T38, T39, T40, T50, T51
- Files owned: `e2e/tests/**`
- Scope: browser journeys on the built app with DEMO_DATA and MANUAL_DATA: the catalogue shows both fixture competitions and the manual source; create a project for a league matchday and one for a knockout stage (stages listed by the source's names, "standings not available" shown, carousel without a standings slide) and see them in the list with source, mode and demonstration label (R-243, R-269, R-283, R-284); run research and follow stage progress including a simulated failure and restart; review facts; preview the carousel with caption and hashtags; see a blocked approval naming the fact; approve items, final approval, export and see the files listed; history and reopen; trace an exported slide; manual import journey: upload a CSV with errors and see every error by row and field, upload the corrected file, enter a selection through the form, see the versions, create a project for the manual competition, run it, see UNVERIFIED facts, manually approve eligible facts and see that the content stays blocked with the reason "manual approval not publishable", because the imported competition is not configured as having no accepted public source (PD-17; the e2e configuration marks no link) (R-272, R-276); register a brand asset and see no badge option; axe checks (`@a11y`) on every page, including the import pages, with no serious or critical violation. Together with T52 this covers the multi-competition demonstration path (R-290).
- Acceptance criteria: R-200, R-203, R-206, R-215, R-216, R-218, R-220, R-221, R-231, R-235, R-236, R-243, R-269, R-272, R-276, R-283, R-284, R-290
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:e2e` -> exit 0 ; `npm run test:a11y` -> exit 0

### T45: Architecture conformance review
- Kind: IMPL
- Agent: architect
- Depends on: T14, T26, T42, T43, T44, T52
- Files owned: `docs/work-items/WI-1/architecture/conformance-review.md`
- Scope: review of the integrated code and configuration against this architecture: competition, target format (dimensions, maximum slides) and publication mode are configuration or data, not stage logic (R-226); the schema and code hold no player or person entity or attribute and no user-account entity (R-233); one ingestion interface and no provider-specific, mode-specific or competition-specific branch in research, verification or later stages (R-268); the shared domain schemas and the contract are provider-neutral (R-288); the provider-identifier lint rule is present, its seeded test passes, its exemptions are limited to adapters and the probe script, and no inline disable directive exists in core code (`noInlineConfig`, T11H-F15) (R-289, R-139); the provider research and findings record cover pricing, coverage, reliability, redistribution and licensing, rate limits, freshness and attribution per candidate, development and tests need no purchased service, and nothing was purchased, subscribed to or upgraded (R-242, R-281); R-103, R-109 and R-137 (no provider-specific feature beyond the capability); deviations listed as findings with the owning task.
- Acceptance criteria: R-226, R-233, R-242, R-268, R-281, R-288, R-289
- Verification: `orch scan models docs/work-items/WI-1/architecture/conformance-review.md` -> exit 0 ; `orch validate --work-item 'WI-1' --at .` -> exit 0

### T46: Security evidence pack
- Kind: VERIFY
- Agent: qa-engineer
- Depends on: T45
- Files owned: `docs/work-items/WI-1/evidence/T46-*.txt`
- Scope: at a committed, clean integration HEAD in the verify worktree, with neither `FOOTBALL_DATA_API_TOKEN` nor `EDR_LIVE_TESTS` in the environment, run exactly these commands, in this order, and record each output verbatim with `orch evidence write` (names in brackets; controls of `docs/work-items/WI-1/security/design-review.md` section 9, of `docs/work-items/WI-1/security/design-review-change-1.md` section 10 (V-31 to V-55) and of `architecture-delta.md` sections 11.4 and 11.12 they evidence in parentheses; extended for T10-F01, T10-F18, T11G and T11H):
  1. `npm ci` [install] (NV-6, V-28).
  2. `npm run test:integration -- apps/server/test/integration/platform` [platform-security: loopback binding, refused non-loopback connection, Host and origin allow-lists including the development set, Fetch-Metadata, headers including `connect-src 'self'`, no CORS, no login, provider swap, no real provider request, echoing-key test, `X-Auth-Token` redaction] (V-01 to V-05, V-08, V-10, V-26).
  3. `npm run test:integration -- apps/server/test/integration/delivery` [delivery-security: export confinement, no publication, no network during export, content flags, publishability refusals] (V-14, V-20).
  4. `npm run test:unit -- apps/server/src/modules/content apps/server/src/providers` [content-safety: prompt framing, placeholder enforcement, Unicode and number-word checks, response validation, payload allow-lists, team-name rules, injection fixtures, AI error mapping] (V-09, V-13 to V-15, V-26).
  5. `npm run test:unit -- apps/server/src/platform` [platform-unit: configuration schema (loopback-only host, explicit allow-lists, secret-like key rejection, data-mode rules, OD-24 independence and mixed-link rules), egress client (exact origin, HTTPS only, redirect error, total deadline, decoded-byte cap, TLS), HTTP guards and headers, logger redaction including `x-auth-token`, token removed from `process.env`, no request body logged, prototype-poisoning options] (V-02, V-03, V-05, V-11, V-24, V-25; V-31, V-33, V-41, V-46, V-52; NV-9).
  6. `npm run test:unit -- apps/server/src/modules/brand apps/server/src/modules/rendering apps/server/src/modules/export apps/server/src/modules/review` [files-render-approval-unit: upload signature, type match, size and dimension caps, SVG refusal; rendering data-URI-only inputs, no system fonts, markup escaping, no socket; export and render confinement; approval guards and publishability] (V-17 to V-21).
  7. `npm run test:integration -- apps/server/src/modules apps/server/src/platform` [module-integration: module and platform `*.int.test.ts` including upload, approval races, manual approval atomicity, import application and export after invalidation] (V-17, V-19 to V-21).
  8. `npm run test:unit -- apps/web` [web-security-unit: Vite development-mode settings, references rendered as text only, status labels never showing manual approval as verified, import upload sending the exact file bytes as base64 and NFC file names, download link with the `download` attribute] (V-07, V-16, V-27; V-35, V-50, V-53; NV-11).
  9. `npm run lint` [lint: network-API bans outside `platform/net` and in `modules/export` and `modules/imports`, `dangerouslySetInnerHTML` ban, SQL template-literal ban, provider-identifier rule] (V-12, V-16, V-22; R-289).
  10. `node scripts/security-checks.mjs secret-scan` [secret-scan: tracked files, including non-empty `FOOTBALL_DATA_API_TOKEN=` assignments and the synthetic marker outside test and fixture files; expected no match] (V-23; R-260, R-261).
  11. `npm run build` [build] then `node scripts/security-checks.mjs bundle-secrets` [bundle-secrets: built UI bundle contains no dummy test key, no marker token, no key or token assignment and no provider host] (V-27; R-262).
  12. `node scripts/security-checks.mjs lockfile` [lockfile: registry and integrity of every lock entry, `.npmrc` without token or alternate registry] (V-23, V-28).
  13. `npm ls fastify @fastify/static zod satori @resvg/resvg-js vite react react-dom` [versions] (V-07, V-28, NV-1).
  14. `npm audit --audit-level=high` [audit] (V-28).
  15. `node scripts/security-checks.mjs audit-report` [audit-full: every advisory of any severity listed for T47's review of moderate advisories; fails on high or critical, or on any advisory for the security-relevant packages, Vite included] (V-07, V-28, NV-1).
  16. `npm audit signatures` [registry-signatures] (V-28); evidence files take only PASS or FAIL, so when the registry does not support signatures no evidence file is written and the report states NOT RUN with the reason (never PASS).
  17. `git ls-files -- .env .env.local data .cache` [repo-hygiene: expected empty output] (V-23).
  18. `git check-ignore .env.local data/ .cache/` [ignore-rules] (V-23).
  19. `npm run test:unit -- apps/server/src/providers/sports apps/server/scripts apps/server/src/modules/imports apps/server/src/modules/verification` [ingestion-unit: football-data error classification, no retry of 400, 401, 403 and 404, bounded retries, 429 wait, budget never exceeded in any 60-second window, cache holding validated projections only (no raw payload, header, error, token or person field), person and badge fields dropped, token only in the `X-Auth-Token` header and only for the pinned origin, fail-closed startup with fixed texts and without the value; `X-Authenticated-Client` used as a boolean and its value never logged or cached; rate-limit header bounds; research priority, discovery share, single-flight and bounded waiters; `Map` lookups with prototype-named keys; references never URLs; the probe's failure paths printing no marker (stdout, stderr, findings); CSV and JSON limits, strict base64 and UTF-8 decoding (BOM, invalid UTF-8, overlong, encoded surrogates), original bytes and hash, depth, duplicate keys, team-key collisions and empty keys, form-size check before write, control characters, person-field rejection, errors without values, duplicates, whole-import rejection, the SC-05 adversarial corpus and the linear-time test; manual eligibility and statuses; OD-24 counting rules] (T11G controls; V-31 to V-34, V-36 to V-41, V-43 to V-48, V-50, V-52; NV-12; R-249, R-252, R-260, R-263, R-266, R-280).
  20. `npm run test:integration -- apps/server/test/integration/ingestion` [ingestion-security: marker token and marker-shaped client value never in API responses, problem details, stored rows or captured logs; LIVE_DATA startup fail-closed; OD-24 startup refusals and DEMO_DATA never confirming LIVE_DATA facts; R-256 with the `test-live` secondary source; catalogue budget, unknown IDs answered 404 without a provider request, and stale listings; manual import end to end with originals byte-identical; no URL in any reference; default suite on DEMO_DATA with no provider request] (T11G controls; V-33, V-35, V-39, V-42, V-46, V-48, V-52; R-256, R-257, R-262, R-263, R-280).
  21. `npm run test:unit -- apps/server/test/static` [static-identifiers: seeded violations fail, exempt adapter path and delivered tree pass] (R-289).
  22. `node scripts/security-checks.mjs hygiene` [hygiene: no tracked `.env*` other than `.env.example`, `data/` or `.cache/`; `.env.local`, `data/`, `.cache/` ignored; `.env.example` lists `FOOTBALL_DATA_API_TOKEN` with an empty value] (V-23, T10-A1-02; R-261, R-264, R-265).
  23. `node scripts/security-checks.mjs marker-scan docs/work-items/WI-1/evidence docs/work-items/WI-1/research apps/web/dist` [marker-scan: no evidence, research or bundle file contains the marker token or the marker-shaped client value; expected output includes `real token checked: no`, because the verify environment holds no token; the real-token evidence is T53's recorded `--require-token` output `docs/work-items/WI-1/evidence/T53-marker-scan-real.txt`, or the findings file's "probe not run" statement] (R-263; V-34, V-36).
  24. `npm run test:live` [live-skipped: exit 0 with every live test skipped and no request made] (R-258).
  25. `npm run test:unit -- scripts` [security-scripts-unit: positive controls of `secret-scan`, `hygiene` and `marker-scan`, including `--require-token` exiting 1 without the token, the `real token checked` line, single-file paths, and no planted value in the output] (V-34; T11H-F02).
  26. `npm run test:contract` [contract: every operation exercised; `contentBase64` imports and byte-identical originals; `getImportOriginal` headers with the server-generated file name; 404 for unknown catalogue IDs; no URL or provider identifier in any response; 403, 413 and 415 on the mutating operations] (V-43, V-48, V-49, V-55; R-219, R-288).
  The real-token run is not part of this pack: T53's recorded output is cited, never re-run. `package.json` and `docs/local-setup.md` (no diagnostic-report flags, V-33; no new parser dependency, V-54) are read by T47 from the validated HEAD.
  A missing or failing command is recorded, never omitted.
- Acceptance criteria: R-219, R-234, R-235, R-241, R-257, R-258, R-261, R-262, R-263, R-264, R-265, R-280
- Verification: `orch evidence check docs/work-items/WI-1/evidence/T46-install.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-platform-security.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-delivery-security.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-content-safety.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-platform-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-files-render-approval-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-module-integration.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-web-security-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-lint.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-secret-scan.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-build.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-bundle-secrets.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-lockfile.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-versions.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-audit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-audit-full.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-repo-hygiene.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-ignore-rules.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-ingestion-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-ingestion-security.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-static-identifiers.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-hygiene.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-marker-scan.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-live-skipped.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-security-scripts-unit.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS ; `orch evidence check docs/work-items/WI-1/evidence/T46-contract.txt --work-item 'WI-1' --task 'T46' --at .` -> exit 0, header RESULT: PASS

### T47: Security delta validation
- Kind: VERIFY
- Agent: security-reviewer
- Depends on: T46
- Files owned: `docs/work-items/WI-1/evidence/T47-security-validation.txt`, `docs/work-items/WI-1/security/T47-security-validation.md`
- Scope: delta validation of the implemented system against the security delta of `architecture-delta.md` sections 4 and 11.4, the T10 design review and the T11H review addendum, using the code and the T46 evidence pack: every control V-01 to V-29 of `docs/work-items/WI-1/security/design-review.md` section 9 (TB-1 local service including development mode, TB-2 and TB-3 providers and AI, TB-4 and TB-5 files, TB-6 secrets, TB-7 supply chain, the contract); V-30 as amended by T11G (the recorded U-03 decision PD-10 and the recorded SC-05 isolation decision for FootballDataProvider and the manual input types, and their conditions); every control and observation the T11H addendum adds; the T11G controls of section 11.4: credential handling (header only, redaction, fail-closed startup, token absent from configuration, cache, database, logs, test output, evidence, probe findings and bundle), rate limiting (budget, header-driven waits, bounded retries, no retry of 400, 401, 403 and 404), cache contents (validated projections only), CSV and JSON import limits, the static provider-identifier check, person-field dropping and rejection, import originals served as attachments, demonstration labels; the design-time assumptions NV-1 to NV-6 of section 10 against the pinned versions, the review of moderate advisories from [audit-full], the status of every should-fix finding T10-F04 to T10-F18 and of the observations T10-A1-01 to T10-A1-06 in the tasks that carry them. T11H (`docs/work-items/WI-1/security/design-review-change-1.md` section 10, with the evidence named there): V-13a (AI data block holds only schema-validated values, never `sourceRef`, `declaredSource` or `fileName`); V-30 as amended by T11H (the SC-05 isolation decision E-13, recorded as PD-15, before T49 and T50 started, and the identity re-raise decision E-14, recorded as PD-16, before any real token was configured and before T53's live run, from the requirements decision register, the source of truth (SC-05, SC-08) and the tracker Decisions and Event log start times of T49, T50 and T53), and the PD-16 conditions (`docs/local-setup.md` states them; no committed configuration other than `config/live.config.json` enables a LIVE_DATA source; T53's record states a free-plan token); V-31 to V-36 (credential sourcing, transmission with origin pinning, absence from logs, errors and responses, test and tooling hygiene including `--require-token`, browser, probe and T53 with T53's recorded `real token checked: yes` output or the "probe not run" statement); V-37 to V-42 (real provider response handling, errors and retries with the boolean-only `X-Authenticated-Client` use, budget with header bounds, priority, single-flight and bounded waiters, cache, egress with the stage-discovery cap at most 2 MiB and backed by T53's sizes, catalogue routes answering 404 without provider requests); V-43 to V-49 (import route, base64 transfer and UTF-8 encoding rule, CSV parser with the adversarial corpus and linear-time test, JSON duplicate keys and depth, form size before write, person data and value-free errors, semantic and team-key rules, application atomicity and byte-identical originals, original download headers and file name); V-50 to V-53 (manual approval, configuration-only policies with the values decided by PD-17 and PD-18 (AD-38: refused `allowed_labelled` and `any_supporting_source`, marked-link startup rule, `publicationPermission` `unconfirmed` for the football-data source and `confirmed` only with a decision ID, no committed marked link), source independence under OD-24, demonstration labelling); the T11H-F17 production condition triggered by PD-17 for operator-attested content: the pinned team names of AD-38 item 4, the disposition of U-28 and, if a flag was adopted, its implementation, and a re-review of TB-3 and TB-8 for the operator-attested publication path with the configured AI (stub or local in WI-1), answering the question of `architecture-delta.md` section 11.13.4; V-54 (the SC-05 conditions of the T11H review section 6.3: no new parser dependency or native decoder in `package.json` and the lock file, no new input format, caps within limits, and that a failed linear-time test led to the option B fallback re-plan); V-55 (promoted contract equals the re-accepted `1.0.0-proposed.2` with the T11H-F01 correction except `info.version`; mutating operations; neutrality; lint rule without inline disables); the design-time assumptions NV-7 to NV-12 (T53 findings, T50 and T51 tests, `app.ts`); the status of every should-fix finding T11H-F03 to T11H-F15 and T11H-F20 and of the verify-in-T47 findings T11H-F12 and T11H-F16 in the tasks that carry them; the residuals R9 to R15 recorded as open, and the production condition of T11H-F17 recorded as met or open for the operator-attested path (as assessed above) and open for LIVE_DATA. Findings with severity and classification; missing evidence marked NOT VERIFIED with the exact command. Verdict PASS or FAIL in the evidence file (header of `templates/evidence-header.txt`, `VALIDATED_HEAD` from the brief).
- Acceptance criteria: R-234, R-235, R-263, R-280
- Verification: `orch evidence check docs/work-items/WI-1/evidence/T47-security-validation.txt --work-item 'WI-1' --task 'T47' --at .` -> exit 0, header RESULT: PASS

### T49: FootballDataProvider adapter, request budget, projection cache, live tests and capability probe script
- Kind: IMPL
- Agent: backend-developer
- Depends on: T21, T23
- Files owned: `apps/server/src/providers/sports/adapters/football-data/**`, `apps/server/src/providers/sports/support/**`, `apps/server/scripts/**`, `config/live.config.json`
- Scope: `contracts/provider-ports.md` section 1.4 and `architecture-delta.md` AD-25 to AD-27, AD-30, AD-32 and AD-36; the SC-05 isolation decision is PD-15, option A (in-process parsing within the reviewed caps, deadline and schemas; a cap above 2 MiB or a new input format needs a new review and Product Owner decision); this task uses the synthetic marker token only. Replace the T21 stub with FootballDataProvider (LIVE_DATA): options schema with the defaults of section 1.4; credential handling (`FOOTBALL_DATA_API_TOKEN` read from the injected environment only, kept in a closure, sent only as `X-Auth-Token`; `validateStartup` fails closed naming the variable; not read without an enabled LIVE_DATA source); the endpoint mapping for discovery, seasons, stages and matchdays, matches and standings; allow-list Zod schemas per resource with person fields (`referees` and any other) and `crest` dropped and counted; status mapping; the error classification table (never retry 400, 401, 403, 404; retries of 5xx, connection failures and timeouts with backoff, at most `maxRetries`, 30 s cap; 429 waits for `X-RequestCounter-Reset` within the purpose's bound); total deadline per request; response handling order (cap, status, parse, allow-list, map, domain validation, cache); generic `support/RequestBudget` (serialized queue, sliding 60-second window with the configured budget, server counters, discovery and research waits) and `support/ProjectionCache` (in-memory LRU of validated projections, TTLs by resource and match status, stale listings for discovery only) with injectable clock and random source and no provider identifier; safe diagnostic logging (path templates, parameter names, status, duration, cache outcome, remaining budget; never the token, a header value other than the rate-limit counters, or a body); `config/live.config.json` (DEMO_DATA, MANUAL_DATA and the enabled football-data source with `https://api.football-data.org/v4` and `referenceCompetitionRefs: ["CL"]`, `publicationPermission: "unconfirmed"` and no `publicationPermissionDecision` (PD-18, AD-38), `verificationPolicy` with the AD-38 defaults; never a token). Unit tests with a replay `EgressClient` serving `fixtures/football-data/` and a controllable clock, no socket: the reference-shaped competition's information, reported seasons only, and matchdays or stages of a season (R-244); the twelve S-003 cases R-245 to R-255 and the adapter part of R-256 (values mapped so that the verification rule can compare them); the marker token only in the `X-Auth-Token` header, never in the URL or query, no credential in code or configuration (R-260); the marker absent from logs, errors, `SourceError` messages and the cache (R-263); a missing or empty token stops startup naming the variable and a configuration without LIVE_DATA never reads it (R-266); referees and crests absent from projections, cache and logs (R-280); 403 and 404 mapped to unavailability with a reason (R-286); with many competitions and a 10 requests per minute budget, catalogue and selection never exceed 10 requests in any 60-second window, a repeat within validity makes no request, and an exhausted budget gives a stale listing with its retrieval time or `retryAfterSeconds` (R-291). Live tests (`*.live.test.ts`) skipped unless `EDR_LIVE_TESTS=1` and the token are set, at most 5 requests, asserting shapes only (R-258). Capability probe script `apps/server/scripts/football-data-probe.ts` with the output rules of section 1.4, and a unit test running it against the replay transport asserting that the findings contain no marker token, no raw body and no person field and stay within 30 requests (R-259). T11H review items (`contracts/provider-ports.md` section 1.4 as corrected): (F02) the probe's top-level handler catches every error, rejection, uncaught exception and unhandled rejection and prints only a closed failure code and counts, never an error object, stack, inspected request options or headers; a unit test runs the probe with the marker token against a replay transport that throws, rejects and returns 401, 403 with the marker-shaped client value, 429 and 500, captures stdout and stderr, and asserts that stdout, stderr and the findings file contain neither the marker token nor the marker-shaped client value; (F03) origin pinning: `validateStartup` refuses a `baseUrl` whose origin is not the adapter constant `https://api.football-data.org` with a fixed `ConfigError`, and `X-Auth-Token` is attached only to requests to that origin (tests: a configuration with another origin fails startup; no request without the pinned origin carries the header); format and options validation errors are fixed texts, never validator issues containing the input (test with the marker token in an invalid format); (F04) the 403 classification uses a boolean computed in memory, and the `X-Authenticated-Client` value is never logged (including `SourceError.message` at debug level), stored, cached, returned or written into findings (tests with the marker-shaped value; the probe records presence booleans only); (F05) rate-limit headers parsed with `^[0-9]{1,6}$`, `X-RequestCounter-Reset` above 3 600 and `X-RequestsAvailable` above 10 000 ignored (tests with negative, fractional, exponent, huge and empty values); (F06) research, verification and consultation before discovery, discovery limited to `requestsPerMinute - researchReservedSlots` slots per window, single-flight per cache key, at most `maxDiscoveryWaiters` waiting discovery requests (tests with the injected clock: a discovery flood never delays research beyond its reserved slots; concurrent identical misses make one request; the waiter bound answers at once); (F07) grouping and lookups by stage value and team key use `Map` (tests with `__proto__`, `constructor`, `prototype` and `toString` as stage values and team keys); (F14) `sourceRef` and item refs are `source:<sourceId>/<resourceKind>@<retrievedAt>`, never a URL (test); (Q8) option `maxResponseBytesByResource.stageDiscovery` (at most 2 MiB; applied only to the season-wide match list), committed unset in `config/live.config.json` until T53's measured size justifies it (test that other resources keep the 512 KiB cap when the override is set).
- Acceptance criteria: R-244, R-245, R-246, R-247, R-248, R-249, R-250, R-251, R-252, R-253, R-254, R-255, R-258, R-259, R-260, R-263, R-266, R-280, R-286, R-291
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0 ; `npm run test:live` -> exit 0, every live test skipped (no token in the task worktree)

### T50: Manual data import module and ManualDataProvider
- Kind: IMPL
- Agent: backend-developer
- Depends on: T18, T19, T20, T21
- Files owned: `apps/server/src/modules/imports/**`, `apps/server/src/providers/sports/adapters/manual/**`
- Scope: `contracts/provider-ports.md` section 1.6, `architecture.md` section 15.3, `data-model.md` section 3.5, AD-29 and AD-35; the SC-05 isolation decision is PD-15, option A for the JSON, CSV and form imports, under the conditions of the T11H review section 6.3 carried below. Replace the `imports` module stub and the T21 manual adapter stub. Routes `createImport`, `listImports`, `getImport`, `getImportOriginal` (attachment, `application/octet-stream`, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, CORP `same-origin`), `listManualSelections`, `getManualVersion`. JSON file, CSV file and form channels converted to one `ManualImportDocument`; the CSV parser (single-pass state machine, strict UTF-8, BOM removal, comma only, quoted fields with `""`, no line break inside a field, 512 KiB, 5 000 rows, fixed column count, 200 characters per field, two fixed layouts, team keys derived deterministically); the JSON size check and depth pre-scan before `JSON.parse`; the strict schema (unknown keys are errors); name, number and control-character rules; person-like columns and keys rejected naming the field; semantic checks (duplicate match identity naming both records, home differs from away, referenced teams, finished needs a score and other statuses forbid one, standings consistency, metadata presence and conflicts); every error collected up to 500 with sanitized fields; whole-import application (original written first with the exclusive flag under a realpath-checked UUID path, then one `BEGIN IMMEDIATE` transaction for the import record, competition and season rows and one new version per selection with the previous one superseded; nothing stored on rejection); ManualDataProvider reading the current versions (catalogue competitions, seasons, stages and matchdays; `fetchSelection` with the import version and `import:<importId>/v<n>` reference; `no_data` without a current version); no network import (lint rule). Unit and integration tests: every invalid sample of `fixtures/manual/` and inline cases rejected with the expected error (R-273, R-275, R-279, R-280), all errors reported together with file or form, record, field and problem (R-274), parser edge cases (quotes, CRLF, BOM, invalid UTF-8, control characters, line break in a field, wrong column count, depth), a valid import with metadata, results and standings selectable through the catalogue and an import without metadata rejected (R-276), the original retrievable unchanged with the same SHA-256 and linked to its import record with timestamp, channel, file name and declared source (R-277), a corrected reimport creating a new version with the earlier one retrievable (R-278), and the manual output passing the shared domain schema (R-267). T11H review items (`contracts/provider-ports.md` section 1.6 as corrected): (F01) file channels take `contentBase64`: strict base64 decoding (non-canonical, URL-safe or line-broken input is `encoding_invalid`), 1 to 524 288 decoded bytes (`too_large`), `TextDecoder('utf-8', { fatal: true })` with a leading BOM ignored for parsing only, and the received bytes preserved and hashed unchanged; tests: a file with a BOM, with CRLF line ends, with an invalid byte, with an overlong sequence and with an encoded lone surrogate (`ED A0 80`), and hash equality between the sent bytes, the stored original, `originalSha256` and the `getImportOriginal` body; (F08) the JSON pre-scan rejects a duplicate member name within one object as `parse_error` naming the JSON pointer (test); (F09) the exact team-key derivation rule; an empty or non-`Slug` key and two different names deriving one key reject the import with `value_inconsistent` naming every row (tests: "Club A.B." and "Club A B"; names in a non-Latin script only; accented and unaccented forms of one name); (F07) every lookup keyed by import or derived values uses `Map` (tests with `__proto__`, `constructor`, `prototype` and `toString` as team keys, team names, CSV team names and stage IDs); (F10) the form document is serialized canonically and checked against 524 288 bytes before anything is written (`too_large`; test that no file and no row remain); (F11) `getImportOriginal` sets `Content-Disposition: attachment; filename="original-<importId>.<json|csv|form.json>"` and never reflects the stored file name (test with a non-ASCII and an NFD stored name); (F12) `ImportError` fields never carry a cell or member value, and the route never logs the request body (test: a rejected file carrying the marker token in a person-like column and in a team name gives errors with row, column and problem only, and the captured log has no marker); (F20) an NFD file name with combining marks is accepted. SC-05 option A conditions (T11H review section 6.3, V-44, V-54, NV-12): an adversarial corpus generated in test code for the CSV parser and the JSON pre-scan (512 KiB of `"`, alternating `""`, an unterminated quote, only separators, CR-only line ends, NUL, a BOM only, overlong UTF-8, encoded lone surrogates, 5 001 rows, a 201-character field, depth 17, duplicate keys, `__proto__` keys), each refused with the expected error; a timing test proving roughly linear time at the cap (median parse time of 512 KiB inputs within a fixed multiple of the median at 64 KiB for the worst corpus shapes); no new parser dependency and no native decoder. If the timing test cannot be met, the task reports FAIL with the measurements and the Orchestrator re-plans with option B (a `worker_threads` worker with `resourceLimits` and a deadline) as the fallback for the import input (MED-05, decision note); the test is never weakened to pass. A deeply nested 1.5 MiB envelope on `createImport` is refused quickly with 400 (NV-9).
- Acceptance criteria: R-267, R-273, R-274, R-275, R-276, R-277, R-278, R-279, R-280
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run test:integration` -> exit 0

### T51: Manual import UI
- Kind: IMPL
- Agent: frontend-developer
- Depends on: T16, T20
- Files owned: `apps/web/src/features/imports/**`
- Scope: import pages (`architecture.md` section 15.3): upload a JSON or CSV file (read in the browser with `file.arrayBuffer()`, never decoded or altered; at most 524 288 bytes checked before sending; sent through `createImport` as `contentBase64` with the file name normalized to NFC and an optional declared source; T11H-F01, T11H-F20); form entry that builds a `ManualImportDocument` (competition, season, stage, matchday or whole stage, teams, matches with status and score, optional standings rows), with client-side hints while server validation stays authoritative and no person-level field; rejection view listing every error by file or form, record, field and problem (R-274); import history with channel, file name (as text), declared source, time, original hash and a download link to the original using the `download` attribute (T11H-F11), with the note "open originals as text" (Q12, residual R10); versions per selection with the current and earlier versions (R-278); a link to create a project for the imported competition (R-276); accessible names, labels and keyboard use. Component tests with a mocked API client: a rejected import with many errors, an applied import, a reimport creating a new version; a file with a leading BOM and an invalid UTF-8 byte whose `contentBase64` in the captured request decodes to exactly the file's bytes (NV-11); an NFD file name sent as NFC; an oversize file refused before any request.
- Acceptance criteria: R-274, R-276, R-278
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:unit` -> exit 0 ; `npm run build` -> exit 0

### T52: Integration tests: data modes, catalogue, manual import and credentials
- Kind: IMPL
- Agent: qa-engineer
- Depends on: T23, T27, T29, T30, T41, T49, T50
- Files owned: `apps/server/test/integration/ingestion/**`
- Scope: API-level tests with the T41 support, the replay transport for football-data-shaped responses and configurations from `fixtures/config/`: the T23 equivalence set through FixtureDataProvider, ManualDataProvider (JSON, CSV, form) and FootballDataProvider gives representations that pass one schema and are equal apart from mode, source metadata and timestamps (R-267), and the downstream stages run unchanged on each (R-268); the default configuration runs on DEMO_DATA without the token, makes no request to the provider host and gives identical results on repeated runs (R-257); catalogue with stub provider competitions, an imported manual competition and DEMO_DATA competitions together with their sources, a competition added to or removed from the replayed response appearing or disappearing without code change (R-243, R-282); a league with matchdays and a stage-based competition with named stages (R-283); the reference-shaped competition offering every stage including those after the league stage, and a stage without standings stating that standings are not available (R-244, R-284); a 403 competition marked unavailable with other competitions usable (R-286), an unavailable season (R-253); a linked competition with two sources where either can be chosen and the project, every retrieval and every fact record the source and the trace shows it (R-287); with many stub competitions and a 10 requests per minute budget, never more than 10 requests in any 60-second window, no request for a repeat view within validity, and a stale listing with its retrieval time or the wait when exhausted (R-291); credentials: the marker token only in the `X-Auth-Token` header of replayed requests, never in URLs, API responses, problem details, stored rows or captured logs (R-260, R-262, R-263); startup with the LIVE-shaped configuration without the token fails naming the variable, an invalid mode fails, the DEMO configuration needs no token (R-266); access refused fails the stage with "provider access refused" and no token in the reason (R-248); provider unavailability within the retry bound and research restartable (R-250); statuses: two agreeing sources verified, the LIVE-shaped source alone awaiting independent verification, MANUAL_DATA unverified then manually approved, exactly one status per fact (R-270); a LIVE-shaped project without a secondary source: research completes and approval is refused naming the single-source fact (R-271); the LIVE-shaped primary against the `test-live` secondary LIVE_DATA verification source of T41 (own independence group; T23 scenarios `live-secondary-disagree` and `live-secondary-agree`) disputed when they disagree, verified citing both when they agree (R-256; OD-24: never with a DEMO_DATA source); source independence (OD-24, T11H-F13): startup refused for two football-data sources with one origin in different independence groups and for a link mixing a DEMO_DATA and a LIVE_DATA source, naming the sources or the link; catalogue routes (T11H-F06): an unknown or unlisted competition, source or season ID answers 404 with zero replayed provider requests, and a discovery flood does not make research fail `rate_limited` within the reserved slots; references (T11H-F14): no `sourceRef` or `ref` in any API response of a LIVE-shaped project is a URL or names the provider host; the marker-shaped `X-Authenticated-Client` value of a replayed 403 never appears in API responses, stored rows or captured logs (T11H-F04); manual approval shown, stored and traced as MANUALLY_APPROVED, refused for LIVE-shaped and disputed facts (R-272); publication eligibility under PD-17 and PD-18 (AD-38), with the configuration and identity map written by the test into a temporary directory: content using MANUALLY_APPROVED facts of a manual competition linked with `noAcceptedPublicSource: true` and pinned team names becomes approvable, is exported with `operatorAttested: true` and shows the facts as MANUALLY_APPROVED, never verified; the same import as an unlinked manual competition stays blocked with `manually_approved_not_publishable`; a team name outside the pinned set leaves its facts `team_identity_unmatched` and refuses their manual approval; startup refuses `allowed_labelled`, `any_supporting_source`, a marked link binding a LIVE_DATA source and a `confirmed` LIVE_DATA source without a decision ID (R-272); manual import end to end: nothing stored from a rejected import (R-273), all errors reported (R-274), duplicates refused (R-275), the imported competition selectable and researchable (R-276), the original retrievable with the same hash and facts tracing to it (R-277), a reimport creating a new version used by later research with changed facts losing MANUALLY_APPROVED and content needing QA and approval again (R-278), a finished match without score rejected and nothing derived (R-279), person data absent from representation, cache, storage and logs and a person-level column rejected naming it (R-280); the multi-competition workflow: two LIVE-shaped competitions (replayed), one MANUAL_DATA and one DEMO_DATA competition taken through selection, retrieval, provenance review, generation, preview and, as far as the verification rules allow, approval and export (R-290).
- Acceptance criteria: R-243, R-244, R-248, R-250, R-253, R-256, R-257, R-260, R-262, R-263, R-266, R-267, R-268, R-270, R-271, R-272, R-273, R-274, R-275, R-276, R-277, R-278, R-279, R-280, R-282, R-283, R-284, R-286, R-287, R-290, R-291
- Verification: `npm ci` -> exit 0 ; `npm run typecheck` -> exit 0 ; `npm run lint` -> exit 0 ; `npm run test:integration` -> exit 0 ; `node scripts/security-checks.mjs secret-scan` -> exit 0

### T53: Capability probe run and football-data.org findings
- Kind: IMPL
- Agent: Orchestrator
- Depends on: T13, T41, T49
- Files owned: `docs/work-items/WI-1/research/football-data-capabilities.md`, `docs/work-items/WI-1/evidence/T53-*.txt`
- Scope: `provider-research-plan.md` section 7 (corrected for T11H-F02). The identity re-raise (E-14, T11H-F19) is decided by PD-16, option A; the live run takes place only under its conditions (source-of-truth SC-08): the Product Owner has placed a free-plan `FOOTBALL_DATA_API_TOKEN` in `.env.local` (mode 0600) of the task worktree on the single-user workstation, and the LIVE configuration is used for this run only; the token is never requested in a conversation. If the Product Owner states that the token belongs to a paid plan, or the run would take place on a shared or multi-user host, the probe is not run and the Orchestrator re-raises the identity model to the Product Owner (PD-16). Exact order: (1) presence check that prints no value, `grep -c '^FOOTBALL_DATA_API_TOKEN=..*' .env.local` (a count); never a read tool, `cat`, `less`, `env`, `printenv`, an `echo` of the variable or shell tracing on the file or the variable; (2) `npm ci`; (3) `npm run probe:football-data -- --out docs/work-items/WI-1/research/football-data-capabilities.md > .cache/probe-output.log 2>&1` (at most 30 requests, within the 10 per minute budget; no purchase or upgrade); the console log is never displayed or read, only the exit code is used; (4) while `.env.local` is still present, `node --env-file-if-exists=.env.local scripts/security-checks.mjs marker-scan --require-token docs/work-items/WI-1/research .cache/probe-output.log` with its output saved to a temporary file outside the repository (`mktemp`); it must exit 0 and print `real token checked: yes`; (5) delete `.cache/probe-output.log` and `.env.local`; (6) commit the findings file, then record the saved step-4 output with `orch evidence write --output-file` as `docs/work-items/WI-1/evidence/T53-marker-scan-real.txt` and commit it. If step 4 exits 1 or prints `real token checked: no`, the findings file is not committed, the log is deleted unread, `.env.local` is deleted, the task fails and the Orchestrator reports a possible credential exposure to the Product Owner. Without the token, or when a PD-16 condition does not hold: write the findings file with "probe not run: token not supplied" or "probe not run: PD-16 condition not met" and the date; the Orchestrator reports to the Product Owner that the LIVE_DATA demonstration and the capability confirmation wait (U-19); this outcome completes the task and blocks nothing else in the build. The findings (a line stating that the run took place under the PD-16 conditions with a token the Product Owner stated to be a free-plan token, never any token detail; competitions available, seasons, matches and standings presence, field presence, observed rate-limit headers, response sizes per resource kind (NV-7, Q8), `X-Authenticated-Client` presence booleans only, never its value (NV-8, T11H-F04), observed counter values and whether the counter is per token (NV-10), freshness observations) feed T14 and the choice of the second LIVE_DATA demonstration competition (OD-22).
- Acceptance criteria: R-259, R-281
- Verification: live run: `orch evidence check docs/work-items/WI-1/evidence/T53-marker-scan-real.txt --work-item 'WI-1' --task 'T53' --at .` -> exit 0, header RESULT: PASS, and the recorded output contains `real token checked: yes` (the Orchestrator relies on this recorded output; a re-run of the `--require-token` scan after `.env.local` was removed exits 1 and is not used) ; probe not run: the findings file states "probe not run" with the reason and the date, and no `T53-marker-scan-real.txt` exists ; both cases: `node scripts/security-checks.mjs marker-scan docs/work-items/WI-1/research` -> exit 0 ; `node scripts/security-checks.mjs hygiene` -> exit 0 ; `orch validate --work-item 'WI-1' --at .` -> exit 0

### T48: Final gate run
- Kind: VERIFY
- Agent: qa-engineer
- Depends on: T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T40, T41, T42, T43, T44, T45, T46, T47, T49, T50, T51, T52, T53
- Files owned: `docs/work-items/WI-1/evidence/T48-gates.txt`
- Scope: run every final gate (project gates of T25 and the four framework-mandatory gates) at a clean, committed integration HEAD in the verify worktree, without `FOOTBALL_DATA_API_TOKEN` in the environment, and report each gate PASS, FAIL or NOT RUN with command, exit code and counts. Last VERIFY task of the work item.
- Acceptance criteria: -
- Verification: `orch gates run --work-item 'WI-1' --task 'T48' --set final --cwd '<VERIFY_WORKTREE>'` -> exit 0, every required gate PASS

## Decisions

| ID | Level | Decision | Alternatives | Reversal cost | Source / PO notified |
|----|-------|----------|--------------|---------------|----------------------|
| OD-01 | MEDIUM | R-404: provenance label (verified fact / commentary) on every stored element and in the review view; no visible label on exported content; commentary states no unverified numbers | visible label on exported slides; no labelling | low (configuration and view change) | MED-04, S-000 line 88; PO notified in stage-1 report |
| OD-02 | MEDIUM | R-405: per-slide and caption review states plus a final carousel approval requiring all items approved and none blocked; export requires final approval | single carousel-level approval only | low | MED-04, S-000 lines 48-50, 60, 89-94; PO notified in stage-1 report |
| OD-03 | MEDIUM | R-407: configurable maximum slides per carousel; overflow split into numbered carousels; user can exclude matches; one slide per match kept | combine several matches per slide | low (configuration) | MED-04, S-000 lines 36, 46, 104; PO notified in stage-1 report |
| OD-04 | MEDIUM | R-408: portrait 4:5, 1080 x 1350 px, configurable, checked against Instagram's published specifications | square 1080 x 1080 | low (configuration) | MED-04, S-000 lines 46, 104; PO notified in stage-1 report |
| OD-05 | MEDIUM | R-409: result slides only for verified final results; unfinished, postponed or abandoned matches listed with status and left out; standings show an "as of" time | wait for the whole matchday to finish | low | MED-04, S-000 lines 18-23, 86-90; PO notified in stage-1 report |
| OD-06 | MEDIUM | R-417: MVP covers league-phase matchdays of seasons the accepted source covers, starting with the current season; knockout rounds deferred | include knockout rounds in the MVP | low (additive later); PO may override as a scope choice | MED-04, S-000 lines 12, 102-103; PO notified in stage-1 report |
| OD-07 | MEDIUM | R-418: provisional configurable colour and font values until the PO supplies official ones; no substitute logo or mascot | block templates until official values arrive | low (configuration) | MED-04, S-000 lines 73-82; PO notified in stage-1 report |
| OD-08 | MEDIUM | R-419: history kept locally with no automatic expiry and no deletion function in the MVP | deletion function (would be HIGH-02 for user data) | low (additive later) | MED-04, S-000 line 63; PO notified in stage-1 report |
| OD-09 | MEDIUM | R-420: data, text-fit and dimension failures block the slide until a regenerated version passes; visual-consistency findings are warnings the user acknowledges | treat all findings as blocking | low | MED-04, S-000 lines 41-46, 89-92; PO notified in stage-1 report |
| PD-01 | HIGH | PO decision PD-01 (R-410 option c): licensed sports-data API as preferred primary source, independent official source for verification; Architect researches providers, pricing, coverage, reliability and redistribution/licensing; synthetic fixtures in development; no purchase or subscription without authorization | options a, b | PO decision | S-001; Product Owner 2026-10-27 |
| PD-02 | HIGH | PO decision PD-02 (R-411 option a): scores, match dates and standings verified only when two independent accepted sources agree; on disagreement consult the official competition publication; disputed facts stay unverified until resolved | options b, c | PO decision | S-001; Product Owner 2026-10-27 |
| PD-03 | HIGH | PO decision PD-03 (R-413 option c): team names as text, existing authorized brand assets only, optional badge slots reserved, no unauthorized logos | options a, b | PO decision | S-001; Product Owner 2026-10-27 |
| PD-04 | HIGH | PO decision PD-04 (R-414 option a): MVP limited to team-level and competition-level data; no player-level information | options b, c | PO decision | S-001; Product Owner 2026-10-27 |
| PD-05 | HIGH | PO decision PD-05 (R-415 option a): single local operator without login; development services bound to localhost only | options b, c | PO decision | S-001; Product Owner 2026-10-27 |
| PD-06 | HIGH | PO decision PD-06 (R-416): content language configurable per project, Spanish by default; team names preserved as verified official names | other language and name options | PO decision | S-001; Product Owner 2026-10-27 |
| PD-07 | HIGH | PO decision PD-07: default branch is main (confirms the assumed basis of init) | - | PO decision | S-001; Product Owner 2026-10-27 |
| PD-08 | HIGH | PO decision PD-08: a frontend is required; enable the frontend-developer role in the project configuration (T06) | keep role disabled | PO decision | S-001; Product Owner 2026-10-27 |
| PD-09 | HIGH | PO decision PD-09: confirms OD-04 (1080 x 1350 carousel format), OD-02 (per slide and caption approval plus final approval) and OD-06 (league-phase-only MVP scope); no automatic publication | - | PO decision | S-001; Product Owner 2026-10-27 |
| PD-10 | HIGH | PO decision PD-10 (E-07, U-03 option A): in-process processing of untrusted input accepted for WI-1 scope (synthetic fixtures, stub or local AI, operator PNG/JPEG brand files) with the compensating controls of design-review Q2; the first real sports-data adapter, any hosted AI provider or any new input type requires a new security review and a new PO decision on isolation | B worker threads; C separate process | PO decision | S-002; Product Owner 2026-10-27 |
| PD-11 | HIGH | PO decision PD-11 (E-08, U-04): http-api contract-evolution policy approved as written in architecture-delta section 2.1 (additive-only within v1; breaking changes need a new major path and a PO decision) | other policy | PO decision | S-002; Product Owner 2026-10-27 |
| PD-12 | HIGH | PO decision PD-12: football-data.org API v4 (https://api.football-data.org/v4) selected as preferred primary sports-data provider for the MVP; initial competition UEFA Champions League (code CL, id 2001); token from environment variable FOOTBALL_DATA_API_TOKEN sent in X-Auth-Token; credential rules 1-7 of S-003; rate-limit headers respected; two-source policy preserved (single-source results awaiting independent verification, not publishable); no purchase or upgrade | other providers | PO decision | S-003; Product Owner 2026-10-27 |
| PD-13 | HIGH | PO decision PD-13: data acquisition modes LIVE_DATA (football-data.org), MANUAL_DATA (JSON, CSV, web form; competitions without public API, initial example Liga Nacional de Guatemala) and DEMO_DATA (synthetic fixtures), one normalized domain representation, manual import rules 1-10 of S-003, statuses UNVERIFIED, VERIFIED, MANUALLY_APPROVED (manual approval never represented as independent verification), adapters FootballDataProvider, ManualDataProvider, FixtureDataProvider | single LIVE mode | PO decision | S-003; Product Owner 2026-10-27 |
| PD-14 | HIGH | PO decision PD-14 (scope clarification): the platform is dynamic and multi-competition; Champions League is only the initial validation scenario and never a hardcoded dependency; dynamic competition discovery from configured providers (catalogue, seasons, matchdays or stages, matches, results, standings, different tournament structures, unavailable competitions and features, subscription restrictions); provider IDs only in adapters or configuration; manual competitions in the same catalogue; one or more sources per competition with the used source recorded; provider-neutral domain concepts; MVP demonstrates at least two LIVE_DATA competitions (subject to provider coverage), one MANUAL_DATA and one DEMO_DATA competition; no provider-specific features beyond this capability | single-competition MVP | PO decision | S-004; Product Owner 2026-10-27 |
| PD-15 | HIGH | PO decision PD-15 (E-13, SC-05): option A for both inputs: in-process processing of FootballDataProvider responses and of the JSON, CSV and form imports, with the conditions of design-review-change-1.md section 6.3 (caps, deadline, schemas; adversarial corpus and linear-time test for the CSV parser and JSON pre-scan, option B fallback by re-plan if the test fails; no new parser dependency or native decoder; re-review and a new PO decision before a new input format, raised caps, a second real provider adapter, a hosted AI provider, or a shared or multi-user host) | B worker thread; C separate process | PO decision | S-005; Product Owner 2026-10-27 |
| PD-16 | HIGH | PO decision PD-16 (E-14, identity re-raise): option A: no login confirmed for LIVE_DATA on a single-user workstation with a free-plan token only, `.env.local` mode 0600, LIVE configuration enabled only when needed, and the budget controls of T11H-F05 and F06; re-raise before a paid plan, a shared or multi-user host, or real non-public data | B per-launch secret; C LIVE_DATA off until a login model | PO decision | S-005; Product Owner 2026-10-27 |
| PD-17 | HIGH | PO decision PD-17 (E-09, R-429): option (c): MANUALLY_APPROVED facts may pass publication approval only for competitions configured as having no accepted public source (for example Liga Nacional de Guatemala), always labelled operator-attested and never shown or stored as verified; API-covered competitions keep the two-source rule | (a) always; (b) never | PO decision | S-005; Product Owner 2026-10-27 |
| PD-18 | HIGH | PO decision PD-18 (E-10, R-430): option (a): before content using football-data.org data is approved for publication, the PO obtains written confirmation of republishing permission from the provider, including any attribution requirement, recorded as a PO decision; until then LIVE_DATA content from that provider is not publication-approvable | other confirmation route | PO decision | S-005; Product Owner 2026-10-27 |
| PD-19 | HIGH | PO decision PD-19 (E-11): conflict C-1 resolution confirmed: multi-competition scope (S-003, S-004) supersedes the single-competition scope | reject | PO decision | S-005; Product Owner 2026-10-27 |
| PD-20 | HIGH | PO decision PD-20 (E-12): conflict C-3 resolution confirmed: generic matchday-or-stage handling supersedes the league-phase-only limit of PD-09; knockout brackets and aggregate-score logic are not added | reject | PO decision | S-005; Product Owner 2026-10-27 |
| OD-10 | MEDIUM | R-424: the PD-02 two-source agreement rule applies to every fact used in content (teams in a match, match status, competition context), not only scores, dates and standings | apply the rule only to scores, dates and standings | low (stricter default; can be relaxed) | MED-04, S-000 lines 25-26, S-001 lines 14-19; PO notified in stage-1 report |
| OD-11 | MEDIUM | R-425: selectable content languages are Spanish (default) and English, held as configuration | Spanish only; open list | low (configuration) | MED-04, S-001 line 37; PO notified in stage-1 report |
| OD-12 | MEDIUM | R-426: the verified official team name comes from the independent official source; team identity is matched across sources and an unmatched team is not verified; any other name form fails Visual QA and is not approvable; hashtags may use a hashtag-safe form of the name | name from the primary API; allow display aliases | low (rule configurable before content exists) | MED-04, S-001 lines 4-5, 38; PO notified in stage-1 report, may override |
| OD-13 | MEDIUM | U-06: carousel templates are versioned code with a registry, list and preview in the UI; no template editing in the UI for the MVP (R-010) | in-UI template editor | low (additive later) | MED-04, architecture-delta section 8; PO notified in stage-2 report |
| OD-14 | MEDIUM | U-05: the corrected http-api proposal (contracts/http-api.openapi.yaml at 41af5ee; 29 operations, 24 paths) is accepted as an additive new contract; promotion by T20, declaration in the configuration by T25, hash in the source of truth by T26 | reject or defer the contract | low (additive; not yet declared) | MED-01; Contract Safety CS-1 to CS-5 hold per T10 addendum; PD-11 policy; PO notified in stage-2 report |
| OD-15 | MEDIUM | T10 addendum observations T10-A1-01 to T10-A1-06 (LOW, non-blocking) are carried as extra constraints in the briefs of the named tasks (A1-01 T20 and T43: declare 403 on GET operations, additive; A1-02 and A1-03 T41 and T46: hygiene subcommand, positive-control test, scripts in lint scope; A1-04 T19 brief wording; A1-05 T32 allowed character exceptions; A1-06 T30 and T43 slug conformance) instead of a fourth architecture attempt | re-open T09 | low | MED-05; design-review.md Addendum 1; PO notified in stage-2 report |
| OD-16 | MEDIUM | R-431: each catalogue competition has one or more configured data sources (provider-discovered competitions have that LIVE_DATA provider; competitions without a public API have MANUAL_DATA; DEMO_DATA in development, test and demonstration configurations); the operator chooses among the available sources per project and the choice is recorded | single fixed source per competition | low | MED-04, S-004 line 57; PO notified in stage report |
| OD-17 | MEDIUM | R-433: VERIFIED is the two-source verified state; UNVERIFIED covers every other fact with a reason (awaiting independent verification, disputed, no accepted source); MANUALLY_APPROVED is a separate status only for MANUAL_DATA facts and never counts as verification | separate status per reason | low | MED-04, S-003 verification section; PO notified |
| OD-18 | MEDIUM | R-434: MANUAL_DATA uses the provider-neutral structure: a season contains matchdays or named stages with matches and, where the competition has them, standings; stages without standings are valid | manual matchdays only | low | MED-04, S-004; PO notified |
| OD-19 | MEDIUM | R-435: match identity is competition, season, matchday or stage, home team and away team; an import is applied as a whole (any rejected record rejects the import, all errors reported); a reimport creates a new version and keeps the original data | partial imports | low | MED-04, S-003 manual import rules 3, 4, 7, 9; PO notified |
| OD-20 | MEDIUM | R-436: with LIVE_DATA enabled, a missing or empty FOOTBALL_DATA_API_TOKEN stops startup with an error naming the variable and never its value; without LIVE_DATA the token is not required; invalid data-mode settings stop startup | warn and continue | low | MED-04, S-003 credential rule 7; PO notified |
| OD-21 | MEDIUM | R-438: DEMO_DATA projects are labelled as demonstration content in the project list, review view and export | no label | low | MED-04, S-003, S-004; PO notified |
| OD-22 | MEDIUM | R-440: MVP demonstration set: LIVE_DATA Champions League plus one domestic league whose coverage the capability probe confirms for the PO token, chosen from the catalogue at execution time, never fixed in code; MANUAL_DATA Liga Nacional de Guatemala; DEMO_DATA a fixture competition; fewer than two confirmed LIVE competitions is reported to the PO | fixed list in code | low | MED-04, S-004 lines 103-112; PO notified |
| OD-23 | MEDIUM | The revision of the never-declared http-api proposal (1.0.0-proposed.2, as corrected for T11H-F01) is a pre-release revision and is re-accepted, covering the T11H-F01 change (contentBase64) and the F06, F11, F14 and F20 description and pattern edits (supersedes the acceptance scope of OD-14); PD-11 applies from promotion (T20) and declaration (T25) onward; this acceptance does not decide C-1, C-3, R-429 or R-430 | treat as HIGH-06 | low (not declared, no consumer) | MED-01; Contract Safety CS-1 to CS-5 hold per T11H section 9 (CS-1 conditional on F01); effective after the T11H addendum confirms F01; PO notified |
| OD-24 | MEDIUM | T11H-F13: DEMO_DATA (synthetic) sources never count as accepted or independent confirmation of LIVE_DATA or MANUAL_DATA facts, and sources that share an upstream belong to one independence group, so their agreement is one source; the R-256 verification fixture is the `test-live` LIVE_DATA test double (T11G attempt 2, LOW-3), not a DEMO_DATA source | count every configured source separately | low | application of PD-02 independence (BR-01); MED-04; PO notified |
| OD-25 | MEDIUM | T11H addendum observations go to task briefs: T11H-A1-01 (T53: run the step-4 scan even when the probe exits non-zero; unless the scan exits 0 with `real token checked: yes`, delete the uncommitted findings file unread) and T11H-A1-02 (T49: the provider-ports 1.4 error table rows from 404 onward, including never retry 404, apply although the table rendering is broken); V-52 in T47 also confirms that container.ts never registers test-only adapters and no committed config names test-live | re-open T11G | low | MED-05; design-review-change-1.md Addendum 1; PO notified |
| OD-26 | MEDIUM | U-28: a deterministic visual-QA warning check on every AI draft flags capitalized tokens that are not verified team or competition names (possible person names, T11H-F17 residual triggered by PD-17); the existing QA acknowledgement applies; one new closed value for the QA check name is added to the http-api proposal at promotion by T20 as an additive pre-release revision under OD-23; T35, T39 and T43 carry it through their briefs (plan precondition 6 satisfied) | no check; blocking check | low (warning only, configurable) | MED-04, MED-01 (additive closed enum value; CS-1 to CS-5 hold), MED-05; PO notified |
| OD-27 | MEDIUM | AD-38 confirmed: manual approval in competitions marked noAcceptedPublicSource requires pinned team identities (unpinned or changed names give team_identity_unmatched); the configuration refuses the options the PO did not choose (allowed_labelled, any_supporting_source); such links bind MANUAL_DATA sources only | eligibility on any manual fact | low (stricter; configurable) | MED-04; consistent with PD-06, PD-17, PD-18; PO notified |
| OD-28 | MEDIUM | U-29: PD-17 operator-attested labelling applies in the review UI, the trace and the export manifest (operatorAttested true when any used fact is MANUALLY_APPROVED); no visible label on the slide images, consistent with OD-01; the PO may require a visible label | visible label on slides | low (template or configuration change) | MED-04; PO notified in the stage report and may override |
| OD-29 | MEDIUM | U-30: T11L added no acceptance-criterion IDs; the extended statements of R-271 (both republishing-permission states, R-078) and R-272 (PD-17 eligibility, R-026) are carried as test expectations in the briefs of the tasks that name them (T30, T31, T32, T37, T39, T42, T44, T52); approval tests using the test-live double cover both permission states | re-open T11G for a fourth attempt | low | MED-05; requirements.md AC-23; PO notified |
| OD-30 | MEDIUM | U-10 resolved: the host has Node.js 22.22.2 (LTS 'Jod', maintained until 2027-04) and no 24 line; `node:sqlite` and `--env-file-if-exists` work on it (verified 2026-10-27; SQLite prints an ExperimentalWarning, silenced in scripts with `--disable-warning=ExperimentalWarning`). AD-01 is amended: pin Node.js 22.22.2 in `.nvmrc` and `engines` instead of 24 or later; nothing is installed on the host | escalate for a host installation of Node 24 | low (one-line pin change to move to 24 later) | MED-03, MED-04; local-environment.md (no host installation); PO notified |
| OD-31 | MEDIUM | Architecture decisions AD-01 to AD-38 of architecture-delta.md sections 5, 11.5, 11.12 and 11.13 are accepted as reviewed by T10 and T11H (design verdicts PASS), with AD-01 amended by OD-30; T12 records them in the source of truth | accept a subset | low | planning stage exit (T11, T11J); PO notified |
| OD-32 | MEDIUM | MED-02 dependency set of T15 at exact versions (save-exact, ignore-scripts, registry pinned, lock file with integrity): typescript 6.0.3 (7.x incompatible with typescript-eslint), eslint 10.12.0, typescript-eslint 8.71.2, @eslint/js 10.0.1, prettier 3.9.10, vitest 5.0.4, vite 8.3.4 (vitest peer), jsdom 30.1.2, @testing-library/react 16.3.3, @testing-library/user-event 14.6.7, @testing-library/dom 10.4.2 (peer), @playwright/test 1.64.0, @axe-core/playwright 4.13.0, @types/node 22.20.5, zod 4.6.7, fastify 5.12.7 (avoids low advisory GHSA-389g-gv7q-r4x8), @fastify/static 10.1.6, satori 0.51.0, @resvg/resvg-js 2.6.2, opentype.js 2.0.0, @readme/openapi-parser 9.1.0, ajv 8.20.0, openapi-types 12.1.3 (peer); npm audit --audit-level=high clean (agent-run) | other versions | low (lock-file change) | MED-02; T15 report; PO notified |
| OD-33 | MEDIUM | Moderate advisory GHSA-px8p-9vwx-vf98 (fflate 0.7.3, unzipSync infinite loop on malformed ZIP64) pinned by satori 0.51.0 is accepted for WI-1: satori's runtime uses only inflateSync and zlibSync, inputs are committed fonts, never ZIP files; T34 and T47 re-check reachability; revisit when satori moves to fflate >= 0.7.5 | pin satori 0.32.0; npm overrides fflate 0.7.5 | low | MED-02 (moderate, not HIGH or CRITICAL, so not HIGH-03); T10-F02; PO notified |
| OD-34 | MEDIUM | Re-plan: T19 also owns `apps/server/test/integration/smoke/**` (created by T15, DONE), because T19 changes buildApp and createContainer which the smoke test calls | T15 reopened | low | MED-05; T15 report |
| OD-35 | MEDIUM | MED-02 dependencies of T16 at exact versions: react 19.3.0, react-dom 19.3.0, react-router 8.4.0 (8.5.0 too recent), @vitejs/plugin-react 6.1.2, @types/react 19.3.0, @types/react-dom 19.3.0, vite 8.3.4 declared in apps/web (dedupes with root); new transitive scheduler, csstype, cookie-es, @remix-run/route-pattern; no advisory for any of them | other versions | low | MED-02; T16 report; PO notified |
| OD-36 | MEDIUM | Re-plan: T28 also owns `apps/web/src/api/types.ts` (created by T16, DONE) and replaces its temporary copies of contract enums and shapes with re-exports from `@edr/contracts` (T20), and makes `parseProblem` use the contract Problem schema in coordination with T16's client (only types.ts is transferred) | a separate follow-up task | low | MED-05; T16 report |

## Conflicts

| ID | Sources in conflict | Resolution (higher source wins) | Follow-up |
|----|---------------------|---------------------------------|-----------|
| C-1 | S-000 single competition and selection flow (R-021, R-101, R-102, R-201) vs S-003 and S-004 multi-competition and manual competitions (R-072, R-137, R-138, R-243); both level 1 | Applied provisionally: later PO statements S-003, S-004 govern; earlier records superseded | Conflict between level-1 sources is HIGH: PO confirmation requested (E-11); resolved by PD-19 |
| C-2 | R-026, R-047 (two-source rule, block unverified) vs R-071 (MANUALLY_APPROVED status); both level 1 | Not decided by any source; R-026 applies until decided | R-429 to the PO (E-09); resolved by PD-17 |
| C-3 | PD-09 league-phase-only and mandatory standings slide (R-417, R-239, R-210) vs S-004 stages and different tournament structures (R-439, R-284, R-285); both level 1 | Applied provisionally: S-004 governs; earlier records superseded | Conflict between level-1 sources is HIGH: PO confirmation requested (E-12); resolved by PD-20 |

## Escalations

| ID | Task | Reason | Raised | Resolved |
|----|------|--------|--------|----------|
| E-01 | T01 | HIGH decision: R-410 accepted sports-data sources and their terms (HIGH-05, HIGH-07) | 2026-10-27 | 2026-10-27 (PD-01) |
| E-02 | T01 | HIGH decision: R-411 rule for a verified fact (HIGH-07) | 2026-10-27 | 2026-10-27 (PD-02) |
| E-03 | T01 | HIGH decision: R-413 use of club badges and competition marks (HIGH-05, HIGH-07) | 2026-10-27 | 2026-10-27 (PD-03) |
| E-04 | T01 | HIGH decision: R-414 personal or player-level data (HIGH-04, HIGH-07) | 2026-10-27 | 2026-10-27 (PD-04) |
| E-05 | T01 | HIGH decision: R-415 user and authentication model (HIGH-03) | 2026-10-27 | 2026-10-27 (PD-05) |
| E-06 | T01 | HIGH decision: R-416 content language and team-name display (HIGH-07) | 2026-10-27 | 2026-10-27 (PD-06) |
| E-07 | T10 | HIGH decision: U-03 isolation of untrusted-input processing (in-process parsing of provider JSON and operator images) (HIGH-03) | 2026-10-27 | 2026-10-27 (PD-10) |
| E-08 | T09 | HIGH decision: U-04 first contract-evolution policy for http-api (additive-only within v1; breaking changes need a new major path and a PO decision) (HIGH-06, uncertain so raised) | 2026-10-27 | 2026-10-27 (PD-11) |
| E-09 | T11F | HIGH decision: R-429 publication eligibility of MANUALLY_APPROVED facts (HIGH-07; conflict C-2) | 2026-10-27 | 2026-10-27 (PD-17) |
| E-10 | T11F | HIGH decision: R-430 confirmation of republishing permission for football-data.org content (HIGH-05, HIGH-07) | 2026-10-27 | 2026-10-27 (PD-18) |
| E-11 | T11F | HIGH decision: confirm conflict C-1 resolution (multi-competition supersedes single competition) (precedence.md: level 1 conflict) | 2026-10-27 | 2026-10-27 (PD-19) |
| E-12 | T11F | HIGH decision: confirm conflict C-3 resolution (generic stages supersede league-phase-only, PD-09) (precedence.md: level 1 conflict) | 2026-10-27 | 2026-10-27 (PD-20) |
| E-13 | T11H | HIGH decision: SC-05 isolation of untrusted-input processing for FootballDataProvider responses and for the JSON, CSV and form imports (HIGH-03; reviewer recommends option A for both, with conditions) | 2026-10-27 | 2026-10-27 (PD-15) |
| E-14 | T11H | HIGH decision: identity-model re-raise for the real credential (T10-F19, Q5): any local process can spend the token request budget through the login-less API (HIGH-03; reviewer recommends option A) | 2026-10-27 | 2026-10-27 (PD-16) |

## Event log (append-only)

| Time (UTC) | Task | Change | Evidence |
|------------|------|--------|----------|
| 2026-10-27T15:26:26Z | T00 | Task added; status IN_PROGRESS (attempt 1) | intake scan exit 0: SP-1, 1 analyzed, 0 excluded, 0 instruction candidates |
| 2026-10-27T15:26:26Z | T01 | Task added; status PENDING | stage 1 plan per intake workflow |
| 2026-10-27T15:26:26Z | T02 | Task added; status PENDING | stage 1 plan per intake workflow |
| 2026-10-27T15:26:44Z | T01 | Status IN_PROGRESS (attempt 1); task worktree WI-1-T01 at base 1176f8c; agent orchestrate:product-manager launched | worktree prepare exit 0 |
| 2026-10-27T15:42:04Z | T01 | Agent report PASS; verified and integrated at dd9499e; affected gates PASS; awaiting T02 | requirements check exit 0; evidence/T01-gates.txt |
| 2026-10-27T15:42:04Z | T02 | Status IN_PROGRESS (attempt 1) | T00 and T01 integrated at dd9499e |
| 2026-10-27T15:42:31Z | T02 | Status DONE | evidence/T02-requirements-check.txt RESULT PASS; evidence commit c68b058; VALIDATED_HEAD 17f8786 |
| 2026-10-27T15:42:31Z | T00 | Status DONE | integration commit 1176f8c; independently verified by T02 |
| 2026-10-27T15:42:31Z | T01 | Status DONE | integration commit dd9499e; independently verified by T02 |
| 2026-10-27T15:42:50Z | T02 | Evidence cell path formatted as code span so the tracker check reads it | tracker check CT-08 on da8700e |
| 2026-10-27T16:03:17Z | T03 | Task added; status IN_PROGRESS (attempt 1) | PO decision message 2026-10-27 recorded as S-001; intake rescan exit 0: SP-4, 2 analyzed, 1 instruction candidate |
| 2026-10-27T16:03:17Z | - | PO decisions PD-01 to PD-09 recorded; escalations E-01 to E-06 resolved | S-001 |
| 2026-10-27T16:03:17Z | T04 | Task added; status PENDING | follow-up requirements and configuration tasks per PO decisions of 2026-10-27 |
| 2026-10-27T16:03:17Z | T05 | Task added; status PENDING | follow-up requirements and configuration tasks per PO decisions of 2026-10-27 |
| 2026-10-27T16:03:17Z | T06 | Task added; status PENDING | follow-up requirements and configuration tasks per PO decisions of 2026-10-27 |
| 2026-10-27T16:03:17Z | T07 | Task added; status PENDING | follow-up requirements and configuration tasks per PO decisions of 2026-10-27 |
| 2026-10-27T16:03:17Z | T08 | Task added; status PENDING | follow-up requirements and configuration tasks per PO decisions of 2026-10-27 |
| 2026-10-27T16:03:26Z | T04 | Status IN_PROGRESS (attempt 1); task worktree WI-1-T04 at base f4ccb0c; agent launched | worktree prepare exit 0 |
| 2026-10-27T16:03:26Z | T05 | Status IN_PROGRESS (attempt 1); task worktree WI-1-T05 at base f4ccb0c; agent launched | worktree prepare exit 0 |
| 2026-10-27T16:03:26Z | T06 | Status IN_PROGRESS (attempt 1); task worktree WI-1-T06 at base f4ccb0c; Orchestrator working | worktree prepare exit 0 |
| 2026-10-27T16:04:47Z | T06 | Verified and integrated at 32d60da; affected gates PASS; awaiting T07 | verify-ownership exit 0; validate config sections exit 0; evidence/T06-gates.txt |
| 2026-10-27T16:05:38Z | T05 | Agent report PASS; verified and integrated; affected gates run; awaiting T07 | verify-ownership exit 0; evidence/T05-gates.txt |
| 2026-10-27T16:19:08Z | T04 | Agent report PASS; verified and integrated at 01a71a7; affected gates PASS; awaiting T08 | requirements check exit 0; evidence/T04-gates.txt |
| 2026-10-27T16:19:08Z | - | Orchestrator decisions OD-10 to OD-12 recorded (R-424, R-425, R-426) | T04 agent report |
| 2026-10-27T16:19:08Z | T07 | Status IN_PROGRESS (attempt 1) | T05 and T06 integrated |
| 2026-10-27T16:19:22Z | T07 | Status DONE | evidence/T07-validate.txt RESULT PASS; evidence commit f648f85; VALIDATED_HEAD e1459cb |
| 2026-10-27T16:19:22Z | T05 | Status DONE | integration commit d93cbb1; independently verified by T07 |
| 2026-10-27T16:19:22Z | T06 | Status DONE | integration commit 32d60da; independently verified by T07 |
| 2026-10-27T16:19:22Z | T08 | Status IN_PROGRESS (attempt 1) | T03, T04 integrated; T07 DONE |
| 2026-10-27T16:19:42Z | T08 | Status DONE | evidence/T08-requirements-check.txt RESULT PASS; evidence commit 70befa9; VALIDATED_HEAD 5ec665d |
| 2026-10-27T16:19:42Z | T03 | Status DONE | integration commit f4ccb0c; independently verified by T08 |
| 2026-10-27T16:19:42Z | T04 | Status DONE | integration commit 01a71a7; independently verified by T08 |
| 2026-10-27T16:19:42Z | - | Ordering correction: T05 and T06 were recorded DONE at 5ec665d before their dependency T03; T03 now DONE | tracker check at 5ec665d reported CT-03 for T05, T06 |
| 2026-10-27T16:32:21Z | T09 | Task added; status IN_PROGRESS (attempt 1); full-mode architecture | stage 2 per planning workflow |
| 2026-10-27T16:32:21Z | T10 | Task added; status PENDING; design review triggered by full-mode architecture | planning workflow section 4 |
| 2026-10-27T16:32:21Z | T11 | Task added; status PENDING | stage 2 per planning workflow |
| 2026-10-27T17:02:43Z | T09 | Agent report PASS; verified and integrated at f017460; affected gates PASS; awaiting T11 | plan check exit 0 (37 tasks); evidence/T09-gates.txt |
| 2026-10-27T17:02:43Z | T10 | Status IN_PROGRESS (attempt 1); agent orchestrate:security-reviewer launched in design-review mode | T09 integrated at f017460 |
| 2026-10-27T17:16:51Z | T10 | Agent report PASS; integrated at 3ac5b85; design verdict FAIL correctable (T10-F01..F03 must-fix); addendum pending after T09 correction | design-review.md; verify-ownership exit 0; evidence/T10-gates.txt |
| 2026-10-27T17:16:51Z | T09 | Must-fix design-review findings T10-F01, T10-F02, T10-F03: targeted correction, attempt 2 | security/design-review.md section 4 |
| 2026-10-27T17:16:51Z | - | OD-13 recorded; escalations E-07 (U-03, HIGH-03) and E-08 (U-04, HIGH-06) raised for the stage-2 PO batch | design-review.md Q2; architecture-delta.md 2.1 |
| 2026-10-27T17:27:54Z | T09 | Attempt 2 (2520c7a) failed Orchestrator verification: contracts/http-api.openapi.yaml is not valid YAML (line 636, plain scalar with colon-space); targeted correction, attempt 3 | plan check exit 0; YAML parse error at line 636 |
| 2026-10-27T17:29:10Z | T09 | Attempt 3 verified and integrated at 41af5ee; affected gates PASS; awaiting T10 addendum and T11 | YAML parses; plan check exit 0; evidence/T09-gates-2.txt |
| 2026-10-27T17:29:10Z | T10 | Attempt 2: addendum confirming the T09 correction requested | T09 correction integrated at 41af5ee |
| 2026-10-27T17:30:39Z | T11A | Task added; status IN_PROGRESS (attempt 1) | PO message recorded as S-002; intake rescan exit 0: 3 analyzed, S-002 level 1 |
| 2026-10-27T17:30:39Z | - | PO decisions PD-10 and PD-11 recorded; escalations E-07 and E-08 resolved | S-002 |
| 2026-10-27T17:30:39Z | T11B | Task added; status PENDING | stage-2 PO decisions follow-up |
| 2026-10-27T17:30:39Z | T11C | Task added; status PENDING | stage-2 PO decisions follow-up |
| 2026-10-27T17:30:39Z | T11D | Task added; status PENDING | stage-2 PO decisions follow-up |
| 2026-10-27T17:30:39Z | T11 | Dependency T11D added | stage-2 PO decisions follow-up |
| 2026-10-27T17:30:47Z | T11B | Status IN_PROGRESS (attempt 1); agent launched | worktree prepare exit 0 at base 266b29d |
| 2026-10-27T17:30:47Z | T11C | Status IN_PROGRESS (attempt 1); agent launched | worktree prepare exit 0 at base 266b29d |
| 2026-10-27T17:32:07Z | T11C | Agent report PASS; verified and integrated at 16013be; affected gates PASS; awaiting T11D | verify-ownership exit 0; evidence/T11C-gates.txt |
| 2026-10-27T17:32:50Z | T10 | Attempt 2 addendum PASS; integrated at c1c0e2c; design verdict PASS; awaiting T11 | design-review.md Addendum 1; evidence/T10-gates-2.txt |
| 2026-10-27T17:32:50Z | - | OD-14 (http-api accepted, MED-01) and OD-15 (A1 observations routed to task briefs) recorded | T10 addendum Contract Safety |
| 2026-10-27T17:42:49Z | T11B | Agent report PASS; verified and integrated; affected gates PASS; awaiting T11D | requirements check exit 0; evidence/T11B-gates.txt |
| 2026-10-27T17:42:49Z | T11D | Status IN_PROGRESS (attempt 1) | T11A, T11B, T11C integrated |
| 2026-10-27T17:43:10Z | T11D | Status DONE | evidence/T11D-validate.txt RESULT PASS; evidence commit d98a135; VALIDATED_HEAD 8373bcb |
| 2026-10-27T17:43:10Z | T11A | Status DONE | integration commit 266b29d; independently verified by T11D |
| 2026-10-27T17:43:10Z | T11B | Status DONE | integration commit 380780f; independently verified by T11D |
| 2026-10-27T17:43:10Z | T11C | Status DONE | integration commit 16013be; independently verified by T11D |
| 2026-10-27T17:43:10Z | T11 | Status IN_PROGRESS (attempt 1) | T09, T10 integrated (design verdict PASS); T11D DONE |
| 2026-10-27T17:43:23Z | T11 | Status DONE | evidence/T11-plan-check.txt RESULT PASS; evidence commit 53e02a7; VALIDATED_HEAD a05778d |
| 2026-10-27T17:43:23Z | T09 | Status DONE | integration commits f017460, 41af5ee; independently verified by T11 |
| 2026-10-27T17:43:23Z | T10 | Status DONE | integration commits 3ac5b85, c1c0e2c; independently verified by T11 |
| 2026-10-27T17:43:29Z | T12 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T13 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T14 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T15 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T16 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T17 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T18 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T19 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T20 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T21 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T22 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T23 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T24 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T25 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T26 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T27 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T28 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T29 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T30 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T31 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T32 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T33 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T34 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T35 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T36 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T37 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T38 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T39 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T40 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T41 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T42 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T43 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T44 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T45 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T46 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T47 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T17:43:29Z | T48 | created PENDING from plan /Users/waltercordero/Documents/Training/el-deporte-rey-ai/.claude/worktrees/WI-1-integration/docs/work-items/WI-1/architecture/task-plan.md | - |
| 2026-10-27T18:27:22Z | T11E | Task added; status IN_PROGRESS (attempt 1) | PO change message recorded as S-003; intake rescan exit 0: SP-4, 4 analyzed, candidates: 1 paragraph duplicate, 1 reference, 3 instructions |
| 2026-10-27T18:27:22Z | - | PO decisions PD-12 (football-data.org) and PD-13 (data acquisition modes) recorded; change handled as a new architecture task with its own verification (planning.md section 5) | S-003 |
| 2026-10-27T18:27:22Z | T11F | Task added; status PENDING | provider and data-mode change (S-003) |
| 2026-10-27T18:27:22Z | T11G | Task added; status PENDING | provider and data-mode change (S-003) |
| 2026-10-27T18:27:22Z | T11H | Task added; status PENDING | provider and data-mode change (S-003) |
| 2026-10-27T18:27:22Z | T11I | Task added; status PENDING | provider and data-mode change (S-003) |
| 2026-10-27T18:27:22Z | T11J | Task added; status PENDING | provider and data-mode change (S-003) |
| 2026-10-27T18:27:29Z | T11F | Status IN_PROGRESS (attempt 1); agent launched | worktree prepare exit 0 at base 4757d4e |
| 2026-10-27T18:38:28Z | T11E | Scope extended: PO scope clarification recorded as S-004 (level 1); intake rescan exit 0: 5 analyzed, new candidates idCollisions[0], references[1] | S-004 |
| 2026-10-27T18:38:28Z | - | PO decision PD-14 (multi-competition scope, provider independence) recorded | S-004 |
| 2026-10-27T18:38:29Z | T11F | Scope extended to S-004 while in progress (MED-05 re-plan within scope): integration merged into the task branch, ownership base moves to that merge | S-004 intake commit |
| 2026-10-27T19:14:43Z | T11F | Agent report PASS; verified and integrated; affected gates PASS; awaiting T11I | requirements check exit 0; evidence/T11F-gates.txt |
| 2026-10-27T19:14:43Z | - | Conflicts C-1 to C-3 recorded; OD-16 to OD-22 recorded; escalations E-09 to E-12 raised for the batched PO request | requirements.md sections 10, 11, 13 |
| 2026-10-27T19:14:43Z | T11G | Status IN_PROGRESS (attempt 1); agent orchestrate:architect launched | T11F integrated |
| 2026-10-27T19:16:13Z | T11I | Status IN_PROGRESS (attempt 1) | T11E and T11F integrated |
| 2026-10-27T19:16:28Z | T11I | Status DONE | evidence/T11I-requirements-check.txt RESULT PASS; evidence commit 3a2f8c9; VALIDATED_HEAD 234e29c |
| 2026-10-27T19:16:28Z | T11E | Status DONE | integration commits 4757d4e, 19bfba9; independently verified by T11I |
| 2026-10-27T19:16:28Z | T11F | Status DONE | integration commit 1715e21; independently verified by T11I |
| 2026-10-27T20:00:36Z | T11G | Agent report PASS; verified and integrated at bf7dd40; affected gates run; awaiting T11H and T11J | plan check exit 0 (42 tasks); YAML parses; evidence/T11G-gates.txt |
| 2026-10-27T20:00:36Z | T11H | Status IN_PROGRESS (attempt 1); agent orchestrate:security-reviewer launched (SC-05 delta review) | T11G integrated at bf7dd40 |
| 2026-10-27T20:15:31Z | T11H | Agent report PASS; integrated at 89c721d; design verdict FAIL correctable (T11H-F01, F02 must-fix); addendum pending after T11G correction | design-review-change-1.md; verify-ownership exit 0; evidence/T11H-gates.txt |
| 2026-10-27T20:15:31Z | T11G | Must-fix findings T11H-F01, T11H-F02 and should-fix F03 to F20: targeted correction, attempt 2 | security/design-review-change-1.md section 4 |
| 2026-10-27T20:15:31Z | - | OD-23 (contract pre-release revision, MED-01) and OD-24 (demo and shared-upstream sources are not independent) recorded; escalations E-13 (SC-05 isolation) and E-14 (credential identity re-raise) raised | design-review-change-1.md sections 6, 7, 9 |
| 2026-10-27T20:32:01Z | T11G | Attempt 2 verified and integrated at 58e906a; affected gates PASS; awaiting T11H addendum and T11J | plan check exit 0; YAML parses; evidence/T11G-gates-2.txt |
| 2026-10-27T20:32:01Z | - | OD-23 scope confirmed (F01, F06, F11, F14, F20 contract edits); OD-24 note: R-256 fixture is the test-live test double | T11G attempt 2 escalations |
| 2026-10-27T20:32:01Z | T11H | Attempt 2: addendum confirming the T11G correction requested | T11G attempt 2 integrated at 58e906a |
| 2026-10-27T20:35:15Z | T11H | Attempt 2 addendum PASS; integrated at 1f65fda; change verdict PASS; awaiting T11J | design-review-change-1.md Addendum 1; evidence/T11H-gates-2.txt |
| 2026-10-27T20:35:15Z | - | OD-23 effective (CS-1 condition met); OD-25 recorded (T11H-A1 observations routed to T53 and T49 briefs) | T11H addendum |
| 2026-10-27T20:35:36Z | T49 | Task added from the reconciled plan (T11G); status PENDING | architecture/task-plan.md Reconciliation (T11G) |
| 2026-10-27T20:35:36Z | T50 | Task added from the reconciled plan (T11G); status PENDING | architecture/task-plan.md Reconciliation (T11G) |
| 2026-10-27T20:35:36Z | T51 | Task added from the reconciled plan (T11G); status PENDING | architecture/task-plan.md Reconciliation (T11G) |
| 2026-10-27T20:35:36Z | T52 | Task added from the reconciled plan (T11G); status PENDING | architecture/task-plan.md Reconciliation (T11G) |
| 2026-10-27T20:35:37Z | T53 | Task added from the reconciled plan (T11G); status PENDING | architecture/task-plan.md Reconciliation (T11G) |
| 2026-10-27T20:35:37Z | - | Tracker reconciled with the T11G plan: T12 to T32, T34, T35, T37 to T48 updated (scope, depends on, files owned, acceptance criteria, verification); T33, T36 unchanged; T49 to T53 added before T48; all PENDING with 0 attempts; no task history changed | plan check exit 0 (42 tasks, 0 violations) |
| 2026-10-27T20:54:50Z | T11K | Task added; status IN_PROGRESS (attempt 1) | PO answer recorded as S-005; intake rescan exit 0: 6 analyzed |
| 2026-10-27T20:54:50Z | - | PO decisions PD-15 to PD-20 recorded (recommendations for E-09 to E-14); escalations E-09 to E-14 and conflicts C-1 to C-3 resolved | S-005 |
| 2026-10-27T20:54:50Z | T11L | Task added; status PENDING | change-batch PO decisions follow-up |
| 2026-10-27T20:54:50Z | T11M | Task added; status PENDING | change-batch PO decisions follow-up |
| 2026-10-27T20:54:50Z | T11N | Task added; status PENDING | change-batch PO decisions follow-up |
| 2026-10-27T20:54:50Z | T11J | Dependency T11N added | change-batch PO decisions follow-up |
| 2026-10-27T20:55:14Z | - | Re-plan (MED-05): T11M removed before start because its owned file overlaps the IN_PROGRESS task T11G; its scope becomes T11G attempt 3; T11N no longer depends on T11M | worktree prepare refused T11M (overlap with T11G) |
| 2026-10-27T20:55:14Z | T11G | Attempt 3 (source-of-truth PD-15 to PD-20, delta pending items decided) requested | S-005; re-plan replacing T11M |
| 2026-10-27T20:55:26Z | T11L | Status IN_PROGRESS (attempt 1); agent launched | worktree prepare exit 0 at base 7bc11e2 |
| 2026-10-27T21:10:09Z | T11G | Attempt 3 verified and integrated at b468d07; affected gates PASS; awaiting T11J | plan check exit 0; source-of-truth diff sections 3 to 5; evidence/T11G-gates-3.txt |
| 2026-10-27T21:10:09Z | - | OD-26 (U-28 QA warning check), OD-27 (AD-38 confirmed), OD-28 (U-29 label scope) recorded | architecture-delta.md section 11.13 |
| 2026-10-27T21:18:38Z | T11L | Agent report PASS; verified and integrated at 966a599; affected gates PASS; awaiting T11N | requirements check exit 0; evidence/T11L-gates.txt |
| 2026-10-27T21:18:38Z | - | OD-29 recorded (R-271, R-272 extended statements routed to task briefs) | T11L report |
| 2026-10-27T21:18:38Z | T11N | Status IN_PROGRESS (attempt 1) | T11K, T11L integrated |
| 2026-10-27T21:18:59Z | T11N | Status DONE | evidence/T11N-validate.txt RESULT PASS; evidence commit 18491cd; VALIDATED_HEAD ce746e4 |
| 2026-10-27T21:18:59Z | T11K | Status DONE | integration commit 7bc11e2; independently verified by T11N |
| 2026-10-27T21:18:59Z | T11L | Status DONE | integration commit 966a599; independently verified by T11N |
| 2026-10-27T21:19:00Z | T11J | Status IN_PROGRESS (attempt 1) | T11G, T11H integrated (change verdict PASS); T11I, T11N DONE; tracker reconciled |
| 2026-10-27T21:19:18Z | T11J | Status DONE | evidence/T11J-plan-check.txt RESULT PASS; evidence commit 91e93b4; VALIDATED_HEAD 076fd8e |
| 2026-10-27T21:19:19Z | T11G | Status DONE | integration commits bf7dd40, 58e906a, b468d07; independently verified by T11J |
| 2026-10-27T21:19:19Z | T11H | Status DONE | integration commits 89c721d, 1f65fda; independently verified by T11J |
| 2026-10-27T21:19:19Z | - | Change PD-12 to PD-20 planned; work item ready for execution | T11J evidence |
| 2026-10-27T21:31:35Z | - | Stage 4 started: work-item status EXECUTING; OD-30 (Node.js 22.22.2 LTS) and OD-31 (AD-01 to AD-38 accepted) recorded | orch next: SELECT T12, T13, T15 |
| 2026-10-27T21:31:35Z | T12 | Status IN_PROGRESS (attempt 1); agent orchestrate:architect launched | orch next SELECT |
| 2026-10-27T21:31:35Z | T13 | Status IN_PROGRESS (attempt 1); Orchestrator working | orch next SELECT |
| 2026-10-27T21:31:35Z | T15 | Status IN_PROGRESS (attempt 1); agent orchestrate:backend-developer launched | orch next SELECT |
| 2026-10-27T21:36:06Z | T13 | Status DONE | integration commit 70906b2; evidence/T13-gates.txt PASS; 20 captures |
| 2026-10-27T21:36:15Z | - | Finding: football-data.org General Terms and Conditions are published on /about (attribution clause 7.1, logos 9.2); the earlier no-published-terms statement is corrected; R-316 outdated, carried to T14 and the PO | research/football-data-org/about-and-terms.txt |
| 2026-10-27T21:38:32Z | - | Reconciliation correction (MED-05): the Scope lines of T12, T14, T15, T17, T20, T30, T37, T38, T44, T47, T49, T50, T52, T53 updated to the T11G attempt-3 plan text (missed when the tracker was reconciled after attempt 2); T15 brief updated in flight; no other field changed | plan-vs-tracker diff: only Scope lines differed |
| 2026-10-27T21:38:50Z | T12 | Status DONE | integration commit 6d8830e; evidence/T12-gates.txt PASS |
| 2026-10-27T21:55:34Z | T15 | Status DONE | integration commit 93a4795; evidence/T15-gates.txt PASS; Orchestrator re-run of typecheck, lint, unit (118), integration (3), live; npm ci offline |
| 2026-10-27T21:55:34Z | - | OD-32 (dependency set), OD-33 (moderate fflate advisory accepted), OD-34 (T19 owns the smoke test) recorded | T15 report |
| 2026-10-27T21:55:34Z | T19 | Files owned extended by OD-34 (apps/server/test/integration/smoke/**) | OD-34 |
| 2026-10-27T21:55:48Z | T16 | Status IN_PROGRESS (attempt 1); agent launched | orch next SELECT |
| 2026-10-27T21:55:48Z | T17 | Status IN_PROGRESS (attempt 1); agent launched | orch next SELECT |
| 2026-10-27T21:55:48Z | T18 | Status IN_PROGRESS (attempt 1); agent launched | orch next SELECT |
| 2026-10-27T21:55:48Z | T20 | Status IN_PROGRESS (attempt 1); agent launched | orch next SELECT |
| 2026-10-27T22:10:07Z | T18 | Status DONE | integration commit 20d92b2; evidence/T18-gates.txt PASS; Orchestrator re-verification |
| 2026-10-27T22:12:52Z | - | OD-35 (T16 dependencies) and OD-36 (T28 owns apps/web/src/api/types.ts) recorded | T16 report |
| 2026-10-27T22:12:52Z | T28 | Files owned extended by OD-36 (apps/web/src/api/types.ts) | OD-36 |
| 2026-10-27T22:12:55Z | T16 | Status DONE | integration commit cf0716e; evidence/T16-gates.txt PASS; Orchestrator re-verification |

## Recovery log

| Time (UTC) | Session | Findings | Actions |
|------------|---------|----------|---------|

## Metrics

Filled at close (/Users/waltercordero/Documents/Training/vetclaims-ai-agents/plugins/orchestrate/workflows/measurement.md). Unavailable values are written NOT RECORDED, never estimated.
