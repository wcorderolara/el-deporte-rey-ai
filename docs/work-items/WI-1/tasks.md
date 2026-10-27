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
| Work-item status | PLANNING (change PD-12, PD-13) |

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
| T11G | Architecture delta and plan reconciliation for PD-12, PD-13 and PD-14 | IMPL | architect | T11F | IN_PROGRESS | 2 | - | - |
| T11H | Security design review of the provider and data-mode change | IMPL | security-reviewer | T11G | IN_PROGRESS | 2 | - | - |
| T11I | Change requirements verification | VERIFY | Orchestrator | T11E, T11F | DONE | 1 | 3a2f8c9 | `docs/work-items/WI-1/evidence/T11I-requirements-check.txt` |
| T11J | Change architecture verification | VERIFY | Orchestrator | T11G, T11H, T11I | PENDING | 0 | - | - |
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
- Scope: update the architecture delta, contracts and data model for the football-data.org adapter and the three data acquisition modes; reconcile task-plan.md (preserve T12 to T48 IDs, add tasks only where needed); add PD-12 and PD-13 to the source-of-truth decision register.
- Acceptance criteria: plan check exit 0 (existing-ID warnings expected); every active acceptance criterion named by a task.
- Verification: `orch plan check --plan '<worktree>/docs/work-items/WI-1/architecture/task-plan.md' --tracker '<worktree>/docs/work-items/WI-1/tasks.md' --requirements '<worktree>/docs/work-items/WI-1/requirements.json' --at .` -> exit 0
- Agent result: PASS (files only; agent has no shell), base d862cb9.
- Orchestrator verification: task commit 91cba66 (Orchestrator commit of agent files); `orch worktree verify-ownership` exit 0 (8 changed, 0 outside); contract YAML parses (OpenAPI 3.1.0, 1.0.0-proposed.2, 32 paths, 85 schemas); `orch contracts check` exit 0 (0 declared); `orch plan check --at .` exit 0 (42 tasks, 0 violations, 37 warnings: existing IDs T12 to T48); main working tree unchanged; at 91cba66, 2026-10-27.
- Attempt 2 (correction for T11H-F01 to T11H-F20): task commit 9680066; `orch worktree verify-ownership` exit 0 (8 changed, 0 outside); contract YAML parses (1.0.0-proposed.2, 32 paths, 85 schemas); `orch plan check --at .` exit 0 (42 tasks, 0 violations, 37 existing-ID warnings); 24 tasks changed in attempt 2, no task added; LOW-1 to LOW-8 (contentBase64; provider-neutral references; test-live test double; T53 after T41; T53 evidence via evidence write; defaults; token removed from process.env); 2026-10-27. Agent usage attempt 2: launches 1; tokens 295325; duration 16 minutes.
- Integration commit(s): bf7dd40 (attempt 1), 58e906a (attempt 2); merges --no-ff of task/WI-1/T11G. Affected gates at 58e906a: FW-TRACKER PASS, FW-CONFIG PASS (evidence/T11G-gates-2.txt). Affected gates: evidence/T11G-gates.txt. Verifier: T11J.
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

### T11J: Change architecture verification
- Kind: VERIFY
- Agent: Orchestrator
- Depends on: T11G, T11H, T11I
- Files owned: `docs/work-items/WI-1/evidence/T11J-plan-check.txt`
- Scope: run the plan check at the integration HEAD after the reconciled tracker is committed and record the evidence.
- Acceptance criteria: evidence `RESULT: PASS`.
- Verification: `orch plan check --plan ... --tracker ... --requirements ... --at '<integration worktree>'` -> exit 0

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

## Conflicts

| ID | Sources in conflict | Resolution (higher source wins) | Follow-up |
|----|---------------------|---------------------------------|-----------|
| C-1 | S-000 single competition and selection flow (R-021, R-101, R-102, R-201) vs S-003 and S-004 multi-competition and manual competitions (R-072, R-137, R-138, R-243); both level 1 | Applied provisionally: later PO statements S-003, S-004 govern; earlier records superseded | Conflict between level-1 sources is HIGH: PO confirmation requested (E-11) |
| C-2 | R-026, R-047 (two-source rule, block unverified) vs R-071 (MANUALLY_APPROVED status); both level 1 | Not decided by any source; R-026 applies until decided | R-429 to the PO (E-09) |
| C-3 | PD-09 league-phase-only and mandatory standings slide (R-417, R-239, R-210) vs S-004 stages and different tournament structures (R-439, R-284, R-285); both level 1 | Applied provisionally: S-004 governs; earlier records superseded | Conflict between level-1 sources is HIGH: PO confirmation requested (E-12) |

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
| E-09 | T11F | HIGH decision: R-429 publication eligibility of MANUALLY_APPROVED facts (HIGH-07; conflict C-2) | 2026-10-27 | open |
| E-10 | T11F | HIGH decision: R-430 confirmation of republishing permission for football-data.org content (HIGH-05, HIGH-07) | 2026-10-27 | open |
| E-11 | T11F | HIGH decision: confirm conflict C-1 resolution (multi-competition supersedes single competition) (precedence.md: level 1 conflict) | 2026-10-27 | open |
| E-12 | T11F | HIGH decision: confirm conflict C-3 resolution (generic stages supersede league-phase-only, PD-09) (precedence.md: level 1 conflict) | 2026-10-27 | open |
| E-13 | T11H | HIGH decision: SC-05 isolation of untrusted-input processing for FootballDataProvider responses and for the JSON, CSV and form imports (HIGH-03; reviewer recommends option A for both, with conditions) | 2026-10-27 | open |
| E-14 | T11H | HIGH decision: identity-model re-raise for the real credential (T10-F19, Q5): any local process can spend the token request budget through the login-less API (HIGH-03; reviewer recommends option A) | 2026-10-27 | open |

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

## Recovery log

| Time (UTC) | Session | Findings | Actions |
|------------|---------|----------|---------|

## Metrics

Filled at close (/Users/waltercordero/Documents/Training/vetclaims-ai-agents/plugins/orchestrate/workflows/measurement.md). Unavailable values are written NOT RECORDED, never estimated.
