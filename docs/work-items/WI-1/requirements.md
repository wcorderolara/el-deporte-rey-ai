# WI-1: El Deporte Rey GT AI sports content platform (MVP)

| Field | Value |
|-------|-------|
| Work item | WI-1 |
| Mode | incremental (as in the current intake record; the document keeps the full structure written at T01) |
| Starting point | SP-4 (several documents: the inline launch text S-000 and the Product Owner decision records S-001, S-002, S-003 and S-004); override: none |
| Records file | `docs/work-items/WI-1/requirements.json` |
| Intake record | `docs/work-items/WI-1/intake/intake-record.json` |
| Language | en |
| Revision | T04 (2026-10-27): Product Owner decisions PD-01 to PD-09 (S-001) applied as an incremental update of the T01 requirements. T11B (2026-10-27): PD-10 and PD-11 (S-002) recorded. T11F (2026-10-27): PD-12 and PD-13 (S-003, sports-data provider and data acquisition modes) and PD-14 (S-004, multi-competition scope clarification) recorded as an incremental update. No record ID was removed or renumbered; replaced records are marked superseded with a pointer |

## Sources

| Source ID | Path | Type | Precedence level | Hash |
|-----------|------|------|------------------|------|
| S-000 | `docs/work-items/WI-1/intake/sources/inline-001.md` | frd (inline record of the Product Owner launch text) | 1 | `b55dc299ab338c57d3555a183ccd11336c6f97bd79708a1f2737e7bdd6251aa2` |
| S-001 | `docs/work-items/WI-1/intake/sources/po-decisions-2026-10-27.md` | decision-record (Product Owner decisions of 2026-10-27) | 1 | `de838ea30275c967d31e8e6886da138ca4a5c18f876f991f239c6df39cd952d9` |
| S-002 | `docs/work-items/WI-1/intake/sources/po-decisions-2026-10-27-stage2.md` | decision-record (Product Owner stage-2 decisions of 2026-10-27, answering escalations E-07 and E-08) | 1 | `99d18619acb2134b7c2c01e9569863fa4d425762fc3059a05fe5ad1693066512` |
| S-003 | `docs/work-items/WI-1/intake/sources/po-change-2026-10-27-provider-and-modes.md` | decision-record (Product Owner change of 2026-10-27: football-data.org provider and data acquisition modes) | 1 | `4eeb482afc7fcc61d159371d3ea02e0da9e7445079162ac5a94aeebeea9a511f` |
| S-004 | `docs/work-items/WI-1/intake/sources/po-scope-clarification-2026-10-27-multi-competition.md` | decision-record (Product Owner scope clarification of 2026-10-27: multi-competition platform) | 1 | `5eae4c9303d5cdd5f5506ae6cd65770194262eff494dfb2a068e57265de059e3` |

The intake record lists five inputs (SP-4) and sets mode `incremental`. Records cite S-000, S-003 and S-004 by heading and line range, and S-001 and S-002 by line range (they have no headings). For S-003 the heading is the section title (the two "Execution" sections and the two architecture sections are told apart by their parent title or name); for S-004 the first-line heading is used for its opening paragraph. No source has requirement identifiers of its own, so every record has `originalId: null`. The architecture proposal, its security design review and the source-of-truth decision register are not intake sources; this document cites them only in basis text. The football-data.org documentation reviewed by the Orchestrator on 2026-10-27 is not an intake source either: it is cited only in basis text and `ext:` references of assumptions and of R-437, never as a requirement by itself.

Product Owner decision IDs (tracker Decisions table) and their source lines:

| Decision | Source and lines | Applies to |
|----------|------------------|------------|
| PD-01 | S-001 3-11 | R-410 (option c): R-045, R-046, R-110, R-111, R-400, R-401 |
| PD-02 | S-001 13-19 | R-411 (option a): R-025, R-047, R-048, R-423, R-424 |
| PD-03 | S-001 21-23 | R-413 (option c): R-034, R-049, R-050, R-309 |
| PD-04 | S-001 25-27 | R-414 (option a): R-112, R-308; applied to the new inputs by R-119 |
| PD-05 | S-001 29-31 | R-415 (option a): R-113, R-114, R-300 |
| PD-06 | S-001 33-35 | R-416 (language c, names i): R-035, R-051, R-052, R-425, R-426 |
| PD-07 | S-001 39 | Default branch `main`: a project fact, not a product requirement; no record |
| PD-08 | S-001 40-42 | Frontend required: confirms R-020 |
| PD-09 | S-001 43-46 | Confirms R-408 (1080 x 1350), R-405, R-417 (league phase only; superseded by R-439 under PD-14) and R-042 |
| PD-10 | S-002 1 ("E-07 A") | R-427: R-115, R-116 (R-116 amended in T11F) |
| PD-11 | S-002 1 ("E-08 ...") | R-428: R-117 |
| PD-12 | S-003 11-147, 173-195 | football-data.org API v4 as preferred primary provider: R-012, R-053 to R-055, R-120 to R-136, R-400 (reclassified), R-432, R-436, R-437; ACs R-244 to R-266, R-271, R-281 |
| PD-13 | S-003 229-310 | Data acquisition modes, manual import, statuses: R-011, R-013, R-056 to R-071, R-118, R-119, R-431, R-433 to R-435, R-438; ACs R-267 to R-280 |
| PD-14 | S-004 3-112 | Dynamic multi-competition platform: R-014, R-072 to R-077, R-137 to R-141, R-439, R-440; ACs R-243, R-282 to R-291 |

Reading notes:
- The "Research Agent", "Fact-Checking Agent", "Content Agent", "Graphic Design Agent" and "Visual QA Agent" of S-000 are **product features** (stages inside the product), not framework roles (R-302).
- Process directions to the framework (S-000 "Orchestration"; S-001 "Execution" and closing lines; S-003 "Incremental Task Reconciliation", both "Execution" sections and "Expected Output"; S-004 "Incremental Planning") are not product requirements. They are listed in section 12.
- Where a source says the same thing more than once, the statements are merged into one record that cites every location. No source reference was dropped; superseded records keep their source references, and each replacing record carries them too.
- When S-001 or S-002 chooses an option by letter or by reference, the option text written in the question record is part of what was decided.
- S-003 and S-004 are later Product Owner statements at the same precedence level as S-000 and S-001. Where they change scope, the earlier records are superseded, not deleted (conflicts C-1 and C-3, section 11).

## 1. Business context

El Deporte Rey GT (social handle @ElDeporteReyGT, mascot KETSI) publishes sports content on social media. The Product Owner wants an AI-assisted platform that researches sports events, verifies the facts, prepares social media content and generates professional visual assets for publication (S-000 lines 5-10, 67-71). The first use case is UEFA Champions League matchday coverage (line 12), delivered as a local-first MVP that produces Instagram carousels for manual publication (lines 99-105). The Product Owner has set the data sources, the verification rule, the use of marks, the data scope, the user model and the content language (S-001, PD-01 to PD-06), and, at stage 2, the handling of untrusted input and the evolution policy of the HTTP API contract (S-002, PD-10 and PD-11).

T11B scope (incremental): PD-10 accepts in-process processing of untrusted input for WI-1's scope with compensating controls (R-115) and makes a new security review and Product Owner decision a precondition for real sports-data adapters, hosted AI providers and new input types (R-116). PD-11 sets the contract-evolution policy of the HTTP API contract (R-117).

T11F scope (incremental): PD-12 selects football-data.org API v4 as the preferred primary sports-data provider (R-053), with credential rules (R-120 to R-127), runtime validation, error handling, bounded retries, rate-limit handling, caching and safe logging (R-128 to R-133), contract tests and optional credential-safe live tests (R-134, R-135), capability and licensing verification (R-136), and the two-source policy preserved (R-055). PD-13 adds the data acquisition modes LIVE_DATA, MANUAL_DATA and DEMO_DATA (R-056 to R-059, R-118), the manual import rules (R-060 to R-069) and the statuses VERIFIED, UNVERIFIED and MANUALLY_APPROVED (R-070, R-071). PD-14 (S-004) clarifies that the platform is dynamic and multi-competition: the UEFA Champions League is only the initial validation scenario and never a hardcoded dependency (R-073 to R-077, R-137 to R-141).

## 2. Problem statement

S-000 states no explicit problem. Derived from the vision and the quality requirements (lines 5-10, 86-95): the brand needs matchday coverage content that is produced quickly, looks professional and consistent, and never contains invented or unverified scores, standings or names, with every published fact traceable to an attributable source and nothing published without explicit human approval. S-004 adds that this must work across competitions and tournament formats, not for one competition only.

## 3. Personas

| Persona | Description | Record |
|---------|-------------|--------|
| Content operator | The only platform user in the MVP ("the user" of S-000): creates projects, chooses competition, season, matchday or stage and data source, supplies manual data for competitions without a public API, runs research, reviews, regenerates, approves and exports. A single local operator without login (PD-05). | R-300, R-113, R-114, R-011, R-014 |
| Audience (indirect) | Followers of @ElDeporteReyGT who see the manually published carousels. Not a platform user. | R-300 |

## 4. User stories

User stories are stored as functional records with the prefix "User story US-nn"; the functional requirements of section 5 refine them. New in T11F: R-011 to R-014.

| Record ID | Story | Sources |
|-----------|-------|---------|
| R-001 | US-01: As the content operator, I want to create a content project in a web interface by selecting a competition, season and matchday, so that the platform prepares coverage of that matchday. | S-000 Primary Workflow 16; Functional Requirements 54-55 |
| R-002 | US-02: As the content operator, I want the platform to research the selected matchday (results, teams and scores, dates, standings and competition context) and to show me the progress of the research, so that I receive structured, source-attributed data without collecting it by hand. | S-000 Primary Workflow 18-23; Functional Requirements 56-57 |
| R-003 | US-03: As the content operator, I want every fact to be verified independently against reliable sources and marked as verified or not verified, so that content with invented or unverified scores, standings or statistics cannot be approved. | S-000 Primary Workflow 25-26; Functional Requirements 58; Quality Requirements 86-90 |
| R-004 | US-04: As the content operator, I want the platform to draft the carousel structure, headlines, slide descriptions, social media caption and hashtags from the verified data, so that I start my review from a complete draft. | S-000 Primary Workflow 28-33 |
| R-005 | US-05: As the content operator, I want cover, match-result, standings and closing slides generated in the El Deporte Rey GT visual identity from reusable templates, so that every post looks professional and consistent. | S-000 Primary Workflow 35-39; Functional Requirements 59; Branding 67-77 |
| R-006 | US-06: As the content operator, I want an automated visual quality check of every slide before my review, so that wrong scores, standings or team names, overflowing text, inconsistent visuals and wrong dimensions are caught. | S-000 Primary Workflow 41-46 |
| R-007 | US-07: As the content operator, I want to preview the carousel and captions, regenerate individual slides and explicitly approve the content, so that nothing I have not approved can be exported. | S-000 Primary Workflow 48; Functional Requirements 60-61; Quality Requirements 94 |
| R-008 | US-08: As the content operator, I want to export the approved images and captions, so that I can publish them manually on Instagram. | S-000 Primary Workflow 50; Functional Requirements 62; Quality Requirements 95 |
| R-009 | US-09: As the content operator, I want a history of generated content with traceability from each exported slide back to its source data, so that I can revisit past content and show where every fact came from. | S-000 Functional Requirements 63; Quality Requirements 93 |
| R-010 | US-10: As the content operator, I want to manage reusable brand assets and carousel templates, and to have brand assets used only when they have actually been provided, so that the brand is applied consistently without placeholder or invented assets. | S-000 Functional Requirements 59; Branding 79-82 |
| R-011 | **New.** US-11: As the content operator, I want to supply match results, standings and competition, season and matchday data as JSON or CSV files or through a form in the web interface, so that I can cover competitions that have no public API (initial example: Liga Nacional de Guatemala). | S-003 MANUAL_DATA 247-258; Manual Import Requirements 273-284 |
| R-012 | **New.** US-12: As the content operator, I want the platform to retrieve competition data from football-data.org and to show for every fact whether it is VERIFIED, UNVERIFIED (for example awaiting independent verification) or MANUALLY_APPROVED, so that I know which facts are confirmed and which content can be approved. | S-003 Provider Selection 11-32; Fact-Checking 110-125; Verification and Approval 286-297 |
| R-013 | **New.** US-13: As the content operator, I want a demonstration mode that runs the whole workflow on deterministic synthetic data, so that the platform can be developed, tested and demonstrated without a provider account or real data. | S-003 DEMO_DATA 260-263; Testing 175 |
| R-014 | **New.** US-14: As the content operator, I want to pick any competition from one catalogue built from the configured providers and manual sources, then its season, its matchday or stage and one of its available data sources, so that I can cover different competitions and tournament formats with the same workflow. | S-004 Dynamic Competition Discovery 28-44; User Experience 80-94 |

## 5. Functional requirements and business rules

Changed in T04: R-020, R-022, R-025, R-034, R-035, R-042, R-045; new in T04: R-046 to R-052. Changed in T11F: R-021 superseded by R-072; R-022 (relationships to R-054, R-056, R-074, R-072); R-030 (reference to R-077); R-046 (S-003 source; football-data.org fills the primary role). New in T11F: R-053 to R-077. The JSON records hold the full statements; the table summarizes the new ones.

| Record ID | Original ID | Type | Statement | Sources (heading, lines) | Relationships |
|-----------|-------------|------|-----------|--------------------------|---------------|
| R-020 | - | functional | Web interface for managing content projects: create a project, list existing projects, open a project. A frontend is required (PD-08). | S-000 Functional Requirements 54; S-001 40 | refines R-001 |
| R-021 | - | functional | **Superseded in T11F by R-072 (conflict C-1).** When creating a project the user selects competition, season and matchday; in the MVP the only competition is the UEFA Champions League (seasons and phases: R-417). | S-000 Product Vision 12; Primary Workflow 16; Functional Requirements 55; Initial Scope 102 | refines R-001; references R-417 |
| R-022 | - | functional | The Research Agent retrieves, for the selected matchday: match results; teams and scores; match dates; competition standings; relevant competition context. | S-000 Primary Workflow 18-23; S-001 3-5 | refines R-002; depends-on R-021, R-072; depends-on ext: sports-data providers per PD-01; references R-054, R-056, R-074 |
| R-023 | - | functional | The user starts research from the project and follows its progress: each workflow stage is shown as pending, running, completed or failed; a failed stage reports its reason. | S-000 Functional Requirements 56 | refines R-002 |
| R-024 | - | functional | Research results are structured records; each fact carries source attribution (source, reference to its location in the source, retrieval time). | S-000 Functional Requirements 57-58; Quality Requirements 87 | refines R-002 |
| R-025 | - | functional | The Fact-Checking Agent independently verifies all factual information against reliable sources and records per fact: verified or not, sources used, reason when not verified. Verification rule: R-047 and R-048 (PD-02) for scores, match dates and standings; R-424 for other facts. | S-000 Primary Workflow 25-26; Functional Requirements 58; S-001 13-19 | refines R-003; depends-on R-024; references R-411, R-047, R-048, R-424 |
| R-026 | - | business-rule | If a fact cannot be verified, publication approval is blocked for the content affected by that fact (every slide, headline, slide description or caption that uses it) until it is verified; content that does not use the fact is not blocked. | S-000 Quality Requirements 89-90 | refines R-003; depends-on R-025; references R-412 |
| R-027 | - | business-rule | Never invent scores, standings or match statistics: every such value in generated content comes from the verified data; content containing such a value not in the verified data is flagged and cannot be approved. | S-000 Quality Requirements 86-90 | refines R-003; depends-on R-025; references R-422 |
| R-028 | - | functional | Verified facts are clearly distinguished from AI-generated commentary; each content element is identified as one or the other (presentation: R-404). | S-000 Quality Requirements 88 | refines R-003; references R-404 |
| R-029 | - | functional | The Content Agent prepares, from the verified data: carousel structure, headlines, slide descriptions, social media captions, relevant hashtags. | S-000 Primary Workflow 28-33 | refines R-004; depends-on R-025; depends-on ext: AI provider (R-401) |
| R-030 | - | functional | The Graphic Design Agent creates a cover slide, individual match-result slides (one per match), standings slides and a closing slide (standings slides only when the selection has standings: R-077). | S-000 Primary Workflow 35-39 | refines R-005; depends-on R-029, R-031; references R-407, R-077 |
| R-031 | - | functional | Slides are produced from reusable branded carousel templates, reused across projects and matchdays. | S-000 Functional Requirements 59; Branding 79; Technical Direction 119 | refines R-005, R-010 |
| R-032 | - | functional | Templates apply the brand identity: El Deporte Rey GT, @ElDeporteReyGT, mascot KETSI (images only when provided), colours purple, gold, blue and white. | S-000 Branding 67-77 | refines R-005; references R-418 |
| R-033 | - | functional | Reusable brand assets: provided assets are registered once and reused by templates across projects. | S-000 Branding 79 | refines R-010 |
| R-034 | - | business-rule | Logos, team badges and mascot images are not assumed to exist and are used only when provided; templates produce complete slides without them. | S-000 Branding 81-82; S-001 21-23 | refines R-010; references R-413, R-049, R-050 |
| R-035 | - | business-rule | Generated visuals preserve the exact verified scores and names (team names: the verified official names, R-052). | S-000 Quality Requirements 92; S-001 33-35 | refines R-005; references R-416, R-052 |
| R-037 | - | functional | The Visual QA Agent checks every slide: scores and standings match verified data; team names are correct; text fits the layout; visual consistency; configured social media dimensions. Failure handling: R-420. | S-000 Primary Workflow 41-46 | refines R-006; depends-on R-025, R-030; references R-408, R-420 |
| R-038 | - | functional | Before approving, the user previews the carousel with captions and hashtags. | S-000 Primary Workflow 48; Functional Requirements 60 | refines R-007 |
| R-039 | - | business-rule | Explicit user approval is required before any content can be exported; only approved assets can be exported (granularity: R-405; after a change: R-406). | S-000 Primary Workflow 50; Functional Requirements 60; Quality Requirements 94 | refines R-007; references R-405, R-406 |
| R-040 | - | functional | The user can regenerate an individual slide without regenerating the other slides. | S-000 Functional Requirements 61 | refines R-007; references R-406 |
| R-041 | - | functional | The user exports approved assets for manual publication: slide images and captions with hashtags. | S-000 Primary Workflow 50; Functional Requirements 62 | refines R-008; depends-on R-039; references R-421 |
| R-042 | - | constraint | The MVP does not publish automatically to any social platform (confirmed by PD-09). | S-000 Quality Requirements 95; Initial Scope 105; S-001 46 | refines R-008 |
| R-043 | - | functional | History of generated content: past projects with their slides, captions, approval state and exports can be listed and reopened. | S-000 Functional Requirements 63 | refines R-009; references R-419 |
| R-044 | - | functional | Traceability from source data to exported slides: for every exported slide, its facts, their verification status and their sources can be retrieved. | S-000 Quality Requirements 93; Functional Requirements 57 | refines R-009; depends-on R-024, R-025 |
| R-045 | - | business-rule | Facts are taken only from trustworthy, attributable data sources; the accepted sources are those of PD-01 (R-046). | S-000 Quality Requirements 87; Primary Workflow 25-26; S-001 3-5 | refines R-003; references R-410, R-411, R-046 |
| R-046 | - | business-rule | Accepted data sources (PD-01): licensed sports-data API as preferred primary source, independent official source for verification; only accepted sources can make a fact verified. **Changed in T11F:** football-data.org API v4 fills the primary role (PD-12, R-053); the verification source is still to be approved (R-055, R-432); manual data is not an accepted source (R-071). | S-001 3-5; S-000 Quality Requirements 87; Primary Workflow 25-26; S-003 Fact-Checking 112-117 | refines R-045; references R-410, R-400, R-111, R-053, R-055, R-071 |
| R-047 | - | business-rule | A score, a match date or a standings value is verified only when two independent accepted sources (R-046) agree on it. | S-001 13-15; S-000 Primary Workflow 25-26 | refines R-025; references R-411, R-046 |
| R-048 | - | business-rule | When accepted sources disagree, the fact is disputed and not verified; the official competition publication is consulted (R-311); not verified until resolved (R-423); content stays blocked (R-026); no manual verification (R-412). | S-001 17-19; S-000 Quality Requirements 89-90 | refines R-025; depends-on R-047; references R-411, R-423, R-311, R-026, R-412 |
| R-049 | - | business-rule | Team names and the competition name appear as text; only authorized brand assets (R-309); no unauthorized logo, club badge or competition mark. | S-001 21-23; S-000 Branding 81-82 | refines R-010; references R-413, R-034, R-309 |
| R-050 | - | functional | Templates reserve optional badge slots, which stay empty while no authorized badge exists; slides remain complete. | S-001 21-23; S-000 Branding 81-82 | refines R-005; references R-413, R-034, R-309 |
| R-051 | - | functional | Each project has a content language, configurable per project, Spanish by default (selectable languages: R-425). | S-001 33-34; S-000 Primary Workflow 28-33 | refines R-004; references R-416, R-425, R-310 |
| R-052 | - | business-rule | Team names are shown exactly as the verified official names in every content language (R-426). | S-001 33-35; S-000 Primary Workflow 43; Quality Requirements 92 | refines R-035; references R-416, R-426 |
| R-053 | - | functional | **New (PD-12).** football-data.org API v4 (base URL https://api.football-data.org/v4) is the preferred primary provider and first concrete adapter (FootballDataProvider, LIVE_DATA). Initial reference competition: UEFA Champions League (provider code CL, ID 2001), held as adapter configuration, not domain constants (R-139). Fills the primary role, not the verification role (R-055). Introduced only after the R-116 review and isolation decision. | S-003 Provider Selection 11-32; Architecture Requirements 56-59; LIVE_DATA 240-245; S-004 Dynamic Competition Discovery 43-44 | refines R-046, R-012; depends-on R-116; references R-118, R-139 |
| R-054 | - | functional | **New (PD-12).** For every competition the provider offers: competition discovery, available seasons, matchday or stage selection, match results, match status, team names, standings, source metadata, retrieval timestamps. Endpoint choice: R-437. Field or season support only after confirmation against the actual API (R-136). | S-003 Architecture Requirements 64-77; API Integration 79-88; S-004 Dynamic Competition Discovery 30-37 | refines R-022; depends-on R-053; references R-024, R-136, R-437, R-073 |
| R-055 | - | business-rule | **New (PD-12).** Two-source policy preserved: until a secondary source is approved and available (R-432), research may use football-data.org alone; results are UNVERIFIED 'awaiting independent verification', never fully verified, and never publication-approvable on that single source. | S-003 Fact-Checking 110-125; S-001 13-15 | refines R-047; references R-026, R-070, R-432 |
| R-056 | - | functional | **New (PD-13).** Three data acquisition modes: LIVE_DATA, MANUAL_DATA, DEMO_DATA. A project uses one data source of its competition (R-431, R-076); mode and source are recorded on the project and every fact. | S-003 229-232; Supported Modes 238-263; S-004 Multiple Data Sources 46-52 | refines R-002; references R-431, R-053, R-057, R-058, R-076 |
| R-057 | - | functional | **New (PD-13).** MANUAL_DATA: JSON files, CSV files or web-form entry; supports competitions without a public API (initial example Liga Nacional de Guatemala, format R-434); manual competitions appear in the same catalogue (R-073); imports follow R-060 to R-069 and R-119; introduced only after the R-116 review and isolation decision. | S-003 MANUAL_DATA 247-258; S-004 Multiple Data Sources 54-55 | refines R-011; depends-on R-116; references R-434, R-020, R-119, R-073 |
| R-058 | - | functional | **New (PD-13).** DEMO_DATA: deterministic synthetic fixtures (FixtureDataProvider) for development, testing and demonstrations; default of the development configuration and of the default test suite; demonstration content labelled (R-438). | S-003 DEMO_DATA 260-263; Testing 175; S-001 9 | refines R-013, R-110; references R-438 |
| R-059 | - | functional | **New (PD-13, PD-14).** All modes and adapters produce the same normalized, runtime-validated domain representation built on the provider-neutral concepts of R-140; downstream stages do not depend on mode, provider or competition. | S-003 Unified Data Model 265-271; Architecture 309-310; S-004 Provider Independence 61-78 | refines R-104; references R-118, R-105, R-140 |
| R-060 | - | functional | **New.** Manual import rule 1: runtime schema validation of JSON, CSV and form data before storage or use. | S-003 Manual Import Requirements 275 | refines R-057; references R-105 |
| R-061 | - | functional | **New.** Manual import rule 2: clear validation errors naming file or form, record, field and problem. | S-003 Manual Import Requirements 276 | refines R-057 |
| R-062 | - | functional | **New.** Manual import rule 3: malformed or incomplete records are rejected, not stored or used (whole-import rule: R-435). | S-003 Manual Import Requirements 277 | refines R-057; references R-435 |
| R-063 | - | business-rule | **New.** Manual import rule 4: duplicate match records are prevented (identity: R-435). | S-003 Manual Import Requirements 278 | refines R-057; references R-435 |
| R-064 | - | functional | **New.** Manual import rule 5: competition, season and matchday (or stage) metadata, used by project selection. | S-003 Manual Import Requirements 279 | refines R-057; references R-072, R-434 |
| R-065 | - | functional | **New.** Manual import rule 6: match results and team-level standings. | S-003 Manual Import Requirements 280 | refines R-057 |
| R-066 | - | functional | **New.** Manual import rule 7: the original imported data is preserved unchanged and linked; rejected imports are not stored. | S-003 Manual Import Requirements 281 | refines R-057; references R-119 |
| R-067 | - | functional | **New.** Manual import rule 8: import timestamp and source metadata (channel, file name, declared source); every fact carries this attribution. | S-003 Manual Import Requirements 282; Verification and Approval 297 | refines R-057; references R-024 |
| R-068 | - | functional | **New.** Manual import rule 9: correct and reimport; new version; earlier versions retrievable; approvals and MANUALLY_APPROVED statuses of changed facts do not carry over. | S-003 Manual Import Requirements 283 | refines R-057; references R-406, R-435 |
| R-069 | - | business-rule | **New.** Manual import rule 10, for every mode: missing scores or standings are never invented, filled or derived. | S-003 Manual Import Requirements 284; S-000 Quality Requirements 86 | refines R-027 |
| R-070 | - | business-rule | **New (PD-13).** Every fact is VERIFIED, UNVERIFIED (with a reason) or MANUALLY_APPROVED (mapping: R-433). | S-003 Verification and Approval 286-292; S-001 13-19 | refines R-025; references R-047, R-048, R-071, R-433 |
| R-071 | - | business-rule | **New (PD-13).** Manual approval is never independent verification: never shown, stored, exported or traced as VERIFIED; manual data is not an accepted source and never counts toward R-047; only MANUAL_DATA facts can be manually approved (not LIVE_DATA or disputed facts, R-412); audit preserved. Publication effect open (R-429); until decided, R-026 applies. | S-003 Verification and Approval 294-297; S-000 Quality Requirements 89-90; S-001 13-15 | refines R-070; references R-412, R-429, R-026, R-046; conflicts-with R-026 (C-2) |
| R-072 | - | functional | **New in T11F (replaces R-021).** The operator selects a competition from the catalogue (R-073), a season, a matchday or stage (R-074) and an available data source (R-076, R-431); the catalogue holds the LIVE_DATA provider competitions (UEFA Champions League as initial reference scenario), the MANUAL_DATA competitions (Liga Nacional de Guatemala) and, in DEMO_DATA configurations, the fixture competitions; nothing is hardcoded (R-139). | S-000 Product Vision 12; Primary Workflow 16; Functional Requirements 55; Initial Scope 102; S-003 Provider Selection 28-32; MANUAL_DATA 255-258; S-004 User Experience 82-87 | supersedes R-021; refines R-001, R-014; references R-439, R-431, R-434 |
| R-073 | - | functional | **New (PD-14).** Dynamic competition catalogue from every configured LIVE_DATA provider, plus MANUAL_DATA and DEMO_DATA competitions, in one selectable list with each entry's data sources; the named competitions are examples, not an allow-list. | S-004 Competition Support 11-26; Dynamic Competition Discovery 30-34; Multiple Data Sources 54-55 | refines R-014; references R-141 |
| R-074 | - | functional | **New (PD-14).** Seasons, then matchdays or equivalent stages, then matches, results and (where provided) standings; different tournament structures through the same flow (R-439). | S-004 Dynamic Competition Discovery 35-38; User Experience 85-88 | refines R-022; references R-439 |
| R-075 | - | functional | **New (PD-14).** Unavailable competitions, unsupported features and subscription restrictions are detected and shown with a reason; nothing invented; other competitions unaffected. | S-004 Dynamic Competition Discovery 39-40 | refines R-073; references R-069, R-136 |
| R-076 | - | business-rule | **New (PD-14).** A competition may have one or more configured data sources; the operator chooses one (R-431); the source used is recorded on the project, every retrieval and every fact. | S-004 Multiple Data Sources 57-59; User Experience 87-89 | refines R-056; references R-431, R-024 |
| R-077 | - | functional | **New (PD-14).** The interface and the content workflow assume no single format: a matchday or stage without standings shows matches and results, states that standings are not available and gets a carousel without a standings slide; names of stages as the source gives them; all workflows reusable across competitions. | S-004 User Experience 88-94; Scope Clarification 107-109 | refines R-030, R-014; references R-069 |

## 6. Non-functional requirements and constraints

New in T04: R-110 to R-114. New in T11B: R-115 to R-117. Changed in T11F: R-101 superseded by R-137; R-102 superseded by R-138; R-109 (reference to R-137); R-110 (DEMO_DATA default, optional live tests outside the default suite; S-003 sources); R-111 (includes upgrading a football-data.org subscription; S-003 source); R-116 (the PD-10 condition now applies within WI-1). New in T11F: R-118 to R-141 (R-137 and R-138 replace R-101 and R-102).

| Record ID | Original ID | Type | Statement | Sources (heading, lines) | Relationships |
|-----------|-------------|------|-----------|--------------------------|---------------|
| R-036 | - | non-functional | Numeric information is rendered deterministically: the same verified data and template always produce the same numeric text; numbers are never produced by a non-deterministic generation step. | S-000 Quality Requirements 91 | refines R-005; references R-402 |
| R-100 | - | constraint | The MVP is local-first: the platform and its data run on the user's local machine (provider access: R-306). | S-000 Initial Scope 99 | references R-306 |
| R-101 | - | constraint | **Superseded in T11F by R-137 (conflict C-1).** MVP priorities in order: (1) one competition, UEFA Champions League; (2) matchday results and standings; (3) Instagram carousel generation; (4) manual approval and export. | S-000 Product Vision 12; Initial Scope 101-105 | - |
| R-102 | - | non-functional | **Superseded in T11F by R-138 (conflict C-1).** The design supports future extension to more competitions, more social platforms and automated publishing; these are not part of the MVP. | S-000 Initial Scope 107-108 | references R-109 |
| R-103 | - | constraint | The technology stack is not prescribed; the Architect proposes it based on these requirements. | S-000 Technical Direction 112-113 | - |
| R-104 | - | non-functional | Modular architecture with testable agent boundaries: each workflow stage has defined inputs and outputs and can be tested in isolation. | S-000 Technical Direction 116, 118; Primary Workflow 18-46 | references R-302 |
| R-105 | - | non-functional | Strong runtime validation of provider data and of data exchanged between stages; invalid data is rejected and not used. | S-000 Technical Direction 117 | - |
| R-106 | - | non-functional | Provider abstraction: AI and sports-data providers are configurable and replaceable by configuration without changing the workflow stages. | S-000 Technical Direction 120, 123 | references R-400, R-401 |
| R-107 | - | non-functional | Automated tests cover the workflow stages and the business rules of this document. | S-000 Technical Direction 121 | - |
| R-108 | - | non-functional | The platform can be developed, run and tested on a local machine. | S-000 Technical Direction 122 | - |
| R-109 | - | constraint | Avoid unnecessary infrastructure and premature complexity: no component that the MVP scope (R-101, now R-137) does not need. | S-000 Technical Direction 125 | references R-101, R-137 |
| R-110 | - | constraint | During development, research and verification run on synthetic fixture data through the provider abstraction (R-106), not on real provider data; the default automated test suite uses synthetic fixtures only (R-225). **Changed in T11F:** this is DEMO_DATA (R-058); optional live integration tests (R-135), run only when explicitly enabled, are outside the default suite. | S-001 9; S-000 Technical Direction 121-122; S-003 Testing 175, 194-195 | references R-410, R-106, R-225, R-058, R-135 |
| R-111 | - | constraint | No service is purchased or subscribed to without the Product Owner's authorization. **Changed in T11F:** includes purchasing or upgrading a football-data.org subscription (PD-12). | S-001 11; S-003 Provider Availability and Licensing 147 | references R-410, R-400, R-401 |
| R-112 | - | constraint | The MVP is limited to team-level and competition-level data; no player-level information; no personal data of users (R-113). | S-001 25-27; S-000 Primary Workflow 18-23 | references R-414, R-308, R-113 |
| R-113 | - | constraint | Single local operator and no login: no user accounts, sign-in or user management. | S-001 29-30; S-000 Initial Scope 99 | references R-415, R-300, R-114 |
| R-114 | - | constraint | Security: every network service the platform starts listens only on the loopback interface. | S-001 29-31; S-000 Initial Scope 99 | references R-415, R-113, R-100 |
| R-115 | - | constraint | Security (PD-10): in-process processing of untrusted input accepted within WI-1's T11B scope (synthetic fixtures, stub or local AI, operator PNG or JPEG brand files) with the compensating controls; limited to that scope (R-116). | S-002 1; S-000 Technical Direction 117 | references R-427, R-116, R-105, R-110, R-033, R-401 |
| R-116 | - | constraint | Security (PD-10 condition): a real sports-data adapter, a hosted AI provider or a new input type needs a new security review and a new PO isolation decision before it is introduced. **Changed in T11F:** PD-12 and PD-13 bring FootballDataProvider (R-053) and new input types (JSON and CSV files, web-form entry, R-057) into WI-1, so the condition applies within WI-1; the T11B reading checked by control V-30 no longer holds. | S-002 1; S-003 Architecture Requirements 58-59; MANUAL_DATA 249-253 | references R-427, R-115, R-111, R-400, R-401, R-110, R-053, R-057 |
| R-117 | - | constraint | Contract-evolution policy (PD-11): additive-only within v1; breaking changes need a new major path and a PO decision. | S-002 1 | references R-428, R-020 |
| R-118 | - | non-functional | **New (PD-12, PD-13).** Provider-independent ingestion interface with FootballDataProvider, ManualDataProvider and FixtureDataProvider producing the R-059 representation; a new provider is an adapter only, with no change to the Research Agent's business logic. | S-003 Architecture Requirements 56-62; Architecture 299-310 | refines R-106; references R-059, R-053, R-057, R-058 |
| R-119 | - | constraint | **New (PD-04 applied to PD-12/PD-13), privacy.** Allow-list mapping of team- and competition-level fields; provider person data (referees, coaches, squads, scorers) dropped at the adapter, never stored, cached, logged or passed on; cache holds mapped projections only; manual imports with a person-level field are rejected naming the field. | S-001 25-27; S-003 API Integration 92-93; Manual Import Requirements 275-281 | refines R-112; references R-414, R-132, R-066 |
| R-120 | - | constraint | **New (PD-12), security.** Token from FOOTBALL_DATA_API_TOKEN sent in the X-Auth-Token header; provider requests from the server side only; handled under R-121 to R-127. | S-003 Authentication 34-40 | refines R-053 |
| R-121 | - | constraint | **New.** Credential rule 1: never hardcode credentials. | S-003 Authentication 44 | refines R-120 |
| R-122 | - | constraint | **New.** Credential rule 2: never commit credentials to Git. | S-003 Authentication 45 | refines R-120 |
| R-123 | - | constraint | **New.** Credential rule 3: never expose credentials to the frontend. | S-003 Authentication 46 | refines R-120 |
| R-124 | - | constraint | **New.** Credential rule 4: never include credentials in logs or test evidence. | S-003 Authentication 47 | refines R-120 |
| R-125 | - | constraint | **New.** Credential rule 5: an .env.example without real credentials. | S-003 Authentication 48 | refines R-120 |
| R-126 | - | constraint | **New.** Credential rule 6: local credential files are Git-ignored. | S-003 Authentication 49 | refines R-120 |
| R-127 | - | constraint | **New.** Credential rule 7: configuration validated at startup (outcome: R-436); messages name variables, never values. | S-003 Authentication 50 | refines R-120; references R-436 |
| R-128 | - | non-functional | **New (PD-12).** Runtime validation of every provider response before provider-to-domain mapping through the R-119 allow-list; invalid responses rejected. | S-003 API Integration 90-93 | refines R-105, R-053 |
| R-129 | - | non-functional | **New (PD-12).** HTTP error handling and timeouts with classified reasons reported without credential data. | S-003 API Integration 94-95 | refines R-053; references R-023 |
| R-130 | - | non-functional | **New (PD-12).** Bounded retries for transient failures only; no retry of authentication, access or not-found errors; retries within the rate limit (values: R-437). | S-003 API Integration 96 | refines R-053; references R-131, R-437 |
| R-131 | - | non-functional | **New (PD-12).** Rate-limit handling: read X-RequestsAvailable and X-RequestCounter-Reset on every response; no request while exhausted before the reset; wait on 429; configured request budget (R-312); unlimited access never assumed. | S-003 API Integration 97, 102-108 | refines R-053; references R-312 |
| R-132 | - | non-functional | **New (PD-12).** Request caching for a configured validity period; mapped projections with retrieval time only; no credential, error or invalid response cached. | S-003 API Integration 98 | refines R-053; references R-119, R-437 |
| R-133 | - | non-functional | **New (PD-12).** Safe diagnostic logging without credentials or person data. | S-003 API Integration 99 | refines R-053; references R-124, R-119 |
| R-134 | - | non-functional | **New (PD-12).** Deterministic fixtures as default test mode; contract tests for football-data.org responses covering the twelve cases of S-003 Testing. | S-003 API Integration 100; Testing 173-192 | refines R-107; references R-058 |
| R-135 | - | non-functional | **New (PD-12).** Live API integration tests optional, explicitly enabled, outside the default suite and gates, within the rate limit, credential-safe; same for the capability probe. | S-003 Testing 194-195 | refines R-134; references R-124, R-136 |
| R-136 | - | constraint | **New (PD-12).** Capabilities and conditions verified, not assumed (capability probe); findings on competition availability, coverage, seasons, rate limits, freshness, commercial use, republishing and attribution recorded with sources or marked unverified; API access is not permission to redistribute (R-430); no purchase or upgrade (R-111). | S-003 Architecture Requirements 76-77; Provider Availability and Licensing 127-147 | refines R-053; references R-430, R-111 |
| R-137 | - | constraint | **New in T11F (replaces R-101).** MVP priorities: (1) dynamic multi-competition catalogue, Champions League as initial reference scenario, demonstrating at least two LIVE_DATA competitions (subject to actual coverage), one MANUAL_DATA and one DEMO_DATA competition through the same workflows (R-440); (2) matchday or stage results and standings; (3) Instagram carousel generation; (4) manual approval and export. No unneeded provider-specific features. | S-000 Product Vision 12; Initial Scope 101-105; S-003 Provider Selection 28-32; MANUAL_DATA 255-258; S-004 3-9; Scope Clarification 96-112 | supersedes R-101; references R-440 |
| R-138 | - | non-functional | **New in T11F (replaces R-102).** Future extension to other social platforms and automated publishing (not MVP); additional competitions are in the MVP through the catalogue. | S-000 Initial Scope 107-108; S-004 3-9 | supersedes R-102; references R-109 |
| R-139 | - | constraint | **New (PD-14).** No hardcoded competition: no competition IDs or codes, and no Champions League or football-data.org identifier (CL, 2001, api.football-data.org) as a constant in domain logic, core services, workflow stages or UI; provider IDs and codes only in adapters or configuration. | S-004 3-9; Dynamic Competition Discovery 41-44 | refines R-118 |
| R-140 | - | non-functional | **New (PD-14).** Provider-neutral shared domain contracts for Competition, Season, Stage, Matchday, Match, Team, Standing, Source and Verification status, independent of football-data.org; provider-specific extensions stay out of the shared contracts. | S-004 Provider Independence 61-78 | refines R-059, R-118 |
| R-141 | - | non-functional | **New (PD-14, PD-12).** Discovery within the rate limit: catalogue, season and stage lists cached and counted against the budget; no per-competition request to show the catalogue; seasons and stages requested on selection; cached lists with retrieval time, or the wait, shown when the budget is exhausted. | S-004 Dynamic Competition Discovery 30-37; S-003 API Integration 102-108 | refines R-131, R-132; references R-312 |

The sources set no performance, availability, scale or accessibility targets; none are invented (R-307). Security constraints set by the Product Owner: R-113, R-114 (PD-05); R-115, R-116 (PD-10); R-120 to R-127 (PD-12); R-119 applies PD-04 to the new inputs.

## 7. Acceptance criteria

Proportional: one or two testable criteria per requirement; for PD-12, PD-13 and PD-14 one per credential rule, per manual import rule (paired where natural), per S-003 test case and per S-004 capability. Superseded in T11F: R-201 (by R-243), R-210 (by R-285), R-239 (by R-284). Changed in T11F (relationships only, statement unchanged): R-226 (also verifies R-138). New in T11F: R-243 to R-291.

| Record ID | Criterion (testable) | Requirement(s) | Sources |
|-----------|----------------------|----------------|---------|
| R-200 | Given the web interface is open, when the user creates a content project, then it appears in the project list and, when opened, shows its competition, season and matchday. | R-020 | S-000 Functional Requirements 54-55 |
| R-201 | **Superseded in T11F by R-243.** The competition selector offers only the UEFA Champions League; the matchday selector lists only matchdays of the selected season; a project cannot be created until all three are selected. | R-021, R-101 | S-000 Functional Requirements 55; Initial Scope 101-102 |
| R-202 | With a fixture sports-data provider holding a known matchday, research returns every match with both teams, the score of each finished match and its date, the full standings and at least one competition-context item, all equal to the fixture values. | R-022 | S-000 Primary Workflow 18-23 |
| R-203 | While research runs, each stage status is shown; a simulated provider failure shows the stage as failed with a reason, and research can be started again. | R-023 | S-000 Functional Requirements 56 |
| R-204 | Every stored fact has a source, a source reference and a retrieval time; a fact without attribution is rejected by validation and not stored. | R-024 | S-000 Functional Requirements 57-58; Quality Requirements 87 |
| R-205 | After fact-checking every fact has a verification status; a seeded disagreement that the official publication fixture does not settle is marked disputed and not verified, with a reason naming the sources. | R-025 | S-000 Primary Workflow 25-26; S-001 17-19 |
| R-206 | Given one unverified score, approval of every slide, headline or caption using it is refused with a message naming the fact, while content not using it can still be approved. | R-026 | S-000 Quality Requirements 89-90 |
| R-207 | Given a stub AI provider returning a caption (or headline) with a score not in the verified data, that caption (or headline) is flagged and cannot be approved. | R-027 | S-000 Quality Requirements 86-90 |
| R-208 | In the review view and in stored content, every text element is identified as verified fact or generated commentary. | R-028 | S-000 Quality Requirements 88 |
| R-209 | For a verified matchday, the content draft has an ordered carousel structure with a slide type per slide, a headline and description per slide, a caption and at least one hashtag. | R-029 | S-000 Primary Workflow 28-33 |
| R-210 | **Superseded in T11F by R-285.** The carousel has a cover slide, one match-result slide per included match, at least one standings slide and a closing slide. | R-030 | S-000 Primary Workflow 35-39 |
| R-211 | Carousels for two matchdays from the same templates share layouts and use only the configured brand palette colours; a template change applies to every carousel generated afterwards. | R-031, R-032 | S-000 Functional Requirements 59; Branding 73-79 |
| R-212 | With no logo, team badge or mascot image provided, a complete carousel is generated without errors and without placeholder or substitute images. | R-034 | S-000 Branding 81-82 |
| R-213 | Rendering the same slide twice from the same data and template gives identical numeric text; every score and team name on a slide equals the verified value exactly. | R-035, R-036 | S-000 Quality Requirements 91-92 |
| R-214 | For each Visual QA check, a slide seeded with that defect fails that check by name, and a correct slide passes all checks. | R-037 | S-000 Primary Workflow 41-46 |
| R-215 | Before approval, the preview shows all slides in carousel order with the caption and hashtags. | R-038 | S-000 Primary Workflow 48; Functional Requirements 60 |
| R-216 | Export of content not explicitly approved is refused; after explicit approval export succeeds. | R-039 | S-000 Quality Requirements 94 |
| R-217 | Regenerating one slide changes only that slide; it goes through Visual QA and needs approval again (R-406). | R-040 | S-000 Functional Requirements 61; Quality Requirements 94 |
| R-218 | Exporting an approved carousel produces one image per approved slide, in order and at the configured dimensions, and a text file with the approved caption and hashtags. | R-041 | S-000 Primary Workflow 50; Functional Requirements 62 |
| R-219 | The MVP has no function that publishes to a social platform, and no export step sends data to one. | R-042 | S-000 Quality Requirements 95; S-001 46 |
| R-220 | After an export the project is in the history with its approval state and export time; reopening shows the same slides and captions. | R-043 | S-000 Functional Requirements 63 |
| R-221 | For any exported slide, the platform shows its facts, their verification status and their sources. | R-044 | S-000 Quality Requirements 93 |
| R-222 | Following the documented local setup, the full workflow runs on one local machine with external access only to the configured providers. | R-100, R-108 | S-000 Initial Scope 99; Technical Direction 122 |
| R-223 | Replacing the configured AI and sports-data providers with stubs needs only a configuration change, and the full workflow then runs end to end. | R-106 | S-000 Technical Direction 120-123 |
| R-224 | Provider or inter-stage data violating its expected structure is rejected with a validation error and used in no content. | R-105 | S-000 Technical Direction 117 |
| R-225 | Each workflow stage has automated tests running it in isolation with fixture inputs; the (default) test suite runs without access to real external providers. | R-104, R-107 | S-000 Technical Direction 116-121 |
| R-226 | The architecture review confirms that competition, target platform format and publication mode are configuration or data, not fixed logic. | R-102, R-138 | S-000 Initial Scope 107-108 |
| R-227 | Every fact names its source, and only sources accepted under PD-01 (R-046) can make a fact verified. | R-045, R-046 | S-000 Quality Requirements 87; S-001 3-5 |
| R-228 | A brand asset registered once is available to the templates of every later project. | R-033 | S-000 Branding 79 |
| R-229 | Two agreeing accepted-source fixtures make a value verified citing both; a value only in the primary source is not verified; a non-accepted source does not count. | R-046, R-047 | S-001 3-5, 13-15 |
| R-230 | A seeded disagreement is disputed, the official publication fixture is consulted and recorded, and content is blocked; resolution or continued dispute as per R-423; no user action marks it verified. | R-048 (R-423) | S-001 17-19; S-000 Quality Requirements 89-90 |
| R-231 | Team and competition names as text; no club badge, competition mark or unauthorized image; empty badge slots; complete slides. | R-049, R-050 | S-001 21-23; S-000 Branding 81-82 |
| R-232 | Fixture data with player-level fields leaves no player-level field or value in stored results, drafting input, content or exports. | R-112 | S-001 25-27 |
| R-233 | The architecture review confirms no player entity or attribute and no user-account entity. | R-112, R-113 | S-001 25-30 |
| R-234 | Every listening socket is bound to a loopback address; connections through a non-loopback address are refused. | R-114 | S-001 31 |
| R-235 | The web interface opens without login, and there is no account or user-management function. | R-113 | S-001 30 |
| R-236 | Default content language Spanish; another selectable language drafts in that language; projects keep their own settings. | R-051 | S-001 33-34 |
| R-237 | Accented official names shown exactly in Spanish and English content; translated or abbreviated forms fail Visual QA or are flagged. | R-052 | S-001 35; S-000 Quality Requirements 92 |
| R-238 | Every slide is 1080 x 1350 pixels by default; Visual QA fails any other size. | R-037 (R-408) | S-001 43; S-000 Primary Workflow 46 |
| R-239 | **Superseded in T11F by R-284.** The matchday selector offers only league-phase matchdays of the UEFA Champions League; knockout rounds cannot be selected. | R-021 (R-417) | S-001 45; S-000 Initial Scope 102-103 |
| R-240 | Final approval refused while any slide or the caption is unapproved or blocked; export refused without it; succeeds once all are approved. | R-039 (R-405) | S-001 44; S-000 Quality Requirements 94 |
| R-241 | In the development configuration and in the (default) automated test suite, research and verification run on synthetic fixtures, with no request to a real sports-data provider. | R-110 | S-001 9 |
| R-242 | The architecture review confirms the provider research (pricing, coverage, reliability, licensing), that development and tests need no purchase, and no purchase before authorization. | R-111 (R-400) | S-001 7-11 |
| R-243 | **New (replaces R-201).** The competition selector is the R-073 catalogue (LIVE_DATA provider competitions, MANUAL_DATA competitions such as Liga Nacional de Guatemala, DEMO_DATA fixture competitions, each with its sources); seasons only those the chosen source has; matchday-or-stage selector lists only those of the season; no project without competition, season, matchday or stage, and data source. | R-072, R-137 | S-000 55, 101-102; S-003 28-32, 255-258; S-004 82-87 |
| R-244 | **New.** Against a stub serving recorded responses for the reference competition (configured CL, 2001): competition information shown; only seasons the provider reports are offered; matchdays or stages of the season listed. | R-054 | S-003 64-68, 84-87 |
| R-245 | **New.** Contract test, valid responses: competition, matches by season and matchday, and standings map to the domain representation equal to the recorded values, with source metadata and retrieval timestamp. | R-128, R-054 | S-003 Testing 181; 69-74 |
| R-246 | **New.** Contract test, missing optional fields: accepted; values stay absent; nothing invented. | R-128 | S-003 Testing 182 |
| R-247 | **New.** Contract test, invalid responses: non-JSON, missing required field, wrong type, unknown status rejected; stage fails with a reason; nothing stored or used. | R-128 | S-003 Testing 183 |
| R-248 | **New.** Contract test, authentication failures (401 or 403): no retry; stage fails with 'provider access refused'; no token in reason or logs. | R-129, R-130 | S-003 Testing 184 |
| R-249 | **New.** Contract test, rate limits: headers recorded; at X-RequestsAvailable 0 or 429 with reset N no request before N seconds (controllable clock); budget never exceeded in any 60-second window. | R-131 | S-003 Testing 185; API Integration 102-108 |
| R-250 | **New.** Contract test, provider unavailability: at most the configured retries, then failure naming unavailability; research can be restarted. | R-130, R-129 | S-003 Testing 186 |
| R-251 | **New.** Contract test, network timeouts: aborted at the timeout, retried within the bound, then timeout failure; total time bounded. | R-129, R-130 | S-003 Testing 187 |
| R-252 | **New.** Contract test, cache: repeat within validity served from cache with original timestamp; new request after expiry; errors not cached; no token, header or person field in the cache. | R-132 | S-003 Testing 188 |
| R-253 | **New.** Contract test, unavailable competitions or seasons (403, 404, season not listed): reported as not available with the subscription; no retry; no data. | R-129, R-136 | S-003 Testing 189 |
| R-254 | **New.** Contract test, missing standings: recorded as unavailable; nothing invented or derived; no standings slide from missing data; other content unaffected. | R-069, R-128 | S-003 Testing 190 |
| R-255 | **New.** Contract test, incomplete matchdays: every status mapped; only finished matches have results; unfinished matches listed with status and no result slide. | R-054 | S-003 Testing 191 |
| R-256 | **New.** Contract test, provider data disagreements: football-data.org vs verification fixture disagreeing gives UNVERIFIED (disputed) under R-048 and R-230; agreeing gives VERIFIED citing both. | R-055, R-048 | S-003 Testing 192; S-001 17-19 |
| R-257 | **New.** Default suite runs with DEMO_DATA, without the token, with no request to api.football-data.org, and gives identical results on repeated runs. | R-134, R-058 | S-003 Testing 175; DEMO_DATA 262-263 |
| R-258 | **New.** Live tests skipped unless enabled with the token; not in the default suite or gates; output, reports and evidence contain no token; within the budget. | R-135 | S-003 Testing 194-195 |
| R-259 | **New.** Optional capability probe records, with date and resource, the accessible competitions (including the reference competition), seasons, matchday filtering, standings, field presence and rate-limit headers; no token in output; anything unconfirmed is unsupported. | R-135, R-136 | S-003 76-77, 129-142 |
| R-260 | **New.** Credential rule 1: a synthetic marker token appears only in the X-Auth-Token header, never in URL or query; code, configuration, fixtures and tests hold no credential. | R-120, R-121 | S-003 Authentication 38-44 |
| R-261 | **New.** Credential rule 2: secret scan of the committed tree clean; no credential file tracked. | R-122 | S-003 Authentication 45 |
| R-262 | **New.** Credential rule 3: no marker in frontend assets, http-api responses or browser requests; the browser never calls api.football-data.org. | R-123 | S-003 Authentication 46 |
| R-263 | **New.** Credential rule 4: after success and failure scenarios, no marker in logs, errors, problem responses, test reports or evidence; X-Auth-Token redacted or absent in diagnostic logs. | R-124, R-133 | S-003 Authentication 47; API Integration 99 |
| R-264 | **New.** Credential rule 5: .env.example names FOOTBALL_DATA_API_TOKEN with an empty or placeholder value. | R-125 | S-003 Authentication 48 |
| R-265 | **New.** Credential rule 6: git check-ignore reports local credential files ignored; .env.example tracked. | R-126 | S-003 Authentication 49 |
| R-266 | **New.** Credential rule 7: LIVE_DATA enabled without token stops startup naming the variable without value; invalid mode stops startup; without LIVE_DATA startup needs no token. | R-127 | S-003 Authentication 50 |
| R-267 | **New.** The same synthetic matchday through FixtureDataProvider, ManualDataProvider (JSON, CSV, form) and FootballDataProvider (recorded responses) yields representations that pass one schema and are equal apart from mode, source metadata and timestamps. | R-059, R-118 | S-003 265-271, 309-310 |
| R-268 | **New.** Downstream stages run unchanged on every mode's representation; the architecture review confirms one ingestion interface and no provider-specific branch in the Research Agent's business logic. | R-118, R-059 | S-003 61-62, 301-307 |
| R-269 | **New.** Each project shows its mode; every fact's source metadata names mode and provider or import; DEMO_DATA projects and exports are labelled as demonstration. | R-056, R-058 | S-003 Supported Modes 238-263 |
| R-270 | **New.** Two-source agreement gives VERIFIED; football-data.org alone gives UNVERIFIED 'awaiting independent verification'; MANUAL_DATA is UNVERIFIED until approved, then MANUALLY_APPROVED; exactly one status per fact. | R-070 | S-003 288-292, 119-123 |
| R-271 | **New.** LIVE_DATA without a secondary source: research completes, facts UNVERIFIED and never VERIFIED, approval of content using them refused naming the single-source fact. | R-055 | S-003 Fact-Checking 119-125 |
| R-272 | **New.** MANUALLY_APPROVED shown, stored, traced and exported as such, never as VERIFIED; does not count toward agreement; audit record kept; manual approval of LIVE_DATA or disputed facts refused; until R-429, content using it is not approvable. | R-071 | S-003 Verification and Approval 294-297 |
| R-273 | **New.** Manual import rules 1 and 3: unparsable JSON, CSV with wrong columns, missing field, wrong type or impossible value rejected; nothing from a rejected import stored. | R-060, R-062 | S-003 275-277 |
| R-274 | **New.** Manual import rule 2: errors name file or form, record, field and problem; all reported together. | R-061 | S-003 276 |
| R-275 | **New.** Manual import rule 4: a match twice in an import is rejected naming both records; an existing match is never stored twice. | R-063 | S-003 278 |
| R-276 | **New.** Manual import rules 5 and 6: a valid import with metadata, results and standings becomes selectable and researchable; an import without metadata is rejected. | R-064, R-065 | S-003 279-280 |
| R-277 | **New.** Manual import rules 7 and 8: the original is retrievable unchanged (same hash), linked to the import record with timestamp, channel, file name and declared source; facts trace back to it. | R-066, R-067 | S-003 281-282, 297 |
| R-278 | **New.** Manual import rule 9: a corrected reimport creates a new version used by later research; earlier version retrievable; changed facts lose MANUALLY_APPROVED; content needs QA and approval again. | R-068 | S-003 283 |
| R-279 | **New.** Manual import rule 10: a finished match without score is rejected; unfinished matches have no score and no result slide; missing standings are never produced or derived. | R-069 | S-003 284, 277 |
| R-280 | **New.** Provider person data (referees, coaches, squads, scorers) absent from representation, cache, storage and logs; a manual import with a person-level field is rejected naming it. | R-119 | S-001 25-27; S-003 92-93, 275-277 |
| R-281 | **New.** The provider findings record lists competition availability, coverage, seasons, rate limits, freshness, commercial use, republishing and attribution, each sourced and dated or marked unverified; no subscription purchased or upgraded. | R-136, R-111 | S-003 127-147 |
| R-282 | **New.** Catalogue: a stub provider's competitions, an imported manual competition and DEMO fixtures appear together with their sources; a competition added to or removed from the stub response appears or disappears without code change. | R-073 | S-004 30-34, 54-55 |
| R-283 | **New.** A league competition lists matchdays; a stage-based competition lists its stages by the source's names; each returns matches and results, with standings only where provided. | R-074 | S-004 35-38, 85-88 |
| R-284 | **New (replaces R-239).** For the reference competition every matchday or stage the source reports is selectable, including stages after the league phase; a stage without standings shows matches and results and states standings are not available; no empty or invented standings table. | R-074, R-077 | S-004 36-38, 86-94 |
| R-285 | **New (replaces R-210).** Carousel: cover, one result slide per included match, at least one standings slide when the selection has verified standings and none otherwise, closing slide; a carousel without standings passes Visual QA and follows the same approval and export rules. | R-030, R-077 | S-000 Primary Workflow 35-39; S-004 93-94 |
| R-286 | **New.** A competition whose resources return 403 is marked unavailable for the subscription with a reason; missing standings or season history shown as not available; nothing invented; other competitions usable. | R-075 | S-004 39-40 |
| R-287 | **New.** For a competition with two sources either can be chosen; project, every retrieval and every fact record the source; traceability of an exported slide shows it. | R-076 | S-004 57-59, 87-89 |
| R-288 | **New.** Shared domain schema and http-api contract define the nine provider-neutral concepts without football-data.org field names or identifiers; provider data only in adapter-side types; all three adapters' outputs validate against the same schema. | R-140 | S-004 61-78 |
| R-289 | **New.** An automated static check over all code outside provider adapters and configuration fails on competition identifiers used as constants (CL, 2001, api.football-data.org, the competition name in logic); a seeded violation fails it; delivered code passes. | R-139 | S-004 6-9, 41-44 |
| R-290 | **New.** The same workflow code takes at least two LIVE_DATA competitions, one MANUAL_DATA and one DEMO_DATA competition through selection, retrieval, provenance review, generation, preview and, as far as the verification rules allow, approval and export; deterministic tests use recorded responses for both LIVE competitions; the live run is subject to the probed coverage (R-440). | R-137, R-077 | S-004 96-109 |
| R-291 | **New.** With a 10 requests/minute budget and many stub competitions, catalogue and selection never exceed the budget in any 60-second window; the catalogue needs no per-competition request; a repeat view within validity makes no request; when exhausted, cached lists with retrieval time or the wait are shown. | R-141 | S-004 30-37; S-003 102-108 |

R-103 (stack proposed by the Architect) and R-109 (no unnecessary infrastructure) are checked in the architecture review rather than by a test. R-115, R-116 and R-117 are verified as described in T11B (security validation and Contract Safety), without acceptance-criterion records; under the amended R-116, the security review of T11H decides how the condition is checked for FootballDataProvider and the manual input types. In R-225 and R-241 "the automated test suite" means the default suite (R-110 as amended); their statements are unchanged.

Coverage of the Product Owner decisions that state behaviour: PD-01 by R-227, R-229, R-241, R-242; PD-02 by R-229, R-230, R-205, R-256, R-271; PD-03 by R-231, R-212; PD-04 by R-232, R-233, R-280; PD-05 by R-234, R-235; PD-06 by R-236, R-237; PD-09 by R-238, R-240, R-219 (its league-phase part replaced by R-284 under PD-14); PD-12 by R-244 to R-266, R-271, R-281; PD-13 by R-267 to R-280; PD-14 by R-243, R-282 to R-291.

## 8. Edge cases

| Edge case | Handling | Records |
|-----------|----------|---------|
| Match not finished, postponed or abandoned; matchday still in progress | No result slide without a verified final result; status listed; standings "as of" time | R-409, R-026, R-255 |
| Accepted sources disagree on a score, date or standings row | Disputed and not verified; official publication consulted; affected content blocked; no manual override | R-047, R-048, R-423, R-026, R-412, R-230, R-256 |
| Official publication unavailable or giving a third value | Fact stays disputed; re-run verification later | R-423, R-311, R-230 |
| Only one accepted source has the value (for example only football-data.org) | UNVERIFIED 'awaiting independent verification'; not publication-approvable | R-047, R-055, R-271 |
| Sources use different name forms for the same team | Team identity matched across sources; unmatched team not verified | R-426, R-424 |
| Provider unavailable, timing out, rate-limited, or returning malformed data | Bounded retries, wait for counter reset, validation rejection; stage failed with reason | R-023, R-129 to R-131, R-247 to R-251 |
| Request budget exhausted during catalogue discovery | Cached lists with retrieval time, or the wait reported; no request beyond the budget | R-141, R-291 |
| Competition or season not granted by the subscription (403/404) | Marked unavailable with reason; no retry; no data | R-075, R-253, R-286 |
| Matchday or stage without standings (for example a knockout round) | Matches and results shown; standings stated as unavailable; carousel without standings slide | R-077, R-254, R-284, R-285 |
| Competition organised in stages rather than matchdays | Stages listed by source names and handled through the same flow | R-074, R-283, R-439 |
| Fewer than two LIVE_DATA competitions confirmed by the probe | Reported to the Product Owner; no purchase or upgrade | R-440, R-111 |
| Provider data includes person data (referees, coaches, squads, scorers) | Dropped at the adapter; never stored, cached or logged | R-119, R-280, R-232 |
| Manual import malformed, incomplete, duplicated or with a person-level column | Whole import rejected with clear errors; nothing stored | R-060 to R-063, R-119, R-273 to R-275, R-280, R-435 |
| Manual finished match without a score | Rejected as incomplete; scores never invented | R-069, R-279 |
| Manual data corrected after approval | Reimport creates a new version; approvals and MANUALLY_APPROVED reset | R-068, R-278, R-406 |
| Operator tries to approve a LIVE_DATA or disputed fact manually | Refused | R-071, R-412, R-272 |
| Content uses MANUALLY_APPROVED facts before R-429 is decided | Not approvable (R-026 applies) | R-071, R-272, R-429 |
| DEMO_DATA content exported | Labelled as demonstration content | R-438, R-269 |
| Token missing with LIVE_DATA enabled | Startup stops, naming the variable without value | R-127, R-436, R-266 |
| Provider republishing or attribution terms not confirmed | No assumption that publication is permitted | R-136, R-316, R-430 |
| Free-plan score delay | No real-time claim; retrieval time shown | R-313 |
| Long team names, accents or special characters | Text-fit check; exact verified official name preserved | R-037, R-035, R-052, R-213, R-237 |
| Team names inside hashtags | Hashtag-safe form allowed; display text keeps the exact name | R-426 |
| No brand assets provided; badge slot with no authorized badge | Complete slides; badge slots stay empty | R-034, R-050, R-212, R-231, R-301 |
| A badge or logo file supplied without authorization | Not used on slides | R-049, R-309 |
| Operator supplies an SVG or non-PNG/JPEG brand file, or one over the caps | Refused | R-115 |
| A real sports-data adapter, a hosted AI provider or a new input type is introduced | New security review and PO isolation decision first (now applies within WI-1 to FootballDataProvider and the manual input types) | R-116, R-111 |
| Content language changed after drafting; slide regenerated or research re-run after approval | QA and approval again | R-051, R-406, R-217 |
| AI text contains a number not in the verified data or a non-official name form | Flagged; cannot be approved | R-027, R-207, R-422, R-426, R-237 |
| Source corrects a value after export | New research run creates a new version; no correction alerts in the MVP | R-406, R-043 |
| Connection attempt from another machine | Refused (loopback binding) | R-114, R-234 |
| Fetched text contains instructions aimed at the AI stages | Treated as data (RK-08, AC-07) | R-105, R-302 |

## 9. Dependencies

External:

| Dependency | Needed by | Records |
|------------|-----------|---------|
| football-data.org API v4 with the Product Owner's token, set locally in FOOTBALL_DATA_API_TOKEN (never requested in the conversation); actual plan, coverage and rate limits confirmed by the capability probe | LIVE_DATA research, catalogue discovery, live tests, demonstration | R-053, R-054, R-120, R-135, R-136, R-259, R-312 |
| New security review (task T11H) and Product Owner decision on isolation of untrusted-input processing (PD-10 condition, SC-05) | FootballDataProvider and the MANUAL_DATA input types (JSON, CSV, web form); any hosted AI provider | R-116, R-053, R-057, R-427 |
| Independent verification source proposed by the Architect and approved by the Product Owner | Publication of LIVE_DATA content (two-source rule) | R-055, R-432, R-400 |
| Product Owner decisions R-429 (MANUALLY_APPROVED and publication) and R-430 (republishing permission) | Publication of MANUAL_DATA and LIVE_DATA content | R-429, R-430 |
| Official competition publication (consulted on disagreement) | Dispute resolution | R-048, R-311, R-423 |
| AI provider(s); any paid account authorized by the Product Owner | Content drafting | R-029, R-111, R-401 |
| Instagram carousel format (1080 x 1350, PD-09) checked at implementation time | Design, Visual QA, export | R-407, R-408, R-238, R-303 |
| Brand values and authorized assets from the Product Owner | Templates | R-301, R-309, R-418, R-033 |
| Architecture stage (stack, rendering, storage, team identity matching, provider-neutral domain contracts, endpoints) | All implementation | R-103, R-402, R-403, R-426, R-140, R-437 |

Internal (record level): R-022 depends on R-021 and R-072; R-025 on R-024; R-026, R-027 and R-029 on R-025; R-030 on R-029 and R-031; R-037 on R-025 and R-030; R-041 on R-039; R-044 on R-024 and R-025; R-048 on R-047; R-053 and R-057 on R-116; R-054 on R-053.

Phase order: MVP-P1, then MVP-P2; MVP-P3 can start on DEMO_DATA in parallel with MVP-P2 but its acceptance needs verified data from MVP-P2; MVP-P4 needs MVP-P2 and MVP-P3. Within MVP-P2, FootballDataProvider and ManualDataProvider wait for the R-116 review and decision; DEMO_DATA work does not.

## 10. Decisions (with classification and source)

Every question of this work item is classified. Only R-429 and R-430 require the Product Owner (section 13). ORCHESTRATOR_DECISION items are recommended reversible defaults for the Orchestrator to record.

| Record ID | Question | Classification | Resolution or recommendation | Source / basis |
|-----------|----------|----------------|------------------------------|----------------|
| R-400 | Which sports-data provider(s)? | RESOLVED_BY_EXISTING_SOURCE (**changed in T11F**, was AUTONOMOUS_DECISION) | **PD-12:** football-data.org API v4 is the preferred primary provider (R-053); verification source proposed by the Architect and approved by the PO (R-432); R-055 meanwhile; manual data not an accepted source (R-071). Earlier recommendation kept for history. | S-003 lines 11-32, 110-125; S-001 lines 3-11 |
| R-401 | Which AI provider(s) and models? | AUTONOMOUS_DECISION | For the Architect, behind the provider abstraction; stub for tests; no paid account without authorization (R-111). | S-000 lines 112-113, 120, 123; S-001 line 11 |
| R-402 | Slide rendering approach? | AUTONOMOUS_DECISION | For the Architect, bounded by R-035 and R-036. | S-000 lines 91-92, 112-113 |
| R-403 | Data storage? | AUTONOMOUS_DECISION | For the Architect, bounded by R-100, R-109, R-043, R-044. | S-000 lines 99, 112-113, 125 |
| R-404 | Where is "verified fact" vs "commentary" shown? | ORCHESTRATOR_DECISION | Provenance label on stored elements and in the review view; none on exports (OD-01). | S-000 line 88; MED-04 |
| R-405 | Approval granularity? | RESOLVED_BY_EXISTING_SOURCE | Per slide and caption plus final approval (PD-09). AC: R-240. | S-001 line 44 |
| R-406 | Does approval survive a change? | RESOLVED_BY_EXISTING_SOURCE | No; changed content needs QA and approval again. | S-000 lines 93-94 |
| R-407 | Matchday exceeds the slide limit? | ORCHESTRATOR_DECISION | Configurable maximum; numbered carousels; matches can be excluded (OD-03). | S-000 lines 36, 46, 104 |
| R-408 | Slide dimensions? | RESOLVED_BY_EXISTING_SOURCE | 1080 x 1350, configurable (PD-09). AC: R-238. | S-001 line 43 |
| R-409 | Unfinished or postponed matches? | ORCHESTRATOR_DECISION | Result slides only for verified final results (OD-05). | S-000 lines 18-23, 86-90 |
| R-410 | Which sources, and their terms? | RESOLVED_BY_EXISTING_SOURCE | **PD-01, option (c).** No legal assessment given. | S-001 lines 3-11 |
| R-411 | When is a fact "verified"? | RESOLVED_BY_EXISTING_SOURCE | **PD-02, option (a)** with the dispute procedure. | S-001 lines 13-19 |
| R-412 | Manual override of unverified content? | RESOLVED_BY_EXISTING_SOURCE | No override; also excludes manual approval of LIVE_DATA and disputed facts (R-071). | S-000 lines 86, 89-90 |
| R-413 | Club badges and competition marks? | RESOLVED_BY_EXISTING_SOURCE | **PD-03, option (c).** | S-001 lines 21-23 |
| R-414 | Personal data? | RESOLVED_BY_EXISTING_SOURCE | **PD-04, option (a);** applied to the new inputs by R-119. | S-001 lines 25-27 |
| R-415 | User and authentication model? | RESOLVED_BY_EXISTING_SOURCE | **PD-05, option (a).** | S-001 lines 29-31 |
| R-416 | Content language and team names? | RESOLVED_BY_EXISTING_SOURCE | **PD-06.** | S-001 lines 33-35 |
| R-417 | Seasons and phases in scope? | RESOLVED_BY_EXISTING_SOURCE; **superseded in T11F by R-439** | League phase only (PD-09) — replaced by generic matchday-or-stage handling under PD-14 (conflict C-3). | S-001 line 45; S-004 |
| R-418 | Colour values and fonts? | ORCHESTRATOR_DECISION | Provisional configurable values (OD-07). | S-000 lines 73-77 |
| R-419 | History retention and deletion? | ORCHESTRATOR_DECISION | Kept locally, no deletion (OD-08). | S-000 line 63 |
| R-420 | Visual QA failure handling? | ORCHESTRATOR_DECISION | Data, text-fit and dimension failures block; consistency findings are warnings (OD-09). | S-000 lines 41-46, 89-92 |
| R-421 | Export formats and naming? | AUTONOMOUS_DECISION | Instagram-accepted image format, ordered names, UTF-8 captions. | S-000 lines 50, 62 |
| R-422 | Captions under the no-invented-facts rule? | RESOLVED_BY_EXISTING_SOURCE | Yes (R-027). | S-000 lines 86, 89-90 |
| R-423 | When is a disputed fact resolved? | RESOLVED_BY_EXISTING_SOURCE | When two independent accepted sources support one value. | S-001 lines 13-19 |
| R-424 | Rule for other facts? | ORCHESTRATOR_DECISION | PD-02 rule for every fact used in content (OD-10). | S-001 lines 13-15; S-000 lines 25-26 |
| R-425 | Selectable languages? | ORCHESTRATOR_DECISION | Spanish (default) and English (OD-11). | S-001 line 34 |
| R-426 | Verified official name? | ORCHESTRATOR_DECISION | Name from the independent official source; identity matching; enforcement (OD-12). | S-001 lines 4-5, 35 |
| R-427 | Untrusted-input isolation (E-07)? | RESOLVED_BY_EXISTING_SOURCE | **PD-10, option (A).** | S-002 line 1 |
| R-428 | Contract-evolution policy (E-08)? | RESOLVED_BY_EXISTING_SOURCE | **PD-11.** | S-002 line 1 |
| R-429 | **New.** May MANUALLY_APPROVED facts pass publication approval? | REQUIRES_PRODUCT_OWNER | See section 13. | S-003 lines 286-297; HIGH-07 |
| R-430 | **New.** How is republishing permission for football-data.org content confirmed? | REQUIRES_PRODUCT_OWNER | See section 13. | S-003 lines 138-145; HIGH-05, HIGH-07 |
| R-431 | **New.** How is a project's data source chosen? | ORCHESTRATOR_DECISION | Each competition has one or more configured sources; operator chooses one at creation (first available preselected); fixed for the project and recorded; DEMO_DATA default in development, test and demonstration configurations. | S-003 lines 238-263; S-004 lines 54-59, 87; MED-04 |
| R-432 | **New.** Which source verifies football-data.org data, and who approves it? | RESOLVED_BY_EXISTING_SOURCE | Architect proposes (PD-01 research), PO approves (S-003 line 119); R-055 meanwhile. A future PO action, not an open question. | S-001 lines 3-11; S-003 lines 112-125 |
| R-433 | **New.** How do the three statuses map to existing states? | ORCHESTRATOR_DECISION | VERIFIED = R-047; UNVERIFIED with reason (awaiting independent verification, disputed, no accepted source); MANUALLY_APPROVED only for MANUAL_DATA facts (R-412 excludes others). | S-003 lines 286-297; S-001 lines 13-19; MED-04 |
| R-434 | **New.** Which structure does MANUAL_DATA support? | ORCHESTRATOR_DECISION | Same provider-neutral structure: seasons with matchdays or named stages, standings where the competition has them; season label from the competition configuration. | S-003 lines 255-258; S-004 lines 36-38, 93-94; MED-04 |
| R-435 | **New.** Duplicate identity, whole or partial import, reimport? | ORCHESTRATOR_DECISION | Match key = competition, season, matchday or stage, home and away team; whole-import application; reimport creates a new version, earlier ones retrievable. | S-003 lines 277-283; MED-04 |
| R-436 | **New.** Startup with incomplete LIVE_DATA configuration? | ORCHESTRATOR_DECISION | Fail closed when LIVE_DATA is enabled; token not required otherwise; named errors without values. | S-003 lines 50, 175 |
| R-437 | **New.** Endpoints, timeouts, retries, cache periods, import layouts? | AUTONOMOUS_DECISION | For the Architect and implementers within R-054, R-128 to R-132, R-141; documented endpoints noted from the Orchestrator's documentation review. | S-003 lines 79-100; ext: football-data.org v4 documentation |
| R-438 | **New.** How is DEMO_DATA content kept apart? | ORCHESTRATOR_DECISION | Labelled as demonstration content in list, review and export. | S-003 lines 260-263; S-000 line 86; MED-04 |
| R-439 | **New (replaces R-417).** Competitions, seasons and phases or stages in scope under PD-14? | RESOLVED_BY_EXISTING_SOURCE | Every competition the configured sources offer; seasons as offered and confirmed; matchdays or stages handled generically, including stages after a league phase; stages without standings produce content without a standings slide; no format-specific extras (brackets, aggregate or qualification calculations). Agrees with the Orchestrator's reading. | S-004 lines 3-9, 35-38, 86, 93-94, 107-112; S-001 line 45 |
| R-440 | **New.** Which competitions does the MVP demonstration use? | ORCHESTRATOR_DECISION | LIVE_DATA: the Champions League and one domestic league from the S-004 examples confirmed by the probe, chosen at execution time; MANUAL_DATA: Liga Nacional de Guatemala; DEMO_DATA: a fixture competition; fewer than two confirmed LIVE competitions is reported to the PO. | S-004 lines 16-26, 96-109; MED-04 |

LOW decisions taken in T04, T11B: LOW-1 to LOW-7 (unchanged; see the T04 and T11B revisions).

LOW decisions taken in T11F (inside the owned files only):
- LOW-8: records that S-003 or S-004 contradict (R-021, R-101, R-102, R-201, R-210, R-239, R-417) are marked `superseded` with a basis pointing to their replacement (R-072, R-137, R-138, R-243, R-285, R-284, R-439), which carries every source reference of the record it replaces; records whose meaning stays but whose scope or sources grow (R-022, R-030, R-046, R-109, R-110, R-111, R-116, R-226) are amended in place, as T04 did.
- LOW-9: R-400 reclassified to RESOLVED_BY_EXISTING_SOURCE (PD-12), with the earlier resolution and recommendation kept for history.
- LOW-10: one record per credential rule and per manual import rule, so that each rule has an acceptance criterion.
- LOW-11: S-003 and S-004 cited by section title and line range; the S-003 "Execution" sections by their parent title.
- LOW-12: the personal-data allow-list (R-119) is written as a constraint derived from PD-04, not as a question, because PD-04 already decides that only team- and competition-level data is introduced; rejecting (rather than stripping) a manual import with a person-level field is the stricter reading.
- LOW-13: the paragraph duplicate of S-001 line 61 and S-003 line 324 is resolved as instruction-flagged (it is a process instruction, not a requirement to merge).
- LOW-14: new records numbered in the existing ranges (R-011 to R-014, R-053 to R-077, R-118 to R-141, R-243 to R-291, R-312 to R-319, R-429 to R-440); no existing ID changed or removed.

## 11. Conflicts

| ID | Records | Resolution |
|----|---------|------------|
| C-1 | R-021, R-101, R-102, R-201 (S-000) vs R-072, R-137, R-138, R-243 (S-003, S-004) | One competition (S-000 lines 12, 102, 107-108) vs competitions without public APIs (S-003 lines 255-258) and a dynamic multi-competition platform (S-004 lines 3-9, 28-44, 96-109). All level 1, so the levels do not decide; S-003 and S-004 are the later Product Owner statements on the same scope point, and scope is the PO's decision (HIGH-07). Classified RESOLVED_BY_EXISTING_SOURCE: the earlier records are superseded. |
| C-2 | R-026 (S-000), R-047 (S-001) vs R-071 (S-003) | MANUALLY_APPROVED is introduced without saying whether it allows publication approval, while unverified facts block publication approval. No source decides: REQUIRES_PRODUCT_OWNER, question R-429. Until decided, R-026 applies unchanged. |
| C-3 | R-417, R-239 (S-001 PD-09), R-210 (S-000) vs R-439, R-284, R-285 (S-004) | League-phase-only scope and mandatory standings slides vs matchdays or equivalent stages of different tournament structures and a UI that assumes no single format. Both level 1; S-004 is the later Product Owner clarification of the vision. Classified RESOLVED_BY_EXISTING_SOURCE; the earlier records are superseded. |

Under `precedence.md` a conflict between level-1 sources is a HIGH matter for the Orchestrator to record in the tracker Conflicts table; C-1 and C-3 are resolved here by the later Product Owner statements, and the Orchestrator may confirm them with the Product Owner in its status report.

Wording differences settled without a source conflict: (1) R-110 said "automated tests use synthetic fixtures only" (a T04 wording); S-001 line 9 says "use synthetic fixtures during development", which S-003 lines 175 and 194-195 keep as the default while allowing optional live tests, so R-110 is narrowed to the default suite. (2) R-116's T11B reading ("WI-1 delivers no real adapter and no new input type") no longer holds after PD-12 and PD-13; the PD-10 condition itself is unchanged and now applies within WI-1. (3) Manual import rule 7 (preserve originals) and PD-04 (no person data) are reconciled by R-119: imports with person-level fields are rejected, so a preserved original never holds person data. (4) R-106 (providers replaceable by configuration) and R-116 (review before a real adapter) are compatible, as noted in T11B.

## 12. Flagged embedded instructions (not acted on)

These lines are process directions to the framework, not product requirements. They do not change any policy, gate, precedence level or file ownership. Each matches existing framework policy (`autonomy.md`, `intake.md`), so behaviour is the same with or without them. This task's deliverables come from the task brief, not from this text.

| Source ID | Location | Quoted text | Action |
|-----------|----------|-------------|--------|
| S-000 | Orchestration, lines 129-140 | `Use the installed ORCH-V3 framework. Start with requirements analysis and normalization. Generate: ... Proposed MVP delivery phases.` | not-acted-on |
| S-000 | Orchestration, lines 142-143 | `Resolve routine technical decisions autonomously within established project policies.` | not-acted-on |
| S-000 | Orchestration, line 145 | `Do not begin implementation during this analysis phase.` | not-acted-on |
| S-000 | Orchestration, line 147 | `Do not push or deploy.` | not-acted-on |
| S-001 | lines 41-42 | `Enable the frontend-developer role in the project configuration through the authorized configuration workflow.` | not-acted-on |
| S-001 | lines 48-56 | `Execution: 1. Record all six Product Owner decisions. ... 7. Report readiness for /orchestrate:plan WI-1.` | not-acted-on |
| S-001 | line 58 | `Resolve routine implementation details autonomously.` | not-acted-on |
| S-001 | line 60 | `Do not implement application features yet.` | not-acted-on |
| S-001 | line 61 | `Do not merge into main, push or deploy.` | not-acted-on |
| S-003 | title section, lines 6-9 | `Do not restart requirements analysis or recreate the implementation plan. Apply an incremental change to the existing WI-1 plan.` | not-acted-on |
| S-003 | Authentication, line 52 | `Do not request the API token in this conversation.` | not-acted-on (matches policy: no real credentials are requested or handled) |
| S-003 | Incremental Task Reconciliation, lines 149-171 | `Inspect the existing 37 tasks, T12-T48. ... Preserve all previously recorded decisions and evidence.` | not-acted-on |
| S-003 | Execution (provider update), lines 199-208 | `1. Record this Product Owner decision. ... 10. Record all modifications and verification evidence.` | not-acted-on |
| S-003 | Execution (provider update), line 210 | `Continue autonomously within the existing policies.` | not-acted-on |
| S-003 | Execution (provider update), line 212 | `Do not begin implementation yet.` | not-acted-on |
| S-003 | Execution (provider update), line 213 | `Do not merge into main.` | not-acted-on |
| S-003 | Execution (provider update), line 214 | `Do not push or deploy.` | not-acted-on |
| S-003 | Expected Output, lines 216-227 | `Report: Updated task IDs. ... Final planning validation results.` | not-acted-on |
| S-003 | Additional Product Owner Requirement, lines 234-236 | `This is an incremental requirement. Do not restart the implementation plan.` | not-acted-on |
| S-003 | Execution (modes), lines 314-321 | `1. Update WI-1 requirements. ... 8. Report affected tasks and remaining dependencies.` | not-acted-on |
| S-003 | Execution (modes), line 323 | `Do not start implementation yet.` | not-acted-on |
| S-003 | Execution (modes), line 324 | `Do not merge into main, push or deploy.` | not-acted-on |
| S-003 | Execution (modes), lines 326-328 | `Finish with WI-1 ready for: /orchestrate:execute WI-1` | not-acted-on |
| S-004 | Incremental Planning, lines 116-126 | `Treat this as a clarification of the original product vision. 1. Update affected requirements. ... 7. Run all planning and framework validation checks.` | not-acted-on (the product content of items 5 and 6 is covered by R-139, R-282 to R-291) |
| S-004 | Incremental Planning, line 128 | `Continue autonomously within existing authorization.` | not-acted-on |
| S-004 | Incremental Planning, line 130 | `Do not restart planning.` | not-acted-on |
| S-004 | Incremental Planning, line 131 | `Do not implement application code yet.` | not-acted-on |
| S-004 | Incremental Planning, line 132 | `Do not merge, push or deploy.` | not-acted-on |

Intake candidates (all in `candidateResolutions`): `instructions[0]` (S-001 line 61), `instructions[1]` (S-003 line 213) and `instructions[2]` (S-003 line 324): instruction-flagged, listed above; they match `autonomy.md` HIGH-08 and the configuration's authorizations. `paragraphDuplicates[0]` (S-001 line 61 and S-003 line 324, the same process instruction): instruction-flagged; not a requirement, so nothing to merge. `idCollisions[0]` ("WI-1" in the first-line headings of S-003 and S-004): dismissed; it is this work item's identifier, not a record ID. `references[0]` (S-001 and S-003 line 1) and `references[1]` (S-001 and S-004 line 1) mention WI-1: dismissed; the work item itself, no dependency.

## 13. Open questions (REQUIRES_PRODUCT_OWNER)

**R-429: May content that uses MANUALLY_APPROVED facts receive publication approval?** S-003 introduces MANUALLY_APPROVED for operator-supplied data (for example Liga Nacional de Guatemala, which has no public API) and says manual approval is never independent verification, but not whether it unlocks publication. Existing rules: unverified facts block publication approval (R-026), verification needs two independent accepted sources (R-047, PD-02), no manual override (R-412). Business-rule semantics no source decides (HIGH-07).
- (a) MANUALLY_APPROVED facts may be approved for publication, always labelled operator-attested and never shown or stored as verified.
- (b) Never publishable until two independent accepted sources verify them.
- (c) Publishable, labelled operator-attested, only for competitions configured as having no accepted public source (for example Liga Nacional de Guatemala); competitions with an API source keep the strict two-source rule.
- **Recommendation: (c).** It makes the MANUAL_DATA competitions S-003 asks for publishable, keeps PD-02 and R-412 unchanged for API-covered competitions, and never presents manual approval as verification. With PD-14 a competition may have both an API source and a manual source; under (c) the strict rule applies to every competition that has an accepted API source. Until decided, R-026 applies, so implementation is not blocked; only publication of manual-competition content waits.

**R-430: How does the Product Owner confirm that republishing football-data.org data is permitted before such content may be approved for publication?** S-003 forbids assuming that API access grants redistribution rights and asks to verify commercial-use, republishing and attribution conditions; the provider publishes none of them (R-316). A Product Owner matter (HIGH-05, HIGH-07); no legal assessment is given here.
- (a) The PO obtains written confirmation from the provider (or a plan whose published terms permit it) and records it as a decision; until then final approval of content using LIVE_DATA facts is refused with the reason 'republishing permission not confirmed'.
- (b) The PO records a decision accepting publication on the basis of their own review of the provider's conditions.
- (c) LIVE_DATA is used only for research and cross-checking; published values come from another accepted source whose republishing the PO has confirmed.
- **Recommendation: (a)**, recorded with any attribution requirement (which would become a template requirement), for every LIVE_DATA competition used for publication. Not blocking for WI-1 implementation: PD-02 (R-055) already refuses publication approval on football-data.org alone until a secondary source exists.

Not open questions of this document, noted for the Orchestrator: the Product Owner decision on isolation of untrusted-input processing for FootballDataProvider and the manual input types (R-116, SC-05) follows the T11H security review and is raised by the Orchestrator; approval of a secondary verification source (R-432) is a future Product Owner action.

## 14. Assumptions (each with its basis)

| Record ID | Assumption | Basis |
|-----------|------------|-------|
| R-300 | One user role, the content operator; followers are the audience, not users. | PD-05 (S-001 lines 29-30); S-000 lines 16, 48. |
| R-301 | No logos, mascot images, badges or brand fonts have been provided yet. | S-000 lines 81-82; S-001 line 22. |
| R-302 | The five "agents" are functional product stages; AI or deterministic is an architecture decision. | S-000 lines 18-46, 112-113. |
| R-303 | Instagram is the only MVP platform. | S-000 lines 104, 107-108. |
| R-304 | Export means local files uploaded manually. | S-000 lines 50, 62, 95, 99. |
| R-305 | "Relevant competition context" is short factual matchday context and is fact-checked. | S-000 lines 23, 25-26. |
| R-306 | Local-first is not offline. | S-000 lines 18-26, 87, 99, 123. |
| R-307 | No performance, availability or scale targets. | S-000 states none; lines 99, 125. |
| R-308 | Detailed team-level match statistics are not collected; player-level data excluded by PD-04. | S-000 lines 18-23, 86; S-001 lines 25-27. |
| R-309 | Authorized brand assets are the PO-provided El Deporte Rey GT assets; no badge or mark authorized. | S-001 lines 22-23; S-000 lines 81-82. |
| R-310 | Fixed template text follows the project's content language. | S-001 line 34; S-000 lines 28-33. |
| R-311 | The "official competition publication" is the organiser's official publication and counts as an independent accepted source. | S-001 lines 4-5, 18. |
| R-312 | **New.** football-data.org's free plan allows 10 requests per minute and lists the Champions League in its free tier; the token's plan is unknown; the budget is configuration (default 10/min) and the probe confirms availability. | Orchestrator documentation review 2026-10-27 (policies, coverage, pricing pages; not an intake source); S-003 lines 52, 129-136. |
| R-313 | **New.** Free-plan scores and schedules are delayed by an unpublished amount; LIVE_DATA is not real-time. | Pricing page ("Scores delayed", "Schedules delayed"); S-003 line 137. |
| R-314 | **New.** Free-plan season history is unpublished; only seasons reported and confirmed are offered. | Competition and lookup-table documentation; S-003 line 135. |
| R-315 | **New.** Provider resources may contain person data and optional fields; allow-list mapping and optional handling. | Referee data in match objects could not be confirmed (truncated sample); S-003 lines 76-77. |
| R-316 | **New.** Terms of use, commercial-use, republishing and attribution conditions are unpublished and treated as not confirmed. | Orchestrator review (terms page not found; only a contact e-mail); S-003 lines 138-145. |
| R-317 | **New.** Liga Nacional de Guatemala has no public API accepted for the MVP; data only through MANUAL_DATA. | S-003 lines 255-258. |
| R-318 | **New.** "Provider data disagreements" means disagreement between football-data.org and another accepted source, handled by R-048. | S-003 line 192; S-001 lines 17-19. |
| R-319 | **New.** Web-form entry captures the same fields as the JSON and CSV formats, with the same validation. | S-003 lines 253, 267-268; S-001 lines 29-30. |

S-004 adds no assumption of its own; its open points are classified as R-439 and R-440.

## 15. Proposed work items (MVP delivery phases)

The phases follow the "Initial Scope" priorities (S-000 lines 101-105) as replaced by R-137. They are proposals for the Orchestrator's planning. Superseded records are not listed; their replacements are.

| Work-item ID | Title | Records |
|--------------|-------|---------|
| MVP-P1 | Phase 1: Foundation: local web interface for a single operator without login and bound to localhost, projects with a dynamic competition catalogue and selection of season, matchday or stage and data source, provider-neutral domain model and ingestion interface with DEMO_DATA fixtures and stub providers, credential handling and startup validation, runtime validation, automated test harness | R-001, R-013, R-014, R-020, R-056, R-058, R-059, R-072, R-073, R-074, R-075, R-076, R-100, R-103, R-104, R-105, R-106, R-107, R-108, R-109, R-110, R-111, R-113, R-114, R-115, R-116, R-117, R-118, R-120, R-121, R-122, R-123, R-124, R-125, R-126, R-127, R-137, R-138, R-139, R-140, R-141, R-200, R-222, R-223, R-224, R-225, R-226, R-234, R-235, R-241, R-242, R-243, R-257, R-260, R-261, R-262, R-263, R-264, R-265, R-266, R-268, R-269, R-282, R-283, R-284, R-286, R-287, R-288, R-289, R-291, R-300, R-306, R-307, R-319, R-400, R-401, R-403, R-415, R-427, R-428, R-431, R-436, R-438, R-439, R-440 |
| MVP-P2 | Phase 2: Verified matchday or stage results and standings: research through FootballDataProvider (LIVE_DATA) and ManualDataProvider (MANUAL_DATA), source attribution, two-source fact-checking with the dispute procedure and the three statuses, team- and competition-level data only | R-002, R-003, R-011, R-012, R-022, R-023, R-024, R-025, R-045, R-046, R-047, R-048, R-053, R-054, R-055, R-057, R-060, R-061, R-062, R-063, R-064, R-065, R-066, R-067, R-068, R-069, R-070, R-071, R-112, R-119, R-128, R-129, R-130, R-131, R-132, R-133, R-134, R-135, R-136, R-202, R-203, R-204, R-205, R-227, R-229, R-230, R-232, R-233, R-244, R-245, R-246, R-247, R-248, R-249, R-250, R-251, R-252, R-253, R-254, R-255, R-256, R-258, R-259, R-267, R-270, R-271, R-272, R-273, R-274, R-275, R-276, R-277, R-278, R-279, R-280, R-281, R-305, R-308, R-311, R-312, R-313, R-314, R-315, R-316, R-317, R-318, R-409, R-410, R-411, R-412, R-414, R-423, R-424, R-426, R-432, R-433, R-434, R-435, R-437 |
| MVP-P3 | Phase 3: Instagram carousel generation: content drafting in the project language, branded templates with badge slots and authorized assets, carousels with or without standings, deterministic rendering at 1080 x 1350, visual QA | R-004, R-005, R-006, R-010, R-027, R-028, R-029, R-030, R-031, R-032, R-033, R-034, R-035, R-036, R-037, R-049, R-050, R-051, R-052, R-077, R-207, R-208, R-209, R-211, R-212, R-213, R-214, R-228, R-231, R-236, R-237, R-238, R-285, R-301, R-302, R-303, R-309, R-310, R-402, R-404, R-407, R-408, R-413, R-416, R-418, R-420, R-422, R-425 |
| MVP-P4 | Phase 4: Review, per-slide and caption approval with final approval, manual export, history and traceability, and the multi-competition demonstration | R-007, R-008, R-009, R-026, R-038, R-039, R-040, R-041, R-042, R-043, R-044, R-206, R-215, R-216, R-217, R-218, R-219, R-220, R-221, R-240, R-290, R-304, R-405, R-406, R-419, R-421, R-429, R-430 |

Prerequisites by phase (none blocks DEMO_DATA work): MVP-P2 FootballDataProvider and ManualDataProvider need the R-116 security review (T11H) and the PO isolation decision; LIVE_DATA runs need the PO's token set locally and the capability probe (R-259). Publication in MVP-P4 of LIVE_DATA content needs an approved secondary source (R-432) and R-430; of MANUAL_DATA content, R-429. MVP-P3 final templates use official brand values when supplied (R-418, R-301, R-309).

## 16. Out of scope (MVP)

- Automatic publishing to any social platform (R-042, PD-09); other social platforms (R-138).
- Format-specific features beyond generic matchday-or-stage handling, such as bracket graphics or aggregate-score and qualification calculations (R-439); provider-specific features the multi-competition capability does not need (R-137).
- Player-level or other person data of any kind, from providers or imports (R-112, R-119, PD-04); detailed match statistics (R-308).
- Login, user accounts, several operators, hosting and remote access (R-113, R-114, PD-05).
- Club badges, competition logos or marks and any unauthorized logo (R-049, R-050, PD-03).
- Purchase of, subscription to or upgrade of any service without the PO's authorization, including football-data.org (R-111, R-136).
- Introducing FootballDataProvider or the manual input types before the new security review and PO isolation decision; hosted AI providers and other new input types under the same condition (R-116).
- Using operator-supplied manual data as an accepted verification source (R-071).
- Real-time live scores (R-313).
- Breaking changes to v1 of the http-api contract (R-117, PD-11).
- Manual override of unverified or disputed facts (R-412, R-048); deletion of history (R-419); alerts on source corrections after export.

## 17. Risks

| ID | Risk | Mitigation / owner | Records |
|----|------|--------------------|---------|
| RK-01 | Data-source terms may not permit republishing derived content, or may cost more than expected. | Provider findings record; no purchase or upgrade without authorization; PO decision R-430 before publication. No legal assessment is given here. | R-410, R-400, R-111, R-136, R-316, R-430 |
| RK-02 | The two-source rule may block content often; with only football-data.org nothing is publishable until a secondary source is approved. | Dispute procedure; clear reasons; secondary source proposed and approved (R-432). | R-047, R-048, R-055, R-423, R-026, R-432 |
| RK-03 | AI-generated text may state invented numbers or non-official names. | Check generated text against verified data; stub-based tests. | R-027, R-207, R-422, R-426, R-237 |
| RK-04 | Generative imagery may distort scores or names. | Deterministic rendering of fact-bearing text. | R-035, R-036, R-402 |
| RK-05 | Use of club badges or competition marks. | PD-03; no legal assessment. | R-413, R-034, R-049, R-050, R-309 |
| RK-06 | Instagram format or limits change. | Dimensions and slide limit as configuration. | R-407, R-408, R-238 |
| RK-07 | Provider rate limits (10 requests/minute on the free plan), delays and outages, made worse by discovery across several competitions. | Request budget, header-driven waiting, caching, lazy season and stage requests, bounded retries. | R-131, R-132, R-141, R-130, R-312, R-313 |
| RK-08 | Provider or imported text may contain instructions aimed at the AI stages. | Treat as data; validation; the new security review before real adapters and new input types. | R-105, R-302, R-115, R-116 |
| RK-09 | Content produced before all matches of a matchday are final. | Result slides only for verified final results. | R-409 |
| RK-10 | Multi-competition support adds premature complexity. | Generic stage handling only; no format-specific extras; review against R-109. | R-109, R-137, R-439 |
| RK-11 | The roster has no front-end role enabled although a web interface is required. | Closed by the configuration task T06 when verified. | R-020 |
| RK-12 | The football-data.org token could leak through code, Git, the frontend, logs or evidence. | Credential rules and their ACs; secret scanning. | R-120 to R-127, R-260 to R-266 |
| RK-13 | Without login, any local process or web page can reach the localhost service. | Protections against other local origins; loopback binding. | R-113, R-114 |
| RK-14 | Providers use different team name forms. | Team identity matching; official name from the official source. | R-426, R-424 |
| RK-15 | **New.** MANUALLY_APPROVED may be read as verified. | Separate status, labels and audit; never counted toward agreement; PO decision R-429 on publication. | R-070, R-071, R-272, R-429 |
| RK-16 | **New.** Operator entry errors in manual data cannot be cross-checked by a second source. | Schema validation, clear errors, duplicate prevention, reimport, explicit operator approval. | R-060 to R-069 |
| RK-17 | **New.** Synthetic DEMO_DATA content published as real. | Demonstration labelling. | R-438, R-269 |
| RK-18 | **New.** Champions League assumptions leak into core code. | Static check and provider-neutral contracts. | R-139, R-140, R-288, R-289 |
| RK-19 | **New.** The PO's plan may cover fewer than two LIVE_DATA competitions or fewer seasons than expected. | Capability probe; report to the PO; no upgrade without authorization. | R-136, R-259, R-440, R-314 |

## 18. Architecture considerations (for the Architect)

These are considerations, not decisions. The stack is proposed by the Architect (R-103).

- AC-01 Workflow stages as separate modules with typed, runtime-validated inputs and outputs (R-104, R-105), testable against fixtures (R-225).
- AC-02 A verified-fact model separate from generated content, with provenance on every element and a disputed state (R-024, R-028, R-044, R-048, R-423).
- AC-03 Deterministic, template-based placement of fact-bearing values (R-035, R-036, R-402).
- AC-04 Some "agents" may be deterministic code; recomputed standings never replace the two-source rule (R-302, R-047).
- AC-05 Adapters selected by configuration, with fixtures for the primary source, the verification source and the official publication (R-106, R-110, R-223, R-241).
- AC-06 Versioned content so that approval binds to an exact version (R-406, R-043, R-044).
- AC-07 Provider, imported and web content are untrusted input to the AI stages (RK-08); PD-10 covers only its T11B scope (R-115, R-116).
- AC-08 Credentials only from local, never-committed configuration (R-120 to R-127).
- AC-09 Local-first storage without hosted infrastructure (R-100, R-109, R-403).
- AC-10 Competition, platform format and publication mode as configuration or data (R-138, R-226).
- AC-11 Loopback binding and no login; protections against other local origins (R-113, R-114, RK-13).
- AC-12 Provider findings record per PD-01 and PD-12, including the capability probe results (R-136, R-242, R-281).
- AC-13 Team identity matching; no player, person or user-account data (R-426, R-112, R-119, R-233).
- AC-14 Content language as a project attribute; badge slots that render complete slides when empty (R-051, R-310, R-050).
- AC-15 The http-api contract evolves under PD-11 (R-117): the new catalogue, stage, data-source and status concepts are assessed under Contract Safety.
- AC-16 **New.** One ingestion interface with FootballDataProvider, ManualDataProvider and FixtureDataProvider; provider-neutral shared contracts (Competition, Season, Stage, Matchday, Match, Team, Standing, Source, Verification status); provider-specific extensions kept adapter-side (R-118, R-140, R-059).
- AC-17 **New.** Provider identifiers (CL, 2001, the base URL) only in adapter configuration, enforced by a static check (R-139, R-289).
- AC-18 **New.** Catalogue and discovery under a shared request budget with header-driven waiting, caching of mapped projections and lazy per-competition requests; controllable clock for tests (R-131, R-132, R-141).
- AC-19 **New.** Allow-list mapping of provider responses; manual import pipeline with schema validation, whole-import application, versioning and preserved originals (R-119, R-060 to R-069, R-435).
- AC-20 **New.** Status model VERIFIED / UNVERIFIED with reason / MANUALLY_APPROVED, with manual approval limited to MANUAL_DATA facts (R-070, R-071, R-433).
- AC-21 **New.** UI and templates that handle matchdays and stages, with or without standings (R-074, R-077, R-285).
- AC-22 **New.** The new security review (T11H) covers FootballDataProvider and the JSON, CSV and web-form inputs before they are introduced (R-116).
