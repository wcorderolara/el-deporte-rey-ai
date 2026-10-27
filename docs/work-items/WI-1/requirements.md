# WI-1: El Deporte Rey GT AI sports content platform (MVP)

| Field | Value |
|-------|-------|
| Work item | WI-1 |
| Mode | incremental (as in the current intake record; the document keeps the full structure written at T01) |
| Starting point | SP-4 (several documents: the inline launch text S-000 and the Product Owner decision records S-001 and S-002); override: none |
| Records file | `docs/work-items/WI-1/requirements.json` |
| Intake record | `docs/work-items/WI-1/intake/intake-record.json` |
| Language | en |
| Revision | T04 (2026-10-27): Product Owner decisions PD-01 to PD-09 (S-001) applied as an incremental update of the T01 requirements. T11B (2026-10-27): Product Owner decisions PD-10 and PD-11 (S-002) recorded as an incremental update. Record IDs of T01 and T04 are unchanged |

## Sources

| Source ID | Path | Type | Precedence level | Hash |
|-----------|------|------|------------------|------|
| S-000 | `docs/work-items/WI-1/intake/sources/inline-001.md` | frd (inline record of the Product Owner launch text) | 1 | `b55dc299ab338c57d3555a183ccd11336c6f97bd79708a1f2737e7bdd6251aa2` |
| S-001 | `docs/work-items/WI-1/intake/sources/po-decisions-2026-10-27.md` | decision-record (Product Owner decisions of 2026-10-27) | 1 | `de838ea30275c967d31e8e6886da138ca4a5c18f876f991f239c6df39cd952d9` |
| S-002 | `docs/work-items/WI-1/intake/sources/po-decisions-2026-10-27-stage2.md` | decision-record (Product Owner stage-2 decisions of 2026-10-27, answering escalations E-07 and E-08) | 1 | `99d18619acb2134b7c2c01e9569863fa4d425762fc3059a05fe5ad1693066512` |

The intake record lists three inputs (SP-4) and sets mode `incremental`. Records cite S-000 by heading and line range, and S-001 and S-002 by line range (they have no headings). No source has identifiers of its own for requirements (S-001 refers to the R-4nn question IDs of this document; S-002 refers to the escalation IDs E-07 and E-08 of the tracker), so every record has `originalId: null`. At T04 the project had no code, no contracts, no architecture and an empty source of truth; since then the architecture proposal (`docs/work-items/WI-1/architecture/`), its security design review (`docs/work-items/WI-1/security/design-review.md`) and the source-of-truth decision register (PD-01 to PD-09, BR-01 to BR-11, SC-01 to SC-04) exist. They are not intake sources; this document cites them only in basis text.

Product Owner decision IDs (tracker Decisions table) and their source lines:

| Decision | Source and lines | Applies to |
|----------|------------------|------------|
| PD-01 | S-001 3-11 | R-410 (option c): R-045, R-046, R-110, R-111, R-400, R-401 |
| PD-02 | S-001 13-19 | R-411 (option a): R-025, R-047, R-048, R-423, R-424 |
| PD-03 | S-001 21-23 | R-413 (option c): R-034, R-049, R-050, R-309 |
| PD-04 | S-001 25-27 | R-414 (option a): R-112, R-308 |
| PD-05 | S-001 29-31 | R-415 (option a): R-113, R-114, R-300 |
| PD-06 | S-001 33-35 | R-416 (language c, names i): R-035, R-051, R-052, R-425, R-426 |
| PD-07 | S-001 39 | Default branch `main`: a project fact, not a product requirement; no record |
| PD-08 | S-001 40-42 | Frontend required: confirms R-020; enabling the frontend-developer role is a configuration task (section 12) |
| PD-09 | S-001 43-46 | Confirms R-408 (1080 x 1350), R-405 (per slide and caption plus final approval), R-417 (league phase only) and R-042 (no automatic publication) |
| PD-10 | S-002 1 ("E-07 A") | R-427 (option A, escalation E-07, architecture issue U-03): R-115, R-116 |
| PD-11 | S-002 1 ("E-08 approve as written with your recommendations") | R-428 (escalation E-08, architecture issue U-04): R-117 |

Reading notes:
- The "Research Agent", "Fact-Checking Agent", "Content Agent", "Graphic Design Agent" and "Visual QA Agent" of S-000 are **product features** (stages inside the product), not framework roles (R-302).
- The "Orchestration" section of S-000 (lines 127-147) and the "Execution" list and closing lines of S-001 (lines 41-42, 48-61) are process directions to the framework, not product requirements. They are listed in section 12.
- Where a source says the same thing more than once (for example reusable templates in S-000 lines 59, 79 and 119), the statements are merged into one record that cites every location. No source reference was dropped.
- When S-001 chooses an option of a question by letter ("Option C"), the option text written in the question record is part of what was decided, together with the S-001 wording. Where the S-001 wording adds to the option text (R-411), S-001 wins.
- S-002 is a one-line answer that chooses by reference: "E-07 A" adopts option A of the options presented for escalation E-07 (security design review section 5, "Q2 and U-03", options table), and "E-08 approve as written with your recommendations" approves the contract-evolution policy of `architecture-delta.md` section 2.1 ("Versioning and compatibility") as recommended (section 8, U-04). As for S-001, the option and policy texts presented to the Product Owner are part of what was decided; they are written into the question records R-427 and R-428.

## 1. Business context

El Deporte Rey GT (social handle @ElDeporteReyGT, mascot KETSI) publishes sports content on social media. The Product Owner wants an AI-assisted platform that researches sports events, verifies the facts, prepares social media content and generates professional visual assets for publication (S-000 lines 5-10, 67-71). The first use case is UEFA Champions League matchday coverage (line 12), delivered as a local-first MVP that produces Instagram carousels for manual publication (lines 99-105). The Product Owner has set the data sources, the verification rule, the use of marks, the data scope, the user model and the content language (S-001, PD-01 to PD-06), and, at stage 2, the handling of untrusted input and the evolution policy of the HTTP API contract (S-002, PD-10 and PD-11).

T11B scope (incremental): two Product Owner decisions are recorded. PD-10 accepts in-process processing of untrusted input for WI-1's scope with compensating controls (R-115) and makes a new security review and Product Owner decision a precondition for real sports-data adapters, hosted AI providers and new input types (R-116). PD-11 sets the contract-evolution policy of the HTTP API contract (R-117). Nothing else changes.

## 2. Problem statement

S-000 states no explicit problem. Derived from the vision and the quality requirements (lines 5-10, 86-95): the brand needs matchday coverage content that is produced quickly, looks professional and consistent, and never contains invented or unverified scores, standings or names, with every published fact traceable to an attributable source and nothing published without explicit human approval.

## 3. Personas

| Persona | Description | Record |
|---------|-------------|--------|
| Content operator | The only platform user in the MVP ("the user" of S-000): creates projects, runs research, reviews, regenerates, approves and exports. A single local operator without login (PD-05). | R-300, R-113, R-114 |
| Audience (indirect) | Followers of @ElDeporteReyGT who see the manually published carousels. Not a platform user. | R-300 |

## 4. User stories

User stories are stored as functional records with the prefix "User story US-nn"; the functional requirements of section 5 refine them. The Product Owner decisions add no new story; they refine the stories through the requirements of section 5 and 6.

| Record ID | Story | Sources (S-000) |
|-----------|-------|-----------------|
| R-001 | US-01: As the content operator, I want to create a content project in a web interface by selecting a competition, season and matchday, so that the platform prepares coverage of that matchday. | Primary Workflow 16; Functional Requirements 54-55 |
| R-002 | US-02: As the content operator, I want the platform to research the selected matchday (results, teams and scores, dates, standings and competition context) and to show me the progress of the research, so that I receive structured, source-attributed data without collecting it by hand. | Primary Workflow 18-23; Functional Requirements 56-57 |
| R-003 | US-03: As the content operator, I want every fact to be verified independently against reliable sources and marked as verified or not verified, so that content with invented or unverified scores, standings or statistics cannot be approved. | Primary Workflow 25-26; Functional Requirements 58; Quality Requirements 86-90 |
| R-004 | US-04: As the content operator, I want the platform to draft the carousel structure, headlines, slide descriptions, social media caption and hashtags from the verified data, so that I start my review from a complete draft. | Primary Workflow 28-33 |
| R-005 | US-05: As the content operator, I want cover, match-result, standings and closing slides generated in the El Deporte Rey GT visual identity from reusable templates, so that every post looks professional and consistent. | Primary Workflow 35-39; Functional Requirements 59; Branding 67-77 |
| R-006 | US-06: As the content operator, I want an automated visual quality check of every slide before my review, so that wrong scores, standings or team names, overflowing text, inconsistent visuals and wrong dimensions are caught. | Primary Workflow 41-46 |
| R-007 | US-07: As the content operator, I want to preview the carousel and captions, regenerate individual slides and explicitly approve the content, so that nothing I have not approved can be exported. | Primary Workflow 48; Functional Requirements 60-61; Quality Requirements 94 |
| R-008 | US-08: As the content operator, I want to export the approved images and captions, so that I can publish them manually on Instagram. | Primary Workflow 50; Functional Requirements 62; Quality Requirements 95 |
| R-009 | US-09: As the content operator, I want a history of generated content with traceability from each exported slide back to its source data, so that I can revisit past content and show where every fact came from. | Functional Requirements 63; Quality Requirements 93 |
| R-010 | US-10: As the content operator, I want to manage reusable brand assets and carousel templates, and to have brand assets used only when they have actually been provided, so that the brand is applied consistently without placeholder or invented assets. | Functional Requirements 59; Branding 79-82 |

## 5. Functional requirements and business rules

Changed in T04: R-020, R-022, R-025, R-034, R-035, R-042, R-045 (added S-001 references; R-025, R-035 and R-045 statements now point to the decided rules). New in T04: R-046 to R-052. No change in T11B.

| Record ID | Original ID | Type | Statement | Sources (heading, lines) | Relationships |
|-----------|-------------|------|-----------|--------------------------|---------------|
| R-020 | - | functional | Web interface for managing content projects: create a project, list existing projects, open a project. A frontend is required (PD-08). | S-000 Functional Requirements 54; S-001 40 | refines R-001 |
| R-021 | - | functional | When creating a project the user selects competition, season and matchday; in the MVP the only competition is the UEFA Champions League (seasons and phases: R-417). | S-000 Product Vision 12; Primary Workflow 16; Functional Requirements 55; Initial Scope 102 | refines R-001; references R-417 |
| R-022 | - | functional | The Research Agent retrieves, for the selected matchday: match results; teams and scores; match dates; competition standings; relevant competition context. | S-000 Primary Workflow 18-23; S-001 3-5 | refines R-002; depends-on R-021; depends-on ext: licensed sports-data API (primary) and independent official source (verification) per PD-01 (R-046, R-400, R-111) |
| R-023 | - | functional | The user starts research from the project and follows its progress: each workflow stage is shown as pending, running, completed or failed; a failed stage reports its reason. | S-000 Functional Requirements 56 | refines R-002 |
| R-024 | - | functional | Research results are structured records; each fact carries source attribution (source, reference to its location in the source, retrieval time). | S-000 Functional Requirements 57-58; Quality Requirements 87 | refines R-002 |
| R-025 | - | functional | The Fact-Checking Agent independently verifies all factual information against reliable sources and records per fact: verified or not, sources used, reason when not verified. Verification rule: R-047 and R-048 (PD-02) for scores, match dates and standings; R-424 for other facts. | S-000 Primary Workflow 25-26; Functional Requirements 58; S-001 13-19 | refines R-003; depends-on R-024; references R-411, R-047, R-048, R-424 |
| R-026 | - | business-rule | If a fact cannot be verified, publication approval is blocked for the content affected by that fact (every slide, headline, slide description or caption that uses it) until it is verified; content that does not use the fact is not blocked. | S-000 Quality Requirements 89-90 | refines R-003; depends-on R-025; references R-412 |
| R-027 | - | business-rule | Never invent scores, standings or match statistics: every such value in generated content (slides, headlines, slide descriptions, captions) comes from the verified data; content containing such a value not in the verified data is flagged and cannot be approved. | S-000 Quality Requirements 86-90 | refines R-003; depends-on R-025; references R-422 |
| R-028 | - | functional | Verified facts are clearly distinguished from AI-generated commentary; each content element is identified as one or the other (presentation: R-404). | S-000 Quality Requirements 88 | refines R-003; references R-404 |
| R-029 | - | functional | The Content Agent prepares, from the verified data: carousel structure, headlines, slide descriptions, social media captions, relevant hashtags. | S-000 Primary Workflow 28-33 | refines R-004; depends-on R-025; depends-on ext: AI provider (R-401) |
| R-030 | - | functional | The Graphic Design Agent creates a cover slide, individual match-result slides (one per match), standings slides and a closing slide. | S-000 Primary Workflow 35-39 | refines R-005; depends-on R-029, R-031; references R-407 |
| R-031 | - | functional | Slides are produced from reusable branded carousel templates, reused across projects and matchdays. | S-000 Functional Requirements 59; Branding 79; Technical Direction 119 | refines R-005, R-010 |
| R-032 | - | functional | Templates apply the brand identity: El Deporte Rey GT, @ElDeporteReyGT, mascot KETSI (images only when provided), colours purple, gold, blue and white. | S-000 Branding 67-77 | refines R-005; references R-418 |
| R-033 | - | functional | Reusable brand assets: provided assets (for example logos, mascot images) are registered once and reused by templates across projects. | S-000 Branding 79 | refines R-010 |
| R-034 | - | business-rule | Logos, team badges and mascot images are not assumed to exist and are used only when provided; templates produce complete slides without them. | S-000 Branding 81-82; S-001 21-23 | refines R-010; references R-413, R-049, R-050 |
| R-035 | - | business-rule | Generated visuals preserve the exact verified scores and names; every score and name on a slide equals the verified value exactly (team names: the verified official names, R-052). | S-000 Quality Requirements 92; S-001 33-35 | refines R-005; references R-416, R-052 |
| R-037 | - | functional | The Visual QA Agent checks every slide: scores and standings match verified data; team names are correct; text fits the layout; visual consistency across the carousel; configured social media dimensions. Results per slide and per check; failure handling: R-420. | S-000 Primary Workflow 41-46 | refines R-006; depends-on R-025, R-030; references R-408, R-420 |
| R-038 | - | functional | Before approving, the user previews the carousel (all slides in order) with captions and hashtags. | S-000 Primary Workflow 48; Functional Requirements 60 | refines R-007 |
| R-039 | - | business-rule | Explicit user approval is required before any content can be exported for publication; only approved assets can be exported (granularity: R-405; after a change: R-406). | S-000 Primary Workflow 50; Functional Requirements 60; Quality Requirements 94 | refines R-007; references R-405, R-406 |
| R-040 | - | functional | The user can regenerate an individual slide without regenerating the other slides. | S-000 Functional Requirements 61 | refines R-007; references R-406 |
| R-041 | - | functional | The user exports approved assets for manual publication: slide images and captions with hashtags. | S-000 Primary Workflow 50; Functional Requirements 62 | refines R-008; depends-on R-039; references R-421 |
| R-042 | - | constraint | The MVP does not publish automatically to any social platform; publication is manual from the exported files (confirmed by PD-09). | S-000 Quality Requirements 95; Initial Scope 105; S-001 46 | refines R-008 |
| R-043 | - | functional | History of generated content: past projects with their slides, captions, approval state and exports can be listed and reopened. | S-000 Functional Requirements 63 | refines R-009; references R-419 |
| R-044 | - | functional | Traceability from source data to exported slides: for every exported slide, its facts, their verification status and their sources can be retrieved. | S-000 Quality Requirements 93; Functional Requirements 57 | refines R-009; depends-on R-024, R-025 |
| R-045 | - | business-rule | Facts are taken only from trustworthy, attributable data sources; the accepted sources are those of PD-01 (R-046): a licensed sports-data API as preferred primary source and an independent official source for verification. | S-000 Quality Requirements 87; Primary Workflow 25-26; S-001 3-5 | refines R-003; references R-410, R-411, R-046 |
| R-046 | - | business-rule | **New (PD-01).** Accepted data sources: research uses a licensed sports-data API as preferred primary source, and fact-checking uses an independent official source for verification. Only accepted sources can make a fact verified. Providers are selected under R-400 and not purchased or subscribed to without authorization (R-111). | S-001 3-5; S-000 Quality Requirements 87; Primary Workflow 25-26 | refines R-045; references R-410, R-400, R-111 |
| R-047 | - | business-rule | **New (PD-02).** A score, a match date or a standings value is verified only when two independent accepted sources (R-046) agree on it. A value reported by only one accepted source is not verified. | S-001 13-15; S-000 Primary Workflow 25-26 | refines R-025; references R-411, R-046 |
| R-048 | - | business-rule | **New (PD-02).** When accepted sources disagree on a fact, the fact is marked disputed and is not verified; the official competition publication is consulted (R-311); the fact is not marked verified until the discrepancy is resolved (R-423). Content using a disputed fact stays blocked (R-026); the user cannot mark it verified manually (R-412). | S-001 17-19; S-000 Quality Requirements 89-90 | refines R-025; depends-on R-047; references R-411, R-423, R-311, R-026, R-412 |
| R-049 | - | business-rule | **New (PD-03).** Team names and the competition name appear in content as text. Slides use only existing brand assets that are authorized (R-309); no unauthorized logo, club badge or competition mark is used. | S-001 21-23; S-000 Branding 81-82 | refines R-010; references R-413, R-034, R-309 |
| R-050 | - | functional | **New (PD-03).** Templates reserve optional badge slots (for example one per team on a match-result slide). A slot shows an image only when an authorized badge asset exists for that team; until the Product Owner allows badges (R-413 option (b)) no badge is authorized, so the slots stay empty and the slides remain complete (R-034). | S-001 21-23; S-000 Branding 81-82 | refines R-005; references R-413, R-034, R-309 |
| R-051 | - | functional | **New (PD-06).** Each content project has a content language, which sets the language of the generated headlines, slide descriptions, captions and hashtags. The language is configurable per project; a new project uses Spanish unless the user selects another language (selectable languages: R-425). | S-001 33-34; S-000 Primary Workflow 28-33 | refines R-004; references R-416, R-425, R-310 |
| R-052 | - | business-rule | **New (PD-06).** Team names are preserved as verified official names: in every content language, every slide, headline, slide description and caption shows a team's name exactly as its verified official name, without translation, abbreviation or other change (official-name source, hashtags and enforcement: R-426). | S-001 33-35; S-000 Primary Workflow 43; Quality Requirements 92 | refines R-035; references R-416, R-426 |

## 6. Non-functional requirements and constraints

New in T04: R-110 to R-114. New in T11B: R-115 to R-117.

| Record ID | Original ID | Type | Statement | Sources (heading, lines) | Relationships |
|-----------|-------------|------|-----------|--------------------------|---------------|
| R-036 | - | non-functional | Numeric information is rendered deterministically: the same verified data and template always produce the same numeric text; numbers are never produced by a non-deterministic generation step. | S-000 Quality Requirements 91 | refines R-005; references R-402 |
| R-100 | - | constraint | The MVP is local-first: the platform and its data run on the user's local machine (provider access: R-306). | S-000 Initial Scope 99 | references R-306 |
| R-101 | - | constraint | MVP priorities in order: (1) one competition, UEFA Champions League; (2) matchday results and standings; (3) Instagram carousel generation; (4) manual approval and export. | S-000 Product Vision 12; Initial Scope 101-105 | - |
| R-102 | - | non-functional | The design supports future extension to more competitions, more social platforms and automated publishing; these are not part of the MVP. | S-000 Initial Scope 107-108 | references R-109 |
| R-103 | - | constraint | The technology stack is not prescribed; the Architect proposes it based on these requirements. | S-000 Technical Direction 112-113 | - |
| R-104 | - | non-functional | Modular architecture with testable agent boundaries: each workflow stage has defined inputs and outputs and can be tested in isolation. | S-000 Technical Direction 116, 118; Primary Workflow 18-46 | references R-302 |
| R-105 | - | non-functional | Strong runtime validation of provider data and of data exchanged between stages; invalid data is rejected and not used. | S-000 Technical Direction 117 | - |
| R-106 | - | non-functional | Provider abstraction: AI and sports-data providers are configurable and replaceable by configuration without changing the workflow stages. | S-000 Technical Direction 120, 123 | references R-400, R-401 |
| R-107 | - | non-functional | Automated tests cover the workflow stages and the business rules of this document. | S-000 Technical Direction 121 | - |
| R-108 | - | non-functional | The platform can be developed, run and tested on a local machine. | S-000 Technical Direction 122 | - |
| R-109 | - | constraint | Avoid unnecessary infrastructure and premature complexity: no component that the MVP scope (R-101) does not need. | S-000 Technical Direction 125 | references R-101 |
| R-110 | - | constraint | **New (PD-01).** During development, research and verification run on synthetic fixture data supplied through the provider abstraction (R-106), not on data from real sports-data providers; automated tests use synthetic fixtures only (R-225). | S-001 9; S-000 Technical Direction 121-122 | references R-410, R-106, R-225 |
| R-111 | - | constraint | **New (PD-01).** No service (a sports-data API, an AI provider or any other service) is purchased or subscribed to without authorization from the Product Owner. | S-001 11 | references R-410, R-400, R-401 |
| R-112 | - | constraint | **New (PD-04).** The MVP is limited to team-level and competition-level data. No player-level information (for example player names, goal scorers, line-ups or player statistics) is collected, stored, generated or shown, and no personal data of users is kept (R-113). | S-001 25-27; S-000 Primary Workflow 18-23 | references R-414, R-308, R-113 |
| R-113 | - | constraint | **New (PD-05).** The MVP has a single local operator and no login: no user accounts, no sign-in step and no user management. | S-001 29-30; S-000 Initial Scope 99 | references R-415, R-300, R-114 |
| R-114 | - | constraint | **New (PD-05), security.** Development services are bound to localhost only: the web interface and every other network service the platform starts listen only on the loopback interface and accept no connection from another machine (the web interface in MVP use as well, R-415 option (a)). | S-001 29-31; S-000 Initial Scope 99 | references R-415, R-113, R-100 |
| R-115 | - | constraint | **New in T11B (PD-10), security.** Untrusted input processed in process: within WI-1's scope (sports data from synthetic fixtures (R-110), the stub or a local AI provider, operator-supplied PNG or JPEG brand files (R-033)), provider data, AI output and brand files may be parsed and decoded inside the platform process without thread or process isolation, provided these compensating controls are in place: allow-list schemas for provider data and AI output (R-105); size, dimension and timeout caps; file-signature checks on brand files; SVG files refused; no HTML parsing; inputs to slide rendering supplied as data URIs only; an egress lint rule that confines network access. The acceptance is limited to this scope (R-116). | S-002 1; S-000 Technical Direction 117 | references R-427, R-116, R-105, R-110, R-033, R-401 |
| R-116 | - | constraint | **New in T11B (PD-10 condition), security.** Before the first real sports-data adapter, any hosted AI provider, or any new input type (for example SVG, HTML or web scraping, or archives) is introduced, a new security review is carried out and the Product Owner takes a new decision on the isolation of untrusted-input processing; until then R-115 does not cover them. Within WI-1 the condition holds when WI-1 delivers no real sports-data adapter, no hosted AI provider and no new input type; the security validation checks this (security design review control V-30). | S-002 1 | references R-427, R-115, R-111, R-400, R-401, R-110 |
| R-117 | - | constraint | **New in T11B (PD-11).** Contract-evolution policy of the http-api contract: within version v1 only additive changes are made (new optional request fields, new response fields, new operations, new problem codes). Removing an operation, a field or a problem code, or changing its meaning, is a breaking change; a breaking change needs a new major version path and a Product Owner decision. A new required request field or header is not an additive change. | S-002 1 | references R-428, R-020 |

S-000, S-001 and S-002 set no performance, availability, scale or accessibility targets; these are not invented here (see R-307 and section 18). The security constraints set by the Product Owner are R-113 and R-114 (PD-05) and R-115 and R-116 (PD-10).

## 7. Acceptance criteria

Proportional: one or two testable criteria per requirement. There is no existing behaviour, so there are no regression criteria. Changed in T04: R-205, R-219, R-227 (S-001 references; R-205 and R-227 wording aligned with PD-01 and PD-02). New in T04: R-229 to R-242. T11B adds no acceptance-criterion record (see the note after the table).

| Record ID | Criterion (testable) | Requirement(s) | Sources |
|-----------|----------------------|----------------|---------|
| R-200 | Given the web interface is open, when the user creates a content project, then it appears in the project list and, when opened, shows its competition, season and matchday. | R-020 | S-000 Functional Requirements 54-55 |
| R-201 | The competition selector offers only the UEFA Champions League; the matchday selector lists only matchdays of the selected season; a project cannot be created until all three are selected. | R-021, R-101 | S-000 Functional Requirements 55; Initial Scope 101-102 |
| R-202 | With a fixture sports-data provider holding a known matchday, research returns every match with both teams, the score of each finished match and its date, the full standings and at least one competition-context item, all equal to the fixture values. | R-022 | S-000 Primary Workflow 18-23 |
| R-203 | While research runs, each stage status is shown; a simulated provider failure shows the stage as failed with a reason, and research can be started again. | R-023 | S-000 Functional Requirements 56 |
| R-204 | Every stored fact has a source, a source reference and a retrieval time; a fact without attribution is rejected by validation and not stored. | R-024 | S-000 Functional Requirements 57-58; Quality Requirements 87 |
| R-205 | After fact-checking every fact has a verification status; a fact with a seeded disagreement between sources that the official competition publication fixture does not settle is marked disputed and not verified, with a reason naming the sources. | R-025 | S-000 Primary Workflow 25-26; S-001 17-19 |
| R-206 | Given one unverified score, approval of every slide, headline or caption using it is refused with a message naming the fact, while content not using it can still be approved. | R-026 | S-000 Quality Requirements 89-90 |
| R-207 | Given a stub AI provider returning a caption (or headline) with a score not in the verified data, that caption (or headline) is flagged and cannot be approved. | R-027 | S-000 Quality Requirements 86-90 |
| R-208 | In the review view and in stored content, every text element is identified as verified fact or generated commentary. | R-028 | S-000 Quality Requirements 88 |
| R-209 | For a verified matchday, the content draft has an ordered carousel structure with a slide type per slide, a headline and description per slide, a caption and at least one hashtag. | R-029 | S-000 Primary Workflow 28-33 |
| R-210 | The carousel has a cover slide, one match-result slide per included match, at least one standings slide and a closing slide. | R-030 | S-000 Primary Workflow 35-39 |
| R-211 | Carousels for two matchdays from the same templates share layouts and use only the configured brand palette colours; a template change applies to every carousel generated afterwards. | R-031, R-032 | S-000 Functional Requirements 59; Branding 73-79 |
| R-212 | With no logo, team badge or mascot image provided, a complete carousel is generated without errors and without placeholder or substitute images for those assets. | R-034 | S-000 Branding 81-82 |
| R-213 | Rendering the same slide twice from the same data and template gives identical numeric text; every score and team name on a slide equals the verified value exactly. | R-035, R-036 | S-000 Quality Requirements 91-92 |
| R-214 | For each check (score or standing mismatch, wrong team name, text overflow, inconsistent style, wrong dimensions), a slide seeded with that defect fails that check by name, and a correct slide passes all checks. | R-037 | S-000 Primary Workflow 41-46 |
| R-215 | Before approval, the preview shows all slides in carousel order with the caption and hashtags. | R-038 | S-000 Primary Workflow 48; Functional Requirements 60 |
| R-216 | Export of content not explicitly approved is refused; after explicit approval export succeeds. | R-039 | S-000 Quality Requirements 94 |
| R-217 | Regenerating one slide changes only that slide; the regenerated slide goes through Visual QA again and needs approval again (R-406). | R-040 | S-000 Functional Requirements 61; Quality Requirements 94 |
| R-218 | Exporting an approved carousel produces one image per approved slide, in carousel order and at the configured dimensions, and a text file with the approved caption and hashtags. | R-041 | S-000 Primary Workflow 50; Functional Requirements 62 |
| R-219 | The MVP has no function that publishes to a social platform, and no export step sends data to one. | R-042 | S-000 Quality Requirements 95; S-001 46 |
| R-220 | After an export the project is in the history with its approval state and export time; reopening shows the same slides and captions that were exported. | R-043 | S-000 Functional Requirements 63 |
| R-221 | For any exported slide, the platform shows its facts, their verification status and their sources. | R-044 | S-000 Quality Requirements 93 |
| R-222 | Following the documented local setup, the full workflow runs on one local machine with external access only to the configured providers. | R-100, R-108 | S-000 Initial Scope 99; Technical Direction 122 |
| R-223 | Replacing the configured AI and sports-data providers with stubs needs only a configuration change, and the full workflow then runs end to end. | R-106 | S-000 Technical Direction 120-123 |
| R-224 | Provider or inter-stage data violating its expected structure (for example a missing score or malformed date) is rejected with a validation error and used in no content. | R-105 | S-000 Technical Direction 117 |
| R-225 | Each workflow stage has automated tests running it in isolation with fixture inputs; the test suite runs without access to real external providers. | R-104, R-107 | S-000 Technical Direction 116-121 |
| R-226 | The architecture review confirms that competition, target platform format (dimensions, maximum slides) and publication mode are configuration or data, not logic fixed in the workflow stages. | R-102 | S-000 Initial Scope 107-108 |
| R-227 | Every fact names its source, and only sources accepted under PD-01 (R-046) can make a fact verified; a fact supported only by another source stays not verified. | R-045, R-046 | S-000 Quality Requirements 87; S-001 3-5 |
| R-228 | A brand asset registered once is available to the templates of every later project without being provided again. | R-033 | S-000 Branding 79 |
| R-229 | **New.** Given synthetic fixtures for a primary source and an independent verification source: a score, match date or standings value on which both agree is marked verified and cites both sources; a value present only in the primary source is not verified; a value from a source that is not accepted does not count toward agreement. | R-046, R-047 | S-001 3-5, 13-15 |
| R-230 | **New.** Given a seeded disagreement between the two accepted sources on a score: the fact is marked disputed and not verified, the official competition publication fixture is consulted and the consultation is recorded, and content using the fact is blocked. When the official publication fixture agrees with one source, the fact becomes verified with that value and its record shows the dispute and its resolution; when the official publication is unavailable or agrees with neither source, the fact stays disputed and not verified, and no user action can mark it verified. | R-048 (R-423) | S-001 17-19; S-000 Quality Requirements 89-90 |
| R-231 | **New.** A generated carousel shows team names and the competition name as text; its slides contain no club badge, competition logo or competition mark image and no image that is not an authorized registered brand asset; the templates contain the reserved badge slots, which stay empty while no authorized badge exists, and every slide is complete. | R-049, R-050 | S-001 21-23; S-000 Branding 81-82 |
| R-232 | **New.** Given fixture provider data that includes player-level fields (for example goal scorers or line-ups), the stored research and verification results, the input passed to content drafting, the generated content and the exports contain no player-level field or value. | R-112 | S-001 25-27 |
| R-233 | **New.** The architecture review confirms that the data model has no player entity or player-level attribute and no user-account entity. | R-112, R-113 | S-001 25-30 |
| R-234 | **New.** With the platform started following the documented local setup, every listening network socket of the platform is bound to a loopback address; a connection to the web interface through the machine's non-loopback address, or from another machine, is refused. | R-114 | S-001 31 |
| R-235 | **New.** The web interface opens on the project list without a login step, and the platform offers no account creation, sign-in or user-management function. | R-113 | S-001 30 |
| R-236 | **New.** A project created without choosing a language has content language Spanish, and the content stage drafts its headlines, slide descriptions, caption and hashtags in Spanish (with a stub AI provider: the stage receives Spanish as the language); a project set to another selectable language (R-425) is drafted in that language; two projects with different languages keep their own settings. | R-051 | S-001 33-34 |
| R-237 | **New.** Given a fixture team whose verified official name contains accents or special characters, every slide, headline, slide description and caption generated for a Spanish and for an English project shows the name exactly as verified; a slide seeded with a translated or abbreviated name fails the Visual QA team-name check, and a caption or headline using such a form is flagged and cannot be approved (R-426). | R-052 | S-001 35; S-000 Quality Requirements 92 |
| R-238 | **New.** With the default configuration, every generated and exported slide is 1080 x 1350 pixels (portrait 4:5); Visual QA fails a slide of any other size. | R-037 (R-408) | S-001 43; S-000 Primary Workflow 46 |
| R-239 | **New.** The matchday selector offers only league-phase matchdays of the UEFA Champions League; knockout rounds cannot be selected. | R-021 (R-417) | S-001 45; S-000 Initial Scope 102-103 |
| R-240 | **New.** Final carousel approval is refused while any included slide or the caption is not approved or is blocked; export is refused without the final approval; once every included slide and the caption are approved, the final approval and the export succeed. | R-039 (R-405) | S-001 44; S-000 Quality Requirements 94 |
| R-241 | **New.** In the development configuration and in the automated test suite, research and verification run end to end on synthetic fixture data, and no request is made to a real sports-data provider. | R-110 | S-001 9 |
| R-242 | **New.** The architecture review confirms that the provider research covers, for each candidate provider, pricing, coverage, reliability and redistribution/licensing conditions; that development and automated testing need no purchased service or subscription; and that no service is purchased or subscribed to before the Product Owner authorizes it. | R-111 (R-400) | S-001 7-11 |

R-103 (stack proposed by the Architect) and R-109 (no unnecessary infrastructure) are checked in the architecture review rather than by a test.

T11B records (no new acceptance-criterion record, so the plan's acceptance criteria R-200 to R-242 are unchanged):
- R-115: the compensating controls are security controls already assigned to plan tasks and validated by the security validation against the controls of the security design review (section 9); the data-validation part is covered by R-224 and the fixture-only part by R-241.
- R-116: within WI-1 the condition is "no real sports-data adapter, no hosted AI provider, no new input type". The security validation checks it (design review control V-30: the U-03 decision ID is recorded and its conditions hold). Its future part (a new review and decision before such a change) is a process gate, not product behaviour that a WI-1 test can show.
- R-117: WI-1 creates the http-api contract at its first version and makes no later change to it, so the policy has no behaviour to test in WI-1. Later changes are assessed against it by the Contract Safety assessment of the framework's planning process.

Coverage of the Product Owner decisions that state behaviour: PD-01 by R-227, R-229, R-241, R-242; PD-02 by R-229, R-230, R-205; PD-03 by R-231, R-212; PD-04 by R-232, R-233; PD-05 by R-234, R-235; PD-06 by R-236, R-237; PD-09 by R-238, R-239, R-240, R-219. PD-10 and PD-11 set constraints verified as described above, without acceptance-criterion records.

## 8. Edge cases

| Edge case | Handling | Records |
|-----------|----------|---------|
| Match not finished, postponed or abandoned; matchday still in progress or not started | No result slide without a verified final result; status listed; standings show the "as of" time | R-409, R-026 |
| Accepted sources disagree on a score, date or standings row | Fact marked disputed and not verified; official competition publication consulted; verified only when two independent accepted sources support one value; affected content blocked meanwhile; no manual override | R-047, R-048, R-423, R-026, R-412, R-230 |
| Official competition publication unavailable, not yet updated, giving a third value, or identical to one of the disagreeing sources | Fact stays disputed and not verified; re-run verification later | R-423, R-311, R-230 |
| Only one accepted source has the value (for example the verification source has not yet published it) | Not verified until a second accepted source agrees; affected content blocked | R-047, R-026, R-229 |
| Sources use different name forms for the same team | Team identity matched across sources (Architect); official name taken from the official source; unmatched team not verified | R-426, R-424 |
| Provider unavailable, rate-limited, returns no data for the matchday, or returns malformed data | Stage shown as failed with reason; retry; invalid data rejected | R-023, R-203, R-105, R-224 |
| Provider data includes player-level fields (goal scorers, line-ups) | Fields not stored and not passed to content drafting | R-112, R-232 |
| League-phase matchday needs more slides than one Instagram carousel allows | Split into numbered carousels; user may exclude matches | R-407 |
| Long team names, accents or special characters | Text-fit check; exact verified official name preserved in every language | R-037, R-035, R-052, R-213, R-237 |
| Team names inside hashtags | Hashtag-safe form of the official name allowed; display text keeps the exact name | R-426 |
| Teams level on points in the standings | Order and values exactly as verified; no recomputed or invented order | R-035, R-047 |
| No brand assets provided; badge slot with no authorized badge | Complete slides without assets or placeholders; badge slots stay empty | R-034, R-050, R-212, R-231, R-301 |
| A badge or logo file is supplied without authorization | Not used on slides | R-049, R-309 |
| Operator supplies a brand file that is an SVG, or whose content is not a PNG or JPEG, or that exceeds the size or dimension caps | Refused; in-process processing is accepted only for PNG and JPEG files within the caps | R-115 |
| A real sports-data adapter, a hosted AI provider or a new input type (HTML or web scraping, archives) is proposed | Not covered by PD-10; needs a new security review and a new Product Owner decision on isolation first (and R-111 authorization for any paid service) | R-116, R-111 |
| Project content language changed after content was drafted | Changed content needs QA and approval again | R-051, R-406 |
| Slide regenerated, or research re-run, after approval | Approval lost; QA and approval again | R-406, R-217 |
| AI-generated caption or headline contains a number not in the verified data, or a non-official team-name form | Flagged; cannot be approved | R-027, R-207, R-422, R-426, R-237 |
| Source corrects a value after export | A new research run creates a new version; earlier approvals do not carry over; no correction alerts in the MVP | R-406, R-043 |
| Connection attempt to the web interface from another machine | Refused (loopback binding) | R-114, R-234 |
| Text fetched from a provider or web page contains instructions aimed at the AI stages | Treated as data; see risk RK-08 and architecture consideration AC-07 | R-105, R-302 |

## 9. Dependencies

External:

| Dependency | Needed by | Records |
|------------|-----------|---------|
| Sports-data providers per PD-01: a licensed sports-data API (preferred primary) and an independent official source (verification); provider research by the Architect (pricing, coverage, reliability, redistribution/licensing); Product Owner authorization before any purchase or subscription | Research, verification | R-022, R-046, R-110, R-111, R-400, R-410 |
| Official competition publication (consulted on disagreement) | Dispute resolution | R-048, R-311, R-423 |
| AI provider(s): selection by the Architect; any paid account authorized by the Product Owner | Content drafting and other AI-based stages | R-029, R-111, R-401 |
| New security review and Product Owner decision on isolation of untrusted-input processing (PD-10 condition) | The first real sports-data adapter, any hosted AI provider, any new input type | R-116, R-427 |
| Instagram carousel format (1080 x 1350 confirmed by PD-09; maximum slides), checked against Instagram's published specifications at implementation time | Design, Visual QA, export | R-407, R-408, R-238, R-303 |
| Brand values and authorized assets from the Product Owner (official colour values, fonts, logo, KETSI images) | Templates | R-301, R-309, R-418, R-033 |
| Architecture stage (stack, rendering, storage, team identity matching) | All implementation | R-103, R-402, R-403, R-426 |

Internal (record level): R-022 depends on R-021; R-025 depends on R-024; R-026, R-027 and R-029 depend on R-025; R-030 depends on R-029 and R-031; R-037 depends on R-025 and R-030; R-041 depends on R-039; R-044 depends on R-024 and R-025; R-048 depends on R-047.

Phase order: MVP-P1, then MVP-P2; MVP-P3 can start on fixture data in parallel with MVP-P2 but its acceptance needs verified data from MVP-P2; MVP-P4 needs MVP-P2 and MVP-P3.

Configuration note (not a requirement change): PD-08 confirms that a frontend is required (R-020). The project roster currently has `frontend-developer` disabled; enabling it is a separate configuration task of the Orchestrator (tracker T06), and the personal-data profile of the configuration follows PD-04 in the same task.

## 10. Decisions (with classification and source)

Every question of this work item is classified and resolved. ORCHESTRATOR_DECISION items are recommended reversible defaults for the Orchestrator to record; RESOLVED_BY_EXISTING_SOURCE items cite the deciding source, which for R-405, R-408, R-410 to R-411, R-413 to R-417 and R-423 is the Product Owner decision record S-001, and for R-427 and R-428 the Product Owner decision record S-002.

| Record ID | Question | Classification | Resolution or recommendation | Source / basis |
|-----------|----------|----------------|------------------------------|----------------|
| R-400 | Which sports-data provider(s)? | AUTONOMOUS_DECISION | For the Architect, bounded by PD-01: research of providers, pricing, coverage, reliability and redistribution/licensing for the primary and verification roles (R-046); provider-neutral (R-106); synthetic fixtures (R-110); no purchase or subscription without authorization (R-111). | S-000 lines 112-113, 120, 123; S-001 lines 3-11 |
| R-401 | Which AI provider(s) and models? | AUTONOMOUS_DECISION | For the Architect, behind the provider abstraction; stub for tests; credentials never in the repository; no paid account without the PO's authorization (R-111). | S-000 lines 112-113, 120, 123; S-001 line 11 |
| R-402 | Slide rendering approach? | AUTONOMOUS_DECISION | For the Architect, bounded by R-035 and R-036: fact-bearing text placed deterministically from verified data. | S-000 lines 91-92, 112-113 |
| R-403 | Data storage? | AUTONOMOUS_DECISION | For the Architect, bounded by R-100, R-109, R-043, R-044. | S-000 lines 99, 112-113, 125 |
| R-404 | Where is "verified fact" vs "commentary" shown? | ORCHESTRATOR_DECISION | Provenance label on every stored element and in the review view; no visible label on exported content; commentary states no unverified numbers (OD-01). | S-000 line 88; MED-04 |
| R-405 | Approval granularity? | RESOLVED_BY_EXISTING_SOURCE | Per-slide and caption review states plus a final carousel approval that requires all included items approved and none blocked; export needs the final approval. Confirmed by PD-09 (preserves OD-02). AC: R-240. | S-001 line 44; S-000 lines 48-50, 60, 89-94 |
| R-406 | Does approval survive a change? | RESOLVED_BY_EXISTING_SOURCE | No; approval binds to the exact version; changed content needs QA and approval again. | S-000 lines 93-94 |
| R-407 | Matchday exceeds the slides allowed in one carousel? | ORCHESTRATOR_DECISION | Configurable maximum; split into numbered carousels; user can exclude matches; individual match slides kept (OD-03). | S-000 lines 36, 46, 104; MED-04 |
| R-408 | Slide dimensions? | RESOLVED_BY_EXISTING_SOURCE | Portrait 4:5, 1080 x 1350 px, configurable, confirmed against Instagram's published specifications. Confirmed by PD-09 (preserves OD-04). AC: R-238. | S-001 line 43; S-000 lines 46, 104 |
| R-409 | Unfinished, postponed or abandoned matches; matchday in progress? | ORCHESTRATOR_DECISION | Result slides only for verified final results; others listed with status and left out; standings show "as of" time (OD-05). | S-000 lines 18-23, 86-90; MED-04 |
| R-410 | Which sports-data sources, and are their terms accepted? | RESOLVED_BY_EXISTING_SOURCE | **PD-01, option (c).** Licensed sports-data API as preferred primary source; independent official source for verification (R-046); Architect researches providers, pricing, coverage, reliability and redistribution/licensing (R-400); synthetic fixtures during development (R-110); no purchase or subscription without authorization (R-111). No legal assessment is given here. | S-001 lines 3-11 |
| R-411 | When is a fact "verified"? | RESOLVED_BY_EXISTING_SOURCE | **PD-02, option (a).** Scores, match dates and standings need agreement of two independent accepted sources (R-047); on disagreement the official competition publication is consulted and the fact stays unverified until resolved (R-048, R-423). The S-001 procedure takes precedence over the option (a) wording. | S-001 lines 13-19 |
| R-412 | Manual override of unverified content? | RESOLVED_BY_EXISTING_SOURCE | No override in the MVP; re-run verification or remove the affected content. | S-000 lines 86, 89-90 |
| R-413 | May slides use club badges and competition marks? | RESOLVED_BY_EXISTING_SOURCE | **PD-03, option (c).** Team names (and competition name) as text; only existing authorized brand assets; optional badge slots reserved and empty; no unauthorized logos (R-049, R-050, R-309). No legal assessment of trademark use is given here. | S-001 lines 21-23 |
| R-414 | Does the MVP process personal data? | RESOLVED_BY_EXISTING_SOURCE | **PD-04, option (a).** Team-level and competition-level data only; no player-level information (R-112); no user accounts, so no personal data of users (R-113). | S-001 lines 25-27 |
| R-415 | User and authentication model? | RESOLVED_BY_EXISTING_SOURCE | **PD-05, option (a).** Single local operator without login (R-113); development services and the web interface bound to localhost only (R-114). | S-001 lines 29-31 |
| R-416 | Content language and team-name display? | RESOLVED_BY_EXISTING_SOURCE | **PD-06.** Language option (c): configurable per project, Spanish by default (R-051, R-425). Names option (i): verified official names preserved (R-052, R-426). | S-001 lines 33-35 |
| R-417 | Seasons and phases in scope? | RESOLVED_BY_EXISTING_SOURCE | League phase only for the initial MVP, confirmed by PD-09 (preserves OD-06); knockout rounds later; other formats out. Seasons: OD-06 default stays (seasons the accepted source covers, starting with the current season). AC: R-239. | S-001 line 45; S-000 lines 12, 102-103 |
| R-418 | Exact colour values and fonts? | ORCHESTRATOR_DECISION | Provisional configurable values until the PO supplies official ones; no substitute logo or mascot (OD-07). | S-000 lines 73-77; MED-04 |
| R-419 | History retention and deletion? | ORCHESTRATOR_DECISION | Keep everything locally, no automatic expiry, no deletion function in the MVP (OD-08). | S-000 line 63; MED-04; HIGH-02 |
| R-420 | Visual QA failure handling? | ORCHESTRATOR_DECISION | Data, text-fit and dimension failures block the slide until a regenerated version passes; visual-consistency findings are warnings to acknowledge (OD-09). | S-000 lines 41-46, 89-92; MED-04 |
| R-421 | Export formats and naming? | AUTONOMOUS_DECISION | Instagram-accepted image format (lossless preferred), files in carousel order, captions as UTF-8 text. | S-000 lines 50, 62 |
| R-422 | Do captions and headlines fall under the no-invented-facts rule? | RESOLVED_BY_EXISTING_SOURCE | Yes; R-027 covers all generated content. | S-000 lines 86, 89-90 |
| R-423 | **New.** When is a disputed fact resolved? | RESOLVED_BY_EXISTING_SOURCE | Applying PD-02 as a whole: when one value is supported by two independent accepted sources (for example the official competition publication agrees with one of the disagreeing sources, or a later retrieval shows agreement). Otherwise (publication unavailable, no value, a third value, or the same source as a disagreeing one) the fact stays disputed and content stays blocked; re-running verification is allowed, manual verification is not (R-412). | S-001 lines 13-19; S-000 lines 89-90 |
| R-424 | **New.** Which verification rule applies to facts other than scores, match dates and standings? | ORCHESTRATOR_DECISION | Recommended reversible default: the PD-02 rule applies to every fact used in content (strictest reading of S-000 lines 25-26); commentary stating no fact is not verified. | S-001 lines 13-15; S-000 lines 25-26; MED-04 |
| R-425 | **New.** Which content languages are selectable? | ORCHESTRATOR_DECISION | Recommended reversible default: Spanish (default) and English, held as configuration. | S-001 line 34; R-416 options; MED-04 |
| R-426 | **New.** Which name is the "verified official name", how are name forms matched, and how is the rule enforced? | ORCHESTRATOR_DECISION | Recommended reversible default: official name from the independent official source (R-046); team identity matched across accepted sources (Architect), unmatched teams not verified; exact name in every language, with Visual QA failure on slides and flagging (not approvable) of headlines, descriptions and captions using another form; hashtags may use a hashtag-safe form. If the Orchestrator judges points (1) or (4) to be business-rule semantics, confirm with the PO in the next status report. | S-001 lines 4-5, 35; S-000 lines 43, 92; MED-04 |
| R-427 | **New in T11B.** May untrusted input (provider data, AI output, operator brand image files) be processed in the platform process without isolation (E-07, U-03)? Options: (A) accept for WI-1's scope with compensating controls and a re-review condition; (B) worker-thread isolation; (C) separate-process isolation. | RESOLVED_BY_EXISTING_SOURCE | **PD-10, option (A).** In-process processing accepted for WI-1's scope (synthetic fixtures, stub or local AI, operator PNG or JPEG brand files) with the compensating controls (R-115); the first real sports-data adapter, any hosted AI provider or any new input type (SVG, HTML or web scraping, archives) needs a new security review and a new PO decision on isolation (R-116). Options (B) and (C) not adopted. | S-002 line 1 ("E-07 A"); option texts: `security/design-review.md` section 5 "Q2 and U-03"; HIGH-03 |
| R-428 | **New in T11B.** Which contract-evolution policy governs the http-api contract (E-08, U-04)? | RESOLVED_BY_EXISTING_SOURCE | **PD-11.** Policy approved as written (R-117): within v1 only additive changes (new optional request fields, new response fields, new operations, new problem codes); removing or changing the meaning of an operation, field or code is a breaking change that needs a new major path and a PO decision. | S-002 line 1 ("E-08 approve as written with your recommendations"); policy text: `architecture/architecture-delta.md` section 2.1 "Versioning and compatibility"; HIGH-06 |

LOW decisions taken in T04 (inside the owned files only):
- LOW-1: Product Owner-decided questions (R-410, R-411, R-413 to R-416) and PO-confirmed defaults (R-405, R-408, R-417) are reclassified as RESOLVED_BY_EXISTING_SOURCE, citing S-001, with the earlier recommendation kept in the `recommendation` field for history where one existed.
- LOW-2: gaps left by the decisions are recorded as three assumptions (R-309 to R-311) and four classified questions (R-423 to R-426), rather than written into requirements.
- LOW-3: S-001 is cited by line range with a null heading, because it has no headings.
- LOW-4: new records numbered in the existing ranges (R-046 to R-052, R-110 to R-114, R-229 to R-242, R-309 to R-311, R-423 to R-426); no existing ID changed or removed.

LOW decisions taken in T11B (inside the owned files only):
- LOW-5: the two escalations answered by S-002 are recorded as question records R-427 and R-428 (RESOLVED_BY_EXISTING_SOURCE, citing S-002 line 1 with a null heading), following the pattern of R-410 to R-416, so that each decision has a record and an entry in this table; the option and policy texts presented to the Product Owner are written into the question statements.
- LOW-6: PD-10 is recorded as two constraints (R-115, the scoped acceptance with its compensating controls; R-116, the re-review condition) and PD-11 as one constraint (R-117); no acceptance-criterion record is added, for the reasons in section 7.
- LOW-7: the records file and this header take mode `incremental` from the current intake record; the document keeps its full structure, and new records are numbered in the existing ranges (R-115 to R-117, R-427, R-428); no existing ID changed or removed.

## 11. Conflicts

None between sources. S-000, S-001 and S-002 are all at precedence level 1 and do not contradict each other: S-001 decides questions that S-000 left open and confirms defaults derived from S-000; S-002 decides two escalations raised by the architecture stage that no earlier source decided. The intake record reports no duplicate, ID-collision, reference or dependency candidates.

One wording difference inside this document was settled by precedence, not recorded as a source conflict: the option (a) text of R-411 (written at T01, a level-5 requirements text) said that any disagreement leaves a fact not verified, while S-001 lines 17-19 (level 1) add a consultation of the official competition publication. The S-001 procedure applies (R-048, R-423).

Tensions inside the sources that are not source conflicts are handled as questions: individual match slides vs carousel size (R-407); future extensibility (R-102) vs no premature complexity (R-109), which the Architect balances; exact official team names vs hashtags and differing name forms of providers (R-426). PD-10 adds one more: the provider abstraction lets providers be replaced by configuration (R-106, R-401), while R-116 requires a new security review and Product Owner decision before a real sports-data adapter or a hosted AI provider is introduced. The two are compatible: R-106 governs how providers are wired, R-116 (with R-111) governs when a real or hosted one may be used; switching to stubs or fixtures (R-223, R-241) is unaffected.

## 12. Flagged embedded instructions (not acted on)

These lines are process directions to the framework, not product requirements. They do not change any policy, gate, precedence level or file ownership. Each one matches existing framework policy (`autonomy.md`, `intake.md`), so behaviour is the same with or without them. This task's deliverables come from the task brief, not from this text.

| Source ID | Location | Quoted text | Action |
|-----------|----------|-------------|--------|
| S-000 | Orchestration, lines 129-140 | `Use the installed ORCH-V3 framework. Start with requirements analysis and normalization. Generate: Product requirements. User stories. Acceptance criteria. Architecture considerations. Dependencies. Risks. Proposed MVP delivery phases.` | not-acted-on |
| S-000 | Orchestration, lines 142-143 | `Resolve routine technical decisions autonomously within established project policies.` | not-acted-on |
| S-000 | Orchestration, line 145 | `Do not begin implementation during this analysis phase.` | not-acted-on |
| S-000 | Orchestration, line 147 | `Do not push or deploy.` | not-acted-on |
| S-001 | lines 41-42 | `Enable the frontend-developer role in the project configuration through the authorized configuration workflow.` | not-acted-on (configuration change; the Orchestrator applies PD-08 in its own configuration task) |
| S-001 | lines 48-56 | `Execution: 1. Record all six Product Owner decisions. 2. Have the Product Manager update the requirements. 3. Verify traceability and acceptance criteria. 4. Update project configuration through the authorized workflow. 5. Run orch requirements check, tracker check and validate. 6. Commit the approved requirements changes to the work branch. 7. Report readiness for /orchestrate:plan WI-1.` | not-acted-on |
| S-001 | line 58 | `Resolve routine implementation details autonomously.` | not-acted-on |
| S-001 | line 60 | `Do not implement application features yet.` | not-acted-on |
| S-001 | line 61 | `Do not merge into main, push or deploy.` | not-acted-on |

Intake candidates: the intake record lists one instruction candidate, `instructions[0]` (S-001 line 61, rule merge-to-protected). It is resolved in `candidateResolutions` as `instruction-flagged` and listed above; it matches `autonomy.md` HIGH-08 and the configuration's `policy.authorizations` (merge, push and deploy all false). S-002 contains no embedded instruction: its single line answers the two escalations and directs no framework action, and the intake record lists no candidate for it.

## 13. Open questions (REQUIRES_PRODUCT_OWNER)

None. The six questions that required the Product Owner (R-410, R-411, R-413, R-414, R-415, R-416) were decided on 2026-10-27 by PD-01 to PD-06 (S-001) and are resolved in section 10. The gaps those decisions leave are classified there (R-423 RESOLVED_BY_EXISTING_SOURCE; R-424, R-425, R-426 ORCHESTRATOR_DECISION) or recorded as assumptions (R-309 to R-311). The two stage-2 escalations E-07 (untrusted-input isolation) and E-08 (contract-evolution policy) were decided on 2026-10-27 by PD-10 and PD-11 (S-002) and are resolved as R-427 and R-428. A future Product Owner decision is required by R-116 before a real sports-data adapter, a hosted AI provider or a new input type; it is a condition of PD-10, not an open question of WI-1.

## 14. Assumptions (each with its basis)

| Record ID | Assumption | Basis |
|-----------|------------|-------|
| R-300 | One user role, the content operator; followers are the audience, not users. | PD-05 (S-001 lines 29-30) confirms a single local operator without login (R-113); that followers are not users rests on S-000 referring only to "the user" (lines 16, 48). |
| R-301 | No logos, mascot images, badges or brand fonts have been provided yet. | S-000 lines 81-82; S-001 line 22 refers to existing authorized assets, but the inventory holds only the S-000 and S-001 texts. |
| R-302 | The five "agents" are functional product stages; whether each uses AI, deterministic code or both is an architecture decision. They are product features, not framework roles. | S-000 lines 18-46 describe responsibilities; lines 112-113 leave the stack to the Architect. |
| R-303 | Instagram is the only MVP platform; "social media dimensions" means the Instagram carousel format. | S-000 lines 104, 107-108. |
| R-304 | Export means local files (images and caption text) uploaded manually by the user. | S-000 lines 50, 62, 95, 99. |
| R-305 | "Relevant competition context" means short factual matchday context derived from competition data, and it is fact-checked. | S-000 line 23 is undefined; lines 25-26 require verifying all facts. |
| R-306 | Local-first is not offline: internet access is needed at run time for the providers. | S-000 lines 18-26, 87, 99, 123. |
| R-307 | No performance, availability or scale targets for the MVP; the load is that of one operator. | S-000 states none; lines 99, 125. |
| R-308 | Research collects only the items in S-000 lines 19-23; detailed (team-level) match statistics are not collected. Player-level data is excluded by PD-04 (R-112). | S-000 lines 18-23, 86; S-001 lines 25-27 exclude player-level data but not team-level statistics. |
| R-309 | **New.** Authorized brand assets are the El Deporte Rey GT assets the PO has provided for use; no club badge, competition logo or mark is authorized in the MVP; badges need a later PO decision (R-413 option (b)). | S-001 lines 22-23 do not say how an asset is authorized; S-000 lines 81-82 tie use to provision; adopted option (c) of R-413. |
| R-310 | **New.** Fixed template text (slide titles, labels) follows the project's content language. | S-001 line 34 sets a per-project language; S-000 lines 28-33 do not mention fixed template text. |
| R-311 | **New.** The "official competition publication" is the competition organiser's official publication of results, dates and standings, and it counts as an independent accepted source; it may coincide with the verification source of R-046 and is identified in the Architect's provider research. | S-001 line 18 names it without a publisher; S-001 lines 4-5 accept an independent official source; R-410 options. |

T11B adds no assumption: S-002, read with the option and policy texts it refers to, decides both escalations completely.

## 15. Proposed work items (MVP delivery phases)

The phases follow the "Initial Scope" priorities of S-000 (lines 101-105). They are proposals for the Orchestrator's planning, not approved work items. Records added in T04 and T11B are assigned to the phase that delivers them.

| Work-item ID | Title | Records |
|--------------|-------|---------|
| MVP-P1 | Phase 1: Foundation: local web interface for a single operator without login and bound to localhost, content projects and UEFA Champions League league-phase selection, provider abstraction with synthetic fixture and stub providers, runtime validation, automated test harness (priority 1) | R-001, R-020, R-021, R-100, R-101, R-102, R-103, R-104, R-105, R-106, R-107, R-108, R-109, R-110, R-111, R-113, R-114, R-115, R-116, R-117, R-200, R-201, R-222, R-223, R-224, R-225, R-226, R-234, R-235, R-239, R-241, R-242, R-300, R-306, R-307, R-400, R-401, R-403, R-415, R-417, R-427, R-428 |
| MVP-P2 | Phase 2: Verified matchday results and standings: research, source attribution, two-source fact-checking with the dispute procedure, team- and competition-level data only (priority 2) | R-002, R-003, R-022, R-023, R-024, R-025, R-045, R-046, R-047, R-048, R-112, R-202, R-203, R-204, R-205, R-227, R-229, R-230, R-232, R-233, R-305, R-308, R-311, R-409, R-410, R-411, R-412, R-414, R-423, R-424, R-426 |
| MVP-P3 | Phase 3: Instagram carousel generation: content drafting in the project language, branded templates with badge slots and authorized assets, deterministic slide rendering at 1080 x 1350, visual QA (priority 3) | R-004, R-005, R-006, R-010, R-027, R-028, R-029, R-030, R-031, R-032, R-033, R-034, R-035, R-036, R-037, R-049, R-050, R-051, R-052, R-207, R-208, R-209, R-210, R-211, R-212, R-213, R-214, R-228, R-231, R-236, R-237, R-238, R-301, R-302, R-303, R-309, R-310, R-402, R-404, R-407, R-408, R-413, R-416, R-418, R-420, R-422, R-425 |
| MVP-P4 | Phase 4: Review, per-slide and caption approval with final approval, manual export, history and traceability (priority 4) | R-007, R-008, R-009, R-026, R-038, R-039, R-040, R-041, R-042, R-043, R-044, R-206, R-215, R-216, R-217, R-218, R-219, R-220, R-221, R-240, R-304, R-405, R-406, R-419, R-421 |

Blocking Product Owner questions by phase: none. The six earlier blocking questions were decided by PD-01 to PD-06 on 2026-10-27, and the stage-2 escalations by PD-10 and PD-11. Remaining prerequisites, none of which blocks fixture-based work: MVP-P2 integration with real providers needs the Architect's provider research (R-400, R-242), for any paid service the Product Owner's authorization (R-111), and a new security review and Product Owner decision on isolation (R-116); until then MVP-P2 runs on synthetic fixtures (R-110). A hosted AI provider has the same prerequisites (R-111, R-116). MVP-P3 final templates use official brand values and authorized assets when the Product Owner supplies them (R-418, R-301, R-309); provisional values are used meanwhile.

## 16. Out of scope (MVP)

- Automatic publishing to any social platform (R-042, confirmed by PD-09); other social platforms and other competitions (R-102, R-101).
- Knockout rounds and other competition formats (R-417, PD-09).
- Player-level information of any kind (R-112, PD-04); detailed match statistics (R-308).
- Login, user accounts, several operators, hosting and remote access to the platform (R-113, R-114, PD-05).
- Club badges, competition logos or marks and any unauthorized logo (R-049, R-050, PD-03), until a Product Owner decision allows badges (R-413 option (b)).
- Purchase of, or subscription to, any service without the Product Owner's authorization (R-111, PD-01).
- Real sports-data adapters, hosted AI providers and new input types (SVG, HTML or web scraping, archives) without a new security review and Product Owner decision on isolation (R-116, PD-10).
- Breaking changes to v1 of the http-api contract (R-117, PD-11); they need a new major path and a Product Owner decision.
- Manual override of unverified or disputed facts (R-412, R-048); deletion of history (R-419).
- Alerts when a source corrects data after export.

## 17. Risks

| ID | Risk | Mitigation / owner | Records |
|----|------|--------------------|---------|
| RK-01 | Data-source terms may not permit republishing derived content, or may cost more than expected. | PD-01: the Architect researches pricing, coverage, reliability and redistribution/licensing for each candidate; no purchase or subscription without authorization; synthetic fixtures meanwhile. No legal assessment is given here. | R-410, R-400, R-110, R-111 |
| RK-02 | The two-source rule chosen in PD-02 may block content often (the verification source slow to update, or sources disagreeing). | Dispute procedure through the official competition publication; clear reasons per fact; re-run verification. | R-047, R-048, R-423, R-026, R-412 |
| RK-03 | AI-generated text may state invented numbers, claims or non-official team names. | Check all generated text against verified data and official names; stub-based tests. | R-027, R-207, R-422, R-426, R-237 |
| RK-04 | Generative imagery may distort scores or names. | Deterministic rendering of all fact-bearing text. | R-035, R-036, R-402 |
| RK-05 | Use of club badges or competition marks on public content. | PD-03: names as text, only authorized brand assets, badge slots empty, no unauthorized logos; badges only after a later PO decision. No legal assessment of trademark use is given here. | R-413, R-034, R-049, R-050, R-309 |
| RK-06 | Instagram format or limits change. | Dimensions (1080 x 1350, PD-09) and slide limit held as configuration. | R-407, R-408, R-238 |
| RK-07 | AI or data provider cost, rate limits and outages. | Provider abstraction, retries shown in the interface, cost raised to the PO with the architecture; no purchase without authorization. | R-106, R-401, R-023, R-111 |
| RK-08 | Text from providers or web pages may contain instructions aimed at the AI stages (prompt injection), which could alter content. | Treat all fetched content as data; validation; security review of the architecture; PD-10 compensating controls and the re-review before real or hosted providers or new input types. | R-105, R-302, R-115, R-116 |
| RK-09 | Content produced before all matches of a matchday are final. | Result slides only for verified final results; "as of" standings. | R-409 |
| RK-10 | Pressure toward extensibility adds premature complexity. | Extension points as configuration only; review against R-109. | R-102, R-109, R-226 |
| RK-11 | The roster has no front-end role enabled although a web interface is required. | PD-08 confirms the frontend; the Orchestrator enables the role in a configuration task (T06). Closed when that task is verified. | R-020 |
| RK-12 | Provider credentials (API keys) could leak into the repository. | Credentials kept out of the repository; security review. | R-401 |
| RK-13 | **New.** Without login, any process or browser page on the same machine can reach the localhost service (for example a cross-site request from a web page to localhost). | For the Architect and the security reviewer: protections against requests from other local origins; loopback binding verified by R-234. | R-113, R-114 |
| RK-14 | **New.** Providers use different name forms for the same team, so team identity may fail to match and block content. | Team identity matching designed by the Architect; official name from the official source. | R-426, R-424 |

## 18. Architecture considerations (for the Architect)

These are considerations, not decisions. The stack is proposed by the Architect (R-103).

- AC-01 Workflow stages as separate modules with typed, runtime-validated inputs and outputs (R-104, R-105), so that each can run against fixtures (R-225).
- AC-02 A verified-fact model separate from generated content, with provenance on every content element (R-024, R-028, R-044, R-404), and with a disputed state that records the disagreeing values, the consultation of the official publication and the outcome (R-048, R-423).
- AC-03 Deterministic, template-based placement of every fact-bearing value; any generative imagery limited to decoration (R-035, R-036, R-402).
- AC-04 Some "agents" may be better as deterministic code, for example Visual QA data checks; recomputing standings from verified results can be an extra check but does not replace the two-source rule (R-302, R-047).
- AC-05 Provider adapters with synthetic fixture and stub implementations, selected by configuration, including fixtures for the primary source, the verification source and the official competition publication (R-106, R-110, R-223, R-241).
- AC-06 Versioned content so that approval binds to an exact version and history and traceability are preserved (R-406, R-043, R-044).
- AC-07 Treat provider and web content as untrusted input to the AI stages; keep instructions and data apart (RK-08). Per PD-10, in-process processing with the compensating controls is accepted for WI-1's scope only (R-115, R-116).
- AC-08 Credentials supplied through local configuration that is never committed (R-401).
- AC-09 Local-first storage without separately hosted infrastructure (R-100, R-109, R-403).
- AC-10 Competition, platform format and publication mode as configuration points, for future extension without redesign (R-102, R-226).
- AC-11 Security: per PD-05, every service bound to the loopback interface and no login (R-113, R-114); consider protections against requests from other local origins (RK-13). Changing the binding or adding remote access is a security-sensitive change (autonomy.md HIGH-03).
- AC-12 Provider research deliverable per PD-01: for each candidate, pricing, coverage of the UEFA Champions League league phase, reliability and redistribution/licensing conditions, with a proposed primary and verification source and the official competition publication (R-400, R-311, R-242).
- AC-13 Team identity matching across sources and the official-name source (R-426); the data model holds no player-level or user-account data (R-112, R-113, R-233).
- AC-14 Content language as a project attribute passed to the content stage, with fixed template text per selectable language (R-051, R-310, R-425); badge slots in templates that render complete slides when empty (R-050).
- AC-15 The http-api contract evolves under the PD-11 policy (R-117): additive-only within v1; breaking changes need a new major path and a Product Owner decision.
